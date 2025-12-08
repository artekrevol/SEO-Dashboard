import { useState, useMemo } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link2,
  FileCode,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/export-button";
import type { ExportColumn } from "@/lib/export-utils";
import { BacklinkDetailDrawer } from "@/components/backlink-detail-drawer";
import { PageAuditDrawer } from "@/components/page-audit-drawer";

type SortField = "url" | "avgPosition" | "keywordsInTop10" | "backlinksCount" | "techRiskScore" | "contentGapScore";
type SortDirection = "asc" | "desc";

interface PageData {
  url: string;
  avgPosition: number;
  bestPosition: number;
  keywordsInTop10: number;
  keywordsInTop3: number;
  totalKeywords: number;
  rankedKeywords: number;
  backlinksCount: number;
  referringDomains: number;
  newLinks7d: number;
  lostLinks7d: number;
  hasSchema: boolean;
  isIndexable: boolean;
  duplicateContent: boolean;
  coreWebVitalsOk: boolean;
  contentGapScore: number;
  techRiskScore: number;
  authorityGapScore: number;
  onpageScore: number | null;
  issueCount: number;
  hasAuditData: boolean;
}

interface PagesTableProps {
  data: PageData[];
  isLoading?: boolean;
  projectId: string | null;
}

const pageExportColumns: ExportColumn<PageData>[] = [
  { header: "URL", accessor: "url" },
  { header: "Avg Position", accessor: "avgPosition", format: (v) => v > 0 ? Number(v).toFixed(1) : "-" },
  { header: "Best Position", accessor: "bestPosition" },
  { header: "Keywords in Top 10", accessor: "keywordsInTop10" },
  { header: "Keywords in Top 3", accessor: "keywordsInTop3" },
  { header: "Total Keywords", accessor: "totalKeywords" },
  { header: "Ranked Keywords", accessor: "rankedKeywords" },
  { header: "Backlinks", accessor: "backlinksCount" },
  { header: "Referring Domains", accessor: "referringDomains" },
  { header: "New Links (7d)", accessor: "newLinks7d" },
  { header: "Lost Links (7d)", accessor: "lostLinks7d" },
  { header: "Has Schema", accessor: (row) => row.hasSchema ? "Yes" : "No" },
  { header: "Indexable", accessor: (row) => row.isIndexable ? "Yes" : "No" },
  { header: "Duplicate Content", accessor: (row) => row.duplicateContent ? "Yes" : "No" },
  { header: "CWV OK", accessor: (row) => row.coreWebVitalsOk ? "Yes" : "No" },
  { header: "OnPage Score", accessor: (row) => row.onpageScore !== null ? row.onpageScore.toFixed(0) : "-" },
  { header: "Issue Count", accessor: "issueCount" },
  { header: "Tech Risk Score", accessor: "techRiskScore" },
  { header: "Content Gap Score", accessor: "contentGapScore" },
];

