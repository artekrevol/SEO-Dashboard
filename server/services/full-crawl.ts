import { storage } from "../storage";
import { createDataForSEOService } from "./dataforseo";
import {
  calculateOpportunityScore,
  calculateRankScore,
  calculateAuthorityScore,
  calculateTechnicalScore,
  calculateContentScore,
  calculateOverallHealthScore,
} from "./scoring";
import type { Keyword, InsertKeywordMetrics, InsertRankingsHistory, InsertKeywordCompetitorMetrics, InsertSeoHealthSnapshot, InsertPageMetrics, InsertCompetitorMetrics } from "@shared/schema";

interface CrawlProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

interface CrawlResult {
  success: boolean;
  keywordsProcessed: number;
  competitorsFound: number;
  pagesAnalyzed: number;
  errors: string[];
}

export async function runFullCrawl(projectId: string, onProgress?: (progress: CrawlProgress) => void): Promise<CrawlResult> {
  const dataForSEO = createDataForSEOService();
  if (!dataForSEO) {
    return {
      success: false,
      keywordsProcessed: 0,
      competitorsFound: 0,
      pagesAnalyzed: 0,
      errors: ["DataForSEO not configured - missing API credentials"],
    };
  }

  const project = await storage.getProject(projectId);
  if (!project) {
    return {
      success: false,
      keywordsProcessed: 0,
      competitorsFound: 0,
      pagesAnalyzed: 0,
      errors: ["Project not found"],
    };
  }

  const errors: string[] = [];
  let keywordsProcessed = 0;
  let competitorsFound = 0;
  let pagesAnalyzed = 0;

  const keywords = await storage.getKeywords(projectId);
  const domain = project.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  console.log(`[FullCrawl] Starting crawl for ${project.name} (${domain}) with ${keywords.length} keywords`);

  const BATCH_SIZE = 10;
  const totalBatches = Math.ceil(keywords.length / BATCH_SIZE);
  // Use America/Chicago timezone for date consistency (handles DST)
  const today = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  
  const keywordPositions = new Map<number, number>();

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, keywords.length);
    const batchKeywords = keywords.slice(batchStart, batchEnd);
    const keywordTexts = batchKeywords.map((k: Keyword) => k.keyword);

    onProgress?.({
      phase: "SERP Rankings",
      current: batchIndex + 1,
      total: totalBatches,
      message: `Processing batch ${batchIndex + 1}/${totalBatches} (${keywordTexts.slice(0, 3).join(", ")}...)`,
    });

    console.log(`[FullCrawl] Processing batch ${batchIndex + 1}/${totalBatches}: ${keywordTexts.length} keywords`);

    try {
      // Use Standard method for cost savings (3.3x cheaper) - resumable via checkpoint system
      const { rankings, competitors, serpFeatures } = await dataForSEO.getSerpRankingsStandardMethod(
        keywordTexts,
        domain
      );

      const [keywordDifficulty, keywordIntent, keywordData] = await Promise.all([
        dataForSEO.getKeywordDifficulty(keywordTexts).catch(() => new Map<string, number>()),
        dataForSEO.getKeywordIntent(keywordTexts).catch(() => new Map<string, string>()),
        dataForSEO.getKeywordData(keywordTexts).catch(() => new Map<string, any>()),
      ]);

      for (const keyword of batchKeywords) {
        const ranking = rankings.get(keyword.keyword);
        const kwCompetitors = competitors.get(keyword.keyword) || [];
        const features = serpFeatures.get(keyword.keyword) || [];
        const difficulty = keywordDifficulty.get(keyword.keyword) || Number(keyword.difficulty) || 50;
        const intent = keywordIntent.get(keyword.keyword) || keyword.intentHint || "informational";
        const kwData = keywordData.get(keyword.keyword);
        const searchVolume = kwData?.searchVolume || keyword.searchVolume || 0;
        
        const position = ranking?.rank_group || 0;
        keywordPositions.set(keyword.id, position);
        
        const opportunityScore = dataForSEO.calculateOpportunityScore(position, searchVolume, difficulty, intent);

        try {
          const metricsData: InsertKeywordMetrics = {
            keywordId: keyword.id,
            date: today,
            position: position > 0 ? position : null,
            searchVolume: searchVolume,
            difficulty: String(difficulty),
            intent: intent,
            opportunityScore: String(opportunityScore),
            serpFeatures: features,
          };
          await storage.createKeywordMetrics(metricsData);

          if (position > 0) {
            const historyData: InsertRankingsHistory = {
              projectId: projectId,
              keywordId: keyword.id,
              date: today,
              position: position,
              url: ranking?.url || keyword.targetUrl || '',
              serpFeatures: features,
            };
            await storage.createRankingsHistory(historyData);
          }

          for (const comp of kwCompetitors) {
            const competitorData: InsertKeywordCompetitorMetrics = {
              projectId: projectId,
              keywordId: keyword.id,
              competitorDomain: comp.domain,
              competitorUrl: comp.url,
              latestPosition: comp.position,
              serpFeatures: features,
            };
            await storage.upsertKeywordCompetitorMetrics(competitorData);
            competitorsFound++;
          }

          keywordsProcessed++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push(`Keyword "${keyword.keyword}": ${errorMsg}`);
          console.error(`[FullCrawl] Error processing keyword "${keyword.keyword}":`, errorMsg);
        }
      }

      if (batchIndex < totalBatches - 1) {
        console.log(`[FullCrawl] Waiting 2 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Batch ${batchIndex + 1}: ${errorMsg}`);
      console.error(`[FullCrawl] Error processing batch ${batchIndex + 1}:`, errorMsg);
    }
  }

  onProgress?.({
    phase: "Domain Competitors",
    current: 1,
    total: 1,
    message: "Fetching domain-level competitors...",
  });

  try {
    const domainCompetitors = await dataForSEO.getCompetitors(domain);
    for (const comp of domainCompetitors) {
      const competitorMetrics: InsertCompetitorMetrics = {
        projectId: projectId,
        competitorDomain: comp.domain,
        date: today,
        avgPosition: String(comp.avgPosition),
        sharedKeywords: comp.keywordsCount,
      };
      await storage.createCompetitorMetrics(competitorMetrics);
    }
    console.log(`[FullCrawl] Saved ${domainCompetitors.length} domain competitors`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Domain competitors: ${errorMsg}`);
    console.error(`[FullCrawl] Error fetching domain competitors:`, errorMsg);
  }

  onProgress?.({
    phase: "On-Page Analysis",
    current: 1,
    total: 1,
    message: `Crawling ${domain} for on-page analysis...`,
  });

  let onPageIssues: string[] = [];
  try {
    const onPageData = await dataForSEO.getOnPageSummary(domain);
    console.log(`[FullCrawl] On-page analysis completed: ${onPageData.crawledPages} pages crawled`);
    onPageIssues = onPageData.issues.map(i => i.type);
    
    const pageMetrics: InsertPageMetrics = {
      projectId: projectId,
      url: `https://${domain}/`,
      date: today,
      wordCount: 0,
      isIndexable: true,
      hasSchema: false,
    };
    await storage.createPageMetrics(pageMetrics);
    pagesAnalyzed = onPageData.crawledPages;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`On-page analysis: ${errorMsg}`);
    console.error(`[FullCrawl] Error during on-page analysis:`, errorMsg);
  }

  onProgress?.({
    phase: "Backlink Analysis",
    current: 1,
    total: 1,
    message: "Fetching backlink data...",
  });

  let backlinkData = { totalBacklinks: 0, referringDomains: 0, domainAuthority: 0 };
  try {
    backlinkData = await dataForSEO.getBacklinkData(domain);
    console.log(`[FullCrawl] Backlink data: ${backlinkData.referringDomains} referring domains`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Backlink analysis: ${errorMsg}`);
    console.error(`[FullCrawl] Error fetching backlink data:`, errorMsg);
  }

  onProgress?.({
    phase: "Health Calculation",
    current: 1,
    total: 1,
    message: "Calculating SEO health scores...",
  });

  try {
    const rankedKeywords = Array.from(keywordPositions.entries()).filter(([_, pos]) => pos > 0);
    const avgPosition = rankedKeywords.length > 0
      ? rankedKeywords.reduce((sum, [_, pos]) => sum + pos, 0) / rankedKeywords.length
      : 100;
    
    const top3Keywords = rankedKeywords.filter(([_, pos]) => pos <= 3).length;
    const top10Keywords = rankedKeywords.filter(([_, pos]) => pos <= 10).length;
    
    const rankScore = calculateRankScore({
      avgPosition,
      top3Keywords,
      top10Keywords,
      totalKeywords: keywords.length,
    });
    
    const authorityScore = calculateAuthorityScore({
      totalBacklinks: backlinkData.totalBacklinks,
      referringDomains: backlinkData.referringDomains,
      domainAuthority: backlinkData.domainAuthority,
    });
    
    const techScore = calculateTechnicalScore({
      indexablePages: pagesAnalyzed,
      totalPages: Math.max(pagesAnalyzed, 1),
      hasSchema: false,
      hasSitemap: true,
      issueCount: onPageIssues.length,
    });
    
    const contentScore = calculateContentScore({
      avgContentLength: 1000,
      pagesWithThinContent: 0,
      pagesWithDuplicateContent: 0,
      totalPages: Math.max(pagesAnalyzed, 1),
    });
    
    const overallScore = calculateOverallHealthScore(rankScore, authorityScore, techScore, contentScore);

    const snapshot: InsertSeoHealthSnapshot = {
      projectId: projectId,
      date: today,
      seoHealthScore: String(overallScore),
      avgPosition: String(avgPosition),
      top3Keywords: top3Keywords,
      top10Keywords: top10Keywords,
      totalKeywords: keywords.length,
      authorityScore: String(authorityScore),
      techScore: String(techScore),
      contentScore: String(contentScore),
    };
    await storage.createSeoHealthSnapshot(snapshot);
    
    console.log(`[FullCrawl] Health snapshot created: score=${overallScore.toFixed(1)}, avgPos=${avgPosition.toFixed(1)}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Health calculation: ${errorMsg}`);
    console.error(`[FullCrawl] Error calculating health scores:`, errorMsg);
  }

  console.log(`[FullCrawl] Completed! Keywords: ${keywordsProcessed}, Competitors: ${competitorsFound}, Pages: ${pagesAnalyzed}, Errors: ${errors.length}`);

  return {
    success: errors.length === 0,
    keywordsProcessed,
    competitorsFound,
    pagesAnalyzed,
    errors,
  };
}

export async function runKeywordCrawl(projectId: string, keywordIds?: number[]): Promise<CrawlResult> {
  const dataForSEO = createDataForSEOService();
  if (!dataForSEO) {
    return {
      success: false,
      keywordsProcessed: 0,
      competitorsFound: 0,
      pagesAnalyzed: 0,
      errors: ["DataForSEO not configured"],
    };
  }

  const project = await storage.getProject(projectId);
  if (!project) {
    return {
      success: false,
      keywordsProcessed: 0,
      competitorsFound: 0,
      pagesAnalyzed: 0,
      errors: ["Project not found"],
    };
  }

  let keywords = await storage.getKeywords(projectId);
  if (keywordIds && keywordIds.length > 0) {
    keywords = keywords.filter((k: Keyword) => keywordIds.includes(k.id));
  }

  const domain = project.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const errors: string[] = [];
  let keywordsProcessed = 0;
  let competitorsFound = 0;
  // Use America/Chicago timezone for date consistency (handles DST)
  const today = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const BATCH_SIZE = 10;
  const totalBatches = Math.ceil(keywords.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, keywords.length);
    const batchKeywords = keywords.slice(batchStart, batchEnd);
    const keywordTexts = batchKeywords.map((k: Keyword) => k.keyword);

    try {
      // Use Standard method for cost savings (3.3x cheaper) - resumable via checkpoint system
      const { rankings, competitors, serpFeatures } = await dataForSEO.getSerpRankingsStandardMethod(
        keywordTexts,
        domain
      );

      for (const keyword of batchKeywords) {
        const ranking = rankings.get(keyword.keyword);
        const kwCompetitors = competitors.get(keyword.keyword) || [];
        const features = serpFeatures.get(keyword.keyword) || [];
        
        const position = ranking?.rank_group || 0;

        if (position > 0) {
          const historyData: InsertRankingsHistory = {
            projectId: projectId,
            keywordId: keyword.id,
            date: today,
            position: position,
            url: ranking?.url || keyword.targetUrl || '',
            serpFeatures: features,
          };
          await storage.createRankingsHistory(historyData);
        }

        for (const comp of kwCompetitors) {
          const competitorData: InsertKeywordCompetitorMetrics = {
            projectId: projectId,
            keywordId: keyword.id,
            competitorDomain: comp.domain,
            competitorUrl: comp.url,
            latestPosition: comp.position,
            serpFeatures: features,
          };
          await storage.upsertKeywordCompetitorMetrics(competitorData);
          competitorsFound++;
        }

        keywordsProcessed++;
      }

      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Batch ${batchIndex + 1}: ${errorMsg}`);
    }
  }

  return {
    success: errors.length === 0,
    keywordsProcessed,
    competitorsFound,
    pagesAnalyzed: 0,
    errors,
  };
}

export const fullCrawlService = {
  runFullCrawl,
  runKeywordCrawl,
};
