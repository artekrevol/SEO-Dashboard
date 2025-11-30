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
  type Location,
  type SettingsPriorityRules,
  type CrawlSchedule,
  type InsertCrawlSchedule,
  type RankingsHistory,
  type InsertRankingsHistory,
  users,
  projects,
  keywords,
  seoHealthSnapshots,
  keywordMetrics,
  pageMetrics,
  seoRecommendations,
  competitorMetrics,
  locations,
  settingsPriorityRules,
  crawlSchedules,
  rankingsHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

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
    const [history] = await db.insert(rankingsHistory).values(insertHistory).returning();
    return history;
  }

  async upsertRankingsHistory(
    keywordId: number,
    date: string,
    data: Omit<InsertRankingsHistory, "keywordId" | "date">
  ): Promise<RankingsHistory> {
    const existing = await this.getRankingsHistoryForDate(keywordId, date);
    if (existing) {
      const [updated] = await db
        .update(rankingsHistory)
        .set({ ...data })
        .where(and(eq(rankingsHistory.keywordId, keywordId), eq(rankingsHistory.date, date)))
        .returning();
      return updated;
    }
    return this.createRankingsHistory({ keywordId, date, ...data });
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
}

export const storage = new DatabaseStorage();
