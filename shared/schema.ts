import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, numeric, date, timestamp, jsonb, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const projects = pgTable("projects", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  seoHealthSnapshots: many(seoHealthSnapshots),
  keywords: many(keywords),
  pageMetrics: many(pageMetrics),
  seoRecommendations: many(seoRecommendations),
  competitorMetrics: many(competitorMetrics),
  keywordCompetitorMetrics: many(keywordCompetitorMetrics),
  rankingsHistory: many(rankingsHistory),
  crawlSchedules: many(crawlSchedules),
  importLogs: many(importLogs),
}));

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const locations = pgTable("locations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name").notNull(),
  dataforseoLocationCode: integer("dataforseo_location_code").notNull(),
  languageCode: text("language_code").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const locationsRelations = relations(locations, ({ many }) => ({
  keywords: many(keywords),
  rankingsHistory: many(rankingsHistory),
}));

export const insertLocationSchema = createInsertSchema(locations).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

export const priorityEnum = z.enum(["P1", "P2", "P3"]);
export type Priority = z.infer<typeof priorityEnum>;

export const intentHintEnum = z.enum(["transactional", "commercial", "informational", "navigational", "mixed"]);
export type IntentHint = z.infer<typeof intentHintEnum>;

export const keywords = pgTable("keywords", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
  languageCode: text("language_code"),
  targetUrl: text("target_url"),
  intentHint: text("intent_hint"),
  cluster: text("cluster"),
  trackDaily: boolean("track_daily").default(true).notNull(),
  priority: text("priority").default("P3"),
  isCorePage: boolean("is_core_page").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  difficulty: numeric("difficulty", { precision: 5, scale: 2 }),
  searchVolume: integer("search_volume"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("keywords_project_id_idx").on(table.projectId),
  locationIdIdx: index("keywords_location_id_idx").on(table.locationId),
  isActiveIdx: index("keywords_is_active_idx").on(table.isActive),
  priorityIdx: index("keywords_priority_idx").on(table.priority),
}));

export const keywordsRelations = relations(keywords, ({ one, many }) => ({
  project: one(projects, {
    fields: [keywords.projectId],
    references: [projects.id],
  }),
  location: one(locations, {
    fields: [keywords.locationId],
    references: [locations.id],
  }),
  keywordMetrics: many(keywordMetrics),
  seoRecommendations: many(seoRecommendations),
  rankingsHistory: many(rankingsHistory),
  keywordCompetitorMetrics: many(keywordCompetitorMetrics),
}));

export const insertKeywordSchema = createInsertSchema(keywords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywords.$inferSelect;

export const rankingsHistory = pgTable("rankings_history", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  keywordId: integer("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  position: integer("position"),
  url: text("url"),
  device: text("device").default("desktop"),
  locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
  serpFeatures: jsonb("serp_features").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("rankings_history_project_id_idx").on(table.projectId),
  keywordIdIdx: index("rankings_history_keyword_id_idx").on(table.keywordId),
  dateIdx: index("rankings_history_date_idx").on(table.date),
  keywordDateIdx: index("rankings_history_keyword_date_idx").on(table.keywordId, table.date),
}));

export const rankingsHistoryRelations = relations(rankingsHistory, ({ one }) => ({
  project: one(projects, {
    fields: [rankingsHistory.projectId],
    references: [projects.id],
  }),
  keyword: one(keywords, {
    fields: [rankingsHistory.keywordId],
    references: [keywords.id],
  }),
  location: one(locations, {
    fields: [rankingsHistory.locationId],
    references: [locations.id],
  }),
}));

