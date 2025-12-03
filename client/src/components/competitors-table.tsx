import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Search, ExternalLink, TrendingUp, Target, ChevronRight, ArrowUp, ArrowDown, Minus, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/export-button";
import type { ExportColumn } from "@/lib/export-utils";
import { CompetitorBacklinksDrawer } from "@/components/competitor-backlinks-drawer";

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
];

export function CompetitorsTable({ data, isLoading, projectId }: CompetitorsTableProps) {
  const [search, setSearch] = useState("");
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [backlinksDrawerDomain, setBacklinksDrawerDomain] = useState<string | null>(null);

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

  const filteredData = data.filter((item) =>
    item.competitorDomain.toLowerCase().includes(search.toLowerCase())
  );

  const sortedData = [...filteredData].sort((a, b) => b.sharedKeywords - a.sharedKeywords);

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
    <div className="space-y-6">
      <Card data-testid="competitors-chart">
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

      <Card data-testid="competitors-table">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg font-medium">Organic Search Competitors</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search competitors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
                data-testid="input-competitor-search"
              />
            </div>
            <ExportButton
              data={sortedData}
              columns={competitorExportColumns}
              filename="competitors"
              sheetName="Competitors"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Competitor</TableHead>
                  <TableHead className="text-center">Shared KWs</TableHead>
                  <TableHead className="text-center">Above Us</TableHead>
                  <TableHead className="text-center">Avg Pos (Us vs Them)</TableHead>
                  <TableHead className="text-center">Backlinks</TableHead>
                  <TableHead className="text-center">Traffic Threat</TableHead>
                  <TableHead className="w-[180px]">Pressure</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
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
          </div>
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
