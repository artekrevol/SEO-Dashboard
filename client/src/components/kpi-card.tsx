import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: Array<{ value: number }>;
  status?: "healthy" | "at_risk" | "declining" | "neutral";
  suffix?: string;
  testId?: string;
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel,
  trend,
  status = "neutral",
  suffix,
  testId,
}: KpiCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const isNeutral = !change || change === 0;

  const getTrendColor = () => {
    if (status === "healthy" || isPositive) return "hsl(var(--chart-4))";
    if (status === "declining" || isNegative) return "hsl(var(--destructive))";
    if (status === "at_risk") return "hsl(var(--chart-5))";
    return "hsl(var(--muted-foreground))";
  };

  const getStatusBadge = () => {
    if (status === "healthy") {
      return (
        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
          Healthy
        </Badge>
      );
    }
    if (status === "at_risk") {
      return (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">
          At Risk
        </Badge>
      );
    }
    if (status === "declining") {
      return (
        <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400 border-0">
          Declining
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card className="hover-elevate" data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight" data-testid={`${testId}-value`}>
                {value}
              </span>
              {suffix && (
                <span className="text-sm font-medium text-muted-foreground">
                  {suffix}
                </span>
              )}
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {(change !== undefined || changeLabel) && (
          <div className="mt-3 flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                isPositive && "text-emerald-600 dark:text-emerald-400",
                isNegative && "text-red-600 dark:text-red-400",
                isNeutral && "text-muted-foreground"
              )}
            >
              {isPositive && <ArrowUp className="h-3 w-3" />}
              {isNegative && <ArrowDown className="h-3 w-3" />}
              {isNeutral && <Minus className="h-3 w-3" />}
              <span>
                {isPositive && "+"}
                {change !== undefined ? `${change}%` : "0%"}
              </span>
            </div>
            {changeLabel && (
              <span className="text-xs text-muted-foreground">{changeLabel}</span>
            )}
          </div>
        )}

        {trend && trend.length > 0 && (
          <div className="mt-4 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={getTrendColor()} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={getTrendColor()} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={getTrendColor()}
                  strokeWidth={2}
                  fill={`url(#gradient-${title})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
