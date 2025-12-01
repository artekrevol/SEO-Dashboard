import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertProjectSchema, insertKeywordSchema, insertSeoRecommendationSchema, crawlSchedules } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { DataForSEOService } from "./services/dataforseo";
import { 
  runDailySEOSnapshot, 
  runKeywordMetricsUpdate, 
  runCompetitorAnalysis, 
  runRecommendationGeneration,
  runRankingsSync,
  runRankingsSyncWithLimit,
  runImpactTracking,
  runNarrativeGeneration,
  runPageMetricsSync,
  runOnPageCrawl,
  runOnPageSync,
  startScheduledJobs 
} from "./services/jobs";
import {
  importLocations,
  importKeywords,
  importRankingsFromXlsx,
  importProjectsFromXlsx,
  runFullImport,
  bulkUpdateKeywords,
  initializeDefaultPriorityRules
} from "./services/ingestion";

function getDefaultQuickWinsSettings(projectId: string) {
  return {
    projectId,
    enabled: true,
    minPosition: 6,
    maxPosition: 20,
    minVolume: 100,
    minOpportunityScore: "0.5",
    validIntents: ["commercial", "transactional"],
    minIntentScore: "0.6",
    minCpc: "0.50",
  };
}

function getDefaultFallingStarsSettings(projectId: string) {
  return {
    projectId,
    enabled: true,
    minPositionDrop: 5,
    lookbackDays: 7,
    previousMaxPosition: 10,
    highlightCorePages: true,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json({ projects });
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const parsed = insertProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error("Project validation failed:", parsed.error.errors);
        return res.status(400).json({ error: "Invalid project data", details: parsed.error.errors });
      }
      
      let project;
      try {
        project = await storage.createProject(parsed.data);
      } catch (dbError: any) {
        console.error("Database error creating project:", dbError);
        if (dbError.code === '23505') {
          return res.status(409).json({ error: "A project with this name or domain already exists" });
        }
        return res.status(500).json({ error: dbError.message || "Database error while creating project" });
      }
      
      try {
        await seedDemoData(project.id, project.domain);
      } catch (seedError) {
        console.error("Warning: Failed to seed demo data for project:", seedError);
      }
      
      res.status(201).json(project);
    } catch (error: any) {
      console.error("Error creating project:", error);
      const message = error.message || "Failed to create project";
      res.status(500).json({ error: message });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  app.get("/api/dashboard/overview", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const latestSnapshot = await storage.getLatestSeoHealthSnapshot(projectId);
      const snapshots = await storage.getSeoHealthSnapshots(projectId, 30);

      const trend = snapshots
        .map((s) => ({
          date: s.date,
          seoHealthScore: Number(s.seoHealthScore) || 0,
          authorityScore: Number(s.authorityScore) || 0,
          techScore: Number(s.techScore) || 0,
          contentScore: Number(s.contentScore) || 0,
        }))
        .reverse();

      const getStatus = (score: number): "healthy" | "at_risk" | "declining" => {
        if (score >= 70) return "healthy";
        if (score >= 40) return "at_risk";
        return "declining";
      };

      res.json({
        projectId,
        latestSnapshot: latestSnapshot
          ? {
              date: latestSnapshot.date,
              seoHealthScore: Number(latestSnapshot.seoHealthScore) || 0,
              avgPosition: Number(latestSnapshot.avgPosition) || 0,
              top3Keywords: latestSnapshot.top3Keywords || 0,
              top10Keywords: latestSnapshot.top10Keywords || 0,
              totalKeywords: latestSnapshot.totalKeywords || 0,
              authorityScore: Number(latestSnapshot.authorityScore) || 0,
              techScore: Number(latestSnapshot.techScore) || 0,
              contentScore: Number(latestSnapshot.contentScore) || 0,
              status: getStatus(Number(latestSnapshot.seoHealthScore) || 0),
            }
          : null,
        trend,
      });
    } catch (error) {
      console.error("Error fetching dashboard overview:", error);
      res.status(500).json({ error: "Failed to fetch dashboard overview" });
    }
  });

  app.get("/api/dashboard/keywords", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const items = await storage.getLatestKeywordMetrics(projectId);

      res.json({ items });
    } catch (error) {
      console.error("Error fetching keyword metrics:", error);
      res.status(500).json({ error: "Failed to fetch keyword metrics" });
    }
  });

  app.get("/api/dashboard/pages", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const pages = await storage.getPageMetricsWithKeywordAnalytics(projectId);

      const items = pages.map((p: any) => ({
        id: p.id,
        url: p.url,
        date: p.date,
        avgPosition: Number(p.avgPosition) || 0,
        bestPosition: p.bestPosition || 0,
        keywordsInTop10: p.keywordsInTop10 || 0,
        keywordsInTop3: p.keywordsInTop3 || 0,
        totalKeywords: p.totalKeywords || 0,
        rankedKeywords: p.rankedKeywords || 0,
        backlinksCount: p.backlinksCount || 0,
        referringDomains: p.referringDomains || 0,
        newLinks7d: p.newLinks7d || 0,
        lostLinks7d: p.lostLinks7d || 0,
        hasSchema: p.hasSchema || false,
        isIndexable: p.isIndexable !== false,
        duplicateContent: p.duplicateContent || false,
        coreWebVitalsOk: p.coreWebVitalsOk !== false,
        contentGapScore: Number(p.contentGapScore) || 0,
        techRiskScore: Number(p.techRiskScore) || 0,
        authorityGapScore: Number(p.authorityGapScore) || 0,
      }));

      res.json({ items });
    } catch (error) {
      console.error("Error fetching page metrics:", error);
      res.status(500).json({ error: "Failed to fetch page metrics" });
    }
  });

  app.post("/api/pages", async (req, res) => {
    try {
      const pageSchema = z.object({
        projectId: z.string(),
        url: z.string().url(),
      });
      
      const parsed = pageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid page data", details: parsed.error.errors });
      }
      
      const page = await storage.createPageMetrics({
        projectId: parsed.data.projectId,
        url: parsed.data.url,
        date: new Date().toISOString().split('T')[0],
        isIndexable: true,
        hasSchema: false,
      });
      
      res.status(201).json(page);
    } catch (error) {
      console.error("Error creating page:", error);
      res.status(500).json({ error: "Failed to create page" });
    }
  });

  app.delete("/api/pages/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid page ID" });
      }
      
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      
      const page = await storage.getPageMetricsById(id);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      
      if (page.projectId !== projectId) {
        return res.status(403).json({ error: "Page does not belong to this project" });
      }
      
      await storage.deletePageMetrics(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting page:", error);
      res.status(500).json({ error: "Failed to delete page" });
    }
  });

  app.post("/api/pages/bulk", async (req, res) => {
    try {
      const bulkSchema = z.object({
        projectId: z.string(),
        urls: z.array(z.string().url()),
      });
      
      const parsed = bulkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid bulk page data", details: parsed.error.errors });
      }
      
      const today = new Date().toISOString().split('T')[0];
      const pages = [];
      
      for (const url of parsed.data.urls) {
        const page = await storage.createPageMetrics({
          projectId: parsed.data.projectId,
          url,
          date: today,
          isIndexable: true,
          hasSchema: false,
        });
        pages.push(page);
      }
      
      res.status(201).json({ pages, count: pages.length });
    } catch (error) {
      console.error("Error bulk creating pages:", error);
      res.status(500).json({ error: "Failed to bulk create pages" });
    }
  });

  app.delete("/api/pages/bulk", async (req, res) => {
    try {
      const bulkDeleteSchema = z.object({
        projectId: z.string(),
        pageIds: z.array(z.number()),
      });
      
      const parsed = bulkDeleteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid bulk delete data", details: parsed.error.errors });
      }
      
      const { projectId, pageIds } = parsed.data;
      let deletedCount = 0;
      
      for (const id of pageIds) {
        const page = await storage.getPageMetricsById(id);
        if (page && page.projectId === projectId) {
          await storage.deletePageMetrics(id);
          deletedCount++;
        }
      }
      
      res.json({ deletedCount });
    } catch (error) {
      console.error("Error bulk deleting pages:", error);
      res.status(500).json({ error: "Failed to bulk delete pages" });
    }
  });

  app.get("/api/dashboard/recommendations", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;
      const severity = req.query.severity as string | undefined;

      const recommendations = await storage.getSeoRecommendations(projectId, {
        status,
        type,
        severity,
      });

      const items = recommendations.map((r) => ({
        id: r.id,
        url: r.url || "",
        keywordId: r.keywordId,
        type: r.type,
        severity: r.severity,
        title: r.title,
        description: r.description || "",
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      }));

      res.json({ items });
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });

  app.patch("/api/dashboard/recommendations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid recommendation ID" });
      }

      const statusSchema = z.object({
        status: z.enum(["open", "in_progress", "done", "dismissed"]),
      });

      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid status", details: parsed.error.errors });
      }

      const updated = await storage.updateSeoRecommendationStatus(id, parsed.data.status);
      if (!updated) {
        return res.status(404).json({ error: "Recommendation not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating recommendation:", error);
      res.status(500).json({ error: "Failed to update recommendation" });
    }
  });

  app.get("/api/dashboard/competitors", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const competitors = await storage.getCompetitorMetrics(projectId);

      const items = competitors.map((c) => ({
        competitorDomain: c.competitorDomain,
        sharedKeywords: c.sharedKeywords || 0,
        aboveUsKeywords: c.aboveUsKeywords || 0,
        authorityScore: Number(c.authorityScore) || 0,
        avgPosition: Number(c.avgPosition) || 0,
        pressureIndex: Number(c.pressureIndex) || 0,
      }));

      res.json({ items });
    } catch (error) {
      console.error("Error fetching competitor metrics:", error);
      res.status(500).json({ error: "Failed to fetch competitor metrics" });
    }
  });

  app.post("/api/keywords", async (req, res) => {
    try {
      const parsed = insertKeywordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid keyword data", details: parsed.error.errors });
      }
      const keyword = await storage.createKeyword(parsed.data);
      res.status(201).json(keyword);
    } catch (error) {
      console.error("Error creating keyword:", error);
      res.status(500).json({ error: "Failed to create keyword" });
    }
  });

  app.delete("/api/keywords/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid keyword ID" });
      }
      await storage.deleteKeyword(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting keyword:", error);
      res.status(500).json({ error: "Failed to delete keyword" });
    }
  });

  app.get("/api/system/status", async (req, res) => {
    res.json({
      dataForSEOConfigured: DataForSEOService.isConfigured(),
      scheduledJobsActive: true,
    });
  });

  app.post("/api/jobs/snapshot", async (req, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const result = await runDailySEOSnapshot(projectId);
      res.json(result);
    } catch (error) {
      console.error("Error running snapshot job:", error);
      res.status(500).json({ error: "Failed to run snapshot job" });
    }
  });

  app.post("/api/jobs/keywords", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const result = await runKeywordMetricsUpdate(projectId);
      res.json(result);
    } catch (error) {
      console.error("Error running keyword update job:", error);
      res.status(500).json({ error: "Failed to run keyword update job" });
    }
  });

  app.post("/api/jobs/competitors", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const result = await runCompetitorAnalysis(projectId);
      res.json(result);
    } catch (error) {
      console.error("Error running competitor analysis job:", error);
      res.status(500).json({ error: "Failed to run competitor analysis job" });
    }
  });

  app.post("/api/jobs/recommendations", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const result = await runRecommendationGeneration(projectId);
      res.json(result);
    } catch (error) {
      console.error("Error running recommendation generation job:", error);
      res.status(500).json({ error: "Failed to run recommendation generation job" });
    }
  });

  app.post("/api/jobs/rankings-sync", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const result = await runRankingsSync(projectId);
      res.json(result);
    } catch (error) {
      console.error("Error running rankings sync job:", error);
      res.status(500).json({ error: "Failed to run rankings sync job" });
    }
  });

  app.post("/api/jobs/impact-tracking", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const result = await runImpactTracking(projectId);
      res.json(result);
    } catch (error) {
      console.error("Error running impact tracking job:", error);
      res.status(500).json({ error: "Failed to run impact tracking job" });
    }
  });

  app.post("/api/jobs/page-metrics", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const result = await runPageMetricsSync(projectId);
      res.json(result);
    } catch (error) {
      console.error("Error running page metrics sync:", error);
      res.status(500).json({ error: "Failed to run page metrics sync" });
    }
  });

  app.post("/api/jobs/on-page-crawl", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const result = await runOnPageCrawl(projectId);
      res.json(result);
    } catch (error) {
      console.error("Error starting on-page crawl:", error);
      res.status(500).json({ error: "Failed to start on-page crawl" });
    }
  });

  app.post("/api/jobs/on-page-sync", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const taskId = req.query.taskId as string;
      if (!projectId || !taskId) {
        return res.status(400).json({ error: "projectId and taskId are required" });
      }
      const result = await runOnPageSync(projectId, taskId);
      res.json(result);
    } catch (error) {
      console.error("Error syncing on-page data:", error);
      res.status(500).json({ error: "Failed to sync on-page data" });
    }
  });

  app.get("/api/projects/:projectId/narrative", async (req, res) => {
    try {
      const { projectId } = req.params;
      const periodDays = parseInt(req.query.days as string) || 7;
      const result = await runNarrativeGeneration(projectId, periodDays);
      res.json(result);
    } catch (error) {
      console.error("Error generating narrative:", error);
      res.status(500).json({ error: "Failed to generate executive narrative" });
    }
  });

  app.get("/api/keywords/:keywordId/competitors", async (req, res) => {
    try {
      const keywordId = parseInt(req.params.keywordId);
      if (isNaN(keywordId)) {
        return res.status(400).json({ error: "Invalid keywordId" });
      }
      const competitors = await storage.getKeywordCompetitorMetrics(keywordId);
      res.json({ competitors });
    } catch (error) {
      console.error("Error fetching keyword competitors:", error);
      res.status(500).json({ error: "Failed to fetch keyword competitors" });
    }
  });

  app.get("/api/projects/:projectId/keyword-competitors", async (req, res) => {
    try {
      const { projectId } = req.params;
      const keywordId = req.query.keywordId ? parseInt(req.query.keywordId as string) : undefined;
      
      if (keywordId) {
        const competitors = await storage.getKeywordCompetitorMetrics(keywordId);
        res.json({ competitors });
      } else {
        const keywords = await storage.getKeywords(projectId);
        const allCompetitors = [];
        for (const keyword of keywords.slice(0, 50)) {
          const competitors = await storage.getKeywordCompetitorMetrics(keyword.id);
          allCompetitors.push({
            keywordId: keyword.id,
            keyword: keyword.keyword,
            competitors,
          });
        }
        res.json({ keywordCompetitors: allCompetitors });
      }
    } catch (error) {
      console.error("Error fetching keyword competitors:", error);
      res.status(500).json({ error: "Failed to fetch keyword competitors" });
    }
  });

  app.get("/api/projects/:projectId/settings/quick-wins", async (req, res) => {
    try {
      const { projectId } = req.params;
      const settings = await storage.getSettingsQuickWins(projectId);
      res.json({ settings: settings || getDefaultQuickWinsSettings(projectId) });
    } catch (error) {
      console.error("Error fetching quick wins settings:", error);
      res.status(500).json({ error: "Failed to fetch quick wins settings" });
    }
  });

  app.put("/api/projects/:projectId/settings/quick-wins", async (req, res) => {
    try {
      const { projectId } = req.params;
      const settings = await storage.upsertSettingsQuickWins(projectId, req.body);
      res.json({ settings });
    } catch (error) {
      console.error("Error updating quick wins settings:", error);
      res.status(500).json({ error: "Failed to update quick wins settings" });
    }
  });

  app.get("/api/projects/:projectId/settings/falling-stars", async (req, res) => {
    try {
      const { projectId } = req.params;
      const settings = await storage.getSettingsFallingStars(projectId);
      res.json({ settings: settings || getDefaultFallingStarsSettings(projectId) });
    } catch (error) {
      console.error("Error fetching falling stars settings:", error);
      res.status(500).json({ error: "Failed to fetch falling stars settings" });
    }
  });

  app.put("/api/projects/:projectId/settings/falling-stars", async (req, res) => {
    try {
      const { projectId } = req.params;
      const settings = await storage.upsertSettingsFallingStars(projectId, req.body);
      res.json({ settings });
    } catch (error) {
      console.error("Error updating falling stars settings:", error);
      res.status(500).json({ error: "Failed to update falling stars settings" });
    }
  });

  app.get("/api/projects/:projectId/import-logs", async (req, res) => {
    try {
      const { projectId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const logs = await storage.getImportLogs(projectId, limit);
      res.json({ logs });
    } catch (error) {
      console.error("Error fetching import logs:", error);
      res.status(500).json({ error: "Failed to fetch import logs" });
    }
  });

  app.get("/api/data/locations", async (req, res) => {
    try {
      const allLocations = await storage.getLocations();
      res.json({ locations: allLocations });
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  app.get("/api/data/priority-rules", async (req, res) => {
    try {
      const rules = await storage.getPriorityRules();
      res.json({ rules });
    } catch (error) {
      console.error("Error fetching priority rules:", error);
      res.status(500).json({ error: "Failed to fetch priority rules" });
    }
  });

  app.post("/api/data/priority-rules/init", async (req, res) => {
    try {
      await initializeDefaultPriorityRules();
      const rules = await storage.getPriorityRules();
      res.json({ success: true, rules });
    } catch (error) {
      console.error("Error initializing priority rules:", error);
      res.status(500).json({ error: "Failed to initialize priority rules" });
    }
  });

  app.post("/api/data/import/locations", async (req, res) => {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: "filePath is required" });
      }
      const result = await importLocations(filePath);
      res.json(result);
    } catch (error) {
      console.error("Error importing locations:", error);
      res.status(500).json({ error: "Failed to import locations" });
    }
  });

  app.post("/api/data/import/keywords", async (req, res) => {
    try {
      const { filePath, projectId } = req.body;
      if (!filePath || !projectId) {
        return res.status(400).json({ error: "filePath and projectId are required" });
      }
      const result = await importKeywords(filePath, projectId);
      res.json(result);
    } catch (error) {
      console.error("Error importing keywords:", error);
      res.status(500).json({ error: "Failed to import keywords" });
    }
  });

  app.post("/api/data/import/rankings", async (req, res) => {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: "filePath is required" });
      }
      const result = await importRankingsFromXlsx(filePath);
      res.json(result);
    } catch (error) {
      console.error("Error importing rankings:", error);
      res.status(500).json({ error: "Failed to import rankings" });
    }
  });

  app.post("/api/data/import/projects", async (req, res) => {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: "filePath is required" });
      }
      const result = await importProjectsFromXlsx(filePath);
      res.json(result);
    } catch (error) {
      console.error("Error importing projects:", error);
      res.status(500).json({ error: "Failed to import projects" });
    }
  });

  app.post("/api/data/import/full", async (req, res) => {
    try {
      const { locationsPath, keywordsPath, projectId, rankingsPath } = req.body;
      if (!locationsPath || !keywordsPath || !projectId) {
        return res.status(400).json({ error: "locationsPath, keywordsPath, and projectId are required" });
      }
      const result = await runFullImport(locationsPath, keywordsPath, projectId, rankingsPath);
      res.json(result);
    } catch (error) {
      console.error("Error running full import:", error);
      res.status(500).json({ error: "Failed to run full import" });
    }
  });

  app.patch("/api/data/keywords/bulk", async (req, res) => {
    try {
      const { keywordIds, updates } = req.body;
      if (!keywordIds || !Array.isArray(keywordIds) || keywordIds.length === 0) {
        return res.status(400).json({ error: "keywordIds array is required" });
      }
      const count = await bulkUpdateKeywords(keywordIds, updates);
      res.json({ success: true, updatedCount: count });
    } catch (error) {
      console.error("Error bulk updating keywords:", error);
      res.status(500).json({ error: "Failed to bulk update keywords" });
    }
  });

  app.get("/api/crawl-schedules", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const schedules = await storage.getCrawlSchedules(projectId);
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching crawl schedules:", error);
      res.status(500).json({ error: "Failed to fetch crawl schedules" });
    }
  });

  app.post("/api/crawl-schedules", async (req, res) => {
    try {
      const { projectId, url, scheduledTime, daysOfWeek, isActive, type, frequency, config } = req.body;
      if (!projectId || !scheduledTime || !daysOfWeek) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const schedule = await storage.createCrawlSchedule({
        projectId,
        url: url || null,
        type: type || "keywords",
        frequency: frequency || "scheduled",
        scheduledTime,
        daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : Array.from(daysOfWeek),
        isActive: isActive !== false,
        config: config || null,
      });
      res.status(201).json(schedule);
    } catch (error) {
      console.error("Error creating crawl schedule:", error);
      res.status(500).json({ error: "Failed to create crawl schedule" });
    }
  });

  app.patch("/api/crawl-schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { url, scheduledTime, daysOfWeek, isActive, type, frequency, config } = req.body;
      const updateData: any = {};
      if (url !== undefined) updateData.url = url;
      if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime;
      if (daysOfWeek !== undefined) updateData.daysOfWeek = Array.isArray(daysOfWeek) ? daysOfWeek : Array.from(daysOfWeek);
      if (isActive !== undefined) updateData.isActive = isActive;
      if (type !== undefined) updateData.type = type;
      if (frequency !== undefined) updateData.frequency = frequency;
      if (config !== undefined) updateData.config = config;
      
      const schedule = await storage.updateCrawlSchedule(id, updateData);
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error("Error updating crawl schedule:", error);
      res.status(500).json({ error: "Failed to update crawl schedule" });
    }
  });

  app.delete("/api/crawl-schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCrawlSchedule(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting crawl schedule:", error);
      res.status(500).json({ error: "Failed to delete crawl schedule" });
    }
  });

  // Run a specific crawl schedule immediately
  // Requires projectId in query params to verify ownership
  app.post("/api/crawl-schedules/:id/run", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const projectId = req.query.projectId as string;
      
      if (!projectId) {
        return res.status(400).json({ error: "projectId query parameter is required" });
      }

      const schedule = await storage.getCrawlSchedule(id);
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      // Validate project ownership
      if (schedule.projectId !== projectId) {
        return res.status(403).json({ error: "Access denied: schedule belongs to a different project" });
      }

      // Execute the crawl based on type
      let result: any = { success: true, message: "Crawl queued" };
      const validTypes = ["keywords", "pages", "competitors", "backlinks", "technical"];
      
      if (!validTypes.includes(schedule.type)) {
        return res.status(400).json({ error: "Invalid crawl type" });
      }

      switch (schedule.type) {
        case "keywords":
          result = await runRankingsSync(projectId);
          break;
        case "pages":
          result = await runKeywordMetricsUpdate(projectId);
          break;
        case "competitors":
          result = await runCompetitorAnalysis(projectId);
          break;
        case "backlinks":
        case "technical":
          result = await runKeywordMetricsUpdate(projectId);
          break;
        default:
          result = await runKeywordMetricsUpdate(projectId);
      }

      // Update last run timestamp using raw SQL since lastRunAt is not in InsertCrawlSchedule
      await db.update(crawlSchedules)
        .set({ lastRunAt: new Date(), lastRunStatus: "success" })
        .where(eq(crawlSchedules.id, id));

      res.json({ success: true, result });
    } catch (error) {
      console.error("Error running crawl schedule:", error);
      res.status(500).json({ error: "Failed to run crawl schedule" });
    }
  });

  // Zod schema for manual crawl trigger validation
  const manualCrawlTriggerSchema = z.object({
    projectId: z.string().uuid(),
    type: z.enum(["keywords", "pages", "competitors"]),
    scope: z.enum(["all", "selected"]).default("all"),
    keywordIds: z.array(z.number().int().positive()).optional(),
    limit: z.number().int().positive().optional(),
  }).refine(
    (data) => {
      // If scope is "selected", keywordIds must be non-empty
      if (data.scope === "selected") {
        return data.keywordIds && data.keywordIds.length > 0;
      }
      return true;
    },
    { message: "keywordIds must be non-empty when scope is 'selected'" }
  );

  // Manual crawl trigger for ad-hoc data collection
  app.post("/api/crawl/trigger", async (req, res) => {
    try {
      const parseResult = manualCrawlTriggerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.errors 
        });
      }

      const { projectId, type, scope, keywordIds, limit } = parseResult.data;

      // Verify project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      let result: any = { success: true, message: "Crawl queued" };

      switch (type) {
        case "keywords":
          result = await runRankingsSyncWithLimit(projectId, limit);
          if (scope === "selected" && keywordIds && keywordIds.length > 0) {
            result.note = `Crawl requested for ${keywordIds.length} specific keywords`;
          }
          break;
        case "pages":
          result = await runKeywordMetricsUpdate(projectId);
          break;
        case "competitors":
          result = await runCompetitorAnalysis(projectId);
          break;
      }

      res.json({ success: true, type, scope, result });
    } catch (error) {
      console.error("Error triggering manual crawl:", error);
      res.status(500).json({ error: "Failed to trigger crawl" });
    }
  });

  // Full crawl endpoint - comprehensive SEO data refresh
  app.post("/api/crawl/full", async (req, res) => {
    try {
      const { projectId } = req.body;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const { runFullCrawl } = await import("./services/full-crawl");
      
      console.log(`[API] Starting full crawl for project: ${project.name}`);
      
      const result = await runFullCrawl(projectId, (progress) => {
        console.log(`[FullCrawl] ${progress.phase}: ${progress.message}`);
      });

      res.json({
        success: result.success,
        keywordsProcessed: result.keywordsProcessed,
        competitorsFound: result.competitorsFound,
        pagesAnalyzed: result.pagesAnalyzed,
        errors: result.errors.slice(0, 10),
        totalErrors: result.errors.length,
      });
    } catch (error) {
      console.error("Error running full crawl:", error);
      res.status(500).json({ error: "Failed to run full crawl" });
    }
  });

  // Crawl Results History API
  app.get("/api/crawl-results", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const results = await storage.getCrawlResults(projectId, limit);
      
      // Format results with CST timezone info
      const formattedResults = results.map(r => ({
        ...r,
        startedAtCST: r.startedAt ? new Date(r.startedAt).toLocaleString("en-US", { timeZone: "America/Chicago" }) : null,
        completedAtCST: r.completedAt ? new Date(r.completedAt).toLocaleString("en-US", { timeZone: "America/Chicago" }) : null,
        durationFormatted: r.duration ? `${Math.round(r.duration / 1000)}s` : null,
      }));
      
      res.json({ results: formattedResults });
    } catch (error) {
      console.error("Error fetching crawl results:", error);
      res.status(500).json({ error: "Failed to fetch crawl results" });
    }
  });

  app.get("/api/crawl-results/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid crawl result ID" });
      }
      const result = await storage.getCrawlResult(id);
      if (!result) {
        return res.status(404).json({ error: "Crawl result not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching crawl result:", error);
      res.status(500).json({ error: "Failed to fetch crawl result" });
    }
  });

  app.get("/api/crawl-results/running", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const runningCrawls = await storage.getRunningCrawls(projectId);
      res.json({ running: runningCrawls });
    } catch (error) {
      console.error("Error fetching running crawls:", error);
      res.status(500).json({ error: "Failed to fetch running crawls" });
    }
  });

  // Quick Wins API - high-opportunity keywords close to top positions
  app.get("/api/quick-wins", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const filters = {
        location: req.query.location as string | undefined,
        cluster: req.query.cluster as string | undefined,
        intent: req.query.intent as string | undefined,
      };
      const quickWins = await storage.getQuickWins(projectId, filters);
      res.json(quickWins);
    } catch (error) {
      console.error("Error fetching quick wins:", error);
      res.status(500).json({ error: "Failed to fetch quick wins" });
    }
  });

  // Falling Stars API - keywords with dropping rankings
  app.get("/api/falling-stars", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const filters = {
        location: req.query.location as string | undefined,
      };
      const fallingStars = await storage.getFallingStars(projectId, filters);
      res.json(fallingStars);
    } catch (error) {
      console.error("Error fetching falling stars:", error);
      res.status(500).json({ error: "Failed to fetch falling stars" });
    }
  });

  // Rankings History API
  app.get("/api/rankings-history/:keywordId", async (req, res) => {
    try {
      const keywordId = parseInt(req.params.keywordId);
      const limit = parseInt(req.query.limit as string) || 100;
      const history = await storage.getRankingsHistory(keywordId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching rankings history:", error);
      res.status(500).json({ error: "Failed to fetch rankings history" });
    }
  });

  startScheduledJobs();

  return httpServer;
}

