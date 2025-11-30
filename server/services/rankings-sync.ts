import { storage } from "../storage";
import { DataForSEOService, createDataForSEOService } from "./dataforseo";
import type { Project, Keyword, InsertRankingsHistory, InsertKeywordCompetitorMetrics } from "@shared/schema";

interface RankingsSyncResult {
  success: boolean;
  message: string;
  keywordsUpdated: number;
  competitorsFound: number;
  errors: string[];
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

  constructor() {
    this.dataForSEO = createDataForSEOService();
  }

  async getSerpResultsWithCompetitors(
    keywords: string[],
    domain: string,
    locationCode: number = 2840
  ): Promise<Map<string, SerpResultWithCompetitors>> {
    if (!this.dataForSEO) {
      throw new Error("DataForSEO not configured");
    }

    const tasks = keywords.map(keyword => ({
      keyword,
      location_code: locationCode,
      language_code: "en",
      device: "desktop",
      os: "windows",
      depth: 100,
    }));

    const response = await this.dataForSEO["makeRequest"]<{
      tasks: Array<{
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
    }>("/serp/google/organic/live/advanced", "POST", tasks);

    const results = new Map<string, SerpResultWithCompetitors>();

    for (const task of response.tasks || []) {
      const keyword = task.data?.keyword || '';
      for (const result of task.result || []) {
        const organicItems = (result.items || []).filter(item => item.type === 'organic');
        
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

        results.set(keyword, {
          keyword,
          position: domainResult?.rank_absolute || null,
          url: domainResult?.url || null,
          serpFeatures,
          competitors,
        });
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

  async syncRankingsForProject(projectId: string): Promise<RankingsSyncResult> {
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
      const activeKeywords = keywords.filter(k => k.isActive);

      if (activeKeywords.length === 0) {
        return {
          success: true,
          message: "No active keywords to sync",
          keywordsUpdated: 0,
          competitorsFound: 0,
          errors: [],
        };
      }

      const batchSize = 100;
      const today = new Date().toISOString().split("T")[0];

      for (let i = 0; i < activeKeywords.length; i += batchSize) {
        const batch = activeKeywords.slice(i, i + batchSize);
        const keywordTexts = batch.map(k => k.keyword);

        try {
          const serpResults = await this.getSerpResultsWithCompetitors(
            keywordTexts,
            project.domain
          );

          for (const kw of batch) {
            const result = serpResults.get(kw.keyword);
            if (!result) continue;

            try {
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
            } catch (err) {
              errors.push(`Failed to save ranking for keyword ${kw.keyword}: ${err}`);
            }
          }
        } catch (err) {
          errors.push(`Failed to fetch SERP results for batch ${i}: ${err}`);
        }

        if (i + batchSize < activeKeywords.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return {
        success: errors.length === 0,
        message: `Synced ${keywordsUpdated} keywords with ${competitorsFound} competitor entries`,
        keywordsUpdated,
        competitorsFound,
        errors,
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
