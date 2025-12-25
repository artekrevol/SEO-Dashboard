import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Search, ExternalLink, TrendingUp, Target, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Minus, Link2, Loader2, Bot, Sparkles, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/export-button";
import type { ExportColumn } from "@/lib/export-utils";
import { CompetitorBacklinksDrawer } from "@/components/competitor-backlinks-drawer";

type CompetitorSortField = "competitorDomain" | "sharedKeywords" | "aboveUsKeywords" | "pressureIndex" | "avgTheirPosition" | "serpVisibilityTotal";
type SortDirection = "asc" | "desc";

interface CompetitorData {
  competitorDomain: string;
  sharedKeywords: number;
  aboveUsKeywords: number;
  avgTheirPosition?: number;
  avgOurPosition?: number;
  avgGap?: number;
  totalVolume?: number;
  pressureIndex: number;
  trafficThreat?: string;
  // SERP visibility data
  aiOverviewCount?: number;
  featuredSnippetCount?: number;
  localPackCount?: number;
  organicTop10Count?: number;
  serpVisibilityTotal?: number;
}

interface KeywordDetail {
  keywordId: number;
  keyword: string;
  searchVolume: number;
  competitorPosition: number;
  ourPosition: number | null;
  gap: number;
  serpFeatures: string[];
  competitorUrl: string;
  targetUrl: string;
  cluster: string;
}

interface CompetitorsTableProps {
  data: CompetitorData[];
  isLoading?: boolean;
  projectId?: string | null;
}

const competitorExportColumns: ExportColumn<CompetitorData>[] = [
  { header: "Competitor Domain", accessor: "competitorDomain" },
  { header: "Shared Keywords", accessor: "sharedKeywords" },
  { header: "Above Us", accessor: "aboveUsKeywords" },
  { header: "Their Avg Position", accessor: "avgTheirPosition", format: (v) => v ? Number(v).toFixed(1) : "-" },
  { header: "Our Avg Position", accessor: "avgOurPosition", format: (v) => v ? Number(v).toFixed(1) : "-" },
  { header: "Avg Gap", accessor: "avgGap", format: (v) => v ? Number(v).toFixed(1) : "-" },
  { header: "Total Volume", accessor: "totalVolume" },
  { header: "Pressure Index", accessor: "pressureIndex", format: (v) => Math.round(v) },
  { header: "Traffic Threat", accessor: "trafficThreat" },
  { header: "AI Overview", accessor: "aiOverviewCount", format: (v) => v ?? 0 },
  { header: "Featured Snippet", accessor: "featuredSnippetCount", format: (v) => v ?? 0 },
  { header: "Local Pack", accessor: "localPackCount", format: (v) => v ?? 0 },
  { header: "Organic Top 10", accessor: "organicTop10Count", format: (v) => v ?? 0 },
  { header: "SERP Visibility", accessor: "serpVisibilityTotal", format: (v) => v ?? 0 },
];

