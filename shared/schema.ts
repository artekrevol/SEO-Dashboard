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

export const backlinks = pgTable("backlinks", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  targetUrl: text("target_url").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceDomain: text("source_domain").notNull(),
  anchorText: text("anchor_text"),
  linkType: text("link_type").default("dofollow").notNull(),
  isLive: boolean("is_live").default(true).notNull(),
  domainAuthority: integer("domain_authority"),
  pageAuthority: integer("page_authority"),
  spamScore: integer("spam_score"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  lostAt: timestamp("lost_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("backlinks_project_id_idx").on(table.projectId),
  targetUrlIdx: index("backlinks_target_url_idx").on(table.targetUrl),
  sourceDomainIdx: index("backlinks_source_domain_idx").on(table.sourceDomain),
  isLiveIdx: index("backlinks_is_live_idx").on(table.isLive),
  firstSeenAtIdx: index("backlinks_first_seen_at_idx").on(table.firstSeenAt),
  spamScoreIdx: index("backlinks_spam_score_idx").on(table.spamScore),
}));

export const backlinksRelations = relations(backlinks, ({ one }) => ({
  project: one(projects, {
    fields: [backlinks.projectId],
    references: [projects.id],
  }),
}));

export const insertBacklinkSchema = createInsertSchema(backlinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBacklink = z.infer<typeof insertBacklinkSchema>;
export type Backlink = typeof backlinks.$inferSelect;

// Backlinks History - Daily snapshots of backlink metrics for trend tracking
export const backlinksHistory = pgTable("backlinks_history", {
  id: serial("id").primaryKey(),
  backlinkId: integer("backlink_id").notNull().references(() => backlinks.id, { onDelete: "cascade" }),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  isLive: boolean("is_live").default(true).notNull(),
  domainAuthority: integer("domain_authority"),
  pageAuthority: integer("page_authority"),
  spamScore: integer("spam_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  backlinkIdIdx: index("backlinks_history_backlink_id_idx").on(table.backlinkId),
  projectIdIdx: index("backlinks_history_project_id_idx").on(table.projectId),
  dateIdx: index("backlinks_history_date_idx").on(table.date),
}));

export const backlinksHistoryRelations = relations(backlinksHistory, ({ one }) => ({
  backlink: one(backlinks, {
    fields: [backlinksHistory.backlinkId],
    references: [backlinks.id],
  }),
  project: one(projects, {
    fields: [backlinksHistory.projectId],
    references: [projects.id],
  }),
}));

export const insertBacklinksHistorySchema = createInsertSchema(backlinksHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertBacklinksHistory = z.infer<typeof insertBacklinksHistorySchema>;
export type BacklinksHistory = typeof backlinksHistory.$inferSelect;

export const competitorBacklinks = pgTable("competitor_backlinks", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  competitorDomain: text("competitor_domain").notNull(),
  targetUrl: text("target_url").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceDomain: text("source_domain").notNull(),
  anchorText: text("anchor_text"),
  linkType: text("link_type").default("dofollow").notNull(),
  isLive: boolean("is_live").default(true).notNull(),
  domainAuthority: integer("domain_authority"),
  pageAuthority: integer("page_authority"),
  spamScore: integer("spam_score"),
  isOpportunity: boolean("is_opportunity").default(false),
  opportunityScore: numeric("opportunity_score", { precision: 5, scale: 2 }),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  lostAt: timestamp("lost_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("competitor_backlinks_project_id_idx").on(table.projectId),
  competitorDomainIdx: index("competitor_backlinks_competitor_domain_idx").on(table.competitorDomain),
  sourceDomainIdx: index("competitor_backlinks_source_domain_idx").on(table.sourceDomain),
  isOpportunityIdx: index("competitor_backlinks_is_opportunity_idx").on(table.isOpportunity),
  domainAuthorityIdx: index("competitor_backlinks_domain_authority_idx").on(table.domainAuthority),
}));

export const competitorBacklinksRelations = relations(competitorBacklinks, ({ one }) => ({
  project: one(projects, {
    fields: [competitorBacklinks.projectId],
    references: [projects.id],
  }),
}));

export const insertCompetitorBacklinkSchema = createInsertSchema(competitorBacklinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompetitorBacklink = z.infer<typeof insertCompetitorBacklinkSchema>;
export type CompetitorBacklink = typeof competitorBacklinks.$inferSelect;

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

export const crawlTypeEnum = z.enum(["keyword_ranks", "competitors", "pages_health", "deep_discovery", "backlinks", "competitor_backlinks", "tech_audit"]);
export type CrawlType = z.infer<typeof crawlTypeEnum>;

export const backlinkTypeEnum = z.enum(["dofollow", "nofollow", "ugc", "sponsored"]);
export type BacklinkType = z.infer<typeof backlinkTypeEnum>;

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
  triggerType: text("trigger_type").default("scheduled").notNull(), // 'scheduled' or 'manual'
  message: text("message"),
  currentStage: text("current_stage"), // e.g., 'fetching_keywords', 'processing_rankings', 'saving_results'
  itemsTotal: integer("items_total").default(0),
  itemsProcessed: integer("items_processed").default(0),
  keywordsProcessed: integer("keywords_processed").default(0),
  keywordsUpdated: integer("keywords_updated").default(0),
  errorsCount: integer("errors_count").default(0),
  estimatedDurationSec: integer("estimated_duration_sec"),
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

// Technical SEO Suite - OnPage Crawl Tracking
export const techCrawlStatusEnum = z.enum(["queued", "running", "completed", "failed"]);
export type TechCrawlStatus = z.infer<typeof techCrawlStatusEnum>;

export const techCrawls = pgTable("tech_crawls", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  onpageTaskId: text("onpage_task_id"),
  targetDomain: text("target_domain").notNull(),
  maxPages: integer("max_pages").default(500),
  crawlScope: text("crawl_scope").default("full_site"),
  status: text("status").default("queued").notNull(),
  pagesCrawled: integer("pages_crawled").default(0),
  pagesWithIssues: integer("pages_with_issues").default(0),
  criticalIssuesCount: integer("critical_issues_count").default(0),
  warningsCount: integer("warnings_count").default(0),
  avgOnpageScore: numeric("avg_onpage_score", { precision: 5, scale: 2 }),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("tech_crawls_project_id_idx").on(table.projectId),
  statusIdx: index("tech_crawls_status_idx").on(table.status),
  startedAtIdx: index("tech_crawls_started_at_idx").on(table.startedAt),
}));

