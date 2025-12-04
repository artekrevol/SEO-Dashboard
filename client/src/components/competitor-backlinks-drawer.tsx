import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Link2,
  ExternalLink,
  Globe,
  Search,
  CheckCircle,
  Shield,
  AlertTriangle,
  Target,
  TrendingUp,
  Loader2,
  RefreshCw,
  Star,
  Plus,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Anchor,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CompetitorBacklink {
  id: number;
  projectId: string;
  competitorDomain: string;
  targetUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  anchorText: string | null;
  linkType: string;
  isLive: boolean;
  domainAuthority: number | null;
  pageAuthority: number | null;
  spamScore: number | null;
  isOpportunity: boolean;
  opportunityScore: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface CompetitorBacklinkAggregations {
  totalBacklinks: number;
  liveBacklinks: number;
  referringDomains: number;
  dofollowCount: number;
  avgDomainAuthority: number | null;
  opportunities: number;
  topOpportunities: { sourceDomain: string; domainAuthority: number; opportunityScore: number }[];
  linkTypeBreakdown: { type: string; count: number }[];
}

interface DomainGroup {
  domain: string;
  backlinks: number;
  liveLinks: number;
  isOpportunity: boolean;
  avgDomainAuthority: number | null;
  avgSpamScore: number | null;
}

interface GapAnalysisItem {
  sourceDomain: string;
  competitorCount: number;
  competitors: string[];
  avgDomainAuthority: number;
  avgSpamScore: number | null;
  bestOpportunityScore: number;
  linkType: string;
  isHighPriority: boolean;
}

interface GapAnalysis {
  gaps: GapAnalysisItem[];
  summary: {
    totalGaps: number;
    highPriorityGaps: number;
    avgGapDA: number;
    ourBacklinkDomains: number;
    competitorBacklinkDomains: number;
  };
}

interface CompetitorBacklinksDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  competitorDomain: string;
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function getSpamScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score <= 30) return "text-green-600";
  if (score <= 60) return "text-yellow-600";
  return "text-red-600";
}

function getSpamScoreBadge(score: number | null) {
  if (score === null) return { label: "Unknown", variant: "secondary" as const, className: "" };
  if (score <= 30) return { label: "Safe", variant: "secondary" as const, className: "bg-green-500/10 text-green-600" };
  if (score <= 60) return { label: "Review", variant: "secondary" as const, className: "bg-yellow-500/10 text-yellow-600" };
  return { label: "Toxic", variant: "destructive" as const, className: "bg-red-500/10 text-red-600" };
}

function getOpportunityScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-yellow-600";
  return "text-muted-foreground";
}

