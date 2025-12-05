import { useQuery, useMutation } from "@tanstack/react-query";
import { KpiCard } from "@/components/kpi-card";
import { SeoHealthChart } from "@/components/seo-health-chart";
import { KeywordsTable } from "@/components/keywords-table";
import { RecommendationsList } from "@/components/recommendations-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Activity, TrendingUp, Search, AlertTriangle, CheckCircle2, RefreshCw, Clock, Info } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface DashboardProps {
  projectId: string | null;
}

export function Dashboard({ projectId }: DashboardProps) {
  const { toast } = useToast();

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["/api/dashboard/overview", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/overview?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch overview");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: keywords, isLoading: keywordsLoading } = useQuery({
    queryKey: ["/api/dashboard/keywords", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/keywords?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch keywords");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: recommendations, isLoading: recommendationsLoading } = useQuery({
    queryKey: ["/api/dashboard/recommendations", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/recommendations?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
    enabled: !!projectId,
  });

  const refreshDataMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/jobs/snapshot?projectId=${projectId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to refresh data");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/overview", { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/keywords", { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recommendations", { projectId }] });
      toast({
        title: "Data refreshed",
        description: "Dashboard data has been updated with the latest rankings.",
      });
    },
    onError: () => {
      toast({
        title: "Refresh failed",
        description: "Failed to refresh data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await apiRequest("PATCH", `/api/dashboard/recommendations/${id}`, { status });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recommendations", { projectId }] });
      toast({
        title: "Status updated",
        description: "Recommendation status has been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update recommendation status.",
        variant: "destructive",
      });
    }
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Activity className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Project Selected</h2>
          <p className="mt-2 text-muted-foreground">
            Select or create a project to view SEO analytics.
          </p>
        </div>
      </div>
    );
  }

  if (overviewLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const latestSnapshot = overview?.latestSnapshot;
  const trend = overview?.trend || [];

  const healthTrend = trend.map((t: any) => ({ value: t.seoHealthScore }));
  const positionTrend = trend.map((t: any) => ({ value: 100 - (t.avgPosition || 50) }));
  const keywordsTrend = trend.map((t: any) => ({ value: t.top10Keywords || 0 }));

  const getHealthStatus = (score: number): "healthy" | "at_risk" | "declining" => {
    if (score >= 70) return "healthy";
    if (score >= 40) return "at_risk";
    return "declining";
  };

  const lastUpdated = latestSnapshot?.date ? new Date(latestSnapshot.date) : null;
  
  // Determine if data needs syncing
  const keywordItems = keywords?.items || [];
  const totalImportedKeywords = keywordItems.length;
  const keywordsWithRankings = keywordItems.filter((k: any) => k.currentPosition > 0).length;
  const needsRankingSync = totalImportedKeywords > 0 && keywordsWithRankings < totalImportedKeywords * 0.1;
  const noKeywordsImported = totalImportedKeywords === 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
            SEO Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your website's SEO performance and health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="text-last-updated">
              <Clock className="h-4 w-4" />
              <span>Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => refreshDataMutation.mutate()}
            disabled={refreshDataMutation.isPending}
            data-testid="button-refresh-data"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshDataMutation.isPending ? 'animate-spin' : ''}`} />
            {refreshDataMutation.isPending ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {needsRankingSync && !keywordsLoading && (
        <Alert data-testid="alert-sync-pending">
          <Info className="h-4 w-4" />
          <AlertTitle>Rankings Data Pending</AlertTitle>
          <AlertDescription>
            {keywordsWithRankings > 0 
              ? `Only ${keywordsWithRankings} of ${totalImportedKeywords} keywords have ranking data. Run a keyword rankings crawl to fetch current positions.`
              : `${totalImportedKeywords} keywords are imported but no rankings have been synced yet. Run a keyword rankings crawl to fetch current positions.`
            }
          </AlertDescription>
        </Alert>
      )}

      {noKeywordsImported && !keywordsLoading && (
        <Alert data-testid="alert-no-keywords">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Keywords Found</AlertTitle>
          <AlertDescription>
            Import keywords via Data Management to start tracking your SEO performance.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="SEO Health Score"
          value={latestSnapshot?.seoHealthScore?.toFixed(0) || "—"}
          suffix="/100"
          change={5.2}
          changeLabel="vs last week"
          trend={healthTrend}
          status={latestSnapshot ? getHealthStatus(latestSnapshot.seoHealthScore) : "neutral"}
          testId="kpi-health-score"
        />
        <KpiCard
          title="Avg. Position"
          value={latestSnapshot?.avgPosition?.toFixed(1) || "—"}
          change={-2.3}
          changeLabel="vs last week"
          trend={positionTrend}
          status={latestSnapshot?.avgPosition <= 10 ? "healthy" : latestSnapshot?.avgPosition <= 30 ? "at_risk" : "declining"}
          testId="kpi-avg-position"
        />
        <KpiCard
          title="Keywords in Top 10"
          value={latestSnapshot?.top10Keywords || 0}
          suffix={`/ ${totalImportedKeywords > 0 ? totalImportedKeywords : (latestSnapshot?.totalKeywords || 0)}`}
          change={needsRankingSync ? undefined : 8.5}
          changeLabel={needsRankingSync ? "sync pending" : "vs last week"}
          trend={keywordsTrend}
          status={needsRankingSync ? "at_risk" : "healthy"}
          testId="kpi-top10-keywords"
        />
        <KpiCard
          title="Top 3 Keywords"
          value={latestSnapshot?.top3Keywords || 0}
          change={12.0}
          changeLabel="vs last week"
          status="healthy"
          testId="kpi-top3-keywords"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SeoHealthChart
            data={trend}
            showBreakdown={true}
          />
        </div>
        <Card data-testid="score-breakdown">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-chart-1" />
                  <span className="text-sm font-medium">Rankings</span>
                </div>
                <span className="text-lg font-bold">
                  {((latestSnapshot?.top10Keywords || 0) / (latestSnapshot?.totalKeywords || 1) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-chart-1 transition-all"
                  style={{
                    width: `${(latestSnapshot?.top10Keywords || 0) / (latestSnapshot?.totalKeywords || 1) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-chart-2" />
                  <span className="text-sm font-medium">Authority</span>
                </div>
                <span className="text-lg font-bold">
                  {latestSnapshot?.authorityScore?.toFixed(0) || "—"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-chart-2 transition-all"
                  style={{ width: `${latestSnapshot?.authorityScore || 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-chart-3" />
                  <span className="text-sm font-medium">Technical</span>
                </div>
                <span className="text-lg font-bold">
                  {latestSnapshot?.techScore?.toFixed(0) || "—"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-chart-3 transition-all"
                  style={{ width: `${latestSnapshot?.techScore || 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-chart-4" />
                  <span className="text-sm font-medium">Content</span>
                </div>
                <span className="text-lg font-bold">
                  {latestSnapshot?.contentScore?.toFixed(0) || "—"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-chart-4 transition-all"
                  style={{ width: `${latestSnapshot?.contentScore || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="top-opportunities">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg font-medium">Top Opportunities</CardTitle>
            <Badge variant="secondary" className="font-mono">
              {keywords?.items?.filter((k: any) => k.opportunityScore >= 50).length || 0}
            </Badge>
          </CardHeader>
          <CardContent>
            {keywordsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {keywords?.items
                  ?.filter((k: any) => k.opportunityScore >= 50)
                  .slice(0, 5)
                  .map((keyword: any) => (
                    <div
                      key={keyword.keywordId}
                      className="flex items-center justify-between rounded-lg border p-3 hover-elevate"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{keyword.keyword}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Position: {keyword.currentPosition}</span>
                          <span>Vol: {keyword.searchVolume.toLocaleString()}</span>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0"
                      >
                        <TrendingUp className="mr-1 h-3 w-3" />
                        {keyword.opportunityScore.toFixed(0)}
                      </Badge>
                    </div>
                  ))}
                {(!keywords?.items || keywords.items.filter((k: any) => k.opportunityScore >= 50).length === 0) && (
                  <div className="py-8 text-center text-muted-foreground">
                    <TrendingUp className="mx-auto mb-2 h-8 w-8" />
                    <p>No high-opportunity keywords found</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="recent-recommendations">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg font-medium">Recent Actions</CardTitle>
            <Badge variant="secondary" className="font-mono">
              {recommendations?.items?.filter((r: any) => r.status === "open").length || 0} open
            </Badge>
          </CardHeader>
          <CardContent>
            {recommendationsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations?.items?.slice(0, 5).map((rec: any) => (
                  <div
                    key={rec.id}
                    className="flex items-start justify-between rounded-lg border p-3 hover-elevate"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{rec.title}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {rec.description}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        rec.severity === "high"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border-0"
                          : rec.severity === "medium"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0"
                      }
                    >
                      {rec.severity}
                    </Badge>
                  </div>
                ))}
                {(!recommendations?.items || recommendations.items.length === 0) && (
                  <div className="py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8" />
                    <p>No recommendations available</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
