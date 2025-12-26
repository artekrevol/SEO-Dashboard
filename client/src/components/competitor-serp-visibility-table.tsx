import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, ExternalLink, ArrowUp, ArrowDown, ArrowUpDown, Bot, Sparkles, MapPin, ListChecks, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/export-button";
import type { ExportColumn } from "@/lib/export-utils";

type SortField = "competitorDomain" | "serpVisibilityTotal" | "aiOverviewCount" | "featuredSnippetCount" | "localPackCount" | "organicTop10Count";
type SortDirection = "asc" | "desc";

interface CompetitorData {
  competitorDomain: string;
  sharedKeywords: number;
  aiOverviewCount?: number;
  featuredSnippetCount?: number;
  localPackCount?: number;
  organicTop10Count?: number;
  serpVisibilityTotal?: number;
}

interface CompetitorSerpVisibilityTableProps {
  data: CompetitorData[];
  isLoading?: boolean;
  projectId?: string | null;
  sortField?: string;
  sortDirection?: SortDirection;
  onSortChange?: (field: string, direction: SortDirection) => void;
}

interface SerpKeywordDetail {
  keywordId: number;
  keyword: string;
  searchVolume: number;
  position: number;
  url: string;
  blockType: string;
  capturedAt: string;
}

interface DrawerState {
  isOpen: boolean;
  competitorDomain: string | null;
  featureType: string | null;
  featureLabel: string;
}

const exportColumns: ExportColumn<CompetitorData>[] = [
  { header: "Competitor Domain", accessor: "competitorDomain" },
  { header: "Shared Keywords", accessor: "sharedKeywords" },
  { header: "AI Overview", accessor: "aiOverviewCount", format: (v) => v ?? 0 },
  { header: "Featured Snippet", accessor: "featuredSnippetCount", format: (v) => v ?? 0 },
  { header: "Local Pack", accessor: "localPackCount", format: (v) => v ?? 0 },
  { header: "Organic Top 10", accessor: "organicTop10Count", format: (v) => v ?? 0 },
  { header: "Total SERP Visibility", accessor: "serpVisibilityTotal", format: (v) => v ?? 0 },
];

const featureConfig: Record<string, { icon: typeof Bot; color: string; label: string; blockTypes: string[] }> = {
  aiOverview: { icon: Bot, color: "purple", label: "AI Overview", blockTypes: ["ai_overview"] },
  featuredSnippet: { icon: Sparkles, color: "amber", label: "Featured Snippet", blockTypes: ["featured_snippet"] },
  localPack: { icon: MapPin, color: "blue", label: "Local Pack", blockTypes: ["local_pack"] },
  organicTop10: { icon: ListChecks, color: "emerald", label: "Organic Top 10", blockTypes: ["organic"] },
};

