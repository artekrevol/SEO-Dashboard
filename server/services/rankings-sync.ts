import { storage } from "../storage";
import { db } from "../db";
import { DataForSEOService, createDataForSEOService } from "./dataforseo";
import { TaskLogger, TaskContext } from "./task-logger";
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

      const today = new Date().toISOString().split("T")[0];
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

      console.log(`[RankingsSync] Starting bulk sync for ${totalKeywords} keywords (${this.bulkBatchSize} per batch)`);

      let lastProgressLog = 0;
      let lastProgressUpdate = 0;

      // Process keywords in bulk batches using DataForSEO bulk API
      for (let i = 0; i < activeKeywords.length; i += this.bulkBatchSize) {
        const batch = activeKeywords.slice(i, Math.min(i + this.bulkBatchSize, activeKeywords.length));
        const keywordTexts = batch.map(kw => kw.keyword);
        
        if (batch.length === 0) {
          console.warn(`[RankingsSync] Empty batch at index ${i}, skipping`);
          continue;
        }
        
        try {
          console.log(`[RankingsSync] Fetching SERP data for batch ${Math.floor(i / this.bulkBatchSize) + 1} (${batch.length} keywords): ${keywordTexts.slice(0, 3).join(", ")}${keywordTexts.length > 3 ? "..." : ""}`);
          // Use Standard method (task_post + task_get) for bulk operations
          // This is 3.3x cheaper and more reliable than Live method
          const serpData = await Promise.race([
            this.dataForSEO.getSerpRankingsStandardMethod(keywordTexts, project.domain),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error("SERP API request timed out after 12 minutes")), 720000)
            )
          ]);
          
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

                // Batch database writes
                dbOperations.push(
                  storage.upsertRankingsHistory(kw.id, today, historyData).then(() => {
                    keywordsUpdated++;
                    console.log(`[RankingsSync] Saved ranking for "${kw.keyword}": position ${position}`);
                  }).catch((err) => {
                    console.error(`[RankingsSync] Failed to save ranking for keyword "${kw.keyword}":`, err);
                    errors.push(`Failed to save ranking for keyword ${kw.keyword}: ${err}`);
                  })
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

          const processed = Math.min(i + batch.length, totalKeywords);
          const progressPercent = Math.round(processed / totalKeywords * 100);
          
          // Log progress every 50 keywords or at milestones
          if (processed - lastProgressLog >= 50 || processed === totalKeywords) {
            console.log(`[RankingsSync] Progress: ${processed}/${totalKeywords} (${progressPercent}%)`);
            lastProgressLog = processed;
          }

          // Update crawl progress every 25 keywords
          if (crawlResultId && (processed - lastProgressUpdate >= 25 || processed === totalKeywords)) {
            await storage.updateCrawlProgress(crawlResultId, processed, "fetching_rankings");
            lastProgressUpdate = processed;
          }

          // Log progress at milestones
          if (taskContext && (progressPercent === 25 || progressPercent === 50 || progressPercent === 75 || processed === totalKeywords)) {
            await TaskLogger.info(taskContext, `Keyword crawl progress: ${progressPercent}%`, {
              processed,
              total: totalKeywords,
              keywordsUpdated,
              competitorsFound,
            });
          }
        } catch (err) {
          const errMsg = `Failed to process batch of ${batch.length} keywords: ${err}`;
          errors.push(errMsg);
          console.error(`[RankingsSync] Batch error:`, err);
          
          // Continue with next batch even if this one failed
          const processed = Math.min(i + batch.length, totalKeywords);
          if (crawlResultId) {
            await storage.updateCrawlProgress(crawlResultId, processed, "fetching_rankings");
          }
        }
      }

      console.log(`[RankingsSync] Completed: ${keywordsUpdated}/${totalKeywords} keywords synced`);

      if (taskContext) {
        await TaskLogger.info(taskContext, `Ranking sync completed: ${keywordsUpdated}/${totalKeywords} keywords`, {
          keywordsUpdated,
          competitorsFound,
          errorsCount: errors.length,
        });
      }

      return {
        success: errors.length === 0,
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

      const today = new Date().toISOString().split('T')[0];
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

      return {
        success: errors.length === 0,
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
      const today = new Date().toISOString().split('T')[0];

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
