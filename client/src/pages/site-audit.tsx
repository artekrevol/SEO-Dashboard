import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  RefreshCw,
  Search,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FileWarning,
  Globe,
  Clock,
  Zap,
  Link2,
  Image,
  Code2,
  FileText,
  ChevronRight,
  ExternalLink,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { PageAudit } from "@shared/schema";
import { PageAuditDrawer } from "@/components/page-audit-drawer";

interface SiteAuditPageProps {
  projectId: string | null;
}

interface TechCrawlResponse {
  id: number;
  projectId: string;
  onpageTaskId: string | null;
  targetDomain: string;
  maxPages: number | null;
  status: string;
  pagesCrawled: number | null;
  pagesWithIssues: number | null;
  criticalIssuesCount: number | null;
  warningsCount: number | null;
  avgOnpageScore: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

interface IssuesSummary {
  issueCode: string;
  issueLabel: string;
  severity: string;
  category: string;
  count: number;
}

export function SiteAuditPage({ projectId }: SiteAuditPageProps) {
  const { toast } = useToast();
  const [selectedAuditUrl, setSelectedAuditUrl] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: latestCrawl, isLoading: crawlLoading } = useQuery<TechCrawlResponse | null>({
    queryKey: ["/api/tech-crawls/latest", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/tech-crawls/latest?projectId=${projectId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch latest crawl");
      return res.json();
    },
    enabled: !!projectId,
    refetchInterval: (query) => {
      const data = query.state.data as TechCrawlResponse | null | undefined;
      if (data && (data.status === "queued" || data.status === "in_progress" || data.status === "running")) {
        return 5000;
      }
      return false;
    },
  });

  const { data: pageAudits, isLoading: auditsLoading } = useQuery<{ audits: PageAudit[] }>({
    queryKey: ["/api/page-audits", { projectId, techCrawlId: latestCrawl?.id }],
    queryFn: async () => {
      const res = await fetch(`/api/page-audits?projectId=${projectId}&techCrawlId=${latestCrawl?.id}&limit=500`);
      if (!res.ok) throw new Error("Failed to fetch page audits");
      return res.json();
    },
    enabled: !!projectId && !!latestCrawl?.id && latestCrawl?.status === "completed",
  });

  const { data: issuesSummary, isLoading: issuesLoading } = useQuery<{ issues: IssuesSummary[] }>({
    queryKey: ["/api/page-issues/summary", { projectId, techCrawlId: latestCrawl?.id }],
    queryFn: async () => {
      const res = await fetch(`/api/page-issues/summary?projectId=${projectId}&techCrawlId=${latestCrawl?.id}`);
      if (!res.ok) throw new Error("Failed to fetch issues summary");
      return res.json();
    },
    enabled: !!projectId && !!latestCrawl?.id && latestCrawl?.status === "completed",
  });

  const startCrawlMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tech-crawls", {
        projectId,
        maxPages: 500,
        enableJavascript: false,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Tech Audit Started",
        description: "The site audit is now running. This may take a few minutes.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tech-crawls/latest"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Start Audit",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncCrawlMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/tech-crawls/${latestCrawl?.id}/sync`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.crawl?.status === "completed") {
        toast({
          title: "Audit Complete",
          description: `Crawled ${data.crawl.pagesCrawled} pages with an average score of ${Number(data.crawl.avgOnpageScore).toFixed(0)}.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tech-crawls/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/page-audits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/page-issues/summary"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelCrawlMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/tech-crawls/${latestCrawl?.id}/cancel`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Audit Cancelled",
        description: "The site audit has been cancelled. You can start a new one.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tech-crawls/latest"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Cancel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePageClick = (url: string) => {
    setSelectedAuditUrl(url);
    setDrawerOpen(true);
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Globe className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Project Selected</h2>
          <p className="mt-2 text-muted-foreground">
            Select or create a project to run a technical site audit.
          </p>
        </div>
      </div>
    );
  }

  if (crawlLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  const isRunning = latestCrawl?.status === "queued" || latestCrawl?.status === "in_progress" || latestCrawl?.status === "running";
  const isCompleted = latestCrawl?.status === "completed";
  const audits = pageAudits?.audits || [];
  const issues = issuesSummary?.issues || [];

  const avgScore = latestCrawl?.avgOnpageScore ? Number(latestCrawl.avgOnpageScore) : 0;
  const criticalCount = issues.filter(i => i.severity === "critical").reduce((s, i) => s + i.count, 0);
  const errorCount = issues.filter(i => i.severity === "error").reduce((s, i) => s + i.count, 0);
  const warningCount = issues.filter(i => i.severity === "warning").reduce((s, i) => s + i.count, 0);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Good";
    if (score >= 60) return "Needs Improvement";
    return "Poor";
  };

  const categoryGroups = issues.reduce((acc, issue) => {
    if (!acc[issue.category]) {
      acc[issue.category] = [];
    }
    acc[issue.category].push(issue);
    return acc;
  }, {} as Record<string, IssuesSummary[]>);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "meta": return FileText;
      case "content": return FileWarning;
      case "links": return Link2;
      case "performance": return Zap;
      case "images": return Image;
      case "schema": return Code2;
      default: return AlertCircle;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive" className="text-xs">Critical</Badge>;
      case "error":
        return <Badge variant="destructive" className="bg-orange-500 text-xs">Error</Badge>;
      case "warning":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600 text-xs">Warning</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Info</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-site-audit-title">
            Technical Site Audit
          </h1>
          <p className="text-muted-foreground">
            Comprehensive technical SEO analysis powered by DataForSEO OnPage API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <Button
              onClick={() => syncCrawlMutation.mutate()}
              disabled={syncCrawlMutation.isPending}
              variant="outline"
              data-testid="button-sync-crawl"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncCrawlMutation.isPending ? "animate-spin" : ""}`} />
              Check Status
            </Button>
          )}
          <Button
            onClick={() => startCrawlMutation.mutate()}
            disabled={startCrawlMutation.isPending || isRunning}
            data-testid="button-start-audit"
          >
            <Search className="mr-2 h-4 w-4" />
            {isRunning ? "Audit Running..." : "Start New Audit"}
          </Button>
        </div>
      </div>

      {isRunning && latestCrawl && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardContent className="flex items-center gap-4 p-4">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            <div className="flex-1">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Audit in Progress
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {latestCrawl.pagesCrawled || 0} of {latestCrawl.maxPages || 500} pages crawled.
                Started {formatDistanceToNow(new Date(latestCrawl.createdAt), { addSuffix: true })}.
              </p>
            </div>
            <Progress value={((latestCrawl.pagesCrawled || 0) / (latestCrawl.maxPages || 500)) * 100} className="w-32" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => cancelCrawlMutation.mutate()}
              disabled={cancelCrawlMutation.isPending}
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              data-testid="button-cancel-audit"
            >
              <XCircle className="mr-2 h-4 w-4" />
              {cancelCrawlMutation.isPending ? "Cancelling..." : "Cancel"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isCompleted && latestCrawl && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card data-testid="card-onpage-score">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">OnPage Score</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${getScoreColor(avgScore)}`}>
                  {avgScore.toFixed(0)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {getScoreLabel(avgScore)} - {latestCrawl.pagesCrawled} pages analyzed
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-critical-issues">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-red-500">{criticalCount}</div>
                <p className="text-sm text-muted-foreground">
                  Immediate attention required
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-errors">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Errors</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-orange-500">{errorCount}</div>
                <p className="text-sm text-muted-foreground">
                  Should be fixed soon
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-warnings">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Warnings</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-yellow-500">{warningCount}</div>
                <p className="text-sm text-muted-foreground">
                  Recommended improvements
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-xs text-muted-foreground">
            Last audit completed {latestCrawl.completedAt 
              ? formatDistanceToNow(new Date(latestCrawl.completedAt), { addSuffix: true })
              : "recently"
            }
          </div>

          <Tabs defaultValue="issues" className="w-full">
            <TabsList>
              <TabsTrigger value="issues" data-testid="tab-issues">Issues by Category</TabsTrigger>
              <TabsTrigger value="pages" data-testid="tab-pages">All Pages</TabsTrigger>
              <TabsTrigger value="low-score" data-testid="tab-low-score">Low Score Pages</TabsTrigger>
            </TabsList>

            <TabsContent value="issues" className="data-[state=active]:flex data-[state=active]:flex-col gap-4 mt-4">
              {Object.entries(categoryGroups).map(([category, categoryIssues]) => {
                const CategoryIcon = getCategoryIcon(category);
                const totalCount = categoryIssues.reduce((s, i) => s + i.count, 0);
                
                return (
                  <Card key={category} data-testid={`card-category-${category}`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <div className="flex items-center gap-2">
                        <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base capitalize">{category}</CardTitle>
                      </div>
                      <Badge variant="secondary">{totalCount} issues</Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {categoryIssues.map((issue) => (
                          <div
                            key={issue.issueCode}
                            className="flex items-center justify-between rounded-md border p-3 hover-elevate"
                            data-testid={`issue-${issue.issueCode}`}
                          >
                            <div className="flex items-center gap-3">
                              {getSeverityBadge(issue.severity)}
                              <span className="text-sm">{issue.issueLabel}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{issue.count} pages affected</span>
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {Object.keys(categoryGroups).length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                    <h3 className="mt-4 text-lg font-semibold">No Issues Found</h3>
                    <p className="text-muted-foreground">Your site passed all technical checks.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="pages" className="data-[state=active]:flex data-[state=active]:flex-col mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>All Audited Pages</CardTitle>
                  <CardDescription>
                    Click on a page to view detailed technical audit information.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {audits.map((audit) => (
                      <div
                        key={audit.id}
                        className="flex items-center justify-between rounded-md border p-3 cursor-pointer hover-elevate"
                        onClick={() => handlePageClick(audit.url)}
                        data-testid={`audit-row-${audit.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`text-lg font-bold ${getScoreColor(Number(audit.onpageScore))}`}>
                            {Number(audit.onpageScore).toFixed(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-sm">{audit.url}</p>
                            <p className="text-xs text-muted-foreground">
                              {audit.statusCode} • {audit.wordCount || 0} words • {audit.internalLinksCount || 0} links
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!audit.isIndexable && (
                            <Badge variant="destructive" className="text-xs">Not Indexable</Badge>
                          )}
                          {audit.brokenLinksCount && audit.brokenLinksCount > 0 && (
                            <Badge variant="outline" className="border-orange-500 text-orange-600 text-xs">
                              {audit.brokenLinksCount} broken links
                            </Badge>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="low-score" className="data-[state=active]:flex data-[state=active]:flex-col mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Low Score Pages</CardTitle>
                  <CardDescription>
                    Pages with OnPage score below 60 that need attention.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {audits
                      .filter(a => Number(a.onpageScore) < 60)
                      .sort((a, b) => Number(a.onpageScore) - Number(b.onpageScore))
                      .map((audit) => (
                        <div
                          key={audit.id}
                          className="flex items-center justify-between rounded-md border p-3 cursor-pointer hover-elevate"
                          onClick={() => handlePageClick(audit.url)}
                          data-testid={`low-score-row-${audit.id}`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`text-lg font-bold ${getScoreColor(Number(audit.onpageScore))}`}>
                              {Number(audit.onpageScore).toFixed(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-mono text-sm">{audit.url}</p>
                              <p className="text-xs text-muted-foreground">
                                {audit.indexabilityReason || "No specific reason"}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    {audits.filter(a => Number(a.onpageScore) < 60).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <h3 className="mt-4 text-lg font-semibold">All Pages Healthy</h3>
                        <p className="text-muted-foreground">No pages with scores below 60.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {!latestCrawl && !crawlLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="h-16 w-16 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">No Audits Yet</h2>
            <p className="mt-2 text-center text-muted-foreground max-w-md">
              Run your first technical site audit to analyze your pages for SEO issues, 
              performance problems, and indexability concerns.
            </p>
            <Button
              onClick={() => startCrawlMutation.mutate()}
              disabled={startCrawlMutation.isPending}
              className="mt-6"
              data-testid="button-start-first-audit"
            >
              <Search className="mr-2 h-4 w-4" />
              Start First Audit
            </Button>
          </CardContent>
        </Card>
      )}

      <PageAuditDrawer
        projectId={projectId}
        url={selectedAuditUrl}
        techCrawlId={latestCrawl?.id}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
