import { storage } from "../storage";
import { rankingsSyncService } from "./rankings-sync";
import { runCompetitorAnalysis, runDailySEOSnapshot, runKeywordMetricsUpdate } from "./jobs";
import { createDataForSEOService } from "./dataforseo";
import type { CrawlSchedule, CrawlResult } from "@shared/schema";
import * as cron from "node-cron";

interface CrawlRunResult {
  scheduleId: number;
  crawlResultId?: number;
  type: string;
  success: boolean;
  message: string;
  duration: number;
  keywordsProcessed?: number;
  keywordsUpdated?: number;
}

type CrawlType = "keyword_ranks" | "competitors" | "pages_health" | "deep_discovery" | "backlinks" | "competitor_backlinks";

const DEFAULT_TIMEZONE = "America/Chicago";

const CRAWL_TYPE_DURATIONS: Record<CrawlType, number> = {
  keyword_ranks: 120,
  competitors: 180,
  pages_health: 90,
  deep_discovery: 300,
  backlinks: 240,
  competitor_backlinks: 300,
};

function normalizeCrawlType(type: string): CrawlType {
  const typeMap: Record<string, CrawlType> = {
    keywords: "keyword_ranks",
    keyword_ranks: "keyword_ranks",
    pages: "pages_health",
    pages_health: "pages_health",
    competitors: "competitors",
    backlinks: "backlinks",
    competitor_backlinks: "competitor_backlinks",
    deep_discovery: "deep_discovery",
    technical: "pages_health",
  };
  return typeMap[type] || "keyword_ranks";
}

const cronJobs: Map<string, cron.ScheduledTask> = new Map();

export class CrawlSchedulerService {
  private runningSchedules: Set<number> = new Set();
  private currentTimezone: string = DEFAULT_TIMEZONE;

  async getTimezone(): Promise<string> {
    try {
      const setting = await storage.getGlobalSetting("timezone");
      return setting?.value || DEFAULT_TIMEZONE;
    } catch (error) {
      console.error("[CrawlScheduler] Error fetching timezone, using default:", error);
      return DEFAULT_TIMEZONE;
    }
  }

  async refreshTimezone(): Promise<void> {
    this.currentTimezone = await this.getTimezone();
    console.log(`[CrawlScheduler] Timezone set to: ${this.currentTimezone}`);
  }

  getEstimatedDuration(crawlType: CrawlType): number {
    return CRAWL_TYPE_DURATIONS[crawlType] || 120;
  }