export const insertRankingsHistorySchema = createInsertSchema(rankingsHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertRankingsHistory = z.infer<typeof insertRankingsHistorySchema>;
export type RankingsHistory = typeof rankingsHistory.$inferSelect;

export const keywordCompetitorMetrics = pgTable("keyword_competitor_metrics", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  keywordId: integer("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  competitorDomain: text("competitor_domain").notNull(),
  competitorUrl: text("competitor_url"),
  latestPosition: integer("latest_position"),
  ourPosition: integer("our_position"),
  avgPosition: numeric("avg_position", { precision: 5, scale: 2 }),
  visibilityScore: numeric("visibility_score", { precision: 5, scale: 2 }),
  serpFeatures: jsonb("serp_features").$type<string[]>(),
  isDirectCompetitor: boolean("is_direct_competitor").default(false),
  clickShareEstimate: numeric("click_share_estimate", { precision: 5, scale: 2 }),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("keyword_competitor_metrics_project_id_idx").on(table.projectId),
  keywordIdIdx: index("keyword_competitor_metrics_keyword_id_idx").on(table.keywordId),
  domainIdx: index("keyword_competitor_metrics_domain_idx").on(table.competitorDomain),
  keywordDomainUnique: unique("keyword_competitor_metrics_keyword_domain_unique").on(table.keywordId, table.competitorDomain),
}));

export const keywordCompetitorMetricsRelations = relations(keywordCompetitorMetrics, ({ one }) => ({
  project: one(projects, {
    fields: [keywordCompetitorMetrics.projectId],
    references: [projects.id],
  }),
  keyword: one(keywords, {
    fields: [keywordCompetitorMetrics.keywordId],
    references: [keywords.id],
  }),
}));

export const insertKeywordCompetitorMetricsSchema = createInsertSchema(keywordCompetitorMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKeywordCompetitorMetrics = z.infer<typeof insertKeywordCompetitorMetricsSchema>;
export type KeywordCompetitorMetrics = typeof keywordCompetitorMetrics.$inferSelect;

export const settingsQuickWins = pgTable("settings_quick_wins", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).references(() => projects.id, { onDelete: "cascade" }),
  minPosition: integer("min_position").default(6).notNull(),
  maxPosition: integer("max_position").default(20).notNull(),
  minVolume: integer("min_volume").default(50).notNull(),
  maxDifficulty: integer("max_difficulty").default(70).notNull(),
  minIntentScore: numeric("min_intent_score", { precision: 5, scale: 2 }),
  minCpc: numeric("min_cpc", { precision: 10, scale: 2 }),
  validIntents: jsonb("valid_intents").$type<string[]>().default(["commercial", "transactional"]).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("settings_quick_wins_project_id_idx").on(table.projectId),
}));

export const insertSettingsQuickWinsSchema = createInsertSchema(settingsQuickWins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSettingsQuickWins = z.infer<typeof insertSettingsQuickWinsSchema>;
export type SettingsQuickWins = typeof settingsQuickWins.$inferSelect;

export const settingsFallingStars = pgTable("settings_falling_stars", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).references(() => projects.id, { onDelete: "cascade" }),
  windowDays: integer("window_days").default(7).notNull(),
  minDropPositions: integer("min_drop_positions").default(5).notNull(),
  minPreviousPosition: integer("min_previous_position").default(10).notNull(),
  minVolume: integer("min_volume").default(0),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("settings_falling_stars_project_id_idx").on(table.projectId),
}));

export const insertSettingsFallingStarsSchema = createInsertSchema(settingsFallingStars).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSettingsFallingStars = z.infer<typeof insertSettingsFallingStarsSchema>;
export type SettingsFallingStars = typeof settingsFallingStars.$inferSelect;

