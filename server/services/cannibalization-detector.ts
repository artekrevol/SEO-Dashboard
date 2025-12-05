import { db } from "../db";
import { storage } from "../storage";
import { keywords, rankingsHistory, pageMetrics } from "@shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

interface CannibalConflict {
  keyword: string;
  keywordId: number | null;
  searchVolume: number;
  primaryUrl: string;
  primaryPosition: number;
  conflictingUrl: string;
  conflictingPosition: number;
  severity: "high" | "medium" | "low";
  conflictType: string;
  suggestedAction: string;
}

function determineSeverity(
  searchVolume: number,
  primaryPos: number,
  conflictingPos: number
): "high" | "medium" | "low" {
  const positionGap = Math.abs(primaryPos - conflictingPos);
  
  if (searchVolume >= 1000 && positionGap <= 5) {
    return "high";
  }
  if (searchVolume >= 500 || (positionGap <= 3 && searchVolume >= 100)) {
    return "medium";
  }
  return "low";
}

function determineConflictType(
  primaryPos: number,
  conflictingPos: number
): string {
  const gap = Math.abs(primaryPos - conflictingPos);
  
  if (primaryPos <= 10 && conflictingPos <= 10) {
    return "both_ranking_top10";
  }
  if (primaryPos <= 3 && conflictingPos <= 10) {
    return "top3_with_cannibalization";
  }
  if (gap <= 3) {
    return "close_positions";
  }
  if (conflictingPos > 20) {
    return "weak_secondary_page";
  }
  return "position_fluctuation";
}

function generateSuggestedAction(
  conflictType: string,
  primaryPos: number,
  conflictingPos: number,
  primaryUrl: string,
  conflictingUrl: string
): string {
  switch (conflictType) {
    case "both_ranking_top10":
      return `Both pages rank in top 10. Consider consolidating content or adding canonical from ${conflictingUrl} to ${primaryUrl} to consolidate ranking signals.`;
    case "top3_with_cannibalization":
      return `Primary page ranks #${primaryPos}. Add 301 redirect from ${conflictingUrl} or implement canonical tag pointing to ${primaryUrl}.`;
    case "close_positions":
      return `Pages are competing closely (positions ${primaryPos} vs ${conflictingPos}). Merge content to stronger page or differentiate targeting intent.`;
    case "weak_secondary_page":
      return `Secondary page ranks poorly (#${conflictingPos}). Consider removing it, 301 redirecting to primary, or repurposing for different keyword.`;
    default:
      return `Review both pages for content overlap. Consider canonicalization or content differentiation.`;
  }
}

