import { storage } from "../storage";
import type { SeoRecommendation, KeywordMetrics, SeoHealthSnapshot } from "@shared/schema";

interface ImpactSnapshot {
  capturedAt: string;
  seoHealthScore?: number;
  avgPosition?: number;
  top10Keywords?: number;
  keywordMetrics?: {
    keywordId: number;
    keyword: string;
    position: number;
    searchVolume: number;
    opportunityScore: number;
  }[];
  pageMetrics?: {
    url: string;
    backlinksCount: number;
    referringDomains: number;
  }[];
}

interface ImpactResult {
  recommendationId: number;
  impactScore: number;
  impactSummary: string;
  positionImprovement?: number;
  trafficPotentialChange?: number;
  healthScoreChange?: number;
}

export class RecommendationImpactTracker {
  async captureBaselineSnapshot(recommendationId: number): Promise<void> {
    const recommendation = await storage.getSeoRecommendation(recommendationId);
    if (!recommendation) {
      throw new Error(`Recommendation ${recommendationId} not found`);
    }

    const snapshot = await this.buildSnapshot(recommendation);
    
    await storage.updateSeoRecommendation(recommendationId, {
      baselineSnapshot: snapshot as unknown as Record<string, unknown>,
      baselineCapturedAt: new Date(),
    });

    console.log(`[ImpactTracker] Captured baseline snapshot for recommendation ${recommendationId}`);
  }

  async captureResultSnapshot(recommendationId: number): Promise<ImpactResult> {
    const recommendation = await storage.getSeoRecommendation(recommendationId);
    if (!recommendation) {
      throw new Error(`Recommendation ${recommendationId} not found`);
    }

    const resultSnapshot = await this.buildSnapshot(recommendation);
    const baselineSnapshot = recommendation.baselineSnapshot as ImpactSnapshot | null;

    const impact = this.calculateImpact(baselineSnapshot, resultSnapshot, recommendation);

    await storage.updateSeoRecommendation(recommendationId, {
      resultSnapshot: resultSnapshot as unknown as Record<string, unknown>,
      resultCapturedAt: new Date(),
      impactScore: impact.impactScore.toFixed(2),
      impactSummary: impact.impactSummary,
    });

    console.log(`[ImpactTracker] Captured result snapshot for recommendation ${recommendationId}: ${impact.impactSummary}`);

    return impact;
  }

  private async buildSnapshot(recommendation: SeoRecommendation): Promise<ImpactSnapshot> {
    const projectId = recommendation.projectId;
    const today = new Date().toISOString().split("T")[0];

    const latestHealth = await storage.getLatestSeoHealthSnapshot(projectId);
    
    let keywordMetricsData: ImpactSnapshot["keywordMetrics"] = [];
    
    if (recommendation.keywordId) {
      const metrics = await storage.getKeywordMetrics(recommendation.keywordId, 1);
      const keyword = await storage.getKeyword(recommendation.keywordId);
      
      if (metrics.length > 0 && keyword) {
        keywordMetricsData = [{
          keywordId: keyword.id,
          keyword: keyword.keyword,
          position: metrics[0].position || 100,
          searchVolume: metrics[0].searchVolume || 0,
          opportunityScore: Number(metrics[0].opportunityScore) || 0,
        }];
      }
    } else {
      const allKeywords = await storage.getKeywords(projectId);
      const keywordIds = allKeywords.slice(0, 10).map(k => k.id);
      
      for (const kwId of keywordIds) {
        const metrics = await storage.getKeywordMetrics(kwId, 1);
        const keyword = await storage.getKeyword(kwId);
        
        if (metrics.length > 0 && keyword) {
          keywordMetricsData.push({
            keywordId: keyword.id,
            keyword: keyword.keyword,
            position: metrics[0].position || 100,
            searchVolume: metrics[0].searchVolume || 0,
            opportunityScore: Number(metrics[0].opportunityScore) || 0,
          });
        }
      }
    }

    let pageMetricsData: ImpactSnapshot["pageMetrics"] = [];
    
    if (recommendation.url) {
      const pages = await storage.getPageMetrics(projectId);
      const targetPage = pages.find(p => p.url === recommendation.url);
      
      if (targetPage) {
        pageMetricsData = [{
          url: targetPage.url,
          backlinksCount: targetPage.backlinksCount || 0,
          referringDomains: targetPage.referringDomains || 0,
        }];
      }
    }

    return {
      capturedAt: today,
      seoHealthScore: latestHealth ? Number(latestHealth.seoHealthScore) : undefined,
      avgPosition: latestHealth ? Number(latestHealth.avgPosition) : undefined,
      top10Keywords: latestHealth?.top10Keywords ?? undefined,
      keywordMetrics: keywordMetricsData,
      pageMetrics: pageMetricsData,
    };
  }

