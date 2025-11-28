import type { InsertSeoRecommendation, KeywordMetrics, PageMetrics, Keyword } from "@shared/schema";

type RecommendationSeverity = "low" | "medium" | "high";

interface KeywordWithMetrics extends KeywordMetrics {
  keywordText?: string;
  url?: string;
}

interface RecommendationTemplate {
  type: string;
  title: string;
  severity: RecommendationSeverity;
  generateDescription: (context: Record<string, unknown>) => string;
}

const RECOMMENDATION_TEMPLATES: RecommendationTemplate[] = [
  {
    type: "content_refresh",
    title: "Refresh Outdated Content",
    severity: "medium",
    generateDescription: (ctx) => 
      `Page "${ctx.url}" has dropped ${ctx.positionDelta} positions. Consider updating content with fresh information, adding new sections, or improving keyword targeting.`,
  },
  {
    type: "add_schema",
    title: "Add Schema Markup",
    severity: "low",
    generateDescription: (ctx) => 
      `Page "${ctx.url}" lacks structured data. Add ${ctx.schemaType || "Article"} schema to improve SERP appearance and click-through rates.`,
  },
  {
    type: "fix_indexability",
    title: "Fix Indexability Issues",
    severity: "high",
    generateDescription: (ctx) => 
      `Page "${ctx.url}" has indexability issues: ${ctx.issues}. Fix immediately to ensure search engines can crawl and index the page.`,
  },
  {
    type: "build_links",
    title: "Build Quality Backlinks",
    severity: "medium",
    generateDescription: (ctx) => 
      `Page "${ctx.url}" has low backlink count (${ctx.backlinks}). Target quality backlinks to improve authority.`,
  },
  {
    type: "optimize_meta",
    title: "Optimize Keyword Targeting",
    severity: "low",
    generateDescription: (ctx) => 
      `Keyword "${ctx.keyword}" shows high opportunity (score: ${ctx.opportunityScore}). Create or optimize content targeting this keyword with ${ctx.searchVolume?.toLocaleString() || "high"} monthly searches.`,
  },
  {
    type: "fix_duplicate_content",
    title: "Resolve Duplicate Content",
    severity: "high",
    generateDescription: (ctx) => 
      `Duplicate content detected on "${ctx.url}". Use canonical tags or consolidate content to prevent ranking dilution.`,
  },
  {
    type: "improve_cwv",
    title: "Improve Core Web Vitals",
    severity: "medium",
    generateDescription: (ctx) => 
      `Page "${ctx.url}" has poor Core Web Vitals. Optimize images, reduce JavaScript, and improve server response time.`,
  },
  {
    type: "add_internal_links",
    title: "Add Internal Links",
    severity: "low",
    generateDescription: (ctx) => 
      `Page "${ctx.url}" could benefit from more internal links to distribute authority and improve crawlability.`,
  },
];

export function generateRecommendationsFromKeywords(
  projectId: string,
  metrics: KeywordMetrics[],
  keywordsMap: Map<number, Keyword>
): InsertSeoRecommendation[] {
  const recommendations: InsertSeoRecommendation[] = [];

  for (const metric of metrics) {
    const keyword = keywordsMap.get(metric.keywordId);
    const opportunityScore = Number(metric.opportunityScore) || 0;
    const position = metric.position || 100;
    const positionDelta = metric.positionDelta || 0;

    if (opportunityScore >= 70 && position > 10) {
      const template = RECOMMENDATION_TEMPLATES.find(t => t.type === "optimize_meta")!;
      recommendations.push({
        projectId,
        type: template.type,
        severity: template.severity,
        title: template.title,
        description: template.generateDescription({
          keyword: keyword?.keyword || `Keyword #${metric.keywordId}`,
          opportunityScore,
          searchVolume: metric.searchVolume,
        }),
        status: "open",
        keywordId: metric.keywordId,
      });
    }

    if (positionDelta > 5 && position <= 30) {
      const template = RECOMMENDATION_TEMPLATES.find(t => t.type === "content_refresh")!;
      recommendations.push({
        projectId,
        type: template.type,
        severity: positionDelta > 10 ? "high" : "medium",
        title: template.title,
        description: template.generateDescription({
          url: keyword?.targetUrl || "targeted page",
          positionDelta,
        }),
        status: "open",
        keywordId: metric.keywordId,
        url: keyword?.targetUrl,
      });
    }

    if (position <= 5 && metric.serpFeatures?.includes("featured_snippet")) {
      recommendations.push({
        projectId,
        type: "optimize_meta",
        severity: "low",
        title: "Target Featured Snippet",
        description: `Keyword "${keyword?.keyword || metric.keywordId}" has featured snippet opportunity. Page ranks at position ${position}. Structure content with clear headers, lists, or tables to win the snippet.`,
        status: "open",
        keywordId: metric.keywordId,
      });
    }
  }

  return recommendations;
}

