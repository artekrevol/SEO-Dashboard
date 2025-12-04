import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Globe,
  FileText,
  Link2,
  Image,
  Zap,
  Code2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Clock,
  FileSearch,
} from "lucide-react";
import { PageAudit, PageIssue } from "@shared/schema";

interface PageAuditDrawerProps {
  projectId: string | null;
  url: string | null;
  techCrawlId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AuditResponse {
  audit: PageAudit;
  issues: PageIssue[];
}

export function PageAuditDrawer({
  projectId,
  url,
  techCrawlId,
  open,
  onOpenChange,
}: PageAuditDrawerProps) {
  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ["/api/page-audits/by-url", { projectId, url, techCrawlId }],
    queryFn: async () => {
      const params = new URLSearchParams({
        projectId: projectId!,
        url: url!,
      });
      if (techCrawlId) params.append("techCrawlId", String(techCrawlId));
      
      const res = await fetch(`/api/page-audits/by-url?${params}`);
      if (!res.ok) throw new Error("Failed to fetch page audit");
      return res.json();
    },
    enabled: !!projectId && !!url && open,
  });

  const audit = data?.audit;
  const issues = data?.issues || [];

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

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            Page Technical Audit
          </SheetTitle>
          {url && (
            <SheetDescription className="font-mono text-xs truncate flex items-center gap-2">
              {url}
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary">
                <ExternalLink className="h-3 w-3" />
              </a>
            </SheetDescription>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-32" />
              <Skeleton className="h-48" />
            </div>
          ) : audit ? (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${getScoreColor(Number(audit.onpageScore))}`}>
                    {Number(audit.onpageScore).toFixed(0)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getScoreLabel(Number(audit.onpageScore))}
                  </p>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Status Code</span>
                    <Badge variant={audit.statusCode === 200 ? "default" : "destructive"}>
                      {audit.statusCode}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Indexable</span>
                    {audit.isIndexable ? (
                      <Badge variant="default" className="bg-green-500">Yes</Badge>
                    ) : (
                      <Badge variant="destructive">No</Badge>
                    )}
                  </div>
                  {!audit.isIndexable && audit.indexabilityReason && (
                    <p className="text-xs text-muted-foreground">
                      Reason: {audit.indexabilityReason}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Meta Tags</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Title ({audit.titleLength || 0} chars)</p>
                      <p className="truncate font-medium">{audit.title || "Missing"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Description ({audit.descriptionLength || 0} chars)</p>
                      <p className="line-clamp-2 text-xs">{audit.description || "Missing"}</p>
                    </div>
                    {audit.canonicalUrl && (
                      <div>
                        <p className="text-muted-foreground">Canonical</p>
                        <p className="truncate text-xs font-mono">{audit.canonicalUrl}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Content</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Word Count</span>
                      <span className="font-medium">{audit.wordCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">H1 Tags</span>
                      <span className={`font-medium ${(audit.h1Count || 0) !== 1 ? "text-orange-500" : ""}`}>
                        {audit.h1Count || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">H2 Tags</span>
                      <span className="font-medium">{audit.h2Count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Content Rate</span>
                      <span className="font-medium">{Number(audit.contentRate || 0).toFixed(1)}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Links</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Internal Links</span>
                      <span className="font-medium">{audit.internalLinksCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">External Links</span>
                      <span className="font-medium">{audit.externalLinksCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Broken Links</span>
                      <span className={`font-medium ${(audit.brokenLinksCount || 0) > 0 ? "text-red-500" : ""}`}>
                        {audit.brokenLinksCount || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                    <Image className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Images</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Images</span>
                      <span className="font-medium">{audit.imagesCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Without Alt</span>
                      <span className={`font-medium ${(audit.imagesWithoutAlt || 0) > 0 ? "text-orange-500" : ""}`}>
                        {audit.imagesWithoutAlt || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Page Size</span>
                      <span className="font-medium">{Number(audit.pageSizeKb || 0).toFixed(0)} KB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Load Time</span>
                      <span className="font-medium">{audit.loadTimeMs || 0} ms</span>
                    </div>
                    {audit.lcpMs && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">LCP</span>
                        <span className={`font-medium ${audit.lcpMs > 2500 ? "text-red-500" : audit.lcpMs > 1800 ? "text-yellow-500" : "text-green-500"}`}>
                          {audit.lcpMs} ms
                        </span>
                      </div>
                    )}
                    {audit.clsScore && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CLS</span>
                        <span className={`font-medium ${Number(audit.clsScore) > 0.25 ? "text-red-500" : Number(audit.clsScore) > 0.1 ? "text-yellow-500" : "text-green-500"}`}>
                          {Number(audit.clsScore).toFixed(3)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                    <Code2 className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Structured Data</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Has Schema</span>
                      {audit.hasSchema ? (
                        <Badge variant="default" className="bg-green-500">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </div>
                    {audit.schemaTypes && audit.schemaTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {audit.schemaTypes.map((type: string) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Issues Found ({issues.length})
                </h3>
                
                {issues.length > 0 ? (
                  <div className="space-y-2">
                    {issues
                      .sort((a, b) => {
                        const order: Record<string, number> = { critical: 0, error: 1, warning: 2, info: 3 };
                        return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
                      })
                      .map((issue) => (
                        <div
                          key={issue.id}
                          className="flex items-start gap-3 rounded-md border p-3"
                          data-testid={`drawer-issue-${issue.id}`}
                        >
                          {getSeverityIcon(issue.severity)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{issue.issueLabel}</span>
                              {getSeverityBadge(issue.severity)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 capitalize">
                              Category: {issue.category}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                    <p className="mt-2 font-medium">No Issues Detected</p>
                    <p className="text-sm text-muted-foreground">This page passed all technical checks.</p>
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                <p>Click Depth: {audit.clickDepth ?? "N/A"}</p>
                {audit.isOrphanPage && <p className="text-orange-500">This is an orphan page (no internal links pointing to it)</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Globe className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Audit Data</h3>
              <p className="text-muted-foreground text-center">
                No technical audit data found for this URL.
              </p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
