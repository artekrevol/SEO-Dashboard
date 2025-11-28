import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { format, subDays, parseISO, differenceInDays } from "date-fns";
import { TrendingUp, TrendingDown, Minus, ArrowRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthDataPoint {
  date: string;
  seoHealthScore: number;
  authorityScore?: number;
  techScore?: number;
  contentScore?: number;
}

interface SeoHealthChartProps {
  data: HealthDataPoint[];
  showBreakdown?: boolean;
}

type DateRange = "7d" | "14d" | "30d" | "90d" | "all";

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "14d", label: "14D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "All" },
];

function calculateTrendLine(data: { date: string; seoHealthScore: number }[]): { slope: number; forecast: number[] } {
  if (data.length < 2) return { slope: 0, forecast: [] };
  
  const n = data.length;
  const xSum = (n * (n - 1)) / 2;
  const x2Sum = (n * (n - 1) * (2 * n - 1)) / 6;
  const ySum = data.reduce((sum, d) => sum + d.seoHealthScore, 0);
  const xySum = data.reduce((sum, d, i) => sum + i * d.seoHealthScore, 0);
  
  const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
  const intercept = (ySum - slope * xSum) / n;
  
  const forecastDays = Math.min(3, Math.ceil(n / 4));
  const forecast = [];
  for (let i = 0; i < forecastDays; i++) {
    const forecastValue = intercept + slope * (n + i);
    forecast.push(Math.max(0, Math.min(100, forecastValue)));
  }
  
  return { slope, forecast };
}

function calculateMovingAverage(data: number[], window: number): number[] {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
  }
  return result as number[];
}

