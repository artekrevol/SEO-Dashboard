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
} from "lucide-react";

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
