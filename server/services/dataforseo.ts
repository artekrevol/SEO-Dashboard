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

  private async makeRequest<T>(endpoint: string, method: string = "GET", body?: unknown, timeout: number = 60000): Promise<T> {
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

    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    options.signal = controller.signal;

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.status_code !== 20000) {
        throw new Error(`DataForSEO API error: ${data.status_message}`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`DataForSEO API request timed out after ${timeout}ms`);
      }
      throw error;
    }
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
          // Case-insensitive domain matching
          const domainLower = domain.toLowerCase();
          const domainResult = organicItems.find(item => {
            const itemDomain = item.domain?.toLowerCase() || '';
            const itemUrl = item.url?.toLowerCase() || '';
            return itemDomain === domainLower || 
              itemDomain.includes(domainLower) ||
              itemUrl.includes(domainLower);
          });

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
    rawSerpItems: Map<string, any[]>;
  }> {
    const rankings = new Map<string, SerpResultItem | null>();
    const competitors = new Map<string, Array<{
      domain: string;
      position: number;
      url: string;
      title: string;
    }>>();
    const serpFeatures = new Map<string, string[]>();
    const rawSerpItems = new Map<string, any[]>();

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

    // Use bulk API requests - DataForSEO supports up to 100 keywords per request
    const BULK_BATCH_SIZE = 100;
    const domainLower = domain.toLowerCase();
    
    console.log(`[DataForSEO] Processing ${keywords.length} keywords in bulk batches (${BULK_BATCH_SIZE} per batch)`);

    for (let i = 0; i < keywords.length; i += BULK_BATCH_SIZE) {
      const batch = keywords.slice(i, Math.min(i + BULK_BATCH_SIZE, keywords.length));
      
      try {
        // Send all keywords in this batch as a single API request
        const tasks = batch.map(keyword => ({
          keyword,
          location_code: locationCode,
          language_code: "en",
          device: "desktop",
          os: "windows",
          depth: 100,
        }));

        console.log(`[DataForSEO] Sending bulk request for ${batch.length} keywords: ${batch.slice(0, 3).join(", ")}${batch.length > 3 ? "..." : ""}`);
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
        }>("/serp/google/organic/live/advanced", "POST", tasks, 120000); // 2 minute timeout for bulk requests
        console.log(`[DataForSEO] Received response for ${batch.length} keywords with ${response.tasks?.length || 0} tasks`);

        // Process all results from the bulk request
        if (!response.tasks || response.tasks.length === 0) {
          console.warn(`[DataForSEO] No tasks in response for batch of ${batch.length} keywords`);
          // Set null results for all keywords in batch
          for (const keyword of batch) {
            rankings.set(keyword, null);
            competitors.set(keyword, []);
            serpFeatures.set(keyword, []);
            rawSerpItems.set(keyword, []);
          }
          continue;
        }

        if (response.tasks.length !== batch.length) {
          console.warn(`[DataForSEO] Mismatch: sent ${batch.length} keywords but received ${response.tasks.length} tasks`);
        }

        // Check if bulk requests are not supported (account limitation)
        // If first succeeds but others have "one task at a time" error, process failed ones sequentially
        const keywordsNeedingSequentialProcessing: string[] = [];
        
        for (let taskIndex = 0; taskIndex < response.tasks.length; taskIndex++) {
          const taskResult = response.tasks[taskIndex];
          const keyword = batch[taskIndex] || batch[taskIndex % batch.length]; // Fallback if index mismatch
          
          if (!keyword) {
            console.warn(`[DataForSEO] No keyword found for task index ${taskIndex}`);
            continue;
          }
          
          // Detect "one task at a time" error and queue for sequential processing
          if (taskResult?.status_message?.includes("only one task at a time")) {
            keywordsNeedingSequentialProcessing.push(keyword);
            continue;
          }

          if (taskResult && taskResult.status_code === 20000 && taskResult.result?.[0]) {
            const result = taskResult.result[0];
            const allItems = result.items || [];
            const organicItems = allItems.filter(item => item.type === 'organic');
            
            // Store raw SERP items for SEID layout parsing
            rawSerpItems.set(keyword, allItems);

            // Case-insensitive domain matching
            const domainResult = organicItems.find(item => {
              const itemDomain = item.domain?.toLowerCase() || '';
              const itemUrl = item.url?.toLowerCase() || '';
              return itemDomain === domainLower || 
                itemDomain.includes(domainLower) ||
                itemUrl.includes(domainLower);
            });

            if (domainResult) {
              // Validate rank_absolute - it should be a positive number
              const rankAbsolute = domainResult.rank_absolute;
              if (!rankAbsolute || rankAbsolute <= 0) {
                console.warn(`[DataForSEO] Invalid rank_absolute (${rankAbsolute}) for keyword "${keyword}" with domain match. Using rank_group (${domainResult.rank_group}) instead.`);
                // Fallback to rank_group if rank_absolute is invalid
                const fallbackPosition = domainResult.rank_group > 0 ? domainResult.rank_group : null;
                if (fallbackPosition) {
                  rankings.set(keyword, {
                    keyword,
                    rank_group: domainResult.rank_group,
                    rank_absolute: fallbackPosition,
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
              } else {
                rankings.set(keyword, {
                  keyword,
                  rank_group: domainResult.rank_group,
                  rank_absolute: rankAbsolute,
                  domain: domainResult.domain || '',
                  url: domainResult.url || '',
                  title: domainResult.title || '',
                  description: domainResult.description || '',
                  breadcrumb: domainResult.breadcrumb || '',
                  is_featured_snippet: false,
                  is_image: false,
                  is_video: false,
                });
              }
            } else {
              rankings.set(keyword, null);
            }

            const top10Competitors = organicItems
              .filter(item => {
                const itemDomain = item.domain?.toLowerCase() || '';
                const itemUrl = item.url?.toLowerCase() || '';
                return itemDomain !== domainLower && 
                  !itemDomain.includes(domainLower) &&
                  !itemUrl.includes(domainLower);
              })
              .slice(0, 10)
              .map(item => {
                // Ensure position is a valid number (use rank_group or rank_absolute)
                const position = typeof item.rank_group === 'number' && item.rank_group > 0
                  ? item.rank_group
                  : (typeof item.rank_absolute === 'number' && item.rank_absolute > 0
                      ? item.rank_absolute
                      : null);
                
                return {
                  domain: item.domain || '',
                  position: position || 100, // Default to 100 if invalid
                  url: item.url || '',
                  title: item.title || '',
                };
              })
              .filter(comp => comp.position !== null); // Filter out invalid positions

            competitors.set(keyword, top10Competitors);

            const itemTypes = result.item_types || [];
            const features = itemTypes
              .map(type => featureMapping[type])
              .filter(Boolean);
            serpFeatures.set(keyword, features);
          } else {
            // Handle API errors for individual keywords in batch (but not "one task at a time" which is queued separately)
            if (!taskResult?.status_message?.includes("only one task at a time")) {
              rankings.set(keyword, null);
              competitors.set(keyword, []);
              serpFeatures.set(keyword, []);
              rawSerpItems.set(keyword, []);
              if (taskResult?.status_message) {
                console.log(`[DataForSEO] API error for "${keyword}": ${taskResult.status_message}`);
              }
            }
          }
        }
        
        // Process keywords that failed with "one task at a time" error sequentially
        if (keywordsNeedingSequentialProcessing.length > 0) {
          console.log(`[DataForSEO] Bulk not supported - processing ${keywordsNeedingSequentialProcessing.length} keywords sequentially`);
          
          for (const keyword of keywordsNeedingSequentialProcessing) {
            try {
              await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting delay
              
              const singleResponse = await this.makeRequest<{
                tasks: Array<{
                  status_code: number;
                  status_message: string;
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
              }>("/serp/google/organic/live/advanced", "POST", [{
                keyword,
                location_code: locationCode,
                language_code: "en",
                device: "desktop",
                os: "windows",
                depth: 100,
              }], 60000);
              
              const task = singleResponse.tasks?.[0];
              if (task && task.status_code === 20000 && task.result?.[0]) {
                const result = task.result[0];
                const allItems = result.items || [];
                const organicItems = allItems.filter(item => item.type === 'organic');
                
                // Store raw SERP items for SEID layout parsing
                rawSerpItems.set(keyword, allItems);
                
                // Find our domain's ranking
                const domainResult = organicItems.find(item => {
                  const itemDomain = item.domain?.toLowerCase() || '';
                  const itemUrl = item.url?.toLowerCase() || '';
                  return itemDomain === domainLower || 
                    itemDomain.includes(domainLower) ||
                    itemUrl.includes(domainLower);
                });
                
                if (domainResult) {
                  const rankAbsolute = domainResult.rank_absolute;
                  const fallbackPosition = domainResult.rank_group > 0 ? domainResult.rank_group : null;
                  rankings.set(keyword, {
                    keyword,
                    rank_group: domainResult.rank_group,
                    rank_absolute: rankAbsolute > 0 ? rankAbsolute : (fallbackPosition || 0),
                    domain: domainResult.domain || '',
                    url: domainResult.url || '',
                    title: domainResult.title || '',
                    description: domainResult.description || '',
                    breadcrumb: domainResult.breadcrumb || '',
                    is_featured_snippet: false,
                    is_image: false,
                    is_video: false,
                  });
                  console.log(`[DataForSEO] Sequential: "${keyword}" position ${domainResult.rank_group}`);
                } else {
                  rankings.set(keyword, null);
                  console.log(`[DataForSEO] Sequential: "${keyword}" not in top 100`);
                }
                
                // Get competitors for this keyword
                const top10Competitors = organicItems
                  .filter(item => {
                    const itemDomain = item.domain?.toLowerCase() || '';
                    const itemUrl = item.url?.toLowerCase() || '';
                    return itemDomain !== domainLower && 
                      !itemDomain.includes(domainLower) &&
                      !itemUrl.includes(domainLower);
                  })
                  .slice(0, 10)
                  .map(item => ({
                    domain: item.domain || '',
                    position: item.rank_group > 0 ? item.rank_group : (item.rank_absolute > 0 ? item.rank_absolute : 100),
                    url: item.url || '',
                    title: item.title || '',
                  }));
                competitors.set(keyword, top10Competitors);
                
                // Extract SERP features
                const itemTypes = result.item_types || [];
                const features = itemTypes.map(type => featureMapping[type]).filter(Boolean);
                serpFeatures.set(keyword, features);
              } else {
                rankings.set(keyword, null);
                competitors.set(keyword, []);
                serpFeatures.set(keyword, []);
                rawSerpItems.set(keyword, []);
                console.log(`[DataForSEO] Sequential: "${keyword}" failed - ${task?.status_message || 'unknown error'}`);
              }
            } catch (error) {
              console.error(`[DataForSEO] Sequential error for "${keyword}":`, error);
              rankings.set(keyword, null);
              competitors.set(keyword, []);
              serpFeatures.set(keyword, []);
              rawSerpItems.set(keyword, []);
            }
          }
        }

        if (onProgress) {
          onProgress(Math.min(i + batch.length, keywords.length), keywords.length);
        }

        // Small delay between bulk batches to respect rate limits (reduced from 500ms per keyword)
        if (i + BULK_BATCH_SIZE < keywords.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        if ((i + batch.length) % 100 === 0 || i + batch.length >= keywords.length) {
          console.log(`[DataForSEO] SERP+Competitors progress: ${Math.min(i + batch.length, keywords.length)}/${keywords.length}`);
        }
      } catch (error) {
        console.error(`[DataForSEO] Error fetching SERP batch (${batch.length} keywords):`, error);
        
        // Fallback to sequential processing when bulk fails completely
        console.log(`[DataForSEO] Bulk failed - falling back to sequential processing for ${batch.length} keywords`);
        
        for (const keyword of batch) {
          try {
            await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting delay
            
            const singleResponse = await this.makeRequest<{
              tasks: Array<{
                status_code: number;
                status_message: string;
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
            }>("/serp/google/organic/live/advanced", "POST", [{
              keyword,
              location_code: locationCode,
              language_code: "en",
              device: "desktop",
              os: "windows",
              depth: 100,
            }], 60000);
            
            const task = singleResponse.tasks?.[0];
            if (task && task.status_code === 20000 && task.result?.[0]) {
              const result = task.result[0];
              const allItems = result.items || [];
              const organicItems = allItems.filter(item => item.type === 'organic');
              
              // Store raw SERP items for SEID layout parsing
              rawSerpItems.set(keyword, allItems);
              
              // Find our domain's ranking
              const domainResult = organicItems.find(item => {
                const itemDomain = item.domain?.toLowerCase() || '';
                const itemUrl = item.url?.toLowerCase() || '';
                return itemDomain === domainLower || 
                  itemDomain.includes(domainLower) ||
                  itemUrl.includes(domainLower);
              });
              
              if (domainResult) {
                const rankAbsolute = domainResult.rank_absolute;
                const fallbackPosition = domainResult.rank_group > 0 ? domainResult.rank_group : null;
                rankings.set(keyword, {
                  keyword,
                  rank_group: domainResult.rank_group,
                  rank_absolute: rankAbsolute > 0 ? rankAbsolute : (fallbackPosition || 0),
                  domain: domainResult.domain || '',
                  url: domainResult.url || '',
                  title: domainResult.title || '',
                  description: domainResult.description || '',
                  breadcrumb: domainResult.breadcrumb || '',
                  is_featured_snippet: false,
                  is_image: false,
                  is_video: false,
                });
                console.log(`[DataForSEO] Fallback sequential: "${keyword}" position ${domainResult.rank_group}`);
              } else {
                rankings.set(keyword, null);
                console.log(`[DataForSEO] Fallback sequential: "${keyword}" not in top 100`);
              }
              
              // Get competitors
              const top10Competitors = organicItems
                .filter(item => {
                  const itemDomain = item.domain?.toLowerCase() || '';
                  const itemUrl = item.url?.toLowerCase() || '';
                  return itemDomain !== domainLower && 
                    !itemDomain.includes(domainLower) &&
                    !itemUrl.includes(domainLower);
                })
                .slice(0, 10)
                .map(item => ({
                  domain: item.domain || '',
                  position: item.rank_group > 0 ? item.rank_group : (item.rank_absolute > 0 ? item.rank_absolute : 100),
                  url: item.url || '',
                  title: item.title || '',
                }));
              competitors.set(keyword, top10Competitors);
              
              // Extract SERP features
              const itemTypes = result.item_types || [];
              const features = itemTypes.map(type => featureMapping[type]).filter(Boolean);
              serpFeatures.set(keyword, features);
            } else {
              rankings.set(keyword, null);
              competitors.set(keyword, []);
              serpFeatures.set(keyword, []);
              rawSerpItems.set(keyword, []);
              console.log(`[DataForSEO] Fallback sequential: "${keyword}" failed - ${task?.status_message || 'unknown error'}`);
            }
          } catch (seqError) {
            console.error(`[DataForSEO] Fallback sequential error for "${keyword}":`, seqError);
            rankings.set(keyword, null);
            competitors.set(keyword, []);
            serpFeatures.set(keyword, []);
            rawSerpItems.set(keyword, []);
          }
          
          if (onProgress) {
            const processedSoFar = i + batch.indexOf(keyword) + 1;
            onProgress(Math.min(processedSoFar, keywords.length), keywords.length);
          }
        }
      }
    }

    return { rankings, competitors, serpFeatures, rawSerpItems };
  }

  /**
   * OPTIMIZED: Standard Method for SERP Rankings
   * Uses task_post + task_get for bulk keyword processing
   * 
   * Priority options:
   * - Normal (priority: 1): ~20 min completion, $0.0006/task
   * - High (priority: 2): ~1 min completion, $0.0012/task (still 40% cheaper than Live)
   * 
   * High priority recommended for:
   * - Environments with frequent restarts (Railway, etc.)
   * - Smaller batches that need quick turnaround
   */
  async getSerpRankingsStandardMethod(
    keywords: string[], 
    domain: string, 
    locationCode: number = 2840, 
    onProgress?: (processed: number, total: number) => void,
    useHighPriority: boolean = true  // Default to high priority for faster results
  ): Promise<{
    rankings: Map<string, SerpResultItem | null>;
    competitors: Map<string, Array<{
      domain: string;
      position: number;
      url: string;
      title: string;
    }>>;
    serpFeatures: Map<string, string[]>;
    rawSerpItems: Map<string, any[]>;
  }> {
    const rankings = new Map<string, SerpResultItem | null>();
    const competitors = new Map<string, Array<{
      domain: string;
      position: number;
      url: string;
      title: string;
    }>>();
    const serpFeatures = new Map<string, string[]>();
    const rawSerpItems = new Map<string, any[]>();

    const featureMapping: Record<string, string> = {
      featured_snippet: "featured_snippet",
      people_also_ask: "people_also_ask",
      local_pack: "local_pack",
      knowledge_panel: "knowledge_panel",
      video: "video",
      images: "image_pack",
      shopping: "shopping",
      news: "news",
      related_searches: "related_searches",
    };

    const domainLower = domain.toLowerCase();
    const BATCH_SIZE = 100; // Max 100 tasks per POST request

    const priorityLabel = useHighPriority ? "HIGH (~1 min)" : "NORMAL (~20 min)";
    console.log(`[DataForSEO] Standard Method [${priorityLabel}]: Processing ${keywords.length} keywords in batches of ${BATCH_SIZE}`);

    // Step 1: Submit all tasks using task_post (batched)
    const allTaskIds: { taskId: string; keyword: string }[] = [];
    
    for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
      const batch = keywords.slice(i, Math.min(i + BATCH_SIZE, keywords.length));
      
      try {
        const priority = useHighPriority ? 2 : 1; // 2 = High (~1 min), 1 = Normal (~20 min)
        const tasks = batch.map(keyword => ({
          keyword,
          location_code: locationCode,
          language_code: "en",
          device: "desktop",
          os: "windows",
          depth: 100,
          priority, // High priority: ~1 min completion, Normal: ~20 min
          tag: keyword, // Use tag to identify keyword in results
        }));

        console.log(`[DataForSEO] Submitting batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} keywords`);
        
        const response = await this.makeRequest<{
          tasks: Array<{
            id: string;
            status_code: number;
            status_message: string;
            data?: { keyword: string; tag: string };
          }>;
        }>("/serp/google/organic/task_post", "POST", tasks, 60000);

        if (response.tasks) {
          for (const task of response.tasks) {
            if (task.status_code === 20100 && task.id) {
              // Task successfully submitted
              const keyword = task.data?.tag || task.data?.keyword || '';
              allTaskIds.push({ taskId: task.id, keyword });
            } else {
              console.warn(`[DataForSEO] Task submission failed: ${task.status_message}`);
              // Initialize as null for failed submissions
              const keyword = task.data?.tag || task.data?.keyword || '';
              if (keyword) {
                rankings.set(keyword, null);
                competitors.set(keyword, []);
                serpFeatures.set(keyword, []);
                rawSerpItems.set(keyword, []);
              }
            }
          }
        }

        // Small delay between batches
        if (i + BATCH_SIZE < keywords.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`[DataForSEO] Error submitting batch:`, error);
        // Mark all keywords in this batch as failed
        for (const keyword of batch) {
          rankings.set(keyword, null);
          competitors.set(keyword, []);
          serpFeatures.set(keyword, []);
          rawSerpItems.set(keyword, []);
        }
      }
    }

    console.log(`[DataForSEO] Submitted ${allTaskIds.length} tasks. Waiting for completion...`);

    // Step 2: Poll for task completion and retrieve results
    const pendingTaskIds = new Set(allTaskIds.map(t => t.taskId));
    const taskKeywordMap = new Map(allTaskIds.map(t => [t.taskId, t.keyword]));
    
    // High priority: ~1-2 min, Normal: ~20 min - set timeout accordingly
    const MAX_POLL_TIME = useHighPriority ? 5 * 60 * 1000 : 25 * 60 * 1000; // 5 min for high, 25 min for normal
    const POLL_INTERVAL = 6000; // Check every 6 seconds (DataForSEO rate limit: 20 calls/min on tasks_ready)
    const startTime = Date.now();
    let processedCount = 0;
    let lastProgressLog = 0;

    console.log(`[DataForSEO] Starting poll loop for ${pendingTaskIds.size} tasks (max ${MAX_POLL_TIME / 60000} min, priority: ${useHighPriority ? 'HIGH' : 'NORMAL'})`);

    while (pendingTaskIds.size > 0 && (Date.now() - startTime) < MAX_POLL_TIME) {
      try {
        // Check which tasks are ready
        const readyResponse = await this.makeRequest<{
          tasks: Array<{
            result: Array<{
              id: string;
              se: string;
              se_type: string;
            }>;
          }>;
        }>("/serp/google/organic/tasks_ready", "GET", undefined, 30000);

        const readyTaskIds: string[] = [];
        if (readyResponse.tasks?.[0]?.result) {
          for (const item of readyResponse.tasks[0].result) {
            if (pendingTaskIds.has(item.id)) {
              readyTaskIds.push(item.id);
            }
          }
        }

        // Fetch results for ready tasks
        for (const taskId of readyTaskIds) {
          try {
            const resultResponse = await this.makeRequest<{
              tasks: Array<{
                status_code: number;
                status_message: string;
                data?: { keyword: string; tag: string };
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
            }>(`/serp/google/organic/task_get/advanced/${taskId}`, "GET", undefined, 30000);

            const task = resultResponse.tasks?.[0];
            const keyword = task?.data?.tag || task?.data?.keyword || taskKeywordMap.get(taskId) || '';

            if (task && task.status_code === 20000 && task.result?.[0]) {
              const result = task.result[0];
              const allItems = result.items || [];
              const organicItems = allItems.filter(item => item.type === 'organic');
              
              // Store raw SERP items for SEID layout parsing
              rawSerpItems.set(keyword, allItems);

              // Find our domain's ranking
              const domainResult = organicItems.find(item => {
                const itemDomain = item.domain?.toLowerCase() || '';
                const itemUrl = item.url?.toLowerCase() || '';
                return itemDomain === domainLower || 
                  itemDomain.includes(domainLower) ||
                  itemUrl.includes(domainLower);
              });

              if (domainResult) {
                const rankAbsolute = domainResult.rank_absolute;
                const fallbackPosition = domainResult.rank_group > 0 ? domainResult.rank_group : null;
                rankings.set(keyword, {
                  keyword,
                  rank_group: domainResult.rank_group,
                  rank_absolute: rankAbsolute > 0 ? rankAbsolute : (fallbackPosition || 0),
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

              // Get competitors
              const top10Competitors = organicItems
                .filter(item => {
                  const itemDomain = item.domain?.toLowerCase() || '';
                  const itemUrl = item.url?.toLowerCase() || '';
                  return itemDomain !== domainLower && 
                    !itemDomain.includes(domainLower) &&
                    !itemUrl.includes(domainLower);
                })
                .slice(0, 10)
                .map(item => ({
                  domain: item.domain || '',
                  position: item.rank_group > 0 ? item.rank_group : (item.rank_absolute > 0 ? item.rank_absolute : 100),
                  url: item.url || '',
                  title: item.title || '',
                }));
              competitors.set(keyword, top10Competitors);

              // Extract SERP features
              const itemTypes = result.item_types || [];
              const features = itemTypes.map(type => featureMapping[type]).filter(Boolean);
              serpFeatures.set(keyword, features);
            } else {
              rankings.set(keyword, null);
              competitors.set(keyword, []);
              serpFeatures.set(keyword, []);
              rawSerpItems.set(keyword, []);
            }

            pendingTaskIds.delete(taskId);
            processedCount++;

            if (onProgress) {
              onProgress(processedCount, allTaskIds.length);
            }

            // Small delay between result fetches
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`[DataForSEO] Error fetching task ${taskId}:`, error);
            pendingTaskIds.delete(taskId);
            const keyword = taskKeywordMap.get(taskId) || '';
            rankings.set(keyword, null);
            competitors.set(keyword, []);
            serpFeatures.set(keyword, []);
            rawSerpItems.set(keyword, []);
            processedCount++;
            if (onProgress) {
              onProgress(processedCount, allTaskIds.length);
            }
          }
        }

        // Log progress periodically (every 20 tasks or every 30 seconds)
        const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
        if (readyTaskIds.length > 0 || (processedCount - lastProgressLog >= 20) || (Date.now() - startTime) % 30000 < POLL_INTERVAL) {
          if (processedCount > lastProgressLog) {
            console.log(`[DataForSEO] Processed ${processedCount}/${allTaskIds.length} tasks. ${pendingTaskIds.size} remaining. (${elapsedMinutes}m elapsed)`);
            lastProgressLog = processedCount;
          }
        }

        // Wait before next poll if tasks still pending
        if (pendingTaskIds.size > 0) {
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }
      } catch (error) {
        console.error(`[DataForSEO] Error checking tasks_ready:`, error);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }
    }

    // Mark any remaining pending tasks as failed
    if (pendingTaskIds.size > 0) {
      const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
      console.warn(`[DataForSEO] ${pendingTaskIds.size}/${allTaskIds.length} tasks did not complete within ${elapsedMinutes} minutes. Completed: ${processedCount}. These keywords will have no SERP layout data.`);
      Array.from(pendingTaskIds).forEach(taskId => {
        const keyword = taskKeywordMap.get(taskId) || '';
        if (keyword && !rankings.has(keyword)) {
          rankings.set(keyword, null);
          competitors.set(keyword, []);
          serpFeatures.set(keyword, []);
          rawSerpItems.set(keyword, []);
        }
      });
    }

    console.log(`[DataForSEO] Standard Method complete. Processed ${rankings.size} keywords.`);
    return { rankings, competitors, serpFeatures, rawSerpItems };
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

  async getCompetitors(domain: string, locationCode: number = 2840, limit: number = 100): Promise<Array<{
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
      limit: Math.min(limit, 1000),
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

  async getBulkDomainBacklinks(domains: string[]): Promise<Map<string, BacklinkData>> {
    const results = new Map<string, BacklinkData>();
    
    if (domains.length === 0) {
      return results;
    }

    console.log(`[DataForSEO] Fetching bulk backlink data for ${domains.length} domains in parallel`);

    const CONCURRENT_LIMIT = 5;
    
    for (let i = 0; i < domains.length; i += CONCURRENT_LIMIT) {
      const batch = domains.slice(i, Math.min(i + CONCURRENT_LIMIT, domains.length));
      
      const promises = batch.map(async (domain) => {
        try {
          const response = await this.makeRequest<{
            tasks: Array<{
              status_code: number;
              data?: { target: string };
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

          const task = response.tasks?.[0];
          if (task?.status_code === 20000 && task.result?.[0]) {
            const result = task.result[0];
            return {
              domain,
              data: {
                totalBacklinks: result.total_count || 0,
                referringDomains: result.referring_domains || 0,
                domainAuthority: result.rank || 0,
              }
            };
          }
          return { domain, data: { totalBacklinks: 0, referringDomains: 0, domainAuthority: 0 } };
        } catch (error) {
          console.warn(`[DataForSEO] Failed to fetch backlinks for ${domain}:`, error);
          return { domain, data: { totalBacklinks: 0, referringDomains: 0, domainAuthority: 0 } };
        }
      });

      const batchResults = await Promise.all(promises);
      for (const { domain, data } of batchResults) {
        results.set(domain, data);
      }

      if (i + CONCURRENT_LIMIT < domains.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[DataForSEO] Retrieved backlink data for ${results.size}/${domains.length} domains`);
    return results;
  }

  async getBulkPagesBacklinks(urls: string[]): Promise<Map<string, {
    backlinksCount: number;
    referringDomains: number;
    dofollowLinks: number;
    rank: number;
  }>> {
    const results = new Map<string, {
      backlinksCount: number;
      referringDomains: number;
      dofollowLinks: number;
      rank: number;
    }>();

    const batchSize = 100;
    console.log(`[DataForSEO] Fetching bulk backlinks for ${urls.length} URLs`);

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      try {
        const tasks = batch.map(url => ({
          target: url,
          internal_list_limit: 0,
        }));

        const response = await this.makeRequest<{
          tasks: Array<{
            status_code: number;
            data?: { target: string };
            result: Array<{
              target: string;
              total_count: number;
              referring_domains: number;
              dofollow: number;
              rank: number;
            }>;
          }>;
        }>("/backlinks/bulk_pages_summary/live", "POST", tasks);

        for (const task of response.tasks || []) {
          if (task.status_code === 20000 && task.result?.[0]) {
            const result = task.result[0];
            const url = task.data?.target || result.target;
            results.set(url, {
              backlinksCount: result.total_count || 0,
              referringDomains: result.referring_domains || 0,
              dofollowLinks: result.dofollow || 0,
              rank: result.rank || 0,
            });
          }
        }
      } catch (error) {
        console.error(`[DataForSEO] Error fetching bulk backlinks batch:`, error);
      }

      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`[DataForSEO] Retrieved backlinks for ${results.size}/${urls.length} URLs`);
    return results;
  }

  async getPageBacklinksSummary(url: string): Promise<{
    backlinksCount: number;
    referringDomains: number;
    dofollowLinks: number;
    rank: number;
  } | null> {
    try {
      const response = await this.makeRequest<{
        tasks: Array<{
          status_code: number;
          status_message: string;
          result: Array<{
            target: string;
            backlinks: number;
            referring_main_domains: number;
            referring_domains: number;
            referring_ips: number;
            referring_subnets: number;
            referring_pages: number;
            dofollow: number;
            nofollow: number;
            rank: number;
            main_domain_rank: number;
            broken_backlinks: number;
            broken_pages: number;
          }>;
        }>;
      }>("/backlinks/summary/live", "POST", [{
        target: url,
        include_subdomains: false,
      }]);

      const task = response.tasks?.[0];
      if (task?.status_code === 20000 && task.result?.[0]) {
        const result = task.result[0];
        return {
          backlinksCount: result.backlinks || 0,
          referringDomains: result.referring_domains || 0,
          dofollowLinks: result.dofollow || 0,
          rank: result.rank || 0,
        };
      }
      return null;
    } catch (error) {
      console.error(`[DataForSEO] Error fetching backlinks summary for ${url}:`, error);
      return null;
    }
  }

  async syncPagesBacklinks(urls: string[], onProgress?: (processed: number, total: number) => void): Promise<Map<string, {
    backlinksCount: number;
    referringDomains: number;
    dofollowLinks: number;
    rank: number;
  }>> {
    const results = new Map<string, {
      backlinksCount: number;
      referringDomains: number;
      dofollowLinks: number;
      rank: number;
    }>();

    const concurrencyLimit = 5; // Process 5 URLs concurrently
    console.log(`[DataForSEO] Syncing backlinks for ${urls.length} pages using Summary API (${concurrencyLimit} concurrent)`);

    let processed = 0;
    
    // Process URLs in concurrent batches
    for (let i = 0; i < urls.length; i += concurrencyLimit) {
      const batch = urls.slice(i, Math.min(i + concurrencyLimit, urls.length));
      
      await Promise.all(batch.map(async (url) => {
        try {
          const data = await this.getPageBacklinksSummary(url);
          if (data) {
            results.set(url.toLowerCase().replace(/\/+$/, ''), data);
            console.log(`  ✓ ${url}: ${data.backlinksCount} backlinks, ${data.referringDomains} domains`);
          } else {
            console.log(`  ! ${url}: No data returned`);
          }
        } catch (error) {
          console.error(`  ! ${url}: Error - ${error}`);
        }
      }));
      
      processed += batch.length;
      if (onProgress) {
        onProgress(processed, urls.length);
      }
      
      // Small delay between batches
      if (i + concurrencyLimit < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[DataForSEO] Synced backlinks for ${results.size}/${urls.length} pages`);
    return results;
  }

  async getBacklinksTimeseries(url: string, days: number = 30): Promise<{
    newLinks: number;
    lostLinks: number;
  }> {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      const dateTo = new Date();

      const response = await this.makeRequest<{
        tasks: Array<{
          status_code: number;
          result: Array<{
            items: Array<{
              date: string;
              new_backlinks: number;
              lost_backlinks: number;
            }>;
          }>;
        }>;
      }>("/backlinks/history/live", "POST", [{
        target: url,
        date_from: dateFrom.toISOString().split('T')[0],
        date_to: dateTo.toISOString().split('T')[0],
      }]);

      let totalNew = 0;
      let totalLost = 0;

      const items = response.tasks?.[0]?.result?.[0]?.items || [];
      for (const item of items) {
        totalNew += item.new_backlinks || 0;
        totalLost += item.lost_backlinks || 0;
      }

      return { newLinks: totalNew, lostLinks: totalLost };
    } catch (error) {
      console.error(`[DataForSEO] Error fetching backlinks timeseries for ${url}:`, error);
      return { newLinks: 0, lostLinks: 0 };
    }
  }

  async getOnPagePagesData(taskId: string, urls: string[]): Promise<Map<string, {
    statusCode: number;
    isIndexable: boolean;
    hasSchema: boolean;
    wordCount: number;
    pageScore: number;
    duplicateContent: boolean;
    coreWebVitalsScore: number;
  }>> {
    const results = new Map<string, {
      statusCode: number;
      isIndexable: boolean;
      hasSchema: boolean;
      wordCount: number;
      pageScore: number;
      duplicateContent: boolean;
      coreWebVitalsScore: number;
    }>();

    try {
      const response = await this.makeRequest<{
        tasks: Array<{
          status_code: number;
          result: Array<{
            items: Array<{
              url: string;
              status_code: number;
              meta?: {
                canonical?: string;
                content?: string;
              };
              page_timing?: {
                time_to_interactive?: number;
              };
              onpage_score?: number;
              checks?: {
                no_index_page?: boolean;
                is_redirect?: boolean;
                no_content?: boolean;
                duplicate_content?: boolean;
                deprecated_html_tags?: boolean;
              };
              content_encoding?: string;
              total_dom_size?: number;
              custom_js_response?: unknown;
              resource_errors?: number;
              schema_types?: string[];
              content?: {
                plain_text_word_count?: number;
              };
            }>;
          }>;
        }>;
      }>(`/on_page/pages/${taskId}`, "GET");

      const items = response.tasks?.[0]?.result?.[0]?.items || [];
      
      for (const item of items) {
        const normalizedUrl = item.url?.toLowerCase().replace(/\/$/, '') || '';
        
        if (urls.some(u => u.toLowerCase().replace(/\/$/, '') === normalizedUrl)) {
          results.set(item.url, {
            statusCode: item.status_code || 0,
            isIndexable: !item.checks?.no_index_page && !item.checks?.is_redirect,
            hasSchema: (item.schema_types?.length || 0) > 0,
            wordCount: item.content?.plain_text_word_count || 0,
            pageScore: item.onpage_score || 0,
            duplicateContent: item.checks?.duplicate_content || false,
            coreWebVitalsScore: item.page_timing?.time_to_interactive ? 
              Math.max(0, 100 - (item.page_timing.time_to_interactive / 100)) : 75,
          });
        }
      }
    } catch (error) {
      console.error(`[DataForSEO] Error fetching on-page data:`, error);
    }

    return results;
  }

  async startOnPageCrawl(domain: string, maxPages: number = 500): Promise<string | null> {
    try {
      const response = await this.makeRequest<{
        tasks: Array<{ id: string; status_code: number }>;
      }>("/on_page/task_post", "POST", [{
        target: domain,
        max_crawl_pages: maxPages,
        load_resources: false,
        enable_javascript: false,
        store_raw_html: false,
        check_spell: false,
        calculate_keyword_density: false,
      }]);

      const taskId = response.tasks?.[0]?.id;
      if (taskId) {
        console.log(`[DataForSEO] Started on-page crawl for ${domain}, task ID: ${taskId}`);
        return taskId;
      }
      return null;
    } catch (error) {
      console.error(`[DataForSEO] Error starting on-page crawl:`, error);
      return null;
    }
  }

  async getOnPageCrawlStatus(taskId: string): Promise<{
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    pagesCrawled: number;
    pagesTotal: number;
  }> {
    try {
      const response = await this.makeRequest<{
        tasks: Array<{
          result: Array<{
            crawl_progress: string;
            crawl_status?: {
              pages_crawled?: number;
              max_crawl_pages?: number;
            };
          }>;
        }>;
      }>(`/on_page/summary/${taskId}`, "GET");

      const result = response.tasks?.[0]?.result?.[0];
      const progress = result?.crawl_progress || 'failed';
      
      return {
        status: progress === 'finished' ? 'completed' : 
                progress === 'in_progress' ? 'in_progress' : 
                progress === 'failed' ? 'failed' : 'pending',
        pagesCrawled: result?.crawl_status?.pages_crawled || 0,
        pagesTotal: result?.crawl_status?.max_crawl_pages || 0,
      };
    } catch (error) {
      console.error(`[DataForSEO] Error getting crawl status:`, error);
      return { status: 'failed', pagesCrawled: 0, pagesTotal: 0 };
    }
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

  async getIndividualBacklinks(targetUrl: string, limit: number = 100): Promise<{
    backlinks: Array<{
      sourceUrl: string;
      sourceDomain: string;
      anchorText: string;
      linkType: 'dofollow' | 'nofollow';
      domainAuthority: number;
      pageAuthority: number;
      firstSeen: Date | null;
      lastSeen: Date | null;
      isLive: boolean;
    }>;
    totalCount: number;
  }> {
    try {
      console.log(`[DataForSEO] Fetching individual backlinks for ${targetUrl}`);
      
      const response = await this.makeRequest<{
        tasks: Array<{
          status_code: number;
          status_message: string;
          result: Array<{
            total_count: number;
            items: Array<{
              type: string;
              domain_from: string;
              url_from: string;
              url_to: string;
              anchor: string;
              dofollow: boolean;
              first_seen: string;
              last_seen: string;
              is_lost: boolean;
              rank: number;
              page_from_rank: number;
            }>;
          }>;
        }>;
      }>("/backlinks/backlinks/live", "POST", [{
        target: targetUrl,
        limit: limit,
        order_by: ["rank,desc"],
        filters: null,
        include_subdomains: false,
      }]);

      const task = response.tasks?.[0];
      if (task?.status_code !== 20000 || !task.result?.[0]) {
        console.warn(`[DataForSEO] No backlinks data for ${targetUrl}: ${task?.status_message}`);
        return { backlinks: [], totalCount: 0 };
      }

      const result = task.result[0];
      const backlinks = (result.items || []).map(item => ({
        sourceUrl: item.url_from || '',
        sourceDomain: item.domain_from || '',
        anchorText: item.anchor || '',
        linkType: item.dofollow ? 'dofollow' as const : 'nofollow' as const,
        domainAuthority: item.rank || 0,
        pageAuthority: item.page_from_rank || 0,
        firstSeen: item.first_seen ? new Date(item.first_seen) : null,
        lastSeen: item.last_seen ? new Date(item.last_seen) : null,
        isLive: !item.is_lost,
      }));

      console.log(`[DataForSEO] Found ${backlinks.length} backlinks (total: ${result.total_count}) for ${targetUrl}`);
      return { backlinks, totalCount: result.total_count || 0 };
    } catch (error) {
      console.error(`[DataForSEO] Error fetching individual backlinks for ${targetUrl}:`, error);
      return { backlinks: [], totalCount: 0 };
    }
  }

  async getNewAndLostBacklinks(targetUrl: string, days: number = 7): Promise<{
    newBacklinks: Array<{
      sourceUrl: string;
      sourceDomain: string;
      anchorText: string;
      linkType: 'dofollow' | 'nofollow';
      domainAuthority: number;
      firstSeen: Date;
    }>;
    lostBacklinks: Array<{
      sourceUrl: string;
      sourceDomain: string;
      lostDate: Date;
    }>;
  }> {
    try {
      console.log(`[DataForSEO] Fetching new/lost backlinks for ${targetUrl} (last ${days} days)`);
      
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      const dateFromStr = dateFrom.toISOString().split('T')[0];
      
      const newBacklinks: Array<{
        sourceUrl: string;
        sourceDomain: string;
        anchorText: string;
        linkType: 'dofollow' | 'nofollow';
        domainAuthority: number;
        firstSeen: Date;
      }> = [];

      const lostBacklinks: Array<{
        sourceUrl: string;
        sourceDomain: string;
        lostDate: Date;
      }> = [];

      const newResponse = await this.makeRequest<{
        tasks: Array<{
          status_code: number;
          result: Array<{
            items: Array<{
              domain_from: string;
              url_from: string;
              anchor: string;
              dofollow: boolean;
              first_seen: string;
              rank: number;
            }>;
          }>;
        }>;
      }>("/backlinks/backlinks/live", "POST", [{
        target: targetUrl,
        limit: 100,
        order_by: ["first_seen,desc"],
        filters: [["first_seen", ">=", dateFromStr]],
        include_subdomains: false,
      }]);

      const newItems = newResponse.tasks?.[0]?.result?.[0]?.items || [];
      for (const item of newItems) {
        newBacklinks.push({
          sourceUrl: item.url_from || '',
          sourceDomain: item.domain_from || '',
          anchorText: item.anchor || '',
          linkType: item.dofollow ? 'dofollow' : 'nofollow',
          domainAuthority: item.rank || 0,
          firstSeen: new Date(item.first_seen),
        });
      }

      const lostResponse = await this.makeRequest<{
        tasks: Array<{
          status_code: number;
          result: Array<{
            items: Array<{
              domain_from: string;
              url_from: string;
              last_seen: string;
            }>;
          }>;
        }>;
      }>("/backlinks/backlinks/live", "POST", [{
        target: targetUrl,
        limit: 100,
        order_by: ["last_seen,desc"],
        filters: [
          ["is_lost", "=", true],
          ["last_seen", ">=", dateFromStr]
        ],
        include_subdomains: false,
      }]);

      const lostItems = lostResponse.tasks?.[0]?.result?.[0]?.items || [];
      for (const item of lostItems) {
        lostBacklinks.push({
          sourceUrl: item.url_from || '',
          sourceDomain: item.domain_from || '',
          lostDate: new Date(item.last_seen),
        });
      }

      console.log(`[DataForSEO] Found ${newBacklinks.length} new and ${lostBacklinks.length} lost backlinks for ${targetUrl}`);
      return { newBacklinks, lostBacklinks };
    } catch (error) {
      console.error(`[DataForSEO] Error fetching new/lost backlinks:`, error);
      return { newBacklinks: [], lostBacklinks: [] };
    }
  }

  // Comprehensive OnPage API Methods for Technical SEO Suite
  async startTechAuditCrawl(domain: string, options?: {
    maxPages?: number;
    enableJavascript?: boolean;
    checkSpell?: boolean;
    calculateKeywordDensity?: boolean;
    customUserAgent?: string;
  }): Promise<{ taskId: string | null; error?: string }> {
    try {
      const targetDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      console.log(`[DataForSEO] Starting technical audit crawl for ${targetDomain}`);

      const response = await this.makeRequest<{
        tasks: Array<{
          id: string;
          status_code: number;
          status_message: string;
        }>;
      }>("/on_page/task_post", "POST", [{
        target: targetDomain,
        max_crawl_pages: options?.maxPages ?? 500,
        load_resources: true,
        enable_javascript: options?.enableJavascript ?? false,
        store_raw_html: false,
        check_spell: options?.checkSpell ?? false,
        calculate_keyword_density: options?.calculateKeywordDensity ?? false,
        custom_user_agent: options?.customUserAgent,
        enable_browser_rendering: false,
        disable_cookie_popup: true,
      }]);

      const task = response.tasks?.[0];
      if (task?.id) {
        console.log(`[DataForSEO] Technical audit crawl queued for ${targetDomain}, task ID: ${task.id}`);
        return { taskId: task.id };
      }

      return { taskId: null, error: task?.status_message || 'Unknown error' };
    } catch (error) {
      console.error(`[DataForSEO] Error starting technical audit crawl:`, error);
      return { taskId: null, error: String(error) };
    }
  }

  async getTechAuditSummary(taskId: string): Promise<{
    status: 'queued' | 'running' | 'completed' | 'failed';
    domain: string;
    pagesCrawled: number;
    maxPages: number;
    onpageScore: number;
    issuesSummary: {
      critical: number;
      warnings: number;
      opportunities: number;
    };
    pagesByStatusCode: Record<string, number>;
    checkCounts: Record<string, number>;
  } | null> {
    try {
      const response = await this.makeRequest<{
        tasks: Array<{
          status_code: number;
          result: Array<{
            crawl_progress: string;
            crawl_status: {
              pages_crawled: number;
              max_crawl_pages: number;
            };
            domain_info: {
              name: string;
              checks?: Record<string, unknown>;
            };
            page_metrics: {
              onpage_score: number;
              checks: Record<string, number>;
            };
            pages_with_errors?: number;
            pages_with_warnings?: number;
          }>;
        }>;
      }>(`/on_page/summary/${taskId}`, "GET");

      const task = response.tasks?.[0];
      if (!task?.result?.[0]) return null;

      const result = task.result[0];
      const progress = result.crawl_progress;
      
      let status: 'queued' | 'running' | 'completed' | 'failed';
      if (progress === 'finished') status = 'completed';
      else if (progress === 'in_progress') status = 'running';
      else if (progress === 'failed') status = 'failed';
      else status = 'queued';

      const checks = result.page_metrics?.checks || {};
      const criticalCount = (checks.no_content || 0) + 
        (checks.is_4xx_code || 0) + 
        (checks.is_5xx_code || 0) + 
        (checks.is_broken || 0) +
        (checks.no_index_page || 0);
      
      const warningsCount = (checks.duplicate_title || 0) + 
        (checks.duplicate_description || 0) +
        (checks.duplicate_content || 0) +
        (checks.title_too_long || 0) +
        (checks.title_too_short || 0) +
        (checks.low_content_rate || 0) +
        (checks.has_redirect || 0) +
        (checks.is_redirect || 0);

      const pagesByStatusCode: Record<string, number> = {};
      for (const [key, value] of Object.entries(checks)) {
        if (key.startsWith('is_') && key.endsWith('xx_code')) {
          const code = key.replace('is_', '').replace('xx_code', 'xx');
          pagesByStatusCode[code] = value as number;
        }
      }

      return {
        status,
        domain: result.domain_info?.name || '',
        pagesCrawled: result.crawl_status?.pages_crawled || 0,
        maxPages: result.crawl_status?.max_crawl_pages || 0,
        onpageScore: result.page_metrics?.onpage_score || 0,
        issuesSummary: {
          critical: criticalCount,
          warnings: warningsCount,
          opportunities: 0,
        },
        pagesByStatusCode,
        checkCounts: checks,
      };
    } catch (error) {
      console.error(`[DataForSEO] Error getting tech audit summary:`, error);
      return null;
    }
  }

  async getTechAuditPages(taskId: string, limit: number = 1000, offset: number = 0): Promise<{
    pages: Array<{
      url: string;
      statusCode: number;
      onpageScore: number;
      meta: {
        title: string;
        titleLength: number;
        description: string;
        descriptionLength: number;
        canonicalUrl: string | null;
      };
      content: {
        wordCount: number;
        h1Count: number;
        h2Count: number;
        readabilityScore: number;
        contentRate: number;
      };
      performance: {
        pageSizeKb: number;
        loadTimeMs: number;
        lcpMs: number | null;
        clsScore: number | null;
        tbtMs: number | null;
        fidMs: number | null;
      };
      links: {
        internalCount: number;
        externalCount: number;
        brokenCount: number;
      };
      images: {
        count: number;
        withoutAlt: number;
      };
      schema: {
        hasSchema: boolean;
        types: string[];
      };
      indexability: {
        isIndexable: boolean;
        reason: string | null;
      };
      structure: {
        clickDepth: number | null;
        isOrphanPage: boolean;
      };
      checks: Record<string, boolean>;
      rawData: Record<string, unknown>;
    }>;
    totalCount: number;
  }> {
    try {
      const response = await this.makeRequest<{
        tasks: Array<{
          status_code: number;
          result: Array<{
            items_count: number;
            items: Array<{
              url: string;
              status_code: number;
              onpage_score: number;
              meta?: {
                title?: string;
                description?: string;
                canonical?: string;
              };
              page_timing?: {
                time_to_interactive?: number;
                dom_complete?: number;
                largest_contentful_paint?: number;
                first_input_delay?: number;
                cumulative_layout_shift?: number;
                total_blocking_time?: number;
              };
              content?: {
                plain_text_word_count?: number;
                automated_readability_index?: number;
                content_rate?: number;
              };
              total_dom_size?: number;
              internal_links_count?: number;
              external_links_count?: number;
              broken_links?: number;
              images_count?: number;
              images_without_alt?: number;
              h1?: { count?: number };
              h2?: { count?: number };
              schema_types?: string[];
              checks?: Record<string, boolean>;
              click_depth?: number;
              is_orphan_page?: boolean;
              indexation?: {
                status?: string;
                reason?: string;
              };
            }>;
          }>;
        }>;
      }>(`/on_page/pages`, "POST", [{
        id: taskId,
        limit,
        offset,
        order_by: ["onpage_score,asc"],
        filters: null,
      }]);

      const result = response.tasks?.[0]?.result?.[0];
      if (!result) {
        return { pages: [], totalCount: 0 };
      }

      const pages = (result.items || []).map(item => {
        const meta = item.meta || {} as any;
        const metaContent = meta.content || {};
        const htags = meta.htags || {};
        const timing = item.page_timing || {};
        const checks = item.checks || {};
        const indexation = item.indexation || {};

        const isIndexable = !checks.no_index_page && 
          !checks.is_redirect && 
          indexation.status !== 'non_indexable';

        let indexabilityReason: string | null = null;
        if (!isIndexable) {
          if (checks.no_index_page) indexabilityReason = 'noindex';
          else if (checks.is_redirect) indexabilityReason = 'redirect';
          else if (indexation.reason) indexabilityReason = indexation.reason;
        }

        // Extract heading counts from htags arrays
        const h1Array = htags.h1 || [];
        const h2Array = htags.h2 || [];

        return {
          url: item.url || '',
          statusCode: item.status_code || 0,
          onpageScore: item.onpage_score || 0,
          meta: {
            title: meta.title || '',
            titleLength: meta.title_length || (meta.title || '').length,
            description: meta.description || '',
            descriptionLength: meta.description_length || (meta.description || '').length,
            canonicalUrl: meta.canonical || null,
          },
          content: {
            // Content metrics are nested under meta.content in the API response
            wordCount: metaContent.plain_text_word_count || 0,
            h1Count: Array.isArray(h1Array) ? h1Array.length : 0,
            h2Count: Array.isArray(h2Array) ? h2Array.length : 0,
            readabilityScore: metaContent.automated_readability_index || 0,
            contentRate: metaContent.plain_text_rate || 0,
          },
          performance: {
            pageSizeKb: (item.total_dom_size || 0) / 1024,
            loadTimeMs: timing.dom_complete || 0,
            lcpMs: timing.largest_contentful_paint || null,
            clsScore: meta.cumulative_layout_shift ?? timing.cumulative_layout_shift ?? null,
            tbtMs: timing.total_blocking_time || null,
            fidMs: timing.first_input_delay || null,
          },
          links: {
            // Link counts are inside meta in the API response
            internalCount: meta.internal_links_count || 0,
            externalCount: meta.external_links_count || 0,
            brokenCount: item.broken_links || 0,
          },
          images: {
            // Image count is inside meta in the API response
            count: meta.images_count || 0,
            withoutAlt: item.images_without_alt || 0,
          },
          schema: {
            hasSchema: (item.schema_types?.length || 0) > 0,
            types: item.schema_types || [],
          },
          indexability: {
            isIndexable,
            reason: indexabilityReason,
          },
          structure: {
            clickDepth: item.click_depth || null,
            isOrphanPage: item.is_orphan_page || false,
          },
          checks,
          rawData: item as Record<string, unknown>,
        };
      });

      return { pages, totalCount: result.items_count || pages.length };
    } catch (error) {
      console.error(`[DataForSEO] Error getting tech audit pages:`, error);
      return { pages: [], totalCount: 0 };
    }
  }

  async getTechAuditNonIndexable(taskId: string, limit: number = 100): Promise<{
    pages: Array<{
      url: string;
      reason: string;
      statusCode: number;
    }>;
    totalCount: number;
  }> {
    try {
      const response = await this.makeRequest<{
        tasks: Array<{
          status_code: number;
          result: Array<{
            items_count: number;
            items: Array<{
              url: string;
              reason: string;
              status_code: number;
            }>;
          }>;
        }>;
      }>(`/on_page/non_indexable`, "POST", [{
        id: taskId,
        limit,
      }]);

      const result = response.tasks?.[0]?.result?.[0];
      if (!result) {
        return { pages: [], totalCount: 0 };
      }

      return {
        pages: (result.items || []).map(item => ({
          url: item.url || '',
          reason: item.reason || 'unknown',
          statusCode: item.status_code || 0,
        })),
        totalCount: result.items_count || 0,
      };
    } catch (error) {
      console.error(`[DataForSEO] Error getting non-indexable pages:`, error);
      return { pages: [], totalCount: 0 };
    }
  }

  // Issue classification helper for Technical SEO Suite
  classifyOnPageIssue(checkKey: string, checkValue: boolean | number): {
    code: string;
    label: string;
    severity: 'critical' | 'warning' | 'info';
    category: 'indexability' | 'content' | 'links' | 'performance' | 'html' | 'images' | 'security' | 'other';
  } | null {
    if (!checkValue) return null;

    const issueMap: Record<string, { label: string; severity: 'critical' | 'warning' | 'info'; category: 'indexability' | 'content' | 'links' | 'performance' | 'html' | 'images' | 'security' | 'other' }> = {
      // Critical - Indexability
      no_index_page: { label: 'Page has noindex tag', severity: 'critical', category: 'indexability' },
      is_4xx_code: { label: '4xx HTTP status code', severity: 'critical', category: 'indexability' },
      is_5xx_code: { label: '5xx HTTP status code', severity: 'critical', category: 'indexability' },
      is_broken: { label: 'Page is broken', severity: 'critical', category: 'indexability' },
      no_content: { label: 'Page has no content', severity: 'critical', category: 'content' },
      
      // Warning - Content
      duplicate_title: { label: 'Duplicate title tag', severity: 'warning', category: 'content' },
      duplicate_description: { label: 'Duplicate meta description', severity: 'warning', category: 'content' },
      duplicate_content: { label: 'Duplicate page content', severity: 'warning', category: 'content' },
      title_too_long: { label: 'Title tag too long (>70 chars)', severity: 'warning', category: 'content' },
      title_too_short: { label: 'Title tag too short (<30 chars)', severity: 'warning', category: 'content' },
      no_title: { label: 'Missing title tag', severity: 'warning', category: 'content' },
      no_description: { label: 'Missing meta description', severity: 'warning', category: 'content' },
      description_too_long: { label: 'Meta description too long', severity: 'warning', category: 'content' },
      description_too_short: { label: 'Meta description too short', severity: 'warning', category: 'content' },
      low_content_rate: { label: 'Low content-to-code ratio', severity: 'warning', category: 'content' },
      low_readability_rate: { label: 'Low readability score', severity: 'info', category: 'content' },
      no_h1_tag: { label: 'Missing H1 heading', severity: 'warning', category: 'content' },
      has_several_h1_tags: { label: 'Multiple H1 headings', severity: 'warning', category: 'html' },
      
      // Warning - Links
      has_redirect: { label: 'Page redirects', severity: 'info', category: 'links' },
      is_redirect: { label: 'Page is a redirect', severity: 'info', category: 'links' },
      has_redirect_chain: { label: 'Redirect chain detected', severity: 'warning', category: 'links' },
      has_redirect_loop: { label: 'Redirect loop detected', severity: 'critical', category: 'links' },
      is_orphan_page: { label: 'Orphan page (no internal links)', severity: 'warning', category: 'links' },
      has_links_to_redirects: { label: 'Links to redirected pages', severity: 'info', category: 'links' },
      is_link_relation_conflict: { label: 'Link relation conflict', severity: 'warning', category: 'links' },
      
      // Warning - Performance
      large_page_size: { label: 'Large page size', severity: 'warning', category: 'performance' },
      high_loading_time: { label: 'High loading time', severity: 'warning', category: 'performance' },
      high_waiting_time: { label: 'High server response time', severity: 'warning', category: 'performance' },
      
      // Warning - HTML
      deprecated_html_tags: { label: 'Uses deprecated HTML tags', severity: 'info', category: 'html' },
      is_http: { label: 'Uses HTTP instead of HTTPS', severity: 'warning', category: 'security' },
      
      // Warning - Images
      no_image_alt: { label: 'Images missing alt text', severity: 'warning', category: 'images' },
      no_image_title: { label: 'Images missing title', severity: 'info', category: 'images' },
      seo_friendly_url: { label: 'Non-SEO friendly URL', severity: 'info', category: 'other' },
      
      // Info - Canonical
      canonical_to_broken: { label: 'Canonical points to broken page', severity: 'critical', category: 'indexability' },
      canonical_to_redirect: { label: 'Canonical points to redirect', severity: 'warning', category: 'indexability' },
      has_canonical_tag: { label: 'Has canonical tag', severity: 'info', category: 'indexability' },
      no_canonical_tag: { label: 'Missing canonical tag', severity: 'info', category: 'indexability' },
    };

    const issue = issueMap[checkKey];
    if (!issue) return null;

    return {
      code: checkKey,
      ...issue,
    };
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

  async getBulkSpamScores(domains: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    
    if (domains.length === 0) {
      return results;
    }

    const batchSize = 1000;
    console.log(`[DataForSEO] Fetching spam scores for ${domains.length} domains`);

    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      
      try {
        const response = await this.makeRequest<{
          tasks: Array<{
            status_code: number;
            result: Array<{
              items: Array<{
                target: string;
                spam_score: number;
              }>;
            }>;
          }>;
        }>("/backlinks/bulk_spam_score/live", "POST", [{
          targets: batch,
        }]);

        const items = response.tasks?.[0]?.result?.[0]?.items || [];
        for (const item of items) {
          if (item.target && item.spam_score !== undefined) {
            results.set(item.target.toLowerCase(), item.spam_score);
          }
        }
      } catch (error) {
        console.error(`[DataForSEO] Error fetching bulk spam scores:`, error);
      }

      if (i + batchSize < domains.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`[DataForSEO] Retrieved spam scores for ${results.size}/${domains.length} domains`);
    return results;
  }

  async getCompetitorBacklinks(competitorDomain: string, limit: number = 100): Promise<{
    backlinks: Array<{
      sourceUrl: string;
      sourceDomain: string;
      targetUrl: string;
      anchorText: string;
      linkType: 'dofollow' | 'nofollow' | 'ugc' | 'sponsored';
      domainAuthority: number;
      pageAuthority: number;
      firstSeen: Date;
      lastSeen: Date;
      isLive: boolean;
    }>;
    totalCount: number;
  }> {
    try {
      console.log(`[DataForSEO] Fetching backlinks for competitor: ${competitorDomain}`);
      
      const response = await this.makeRequest<{
        tasks: Array<{
          status_code: number;
          result: Array<{
            total_count: number;
            items: Array<{
              domain_from: string;
              url_from: string;
              url_to: string;
              anchor: string;
              dofollow: boolean;
              is_lost: boolean;
              first_seen: string;
              last_seen: string;
              rank: number;
              page_from_rank: number;
              attr?: string[];
            }>;
          }>;
        }>;
      }>("/backlinks/backlinks/live", "POST", [{
        target: competitorDomain,
        limit,
        order_by: ["rank,desc"],
        include_subdomains: true,
      }]);

      const result = response.tasks?.[0]?.result?.[0];
      if (!result) {
        return { backlinks: [], totalCount: 0 };
      }

      const backlinks = (result.items || []).map(item => {
        let linkType: 'dofollow' | 'nofollow' | 'ugc' | 'sponsored' = item.dofollow ? 'dofollow' : 'nofollow';
        if (item.attr?.includes('ugc')) linkType = 'ugc';
        if (item.attr?.includes('sponsored')) linkType = 'sponsored';

        return {
          sourceUrl: item.url_from || '',
          sourceDomain: item.domain_from || '',
          targetUrl: item.url_to || '',
          anchorText: item.anchor || '',
          linkType,
          domainAuthority: item.rank || 0,
          pageAuthority: item.page_from_rank || 0,
          firstSeen: new Date(item.first_seen),
          lastSeen: new Date(item.last_seen),
          isLive: !item.is_lost,
        };
      });

      console.log(`[DataForSEO] Found ${backlinks.length} backlinks (total: ${result.total_count}) for ${competitorDomain}`);
      return { backlinks, totalCount: result.total_count || 0 };
    } catch (error) {
      console.error(`[DataForSEO] Error fetching competitor backlinks for ${competitorDomain}:`, error);
      return { backlinks: [], totalCount: 0 };
    }
  }

  async getCompetitorBacklinksSummary(competitorDomain: string): Promise<{
    totalBacklinks: number;
    referringDomains: number;
    dofollowLinks: number;
    domainRank: number;
  } | null> {
    try {
      const response = await this.makeRequest<{
        tasks: Array<{
          status_code: number;
          result: Array<{
            backlinks: number;
            referring_domains: number;
            dofollow: number;
            rank: number;
          }>;
        }>;
      }>("/backlinks/summary/live", "POST", [{
        target: competitorDomain,
        include_subdomains: true,
      }]);

      const result = response.tasks?.[0]?.result?.[0];
      if (!result) return null;

      return {
        totalBacklinks: result.backlinks || 0,
        referringDomains: result.referring_domains || 0,
        dofollowLinks: result.dofollow || 0,
        domainRank: result.rank || 0,
      };
    } catch (error) {
      console.error(`[DataForSEO] Error fetching competitor backlinks summary:`, error);
      return null;
    }
  }

  calculateBacklinkOpportunityScore(
    domainAuthority: number,
    isDofollow: boolean,
    spamScore: number | null
  ): number {
    let score = 0;
    
    if (domainAuthority >= 80) score += 40;
    else if (domainAuthority >= 60) score += 30;
    else if (domainAuthority >= 40) score += 20;
    else if (domainAuthority >= 20) score += 10;
    else score += 5;
    
    if (isDofollow) score += 30;
    else score += 10;
    
    if (spamScore !== null) {
      if (spamScore <= 10) score += 30;
      else if (spamScore <= 30) score += 20;
      else if (spamScore <= 60) score += 10;
      else score += 0;
    } else {
      score += 15;
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