export async function detectCannibalization(projectId: string): Promise<{
  detected: number;
  conflicts: CannibalConflict[];
}> {
  console.log(`[Cannibalization] Starting detection for project ${projectId}`);
  
  const projectKeywords = await storage.getKeywords(projectId);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateThreshold = thirtyDaysAgo.toISOString().split('T')[0];

  const conflicts: CannibalConflict[] = [];
  const processedPairs = new Set<string>();

  for (const keyword of projectKeywords) {
    const rankings = await db
      .select({
        url: rankingsHistory.url,
        position: rankingsHistory.position,
        date: rankingsHistory.date,
      })
      .from(rankingsHistory)
      .where(
        and(
          eq(rankingsHistory.keywordId, keyword.id),
          gte(rankingsHistory.date, dateThreshold),
          sql`${rankingsHistory.position} IS NOT NULL AND ${rankingsHistory.position} <= 50`
        )
      )
      .orderBy(desc(rankingsHistory.date));

    if (rankings.length === 0) continue;

    const urlRankings = new Map<string, { position: number; date: string }[]>();
    
    for (const ranking of rankings) {
      if (!ranking.url) continue;
      
      const normalizedUrl = ranking.url.toLowerCase().replace(/\/+$/, '');
      if (!urlRankings.has(normalizedUrl)) {
        urlRankings.set(normalizedUrl, []);
      }
      urlRankings.get(normalizedUrl)!.push({
        position: ranking.position!,
        date: ranking.date,
      });
    }

    if (urlRankings.size < 2) continue;

    const urlStats = Array.from(urlRankings.entries()).map(([url, positions]) => {
      const avgPosition = positions.reduce((sum, p) => sum + p.position, 0) / positions.length;
      const bestPosition = Math.min(...positions.map(p => p.position));
      const frequency = positions.length;
      return { url, avgPosition, bestPosition, frequency };
    });

    urlStats.sort((a, b) => {
      if (a.bestPosition !== b.bestPosition) return a.bestPosition - b.bestPosition;
      return b.frequency - a.frequency;
    });

    const primaryUrl = urlStats[0];
    for (let i = 1; i < urlStats.length; i++) {
      const conflictingUrl = urlStats[i];
      
      const pairKey = [primaryUrl.url, conflictingUrl.url].sort().join('|') + `|${keyword.keyword}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const severity = determineSeverity(
        keyword.searchVolume || 0,
        primaryUrl.bestPosition,
        conflictingUrl.bestPosition
      );

      const conflictType = determineConflictType(
        primaryUrl.bestPosition,
        conflictingUrl.bestPosition
      );

      const suggestedAction = generateSuggestedAction(
        conflictType,
        primaryUrl.bestPosition,
        conflictingUrl.bestPosition,
        primaryUrl.url,
        conflictingUrl.url
      );

      conflicts.push({
        keyword: keyword.keyword,
        keywordId: keyword.id,
        searchVolume: keyword.searchVolume || 0,
        primaryUrl: primaryUrl.url,
        primaryPosition: primaryUrl.bestPosition,
        conflictingUrl: conflictingUrl.url,
        conflictingPosition: conflictingUrl.bestPosition,
        severity,
        conflictType,
        suggestedAction,
      });
    }
  }

  console.log(`[Cannibalization] Detected ${conflicts.length} conflicts for project ${projectId}`);
  return { detected: conflicts.length, conflicts };
}

export async function runCannibalizationScan(projectId: string): Promise<{
  newConflicts: number;
  updatedConflicts: number;
  resolvedConflicts: number;
}> {
  console.log(`[Cannibalization] Running full scan for project ${projectId}`);
  
  const { conflicts } = await detectCannibalization(projectId);
  
  let newConflicts = 0;
  let updatedConflicts = 0;

  const existingConflicts = await storage.getKeywordPageConflicts(projectId, { status: 'active' });
  const existingKeys = new Set(
    existingConflicts.map(c => 
      [c.keyword, c.primaryUrl, c.conflictingUrl].sort().join('|')
    )
  );

  for (const conflict of conflicts) {
    const key = [conflict.keyword, conflict.primaryUrl, conflict.conflictingUrl].sort().join('|');
    
    const result = await storage.upsertKeywordPageConflict({
      projectId,
      keyword: conflict.keyword,
      keywordId: conflict.keywordId,
      primaryUrl: conflict.primaryUrl,
      conflictingUrl: conflict.conflictingUrl,
      primaryPosition: conflict.primaryPosition,
      conflictingPosition: conflict.conflictingPosition,
      searchVolume: conflict.searchVolume,
      severity: conflict.severity,
      status: 'active',
      conflictType: conflict.conflictType,
      suggestedAction: conflict.suggestedAction,
    });

    if (existingKeys.has(key)) {
      updatedConflicts++;
    } else {
      newConflicts++;
    }
  }

  const newConflictKeys = new Set(
    conflicts.map(c => [c.keyword, c.primaryUrl, c.conflictingUrl].sort().join('|'))
  );
  
  let resolvedConflicts = 0;
  for (const existing of existingConflicts) {
    const key = [existing.keyword, existing.primaryUrl, existing.conflictingUrl].sort().join('|');
    if (!newConflictKeys.has(key)) {
      await storage.updateKeywordPageConflict(existing.id, { 
        status: 'resolved',
        resolvedAt: new Date(),
      });
      resolvedConflicts++;
    }
  }

  console.log(`[Cannibalization] Scan complete: ${newConflicts} new, ${updatedConflicts} updated, ${resolvedConflicts} resolved`);
  
  return { newConflicts, updatedConflicts, resolvedConflicts };
}