export const settingsPriorityRules = pgTable("settings_priority_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  priority: text("priority").notNull(),
  intents: jsonb("intents").$type<string[]>(),
  maxPosition: integer("max_position"),
  minClicks: integer("min_clicks"),
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSettingsPriorityRulesSchema = createInsertSchema(settingsPriorityRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSettingsPriorityRules = z.infer<typeof insertSettingsPriorityRulesSchema>;
export type SettingsPriorityRules = typeof settingsPriorityRules.$inferSelect;

export const seoHealthSnapshots = pgTable("seo_health_snapshots", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  avgPosition: numeric("avg_position", { precision: 5, scale: 2 }),
  top3Keywords: integer("top3_keywords").default(0),
  top10Keywords: integer("top10_keywords").default(0),
  totalKeywords: integer("total_keywords").default(0),
  authorityScore: numeric("authority_score", { precision: 5, scale: 2 }),
  techScore: numeric("tech_score", { precision: 5, scale: 2 }),
  contentScore: numeric("content_score", { precision: 5, scale: 2 }),
  seoHealthScore: numeric("seo_health_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("seo_health_project_id_idx").on(table.projectId),
  dateIdx: index("seo_health_date_idx").on(table.date),
}));

export const seoHealthSnapshotsRelations = relations(seoHealthSnapshots, ({ one }) => ({
  project: one(projects, {
    fields: [seoHealthSnapshots.projectId],
    references: [projects.id],
  }),
}));

export const insertSeoHealthSnapshotSchema = createInsertSchema(seoHealthSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertSeoHealthSnapshot = z.infer<typeof insertSeoHealthSnapshotSchema>;
export type SeoHealthSnapshot = typeof seoHealthSnapshots.$inferSelect;

export const keywordMetrics = pgTable("keyword_metrics", {
  id: serial("id").primaryKey(),
  keywordId: integer("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  position: integer("position"),
  previousPosition: integer("previous_position"),
  positionDelta: integer("position_delta"),
  searchVolume: integer("search_volume"),
  difficulty: numeric("difficulty", { precision: 5, scale: 2 }),
  intent: text("intent"),
  serpFeatures: jsonb("serp_features").$type<string[]>(),
  opportunityScore: numeric("opportunity_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  keywordIdIdx: index("keyword_metrics_keyword_id_idx").on(table.keywordId),
  dateIdx: index("keyword_metrics_date_idx").on(table.date),
}));

export const keywordMetricsRelations = relations(keywordMetrics, ({ one }) => ({
  keyword: one(keywords, {
    fields: [keywordMetrics.keywordId],
    references: [keywords.id],
  }),
}));

export const insertKeywordMetricsSchema = createInsertSchema(keywordMetrics).omit({
  id: true,
  createdAt: true,
});

export type InsertKeywordMetrics = z.infer<typeof insertKeywordMetricsSchema>;
export type KeywordMetrics = typeof keywordMetrics.$inferSelect;

export const pageMetrics = pgTable("page_metrics", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  date: date("date").notNull(),
  avgPosition: numeric("avg_position", { precision: 5, scale: 2 }),
  bestPosition: integer("best_position"),
  keywordsInTop10: integer("keywords_in_top10").default(0),
  totalKeywords: integer("total_keywords").default(0),
  backlinksCount: integer("backlinks_count").default(0),
  referringDomains: integer("referring_domains").default(0),
  newLinks7d: integer("new_links_7d").default(0),
  lostLinks7d: integer("lost_links_7d").default(0),
  wordCount: integer("word_count"),
  hasSchema: boolean("has_schema").default(false),
  isIndexable: boolean("is_indexable").default(true),
  duplicateContent: boolean("duplicate_content").default(false),
  coreWebVitalsOk: boolean("core_web_vitals_ok").default(true),
  contentGapScore: numeric("content_gap_score", { precision: 5, scale: 2 }),
  techRiskScore: numeric("tech_risk_score", { precision: 5, scale: 2 }),
  authorityGapScore: numeric("authority_gap_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("page_metrics_project_id_idx").on(table.projectId),
  dateIdx: index("page_metrics_date_idx").on(table.date),
}));

export const pageMetricsRelations = relations(pageMetrics, ({ one }) => ({
  project: one(projects, {
    fields: [pageMetrics.projectId],
    references: [projects.id],
  }),
}));

export const insertPageMetricsSchema = createInsertSchema(pageMetrics).omit({
  id: true,
  createdAt: true,
});

export type InsertPageMetrics = z.infer<typeof insertPageMetricsSchema>;
export type PageMetrics = typeof pageMetrics.$inferSelect;

export const seoRecommendations = pgTable("seo_recommendations", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  url: text("url"),
  keywordId: integer("keyword_id").references(() => keywords.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("open").notNull(),
  sourceSignals: jsonb("source_signals"),
  baselineSnapshot: jsonb("baseline_snapshot").$type<Record<string, unknown>>(),
  resultSnapshot: jsonb("result_snapshot").$type<Record<string, unknown>>(),
  impactScore: numeric("impact_score", { precision: 5, scale: 2 }),
  impactSummary: text("impact_summary"),
  baselineCapturedAt: timestamp("baseline_captured_at"),
  resultCapturedAt: timestamp("result_captured_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("seo_recommendations_project_id_idx").on(table.projectId),
  statusIdx: index("seo_recommendations_status_idx").on(table.status),
}));

export const seoRecommendationsRelations = relations(seoRecommendations, ({ one }) => ({
  project: one(projects, {
    fields: [seoRecommendations.projectId],
    references: [projects.id],
  }),
  keyword: one(keywords, {
    fields: [seoRecommendations.keywordId],
    references: [keywords.id],
  }),
}));

export const insertSeoRecommendationSchema = createInsertSchema(seoRecommendations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSeoRecommendation = z.infer<typeof insertSeoRecommendationSchema>;
export type SeoRecommendation = typeof seoRecommendations.$inferSelect;

export const competitorMetrics = pgTable("competitor_metrics", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  competitorDomain: text("competitor_domain").notNull(),
  date: date("date").notNull(),
  sharedKeywords: integer("shared_keywords").default(0),
  aboveUsKeywords: integer("above_us_keywords").default(0),
  authorityScore: numeric("authority_score", { precision: 5, scale: 2 }),
  avgPosition: numeric("avg_position", { precision: 5, scale: 2 }),
  pressureIndex: numeric("pressure_index", { precision: 6, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("competitor_metrics_project_id_idx").on(table.projectId),
  dateIdx: index("competitor_metrics_date_idx").on(table.date),
}));

export const competitorMetricsRelations = relations(competitorMetrics, ({ one }) => ({
  project: one(projects, {
    fields: [competitorMetrics.projectId],
    references: [projects.id],
  }),
}));

export const insertCompetitorMetricsSchema = createInsertSchema(competitorMetrics).omit({
  id: true,
  createdAt: true,
});

export type InsertCompetitorMetrics = z.infer<typeof insertCompetitorMetricsSchema>;
export type CompetitorMetrics = typeof competitorMetrics.$inferSelect;

export const importLogs = pgTable("import_logs", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).references(() => projects.id, { onDelete: "cascade" }),
  importType: text("import_type").notNull(),
  fileName: text("file_name"),
  userIdentifier: text("user_identifier").default("system"),
  rowsTotal: integer("rows_total").default(0),
  rowsSuccess: integer("rows_success").default(0),
  rowsFailed: integer("rows_failed").default(0),
  recordsProcessed: integer("records_processed").default(0),
  recordsInserted: integer("records_inserted").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsSkipped: integer("records_skipped").default(0),
  errors: jsonb("errors").$type<string[]>(),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  status: text("status").default("pending").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  projectIdIdx: index("import_logs_project_id_idx").on(table.projectId),
  importTypeIdx: index("import_logs_import_type_idx").on(table.importType),
}));

