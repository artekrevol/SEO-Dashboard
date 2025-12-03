import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Calendar, Plus, X, Award, Sparkles } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface RankingsHistoryItem {
  id: number;
  projectId: string;
  keywordId: number;
  date: string;
  position: number | null;
  url: string | null;
  device: string | null;
  locationId: string | null;
  serpFeatures: string[] | null;
  createdAt: string;
}

interface KeywordHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keywordId: number;
  keywordName: string;
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d");
  } catch {
    return dateStr;
  }
}

function formatDateFull(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

const serpFeatureLabels: Record<string, string> = {
  featured_snippet: "Featured Snippet",
  local_pack: "Local Pack",
  knowledge_panel: "Knowledge Panel",
  video: "Video",
  images: "Images",
  shopping: "Shopping",
  news: "News",
  people_also_ask: "People Also Ask",
  sitelinks: "Sitelinks",
  reviews: "Reviews",
  faq: "FAQ",
  top_stories: "Top Stories",
  twitter: "Twitter",
  carousel: "Carousel",
};

const serpFeatureColors: Record<string, string> = {
  featured_snippet: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  local_pack: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  knowledge_panel: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  video: "bg-red-500/10 text-red-600 dark:text-red-400",
  images: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  shopping: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  news: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  people_also_ask: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  sitelinks: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  reviews: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  faq: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  top_stories: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  twitter: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  carousel: "bg-lime-500/10 text-lime-600 dark:text-lime-400",
};

interface SerpFeatureChange {
  date: string;
  feature: string;
  type: 'gained' | 'lost';
}

export function KeywordHistoryModal({
  open,
  onOpenChange,
  keywordId,
  keywordName,
}: KeywordHistoryModalProps) {
  const { data: history = [], isLoading } = useQuery<RankingsHistoryItem[]>({
    queryKey: ["/api/rankings-history", keywordId],
    queryFn: async () => {
      const res = await fetch(`/api/rankings-history/${keywordId}?limit=90`);
      if (!res.ok) throw new Error("Failed to fetch rankings history");
      return res.json();
    },
    enabled: open && keywordId > 0,
  });

  const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));

  const chartData = sortedHistory.map((item) => ({
    date: formatDate(item.date),
    fullDate: formatDateFull(item.date),
    position: item.position,
  }));

  const latestPosition = sortedHistory.length > 0 
    ? sortedHistory[sortedHistory.length - 1].position 
    : null;
  const previousPosition = sortedHistory.length > 1 
    ? sortedHistory[sortedHistory.length - 2].position 
    : null;
  const positionChange = latestPosition !== null && previousPosition !== null 
    ? previousPosition - latestPosition 
    : null;

  const bestPosition = sortedHistory.reduce((best, item) => {
    if (item.position === null) return best;
    if (best === null) return item.position;
    return Math.min(best, item.position);
  }, null as number | null);

  const worstPosition = sortedHistory.reduce((worst, item) => {
    if (item.position === null) return worst;
    if (worst === null) return item.position;
    return Math.max(worst, item.position);
  }, null as number | null);

  const serpFeatureChanges = useMemo(() => {
    const changes: SerpFeatureChange[] = [];
    for (let i = 1; i < sortedHistory.length; i++) {
      const prevFeatures = new Set(sortedHistory[i - 1].serpFeatures || []);
      const currFeatures = new Set(sortedHistory[i].serpFeatures || []);
      
      currFeatures.forEach((feature) => {
        if (!prevFeatures.has(feature)) {
          changes.push({ date: sortedHistory[i].date, feature, type: 'gained' });
        }
      });
      
      prevFeatures.forEach((feature) => {
        if (!currFeatures.has(feature)) {
          changes.push({ date: sortedHistory[i].date, feature, type: 'lost' });
        }
      });
    }
    return changes.reverse();
  }, [sortedHistory]);

  const currentSerpFeatures = useMemo(() => {
    if (sortedHistory.length === 0) return [];
    return sortedHistory[sortedHistory.length - 1].serpFeatures || [];
  }, [sortedHistory]);

  const allTimeFeatures = useMemo(() => {
    const features = new Set<string>();
    sortedHistory.forEach((item) => {
      (item.serpFeatures || []).forEach((f) => features.add(f));
    });
    return Array.from(features).sort();
  }, [sortedHistory]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Calendar className="h-5 w-5" />
            Position History
          </DialogTitle>
          <DialogDescription className="font-medium text-foreground">
            {keywordName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No historical data available for this keyword
          </div>
        ) : (
          <Tabs defaultValue="position" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="position" data-testid="tab-position-history">
                Position History
              </TabsTrigger>
              <TabsTrigger value="serp" data-testid="tab-serp-features">
                SERP Features
                {serpFeatureChanges.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">
                    {serpFeatureChanges.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="position" className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border bg-muted/30 p-3" data-testid="stat-current-position">
                  <p className="text-xs text-muted-foreground">Current Position</p>
                  <p className="text-2xl font-bold" data-testid="text-current-position">
                    {latestPosition ?? "—"}
                  </p>
                  {positionChange !== null && (
                    <div className={`flex items-center text-xs ${
                      positionChange > 0 ? 'text-green-600' : positionChange < 0 ? 'text-red-600' : 'text-muted-foreground'
                    }`} data-testid="text-position-change">
                      {positionChange > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : 
                       positionChange < 0 ? <TrendingDown className="h-3 w-3 mr-1" /> : 
                       <Minus className="h-3 w-3 mr-1" />}
                      {positionChange > 0 ? `+${positionChange}` : positionChange}
                    </div>
                  )}
                </div>
                <div className="rounded-lg border bg-muted/30 p-3" data-testid="stat-best-position">
                  <p className="text-xs text-muted-foreground">Best Position</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-best-position">
                    {bestPosition ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3" data-testid="stat-worst-position">
                  <p className="text-xs text-muted-foreground">Worst Position</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="text-worst-position">
                    {worstPosition ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3" data-testid="stat-data-points">
                  <p className="text-xs text-muted-foreground">Data Points</p>
                  <p className="text-2xl font-bold" data-testid="text-data-points">
                    {history.length}
                  </p>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      reversed 
                      domain={[1, 'auto']} 
                      className="text-xs" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      label={{ 
                        value: 'Position', 
                        angle: -90, 
                        position: 'insideLeft', 
                        fill: 'hsl(var(--muted-foreground))',
                        style: { textAnchor: 'middle' }
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value) => [
                        value !== null ? `Position ${value}` : 'Not ranking', 
                        ''
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="position"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr>
                      <th className="p-2 text-left font-medium">Date</th>
                      <th className="p-2 text-right font-medium">Position</th>
                      <th className="p-2 text-left font-medium">URL</th>
                      <th className="p-2 text-left font-medium">SERP Features</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sortedHistory].reverse().slice(0, 30).map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2 text-muted-foreground">
                          {formatDateFull(item.date)}
                        </td>
                        <td className="p-2 text-right font-medium">
                          {item.position !== null ? (
                            <span className={
                              item.position <= 3 ? "text-green-600" :
                              item.position <= 10 ? "text-blue-600" :
                              item.position <= 20 ? "text-yellow-600" : ""
                            }>
                              {item.position}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="max-w-[150px] truncate p-2 font-mono text-xs text-muted-foreground">
                          {item.url ? item.url.replace(/^https?:\/\//, '') : '—'}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {(item.serpFeatures || []).slice(0, 3).map((feature) => (
                              <Badge 
                                key={feature} 
                                variant="secondary" 
                                className={cn("text-xs", serpFeatureColors[feature])}
                              >
                                {serpFeatureLabels[feature] || feature}
                              </Badge>
                            ))}
                            {(item.serpFeatures || []).length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{(item.serpFeatures || []).length - 3}
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="serp" className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-3" data-testid="stat-current-serp">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-xs text-muted-foreground">Current Features</p>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-current-serp-count">
                    {currentSerpFeatures.length}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3" data-testid="stat-all-time-serp">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    <p className="text-xs text-muted-foreground">All-Time Features</p>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-all-time-serp-count">
                    {allTimeFeatures.length}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3" data-testid="stat-serp-changes">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <p className="text-xs text-muted-foreground">Recent Changes</p>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-serp-changes-count">
                    {serpFeatureChanges.length}
                  </p>
                </div>
              </div>

              {currentSerpFeatures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Current SERP Features</h4>
                  <div className="flex flex-wrap gap-2" data-testid="current-serp-features">
                    {currentSerpFeatures.map((feature) => (
                      <Badge 
                        key={feature} 
                        className={cn("text-sm", serpFeatureColors[feature])}
                      >
                        {serpFeatureLabels[feature] || feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {serpFeatureChanges.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Feature Change History</h4>
                  <div className="max-h-64 overflow-y-auto rounded-lg border" data-testid="serp-change-history">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                        <tr>
                          <th className="p-2 text-left font-medium">Date</th>
                          <th className="p-2 text-left font-medium">Change</th>
                          <th className="p-2 text-left font-medium">Feature</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serpFeatureChanges.map((change, idx) => (
                          <tr 
                            key={`${change.date}-${change.feature}-${idx}`} 
                            className="border-t"
                            data-testid={`row-serp-change-${idx}`}
                          >
                            <td className="p-2 text-muted-foreground" data-testid={`text-serp-change-date-${idx}`}>
                              {formatDateFull(change.date)}
                            </td>
                            <td className="p-2" data-testid={`text-serp-change-type-${idx}`}>
                              {change.type === 'gained' ? (
                                <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
                                  <Plus className="mr-1 h-3 w-3" />
                                  Gained
                                </Badge>
                              ) : (
                                <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
                                  <X className="mr-1 h-3 w-3" />
                                  Lost
                                </Badge>
                              )}
                            </td>
                            <td className="p-2" data-testid={`text-serp-feature-${idx}`}>
                              <Badge className={cn("text-sm", serpFeatureColors[change.feature])}>
                                {serpFeatureLabels[change.feature] || change.feature}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border text-muted-foreground">
                  No SERP feature changes detected in the tracked period
                </div>
              )}

              {allTimeFeatures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">All-Time Features Observed</h4>
                  <div className="flex flex-wrap gap-2" data-testid="all-time-serp-features">
                    {allTimeFeatures.map((feature) => (
                      <Badge 
                        key={feature}
                        variant="outline"
                        className={cn(
                          "text-sm",
                          currentSerpFeatures.includes(feature) 
                            ? serpFeatureColors[feature] 
                            : "opacity-50"
                        )}
                      >
                        {serpFeatureLabels[feature] || feature}
                        {!currentSerpFeatures.includes(feature) && (
                          <span className="ml-1 text-xs">(lost)</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
