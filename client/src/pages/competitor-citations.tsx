import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { KpiCard } from "@/components/kpi-card";
import { ExportButton } from "@/components/export-button";
import { SiGoogle, SiOpenai } from "react-icons/si";
import {
  Search,
  Eye,
  ExternalLink,
  ChevronRight,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Target,
  Lightbulb,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  MessageSquare,
  Filter,
  ChevronDown,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ExportColumn } from "@/lib/export-utils";

interface CompetitorCitationsPageProps {
  projectId: string | null;
}

interface CitationItem {
  id: number;
  snapshotId: number;
  projectId: string;
  question: string | null;
  answerExcerpt: string | null;
  citedUrl: string | null;
  citedDomain: string | null;
  citedPageTitle: string | null;
  sourceName: string | null;
  snippet: string | null;
  referencePosition: number | null;
  aiSearchVolume: number | null;
  impressions: number | null;
  platform: string;
  citationStatus: string | null;
  notes: string | null;
  intent: string | null;
  capturedAt: string;
  entityType?: string;
  entityName?: string;
}

interface Competitor {
  id: number;
  name: string | null;
  domain: string;
}

interface CompetitorInsights {
  summary: string;
  questionThemes: Array<{
    theme: string;
    count: number;
    examples: string[];
    intent: string;
  }>;
  contentGaps: Array<{
    topic: string;
    competitorAdvantage: string;
    suggestedAction: string;
    priority: "high" | "medium" | "low";
  }>;
  topCompetitorStrategies: Array<{
    competitor: string;
    citationCount: number;
    dominantTopics: string[];
    contentType: string;
  }>;
  recommendations: Array<{
    action: string;
    rationale: string;
    expectedImpact: string;
  }>;
  analyzedAt: string;
}

