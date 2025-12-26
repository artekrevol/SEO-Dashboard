import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  Bot,
  Video,
  ShoppingCart,
  MessageSquare,
  MapPin,
  Image,
  Newspaper,
  ListChecks,
  Search,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ExternalLink,
  X,
  Filter,
  Layers,
  Eye,
  Quote,
  Link2,
  Activity,
  Zap,
  Info,
  RefreshCw,
} from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";

interface KeywordIntelligenceData {
  keywords: EnrichedKeyword[];
  summary: {
    totalKeywords: number;
    withAiOverview: number;
    withFeaturedSnippet: number;
    withLocalPack: number;
    avgOpportunity: number;
    avgPosition: number;
    avgVolume: number;
    alertsCount: number;
    avgStability: number;
    brandCitationRate: number;
  };
}

interface EnrichedKeyword {
  keyword: {
    id: number;
    projectId: string;
    keyword: string;
    targetUrl: string | null;
    searchIntent: string | null;
    cluster: string | null;
    priorityTier: string | null;
  };
  metrics: {
    position: number | null;
    searchVolume: number | null;
    opportunityScore: number | null;
    difficulty: number | null;
    intent: string | null;
    trend: string | null;
  } | null;
  serpFeatures: {
    hasAiOverview: boolean;
    hasFeaturedSnippet: boolean;
    hasLocalPack: boolean;
    hasPeopleAlsoAsk: boolean;
    hasVideoCarousel: boolean;
    hasImagePack: boolean;
    organicStartPosition: number | null;
    stabilityScore: number | null;
    layoutStack: string[];
  } | null;
  aiIntelligence: {
    citationCount: number;
    isBrandCited: boolean;
    latestCapturedAt: string | null;
  };
  competitorPresence: {
    inAiOverview: string[];
    inFeaturedSnippet: string[];
    inLocalPack: string[];
  };
}

interface KeywordDetailData {
  keyword: {
    id: number;
    projectId: string;
    keyword: string;
    targetUrl: string | null;
    searchIntent: string | null;
    cluster: string | null;
    priorityTier: string | null;
    createdAt: string;
  };
  metrics: any;
  serpSnapshot: {
    id: number;
    hasAiOverview: boolean;
    hasFeaturedSnippet: boolean;
    hasLocalPack: boolean;
    organicStartPosition: number | null;
    stabilityScore: number | null;
    capturedAt: string;
  } | null;
  serpLayoutItems: Array<{
    id: number;
    blockType: string;
    blockIndex: number;
    positionStart: number | null;
    positionEnd: number | null;
    ourBrandPresent: boolean;
    competitorDomains: string[] | null;
  }>;
  aiCitations: Array<{
    id: number;
    sourceDomain: string;
    sourceTitle: string | null;
    sourceUrl: string | null;
    citedText: string | null;
    referencePosition: number | null;
    isBrandMention: boolean;
    contentType: string | null;
    capturedAt: string;
  }>;
  competitorPresence: Array<{
    id: number;
    competitorDomain: string;
    inAiOverview: boolean;
    inFeaturedSnippet: boolean;
    inLocalPack: boolean;
    organicPosition: number | null;
  }>;
  rankingsHistory: Array<{
    date: string;
    position: number | null;
  }>;
  alerts: Array<{
    id: number;
    alertType: string;
    severity: string;
    title: string;
    description: string | null;
    isResolved: boolean;
    createdAt: string;
  }>;
}

interface Props {
  projectId: string | null;
}

const BLOCK_COLORS: Record<string, string> = {
  ai_overview: "hsl(var(--chart-1))",
  featured_snippet: "hsl(var(--chart-2))",
  ads_top: "hsl(var(--chart-3))",
  local_pack: "hsl(var(--chart-4))",
  people_also_ask: "hsl(var(--chart-5))",
  video_carousel: "hsl(210, 60%, 55%)",
  image_pack: "hsl(330, 60%, 55%)",
  knowledge_panel: "hsl(280, 60%, 55%)",
  shopping: "hsl(30, 60%, 55%)",
  organic: "hsl(120, 40%, 50%)",
};

