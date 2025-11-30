import { storage } from "../storage";
import type { SeoHealthSnapshot, KeywordMetrics, CompetitorMetrics, SeoRecommendation } from "@shared/schema";

interface NarrativeData {
  projectId: string;
  projectName: string;
  period: string;
  healthTrend: "improving" | "stable" | "declining";
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  metrics: {
    currentHealthScore: number;
    previousHealthScore: number;
    healthChange: number;
    avgPosition: number;
    positionChange: number;
    top10Keywords: number;
    top10Change: number;
    totalKeywords: number;
    competitorPressure: "low" | "medium" | "high";
    openRecommendations: number;
  };
}

interface ExecutiveNarrative {
  summary: string;
  detailedNarrative: string;
  bulletPoints: string[];
  alertLevel: "green" | "yellow" | "red";
  generatedAt: string;
}

export class ExecutiveNarrativeGenerator {
  async generateNarrative(projectId: string, periodDays: number = 7): Promise<ExecutiveNarrative> {
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const data = await this.gatherData(projectId, project.name, periodDays);
    return this.buildNarrative(data);
  }

  private async gatherData(projectId: string, projectName: string, periodDays: number): Promise<NarrativeData> {
    const snapshots = await storage.getSeoHealthSnapshots(projectId, periodDays + 1);
    const competitors = await storage.getCompetitorMetrics(projectId);
    const recommendations = await storage.getSeoRecommendations(projectId, { status: "open" });

    const latestSnapshot = snapshots[0];
    const previousSnapshot = snapshots[snapshots.length - 1];

    const currentHealth = latestSnapshot ? Number(latestSnapshot.seoHealthScore) : 0;
    const previousHealth = previousSnapshot ? Number(previousSnapshot.seoHealthScore) : currentHealth;
    const healthChange = currentHealth - previousHealth;

    const currentPosition = latestSnapshot ? Number(latestSnapshot.avgPosition) : 50;
    const previousPosition = previousSnapshot ? Number(previousSnapshot.avgPosition) : currentPosition;
    const positionChange = previousPosition - currentPosition;

    const top10Keywords = latestSnapshot?.top10Keywords || 0;
    const previousTop10 = previousSnapshot?.top10Keywords || top10Keywords;
    const top10Change = top10Keywords - previousTop10;

    const avgPressure = competitors.length > 0
      ? competitors.reduce((sum, c) => sum + Number(c.pressureIndex || 0), 0) / competitors.length
      : 0;

    const competitorPressure: "low" | "medium" | "high" = 
      avgPressure >= 70 ? "high" : avgPressure >= 40 ? "medium" : "low";

    const healthTrend: "improving" | "stable" | "declining" =
      healthChange >= 3 ? "improving" : healthChange <= -3 ? "declining" : "stable";

    const highlights = this.identifyHighlights(snapshots, healthChange, positionChange, top10Change);
    const concerns = this.identifyConcerns(snapshots, healthChange, positionChange, competitors, recommendations);
    const recommendationSummaries = this.summarizeRecommendations(recommendations);

    return {
      projectId,
      projectName,
      period: `Last ${periodDays} days`,
      healthTrend,
      highlights,
      concerns,
      recommendations: recommendationSummaries,
      metrics: {
        currentHealthScore: currentHealth,
        previousHealthScore: previousHealth,
        healthChange,
        avgPosition: currentPosition,
        positionChange,
        top10Keywords,
        top10Change,
        totalKeywords: latestSnapshot?.totalKeywords || 0,
        competitorPressure,
        openRecommendations: recommendations.length,
      },
    };
  }

  private identifyHighlights(
    snapshots: SeoHealthSnapshot[],
    healthChange: number,
    positionChange: number,
    top10Change: number
  ): string[] {
    const highlights: string[] = [];

    if (healthChange >= 5) {
      highlights.push(`SEO health score improved significantly by ${healthChange.toFixed(1)} points`);
    } else if (healthChange > 0) {
      highlights.push(`SEO health score improved by ${healthChange.toFixed(1)} points`);
    }

    if (positionChange >= 3) {
      highlights.push(`Average ranking position improved by ${positionChange.toFixed(1)} positions`);
    } else if (positionChange > 0) {
      highlights.push(`Rankings are trending upward with a ${positionChange.toFixed(1)} position improvement`);
    }

    if (top10Change > 0) {
      highlights.push(`Gained ${top10Change} new keyword(s) in the top 10 rankings`);
    }

    if (snapshots.length > 3) {
      const recentScores = snapshots.slice(0, 3).map(s => Number(s.seoHealthScore));
      const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      if (avgRecent >= 80) {
        highlights.push("Maintaining strong SEO performance with health scores above 80");
      }
    }

    return highlights;
  }

  private identifyConcerns(
    snapshots: SeoHealthSnapshot[],
    healthChange: number,
    positionChange: number,
    competitors: CompetitorMetrics[],
    recommendations: SeoRecommendation[]
  ): string[] {
    const concerns: string[] = [];

    if (healthChange <= -5) {
      concerns.push(`SEO health score dropped significantly by ${Math.abs(healthChange).toFixed(1)} points`);
    } else if (healthChange < -2) {
      concerns.push(`SEO health score declined by ${Math.abs(healthChange).toFixed(1)} points`);
    }

    if (positionChange <= -3) {
      concerns.push(`Average ranking position dropped by ${Math.abs(positionChange).toFixed(1)} positions`);
    }

    const highPressureCompetitors = competitors.filter(c => Number(c.pressureIndex || 0) >= 70);
    if (highPressureCompetitors.length > 0) {
      concerns.push(`${highPressureCompetitors.length} competitor(s) exerting high competitive pressure`);
    }

    const criticalRecs = recommendations.filter(r => r.severity === "high");
    if (criticalRecs.length > 0) {
      concerns.push(`${criticalRecs.length} high-priority recommendation(s) require attention`);
    }

    if (snapshots.length > 0) {
      const latestTech = Number(snapshots[0].techScore || 0);
      if (latestTech < 60) {
        concerns.push("Technical SEO score is below optimal levels and needs improvement");
      }
    }

    return concerns;
  }

