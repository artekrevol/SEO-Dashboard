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
  runPageMetricsSyncWithLimit,
  runOnPageCrawl,
  runOnPageSync,
  runFullProjectSync,
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
import { crawlSchedulerService } from "./services/crawl-scheduler";

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

// Normalize legacy crawl types to canonical types
function normalizeCrawlTypeForSchedule(type?: string): string {
  const typeMap: Record<string, string> = {
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
  return typeMap[type || "keyword_ranks"] || "keyword_ranks";
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
      
      // Get latest page audit data for tech scores
      const pageAuditsByUrl = await storage.getLatestPageAuditsByUrl(projectId);

      const normalizeUrl = (url: string) => url.toLowerCase().replace(/\/+$/, '');

      const items = pages.map((p: any) => {
        const normalizedUrl = normalizeUrl(p.url);
        const auditData = pageAuditsByUrl.get(normalizedUrl);
        
        // Calculate tech risk from OnPage score (100 - score) when available, fallback to legacy
        const onpageScore = auditData?.onpageScore;
        const techRiskScore = onpageScore !== null && onpageScore !== undefined
          ? Math.round(100 - onpageScore)
          : Number(p.techRiskScore) || 0;

        return {
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
          techRiskScore: techRiskScore,
          authorityGapScore: Number(p.authorityGapScore) || 0,
          onpageScore: onpageScore ?? null,
          issueCount: auditData?.issueCount || 0,
          hasAuditData: !!auditData,
        };
      });

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

      const aggregatedCompetitors = await storage.getAggregatedCompetitors(projectId);

      const items = aggregatedCompetitors
        .filter((c) => {
          const domain = c.competitorDomain.toLowerCase().replace(/^www\./, '');
          return !domain.includes('tekrevol');
        })
        .map((c) => ({
          competitorDomain: c.competitorDomain,
          sharedKeywords: c.sharedKeywords,
          aboveUsKeywords: c.keywordsAboveUs,
          avgTheirPosition: c.avgCompetitorPosition,
          avgOurPosition: c.avgOurPosition,
          avgGap: c.avgGap,
          totalVolume: c.totalVolume,
          pressureIndex: c.pressureIndex,
          trafficThreat: c.pressureIndex >= 60 ? 'high' : c.pressureIndex >= 30 ? 'medium' : 'low',
        }));

      res.json({ items });
    } catch (error) {
      console.error("Error fetching competitor metrics:", error);
      res.status(500).json({ error: "Failed to fetch competitor metrics" });
    }
  });

  app.get("/api/competitors/summary", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const allCompetitors = await storage.getAggregatedCompetitors(projectId);
      const keywords = await storage.getKeywords(projectId);
      
      const competitors = allCompetitors.filter((c) => {
        const domain = c.competitorDomain.toLowerCase().replace(/^www\./, '');
        return !domain.includes('tekrevol');
      });

      res.json({ 
        competitors,
        totalTrackedKeywords: keywords.length,
        topCompetitors: competitors.slice(0, 10),
      });
    } catch (error) {
      console.error("Error fetching competitor summary:", error);
      res.status(500).json({ error: "Failed to fetch competitor summary" });
    }
  });

  app.get("/api/competitors/:domain/keywords", async (req, res) => {
    try {
      const { domain } = req.params;
      const projectId = req.query.projectId as string;
      
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      if (!domain) {
        return res.status(400).json({ error: "domain is required" });
      }

      const keywordDetails = await storage.getCompetitorKeywordDetails(projectId, domain);
      
      const aboveUs = keywordDetails.filter(k => k.gap > 0);
      const belowUs = keywordDetails.filter(k => k.gap < 0);
      const equal = keywordDetails.filter(k => k.gap === 0);

      res.json({ 
        keywords: keywordDetails,
        summary: {
          total: keywordDetails.length,
          aboveUs: aboveUs.length,
          belowUs: belowUs.length,
          equalPosition: equal.length,
          totalVolume: keywordDetails.reduce((sum, k) => sum + k.searchVolume, 0),
        }
      });
    } catch (error) {
      console.error("Error fetching competitor keyword details:", error);
      res.status(500).json({ error: "Failed to fetch competitor keyword details" });
    }
  });

  app.post("/api/competitors", async (req, res) => {
    try {
      const { projectId, domain } = req.body;
      
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      if (!domain) {
        return res.status(400).json({ error: "domain is required" });
      }

      const normalizedDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
      
      const today = new Date().toISOString().split('T')[0];
      const competitor = await storage.createCompetitorMetrics({
        projectId,
        competitorDomain: normalizedDomain,
        date: today,
        sharedKeywords: 0,
        aboveUsKeywords: 0,
      });
      
      res.status(201).json({ 
        success: true,
        competitor,
        message: `Added ${normalizedDomain} as a competitor`
      });
    } catch (error) {
      console.error("Error adding competitor:", error);
      res.status(500).json({ error: "Failed to add competitor" });
    }
  });

  app.delete("/api/competitors/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      const projectId = req.query.projectId as string;
      
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      if (!domain) {
        return res.status(400).json({ error: "domain is required" });
      }

      const deletedCount = await storage.deleteCompetitorByDomain(projectId, domain);
      
      res.json({ 
        success: true,
        deletedCount,
        message: `Deleted ${deletedCount} competitor entries for ${domain}`
      });
    } catch (error) {
      console.error("Error deleting competitor:", error);
      res.status(500).json({ error: "Failed to delete competitor" });
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
      if (!projectId || typeof projectId !== 'string' || projectId.length < 10) {
        return res.status(400).json({ error: "Valid projectId is required" });
      }
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json({ 
        success: true, 
        message: "Page metrics sync started", 
        status: "processing" 
      });
      
      runPageMetricsSync(projectId).then(result => {
        console.log(`[Jobs] Page metrics sync completed: ${result.message}`);
      }).catch(err => {
        console.error("[Jobs] Page metrics sync failed:", err);
      });
    } catch (error) {
      console.error("Error running page metrics sync:", error);
      res.status(500).json({ error: "Failed to start page metrics sync" });
    }
  });

  app.post("/api/jobs/on-page-crawl", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId || typeof projectId !== 'string' || projectId.length < 10) {
        return res.status(400).json({ error: "Valid projectId is required" });
      }
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
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
      if (!projectId || typeof projectId !== 'string' || projectId.length < 10) {
        return res.status(400).json({ error: "Valid projectId is required" });
      }
      if (!taskId || typeof taskId !== 'string') {
        return res.status(400).json({ error: "Valid taskId is required" });
      }
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json({ 
        success: true, 
        message: "On-page sync started", 
        status: "processing" 
      });
      
      runOnPageSync(projectId, taskId).then(result => {
        console.log(`[Jobs] On-page sync completed: ${result.message}`);
      }).catch(err => {
        console.error("[Jobs] On-page sync failed:", err);
      });
    } catch (error) {
      console.error("Error syncing on-page data:", error);
      res.status(500).json({ error: "Failed to start on-page sync" });
    }
  });

  app.post("/api/jobs/full-sync", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const keywordLimit = req.query.keywordLimit ? parseInt(req.query.keywordLimit as string) : undefined;
      const pageLimit = req.query.pageLimit ? parseInt(req.query.pageLimit as string) : undefined;
      const includeOnPageCrawl = req.query.includeOnPageCrawl === 'true';
      
      if (!projectId || typeof projectId !== 'string' || projectId.length < 10) {
        return res.status(400).json({ error: "Valid projectId is required" });
      }
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json({ 
        success: true, 
        message: "Full project sync started", 
        status: "processing",
        options: { keywordLimit, pageLimit, includeOnPageCrawl }
      });
      
      runFullProjectSync(projectId, { 
        keywordLimit, 
        pageLimit, 
        includeOnPageCrawl 
      }).then(result => {
        console.log(`[Jobs] Full sync completed: ${result.message}`);
      }).catch(err => {
        console.error("[Jobs] Full sync failed:", err);
      });
    } catch (error) {
      console.error("Error starting full sync:", error);
      res.status(500).json({ error: "Failed to start full sync" });
    }
  });

  app.post("/api/jobs/page-metrics-limited", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      
      if (!projectId || typeof projectId !== 'string' || projectId.length < 10) {
        return res.status(400).json({ error: "Valid projectId is required" });
      }
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json({ 
        success: true, 
        message: `Page metrics sync started for ${limit} pages`, 
        status: "processing" 
      });
      
      runPageMetricsSyncWithLimit(projectId, limit).then(result => {
        console.log(`[Jobs] Page metrics sync (limited) completed: ${result.message}`);
      }).catch(err => {
        console.error("[Jobs] Page metrics sync (limited) failed:", err);
      });
    } catch (error) {
      console.error("Error running page metrics sync:", error);
      res.status(500).json({ error: "Failed to start page metrics sync" });
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
      
      // Normalize legacy crawl types to canonical types
      const normalizedType = normalizeCrawlTypeForSchedule(type);
      
      const schedule = await storage.createCrawlSchedule({
        projectId,
        url: url || null,
        type: normalizedType,
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
      if (type !== undefined) updateData.type = normalizeCrawlTypeForSchedule(type);
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

      // Normalize the stored type to canonical type for execution
      const normalizedType = normalizeCrawlTypeForSchedule(schedule.type);
      const validTypes = ["keyword_ranks", "pages_health", "competitors", "backlinks", "competitor_backlinks", "deep_discovery"];
      
      if (!validTypes.includes(normalizedType)) {
        return res.status(400).json({ error: `Invalid crawl type: ${schedule.type}. Valid types: ${validTypes.join(", ")}` });
      }

      // Execute the crawl based on normalized type
      let result: any = { success: true, message: "Crawl queued" };
      
      switch (normalizedType) {
        case "keyword_ranks":
        case "deep_discovery":
          result = await runRankingsSync(projectId);
          break;
        case "pages_health":
          result = await runKeywordMetricsUpdate(projectId);
          break;
        case "competitors":
        case "competitor_backlinks":
          result = await runCompetitorAnalysis(projectId);
          break;
        case "backlinks":
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

  // Manual crawl trigger is now handled by the unified /api/crawl/trigger endpoint below
  // that uses the crawl scheduler for proper progress tracking

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

  // Running crawls endpoint - must be before :id route to avoid "running" being parsed as an ID
  app.get("/api/crawl-results/running", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const runningCrawls = await storage.getRunningCrawls(projectId);
      
      const enriched = runningCrawls.map(c => ({
        id: c.id,
        type: c.type,
        status: c.status,
        currentStage: c.currentStage,
        itemsTotal: c.itemsTotal || 0,
        itemsProcessed: c.itemsProcessed || 0,
        estimatedDurationSec: c.estimatedDurationSec,
        startedAt: c.startedAt,
        elapsedSec: c.startedAt ? Math.floor((Date.now() - new Date(c.startedAt).getTime()) / 1000) : 0,
        progressPercent: c.itemsTotal && c.itemsTotal > 0 
          ? Math.round((c.itemsProcessed || 0) / c.itemsTotal * 100) 
          : 0,
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching running crawls:", error);
      res.status(500).json({ error: "Failed to fetch running crawls" });
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

  // Stop a running crawl
  app.post("/api/crawl-results/:id/stop", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid crawl result ID" });
      }
      
      const crawl = await storage.getCrawlResult(id);
      if (!crawl) {
        return res.status(404).json({ error: "Crawl not found" });
      }
      
      if (crawl.status !== "running") {
        return res.status(400).json({ error: "Can only stop running crawls" });
      }
      
      const stopped = await storage.stopCrawl(id);
      console.log(`[Crawl] Manually stopped crawl ${id} (${crawl.type})`);
      res.json({ success: true, crawl: stopped });
    } catch (error) {
      console.error("Error stopping crawl:", error);
      res.status(500).json({ error: "Failed to stop crawl" });
    }
  });

  // Get all running crawls across all projects (for global status)
  app.get("/api/crawl-results/all-running", async (req, res) => {
    try {
      const runningCrawls = await storage.getAllRunningCrawls();
      
      // Enrich with project info
      const projects = await storage.getProjects();
      const projectMap = new Map(projects.map(p => [p.id, p]));
      
      const enriched = runningCrawls.map(c => ({
        ...c,
        projectName: projectMap.get(c.projectId)?.name || 'Unknown',
        projectDomain: projectMap.get(c.projectId)?.domain || 'Unknown',
        elapsedSec: c.startedAt ? Math.floor((Date.now() - new Date(c.startedAt).getTime()) / 1000) : 0,
        progress: c.itemsTotal && c.itemsTotal > 0 
          ? Math.round((c.itemsProcessed || 0) / c.itemsTotal * 100) 
          : null,
      }));
      
      res.json({ running: enriched });
    } catch (error) {
      console.error("Error fetching all running crawls:", error);
      res.status(500).json({ error: "Failed to fetch running crawls" });
    }
  });

  // Trigger a manual crawl for a project
  app.post("/api/crawl/trigger", async (req, res) => {
    try {
      const { projectId, crawlType } = req.body;
      
      if (!projectId || !crawlType) {
        return res.status(400).json({ error: "projectId and crawlType are required" });
      }
      
      const validTypes = ["keyword_ranks", "competitors", "pages_health", "deep_discovery", "backlinks", "competitor_backlinks"];
      if (!validTypes.includes(crawlType)) {
        return res.status(400).json({ error: `Invalid crawlType. Must be one of: ${validTypes.join(", ")}` });
      }
      
      // Check if a crawl of this type is already running for this project
      const runningCrawls = await storage.getRunningCrawlsByType(projectId, crawlType);
      if (runningCrawls.length > 0) {
        return res.status(409).json({ 
          error: `A ${crawlType} crawl is already running for this project`,
          runningCrawl: runningCrawls[0]
        });
      }
      
      // Get the project to verify it exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Find the schedule for this crawl type (if exists, for configuration)
      const schedules = await storage.getCrawlSchedules(projectId);
      const schedule = schedules.find(s => s.type === crawlType);
      
      // Create a temporary schedule object for execution (the scheduler will create the crawl result)
      const tempSchedule = schedule || {
        id: -1,
        projectId,
        type: crawlType,
        url: null,
        frequency: "manual",
        scheduledTime: "00:00",
        daysOfWeek: [],
        isActive: false,
        config: null,
        lastRunAt: null,
        nextRunAt: null,
        lastRunStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Execute the crawl asynchronously - scheduler creates the crawl result record
      crawlSchedulerService.executeSchedule(tempSchedule).catch(err => {
        console.error(`Error executing manual crawl for ${crawlType}:`, err);
      });
      
      res.json({ 
        success: true, 
        message: `${crawlType} crawl triggered successfully. Check the Active Crawls section for progress.`,
      });
    } catch (error) {
      console.error("Error triggering crawl:", error);
      res.status(500).json({ error: "Failed to trigger crawl" });
    }
  });

  // Global Settings API
  app.get("/api/settings/global", async (req, res) => {
    try {
      const settings = await storage.getAllGlobalSettings();
      const settingsMap: Record<string, string> = {};
      for (const s of settings) {
        settingsMap[s.key] = s.value;
      }
      res.json(settingsMap);
    } catch (error) {
      console.error("Error fetching global settings:", error);
      res.status(500).json({ error: "Failed to fetch global settings" });
    }
  });

  app.get("/api/settings/global/:key", async (req, res) => {
    try {
      const setting = await storage.getGlobalSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching global setting:", error);
      res.status(500).json({ error: "Failed to fetch global setting" });
    }
  });

  app.post("/api/settings/global", async (req, res) => {
    try {
      const { key, value, description } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ error: "key and value are required" });
      }
      const setting = await storage.setGlobalSetting(key, value, description);
      res.json(setting);
    } catch (error) {
      console.error("Error saving global setting:", error);
      res.status(500).json({ error: "Failed to save global setting" });
    }
  });

  // Get timezone setting with default fallback
  app.get("/api/settings/timezone", async (req, res) => {
    try {
      const setting = await storage.getGlobalSetting("timezone");
      const timezone = setting?.value || "America/Chicago";
      res.json({ timezone });
    } catch (error) {
      console.error("Error fetching timezone setting:", error);
      res.status(500).json({ error: "Failed to fetch timezone setting" });
    }
  });

  // Set timezone setting
  app.post("/api/settings/timezone", async (req, res) => {
    try {
      const { timezone } = req.body;
      if (!timezone) {
        return res.status(400).json({ error: "timezone is required" });
      }
      
      // Validate timezone format (basic check)
      try {
        new Date().toLocaleString("en-US", { timeZone: timezone });
      } catch (e) {
        return res.status(400).json({ error: "Invalid timezone identifier" });
      }
      
      const setting = await storage.setGlobalSetting(
        "timezone", 
        timezone, 
        "Default timezone for scheduled crawls and time displays"
      );
      
      res.json({ success: true, timezone: setting.value });
    } catch (error) {
      console.error("Error saving timezone setting:", error);
      res.status(500).json({ error: "Failed to save timezone setting" });
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

  // Rankings History API - per keyword
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

  // Rankings History API - project level with aggregations
  app.get("/api/project-rankings-history", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      
      const history = await storage.getRankingsHistoryByProject(projectId, startDate, endDate);
      
      // Get keywords for enrichment
      const keywords = await storage.getKeywords(projectId);
      const keywordMap = new Map(keywords.map(k => [k.id, k]));
      
      // Enrich history with keyword details
      const enrichedHistory = history.map(h => ({
        ...h,
        keyword: keywordMap.get(h.keywordId)?.keyword || 'Unknown',
        cluster: keywordMap.get(h.keywordId)?.cluster || null,
      }));
      
      // Calculate daily aggregations
      const dailyAggregations = new Map<string, { 
        date: string; 
        avgPosition: number; 
        totalKeywords: number;
        top3: number;
        top10: number;
        top20: number;
        top100: number;
        notRanking: number;
      }>();
      
      for (const item of history) {
        const date = item.date;
        if (!dailyAggregations.has(date)) {
          dailyAggregations.set(date, {
            date,
            avgPosition: 0,
            totalKeywords: 0,
            top3: 0,
            top10: 0,
            top20: 0,
            top100: 0,
            notRanking: 0,
          });
        }
        
        const agg = dailyAggregations.get(date)!;
        agg.totalKeywords++;
        
        if (item.position !== null && item.position > 0) {
          agg.avgPosition += item.position;
          if (item.position <= 3) agg.top3++;
          else if (item.position <= 10) agg.top10++;
          else if (item.position <= 20) agg.top20++;
          else if (item.position <= 100) agg.top100++;
        } else {
          agg.notRanking++;
        }
      }
      
      // Finalize averages
      const dailyStats = Array.from(dailyAggregations.values()).map(agg => ({
        ...agg,
        avgPosition: agg.totalKeywords > agg.notRanking 
          ? Number((agg.avgPosition / (agg.totalKeywords - agg.notRanking)).toFixed(1))
          : null,
      })).sort((a, b) => a.date.localeCompare(b.date));
      
      res.json({
        history: enrichedHistory,
        dailyStats,
        totalRecords: history.length,
      });
    } catch (error) {
      console.error("Error fetching project rankings history:", error);
      res.status(500).json({ error: "Failed to fetch project rankings history" });
    }
  });

  // Settings API - Quick Wins
  app.get("/api/settings/quick-wins", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const settings = await storage.getSettingsQuickWins(projectId);
      if (!settings) {
        return res.json({
          projectId,
          minPosition: 6,
          maxPosition: 20,
          minVolume: 50,
          maxDifficulty: 70,
          validIntents: ["commercial", "transactional"],
          enabled: true,
        });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching quick wins settings:", error);
      res.status(500).json({ error: "Failed to fetch quick wins settings" });
    }
  });

  app.post("/api/settings/quick-wins", async (req, res) => {
    try {
      const projectId = req.body.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      
      const { minPosition, maxPosition, minVolume, maxDifficulty, validIntents, enabled } = req.body;
      
      const sanitizedSettings: Record<string, unknown> = {};
      if (typeof minPosition === 'number') sanitizedSettings.minPosition = Math.max(1, minPosition);
      if (typeof maxPosition === 'number') sanitizedSettings.maxPosition = Math.max(1, maxPosition);
      if (typeof minVolume === 'number') sanitizedSettings.minVolume = Math.max(0, minVolume);
      if (typeof maxDifficulty === 'number') sanitizedSettings.maxDifficulty = Math.min(100, Math.max(0, maxDifficulty));
      if (Array.isArray(validIntents)) sanitizedSettings.validIntents = validIntents.filter((i: unknown) => typeof i === 'string');
      if (typeof enabled === 'boolean') sanitizedSettings.enabled = enabled;
      
      const settings = await storage.upsertSettingsQuickWins(projectId, sanitizedSettings);
      res.json(settings);
    } catch (error) {
      console.error("Error saving quick wins settings:", error);
      res.status(500).json({ error: "Failed to save quick wins settings" });
    }
  });

  // Settings API - Falling Stars
  app.get("/api/settings/falling-stars", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const settings = await storage.getSettingsFallingStars(projectId);
      if (!settings) {
        return res.json({
          projectId,
          windowDays: 7,
          minDropPositions: 5,
          minPreviousPosition: 10,
          minVolume: 0,
          enabled: true,
        });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching falling stars settings:", error);
      res.status(500).json({ error: "Failed to fetch falling stars settings" });
    }
  });

  app.post("/api/settings/falling-stars", async (req, res) => {
    try {
      const projectId = req.body.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      
      const { windowDays, minDropPositions, minPreviousPosition, minVolume, enabled } = req.body;
      
      const sanitizedSettings: Record<string, unknown> = {};
      if (typeof windowDays === 'number') sanitizedSettings.windowDays = Math.min(30, Math.max(1, windowDays));
      if (typeof minDropPositions === 'number') sanitizedSettings.minDropPositions = Math.max(1, minDropPositions);
      if (typeof minPreviousPosition === 'number') sanitizedSettings.minPreviousPosition = Math.max(1, minPreviousPosition);
      if (typeof minVolume === 'number') sanitizedSettings.minVolume = Math.max(0, minVolume);
      if (typeof enabled === 'boolean') sanitizedSettings.enabled = enabled;
      
      const settings = await storage.upsertSettingsFallingStars(projectId, sanitizedSettings);
      res.json(settings);
    } catch (error) {
      console.error("Error saving falling stars settings:", error);
      res.status(500).json({ error: "Failed to save falling stars settings" });
    }
  });

  app.get("/api/backlinks", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const targetUrl = req.query.targetUrl as string | undefined;
      const backlinks = await storage.getBacklinks(projectId, targetUrl);
      res.json({ backlinks });
    } catch (error) {
      console.error("Error fetching backlinks:", error);
      res.status(500).json({ error: "Failed to fetch backlinks" });
    }
  });

  app.get("/api/backlinks/aggregations", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const targetUrl = req.query.targetUrl as string | undefined;
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const aggregations = await storage.getBacklinkAggregations(projectId, targetUrl, days);
      res.json(aggregations);
    } catch (error) {
      console.error("Error fetching backlink aggregations:", error);
      res.status(500).json({ error: "Failed to fetch backlink aggregations" });
    }
  });

  app.get("/api/backlinks/by-domain", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const targetUrl = req.query.targetUrl as string | undefined;
      const domains = await storage.getBacklinksByDomain(projectId, targetUrl);
      res.json({ domains });
    } catch (error) {
      console.error("Error fetching backlinks by domain:", error);
      res.status(500).json({ error: "Failed to fetch backlinks by domain" });
    }
  });

  app.get("/api/backlinks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const backlink = await storage.getBacklink(id);
      if (!backlink) {
        return res.status(404).json({ error: "Backlink not found" });
      }
      res.json(backlink);
    } catch (error) {
      console.error("Error fetching backlink:", error);
      res.status(500).json({ error: "Failed to fetch backlink" });
    }
  });

  app.post("/api/backlinks", async (req, res) => {
    try {
      const { projectId, sourceUrl, targetUrl, sourceDomain, anchorText, linkType, domainAuthority, pageAuthority } = req.body;
      if (!projectId || !sourceUrl || !targetUrl) {
        return res.status(400).json({ error: "projectId, sourceUrl, and targetUrl are required" });
      }
      const backlink = await storage.upsertBacklink(projectId, sourceUrl, targetUrl, {
        sourceDomain,
        anchorText,
        linkType,
        domainAuthority,
        pageAuthority,
      });
      res.json(backlink);
    } catch (error) {
      console.error("Error creating backlink:", error);
      res.status(500).json({ error: "Failed to create backlink" });
    }
  });

  app.patch("/api/backlinks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { anchorText, linkType, domainAuthority, pageAuthority, isLive } = req.body;
      const updates: Record<string, unknown> = {};
      if (anchorText !== undefined) updates.anchorText = anchorText;
      if (linkType !== undefined) updates.linkType = linkType;
      if (domainAuthority !== undefined) updates.domainAuthority = domainAuthority;
      if (pageAuthority !== undefined) updates.pageAuthority = pageAuthority;
      if (isLive !== undefined) updates.isLive = isLive;
      
      const backlink = await storage.updateBacklink(id, updates);
      if (!backlink) {
        return res.status(404).json({ error: "Backlink not found" });
      }
      res.json(backlink);
    } catch (error) {
      console.error("Error updating backlink:", error);
      res.status(500).json({ error: "Failed to update backlink" });
    }
  });

  app.patch("/api/backlinks/:id/lost", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const backlink = await storage.markBacklinkLost(id);
      if (!backlink) {
        return res.status(404).json({ error: "Backlink not found" });
      }
      res.json(backlink);
    } catch (error) {
      console.error("Error marking backlink as lost:", error);
      res.status(500).json({ error: "Failed to mark backlink as lost" });
    }
  });

  app.delete("/api/backlinks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await storage.deleteBacklink(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting backlink:", error);
      res.status(500).json({ error: "Failed to delete backlink" });
    }
  });

  app.post("/api/backlinks/crawl", async (req, res) => {
    try {
      const { projectId } = req.body;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      
      console.log(`[API] Starting backlinks crawl for project ${projectId}`);
      const result = await crawlSchedulerService.runBacklinksCrawl(projectId);
      
      res.json(result);
    } catch (error) {
      console.error("Error running backlinks crawl:", error);
      res.status(500).json({ error: "Failed to run backlinks crawl" });
    }
  });

  app.post("/api/backlinks/spam-scores", async (req, res) => {
    try {
      const { projectId, targetUrl } = req.body;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      
      const dataForSeoService = DataForSEOService.fromEnv();
      if (!dataForSeoService) {
        return res.status(503).json({ error: "DataForSEO API not configured" });
      }
      
      const backlinks = await storage.getBacklinks(projectId, targetUrl);
      const uniqueDomains = Array.from(new Set(backlinks.map(b => b.sourceDomain.toLowerCase())));
      
      console.log(`[API] Fetching spam scores for ${uniqueDomains.length} domains${targetUrl ? ` (page: ${targetUrl})` : ''}`);
      const spamScoreMap = await dataForSeoService.getBulkSpamScores(uniqueDomains);
      const updated = await storage.updateBacklinkSpamScores(projectId, spamScoreMap, targetUrl);
      
      res.json({ 
        success: true, 
        domainsChecked: uniqueDomains.length,
        scoresFound: spamScoreMap.size,
        updated 
      });
    } catch (error) {
      console.error("Error fetching spam scores:", error);
      res.status(500).json({ error: "Failed to fetch spam scores" });
    }
  });

  app.get("/api/competitor-backlinks", async (req, res) => {
    try {
      const { projectId, competitorDomain } = req.query;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const backlinks = await storage.getCompetitorBacklinks(
        projectId as string,
        competitorDomain as string | undefined
      );
      res.json(backlinks);
    } catch (error) {
      console.error("Error fetching competitor backlinks:", error);
      res.status(500).json({ error: "Failed to fetch competitor backlinks" });
    }
  });

  app.get("/api/competitor-backlinks/aggregations", async (req, res) => {
    try {
      const { projectId, competitorDomain } = req.query;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const aggregations = await storage.getCompetitorBacklinkAggregations(
        projectId as string,
        competitorDomain as string | undefined
      );
      res.json(aggregations);
    } catch (error) {
      console.error("Error fetching competitor backlink aggregations:", error);
      res.status(500).json({ error: "Failed to fetch competitor backlink aggregations" });
    }
  });

  app.get("/api/competitor-backlinks/by-domain", async (req, res) => {
    try {
      const { projectId, competitorDomain } = req.query;
      if (!projectId || !competitorDomain) {
        return res.status(400).json({ error: "projectId and competitorDomain are required" });
      }
      const domains = await storage.getCompetitorBacklinksByDomain(
        projectId as string,
        competitorDomain as string
      );
      res.json(domains);
    } catch (error) {
      console.error("Error fetching competitor backlinks by domain:", error);
      res.status(500).json({ error: "Failed to fetch competitor backlinks by domain" });
    }
  });

  app.get("/api/competitor-backlinks/opportunities", async (req, res) => {
    try {
      const { projectId, competitorDomain } = req.query;
      if (!projectId || !competitorDomain) {
        return res.status(400).json({ error: "projectId and competitorDomain are required" });
      }
      const opportunities = await storage.findLinkOpportunities(
        projectId as string,
        competitorDomain as string
      );
      res.json(opportunities);
    } catch (error) {
      console.error("Error finding link opportunities:", error);
      res.status(500).json({ error: "Failed to find link opportunities" });
    }
  });

  app.get("/api/competitor-backlinks/counts", async (req, res) => {
    try {
      const { projectId } = req.query;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const counts = await storage.getCompetitorBacklinkCounts(projectId as string);
      res.json(counts);
    } catch (error) {
      console.error("Error fetching competitor backlink counts:", error);
      res.status(500).json({ error: "Failed to fetch competitor backlink counts" });
    }
  });

  app.get("/api/competitor-backlinks/gap-analysis", async (req, res) => {
    try {
      const { projectId, competitorDomain } = req.query;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const analysis = await storage.getBacklinkGapAnalysis(
        projectId as string,
        competitorDomain as string | undefined
      );
      res.json(analysis);
    } catch (error) {
      console.error("Error getting backlink gap analysis:", error);
      res.status(500).json({ error: "Failed to get backlink gap analysis" });
    }
  });

  // Promote gap opportunity to recommendations for outreach
  app.post("/api/recommendations/promote-gap", async (req, res) => {
    try {
      const promoteSchema = z.object({
        projectId: z.string(),
        sourceDomain: z.string(),
        domainAuthority: z.number().optional(),
        linkType: z.string().optional(),
        spamScore: z.number().nullable().optional(),
        competitors: z.array(z.string()).optional(),
        competitorCount: z.number().optional(),
      });

      const parsed = promoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { projectId, sourceDomain, domainAuthority, linkType, spamScore, competitors, competitorCount } = parsed.data;

      // Check if recommendation already exists for this domain
      const existingRecs = await storage.getSeoRecommendations(projectId, {
        type: "backlink_outreach",
        status: "open",
      });
      
      const alreadyExists = existingRecs.some(r => {
        const signals = r.sourceSignals as { sourceDomain?: string } | null;
        return signals?.sourceDomain === sourceDomain;
      });

      if (alreadyExists) {
        return res.status(409).json({ error: "Outreach recommendation already exists for this domain" });
      }

      // Determine severity based on DA and competitor count
      let severity: "high" | "medium" | "low" = "medium";
      if ((domainAuthority && domainAuthority >= 50) || (competitorCount && competitorCount >= 3)) {
        severity = "high";
      } else if (domainAuthority && domainAuthority < 40) {
        severity = "low";
      }

      const recommendation = await storage.createSeoRecommendation({
        projectId,
        type: "backlink_outreach",
        severity,
        title: `Outreach: ${sourceDomain}`,
        description: `High-potential backlink opportunity. Domain Authority: ${domainAuthority || 'N/A'}. ${linkType === 'dofollow' ? 'Dofollow link.' : ''} Links to ${competitorCount || 0} competitor(s): ${competitors?.slice(0, 3).join(', ') || 'Unknown'}${(competitors?.length || 0) > 3 ? '...' : ''}.`,
        status: "open",
        sourceSignals: {
          sourceDomain,
          domainAuthority,
          linkType,
          spamScore,
          competitors,
          competitorCount,
          promotedAt: new Date().toISOString(),
        },
      });

      res.json({ success: true, recommendation });
    } catch (error) {
      console.error("Error promoting gap to recommendation:", error);
      res.status(500).json({ error: "Failed to promote gap to recommendation" });
    }
  });

  app.post("/api/competitor-backlinks/crawl", async (req, res) => {
    try {
      const { projectId, competitorDomain, limit = 100 } = req.body;
      if (!projectId || !competitorDomain) {
        return res.status(400).json({ error: "projectId and competitorDomain are required" });
      }
      
      const dataForSeoService = DataForSEOService.fromEnv();
      if (!dataForSeoService) {
        return res.status(503).json({ error: "DataForSEO API not configured" });
      }
      
      console.log(`[API] Starting competitor backlinks crawl for ${competitorDomain}`);
      const { backlinks, totalCount } = await dataForSeoService.getCompetitorBacklinks(competitorDomain, limit);
      
      let inserted = 0;
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
        inserted++;
      }
      
      const uniqueDomains = Array.from(new Set(backlinks.map(b => b.sourceDomain.toLowerCase())));
      const spamScoreMap = await dataForSeoService.getBulkSpamScores(uniqueDomains);
      
      for (const backlink of backlinks) {
        const spamScore = spamScoreMap.get(backlink.sourceDomain.toLowerCase());
        if (spamScore !== undefined) {
          const existing = await storage.getCompetitorBacklinks(projectId, competitorDomain);
          const match = existing.find(b => b.sourceUrl === backlink.sourceUrl && b.targetUrl === backlink.targetUrl);
          if (match) {
            await storage.upsertCompetitorBacklink(
              projectId,
              competitorDomain,
              match.sourceUrl,
              match.targetUrl,
              { spamScore }
            );
          }
        }
      }
      
      const opportunitiesUpdated = await storage.updateCompetitorBacklinkOpportunities(projectId, competitorDomain);
      
      res.json({ 
        success: true, 
        totalAvailable: totalCount,
        backlinksProcessed: inserted,
        spamScoresFound: spamScoreMap.size,
        opportunitiesIdentified: opportunitiesUpdated
      });
    } catch (error) {
      console.error("Error crawling competitor backlinks:", error);
      res.status(500).json({ error: "Failed to crawl competitor backlinks" });
    }
  });

  // ========== Technical SEO Suite API Routes ==========

  // Get all tech crawls for a project
  app.get("/api/tech-crawls", async (req, res) => {
    try {
      const { projectId, limit } = req.query;
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }
      const crawls = await storage.getTechCrawls(projectId, limit ? Number(limit) : undefined);
      res.json({ crawls });
    } catch (error) {
      console.error("Error fetching tech crawls:", error);
      res.status(500).json({ error: "Failed to fetch tech crawls" });
    }
  });

  // Get latest tech crawl for a project
  app.get("/api/tech-crawls/latest", async (req, res) => {
    try {
      const { projectId } = req.query;
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }
      const crawl = await storage.getLatestTechCrawl(projectId);
      if (!crawl) {
        return res.status(404).json({ error: "No tech crawl found for this project" });
      }
      res.json(crawl);
    } catch (error) {
      console.error("Error fetching latest tech crawl:", error);
      res.status(500).json({ error: "Failed to fetch latest tech crawl" });
    }
  });

  // Get running tech crawls
  app.get("/api/tech-crawls/running", async (req, res) => {
    try {
      const { projectId } = req.query;
      const crawls = await storage.getRunningTechCrawls(
        projectId && typeof projectId === "string" ? projectId : undefined
      );
      res.json({ crawls });
    } catch (error) {
      console.error("Error fetching running tech crawls:", error);
      res.status(500).json({ error: "Failed to fetch running tech crawls" });
    }
  });

  // Get a specific tech crawl
  app.get("/api/tech-crawls/:id", async (req, res) => {
    try {
      const crawl = await storage.getTechCrawl(Number(req.params.id));
      if (!crawl) {
        return res.status(404).json({ error: "Tech crawl not found" });
      }
      res.json(crawl);
    } catch (error) {
      console.error("Error fetching tech crawl:", error);
      res.status(500).json({ error: "Failed to fetch tech crawl" });
    }
  });

  // Start a new tech audit crawl
  app.post("/api/tech-crawls", async (req, res) => {
    try {
      const { projectId, maxPages, enableJavascript } = req.body;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Check for running crawls
      const runningCrawls = await storage.getRunningTechCrawls(projectId);
      if (runningCrawls.length > 0) {
        return res.status(409).json({ 
          error: "A tech crawl is already running for this project",
          runningCrawlId: runningCrawls[0].id
        });
      }

      const dataForSeoService = DataForSEOService.fromEnv();
      if (!dataForSeoService) {
        return res.status(503).json({ error: "DataForSEO API not configured" });
      }

      // Start the crawl via DataForSEO
      const { taskId, error: apiError } = await dataForSeoService.startTechAuditCrawl(project.domain, {
        maxPages: maxPages || 500,
        enableJavascript: enableJavascript || false,
      });

      if (!taskId) {
        return res.status(500).json({ error: apiError || "Failed to start tech audit crawl" });
      }

      // Create crawl record
      const crawl = await storage.createTechCrawl({
        projectId,
        onpageTaskId: taskId,
        targetDomain: project.domain,
        status: "queued",
        startedAt: new Date(),
        maxPages: maxPages || 500,
      });

      console.log(`[Tech Audit] Started crawl for ${project.domain}, task ID: ${taskId}, crawl ID: ${crawl.id}`);

      res.status(201).json(crawl);
    } catch (error) {
      console.error("Error starting tech crawl:", error);
      res.status(500).json({ error: "Failed to start tech crawl" });
    }
  });

  // Poll/sync tech crawl status and data
  app.post("/api/tech-crawls/:id/sync", async (req, res) => {
    try {
      const crawlId = Number(req.params.id);
      const crawl = await storage.getTechCrawl(crawlId);
      
      if (!crawl) {
        return res.status(404).json({ error: "Tech crawl not found" });
      }

      if (crawl.status === "completed" || crawl.status === "failed") {
        return res.json({ message: "Crawl already completed", crawl });
      }

      const dataForSeoService = DataForSEOService.fromEnv();
      if (!dataForSeoService) {
        return res.status(503).json({ error: "DataForSEO API not configured" });
      }

      if (!crawl.onpageTaskId) {
        return res.status(400).json({ error: "Crawl has no associated DataForSEO task ID" });
      }

      // Get summary from DataForSEO
      const summary = await dataForSeoService.getTechAuditSummary(crawl.onpageTaskId);
      
      if (!summary) {
        return res.status(500).json({ error: "Failed to get crawl status from DataForSEO" });
      }

      // Update crawl record
      const updates: any = {
        status: summary.status,
        pagesCrawled: summary.pagesCrawled,
        pagesTotal: summary.maxPages,
        avgOnpageScore: String(summary.onpageScore),
        criticalIssues: summary.issuesSummary.critical,
        warnings: summary.issuesSummary.warnings,
      };

      if (summary.status === "completed") {
        updates.completedAt = new Date();
        
        // Fetch and store page audit data
        const { pages } = await dataForSeoService.getTechAuditPages(crawl.onpageTaskId, 1000);
        
        if (pages.length > 0) {
          // Delete existing audits for this crawl (in case of re-sync)
          await storage.deletePageAuditsByTechCrawl(crawlId);
          
          // Create page audits
          const auditRecords = pages.map(page => ({
            projectId: crawl.projectId,
            techCrawlId: crawlId,
            url: page.url,
            statusCode: page.statusCode,
            onpageScore: String(page.onpageScore),
            title: page.meta.title,
            titleLength: page.meta.titleLength,
            description: page.meta.description,
            descriptionLength: page.meta.descriptionLength,
            canonicalUrl: page.meta.canonicalUrl,
            isIndexable: page.indexability.isIndexable,
            indexabilityReason: page.indexability.reason,
            wordCount: page.content.wordCount,
            h1Count: page.content.h1Count,
            h2Count: page.content.h2Count,
            readabilityScore: String(page.content.readabilityScore),
            contentRate: String(page.content.contentRate),
            pageSizeKb: String(page.performance.pageSizeKb),
            loadTimeMs: page.performance.loadTimeMs,
            lcpMs: page.performance.lcpMs,
            clsScore: page.performance.clsScore ? String(page.performance.clsScore) : null,
            tbtMs: page.performance.tbtMs,
            fidMs: page.performance.fidMs,
            internalLinksCount: page.links.internalCount,
            externalLinksCount: page.links.externalCount,
            brokenLinksCount: page.links.brokenCount,
            imagesCount: page.images.count,
            imagesWithoutAlt: page.images.withoutAlt,
            hasSchema: page.schema.hasSchema,
            schemaTypes: page.schema.types,
            clickDepth: page.structure.clickDepth,
            isOrphanPage: page.structure.isOrphanPage,
            checksData: page.checks,
          }));

          const createdAudits = await storage.createPageAudits(auditRecords);
          
          // Create page issues from checks
          const allIssues: any[] = [];
          for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const audit = createdAudits[i];
            
            for (const [checkKey, checkValue] of Object.entries(page.checks)) {
              const issueInfo = dataForSeoService.classifyOnPageIssue(checkKey, checkValue);
              if (issueInfo) {
                allIssues.push({
                  projectId: crawl.projectId,
                  pageAuditId: audit.id,
                  issueCode: issueInfo.code,
                  issueLabel: issueInfo.label,
                  severity: issueInfo.severity,
                  category: issueInfo.category,
                  occurrences: 1,
                });
              }
            }
          }
          
          if (allIssues.length > 0) {
            await storage.createPageIssues(allIssues);
          }
          
          updates.issuesTotal = allIssues.length;
          
          // Auto-generate recommendations from critical/error issues
          const criticalIssues = allIssues.filter(issue => 
            issue.severity === "critical" || issue.severity === "error"
          );
          
          // Group issues by category and URL for recommendation generation
          const issueGroups: Map<string, { count: number; urls: Set<string>; label: string; severity: string }> = new Map();
          
          for (let i = 0; i < criticalIssues.length; i++) {
            const issue = criticalIssues[i];
            const audit = createdAudits.find(a => a.id === issue.pageAuditId);
            const key = `${issue.issueCode}-${issue.category}`;
            
            if (!issueGroups.has(key)) {
              issueGroups.set(key, { 
                count: 0, 
                urls: new Set(), 
                label: issue.issueLabel, 
                severity: issue.severity 
              });
            }
            
            const group = issueGroups.get(key)!;
            group.count++;
            if (audit) {
              group.urls.add(audit.url);
            }
          }
          
          // Create recommendations for issues affecting multiple pages or critical single-page issues
          let recommendationsCreated = 0;
          const issueGroupEntries = Array.from(issueGroups.entries());
          for (let i = 0; i < issueGroupEntries.length; i++) {
            const [key, group] = issueGroupEntries[i];
            const [issueCode, category] = key.split("-");
            const urlsArray = Array.from(group.urls);
            const pagesAffected = urlsArray.length;
            
            // Create recommendation if it affects at least 1 page
            if (pagesAffected > 0) {
              const titleMap: Record<string, string> = {
                "meta": "Fix Meta Tag Issues",
                "content": "Resolve Content Issues",
                "links": "Fix Broken or Missing Links",
                "performance": "Improve Page Performance",
                "indexability": "Resolve Indexability Issues",
                "images": "Fix Image Optimization Issues",
                "schema": "Add or Fix Structured Data",
                "security": "Address Security Issues",
              };
              
              const title = `${titleMap[category] || "Fix Technical Issue"}: ${group.label}`;
              const firstUrl = urlsArray[0] || "";
              const description = pagesAffected > 1 
                ? `This issue affects ${pagesAffected} pages across the site. Priority: ${group.severity}.`
                : `This issue was found on: ${firstUrl}. Priority: ${group.severity}.`;
              
              await storage.createSeoRecommendation({
                projectId: crawl.projectId,
                url: pagesAffected === 1 ? firstUrl : undefined,
                type: "technical_seo",
                severity: group.severity === "critical" ? "critical" : "high",
                title,
                description,
                status: "open",
                sourceSignals: {
                  issueCode,
                  category,
                  pagesAffected,
                  techCrawlId: crawlId,
                  affectedUrls: urlsArray.slice(0, 10), // Store first 10 URLs
                },
              });
              recommendationsCreated++;
            }
          }
          
          console.log(`[Tech Audit] Generated ${recommendationsCreated} recommendations from ${criticalIssues.length} critical issues`);
        }
      }

      const updatedCrawl = await storage.updateTechCrawl(crawlId, updates);
      
      res.json({ 
        crawl: updatedCrawl,
        summary: {
          status: summary.status,
          pagesCrawled: summary.pagesCrawled,
          onpageScore: summary.onpageScore,
          issues: summary.issuesSummary,
        }
      });
    } catch (error) {
      console.error("Error syncing tech crawl:", error);
      res.status(500).json({ error: "Failed to sync tech crawl" });
    }
  });

  // Get page audits for a project
  app.get("/api/page-audits", async (req, res) => {
    try {
      const { projectId, techCrawlId, limit, offset, minScore, maxScore } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const audits = await storage.getPageAudits(projectId, {
        techCrawlId: techCrawlId ? Number(techCrawlId) : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
        minScore: minScore ? Number(minScore) : undefined,
        maxScore: maxScore ? Number(maxScore) : undefined,
      });

      res.json({ audits });
    } catch (error) {
      console.error("Error fetching page audits:", error);
      res.status(500).json({ error: "Failed to fetch page audits" });
    }
  });

  // Get page audits summary
  app.get("/api/page-audits/summary", async (req, res) => {
    try {
      const { projectId, techCrawlId } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const summary = await storage.getPageAuditsSummary(
        projectId, 
        techCrawlId ? Number(techCrawlId) : undefined
      );

      res.json(summary);
    } catch (error) {
      console.error("Error fetching page audits summary:", error);
      res.status(500).json({ error: "Failed to fetch page audits summary" });
    }
  });

  // Get page audit by URL (must be before :id route to avoid matching "by-url" as id)
  app.get("/api/page-audits/by-url", async (req, res) => {
    try {
      const { projectId, url, techCrawlId } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "url is required" });
      }

      const audit = await storage.getPageAuditByUrl(
        projectId, 
        url,
        techCrawlId ? Number(techCrawlId) : undefined
      );

      if (!audit) {
        return res.status(404).json({ error: "Page audit not found for this URL" });
      }

      const issues = await storage.getPageIssues(audit.id);
      
      res.json({ audit, issues });
    } catch (error) {
      console.error("Error fetching page audit by URL:", error);
      res.status(500).json({ error: "Failed to fetch page audit" });
    }
  });

  // Get a specific page audit by ID
  app.get("/api/page-audits/:id", async (req, res) => {
    try {
      const audit = await storage.getPageAudit(Number(req.params.id));
      if (!audit) {
        return res.status(404).json({ error: "Page audit not found" });
      }
      
      // Also get issues for this audit
      const issues = await storage.getPageIssues(audit.id);
      
      res.json({ audit, issues });
    } catch (error) {
      console.error("Error fetching page audit:", error);
      res.status(500).json({ error: "Failed to fetch page audit" });
    }
  });

  // Get issues for a project
  app.get("/api/page-issues", async (req, res) => {
    try {
      const { projectId, techCrawlId, severity, category, limit } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const issues = await storage.getPageIssuesByProject(projectId, {
        techCrawlId: techCrawlId ? Number(techCrawlId) : undefined,
        severity: severity && typeof severity === "string" ? severity : undefined,
        category: category && typeof category === "string" ? category : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.json({ issues });
    } catch (error) {
      console.error("Error fetching page issues:", error);
      res.status(500).json({ error: "Failed to fetch page issues" });
    }
  });

  // Get issues summary
  app.get("/api/page-issues/summary", async (req, res) => {
    try {
      const { projectId, techCrawlId } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const summary = await storage.getIssuesSummary(
        projectId,
        techCrawlId ? Number(techCrawlId) : undefined
      );

      res.json({ issues: summary });
    } catch (error) {
      console.error("Error fetching issues summary:", error);
      res.status(500).json({ error: "Failed to fetch issues summary" });
    }
  });

  // ============================================
  // CANNIBALIZATION DETECTION ROUTES
  // ============================================
  
  // Get keyword page conflicts
  app.get("/api/cannibalization", async (req, res) => {
    try {
      const { projectId, status, severity, keyword, limit } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const conflicts = await storage.getKeywordPageConflicts(projectId, {
        status: status && typeof status === "string" ? status : undefined,
        severity: severity && typeof severity === "string" ? severity : undefined,
        keyword: keyword && typeof keyword === "string" ? keyword : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.json({ conflicts });
    } catch (error) {
      console.error("Error fetching cannibalization conflicts:", error);
      res.status(500).json({ error: "Failed to fetch cannibalization conflicts" });
    }
  });

  // Get cannibalization summary
  app.get("/api/cannibalization/summary", async (req, res) => {
    try {
      const { projectId } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const summary = await storage.getConflictsSummary(projectId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching cannibalization summary:", error);
      res.status(500).json({ error: "Failed to fetch cannibalization summary" });
    }
  });

  // Run cannibalization scan
  app.post("/api/cannibalization/scan", async (req, res) => {
    try {
      const { projectId } = req.body;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const { runCannibalizationScan } = await import("./services/cannibalization-detector");
      const result = await runCannibalizationScan(projectId);

      res.json({
        success: true,
        message: `Cannibalization scan complete: ${result.newConflicts} new, ${result.updatedConflicts} updated, ${result.resolvedConflicts} resolved`,
        ...result,
      });
    } catch (error) {
      console.error("Error running cannibalization scan:", error);
      res.status(500).json({ error: "Failed to run cannibalization scan" });
    }
  });

  // Update conflict status
  app.patch("/api/cannibalization/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!id || isNaN(Number(id))) {
        return res.status(400).json({ error: "Valid conflict ID is required" });
      }

      const updates: Record<string, unknown> = {};
      if (status) {
        updates.status = status;
        if (status === 'resolved') {
          updates.resolvedAt = new Date();
        }
      }
      if (notes !== undefined) {
        updates.notes = notes;
      }

      const updated = await storage.updateKeywordPageConflict(Number(id), updates);
      
      if (!updated) {
        return res.status(404).json({ error: "Conflict not found" });
      }

      res.json({ success: true, conflict: updated });
    } catch (error) {
      console.error("Error updating conflict:", error);
      res.status(500).json({ error: "Failed to update conflict" });
    }
  });

  // Delete a conflict
  app.delete("/api/cannibalization/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!id || isNaN(Number(id))) {
        return res.status(400).json({ error: "Valid conflict ID is required" });
      }

      await storage.deleteKeywordPageConflict(Number(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting conflict:", error);
      res.status(500).json({ error: "Failed to delete conflict" });
    }
  });

  // Promote conflict to recommendation
  app.post("/api/cannibalization/:id/promote", async (req, res) => {
    try {
      const { id } = req.params;

      if (!id || isNaN(Number(id))) {
        return res.status(400).json({ error: "Valid conflict ID is required" });
      }

      const conflict = await storage.getKeywordPageConflict(Number(id));
      
      if (!conflict) {
        return res.status(404).json({ error: "Conflict not found" });
      }

      const recommendation = await storage.createSeoRecommendation({
        projectId: conflict.projectId,
        url: conflict.primaryUrl,
        type: "fix_cannibalization",
        severity: conflict.severity === "high" ? "high" : conflict.severity === "medium" ? "medium" : "low",
        title: `Fix keyword cannibalization for "${conflict.keyword}"`,
        description: conflict.suggestedAction || `Multiple pages are competing for the keyword "${conflict.keyword}". Primary URL: ${conflict.primaryUrl} (position #${conflict.primaryPosition}), Conflicting URL: ${conflict.conflictingUrl} (position #${conflict.conflictingPosition}). Consider consolidating content or implementing canonical tags.`,
        status: "open",
        sourceSignals: {
          type: "cannibalization",
          conflictId: conflict.id,
          keyword: conflict.keyword,
          primaryUrl: conflict.primaryUrl,
          conflictingUrl: conflict.conflictingUrl,
          primaryPosition: conflict.primaryPosition,
          conflictingPosition: conflict.conflictingPosition,
          searchVolume: conflict.searchVolume,
        },
      });

      res.json({ 
        success: true, 
        recommendation,
        message: "Cannibalization issue promoted to recommendation" 
      });
    } catch (error) {
      console.error("Error promoting conflict:", error);
      res.status(500).json({ error: "Failed to promote conflict to recommendation" });
    }
  });

  // ============================================
  // SCHEDULED REPORTS ROUTES
  // ============================================

  // Get all scheduled reports for a project
  app.get("/api/scheduled-reports", async (req, res) => {
    try {
      const { projectId } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const reports = await storage.getScheduledReports(projectId);
      res.json({ reports });
    } catch (error) {
      console.error("Error fetching scheduled reports:", error);
      res.status(500).json({ error: "Failed to fetch scheduled reports" });
    }
  });

  // Get a single scheduled report
  app.get("/api/scheduled-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getScheduledReport(Number(id));
      
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      res.json(report);
    } catch (error) {
      console.error("Error fetching scheduled report:", error);
      res.status(500).json({ error: "Failed to fetch scheduled report" });
    }
  });

  // Create a new scheduled report
  app.post("/api/scheduled-reports", async (req, res) => {
    try {
      const { projectId, name, reportType, frequency, dayOfWeek, dayOfMonth, timeOfDay, timezone, recipients, ...options } = req.body;

      if (!projectId || !name || !reportType || !frequency || !recipients || recipients.length === 0) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const now = new Date();
      const [hours, minutes] = (timeOfDay || "09:00").split(":").map(Number);
      let nextScheduledAt = new Date(now);
      nextScheduledAt.setHours(hours, minutes, 0, 0);
      
      if (nextScheduledAt <= now) {
        nextScheduledAt.setDate(nextScheduledAt.getDate() + 1);
      }

      const report = await storage.createScheduledReport({
        projectId,
        name,
        reportType,
        frequency,
        dayOfWeek: dayOfWeek ?? null,
        dayOfMonth: dayOfMonth ?? null,
        timeOfDay: timeOfDay || "09:00",
        timezone: timezone || "America/Chicago",
        recipients,
        includeExecutiveSummary: options.includeExecutiveSummary ?? true,
        includeTrends: options.includeTrends ?? true,
        includeRecommendations: options.includeRecommendations ?? true,
        includeCompetitors: options.includeCompetitors ?? false,
        customSections: options.customSections ?? null,
        isActive: true,
      });

      await storage.updateScheduledReport(report.id, { nextScheduledAt });

      res.json({ success: true, report });
    } catch (error) {
      console.error("Error creating scheduled report:", error);
      res.status(500).json({ error: "Failed to create scheduled report" });
    }
  });

  // Update a scheduled report
  app.patch("/api/scheduled-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const report = await storage.updateScheduledReport(Number(id), updates);
      
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      res.json({ success: true, report });
    } catch (error) {
      console.error("Error updating scheduled report:", error);
      res.status(500).json({ error: "Failed to update scheduled report" });
    }
  });

  // Delete a scheduled report
  app.delete("/api/scheduled-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteScheduledReport(Number(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting scheduled report:", error);
      res.status(500).json({ error: "Failed to delete scheduled report" });
    }
  });

  // Get report runs history
  app.get("/api/report-runs", async (req, res) => {
    try {
      const { projectId, limit } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const runs = await storage.getReportRuns(projectId, limit ? Number(limit) : 20);
      res.json({ runs });
    } catch (error) {
      console.error("Error fetching report runs:", error);
      res.status(500).json({ error: "Failed to fetch report runs" });
    }
  });

  // Send a manual report
  app.post("/api/reports/send", async (req, res) => {
    try {
      const { projectId, reportType, recipients, ...options } = req.body;

      if (!projectId || !reportType || !recipients || recipients.length === 0) {
        return res.status(400).json({ error: "projectId, reportType, and recipients are required" });
      }

      const { executeManualReport } = await import("./services/email-service");
      const run = await executeManualReport(projectId, reportType, recipients, options);

      res.json({ 
        success: run.status === "completed",
        run,
        message: run.status === "completed" 
          ? `Report sent to ${recipients.length} recipient(s)` 
          : `Report generation ${run.status}`,
      });
    } catch (error) {
      console.error("Error sending manual report:", error);
      res.status(500).json({ error: "Failed to send report" });
    }
  });

  // Generate report preview (without sending)
  app.post("/api/reports/preview", async (req, res) => {
    try {
      const { projectId, reportType, ...options } = req.body;

      if (!projectId || !reportType) {
        return res.status(400).json({ error: "projectId and reportType are required" });
      }

      const { generateReportData, formatReportAsHtml } = await import("./services/report-generator");
      const data = await generateReportData(projectId, reportType, options);

      if (!data) {
        return res.status(404).json({ error: "Failed to generate report data" });
      }

      const html = formatReportAsHtml(data);
      res.json({ data, html });
    } catch (error) {
      console.error("Error generating report preview:", error);
      res.status(500).json({ error: "Failed to generate preview" });
    }
  });

  // ============================================
  // GOOGLE SEARCH CONSOLE ROUTES
  // ============================================

  // Get GSC credentials status for a project
  app.get("/api/gsc/status", async (req, res) => {
    try {
      const { projectId } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const credentials = await storage.getGscCredentials(projectId);
      
      if (!credentials) {
        return res.json({ connected: false });
      }

      res.json({
        connected: true,
        isConnected: credentials.isConnected,
        siteUrl: credentials.siteUrl,
        tokenExpired: credentials.tokenExpiresAt ? new Date(credentials.tokenExpiresAt) < new Date() : true,
        lastSyncAt: credentials.lastSyncAt,
      });
    } catch (error) {
      console.error("Error getting GSC status:", error);
      res.status(500).json({ error: "Failed to get GSC status" });
    }
  });

  // Get GSC OAuth URL
  app.get("/api/gsc/auth-url", async (req, res) => {
    try {
      const { projectId, siteUrl } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const { getGscAuthUrl } = await import("./services/gsc-service");
      
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const redirectUri = `${protocol}://${host}/api/gsc/callback`;
      
      const state = Buffer.from(JSON.stringify({ projectId, siteUrl })).toString("base64");
      const authUrl = getGscAuthUrl(redirectUri, state);

      if (!authUrl) {
        return res.status(500).json({ error: "Google OAuth not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
      }

      res.json({ authUrl, redirectUri });
    } catch (error) {
      console.error("Error generating GSC auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  // GSC OAuth callback
  app.get("/api/gsc/callback", async (req, res) => {
    try {
      const { code, state, error: authError } = req.query;

      if (authError) {
        console.error("GSC OAuth error:", authError);
        return res.redirect("/?gsc_error=auth_denied");
      }

      if (!code || typeof code !== "string" || !state || typeof state !== "string") {
        return res.redirect("/?gsc_error=missing_params");
      }

      const { projectId, siteUrl } = JSON.parse(Buffer.from(state, "base64").toString());

      if (!projectId || !siteUrl) {
        return res.redirect("/?gsc_error=invalid_state");
      }

      const { handleGscAuthCallback } = await import("./services/gsc-service");
      
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const redirectUri = `${protocol}://${host}/api/gsc/callback`;

      const credentials = await handleGscAuthCallback(code, redirectUri, projectId, siteUrl);

      if (!credentials) {
        return res.redirect("/?gsc_error=token_exchange_failed");
      }

      res.redirect(`/?gsc_success=true&project=${projectId}`);
    } catch (error) {
      console.error("Error handling GSC callback:", error);
      res.redirect("/?gsc_error=callback_failed");
    }
  });

  // Disconnect GSC
  app.delete("/api/gsc/disconnect", async (req, res) => {
    try {
      const { projectId } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      await storage.deleteGscCredentials(projectId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting GSC:", error);
      res.status(500).json({ error: "Failed to disconnect GSC" });
    }
  });

  // Toggle GSC active status
  app.patch("/api/gsc/toggle", async (req, res) => {
    try {
      const { projectId } = req.query;
      const { isConnected } = req.body;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const credentials = await storage.updateGscCredentials(projectId, { isConnected });
      
      if (!credentials) {
        return res.status(404).json({ error: "GSC credentials not found" });
      }

      res.json({ success: true, isConnected: credentials.isConnected });
    } catch (error) {
      console.error("Error toggling GSC status:", error);
      res.status(500).json({ error: "Failed to toggle GSC status" });
    }
  });

  // Sync GSC data
  app.post("/api/gsc/sync", async (req, res) => {
    try {
      const { projectId, daysBack } = req.body;
      
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const { syncSearchAnalytics } = await import("./services/gsc-service");
      const result = await syncSearchAnalytics(projectId, daysBack || 7);

      await storage.updateGscCredentials(projectId, { lastSyncAt: new Date() });

      res.json({ 
        success: true, 
        synced: result.synced, 
        errors: result.errors,
      });
    } catch (error) {
      console.error("Error syncing GSC data:", error);
      res.status(500).json({ error: "Failed to sync GSC data" });
    }
  });

  // Get GSC summary
  app.get("/api/gsc/summary", async (req, res) => {
    try {
      const { projectId, daysBack } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const { getGscSummary } = await import("./services/gsc-service");
      const summary = await getGscSummary(projectId, daysBack ? Number(daysBack) : 7);

      res.json(summary);
    } catch (error) {
      console.error("Error getting GSC summary:", error);
      res.status(500).json({ error: "Failed to get GSC summary" });
    }
  });

  // Get GSC query stats
  app.get("/api/gsc/queries", async (req, res) => {
    try {
      const { projectId, startDate, endDate, query, page, limit } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const stats = await storage.getGscQueryStats(projectId, {
        startDate: startDate as string,
        endDate: endDate as string,
        query: query as string,
        page: page as string,
        limit: limit ? Number(limit) : undefined,
      });

      res.json({ stats });
    } catch (error) {
      console.error("Error getting GSC queries:", error);
      res.status(500).json({ error: "Failed to get GSC queries" });
    }
  });

  // Inspect a URL
  app.post("/api/gsc/inspect", async (req, res) => {
    try {
      const { projectId, url } = req.body;
      
      if (!projectId || !url) {
        return res.status(400).json({ error: "projectId and url are required" });
      }

      const { inspectAndSaveUrl } = await import("./services/gsc-service");
      const result = await inspectAndSaveUrl(projectId, url);

      if (!result) {
        return res.status(500).json({ error: "Failed to inspect URL" });
      }

      res.json({ success: true, inspection: result });
    } catch (error) {
      console.error("Error inspecting URL:", error);
      res.status(500).json({ error: "Failed to inspect URL" });
    }
  });

  // Get URL inspection results
  app.get("/api/gsc/inspections", async (req, res) => {
    try {
      const { projectId, url } = req.query;
      
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "projectId is required" });
      }

      const inspections = await storage.getGscUrlInspection(projectId, url as string);
      res.json({ inspections });
    } catch (error) {
      console.error("Error getting URL inspections:", error);
      res.status(500).json({ error: "Failed to get URL inspections" });
    }
  });

  // ============================================
  // TASK EXECUTION LOGS
  // ============================================

  // Get task execution logs with filtering
  app.get("/api/task-logs", async (req, res) => {
    try {
      const { projectId, taskId, category, level, limit, offset, startDate, endDate } = req.query;
      
      const logs = await storage.getTaskLogs({
        projectId: projectId as string | undefined,
        taskId: taskId as string | undefined,
        category: category as string | undefined,
        level: level as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 100,
        offset: offset ? parseInt(offset as string, 10) : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      res.json({ logs });
    } catch (error) {
      console.error("Error getting task logs:", error);
      res.status(500).json({ error: "Failed to get task logs" });
    }
  });

  // Get task logs summary/stats
  app.get("/api/task-logs/summary", async (req, res) => {
    try {
      const { projectId, startDate, endDate } = req.query;
      
      const summary = await storage.getTaskLogsSummary({
        projectId: projectId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      res.json({ summary });
    } catch (error) {
      console.error("Error getting task logs summary:", error);
      res.status(500).json({ error: "Failed to get task logs summary" });
    }
  });

  // Get logs for a specific task ID
  app.get("/api/task-logs/task/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const logs = await storage.getTaskLogsByTaskId(taskId);
      res.json({ logs });
    } catch (error) {
      console.error("Error getting task logs by ID:", error);
      res.status(500).json({ error: "Failed to get task logs" });
    }
  });

  // Get single log entry
  app.get("/api/task-logs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const log = await storage.getTaskLog(id);
      
      if (!log) {
        return res.status(404).json({ error: "Log not found" });
      }
      
      res.json({ log });
    } catch (error) {
      console.error("Error getting task log:", error);
      res.status(500).json({ error: "Failed to get task log" });
    }
  });

  // Delete old logs (cleanup endpoint)
  app.delete("/api/task-logs/cleanup", async (req, res) => {
    try {
      const { olderThanDays } = req.query;
      const days = olderThanDays ? parseInt(olderThanDays as string, 10) : 30;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const deletedCount = await storage.deleteOldTaskLogs(cutoffDate);
      res.json({ success: true, deletedCount, cutoffDate: cutoffDate.toISOString() });
    } catch (error) {
      console.error("Error cleaning up task logs:", error);
      res.status(500).json({ error: "Failed to cleanup task logs" });
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