export function SeoHealthChart({ data, showBreakdown = false }: SeoHealthChartProps) {
  const [dateRange, setDateRange] = useState<DateRange>("14d");
  const [showForecast, setShowForecast] = useState(true);
  const [showComparison, setShowComparison] = useState(true);

  const filteredData = useMemo(() => {
    if (!data.length) return [];
    
    const sortedData = [...data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    if (dateRange === "all") return sortedData;
    
    const days = parseInt(dateRange.replace("d", ""));
    const latestDate = new Date(sortedData[sortedData.length - 1].date);
    const cutoffDate = subDays(latestDate, days);
    
    return sortedData.filter((d) => new Date(d.date) >= cutoffDate);
  }, [data, dateRange]);

  const chartData = useMemo(() => {
    if (!filteredData.length) return [];
    
    const healthScores = filteredData.map((d) => d.seoHealthScore);
    const movingAvg = calculateMovingAverage(healthScores, 3);
    
    return filteredData.map((d, i) => ({
      ...d,
      movingAvg: movingAvg[i],
    }));
  }, [filteredData]);

  const { trendInfo, forecastPoints } = useMemo(() => {
    if (!filteredData.length) return { trendInfo: null, forecastPoints: [] };
    
    const { slope, forecast } = calculateTrendLine(filteredData);
    
    const lastDate = new Date(filteredData[filteredData.length - 1].date);
    const points = forecast.map((value, i) => {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + i + 1);
      return {
        date: format(date, "yyyy-MM-dd"),
        forecast: value,
        isForecast: true,
      };
    });
    
    const trend = slope > 0.5 ? "up" : slope < -0.5 ? "down" : "stable";
    const percentChange = filteredData.length >= 2
      ? ((filteredData[filteredData.length - 1].seoHealthScore - filteredData[0].seoHealthScore) / 
         filteredData[0].seoHealthScore * 100)
      : 0;
    
    return {
      trendInfo: { trend, slope, percentChange },
      forecastPoints: points,
    };
  }, [filteredData]);

  const periodComparison = useMemo(() => {
    if (!showComparison || filteredData.length < 2) return null;
    
    const halfPoint = Math.floor(filteredData.length / 2);
    if (halfPoint < 1) return null;
    
    const currentPeriod = filteredData.slice(halfPoint);
    const prevPeriod = filteredData.slice(0, halfPoint);
    
    if (!currentPeriod.length || !prevPeriod.length) return null;
    
    const currentAvg = currentPeriod.reduce((sum, d) => sum + d.seoHealthScore, 0) / currentPeriod.length;
    const prevAvg = prevPeriod.reduce((sum, d) => sum + d.seoHealthScore, 0) / prevPeriod.length;
    const change = prevAvg !== 0 ? ((currentAvg - prevAvg) / prevAvg) * 100 : 0;
    
    return {
      currentAvg,
      prevAvg,
      change,
      direction: change > 0 ? "up" : change < 0 ? "down" : "stable",
    };
  }, [filteredData, showComparison]);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d");
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isForecast = payload[0]?.payload?.isForecast;
      return (
        <div className="rounded-lg border bg-popover px-4 py-3 shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-medium text-popover-foreground">
              {formatDate(label)}
            </p>
            {isForecast && (
              <Badge variant="secondary" className="text-xs">Forecast</Badge>
            )}
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">{Number(entry.value).toFixed(1)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const combinedData = useMemo(() => {
    if (!showForecast || !forecastPoints.length) return chartData;
    
    const lastDataPoint = chartData[chartData.length - 1];
    const forecastWithConnection = forecastPoints.map((f, i) => ({
      ...f,
      seoHealthScore: i === 0 ? lastDataPoint?.seoHealthScore : undefined,
    }));
    
    return [...chartData, ...forecastWithConnection];
  }, [chartData, forecastPoints, showForecast]);

  return (
    <Card data-testid="seo-health-chart">
      <CardHeader className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg font-medium">SEO Health Over Time</CardTitle>
          {trendInfo && (
            <Badge
              variant="secondary"
              className={cn(
                "gap-1",
                trendInfo.trend === "up" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                trendInfo.trend === "down" && "bg-red-500/10 text-red-600 dark:text-red-400",
                trendInfo.trend === "stable" && "bg-muted text-muted-foreground"
              )}
              data-testid="badge-trend"
            >
              {trendInfo.trend === "up" && <TrendingUp className="h-3 w-3" />}
              {trendInfo.trend === "down" && <TrendingDown className="h-3 w-3" />}
              {trendInfo.trend === "stable" && <Minus className="h-3 w-3" />}
              {trendInfo.percentChange >= 0 ? "+" : ""}
              {trendInfo.percentChange.toFixed(1)}%
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-1" data-testid="date-range-selector">
            {dateRangeOptions.map((option) => (
              <Button
                key={option.value}
                variant={dateRange === option.value ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setDateRange(option.value)}
                data-testid={`button-range-${option.value}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Button
            variant={showForecast ? "default" : "outline"}
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setShowForecast(!showForecast)}
            data-testid="button-toggle-forecast"
          >
            <ArrowRight className="h-3 w-3" />
            Forecast
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {periodComparison && (
          <div className="mb-4 flex items-center justify-between rounded-lg border p-3 bg-muted/30" data-testid="period-comparison">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Previous Period</span>
                <span className="text-lg font-semibold">{periodComparison.prevAvg.toFixed(1)}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Current Period</span>
                <span className="text-lg font-semibold">{periodComparison.currentAvg.toFixed(1)}</span>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "gap-1",
                periodComparison.direction === "up" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                periodComparison.direction === "down" && "bg-red-500/10 text-red-600 dark:text-red-400",
                periodComparison.direction === "stable" && "bg-muted text-muted-foreground"
              )}
              data-testid="badge-period-change"
            >
              {periodComparison.direction === "up" && <TrendingUp className="h-3 w-3" />}
              {periodComparison.direction === "down" && <TrendingDown className="h-3 w-3" />}
              {periodComparison.direction === "stable" && <Minus className="h-3 w-3" />}
              {periodComparison.change >= 0 ? "+" : ""}
              {periodComparison.change.toFixed(1)}%
            </Badge>
          </div>
        )}
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={combinedData}
              margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
            >
              <defs>
                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={70}
                stroke="hsl(var(--chart-4))"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
                label={{
                  value: "Target",
                  position: "insideTopRight",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="seoHealthScore"
                name="SEO Health"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
                connectNulls={false}
              />
              {showForecast && (
                <>
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    name="Forecast"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="url(#forecastGradient)"
                    activeDot={{ r: 4, strokeWidth: 2 }}
                  />
                </>
              )}
              <Line
                type="monotone"
                dataKey="movingAvg"
                name="3-Day Avg"
                stroke="hsl(var(--chart-2))"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                strokeOpacity={0.6}
              />
              {showBreakdown && (
                <>
                  <Line
                    type="monotone"
                    dataKey="authorityScore"
                    name="Authority"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="techScore"
                    name="Technical"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="contentScore"
                    name="Content"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground" data-testid="chart-legend">
          <div className="flex items-center gap-2" data-testid="legend-seo-health">
            <div className="h-0.5 w-4 bg-chart-1" />
            <span>SEO Health</span>
          </div>
          <div className="flex items-center gap-2" data-testid="legend-moving-avg">
            <div className="h-0.5 w-4 bg-chart-2" style={{ backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--chart-2)) 0 2px, transparent 2px 4px)" }} />
            <span>3-Day Avg</span>
          </div>
          {showForecast && (
            <div className="flex items-center gap-2" data-testid="legend-forecast">
              <div className="h-0.5 w-4" style={{ backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--chart-1)) 0 3px, transparent 3px 6px)" }} />
              <span>Forecast</span>
            </div>
          )}
          <div className="flex items-center gap-2" data-testid="legend-target">
            <div className="h-0.5 w-4" style={{ backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--chart-4)) 0 3px, transparent 3px 6px)" }} />
            <span>Target (70)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
