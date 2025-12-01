interface DataForSEOConfig {
  login: string;
  password: string;
  baseUrl?: string;
}

interface SerpResultItem {
  keyword: string;
  rank_group: number;
  rank_absolute: number;
  domain: string;
  url: string;
  title: string;
  description: string;
  breadcrumb: string;
  is_featured_snippet: boolean;
  is_image: boolean;
  is_video: boolean;
}

interface KeywordData {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
  monthlySearches: { year: number; month: number; search_volume: number }[];
}

interface BacklinkData {
  totalBacklinks: number;
  referringDomains: number;
  domainAuthority: number;
}

interface OnPageIssue {
  type: string;
  severity: "critical" | "warning" | "info";
  count: number;
  pages: string[];
}

export class DataForSEOService {
  private config: DataForSEOConfig;
  private baseUrl: string;
  private authHeader: string;

  constructor(config: DataForSEOConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || "https://api.dataforseo.com/v3";
    this.authHeader = "Basic " + Buffer.from(`${config.login}:${config.password}`).toString("base64");
  }

  private async makeRequest<T>(endpoint: string, method: string = "GET", body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        "Authorization": this.authHeader,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.status_code !== 20000) {
      throw new Error(`DataForSEO API error: ${data.status_message}`);
    }

    return data;
  }

  async getSerpRankings(keywords: string[], domain: string, locationCode: number = 2840, onProgress?: (processed: number, total: number) => void): Promise<Map<string, SerpResultItem | null>> {
    const results = new Map<string, SerpResultItem | null>();
    const requestDelay = 500;

    console.log(`[DataForSEO] Processing ${keywords.length} keywords sequentially for SERP rankings`);

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];

      try {
        const task = [{
          keyword,
          location_code: locationCode,
          language_code: "en",
          device: "desktop",
          os: "windows",
          depth: 100,
        }];

        const response = await this.makeRequest<{
          tasks: Array<{
            status_code: number;
            status_message: string;
            data?: { keyword: string };
            result: Array<{
              keyword: string;
              items: Array<{
                type: string;
                rank_group: number;
                rank_absolute: number;
                domain?: string;
                url?: string;
                title?: string;
                description?: string;
                breadcrumb?: string;
              }>;
            }>;
          }>;
        }>("/serp/google/organic/live/advanced", "POST", task);

        const taskResult = response.tasks?.[0];
        if (taskResult && taskResult.status_code === 20000 && taskResult.result?.[0]) {
          const result = taskResult.result[0];
          const organicItems = (result.items || []).filter(item => item.type === 'organic');
          const domainResult = organicItems.find(item => 
            item.domain === domain || 
            item.domain?.includes(domain) ||
            item.url?.includes(domain)
          );

          if (domainResult) {
            results.set(keyword, {
              keyword,
              rank_group: domainResult.rank_group,
              rank_absolute: domainResult.rank_absolute,
              domain: domainResult.domain || '',
              url: domainResult.url || '',
              title: domainResult.title || '',
              description: domainResult.description || '',
              breadcrumb: domainResult.breadcrumb || '',
              is_featured_snippet: false,
              is_image: false,
              is_video: false,
            });
          } else {
            results.set(keyword, null);
          }
        }
      } catch (error) {
        console.error(`[DataForSEO] Error fetching SERP for "${keyword}":`, error);
        results.set(keyword, null);
      }

      if (onProgress) {
        onProgress(i + 1, keywords.length);
      }

      if (i < keywords.length - 1) {
        await new Promise(resolve => setTimeout(resolve, requestDelay));
      }

      if ((i + 1) % 10 === 0 || i === keywords.length - 1) {
        console.log(`[DataForSEO] SERP progress: ${i + 1}/${keywords.length}`);
      }
    }

    return results;
  }

  async getSerpRankingsWithCompetitors(keywords: string[], domain: string, locationCode: number = 2840, onProgress?: (processed: number, total: number) => void): Promise<{
    rankings: Map<string, SerpResultItem | null>;
    competitors: Map<string, Array<{
      domain: string;
      position: number;
      url: string;
      title: string;
    }>>;
    serpFeatures: Map<string, string[]>;
  }> {
    const rankings = new Map<string, SerpResultItem | null>();
    const competitors = new Map<string, Array<{
      domain: string;
      position: number;
      url: string;
      title: string;
    }>>();
    const serpFeatures = new Map<string, string[]>();
    const requestDelay = 500;

    const featureMapping: Record<string, string> = {
      featured_snippet: "featured_snippet",
      people_also_ask: "people_also_ask",
      local_pack: "local_pack",
      knowledge_panel: "knowledge_panel",
      video: "video",
      images: "image_pack",
      shopping: "shopping",
      news: "news",
    };

    console.log(`[DataForSEO] Processing ${keywords.length} keywords sequentially for SERP with competitors`);

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];

      try {
        const task = [{
          keyword,
          location_code: locationCode,
          language_code: "en",
          device: "desktop",
          os: "windows",
          depth: 100,
        }];

        const response = await this.makeRequest<{
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
                breadcrumb?: string;
              }>;
            }>;
          }>;
        }>("/serp/google/organic/live/advanced", "POST", task);

        const taskResult = response.tasks?.[0];
        if (taskResult && taskResult.status_code === 20000 && taskResult.result?.[0]) {
          const result = taskResult.result[0];
          const organicItems = (result.items || []).filter(item => item.type === 'organic');

          const domainResult = organicItems.find(item => 
            item.domain === domain || 
            item.domain?.includes(domain) ||
            item.url?.includes(domain)
          );

          if (domainResult) {
            rankings.set(keyword, {
              keyword,
              rank_group: domainResult.rank_group,
              rank_absolute: domainResult.rank_absolute,
              domain: domainResult.domain || '',
              url: domainResult.url || '',
              title: domainResult.title || '',
              description: domainResult.description || '',
              breadcrumb: domainResult.breadcrumb || '',
              is_featured_snippet: false,
              is_image: false,
              is_video: false,
            });
          } else {
            rankings.set(keyword, null);
          }

          const top10Competitors = organicItems
            .filter(item => 
              item.domain !== domain && 
              !item.domain?.includes(domain) &&
              !item.url?.includes(domain)
            )
            .slice(0, 10)
            .map(item => ({
              domain: item.domain || '',
              position: item.rank_group,
              url: item.url || '',
              title: item.title || '',
            }));

          competitors.set(keyword, top10Competitors);

          const itemTypes = result.item_types || [];
          const features = itemTypes
            .map(type => featureMapping[type])
            .filter(Boolean);
          serpFeatures.set(keyword, features);
        }
      } catch (error) {
        console.error(`[DataForSEO] Error fetching SERP with competitors for "${keyword}":`, error);
        rankings.set(keyword, null);
        competitors.set(keyword, []);
        serpFeatures.set(keyword, []);
      }

      if (onProgress) {
        onProgress(i + 1, keywords.length);
      }

      if (i < keywords.length - 1) {
        await new Promise(resolve => setTimeout(resolve, requestDelay));
      }

      if ((i + 1) % 10 === 0 || i === keywords.length - 1) {
        console.log(`[DataForSEO] SERP+Competitors progress: ${i + 1}/${keywords.length}`);
      }
    }

    return { rankings, competitors, serpFeatures };
  }

  async getKeywordData(keywords: string[], locationCode: number = 2840): Promise<Map<string, KeywordData>> {
    const response = await this.makeRequest<{
      tasks: Array<{
        result: Array<{
          keyword: string;
          search_volume: number;
          competition: number;
          cpc: number;
          monthly_searches: Array<{ year: number; month: number; search_volume: number }>;
        }>;
      }>;
    }>("/keywords_data/google_ads/search_volume/live", "POST", [{
      keywords,
      location_code: locationCode,
      language_code: "en",
    }]);

    const results = new Map<string, KeywordData>();
    
    for (const task of response.tasks || []) {
      for (const result of task.result || []) {
        results.set(result.keyword, {
          keyword: result.keyword,
          searchVolume: result.search_volume || 0,
          competition: result.competition || 0,
          cpc: result.cpc || 0,
          monthlySearches: result.monthly_searches || [],
        });
      }
    }

    return results;
  }

  async getKeywordDifficulty(keywords: string[], locationCode: number = 2840): Promise<Map<string, number>> {
    const response = await this.makeRequest<{
      tasks: Array<{
        result: Array<{
          items: Array<{
            keyword: string;
            keyword_difficulty: number;
          }>;
        }>;
      }>;
    }>("/dataforseo_labs/google/bulk_keyword_difficulty/live", "POST", [{
      keywords,
      location_code: locationCode,
      language_code: "en",
    }]);

    const results = new Map<string, number>();
    
    for (const task of response.tasks || []) {
      for (const result of task.result || []) {
        for (const item of result.items || []) {
          results.set(item.keyword, item.keyword_difficulty || 0);
        }
      }
    }

    return results;
  }

  async getKeywordIntent(keywords: string[]): Promise<Map<string, string>> {
    const response = await this.makeRequest<{
      tasks: Array<{
        result: Array<{
          items: Array<{
            keyword: string;
            keyword_intent: {
              label: string;
              probability: number;
            };
          }>;
        }>;
      }>;
    }>("/dataforseo_labs/google/search_intent/live", "POST", [{
      keywords,
      language_code: "en",
    }]);

    const results = new Map<string, string>();
    
    for (const task of response.tasks || []) {
      for (const result of task.result || []) {
        for (const item of result.items || []) {
          const intent = item.keyword_intent?.label || "informational";
          results.set(item.keyword, intent.toLowerCase());
        }
      }
    }

    return results;
  }

  async getCompetitors(domain: string, locationCode: number = 2840): Promise<Array<{
    domain: string;
    avgPosition: number;
    visibility: number;
    keywordsCount: number;
  }>> {
    const response = await this.makeRequest<{
      tasks: Array<{
        result: Array<{
          items: Array<{
            domain: string;
            avg_position: number;
            se_results_count: number;
            keywords_count: number;
          }>;
        }>;
      }>;
    }>("/dataforseo_labs/google/competitors_domain/live", "POST", [{
      target: domain,
      location_code: locationCode,
      language_code: "en",
      limit: 10,
    }]);

    const competitors: Array<{
      domain: string;
      avgPosition: number;
      visibility: number;
      keywordsCount: number;
    }> = [];

    for (const task of response.tasks || []) {
      for (const result of task.result || []) {
        for (const item of result.items || []) {
          competitors.push({
            domain: item.domain,
            avgPosition: item.avg_position || 0,
            visibility: Math.min(100, (item.se_results_count / 100) * 10),
            keywordsCount: item.keywords_count || 0,
          });
        }
      }
    }

    return competitors;
  }

  async getBacklinkData(domain: string): Promise<BacklinkData> {
    const response = await this.makeRequest<{
      tasks: Array<{
        result: Array<{
          total_count: number;
          referring_domains: number;
          rank: number;
        }>;
      }>;
    }>("/backlinks/summary/live", "POST", [{
      target: domain,
      internal_list_limit: 0,
    }]);

    const result = response.tasks?.[0]?.result?.[0];
    
    return {
      totalBacklinks: result?.total_count || 0,
      referringDomains: result?.referring_domains || 0,
      domainAuthority: result?.rank || 0,
    };
  }

  async getOnPageSummary(domain: string): Promise<{
    crawledPages: number;
    indexablePages: number;
    issues: OnPageIssue[];
    techScore: number;
  }> {
    const taskResponse = await this.makeRequest<{
      tasks: Array<{ id: string }>;
    }>("/on_page/task_post", "POST", [{
      target: domain,
      max_crawl_pages: 100,
      load_resources: false,
      enable_javascript: false,
      store_raw_html: false,
    }]);

    const taskId = taskResponse.tasks?.[0]?.id;
    if (!taskId) {
      return { crawledPages: 0, indexablePages: 0, issues: [], techScore: 50 };
    }

    await new Promise(resolve => setTimeout(resolve, 30000));

    const summaryResponse = await this.makeRequest<{
      tasks: Array<{
        result: Array<{
          crawl_progress: string;
          crawl_status: {
            pages_crawled: number;
          };
          page_metrics: {
            checks: Record<string, number>;
            onpage_score: number;
          };
        }>;
      }>;
    }>(`/on_page/summary/${taskId}`, "GET");

    const result = summaryResponse.tasks?.[0]?.result?.[0];
    
    const issues: OnPageIssue[] = [];
    const checks = result?.page_metrics?.checks || {};
    
    if (checks.is_redirect > 0) {
      issues.push({ type: "redirect_chains", severity: "warning", count: checks.is_redirect, pages: [] });
    }
    if (checks.duplicate_title > 0) {
      issues.push({ type: "duplicate_title", severity: "warning", count: checks.duplicate_title, pages: [] });
    }
    if (checks.duplicate_description > 0) {
      issues.push({ type: "duplicate_description", severity: "warning", count: checks.duplicate_description, pages: [] });
    }
    if (checks.no_index > 0) {
      issues.push({ type: "noindex_pages", severity: "critical", count: checks.no_index, pages: [] });
    }

    return {
      crawledPages: result?.crawl_status?.pages_crawled || 0,
      indexablePages: Math.max(0, (result?.crawl_status?.pages_crawled || 0) - (checks.no_index || 0)),
      issues,
      techScore: result?.page_metrics?.onpage_score || 50,
    };
  }

  async getSerpFeatures(keyword: string, locationCode: number = 2840): Promise<string[]> {
    const response = await this.makeRequest<{
      tasks: Array<{
        result: Array<{
          item_types: string[];
        }>;
      }>;
    }>("/serp/google/organic/live/regular", "POST", [{
      keyword,
      location_code: locationCode,
      language_code: "en",
    }]);

    const itemTypes = response.tasks?.[0]?.result?.[0]?.item_types || [];
    
    const featureMapping: Record<string, string> = {
      featured_snippet: "featured_snippet",
      people_also_ask: "people_also_ask",
      local_pack: "local_pack",
      knowledge_panel: "knowledge_panel",
      video: "video",
      images: "image_pack",
      shopping: "shopping",
      news: "news",
    };

    return itemTypes
      .map(type => featureMapping[type])
      .filter(Boolean);
  }

  calculateOpportunityScore(
    position: number,
    searchVolume: number,
    difficulty: number,
    intent: string
  ): number {
    let score = 0;
    
    if (position > 0 && position <= 20) {
      score += Math.max(0, 40 - (position - 1) * 2);
    }
    
    if (searchVolume >= 10000) score += 30;
    else if (searchVolume >= 1000) score += 20;
    else if (searchVolume >= 100) score += 10;
    else score += 5;
    
    if (difficulty <= 30) score += 20;
    else if (difficulty <= 50) score += 15;
    else if (difficulty <= 70) score += 10;
    else score += 5;
    
    if (intent === "transactional" || intent === "commercial") {
      score += 10;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  static isConfigured(): boolean {
    return !!(process.env.DATAFORSEO_API_LOGIN && process.env.DATAFORSEO_API_PASSWORD);
  }

  static fromEnv(): DataForSEOService | null {
    if (!this.isConfigured()) {
      return null;
    }
    return new DataForSEOService({
      login: process.env.DATAFORSEO_API_LOGIN!,
      password: process.env.DATAFORSEO_API_PASSWORD!,
    });
  }
}

export function createDataForSEOService(): DataForSEOService | null {
  return DataForSEOService.fromEnv();
}
