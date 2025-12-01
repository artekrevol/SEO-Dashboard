import { storage } from "../storage";
import { DataForSEOService, createDataForSEOService } from "./dataforseo";
import {
  calculateRankScore,
  calculateAuthorityScore,
  calculateTechnicalScore,
  calculateContentScore,
  calculateOverallHealthScore,
  calculateOpportunityScore,
  calculateCompetitorPressure,
} from "./scoring";
import {
  generateRecommendationsFromKeywords,
  generateRecommendationsFromPages,
  prioritizeRecommendations,
} from "./recommendations";
import { rankingsSyncService } from "./rankings-sync";
import { impactTracker } from "./impact-tracker";
import { narrativeGenerator } from "./narrative-generator";

let crawlSchedulerServiceInstance: any = null;
async function getCrawlSchedulerService() {
  if (!crawlSchedulerServiceInstance) {
    const module = await import("./crawl-scheduler");
    crawlSchedulerServiceInstance = module.crawlSchedulerService;
  }
  return crawlSchedulerServiceInstance;
}
import type { Project, InsertSeoHealthSnapshot, InsertKeywordMetrics, InsertCompetitorMetrics, Keyword } from "@shared/schema";
import * as cron from "node-cron";

interface JobResult {
  success: boolean;
  message: string;
  data?: unknown;
}

class JobScheduler {
  private jobs: Map<string, NodeJS.Timeout> = new Map();

  schedule(name: string, intervalMs: number, job: () => Promise<void>): void {
    if (this.jobs.has(name)) {
      clearInterval(this.jobs.get(name)!);
    }

    const interval = setInterval(async () => {
      console.log(`[Job] Running ${name}...`);
      try {
        await job();
        console.log(`[Job] ${name} completed successfully`);
      } catch (error) {
        console.error(`[Job] ${name} failed:`, error);
      }
    }, intervalMs);

    this.jobs.set(name, interval);
    console.log(`[Job] Scheduled ${name} to run every ${intervalMs / 1000 / 60} minutes`);
  }

  stop(name: string): void {
    if (this.jobs.has(name)) {
      clearInterval(this.jobs.get(name)!);
      this.jobs.delete(name);
      console.log(`[Job] Stopped ${name}`);
    }
  }

  stopAll(): void {
    this.jobs.forEach((interval, name) => {
      clearInterval(interval);
      console.log(`[Job] Stopped ${name}`);
    });
    this.jobs.clear();
  }
}

export const jobScheduler = new JobScheduler();

