import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, ArrowDown, Minus, Search, ExternalLink, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeywordData {
  keywordId: number;
  keyword: string;
  cluster?: string;
  currentPosition: number;
  positionDelta: number;
  searchVolume: number;
  difficulty: number;
  intent: string;
  opportunityScore: number;
  serpFeatures: string[];
  url: string;
}

interface KeywordsTableProps {
  data: KeywordData[];
  isLoading?: boolean;
}

const intentColors: Record<string, string> = {
  informational: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  commercial: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  transactional: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  navigational: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const serpFeatureLabels: Record<string, string> = {
  featured_snippet: "Featured",
  local_pack: "Local",
  knowledge_panel: "Knowledge",
  video: "Video",
  images: "Images",
  shopping: "Shopping",
  news: "News",
  people_also_ask: "PAA",
  sitelinks: "Sitelinks",
};

export function KeywordsTable({ data, isLoading }: KeywordsTableProps) {
  const [search, setSearch] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("opportunity");

  const filteredData = data
    .filter((item) => {
      const matchesSearch = item.keyword.toLowerCase().includes(search.toLowerCase());
      const matchesIntent = intentFilter === "all" || item.intent === intentFilter;
      return matchesSearch && matchesIntent;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "opportunity":
          return b.opportunityScore - a.opportunityScore;
        case "position":
          return a.currentPosition - b.currentPosition;
        case "volume":
          return b.searchVolume - a.searchVolume;
        case "difficulty":
          return a.difficulty - b.difficulty;
        default:
          return 0;
      }
    });

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty < 30) return "text-emerald-600 dark:text-emerald-400";
    if (difficulty < 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getOpportunityColor = (score: number) => {
    if (score >= 70) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    if (score >= 40) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    return "bg-muted text-muted-foreground";
  };

  if (isLoading) {
    return (
      <Card data-testid="keywords-table">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg font-medium">Keyword Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-8 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="keywords-table">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4">
        <CardTitle className="text-lg font-medium">Keyword Performance</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9"
              data-testid="input-keyword-search"
            />
          </div>
          <Select value={intentFilter} onValueChange={setIntentFilter}>
            <SelectTrigger className="w-40" data-testid="select-intent-filter">
              <SelectValue placeholder="Intent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Intents</SelectItem>
              <SelectItem value="informational">Informational</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="transactional">Transactional</SelectItem>
              <SelectItem value="navigational">Navigational</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40" data-testid="select-sort">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="opportunity">Opportunity</SelectItem>
              <SelectItem value="position">Position</SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
              <SelectItem value="difficulty">Difficulty</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Keyword</TableHead>
                <TableHead className="text-center">Position</TableHead>
                <TableHead className="text-center">Change</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-center">Difficulty</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead className="text-center">Opportunity</TableHead>
                <TableHead>SERP Features</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8" />
                      <p>No keywords found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow
                    key={item.keywordId}
                    className="hover-elevate"
                    data-testid={`row-keyword-${item.keywordId}`}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{item.keyword}</span>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <span className="max-w-[200px] truncate font-mono">
                              {item.url.replace(/^https?:\/\//, "")}
                            </span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-lg font-semibold">{item.currentPosition}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1 text-sm font-medium",
                          item.positionDelta > 0 && "text-emerald-600 dark:text-emerald-400",
                          item.positionDelta < 0 && "text-red-600 dark:text-red-400",
                          item.positionDelta === 0 && "text-muted-foreground"
                        )}
                      >
                        {item.positionDelta > 0 && <ArrowUp className="h-3 w-3" />}
                        {item.positionDelta < 0 && <ArrowDown className="h-3 w-3" />}
                        {item.positionDelta === 0 && <Minus className="h-3 w-3" />}
                        <span>{Math.abs(item.positionDelta)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.searchVolume.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("font-medium", getDifficultyColor(item.difficulty))}>
                        {item.difficulty}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn("border-0 capitalize", intentColors[item.intent])}
                      >
                        {item.intent}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={cn("border-0", getOpportunityColor(item.opportunityScore))}
                      >
                        <TrendingUp className="mr-1 h-3 w-3" />
                        {item.opportunityScore.toFixed(0)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.serpFeatures?.slice(0, 3).map((feature) => (
                          <Badge
                            key={feature}
                            variant="outline"
                            className="text-xs"
                          >
                            {serpFeatureLabels[feature] || feature}
                          </Badge>
                        ))}
                        {item.serpFeatures && item.serpFeatures.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{item.serpFeatures.length - 3}
                          </Badge>
                        )}
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
