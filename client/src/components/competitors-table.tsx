import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Search, ExternalLink, TrendingUp, Shield, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompetitorData {
  competitorDomain: string;
  sharedKeywords: number;
  aboveUsKeywords: number;
  authorityScore: number;
  avgPosition: number;
  pressureIndex: number;
}

interface CompetitorsTableProps {
  data: CompetitorData[];
  isLoading?: boolean;
}

export function CompetitorsTable({ data, isLoading }: CompetitorsTableProps) {
  const [search, setSearch] = useState("");

  const filteredData = data.filter((item) =>
    item.competitorDomain.toLowerCase().includes(search.toLowerCase())
  );

  const sortedData = [...filteredData].sort((a, b) => b.pressureIndex - a.pressureIndex);

  const getPressureColor = (index: number) => {
    if (index >= 70) return "hsl(var(--destructive))";
    if (index >= 40) return "hsl(var(--chart-5))";
    return "hsl(var(--chart-4))";
  };

  const getPressureLabel = (index: number) => {
    if (index >= 70) return "High";
    if (index >= 40) return "Medium";
    return "Low";
  };

  const getPressureBadgeClass = (index: number) => {
    if (index >= 70) return "bg-red-500/10 text-red-600 dark:text-red-400";
    if (index >= 40) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  };

  const chartData = sortedData.slice(0, 10).map((item) => ({
    domain: item.competitorDomain.replace(/^www\./, "").split(".")[0],
    pressure: item.pressureIndex,
    fullDomain: item.competitorDomain,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-popover px-4 py-3 shadow-md">
          <p className="mb-1 font-medium text-popover-foreground">{data.fullDomain}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Pressure Index:</span>
            <span className="font-semibold">{data.pressure.toFixed(1)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card data-testid="competitors-table">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg font-medium">Competitor Analysis</CardTitle>
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
    <div className="space-y-6">
      <Card data-testid="competitors-chart">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Competitive Pressure Index</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="domain"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pressure" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getPressureColor(entry.pressure)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="competitors-table">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg font-medium">Competitor Details</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search competitors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9"
              data-testid="input-competitor-search"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Competitor</TableHead>
                  <TableHead className="text-center">Shared Keywords</TableHead>
                  <TableHead className="text-center">Above Us</TableHead>
                  <TableHead className="text-center">Authority</TableHead>
                  <TableHead className="text-center">Avg Position</TableHead>
                  <TableHead className="w-[200px]">Pressure Index</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="h-8 w-8" />
                        <p>No competitors found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((item, index) => (
                    <TableRow
                      key={item.competitorDomain}
                      className="hover-elevate"
                      data-testid={`row-competitor-${index}`}
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
                        <div className="flex items-center justify-center gap-1">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono">{item.sharedKeywords}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-mono border-0",
                            item.aboveUsKeywords > 0
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {item.aboveUsKeywords}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono">{Number(item.authorityScore).toFixed(0)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-lg">
                          {Number(item.avgPosition).toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge
                              variant="secondary"
                              className={cn("border-0", getPressureBadgeClass(item.pressureIndex))}
                            >
                              <TrendingUp className="mr-1 h-3 w-3" />
                              {getPressureLabel(item.pressureIndex)}
                            </Badge>
                            <span className="font-mono text-sm">
                              {Number(item.pressureIndex).toFixed(1)}
                            </span>
                          </div>
                          <Progress
                            value={item.pressureIndex}
                            className="h-2"
                            indicatorClassName={
                              item.pressureIndex >= 70
                                ? "bg-red-500"
                                : item.pressureIndex >= 40
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }
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
    </div>
  );
}