export const techCrawlsRelations = relations(techCrawls, ({ one, many }) => ({
  project: one(projects, {
    fields: [techCrawls.projectId],
    references: [projects.id],
  }),
  pageAudits: many(pageAudits),
}));

export const insertTechCrawlSchema = createInsertSchema(techCrawls).omit({
  id: true,
  createdAt: true,
});

export type InsertTechCrawl = z.infer<typeof insertTechCrawlSchema>;
export type TechCrawl = typeof techCrawls.$inferSelect;

// Page Audits - Per-page technical audit data from OnPage API
export const pageAudits = pgTable("page_audits", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  techCrawlId: integer("tech_crawl_id").references(() => techCrawls.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  onpageScore: numeric("onpage_score", { precision: 5, scale: 2 }),
  statusCode: integer("status_code"),
  isIndexable: boolean("is_indexable").default(true),
  indexabilityReason: text("indexability_reason"),
  canonicalUrl: text("canonical_url"),
  title: text("title"),
  titleLength: integer("title_length"),
  description: text("description"),
  descriptionLength: integer("description_length"),
  h1Count: integer("h1_count").default(0),
  h2Count: integer("h2_count").default(0),
  wordCount: integer("word_count").default(0),
  readabilityScore: numeric("readability_score", { precision: 5, scale: 2 }),
  contentRate: numeric("content_rate", { precision: 5, scale: 2 }),
  pageSizeKb: numeric("page_size_kb", { precision: 10, scale: 2 }),
  loadTimeMs: integer("load_time_ms"),
  lcpMs: integer("lcp_ms"),
  clsScore: numeric("cls_score", { precision: 5, scale: 4 }),
  tbtMs: integer("tbt_ms"),
  fidMs: integer("fid_ms"),
  internalLinksCount: integer("internal_links_count").default(0),
  externalLinksCount: integer("external_links_count").default(0),
  brokenLinksCount: integer("broken_links_count").default(0),
  imagesCount: integer("images_count").default(0),
  imagesWithoutAlt: integer("images_without_alt").default(0),
  hasSchema: boolean("has_schema").default(false),
  schemaTypes: jsonb("schema_types").$type<string[]>(),
  isOrphanPage: boolean("is_orphan_page").default(false),
  clickDepth: integer("click_depth"),
  techRiskLevel: text("tech_risk_level").default("low"),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("page_audits_project_id_idx").on(table.projectId),
  techCrawlIdIdx: index("page_audits_tech_crawl_id_idx").on(table.techCrawlId),
  urlIdx: index("page_audits_url_idx").on(table.url),
  onpageScoreIdx: index("page_audits_onpage_score_idx").on(table.onpageScore),
  techRiskLevelIdx: index("page_audits_tech_risk_level_idx").on(table.techRiskLevel),
}));

