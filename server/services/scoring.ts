interface ScoringWeights {
  rank: number;
  authority: number;
  technical: number;
  content: number;
}

interface RankMetrics {
  avgPosition: number;
  top3Keywords: number;
  top10Keywords: number;
  totalKeywords: number;
}

interface AuthorityMetrics {
  totalBacklinks: number;
  referringDomains: number;
  domainAuthority: number;
}

interface TechnicalMetrics {
  indexablePages: number;
  totalPages: number;
  hasSchema: boolean;
  hasSitemap: boolean;
  issueCount: number;
}

interface ContentMetrics {
  avgContentLength: number;
  pagesWithThinContent: number;
  pagesWithDuplicateContent: number;
  totalPages: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  rank: 0.35,
  authority: 0.25,
  technical: 0.20,
  content: 0.20,
};

export function calculateRankScore(metrics: RankMetrics): number {
  let score = 0;
  
  if (metrics.totalKeywords === 0) return 50;
  
  const top3Ratio = metrics.top3Keywords / metrics.totalKeywords;
  const top10Ratio = metrics.top10Keywords / metrics.totalKeywords;
  
  if (metrics.avgPosition <= 3) score += 40;
  else if (metrics.avgPosition <= 10) score += 30;
  else if (metrics.avgPosition <= 20) score += 20;
  else if (metrics.avgPosition <= 50) score += 10;
  else score += 5;
  
  score += Math.min(30, top3Ratio * 100 * 0.3);
  
  score += Math.min(30, top10Ratio * 100 * 0.3);
  
  return Math.min(100, Math.max(0, score));
}

export function calculateAuthorityScore(metrics: AuthorityMetrics): number {
  let score = 0;
  
  if (metrics.domainAuthority >= 60) score += 40;
  else if (metrics.domainAuthority >= 40) score += 30;
  else if (metrics.domainAuthority >= 20) score += 20;
  else score += 10;
  
  if (metrics.referringDomains >= 1000) score += 30;
  else if (metrics.referringDomains >= 100) score += 20;
  else if (metrics.referringDomains >= 10) score += 10;
  else score += 5;
  
  if (metrics.totalBacklinks >= 10000) score += 30;
  else if (metrics.totalBacklinks >= 1000) score += 20;
  else if (metrics.totalBacklinks >= 100) score += 10;
  else score += 5;
  
  return Math.min(100, Math.max(0, score));
}

export function calculateTechnicalScore(metrics: TechnicalMetrics): number {
  let score = 100;
  
  if (metrics.totalPages > 0) {
    const indexableRatio = metrics.indexablePages / metrics.totalPages;
    if (indexableRatio < 0.9) {
      score -= (0.9 - indexableRatio) * 50;
    }
  }
  
  if (!metrics.hasSchema) score -= 10;
  if (!metrics.hasSitemap) score -= 10;
  
  if (metrics.issueCount > 50) score -= 30;
  else if (metrics.issueCount > 20) score -= 20;
  else if (metrics.issueCount > 5) score -= 10;
  
  return Math.min(100, Math.max(0, score));
}

export function calculateContentScore(metrics: ContentMetrics): number {
  let score = 100;
  
  if (metrics.totalPages === 0) return 50;
  
  const thinContentRatio = metrics.pagesWithThinContent / metrics.totalPages;
  const duplicateRatio = metrics.pagesWithDuplicateContent / metrics.totalPages;
  
  if (thinContentRatio > 0.3) score -= 30;
  else if (thinContentRatio > 0.1) score -= 15;
  
  if (duplicateRatio > 0.2) score -= 30;
  else if (duplicateRatio > 0.05) score -= 15;
  
  if (metrics.avgContentLength < 300) score -= 20;
  else if (metrics.avgContentLength < 500) score -= 10;
  else if (metrics.avgContentLength >= 1500) score += 10;
  
  return Math.min(100, Math.max(0, score));
}

export function calculateOverallHealthScore(
  rankScore: number,
  authorityScore: number,
  technicalScore: number,
  contentScore: number,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  const totalWeight = weights.rank + weights.authority + weights.technical + weights.content;
  
  const normalizedWeights = {
    rank: weights.rank / totalWeight,
    authority: weights.authority / totalWeight,
    technical: weights.technical / totalWeight,
    content: weights.content / totalWeight,
  };
  
  const score = 
    rankScore * normalizedWeights.rank +
    authorityScore * normalizedWeights.authority +
    technicalScore * normalizedWeights.technical +
    contentScore * normalizedWeights.content;
  
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function getHealthStatus(score: number): "healthy" | "at_risk" | "declining" {
  if (score >= 70) return "healthy";
  if (score >= 40) return "at_risk";
  return "declining";
}

export function calculateOpportunityScore(
  position: number,
  searchVolume: number,
  difficulty: number,
  intent: string
): number {
  let score = 0;
  
  if (position > 0 && position <= 20) {
    score += Math.max(0, 40 - (position - 1) * 2);
  } else if (position > 20 && position <= 50) {
    score += 10;
  }
  
  if (searchVolume >= 10000) score += 25;
  else if (searchVolume >= 1000) score += 20;
  else if (searchVolume >= 100) score += 15;
  else score += 5;
  
  if (difficulty <= 30) score += 25;
  else if (difficulty <= 50) score += 20;
  else if (difficulty <= 70) score += 10;
  else score += 5;
  
  if (intent === "transactional" || intent === "commercial") {
    score += 10;
  } else if (intent === "informational") {
    score += 5;
  }
  
  return Math.min(100, Math.max(0, score));
}

export function calculateCompetitorPressure(
  sharedKeywords: number,
  competitorAuthority: number,
  yourAuthority: number,
  competitorAvgPosition: number,
  yourAvgPosition: number
): number {
  let pressure = 0;
  
  pressure += Math.min(30, sharedKeywords * 0.5);
  
  const authorityDiff = competitorAuthority - yourAuthority;
  if (authorityDiff > 0) {
    pressure += Math.min(30, authorityDiff * 0.5);
  }
  
  const positionDiff = yourAvgPosition - competitorAvgPosition;
  if (positionDiff > 0) {
    pressure += Math.min(40, positionDiff * 2);
  }
  
  return Math.min(100, Math.max(0, pressure));
}

export function calculatePageRiskScore(
  position: number,
  positionDelta: number,
  backlinks: number,
  technicalIssues: number,
  contentScore: number
): number {
  let risk = 0;
  
  if (position > 20) risk += 20;
  else if (position > 10) risk += 10;
  
  if (positionDelta > 5) risk += 30;
  else if (positionDelta > 2) risk += 15;
  
  if (backlinks < 5) risk += 20;
  else if (backlinks < 20) risk += 10;
  
  if (technicalIssues > 5) risk += 20;
  else if (technicalIssues > 2) risk += 10;
  
  if (contentScore < 50) risk += 10;
  
  return Math.min(100, Math.max(0, risk));
}
