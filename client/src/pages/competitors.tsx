import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CompetitorsTable } from "@/components/competitors-table";
import { CompetitorSerpVisibilityTable } from "@/components/competitor-serp-visibility-table";
import { KpiCard } from "@/components/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Target, Shield, TrendingUp, Bot, Sparkles, MapPin } from "lucide-react";

type SortDirection = "asc" | "desc";

interface CompetitorsPageProps {
  projectId: string | null;
}

interface SerpVisibilityCompetitor {
  competitorDomain: string;
  totalMentions: number;
  aiOverviewMentions: number;
  featuredSnippetMentions: number;
  localPackMentions: number;
  organicMentions: number;
}

export function CompetitorsPage({ projectId }: CompetitorsPageProps) {
  const [sharedSortField, setSharedSortField] = useState<string>("sharedKeywords");
  const [sharedSortDirection, setSharedSortDirection] = useState<SortDirection>("desc");
  const [serpSortField, setSerpSortField] = useState<string>("serpVisibilityTotal");
  const [serpSortDirection, setSerpSortDirection] = useState<SortDirection>("desc");
  
  const { data: competitors, isLoading } = useQuery({
    queryKey: ["/api/dashboard/competitors", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/competitors?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch competitors");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: serpVisibilityData, isLoading: serpLoading } = useQuery<{ competitors: SerpVisibilityCompetitor[] }>({
    queryKey: ["/api/projects", projectId, "competitor-visibility"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/competitor-visibility`);
      if (!res.ok) throw new Error("Failed to fetch SERP visibility");
      return res.json();
    },
    enabled: !!projectId,
  });

  const serpVisibilityItems = useMemo(() => {
    if (!serpVisibilityData?.competitors) return [];
    return serpVisibilityData.competitors.map((c) => ({
      competitorDomain: c.competitorDomain,
      sharedKeywords: 0,
      aiOverviewCount: c.aiOverviewMentions,
      featuredSnippetCount: c.featuredSnippetMentions,
      localPackCount: c.localPackMentions,
      organicTop10Count: c.organicMentions,
      serpVisibilityTotal: c.totalMentions,
    }));
  }, [serpVisibilityData]);

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
    <div className="space-y-6 p-6 w-full max-w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-competitors-title">
          Competitor Analysis
        </h1>
        <p className="text-muted-foreground">
          Monitor competitive pressure and keyword overlap with competitors.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-competitor-overview">
            <Target className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="serp-visibility" data-testid="tab-serp-visibility">
            <Bot className="mr-2 h-4 w-4" />
            SERP Visibility
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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

          <CompetitorsTable 
            data={items} 
            isLoading={isLoading} 
            projectId={projectId}
            sortField={sharedSortField}
            sortDirection={sharedSortDirection}
            onSortChange={(field, direction) => {
              setSharedSortField(field);
              setSharedSortDirection(direction);
            }}
          />
        </TabsContent>

        <TabsContent value="serp-visibility">
          <CompetitorSerpVisibilityTable 
            data={serpVisibilityItems} 
            isLoading={serpLoading}
            projectId={projectId}
            sortField={serpSortField}
            sortDirection={serpSortDirection}
            onSortChange={(field: string, direction: SortDirection) => {
              setSerpSortField(field);
              setSerpSortDirection(direction);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