export const pageAuditsRelations = relations(pageAudits, ({ one, many }) => ({
  project: one(projects, {
    fields: [pageAudits.projectId],
    references: [projects.id],
  }),
  techCrawl: one(techCrawls, {
    fields: [pageAudits.techCrawlId],
    references: [techCrawls.id],
  }),
  issues: many(pageIssues),
}));

export const insertPageAuditSchema = createInsertSchema(pageAudits).omit({
  id: true,
  createdAt: true,
});

export type InsertPageAudit = z.infer<typeof insertPageAuditSchema>;
export type PageAudit = typeof pageAudits.$inferSelect;

// Page Issues - Normalized issue list per page
export const issueSeverityEnum = z.enum(["critical", "warning", "info"]);
export type IssueSeverity = z.infer<typeof issueSeverityEnum>;

export const issueCategoryEnum = z.enum(["indexability", "content", "links", "performance", "html", "images", "security", "other"]);
export type IssueCategory = z.infer<typeof issueCategoryEnum>;

export const pageIssues = pgTable("page_issues", {
  id: serial("id").primaryKey(),
  pageAuditId: integer("page_audit_id").notNull().references(() => pageAudits.id, { onDelete: "cascade" }),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  issueCode: text("issue_code").notNull(),
  issueLabel: text("issue_label").notNull(),
  severity: text("severity").notNull(),
  category: text("category").notNull(),
  occurrences: integer("occurrences").default(1),
  affectedElements: jsonb("affected_elements").$type<string[]>(),
  sampleData: jsonb("sample_data").$type<Record<string, unknown>>(),
  recommendationCreated: boolean("recommendation_created").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pageAuditIdIdx: index("page_issues_page_audit_id_idx").on(table.pageAuditId),
  projectIdIdx: index("page_issues_project_id_idx").on(table.projectId),
  issueCodeIdx: index("page_issues_issue_code_idx").on(table.issueCode),
  severityIdx: index("page_issues_severity_idx").on(table.severity),
  categoryIdx: index("page_issues_category_idx").on(table.category),
}));

export const pageIssuesRelations = relations(pageIssues, ({ one }) => ({
  pageAudit: one(pageAudits, {
    fields: [pageIssues.pageAuditId],
    references: [pageAudits.id],
  }),
  project: one(projects, {
    fields: [pageIssues.projectId],
    references: [projects.id],
  }),
}));

export const insertPageIssueSchema = createInsertSchema(pageIssues).omit({
  id: true,
  createdAt: true,
});

export type InsertPageIssue = z.infer<typeof insertPageIssueSchema>;
export type PageIssue = typeof pageIssues.$inferSelect;