async function calculateAndSaveSnapshot(
  project: Project,
  dataForSEO: DataForSEOService | null
): Promise<InsertSeoHealthSnapshot> {
  const keywords = await storage.getKeywords(project.id);
  const keywordIds = keywords.map(k => k.id);
  
  let allKeywordMetrics: Awaited<ReturnType<typeof storage.getKeywordMetrics>>[number][] = [];
  for (const keywordId of keywordIds) {
    const metrics = await storage.getKeywordMetrics(keywordId);
    if (metrics.length > 0) {
      allKeywordMetrics.push(metrics[0]);
    }
  }
  
  const pages = await storage.getPageMetrics(project.id);

  const rankMetrics = {
    avgPosition: allKeywordMetrics.length > 0 
      ? allKeywordMetrics.reduce((sum, k) => sum + (k.position || 100), 0) / allKeywordMetrics.length 
      : 50,
    top3Keywords: allKeywordMetrics.filter(k => (k.position || 100) <= 3).length,
    top10Keywords: allKeywordMetrics.filter(k => (k.position || 100) <= 10).length,
    totalKeywords: allKeywordMetrics.length,
  };

  let authorityMetrics = {
    totalBacklinks: pages.reduce((sum, p) => sum + (p.backlinksCount || 0), 0),
    referringDomains: pages.reduce((sum, p) => sum + (p.referringDomains || 0), 0),
    domainAuthority: 30,
  };

  if (dataForSEO) {
    try {
      const backlinkData = await dataForSEO.getBacklinkData(project.domain);
      authorityMetrics = {
        totalBacklinks: backlinkData.totalBacklinks,
        referringDomains: backlinkData.referringDomains,
        domainAuthority: backlinkData.domainAuthority,
      };
    } catch (error) {
      console.warn(`[Job] Failed to fetch backlink data for ${project.domain}:`, error);
    }
  }

  const technicalMetrics = {
    indexablePages: pages.filter(p => p.isIndexable).length,
    totalPages: pages.length,
    hasSchema: pages.some(p => p.hasSchema),
    hasSitemap: true,
    issueCount: pages.filter(p => !p.isIndexable || p.duplicateContent).length,
  };

  const contentMetrics = {
    avgContentLength: 1000,
    pagesWithThinContent: 0,
    pagesWithDuplicateContent: pages.filter(p => p.duplicateContent).length,
    totalPages: pages.length,
  };

  const rankScore = calculateRankScore(rankMetrics);
  const authorityScore = calculateAuthorityScore(authorityMetrics);
  const techScore = calculateTechnicalScore(technicalMetrics);
  const contentScore = calculateContentScore(contentMetrics);
  const seoHealthScore = calculateOverallHealthScore(rankScore, authorityScore, techScore, contentScore);

  const today = new Date().toISOString().split("T")[0];

  const snapshot: InsertSeoHealthSnapshot = {
    projectId: project.id,
    date: today,
    avgPosition: rankMetrics.avgPosition.toFixed(2),
    top3Keywords: rankMetrics.top3Keywords,
    top10Keywords: rankMetrics.top10Keywords,
    totalKeywords: rankMetrics.totalKeywords,
    authorityScore: authorityScore.toFixed(2),
    techScore: techScore.toFixed(2),
    contentScore: contentScore.toFixed(2),
    seoHealthScore: seoHealthScore.toFixed(2),
  };

  return snapshot;
}

export async function runDailySEOSnapshot(projectId?: string): Promise<JobResult> {
  const dataForSEO = createDataForSEOService();

  try {
    let projects: Project[];
    if (projectId) {
      const project = await storage.getProject(projectId);
      if (!project) {
        return { success: false, message: `Project ${projectId} not found` };
      }
      projects = [project];
    } else {
      projects = await storage.getProjects();
    }

    const results: string[] = [];

    for (const project of projects) {
      try {
        const snapshot = await calculateAndSaveSnapshot(project, dataForSEO);
        await storage.createSeoHealthSnapshot(snapshot);
        results.push(`${project.name}: Health score ${snapshot.seoHealthScore}`);
      } catch (error) {
        console.error(`[Job] Failed to process project ${project.name}:`, error);
        results.push(`${project.name}: Failed - ${error}`);
      }
    }

    return {
      success: true,
      message: `Processed ${projects.length} projects`,
      data: results,
    };
  } catch (error) {
    return {
      success: false,
      message: `Job failed: ${error}`,
    };
  }
}