export const insertImportLogSchema = createInsertSchema(importLogs).omit({
  id: true,
});

export type InsertImportLog = z.infer<typeof insertImportLogSchema>;
export type ImportLog = typeof importLogs.$inferSelect;

export const recommendationStatusEnum = z.enum(["open", "in_progress", "done", "dismissed"]);
export type RecommendationStatus = z.infer<typeof recommendationStatusEnum>;

export const recommendationTypeEnum = z.enum([
  "content_refresh",
  "add_schema",
  "build_links",
  "fix_indexability",
  "fix_duplicate_content",
  "optimize_meta",
  "improve_cwv",
  "add_internal_links",
]);
export type RecommendationType = z.infer<typeof recommendationTypeEnum>;

export const severityEnum = z.enum(["low", "medium", "high"]);
export type Severity = z.infer<typeof severityEnum>;

export const intentEnum = z.enum(["informational", "commercial", "transactional", "navigational"]);
export type Intent = z.infer<typeof intentEnum>;

export const healthStatusEnum = z.enum(["healthy", "at_risk", "declining"]);
export type HealthStatus = z.infer<typeof healthStatusEnum>;

export const crawlTypeEnum = z.enum(["keyword_ranks", "competitors", "pages_health", "deep_discovery"]);
export type CrawlType = z.infer<typeof crawlTypeEnum>;

