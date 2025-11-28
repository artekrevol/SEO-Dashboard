import { useQuery } from "@tanstack/react-query";
import { PagesTable } from "@/components/pages-table";
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
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { FileText, Link2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface PagesPageProps {
  projectId: string | null;
}

export function PagesPage({ projectId }: PagesPageProps) {
  const { data: pages, isLoading } = useQuery({
    queryKey: ["/api/dashboard/pages", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/pages?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch pages");
      return res.json();
    },
    enabled: !!projectId,
  });

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Project Selected</h2>
          <p className="mt-2 text-muted-foreground">
            Select or create a project to view page analytics.
          </p>
        </div>
      </div>
    );
  }

  const pageItems = pages?.items || [];

  const totalBacklinks = pageItems.reduce((sum: number, p: any) => sum + (p.backlinksCount || 0), 0);
  const totalReferringDomains = pageItems.reduce((sum: number, p: any) => sum + (p.referringDomains || 0), 0);
  const indexablePages = pageItems.filter((p: any) => p.isIndexable).length;
  const pagesWithSchema = pageItems.filter((p: any) => p.hasSchema).length;

  const avgTechRisk = pageItems.length > 0
    ? pageItems.reduce((sum: number, p: any) => sum + (p.techRiskScore || 0), 0) / pageItems.length
    : 0;

  const riskDistribution = [
    { name: "Low Risk", count: pageItems.filter((p: any) => (p.techRiskScore || 0) < 30).length, fill: "hsl(var(--chart-4))" },
    { name: "Medium Risk", count: pageItems.filter((p: any) => (p.techRiskScore || 0) >= 30 && (p.techRiskScore || 0) < 60).length, fill: "hsl(var(--chart-5))" },
    { name: "High Risk", count: pageItems.filter((p: any) => (p.techRiskScore || 0) >= 60).length, fill: "hsl(var(--destructive))" },
  ];

  const scatterData = pageItems.map((p: any) => ({
    x: p.techRiskScore || 0,
    y: p.contentGapScore || 0,
    z: p.keywordsInTop10 || 1,
    url: p.url,
  }));

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
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-pages-title">
          Page Analytics
        </h1>
        <p className="text-muted-foreground">
          Analyze page performance, backlinks, and technical health.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Pages"
          value={pageItems.length}
          testId="kpi-total-pages"
        />
        <KpiCard
          title="Total Backlinks"
          value={totalBacklinks.toLocaleString()}
          suffix={`(${totalReferringDomains} domains)`}
          testId="kpi-total-backlinks"
        />
        <KpiCard
          title="Indexable Pages"
          value={indexablePages}
          suffix={`/ ${pageItems.length}`}
          status={indexablePages === pageItems.length ? "healthy" : "at_risk"}
          testId="kpi-indexable-pages"
        />
        <KpiCard
          title="Pages with Schema"
          value={pagesWithSchema}
          suffix={`/ ${pageItems.length}`}
          status={pagesWithSchema > pageItems.length * 0.5 ? "healthy" : "at_risk"}
          testId="kpi-pages-schema"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="risk-distribution-chart">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              Technical Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskDistribution} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={30}>
                    {riskDistribution.map((entry, index) => (
                      <Bar key={index} dataKey="count" fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="risk-opportunity-matrix">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              Risk vs Content Gap Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Tech Risk"
                    domain={[0, 100]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: "Tech Risk Score",
                      position: "insideBottom",
                      offset: -10,
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Content Gap"
                    domain={[0, 100]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                    label={{
                      value: "Content Gap",
                      angle: -90,
                      position: "insideLeft",
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />
                  <ZAxis type="number" dataKey="z" range={[20, 200]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: any, name: string) => [value, name]}
                  />
                  <Scatter
                    name="Pages"
                    data={scatterData}
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <PagesTable data={pageItems} isLoading={isLoading} />
    </div>
  );
}