// Global Settings - System-wide configuration including timezone
export const globalSettings = pgTable("global_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGlobalSettingSchema = createInsertSchema(globalSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertGlobalSetting = z.infer<typeof insertGlobalSettingSchema>;
export type GlobalSetting = typeof globalSettings.$inferSelect;

// Crawl type estimated durations in seconds (used for progress estimation)
export const crawlTypeDurations: Record<string, number> = {
  keyword_ranks: 120,      // ~2 minutes for typical keyword batch
  competitors: 180,        // ~3 minutes for competitor analysis
  pages_health: 90,        // ~1.5 minutes for page metrics
  deep_discovery: 300,     // ~5 minutes for deep keyword discovery
  backlinks: 240,          // ~4 minutes for backlink crawl
  competitor_backlinks: 300, // ~5 minutes for competitor backlinks
  tech_audit: 600,         // ~10 minutes for technical audit
};

// Crawl concurrency rules - which crawl types can run simultaneously
export const crawlConcurrencyRules = {
  // Only one of each type can run per project at a time
  maxPerTypePerProject: 1,
  // Global limits across all projects
  globalLimits: {
    keyword_ranks: 2,
    competitors: 2,
    pages_health: 2,
    deep_discovery: 1,
    backlinks: 2,
    competitor_backlinks: 1,
    tech_audit: 1,
  },
};

// ============================================
// SCHEDULED REPORTS - Email Delivery System
// ============================================

export const reportTypeEnum = z.enum(["weekly_summary", "monthly_report", "keyword_changes", "competitor_analysis", "technical_audit", "custom"]);
export type ReportType = z.infer<typeof reportTypeEnum>;

export const reportFrequencyEnum = z.enum(["daily", "weekly", "biweekly", "monthly"]);
export type ReportFrequency = z.infer<typeof reportFrequencyEnum>;

export const scheduledReports = pgTable("scheduled_reports", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  reportType: text("report_type").notNull(),
  frequency: text("frequency").notNull(),
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"),
  timeOfDay: text("time_of_day").default("09:00"),
  timezone: text("timezone").default("America/Chicago"),
  recipients: jsonb("recipients").$type<string[]>().notNull(),
  includeExecutiveSummary: boolean("include_executive_summary").default(true),
  includeTrends: boolean("include_trends").default(true),
  includeRecommendations: boolean("include_recommendations").default(true),
  includeCompetitors: boolean("include_competitors").default(false),
  customSections: jsonb("custom_sections").$type<string[]>(),
  isActive: boolean("is_active").default(true).notNull(),
  lastSentAt: timestamp("last_sent_at"),
  nextScheduledAt: timestamp("next_scheduled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("scheduled_reports_project_id_idx").on(table.projectId),
  isActiveIdx: index("scheduled_reports_is_active_idx").on(table.isActive),
  nextScheduledAtIdx: index("scheduled_reports_next_scheduled_idx").on(table.nextScheduledAt),
}));

export const scheduledReportsRelations = relations(scheduledReports, ({ one, many }) => ({
  project: one(projects, {
    fields: [scheduledReports.projectId],
    references: [projects.id],
  }),
  runs: many(reportRuns),
}));

export const insertScheduledReportSchema = createInsertSchema(scheduledReports).omit({
  id: true,
  lastSentAt: true,
  nextScheduledAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertScheduledReport = z.infer<typeof insertScheduledReportSchema>;
export type ScheduledReport = typeof scheduledReports.$inferSelect;

export const reportRunStatusEnum = z.enum(["pending", "generating", "sending", "completed", "failed"]);
export type ReportRunStatus = z.infer<typeof reportRunStatusEnum>;

export const reportRuns = pgTable("report_runs", {
  id: serial("id").primaryKey(),
  scheduledReportId: integer("scheduled_report_id").references(() => scheduledReports.id, { onDelete: "cascade" }),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull(),
  status: text("status").notNull().default("pending"),
  triggerType: text("trigger_type").default("scheduled"),
  recipients: jsonb("recipients").$type<string[]>(),
  reportData: jsonb("report_data").$type<Record<string, unknown>>(),
  pdfUrl: text("pdf_url"),
  emailsSent: integer("emails_sent").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  scheduledReportIdIdx: index("report_runs_scheduled_report_id_idx").on(table.scheduledReportId),
  projectIdIdx: index("report_runs_project_id_idx").on(table.projectId),
  statusIdx: index("report_runs_status_idx").on(table.status),
  startedAtIdx: index("report_runs_started_at_idx").on(table.startedAt),
}));

export const reportRunsRelations = relations(reportRuns, ({ one }) => ({
  scheduledReport: one(scheduledReports, {
    fields: [reportRuns.scheduledReportId],
    references: [scheduledReports.id],
  }),
  project: one(projects, {
    fields: [reportRuns.projectId],
    references: [projects.id],
  }),
}));

export const insertReportRunSchema = createInsertSchema(reportRuns).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export type InsertReportRun = z.infer<typeof insertReportRunSchema>;
export type ReportRun = typeof reportRuns.$inferSelect;

// ============================================
// GOOGLE SEARCH CONSOLE INTEGRATION
// ============================================

export const gscCredentials = pgTable("gsc_credentials", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }).unique(),
  siteUrl: text("site_url").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scope: text("scope"),
  isConnected: boolean("is_connected").default(false).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  syncErrorMessage: text("sync_error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("gsc_credentials_project_id_idx").on(table.projectId),
}));

