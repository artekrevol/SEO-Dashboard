/**
 * SEID (Search Engine Intent Detector) - SERP Parser Service
 * 
 * Parses DataForSEO SERP responses to extract:
 * - Layout blocks (what appears before organic results)
 * - Organic start position
 * - Competitor presence in AI Overview, Featured Snippets, Local Pack, etc.
 * - Intent stability scoring
 */

import { storage } from "../storage";
import type { 
  InsertSerpLayoutSnapshot, 
  InsertSerpLayoutItem, 
  InsertCompetitorSerpPresence,
  InsertIntentAlert,
  SerpLayoutSnapshot,
  SerpLayoutBlock,
  SerpBlockType
} from "@shared/schema";

export interface ParsedSerpBlock {
  blockType: SerpBlockType;
  blockIndex: number;
  rank_absolute: number;
  title?: string;
  url?: string;
  domain?: string;
  description?: string;
  items?: Array<{
    position: number;
    title: string;
    url: string;
    domain: string;
  }>;
  raw?: any;
}

export interface ParsedSerpResult {
  keyword: string;
  layoutStack: SerpLayoutBlock[];
  organicStartPosition: number;
  hasAiOverview: boolean;
  hasFeaturedSnippet: boolean;
  hasLocalPack: boolean;
  hasPeopleAlsoAsk: boolean;
  hasAds: boolean;
  hasVideoCarousel: boolean;
  blocks: ParsedSerpBlock[];
  competitorPresences: Array<{
    domain: string;
    blockType: SerpBlockType;
    position?: number;
    url: string;
    title: string;
    isInAiOverview: boolean;
    isInFeaturedSnippet: boolean;
  }>;
}

const TYPE_TO_BLOCK_MAP: Record<string, SerpBlockType | null> = {
  paid: 'ads_top',
  paid_top: 'ads_top',
  paid_bottom: 'ads_bottom',
  organic: 'organic',
  featured_snippet: 'featured_snippet',
  people_also_ask: 'people_also_ask',
  local_pack: 'local_pack',
  knowledge_panel: 'knowledge_panel',
  knowledge_graph: 'knowledge_panel',
  video: 'video_carousel',
  video_carousel: 'video_carousel',
  images: 'image_pack',
  image_pack: 'image_pack',
  shopping: 'shopping',
  shopping_element: 'shopping',
  popular_products: 'popular_products',
  news: 'top_stories',
  top_stories: 'top_stories',
  related_searches: 'related_searches',
  ai_overview: 'ai_overview',
  discussions_and_forums: 'discussions',
  discussions: 'discussions',
  twitter: 'twitter_carousel',
  twitter_carousel: 'twitter_carousel',
  google_flights: null,
  google_reviews: null,
  google_hotels: null,
  jobs: null,
  events: null,
  recipes: null,
  scholarly_articles: null,
  answer_box: 'featured_snippet',
};

