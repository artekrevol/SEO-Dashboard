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

type CrawlType = "keyword_ranks" | "competitors" | "pages_health" | "deep_discovery" | "backlinks";

const cronJobs: Map<string, cron.ScheduledTask> = new Map();

export class CrawlSchedulerService {
  private runningSchedules: Set<number> = new Set();

  async executeSchedule(schedule: CrawlSchedule): Promise<CrawlRunResult> {
    const startTime = Date.now();
    const scheduleType = (schedule.type || "keyword_ranks") as CrawlType;

    if (this.runningSchedules.has(schedule.id)) {
      return {
        scheduleId: schedule.id,
        type: scheduleType,
        success: false,
        message: "Schedule already running",
        duration: 0,
      };
    }

    this.runningSchedules.add(schedule.id);

    // Create initial crawl result record
    const crawlResult = await storage.createCrawlResult({
      projectId: schedule.projectId,
      scheduleId: schedule.id,
      type: scheduleType,
      status: "running",
      message: `Starting ${scheduleType} crawl...`,
    });

    try {
      console.log(`[CrawlScheduler] Executing ${scheduleType} for project ${schedule.projectId}`);

      let result: { success: boolean; message: string; keywordsProcessed?: number; keywordsUpdated?: number };

      switch (scheduleType) {
        case "keyword_ranks":
          const rankResult = await rankingsSyncService.syncRankingsForProject(schedule.projectId);
          result = { 
            success: rankResult.success, 
            message: rankResult.message,
            keywordsProcessed: rankResult.keywordsUpdated,
            keywordsUpdated: rankResult.keywordsUpdated,
          };
          break;

        case "competitors":
          result = await runCompetitorAnalysis(schedule.projectId);
          break;

        case "pages_health":
          result = await runDailySEOSnapshot(schedule.projectId);
          break;

        case "deep_discovery":
          const metricsResult = await runKeywordMetricsUpdate(schedule.projectId);
          result = metricsResult;
          break;

        case "backlinks":
          result = await this.runBacklinksCrawl(schedule.projectId);
          break;

        default:
          result = { success: false, message: `Unknown crawl type: ${scheduleType}` };
      }

      const duration = Date.now() - startTime;
      const status = result.success ? "success" : "failed";

      // Update crawl result with final status
      await storage.updateCrawlResult(crawlResult.id, {
        status,
        message: result.message,
        duration,
        keywordsProcessed: result.keywordsProcessed || 0,
        keywordsUpdated: result.keywordsUpdated || 0,
        completedAt: new Date(),
      });

      await storage.updateCrawlScheduleLastRun(schedule.id, status);

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
        completedAt: new Date(),
      });

      await storage.updateCrawlScheduleLastRun(schedule.id, "failed");

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
      this.runningSchedules.delete(schedule.id);
    }
  }

  async checkAndRunDueSchedules(): Promise<CrawlRunResult[]> {
    const results: CrawlRunResult[] = [];
    const activeSchedules = await storage.getActiveCrawlSchedules();
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);

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
    const minuteCheck = cron.schedule(
      "* * * * *",
      async () => {
        const results = await this.checkAndRunDueSchedules();
        if (results.length > 0) {
          console.log(`[CrawlScheduler] Executed ${results.length} scheduled crawls`);
        }
      },
      {
        timezone: "America/Chicago",
      }
    );

    cronJobs.set("crawl-scheduler-check", minuteCheck);
    console.log("[CrawlScheduler] Started crawl scheduler (checking every minute in CST)");
  }

  stopScheduler(): void {
    cronJobs.forEach((job, name) => {
      job.stop();
      console.log(`[CrawlScheduler] Stopped ${name}`);
    });
    cronJobs.clear();
  }

  async runBacklinksCrawl(projectId: string): Promise<{ success: boolean; message: string; keywordsProcessed?: number }> {
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
      
      let newBacklinksCount = 0;
      let lostBacklinksCount = 0;
      let totalBacklinksIngested = 0;
      
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
    ];

    for (const schedule of defaultSchedules) {
      await storage.createCrawlSchedule(schedule);
    }

    console.log(`[CrawlScheduler] Created ${defaultSchedules.length} default schedules for project ${projectId}`);
  }
}

export const crawlSchedulerService = new CrawlSchedulerService();
