import { storage } from "../storage";
import { db } from "../db";
import { DataForSEOService, createDataForSEOService } from "./dataforseo";
import { TaskLogger, TaskContext } from "./task-logger";
import { serpParser } from "./serp-parser";
import type { Project, Keyword, InsertRankingsHistory, InsertKeywordCompetitorMetrics } from "@shared/schema";
import { rankingsHistory } from "@shared/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

const normalizeUrl = (url: string) => url.toLowerCase().replace(/\/+$/, '');

interface RankingsSyncResult {
  success: boolean;
  message: string;
  keywordsUpdated: number;
  competitorsFound: number;
  errors: string[];
  progress?: {
    total: number;
    processed: number;
    percentage: number;
  };
}

interface SerpResultWithCompetitors {
  keyword: string;
  position: number | null;
  url: string | null;
  serpFeatures: string[];
  competitors: Array<{
    domain: string;
    url: string;
    position: number;
    title: string;
  }>;
}

export class RankingsSyncService {
  private dataForSEO: DataForSEOService | null;
  private bulkBatchSize: number = 100; // Process up to 100 keywords per bulk API call
  private requestDelay: number = 300; // Delay between single keyword requests in ms

  constructor() {
    this.dataForSEO = createDataForSEOService();
  }

  async getSerpResultForSingleKeyword(
    keyword: string,
    domain: string,
    locationCode: number = 2840
  ): Promise<SerpResultWithCompetitors | null> {
    if (!this.dataForSEO) {
      throw new Error("DataForSEO not configured");
    }

    const task = [{
      keyword,
      location_code: locationCode,
      language_code: "en",
      device: "desktop",
      os: "windows",
      depth: 100,
    }];

    try {
      const response = await this.dataForSEO["makeRequest"]<{
        tasks: Array<{
          status_code: number;
          status_message: string;
          data?: { keyword: string };
          result: Array<{
            keyword: string;
            item_types?: string[];
            items: Array<{
              type: string;
              rank_group: number;
              rank_absolute: number;
              domain?: string;
              url?: string;
              title?: string;
              description?: string;
            }>;
          }>;
        }>;
      }>("/serp/google/organic/live/advanced", "POST", task);

      const taskResult = response.tasks?.[0];
      if (!taskResult || taskResult.status_code !== 20000) {
        console.log(`[SERP] API error for "${keyword}": ${taskResult?.status_message || 'Unknown error'}`);
        return null;
      }

      const result = taskResult.result?.[0];
      if (!result || !result.items) {
        return null;
      }

      const organicItems = result.items.filter(item => item.type === 'organic');
      const serpFeatures = this.extractSerpFeatures(result.item_types || []);

      // Case-insensitive domain matching
      const domainLower = domain.toLowerCase();
      const domainResult = organicItems.find(item => {
        const itemDomain = item.domain?.toLowerCase() || '';
        const itemUrl = item.url?.toLowerCase() || '';
        return itemDomain === domainLower ||
          itemDomain.includes(domainLower) ||
          itemUrl.includes(domainLower);
      });

      const competitors = organicItems
        .filter(item => item.domain && !item.domain.toLowerCase().includes(domainLower))
        .slice(0, 10)
        .map(item => ({
          domain: item.domain || '',
          url: item.url || '',
          position: item.rank_absolute,
          title: item.title || '',
        }));

      return {
        keyword,
        position: domainResult?.rank_absolute || null,
        url: domainResult?.url || null,
        serpFeatures,
        competitors,
      };
    } catch (error) {
      console.error(`[SERP] Error fetching "${keyword}":`, error);
      return null;
    }
  }

  async getSerpResultsWithCompetitors(
    keywords: string[],
    domain: string,
    locationCode: number = 2840,
    onProgress?: (processed: number, total: number) => void
  ): Promise<Map<string, SerpResultWithCompetitors>> {
    const results = new Map<string, SerpResultWithCompetitors>();

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];

      const result = await this.getSerpResultForSingleKeyword(keyword, domain, locationCode);
      if (result) {
        results.set(keyword, result);
      }

      if (onProgress) {
        onProgress(i + 1, keywords.length);
      }