export const gscCredentialsRelations = relations(gscCredentials, ({ one }) => ({
  project: one(projects, {
    fields: [gscCredentials.projectId],
    references: [projects.id],
  }),
}));

export const insertGscCredentialsSchema = createInsertSchema(gscCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGscCredentials = z.infer<typeof insertGscCredentialsSchema>;
export type GscCredentials = typeof gscCredentials.$inferSelect;

export const gscQueryStats = pgTable("gsc_query_stats", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  page: text("page"),
  date: date("date").notNull(),
  clicks: integer("clicks").default(0),
  impressions: integer("impressions").default(0),
  ctr: numeric("ctr", { precision: 6, scale: 4 }),
  position: numeric("position", { precision: 5, scale: 2 }),
  country: text("country"),
  device: text("device"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("gsc_query_stats_project_id_idx").on(table.projectId),
  queryIdx: index("gsc_query_stats_query_idx").on(table.query),
  pageIdx: index("gsc_query_stats_page_idx").on(table.page),
  dateIdx: index("gsc_query_stats_date_idx").on(table.date),
  uniqueQueryDate: unique("gsc_query_stats_unique").on(table.projectId, table.query, table.page, table.date),
}));

export const gscQueryStatsRelations = relations(gscQueryStats, ({ one }) => ({
  project: one(projects, {
    fields: [gscQueryStats.projectId],
    references: [projects.id],
  }),
}));

export const insertGscQueryStatsSchema = createInsertSchema(gscQueryStats).omit({
  id: true,
  createdAt: true,
});

export type InsertGscQueryStats = z.infer<typeof insertGscQueryStatsSchema>;
export type GscQueryStats = typeof gscQueryStats.$inferSelect;

export const urlInspectionStatusEnum = z.enum(["indexed", "not_indexed", "pending", "error", "blocked"]);
export type UrlInspectionStatus = z.infer<typeof urlInspectionStatusEnum>;

export const gscUrlInspection = pgTable("gsc_url_inspection", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  indexingStatus: text("indexing_status"),
  coverageState: text("coverage_state"),
  robotsTxtState: text("robots_txt_state"),
  indexingState: text("indexing_state"),
  lastCrawlTime: timestamp("last_crawl_time"),
  pageFetchState: text("page_fetch_state"),
  googleCanonical: text("google_canonical"),
  userCanonical: text("user_canonical"),
  mobileUsability: text("mobile_usability"),
  richResultsStatus: text("rich_results_status"),
  richResultsItems: jsonb("rich_results_items").$type<Record<string, unknown>[]>(),
  lastInspectedAt: timestamp("last_inspected_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("gsc_url_inspection_project_id_idx").on(table.projectId),
  urlIdx: index("gsc_url_inspection_url_idx").on(table.url),
  indexingStatusIdx: index("gsc_url_inspection_indexing_status_idx").on(table.indexingStatus),
  uniqueProjectUrl: unique("gsc_url_inspection_unique").on(table.projectId, table.url),
}));

export const gscUrlInspectionRelations = relations(gscUrlInspection, ({ one }) => ({
  project: one(projects, {
    fields: [gscUrlInspection.projectId],
    references: [projects.id],
  }),
}));

export const insertGscUrlInspectionSchema = createInsertSchema(gscUrlInspection).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGscUrlInspection = z.infer<typeof insertGscUrlInspectionSchema>;
export type GscUrlInspection = typeof gscUrlInspection.$inferSelect;

// ============================================
// CANNIBALIZATION DETECTION
// ============================================

export const conflictSeverityEnum = z.enum(["high", "medium", "low"]);
export type ConflictSeverity = z.infer<typeof conflictSeverityEnum>;

export const conflictStatusEnum = z.enum(["active", "resolved", "ignored"]);
export type ConflictStatus = z.infer<typeof conflictStatusEnum>;