export function CompetitorBacklinksDrawer({
  open,
  onOpenChange,
  projectId,
  competitorDomain,
}: CompetitorBacklinksDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [opportunityFilter, setOpportunityFilter] = useState<"all" | "opportunities">("all");
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: backlinks = [], isLoading: isLoadingBacklinks, refetch: refetchBacklinks } = useQuery<CompetitorBacklink[]>({
    queryKey: ["/api/competitor-backlinks", projectId, competitorDomain],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId, competitorDomain });
      const res = await fetch(`/api/competitor-backlinks?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch competitor backlinks");
      return res.json();
    },
    enabled: open && !!projectId && !!competitorDomain,
  });

  const { data: aggregations, isLoading: isLoadingAggregations } = useQuery<CompetitorBacklinkAggregations>({
    queryKey: ["/api/competitor-backlinks/aggregations", projectId, competitorDomain],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId, competitorDomain });
      const res = await fetch(`/api/competitor-backlinks/aggregations?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch aggregations");
      return res.json();
    },
    enabled: open && !!projectId && !!competitorDomain,
  });

  const { data: domainGroups = [], isLoading: isLoadingDomains } = useQuery<DomainGroup[]>({
    queryKey: ["/api/competitor-backlinks/by-domain", projectId, competitorDomain],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId, competitorDomain });
      const res = await fetch(`/api/competitor-backlinks/by-domain?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch domains");
      return res.json();
    },
    enabled: open && !!projectId && !!competitorDomain,
  });

  const { data: gapAnalysis, isLoading: isLoadingGaps } = useQuery<GapAnalysis>({
    queryKey: ["/api/competitor-backlinks/gap-analysis", projectId, competitorDomain],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId, competitorDomain });
      const res = await fetch(`/api/competitor-backlinks/gap-analysis?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch gap analysis");
      return res.json();
    },
    enabled: open && !!projectId && !!competitorDomain,
  });

  const crawlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/competitor-backlinks/crawl", {
        projectId,
        competitorDomain,
        limit: 100,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Backlinks Fetched",
        description: `Processed ${data.backlinksProcessed} backlinks. Found ${data.opportunitiesIdentified} opportunities.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/competitor-backlinks"] });
    },
    onError: (error) => {
      toast({
        title: "Fetch Failed",
        description: error instanceof Error ? error.message : "Failed to fetch competitor backlinks",
        variant: "destructive",
      });
    },
  });

  const [promotedDomains, setPromotedDomains] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPromotedDomains(new Set());
  }, [projectId, competitorDomain]);

  const promoteMutation = useMutation({
    mutationFn: async (gap: GapAnalysisItem) => {
      const res = await apiRequest("POST", "/api/recommendations/promote-gap", {
        projectId,
        sourceDomain: gap.sourceDomain,
        domainAuthority: gap.avgDomainAuthority,
        linkType: gap.linkType,
        spamScore: gap.avgSpamScore,
        competitors: gap.competitors,
        competitorCount: gap.competitorCount,
      });
      return res.json();
    },
    onSuccess: (_, gap) => {
      setPromotedDomains(prev => new Set(prev).add(gap.sourceDomain));
      toast({
        title: "Added to Recommendations",
        description: `${gap.sourceDomain} has been added to your outreach recommendations.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recommendations"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Promote",
        description: error instanceof Error ? error.message : "Failed to add to recommendations",
        variant: "destructive",
      });
    },
  });

  const filteredBacklinks = useMemo(() => {
    return backlinks.filter((backlink) => {
      const matchesSearch =
        !searchQuery ||
        backlink.sourceDomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        backlink.sourceUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (backlink.anchorText && backlink.anchorText.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesOpportunity =
        opportunityFilter === "all" || (opportunityFilter === "opportunities" && backlink.isOpportunity);

      return matchesSearch && matchesOpportunity;
    });
  }, [backlinks, searchQuery, opportunityFilter]);

  const isLoading = isLoadingBacklinks || isLoadingAggregations || isLoadingDomains || isLoadingGaps;
  const [overviewFilter, setOverviewFilter] = useState<"all" | "opportunities">("all");

  const derivedStats = useMemo(() => {
    const allOpportunities = backlinks.filter(b => b.isOpportunity);
    const dataSet = overviewFilter === "opportunities" ? allOpportunities : backlinks;
    const liveBacklinks = dataSet.filter(b => b.isLive);
    const uniqueDomains = new Set(liveBacklinks.map(b => b.sourceDomain));
    const withSpamScore = liveBacklinks.filter(b => b.spamScore !== null);
    
    const daValues = liveBacklinks.filter(b => b.domainAuthority).map(b => b.domainAuthority!);
    const avgDA = daValues.length > 0 
      ? Math.round(daValues.reduce((a, b) => a + b, 0) / daValues.length) 
      : 0;
    
    const topOpps = dataSet
      .filter(b => b.isOpportunity && b.isLive)
      .sort((a, b) => (Number(b.opportunityScore) || 0) - (Number(a.opportunityScore) || 0))
      .slice(0, 5)
      .map(b => ({
        sourceDomain: b.sourceDomain,
        domainAuthority: b.domainAuthority || 0,
        opportunityScore: Number(b.opportunityScore) || 0,
      }));
    
    const typeCounts = new Map<string, number>();
    liveBacklinks.forEach(b => {
      typeCounts.set(b.linkType, (typeCounts.get(b.linkType) || 0) + 1);
    });
    
    return {
      totalBacklinks: dataSet.length,
      liveBacklinks: liveBacklinks.length,
      referringDomains: uniqueDomains.size,
      opportunities: dataSet.filter(b => b.isOpportunity).length,
      opportunityCount: allOpportunities.length,
      avgDomainAuthority: avgDA,
      topOpportunities: topOpps,
      linkTypeBreakdown: Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      spamStats: {
        safe: withSpamScore.filter(b => b.spamScore !== null && b.spamScore <= 30).length,
        review: withSpamScore.filter(b => b.spamScore !== null && b.spamScore > 30 && b.spamScore <= 60).length,
        toxic: withSpamScore.filter(b => b.spamScore !== null && b.spamScore > 60).length,
        unknown: liveBacklinks.length - withSpamScore.length,
      },
    };
  }, [backlinks, overviewFilter]);

  const opportunityBacklinks = useMemo(() => backlinks.filter(b => b.isOpportunity), [backlinks]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2" data-testid="competitor-drawer-title">
            <Target className="h-5 w-5" />
            Competitor Backlinks
          </SheetTitle>
          <SheetDescription className="truncate" data-testid="competitor-drawer-description">
            <span className="font-mono text-xs">{competitorDomain}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {isLoading && backlinks.length === 0 ? (
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : backlinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
              <Link2 className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-medium mb-1">No Backlinks Found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Fetch backlinks from this competitor to discover link building opportunities.
                </p>
                <Button
                  onClick={() => crawlMutation.mutate()}
                  disabled={crawlMutation.isPending}
                  data-testid="button-fetch-backlinks"
                >
                  {crawlMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Fetch Backlinks
                </Button>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="overview" className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mx-4 mt-4 shrink-0">
                <TabsList data-testid="competitor-tabs-list">
                  <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                  <TabsTrigger value="gap" data-testid="tab-gap" className="text-orange-600">
                    Gap ({gapAnalysis?.summary.totalGaps || 0})
                  </TabsTrigger>
                  <TabsTrigger value="opportunities" data-testid="tab-opportunities">
                    Opportunities ({opportunityBacklinks.length})
                  </TabsTrigger>
                  <TabsTrigger value="domains" data-testid="tab-domains">
                    By Domain ({domainGroups.length})
                  </TabsTrigger>
                  <TabsTrigger value="all" data-testid="tab-all">All ({backlinks.length})</TabsTrigger>
                </TabsList>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => crawlMutation.mutate()}
                  disabled={crawlMutation.isPending}
                  data-testid="button-refresh-backlinks"
                >
                  {crawlMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <TabsContent value="overview" className="flex-1 overflow-auto mt-4 px-4">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Statistics View</span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={overviewFilter === "all" ? "default" : "outline"}
                        onClick={() => setOverviewFilter("all")}
                        data-testid="filter-all-links"
                      >
                        All Links
                      </Button>
                      <Button
                        size="sm"
                        variant={overviewFilter === "opportunities" ? "default" : "outline"}
                        onClick={() => setOverviewFilter("opportunities")}
                        className={overviewFilter === "opportunities" ? "bg-green-600 hover:bg-green-700" : ""}
                        data-testid="filter-opportunities-only"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Opportunities
                      </Button>
                    </div>
                  </div>
                  {overviewFilter === "opportunities" && (
                    <div className="text-xs text-green-600 bg-green-500/10 rounded-md p-2 text-center flex items-center justify-center gap-1">
                      <Star className="h-3 w-3" />
                      Showing stats for {derivedStats.opportunityCount} opportunities only
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Link2 className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wider">Total Links</span>
                        </div>
                        <div className="text-2xl font-bold" data-testid="stat-total">
                          {derivedStats.totalBacklinks}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Globe className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wider">Domains</span>
                        </div>
                        <div className="text-2xl font-bold" data-testid="stat-domains">
                          {derivedStats.referringDomains}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-green-500/30 bg-green-500/5">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-green-600 mb-1">
                          <Star className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wider">Opportunities</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600" data-testid="stat-opportunities">
                          {derivedStats.opportunities}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wider">Avg DA</span>
                        </div>
                        <div className="text-2xl font-bold" data-testid="stat-avg-da">
                          {derivedStats.avgDomainAuthority}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {derivedStats.topOpportunities.length > 0 && (
                    <Card className="border-green-500/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                          <Star className="h-4 w-4" />
                          Top Link Opportunities
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3" data-testid="opportunity-list">
                          {derivedStats.topOpportunities.map((opp, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between"
                              data-testid={`opportunity-item-${i}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate max-w-[180px]" title={opp.sourceDomain}>
                                  {opp.sourceDomain}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  DA {opp.domainAuthority}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={opp.opportunityScore} 
                                  className="w-16 h-2"
                                />
                                <span className={cn("text-sm font-medium", getOpportunityScoreColor(opp.opportunityScore))}>
                                  {opp.opportunityScore}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          High-DA domains linking to competitor but not to you
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {derivedStats.linkTypeBreakdown.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Link Types
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2" data-testid="type-breakdown">
                          {derivedStats.linkTypeBreakdown.map((item, i) => (
                            <Badge
                              key={i}
                              variant={item.type === "dofollow" ? "default" : "secondary"}
                              className={cn(
                                item.type === "dofollow"
                                  ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                                  : "bg-muted"
                              )}
                              data-testid={`type-badge-${item.type}`}
                            >
                              {item.type}: {item.count}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {(derivedStats.spamStats.safe > 0 || derivedStats.spamStats.review > 0 || derivedStats.spamStats.toxic > 0) && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Spam Score Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2" data-testid="spam-breakdown">
                          <Badge
                            variant="secondary"
                            className="bg-green-500/10 text-green-600"
                            data-testid="spam-safe-count"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Safe: {derivedStats.spamStats.safe}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="bg-yellow-500/10 text-yellow-600"
                            data-testid="spam-review-count"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Review: {derivedStats.spamStats.review}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="bg-red-500/10 text-red-600"
                            data-testid="spam-toxic-count"
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            Toxic: {derivedStats.spamStats.toxic}
                          </Badge>
                          {derivedStats.spamStats.unknown > 0 && (
                            <Badge variant="outline" data-testid="spam-unknown-count">
                              Unknown: {derivedStats.spamStats.unknown}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          Safe: 0-30% | Review: 31-60% | Toxic: 61-100%
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="gap" className="flex-1 min-h-0 mt-4 px-4">
                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-4 pb-4">
                    {gapAnalysis?.summary && (
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="border-orange-500/30 bg-orange-500/5">
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-2 text-orange-600 mb-1">
                              <Target className="h-4 w-4" />
                              <span className="text-xs uppercase tracking-wider">Gap Domains</span>
                            </div>
                            <div className="text-2xl font-bold text-orange-600" data-testid="stat-gap-total">
                              {gapAnalysis.summary.totalGaps}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-green-500/30 bg-green-500/5">
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-2 text-green-600 mb-1">
                              <Star className="h-4 w-4" />
                              <span className="text-xs uppercase tracking-wider">High Priority</span>
                            </div>
                            <div className="text-2xl font-bold text-green-600" data-testid="stat-high-priority">
                              {gapAnalysis.summary.highPriorityGaps}
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <TrendingUp className="h-4 w-4" />
                              <span className="text-xs uppercase tracking-wider">Avg Gap DA</span>
                            </div>
                            <div className="text-2xl font-bold" data-testid="stat-gap-da">
                              {gapAnalysis.summary.avgGapDA}
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <Globe className="h-4 w-4" />
                              <span className="text-xs uppercase tracking-wider">Our Domains</span>
                            </div>
                            <div className="text-2xl font-bold" data-testid="stat-our-domains">
                              {gapAnalysis.summary.ourBacklinkDomains}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    <div className="text-sm text-muted-foreground bg-orange-500/10 rounded-md p-3">
                      <span className="font-medium text-orange-600">Gap Analysis:</span> These are domains that link to <span className="font-mono text-xs">{competitorDomain}</span> but don't link to you. High priority gaps have DA 40+ and link to multiple competitors.
                    </div>

                    {gapAnalysis?.gaps.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No gaps found</p>
                        <p className="text-xs mt-1">
                          All competitor backlink domains also link to you, or no competitor backlinks tracked yet
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {gapAnalysis?.gaps.slice(0, 50).map((gap, i) => (
                          <Card 
                            key={i} 
                            className={cn(
                              gap.isHighPriority && "border-green-500/30 bg-green-500/5"
                            )} 
                            data-testid={`gap-card-${i}`}
                          >
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {gap.isHighPriority && (
                                      <Star className="h-4 w-4 text-green-600 shrink-0" />
                                    )}
                                    <span className="font-medium text-sm truncate" title={gap.sourceDomain}>
                                      {gap.sourceDomain}
                                    </span>
                                    <a
                                      href={`https://${gap.sourceDomain}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-muted-foreground hover:text-foreground shrink-0"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Links to {gap.competitorCount} competitor{gap.competitorCount > 1 ? 's' : ''}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <Badge variant="secondary" className="text-xs">
                                    DA {gap.avgDomainAuthority}
                                  </Badge>
                                  <Badge 
                                    variant="secondary" 
                                    className={cn(
                                      "text-xs",
                                      gap.linkType === "dofollow" 
                                        ? "bg-green-500/10 text-green-600" 
                                        : "bg-muted"
                                    )}
                                  >
                                    {gap.linkType}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs mt-2">
                                <div className="flex flex-wrap gap-1">
                                  {gap.competitors.slice(0, 3).map((comp, j) => (
                                    <Badge key={j} variant="outline" className="text-xs font-mono">
                                      {comp.length > 20 ? comp.slice(0, 20) + '...' : comp}
                                    </Badge>
                                  ))}
                                  {gap.competitors.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{gap.competitors.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {gap.avgSpamScore !== null && (
                                    <Badge 
                                      variant="secondary" 
                                      className={cn(
                                        "text-xs",
                                        gap.avgSpamScore <= 30 
                                          ? "bg-green-500/10 text-green-600" 
                                          : gap.avgSpamScore <= 60 
                                            ? "bg-yellow-500/10 text-yellow-600" 
                                            : "bg-red-500/10 text-red-600"
                                      )}
                                    >
                                      Spam {gap.avgSpamScore}%
                                    </Badge>
                                  )}
                                  {promotedDomains.has(gap.sourceDomain) ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled
                                      className="h-7 text-green-600"
                                      data-testid={`button-promoted-${i}`}
                                    >
                                      <CheckCheck className="h-3 w-3 mr-1" />
                                      Added
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7"
                                      onClick={() => promoteMutation.mutate(gap)}
                                      disabled={promoteMutation.isPending}
                                      data-testid={`button-promote-${i}`}
                                    >
                                      {promoteMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      ) : (
                                        <Plus className="h-3 w-3 mr-1" />
                                      )}
                                      Outreach
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {(gapAnalysis?.gaps.length || 0) > 50 && (
                          <p className="text-xs text-muted-foreground text-center">
                            Showing top 50 of {gapAnalysis?.gaps.length} gap opportunities
                          </p>
                        )}
                      </div>
                    )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="opportunities" className="flex-1 min-h-0 mt-4 px-4">
                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-3 pb-4">
                    {opportunityBacklinks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No opportunities found yet</p>
                        <p className="text-xs mt-1">
                          High-DA domains will appear here when they link to the competitor but not to you
                        </p>
                      </div>
                    ) : (
                      opportunityBacklinks.map((backlink) => (
                        <Card key={backlink.id} className="border-green-500/20" data-testid={`opportunity-card-${backlink.id}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm truncate" title={backlink.sourceDomain}>
                                    {backlink.sourceDomain}
                                  </span>
                                  <a
                                    href={backlink.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                                <div className="text-xs text-muted-foreground truncate" title={backlink.sourceUrl}>
                                  {backlink.sourceUrl}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <Badge variant="secondary" className="text-xs">
                                  DA {backlink.domainAuthority || 0}
                                </Badge>
                                {backlink.opportunityScore && (
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      "text-xs",
                                      Number(backlink.opportunityScore) >= 80
                                        ? "bg-green-500/10 text-green-600"
                                        : Number(backlink.opportunityScore) >= 60
                                        ? "bg-blue-500/10 text-blue-600"
                                        : "bg-yellow-500/10 text-yellow-600"
                                    )}
                                  >
                                    Score {backlink.opportunityScore}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Badge
                                variant={backlink.linkType === "dofollow" ? "default" : "secondary"}
                                className={cn(
                                  "text-xs",
                                  backlink.linkType === "dofollow"
                                    ? "bg-green-500/10 text-green-600"
                                    : ""
                                )}
                              >
                                {backlink.linkType}
                              </Badge>
                              {backlink.spamScore !== null && (
                                <Badge
                                  variant={getSpamScoreBadge(backlink.spamScore).variant}
                                  className={getSpamScoreBadge(backlink.spamScore).className}
                                >
                                  {backlink.spamScore <= 30 ? (
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                  ) : backlink.spamScore <= 60 ? (
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                  ) : (
                                    <Shield className="h-3 w-3 mr-1" />
                                  )}
                                  Spam: {backlink.spamScore}%
                                </Badge>
                              )}
                              {backlink.anchorText && (
                                <span className="text-muted-foreground truncate max-w-[120px]" title={backlink.anchorText}>
                                  "{backlink.anchorText}"
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="domains" className="flex-1 min-h-0 mt-4 px-4 pb-4">
                <div className="flex-1 min-h-0" data-testid="scroll-container-domains">
                  <ScrollArea className="h-full" data-testid="scroll-area-domains">
                    <div className="space-y-3 pr-4">
                    {domainGroups.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground" data-testid="no-domains">
                        No referring domains found.
                      </div>
                    ) : (
                      domainGroups.map((group) => {
                        const isExpanded = expandedDomain === group.domain;
                        const domainBacklinks = backlinks.filter(bl => bl.sourceDomain === group.domain);
                        
                        return (
                          <Card
                            key={group.domain}
                            className={cn(
                              "transition-colors",
                              group.isOpportunity && "border-green-500/30 bg-green-500/5"
                            )}
                            data-testid={`domain-group-${group.domain}`}
                          >
                            <CardContent className="py-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span className="font-medium truncate">{group.domain}</span>
                                    {group.isOpportunity && (
                                      <Star className="h-3 w-3 text-green-500" />
                                    )}
                                    {group.avgDomainAuthority && (
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        DA: {group.avgDomainAuthority}
                                      </Badge>
                                    )}
                                  </div>
                                  {group.avgSpamScore !== null && (
                                    <div className="flex items-center gap-1 mt-1 text-xs">
                                      <span className="text-muted-foreground">Avg Spam:</span>
                                      <Badge
                                        variant={getSpamScoreBadge(group.avgSpamScore).variant}
                                        className={cn("text-xs", getSpamScoreBadge(group.avgSpamScore).className)}
                                      >
                                        {group.avgSpamScore}%
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant="secondary"
                                      className="cursor-pointer hover-elevate"
                                      onClick={() => setExpandedDomain(isExpanded ? null : group.domain)}
                                      data-testid={`toggle-links-${group.domain}`}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-3 w-3 mr-1" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3 mr-1" />
                                      )}
                                      {group.backlinks} link{group.backlinks !== 1 ? "s" : ""}
                                    </Badge>
                                    {group.liveLinks > 0 && (
                                      <Badge
                                        variant="secondary"
                                        className="bg-green-500/10 text-green-600"
                                      >
                                        {group.liveLinks} live
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {isExpanded && domainBacklinks.length > 0 && (
                                <div className="mt-3 pt-3 border-t space-y-2">
                                  {domainBacklinks.map((backlink) => (
                                    <div 
                                      key={backlink.id}
                                      className={cn(
                                        "flex items-start gap-2 text-sm pl-2 py-2 rounded-md",
                                        backlink.isOpportunity ? "bg-green-500/10" : "bg-muted/30"
                                      )}
                                      data-testid={`domain-backlink-${backlink.id}`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <a
                                          href={backlink.sourceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm hover:text-primary flex items-center gap-1 break-all"
                                        >
                                          {backlink.sourceUrl}
                                          <ExternalLink className="h-3 w-3 shrink-0" />
                                        </a>
                                        {backlink.anchorText && (
                                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                            <Anchor className="h-3 w-3 shrink-0" />
                                            <span className="truncate">"{backlink.anchorText}"</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {backlink.isOpportunity && (
                                          <Star className="h-3 w-3 text-green-500" />
                                        )}
                                        {backlink.isLive ? (
                                          <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                                            Live
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-600">
                                            Lost
                                          </Badge>
                                        )}
                                        <Badge
                                          variant="secondary"
                                          className={cn(
                                            "text-xs",
                                            backlink.linkType === "dofollow"
                                              ? "bg-blue-500/10 text-blue-600"
                                              : ""
                                          )}
                                        >
                                          {backlink.linkType}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="all" className="flex-1 min-h-0 mt-4 px-4">
                <div className="mb-4 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by domain, URL, or anchor..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search"
                    />
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-2 pb-4">
                    {filteredBacklinks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No backlinks match your search
                      </div>
                    ) : (
                      filteredBacklinks.map((backlink) => (
                        <div
                          key={backlink.id}
                          className={cn(
                            "p-3 rounded-lg border bg-card transition-colors",
                            backlink.isOpportunity && "border-green-500/30 bg-green-500/5"
                          )}
                          data-testid={`backlink-row-${backlink.id}`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate" title={backlink.sourceDomain}>
                                  {backlink.sourceDomain}
                                </span>
                                {backlink.isOpportunity && (
                                  <Star className="h-3 w-3 text-green-500" />
                                )}
                                <a
                                  href={backlink.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              {backlink.domainAuthority !== null && (
                                <Badge variant="outline" className="text-xs">
                                  DA {backlink.domainAuthority}
                                </Badge>
                              )}
                              {backlink.spamScore !== null && (
                                <Badge
                                  variant={getSpamScoreBadge(backlink.spamScore).variant}
                                  className={cn("text-xs", getSpamScoreBadge(backlink.spamScore).className)}
                                >
                                  {backlink.spamScore}%
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge
                              variant={backlink.linkType === "dofollow" ? "default" : "secondary"}
                              className={cn(
                                "text-xs",
                                backlink.linkType === "dofollow"
                                  ? "bg-green-500/10 text-green-600"
                                  : ""
                              )}
                            >
                              {backlink.linkType}
                            </Badge>
                            {backlink.anchorText && (
                              <span className="truncate max-w-[150px]" title={backlink.anchorText}>
                                "{backlink.anchorText}"
                              </span>
                            )}
                            <span>Seen {formatDate(backlink.lastSeenAt)}</span>
                          </div>
                        </div>
                      ))
                    )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
