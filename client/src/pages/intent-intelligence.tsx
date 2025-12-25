import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Target,
  Shield,
  CheckCircle2,
  XCircle,
  Sparkles,
  LayoutList,
  Layers,
  Bot,
  Video,
  ShoppingCart,
  MessageSquare,
  MapPin,
  Image,
  Newspaper,
  ListChecks,
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

interface IntentDashboard {
  totalSnapshots: number;
  avgStabilityScore: number;
  keywordsWithAiOverview: number;
  keywordsWithFeaturedSnippet: number;
  keywordsWithLocalPack: number;
  avgOrganicPosition: number;
  recentAlerts: Array<{
    id: number;
    alertType: string;
    severity: string;
    title: string;
    createdAt: string;
    isResolved: boolean;
  }>;
  layoutDistribution: Record<string, number>;
}

interface IntentAlert {
  id: number;
  projectId: string;
  keywordId: number | null;
  snapshotId: number | null;
  alertType: string;
  severity: string;
  title: string;
  description: string | null;
  previousValue: string | null;
  currentValue: string | null;
  impactScore: string | null;
  suggestedAction: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

interface CompetitorVisibility {
  competitorDomain: string;
  totalMentions: number;
  aiOverviewMentions: number;
  featuredSnippetMentions: number;
  localPackMentions: number;
  organicMentions: number;
}

interface FeatureOpportunity {
  keywordId: number;
  keyword: string;
  competitors: string[];
  position: number | null;
  lastSeen: string;
}

interface SerpOpportunities {
  aiOverviewOpportunities: FeatureOpportunity[];
  featuredSnippetOpportunities: FeatureOpportunity[];
  localPackOpportunities: FeatureOpportunity[];
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
  knowledge_panel: LayoutList,
  shopping: ShoppingCart,
  top_stories: Newspaper,
  organic: ListChecks,
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive" },
  high: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500" },
  low: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500" },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  intent_shift: "Intent Shift",
  competitor_gained_feature: "Competitor Gained Feature",
  organic_pushed_down: "Organic Pushed Down",
  competitor_in_ai_overview: "Competitor in AI Overview",
  lost_serp_feature: "Lost SERP Feature",
  volatility_spike: "Volatility Spike",
};

function formatBlockType(blockType: string): string {
  return blockType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// SERP Opportunities Section with summary cards + tabbed tables
function SerpOpportunitiesSection({ 
  opportunities, 
  isLoading,
  totalKeywords 
}: { 
  opportunities: SerpOpportunities | undefined;
  isLoading: boolean;
  totalKeywords: number;
}) {
  const [activeTab, setActiveTab] = useState("ai_overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: 'position', 
    direction: 'asc' 
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Compute stats for summary cards
  const aiCount = opportunities?.aiOverviewOpportunities?.length || 0;
  const fsCount = opportunities?.featuredSnippetOpportunities?.length || 0;
  const lpCount = opportunities?.localPackOpportunities?.length || 0;
  const totalOpportunities = aiCount + fsCount + lpCount;

  // Get top competitor for each feature
  const getTopCompetitor = (items: FeatureOpportunity[] | undefined) => {
    if (!items || items.length === 0) return null;
    const domainCounts: Record<string, number> = {};
    items.forEach(item => {
      item.competitors.forEach(c => {
        const domain = c.replace(/^www\./, '');
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      });
    });
    const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { domain: sorted[0][0], count: sorted[0][1] } : null;
  };

  const aiTopCompetitor = getTopCompetitor(opportunities?.aiOverviewOpportunities);
  const fsTopCompetitor = getTopCompetitor(opportunities?.featuredSnippetOpportunities);
  const lpTopCompetitor = getTopCompetitor(opportunities?.localPackOpportunities);

  // Get data for active tab
  const getActiveData = (): FeatureOpportunity[] => {
    switch (activeTab) {
      case 'ai_overview':
        return opportunities?.aiOverviewOpportunities || [];
      case 'featured_snippet':
        return opportunities?.featuredSnippetOpportunities || [];
      case 'local_pack':
        return opportunities?.localPackOpportunities || [];
      default:
        return [];
    }
  };

  // Filter and sort data
  const processedData = useMemo(() => {
    let data = getActiveData();
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(item => 
        item.keyword.toLowerCase().includes(query) ||
        item.competitors.some(c => c.toLowerCase().includes(query))
      );
    }

    // Sort
    data = [...data].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortConfig.key) {
        case 'keyword':
          aVal = a.keyword.toLowerCase();
          bVal = b.keyword.toLowerCase();
          break;
        case 'position':
          aVal = a.position || 999;
          bVal = b.position || 999;
          break;
        case 'competitors':
          aVal = a.competitors.length;
          bVal = b.competitors.length;
          break;
        case 'lastSeen':
          aVal = new Date(a.lastSeen).getTime();
          bVal = new Date(b.lastSeen).getTime();
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [activeTab, opportunities, searchQuery, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const paginatedData = processedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when tab or search changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // CSV Export
  const handleExport = () => {
    const data = getActiveData();
    if (data.length === 0) return;

    const tabName = activeTab.replace('_', '-');
    const headers = ['Keyword', 'Competitors', 'Organic Start Position', 'Last Seen'];
    const rows = data.map(item => [
      item.keyword,
      item.competitors.join('; '),
      item.position?.toString() || 'N/A',
      new Date(item.lastSeen).toLocaleDateString()
    ]);

    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serp-opportunities-${tabName}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-3 w-3" /> 
      : <ChevronDown className="h-3 w-3" />;
  };

  if (isLoading) {
    return (
      <Card data-testid="card-serp-opportunities">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-green-500" />
            SERP Feature Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-serp-opportunities">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-green-500" />
          SERP Feature Opportunities
          <Badge variant="secondary" className="ml-2">
            {totalOpportunities} Total
          </Badge>
        </CardTitle>
        <CardDescription>
          Keywords where competitors appear in premium SERP features but you don't - potential outranking targets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card 
            className={`cursor-pointer transition-all hover-elevate ${activeTab === 'ai_overview' ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => handleTabChange('ai_overview')}
            data-testid="kpi-ai-overview"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-blue-500/10 p-2">
                    <Bot className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">AI Overview</p>
                    <p className="text-2xl font-bold">{aiCount}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {totalKeywords > 0 && (
                    <p>{((aiCount / totalKeywords) * 100).toFixed(1)}% of keywords</p>
                  )}
                  {aiTopCompetitor && (
                    <p className="mt-1 truncate max-w-[100px]" title={aiTopCompetitor.domain}>
                      Top: {aiTopCompetitor.domain}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover-elevate ${activeTab === 'featured_snippet' ? 'ring-2 ring-amber-500' : ''}`}
            onClick={() => handleTabChange('featured_snippet')}
            data-testid="kpi-featured-snippet"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-amber-500/10 p-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Featured Snippet</p>
                    <p className="text-2xl font-bold">{fsCount}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {totalKeywords > 0 && (
                    <p>{((fsCount / totalKeywords) * 100).toFixed(1)}% of keywords</p>
                  )}
                  {fsTopCompetitor && (
                    <p className="mt-1 truncate max-w-[100px]" title={fsTopCompetitor.domain}>
                      Top: {fsTopCompetitor.domain}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover-elevate ${activeTab === 'local_pack' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => handleTabChange('local_pack')}
            data-testid="kpi-local-pack"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-green-500/10 p-2">
                    <MapPin className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Local Pack</p>
                    <p className="text-2xl font-bold">{lpCount}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {totalKeywords > 0 && (
                    <p>{((lpCount / totalKeywords) * 100).toFixed(1)}% of keywords</p>
                  )}
                  {lpTopCompetitor && (
                    <p className="mt-1 truncate max-w-[100px]" title={lpTopCompetitor.domain}>
                      Top: {lpTopCompetitor.domain}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Table Section */}
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList>
                <TabsTrigger value="ai_overview" data-testid="tab-ai-overview">
                  <Bot className="h-4 w-4 mr-1" />
                  AI Overview ({aiCount})
                </TabsTrigger>
                <TabsTrigger value="featured_snippet" data-testid="tab-featured-snippet">
                  <Sparkles className="h-4 w-4 mr-1" />
                  Featured Snippet ({fsCount})
                </TabsTrigger>
                <TabsTrigger value="local_pack" data-testid="tab-local-pack">
                  <MapPin className="h-4 w-4 mr-1" />
                  Local Pack ({lpCount})
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search keywords..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-8 w-[200px]"
                    data-testid="input-search-opportunities"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExport}
                  disabled={processedData.length === 0}
                  data-testid="button-export-csv"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>

            <TabsContent value={activeTab} className="mt-4">
              {processedData.length > 0 ? (
                <>
                  <div className="rounded-md border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th 
                              className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-muted/70"
                              onClick={() => handleSort('keyword')}
                            >
                              <div className="flex items-center gap-1">
                                Keyword
                                <SortIcon column="keyword" />
                              </div>
                            </th>
                            <th 
                              className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-muted/70"
                              onClick={() => handleSort('competitors')}
                            >
                              <div className="flex items-center gap-1">
                                Competitors
                                <SortIcon column="competitors" />
                              </div>
                            </th>
                            <th 
                              className="px-4 py-3 text-center font-medium cursor-pointer hover:bg-muted/70"
                              onClick={() => handleSort('position')}
                            >
                              <div className="flex items-center justify-center gap-1">
                                Organic Start
                                <SortIcon column="position" />
                              </div>
                            </th>
                            <th 
                              className="px-4 py-3 text-center font-medium cursor-pointer hover:bg-muted/70"
                              onClick={() => handleSort('lastSeen')}
                            >
                              <div className="flex items-center justify-center gap-1">
                                Last Seen
                                <SortIcon column="lastSeen" />
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedData.map((item, idx) => (
                            <tr 
                              key={item.keywordId}
                              className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                              data-testid={`row-opportunity-${item.keywordId}`}
                            >
                              <td className="px-4 py-3">
                                <span className="font-medium" title={item.keyword}>
                                  {item.keyword.length > 50 ? item.keyword.slice(0, 50) + '...' : item.keyword}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {item.competitors.slice(0, 3).map((c, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {c.replace(/^www\./, '').slice(0, 20)}
                                    </Badge>
                                  ))}
                                  {item.competitors.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{item.competitors.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {item.position ? (
                                  <Badge variant={item.position <= 5 ? "destructive" : item.position <= 10 ? "default" : "secondary"}>
                                    #{item.position}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-muted-foreground">
                                {new Date(item.lastSeen).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, processedData.length)} of {processedData.length}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          data-testid="button-prev-page"
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1 px-2">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className="w-8"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          data-testid="button-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Target className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold">No Opportunities Found</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {searchQuery 
                      ? "No opportunities match your search criteria" 
                      : "No competitor opportunities detected for this feature"
                    }
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntentIntelligencePage({ projectId }: Props) {
  const { toast } = useToast();

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<IntentDashboard>({
    queryKey: ["/api/projects", projectId, "intent-dashboard"],
    enabled: !!projectId,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery<{ alerts: IntentAlert[] }>({
    queryKey: ["/api/projects", projectId, "intent-alerts"],
    enabled: !!projectId,
  });

  const { data: competitorData, isLoading: competitorLoading } = useQuery<{ competitors: CompetitorVisibility[] }>({
    queryKey: ["/api/projects", projectId, "competitor-visibility"],
    enabled: !!projectId,
  });

  const { data: opportunities, isLoading: opportunitiesLoading } = useQuery<SerpOpportunities>({
    queryKey: ["/api/projects", projectId, "serp-opportunities"],
    enabled: !!projectId,
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: number) => {
      return await apiRequest("PATCH", `/api/intent-alerts/${alertId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "intent-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "intent-dashboard"] });
      toast({ title: "Alert resolved" });
    },
    onError: () => {
      toast({ title: "Failed to resolve alert", variant: "destructive" });
    },
  });

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Select a Project</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a project from the dropdown above to view SERP intent intelligence.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alerts = alertsData?.alerts || [];
  const unresolvedAlerts = alerts.filter((a) => !a.isResolved);
  const competitors = competitorData?.competitors || [];

  const layoutChartData = dashboard?.layoutDistribution
    ? Object.entries(dashboard.layoutDistribution).map(([name, value]) => ({
        name: formatBlockType(name),
        value,
        fill: BLOCK_COLORS[name] || "hsl(var(--muted-foreground))",
      }))
    : [];

  const competitorChartData = competitors
    .filter((c) => c.competitorDomain)
    .slice(0, 5)
    .map((c) => ({
      domain: (c.competitorDomain || "").replace(/^www\./, "").slice(0, 15),
      aiOverview: c.aiOverviewMentions,
      featuredSnippet: c.featuredSnippetMentions,
      localPack: c.localPackMentions,
      organic: c.organicMentions,
    }));

  return (
    <div className="space-y-6 p-6" data-testid="page-intent-intelligence">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intent Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            SERP layout analysis, competitor visibility tracking, and intent stability monitoring
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Brain className="h-3.5 w-3.5" />
          SEID Feature
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-stability-score">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stability Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {dashboard?.avgStabilityScore?.toFixed(0) || 0}
                  <span className="text-lg text-muted-foreground">/100</span>
                </div>
                <Progress
                  value={dashboard?.avgStabilityScore || 0}
                  className="mt-2 h-2"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Average SERP layout stability
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-ai-overview">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Overview Presence</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {dashboard?.keywordsWithAiOverview || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Keywords with AI Overview blocks
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-featured-snippet">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Featured Snippets</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {dashboard?.keywordsWithFeaturedSnippet || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Keywords with featured snippets
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-organic-position">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Organic Start</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  #{dashboard?.avgOrganicPosition?.toFixed(1) || "-"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Where organic results begin on SERP
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-serp-layout">
          <CardHeader>
            <CardTitle className="text-lg">SERP Layout Distribution</CardTitle>
            <CardDescription>
              Frequency of SERP features across tracked keywords
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : layoutChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={layoutChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {layoutChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No SERP layout data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-competitor-visibility">
          <CardHeader>
            <CardTitle className="text-lg">Competitor SERP Visibility</CardTitle>
            <CardDescription>
              Competitor presence across SERP features
            </CardDescription>
          </CardHeader>
          <CardContent>
            {competitorLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : competitorChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={competitorChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="domain" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="aiOverview" name="AI Overview" fill="hsl(var(--chart-1))" stackId="a" />
                  <Bar dataKey="featuredSnippet" name="Featured Snippet" fill="hsl(var(--chart-2))" stackId="a" />
                  <Bar dataKey="localPack" name="Local Pack" fill="hsl(var(--chart-4))" stackId="a" />
                  <Bar dataKey="organic" name="Organic" fill="hsl(120, 40%, 50%)" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No competitor visibility data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-intent-alerts">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Intent Alerts</CardTitle>
              <CardDescription>
                SERP layout changes and competitor movements requiring attention
              </CardDescription>
            </div>
            <Badge variant={unresolvedAlerts.length > 0 ? "destructive" : "secondary"}>
              {unresolvedAlerts.length} Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active">
            <TabsList className="mb-4">
              <TabsTrigger value="active" data-testid="tab-active-alerts">
                Active ({unresolvedAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="resolved" data-testid="tab-resolved-alerts">
                Resolved ({alerts.filter((a) => a.isResolved).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              <ScrollArea className="h-[400px]">
                {alertsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : unresolvedAlerts.length > 0 ? (
                  <div className="space-y-3">
                    {unresolvedAlerts.map((alert) => {
                      const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.low;
                      return (
                        <div
                          key={alert.id}
                          className={`rounded-lg border-l-4 p-4 ${styles.bg} ${styles.border}`}
                          data-testid={`alert-${alert.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className={`h-4 w-4 ${styles.text}`} />
                                <span className="font-medium">{alert.title}</span>
                                <Badge variant="outline" className="text-xs">
                                  {ALERT_TYPE_LABELS[alert.alertType] || alert.alertType}
                                </Badge>
                              </div>
                              {alert.description && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {alert.description}
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                {alert.previousValue && alert.currentValue && (
                                  <span>
                                    {alert.previousValue} → {alert.currentValue}
                                  </span>
                                )}
                                <span>
                                  {new Date(alert.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              {alert.suggestedAction && (
                                <p className="mt-2 text-sm font-medium text-primary">
                                  Suggested: {alert.suggestedAction}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => resolveAlertMutation.mutate(alert.id)}
                              disabled={resolveAlertMutation.isPending}
                              data-testid={`button-resolve-${alert.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center text-center">
                    <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
                    <h3 className="font-semibold">All Clear</h3>
                    <p className="text-sm text-muted-foreground">
                      No active intent alerts at this time
                    </p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="resolved">
              <ScrollArea className="h-[400px]">
                {alerts.filter((a) => a.isResolved).length > 0 ? (
                  <div className="space-y-3">
                    {alerts
                      .filter((a) => a.isResolved)
                      .map((alert) => (
                        <div
                          key={alert.id}
                          className="rounded-lg border bg-muted/30 p-4 opacity-75"
                          data-testid={`resolved-alert-${alert.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="font-medium">{alert.title}</span>
                            <Badge variant="outline" className="text-xs">
                              {ALERT_TYPE_LABELS[alert.alertType] || alert.alertType}
                            </Badge>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Resolved{" "}
                            {alert.resolvedAt
                              ? new Date(alert.resolvedAt).toLocaleDateString()
                              : ""}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center text-muted-foreground">
                    No resolved alerts
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <SerpOpportunitiesSection 
        opportunities={opportunities} 
        isLoading={opportunitiesLoading}
        totalKeywords={dashboard?.totalSnapshots || 0}
      />

      <Card data-testid="card-competitor-matrix">
        <CardHeader>
          <CardTitle className="text-lg">Competitor Visibility Matrix</CardTitle>
          <CardDescription>
            Detailed breakdown of competitor presence across SERP features
          </CardDescription>
        </CardHeader>
        <CardContent>
          {competitorLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : competitors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium">Competitor</th>
                    <th className="px-4 py-3 text-center font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <Bot className="h-3.5 w-3.5" />
                        AI Overview
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        Featured Snippet
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        Local Pack
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <ListChecks className="h-3.5 w-3.5" />
                        Organic
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.filter((c) => c.competitorDomain).map((competitor, idx) => (
                    <tr
                      key={competitor.competitorDomain || idx}
                      className={idx % 2 === 0 ? "bg-muted/30" : ""}
                    >
                      <td className="px-4 py-3 font-medium">
                        {competitor.competitorDomain || "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={competitor.aiOverviewMentions > 0 ? "default" : "secondary"}>
                          {competitor.aiOverviewMentions}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={competitor.featuredSnippetMentions > 0 ? "default" : "secondary"}>
                          {competitor.featuredSnippetMentions}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={competitor.localPackMentions > 0 ? "default" : "secondary"}>
                          {competitor.localPackMentions}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={competitor.organicMentions > 0 ? "default" : "secondary"}>
                          {competitor.organicMentions}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">
                        {competitor.totalMentions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              No competitor visibility data available. Run a SERP layout crawl to collect data.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default IntentIntelligencePage;
