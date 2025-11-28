import { useQuery, useMutation } from "@tanstack/react-query";
import { RecommendationsList } from "@/components/recommendations-list";
import { KpiCard } from "@/components/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RecommendationsPageProps {
  projectId: string | null;
}

export function RecommendationsPage({ projectId }: RecommendationsPageProps) {
  const { toast } = useToast();

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ["/api/dashboard/recommendations", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/recommendations?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
    enabled: !!projectId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest("PATCH", `/api/dashboard/recommendations/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recommendations", { projectId }] });
      toast({
        title: "Status updated",
        description: "Recommendation status has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update recommendation status.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (id: number, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Lightbulb className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Project Selected</h2>
          <p className="mt-2 text-muted-foreground">
            Select or create a project to view recommendations.
          </p>
        </div>
      </div>
    );
  }

  const items = recommendations?.items || [];
  const openCount = items.filter((r: any) => r.status === "open").length;
  const inProgressCount = items.filter((r: any) => r.status === "in_progress").length;
  const doneCount = items.filter((r: any) => r.status === "done").length;
  const highSeverityCount = items.filter((r: any) => r.severity === "high" && r.status !== "done" && r.status !== "dismissed").length;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-recommendations-title">
          SEO Recommendations
        </h1>
        <p className="text-muted-foreground">
          Actionable tasks to improve your website's SEO performance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Open Tasks"
          value={openCount}
          status={openCount > 10 ? "at_risk" : "neutral"}
          testId="kpi-open-tasks"
        />
        <KpiCard
          title="In Progress"
          value={inProgressCount}
          testId="kpi-in-progress"
        />
        <KpiCard
          title="Completed"
          value={doneCount}
          status="healthy"
          testId="kpi-completed"
        />
        <KpiCard
          title="High Priority"
          value={highSeverityCount}
          status={highSeverityCount > 0 ? "declining" : "healthy"}
          testId="kpi-high-priority"
        />
      </div>

      <RecommendationsList
        data={items}
        isLoading={isLoading}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