export async function runKeywordMetricsUpdate(projectId: string): Promise<JobResult> {
  const dataForSEO = createDataForSEOService();
  
  if (!dataForSEO) {
    return {
      success: false,
      message: "DataForSEO not configured. Set DATAFORSEO_API_LOGIN and DATAFORSEO_API_PASSWORD secrets.",
    };
  }

  try {
    const project = await storage.getProject(projectId);
    if (!project) {
      return { success: false, message: `Project ${projectId} not found` };
    }

    const trackedKeywords = await storage.getKeywords(projectId);
    if (trackedKeywords.length === 0) {
      return { success: false, message: "No keywords to track" };
    }

    const keywordTexts = trackedKeywords.map(k => k.keyword);
    
    const [rankings, keywordData, difficulties, intents] = await Promise.all([
      dataForSEO.getSerpRankings(keywordTexts, project.domain),
      dataForSEO.getKeywordData(keywordTexts),
      dataForSEO.getKeywordDifficulty(keywordTexts),
      dataForSEO.getKeywordIntent(keywordTexts),
    ]);

    const today = new Date().toISOString().split("T")[0];
    const metricsToSave: InsertKeywordMetrics[] = [];

    for (const tracked of trackedKeywords) {
      const ranking = rankings.get(tracked.keyword);
      const data = keywordData.get(tracked.keyword);
      const difficulty = difficulties.get(tracked.keyword) || 50;
      const intent = intents.get(tracked.keyword) || "informational";

      const position = ranking?.rank_absolute || 100;
      
      const existingMetrics = await storage.getKeywordMetrics(tracked.id);
      const previousPosition = existingMetrics.length > 0 ? (existingMetrics[0].position || position) : position;
      const positionDelta = previousPosition - position;

      const searchVolume = data?.searchVolume || 0;
      const opportunityScore = calculateOpportunityScore(position, searchVolume, difficulty, intent);

      metricsToSave.push({
        keywordId: tracked.id,
        date: today,
        position,
        previousPosition,
        positionDelta,
        searchVolume,
        difficulty: difficulty.toFixed(2),
        intent,
        serpFeatures: [],
        opportunityScore: opportunityScore.toFixed(2),
      });
    }

    for (const metric of metricsToSave) {
      await storage.createKeywordMetrics(metric);
    }

    return {
      success: true,
      message: `Updated ${metricsToSave.length} keyword metrics`,
      data: metricsToSave,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update keyword metrics: ${error}`,
    };
  }
}

export async function runCompetitorAnalysis(projectId: string): Promise<JobResult> {
  const dataForSEO = createDataForSEOService();
  
  if (!dataForSEO) {
    return {
      success: false,
      message: "DataForSEO not configured",
    };
  }

  try {
    const project = await storage.getProject(projectId);
    if (!project) {
      return { success: false, message: `Project ${projectId} not found` };
    }

    const competitors = await dataForSEO.getCompetitors(project.domain);
    const ourBacklinks = await dataForSEO.getBacklinkData(project.domain);

    const today = new Date().toISOString().split("T")[0];
    const metricsToSave: InsertCompetitorMetrics[] = [];

    for (const competitor of competitors) {
      let competitorBacklinks = { totalBacklinks: 0, referringDomains: 0, domainAuthority: 50 };
      try {
        competitorBacklinks = await dataForSEO.getBacklinkData(competitor.domain);
      } catch {
        console.warn(`[Job] Failed to fetch backlinks for ${competitor.domain}`);
      }

      const pressureIndex = calculateCompetitorPressure(
        competitor.keywordsCount,
        competitorBacklinks.domainAuthority,
        ourBacklinks.domainAuthority,
        competitor.avgPosition,
        10
      );

      metricsToSave.push({
        projectId,
        competitorDomain: competitor.domain,
        date: today,
        sharedKeywords: competitor.keywordsCount,
        avgPosition: competitor.avgPosition.toFixed(2),
        authorityScore: competitorBacklinks.domainAuthority.toFixed(2),
        pressureIndex: pressureIndex.toFixed(2),
      });
    }

    for (const metric of metricsToSave) {
      await storage.createCompetitorMetrics(metric);
    }

    return {
      success: true,
      message: `Analyzed ${metricsToSave.length} competitors`,
      data: metricsToSave,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to analyze competitors: ${error}`,
    };
  }
}

