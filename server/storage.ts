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
  type RankingsHistory,
  type InsertRankingsHistory,
  type SettingsQuickWins,
  type InsertSettingsQuickWins,
  type SettingsFallingStars,
  type InsertSettingsFallingStars,
  type ImportLog,
  type InsertImportLog,
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
  rankingsHistory,
  settingsQuickWins,
  settingsFallingStars,
  importLogs,
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
  deleteKeyword(id: number): Promise<void>;

  getSeoHealthSnapshots(projectId: string, limit?: number): Promise<SeoHealthSnapshot[]>;
  getLatestSeoHealthSnapshot(projectId: string): Promise<SeoHealthSnapshot | undefined>;
  createSeoHealthSnapshot(snapshot: InsertSeoHealthSnapshot): Promise<SeoHealthSnapshot>;

  getKeywordMetrics(keywordId: number, limit?: number): Promise<KeywordMetrics[]>;
  getLatestKeywordMetrics(projectId: string): Promise<any[]>;
  createKeywordMetrics(metrics: InsertKeywordMetrics): Promise<KeywordMetrics>;

  getPageMetrics(projectId: string, limit?: number): Promise<PageMetrics[]>;
  getLatestPageMetrics(projectId: string): Promise<PageMetrics[]>;
  createPageMetrics(metrics: InsertPageMetrics): Promise<PageMetrics>;

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

    // Get latest metrics for all keywords (including those without metrics)
    const allKeywordsWithMetrics = await db
      .select({
        keywordMetrics: keywordMetrics,
        keyword: keywords,
      })
      .from(keywords)
      .leftJoin(keywordMetrics, eq(keywordMetrics.keywordId, keywords.id))
      .where(eq(keywords.projectId, projectId))
      .orderBy(desc(keywordMetrics.date));

    const metricsMap = new Map<number, any>();
    for (const row of allKeywordsWithMetrics) {
      if (!metricsMap.has(row.keyword.id)) {
        metricsMap.set(row.keyword.id, {
          keywordId: row.keyword.id,
          keyword: row.keyword.keyword,
          cluster: row.keyword.cluster,
          url: row.keyword.targetUrl || "",
          currentPosition: row.keywordMetrics?.position || 0,
          positionDelta: row.keywordMetrics?.positionDelta || 0,
          searchVolume: row.keywordMetrics?.searchVolume || 0,
          difficulty: row.keywordMetrics ? Number(row.keywordMetrics.difficulty) || 0 : 0,
          intent: row.keywordMetrics?.intent || "informational",
          serpFeatures: row.keywordMetrics?.serpFeatures || [],
          opportunityScore: row.keywordMetrics ? Number(row.keywordMetrics.opportunityScore) || 0 : 0,
        });
      }
    }

    return Array.from(metricsMap.values());
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

  async createPageMetrics(insertMetrics: InsertPageMetrics): Promise<PageMetrics> {
    const [metrics] = await db.insert(pageMetrics).values(insertMetrics).returning();
    return metrics;
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
    const allMetrics = await db
      .select()
      .from(competitorMetrics)
      .where(eq(competitorMetrics.projectId, projectId))
      .orderBy(desc(competitorMetrics.date));

    const domainMap = new Map<string, CompetitorMetrics>();
    for (const metric of allMetrics) {
      if (!domainMap.has(metric.competitorDomain)) {
        domainMap.set(metric.competitorDomain, metric);
      }
    }

    return Array.from(domainMap.values());
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
        .orderBy(desc(importLogs.createdAt))
        .limit(limit);
    }
    return await db
      .select()
      .from(importLogs)
      .orderBy(desc(importLogs.createdAt))
      .limit(limit);
  }

  async createImportLog(log: InsertImportLog): Promise<ImportLog> {
    const [created] = await db.insert(importLogs).values(log).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
