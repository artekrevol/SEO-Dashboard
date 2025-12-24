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
  type BacklinksHistory,
  type InsertBacklinksHistory,
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
  type ScheduledReport,
  type InsertScheduledReport,
  type ReportRun,
  type InsertReportRun,
  type GscCredentials,
  type InsertGscCredentials,
  type GscQueryStats,
  type InsertGscQueryStats,
  type GscUrlInspection,
  type InsertGscUrlInspection,
  type KeywordPageConflict,
  type InsertKeywordPageConflict,
  type TaskExecutionLog,
  type InsertTaskExecutionLog,
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
  backlinksHistory,
  competitorBacklinks,
  techCrawls,
  pageAudits,
  pageIssues,
  globalSettings,
  scheduledReports,
  reportRuns,
  gscCredentials,
  gscQueryStats,
  gscUrlInspection,
  keywordPageConflicts,
  crawlTypeDurations,
  taskExecutionLogs,
  appVersions,
  InsertAppVersion,
  AppVersion,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, lt, sql, isNull, or } from "drizzle-orm";

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
  upsertKeywordMetrics(keywordId: number, date: string, data: Partial<InsertKeywordMetrics>): Promise<KeywordMetrics>;

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
  updateCompetitorMetrics(projectId: string, competitorDomain: string, updates: Partial<InsertCompetitorMetrics>): Promise<CompetitorMetrics | undefined>;

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
  updateCrawlProgress(id: number, itemsProcessed: number, stage?: string, itemsTotal?: number): Promise<CrawlResult | undefined>;
  cancelStaleCrawls(serverStartTime: Date): Promise<number>;
  
  // Scheduled Reports
  getScheduledReports(projectId: string): Promise<ScheduledReport[]>;
  getScheduledReport(id: number): Promise<ScheduledReport | undefined>;
  getActiveScheduledReports(): Promise<ScheduledReport[]>;
  getDueScheduledReports(): Promise<ScheduledReport[]>;
  createScheduledReport(report: InsertScheduledReport): Promise<ScheduledReport>;
  updateScheduledReport(id: number, updates: Partial<ScheduledReport>): Promise<ScheduledReport | undefined>;
  deleteScheduledReport(id: number): Promise<void>;
  
  // Report Runs
  getReportRuns(projectId: string, limit?: number): Promise<ReportRun[]>;
  getReportRun(id: number): Promise<ReportRun | undefined>;
  createReportRun(run: InsertReportRun): Promise<ReportRun>;
  updateReportRun(id: number, updates: Partial<ReportRun>): Promise<ReportRun | undefined>;
  
  // Keyword Page Conflicts (Cannibalization)
  getKeywordPageConflicts(projectId: string, filters?: { status?: string; severity?: string }): Promise<KeywordPageConflict[]>;
  getKeywordPageConflict(id: number): Promise<KeywordPageConflict | undefined>;
  createKeywordPageConflict(conflict: InsertKeywordPageConflict): Promise<KeywordPageConflict>;
  updateKeywordPageConflict(id: number, updates: Partial<KeywordPageConflict>): Promise<KeywordPageConflict | undefined>;
  deleteKeywordPageConflict(id: number): Promise<void>;
  deleteKeywordPageConflictsByProject(projectId: string): Promise<void>;
  
  // Task Execution Logs
  getTaskLogs(options?: {
    projectId?: string;
    taskId?: string;
    category?: string;
    level?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<TaskExecutionLog[]>;
  getTaskLog(id: number): Promise<TaskExecutionLog | undefined>;
  createTaskLog(log: InsertTaskExecutionLog): Promise<TaskExecutionLog>;
  deleteOldTaskLogs(olderThan: Date): Promise<number>;
  getTaskLogsByTaskId(taskId: string): Promise<TaskExecutionLog[]>;
  getTaskLogsSummary(options?: { projectId?: string; startDate?: Date; endDate?: Date }): Promise<{
    totalLogs: number;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    debugCount: number;
    byCategory: Record<string, number>;
    recentErrors: TaskExecutionLog[];
  }>;
  
  // App Versions / Release Notes
  getAppVersions(limit?: number): Promise<AppVersion[]>;
  getAppVersion(id: number): Promise<AppVersion | undefined>;
  createAppVersion(version: InsertAppVersion): Promise<AppVersion>;
  updateAppVersion(id: number, updates: Partial<InsertAppVersion>): Promise<AppVersion | undefined>;
  deleteAppVersion(id: number): Promise<void>;
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

  async upsertKeywordMetrics(keywordId: number, date: string, data: Partial<InsertKeywordMetrics>): Promise<KeywordMetrics> {
    const [existing] = await db
      .select()
      .from(keywordMetrics)
      .where(and(eq(keywordMetrics.keywordId, keywordId), eq(keywordMetrics.date, date)))
      .limit(1);
    
    if (existing) {
      const updateData: Record<string, unknown> = {};
      if (data.position !== undefined) updateData.position = data.position;
      if (data.previousPosition !== undefined) updateData.previousPosition = data.previousPosition;
      if (data.positionDelta !== undefined) updateData.positionDelta = data.positionDelta;
      if (data.searchVolume !== undefined) updateData.searchVolume = data.searchVolume;
      if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
      if (data.intent !== undefined) updateData.intent = data.intent;
      if (data.serpFeatures !== undefined) updateData.serpFeatures = data.serpFeatures;
      if (data.opportunityScore !== undefined) updateData.opportunityScore = data.opportunityScore;
      
      const [updated] = await db
        .update(keywordMetrics)
        .set(updateData)
        .where(eq(keywordMetrics.id, existing.id))
        .returning();
      return updated || existing;
    }
    
    const insertData: InsertKeywordMetrics = {
      keywordId,
      date,
      position: data.position ?? null,
      previousPosition: data.previousPosition ?? null,
      positionDelta: data.positionDelta ?? null,
      searchVolume: data.searchVolume ?? null,
      difficulty: data.difficulty ?? null,
      intent: data.intent ?? null,
      serpFeatures: data.serpFeatures ?? null,
      opportunityScore: data.opportunityScore ?? null,
    };
    
    return await this.createKeywordMetrics(insertData);
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
    
    // Get the most recent ranking WITH a valid position for each keyword
    const rankingsByKeywordId = new Map<number, RankingsHistory>();
    for (const r of allRankings) {
      // Only consider rankings with valid positions (not null and > 0)
      if (!rankingsByKeywordId.has(r.keywordId) && r.position !== null && r.position > 0) {
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

  async updateCompetitorMetrics(projectId: string, competitorDomain: string, updates: Partial<InsertCompetitorMetrics>): Promise<CompetitorMetrics | undefined> {
    // First find the latest entry for this competitor to avoid clobbering historical data
    const [latestEntry] = await db
      .select()
      .from(competitorMetrics)
      .where(
        and(
          eq(competitorMetrics.projectId, projectId),
          eq(competitorMetrics.competitorDomain, competitorDomain)
        )
      )
      .orderBy(desc(competitorMetrics.date))
      .limit(1);
    
    if (!latestEntry) {
      return undefined;
    }
    
    // Update only the latest entry
    const [metric] = await db
      .update(competitorMetrics)
      .set({ ...updates })
      .where(eq(competitorMetrics.id, latestEntry.id))
      .returning();
    return metric || undefined;
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
    // Check for existing record first (most common case is update)
    const existing = await this.getRankingsHistoryForDate(keywordId, date);
    
    if (existing) {
      // Update existing record
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
      
      try {
        const [updated] = await db
          .update(rankingsHistory)
          .set(updateData)
          .where(and(eq(rankingsHistory.keywordId, keywordId), eq(rankingsHistory.date, date)))
          .returning();
        
        if (updated) {
          return updated;
        }
        // If update returned nothing, record might have been deleted, fall through to insert
      } catch (error) {
        console.error(`[Storage] Error updating rankings history for keyword ${keywordId} on ${date}:`, error);
        // Fall through to insert attempt
      }
    }
    
    // Insert new record (or retry if update failed)
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
    
    try {
      return await this.createRankingsHistory(insertData);
    } catch (error: any) {
      // If insert fails due to duplicate (race condition), try to get the existing record
      if (error?.code === '23505' || error?.message?.includes('duplicate') || error?.message?.includes('unique')) {
        const existingAfterConflict = await this.getRankingsHistoryForDate(keywordId, date);
        if (existingAfterConflict) {
          // Update the existing record that was created by another process
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
          return updated || existingAfterConflict;
        }
      }
      throw error;
    }
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

  // Backlinks History Methods
  async upsertBacklinksHistory(backlinkId: number, projectId: string, data: {
    isLive: boolean;
    domainAuthority: number | null;
    pageAuthority: number | null;
    spamScore: number | null;
  }): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    const existing = await db
      .select()
      .from(backlinksHistory)
      .where(
        and(
          eq(backlinksHistory.backlinkId, backlinkId),
          eq(backlinksHistory.date, today)
        )
      );
    
    if (existing.length > 0) {
      await db
        .update(backlinksHistory)
        .set({
          isLive: data.isLive,
          domainAuthority: data.domainAuthority,
          pageAuthority: data.pageAuthority,
          spamScore: data.spamScore,
        })
        .where(eq(backlinksHistory.id, existing[0].id));
    } else {
      await db.insert(backlinksHistory).values({
        backlinkId,
        projectId,
        date: today,
        isLive: data.isLive,
        domainAuthority: data.domainAuthority,
        pageAuthority: data.pageAuthority,
        spamScore: data.spamScore,
      });
    }
  }

  async getBacklinksHistory(backlinkId: number, days: number = 90): Promise<BacklinksHistory[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    
    return await db
      .select()
      .from(backlinksHistory)
      .where(
        and(
          eq(backlinksHistory.backlinkId, backlinkId),
          gte(backlinksHistory.date, cutoffStr)
        )
      )
      .orderBy(backlinksHistory.date);
  }

  async getProjectBacklinksHistory(projectId: string, days: number = 90): Promise<BacklinksHistory[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    
    return await db
      .select()
      .from(backlinksHistory)
      .where(
        and(
          eq(backlinksHistory.projectId, projectId),
          gte(backlinksHistory.date, cutoffStr)
        )
      )
      .orderBy(backlinksHistory.date);
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
    // Strategy: Find the latest tech crawl that has audits, prioritizing completed ones
    // First try to get latest completed crawl
    const completedCrawls = await db.select()
      .from(techCrawls)
      .where(and(
        eq(techCrawls.projectId, projectId),
        eq(techCrawls.status, "completed")
      ))
      .orderBy(desc(techCrawls.createdAt))
      .limit(1);

    let targetCrawlId: number | null = null;
    
    if (completedCrawls.length > 0) {
      // Check if this completed crawl has audits
      const hasAudits = await db.select({ id: pageAudits.id })
        .from(pageAudits)
        .where(and(
          eq(pageAudits.projectId, projectId),
          eq(pageAudits.techCrawlId, completedCrawls[0].id)
        ))
        .limit(1);
      
      if (hasAudits.length > 0) {
        targetCrawlId = completedCrawls[0].id;
      }
    }

    // If no completed crawl with audits, find the latest crawl (any status) that has audits
    if (!targetCrawlId) {
      const crawlsWithAudits = await db.select({
        techCrawlId: pageAudits.techCrawlId,
        maxCreatedAt: sql<Date>`max(${pageAudits.createdAt})`.as("max_created_at"),
      })
        .from(pageAudits)
        .where(eq(pageAudits.projectId, projectId))
        .groupBy(pageAudits.techCrawlId)
        .orderBy(desc(sql`max(${pageAudits.createdAt})`))
        .limit(1);

      if (crawlsWithAudits.length > 0) {
        targetCrawlId = crawlsWithAudits[0].techCrawlId;
      }
    }

    if (!targetCrawlId) {
      return new Map();
    }

    // Get all audits for the target crawl
    const audits = await db.select({
      id: pageAudits.id,
      url: pageAudits.url,
      onpageScore: pageAudits.onpageScore,
    })
      .from(pageAudits)
      .where(and(
        eq(pageAudits.projectId, projectId),
        eq(pageAudits.techCrawlId, targetCrawlId)
      ));

    if (audits.length === 0) {
      return new Map();
    }

    // Get issue counts for these audits
    const issues = await db.select({
      pageAuditId: pageIssues.pageAuditId,
      count: sql<number>`count(*)`.as("count"),
    })
      .from(pageIssues)
      .innerJoin(pageAudits, eq(pageIssues.pageAuditId, pageAudits.id))
      .where(and(
        eq(pageAudits.projectId, projectId),
        eq(pageAudits.techCrawlId, targetCrawlId)
      ))
      .groupBy(pageIssues.pageAuditId);

    const issueCountByAuditId = new Map<number, number>();
    for (const i of issues) {
      issueCountByAuditId.set(i.pageAuditId, Number(i.count));
    }

    // Build result map with normalized URLs (matching the normalization in routes.ts)
    const result = new Map<string, { onpageScore: number | null; issueCount: number }>();
    for (const audit of audits) {
      const normalizedUrl = audit.url.toLowerCase().replace(/\/+$/, "");
      result.set(normalizedUrl, {
        onpageScore: audit.onpageScore !== null && audit.onpageScore !== undefined 
          ? Number(audit.onpageScore) 
          : null,
        issueCount: issueCountByAuditId.get(audit.id) || 0,
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

  async updateCrawlProgress(id: number, itemsProcessed: number, stage?: string, itemsTotal?: number): Promise<CrawlResult | undefined> {
    const updates: Partial<CrawlResult> = { 
      itemsProcessed,
    };
    if (stage) {
      updates.currentStage = stage;
    }
    if (itemsTotal !== undefined) {
      updates.itemsTotal = itemsTotal;
    }
    const [updated] = await db
      .update(crawlResults)
      .set(updates)
      .where(eq(crawlResults.id, id))
      .returning();
    return updated || undefined;
  }

  async cancelStaleCrawls(serverStartTime: Date): Promise<number> {
    const result = await db
      .update(crawlResults)
      .set({
        status: "cancelled",
        completedAt: new Date(),
        message: "Cancelled: Server restart detected - crawl was orphaned",
      })
      .where(
        and(
          eq(crawlResults.status, "running"),
          lt(crawlResults.startedAt, serverStartTime)
        )
      )
      .returning({ id: crawlResults.id });
    
    return result.length;
  }

  async stopCrawl(id: number): Promise<CrawlResult | undefined> {
    const [updated] = await db
      .update(crawlResults)
      .set({
        status: "cancelled",
        completedAt: new Date(),
        message: "Crawl was manually stopped by user",
      })
      .where(eq(crawlResults.id, id))
      .returning();
    return updated || undefined;
  }

  // ============================================
  // SCHEDULED REPORTS METHODS
  // ============================================

  async getScheduledReports(projectId: string): Promise<ScheduledReport[]> {
    return await db.select()
      .from(scheduledReports)
      .where(eq(scheduledReports.projectId, projectId))
      .orderBy(desc(scheduledReports.createdAt));
  }

  async getScheduledReport(id: number): Promise<ScheduledReport | undefined> {
    const [report] = await db.select()
      .from(scheduledReports)
      .where(eq(scheduledReports.id, id));
    return report || undefined;
  }

  async getActiveScheduledReports(): Promise<ScheduledReport[]> {
    return await db.select()
      .from(scheduledReports)
      .where(eq(scheduledReports.isActive, true))
      .orderBy(scheduledReports.nextScheduledAt);
  }

  async getDueScheduledReports(): Promise<ScheduledReport[]> {
    const now = new Date();
    return await db.select()
      .from(scheduledReports)
      .where(
        and(
          eq(scheduledReports.isActive, true),
          lte(scheduledReports.nextScheduledAt, now)
        )
      );
  }

  async createScheduledReport(report: InsertScheduledReport): Promise<ScheduledReport> {
    const [result] = await db.insert(scheduledReports).values(report).returning();
    return result;
  }

  async updateScheduledReport(id: number, updates: Partial<ScheduledReport>): Promise<ScheduledReport | undefined> {
    const [updated] = await db
      .update(scheduledReports)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(scheduledReports.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteScheduledReport(id: number): Promise<void> {
    await db.delete(scheduledReports).where(eq(scheduledReports.id, id));
  }

  async getReportRuns(projectId: string, limit?: number): Promise<ReportRun[]> {
    let query = db.select()
      .from(reportRuns)
      .where(eq(reportRuns.projectId, projectId))
      .orderBy(desc(reportRuns.startedAt));
    
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    
    return await query;
  }

  async getReportRun(id: number): Promise<ReportRun | undefined> {
    const [run] = await db.select()
      .from(reportRuns)
      .where(eq(reportRuns.id, id));
    return run || undefined;
  }

  async createReportRun(run: InsertReportRun): Promise<ReportRun> {
    const [result] = await db.insert(reportRuns).values(run).returning();
    return result;
  }

  async updateReportRun(id: number, updates: Partial<ReportRun>): Promise<ReportRun | undefined> {
    const [updated] = await db
      .update(reportRuns)
      .set(updates)
      .where(eq(reportRuns.id, id))
      .returning();
    return updated || undefined;
  }

  // ============================================
  // GOOGLE SEARCH CONSOLE METHODS
  // ============================================

  async getGscCredentials(projectId: string): Promise<GscCredentials | undefined> {
    const [creds] = await db.select()
      .from(gscCredentials)
      .where(eq(gscCredentials.projectId, projectId));
    return creds || undefined;
  }

  async createGscCredentials(creds: InsertGscCredentials): Promise<GscCredentials> {
    const [result] = await db.insert(gscCredentials).values(creds).returning();
    return result;
  }

  async updateGscCredentials(projectId: string, updates: Partial<InsertGscCredentials>): Promise<GscCredentials | undefined> {
    const [updated] = await db
      .update(gscCredentials)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(gscCredentials.projectId, projectId))
      .returning();
    return updated || undefined;
  }

  async deleteGscCredentials(projectId: string): Promise<void> {
    await db.delete(gscCredentials).where(eq(gscCredentials.projectId, projectId));
  }

  async getGscQueryStats(projectId: string, options?: {
    startDate?: string;
    endDate?: string;
    query?: string;
    page?: string;
    limit?: number;
  }): Promise<GscQueryStats[]> {
    const conditions = [eq(gscQueryStats.projectId, projectId)];
    
    if (options?.startDate) {
      conditions.push(gte(gscQueryStats.date, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(gscQueryStats.date, options.endDate));
    }
    if (options?.query) {
      conditions.push(eq(gscQueryStats.query, options.query));
    }
    if (options?.page) {
      conditions.push(eq(gscQueryStats.page, options.page));
    }

    let query = db.select()
      .from(gscQueryStats)
      .where(and(...conditions))
      .orderBy(desc(gscQueryStats.date));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    return await query;
  }

  async createGscQueryStats(stats: InsertGscQueryStats): Promise<GscQueryStats> {
    const [result] = await db.insert(gscQueryStats).values(stats).returning();
    return result;
  }

  async upsertGscQueryStats(stats: InsertGscQueryStats): Promise<GscQueryStats> {
    const existing = await db.select()
      .from(gscQueryStats)
      .where(
        and(
          eq(gscQueryStats.projectId, stats.projectId),
          eq(gscQueryStats.query, stats.query),
          stats.page ? eq(gscQueryStats.page, stats.page) : isNull(gscQueryStats.page),
          eq(gscQueryStats.date, stats.date)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(gscQueryStats)
        .set(stats)
        .where(eq(gscQueryStats.id, existing[0].id))
        .returning();
      return updated;
    }

    return this.createGscQueryStats(stats);
  }

  async getGscUrlInspection(projectId: string, url?: string): Promise<GscUrlInspection[]> {
    const conditions = [eq(gscUrlInspection.projectId, projectId)];
    if (url) {
      conditions.push(eq(gscUrlInspection.url, url));
    }
    return await db.select()
      .from(gscUrlInspection)
      .where(and(...conditions))
      .orderBy(desc(gscUrlInspection.lastInspectedAt));
  }

  async upsertGscUrlInspection(inspection: InsertGscUrlInspection): Promise<GscUrlInspection> {
    const existing = await db.select()
      .from(gscUrlInspection)
      .where(
        and(
          eq(gscUrlInspection.projectId, inspection.projectId),
          eq(gscUrlInspection.url, inspection.url)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(gscUrlInspection)
        .set({ ...inspection, updatedAt: new Date() })
        .where(eq(gscUrlInspection.id, existing[0].id))
        .returning();
      return updated;
    }

    const [result] = await db.insert(gscUrlInspection).values(inspection).returning();
    return result;
  }

  // ============================================
  // CANNIBALIZATION DETECTION METHODS
  // ============================================

  async getKeywordPageConflicts(projectId: string, options?: {
    status?: string;
    severity?: string;
    keyword?: string;
    limit?: number;
  }): Promise<KeywordPageConflict[]> {
    const conditions = [eq(keywordPageConflicts.projectId, projectId)];
    
    if (options?.status) {
      conditions.push(eq(keywordPageConflicts.status, options.status));
    }
    if (options?.severity) {
      conditions.push(eq(keywordPageConflicts.severity, options.severity));
    }
    if (options?.keyword) {
      conditions.push(sql`lower(${keywordPageConflicts.keyword}) LIKE lower(${'%' + options.keyword + '%'})`);
    }

    let query = db.select()
      .from(keywordPageConflicts)
      .where(and(...conditions))
      .orderBy(
        desc(sql`CASE WHEN ${keywordPageConflicts.severity} = 'high' THEN 0 WHEN ${keywordPageConflicts.severity} = 'medium' THEN 1 ELSE 2 END`),
        desc(keywordPageConflicts.searchVolume)
      );

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    return await query;
  }

  async getKeywordPageConflict(id: number): Promise<KeywordPageConflict | undefined> {
    const [conflict] = await db.select()
      .from(keywordPageConflicts)
      .where(eq(keywordPageConflicts.id, id));
    return conflict || undefined;
  }

  async createKeywordPageConflict(conflict: InsertKeywordPageConflict): Promise<KeywordPageConflict> {
    const [result] = await db.insert(keywordPageConflicts).values(conflict).returning();
    return result;
  }

  async upsertKeywordPageConflict(conflict: InsertKeywordPageConflict): Promise<KeywordPageConflict> {
    const existing = await db.select()
      .from(keywordPageConflicts)
      .where(
        and(
          eq(keywordPageConflicts.projectId, conflict.projectId),
          eq(keywordPageConflicts.keyword, conflict.keyword),
          eq(keywordPageConflicts.primaryUrl, conflict.primaryUrl),
          eq(keywordPageConflicts.conflictingUrl, conflict.conflictingUrl)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(keywordPageConflicts)
        .set({ ...conflict, updatedAt: new Date() })
        .where(eq(keywordPageConflicts.id, existing[0].id))
        .returning();
      return updated;
    }

    return this.createKeywordPageConflict(conflict);
  }

  async updateKeywordPageConflict(id: number, updates: Partial<KeywordPageConflict>): Promise<KeywordPageConflict | undefined> {
    const [updated] = await db
      .update(keywordPageConflicts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(keywordPageConflicts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteKeywordPageConflict(id: number): Promise<void> {
    await db.delete(keywordPageConflicts).where(eq(keywordPageConflicts.id, id));
  }

  async deleteResolvedConflicts(projectId: string): Promise<void> {
    await db.delete(keywordPageConflicts)
      .where(
        and(
          eq(keywordPageConflicts.projectId, projectId),
          eq(keywordPageConflicts.status, 'resolved')
        )
      );
  }

  async deleteKeywordPageConflictsByProject(projectId: string): Promise<void> {
    await db.delete(keywordPageConflicts)
      .where(eq(keywordPageConflicts.projectId, projectId));
  }

  async getConflictsSummary(projectId: string): Promise<{
    total: number;
    active: number;
    resolved: number;
    ignored: number;
    bySeverity: { high: number; medium: number; low: number };
  }> {
    const conflicts = await db.select()
      .from(keywordPageConflicts)
      .where(eq(keywordPageConflicts.projectId, projectId));

    const summary = {
      total: conflicts.length,
      active: 0,
      resolved: 0,
      ignored: 0,
      bySeverity: { high: 0, medium: 0, low: 0 },
    };

    for (const conflict of conflicts) {
      if (conflict.status === 'active') summary.active++;
      else if (conflict.status === 'resolved') summary.resolved++;
      else if (conflict.status === 'ignored') summary.ignored++;

      if (conflict.severity === 'high') summary.bySeverity.high++;
      else if (conflict.severity === 'medium') summary.bySeverity.medium++;
      else summary.bySeverity.low++;
    }

    return summary;
  }

  // Task Execution Logs
  async getTaskLogs(options?: {
    projectId?: string;
    taskId?: string;
    category?: string;
    level?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<TaskExecutionLog[]> {
    const conditions = [];
    
    if (options?.projectId) {
      conditions.push(eq(taskExecutionLogs.projectId, options.projectId));
    }
    if (options?.taskId) {
      conditions.push(eq(taskExecutionLogs.taskId, options.taskId));
    }
    if (options?.category) {
      conditions.push(eq(taskExecutionLogs.category, options.category));
    }
    if (options?.level) {
      conditions.push(eq(taskExecutionLogs.level, options.level));
    }
    if (options?.startDate) {
      conditions.push(gte(taskExecutionLogs.createdAt, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(taskExecutionLogs.createdAt, options.endDate));
    }

    let query = db.select()
      .from(taskExecutionLogs)
      .orderBy(desc(taskExecutionLogs.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return await query;
  }

  async getTaskLog(id: number): Promise<TaskExecutionLog | undefined> {
    const [log] = await db.select()
      .from(taskExecutionLogs)
      .where(eq(taskExecutionLogs.id, id));
    return log || undefined;
  }

  async createTaskLog(log: InsertTaskExecutionLog): Promise<TaskExecutionLog> {
    const [created] = await db.insert(taskExecutionLogs)
      .values(log)
      .returning();
    return created;
  }

  async deleteOldTaskLogs(olderThan: Date): Promise<number> {
    const result = await db.delete(taskExecutionLogs)
      .where(lte(taskExecutionLogs.createdAt, olderThan))
      .returning();
    return result.length;
  }

  async getTaskLogsByTaskId(taskId: string): Promise<TaskExecutionLog[]> {
    return await db.select()
      .from(taskExecutionLogs)
      .where(eq(taskExecutionLogs.taskId, taskId))
      .orderBy(taskExecutionLogs.createdAt);
  }

  async getTaskLogsSummary(options?: { projectId?: string; startDate?: Date; endDate?: Date }): Promise<{
    totalLogs: number;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    debugCount: number;
    byCategory: Record<string, number>;
    recentErrors: TaskExecutionLog[];
  }> {
    const conditions = [];
    
    if (options?.projectId) {
      conditions.push(eq(taskExecutionLogs.projectId, options.projectId));
    }
    if (options?.startDate) {
      conditions.push(gte(taskExecutionLogs.createdAt, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(taskExecutionLogs.createdAt, options.endDate));
    }

    let query = db.select().from(taskExecutionLogs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const logs = await query;
    
    const summary = {
      totalLogs: logs.length,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      byCategory: {} as Record<string, number>,
      recentErrors: [] as TaskExecutionLog[],
    };

    for (const log of logs) {
      if (log.level === 'error') {
        summary.errorCount++;
        if (summary.recentErrors.length < 10) {
          summary.recentErrors.push(log);
        }
      } else if (log.level === 'warn') {
        summary.warnCount++;
      } else if (log.level === 'info') {
        summary.infoCount++;
      } else if (log.level === 'debug') {
        summary.debugCount++;
      }

      summary.byCategory[log.category] = (summary.byCategory[log.category] || 0) + 1;
    }

    // Sort recent errors by date descending
    summary.recentErrors.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return summary;
  }

  // App Versions / Release Notes
  async getAppVersions(limit: number = 50): Promise<AppVersion[]> {
    return await db.select()
      .from(appVersions)
      .orderBy(desc(appVersions.releasedAt))
      .limit(limit);
  }

  async getAppVersion(id: number): Promise<AppVersion | undefined> {
    const [version] = await db.select().from(appVersions).where(eq(appVersions.id, id));
    return version || undefined;
  }

  async createAppVersion(insertVersion: InsertAppVersion): Promise<AppVersion> {
    const [version] = await db.insert(appVersions).values(insertVersion).returning();
    return version;
  }

  async updateAppVersion(id: number, updates: Partial<InsertAppVersion>): Promise<AppVersion | undefined> {
    const [version] = await db.update(appVersions).set(updates).where(eq(appVersions.id, id)).returning();
    return version || undefined;
  }

  async deleteAppVersion(id: number): Promise<void> {
    await db.delete(appVersions).where(eq(appVersions.id, id));
  }

  // Data cleanup functions - remove data older than specified retention period
  async cleanupOldData(retentionDays: number = 90): Promise<{
    rankingsHistoryDeleted: number;
    keywordMetricsDeleted: number;
    competitorMetricsDeleted: number;
    seoHealthSnapshotsDeleted: number;
    backlinksHistoryDeleted: number;
    taskLogsDeleted: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log(`[Storage] Cleaning up data older than ${retentionDays} days (before ${cutoffDateStr})`);
    
    // Delete old rankings history
    await db.delete(rankingsHistory)
      .where(lt(rankingsHistory.date, cutoffDateStr));
    
    // Delete old keyword metrics
    await db.delete(keywordMetrics)
      .where(lt(keywordMetrics.date, cutoffDateStr));
    
    // Delete old competitor metrics
    await db.delete(competitorMetrics)
      .where(lt(competitorMetrics.date, cutoffDateStr));
    
    // Delete old SEO health snapshots
    await db.delete(seoHealthSnapshots)
      .where(lt(seoHealthSnapshots.date, cutoffDateStr));
    
    // Delete old backlinks history
    await db.delete(backlinksHistory)
      .where(lt(backlinksHistory.date, cutoffDateStr));
    
    // Delete old task execution logs (use timestamp comparison)
    await db.delete(taskExecutionLogs)
      .where(lt(taskExecutionLogs.createdAt, cutoffDate));
    
    const summary = {
      rankingsHistoryDeleted: 0, // Drizzle doesn't return affected row count directly
      keywordMetricsDeleted: 0,
      competitorMetricsDeleted: 0,
      seoHealthSnapshotsDeleted: 0,
      backlinksHistoryDeleted: 0,
      taskLogsDeleted: 0,
    };
    
    console.log(`[Storage] Data cleanup completed for records before ${cutoffDateStr}`);
    return summary;
  }

  async getDataRetentionStats(): Promise<{
    rankingsHistoryCount: number;
    keywordMetricsCount: number;
    competitorMetricsCount: number;
    seoHealthSnapshotsCount: number;
    oldestRankingDate: string | null;
    oldestKeywordMetricDate: string | null;
    oldestCompetitorMetricDate: string | null;
  }> {
    const [rankingsCount] = await db.select({ count: sql<number>`count(*)` }).from(rankingsHistory);
    const [keywordMetricsCount] = await db.select({ count: sql<number>`count(*)` }).from(keywordMetrics);
    const [competitorMetricsCount] = await db.select({ count: sql<number>`count(*)` }).from(competitorMetrics);
    const [snapshotsCount] = await db.select({ count: sql<number>`count(*)` }).from(seoHealthSnapshots);
    
    const [oldestRanking] = await db.select({ date: rankingsHistory.date })
      .from(rankingsHistory)
      .orderBy(rankingsHistory.date)
      .limit(1);
    
    const [oldestKeywordMetric] = await db.select({ date: keywordMetrics.date })
      .from(keywordMetrics)
      .orderBy(keywordMetrics.date)
      .limit(1);
    
    const [oldestCompetitorMetric] = await db.select({ date: competitorMetrics.date })
      .from(competitorMetrics)
      .orderBy(competitorMetrics.date)
      .limit(1);
    
    return {
      rankingsHistoryCount: Number(rankingsCount?.count || 0),
      keywordMetricsCount: Number(keywordMetricsCount?.count || 0),
      competitorMetricsCount: Number(competitorMetricsCount?.count || 0),
      seoHealthSnapshotsCount: Number(snapshotsCount?.count || 0),
      oldestRankingDate: oldestRanking?.date || null,
      oldestKeywordMetricDate: oldestKeywordMetric?.date || null,
      oldestCompetitorMetricDate: oldestCompetitorMetric?.date || null,
    };
  }
}

export const storage = new DatabaseStorage();