export class SerpParserService {
  /**
   * Parse a DataForSEO SERP response into structured layout data
   */
  parseSerpResponse(serpItems: any[], keyword: string): ParsedSerpResult {
    const blocks: ParsedSerpBlock[] = [];
    const layoutStack: SerpLayoutBlock[] = [];
    const competitorPresences: ParsedSerpResult['competitorPresences'] = [];
    const seenBlockTypes = new Set<string>();
    
    let organicStartPosition = 0;
    let hasAiOverview = false;
    let hasFeaturedSnippet = false;
    let hasLocalPack = false;
    let hasPeopleAlsoAsk = false;
    let hasAds = false;
    let hasVideoCarousel = false;
    let firstOrganicFound = false;
    let blockIndex = 0;

    for (const item of serpItems) {
      const itemType = item.type?.toLowerCase() || '';
      const blockType = TYPE_TO_BLOCK_MAP[itemType];
      
      if (!blockType) continue;
      
      if (!seenBlockTypes.has(blockType)) {
        seenBlockTypes.add(blockType);
        layoutStack.push({
          blockType,
          position: blockIndex + 1,
          resultCount: 1,
        });
      }
      
      switch (blockType) {
        case 'ai_overview':
          hasAiOverview = true;
          break;
        case 'featured_snippet':
          hasFeaturedSnippet = true;
          break;
        case 'local_pack':
          hasLocalPack = true;
          break;
        case 'people_also_ask':
          hasPeopleAlsoAsk = true;
          break;
        case 'ads_top':
        case 'ads_bottom':
          hasAds = true;
          break;
        case 'video_carousel':
          hasVideoCarousel = true;
          break;
        case 'organic':
          if (!firstOrganicFound) {
            organicStartPosition = item.rank_absolute || blockIndex + 1;
            firstOrganicFound = true;
          }
          break;
      }

      const parsedBlock: ParsedSerpBlock = {
        blockType,
        blockIndex,
        rank_absolute: item.rank_absolute || 0,
        title: item.title,
        url: item.url,
        domain: item.domain,
        description: item.description,
      };

      if (item.items && Array.isArray(item.items)) {
        parsedBlock.items = item.items.map((subItem: any, idx: number) => ({
          position: idx + 1,
          title: subItem.title || '',
          url: subItem.url || '',
          domain: this.extractDomain(subItem.url || ''),
        }));
      }

      blocks.push(parsedBlock);
      blockIndex++;

      if (item.domain) {
        const domain = item.domain.toLowerCase();
        competitorPresences.push({
          domain,
          blockType,
          position: item.rank_absolute || item.rank_group,
          url: item.url || '',
          title: item.title || '',
          isInAiOverview: blockType === 'ai_overview',
          isInFeaturedSnippet: blockType === 'featured_snippet',
        });
      }

      // Extract competitors from AI Overview
      if (blockType === 'ai_overview') {
        // Try items array first
        if (item.items && Array.isArray(item.items)) {
          for (const aiItem of item.items) {
            const domain = aiItem.domain || this.extractDomain(aiItem.url || aiItem.link || '');
            if (domain) {
              competitorPresences.push({
                domain: domain.toLowerCase(),
                blockType: 'ai_overview',
                position: undefined,
                url: aiItem.url || aiItem.link || '',
                title: aiItem.title || aiItem.snippet || '',
                isInAiOverview: true,
                isInFeaturedSnippet: false,
              });
            }
          }
        }
        // Try references/sources in AI overview
        if (item.references && Array.isArray(item.references)) {
          for (const ref of item.references) {
            const domain = ref.domain || this.extractDomain(ref.url || ref.link || '');
            if (domain) {
              competitorPresences.push({
                domain: domain.toLowerCase(),
                blockType: 'ai_overview',
                position: undefined,
                url: ref.url || ref.link || '',
                title: ref.title || '',
                isInAiOverview: true,
                isInFeaturedSnippet: false,
              });
            }
          }
        }
      }

      // Extract competitors from Featured Snippet
      if (blockType === 'featured_snippet') {
        // Featured snippet typically has a single source
        const domain = item.domain || this.extractDomain(item.url || item.link || '');
        if (domain && !competitorPresences.some(cp => cp.domain === domain.toLowerCase() && cp.blockType === 'featured_snippet')) {
          competitorPresences.push({
            domain: domain.toLowerCase(),
            blockType: 'featured_snippet',
            position: item.rank_absolute || 0,
            url: item.url || item.link || '',
            title: item.title || '',
            isInAiOverview: false,
            isInFeaturedSnippet: true,
          });
        }
      }

      // Extract competitors from Local Pack
      if (blockType === 'local_pack') {
        if (item.items && Array.isArray(item.items)) {
          for (const lpItem of item.items) {
            const domain = lpItem.domain || this.extractDomain(lpItem.url || lpItem.website || lpItem.link || '');
            if (domain) {
              competitorPresences.push({
                domain: domain.toLowerCase(),
                blockType: 'local_pack',
                position: undefined,
                url: lpItem.url || lpItem.website || lpItem.link || '',
                title: lpItem.title || lpItem.name || '',
                isInAiOverview: false,
                isInFeaturedSnippet: false,
              });
            }
          }
        }
      }
    }

    if (!firstOrganicFound) {
      organicStartPosition = blocks.length + 1;
    }

    return {
      keyword,
      layoutStack,
      organicStartPosition,
      hasAiOverview,
      hasFeaturedSnippet,
      hasLocalPack,
      hasPeopleAlsoAsk,
      hasAds,
      hasVideoCarousel,
      blocks,
      competitorPresences,
    };
  }