export function PagesTable({ data, isLoading, projectId }: PagesTableProps) {
  const [search, setSearch] = useState("");
  const [backlinkDrawerOpen, setBacklinkDrawerOpen] = useState(false);
  const [selectedPageUrl, setSelectedPageUrl] = useState<string | null>(null);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [selectedAuditUrl, setSelectedAuditUrl] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("keywordsInTop10");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [techRiskFilter, setTechRiskFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");

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
    let result = data.filter((item) =>
      item.url.toLowerCase().includes(search.toLowerCase())
    );

    if (techRiskFilter !== "all") {
      result = result.filter((item) => {
        if (techRiskFilter === "low") return item.techRiskScore < 30;
        if (techRiskFilter === "medium") return item.techRiskScore >= 30 && item.techRiskScore <= 60;
        if (techRiskFilter === "high") return item.techRiskScore > 60;
        return true;
      });
    }

    if (healthFilter !== "all") {
      result = result.filter((item) => {
        if (healthFilter === "indexable") return item.isIndexable;
        if (healthFilter === "not_indexable") return !item.isIndexable;
        if (healthFilter === "has_schema") return item.hasSchema;
        if (healthFilter === "no_schema") return !item.hasSchema;
        if (healthFilter === "cwv_ok") return item.coreWebVitalsOk;
        if (healthFilter === "cwv_issues") return !item.coreWebVitalsOk;
        return true;
      });
    }

    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      
      switch (sortField) {
        case "url":
          aVal = a.url.toLowerCase();
          bVal = b.url.toLowerCase();
          break;
        case "avgPosition":
          aVal = a.avgPosition || 999;
          bVal = b.avgPosition || 999;
          break;
        case "keywordsInTop10":
          aVal = a.keywordsInTop10;
          bVal = b.keywordsInTop10;
          break;
        case "backlinksCount":
          aVal = a.backlinksCount;
          bVal = b.backlinksCount;
          break;
        case "techRiskScore":
          aVal = a.techRiskScore;
          bVal = b.techRiskScore;
          break;
        case "contentGapScore":
          aVal = a.contentGapScore;
          bVal = b.contentGapScore;
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [data, search, sortField, sortDirection, techRiskFilter, healthFilter]);

  const filteredData = filteredAndSortedData;

  const getRiskColor = (score: number) => {
    if (score < 30) return "bg-emerald-500";
    if (score < 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const getRiskLabel = (score: number) => {
    if (score < 30) return "Low";
    if (score < 60) return "Medium";
    return "High";
  };

  if (isLoading) {
    return (
      <Card data-testid="pages-table">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg font-medium">Page Analytics</CardTitle>
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
    <Card data-testid="pages-table">
      <CardHeader className="flex flex-col gap-4 pb-4">
        <div className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle className="text-lg font-medium">Page Analytics</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search URLs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
                data-testid="input-page-search"
              />
            </div>
            <ExportButton
              data={filteredData}
              columns={pageExportColumns}
              filename="pages"
              sheetName="Pages"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tech Risk:</span>
            <Select value={techRiskFilter} onValueChange={setTechRiskFilter}>
              <SelectTrigger className="w-32" data-testid="select-tech-risk-filter">
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
            <span className="text-sm text-muted-foreground">Health:</span>
            <Select value={healthFilter} onValueChange={setHealthFilter}>
              <SelectTrigger className="w-36" data-testid="select-health-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="indexable">Indexable</SelectItem>
                <SelectItem value="not_indexable">Not Indexable</SelectItem>
                <SelectItem value="has_schema">Has Schema</SelectItem>
                <SelectItem value="no_schema">No Schema</SelectItem>
                <SelectItem value="cwv_ok">CWV OK</SelectItem>
                <SelectItem value="cwv_issues">CWV Issues</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="ml-auto">
            {filteredData.length} of {data.length} pages
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="w-[350px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("url")}
                >
                  <div className="flex items-center">
                    URL
                    <SortIcon field="url" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("avgPosition")}
                >
                  <div className="flex items-center justify-center">
                    Avg Position
                    <SortIcon field="avgPosition" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("keywordsInTop10")}
                >
                  <div className="flex items-center justify-center">
                    Top 10
                    <SortIcon field="keywordsInTop10" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("backlinksCount")}
                >
                  <div className="flex items-center justify-center">
                    Backlinks
                    <SortIcon field="backlinksCount" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Link Velocity</TableHead>
                <TableHead className="text-center">Health</TableHead>
                <TableHead 
                  className="w-[150px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("techRiskScore")}
                >
                  <div className="flex items-center">
                    Tech Risk
                    <SortIcon field="techRiskScore" />
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[150px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("contentGapScore")}
                >
                  <div className="flex items-center">
                    Content Gap
                    <SortIcon field="contentGapScore" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8" />
                      <p>No pages found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item, index) => (
                  <TableRow
                    key={item.url}
                    className="hover-elevate"
                    data-testid={`row-page-${index}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 font-mono text-sm text-foreground hover:text-primary"
                        >
                          <span className="max-w-[300px] truncate">
                            {item.url.replace(/^https?:\/\//, "")}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {item.avgPosition > 0 ? (
                        <div className="flex flex-col items-center">
                          <Badge 
                            variant={item.avgPosition <= 10 ? "default" : item.avgPosition <= 20 ? "outline" : "secondary"}
                            className="font-mono text-sm"
                          >
                            {Number(item.avgPosition).toFixed(1)}
                          </Badge>
                          {item.bestPosition > 0 && item.bestPosition !== Math.round(item.avgPosition) && (
                            <span className="text-xs text-muted-foreground mt-0.5">
                              best: {item.bestPosition}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge 
                          variant={item.keywordsInTop10 > 0 ? "default" : "outline"} 
                          className="font-mono"
                        >
                          {item.keywordsInTop10}
                        </Badge>
                        {item.totalKeywords > 0 && (
                          <span className="text-xs text-muted-foreground">
                            / {item.totalKeywords} total
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {item.backlinksCount > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1 hover:bg-muted"
                            onClick={() => {
                              setSelectedPageUrl(item.url);
                              setBacklinkDrawerOpen(true);
                            }}
                            data-testid={`button-view-backlinks-${index}`}
                          >
                            <div className="flex items-center gap-1">
                              <Link2 className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono text-sm">{item.backlinksCount.toLocaleString()}</span>
                              <Eye className="h-3 w-3 ml-1 text-primary" />
                            </div>
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {item.referringDomains} domains
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.backlinksCount > 0 ? (
                        <div className="flex items-center justify-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">
                            +{item.newLinks7d}
                          </Badge>
                          <Badge variant="outline" className="text-xs font-mono">
                            -{item.lostLinks7d}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Tooltip>
                          <TooltipTrigger>
                            {item.isIndexable ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            {item.isIndexable ? "Indexable" : "Not Indexable"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger>
                            {item.hasSchema ? (
                              <FileCode className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <FileCode className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            {item.hasSchema ? "Has Schema" : "No Schema"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger>
                            {item.coreWebVitalsOk ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            {item.coreWebVitalsOk ? "CWV Passed" : "CWV Issues"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.hasAuditData ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-auto p-1 hover:bg-muted"
                          onClick={() => {
                            setSelectedAuditUrl(item.url);
                            setAuditDrawerOpen(true);
                          }}
                          data-testid={`button-view-audit-${index}`}
                        >
                          <div className="w-full space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {getRiskLabel(item.techRiskScore)}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="font-mono">{item.techRiskScore}%</span>
                                <Eye className="h-3 w-3 text-primary" />
                              </div>
                            </div>
                            <Progress
                              value={item.techRiskScore}
                              className="h-2"
                              indicatorClassName={getRiskColor(item.techRiskScore)}
                            />
                            {item.issueCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {item.issueCount} issue{item.issueCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </Button>
                      ) : (
                        <div className="flex items-center justify-center text-xs text-muted-foreground">
                          <span>Run audit</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.hasAuditData ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {getRiskLabel(item.contentGapScore)}
                            </span>
                            <span className="font-mono">{item.contentGapScore}%</span>
                          </div>
                          <Progress
                            value={item.contentGapScore}
                            className="h-2"
                            indicatorClassName={getRiskColor(item.contentGapScore)}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-xs text-muted-foreground">
                          <span>Run audit</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {projectId && (
        <BacklinkDetailDrawer
          open={backlinkDrawerOpen}
          onOpenChange={setBacklinkDrawerOpen}
          projectId={projectId}
          targetUrl={selectedPageUrl || undefined}
          pageTitle={selectedPageUrl?.replace(/^https?:\/\//, "") || ""}
        />
      )}

      {projectId && selectedAuditUrl && (
        <PageAuditDrawer
          open={auditDrawerOpen}
          onOpenChange={setAuditDrawerOpen}
          projectId={projectId}
          url={selectedAuditUrl}
        />
      )}
    </Card>
  );
}