  async executeSchedule(schedule: CrawlSchedule): Promise<CrawlRunResult> {
    const startTime = Date.now();
    const scheduleType = normalizeCrawlType(schedule.type || "keyword_ranks");

    // Check if this schedule is already running (prevents duplicate runs)
    if (schedule.id > 0 && this.runningSchedules.has(schedule.id)) {
      return {
        scheduleId: schedule.id,
        type: scheduleType,
        success: false,
        message: "Schedule already running",
        duration: 0,
      };
    }

    // Also check for running crawls of the same type for this project
    const existingRunning = await storage.getRunningCrawlsByType(schedule.projectId, scheduleType);
    if (existingRunning.length > 0) {
      return {
        scheduleId: schedule.id,
        type: scheduleType,
        success: false,
        message: `A ${scheduleType} crawl is already running for this project`,
        duration: 0,
      };
    }

    if (schedule.id > 0) {
      this.runningSchedules.add(schedule.id);
    }

    // Get estimated item count based on crawl type
    let estimatedItems = 0;
    try {
      if (scheduleType === "keyword_ranks" || scheduleType === "deep_discovery") {
        const keywords = await storage.getKeywords(schedule.projectId);
        estimatedItems = keywords.length;
      } else if (scheduleType === "backlinks" || scheduleType === "pages_health") {
        const pages = await storage.getPageMetrics(schedule.projectId);
        estimatedItems = Math.min(pages.length, 50);
      } else if (scheduleType === "competitors" || scheduleType === "competitor_backlinks") {
        const competitors = await storage.getCompetitorMetrics(schedule.projectId);
        estimatedItems = Math.min(competitors.length, 10);
      }
    } catch (e) {
      estimatedItems = 10;
    }

    // Create initial crawl result record with progress tracking fields
    const crawlResult = await storage.createCrawlResult({
      projectId: schedule.projectId,
      scheduleId: schedule.id > 0 ? schedule.id : null,
      type: scheduleType,
      status: "running",
      triggerType: schedule.id > 0 ? "scheduled" : "manual",
      message: `Starting ${scheduleType} crawl...`,
      estimatedDurationSec: this.getEstimatedDuration(scheduleType),
      itemsTotal: estimatedItems,
      itemsProcessed: 0,
      currentStage: "initializing",
    });

    try {
      console.log(`[CrawlScheduler] Executing ${scheduleType} for project ${schedule.projectId}`);

      // Update stage to "processing"
      await storage.updateCrawlProgress(crawlResult.id, 0, "processing");

      let result: { success: boolean; message: string; keywordsProcessed?: number; keywordsUpdated?: number };

      switch (scheduleType) {
        case "keyword_ranks":
          await storage.updateCrawlProgress(crawlResult.id, 0, "fetching_rankings");
          const rankResult = await rankingsSyncService.syncRankingsForProject(schedule.projectId, undefined, crawlResult.id);
          result = { 
            success: rankResult.success, 
            message: rankResult.message,
            keywordsProcessed: rankResult.keywordsUpdated,
            keywordsUpdated: rankResult.keywordsUpdated,
          };
          break;

        case "competitors":
          await storage.updateCrawlProgress(crawlResult.id, 0, "analyzing_competitors");
          result = await runCompetitorAnalysis(schedule.projectId);
          break;

        case "pages_health":
          await storage.updateCrawlProgress(crawlResult.id, 0, "checking_pages");
          const pagesResult = await rankingsSyncService.syncPageMetrics(schedule.projectId, undefined, crawlResult.id);
          result = { 
            success: pagesResult.success, 
            message: pagesResult.message,
          };
          break;

        case "deep_discovery":
          await storage.updateCrawlProgress(crawlResult.id, 0, "discovering_metrics");
          const metricsResult = await runKeywordMetricsUpdate(schedule.projectId);
          result = metricsResult;
          break;

        case "backlinks":
          await storage.updateCrawlProgress(crawlResult.id, 0, "crawling_backlinks");
          result = await this.runBacklinksCrawl(schedule.projectId, crawlResult.id);
          break;

        case "competitor_backlinks":
          await storage.updateCrawlProgress(crawlResult.id, 0, "crawling_competitor_backlinks");
          result = await this.runCompetitorBacklinksCrawl(schedule.projectId, crawlResult.id);
          break;

        default:
          result = { success: false, message: `Unknown crawl type: ${scheduleType}` };
      }

      const duration = Date.now() - startTime;
      const status = result.success ? "completed" : "failed";

      // Update crawl result with final status
      await storage.updateCrawlResult(crawlResult.id, {
        status,
        message: result.message,
        duration,
        keywordsProcessed: result.keywordsProcessed || 0,
        keywordsUpdated: result.keywordsUpdated || 0,
        itemsProcessed: estimatedItems,
        currentStage: "completed",
        completedAt: new Date(),
      });

      if (schedule.id > 0) {
        await storage.updateCrawlScheduleLastRun(schedule.id, status);
      }

      console.log(`[CrawlScheduler] ${scheduleType} completed in ${duration}ms: ${result.message}`);

      return {
        scheduleId: schedule.id,
        crawlResultId: crawlResult.id,
        type: scheduleType,
        success: result.success,
        message: result.message,
        duration,
        keywordsProcessed: result.keywordsProcessed,
        keywordsUpdated: result.keywordsUpdated,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update crawl result with failed status
      await storage.updateCrawlResult(crawlResult.id, {
        status: "failed",
        message: errorMessage,
        duration,
        errorsCount: 1,
        currentStage: "failed",
        completedAt: new Date(),
      });

      if (schedule.id > 0) {
        await storage.updateCrawlScheduleLastRun(schedule.id, "failed");
      }

      console.error(`[CrawlScheduler] ${scheduleType} failed:`, error);

      return {
        scheduleId: schedule.id,
        crawlResultId: crawlResult.id,
        type: scheduleType,
        success: false,
        message: errorMessage,
        duration,
      };
    } finally {
      if (schedule.id > 0) {
        this.runningSchedules.delete(schedule.id);
      }
    }
  }

  async checkAndRunDueSchedules(): Promise<CrawlRunResult[]> {
    const results: CrawlRunResult[] = [];
    const activeSchedules = await storage.getActiveCrawlSchedules();
    
    // Get current time in configured timezone
    const timezone = this.currentTimezone;
    const now = new Date();
    const tzOptions: Intl.DateTimeFormatOptions = { 
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false 
    };
    const tzFormatter = new Intl.DateTimeFormat('en-US', tzOptions);
    const parts = tzFormatter.formatToParts(now);
    
    const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const weekdayPart = parts.find(p => p.type === 'weekday')?.value || 'Sun';
    const hourPart = parts.find(p => p.type === 'hour')?.value || '00';
    const minutePart = parts.find(p => p.type === 'minute')?.value || '00';
    
    const currentDay = dayMap[weekdayPart] ?? 0;
    const currentTime = `${hourPart}:${minutePart}`;

    for (const schedule of activeSchedules) {
      const daysOfWeek = schedule.daysOfWeek as number[];
      
      if (!daysOfWeek.includes(currentDay)) {
        continue;
      }

      if (schedule.scheduledTime !== currentTime) {
        continue;
      }

      if (schedule.lastRunAt) {
        const lastRun = new Date(schedule.lastRunAt);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastRunDate = new Date(lastRun.getFullYear(), lastRun.getMonth(), lastRun.getDate());
        
        if (lastRunDate >= today) {
          continue;
        }
      }

      const result = await this.executeSchedule(schedule);
      results.push(result);
    }

    return results;
  }

  parseScheduleTime(scheduledTime: string): { hour: number; minute: number } {
    const [hourStr, minuteStr] = scheduledTime.split(":");
    return {
      hour: parseInt(hourStr, 10),
      minute: parseInt(minuteStr, 10),
    };
  }

  getCronExpression(schedule: CrawlSchedule): string {
    const { hour, minute } = this.parseScheduleTime(schedule.scheduledTime);
    const daysOfWeek = (schedule.daysOfWeek as number[]).join(",");
    return `${minute} ${hour} * * ${daysOfWeek}`;
  }

  async startScheduler(): Promise<void> {
    // Initialize timezone from database
    await this.refreshTimezone();
    
    // Set up a job to refresh timezone every 5 minutes
    const timezoneRefresh = cron.schedule("*/5 * * * *", async () => {
      await this.refreshTimezone();
    });
    cronJobs.set("timezone-refresh", timezoneRefresh);
    
    // Note: node-cron doesn't support dynamic timezone changes, 
    // so we check schedules ourselves with current timezone
    const minuteCheck = cron.schedule(
      "* * * * *",
      async () => {
        const results = await this.checkAndRunDueSchedules();
        if (results.length > 0) {
          console.log(`[CrawlScheduler] Executed ${results.length} scheduled crawls`);
        }
      }
    );

    cronJobs.set("crawl-scheduler-check", minuteCheck);
    console.log(`[CrawlScheduler] Started crawl scheduler (timezone: ${this.currentTimezone})`);
  }

  stopScheduler(): void {
    cronJobs.forEach((job, name) => {
      job.stop();
      console.log(`[CrawlScheduler] Stopped ${name}`);
    });
    cronJobs.clear();
  }

  async runBacklinksCrawl(projectId: string, crawlResultId?: number): Promise<{ success: boolean; message: string; keywordsProcessed?: number }> {
    try {
      console.log(`[CrawlScheduler] Running backlinks crawl for project ${projectId}`);
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return { success: false, message: "Project not found" };
      }

      const dataForSEOService = createDataForSEOService();
      if (!dataForSEOService) {
        console.warn("[CrawlScheduler] DataForSEO not configured, skipping backlinks fetch");
        return { success: false, message: "DataForSEO API not configured" };
      }
      
      const pageMetrics = await storage.getPageMetrics(projectId);
      const targetUrls = pageMetrics
        .filter(pm => pm.url)
        .map(pm => pm.url)
        .slice(0, 50);
      
      if (targetUrls.length === 0) {
        const domainUrl = `https://${project.domain}`;
        targetUrls.push(domainUrl);
      }
      
      // Update total items for progress tracking
      if (crawlResultId) {
        await storage.updateCrawlResult(crawlResultId, { itemsTotal: targetUrls.length });
      }
      
      let newBacklinksCount = 0;
      let lostBacklinksCount = 0;
      let totalBacklinksIngested = 0;
      
      let urlIndex = 0;
      for (const targetUrl of targetUrls) {
        try {
          console.log(`[CrawlScheduler] Fetching backlinks for ${targetUrl}`);
          
          const { backlinks, totalCount } = await dataForSEOService.getIndividualBacklinks(targetUrl, 100);
          
          const existingBacklinks = await storage.getBacklinks(projectId, targetUrl);
          const existingSourceUrls = new Set(existingBacklinks.map(b => b.sourceUrl.toLowerCase()));
          
          for (const backlink of backlinks) {
            const sourceUrlLower = backlink.sourceUrl.toLowerCase();
            
            if (!existingSourceUrls.has(sourceUrlLower)) {
              await storage.createBacklink({
                projectId,
                targetUrl,
                sourceUrl: backlink.sourceUrl,
                sourceDomain: backlink.sourceDomain,
                anchorText: backlink.anchorText,
                linkType: backlink.linkType,
                domainAuthority: backlink.domainAuthority,
                pageAuthority: backlink.pageAuthority,
                isLive: backlink.isLive,
                firstSeenAt: backlink.firstSeen || new Date(),
                lastSeenAt: backlink.lastSeen || new Date(),
              });
              newBacklinksCount++;
            } else {
              const existing = existingBacklinks.find(
                b => b.sourceUrl.toLowerCase() === sourceUrlLower
              );
              if (existing) {
                await storage.updateBacklink(existing.id, {
                  lastSeenAt: new Date(),
                  isLive: backlink.isLive,
                  domainAuthority: backlink.domainAuthority,
                  pageAuthority: backlink.pageAuthority,
                });
              }
            }
            totalBacklinksIngested++;
          }
          
          const apiSourceUrls = new Set(backlinks.map(b => b.sourceUrl.toLowerCase()));
          for (const existing of existingBacklinks) {
            if (existing.isLive && !apiSourceUrls.has(existing.sourceUrl.toLowerCase())) {
              await storage.markBacklinkLost(existing.id);
              lostBacklinksCount++;
            }
          }
          
          // Update progress
          urlIndex++;
          if (crawlResultId) {
            await storage.updateCrawlProgress(crawlResultId, urlIndex, `Processing URL ${urlIndex}/${targetUrls.length}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (urlError) {
          console.error(`[CrawlScheduler] Error fetching backlinks for ${targetUrl}:`, urlError);
        }
      }
      
      const stats = {
        totalUrls: targetUrls.length,
        totalBacklinksIngested,
        newBacklinks: newBacklinksCount,
        lostBacklinks: lostBacklinksCount,
      };
      
      console.log(`[CrawlScheduler] Backlinks crawl completed:`, stats);
      
      return {
        success: true,
        message: `Backlinks crawl completed. Processed ${targetUrls.length} pages. Ingested: ${totalBacklinksIngested}, New: ${newBacklinksCount}, Lost: ${lostBacklinksCount}.`,
        keywordsProcessed: totalBacklinksIngested,
      };
    } catch (error) {
      console.error("[CrawlScheduler] Backlinks crawl error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async runCompetitorBacklinksCrawl(projectId: string, crawlResultId?: number): Promise<{ success: boolean; message: string; keywordsProcessed?: number }> {
    try {
      console.log(`[CrawlScheduler] Running competitor backlinks crawl for project ${projectId}`);
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return { success: false, message: "Project not found" };
      }

      const dataForSEOService = createDataForSEOService();
      if (!dataForSEOService) {
        console.warn("[CrawlScheduler] DataForSEO not configured, skipping competitor backlinks fetch");
        return { success: false, message: "DataForSEO API not configured" };
      }
      
      const competitorMetrics = await storage.getCompetitorMetrics(projectId);
      const competitorDomains = competitorMetrics
        .filter(cm => cm.competitorDomain)
        .map(cm => cm.competitorDomain)
        .slice(0, 5);
      
      if (competitorDomains.length === 0) {
        return { success: true, message: "No competitors found to analyze backlinks" };
      }
      
      // Update total items for progress tracking
      if (crawlResultId) {
        await storage.updateCrawlResult(crawlResultId, { itemsTotal: competitorDomains.length });
      }
      
      let totalBacklinksIngested = 0;
      let totalOpportunities = 0;
      
      let competitorIndex = 0;
      for (const competitorDomain of competitorDomains) {
        try {
          console.log(`[CrawlScheduler] Fetching backlinks for competitor: ${competitorDomain}`);
          
          const { backlinks, totalCount } = await dataForSEOService.getCompetitorBacklinks(competitorDomain, 100);
          
          for (const backlink of backlinks) {
            await storage.upsertCompetitorBacklink(
              projectId,
              competitorDomain,
              backlink.sourceUrl,
              backlink.targetUrl,
              {
                sourceDomain: backlink.sourceDomain,
                anchorText: backlink.anchorText,
                linkType: backlink.linkType,
                domainAuthority: backlink.domainAuthority,
                pageAuthority: backlink.pageAuthority,
              }
            );
            totalBacklinksIngested++;
          }
          
          const uniqueDomains = Array.from(new Set(backlinks.map(b => b.sourceDomain.toLowerCase())));
          if (uniqueDomains.length > 0) {
            const spamScoreMap = await dataForSEOService.getBulkSpamScores(uniqueDomains);
            
            const existingBacklinks = await storage.getCompetitorBacklinks(projectId, competitorDomain);
            for (const existing of existingBacklinks) {
              const spamScore = spamScoreMap.get(existing.sourceDomain.toLowerCase());
              if (spamScore !== undefined) {
                await storage.upsertCompetitorBacklink(
                  projectId,
                  competitorDomain,
                  existing.sourceUrl,
                  existing.targetUrl,
                  { spamScore }
                );
              }
            }
          }
          
          const oppsUpdated = await storage.updateCompetitorBacklinkOpportunities(projectId, competitorDomain);
          totalOpportunities += oppsUpdated;
          
          // Update progress
          competitorIndex++;
          if (crawlResultId) {
            await storage.updateCrawlProgress(crawlResultId, competitorIndex, `Analyzing competitor ${competitorIndex}/${competitorDomains.length}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (domainError) {
          console.error(`[CrawlScheduler] Error fetching competitor backlinks for ${competitorDomain}:`, domainError);
        }
      }
      
      const stats = {
        competitorsAnalyzed: competitorDomains.length,
        totalBacklinksIngested,
        totalOpportunities,
      };
      
      console.log(`[CrawlScheduler] Competitor backlinks crawl completed:`, stats);
      
      return {
        success: true,
        message: `Competitor backlinks crawl completed. Analyzed ${competitorDomains.length} competitors. Ingested: ${totalBacklinksIngested}, Opportunities: ${totalOpportunities}.`,
        keywordsProcessed: totalBacklinksIngested,
      };
    } catch (error) {
      console.error("[CrawlScheduler] Competitor backlinks crawl error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async createDefaultSchedulesForProject(projectId: string, domain: string): Promise<void> {
    const existingSchedules = await storage.getCrawlSchedules(projectId);
    
    if (existingSchedules.length > 0) {
      console.log(`[CrawlScheduler] Project ${projectId} already has schedules, skipping defaults`);
      return;
    }

    const defaultSchedules = [
      {
        projectId,
        type: "keyword_ranks",
        url: `https://${domain}/keywords/rankings`,
        frequency: "twice_weekly",
        scheduledTime: "09:00",
        daysOfWeek: [1, 3, 5],
        isActive: true,
        config: { batchSize: 100 },
      },
      {
        projectId,
        type: "pages_health",
        url: `https://${domain}/pages/metrics`,
        frequency: "twice_weekly",
        scheduledTime: "10:00",
        daysOfWeek: [0, 2, 4, 6],
        isActive: true,
        config: { includeBacklinks: true },
      },
      {
        projectId,
        type: "competitors",
        url: `https://${domain}/competitors/analysis`,
        frequency: "weekly",
        scheduledTime: "14:00",
        daysOfWeek: [3, 5],
        isActive: true,
        config: { topN: 10 },
      },
      {
        projectId,
        type: "backlinks",
        url: `https://${domain}/backlinks/update`,
        frequency: "weekly",
        scheduledTime: "11:00",
        daysOfWeek: [0],
        isActive: true,
        config: { checkLiveStatus: true },
      },
      {
        projectId,
        type: "competitor_backlinks",
        url: `https://${domain}/competitor-backlinks/crawl`,
        frequency: "biweekly",
        scheduledTime: "12:00",
        daysOfWeek: [1, 4],
        isActive: true,
        config: { limit: 100 },
      },
    ];

    for (const schedule of defaultSchedules) {
      await storage.createCrawlSchedule(schedule);
    }

    console.log(`[CrawlScheduler] Created ${defaultSchedules.length} default schedules for project ${projectId}`);
  }
}

export const crawlSchedulerService = new CrawlSchedulerService();