async function seedDemoData(projectId: string, domain: string) {
  const today = new Date();
  
  const demoKeywords = [
    { keyword: "seo tools", cluster: "tools", targetUrl: `https://${domain}/tools` },
    { keyword: "keyword research", cluster: "research", targetUrl: `https://${domain}/research` },
    { keyword: "backlink analysis", cluster: "links", targetUrl: `https://${domain}/backlinks` },
    { keyword: "rank tracking software", cluster: "tools", targetUrl: `https://${domain}/tracking` },
    { keyword: "competitor analysis", cluster: "competitive", targetUrl: `https://${domain}/competitors` },
    { keyword: "site audit tool", cluster: "tools", targetUrl: `https://${domain}/audit` },
    { keyword: "seo dashboard", cluster: "tools", targetUrl: `https://${domain}/dashboard` },
    { keyword: "organic traffic analysis", cluster: "analytics", targetUrl: `https://${domain}/analytics` },
    { keyword: "content optimization", cluster: "content", targetUrl: `https://${domain}/content` },
    { keyword: "technical seo checker", cluster: "technical", targetUrl: `https://${domain}/technical` },
  ];

  for (const kw of demoKeywords) {
    const keyword = await storage.createKeyword({
      projectId,
      keyword: kw.keyword,
      cluster: kw.cluster,
      targetUrl: kw.targetUrl,
    });

    const position = Math.floor(Math.random() * 50) + 1;
    const prevPosition = position + Math.floor(Math.random() * 10) - 5;
    const searchVolume = Math.floor(Math.random() * 10000) + 500;
    const difficulty = Math.floor(Math.random() * 80) + 10;
    const intents = ["informational", "commercial", "transactional", "navigational"];
    const serpFeatures = ["featured_snippet", "local_pack", "knowledge_panel", "video", "images", "people_also_ask"];
    const selectedFeatures = serpFeatures.filter(() => Math.random() > 0.6);
    
    const opportunityScore = Math.min(100, Math.max(0,
      (searchVolume / 100) * (1 / (position + 1)) * (1 - difficulty / 100) * 100
    ));

    await storage.createKeywordMetrics({
      keywordId: keyword.id,
      date: today.toISOString().split("T")[0],
      position,
      previousPosition: prevPosition,
      positionDelta: prevPosition - position,
      searchVolume,
      difficulty: String(difficulty),
      intent: intents[Math.floor(Math.random() * intents.length)],
      serpFeatures: selectedFeatures,
      opportunityScore: String(opportunityScore.toFixed(2)),
    });
  }

  const demoPages = [
    `https://${domain}/`,
    `https://${domain}/tools`,
    `https://${domain}/pricing`,
    `https://${domain}/features`,
    `https://${domain}/blog`,
    `https://${domain}/about`,
  ];

  for (const url of demoPages) {
    await storage.createPageMetrics({
      projectId,
      url,
      date: today.toISOString().split("T")[0],
      avgPosition: String(Math.random() * 30 + 5),
      bestPosition: Math.floor(Math.random() * 10) + 1,
      keywordsInTop10: Math.floor(Math.random() * 15),
      totalKeywords: Math.floor(Math.random() * 30) + 5,
      backlinksCount: Math.floor(Math.random() * 500) + 50,
      referringDomains: Math.floor(Math.random() * 100) + 10,
      newLinks7d: Math.floor(Math.random() * 20),
      lostLinks7d: Math.floor(Math.random() * 10),
      wordCount: Math.floor(Math.random() * 2000) + 500,
      hasSchema: Math.random() > 0.4,
      isIndexable: Math.random() > 0.1,
      duplicateContent: Math.random() > 0.8,
      coreWebVitalsOk: Math.random() > 0.3,
      contentGapScore: String(Math.random() * 60 + 10),
      techRiskScore: String(Math.random() * 50),
      authorityGapScore: String(Math.random() * 40 + 10),
    });
  }

  const recommendations = [
    { type: "content_refresh", severity: "high", title: "Update outdated content on /blog", description: "The blog page has content that is over 12 months old and is losing rankings." },
    { type: "add_schema", severity: "medium", title: "Add FAQ schema to /pricing", description: "Adding FAQ schema could help capture featured snippets for pricing-related queries." },
    { type: "build_links", severity: "high", title: "Build backlinks to /features", description: "The features page has low domain authority compared to competitors." },
    { type: "fix_indexability", severity: "high", title: "Fix noindex on /tools", description: "The tools page has a noindex tag preventing it from being indexed." },
    { type: "optimize_meta", severity: "low", title: "Improve meta description for homepage", description: "The homepage meta description is too short and doesn't include target keywords." },
    { type: "improve_cwv", severity: "medium", title: "Fix Core Web Vitals on mobile", description: "LCP is above 4s on mobile devices affecting user experience." },
    { type: "add_internal_links", severity: "low", title: "Add internal links to /about", description: "The about page has few internal links, reducing its authority flow." },
  ];

  for (const rec of recommendations) {
    await storage.createSeoRecommendation({
      projectId,
      url: `https://${domain}${rec.title.includes("homepage") ? "/" : "/page"}`,
      type: rec.type,
      severity: rec.severity,
      title: rec.title,
      description: rec.description,
      status: "open",
    });
  }

  const competitors = [
    { domain: "ahrefs.com", sharedKeywords: 45, aboveUs: 28, authority: 85, avgPos: 4.2 },
    { domain: "semrush.com", sharedKeywords: 52, aboveUs: 35, authority: 88, avgPos: 3.8 },
    { domain: "moz.com", sharedKeywords: 38, aboveUs: 22, authority: 82, avgPos: 5.5 },
    { domain: "searchenginejournal.com", sharedKeywords: 25, aboveUs: 12, authority: 75, avgPos: 8.2 },
    { domain: "backlinko.com", sharedKeywords: 18, aboveUs: 10, authority: 72, avgPos: 7.5 },
  ];

  for (const comp of competitors) {
    const pressureIndex = (comp.aboveUs * comp.authority) / 50;
    await storage.createCompetitorMetrics({
      projectId,
      competitorDomain: comp.domain,
      date: today.toISOString().split("T")[0],
      sharedKeywords: comp.sharedKeywords,
      aboveUsKeywords: comp.aboveUs,
      authorityScore: String(comp.authority),
      avgPosition: String(comp.avgPos),
      pressureIndex: String(pressureIndex.toFixed(2)),
    });
  }

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const baseScore = 65 + Math.random() * 20;
    const variation = Math.sin(i / 3) * 5;

    await storage.createSeoHealthSnapshot({
      projectId,
      date: dateStr,
      avgPosition: String(12 + Math.random() * 8 - i * 0.2),
      top3Keywords: Math.floor(3 + Math.random() * 4 + i * 0.1),
      top10Keywords: Math.floor(8 + Math.random() * 5 + i * 0.2),
      totalKeywords: 10,
      authorityScore: String(55 + Math.random() * 15 + i * 0.3),
      techScore: String(70 + Math.random() * 15),
      contentScore: String(60 + Math.random() * 20),
      seoHealthScore: String(baseScore + variation),
    });
  }

  // Create predefined crawl schedules
  const predefinedCrawls = [
    {
      url: `https://${domain}/keywords/rankings`,
      name: "Keyword Rankings Update",
      time: "09:00",
      days: [1, 3, 5], // Mon, Wed, Fri
    },
    {
      url: `https://${domain}/pages/metrics`,
      name: "Pages Metrics",
      time: "10:00",
      days: [0, 2, 4, 6], // Sun, Tue, Thu, Sat
    },
    {
      url: `https://${domain}/competitors/analysis`,
      name: "Competitors Analysis",
      time: "14:00",
      days: [1, 4], // Wed, Fri
    },
  ];

  for (const crawl of predefinedCrawls) {
    await storage.createCrawlSchedule({
      projectId,
      url: crawl.url,
      scheduledTime: crawl.time,
      daysOfWeek: crawl.days,
      isActive: true,
    });
  }
}
