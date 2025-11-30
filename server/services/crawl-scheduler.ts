import { storage } from "../storage";
import { rankingsSyncService } from "./rankings-sync";
import { runCompetitorAnalysis, runDailySEOSnapshot, runKeywordMetricsUpdate } from "./jobs";
import type { CrawlSchedule } from "@shared/schema";
import * as cron from "node-cron";

interface CrawlRunResult {
  scheduleId: number;
  type: string;
  success: boolean;
  message: string;
  duration: number;
}

type CrawlType = "keyword_ranks" | "competitors" | "pages_health" | "deep_discovery";

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

    try {
      console.log(`[CrawlScheduler] Executing ${scheduleType} for project ${schedule.projectId}`);

      let result: { success: boolean; message: string };

      switch (scheduleType) {
        case "keyword_ranks":
          const rankResult = await rankingsSyncService.syncRankingsForProject(schedule.projectId);
          result = { success: rankResult.success, message: rankResult.message };
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

        default:
          result = { success: false, message: `Unknown crawl type: ${scheduleType}` };
      }

      const duration = Date.now() - startTime;
      const status = result.success ? "success" : "failed";

      await storage.updateCrawlScheduleLastRun(schedule.id, status);

      console.log(`[CrawlScheduler] ${scheduleType} completed in ${duration}ms: ${result.message}`);

      return {
        scheduleId: schedule.id,
        type: scheduleType,
        success: result.success,
        message: result.message,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await storage.updateCrawlScheduleLastRun(schedule.id, "error");

      console.error(`[CrawlScheduler] ${scheduleType} failed:`, error);

      return {
        scheduleId: schedule.id,
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
    ];

    for (const schedule of defaultSchedules) {
      await storage.createCrawlSchedule(schedule);
    }

    console.log(`[CrawlScheduler] Created ${defaultSchedules.length} default schedules for project ${projectId}`);
  }
}

export const crawlSchedulerService = new CrawlSchedulerService();
