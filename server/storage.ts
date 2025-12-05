import {
  type User,
  type InsertUser,
  type Project,
  type InsertProject,
  type Keyword,
  type InsertKeyword,
  type SeoHealthSnapshot,
  type InsertSeoHealthSnapshot,
  type KeywordMetrics,
  type InsertKeywordMetrics,
  type PageMetrics,
  type InsertPageMetrics,
  type SeoRecommendation,
  type InsertSeoRecommendation,
  type CompetitorMetrics,
  type InsertCompetitorMetrics,
  type KeywordCompetitorMetrics,
  type InsertKeywordCompetitorMetrics,
  type Location,
  type SettingsPriorityRules,
  type CrawlSchedule,
  type InsertCrawlSchedule,
  type CrawlResult,
  type InsertCrawlResult,
  type RankingsHistory,
  type InsertRankingsHistory,
  type SettingsQuickWins,
  type InsertSettingsQuickWins,
  type SettingsFallingStars,
  type InsertSettingsFallingStars,
  type ImportLog,
  type InsertImportLog,
  type Backlink,
  type InsertBacklink,
  type CompetitorBacklink,
  type InsertCompetitorBacklink,
  type TechCrawl,
  type InsertTechCrawl,
  type PageAudit,
  type InsertPageAudit,
  type PageIssue,
  type InsertPageIssue,
  type GlobalSetting,
  type InsertGlobalSetting,
  users,
  projects,
  keywords,
  seoHealthSnapshots,
  keywordMetrics,
  pageMetrics,
  seoRecommendations,
  competitorMetrics,
  keywordCompetitorMetrics,
  locations,
  settingsPriorityRules,
  crawlSchedules,
  crawlResults,
  rankingsHistory,
  settingsQuickWins,
  settingsFallingStars,
  importLogs,
  backlinks,
  competitorBacklinks,
  techCrawls,
  pageAudits,
  pageIssues,
  globalSettings,
  crawlTypeDurations,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, isNull, or } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  getKeywords(projectId: string): Promise<Keyword[]>;
  getKeyword(id: number): Promise<Keyword | undefined>;
  createKeyword(keyword: InsertKeyword): Promise<Keyword>;
  updateKeyword(id: number, updates: Partial<InsertKeyword>): Promise<Keyword | undefined>;
  deleteKeyword(id: number): Promise<void>;

  getSeoHealthSnapshots(projectId: string, limit?: number): Promise<SeoHealthSnapshot[]>;
  getLatestSeoHealthSnapshot(projectId: string): Promise<SeoHealthSnapshot | undefined>;
  createSeoHealthSnapshot(snapshot: InsertSeoHealthSnapshot): Promise<SeoHealthSnapshot>;

  getKeywordMetrics(keywordId: number, limit?: number): Promise<KeywordMetrics[]>;
  getLatestKeywordMetrics(projectId: string): Promise<any[]>;
  createKeywordMetrics(metrics: InsertKeywordMetrics): Promise<KeywordMetrics>;

  getPageMetrics(projectId: string, limit?: number): Promise<PageMetrics[]>;
  getLatestPageMetrics(projectId: string): Promise<PageMetrics[]>;
  getPageMetricsWithKeywordAnalytics(projectId: string): Promise<any[]>;
  createPageMetrics(metrics: InsertPageMetrics): Promise<PageMetrics>;
  updatePageMetrics(id: number, updates: Partial<InsertPageMetrics>): Promise<PageMetrics | undefined>;
  deletePageMetrics(id: number): Promise<void>;
  getPageMetricsById(id: number): Promise<PageMetrics | undefined>;

  getSeoRecommendations(projectId: string, filters?: { status?: string; type?: string; severity?: string }): Promise<SeoRecommendation[]>;
  getSeoRecommendation(id: number): Promise<SeoRecommendation | undefined>;
  createSeoRecommendation(recommendation: InsertSeoRecommendation): Promise<SeoRecommendation>;
  updateSeoRecommendationStatus(id: number, status: string): Promise<SeoRecommendation | undefined>;

  getCompetitorMetrics(projectId: string): Promise<CompetitorMetrics[]>;
  createCompetitorMetrics(metrics: InsertCompetitorMetrics): Promise<CompetitorMetrics>;

  getLocations(): Promise<Location[]>;
  getPriorityRules(): Promise<SettingsPriorityRules[]>;

  getCrawlSchedules(projectId: string): Promise<CrawlSchedule[]>;
  getCrawlSchedule(id: number): Promise<CrawlSchedule | undefined>;
  createCrawlSchedule(schedule: InsertCrawlSchedule): Promise<CrawlSchedule>;
  updateCrawlSchedule(id: number, schedule: Partial<InsertCrawlSchedule>): Promise<CrawlSchedule | undefined>;
  deleteCrawlSchedule(id: number): Promise<void>;

  getRankingsHistory(keywordId: number, limit?: number): Promise<RankingsHistory[]>;
  getRankingsHistoryForDate(keywordId: number, date: string): Promise<RankingsHistory | undefined>;
  createRankingsHistory(history: InsertRankingsHistory): Promise<RankingsHistory>;
  upsertRankingsHistory(keywordId: number, date: string, data: Omit<InsertRankingsHistory, "keywordId" | "date">): Promise<RankingsHistory>;

  getQuickWins(projectId: string, filters?: { location?: string; cluster?: string; intent?: string }): Promise<any[]>;
  getFallingStars(projectId: string, filters?: { location?: string }): Promise<any[]>;

  getKeywordCompetitorMetrics(keywordId: number): Promise<KeywordCompetitorMetrics[]>;
  getKeywordCompetitorMetricsForProject(projectId: string): Promise<KeywordCompetitorMetrics[]>;
  upsertKeywordCompetitorMetrics(data: InsertKeywordCompetitorMetrics): Promise<KeywordCompetitorMetrics>;
  deleteCompetitorByDomain(projectId: string, competitorDomain: string): Promise<number>;
  
  getAggregatedCompetitors(projectId: string): Promise<{
    competitorDomain: string;
    sharedKeywords: number;
    keywordsAboveUs: number;
    avgCompetitorPosition: number;
    avgOurPosition: number;
    avgGap: number;
    totalVolume: number;
    pressureIndex: number;
  }[]>;
  getCompetitorKeywordDetails(projectId: string, competitorDomain: string): Promise<{
    keywordId: number;
    keyword: string;
    searchVolume: number;
    competitorPosition: number;
    ourPosition: number | null;
    gap: number;
    serpFeatures: string[];
    competitorUrl: string;
    targetUrl: string;
    cluster: string;
  }[]>;
  
  getActiveCrawlSchedules(): Promise<CrawlSchedule[]>;
  updateCrawlScheduleLastRun(id: number, status: string): Promise<void>;
  
  getSettingsQuickWins(projectId: string): Promise<SettingsQuickWins | undefined>;
  upsertSettingsQuickWins(projectId: string, settings: Partial<InsertSettingsQuickWins>): Promise<SettingsQuickWins>;
  getSettingsFallingStars(projectId: string): Promise<SettingsFallingStars | undefined>;
  upsertSettingsFallingStars(projectId: string, settings: Partial<InsertSettingsFallingStars>): Promise<SettingsFallingStars>;
  
  updateSeoRecommendation(id: number, updates: Partial<SeoRecommendation>): Promise<SeoRecommendation | undefined>;
  
  getRankingsHistoryByProject(projectId: string, startDate?: string, endDate?: string): Promise<RankingsHistory[]>;
  
  getImportLogs(projectId?: string, limit?: number): Promise<ImportLog[]>;
  createImportLog(log: InsertImportLog): Promise<ImportLog>;
  
  getCrawlResults(projectId: string, limit?: number): Promise<CrawlResult[]>;
  getCrawlResult(id: number): Promise<CrawlResult | undefined>;
  createCrawlResult(result: InsertCrawlResult): Promise<CrawlResult>;
  updateCrawlResult(id: number, updates: Partial<CrawlResult>): Promise<CrawlResult | undefined>;
  getRunningCrawls(projectId: string): Promise<CrawlResult[]>;
  
  getBacklinks(projectId: string, targetUrl?: string): Promise<Backlink[]>;
  getBacklink(id: number): Promise<Backlink | undefined>;
  createBacklink(backlink: InsertBacklink): Promise<Backlink>;
  upsertBacklink(projectId: string, sourceUrl: string, targetUrl: string, data: Partial<InsertBacklink>): Promise<Backlink>;
  updateBacklink(id: number, updates: Partial<InsertBacklink>): Promise<Backlink | undefined>;
  deleteBacklink(id: number): Promise<void>;
  markBacklinkLost(id: number): Promise<Backlink | undefined>;
  getBacklinkAggregations(projectId: string, targetUrl?: string, days?: number): Promise<{
    totalBacklinks: number;
    liveBacklinks: number;
    lostBacklinks: number;
    newBacklinks: number;
    referringDomains: number;
    topAnchors: { anchor: string; count: number }[];
    linkTypeBreakdown: { type: string; count: number }[];
    spamDistribution: { safe: number; review: number; toxic: number; unknown: number };
  }>;
  getBacklinksByDomain(projectId: string, targetUrl?: string): Promise<{
    domain: string;
    backlinks: number;
    liveLinks: number;
    firstSeen: Date;
    lastSeen: Date;
    avgDomainAuthority: number | null;
  }[]>;
  
  // Technical SEO Suite - Tech Crawls
  getTechCrawls(projectId: string, limit?: number): Promise<TechCrawl[]>;
  getTechCrawl(id: number): Promise<TechCrawl | undefined>;
  getLatestTechCrawl(projectId: string): Promise<TechCrawl | undefined>;
  createTechCrawl(crawl: InsertTechCrawl): Promise<TechCrawl>;
  updateTechCrawl(id: number, updates: Partial<InsertTechCrawl>): Promise<TechCrawl | undefined>;
  getRunningTechCrawls(projectId?: string): Promise<TechCrawl[]>;
  
  // Technical SEO Suite - Page Audits
  getPageAudits(projectId: string, options?: { 
    techCrawlId?: number; 
    limit?: number; 
    offset?: number;
    minScore?: number;
    maxScore?: number;
    hasIssues?: boolean;
  }): Promise<PageAudit[]>;
  getPageAudit(id: number): Promise<PageAudit | undefined>;
  getPageAuditByUrl(projectId: string, url: string, techCrawlId?: number): Promise<PageAudit | undefined>;
  createPageAudit(audit: InsertPageAudit): Promise<PageAudit>;
  createPageAudits(audits: InsertPageAudit[]): Promise<PageAudit[]>;
  deletePageAuditsByTechCrawl(techCrawlId: number): Promise<void>;
  getPageAuditsSummary(projectId: string, techCrawlId?: number): Promise<{
    totalPages: number;
    avgOnpageScore: number;
    indexablePages: number;
    nonIndexablePages: number;
    pagesWithIssues: number;
    issuesBySeverity: { critical: number; warning: number; info: number };
    issuesByCategory: Record<string, number>;
  }>;
  
  // Technical SEO Suite - Page Issues
  getPageIssues(pageAuditId: number): Promise<PageIssue[]>;
  getPageIssuesByProject(projectId: string, options?: {
    techCrawlId?: number;
    severity?: string;
    category?: string;
    limit?: number;
  }): Promise<PageIssue[]>;
  createPageIssue(issue: InsertPageIssue): Promise<PageIssue>;
  createPageIssues(issues: InsertPageIssue[]): Promise<PageIssue[]>;
  deletePageIssuesByAudit(pageAuditId: number): Promise<void>;
  getIssuesSummary(projectId: string, techCrawlId?: number): Promise<{
    issueCode: string;
    issueLabel: string;
    severity: string;
    category: string;
    count: number;
    affectedPages: number;
  }[]>;
  
  // Get latest page audit scores indexed by normalized URL for integration with Pages table
  getLatestPageAuditsByUrl(projectId: string): Promise<Map<string, { onpageScore: number | null; issueCount: number }>>;
  
  // Global Settings
  getGlobalSetting(key: string): Promise<GlobalSetting | undefined>;
  setGlobalSetting(key: string, value: string, description?: string): Promise<GlobalSetting>;
  getAllGlobalSettings(): Promise<GlobalSetting[]>;
  
  // Enhanced Crawl Management
  getRunningCrawlsByType(projectId: string, type: string): Promise<CrawlResult[]>;
  getAllRunningCrawls(): Promise<CrawlResult[]>;
  updateCrawlProgress(id: number, itemsProcessed: number, stage?: string): Promise<CrawlResult | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getKeywords(projectId: string): Promise<Keyword[]> {
    return await db.select().from(keywords).where(eq(keywords.projectId, projectId));
  }

  async getKeyword(id: number): Promise<Keyword | undefined> {
    const [keyword] = await db.select().from(keywords).where(eq(keywords.id, id));
    return keyword || undefined;
  }

  async createKeyword(insertKeyword: InsertKeyword): Promise<Keyword> {
    const [keyword] = await db.insert(keywords).values(insertKeyword).returning();
    return keyword;
  }

  async updateKeyword(id: number, updates: Partial<InsertKeyword>): Promise<Keyword | undefined> {
    const [keyword] = await db.update(keywords).set(updates).where(eq(keywords.id, id)).returning();
    return keyword || undefined;
  }

  async deleteKeyword(id: number): Promise<void> {
    await db.delete(keywords).where(eq(keywords.id, id));
  }

  async getSeoHealthSnapshots(projectId: string, limit: number = 30): Promise<SeoHealthSnapshot[]> {
    return await db
      .select()
      .from(seoHealthSnapshots)
      .where(eq(seoHealthSnapshots.projectId, projectId))
      .orderBy(desc(seoHealthSnapshots.date))
      .limit(limit);
  }

  async getLatestSeoHealthSnapshot(projectId: string): Promise<SeoHealthSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(seoHealthSnapshots)
      .where(eq(seoHealthSnapshots.projectId, projectId))
      .orderBy(desc(seoHealthSnapshots.date))
      .limit(1);
    return snapshot || undefined;
  }

  async createSeoHealthSnapshot(insertSnapshot: InsertSeoHealthSnapshot): Promise<SeoHealthSnapshot> {
    const [snapshot] = await db.insert(seoHealthSnapshots).values(insertSnapshot).returning();
    return snapshot;
  }

  async getKeywordMetrics(keywordId: number, limit: number = 30): Promise<KeywordMetrics[]> {
    return await db
      .select()
      .from(keywordMetrics)
      .where(eq(keywordMetrics.keywordId, keywordId))
      .orderBy(desc(keywordMetrics.date))
      .limit(limit);
  }

  async getLatestKeywordMetrics(projectId: string): Promise<any[]> {
    const projectKeywords = await this.getKeywords(projectId);
    if (projectKeywords.length === 0) return [];

    // Get all locations for this project's keywords
    const allLocations = await db.select().from(locations);
    const locationMap = new Map<string, string>();
    for (const loc of allLocations) {
      locationMap.set(loc.id, loc.name);
    }

    // Get latest rankings for each keyword from rankings_history
    const allKeywordsWithRankings = await db
      .select({
        keyword: keywords,
        ranking: rankingsHistory,
      })
      .from(keywords)
      .leftJoin(rankingsHistory, eq(rankingsHistory.keywordId, keywords.id))
      .where(eq(keywords.projectId, projectId))
      .orderBy(desc(rankingsHistory.date));

    // Build a map: keywordId -> latest ranking
    const rankingMap = new Map<number, typeof rankingsHistory.$inferSelect>();
    for (const row of allKeywordsWithRankings) {
      if (row.ranking && !rankingMap.has(row.keyword.id)) {
        rankingMap.set(row.keyword.id, row.ranking);
      }
    }

    // Get previous day rankings for position delta calculation
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const previousRankings = await db
      .select()
      .from(rankingsHistory)
      .where(
        and(
          eq(rankingsHistory.projectId, projectId),
          eq(rankingsHistory.date, yesterday)
        )
      );
    const previousRankingMap = new Map<number, number>();
    for (const r of previousRankings) {
      previousRankingMap.set(r.keywordId, r.position || 0);
    }

    // Build results with data from keywords table and rankings_history
    const results: any[] = [];
    for (const kw of projectKeywords) {
      const latestRanking = rankingMap.get(kw.id);
      const previousPosition = previousRankingMap.get(kw.id) || 0;
      const currentPosition = latestRanking?.position || 0;
      const positionDelta = previousPosition > 0 && currentPosition > 0 
        ? previousPosition - currentPosition 
        : 0;

      // Calculate opportunity score based on position, volume, and difficulty
      let opportunityScore = 0;
      if (kw.searchVolume && kw.difficulty !== undefined) {
        const volume = kw.searchVolume || 0;
        const difficulty = Number(kw.difficulty) || 0;
        const position = currentPosition || 100;
        
        // Higher volume = higher opportunity
        const volumeScore = Math.min(50, volume / 100);
        // Lower difficulty = higher opportunity  
        const difficultyScore = Math.max(0, 50 - difficulty);
        // Better position = higher opportunity (positions 6-20 are "quick wins")
        const positionScore = position > 0 && position <= 20 ? (21 - position) * 2 : 10;
        
        opportunityScore = Math.round((volumeScore + difficultyScore + positionScore) / 3);
      }

      results.push({
        keywordId: kw.id,
        keyword: kw.keyword,
        cluster: kw.cluster,
        url: kw.targetUrl || "",
        currentPosition: currentPosition,
        positionDelta: positionDelta,
        searchVolume: kw.searchVolume || 0,
        difficulty: kw.difficulty || 0,
        intent: kw.intentHint || "informational",
        serpFeatures: latestRanking?.serpFeatures || [],
        opportunityScore: opportunityScore,
        priority: kw.priority || "P3",
        locationId: kw.locationId,
        location: kw.locationId ? locationMap.get(kw.locationId) || "Unknown" : "Global",
      });
    }

    return results;
  }

  async createKeywordMetrics(insertMetrics: InsertKeywordMetrics): Promise<KeywordMetrics> {
    const dataToInsert = {
      ...insertMetrics,
      serpFeatures: insertMetrics.serpFeatures ? [...insertMetrics.serpFeatures] : null,
    };
    const result = await db.insert(keywordMetrics).values([dataToInsert]).returning();
    return result[0];
  }

  async getPageMetrics(projectId: string, limit: number = 100): Promise<PageMetrics[]> {
    return await db
      .select()
      .from(pageMetrics)
      .where(eq(pageMetrics.projectId, projectId))
      .orderBy(desc(pageMetrics.date))
      .limit(limit);
  }

  async getLatestPageMetrics(projectId: string): Promise<PageMetrics[]> {
    const allMetrics = await db
      .select()
      .from(pageMetrics)
      .where(eq(pageMetrics.projectId, projectId))
      .orderBy(desc(pageMetrics.date));

    const urlMap = new Map<string, PageMetrics>();
    for (const metric of allMetrics) {
      if (!urlMap.has(metric.url)) {
        urlMap.set(metric.url, metric);
      }
    }

    return Array.from(urlMap.values());
  }

  async getPageMetricsWithKeywordAnalytics(projectId: string): Promise<any[]> {
    const pages = await this.getLatestPageMetrics(projectId);
    const allKeywords = await this.getKeywords(projectId);
    
    const allRankings = await db
      .select()
      .from(rankingsHistory)
      .where(eq(rankingsHistory.projectId, projectId))
      .orderBy(desc(rankingsHistory.date));
    
    const rankingsByKeywordId = new Map<number, RankingsHistory>();
    for (const r of allRankings) {
      if (!rankingsByKeywordId.has(r.keywordId)) {
        rankingsByKeywordId.set(r.keywordId, r);
      }
    }
    
    const normalizeUrl = (url: string) => url.toLowerCase().replace(/\/+$/, '');
    
    const keywordsByUrl = new Map<string, Array<{ keyword: Keyword; position: number }>>();
    for (const kw of allKeywords) {
      if (kw.targetUrl) {
        const url = normalizeUrl(kw.targetUrl);
        if (!keywordsByUrl.has(url)) {
          keywordsByUrl.set(url, []);
        }
        const ranking = rankingsByKeywordId.get(kw.id);
        const position = ranking?.position || 0;
        keywordsByUrl.get(url)!.push({ keyword: kw, position });
      }
    }
    
    return pages.map(page => {
      const pageUrl = normalizeUrl(page.url);
      const pageKeywords = keywordsByUrl.get(pageUrl) || [];
      const rankedKeywords = pageKeywords.filter(k => k.position > 0);
      
      const avgPosition = rankedKeywords.length > 0
        ? rankedKeywords.reduce((sum, k) => sum + k.position, 0) / rankedKeywords.length
        : 0;
      const bestPosition = rankedKeywords.length > 0
        ? Math.min(...rankedKeywords.map(k => k.position))
        : 0;
      const keywordsInTop10 = rankedKeywords.filter(k => k.position <= 10).length;
      const keywordsInTop3 = rankedKeywords.filter(k => k.position <= 3).length;
      const totalKeywords = pageKeywords.length;
      
      return {
        ...page,
        avgPosition: Math.round(avgPosition * 10) / 10,
        bestPosition,
        keywordsInTop10,
        keywordsInTop3,
        totalKeywords,
        rankedKeywords: rankedKeywords.length,
      };
    });
  }

  async createPageMetrics(insertMetrics: InsertPageMetrics): Promise<PageMetrics> {
    const [metrics] = await db.insert(pageMetrics).values(insertMetrics).returning();
    return metrics;
  }

  async updatePageMetrics(id: number, updates: Partial<InsertPageMetrics>): Promise<PageMetrics | undefined> {
    const [updated] = await db
      .update(pageMetrics)
      .set(updates)
      .where(eq(pageMetrics.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePageMetrics(id: number): Promise<void> {
    await db.delete(pageMetrics).where(eq(pageMetrics.id, id));
  }

  async getPageMetricsById(id: number): Promise<PageMetrics | undefined> {
    const [page] = await db
      .select()
      .from(pageMetrics)
      .where(eq(pageMetrics.id, id));
    return page || undefined;
  }

  async getSeoRecommendations(
    projectId: string,
    filters?: { status?: string; type?: string; severity?: string }
  ): Promise<SeoRecommendation[]> {
    let query = db
      .select()
      .from(seoRecommendations)
      .where(eq(seoRecommendations.projectId, projectId))
      .orderBy(desc(seoRecommendations.createdAt));

    const results = await query;

    let filtered = results;
    if (filters?.status) {
      filtered = filtered.filter((r) => r.status === filters.status);
    }
    if (filters?.type) {
      filtered = filtered.filter((r) => r.type === filters.type);
    }
    if (filters?.severity) {
      filtered = filtered.filter((r) => r.severity === filters.severity);
    }

    return filtered;
  }

  async getSeoRecommendation(id: number): Promise<SeoRecommendation | undefined> {
    const [rec] = await db
      .select()
      .from(seoRecommendations)
      .where(eq(seoRecommendations.id, id));
    return rec || undefined;
  }

  async createSeoRecommendation(insertRec: InsertSeoRecommendation): Promise<SeoRecommendation> {
    const [rec] = await db.insert(seoRecommendations).values(insertRec).returning();
    return rec;
  }

  async updateSeoRecommendationStatus(id: number, status: string): Promise<SeoRecommendation | undefined> {
    const [rec] = await db
      .update(seoRecommendations)
      .set({ status, updatedAt: new Date() })
      .where(eq(seoRecommendations.id, id))
      .returning();
    return rec || undefined;
  }

  async getCompetitorMetrics(projectId: string): Promise<CompetitorMetrics[]> {
    // First try to get from competitor_metrics table
    const allMetrics = await db
      .select()
      .from(competitorMetrics)
      .where(eq(competitorMetrics.projectId, projectId))
      .orderBy(desc(competitorMetrics.date));

    if (allMetrics.length > 0) {
      const domainMap = new Map<string, CompetitorMetrics>();
      for (const metric of allMetrics) {
        if (!domainMap.has(metric.competitorDomain)) {
          domainMap.set(metric.competitorDomain, metric);
        }
      }
      return Array.from(domainMap.values());
    }

    // Fallback: Aggregate from keyword_competitor_metrics
    const keywordCompetitors = await db
      .select()
      .from(keywordCompetitorMetrics)
      .where(eq(keywordCompetitorMetrics.projectId, projectId));

    if (keywordCompetitors.length === 0) return [];

    // Aggregate by domain
    const domainStats = new Map<string, {
      sharedKeywords: number;
      totalPosition: number;
      minPosition: number;
    }>();

    for (const kc of keywordCompetitors) {
      const domain = kc.competitorDomain;
      const existing = domainStats.get(domain) || {
        sharedKeywords: 0,
        totalPosition: 0,
        minPosition: 100,
      };
      existing.sharedKeywords += 1;
      existing.totalPosition += kc.latestPosition || 0;
      existing.minPosition = Math.min(existing.minPosition, kc.latestPosition || 100);
      domainStats.set(domain, existing);
    }

    // Get our rankings to calculate "above us" count
    const ourRankings = await db
      .select()
      .from(rankingsHistory)
      .where(eq(rankingsHistory.projectId, projectId));
    
    const ourPositionMap = new Map<number, number>();
    for (const r of ourRankings) {
      if (!ourPositionMap.has(r.keywordId) || (ourPositionMap.get(r.keywordId)! > (r.position || 100))) {
        ourPositionMap.set(r.keywordId, r.position || 100);
      }
    }

    // Calculate above us for each competitor
    const domainAboveUs = new Map<string, number>();
    for (const kc of keywordCompetitors) {
      const ourPosition = ourPositionMap.get(kc.keywordId) || 100;
      const theirPosition = kc.latestPosition || 100;
      if (theirPosition < ourPosition) {
        const domain = kc.competitorDomain;
        domainAboveUs.set(domain, (domainAboveUs.get(domain) || 0) + 1);
      }
    }

    // Convert to CompetitorMetrics format
    const result: CompetitorMetrics[] = [];
    const today = new Date().toISOString().split('T')[0];
    let idCounter = 1;

    for (const [domain, stats] of Array.from(domainStats.entries())) {
      const avgPosition = stats.sharedKeywords > 0 
        ? stats.totalPosition / stats.sharedKeywords 
        : 0;
      const aboveUs = domainAboveUs.get(domain) || 0;
      const pressureIndex = Math.round((aboveUs / Math.max(stats.sharedKeywords, 1)) * 100);

      result.push({
        id: idCounter++,
        projectId: projectId,
        competitorDomain: domain,
        date: today,
        avgPosition: String(avgPosition.toFixed(1)),
        sharedKeywords: stats.sharedKeywords,
        aboveUsKeywords: aboveUs,
        authorityScore: null,
        pressureIndex: String(pressureIndex),
        createdAt: new Date(),
      });
    }

    // Sort by shared keywords descending
    result.sort((a, b) => (b.sharedKeywords || 0) - (a.sharedKeywords || 0));

    return result.slice(0, 20); // Return top 20
  }

  async createCompetitorMetrics(insertMetrics: InsertCompetitorMetrics): Promise<CompetitorMetrics> {
    const [metrics] = await db.insert(competitorMetrics).values(insertMetrics).returning();
    return metrics;
  }

  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations).orderBy(locations.name);
  }

  async getPriorityRules(): Promise<SettingsPriorityRules[]> {
    return await db.select().from(settingsPriorityRules).orderBy(settingsPriorityRules.priority);
  }

  async getCrawlSchedules(projectId: string): Promise<CrawlSchedule[]> {
    return await db.select().from(crawlSchedules).where(eq(crawlSchedules.projectId, projectId)).orderBy(crawlSchedules.url);
  }

  async getCrawlSchedule(id: number): Promise<CrawlSchedule | undefined> {
    const [schedule] = await db.select().from(crawlSchedules).where(eq(crawlSchedules.id, id));
    return schedule || undefined;
  }

  async createCrawlSchedule(insertSchedule: InsertCrawlSchedule): Promise<CrawlSchedule> {
    const data = { ...insertSchedule, daysOfWeek: Array.from(insertSchedule.daysOfWeek) as number[] };
    const [schedule] = await db.insert(crawlSchedules).values([data]).returning();
    return schedule;
  }

  async updateCrawlSchedule(id: number, insertSchedule: Partial<InsertCrawlSchedule>): Promise<CrawlSchedule | undefined> {
    const updateData: any = { updatedAt: new Date() };
    if (insertSchedule.url !== undefined) updateData.url = insertSchedule.url;
    if (insertSchedule.scheduledTime !== undefined) updateData.scheduledTime = insertSchedule.scheduledTime;
    if (insertSchedule.daysOfWeek !== undefined) updateData.daysOfWeek = Array.from(insertSchedule.daysOfWeek) as number[];
    if (insertSchedule.isActive !== undefined) updateData.isActive = insertSchedule.isActive;
    const [schedule] = await db.update(crawlSchedules).set(updateData).where(eq(crawlSchedules.id, id)).returning();
    return schedule || undefined;
  }

  async deleteCrawlSchedule(id: number): Promise<void> {
    await db.delete(crawlSchedules).where(eq(crawlSchedules.id, id));
  }

  async getRankingsHistory(keywordId: number, limit: number = 100): Promise<RankingsHistory[]> {
    return await db
      .select()
      .from(rankingsHistory)
      .where(eq(rankingsHistory.keywordId, keywordId))
      .orderBy(desc(rankingsHistory.date))
      .limit(limit);
  }

  async getRankingsHistoryForDate(keywordId: number, date: string): Promise<RankingsHistory | undefined> {
    const [history] = await db
      .select()
      .from(rankingsHistory)
      .where(and(eq(rankingsHistory.keywordId, keywordId), eq(rankingsHistory.date, date)));
    return history || undefined;
  }

  async createRankingsHistory(insertHistory: InsertRankingsHistory): Promise<RankingsHistory> {
    const values = {
      projectId: insertHistory.projectId,
      keywordId: insertHistory.keywordId,
      date: insertHistory.date,
      position: insertHistory.position,
      url: insertHistory.url,
      device: insertHistory.device,
      locationId: insertHistory.locationId,
      serpFeatures: insertHistory.serpFeatures as string[] | null | undefined,
    };
    const [history] = await db.insert(rankingsHistory).values(values).returning();
    return history;
  }

  async upsertRankingsHistory(
    keywordId: number,
    date: string,
    data: Omit<InsertRankingsHistory, "keywordId" | "date">
  ): Promise<RankingsHistory> {
    const existing = await this.getRankingsHistoryForDate(keywordId, date);
    if (existing) {
      const updateData: Record<string, unknown> = {
        projectId: data.projectId,
        position: data.position,
        url: data.url,
        device: data.device,
        locationId: data.locationId,
      };
      if (data.serpFeatures !== undefined) {
        updateData.serpFeatures = data.serpFeatures;
      }
      const [updated] = await db
        .update(rankingsHistory)
        .set(updateData)
        .where(and(eq(rankingsHistory.keywordId, keywordId), eq(rankingsHistory.date, date)))
        .returning();
      return updated;
    }
    const insertData: InsertRankingsHistory = {
      keywordId,
      date,
      projectId: data.projectId,
      position: data.position,
      url: data.url,
      device: data.device,
      locationId: data.locationId,
      serpFeatures: data.serpFeatures as string[] | undefined,
    };
    return this.createRankingsHistory(insertData);
  }

  async getQuickWins(projectId: string, filters?: { location?: string; cluster?: string; intent?: string }): Promise<any[]> {
    const allKeywordsWithMetrics = await db
      .select({
        keyword: keywords,
        metrics: keywordMetrics,
        location: locations,
      })
      .from(keywords)
      .leftJoin(keywordMetrics, eq(keywordMetrics.keywordId, keywords.id))
      .leftJoin(locations, eq(locations.id, keywords.locationId))
      .where(
        and(
          eq(keywords.projectId, projectId),
          eq(keywords.isActive, true),
          gte(keywordMetrics.position, 6),
          lte(keywordMetrics.position, 20)
        )
      )
      .orderBy(desc(keywordMetrics.opportunityScore));

    let results = allKeywordsWithMetrics.map((row) => ({
      keywordId: row.keyword.id,
      keyword: row.keyword.keyword,
      cluster: row.keyword.cluster,
      location: row.location?.name || "Global",
      currentPosition: row.metrics?.position || 0,
      searchVolume: row.metrics?.searchVolume || 0,
      difficulty: row.metrics?.difficulty ? Number(row.metrics.difficulty) : 0,
      intent: row.metrics?.intent || "informational",
      opportunityScore: row.metrics?.opportunityScore ? Number(row.metrics.opportunityScore) : 0,
      targetUrl: row.keyword.targetUrl || "",
    }));

    if (filters?.location) {
      results = results.filter((r) => r.location === filters.location);
    }
    if (filters?.cluster) {
      results = results.filter((r) => r.cluster === filters.cluster);
    }
    if (filters?.intent) {
      results = results.filter((r) => r.intent === filters.intent);
    }

    return results;
  }

  async getFallingStars(projectId: string, filters?: { location?: string }): Promise<any[]> {
    const windowDays = 7;
    const minDrop = 5;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - windowDays);
    const pastDateStr = pastDate.toISOString().split("T")[0];

    const allWithHistory = await db
      .select({
        keyword: keywords,
        currentMetrics: keywordMetrics,
        location: locations,
      })
      .from(keywords)
      .leftJoin(keywordMetrics, eq(keywordMetrics.keywordId, keywords.id))
      .leftJoin(locations, eq(locations.id, keywords.locationId))
      .where(
        and(
          eq(keywords.projectId, projectId),
          eq(keywords.isActive, true),
          lte(keywordMetrics.position, 10)
        )
      )
      .orderBy(desc(keywordMetrics.positionDelta));

    return allWithHistory
      .map((row) => ({
        keywordId: row.keyword.id,
        keyword: row.keyword.keyword,
        cluster: row.keyword.cluster,
        location: row.location?.name || "Global",
        currentPosition: row.currentMetrics?.position || 0,
        positionDelta: row.currentMetrics?.positionDelta || 0,
        searchVolume: row.currentMetrics?.searchVolume || 0,
        difficulty: row.currentMetrics?.difficulty ? Number(row.currentMetrics.difficulty) : 0,
        intent: row.currentMetrics?.intent || "informational",
        targetUrl: row.keyword.targetUrl || "",
        isCoreKeyword: row.keyword.isCorePage || false,
      }))
      .filter((r) => r.positionDelta <= -minDrop)
      .filter((f) => !filters?.location || f.location === filters.location);
  }

  async getKeywordCompetitorMetrics(keywordId: number): Promise<KeywordCompetitorMetrics[]> {
    return await db
      .select()
      .from(keywordCompetitorMetrics)
      .where(eq(keywordCompetitorMetrics.keywordId, keywordId))
      .orderBy(desc(keywordCompetitorMetrics.latestPosition));
  }

  async getKeywordCompetitorMetricsForProject(projectId: string): Promise<KeywordCompetitorMetrics[]> {
    return await db
      .select()
      .from(keywordCompetitorMetrics)
      .where(eq(keywordCompetitorMetrics.projectId, projectId))
      .orderBy(desc(keywordCompetitorMetrics.updatedAt));
  }

  async upsertKeywordCompetitorMetrics(data: InsertKeywordCompetitorMetrics): Promise<KeywordCompetitorMetrics> {
    const existing = await db
      .select()
      .from(keywordCompetitorMetrics)
      .where(
        and(
          eq(keywordCompetitorMetrics.keywordId, data.keywordId),
          eq(keywordCompetitorMetrics.competitorDomain, data.competitorDomain)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      const updateData: Record<string, unknown> = {
        latestPosition: data.latestPosition,
        ourPosition: data.ourPosition,
        avgPosition: data.avgPosition,
        visibilityScore: data.visibilityScore,
        isDirectCompetitor: data.isDirectCompetitor,
        clickShareEstimate: data.clickShareEstimate,
        competitorUrl: data.competitorUrl,
        lastSeenAt: data.lastSeenAt,
        updatedAt: new Date(),
      };
      if (data.serpFeatures !== undefined) {
        updateData.serpFeatures = data.serpFeatures;
      }
      const [updated] = await db
        .update(keywordCompetitorMetrics)
        .set(updateData)
        .where(eq(keywordCompetitorMetrics.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const insertValues = {
      projectId: data.projectId,
      keywordId: data.keywordId,
      competitorDomain: data.competitorDomain,
      competitorUrl: data.competitorUrl,
      latestPosition: data.latestPosition,
      ourPosition: data.ourPosition,
      avgPosition: data.avgPosition,
      visibilityScore: data.visibilityScore,
      serpFeatures: data.serpFeatures as string[] | null | undefined,
      isDirectCompetitor: data.isDirectCompetitor,
      clickShareEstimate: data.clickShareEstimate,
      lastSeenAt: data.lastSeenAt,
    };
    const [created] = await db
      .insert(keywordCompetitorMetrics)
      .values(insertValues)
      .returning();
    return created;
  }

  async getAggregatedCompetitors(projectId: string): Promise<{
    competitorDomain: string;
    sharedKeywords: number;
    keywordsAboveUs: number;
    avgCompetitorPosition: number;
    avgOurPosition: number;
    avgGap: number;
    totalVolume: number;
    pressureIndex: number;
  }[]> {
    const competitorData = await db
      .select({
        competitorDomain: keywordCompetitorMetrics.competitorDomain,
        latestPosition: keywordCompetitorMetrics.latestPosition,
        ourPosition: keywordCompetitorMetrics.ourPosition,
        keywordId: keywordCompetitorMetrics.keywordId,
        searchVolume: keywords.searchVolume,
      })
      .from(keywordCompetitorMetrics)
      .innerJoin(keywords, eq(keywords.id, keywordCompetitorMetrics.keywordId))
      .where(eq(keywordCompetitorMetrics.projectId, projectId));

    const domainStats = new Map<string, {
      sharedKeywords: number;
      keywordsAboveUs: number;
      totalCompetitorPosition: number;
      totalOurPosition: number;
      positionsWithUs: number;
      totalGap: number;
      totalVolume: number;
      threatScore: number;
    }>();

    for (const row of competitorData) {
      const domain = row.competitorDomain;
      if (!domainStats.has(domain)) {
        domainStats.set(domain, {
          sharedKeywords: 0,
          keywordsAboveUs: 0,
          totalCompetitorPosition: 0,
          totalOurPosition: 0,
          positionsWithUs: 0,
          totalGap: 0,
          totalVolume: 0,
          threatScore: 0,
        });
      }

      const stats = domainStats.get(domain)!;
      stats.sharedKeywords++;
      stats.totalCompetitorPosition += row.latestPosition || 100;
      stats.totalVolume += row.searchVolume || 0;

      const competitorPos = row.latestPosition || 100;
      const ourPos = row.ourPosition;
      
      if (ourPos !== null) {
        stats.totalOurPosition += ourPos;
        stats.positionsWithUs++;
        stats.totalGap += (ourPos - competitorPos);
        
        if (competitorPos < ourPos) {
          stats.keywordsAboveUs++;
        }
      } else {
        stats.keywordsAboveUs++;
      }

      const volume = row.searchVolume || 0;
      if (competitorPos <= 20) {
        const positionScore = (21 - competitorPos) / 20;
        const weRank = ourPos !== null && ourPos <= 100;
        const gapFactor = weRank 
          ? Math.max(0, (ourPos! - competitorPos) / 20)
          : 1.0;
        stats.threatScore += volume * positionScore * gapFactor;
      }
    }

    const results = [];
    const entries = Array.from(domainStats.entries());
    for (const entry of entries) {
      const domain = entry[0];
      const stats = entry[1];
      const avgCompetitorPosition = stats.sharedKeywords > 0 
        ? stats.totalCompetitorPosition / stats.sharedKeywords 
        : 0;
      const avgOurPosition = stats.positionsWithUs > 0 
        ? stats.totalOurPosition / stats.positionsWithUs 
        : 100;
      const avgGap = stats.positionsWithUs > 0 
        ? stats.totalGap / stats.positionsWithUs 
        : 0;

      const normalizedThreat = stats.totalVolume > 0 
        ? (stats.threatScore / stats.totalVolume) * 100
        : 0;
      const pressureIndex = Math.min(100, Math.max(0, normalizedThreat));

      results.push({
        competitorDomain: domain,
        sharedKeywords: stats.sharedKeywords,
        keywordsAboveUs: stats.keywordsAboveUs,
        avgCompetitorPosition: Math.round(avgCompetitorPosition * 10) / 10,
        avgOurPosition: Math.round(avgOurPosition * 10) / 10,
        avgGap: Math.round(avgGap * 10) / 10,
        totalVolume: stats.totalVolume,
        pressureIndex: Math.round(pressureIndex),
      });
    }

    return results.sort((a, b) => b.sharedKeywords - a.sharedKeywords);
  }

  async getCompetitorKeywordDetails(projectId: string, competitorDomain: string): Promise<{
    keywordId: number;
    keyword: string;
    searchVolume: number;
    competitorPosition: number;
    ourPosition: number | null;
    gap: number;
    serpFeatures: string[];
    competitorUrl: string;
    targetUrl: string;
    cluster: string;
  }[]> {
    const details = await db
      .select({
        keywordId: keywordCompetitorMetrics.keywordId,
        keyword: keywords.keyword,
        searchVolume: keywords.searchVolume,
        competitorPosition: keywordCompetitorMetrics.latestPosition,
        ourPosition: keywordCompetitorMetrics.ourPosition,
        serpFeatures: keywordCompetitorMetrics.serpFeatures,
        competitorUrl: keywordCompetitorMetrics.competitorUrl,
        targetUrl: keywords.targetUrl,
        cluster: keywords.cluster,
      })
      .from(keywordCompetitorMetrics)
      .innerJoin(keywords, eq(keywords.id, keywordCompetitorMetrics.keywordId))
      .where(
        and(
          eq(keywordCompetitorMetrics.projectId, projectId),
          eq(keywordCompetitorMetrics.competitorDomain, competitorDomain)
        )
      )
      .orderBy(desc(keywords.searchVolume));

    return details.map(row => ({
      keywordId: row.keywordId,
      keyword: row.keyword,
      searchVolume: row.searchVolume || 0,
      competitorPosition: row.competitorPosition || 100,
      ourPosition: row.ourPosition,
      gap: (row.ourPosition || 100) - (row.competitorPosition || 100),
      serpFeatures: row.serpFeatures || [],
      competitorUrl: row.competitorUrl || '',
      targetUrl: row.targetUrl || '',
      cluster: row.cluster || '',
    }));
  }

  async deleteCompetitorByDomain(projectId: string, competitorDomain: string): Promise<number> {
    const result = await db
      .delete(keywordCompetitorMetrics)
      .where(
        and(
          eq(keywordCompetitorMetrics.projectId, projectId),
          eq(keywordCompetitorMetrics.competitorDomain, competitorDomain)
        )
      )
      .returning({ id: keywordCompetitorMetrics.id });
    return result.length;
  }

  async getActiveCrawlSchedules(): Promise<CrawlSchedule[]> {
    return await db
      .select()
      .from(crawlSchedules)
      .where(eq(crawlSchedules.isActive, true))
      .orderBy(crawlSchedules.scheduledTime);
  }

  async updateCrawlScheduleLastRun(id: number, status: string): Promise<void> {
    await db
      .update(crawlSchedules)
      .set({
        lastRunAt: new Date(),
        lastRunStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(crawlSchedules.id, id));
  }

  async getSettingsQuickWins(projectId: string): Promise<SettingsQuickWins | undefined> {
    const [settings] = await db
      .select()
      .from(settingsQuickWins)
      .where(eq(settingsQuickWins.projectId, projectId))
      .limit(1);
    return settings || undefined;
  }

  async upsertSettingsQuickWins(projectId: string, settings: Partial<InsertSettingsQuickWins>): Promise<SettingsQuickWins> {
    const existing = await this.getSettingsQuickWins(projectId);
    if (existing) {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (settings.minPosition !== undefined) updateData.minPosition = settings.minPosition;
      if (settings.maxPosition !== undefined) updateData.maxPosition = settings.maxPosition;
      if (settings.minVolume !== undefined) updateData.minVolume = settings.minVolume;
      if (settings.maxDifficulty !== undefined) updateData.maxDifficulty = settings.maxDifficulty;
      if (settings.minIntentScore !== undefined) updateData.minIntentScore = settings.minIntentScore;
      if (settings.minCpc !== undefined) updateData.minCpc = settings.minCpc;
      if (settings.enabled !== undefined) updateData.enabled = settings.enabled;
      if (settings.validIntents !== undefined) updateData.validIntents = settings.validIntents;
      
      const [updated] = await db
        .update(settingsQuickWins)
        .set(updateData)
        .where(eq(settingsQuickWins.id, existing.id))
        .returning();
      return updated;
    }
    const insertValues = {
      projectId,
      minPosition: settings.minPosition ?? 6,
      maxPosition: settings.maxPosition ?? 20,
      minVolume: settings.minVolume ?? 100,
      maxDifficulty: settings.maxDifficulty ?? 70,
      minIntentScore: settings.minIntentScore,
      minCpc: settings.minCpc,
      enabled: settings.enabled ?? true,
      validIntents: (settings.validIntents as string[] | undefined) ?? ["commercial", "transactional"],
    };
    const [created] = await db
      .insert(settingsQuickWins)
      .values(insertValues)
      .returning();
    return created;
  }

  async getSettingsFallingStars(projectId: string): Promise<SettingsFallingStars | undefined> {
    const [settings] = await db
      .select()
      .from(settingsFallingStars)
      .where(eq(settingsFallingStars.projectId, projectId))
      .limit(1);
    return settings || undefined;
  }

  async upsertSettingsFallingStars(projectId: string, settings: Partial<InsertSettingsFallingStars>): Promise<SettingsFallingStars> {
    const existing = await this.getSettingsFallingStars(projectId);
    if (existing) {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (settings.windowDays !== undefined) updateData.windowDays = settings.windowDays;
      if (settings.minDropPositions !== undefined) updateData.minDropPositions = settings.minDropPositions;
      if (settings.minPreviousPosition !== undefined) updateData.minPreviousPosition = settings.minPreviousPosition;
      if (settings.minVolume !== undefined) updateData.minVolume = settings.minVolume;
      if (settings.enabled !== undefined) updateData.enabled = settings.enabled;
      
      const [updated] = await db
        .update(settingsFallingStars)
        .set(updateData)
        .where(eq(settingsFallingStars.id, existing.id))
        .returning();
      return updated;
    }
    const insertValues = {
      projectId,
      windowDays: settings.windowDays ?? 7,
      minDropPositions: settings.minDropPositions ?? 5,
      minPreviousPosition: settings.minPreviousPosition ?? 10,
      minVolume: settings.minVolume ?? 0,
      enabled: settings.enabled ?? true,
    };
    const [created] = await db
      .insert(settingsFallingStars)
      .values(insertValues)
      .returning();
    return created;
  }

  async updateSeoRecommendation(id: number, updates: Partial<SeoRecommendation>): Promise<SeoRecommendation | undefined> {
    const [updated] = await db
      .update(seoRecommendations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(seoRecommendations.id, id))
      .returning();
    return updated || undefined;
  }

  async getRankingsHistoryByProject(projectId: string, startDate?: string, endDate?: string): Promise<RankingsHistory[]> {
    let conditions = [eq(rankingsHistory.projectId, projectId)];
    if (startDate) {
      conditions.push(gte(rankingsHistory.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(rankingsHistory.date, endDate));
    }
    return await db
      .select()
      .from(rankingsHistory)
      .where(and(...conditions))
      .orderBy(desc(rankingsHistory.date));
  }

  async getImportLogs(projectId?: string, limit: number = 20): Promise<ImportLog[]> {
    if (projectId) {
      return await db
        .select()
        .from(importLogs)
        .where(eq(importLogs.projectId, projectId))
        .orderBy(desc(importLogs.startedAt))
        .limit(limit);
    }
    return await db
      .select()
      .from(importLogs)
      .orderBy(desc(importLogs.startedAt))
      .limit(limit);
  }

  async createImportLog(log: InsertImportLog): Promise<ImportLog> {
    const [created] = await db.insert(importLogs).values(log as typeof importLogs.$inferInsert).returning();
    return created;
  }

  async getCrawlResults(projectId: string, limit: number = 50): Promise<CrawlResult[]> {
    return await db
      .select()
      .from(crawlResults)
      .where(eq(crawlResults.projectId, projectId))
      .orderBy(desc(crawlResults.startedAt))
      .limit(limit);
  }

  async getCrawlResult(id: number): Promise<CrawlResult | undefined> {
    const [result] = await db.select().from(crawlResults).where(eq(crawlResults.id, id));
    return result || undefined;
  }

  async createCrawlResult(result: InsertCrawlResult): Promise<CrawlResult> {
    const [created] = await db.insert(crawlResults).values(result as typeof crawlResults.$inferInsert).returning();
    return created;
  }

  async updateCrawlResult(id: number, updates: Partial<CrawlResult>): Promise<CrawlResult | undefined> {
    const [updated] = await db
      .update(crawlResults)
      .set(updates)
      .where(eq(crawlResults.id, id))
      .returning();
    return updated || undefined;
  }

  async getRunningCrawls(projectId: string): Promise<CrawlResult[]> {
    return await db
      .select()
      .from(crawlResults)
      .where(
        and(
          eq(crawlResults.projectId, projectId),
          eq(crawlResults.status, "running")
        )
      )
      .orderBy(desc(crawlResults.startedAt));
  }

  async getBacklinks(projectId: string, targetUrl?: string): Promise<Backlink[]> {
    let conditions = [eq(backlinks.projectId, projectId)];
    if (targetUrl) {
      conditions.push(eq(backlinks.targetUrl, targetUrl));
    }
    return await db
      .select()
      .from(backlinks)
      .where(and(...conditions))
      .orderBy(desc(backlinks.lastSeenAt));
  }

  async getBacklink(id: number): Promise<Backlink | undefined> {
    const [backlink] = await db.select().from(backlinks).where(eq(backlinks.id, id));
    return backlink || undefined;
  }

  async createBacklink(backlink: InsertBacklink): Promise<Backlink> {
    const [created] = await db.insert(backlinks).values(backlink as typeof backlinks.$inferInsert).returning();
    return created;
  }

  async upsertBacklink(projectId: string, sourceUrl: string, targetUrl: string, data: Partial<InsertBacklink>): Promise<Backlink> {
    const existing = await db
      .select()
      .from(backlinks)
      .where(
        and(
          eq(backlinks.projectId, projectId),
          eq(backlinks.sourceUrl, sourceUrl),
          eq(backlinks.targetUrl, targetUrl)
        )
      );
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(backlinks)
        .set({
          ...data,
          lastSeenAt: new Date(),
          isLive: true,
          lostAt: null,
          updatedAt: new Date(),
        })
        .where(eq(backlinks.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const extractDomain = (url: string): string => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return url;
      }
    };
    
    const [created] = await db
      .insert(backlinks)
      .values({
        projectId,
        sourceUrl,
        targetUrl,
        sourceDomain: data.sourceDomain || extractDomain(sourceUrl),
        anchorText: data.anchorText || null,
        linkType: data.linkType || 'dofollow',
        isLive: true,
        domainAuthority: data.domainAuthority || null,
        pageAuthority: data.pageAuthority || null,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      } as typeof backlinks.$inferInsert)
      .returning();
    return created;
  }

  async updateBacklink(id: number, updates: Partial<InsertBacklink>): Promise<Backlink | undefined> {
    const [updated] = await db
      .update(backlinks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(backlinks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBacklink(id: number): Promise<void> {
    await db.delete(backlinks).where(eq(backlinks.id, id));
  }

  async markBacklinkLost(id: number): Promise<Backlink | undefined> {
    const [updated] = await db
      .update(backlinks)
      .set({ isLive: false, lostAt: new Date(), updatedAt: new Date() })
      .where(eq(backlinks.id, id))
      .returning();
    return updated || undefined;
  }

  async getBacklinkAggregations(projectId: string, targetUrl?: string, days: number = 30): Promise<{
    totalBacklinks: number;
    liveBacklinks: number;
    lostBacklinks: number;
    newBacklinks: number;
    referringDomains: number;
    topAnchors: { anchor: string; count: number }[];
    linkTypeBreakdown: { type: string; count: number }[];
    spamDistribution: { safe: number; review: number; toxic: number; unknown: number };
  }> {
    let conditions = [eq(backlinks.projectId, projectId)];
    if (targetUrl) {
      conditions.push(eq(backlinks.targetUrl, targetUrl));
    }
    
    const allBacklinks = await db
      .select()
      .from(backlinks)
      .where(and(...conditions));
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const totalBacklinks = allBacklinks.length;
    const liveBacklinks = allBacklinks.filter(b => b.isLive).length;
    const lostBacklinks = allBacklinks.filter(b => !b.isLive).length;
    const newBacklinks = allBacklinks.filter(b => b.firstSeenAt >= cutoffDate).length;
    
    const uniqueDomains = new Set(allBacklinks.filter(b => b.isLive).map(b => b.sourceDomain));
    const referringDomains = uniqueDomains.size;
    
    const anchorCounts = new Map<string, number>();
    allBacklinks.filter(b => b.isLive && b.anchorText).forEach(b => {
      const anchor = b.anchorText || '(no anchor)';
      anchorCounts.set(anchor, (anchorCounts.get(anchor) || 0) + 1);
    });
    const topAnchors = Array.from(anchorCounts.entries())
      .map(([anchor, count]) => ({ anchor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    const typeCounts = new Map<string, number>();
    allBacklinks.filter(b => b.isLive).forEach(b => {
      typeCounts.set(b.linkType, (typeCounts.get(b.linkType) || 0) + 1);
    });
    const linkTypeBreakdown = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    
    const spamDistribution = {
      safe: allBacklinks.filter(b => b.spamScore !== null && b.spamScore <= 30).length,
      review: allBacklinks.filter(b => b.spamScore !== null && b.spamScore > 30 && b.spamScore <= 60).length,
      toxic: allBacklinks.filter(b => b.spamScore !== null && b.spamScore > 60).length,
      unknown: allBacklinks.filter(b => b.spamScore === null).length,
    };
    
    return {
      totalBacklinks,
      liveBacklinks,
      lostBacklinks,
      newBacklinks,
      referringDomains,
      topAnchors,
      linkTypeBreakdown,
      spamDistribution,
    };
  }

  async getBacklinksByDomain(projectId: string, targetUrl?: string): Promise<{
    domain: string;
    backlinks: number;
    liveLinks: number;
    firstSeen: Date;
    lastSeen: Date;
    avgDomainAuthority: number | null;
  }[]> {
    let conditions = [eq(backlinks.projectId, projectId)];
    if (targetUrl) {
      conditions.push(eq(backlinks.targetUrl, targetUrl));
    }
    
    const allBacklinks = await db
      .select()
      .from(backlinks)
      .where(and(...conditions));
    
    const domainMap = new Map<string, {
      domain: string;
      backlinks: number;
      liveLinks: number;
      firstSeen: Date;
      lastSeen: Date;
      daSum: number;
      daCount: number;
    }>();
    
    allBacklinks.forEach(b => {
      const existing = domainMap.get(b.sourceDomain);
      if (existing) {
        existing.backlinks++;
        if (b.isLive) existing.liveLinks++;
        if (b.firstSeenAt < existing.firstSeen) existing.firstSeen = b.firstSeenAt;
        if (b.lastSeenAt > existing.lastSeen) existing.lastSeen = b.lastSeenAt;
        if (b.domainAuthority) {
          existing.daSum += b.domainAuthority;
          existing.daCount++;
        }
      } else {
        domainMap.set(b.sourceDomain, {
          domain: b.sourceDomain,
          backlinks: 1,
          liveLinks: b.isLive ? 1 : 0,
          firstSeen: b.firstSeenAt,
          lastSeen: b.lastSeenAt,
          daSum: b.domainAuthority || 0,
          daCount: b.domainAuthority ? 1 : 0,
        });
      }
    });
    
    return Array.from(domainMap.values())
      .map(d => ({
        domain: d.domain,
        backlinks: d.backlinks,
        liveLinks: d.liveLinks,
        firstSeen: d.firstSeen,
        lastSeen: d.lastSeen,
        avgDomainAuthority: d.daCount > 0 ? Math.round(d.daSum / d.daCount) : null,
      }))
      .sort((a, b) => b.liveLinks - a.liveLinks);
  }

  async updateBacklinkSpamScores(projectId: string, spamScoreMap: Map<string, number>, targetUrl?: string): Promise<number> {
    let updated = 0;
    let conditions = [eq(backlinks.projectId, projectId)];
    if (targetUrl) {
      conditions.push(eq(backlinks.targetUrl, targetUrl));
    }
    
    const allBacklinks = await db
      .select()
      .from(backlinks)
      .where(and(...conditions));
    
    for (const backlink of allBacklinks) {
      const spamScore = spamScoreMap.get(backlink.sourceDomain.toLowerCase());
      if (spamScore !== undefined && backlink.spamScore !== spamScore) {
        await db
          .update(backlinks)
          .set({ spamScore, updatedAt: new Date() })
          .where(eq(backlinks.id, backlink.id));
        updated++;
      }
    }
    
    return updated;
  }

  async getCompetitorBacklinks(projectId: string, competitorDomain?: string): Promise<CompetitorBacklink[]> {
    let conditions = [eq(competitorBacklinks.projectId, projectId)];
    if (competitorDomain) {
      conditions.push(eq(competitorBacklinks.competitorDomain, competitorDomain));
    }
    return await db
      .select()
      .from(competitorBacklinks)
      .where(and(...conditions))
      .orderBy(desc(competitorBacklinks.domainAuthority));
  }

  async getCompetitorBacklink(id: number): Promise<CompetitorBacklink | undefined> {
    const [backlink] = await db.select().from(competitorBacklinks).where(eq(competitorBacklinks.id, id));
    return backlink || undefined;
  }

  async upsertCompetitorBacklink(
    projectId: string,
    competitorDomain: string,
    sourceUrl: string,
    targetUrl: string,
    data: Partial<InsertCompetitorBacklink>
  ): Promise<CompetitorBacklink> {
    const existing = await db
      .select()
      .from(competitorBacklinks)
      .where(
        and(
          eq(competitorBacklinks.projectId, projectId),
          eq(competitorBacklinks.competitorDomain, competitorDomain),
          eq(competitorBacklinks.sourceUrl, sourceUrl),
          eq(competitorBacklinks.targetUrl, targetUrl)
        )
      );
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(competitorBacklinks)
        .set({
          ...data,
          lastSeenAt: new Date(),
          isLive: true,
          lostAt: null,
          updatedAt: new Date(),
        })
        .where(eq(competitorBacklinks.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const extractDomain = (url: string): string => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return url;
      }
    };
    
    const [created] = await db
      .insert(competitorBacklinks)
      .values({
        projectId,
        competitorDomain,
        sourceUrl,
        targetUrl,
        sourceDomain: data.sourceDomain || extractDomain(sourceUrl),
        anchorText: data.anchorText || null,
        linkType: data.linkType || 'dofollow',
        isLive: true,
        domainAuthority: data.domainAuthority || null,
        pageAuthority: data.pageAuthority || null,
        spamScore: data.spamScore || null,
        isOpportunity: data.isOpportunity || false,
        opportunityScore: data.opportunityScore || null,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      } as typeof competitorBacklinks.$inferInsert)
      .returning();
    return created;
  }

  async deleteCompetitorBacklink(id: number): Promise<void> {
    await db.delete(competitorBacklinks).where(eq(competitorBacklinks.id, id));
  }

  async getCompetitorBacklinkAggregations(projectId: string, competitorDomain?: string): Promise<{
    totalBacklinks: number;
    liveBacklinks: number;
    referringDomains: number;
    dofollowCount: number;
    avgDomainAuthority: number | null;
    opportunities: number;
    topOpportunities: { sourceDomain: string; domainAuthority: number; opportunityScore: number }[];
    linkTypeBreakdown: { type: string; count: number }[];
  }> {
    let conditions = [eq(competitorBacklinks.projectId, projectId)];
    if (competitorDomain) {
      conditions.push(eq(competitorBacklinks.competitorDomain, competitorDomain));
    }
    
    const allBacklinks = await db
      .select()
      .from(competitorBacklinks)
      .where(and(...conditions));
    
    const totalBacklinks = allBacklinks.length;
    const liveBacklinks = allBacklinks.filter(b => b.isLive).length;
    const uniqueDomains = new Set(allBacklinks.filter(b => b.isLive).map(b => b.sourceDomain));
    const referringDomains = uniqueDomains.size;
    const dofollowCount = allBacklinks.filter(b => b.isLive && b.linkType === 'dofollow').length;
    
    const daValues = allBacklinks.filter(b => b.isLive && b.domainAuthority).map(b => b.domainAuthority!);
    const avgDomainAuthority = daValues.length > 0 
      ? Math.round(daValues.reduce((a, b) => a + b, 0) / daValues.length) 
      : null;
    
    const opportunities = allBacklinks.filter(b => b.isOpportunity).length;
    
    const topOpportunities = allBacklinks
      .filter(b => b.isOpportunity && b.isLive)
      .sort((a, b) => (Number(b.opportunityScore) || 0) - (Number(a.opportunityScore) || 0))
      .slice(0, 10)
      .map(b => ({
        sourceDomain: b.sourceDomain,
        domainAuthority: b.domainAuthority || 0,
        opportunityScore: Number(b.opportunityScore) || 0,
      }));
    
    const typeCounts = new Map<string, number>();
    allBacklinks.filter(b => b.isLive).forEach(b => {
      typeCounts.set(b.linkType, (typeCounts.get(b.linkType) || 0) + 1);
    });
    const linkTypeBreakdown = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    
    return {
      totalBacklinks,
      liveBacklinks,
      referringDomains,
      dofollowCount,
      avgDomainAuthority,
      opportunities,
      topOpportunities,
      linkTypeBreakdown,
    };
  }

  async findLinkOpportunities(projectId: string, competitorDomain: string): Promise<{
    domain: string;
    competitorLinks: number;
    ourLinks: number;
    isOpportunity: boolean;
    avgDomainAuthority: number;
    avgSpamScore: number | null;
  }[]> {
    const ourDomains = new Set<string>();
    const allOurBacklinks = await db
      .select()
      .from(backlinks)
      .where(and(eq(backlinks.projectId, projectId), eq(backlinks.isLive, true)));
    
    allOurBacklinks.forEach(b => ourDomains.add(b.sourceDomain.toLowerCase()));
    
    const competitorLinks = await db
      .select()
      .from(competitorBacklinks)
      .where(
        and(
          eq(competitorBacklinks.projectId, projectId),
          eq(competitorBacklinks.competitorDomain, competitorDomain),
          eq(competitorBacklinks.isLive, true)
        )
      );
    
    const domainMap = new Map<string, {
      domain: string;
      competitorLinks: number;
      ourLinks: number;
      daSum: number;
      daCount: number;
      spamSum: number;
      spamCount: number;
    }>();
    
    competitorLinks.forEach(b => {
      const domain = b.sourceDomain.toLowerCase();
      const existing = domainMap.get(domain);
      const ourLinkCount = ourDomains.has(domain) ? 1 : 0;
      
      if (existing) {
        existing.competitorLinks++;
        if (b.domainAuthority) {
          existing.daSum += b.domainAuthority;
          existing.daCount++;
        }
        if (b.spamScore !== null) {
          existing.spamSum += b.spamScore;
          existing.spamCount++;
        }
      } else {
        domainMap.set(domain, {
          domain,
          competitorLinks: 1,
          ourLinks: ourLinkCount,
          daSum: b.domainAuthority || 0,
          daCount: b.domainAuthority ? 1 : 0,
          spamSum: b.spamScore || 0,
          spamCount: b.spamScore !== null ? 1 : 0,
        });
      }
    });
    
    return Array.from(domainMap.values())
      .map(d => ({
        domain: d.domain,
        competitorLinks: d.competitorLinks,
        ourLinks: d.ourLinks,
        isOpportunity: d.ourLinks === 0 && d.daCount > 0 && (d.daSum / d.daCount) >= 30,
        avgDomainAuthority: d.daCount > 0 ? Math.round(d.daSum / d.daCount) : 0,
        avgSpamScore: d.spamCount > 0 ? Math.round(d.spamSum / d.spamCount) : null,
      }))
      .filter(d => d.isOpportunity)
      .sort((a, b) => b.avgDomainAuthority - a.avgDomainAuthority);
  }

  async updateCompetitorBacklinkOpportunities(projectId: string, competitorDomain: string): Promise<number> {
    const ourDomains = new Set<string>();
    const allOurBacklinks = await db
      .select()
      .from(backlinks)
      .where(and(eq(backlinks.projectId, projectId), eq(backlinks.isLive, true)));
    
    allOurBacklinks.forEach(b => ourDomains.add(b.sourceDomain.toLowerCase()));
    
    const competitorLinks = await db
      .select()
      .from(competitorBacklinks)
      .where(
        and(
          eq(competitorBacklinks.projectId, projectId),
          eq(competitorBacklinks.competitorDomain, competitorDomain)
        )
      );
    
    let updated = 0;
    for (const link of competitorLinks) {
      const isOpp = !ourDomains.has(link.sourceDomain.toLowerCase()) && 
                    link.domainAuthority !== null && 
                    link.domainAuthority >= 30 &&
                    link.isLive;
      
      let oppScore = 0;
      if (isOpp && link.domainAuthority) {
        oppScore = link.domainAuthority >= 80 ? 100 :
                   link.domainAuthority >= 60 ? 80 :
                   link.domainAuthority >= 40 ? 60 :
                   link.domainAuthority >= 30 ? 40 : 20;
        
        if (link.linkType === 'dofollow') oppScore += 10;
        if (link.spamScore !== null && link.spamScore <= 30) oppScore += 10;
        else if (link.spamScore !== null && link.spamScore > 60) oppScore -= 20;
      }
      
      if (link.isOpportunity !== isOpp || Number(link.opportunityScore) !== oppScore) {
        await db
          .update(competitorBacklinks)
          .set({ 
            isOpportunity: isOpp, 
            opportunityScore: oppScore.toString(),
            updatedAt: new Date() 
          })
          .where(eq(competitorBacklinks.id, link.id));
        updated++;
      }
    }
    
    return updated;
  }

  async getCompetitorBacklinksByDomain(projectId: string, competitorDomain: string): Promise<{
    domain: string;
    backlinks: number;
    liveLinks: number;
    isOpportunity: boolean;
    avgDomainAuthority: number | null;
    avgSpamScore: number | null;
  }[]> {
    const allBacklinks = await db
      .select()
      .from(competitorBacklinks)
      .where(
        and(
          eq(competitorBacklinks.projectId, projectId),
          eq(competitorBacklinks.competitorDomain, competitorDomain)
        )
      );
    
    const domainMap = new Map<string, {
      domain: string;
      backlinks: number;
      liveLinks: number;
      isOpportunity: boolean;
      daSum: number;
      daCount: number;
      spamSum: number;
      spamCount: number;
    }>();
    
    allBacklinks.forEach(b => {
      const existing = domainMap.get(b.sourceDomain);
      if (existing) {
        existing.backlinks++;
        if (b.isLive) existing.liveLinks++;
        if (b.isOpportunity) existing.isOpportunity = true;
        if (b.domainAuthority) {
          existing.daSum += b.domainAuthority;
          existing.daCount++;
        }
        if (b.spamScore !== null) {
          existing.spamSum += b.spamScore;
          existing.spamCount++;
        }
      } else {
        domainMap.set(b.sourceDomain, {
          domain: b.sourceDomain,
          backlinks: 1,
          liveLinks: b.isLive ? 1 : 0,
          isOpportunity: b.isOpportunity || false,
          daSum: b.domainAuthority || 0,
          daCount: b.domainAuthority ? 1 : 0,
          spamSum: b.spamScore || 0,
          spamCount: b.spamScore !== null ? 1 : 0,
        });
      }
    });
    
    return Array.from(domainMap.values())
      .map(d => ({
        domain: d.domain,
        backlinks: d.backlinks,
        liveLinks: d.liveLinks,
        isOpportunity: d.isOpportunity,
        avgDomainAuthority: d.daCount > 0 ? Math.round(d.daSum / d.daCount) : null,
        avgSpamScore: d.spamCount > 0 ? Math.round(d.spamSum / d.spamCount) : null,
      }))
      .sort((a, b) => (b.avgDomainAuthority || 0) - (a.avgDomainAuthority || 0));
  }

  async getCompetitorBacklinkCounts(projectId: string): Promise<Record<string, { total: number; opportunities: number }>> {
    const allBacklinks = await db
      .select()
      .from(competitorBacklinks)
      .where(eq(competitorBacklinks.projectId, projectId));
    
    const countsMap: Record<string, { total: number; opportunities: number }> = {};
    
    allBacklinks.forEach(b => {
      if (!countsMap[b.competitorDomain]) {
        countsMap[b.competitorDomain] = { total: 0, opportunities: 0 };
      }
      countsMap[b.competitorDomain].total++;
      if (b.isOpportunity) {
        countsMap[b.competitorDomain].opportunities++;
      }
    });
    
    return countsMap;
  }

  async getBacklinkGapAnalysis(projectId: string, competitorDomain?: string): Promise<{
    gaps: {
      sourceDomain: string;
      competitorCount: number;
      competitors: string[];
      avgDomainAuthority: number;
      avgSpamScore: number | null;
      bestOpportunityScore: number;
      linkType: string;
      isHighPriority: boolean;
    }[];
    summary: {
      totalGaps: number;
      highPriorityGaps: number;
      avgGapDA: number;
      ourBacklinkDomains: number;
      competitorBacklinkDomains: number;
    };
  }> {
    const ourDomains = new Set<string>();
    const allOurBacklinks = await db
      .select()
      .from(backlinks)
      .where(and(eq(backlinks.projectId, projectId), eq(backlinks.isLive, true)));
    
    allOurBacklinks.forEach(b => ourDomains.add(b.sourceDomain.toLowerCase()));
    
    let conditions = [
      eq(competitorBacklinks.projectId, projectId),
      eq(competitorBacklinks.isLive, true)
    ];
    if (competitorDomain) {
      conditions.push(eq(competitorBacklinks.competitorDomain, competitorDomain));
    }
    
    const allCompetitorBacklinks = await db
      .select()
      .from(competitorBacklinks)
      .where(and(...conditions));
    
    const competitorDomainSet = new Set(allCompetitorBacklinks.map(b => b.sourceDomain.toLowerCase()));
    
    const gapMap = new Map<string, {
      sourceDomain: string;
      competitors: Set<string>;
      daSum: number;
      daCount: number;
      spamSum: number;
      spamCount: number;
      bestOpportunityScore: number;
      linkTypes: Map<string, number>;
    }>();
    
    allCompetitorBacklinks.forEach(b => {
      const domain = b.sourceDomain.toLowerCase();
      if (ourDomains.has(domain)) return;
      
      const existing = gapMap.get(domain);
      const oppScore = Number(b.opportunityScore) || 0;
      
      if (existing) {
        existing.competitors.add(b.competitorDomain);
        if (b.domainAuthority) {
          existing.daSum += b.domainAuthority;
          existing.daCount++;
        }
        if (b.spamScore !== null) {
          existing.spamSum += b.spamScore;
          existing.spamCount++;
        }
        if (oppScore > existing.bestOpportunityScore) {
          existing.bestOpportunityScore = oppScore;
        }
        existing.linkTypes.set(b.linkType, (existing.linkTypes.get(b.linkType) || 0) + 1);
      } else {
        const linkTypes = new Map<string, number>();
        linkTypes.set(b.linkType, 1);
        gapMap.set(domain, {
          sourceDomain: domain,
          competitors: new Set([b.competitorDomain]),
          daSum: b.domainAuthority || 0,
          daCount: b.domainAuthority ? 1 : 0,
          spamSum: b.spamScore || 0,
          spamCount: b.spamScore !== null ? 1 : 0,
          bestOpportunityScore: oppScore,
          linkTypes,
        });
      }
    });
    
    const gaps = Array.from(gapMap.values())
      .map(g => {
        const avgDA = g.daCount > 0 ? Math.round(g.daSum / g.daCount) : 0;
        const avgSpam = g.spamCount > 0 ? Math.round(g.spamSum / g.spamCount) : null;
        const dominantLinkType = Array.from(g.linkTypes.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'dofollow';
        
        return {
          sourceDomain: g.sourceDomain,
          competitorCount: g.competitors.size,
          competitors: Array.from(g.competitors),
          avgDomainAuthority: avgDA,
          avgSpamScore: avgSpam,
          bestOpportunityScore: g.bestOpportunityScore,
          linkType: dominantLinkType,
          isHighPriority: avgDA >= 40 && g.competitors.size >= 2 && (avgSpam === null || avgSpam <= 30),
        };
      })
      .sort((a, b) => {
        if (a.isHighPriority !== b.isHighPriority) return a.isHighPriority ? -1 : 1;
        if (a.competitorCount !== b.competitorCount) return b.competitorCount - a.competitorCount;
        return b.avgDomainAuthority - a.avgDomainAuthority;
      });
    
    const highPriorityGaps = gaps.filter(g => g.isHighPriority);
    const daValues = gaps.filter(g => g.avgDomainAuthority > 0).map(g => g.avgDomainAuthority);
    
    return {
      gaps,
      summary: {
        totalGaps: gaps.length,
        highPriorityGaps: highPriorityGaps.length,
        avgGapDA: daValues.length > 0 ? Math.round(daValues.reduce((a, b) => a + b, 0) / daValues.length) : 0,
        ourBacklinkDomains: ourDomains.size,
        competitorBacklinkDomains: competitorDomainSet.size,
      },
    };
  }

  // Technical SEO Suite - Tech Crawls Implementation
  async getTechCrawls(projectId: string, limit: number = 20): Promise<TechCrawl[]> {
    return await db.select()
      .from(techCrawls)
      .where(eq(techCrawls.projectId, projectId))
      .orderBy(desc(techCrawls.createdAt))
      .limit(limit);
  }

  async getTechCrawl(id: number): Promise<TechCrawl | undefined> {
    const [crawl] = await db.select()
      .from(techCrawls)
      .where(eq(techCrawls.id, id));
    return crawl || undefined;
  }

  async getLatestTechCrawl(projectId: string): Promise<TechCrawl | undefined> {
    const [crawl] = await db.select()
      .from(techCrawls)
      .where(eq(techCrawls.projectId, projectId))
      .orderBy(desc(techCrawls.createdAt))
      .limit(1);
    return crawl || undefined;
  }

  async createTechCrawl(crawl: InsertTechCrawl): Promise<TechCrawl> {
    const [result] = await db.insert(techCrawls).values(crawl).returning();
    return result;
  }

  async updateTechCrawl(id: number, updates: Partial<InsertTechCrawl>): Promise<TechCrawl | undefined> {
    const [result] = await db.update(techCrawls)
      .set(updates)
      .where(eq(techCrawls.id, id))
      .returning();
    return result || undefined;
  }

  async getRunningTechCrawls(projectId?: string): Promise<TechCrawl[]> {
    const conditions = [
      or(eq(techCrawls.status, 'queued'), eq(techCrawls.status, 'running'))
    ];
    if (projectId) {
      conditions.push(eq(techCrawls.projectId, projectId));
    }
    return await db.select()
      .from(techCrawls)
      .where(and(...conditions))
      .orderBy(desc(techCrawls.startedAt));
  }

  // Technical SEO Suite - Page Audits Implementation
  async getPageAudits(projectId: string, options?: { 
    techCrawlId?: number; 
    limit?: number; 
    offset?: number;
    minScore?: number;
    maxScore?: number;
    hasIssues?: boolean;
  }): Promise<PageAudit[]> {
    const conditions = [eq(pageAudits.projectId, projectId)];
    
    if (options?.techCrawlId) {
      conditions.push(eq(pageAudits.techCrawlId, options.techCrawlId));
    }
    if (options?.minScore !== undefined) {
      conditions.push(gte(pageAudits.onpageScore, String(options.minScore)));
    }
    if (options?.maxScore !== undefined) {
      conditions.push(lte(pageAudits.onpageScore, String(options.maxScore)));
    }
    
    let query = db.select()
      .from(pageAudits)
      .where(and(...conditions))
      .orderBy(pageAudits.onpageScore);
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }
    
    return await query;
  }

  async getPageAudit(id: number): Promise<PageAudit | undefined> {
    const [audit] = await db.select()
      .from(pageAudits)
      .where(eq(pageAudits.id, id));
    return audit || undefined;
  }

  async getPageAuditByUrl(projectId: string, url: string, techCrawlId?: number): Promise<PageAudit | undefined> {
    const normalizedUrl = url.toLowerCase().replace(/\/+$/, '');
    const conditions = [
      eq(pageAudits.projectId, projectId),
      sql`lower(${pageAudits.url}) = ${normalizedUrl}`
    ];
    if (techCrawlId) {
      conditions.push(eq(pageAudits.techCrawlId, techCrawlId));
    }
    
    const [audit] = await db.select()
      .from(pageAudits)
      .where(and(...conditions))
      .orderBy(desc(pageAudits.createdAt))
      .limit(1);
    return audit || undefined;
  }

  async createPageAudit(audit: InsertPageAudit): Promise<PageAudit> {
    const [result] = await db.insert(pageAudits).values(audit).returning();
    return result;
  }

  async createPageAudits(audits: InsertPageAudit[]): Promise<PageAudit[]> {
    if (audits.length === 0) return [];
    return await db.insert(pageAudits).values(audits).returning();
  }

  async deletePageAuditsByTechCrawl(techCrawlId: number): Promise<void> {
    await db.delete(pageAudits).where(eq(pageAudits.techCrawlId, techCrawlId));
  }

  async getPageAuditsSummary(projectId: string, techCrawlId?: number): Promise<{
    totalPages: number;
    avgOnpageScore: number;
    indexablePages: number;
    nonIndexablePages: number;
    pagesWithIssues: number;
    issuesBySeverity: { critical: number; warning: number; info: number };
    issuesByCategory: Record<string, number>;
  }> {
    const conditions = [eq(pageAudits.projectId, projectId)];
    if (techCrawlId) {
      conditions.push(eq(pageAudits.techCrawlId, techCrawlId));
    }

    const audits = await db.select()
      .from(pageAudits)
      .where(and(...conditions));

    const totalPages = audits.length;
    const avgOnpageScore = totalPages > 0 
      ? audits.reduce((sum, a) => sum + (Number(a.onpageScore) || 0), 0) / totalPages 
      : 0;
    const indexablePages = audits.filter(a => a.isIndexable).length;
    const nonIndexablePages = totalPages - indexablePages;

    // Get issues summary
    const issueConditions = [eq(pageIssues.projectId, projectId)];
    if (techCrawlId) {
      const auditIds = audits.map(a => a.id);
      if (auditIds.length > 0) {
        issueConditions.push(sql`${pageIssues.pageAuditId} = ANY(${auditIds})`);
      }
    }

    const issues = await db.select()
      .from(pageIssues)
      .where(and(...issueConditions));

    const pageAuditIdsWithIssues = new Set(issues.map(i => i.pageAuditId));
    const pagesWithIssues = pageAuditIdsWithIssues.size;

    const issuesBySeverity = { critical: 0, warning: 0, info: 0 };
    const issuesByCategory: Record<string, number> = {};

    for (const issue of issues) {
      if (issue.severity === 'critical') issuesBySeverity.critical++;
      else if (issue.severity === 'warning') issuesBySeverity.warning++;
      else issuesBySeverity.info++;

      issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
    }

    return {
      totalPages,
      avgOnpageScore: Math.round(avgOnpageScore * 100) / 100,
      indexablePages,
      nonIndexablePages,
      pagesWithIssues,
      issuesBySeverity,
      issuesByCategory,
    };
  }

  // Technical SEO Suite - Page Issues Implementation
  async getPageIssues(pageAuditId: number): Promise<PageIssue[]> {
    return await db.select()
      .from(pageIssues)
      .where(eq(pageIssues.pageAuditId, pageAuditId))
      .orderBy(desc(sql`CASE WHEN ${pageIssues.severity} = 'critical' THEN 0 WHEN ${pageIssues.severity} = 'warning' THEN 1 ELSE 2 END`));
  }

  async getPageIssuesByProject(projectId: string, options?: {
    techCrawlId?: number;
    severity?: string;
    category?: string;
    limit?: number;
  }): Promise<PageIssue[]> {
    const conditions = [eq(pageIssues.projectId, projectId)];
    
    if (options?.severity) {
      conditions.push(eq(pageIssues.severity, options.severity));
    }
    if (options?.category) {
      conditions.push(eq(pageIssues.category, options.category));
    }

    let query = db.select()
      .from(pageIssues)
      .where(and(...conditions))
      .orderBy(desc(sql`CASE WHEN ${pageIssues.severity} = 'critical' THEN 0 WHEN ${pageIssues.severity} = 'warning' THEN 1 ELSE 2 END`));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    return await query;
  }

  async createPageIssue(issue: InsertPageIssue): Promise<PageIssue> {
    const [result] = await db.insert(pageIssues).values(issue).returning();
    return result;
  }

  async createPageIssues(issues: InsertPageIssue[]): Promise<PageIssue[]> {
    if (issues.length === 0) return [];
    return await db.insert(pageIssues).values(issues).returning();
  }

  async deletePageIssuesByAudit(pageAuditId: number): Promise<void> {
    await db.delete(pageIssues).where(eq(pageIssues.pageAuditId, pageAuditId));
  }

  async getIssuesSummary(projectId: string, techCrawlId?: number): Promise<{
    issueCode: string;
    issueLabel: string;
    severity: string;
    category: string;
    count: number;
    affectedPages: number;
  }[]> {
    const conditions = [eq(pageIssues.projectId, projectId)];

    if (techCrawlId) {
      const audits = await db.select({ id: pageAudits.id })
        .from(pageAudits)
        .where(eq(pageAudits.techCrawlId, techCrawlId));
      const auditIds = audits.map(a => a.id);
      if (auditIds.length > 0) {
        conditions.push(sql`${pageIssues.pageAuditId} = ANY(${auditIds})`);
      }
    }

    const issues = await db.select()
      .from(pageIssues)
      .where(and(...conditions));

    const summaryMap = new Map<string, {
      issueCode: string;
      issueLabel: string;
      severity: string;
      category: string;
      count: number;
      pageAuditIds: Set<number>;
    }>();

    for (const issue of issues) {
      const existing = summaryMap.get(issue.issueCode);
      if (existing) {
        existing.count += issue.occurrences || 1;
        existing.pageAuditIds.add(issue.pageAuditId);
      } else {
        summaryMap.set(issue.issueCode, {
          issueCode: issue.issueCode,
          issueLabel: issue.issueLabel,
          severity: issue.severity,
          category: issue.category,
          count: issue.occurrences || 1,
          pageAuditIds: new Set([issue.pageAuditId]),
        });
      }
    }

    return Array.from(summaryMap.values())
      .map(s => ({
        issueCode: s.issueCode,
        issueLabel: s.issueLabel,
        severity: s.severity,
        category: s.category,
        count: s.count,
        affectedPages: s.pageAuditIds.size,
      }))
      .sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        const aSev = severityOrder[a.severity as keyof typeof severityOrder] ?? 3;
        const bSev = severityOrder[b.severity as keyof typeof severityOrder] ?? 3;
        if (aSev !== bSev) return aSev - bSev;
        return b.affectedPages - a.affectedPages;
      });
  }

  async getLatestPageAuditsByUrl(projectId: string): Promise<Map<string, { onpageScore: number | null; issueCount: number }>> {
    const latestCrawl = await this.getLatestTechCrawl(projectId);
    if (!latestCrawl || latestCrawl.status !== "completed") {
      return new Map();
    }

    const audits = await db.select({
      url: pageAudits.url,
      onpageScore: pageAudits.onpageScore,
    })
      .from(pageAudits)
      .where(and(
        eq(pageAudits.projectId, projectId),
        eq(pageAudits.techCrawlId, latestCrawl.id)
      ));

    const issues = await db.select({
      pageAuditId: pageIssues.pageAuditId,
      count: sql<number>`count(*)`.as("count"),
    })
      .from(pageIssues)
      .innerJoin(pageAudits, eq(pageIssues.pageAuditId, pageAudits.id))
      .where(and(
        eq(pageAudits.projectId, projectId),
        eq(pageAudits.techCrawlId, latestCrawl.id)
      ))
      .groupBy(pageIssues.pageAuditId);

    const issueCountByAuditId = new Map<number, number>();
    for (const i of issues) {
      issueCountByAuditId.set(i.pageAuditId, Number(i.count));
    }

    const auditsByUrl = await db.select({
      id: pageAudits.id,
      url: pageAudits.url,
    })
      .from(pageAudits)
      .where(and(
        eq(pageAudits.projectId, projectId),
        eq(pageAudits.techCrawlId, latestCrawl.id)
      ));

    const auditIdByUrl = new Map<string, number>();
    for (const a of auditsByUrl) {
      const normalizedUrl = a.url.toLowerCase().replace(/\/+$/, "");
      auditIdByUrl.set(normalizedUrl, a.id);
    }

    const result = new Map<string, { onpageScore: number | null; issueCount: number }>();
    for (const audit of audits) {
      const normalizedUrl = audit.url.toLowerCase().replace(/\/+$/, "");
      const auditId = auditIdByUrl.get(normalizedUrl);
      result.set(normalizedUrl, {
        onpageScore: audit.onpageScore !== null && audit.onpageScore !== undefined 
          ? Number(audit.onpageScore) 
          : null,
        issueCount: auditId ? (issueCountByAuditId.get(auditId) || 0) : 0,
      });
    }

    return result;
  }

  // Global Settings Methods
  async getGlobalSetting(key: string): Promise<GlobalSetting | undefined> {
    const [setting] = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.key, key));
    return setting || undefined;
  }

  async setGlobalSetting(key: string, value: string, description?: string): Promise<GlobalSetting> {
    const existing = await this.getGlobalSetting(key);
    
    if (existing) {
      const [updated] = await db
        .update(globalSettings)
        .set({ 
          value, 
          description: description ?? existing.description,
          updatedAt: new Date() 
        })
        .where(eq(globalSettings.key, key))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(globalSettings)
      .values({ key, value, description })
      .returning();
    return created;
  }

  async getAllGlobalSettings(): Promise<GlobalSetting[]> {
    return await db.select().from(globalSettings);
  }

  // Enhanced Crawl Management Methods
  async getRunningCrawlsByType(projectId: string, type: string): Promise<CrawlResult[]> {
    return await db
      .select()
      .from(crawlResults)
      .where(
        and(
          eq(crawlResults.projectId, projectId),
          eq(crawlResults.type, type),
          eq(crawlResults.status, "running")
        )
      )
      .orderBy(desc(crawlResults.startedAt));
  }

  async getAllRunningCrawls(): Promise<CrawlResult[]> {
    return await db
      .select()
      .from(crawlResults)
      .where(eq(crawlResults.status, "running"))
      .orderBy(desc(crawlResults.startedAt));
  }

  async updateCrawlProgress(id: number, itemsProcessed: number, stage?: string): Promise<CrawlResult | undefined> {
    const updates: Partial<CrawlResult> = { 
      itemsProcessed,
    };
    if (stage) {
      updates.currentStage = stage;
    }
    const [updated] = await db
      .update(crawlResults)
      .set(updates)
      .where(eq(crawlResults.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