export const crawlFrequencyEnum = z.enum(["daily", "twice_weekly", "weekly", "monthly", "custom"]);
export type CrawlFrequency = z.infer<typeof crawlFrequencyEnum>;

export const crawlSchedules = pgTable("crawl_schedules", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("keyword_ranks"),
  url: text("url"),
  frequency: text("frequency").default("daily"),
  scheduledTime: text("scheduled_time").notNull(),
  daysOfWeek: jsonb("days_of_week").$type<number[]>().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  config: jsonb("config").$type<Record<string, unknown>>(),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  lastRunStatus: text("last_run_status"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("crawl_schedules_project_id_idx").on(table.projectId),
  isActiveIdx: index("crawl_schedules_is_active_idx").on(table.isActive),
  typeIdx: index("crawl_schedules_type_idx").on(table.type),
}));

export const crawlSchedulesRelations = relations(crawlSchedules, ({ one }) => ({
  project: one(projects, {
    fields: [crawlSchedules.projectId],
    references: [projects.id],
  }),
}));

export const insertCrawlScheduleSchema = createInsertSchema(crawlSchedules).omit({
  id: true,
  lastRunAt: true,
  nextRunAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrawlSchedule = z.infer<typeof insertCrawlScheduleSchema>;
export type CrawlSchedule = typeof crawlSchedules.$inferSelect;

export const crawlResultStatusEnum = z.enum(["running", "success", "failed", "error"]);
export type CrawlResultStatus = z.infer<typeof crawlResultStatusEnum>;

export const crawlResults = pgTable("crawl_results", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  scheduleId: integer("schedule_id").references(() => crawlSchedules.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("running"),
  message: text("message"),
  keywordsProcessed: integer("keywords_processed").default(0),
  keywordsUpdated: integer("keywords_updated").default(0),
  errorsCount: integer("errors_count").default(0),
  duration: integer("duration"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  projectIdIdx: index("crawl_results_project_id_idx").on(table.projectId),
  scheduleIdIdx: index("crawl_results_schedule_id_idx").on(table.scheduleId),
  statusIdx: index("crawl_results_status_idx").on(table.status),
  startedAtIdx: index("crawl_results_started_at_idx").on(table.startedAt),
}));

export const crawlResultsRelations = relations(crawlResults, ({ one }) => ({
  project: one(projects, {
    fields: [crawlResults.projectId],
    references: [projects.id],
  }),
  schedule: one(crawlSchedules, {
    fields: [crawlResults.scheduleId],
    references: [crawlSchedules.id],
  }),
}));

export const insertCrawlResultSchema = createInsertSchema(crawlResults).omit({
  id: true,
  startedAt: true,
});

export type InsertCrawlResult = z.infer<typeof insertCrawlResultSchema>;
export type CrawlResult = typeof crawlResults.$inferSelect;