  /**
   * Calculate stability score comparing current layout to previous
   * Score: 0-100 (100 = completely stable, 0 = completely different)
   */
  calculateStabilityScore(current: ParsedSerpResult, previous?: ParsedSerpResult): number {
    if (!previous) return 100;

    let score = 100;

    if (current.organicStartPosition !== previous.organicStartPosition) {
      const diff = Math.abs(current.organicStartPosition - previous.organicStartPosition);
      score -= Math.min(diff * 5, 25);
    }

    if (current.hasAiOverview !== previous.hasAiOverview) score -= 15;
    if (current.hasFeaturedSnippet !== previous.hasFeaturedSnippet) score -= 10;
    if (current.hasLocalPack !== previous.hasLocalPack) score -= 10;
    if (current.hasPeopleAlsoAsk !== previous.hasPeopleAlsoAsk) score -= 5;

    const currentTypes = new Set(current.layoutStack.map(b => b.blockType));
    const previousTypes = new Set(previous.layoutStack.map(b => b.blockType));
    const allTypes = new Set([...Array.from(currentTypes), ...Array.from(previousTypes)]);
    let matching = 0;
    for (const blockType of Array.from(allTypes)) {
      if (currentTypes.has(blockType) && previousTypes.has(blockType)) {
        matching++;
      }
    }
    const layoutSimilarity = allTypes.size > 0 ? (matching / allTypes.size) * 35 : 35;
    score -= (35 - layoutSimilarity);

    return Math.max(0, Math.round(score));
  }

  /**
   * Detect significant changes and generate alerts
   */
  detectIntentChanges(
    projectId: string,
    keywordId: number,
    keyword: string,
    current: ParsedSerpResult,
    previous?: SerpLayoutSnapshot
  ): InsertIntentAlert[] {
    const alerts: InsertIntentAlert[] = [];

    if (!previous) return alerts;

    if (current.hasAiOverview && !previous.hasAiOverview) {
      alerts.push({
        projectId,
        keywordId,
        alertType: 'intent_shift',
        severity: 'high',
        title: `AI Overview Appeared for "${keyword}"`,
        description: `This keyword now shows an AI Overview in search results. This may significantly reduce organic click-through rates.`,
        previousState: { hasAiOverview: false },
        newState: { hasAiOverview: true },
      });
    }

    if (!current.hasAiOverview && previous.hasAiOverview) {
      alerts.push({
        projectId,
        keywordId,
        alertType: 'lost_serp_feature',
        severity: 'medium',
        title: `AI Overview Removed for "${keyword}"`,
        description: `This keyword no longer shows an AI Overview. Organic visibility may improve.`,
        previousState: { hasAiOverview: true },
        newState: { hasAiOverview: false },
      });
    }

    if (current.hasFeaturedSnippet && !previous.hasFeaturedSnippet) {
      alerts.push({
        projectId,
        keywordId,
        alertType: 'intent_shift',
        severity: 'medium',
        title: `Featured Snippet Appeared for "${keyword}"`,
        description: `This keyword now has a Featured Snippet. Consider optimizing for position zero.`,
        previousState: { hasFeaturedSnippet: false },
        newState: { hasFeaturedSnippet: true },
      });
    }

    if (current.hasLocalPack && !previous.hasLocalPack) {
      alerts.push({
        projectId,
        keywordId,
        alertType: 'intent_shift',
        severity: 'low',
        title: `Local Pack Appeared for "${keyword}"`,
        description: `This keyword now shows Local Pack results. Consider local SEO optimization.`,
        previousState: { hasLocalPack: false },
        newState: { hasLocalPack: true },
      });
    }

    const organicShift = current.organicStartPosition - (previous.organicStartPosition || 1);
    if (organicShift >= 3) {
      alerts.push({
        projectId,
        keywordId,
        alertType: 'organic_pushed_down',
        severity: 'high',
        title: `Organic Results Pushed Down for "${keyword}"`,
        description: `Organic results now start at position ${current.organicStartPosition} (was ${previous.organicStartPosition}). SERP features are consuming more space.`,
        previousState: { organicStartPosition: previous.organicStartPosition },
        newState: { organicStartPosition: current.organicStartPosition },
      });
    }

    return alerts;
  }

