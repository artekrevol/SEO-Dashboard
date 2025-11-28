import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, numeric, date, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  seoHealthSnapshots: many(seoHealthSnapshots),
  keywords: many(keywords),
  pageMetrics: many(pageMetrics),
  seoRecommendations: many(seoRecommendations),
  competitorMetrics: many(competitorMetrics),
}));

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const keywords = pgTable("keywords", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  cluster: text("cluster"),
  targetUrl: text("target_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("keywords_project_id_idx").on(table.projectId),
}));

export const keywordsRelations = relations(keywords, ({ one, many }) => ({
  project: one(projects, {
    fields: [keywords.projectId],
    references: [projects.id],
  }),
  keywordMetrics: many(keywordMetrics),
  seoRecommendations: many(seoRecommendations),
}));

export const insertKeywordSchema = createInsertSchema(keywords).omit({
  id: true,
  createdAt: true,
});

export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywords.$inferSelect;

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