export function CompetitorSerpVisibilityTable({ 
  data, 
  isLoading,
  projectId,
  sortField: externalSortField,
  sortDirection: externalSortDirection,
  onSortChange,
}: CompetitorSerpVisibilityTableProps) {
  const [search, setSearch] = useState("");
  const [localSortField, setLocalSortField] = useState<SortField>("serpVisibilityTotal");
  const [localSortDirection, setLocalSortDirection] = useState<SortDirection>("desc");
  const [drawer, setDrawer] = useState<DrawerState>({
    isOpen: false,
    competitorDomain: null,
    featureType: null,
    featureLabel: "",
  });

  const sortField = (externalSortField as SortField) || localSortField;
  const sortDirection = externalSortDirection || localSortDirection;

  const handleSort = (field: SortField) => {
    const newDirection = sortField === field && sortDirection === "desc" ? "asc" : "desc";
    if (onSortChange) {
      onSortChange(field, newDirection);
    } else {
      setLocalSortField(field);
      setLocalSortDirection(newDirection);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const openKeywordDrawer = (domain: string, featureType: string, featureLabel: string, count: number) => {
    if (count === 0) return;
    setDrawer({
      isOpen: true,
      competitorDomain: domain,
      featureType,
      featureLabel,
    });
  };

  const { data: keywordDetails, isLoading: keywordsLoading } = useQuery<SerpKeywordDetail[]>({
    queryKey: ["/api/competitors/serp-keywords", drawer.competitorDomain, drawer.featureType, projectId],
    queryFn: async () => {
      if (!drawer.competitorDomain || !drawer.featureType || !projectId) return [];
      const res = await fetch(
        `/api/competitors/${encodeURIComponent(drawer.competitorDomain)}/serp-keywords?projectId=${projectId}&featureType=${drawer.featureType}`
      );
      if (!res.ok) throw new Error("Failed to fetch keyword details");
      return res.json();
    },
    enabled: drawer.isOpen && !!drawer.competitorDomain && !!drawer.featureType && !!projectId,
  });

  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(item => 
      item.competitorDomain.toLowerCase().includes(search.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "competitorDomain":
          aVal = a.competitorDomain.toLowerCase();
          bVal = b.competitorDomain.toLowerCase();
          break;
        case "serpVisibilityTotal":
          aVal = a.serpVisibilityTotal ?? 0;
          bVal = b.serpVisibilityTotal ?? 0;
          break;
        case "aiOverviewCount":
          aVal = a.aiOverviewCount ?? 0;
          bVal = b.aiOverviewCount ?? 0;
          break;
        case "featuredSnippetCount":
          aVal = a.featuredSnippetCount ?? 0;
          bVal = b.featuredSnippetCount ?? 0;
          break;
        case "localPackCount":
          aVal = a.localPackCount ?? 0;
          bVal = b.localPackCount ?? 0;
          break;
        case "organicTop10Count":
          aVal = a.organicTop10Count ?? 0;
          bVal = b.organicTop10Count ?? 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data, search, sortField, sortDirection]);

  const competitorsWithVisibility = useMemo(() => {
    return data.filter(c => (c.serpVisibilityTotal ?? 0) > 0).length;
  }, [data]);

  const totalAiOverview = useMemo(() => {
    return data.reduce((sum, c) => sum + (c.aiOverviewCount ?? 0), 0);
  }, [data]);

  const totalFeaturedSnippet = useMemo(() => {
    return data.reduce((sum, c) => sum + (c.featuredSnippetCount ?? 0), 0);
  }, [data]);

  const totalLocalPack = useMemo(() => {
    return data.reduce((sum, c) => sum + (c.localPackCount ?? 0), 0);
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const ClickableBadge = ({ 
    count, 
    colorClass, 
    domain,
    featureType,
    featureLabel,
  }: { 
    count: number; 
    colorClass: string;
    domain: string;
    featureType: string;
    featureLabel: string;
  }) => (
    <Badge
      variant="secondary"
      className={cn(
        "font-mono transition-all",
        count > 0
          ? `${colorClass} cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-offset-background`
          : "bg-muted text-muted-foreground"
      )}
      onClick={() => openKeywordDrawer(domain, featureType, featureLabel, count)}
      data-testid={`badge-${featureType}-${domain}`}
    >
      {count}
    </Badge>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Competitors with SERP Features</p>
                <p className="text-2xl font-bold">{competitorsWithVisibility}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ListChecks className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI Overview Appearances</p>
                <p className="text-2xl font-bold">{totalAiOverview}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Featured Snippet Wins</p>
                <p className="text-2xl font-bold">{totalFeaturedSnippet}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Local Pack Appearances</p>
                <p className="text-2xl font-bold">{totalLocalPack}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="serp-visibility-table">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg font-medium">Competitor SERP Feature Visibility</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search competitors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 pl-9"
                data-testid="input-serp-visibility-search"
              />
            </div>
            <ExportButton
              data={filteredAndSortedData}
              columns={exportColumns}
              filename="competitor-serp-visibility"
              sheetName="SERP Visibility"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="w-[250px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("competitorDomain")}
                >
                  <div className="flex items-center">
                    Competitor
                    <SortIcon field="competitorDomain" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("aiOverviewCount")}
                  data-testid="header-ai-overview"
                >
                  <div className="flex items-center justify-center gap-1">
                    <Bot className="h-4 w-4 text-purple-500" />
                    AI Overview
                    <SortIcon field="aiOverviewCount" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("featuredSnippetCount")}
                  data-testid="header-featured-snippet"
                >
                  <div className="flex items-center justify-center gap-1">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Featured Snippet
                    <SortIcon field="featuredSnippetCount" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("localPackCount")}
                  data-testid="header-local-pack"
                >
                  <div className="flex items-center justify-center gap-1">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    Local Pack
                    <SortIcon field="localPackCount" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("organicTop10Count")}
                  data-testid="header-organic-top10"
                >
                  <div className="flex items-center justify-center gap-1">
                    <ListChecks className="h-4 w-4 text-emerald-500" />
                    Organic Top 10
                    <SortIcon field="organicTop10Count" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("serpVisibilityTotal")}
                  data-testid="header-total-visibility"
                >
                  <div className="flex items-center justify-center">
                    Total
                    <SortIcon field="serpVisibilityTotal" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8" />
                      <p>No competitors found</p>
                      <p className="text-sm">Run a SERP layout crawl to capture competitor visibility data</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((item, index) => (
                  <TableRow
                    key={item.competitorDomain}
                    data-testid={`row-serp-visibility-${index}`}
                  >
                    <TableCell>
                      <a
                        href={`https://${item.competitorDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 font-medium text-foreground hover:text-primary"
                      >
                        <span>{item.competitorDomain}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell className="text-center">
                      <ClickableBadge
                        count={item.aiOverviewCount ?? 0}
                        colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:ring-purple-500"
                        domain={item.competitorDomain}
                        featureType="aiOverview"
                        featureLabel="AI Overview"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <ClickableBadge
                        count={item.featuredSnippetCount ?? 0}
                        colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:ring-amber-500"
                        domain={item.competitorDomain}
                        featureType="featuredSnippet"
                        featureLabel="Featured Snippet"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <ClickableBadge
                        count={item.localPackCount ?? 0}
                        colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:ring-blue-500"
                        domain={item.competitorDomain}
                        featureType="localPack"
                        featureLabel="Local Pack"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <ClickableBadge
                        count={item.organicTop10Count ?? 0}
                        colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:ring-emerald-500"
                        domain={item.competitorDomain}
                        featureType="organicTop10"
                        featureLabel="Organic Top 10"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-mono font-bold",
                          (item.serpVisibilityTotal ?? 0) > 0
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.serpVisibilityTotal ?? 0}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={drawer.isOpen} onOpenChange={(open) => setDrawer(prev => ({ ...prev, isOpen: open }))}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {drawer.featureType === "aiOverview" && <Bot className="h-5 w-5 text-purple-500" />}
              {drawer.featureType === "featuredSnippet" && <Sparkles className="h-5 w-5 text-amber-500" />}
              {drawer.featureType === "localPack" && <MapPin className="h-5 w-5 text-blue-500" />}
              {drawer.featureType === "organicTop10" && <ListChecks className="h-5 w-5 text-emerald-500" />}
              {drawer.featureLabel} Keywords
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              Keywords where <span className="font-medium">{drawer.competitorDomain}</span> appears in {drawer.featureLabel}
            </p>
          </SheetHeader>
          
          <div className="mt-6">
            {keywordsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : !keywordDetails || keywordDetails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mb-4" />
                <p className="font-medium">No keyword details found</p>
                <p className="text-sm">Run a SERP layout crawl to capture this data</p>
              </div>
            ) : (
              <div className="space-y-3">
                {keywordDetails.map((kw) => (
                  <Card key={`${kw.keywordId}-${kw.blockType}`} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{kw.keyword}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{kw.searchVolume?.toLocaleString() ?? 0} vol</span>
                          {kw.position && <span>Position #{kw.position}</span>}
                        </div>
                        {kw.url && (
                          <a
                            href={kw.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline truncate"
                          >
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{kw.url}</span>
                          </a>
                        )}
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {kw.blockType?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