export async function runRecommendationGeneration(projectId: string): Promise<JobResult> {
  try {
    const keywords = await storage.getKeywords(projectId);
    const keywordIds = keywords.map(k => k.id);
    
    const keywordsMap = new Map<number, Keyword>();
    for (const k of keywords) {
      keywordsMap.set(k.id, k);
    }
    
    let allKeywordMetrics: Awaited<ReturnType<typeof storage.getKeywordMetrics>>[number][] = [];
    for (const keywordId of keywordIds) {
      const metrics = await storage.getKeywordMetrics(keywordId);
      if (metrics.length > 0) {
        allKeywordMetrics.push(metrics[0]);
      }
    }
    
    const pages = await storage.getPageMetrics(projectId);

    const keywordRecs = generateRecommendationsFromKeywords(projectId, allKeywordMetrics, keywordsMap);
    const pageRecs = generateRecommendationsFromPages(projectId, pages);

    const allRecs = prioritizeRecommendations([...keywordRecs, ...pageRecs]);

    const existingRecs = await storage.getSeoRecommendations(projectId);
    const existingTypes = new Set(existingRecs.map(r => `${r.type}-${r.title}`));

    const newRecs = allRecs.filter(r => !existingTypes.has(`${r.type}-${r.title}`));

    for (const rec of newRecs.slice(0, 10)) {
      await storage.createSeoRecommendation(rec);
    }

    return {
      success: true,
      message: `Generated ${newRecs.length} new recommendations`,
      data: newRecs,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to generate recommendations: ${error}`,
    };
  }
}

export async function runRankingsSync(projectId?: string): Promise<JobResult> {
  try {
    if (!rankingsSyncService.constructor) {
      return { success: false, message: "Rankings sync service not available" };
    }

    if (projectId) {
      const result = await rankingsSyncService.syncRankingsForProject(projectId);
      return {
        success: result.success,
        message: result.message,
        data: { keywordsUpdated: result.keywordsUpdated, competitorsFound: result.competitorsFound },
      };
    }

    const results = await rankingsSyncService.syncDailyRankings();
    const totalKeywords = results.reduce((sum, r) => sum + r.keywordsUpdated, 0);
    const totalCompetitors = results.reduce((sum, r) => sum + r.competitorsFound, 0);

    return {
      success: results.every(r => r.success),
      message: `Synced ${totalKeywords} keywords across ${results.length} projects with ${totalCompetitors} competitor entries`,
      data: results,
    };
  } catch (error) {
    return { success: false, message: `Rankings sync failed: ${error}` };
  }
}

export async function runRankingsSyncWithLimit(projectId: string, limit?: number): Promise<JobResult> {
  try {
    if (!rankingsSyncService.constructor) {
      return { success: false, message: "Rankings sync service not available" };
    }

    const result = await rankingsSyncService.syncRankingsForProject(projectId, limit);
    return {
      success: result.success,
      message: result.message,
      data: { 
        keywordsUpdated: result.keywordsUpdated, 
        competitorsFound: result.competitorsFound,
        progress: result.progress,
      },
    };
  } catch (error) {
    return { success: false, message: `Rankings sync failed: ${error}` };
  }
}

export async function runImpactTracking(projectId: string): Promise<JobResult> {
  try {
    const results = await impactTracker.trackImplementedRecommendations(projectId);
    return {
      success: true,
      message: `Tracked impact for ${results.length} implemented recommendations`,
      data: results,
    };
  } catch (error) {
    return { success: false, message: `Impact tracking failed: ${error}` };
  }
}

export async function runNarrativeGeneration(projectId: string, periodDays: number = 7): Promise<JobResult> {
  try {
    const narrative = await narrativeGenerator.generateNarrative(projectId, periodDays);
    return {
      success: true,
      message: `Generated executive narrative with alert level: ${narrative.alertLevel}`,
      data: narrative,
    };
  } catch (error) {
    return { success: false, message: `Narrative generation failed: ${error}` };
  }
}

const cronJobs: Map<string, cron.ScheduledTask> = new Map();

export function startScheduledJobs(): void {
  const dailySnapshotJob = cron.schedule(
    "0 17 * * *",
    async () => {
      console.log("[Job] Running daily-seo-snapshot (5 PM CST)...");
      try {
        const result = await runDailySEOSnapshot();
        console.log(`[Job] daily-seo-snapshot completed: ${result.message}`);
      } catch (error) {
        console.error("[Job] daily-seo-snapshot failed:", error);
      }
    },
    {
      timezone: "America/Chicago",
    }
  );
  cronJobs.set("daily-seo-snapshot", dailySnapshotJob);
  console.log("[Jobs] Scheduled daily-seo-snapshot to run at 5 PM CST");

  const weekendHeavyJob = cron.schedule(
    "0 3 * * 0",
    async () => {
      console.log("[Job] Running weekend-heavy-jobs (Sunday 3 AM CST)...");
      try {
        const projects = await storage.getProjects();
        for (const project of projects) {
          if (project.isActive) {
            console.log(`[Job] Processing heavy jobs for ${project.name}...`);
            await runKeywordMetricsUpdate(project.id);
            await runCompetitorAnalysis(project.id);
            await runRecommendationGeneration(project.id);
          }
        }
        console.log("[Job] weekend-heavy-jobs completed");
      } catch (error) {
        console.error("[Job] weekend-heavy-jobs failed:", error);
      }
    },
    {
      timezone: "America/Chicago",
    }
  );
  cronJobs.set("weekend-heavy-jobs", weekendHeavyJob);
  console.log("[Jobs] Scheduled weekend-heavy-jobs to run Sunday 3 AM CST");

  const rankingsSyncJob = cron.schedule(
    "0 6 * * *",
    async () => {
      console.log("[Job] Running daily-rankings-sync (6 AM CST)...");
      try {
        const result = await runRankingsSync();
        console.log(`[Job] daily-rankings-sync completed: ${result.message}`);
      } catch (error) {
        console.error("[Job] daily-rankings-sync failed:", error);
      }
    },
    {
      timezone: "America/Chicago",
    }
  );
  cronJobs.set("daily-rankings-sync", rankingsSyncJob);
  console.log("[Jobs] Scheduled daily-rankings-sync to run at 6 AM CST");

  const crawlScheduleRunner = cron.schedule(
    "*/15 * * * *",
    async () => {
      console.log("[Job] Running crawl-schedule-check (every 15 min)...");
      try {
        const crawlService = await getCrawlSchedulerService();
        const results = await crawlService.checkAndRunDueSchedules();
        if (results.length > 0) {
          console.log(`[Job] Executed ${results.length} scheduled crawls`);
        }
      } catch (error) {
        console.error("[Job] crawl-schedule-check failed:", error);
      }
    },
    {
      timezone: "America/Chicago",
    }
  );
  cronJobs.set("crawl-schedule-check", crawlScheduleRunner);
  console.log("[Jobs] Scheduled crawl-schedule-check to run every 15 minutes");

  const impactTrackingJob = cron.schedule(
    "0 18 * * *",
    async () => {
      console.log("[Job] Running daily-impact-tracking (6 PM CST)...");
      try {
        const projects = await storage.getProjects();
        for (const project of projects) {
          if (project.isActive) {
            await runImpactTracking(project.id);
          }
        }
        console.log("[Job] daily-impact-tracking completed");
      } catch (error) {
        console.error("[Job] daily-impact-tracking failed:", error);
      }
    },
    {
      timezone: "America/Chicago",
    }
  );
  cronJobs.set("daily-impact-tracking", impactTrackingJob);
  console.log("[Jobs] Scheduled daily-impact-tracking to run at 6 PM CST");

  console.log("[Jobs] Scheduled jobs started");
}

export function stopScheduledJobs(): void {
  cronJobs.forEach((job, name) => {
    job.stop();
    console.log(`[Job] Stopped ${name}`);
  });
  cronJobs.clear();
  jobScheduler.stopAll();
  console.log("[Jobs] All scheduled jobs stopped");
}