  /**
   * Process a keyword's SERP data and save to database
   */
  async processSerpData(
    projectId: string,
    keywordId: number,
    keyword: string,
    serpItems: any[],
    searchEngine: string = 'google',
    device: string = 'desktop'
  ): Promise<{
    snapshot: any;
    alerts: InsertIntentAlert[];
  }> {
    const parsed = this.parseSerpResponse(serpItems, keyword);
    
    const previousSnapshot = await storage.getLatestSerpLayoutSnapshot(keywordId);
    
    let previousParsed: ParsedSerpResult | undefined;
    if (previousSnapshot) {
      const layoutBlocks = (previousSnapshot.layoutStack || []) as SerpLayoutBlock[];
      previousParsed = {
        keyword,
        layoutStack: layoutBlocks,
        organicStartPosition: previousSnapshot.organicStartPosition || 1,
        hasAiOverview: previousSnapshot.hasAiOverview || false,
        hasFeaturedSnippet: previousSnapshot.hasFeaturedSnippet || false,
        hasLocalPack: previousSnapshot.hasLocalPack || false,
        hasPeopleAlsoAsk: previousSnapshot.hasPeopleAlsoAsk || false,
        hasAds: false,
        hasVideoCarousel: previousSnapshot.hasVideoCarousel || false,
        blocks: [],
        competitorPresences: [],
      };
    }
    
    const stabilityScore = this.calculateStabilityScore(parsed, previousParsed);
    
    const blocksBeforeOrganic = parsed.blocks.filter((b, i) => {
      const organicIdx = parsed.blocks.findIndex(block => block.blockType === 'organic');
      return organicIdx === -1 || i < organicIdx;
    }).filter(b => b.blockType !== 'organic').length;
    
    const snapshotData: InsertSerpLayoutSnapshot = {
      projectId,
      keywordId,
      layoutStack: parsed.layoutStack,
      organicStartPosition: parsed.organicStartPosition,
      organicOffsetCount: blocksBeforeOrganic,
      hasAiOverview: parsed.hasAiOverview,
      hasFeaturedSnippet: parsed.hasFeaturedSnippet,
      hasLocalPack: parsed.hasLocalPack,
      hasPeopleAlsoAsk: parsed.hasPeopleAlsoAsk,
      hasVideoCarousel: parsed.hasVideoCarousel,
      stabilityScore: stabilityScore.toString(),
    };
    
    const snapshot = await storage.createSerpLayoutSnapshot(snapshotData);
    
    const layoutItems: InsertSerpLayoutItem[] = parsed.blocks.map(block => ({
      snapshotId: snapshot.id,
      blockIndex: block.blockIndex,
      blockType: block.blockType,
      positionStart: block.rank_absolute,
      positionEnd: block.rank_absolute,
      resultCount: block.items?.length || 1,
      competitorDomains: block.items?.map(i => i.domain).filter(Boolean) || (block.domain ? [block.domain] : []),
    }));
    
    if (layoutItems.length > 0) {
      await storage.createSerpLayoutItems(layoutItems);
    }
    
    const presenceRecords: InsertCompetitorSerpPresence[] = parsed.competitorPresences.map(cp => ({
      snapshotId: snapshot.id,
      competitorDomain: cp.domain,
      blockType: cp.blockType,
      position: cp.position,
      url: cp.url,
    }));
    
    if (presenceRecords.length > 0) {
      await storage.createCompetitorSerpPresenceBatch(presenceRecords);
    }
    
    const alerts = this.detectIntentChanges(projectId, keywordId, keyword, parsed, previousSnapshot || undefined);
    
    for (const alert of alerts) {
      await storage.createIntentAlert(alert);
    }
    
    return { snapshot, alerts };
  }

  /**
   * Process multiple keywords from a SERP crawl batch
   */
  async processBatch(
    projectId: string,
    keywordResults: Array<{ keywordId: number; keyword: string; serpItems: any[] }>,
    searchEngine: string = 'google',
    device: string = 'desktop',
    onProgress?: (processed: number, total: number) => void
  ): Promise<{
    processed: number;
    alertsGenerated: number;
  }> {
    let processed = 0;
    let alertsGenerated = 0;
    const total = keywordResults.length;

    for (const data of keywordResults) {
      try {
        const result = await this.processSerpData(
          projectId,
          data.keywordId,
          data.keyword,
          data.serpItems,
          searchEngine,
          device
        );
        
        alertsGenerated += result.alerts.length;
        processed++;
        
        if (onProgress) {
          onProgress(processed, total);
        }
      } catch (error) {
        console.error(`[SerpParser] Error processing keyword ${data.keyword}:`, error);
      }
    }

    return { processed, alertsGenerated };
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
      return match ? match[1].replace(/^www\./, '') : '';
    }
  }
}

export const serpParser = new SerpParserService();
