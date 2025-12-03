import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart3, Target, Activity } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton } from "@/components/export-button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExportColumn } from "@/lib/export-utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";

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
  keyword: string;
  cluster: string | null;
}

interface DailyStats {
  date: string;
  avgPosition: number | null;
  totalKeywords: number;
  top3: number;
  top10: number;
  top20: number;
  top100: number;
  notRanking: number;
}

interface RankingsHistoryResponse {
  history: RankingsHistoryItem[];
  dailyStats: DailyStats[];
  totalRecords: number;
}

const exportColumns: ExportColumn<RankingsHistoryItem>[] = [
  { header: "Date", accessor: "date" },
  { header: "Keyword", accessor: "keyword" },
  { header: "Position", accessor: (row) => row.position ?? "Not ranking" },
  { header: "URL", accessor: "url" },
  { header: "Device", accessor: "device" },
  { header: "Cluster", accessor: "cluster" },
  { header: "SERP Features", accessor: (row) => row.serpFeatures?.join(", ") || "" },
];

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d");
  } catch {
    return dateStr;
  }
}

function PositionTrendChart({ data }: { data: DailyStats[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No ranking data available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    avgPosition: d.avgPosition,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis 
          reversed 
          domain={[1, 'auto']} 
          className="text-xs" 
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          label={{ value: 'Position', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value) => [value !== null ? `Position ${value}` : 'Not ranking', 'Avg Position']}
        />
        <Line
          type="monotone"
          dataKey="avgPosition"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PositionDistributionChart({ data }: { data: DailyStats[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No ranking data available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    "Top 3": d.top3,
    "4-10": d.top10,
    "11-20": d.top20,
    "21-100": d.top100,
    "Not Ranking": d.notRanking,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
        />
        <Legend />
        <Area type="monotone" dataKey="Top 3" stackId="1" stroke="#22c55e" fill="#22c55e" />
        <Area type="monotone" dataKey="4-10" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
        <Area type="monotone" dataKey="11-20" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
        <Area type="monotone" dataKey="21-100" stackId="1" stroke="#ef4444" fill="#ef4444" />
        <Area type="monotone" dataKey="Not Ranking" stackId="1" stroke="#6b7280" fill="#6b7280" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SummaryCards({ dailyStats }: { dailyStats: DailyStats[] }) {
  const latestStats = dailyStats.length > 0 ? dailyStats[dailyStats.length - 1] : null;
  const previousStats = dailyStats.length > 1 ? dailyStats[dailyStats.length - 2] : null;

  const avgPositionChange = latestStats?.avgPosition && previousStats?.avgPosition
    ? Number((previousStats.avgPosition - latestStats.avgPosition).toFixed(1))
    : 0;

  const top10Change = latestStats && previousStats
    ? (latestStats.top3 + latestStats.top10) - (previousStats.top3 + previousStats.top10)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Average Position</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {latestStats?.avgPosition ?? "—"}
          </div>
          {avgPositionChange !== 0 && (
            <div className={`flex items-center text-xs ${avgPositionChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {avgPositionChange > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {avgPositionChange > 0 ? `+${avgPositionChange}` : avgPositionChange} positions
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Top 10 Keywords</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {latestStats ? latestStats.top3 + latestStats.top10 : "—"}
          </div>
          {top10Change !== 0 && (
            <div className={`flex items-center text-xs ${top10Change > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {top10Change > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {top10Change > 0 ? `+${top10Change}` : top10Change} vs yesterday
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Top 3 Keywords</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {latestStats?.top3 ?? "—"}
          </div>
          <p className="text-xs text-muted-foreground">
            {latestStats ? `${((latestStats.top3 / latestStats.totalKeywords) * 100).toFixed(1)}% of tracked` : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Total Tracked</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {latestStats?.totalKeywords ?? "—"}
          </div>
          <p className="text-xs text-muted-foreground">
            {latestStats ? `${latestStats.notRanking} not ranking` : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RankingsTable({ history }: { history: RankingsHistoryItem[] }) {
  const groupedByDate = history.reduce((acc, item) => {
    const date = item.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {} as Record<string, RankingsHistoryItem[]>);

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a)).slice(0, 7);

  const keywordPositions = new Map<string, { keyword: string; positions: Record<string, number | null>; cluster: string | null }>();

  for (const date of dates) {
    for (const item of groupedByDate[date]) {
      const key = item.keyword;
      if (!keywordPositions.has(key)) {
        keywordPositions.set(key, { keyword: item.keyword, positions: {}, cluster: item.cluster });
      }
      keywordPositions.get(key)!.positions[date] = item.position;
    }
  }

  const keywordData = Array.from(keywordPositions.values())
    .map((kw) => {
      const sortedDates = Object.keys(kw.positions).sort((a, b) => b.localeCompare(a));
      const latestPos = kw.positions[sortedDates[0]];
      const prevPos = sortedDates.length > 1 ? kw.positions[sortedDates[1]] : null;
      const change = latestPos !== null && prevPos !== null ? prevPos - latestPos : null;
      return { ...kw, latestPosition: latestPos, change };
    })
    .sort((a, b) => {
      if (a.latestPosition === null) return 1;
      if (b.latestPosition === null) return -1;
      return a.latestPosition - b.latestPosition;
    })
    .slice(0, 50);

  if (keywordData.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No ranking history data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Keyword</TableHead>
            <TableHead>Cluster</TableHead>
            <TableHead className="text-right">Position</TableHead>
            <TableHead className="text-right">Change</TableHead>
            {dates.slice(0, 5).map((date) => (
              <TableHead key={date} className="text-right text-xs">
                {formatDate(date)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {keywordData.map((kw) => (
            <TableRow key={kw.keyword} data-testid={`row-keyword-${kw.keyword}`}>
              <TableCell className="font-medium">{kw.keyword}</TableCell>
              <TableCell>
                {kw.cluster && <Badge variant="outline">{kw.cluster}</Badge>}
              </TableCell>
              <TableCell className="text-right">
                {kw.latestPosition !== null ? (
                  <span className={
                    kw.latestPosition <= 3 ? "text-green-600 font-semibold" :
                    kw.latestPosition <= 10 ? "text-blue-600" :
                    kw.latestPosition <= 20 ? "text-yellow-600" : ""
                  }>
                    {kw.latestPosition}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {kw.change !== null ? (
                  <div className={`flex items-center justify-end gap-1 ${
                    kw.change > 0 ? "text-green-600" : kw.change < 0 ? "text-red-600" : "text-muted-foreground"
                  }`}>
                    {kw.change > 0 ? <TrendingUp className="h-3 w-3" /> : 
                     kw.change < 0 ? <TrendingDown className="h-3 w-3" /> : 
                     <Minus className="h-3 w-3" />}
                    {kw.change > 0 ? `+${kw.change}` : kw.change}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              {dates.slice(0, 5).map((date) => (
                <TableCell key={date} className="text-right text-sm">
                  {kw.positions[date] !== null && kw.positions[date] !== undefined ? (
                    <span className={
                      kw.positions[date]! <= 3 ? "text-green-600" :
                      kw.positions[date]! <= 10 ? "text-blue-600" :
                      kw.positions[date]! <= 20 ? "text-yellow-600" : ""
                    }>
                      {kw.positions[date]}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function RankingsPage({ projectId }: { projectId: string | null }) {
  const { data, isLoading } = useQuery<RankingsHistoryResponse>({
    queryKey: ["/api/project-rankings-history", { projectId }],
    queryFn: async () => {
      if (!projectId) return { history: [], dailyStats: [], totalRecords: 0 };
      const res = await fetch(`/api/project-rankings-history?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch rankings history");
      return res.json();
    },
    enabled: !!projectId,
  });

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view rankings</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const { history = [], dailyStats = [] } = data || {};

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-rankings-title">Historical Rankings</h1>
          <p className="text-muted-foreground">
            Track keyword position changes over time
          </p>
        </div>
        <ExportButton
          data={history}
          columns={exportColumns}
          filename="rankings-history"
          sheetName="Rankings History"
        />
      </div>

      <SummaryCards dailyStats={dailyStats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Average Position Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PositionTrendChart data={dailyStats} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Position Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PositionDistributionChart data={dailyStats} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>Keyword Rankings</CardTitle>
          <Badge variant="secondary">{history.length} records</Badge>
        </CardHeader>
        <CardContent>
          <RankingsTable history={history} />
        </CardContent>
      </Card>
    </div>
  );
}