  private calculateImpact(
    baseline: ImpactSnapshot | null,
    result: ImpactSnapshot,
    recommendation: SeoRecommendation
  ): ImpactResult {
    if (!baseline) {
      return {
        recommendationId: recommendation.id,
        impactScore: 0,
        impactSummary: "No baseline snapshot available for comparison",
      };
    }

    let impactScore = 0;
    const impactDetails: string[] = [];

    if (baseline.seoHealthScore !== undefined && result.seoHealthScore !== undefined) {
      const healthChange = result.seoHealthScore - baseline.seoHealthScore;
      if (healthChange > 0) {
        impactScore += Math.min(30, healthChange * 3);
        impactDetails.push(`Health score improved by ${healthChange.toFixed(1)} points`);
      } else if (healthChange < 0) {
        impactDetails.push(`Health score decreased by ${Math.abs(healthChange).toFixed(1)} points`);
      }
    }

    if (baseline.avgPosition !== undefined && result.avgPosition !== undefined) {
      const positionImprovement = baseline.avgPosition - result.avgPosition;
      if (positionImprovement > 0) {
        impactScore += Math.min(40, positionImprovement * 5);
        impactDetails.push(`Average position improved by ${positionImprovement.toFixed(1)}`);
      } else if (positionImprovement < 0) {
        impactDetails.push(`Average position worsened by ${Math.abs(positionImprovement).toFixed(1)}`);
      }
    }

    if (baseline.top10Keywords !== undefined && result.top10Keywords !== undefined) {
      const top10Change = result.top10Keywords - baseline.top10Keywords;
      if (top10Change > 0) {
        impactScore += top10Change * 10;
        impactDetails.push(`Gained ${top10Change} keyword(s) in top 10`);
      } else if (top10Change < 0) {
        impactDetails.push(`Lost ${Math.abs(top10Change)} keyword(s) from top 10`);
      }
    }

    if (baseline.keywordMetrics && result.keywordMetrics) {
      const baselineMap = new Map(baseline.keywordMetrics.map(k => [k.keywordId, k]));
      
      for (const resultKw of result.keywordMetrics) {
        const baselineKw = baselineMap.get(resultKw.keywordId);
        if (baselineKw) {
          const positionChange = baselineKw.position - resultKw.position;
          if (positionChange > 0) {
            impactScore += Math.min(20, positionChange * 2);
            if (positionChange >= 5) {
              impactDetails.push(`"${resultKw.keyword}" improved ${positionChange} positions`);
            }
          }
        }
      }
    }

    impactScore = Math.min(100, Math.max(0, impactScore));

    const impactSummary = impactDetails.length > 0
      ? impactDetails.join(". ") + "."
      : "No significant changes detected since baseline.";

    return {
      recommendationId: recommendation.id,
      impactScore,
      impactSummary,
      positionImprovement: baseline.avgPosition && result.avgPosition
        ? baseline.avgPosition - result.avgPosition
        : undefined,
      healthScoreChange: baseline.seoHealthScore && result.seoHealthScore
        ? result.seoHealthScore - baseline.seoHealthScore
        : undefined,
    };
  }

  async trackImplementedRecommendations(projectId: string): Promise<ImpactResult[]> {
    const recommendations = await storage.getSeoRecommendations(projectId, { status: "done" });
    const results: ImpactResult[] = [];

    for (const rec of recommendations) {
      if (rec.baselineSnapshot && !rec.resultSnapshot) {
        const implementedAt = rec.updatedAt;
        const daysSinceImplementation = Math.floor(
          (Date.now() - new Date(implementedAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceImplementation >= 7) {
          try {
            const result = await this.captureResultSnapshot(rec.id);
            results.push(result);
          } catch (error) {
            console.error(`[ImpactTracker] Failed to capture result for recommendation ${rec.id}:`, error);
          }
        }
      }
    }

    return results;
  }
}

export const impactTracker = new RecommendationImpactTracker();