  private summarizeRecommendations(recommendations: SeoRecommendation[]): string[] {
    const summaries: string[] = [];
    const byType = new Map<string, SeoRecommendation[]>();

    for (const rec of recommendations) {
      const list = byType.get(rec.type) || [];
      list.push(rec);
      byType.set(rec.type, list);
    }

    const typeLabels: Record<string, string> = {
      fix_indexability: "indexability issues",
      optimize_meta: "meta tag optimizations",
      build_links: "link building opportunities",
      improve_cwv: "Core Web Vitals improvements",
      content_refresh: "content refresh tasks",
      add_schema: "structured data additions",
      add_internal_links: "internal linking improvements",
    };

    Array.from(byType.entries()).forEach(([type, recs]) => {
      const label = typeLabels[type] || type.replace(/_/g, " ");
      const highPriority = recs.filter((r: SeoRecommendation) => r.severity === "high").length;
      
      if (highPriority > 0) {
        summaries.push(`Address ${highPriority} high-priority ${label}`);
      } else {
        summaries.push(`Review ${recs.length} ${label}`);
      }
    });

    return summaries.slice(0, 5);
  }

  private buildNarrative(data: NarrativeData): ExecutiveNarrative {
    const { metrics, healthTrend, highlights, concerns, recommendations, projectName, period } = data;

    const trendText = {
      improving: "showing positive momentum",
      stable: "maintaining steady performance",
      declining: "experiencing challenges",
    }[healthTrend];

    const summary = `${projectName} SEO performance is ${trendText} over the ${period.toLowerCase()}. ` +
      `Current health score: ${metrics.currentHealthScore.toFixed(0)}/100 ` +
      `(${metrics.healthChange >= 0 ? "+" : ""}${metrics.healthChange.toFixed(1)} from previous period). ` +
      `${metrics.top10Keywords} keywords ranking in top 10 positions.`;

    let detailedNarrative = `## SEO Performance Summary\n\n`;
    detailedNarrative += `**${projectName}** - ${period}\n\n`;

    detailedNarrative += `### Key Metrics\n`;
    detailedNarrative += `- **SEO Health Score**: ${metrics.currentHealthScore.toFixed(0)}/100 `;
    detailedNarrative += `(${metrics.healthChange >= 0 ? "+" : ""}${metrics.healthChange.toFixed(1)})\n`;
    detailedNarrative += `- **Average Position**: ${metrics.avgPosition.toFixed(1)} `;
    detailedNarrative += `(${metrics.positionChange >= 0 ? "improved by " : "declined by "}${Math.abs(metrics.positionChange).toFixed(1)})\n`;
    detailedNarrative += `- **Top 10 Keywords**: ${metrics.top10Keywords} of ${metrics.totalKeywords} total\n`;
    detailedNarrative += `- **Competitive Pressure**: ${metrics.competitorPressure.charAt(0).toUpperCase() + metrics.competitorPressure.slice(1)}\n\n`;

    if (highlights.length > 0) {
      detailedNarrative += `### Highlights\n`;
      highlights.forEach(h => { detailedNarrative += `- ${h}\n`; });
      detailedNarrative += `\n`;
    }

    if (concerns.length > 0) {
      detailedNarrative += `### Areas of Concern\n`;
      concerns.forEach(c => { detailedNarrative += `- ${c}\n`; });
      detailedNarrative += `\n`;
    }

    if (recommendations.length > 0) {
      detailedNarrative += `### Recommended Actions\n`;
      recommendations.forEach(r => { detailedNarrative += `- ${r}\n`; });
    }

    const bulletPoints = [
      `Health Score: ${metrics.currentHealthScore.toFixed(0)}/100 (${metrics.healthChange >= 0 ? "+" : ""}${metrics.healthChange.toFixed(1)})`,
      `Avg Position: ${metrics.avgPosition.toFixed(1)} (${metrics.positionChange >= 0 ? "+" : ""}${metrics.positionChange.toFixed(1)})`,
      `Top 10 Keywords: ${metrics.top10Keywords} (${metrics.top10Change >= 0 ? "+" : ""}${metrics.top10Change})`,
      `Open Tasks: ${metrics.openRecommendations}`,
      `Trend: ${healthTrend.charAt(0).toUpperCase() + healthTrend.slice(1)}`,
    ];

    const alertLevel: "green" | "yellow" | "red" = 
      concerns.length >= 3 || metrics.healthChange <= -10 ? "red" :
      concerns.length >= 1 || metrics.healthChange < 0 ? "yellow" : "green";

    return {
      summary,
      detailedNarrative,
      bulletPoints,
      alertLevel,
      generatedAt: new Date().toISOString(),
    };
  }

  async generateWeeklyDigest(projectIds?: string[]): Promise<Map<string, ExecutiveNarrative>> {
    const projects = projectIds 
      ? await Promise.all(projectIds.map(id => storage.getProject(id)))
      : await storage.getProjects();

    const digests = new Map<string, ExecutiveNarrative>();

    for (const project of projects) {
      if (!project || !project.isActive) continue;
      
      try {
        const narrative = await this.generateNarrative(project.id, 7);
        digests.set(project.id, narrative);
      } catch (error) {
        console.error(`[NarrativeGenerator] Failed to generate digest for ${project.name}:`, error);
      }
    }

    return digests;
  }
}

export const narrativeGenerator = new ExecutiveNarrativeGenerator();
