import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import {
  Link2,
  ExternalLink,
  Calendar,
  TrendingUp,
  TrendingDown,
  Globe,
  Anchor,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Backlink {
  id: number;
  projectId: string;
  targetUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  anchorText: string | null;
  linkType: string;
  isLive: boolean;
  domainAuthority: number | null;
  pageAuthority: number | null;
  spamScore: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lostAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function getSpamScoreBadge(score: number | null) {
  if (score === null) return { label: "Unknown", variant: "secondary" as const, className: "", icon: null };
  if (score <= 30) return { label: "Safe", variant: "secondary" as const, className: "bg-green-500/10 text-green-600", icon: CheckCircle };
  if (score <= 60) return { label: "Review", variant: "secondary" as const, className: "bg-yellow-500/10 text-yellow-600", icon: AlertTriangle };
  return { label: "Toxic", variant: "destructive" as const, className: "bg-red-500/10 text-red-600", icon: Shield };
}

interface BacklinkAggregations {
  totalBacklinks: number;
  liveBacklinks: number;
  lostBacklinks: number;
  newBacklinks: number;
  referringDomains: number;
  topAnchors: { anchor: string; count: number }[];
  linkTypeBreakdown: { type: string; count: number }[];
  spamDistribution: { safe: number; review: number; toxic: number; unknown: number };
}

interface DomainGroup {
  domain: string;
  backlinks: number;
  liveLinks: number;
  firstSeen: string;
  lastSeen: string;
  avgDomainAuthority: number | null;
}

interface BacklinkDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  targetUrl?: string;
  pageTitle?: string;
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function formatTimeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function BacklinkDetailDrawer({
  open,
  onOpenChange,
  projectId,
  targetUrl,
  pageTitle,
}: BacklinkDetailDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [linkTypeFilter, setLinkTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "lost">("all");

  const { data: backlinks = [], isLoading: isLoadingBacklinks } = useQuery<Backlink[]>({
    queryKey: ["/api/backlinks", projectId, targetUrl],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId });
      if (targetUrl) params.append("targetUrl", targetUrl);
      const res = await fetch(`/api/backlinks?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch backlinks");
      const data = await res.json();
      return data.backlinks;
    },
    enabled: open && !!projectId,
  });

  const { data: aggregations, isLoading: isLoadingAggregations } = useQuery<BacklinkAggregations>({
    queryKey: ["/api/backlinks/aggregations", projectId, targetUrl],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId });
      if (targetUrl) params.append("targetUrl", targetUrl);
      const res = await fetch(`/api/backlinks/aggregations?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch aggregations");
      return res.json();
    },
    enabled: open && !!projectId,
  });

  const { data: domainGroups = [], isLoading: isLoadingDomains } = useQuery<DomainGroup[]>({
    queryKey: ["/api/backlinks/by-domain", projectId, targetUrl],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId });
      if (targetUrl) params.append("targetUrl", targetUrl);
      const res = await fetch(`/api/backlinks/by-domain?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch domains");
      const data = await res.json();
      return data.domains;
    },
    enabled: open && !!projectId,
  });

  const filteredBacklinks = useMemo(() => {
    return backlinks.filter((backlink) => {
      const matchesSearch =
        !searchQuery ||
        backlink.sourceDomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        backlink.sourceUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (backlink.anchorText && backlink.anchorText.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = !linkTypeFilter || backlink.linkType === linkTypeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "live" && backlink.isLive) ||
        (statusFilter === "lost" && !backlink.isLive);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [backlinks, searchQuery, linkTypeFilter, statusFilter]);

  const isLoading = isLoadingBacklinks || isLoadingAggregations || isLoadingDomains;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2" data-testid="drawer-title">
            <Link2 className="h-5 w-5" />
            Backlink Profile
          </SheetTitle>
          <SheetDescription className="truncate" data-testid="drawer-description">
            {targetUrl ? (
              <span className="font-mono text-xs">{targetUrl}</span>
            ) : (
              pageTitle || "All backlinks for this project"
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : (
            <Tabs defaultValue="overview" className="flex flex-col h-full">
              <TabsList className="mx-4 mt-4 shrink-0" data-testid="tabs-list">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="all" data-testid="tab-all">All Links ({backlinks.length})</TabsTrigger>
                <TabsTrigger value="domains" data-testid="tab-domains">By Domain ({domainGroups.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="flex-1 overflow-auto mt-4 px-4">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Link2 className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wider">Total Links</span>
                        </div>
                        <div className="text-2xl font-bold" data-testid="stat-total">
                          {aggregations?.totalBacklinks || 0}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-xs uppercase tracking-wider">Live</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600" data-testid="stat-live">
                          {aggregations?.liveBacklinks || 0}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-xs uppercase tracking-wider">Lost</span>
                        </div>
                        <div className="text-2xl font-bold text-red-600" data-testid="stat-lost">
                          {aggregations?.lostBacklinks || 0}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <TrendingUp className="h-4 w-4 text-blue-500" />
                          <span className="text-xs uppercase tracking-wider">New (30d)</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600" data-testid="stat-new">
                          {aggregations?.newBacklinks || 0}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Referring Domains
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold" data-testid="stat-domains">
                        {aggregations?.referringDomains || 0}
                      </div>
                    </CardContent>
                  </Card>

                  {aggregations?.topAnchors && aggregations.topAnchors.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Anchor className="h-4 w-4" />
                          Top Anchor Texts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2" data-testid="anchor-list">
                          {aggregations.topAnchors.slice(0, 5).map((anchor, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                              data-testid={`anchor-item-${i}`}
                            >
                              <span className="truncate max-w-[200px]" title={anchor.anchor}>
                                {anchor.anchor || "(empty)"}
                              </span>
                              <Badge variant="secondary">{anchor.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {aggregations?.linkTypeBreakdown && aggregations.linkTypeBreakdown.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Link Types
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2" data-testid="type-breakdown">
                          {aggregations.linkTypeBreakdown.map((item, i) => (
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

                  {aggregations?.spamDistribution && (aggregations.spamDistribution.safe + aggregations.spamDistribution.review + aggregations.spamDistribution.toxic + aggregations.spamDistribution.unknown) > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Spam Score Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const spam = aggregations.spamDistribution;
                          const total = spam.safe + spam.review + spam.toxic + spam.unknown;
                          return (
                            <>
                              <div className="space-y-2" data-testid="spam-distribution">
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <span>Safe (≤30%)</span>
                                  </div>
                                  <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                                    {spam.safe}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                    <span>Review (31-60%)</span>
                                  </div>
                                  <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                                    {spam.review}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-red-600" />
                                    <span>Toxic (&gt;60%)</span>
                                  </div>
                                  <Badge variant="secondary" className="bg-red-500/10 text-red-600">
                                    {spam.toxic}
                                  </Badge>
                                </div>
                                {spam.unknown > 0 && (
                                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>Unknown</span>
                                    <Badge variant="secondary">{spam.unknown}</Badge>
                                  </div>
                                )}
                              </div>
                              {total > 0 && (
                                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden flex">
                                  {spam.safe > 0 && (
                                    <div
                                      className="bg-green-500 h-full"
                                      style={{ width: `${(spam.safe / total) * 100}%` }}
                                    />
                                  )}
                                  {spam.review > 0 && (
                                    <div
                                      className="bg-yellow-500 h-full"
                                      style={{ width: `${(spam.review / total) * 100}%` }}
                                    />
                                  )}
                                  {spam.toxic > 0 && (
                                    <div
                                      className="bg-red-500 h-full"
                                      style={{ width: `${(spam.toxic / total) * 100}%` }}
                                    />
                                  )}
                                  {spam.unknown > 0 && (
                                    <div
                                      className="bg-muted-foreground/30 h-full"
                                      style={{ width: `${(spam.unknown / total) * 100}%` }}
                                    />
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="all" className="flex-1 overflow-hidden flex flex-col mt-4 px-4 pb-4">
                <div className="flex flex-wrap gap-2 mb-4 shrink-0">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search domains, URLs, anchors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-backlinks"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant={statusFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter("all")}
                      data-testid="filter-all"
                    >
                      All
                    </Button>
                    <Button
                      variant={statusFilter === "live" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter("live")}
                      data-testid="filter-live"
                    >
                      Live
                    </Button>
                    <Button
                      variant={statusFilter === "lost" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter("lost")}
                      data-testid="filter-lost"
                    >
                      Lost
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-3">
                    {filteredBacklinks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground" data-testid="no-backlinks">
                        {backlinks.length === 0
                          ? "No backlinks found for this page."
                          : "No backlinks match your filters."}
                      </div>
                    ) : (
                      filteredBacklinks.map((backlink) => (
                        <Card
                          key={backlink.id}
                          className={cn(
                            "transition-colors",
                            !backlink.isLive && "opacity-60"
                          )}
                          data-testid={`backlink-card-${backlink.id}`}
                        >
                          <CardContent className="py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  <span className="font-medium truncate" data-testid={`domain-${backlink.id}`}>
                                    {backlink.sourceDomain}
                                  </span>
                                  {backlink.domainAuthority && (
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      DA: {backlink.domainAuthority}
                                    </Badge>
                                  )}
                                  {backlink.spamScore !== null && (
                                    <Badge
                                      variant={getSpamScoreBadge(backlink.spamScore).variant}
                                      className={cn("text-xs shrink-0", getSpamScoreBadge(backlink.spamScore).className)}
                                      data-testid={`spam-score-${backlink.id}`}
                                    >
                                      {(() => {
                                        const spamBadge = getSpamScoreBadge(backlink.spamScore);
                                        const IconComponent = spamBadge.icon;
                                        return IconComponent ? <IconComponent className="h-3 w-3 mr-1" /> : null;
                                      })()}
                                      Spam: {backlink.spamScore}%
                                    </Badge>
                                  )}
                                </div>
                                <a
                                  href={backlink.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-muted-foreground hover:text-primary truncate block mt-1 max-w-full"
                                  data-testid={`source-url-${backlink.id}`}
                                >
                                  {backlink.sourceUrl}
                                  <ExternalLink className="inline h-3 w-3 ml-1" />
                                </a>
                                {backlink.anchorText && (
                                  <div className="flex items-center gap-1 mt-2 text-sm">
                                    <Anchor className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="truncate text-muted-foreground" title={backlink.anchorText}>
                                      "{backlink.anchorText}"
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="flex items-center gap-1">
                                  {backlink.isLive ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-green-500/10 text-green-600"
                                      data-testid={`status-live-${backlink.id}`}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Live
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className="bg-red-500/10 text-red-600"
                                      data-testid={`status-lost-${backlink.id}`}
                                    >
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Lost
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={backlink.linkType === "dofollow" ? "default" : "secondary"}
                                    className={cn(
                                      "text-xs",
                                      backlink.linkType === "dofollow"
                                        ? "bg-blue-500/10 text-blue-600"
                                        : ""
                                    )}
                                    data-testid={`link-type-${backlink.id}`}
                                  >
                                    {backlink.linkType}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  <span title={formatDate(backlink.firstSeenAt)}>
                                    {formatTimeAgo(backlink.firstSeenAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="domains" className="flex-1 overflow-hidden flex flex-col mt-4 px-4 pb-4">
                <ScrollArea className="flex-1">
                  <div className="space-y-3">
                    {domainGroups.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground" data-testid="no-domains">
                        No referring domains found.
                      </div>
                    ) : (
                      domainGroups.map((group) => (
                        <Card
                          key={group.domain}
                          className="transition-colors"
                          data-testid={`domain-group-${group.domain}`}
                        >
                          <CardContent className="py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  <span className="font-medium truncate">{group.domain}</span>
                                  {group.avgDomainAuthority && (
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      DA: {group.avgDomainAuthority}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  <span>
                                    First seen: {formatDate(group.firstSeen)}
                                  </span>
                                  <span>
                                    Last seen: {formatDate(group.lastSeen)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">
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
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
