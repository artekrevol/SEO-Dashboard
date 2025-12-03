import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
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
          <div className="space-y-6">
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
                      <td className="max-w-[200px] truncate p-2 font-mono text-xs text-muted-foreground">
                        {item.url ? item.url.replace(/^https?:\/\//, '') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