export function CompetitorsTable({ data, isLoading, projectId }: CompetitorsTableProps) {
  const [search, setSearch] = useState("");
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [backlinksDrawerDomain, setBacklinksDrawerDomain] = useState<string | null>(null);
  const [sortField, setSortField] = useState<CompetitorSortField>("sharedKeywords");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [pressureFilter, setPressureFilter] = useState<string>("all");
  const [threatFilter, setThreatFilter] = useState<string>("all");
  const { toast } = useToast();

  const handleSort = (field: CompetitorSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: CompetitorSortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const crawlAllBacklinksMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      const res = await apiRequest("POST", "/api/competitor-backlinks/crawl-all", {
        projectId,
        limit: 50,
      });
      return res.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Backlinks Crawl Complete",
        description: `Processed ${result.competitorsProcessed} competitors, found ${result.totalBacklinks} backlinks and ${result.totalOpportunities} opportunities.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/competitor-backlinks/counts", projectId] });
    },
    onError: (error) => {
      toast({
        title: "Crawl Failed",
        description: error instanceof Error ? error.message : "Failed to crawl backlinks",
        variant: "destructive",
      });
    },
  });

  const { data: backlinkCounts = {} } = useQuery<Record<string, { total: number; opportunities: number }>>({
    queryKey: ["/api/competitor-backlinks/counts", projectId],
    queryFn: async () => {
      if (!projectId) return {};
      const res = await fetch(`/api/competitor-backlinks/counts?projectId=${projectId}`);
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: keywordDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ["/api/competitors", selectedCompetitor, "keywords", projectId],
    queryFn: async () => {
      if (!selectedCompetitor || !projectId) return null;
      const res = await fetch(`/api/competitors/${encodeURIComponent(selectedCompetitor)}/keywords?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch keyword details");
      return res.json();
    },
    enabled: !!selectedCompetitor && !!projectId,
  });

  const sortedData = useMemo(() => {
    let result = data.filter((item) =>
      item.competitorDomain.toLowerCase().includes(search.toLowerCase())
    );

    if (pressureFilter !== "all") {
      result = result.filter((item) => {
        if (pressureFilter === "low") return item.pressureIndex < 30;
        if (pressureFilter === "medium") return item.pressureIndex >= 30 && item.pressureIndex <= 60;
        if (pressureFilter === "high") return item.pressureIndex > 60;
        return true;
      });
    }

    if (threatFilter !== "all") {
      result = result.filter((item) => {
        if (threatFilter === "low") return item.trafficThreat === "low";
        if (threatFilter === "medium") return item.trafficThreat === "medium";
        if (threatFilter === "high") return item.trafficThreat === "high";
        return true;
      });
    }

    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      
      switch (sortField) {
        case "competitorDomain":
          aVal = a.competitorDomain.toLowerCase();
          bVal = b.competitorDomain.toLowerCase();
          break;
        case "sharedKeywords":
          aVal = a.sharedKeywords;
          bVal = b.sharedKeywords;
          break;
        case "aboveUsKeywords":
          aVal = a.aboveUsKeywords;
          bVal = b.aboveUsKeywords;
          break;
        case "pressureIndex":
          aVal = a.pressureIndex;
          bVal = b.pressureIndex;
          break;
        case "avgTheirPosition":
          aVal = a.avgTheirPosition || 999;
          bVal = b.avgTheirPosition || 999;
          break;
        case "serpVisibilityTotal":
          aVal = a.serpVisibilityTotal || 0;
          bVal = b.serpVisibilityTotal || 0;
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [data, search, sortField, sortDirection, pressureFilter, threatFilter]);

  const getPressureColor = (index: number) => {
    if (index >= 60) return "hsl(var(--destructive))";
    if (index >= 30) return "hsl(var(--chart-5))";
    return "hsl(var(--chart-4))";
  };

  const getPressureLabel = (index: number) => {
    if (index >= 60) return "High";
    if (index >= 30) return "Medium";
    return "Low";
  };

  const getPressureBadgeClass = (index: number) => {
    if (index >= 60) return "bg-red-500/10 text-red-600 dark:text-red-400";
    if (index >= 30) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  };

  const chartData = sortedData.slice(0, 10).map((item) => ({
    domain: item.competitorDomain.replace(/^www\./, "").split(".")[0],
    sharedKeywords: item.sharedKeywords,
    aboveUs: item.aboveUsKeywords,
    fullDomain: item.competitorDomain,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-popover px-4 py-3 shadow-md">
          <p className="mb-1 font-medium text-popover-foreground">{data.fullDomain}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Shared Keywords:</span>
            <span className="font-semibold">{data.sharedKeywords}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Above Us:</span>
            <span className="font-semibold text-red-500">{data.aboveUs}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card data-testid="competitors-table">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg font-medium">Competitor Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-12 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full">
      <Card data-testid="competitors-chart" className="w-full overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Keyword Overlap by Competitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  type="number"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="domain"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="sharedKeywords" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} maxBarSize={20} name="Shared" />
                <Bar dataKey="aboveUs" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} maxBarSize={20} name="Above Us" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="competitors-table" className="w-full overflow-hidden">
        <CardHeader className="flex flex-col gap-4 pb-4">
          <div className="flex flex-row flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium">Organic Search Competitors</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search competitors..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48 pl-9"
                  data-testid="input-competitor-search"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => crawlAllBacklinksMutation.mutate()}
                disabled={!projectId || crawlAllBacklinksMutation.isPending || data.length === 0}
                data-testid="button-crawl-all-backlinks"
              >
                {crawlAllBacklinksMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Crawling...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Crawl All Backlinks
                  </>
                )}
              </Button>
              <ExportButton
                data={sortedData}
                columns={competitorExportColumns}
                filename="competitors"
                sheetName="Competitors"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Pressure:</span>
              <Select value={pressureFilter} onValueChange={setPressureFilter}>
                <SelectTrigger className="w-32" data-testid="select-pressure-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low (&lt;30)</SelectItem>
                  <SelectItem value="medium">Medium (30-60)</SelectItem>
                  <SelectItem value="high">High (60+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Threat:</span>
              <Select value={threatFilter} onValueChange={setThreatFilter}>
                <SelectTrigger className="w-28" data-testid="select-threat-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="ml-auto">
              {sortedData.length} of {data.length} competitors
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
            <Table className="min-w-[1100px] w-full">
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="w-[220px] cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("competitorDomain")}
                  >
                    <div className="flex items-center">
                      Competitor
                      <SortIcon field="competitorDomain" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("sharedKeywords")}
                  >
                    <div className="flex items-center justify-center">
                      Shared KWs
                      <SortIcon field="sharedKeywords" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("aboveUsKeywords")}
                  >
                    <div className="flex items-center justify-center">
                      Above Us
                      <SortIcon field="aboveUsKeywords" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("avgTheirPosition")}
                  >
                    <div className="flex items-center justify-center">
                      Avg Pos (Us vs Them)
                      <SortIcon field="avgTheirPosition" />
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Backlinks</TableHead>
                  <TableHead className="text-center">Traffic Threat</TableHead>
                  <TableHead 
                    className="w-[180px] cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("pressureIndex")}
                  >
                    <div className="flex items-center">
                      Pressure
                      <SortIcon field="pressureIndex" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("serpVisibilityTotal")}
                    data-testid="header-serp-visibility"
                  >
                    <div className="flex items-center justify-center gap-1" title="SERP Visibility (AI Overview, Featured Snippet, Local Pack)">
                      <Bot className="h-3.5 w-3.5" />
                      <Sparkles className="h-3.5 w-3.5" />
                      <MapPin className="h-3.5 w-3.5" />
                      <SortIcon field="serpVisibilityTotal" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="h-8 w-8" />
                        <p>No competitors found</p>
                        <p className="text-sm">Run a rankings sync to discover competitors from SERP data</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((item, index) => (
                    <TableRow
                      key={item.competitorDomain}
                      className="hover-elevate cursor-pointer"
                      data-testid={`row-competitor-${index}`}
                      onClick={() => setSelectedCompetitor(item.competitorDomain)}
                    >
                      <TableCell>
                        <a
                          href={`https://${item.competitorDomain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 font-medium text-foreground hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>{item.competitorDomain}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono">{item.sharedKeywords}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-mono border-0",
                            item.aboveUsKeywords > 0
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {item.aboveUsKeywords}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 font-mono">
                          <span className="text-muted-foreground">{item.avgOurPosition?.toFixed(1) || '-'}</span>
                          <span className="text-muted-foreground">vs</span>
                          <span className="font-semibold">{item.avgTheirPosition?.toFixed(1) || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const counts = backlinkCounts[item.competitorDomain];
                          return (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 font-mono"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (projectId) {
                                  setBacklinksDrawerDomain(item.competitorDomain);
                                }
                              }}
                              disabled={!projectId}
                              data-testid={`button-backlinks-${item.competitorDomain}`}
                            >
                              <Link2 className="h-3 w-3" />
                              {counts?.total || 0}
                              {counts?.opportunities ? (
                                <Badge 
                                  variant="secondary" 
                                  className="ml-1 bg-green-500/10 text-green-600 text-xs px-1"
                                >
                                  {counts.opportunities}
                                </Badge>
                              ) : null}
                            </Button>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "border-0",
                            item.trafficThreat === 'high'
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : item.trafficThreat === 'medium'
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {item.trafficThreat === 'high' ? 'High' : item.trafficThreat === 'medium' ? 'Medium' : 'Low'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge
                              variant="secondary"
                              className={cn("border-0", getPressureBadgeClass(item.pressureIndex))}
                            >
                              <TrendingUp className="mr-1 h-3 w-3" />
                              {getPressureLabel(item.pressureIndex)}
                            </Badge>
                            <span className="font-mono text-sm">
                              {Number(item.pressureIndex).toFixed(0)}
                            </span>
                          </div>
                          <Progress
                            value={item.pressureIndex}
                            className="h-2"
                            indicatorClassName={
                              item.pressureIndex >= 60
                                ? "bg-red-500"
                                : item.pressureIndex >= 30
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center" data-testid={`cell-serp-visibility-${index}`}>
                        <div className="flex items-center justify-center gap-2">
                          {(item.aiOverviewCount ?? 0) > 0 && (
                            <div className="flex items-center gap-0.5" title="AI Overview mentions">
                              <Bot className="h-3.5 w-3.5 text-purple-500" />
                              <span className="text-xs font-mono">{item.aiOverviewCount}</span>
                            </div>
                          )}
                          {(item.featuredSnippetCount ?? 0) > 0 && (
                            <div className="flex items-center gap-0.5" title="Featured Snippet mentions">
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                              <span className="text-xs font-mono">{item.featuredSnippetCount}</span>
                            </div>
                          )}
                          {(item.localPackCount ?? 0) > 0 && (
                            <div className="flex items-center gap-0.5" title="Local Pack mentions">
                              <MapPin className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-xs font-mono">{item.localPackCount}</span>
                            </div>
                          )}
                          {(item.serpVisibilityTotal ?? 0) === 0 && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCompetitor} onOpenChange={() => setSelectedCompetitor(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Keywords Where</span>
              <Badge variant="outline" className="text-base font-normal">
                {selectedCompetitor}
              </Badge>
              <span>Competes</span>
            </DialogTitle>
          </DialogHeader>
          
          {keywordDetails?.summary && (
            <div className="grid grid-cols-4 gap-4 py-4 border-b">
              <div className="text-center">
                <div className="text-2xl font-bold">{keywordDetails.summary.total}</div>
                <div className="text-sm text-muted-foreground">Total Keywords</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{keywordDetails.summary.aboveUs}</div>
                <div className="text-sm text-muted-foreground">Above Us</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-500">{keywordDetails.summary.belowUs}</div>
                <div className="text-sm text-muted-foreground">Below Us</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{keywordDetails.summary.totalVolume?.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Volume</div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {loadingDetails ? (
              <div className="space-y-2 p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead className="text-center">Volume</TableHead>
                    <TableHead className="text-center">Their Pos</TableHead>
                    <TableHead className="text-center">Our Pos</TableHead>
                    <TableHead className="text-center">Gap</TableHead>
                    <TableHead>Competitor URL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(keywordDetails?.keywords || []).map((kw: KeywordDetail) => (
                    <TableRow key={kw.keywordId} data-testid={`row-keyword-detail-${kw.keywordId}`}>
                      <TableCell>
                        <div className="font-medium">{kw.keyword}</div>
                        {kw.cluster && (
                          <div className="text-xs text-muted-foreground">{kw.cluster}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {kw.searchVolume.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono">
                          {kw.competitorPosition}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "font-mono",
                            kw.ourPosition === null 
                              ? "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                              : ""
                          )}
                        >
                          {kw.ourPosition || 'N/R'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={cn(
                          "flex items-center justify-center gap-1 font-mono",
                          kw.gap > 0 ? "text-red-500" : kw.gap < 0 ? "text-emerald-500" : "text-muted-foreground"
                        )}>
                          {kw.gap > 0 ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : kw.gap < 0 ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                          <span>{Math.abs(kw.gap)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {kw.competitorUrl && (
                          <a
                            href={kw.competitorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary truncate max-w-[200px]"
                          >
                            <span className="truncate">{kw.competitorUrl.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {projectId && (
        <CompetitorBacklinksDrawer
          open={!!backlinksDrawerDomain}
          onOpenChange={(open) => !open && setBacklinksDrawerDomain(null)}
          projectId={projectId}
          competitorDomain={backlinksDrawerDomain || ""}
        />
      )}
    </div>
  );
}