const statusConfig = {
  new: { label: "New", icon: Eye, color: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  opportunity: { label: "Opportunity", icon: Lightbulb, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  addressing: { label: "Addressing", icon: Target, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  dismissed: { label: "Dismissed", icon: XCircle, color: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

const intentConfig = {
  informational: { label: "Informational", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  commercial: { label: "Commercial", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  transactional: { label: "Transactional", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  navigational: { label: "Navigational", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
};

type SortField = "question" | "competitor" | "platform" | "position" | "volume" | "status";
type SortDirection = "asc" | "desc";

const citationExportColumns: ExportColumn<CitationItem>[] = [
  { header: "Question", accessor: "question" },
  { header: "Cited URL", accessor: "citedUrl" },
  { header: "Cited Domain", accessor: "citedDomain" },
  { header: "Page Title", accessor: "citedPageTitle" },
  { header: "Platform", accessor: "platform" },
  { header: "Position", accessor: "referencePosition" },
  { header: "AI Search Volume", accessor: "aiSearchVolume" },
  { header: "Intent", accessor: "intent" },
  { header: "Status", accessor: "citationStatus" },
  { header: "Notes", accessor: "notes" },
  { header: "Captured At", accessor: "capturedAt" },
];

export function CompetitorCitationsPage({ projectId }: CompetitorCitationsPageProps) {
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [selectedCompetitor, setSelectedCompetitor] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedIntent, setSelectedIntent] = useState("all");
  const [sortField, setSortField] = useState<SortField>("volume");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [page, setPage] = useState(1);
  const [isClassifying, setIsClassifying] = useState(false);
  const [backgroundJobId, setBackgroundJobId] = useState<string | null>(null);
  const pageSize = 50;

  const normalizePlatform = (platform: string) => {
    if (platform === "chatgpt") return "chat_gpt";
    return platform;
  };

  const { data: competitorsData } = useQuery<{ competitors: Competitor[] }>({
    queryKey: ["/api/llm-citations/competitors", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/llm-citations/competitors?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch competitors");
      return res.json();
    },
    enabled: !!projectId,
  });

  // Fetch summary stats for KPI cards (aggregates across ALL citations, not just current page)
  const { data: summaryData } = useQuery<{
    total: number;
    byPlatform: { google: number; chatgpt: number };
    byStatus: { new: number; opportunity: number; addressing: number; dismissed: number };
    byIntent: { informational: number; commercial: number; transactional: number; navigational: number; unclassified: number };
    uniqueCompetitors: number;
    totalVolume: number;
  }>({
    queryKey: ["/api/llm-citations/competitor-summary", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/llm-citations/competitor-summary?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: citationsData, isLoading } = useQuery<{ items: CitationItem[]; total: number }>({
    queryKey: [
      "/api/llm-citations/items",
      projectId,
      "competitor",
      selectedCompetitor,
      selectedPlatform,
      search,
      page,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        projectId: projectId!,
        entityType: "competitor",
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      });
      if (selectedCompetitor !== "all") params.append("competitorDomain", selectedCompetitor);
      if (selectedPlatform !== "all") params.append("platform", normalizePlatform(selectedPlatform));
      if (search) params.append("search", search);
      const res = await fetch(`/api/llm-citations/items?${params}`);
      if (!res.ok) throw new Error("Failed to fetch citations");
      return res.json();
    },
    enabled: !!projectId,
  });

  const updateCitationMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status?: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/llm-citations/items/${id}`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/competitor-summary"] });
      toast({ title: "Citation updated", description: "Status and notes have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update citation.", variant: "destructive" });
    },
  });

  // AI Insights query
  const { data: insightsData, isLoading: isLoadingInsights } = useQuery<{
    insights: CompetitorInsights | null;
    generatedAt: string | null;
    citationCount: number | null;
    cached: boolean;
  }>({
    queryKey: ["/api/llm-citations/competitor-insights", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/llm-citations/competitor-insights?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    enabled: !!projectId,
  });

  // AI Insights generation mutation
  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/llm-citations/competitor-insights", { projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/competitor-insights", projectId] });
      toast({ title: "Analysis Complete", description: "AI insights have been generated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate AI insights.", variant: "destructive" });
    },
  });

  // Background classification job status polling
  const { data: jobStatus } = useQuery<{
    id: string;
    status: "running" | "completed" | "failed" | "cancelled";
    classified: number;
    initialTotal: number;
    remaining: number;
    progress: number;
    error?: string;
  } | null>({
    queryKey: ["/api/llm-citations/classify-job-status", projectId, backgroundJobId],
    queryFn: async () => {
      if (backgroundJobId) {
        const res = await fetch(`/api/llm-citations/classify-job-status?jobId=${backgroundJobId}`);
        if (!res.ok) return null;
        return res.json();
      }
      const res = await fetch(`/api/llm-citations/classify-job-status?projectId=${projectId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.job === null ? null : data;
    },
    enabled: !!projectId,
    refetchInterval: backgroundJobId ? 2000 : false, // Poll every 2s while job is running
  });

  // Start background classification mutation
  const startBackgroundClassificationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/llm-citations/classify-all-background", { projectId });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      if (data.jobId) {
        setBackgroundJobId(data.jobId);
        toast({ 
          title: "Background Classification Started", 
          description: data.message 
        });
      } else if (data.job === null) {
        toast({ 
          title: "All Citations Classified", 
          description: "No unclassified citations found." 
        });
      }
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to start background classification.", 
        variant: "destructive" 
      });
    },
  });

  // Cancel background job mutation
  const cancelBackgroundJobMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/llm-citations/classify-job-cancel", { jobId: backgroundJobId });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setBackgroundJobId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/competitor-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/classify-job-status"] });
      toast({ 
        title: "Classification Cancelled", 
        description: data.message 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to cancel classification.", 
        variant: "destructive" 
      });
    },
  });

  // Handle job completion - use useEffect for side effects
  useEffect(() => {
    if (!jobStatus || !backgroundJobId) return;
    
    if (jobStatus.status === "completed" || jobStatus.status === "failed") {
      setBackgroundJobId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/competitor-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/classify-job-status"] });
      
      if (jobStatus.status === "completed") {
        toast({ 
          title: "Classification Complete", 
          description: `Successfully classified ${jobStatus.classified.toLocaleString()} citations.` 
        });
      } else if (jobStatus.error) {
        toast({ 
          title: "Classification Failed", 
          description: jobStatus.error, 
          variant: "destructive" 
        });
      }
    }
  }, [jobStatus, backgroundJobId, projectId, toast]);

  const isBackgroundJobRunning = backgroundJobId && jobStatus?.status === "running";

  const [showInsights, setShowInsights] = useState(false);

  const competitors: Competitor[] = competitorsData?.competitors || [];
  const citations: CitationItem[] = citationsData?.items || [];

  const filteredAndSortedCitations = useMemo(() => {
    let result = [...citations];

    if (selectedStatus !== "all") {
      result = result.filter(c => (c.citationStatus || "new") === selectedStatus);
    }

    if (selectedIntent !== "all") {
      result = result.filter(c => c.intent === selectedIntent);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "question":
          comparison = (a.question || "").localeCompare(b.question || "");
          break;
        case "competitor":
          comparison = (a.citedDomain || "").localeCompare(b.citedDomain || "");
          break;
        case "platform":
          comparison = a.platform.localeCompare(b.platform);
          break;
        case "position":
          comparison = (a.referencePosition || 99) - (b.referencePosition || 99);
          break;
        case "volume":
          comparison = (b.aiSearchVolume || 0) - (a.aiSearchVolume || 0);
          break;
        case "status":
          comparison = (a.citationStatus || "new").localeCompare(b.citationStatus || "new");
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [citations, selectedStatus, selectedIntent, sortField, sortDirection]);

  const handleClassifyCurrentPage = async () => {
    if (!projectId || isClassifying) return;
    
    setIsClassifying(true);
    try {
      // Use the bulk classification endpoint that finds unclassified citations directly
      const response = await apiRequest("POST", "/api/llm-citations/classify-all-intents", {
        projectId,
        batchSize: 50,
      });
      
      const data = await response.json();
      
      if (data.classified === 0 && data.remaining === 0) {
        toast({ 
          title: "All citations classified", 
          description: "No unclassified citations found." 
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/items"] });
        queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/competitor-summary"] });
        toast({ 
          title: "Intent classification complete", 
          description: data.message || `Classified ${data.classified} citations${data.remaining > 0 ? `. ${data.remaining} more remaining.` : ''}`
        });
      }
    } catch (error) {
      toast({ 
        title: "Classification failed", 
        description: "Failed to classify citation intents", 
        variant: "destructive" 
      });
    } finally {
      setIsClassifying(false);
    }
  };

  // Use summary data from API for KPI cards (correct totals across all pages)
  const stats = useMemo(() => {
    if (summaryData) {
      return {
        total: summaryData.total,
        byPlatform: summaryData.byPlatform,
        byStatus: summaryData.byStatus,
        byIntent: summaryData.byIntent,
        uniqueCompetitors: summaryData.uniqueCompetitors,
        totalVolume: summaryData.totalVolume,
      };
    }
    // Fallback to empty stats if summary not loaded
    return {
      total: 0,
      byPlatform: { google: 0, chatgpt: 0 },
      byStatus: { new: 0, opportunity: 0, addressing: 0, dismissed: 0 },
      byIntent: { informational: 0, commercial: 0, transactional: 0, navigational: 0, unclassified: 0 },
      uniqueCompetitors: 0,
      totalVolume: 0,
    };
  }, [summaryData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleStatusChange = (citation: CitationItem, newStatus: string) => {
    updateCitationMutation.mutate({ id: citation.id, status: newStatus });
  };

  const handleSaveNotes = () => {
    if (!selectedCitation) return;
    updateCitationMutation.mutate({ 
      id: selectedCitation.id, 
      notes: editNotes,
      status: selectedCitation.citationStatus || "new",
    });
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover-elevate select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    </TableHead>
  );

  const hasActiveFilters = search || selectedCompetitor !== "all" || selectedPlatform !== "all" || selectedStatus !== "all" || selectedIntent !== "all";

  const totalPages = Math.ceil((citationsData?.total || 0) / pageSize);

  const clearAllFilters = () => {
    setSearch("");
    setSelectedCompetitor("all");
    setSelectedPlatform("all");
    setSelectedStatus("all");
    setSelectedIntent("all");
    setPage(1);
  };

  const handleFilterChange = (setter: (val: any) => void, value: any) => {
    setter(value);
    setPage(1);
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Eye className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Project Selected</h2>
          <p className="mt-2 text-muted-foreground">
            Select a project to view competitor AI citations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-competitor-citations-title">
          Competitor Citations
        </h1>
        <p className="text-muted-foreground">
          Analyze what questions and topics generate AI citations for your competitors.
          Track opportunities and prioritize content to compete.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Total Citations"
          value={stats.total}
          testId="kpi-total-citations"
        />
        <KpiCard
          title="Google AI"
          value={stats.byPlatform.google}
          suffix={` / ${stats.total}`}
          testId="kpi-google-citations"
        />
        <KpiCard
          title="ChatGPT"
          value={stats.byPlatform.chatgpt}
          suffix={` / ${stats.total}`}
          testId="kpi-chatgpt-citations"
        />
        <KpiCard
          title="Competitors Tracked"
          value={stats.uniqueCompetitors}
          testId="kpi-unique-competitors"
        />
        <KpiCard
          title="Total AI Volume"
          value={stats.totalVolume.toLocaleString()}
          testId="kpi-total-volume"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded", statusConfig.new.color)}>
                <Eye className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">New</span>
            </div>
            <Badge variant="secondary">{stats.byStatus.new}</Badge>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded", statusConfig.opportunity.color)}>
                <Lightbulb className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Opportunities</span>
            </div>
            <Badge variant="secondary">{stats.byStatus.opportunity}</Badge>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded", statusConfig.addressing.color)}>
                <Target className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Addressing</span>
            </div>
            <Badge variant="secondary">{stats.byStatus.addressing}</Badge>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded", statusConfig.dismissed.color)}>
                <XCircle className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Dismissed</span>
            </div>
            <Badge variant="secondary">{stats.byStatus.dismissed}</Badge>
          </div>
        </Card>
      </div>

      {/* AI Insights Section */}
      <Card data-testid="card-ai-insights">
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Competitive Analysis</CardTitle>
              <CardDescription>
                {insightsData?.insights ? (
                  <>Analyzed {insightsData.citationCount} citations • Last updated {new Date(insightsData.generatedAt!).toLocaleDateString()}</>
                ) : (
                  "Generate AI-powered insights from competitor citations"
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {insightsData?.insights && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInsights(!showInsights)}
                data-testid="button-toggle-insights"
              >
                {showInsights ? "Hide Details" : "Show Details"}
              </Button>
            )}
            <Button
              onClick={() => generateInsightsMutation.mutate()}
              disabled={generateInsightsMutation.isPending || stats.total === 0}
              data-testid="button-generate-insights"
            >
              {generateInsightsMutation.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
              ) : insightsData?.insights ? (
                <><RefreshCw className="h-4 w-4 mr-2" /> Refresh Analysis</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate Insights</>
              )}
            </Button>
          </div>
        </CardHeader>
        
        {insightsData?.insights && (
          <CardContent className="pt-0">
            {/* Summary always visible */}
            <div className="p-4 rounded-lg bg-muted/50 mb-4">
              <p className="text-sm leading-relaxed">{insightsData.insights.summary}</p>
            </div>
            
            {showInsights && (
              <div className="space-y-6">
                {/* Empty state when no detailed insights */}
                {insightsData.insights.contentGaps.length === 0 &&
                 insightsData.insights.questionThemes.length === 0 &&
                 insightsData.insights.recommendations.length === 0 &&
                 insightsData.insights.topCompetitorStrategies.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No specific patterns identified</p>
                    <p className="text-sm">The AI analyzed your citations but couldn't identify distinct themes or gaps. Try refreshing after more citations are collected.</p>
                  </div>
                )}
                
                {/* Content Gaps - High Priority */}
                {insightsData.insights.contentGaps.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 font-semibold mb-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Content Gaps
                    </h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      {insightsData.insights.contentGaps.slice(0, 4).map((gap, i) => (
                        <div key={i} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="font-medium text-sm">{gap.topic}</span>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                gap.priority === "high" && "border-red-500/50 text-red-600 dark:text-red-400",
                                gap.priority === "medium" && "border-amber-500/50 text-amber-600 dark:text-amber-400",
                                gap.priority === "low" && "border-green-500/50 text-green-600 dark:text-green-400"
                              )}
                            >
                              {gap.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{gap.competitorAdvantage}</p>
                          <p className="text-xs font-medium text-primary">{gap.suggestedAction}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Question Themes */}
                {insightsData.insights.questionThemes.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 font-semibold mb-3">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      Top Question Themes
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {insightsData.insights.questionThemes.slice(0, 8).map((theme, i) => (
                        <Badge key={i} variant="secondary" className="py-1.5 px-3">
                          {theme.theme}
                          <span className="ml-2 text-xs text-muted-foreground">~{theme.count}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {insightsData.insights.recommendations.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 font-semibold mb-3">
                      <Zap className="h-4 w-4 text-green-500" />
                      Recommended Actions
                    </h4>
                    <div className="space-y-3">
                      {insightsData.insights.recommendations.slice(0, 3).map((rec, i) => (
                        <div key={i} className="p-3 rounded-lg border bg-card">
                          <p className="font-medium text-sm mb-1">{rec.action}</p>
                          <p className="text-xs text-muted-foreground">{rec.rationale}</p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Expected: {rec.expectedImpact}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Competitor Strategies */}
                {insightsData.insights.topCompetitorStrategies.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 font-semibold mb-3">
                      <Target className="h-4 w-4 text-purple-500" />
                      Competitor Strategies
                    </h4>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {insightsData.insights.topCompetitorStrategies.slice(0, 3).map((comp, i) => (
                        <div key={i} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="secondary" className="truncate max-w-[150px]">{comp.competitor}</Badge>
                            <span className="text-xs text-muted-foreground">{comp.citationCount} citations</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">Content: {comp.contentType}</p>
                          <div className="flex flex-wrap gap-1">
                            {comp.dominantTopics.slice(0, 2).map((topic, j) => (
                              <Badge key={j} variant="outline" className="text-xs">{topic}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Citation Analysis</CardTitle>
              <CardDescription>
                Filter and analyze competitor citations to find content opportunities
              </CardDescription>
            </div>
            <ExportButton
              data={filteredAndSortedCitations}
              columns={citationExportColumns}
              filename="competitor-citations"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search questions or pages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-[220px]"
                data-testid="input-search"
              />
            </div>
            
            <Select value={selectedCompetitor} onValueChange={(v) => handleFilterChange(setSelectedCompetitor, v)}>
              <SelectTrigger className="w-[180px]" data-testid="select-competitor">
                <SelectValue placeholder="All competitors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Competitors</SelectItem>
                {competitors.map((comp) => (
                  <SelectItem key={comp.id} value={comp.domain}>
                    {comp.name || comp.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedPlatform} onValueChange={(v) => handleFilterChange(setSelectedPlatform, v)}>
              <SelectTrigger className="w-[150px]" data-testid="select-platform">
                <SelectValue placeholder="All platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="google">Google AI</SelectItem>
                <SelectItem value="chatgpt">ChatGPT</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedStatus} onValueChange={(v) => handleFilterChange(setSelectedStatus, v)}>
              <SelectTrigger className="w-[150px]" data-testid="select-status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="opportunity">Opportunity</SelectItem>
                <SelectItem value="addressing">Addressing</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedIntent} onValueChange={(v) => handleFilterChange(setSelectedIntent, v)}>
              <SelectTrigger className="w-[160px]" data-testid="select-intent">
                <SelectValue placeholder="All intents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Intents</SelectItem>
                <SelectItem value="informational">Informational</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="navigational">Navigational</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleClassifyCurrentPage}
              disabled={isClassifying || isBackgroundJobRunning || !projectId}
              data-testid="button-classify-intents"
            >
              {isClassifying ? "Classifying..." : "Classify 50"}
            </Button>
            
            {isBackgroundJobRunning ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col text-xs">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                    <span className="font-medium">Classifying All...</span>
                  </div>
                  <span className="text-muted-foreground">
                    {jobStatus?.classified.toLocaleString() || 0} / {jobStatus?.initialTotal.toLocaleString() || 0} ({jobStatus?.progress || 0}%)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelBackgroundJobMutation.mutate()}
                  disabled={cancelBackgroundJobMutation.isPending}
                  data-testid="button-cancel-classify"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => startBackgroundClassificationMutation.mutate()}
                disabled={startBackgroundClassificationMutation.isPending || isClassifying || !projectId}
                data-testid="button-classify-all"
              >
                <Zap className="h-4 w-4 mr-1" />
                {startBackgroundClassificationMutation.isPending ? "Starting..." : "Classify All"}
              </Button>
            )}
            
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredAndSortedCitations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No competitor citations found</p>
              <p className="text-sm mt-1">
                {hasActiveFilters 
                  ? "Try adjusting your filters or search terms."
                  : "Add competitors in the AI Citations page and run a sync to fetch their citations."}
              </p>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-4">
                Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, citationsData?.total || 0)} of {citationsData?.total || 0} citations
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader field="question">Question / Topic</SortableHeader>
                      <TableHead>Cited Page</TableHead>
                      <SortableHeader field="competitor">Competitor</SortableHeader>
                      <SortableHeader field="platform">Platform</SortableHeader>
                      <SortableHeader field="position">Pos</SortableHeader>
                      <SortableHeader field="volume">Volume</SortableHeader>
                      <TableHead>Intent</TableHead>
                      <SortableHeader field="status">Status</SortableHeader>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedCitations.map((item) => {
                      const status = item.citationStatus || "new";
                      const StatusIcon = statusConfig[status as keyof typeof statusConfig]?.icon || Eye;
                      
                      return (
                        <TableRow 
                          key={item.id} 
                          data-testid={`row-citation-${item.id}`}
                          className="cursor-pointer hover-elevate"
                          onClick={() => {
                            setSelectedCitation(item);
                            setEditNotes(item.notes || "");
                          }}
                        >
                          <TableCell className="max-w-xs">
                            <p className="font-medium truncate">{item.question}</p>
                            {item.snippet && (
                              <p className="text-xs text-muted-foreground truncate">{item.snippet}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 max-w-[200px]">
                              <span className="truncate">{item.citedPageTitle || item.citedUrl}</span>
                              <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="truncate max-w-[120px]">
                              {item.citedDomain}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.platform === "google" ? (
                                <><SiGoogle className="h-3 w-3 mr-1" /> Google</>
                              ) : (
                                <><SiOpenai className="h-3 w-3 mr-1" /> ChatGPT</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">#{item.referencePosition}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.aiSearchVolume?.toLocaleString() || "-"}
                          </TableCell>
                          <TableCell>
                            {item.intent ? (
                              <Badge 
                                variant="outline"
                                className={cn(intentConfig[item.intent as keyof typeof intentConfig]?.color)}
                              >
                                {intentConfig[item.intent as keyof typeof intentConfig]?.label || item.intent}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Badge 
                                  variant="outline"
                                  className={cn("cursor-pointer", statusConfig[status as keyof typeof statusConfig]?.color)}
                                >
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusConfig[status as keyof typeof statusConfig]?.label || "New"}
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Badge>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {Object.entries(statusConfig).map(([key, config]) => (
                                  <DropdownMenuItem
                                    key={key}
                                    onClick={() => handleStatusChange(item, key)}
                                  >
                                    <config.icon className="h-4 w-4 mr-2" />
                                    {config.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {item.notes && (
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedCitation} onOpenChange={(open) => !open && setSelectedCitation(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Citation Details</SheetTitle>
            <SheetDescription>
              Review and manage this competitor citation
            </SheetDescription>
          </SheetHeader>
          
          {selectedCitation && (
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {selectedCitation.platform === "google" ? (
                      <><SiGoogle className="h-3 w-3 mr-1" /> Google AI Overview</>
                    ) : (
                      <><SiOpenai className="h-3 w-3 mr-1" /> ChatGPT</>
                    )}
                  </Badge>
                  <Badge variant="secondary">#{selectedCitation.referencePosition}</Badge>
                  {selectedCitation.aiSearchVolume && (
                    <Badge variant="outline">{selectedCitation.aiSearchVolume.toLocaleString()} vol</Badge>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Question / Query</h4>
                <p className="text-base">{selectedCitation.question}</p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Competitor</h4>
                <Badge variant="secondary">{selectedCitation.citedDomain}</Badge>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Cited Page</h4>
                <p className="text-sm">{selectedCitation.citedPageTitle}</p>
                {selectedCitation.citedUrl && (
                  <a
                    href={selectedCitation.citedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary flex items-center gap-1 hover:underline"
                    data-testid="link-cited-url"
                  >
                    {selectedCitation.citedUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              
              {selectedCitation.snippet && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Snippet</h4>
                  <p className="text-sm text-muted-foreground">{selectedCitation.snippet}</p>
                </div>
              )}
              
              {selectedCitation.answerExcerpt && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">AI Response Excerpt</h4>
                  <div className="bg-muted/50 rounded-md p-3 text-sm max-h-48 overflow-y-auto">
                    {selectedCitation.answerExcerpt}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statusConfig).map(([key, config]) => {
                    const isActive = (selectedCitation.citationStatus || "new") === key;
                    return (
                      <Button
                        key={key}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleStatusChange(selectedCitation, key)}
                        data-testid={`button-status-${key}`}
                      >
                        <config.icon className="h-4 w-4 mr-1" />
                        {config.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Notes</h4>
                <Textarea
                  placeholder="Add notes about this citation opportunity..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="min-h-[100px]"
                  data-testid="textarea-notes"
                />
                <Button 
                  size="sm" 
                  onClick={handleSaveNotes}
                  disabled={updateCitationMutation.isPending}
                  data-testid="button-save-notes"
                >
                  Save Notes
                </Button>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Captured {new Date(selectedCitation.capturedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
