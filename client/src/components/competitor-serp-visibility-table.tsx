import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ExternalLink, ArrowUp, ArrowDown, ArrowUpDown, Bot, Sparkles, MapPin, ListChecks } from "lucide-react";
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

export function CompetitorSerpVisibilityTable({ data, isLoading }: CompetitorSerpVisibilityTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("serpVisibilityTotal");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

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
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-mono",
                          (item.aiOverviewCount ?? 0) > 0
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.aiOverviewCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-mono",
                          (item.featuredSnippetCount ?? 0) > 0
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.featuredSnippetCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-mono",
                          (item.localPackCount ?? 0) > 0
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.localPackCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-mono",
                          (item.organicTop10Count ?? 0) > 0
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.organicTop10Count ?? 0}
                      </Badge>
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
    </div>
  );
}
