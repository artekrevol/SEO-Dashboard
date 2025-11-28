import { useQuery } from "@tanstack/react-query";
import { KeywordsTable } from "@/components/keywords-table";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Search, TrendingUp, Target, BarChart3 } from "lucide-react";

interface KeywordsPageProps {
  projectId: string | null;
}

const INTENT_COLORS = {
  informational: "hsl(var(--chart-1))",
  commercial: "hsl(var(--chart-3))",
  transactional: "hsl(var(--chart-4))",
  navigational: "hsl(var(--chart-5))",
};

export function KeywordsPage({ projectId }: KeywordsPageProps) {
  const { data: keywords, isLoading } = useQuery({
    queryKey: ["/api/dashboard/keywords", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/keywords?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch keywords");
      return res.json();
    },
    enabled: !!projectId,
  });

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Project Selected</h2>
          <p className="mt-2 text-muted-foreground">
            Select or create a project to view keyword analytics.
          </p>
        </div>
      </div>
    );
  }

  const keywordItems = keywords?.items || [];

  const intentDistribution = Object.entries(
    keywordItems.reduce((acc: Record<string, number>, k: any) => {
      acc[k.intent] = (acc[k.intent] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const positionBuckets = [
    { name: "1-3", count: keywordItems.filter((k: any) => k.currentPosition >= 1 && k.currentPosition <= 3).length },
    { name: "4-10", count: keywordItems.filter((k: any) => k.currentPosition >= 4 && k.currentPosition <= 10).length },
    { name: "11-20", count: keywordItems.filter((k: any) => k.currentPosition >= 11 && k.currentPosition <= 20).length },
    { name: "21-50", count: keywordItems.filter((k: any) => k.currentPosition >= 21 && k.currentPosition <= 50).length },
    { name: "51+", count: keywordItems.filter((k: any) => k.currentPosition > 50).length },
  ];

  const avgPosition = keywordItems.length > 0
    ? keywordItems.reduce((sum: number, k: any) => sum + k.currentPosition, 0) / keywordItems.length
    : 0;

  const avgOpportunity = keywordItems.length > 0
    ? keywordItems.reduce((sum: number, k: any) => sum + k.opportunityScore, 0) / keywordItems.length
    : 0;

  const highOpportunityCount = keywordItems.filter((k: any) => k.opportunityScore >= 60).length;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-keywords-title">
          Keyword Analytics
        </h1>
        <p className="text-muted-foreground">
          Track keyword rankings, opportunities, and search intent.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Keywords"
          value={keywordItems.length}
          testId="kpi-total-keywords"
        />
        <KpiCard
          title="Avg. Position"
          value={avgPosition.toFixed(1)}
          testId="kpi-keywords-avg-position"
        />
        <KpiCard
          title="Avg. Opportunity"
          value={avgOpportunity.toFixed(0)}
          suffix="/100"
          testId="kpi-avg-opportunity"
        />
        <KpiCard
          title="High Opportunity"
          value={highOpportunityCount}
          suffix={`/ ${keywordItems.length}`}
          status={highOpportunityCount > 5 ? "healthy" : "at_risk"}
          testId="kpi-high-opportunity"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="position-distribution-chart">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              Position Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={positionBuckets} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--chart-1))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="intent-distribution-chart">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Target className="h-5 w-5 text-muted-foreground" />
              Search Intent Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={intentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {intentDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={INTENT_COLORS[entry.name as keyof typeof INTENT_COLORS] || "hsl(var(--muted))"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <KeywordsTable data={keywordItems} isLoading={isLoading} />
    </div>
  );
}
