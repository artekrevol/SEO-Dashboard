import { storage } from "../storage";
import { DataForSEOService, createDataForSEOService } from "./dataforseo";
import type { Project, Keyword, InsertRankingsHistory, InsertKeywordCompetitorMetrics } from "@shared/schema";

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
  private requestDelay: number = 500;

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

      const domainResult = organicItems.find(item =>
        item.domain === domain ||
        item.domain?.includes(domain) ||
        item.url?.includes(domain)
      );

      const competitors = organicItems
        .filter(item => item.domain && !item.domain.includes(domain))
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

  async syncRankingsForProject(projectId: string, keywordLimit?: number): Promise<RankingsSyncResult> {
    const errors: string[] = [];
    let keywordsUpdated = 0;
    let competitorsFound = 0;

    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        return {
          success: false,
          message: `Project ${projectId} not found`,
          keywordsUpdated: 0,
          competitorsFound: 0,
          errors: [`Project ${projectId} not found`],
        };
      }

      if (!this.dataForSEO) {
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

      if (keywordLimit && keywordLimit > 0) {
        activeKeywords = activeKeywords.slice(0, keywordLimit);
      }

      if (activeKeywords.length === 0) {
        return {
          success: true,
          message: "No active keywords to sync",
          keywordsUpdated: 0,
          competitorsFound: 0,
          errors: [],
        };
      }

      const today = new Date().toISOString().split("T")[0];
      const totalKeywords = activeKeywords.length;

      console.log(`[RankingsSync] Starting sync for ${totalKeywords} keywords (processing one at a time)`);

      for (let i = 0; i < activeKeywords.length; i++) {
        const kw = activeKeywords[i];

        if (i % 10 === 0 || i === totalKeywords - 1) {
          console.log(`[RankingsSync] Progress: ${i + 1}/${totalKeywords} (${Math.round((i + 1) / totalKeywords * 100)}%)`);
        }

        try {
          const result = await this.getSerpResultForSingleKeyword(kw.keyword, project.domain);

          if (result) {
            const historyData: Omit<InsertRankingsHistory, "keywordId" | "date"> = {
              projectId,
              position: result.position,
              url: result.url,
              device: "desktop",
              locationId: kw.locationId,
              serpFeatures: result.serpFeatures,
            };

            await storage.upsertRankingsHistory(kw.id, today, historyData);
            keywordsUpdated++;

            for (const competitor of result.competitors) {
              try {
                const competitorData: InsertKeywordCompetitorMetrics = {
                  projectId,
                  keywordId: kw.id,
                  competitorDomain: competitor.domain,
                  competitorUrl: competitor.url,
                  latestPosition: competitor.position,
                  avgPosition: competitor.position.toFixed(2),
                  visibilityScore: this.calculateVisibilityScore(competitor.position).toFixed(2),
                  serpFeatures: result.serpFeatures,
                  isDirectCompetitor: competitor.position <= 10,
                  clickShareEstimate: this.estimateClickShare(competitor.position).toFixed(4),
                  lastSeenAt: new Date(),
                };

                await storage.upsertKeywordCompetitorMetrics(competitorData);
                competitorsFound++;
              } catch (err) {
                errors.push(`Failed to save competitor ${competitor.domain} for keyword ${kw.keyword}: ${err}`);
              }
            }
          }
        } catch (err) {
          errors.push(`Failed to process keyword ${kw.keyword}: ${err}`);
        }

        if (i < activeKeywords.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        }
      }

      console.log(`[RankingsSync] Completed: ${keywordsUpdated}/${totalKeywords} keywords synced`);

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

  static isConfigured(): boolean {
    return DataForSEOService.isConfigured();
  }
}

export const rankingsSyncService = new RankingsSyncService();