      if (i < keywords.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }
    }

    return results;
  }

  private extractSerpFeatures(itemTypes: string[]): string[] {
    const featureMapping: Record<string, string> = {
      featured_snippet: "featured_snippet",
      people_also_ask: "people_also_ask",
      local_pack: "local_pack",
      knowledge_panel: "knowledge_panel",
      video: "video",
      images: "image_pack",
      shopping: "shopping",
      news: "news",
      top_stories: "top_stories",
      twitter: "twitter",
      related_searches: "related_searches",
    };

    return itemTypes
      .map(type => featureMapping[type])
      .filter(Boolean);
  }

  async syncRankingsForProject(projectId: string, keywordIds?: number[], crawlResultId?: number, taskContext?: TaskContext): Promise<RankingsSyncResult> {
    const errors: string[] = [];
    let keywordsUpdated = 0;
    let competitorsFound = 0;

    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        if (taskContext) {
          await TaskLogger.error(taskContext, `Project ${projectId} not found`);
        }
        return {
          success: false,
          message: `Project ${projectId} not found`,
          keywordsUpdated: 0,
          competitorsFound: 0,
          errors: [`Project ${projectId} not found`],
        };
      }

      if (!this.dataForSEO) {
        if (taskContext) {
          await TaskLogger.error(taskContext, "DataForSEO API credentials not configured");
        }
        return {
          success: false,
          message: "DataForSEO not configured",
          keywordsUpdated: 0,
          competitorsFound: 0,
          errors: ["DataForSEO API credentials not configured"],
        };
      }

      const keywords = await storage.getKeywords(projectId);
      let activeKeywords = keywords.filter(k => k.isActive);

      // If specific keyword IDs are provided, filter to only those keywords
      if (keywordIds && keywordIds.length > 0) {
        const keywordIdSet = new Set(keywordIds);
        activeKeywords = activeKeywords.filter(k => keywordIdSet.has(k.id));
        console.log(`[RankingsSync] Filtered to ${activeKeywords.length} selected keywords from ${keywordIds.length} requested IDs`);
        
        // Warn if some requested keywords weren't found
        if (activeKeywords.length < keywordIds.length) {
          const foundIds = new Set(activeKeywords.map(k => k.id));
          const missingIds = keywordIds.filter(id => !foundIds.has(id));
          console.log(`[RankingsSync] Warning: ${missingIds.length} requested keyword IDs not found or inactive`);
        }
      }

      if (activeKeywords.length === 0) {
        const message = keywordIds && keywordIds.length > 0
          ? `None of the ${keywordIds.length} selected keywords were found or active`
          : "No active keywords to sync";
        if (taskContext) {
          await TaskLogger.info(taskContext, message, { projectId, requestedIds: keywordIds?.length });
        }
        return {
          success: keywordIds ? false : true, // Failure if user selected specific keywords but none matched
          message,
          keywordsUpdated: 0,
          competitorsFound: 0,
          errors: keywordIds ? [message] : [],
        };
      }

      // Use America/Chicago timezone for date to match user's business day
      // This handles both CST (UTC-6) and CDT (UTC-5) automatically
      const today = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      const totalKeywords = activeKeywords.length;

      if (crawlResultId) {
        await storage.updateCrawlProgress(crawlResultId, 0, "fetching_rankings", totalKeywords);
      }

      if (taskContext) {
        await TaskLogger.info(taskContext, `Processing ${totalKeywords} active keywords`, {
          projectId,
          domain: project.domain,
          totalKeywords,
          selectedKeywordIds: keywordIds?.length || "all",
        });
      }

      // Always use Standard Method for cost savings (3.3x cheaper than Live)
      // Crawls are resumable - if server restarts, they continue from where they left off
      const useSelectedKeywordsMode = keywordIds && keywordIds.length > 0;
      const useLiveMethod = false; // Always use Standard Method for cost savings
      
      console.log(`[RankingsSync] Using STANDARD method for ${totalKeywords} keywords (resumable, cost-effective)`);
      
      // Check if this is a resumed crawl - load already-processed keyword IDs from details
      let alreadyProcessedIds = new Set<number>();
      if (crawlResultId) {
        const existingCrawl = await storage.getCrawlResult(crawlResultId);
        if (existingCrawl?.details && typeof existingCrawl.details === 'object') {
          const details = existingCrawl.details as { processedKeywordIds?: number[] };
          if (details.processedKeywordIds && Array.isArray(details.processedKeywordIds)) {
            alreadyProcessedIds = new Set(details.processedKeywordIds);
            console.log(`[RankingsSync] Resuming crawl - ${alreadyProcessedIds.size} keywords already processed`);
          }
        }
      }
      
      // Filter out already-processed keywords for resumed crawls
      const keywordsToProcess = activeKeywords.filter(k => !alreadyProcessedIds.has(k.id));
      console.log(`[RankingsSync] Processing ${keywordsToProcess.length} remaining keywords (${alreadyProcessedIds.size} already done)`);
      
      if (keywordsToProcess.length === 0) {
        return {
          success: true,
          message: `All ${totalKeywords} keywords already processed`,
          keywordsUpdated: alreadyProcessedIds.size,
          competitorsFound: 0,
          errors: [],
        };
      }

      let lastProgressLog = 0;
      let lastProgressUpdate = 0;
      let processedKeywords = alreadyProcessedIds.size; // Start from already processed count
      const allProcessedIds = new Set(alreadyProcessedIds); // Track all processed IDs for checkpoint saves

      // Process keywords in bulk batches using DataForSEO bulk API
      // DataForSEO API handles up to 100 keywords per request
      const RESUMABLE_BATCH_SIZE = 100;
      for (let i = 0; i < keywordsToProcess.length; i += RESUMABLE_BATCH_SIZE) {
        const batch = keywordsToProcess.slice(i, Math.min(i + RESUMABLE_BATCH_SIZE, keywordsToProcess.length));
        const keywordTexts = batch.map(kw => kw.keyword);
        
        if (batch.length === 0) {
          console.warn(`[RankingsSync] Empty batch at index ${i}, skipping`);
          continue;
        }
        
        try {
          const batchNum = Math.floor(i / RESUMABLE_BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(keywordsToProcess.length / RESUMABLE_BATCH_SIZE);
          console.log(`[RankingsSync] Fetching SERP data for batch ${batchNum}/${totalBatches} (${batch.length} keywords): ${keywordTexts.slice(0, 3).join(", ")}${keywordTexts.length > 3 ? "..." : ""}`);
          
          let serpData: {
            rankings: Map<string, { keyword: string; rank_group: number; rank_absolute: number; domain: string; url: string; title: string; description: string; breadcrumb: string; is_featured_snippet: boolean; is_image: boolean; is_video: boolean; } | null>;
            competitors: Map<string, Array<{ domain: string; position: number; url: string; title: string; }>>;
            serpFeatures: Map<string, string[]>;
            rawSerpItems?: Map<string, any[]>;
          };
          
          // Always use Standard method for cost savings (3.3x cheaper)
          // Progress callback for real-time updates during batch processing
          const onProgress = async (batchProcessed: number, _batchTotal: number) => {
            const currentTotal = alreadyProcessedIds.size + i + batchProcessed;
            if (crawlResultId && currentTotal - lastProgressUpdate >= 5) {
              await storage.updateCrawlProgress(crawlResultId, currentTotal, "fetching_rankings");
              lastProgressUpdate = currentTotal;
            }
          };
          
          serpData = await Promise.race([
            this.dataForSEO.getSerpRankingsStandardMethod(keywordTexts, project.domain, 2840, onProgress),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error("SERP API request timed out after 12 minutes")), 720000)
            )
          ]);
          
          // Update processed count after batch completes
          processedKeywords = alreadyProcessedIds.size + i + batch.length;
          
          const { rankings: bulkRankings, competitors: bulkCompetitors, serpFeatures: bulkFeatures } = serpData;
          console.log(`[RankingsSync] Received SERP data: ${bulkRankings.size} rankings, ${bulkCompetitors.size} competitor sets`);

          // Batch database operations for better performance
          const dbOperations: Promise<void>[] = [];

          for (const kw of batch) {
            const result = bulkRankings.get(kw.keyword);
            const kwCompetitors = bulkCompetitors.get(kw.keyword) || [];
            const features = bulkFeatures.get(kw.keyword) || [];

            if (result) {
              // Validate that we have a valid position (rank_absolute should be > 0)
              const position = result.rank_absolute;
              if (position && position > 0) {
                const historyData: Omit<InsertRankingsHistory, "keywordId" | "date"> = {
                  projectId,
                  position: position,
                  url: result.url,
                  device: "desktop",
                  locationId: kw.locationId,
                  serpFeatures: features,
                };

                // Batch database writes - save to rankings_history
                dbOperations.push(
                  storage.upsertRankingsHistory(kw.id, today, historyData).then(() => {
                    keywordsUpdated++;
                    console.log(`[RankingsSync] Saved ranking for "${kw.keyword}": position ${position}`);
                  }).catch((err) => {
                    console.error(`[RankingsSync] Failed to save ranking for keyword "${kw.keyword}":`, err);
                    errors.push(`Failed to save ranking for keyword ${kw.keyword}: ${err}`);
                  })
                );

                // CRITICAL FIX: Also update keywordMetrics for Keywords table, Quick Wins, Falling Stars
                dbOperations.push(
                  (async () => {
                    try {
                      // Get previous position for delta calculation
                      const existingMetrics = await storage.getKeywordMetrics(kw.id, 1);
                      const previousPosition = existingMetrics.length > 0 ? (existingMetrics[0].position || position) : position;
                      const positionDelta = previousPosition - position; // Positive = improved, Negative = dropped
                      
                      // Calculate opportunity score
                      const searchVolume = kw.searchVolume || 0;
                      const difficulty = typeof kw.difficulty === 'string' ? parseInt(kw.difficulty, 10) : (kw.difficulty || 50);
                      const intent = kw.intentHint || "informational";
                      const opportunityScore = this.dataForSEO?.calculateOpportunityScore(position, searchVolume, difficulty, intent) || 0;
                      
                      await storage.upsertKeywordMetrics(kw.id, today, {
                        position,
                        previousPosition,
                        positionDelta,
                        searchVolume,
                        difficulty: String(difficulty),
                        intent,
                        serpFeatures: features,
                        opportunityScore: String(opportunityScore),
                      });
                    } catch (err) {
                      console.error(`[RankingsSync] Failed to update keyword metrics for "${kw.keyword}":`, err);
                    }
                  })()
                );
              } else {
                console.warn(`[RankingsSync] Invalid position (${position}) for keyword "${kw.keyword}". Domain found but position invalid. Result:`, {
                  rank_absolute: result.rank_absolute,
                  rank_group: result.rank_group,
                  url: result.url,
                  domain: result.domain
                });
                // Still count as processed even if we don't save
                keywordsUpdated++;
              }

              // Process competitors for this keyword (only if we have a valid result)
              if (position && position > 0) {
                for (const competitor of kwCompetitors) {
                  // Ensure competitor.position is a valid number
                  const compPosition = typeof competitor.position === 'number' && competitor.position > 0 
                    ? competitor.position 
                    : null;
                  
                  if (!compPosition) {
                    console.warn(`[RankingsSync] Invalid competitor position for ${competitor.domain}: ${competitor.position}`);
                    continue;
                  }
                  
                  dbOperations.push(
                    storage.upsertKeywordCompetitorMetrics({
                      projectId,
                      keywordId: kw.id,
                      competitorDomain: competitor.domain,
                      competitorUrl: competitor.url,
                      latestPosition: compPosition,
                      ourPosition: result.rank_absolute || null,
                      avgPosition: compPosition.toFixed(2),
                      visibilityScore: this.calculateVisibilityScore(compPosition).toFixed(2),
                      serpFeatures: features,
                      isDirectCompetitor: compPosition <= 10,
                      clickShareEstimate: this.estimateClickShare(compPosition).toFixed(4),
                      lastSeenAt: new Date(),
                    }).then(() => {
                      competitorsFound++;
                    }).catch((err) => {
                      const errMsg = `Failed to save competitor ${competitor.domain} for keyword ${kw.keyword}: ${err}`;
                      errors.push(errMsg);
                    })
                  );
                }
              }
            } else {
              // Keyword not found in SERP - still count as processed
              console.log(`[RankingsSync] Keyword "${kw.keyword}" not found in SERP results (domain not ranking)`);
              keywordsUpdated++; // Count as processed even if not ranking
            }
          }

          // Execute all database operations concurrently
          // Use Promise.allSettled to ensure all operations complete even if some fail
          const results = await Promise.allSettled(dbOperations);
          const failed = results.filter(r => r.status === 'rejected').length;
          if (failed > 0) {
            console.warn(`[RankingsSync] ${failed} database operations failed in batch ${Math.floor(i / this.bulkBatchSize) + 1}`);
          }

          // SEID Integration: Process SERP layout data for Intent Intelligence
          // Only process if we have raw SERP items (Standard method returns them)
          const rawItemsExists = !!serpData.rawSerpItems;
          const rawItemsSize = serpData.rawSerpItems?.size || 0;
          console.log(`[RankingsSync] SEID check: rawSerpItems exists=${rawItemsExists}, size=${rawItemsSize}, batch=${batch.length} keywords`);
          
          if (rawItemsExists && rawItemsSize > 0) {
            try {
              const serpLayoutBatch: Array<{ keywordId: number; keyword: string; serpItems: any[] }> = [];
              let emptyItems = 0;
              
              for (const kw of batch) {
                const rawItems = serpData.rawSerpItems!.get(kw.keyword);
                if (rawItems && rawItems.length > 0) {
                  serpLayoutBatch.push({
                    keywordId: kw.id,
                    keyword: kw.keyword,
                    serpItems: rawItems,
                  });
                } else {
                  emptyItems++;
                }
              }
              
              console.log(`[RankingsSync] SEID batch prepared: ${serpLayoutBatch.length} with data, ${emptyItems} empty`);
              
              if (serpLayoutBatch.length > 0) {
                const layoutResult = await serpParser.processBatch(projectId, serpLayoutBatch);
                console.log(`[RankingsSync] SEID processed ${layoutResult.processed} layouts, generated ${layoutResult.alertsGenerated} alerts`);
              } else {
                console.warn(`[RankingsSync] SEID: No keywords with SERP layout data in this batch`);
              }
            } catch (serpLayoutErr) {
              console.error(`[RankingsSync] SEID layout processing error (non-fatal):`, serpLayoutErr);
            }
          } else {
            console.warn(`[RankingsSync] SEID skipped: rawSerpItems not available (exists=${rawItemsExists}, size=${rawItemsSize})`);
          }

          const progressPercent = Math.round(processedKeywords / totalKeywords * 100);
          
          // Log progress every 50 keywords or at milestones
          if (processedKeywords - lastProgressLog >= 50 || processedKeywords === totalKeywords) {
            console.log(`[RankingsSync] Progress: ${processedKeywords}/${totalKeywords} (${progressPercent}%)`);
            lastProgressLog = processedKeywords;
          }

          // Update crawl progress after batch (only if not already updated by callback)
          if (crawlResultId && processedKeywords > lastProgressUpdate) {
            await storage.updateCrawlProgress(crawlResultId, processedKeywords, "fetching_rankings");
            lastProgressUpdate = processedKeywords;
          }

          // CHECKPOINT: Save processed keyword IDs so crawl can resume if server restarts
          for (const kw of batch) {
            allProcessedIds.add(kw.id);
          }
          if (crawlResultId) {
            await storage.updateCrawlResult(crawlResultId, {
              details: {
                processedKeywordIds: Array.from(allProcessedIds),
                lastCheckpointAt: new Date().toISOString(),
              },
            });
            console.log(`[RankingsSync] Checkpoint saved: ${allProcessedIds.size}/${totalKeywords} keywords processed`);
          }

          // Log progress at milestones
          if (taskContext && (progressPercent === 25 || progressPercent === 50 || progressPercent === 75 || processedKeywords === totalKeywords)) {
            await TaskLogger.info(taskContext, `Keyword crawl progress: ${progressPercent}%`, {
              processed: processedKeywords,
              total: totalKeywords,
              keywordsUpdated,
              competitorsFound,
            });
          }
          
          // Batch 1 verification complete (2025-12-08). Standard Method confirmed working.
          // Full crawls now process all batches.
        } catch (err) {
          const errMsg = `Failed to process batch of ${batch.length} keywords: ${err}`;
          errors.push(errMsg);
          console.error(`[RankingsSync] Batch error:`, err);
          
          // Continue with next batch even if this one failed
          processedKeywords = Math.min(i + batch.length, totalKeywords);
          if (crawlResultId) {
            await storage.updateCrawlProgress(crawlResultId, processedKeywords, "fetching_rankings");
            lastProgressUpdate = processedKeywords;
          }
        }
      }

      // Final progress update to ensure we reach 100%
      if (crawlResultId && lastProgressUpdate < totalKeywords) {
        await storage.updateCrawlProgress(crawlResultId, totalKeywords, "fetching_rankings");
      }

      console.log(`[RankingsSync] Completed: ${keywordsUpdated}/${totalKeywords} keywords synced`);

      if (taskContext) {
        await TaskLogger.info(taskContext, `Ranking sync completed: ${keywordsUpdated}/${totalKeywords} keywords`, {
          keywordsUpdated,
          competitorsFound,
          errorsCount: errors.length,
        });
      }

      // Consider successful if we synced keywords, even with some minor errors
      // Only fail if no keywords were updated or errors exceed 10% of total
      const errorThreshold = Math.max(1, Math.ceil(totalKeywords * 0.1));
      const isSuccess = keywordsUpdated > 0 && errors.length < errorThreshold;
      
      return {
        success: isSuccess,
        message: `Synced ${keywordsUpdated} keywords with ${competitorsFound} competitor entries`,
        keywordsUpdated,
        competitorsFound,
        errors,
        progress: {
          total: totalKeywords,
          processed: keywordsUpdated,
          percentage: Math.round(keywordsUpdated / totalKeywords * 100),
        },
      };
    } catch (error) {
      if (taskContext) {
        await TaskLogger.error(taskContext, `Rankings sync failed: ${error}`, error);
      }
      return {
        success: false,
        message: `Rankings sync failed: ${error}`,
        keywordsUpdated,
        competitorsFound,
        errors: [...errors, String(error)],
      };
    }
  }

  private calculateVisibilityScore(position: number): number {
    if (position <= 0) return 0;
    if (position === 1) return 100;
    if (position <= 3) return 90 - (position - 1) * 10;
    if (position <= 10) return 70 - (position - 3) * 5;
    if (position <= 20) return 35 - (position - 10) * 2;
    return Math.max(0, 15 - (position - 20) * 0.5);
  }

  private estimateClickShare(position: number): number {
    const ctrByPosition: Record<number, number> = {
      1: 0.316,
      2: 0.147,
      3: 0.094,
      4: 0.063,
      5: 0.044,
      6: 0.033,
      7: 0.025,
      8: 0.020,
      9: 0.016,
      10: 0.013,
    };

    if (position <= 10) {
      return ctrByPosition[position] || 0.01;
    }
    return Math.max(0.001, 0.01 / (position - 9));
  }

  async syncDailyRankings(): Promise<RankingsSyncResult[]> {
    const results: RankingsSyncResult[] = [];
    const projects = await storage.getProjects();

    for (const project of projects) {
      if (!project.isActive) continue;

      console.log(`[RankingsSync] Syncing rankings for project: ${project.name}`);
      const result = await this.syncRankingsForProject(project.id);
      results.push(result);
      console.log(`[RankingsSync] ${project.name}: ${result.message}`);
    }

    return results;
  }

  async syncPageMetrics(projectId: string, urlLimit?: number, crawlResultId?: number): Promise<{
    success: boolean;
    message: string;
    pagesUpdated: number;
    errors: string[];
  }> {
    if (!this.dataForSEO) {
      return {
        success: false,
        message: "DataForSEO not configured",
        pagesUpdated: 0,
        errors: ["DataForSEO API credentials not configured"],
      };
    }

    const errors: string[] = [];
    let pagesUpdated = 0;

    try {
      const keywords = await storage.getKeywords(projectId);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return { success: false, message: "Project not found", pagesUpdated: 0, errors: ["Project not found"] };
      }

      // Collect URLs from keywords (primary source)
      const urlSet = new Set<string>();
      for (const kw of keywords) {
        if (kw.targetUrl) {
          urlSet.add(kw.targetUrl.toLowerCase().replace(/\/+$/, ''));
        }
      }

      // Also include ALL existing pages in page_metrics (even those without keywords)
      // Fetch once and reuse (performance optimization - was being called inside loop before)
      const existingPages = await storage.getPageMetrics(projectId);
      for (const page of existingPages) {
        if (page.url) {
          urlSet.add(page.url.toLowerCase().replace(/\/+$/, ''));
        }
      }

      // Create a map for quick lookup (reuse the fetched pages)
      const existingPagesMap = new Map(
        existingPages.map(p => [p.url.toLowerCase().replace(/\/+$/, ''), p])
      );

      let urls = Array.from(urlSet);
      if (urls.length === 0) {
        return { success: true, message: "No URLs to sync", pagesUpdated: 0, errors: [] };
      }

      if (urlLimit && urlLimit > 0) {
        urls = urls.slice(0, urlLimit);
      }

      if (crawlResultId) {
        await storage.updateCrawlProgress(crawlResultId, 0, "fetching_backlinks", urls.length);
      }

      console.log(`[PageMetrics] Syncing ${urls.length} pages for project ${project.name}`);

      const backlinkData = await this.dataForSEO.syncPagesBacklinks(urls);
      console.log(`[PageMetrics] Retrieved backlinks for ${backlinkData.size}/${urls.length} URLs from DataForSEO`);

      // Use America/Chicago timezone for date consistency (handles DST)
      const today = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      const totalUrls = urls.length;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];

        if (crawlResultId && (i % 3 === 0 || i === totalUrls - 1)) {
          await storage.updateCrawlProgress(crawlResultId, i + 1, "syncing_pages");
        }

        try {
          const normalizedUrl = url.toLowerCase().replace(/\/+$/, '');
          const backlinks = backlinkData.get(normalizedUrl) || backlinkData.get(url);
          
          let velocity = { newLinks: 0, lostLinks: 0 };
          try {
            velocity = await this.dataForSEO!.getBacklinksTimeseries(url, 7);
            await new Promise(r => setTimeout(r, 200));
          } catch (e) {
            console.log(`[PageMetrics] Could not get velocity for ${url}`);
          }

          // Use the pre-fetched pages map instead of querying each time
          const existingPage = existingPagesMap.get(normalizedUrl);

          // Get keywords targeting this URL for position-based calculations
          const pageKeywords = keywords.filter(kw => 
            kw.targetUrl && normalizeUrl(kw.targetUrl) === normalizedUrl
          );
          const totalKeywordsForPage = pageKeywords.length;

          // Get latest rankings for these keywords
          const keywordIds = pageKeywords.map(k => k.id);
          let rankedCount = 0;
          let top10Count = 0;
          let top3Count = 0;
          let positionSum = 0;
          let bestPos = 0;

          if (keywordIds.length > 0) {
            const latestRankings = await db
              .select()
              .from(rankingsHistory)
              .where(
                and(
                  eq(rankingsHistory.projectId, projectId),
                  inArray(rankingsHistory.keywordId, keywordIds)
                )
              )
              .orderBy(desc(rankingsHistory.date));

            const rankingsByKw = new Map<number, number>();
            for (const r of latestRankings) {
              if (!rankingsByKw.has(r.keywordId) && r.position && r.position > 0) {
                rankingsByKw.set(r.keywordId, r.position);
              }
            }

            for (const pos of Array.from(rankingsByKw.values())) {
              rankedCount++;
              positionSum += pos;
              if (pos <= 10) top10Count++;
              if (pos <= 3) top3Count++;
              if (bestPos === 0 || pos < bestPos) bestPos = pos;
            }
          }

          const avgPosition = rankedCount > 0 ? Math.round((positionSum / rankedCount) * 10) / 10 : 0;

          // Calculate Tech Risk Score (0-100, higher = more risk)
          // Factors: isIndexable, hasSchema, duplicateContent, coreWebVitalsOk
          let techRisk = 0;
          const hasSchema = existingPage?.hasSchema || false;
          const isIndexable = existingPage?.isIndexable !== false;
          const duplicateContent = existingPage?.duplicateContent || false;
          const coreWebVitalsOk = existingPage?.coreWebVitalsOk !== false;
          
          if (!isIndexable) techRisk += 40;
          if (!hasSchema) techRisk += 15;
          if (duplicateContent) techRisk += 25;
          if (!coreWebVitalsOk) techRisk += 20;
          
          // Calculate Content Gap Score (0-100, higher = bigger gap/more opportunity)
          // Based on how many keywords have poor rankings (>20) or no rankings
          let contentGap = 0;
          if (totalKeywordsForPage > 0) {
            const unrankedOrPoorRatio = (totalKeywordsForPage - top10Count) / totalKeywordsForPage;
            contentGap = Math.round(unrankedOrPoorRatio * 100);
          }

          // Calculate Authority Gap Score (0-100, higher = weaker authority)
          // Based on backlinks/referring domains relative to benchmarks
          const backlinksCount = backlinks?.backlinksCount || 0;
          const referringDomainsCount = backlinks?.referringDomains || 0;
          let authorityGap = 100;
          if (referringDomainsCount >= 100) authorityGap = 10;
          else if (referringDomainsCount >= 50) authorityGap = 25;
          else if (referringDomainsCount >= 20) authorityGap = 40;
          else if (referringDomainsCount >= 10) authorityGap = 55;
          else if (referringDomainsCount >= 5) authorityGap = 70;
          else if (referringDomainsCount >= 1) authorityGap = 85;

          const pageData = {
            projectId,
            url: existingPage?.url || url,
            date: today,
            backlinksCount: backlinksCount,
            referringDomains: referringDomainsCount,
            newLinks7d: velocity.newLinks,
            lostLinks7d: velocity.lostLinks,
            avgPosition: avgPosition > 0 ? String(avgPosition) : null,
            bestPosition: bestPos > 0 ? bestPos : null,
            keywordsInTop10: top10Count,
            keywordsInTop3: top3Count,
            totalKeywords: totalKeywordsForPage,
            wordCount: existingPage?.wordCount || null,
            hasSchema: hasSchema,
            isIndexable: isIndexable,
            duplicateContent: duplicateContent,
            coreWebVitalsOk: coreWebVitalsOk,
            contentGapScore: String(contentGap),
            techRiskScore: String(techRisk),
            authorityGapScore: String(authorityGap),
          };

          if (existingPage) {
            await storage.updatePageMetrics(existingPage.id, pageData);
          } else {
            await storage.createPageMetrics(pageData);
          }
          pagesUpdated++;
        } catch (error) {
          errors.push(`Failed to sync page ${url}: ${error}`);
        }
      }

      console.log(`[PageMetrics] Updated ${pagesUpdated}/${urls.length} pages`);

      // Consider successful if we synced pages, even with some minor errors
      // Only fail if no pages were updated or errors exceed 10% of total
      const errorThreshold = Math.max(1, Math.ceil(urls.length * 0.1));
      const isSuccess = pagesUpdated > 0 && errors.length < errorThreshold;

      return {
        success: isSuccess,
        message: `Synced ${pagesUpdated} pages with backlink data`,
        pagesUpdated,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        message: `Page metrics sync failed: ${error}`,
        pagesUpdated,
        errors: [...errors, String(error)],
      };
    }
  }

  async syncOnPageData(projectId: string, taskId: string): Promise<{
    success: boolean;
    message: string;
    pagesUpdated: number;
  }> {
    if (!this.dataForSEO) {
      return { success: false, message: "DataForSEO not configured", pagesUpdated: 0 };
    }

    try {
      const keywords = await storage.getKeywords(projectId);
      const urlSet = new Set<string>();
      for (const kw of keywords) {
        if (kw.targetUrl) {
          urlSet.add(kw.targetUrl);
        }
      }
      const urls = Array.from(urlSet);

      const onPageData = await this.dataForSEO.getOnPagePagesData(taskId, urls);
      console.log(`[OnPage] Retrieved data for ${onPageData.size} pages`);

      // Fetch existing pages once outside the loop (performance optimization)
      const existingPages = await storage.getPageMetrics(projectId);
      const existingPagesMap = new Map(
        existingPages.map(p => [p.url.toLowerCase().replace(/\/+$/, ''), p])
      );

      let pagesUpdated = 0;
      // Use America/Chicago timezone for date consistency (handles DST)
      const today = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());

      const onPageEntries = Array.from(onPageData.entries());
      for (const entry of onPageEntries) {
        const url = entry[0];
        const data = entry[1];
        const normalizedUrl = url.toLowerCase().replace(/\/+$/, '');
        const existingPage = existingPagesMap.get(normalizedUrl);

        const techRiskScore = Math.max(0, 100 - (data.pageScore || 50));

        if (existingPage) {
          await storage.updatePageMetrics(existingPage.id, {
            ...existingPage,
            date: today,
            hasSchema: data.hasSchema,
            isIndexable: data.isIndexable,
            duplicateContent: data.duplicateContent,
            coreWebVitalsOk: data.coreWebVitalsScore >= 50,
            wordCount: data.wordCount,
            techRiskScore: String(techRiskScore),
          });
          pagesUpdated++;
        } else {
          await storage.createPageMetrics({
            projectId,
            url,
            date: today,
            hasSchema: data.hasSchema,
            isIndexable: data.isIndexable,
            duplicateContent: data.duplicateContent,
            coreWebVitalsOk: data.coreWebVitalsScore >= 50,
            wordCount: data.wordCount,
            techRiskScore: String(techRiskScore),
          });
          pagesUpdated++;
        }
      }

      return {
        success: true,
        message: `Updated on-page data for ${pagesUpdated} pages`,
        pagesUpdated,
      };
    } catch (error) {
      return {
        success: false,
        message: `On-page sync failed: ${error}`,
        pagesUpdated: 0,
      };
    }
  }

  static isConfigured(): boolean {
    return DataForSEOService.isConfigured();
  }
}

export const rankingsSyncService = new RankingsSyncService();