const BLOCK_ICONS: Record<string, typeof Brain> = {
  ai_overview: Bot,
  featured_snippet: Sparkles,
  ads_top: Target,
  local_pack: MapPin,
  people_also_ask: MessageSquare,
  video_carousel: Video,
  image_pack: Image,
  shopping: ShoppingCart,
  top_stories: Newspaper,
  organic: ListChecks,
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string }> = {
  critical: { bg: "bg-destructive/10", text: "text-destructive" },
  high: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400" },
  low: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
};

function formatBlockType(blockType: string): string {
  return blockType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getOpportunityColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}

function getPositionBadgeVariant(position: number | null): "default" | "secondary" | "destructive" | "outline" {
  if (position === null) return "outline";
  if (position <= 3) return "default";
  if (position <= 10) return "secondary";
  return "outline";
}

export default function KeywordIntelligence({ projectId }: Props) {
  const { toast } = useToast();
  const [selectedKeywordId, setSelectedKeywordId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [serpFeatureFilter, setSerpFeatureFilter] = useState<string>("all");
  const [aiStatusFilter, setAiStatusFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'keyword',
    direction: 'asc'
  });

  const { data: intelligenceData, isLoading } = useQuery<KeywordIntelligenceData>({
    queryKey: ['/api/keyword-intelligence', projectId],
    enabled: !!projectId,
  });

  const { data: keywordDetail, isLoading: isLoadingDetail } = useQuery<KeywordDetailData>({
    queryKey: ['/api/keyword-intelligence', selectedKeywordId, projectId],
    enabled: !!selectedKeywordId && !!projectId,
  });

  const filteredKeywords = useMemo(() => {
    if (!intelligenceData?.keywords) return [];

    let filtered = intelligenceData.keywords;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(k =>
        k.keyword.keyword.toLowerCase().includes(query) ||
        k.keyword.targetUrl?.toLowerCase().includes(query)
      );
    }

    if (intentFilter !== "all") {
      filtered = filtered.filter(k => k.keyword.searchIntent === intentFilter);
    }

    if (serpFeatureFilter !== "all") {
      filtered = filtered.filter(k => {
        if (!k.serpFeatures) return false;
        switch (serpFeatureFilter) {
          case "ai_overview": return k.serpFeatures.hasAiOverview;
          case "featured_snippet": return k.serpFeatures.hasFeaturedSnippet;
          case "local_pack": return k.serpFeatures.hasLocalPack;
          case "paa": return k.serpFeatures.hasPeopleAlsoAsk;
          default: return true;
        }
      });
    }

    if (aiStatusFilter !== "all") {
      filtered = filtered.filter(k => {
        if (aiStatusFilter === "cited") return k.aiIntelligence.isBrandCited;
        if (aiStatusFilter === "not_cited") return k.serpFeatures?.hasAiOverview && !k.aiIntelligence.isBrandCited;
        if (aiStatusFilter === "no_ai") return !k.serpFeatures?.hasAiOverview;
        return true;
      });
    }

    if (positionFilter !== "all") {
      filtered = filtered.filter(k => {
        const pos = k.metrics?.position ?? null;
        if (pos === null || pos === undefined) return positionFilter === "unranked";
        switch (positionFilter) {
          case "top3": return pos <= 3;
          case "top10": return pos <= 10;
          case "top20": return pos <= 20;
          case "beyond20": return pos > 20;
          default: return true;
        }
      });
    }

    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortConfig.key) {
        case 'keyword':
          aValue = a.keyword.keyword;
          bValue = b.keyword.keyword;
          break;
        case 'position':
          aValue = a.metrics?.position ?? 999;
          bValue = b.metrics?.position ?? 999;
          break;
        case 'volume':
          aValue = a.metrics?.searchVolume ?? 0;
          bValue = b.metrics?.searchVolume ?? 0;
          break;
        case 'opportunity':
          aValue = a.metrics?.opportunityScore ?? 0;
          bValue = b.metrics?.opportunityScore ?? 0;
          break;
        case 'stability':
          aValue = a.serpFeatures?.stabilityScore ?? 0;
          bValue = b.serpFeatures?.stabilityScore ?? 0;
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [intelligenceData?.keywords, searchQuery, intentFilter, serpFeatureFilter, aiStatusFilter, positionFilter, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Please select a project to view keyword intelligence.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const summary = intelligenceData?.summary;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Keyword Intelligence</h1>
          <p className="text-muted-foreground">
            Comprehensive keyword analysis with SERP features, AI mentions, and competitive insights
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.totalKeywords ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Keywords</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Bot className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.withAiOverview ?? 0}</p>
                <p className="text-sm text-muted-foreground">With AI Overview</p>
              </div>
            </div>
            {summary && summary.totalKeywords > 0 && (
              <div className="mt-2">
                <Progress value={(summary.withAiOverview / summary.totalKeywords) * 100} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.withFeaturedSnippet ?? 0}</p>
                <p className="text-sm text-muted-foreground">Featured Snippets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <MapPin className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.withLocalPack ?? 0}</p>
                <p className="text-sm text-muted-foreground">Local Pack</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Quote className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{((summary?.brandCitationRate ?? 0) * 100).toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Brand Citation Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(summary?.avgStability ?? 0).toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Avg Stability Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Keyword Explorer</CardTitle>
              <CardDescription>
                {filteredKeywords.length} keywords matching your filters
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-keyword-search"
                />
              </div>
              <Select value={intentFilter} onValueChange={setIntentFilter}>
                <SelectTrigger className="w-36" data-testid="select-intent-filter">
                  <SelectValue placeholder="Intent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Intents</SelectItem>
                  <SelectItem value="informational">Informational</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="transactional">Transactional</SelectItem>
                  <SelectItem value="navigational">Navigational</SelectItem>
                </SelectContent>
              </Select>
              <Select value={serpFeatureFilter} onValueChange={setSerpFeatureFilter}>
                <SelectTrigger className="w-40" data-testid="select-serp-filter">
                  <SelectValue placeholder="SERP Feature" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Features</SelectItem>
                  <SelectItem value="ai_overview">AI Overview</SelectItem>
                  <SelectItem value="featured_snippet">Featured Snippet</SelectItem>
                  <SelectItem value="local_pack">Local Pack</SelectItem>
                  <SelectItem value="paa">People Also Ask</SelectItem>
                </SelectContent>
              </Select>
              <Select value={aiStatusFilter} onValueChange={setAiStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-ai-filter">
                  <SelectValue placeholder="AI Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All AI Status</SelectItem>
                  <SelectItem value="cited">Brand Cited</SelectItem>
                  <SelectItem value="not_cited">Not Cited</SelectItem>
                  <SelectItem value="no_ai">No AI Overview</SelectItem>
                </SelectContent>
              </Select>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-32" data-testid="select-position-filter">
                  <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  <SelectItem value="top3">Top 3</SelectItem>
                  <SelectItem value="top10">Top 10</SelectItem>
                  <SelectItem value="top20">Top 20</SelectItem>
                  <SelectItem value="beyond20">Beyond 20</SelectItem>
                  <SelectItem value="unranked">Unranked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-3 font-medium">
                      <button
                        className="flex items-center gap-1 hover-elevate"
                        onClick={() => handleSort('keyword')}
                        data-testid="sort-keyword"
                      >
                        Keyword
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="text-center p-3 font-medium">
                      <button
                        className="flex items-center gap-1 hover-elevate mx-auto"
                        onClick={() => handleSort('position')}
                        data-testid="sort-position"
                      >
                        Position
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="text-center p-3 font-medium">
                      <button
                        className="flex items-center gap-1 hover-elevate mx-auto"
                        onClick={() => handleSort('volume')}
                        data-testid="sort-volume"
                      >
                        Volume
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="text-center p-3 font-medium">SERP Features</th>
                    <th className="text-center p-3 font-medium">AI Status</th>
                    <th className="text-center p-3 font-medium">
                      <button
                        className="flex items-center gap-1 hover-elevate mx-auto"
                        onClick={() => handleSort('opportunity')}
                        data-testid="sort-opportunity"
                      >
                        Opportunity
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="text-center p-3 font-medium">
                      <button
                        className="flex items-center gap-1 hover-elevate mx-auto"
                        onClick={() => handleSort('stability')}
                        data-testid="sort-stability"
                      >
                        Stability
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeywords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-muted-foreground">
                        No keywords match your filters
                      </td>
                    </tr>
                  ) : (
                    filteredKeywords.slice(0, 100).map((item) => (
                      <tr
                        key={item.keyword.id}
                        className="border-b last:border-0 hover-elevate cursor-pointer"
                        onClick={() => setSelectedKeywordId(item.keyword.id)}
                        data-testid={`row-keyword-${item.keyword.id}`}
                      >
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{item.keyword.keyword}</span>
                            {item.keyword.targetUrl && (
                              <span className="text-xs text-muted-foreground truncate max-w-xs">
                                {item.keyword.targetUrl}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              {item.keyword.searchIntent && (
                                <Badge variant="outline" className="text-xs">
                                  {item.keyword.searchIntent}
                                </Badge>
                              )}
                              {item.keyword.priorityTier && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.keyword.priorityTier}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={getPositionBadgeVariant(item.metrics?.position ?? null)}>
                            {item.metrics?.position ?? "—"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          {item.metrics?.searchVolume?.toLocaleString() ?? "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.serpFeatures?.hasAiOverview && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Bot className="h-4 w-4 text-violet-500" />
                                </TooltipTrigger>
                                <TooltipContent>AI Overview</TooltipContent>
                              </Tooltip>
                            )}
                            {item.serpFeatures?.hasFeaturedSnippet && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Sparkles className="h-4 w-4 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>Featured Snippet</TooltipContent>
                              </Tooltip>
                            )}
                            {item.serpFeatures?.hasLocalPack && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <MapPin className="h-4 w-4 text-emerald-500" />
                                </TooltipTrigger>
                                <TooltipContent>Local Pack</TooltipContent>
                              </Tooltip>
                            )}
                            {item.serpFeatures?.hasPeopleAlsoAsk && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <MessageSquare className="h-4 w-4 text-blue-500" />
                                </TooltipTrigger>
                                <TooltipContent>People Also Ask</TooltipContent>
                              </Tooltip>
                            )}
                            {item.serpFeatures?.hasVideoCarousel && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Video className="h-4 w-4 text-red-500" />
                                </TooltipTrigger>
                                <TooltipContent>Video Carousel</TooltipContent>
                              </Tooltip>
                            )}
                            {!item.serpFeatures?.hasAiOverview && 
                             !item.serpFeatures?.hasFeaturedSnippet && 
                             !item.serpFeatures?.hasLocalPack && 
                             !item.serpFeatures?.hasPeopleAlsoAsk && 
                             !item.serpFeatures?.hasVideoCarousel && (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {item.serpFeatures?.hasAiOverview ? (
                            item.aiIntelligence.isBrandCited ? (
                              <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                                Cited
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Not Cited
                              </Badge>
                            )
                          ) : (
                            <span className="text-muted-foreground text-xs">No AI</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`font-medium ${getOpportunityColor(item.metrics?.opportunityScore ?? null)}`}>
                            {item.metrics?.opportunityScore ?? "—"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span>{item.serpFeatures?.stabilityScore ?? "—"}</span>
                            {item.serpFeatures?.stabilityScore !== null && (
                              <Progress 
                                value={item.serpFeatures?.stabilityScore ?? 0} 
                                className="w-12 h-1.5" 
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredKeywords.length > 100 && (
              <div className="p-3 text-center text-sm text-muted-foreground border-t bg-muted/30">
                Showing 100 of {filteredKeywords.length} keywords. Use filters to narrow results.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selectedKeywordId} onOpenChange={(open) => !open && setSelectedKeywordId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {isLoadingDetail ? (
            <div className="space-y-4 pt-8">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
              <div className="space-y-2 pt-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            </div>
          ) : keywordDetail ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {keywordDetail.keyword.keyword}
                  {keywordDetail.keyword.priorityTier && (
                    <Badge variant="secondary">{keywordDetail.keyword.priorityTier}</Badge>
                  )}
                </SheetTitle>
                <SheetDescription>
                  {keywordDetail.keyword.targetUrl && (
                    <a 
                      href={keywordDetail.keyword.targetUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:underline"
                    >
                      {keywordDetail.keyword.targetUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </SheetDescription>
              </SheetHeader>

              <Tabs defaultValue="overview" className="mt-6">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                  <TabsTrigger value="ai" data-testid="tab-ai">AI Intelligence</TabsTrigger>
                  <TabsTrigger value="serp" data-testid="tab-serp">SERP Layout</TabsTrigger>
                  <TabsTrigger value="competitors" data-testid="tab-competitors">Competitors</TabsTrigger>
                  <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Position</p>
                        <p className="text-2xl font-bold">
                          {keywordDetail.metrics?.position ?? "—"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Search Volume</p>
                        <p className="text-2xl font-bold">
                          {keywordDetail.metrics?.searchVolume?.toLocaleString() ?? "—"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Opportunity Score</p>
                        <p className={`text-2xl font-bold ${getOpportunityColor(keywordDetail.metrics?.opportunityScore)}`}>
                          {keywordDetail.metrics?.opportunityScore ?? "—"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Difficulty</p>
                        <p className="text-2xl font-bold">
                          {keywordDetail.metrics?.keywordDifficulty ?? "—"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {keywordDetail.serpSnapshot && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">SERP Features Detected</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {keywordDetail.serpSnapshot.hasAiOverview && (
                            <Badge className="bg-violet-500/10 text-violet-600 dark:text-violet-400 gap-1">
                              <Bot className="h-3 w-3" /> AI Overview
                            </Badge>
                          )}
                          {keywordDetail.serpSnapshot.hasFeaturedSnippet && (
                            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1">
                              <Sparkles className="h-3 w-3" /> Featured Snippet
                            </Badge>
                          )}
                          {keywordDetail.serpSnapshot.hasLocalPack && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1">
                              <MapPin className="h-3 w-3" /> Local Pack
                            </Badge>
                          )}
                        </div>
                        <div className="mt-4 flex items-center gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Organic Starts At</p>
                            <p className="font-medium">Position {keywordDetail.serpSnapshot.organicStartPosition ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Stability Score</p>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{keywordDetail.serpSnapshot.stabilityScore ?? "—"}</p>
                              {keywordDetail.serpSnapshot.stabilityScore && (
                                <Progress value={keywordDetail.serpSnapshot.stabilityScore} className="w-16 h-1.5" />
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {keywordDetail.alerts.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          Recent Alerts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {keywordDetail.alerts.slice(0, 5).map(alert => (
                            <div key={alert.id} className={`p-2 rounded-md ${SEVERITY_STYLES[alert.severity]?.bg || 'bg-muted'}`}>
                              <p className={`font-medium text-sm ${SEVERITY_STYLES[alert.severity]?.text || ''}`}>
                                {alert.title}
                              </p>
                              {alert.description && (
                                <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="ai" className="space-y-4 mt-4">
                  {keywordDetail.aiCitations.length > 0 ? (
                    <>
                      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="p-3 rounded-full bg-violet-500/10">
                          <Bot className="h-6 w-6 text-violet-500" />
                        </div>
                        <div>
                          <p className="font-medium">{keywordDetail.aiCitations.length} AI Overview Citations</p>
                          <p className="text-sm text-muted-foreground">
                            {keywordDetail.aiCitations.filter(c => c.isBrandMention).length} brand mentions
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {keywordDetail.aiCitations.map(citation => (
                          <Card key={citation.id}>
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{citation.sourceDomain}</p>
                                    {citation.isBrandMention && (
                                      <Badge className="bg-green-500/10 text-green-600 text-xs">Brand</Badge>
                                    )}
                                    {citation.contentType && (
                                      <Badge variant="outline" className="text-xs">{citation.contentType}</Badge>
                                    )}
                                  </div>
                                  {citation.sourceTitle && (
                                    <p className="text-sm text-muted-foreground mt-1">{citation.sourceTitle}</p>
                                  )}
                                  {citation.citedText && (
                                    <blockquote className="mt-2 pl-3 border-l-2 border-muted text-sm italic text-muted-foreground">
                                      "{citation.citedText}"
                                    </blockquote>
                                  )}
                                </div>
                                {citation.sourceUrl && (
                                  <Button variant="ghost" size="icon" asChild>
                                    <a href={citation.sourceUrl} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Position #{citation.referencePosition} · {format(new Date(citation.capturedAt), 'MMM d, yyyy')}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <Bot className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No AI Overview citations found for this keyword</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Citations will appear after crawling keywords with AI Overview enabled
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="serp" className="space-y-4 mt-4">
                  {keywordDetail.serpLayoutItems.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground mb-4">
                        SERP layout as of {keywordDetail.serpSnapshot?.capturedAt ? format(new Date(keywordDetail.serpSnapshot.capturedAt), 'MMM d, yyyy h:mm a') : 'Unknown'}
                      </p>
                      {keywordDetail.serpLayoutItems.map((item, idx) => {
                        const Icon = BLOCK_ICONS[item.blockType] || Layers;
                        const color = BLOCK_COLORS[item.blockType] || 'hsl(var(--muted-foreground))';
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 rounded-lg border"
                            style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded" style={{ backgroundColor: `${color}20` }}>
                              <Icon className="h-4 w-4" style={{ color }} />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{formatBlockType(item.blockType)}</p>
                              <p className="text-xs text-muted-foreground">
                                Position {item.positionStart ?? idx + 1}
                                {item.positionEnd && item.positionEnd !== item.positionStart && ` - ${item.positionEnd}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.ourBrandPresent && (
                                <Badge className="bg-green-500/10 text-green-600 text-xs">
                                  We're Here
                                </Badge>
                              )}
                              {item.competitorDomains && item.competitorDomains.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {item.competitorDomains.length} competitors
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No SERP layout data available</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Layout data will appear after crawling this keyword
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="competitors" className="space-y-4 mt-4">
                  {keywordDetail.competitorPresence.length > 0 ? (
                    <div className="space-y-3">
                      {keywordDetail.competitorPresence.map(comp => (
                        <Card key={comp.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{comp.competitorDomain}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {comp.inAiOverview && (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <Bot className="h-3 w-3" /> AI Overview
                                    </Badge>
                                  )}
                                  {comp.inFeaturedSnippet && (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <Sparkles className="h-3 w-3" /> Featured Snippet
                                    </Badge>
                                  )}
                                  {comp.inLocalPack && (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <MapPin className="h-3 w-3" /> Local Pack
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {comp.organicPosition && (
                                <div className="text-right">
                                  <p className="text-sm text-muted-foreground">Organic Position</p>
                                  <Badge variant={getPositionBadgeVariant(comp.organicPosition)}>
                                    #{comp.organicPosition}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No competitor data available</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Competitor presence will be tracked during SERP crawls
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="space-y-4 mt-4">
                  {keywordDetail.rankingsHistory.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Position History (Last 30 Days)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={keywordDetail.rankingsHistory.slice().reverse().map(r => ({
                                date: format(new Date(r.date), 'MMM d'),
                                position: r.position,
                              }))}
                              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="positionGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="date" className="text-xs" />
                              <YAxis reversed domain={[1, 'auto']} className="text-xs" />
                              <RechartsTooltip 
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--background))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="position" 
                                stroke="hsl(var(--primary))" 
                                fillOpacity={1}
                                fill="url(#positionGradient)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-center py-12">
                      <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No ranking history available</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Position history will be tracked over time
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Failed to load keyword details</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
