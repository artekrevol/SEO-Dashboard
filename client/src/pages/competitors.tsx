import { useQuery } from "@tanstack/react-query";
import { CompetitorsTable } from "@/components/competitors-table";
import { KpiCard } from "@/components/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Target, Shield, TrendingUp } from "lucide-react";

interface CompetitorsPageProps {
  projectId: string | null;
}

export function CompetitorsPage({ projectId }: CompetitorsPageProps) {
  const { data: competitors, isLoading } = useQuery({
    queryKey: ["/api/dashboard/competitors", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/competitors?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch competitors");
      return res.json();
    },
    enabled: !!projectId,
  });

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Project Selected</h2>
          <p className="mt-2 text-muted-foreground">
            Select or create a project to view competitor analysis.
          </p>
        </div>
      </div>
    );
  }

  const items = competitors?.items || [];

  const totalSharedKeywords = items.reduce((sum: number, c: any) => sum + (c.sharedKeywords || 0), 0);
  const totalAboveUs = items.reduce((sum: number, c: any) => sum + (c.aboveUsKeywords || 0), 0);
  const avgPressure = items.length > 0
    ? items.reduce((sum: number, c: any) => sum + (c.pressureIndex || 0), 0) / items.length
    : 0;
  const highPressureCompetitors = items.filter((c: any) => c.pressureIndex >= 60).length;
  const avgTheirPosition = items.length > 0
    ? items.reduce((sum: number, c: any) => sum + (c.avgTheirPosition || 0), 0) / items.length
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-competitors-title">
          Competitor Analysis
        </h1>
        <p className="text-muted-foreground">
          Monitor competitive pressure and keyword overlap with competitors.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Competitors Tracked"
          value={items.length}
          testId="kpi-competitors-count"
        />
        <KpiCard
          title="Shared Keywords"
          value={totalSharedKeywords.toLocaleString()}
          testId="kpi-shared-keywords"
        />
        <KpiCard
          title="Keywords Above Us"
          value={totalAboveUs.toLocaleString()}
          status={totalAboveUs > 50 ? "declining" : totalAboveUs > 20 ? "at_risk" : "healthy"}
          testId="kpi-keywords-above-us"
        />
        <KpiCard
          title="Avg Pressure Index"
          value={avgPressure.toFixed(1)}
          suffix="/100"
          status={avgPressure >= 60 ? "declining" : avgPressure >= 40 ? "at_risk" : "healthy"}
          testId="kpi-avg-pressure"
        />
      </div>

      <CompetitorsTable data={items} isLoading={isLoading} projectId={projectId} />
    </div>
  );
}