export const keywordPageConflicts = pgTable("keyword_page_conflicts", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  keywordId: integer("keyword_id").references(() => keywords.id, { onDelete: "set null" }),
  primaryUrl: text("primary_url").notNull(),
  conflictingUrl: text("conflicting_url").notNull(),
  primaryPosition: integer("primary_position"),
  conflictingPosition: integer("conflicting_position"),
  searchVolume: integer("search_volume"),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("active"),
  conflictType: text("conflict_type").notNull(),
  suggestedAction: text("suggested_action"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("keyword_page_conflicts_project_id_idx").on(table.projectId),
  keywordIdx: index("keyword_page_conflicts_keyword_idx").on(table.keyword),
  severityIdx: index("keyword_page_conflicts_severity_idx").on(table.severity),
  statusIdx: index("keyword_page_conflicts_status_idx").on(table.status),
  uniqueConflict: unique("keyword_page_conflicts_unique").on(table.projectId, table.keyword, table.primaryUrl, table.conflictingUrl),
}));

export const keywordPageConflictsRelations = relations(keywordPageConflicts, ({ one }) => ({
  project: one(projects, {
    fields: [keywordPageConflicts.projectId],
    references: [projects.id],
  }),
  keywordRef: one(keywords, {
    fields: [keywordPageConflicts.keywordId],
    references: [keywords.id],
  }),
}));

export const insertKeywordPageConflictSchema = createInsertSchema(keywordPageConflicts).omit({
  id: true,
  detectedAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKeywordPageConflict = z.infer<typeof insertKeywordPageConflictSchema>;
export type KeywordPageConflict = typeof keywordPageConflicts.$inferSelect;

// ============================================
// TASK EXECUTION LOGS
// ============================================

export const taskLogLevelEnum = z.enum(["debug", "info", "warn", "error"]);
export type TaskLogLevel = z.infer<typeof taskLogLevelEnum>;

export const taskLogCategoryEnum = z.enum([
  "crawl",
  "sync",
  "import",
  "export",
  "api",
  "scheduled_job",
  "report",
  "gsc",
  "system"
]);
export type TaskLogCategory = z.infer<typeof taskLogCategoryEnum>;

export const taskExecutionLogs = pgTable("task_execution_logs", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).references(() => projects.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull(),
  taskType: text("task_type").notNull(),
  category: text("category").notNull().default("system"),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  details: jsonb("details"),
  errorStack: text("error_stack"),
  crawlResultId: integer("crawl_result_id").references(() => crawlResults.id, { onDelete: "set null" }),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("task_execution_logs_project_id_idx").on(table.projectId),
  taskIdIdx: index("task_execution_logs_task_id_idx").on(table.taskId),
  taskTypeIdx: index("task_execution_logs_task_type_idx").on(table.taskType),
  categoryIdx: index("task_execution_logs_category_idx").on(table.category),
  levelIdx: index("task_execution_logs_level_idx").on(table.level),
  createdAtIdx: index("task_execution_logs_created_at_idx").on(table.createdAt),
}));

export const taskExecutionLogsRelations = relations(taskExecutionLogs, ({ one }) => ({
  project: one(projects, {
    fields: [taskExecutionLogs.projectId],
    references: [projects.id],
  }),
  crawlResult: one(crawlResults, {
    fields: [taskExecutionLogs.crawlResultId],
    references: [crawlResults.id],
  }),
}));

export const insertTaskExecutionLogSchema = createInsertSchema(taskExecutionLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskExecutionLog = z.infer<typeof insertTaskExecutionLogSchema>;
export type TaskExecutionLog = typeof taskExecutionLogs.$inferSelect;

// ============================================
// APP VERSIONS / RELEASE NOTES
// ============================================

export const appVersions = pgTable("app_versions", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  releaseNotes: text("release_notes").notNull(),
  changeType: varchar("change_type", { length: 50 }).notNull().default("feature"),
  isPublished: boolean("is_published").default(true),
  releasedAt: timestamp("released_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  versionIdx: index("app_versions_version_idx").on(table.version),
  releasedAtIdx: index("app_versions_released_at_idx").on(table.releasedAt),
}));

export const insertAppVersionSchema = createInsertSchema(appVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertAppVersion = z.infer<typeof insertAppVersionSchema>;
export type AppVersion = typeof appVersions.$inferSelect;