export function generateRecommendationsFromPages(
  projectId: string,
  pages: PageMetrics[]
): InsertSeoRecommendation[] {
  const recommendations: InsertSeoRecommendation[] = [];

  for (const page of pages) {
    const bestPosition = page.bestPosition || 100;
    const backlinks = page.backlinksCount || 0;

    if (!page.hasSchema) {
      const template = RECOMMENDATION_TEMPLATES.find(t => t.type === "add_schema")!;
      recommendations.push({
        projectId,
        type: template.type,
        severity: template.severity,
        title: template.title,
        description: template.generateDescription({
          url: page.url,
          schemaType: "Article",
        }),
        status: "open",
        url: page.url,
      });
    }

    if (!page.isIndexable) {
      const template = RECOMMENDATION_TEMPLATES.find(t => t.type === "fix_indexability")!;
      recommendations.push({
        projectId,
        type: template.type,
        severity: template.severity,
        title: template.title,
        description: template.generateDescription({
          url: page.url,
          issues: "Page is not indexable - check robots.txt, meta robots, or canonical tags",
        }),
        status: "open",
        url: page.url,
      });
    }

    if (backlinks < 5 && bestPosition <= 20) {
      const template = RECOMMENDATION_TEMPLATES.find(t => t.type === "build_links")!;
      recommendations.push({
        projectId,
        type: template.type,
        severity: template.severity,
        title: template.title,
        description: template.generateDescription({
          url: page.url,
          backlinks,
        }),
        status: "open",
        url: page.url,
      });
    }

    if (page.duplicateContent) {
      const template = RECOMMENDATION_TEMPLATES.find(t => t.type === "fix_duplicate_content")!;
      recommendations.push({
        projectId,
        type: template.type,
        severity: template.severity,
        title: template.title,
        description: template.generateDescription({
          url: page.url,
        }),
        status: "open",
        url: page.url,
      });
    }

    if (!page.coreWebVitalsOk) {
      const template = RECOMMENDATION_TEMPLATES.find(t => t.type === "improve_cwv")!;
      recommendations.push({
        projectId,
        type: template.type,
        severity: template.severity,
        title: template.title,
        description: template.generateDescription({
          url: page.url,
        }),
        status: "open",
        url: page.url,
      });
    }
  }

  return recommendations;
}

export function generateRecommendationsFromTechnicalAudit(
  projectId: string,
  issues: Array<{ type: string; severity: string; count: number; pages: string[] }>
): InsertSeoRecommendation[] {
  const recommendations: InsertSeoRecommendation[] = [];

  for (const issue of issues) {
    if (issue.type === "redirect_chains" && issue.count > 0) {
      recommendations.push({
        projectId,
        type: "fix_indexability",
        severity: issue.count > 10 ? "high" : "medium",
        title: `Fix Redirect Chains (${issue.count} found)`,
        description: `Found ${issue.count} redirect chains that need consolidation. Fix to preserve link equity and improve crawl efficiency.`,
        status: "open",
        url: issue.pages[0],
      });
    }

    if (issue.type === "noindex_pages" && issue.count > 0) {
      recommendations.push({
        projectId,
        type: "fix_indexability",
        severity: "high",
        title: `Review NoIndex Pages (${issue.count} pages)`,
        description: `${issue.count} pages are marked as noindex. Review to ensure this is intentional and not blocking important content.`,
        status: "open",
        url: issue.pages[0],
      });
    }

    if ((issue.type === "duplicate_title" || issue.type === "duplicate_description") && issue.count > 0) {
      recommendations.push({
        projectId,
        type: "fix_duplicate_content",
        severity: issue.count > 5 ? "high" : "medium",
        title: `Fix Duplicate ${issue.type === "duplicate_title" ? "Titles" : "Descriptions"} (${issue.count} found)`,
        description: `Found ${issue.count} pages with duplicate ${issue.type === "duplicate_title" ? "title tags" : "meta descriptions"}. Make each unique and descriptive to improve CTR and avoid ranking conflicts.`,
        status: "open",
      });
    }
  }

  return recommendations;
}

export function prioritizeRecommendations(
  recommendations: InsertSeoRecommendation[]
): InsertSeoRecommendation[] {
  const severityOrder: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return [...recommendations].sort((a, b) => {
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
