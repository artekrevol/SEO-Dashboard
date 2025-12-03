import { useState } from "react";
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
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link2,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/export-button";
import type { ExportColumn } from "@/lib/export-utils";

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
}

interface PagesTableProps {
  data: PageData[];
  isLoading?: boolean;
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
  { header: "Tech Risk Score", accessor: "techRiskScore" },
  { header: "Content Gap Score", accessor: "contentGapScore" },
];

export function PagesTable({ data, isLoading }: PagesTableProps) {
  const [search, setSearch] = useState("");

  const filteredData = data.filter((item) =>
    item.url.toLowerCase().includes(search.toLowerCase())
  );

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
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4">
        <CardTitle className="text-lg font-medium">Page Analytics</CardTitle>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search URLs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80 pl-9"
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
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[350px]">URL</TableHead>
                <TableHead className="text-center">Avg Position</TableHead>
                <TableHead className="text-center">Top 10</TableHead>
                <TableHead className="text-center">Backlinks</TableHead>
                <TableHead className="text-center">Link Velocity</TableHead>
                <TableHead className="text-center">Health</TableHead>
                <TableHead className="w-[150px]">Tech Risk</TableHead>
                <TableHead className="w-[150px]">Content Gap</TableHead>
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
                          <div className="flex items-center gap-1">
                            <Link2 className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-sm">{item.backlinksCount.toLocaleString()}</span>
                          </div>
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
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {getRiskLabel(item.techRiskScore)}
                          </span>
                          <span className="font-mono">{item.techRiskScore}%</span>
                        </div>
                        <Progress
                          value={item.techRiskScore}
                          className="h-2"
                          indicatorClassName={getRiskColor(item.techRiskScore)}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
