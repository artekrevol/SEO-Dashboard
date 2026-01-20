import { useState, useMemo } from "react";
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
  capturedAt: string;
  entityType?: string;
  entityName?: string;
}

interface Competitor {
  id: number;
  name: string | null;
  domain: string;
}

const statusConfig = {
  new: { label: "New", icon: Eye, color: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  opportunity: { label: "Opportunity", icon: Lightbulb, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  addressing: { label: "Addressing", icon: Target, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  dismissed: { label: "Dismissed", icon: XCircle, color: "bg-red-500/10 text-red-600 dark:text-red-400" },
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
  const [sortField, setSortField] = useState<SortField>("volume");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [page, setPage] = useState(1);
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

  const competitors: Competitor[] = competitorsData?.competitors || [];
  const citations: CitationItem[] = citationsData?.items || [];

  const filteredAndSortedCitations = useMemo(() => {
    let result = [...citations];

    if (selectedStatus !== "all") {
      result = result.filter(c => (c.citationStatus || "new") === selectedStatus);
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
  }, [citations, selectedStatus, sortField, sortDirection]);

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

  const hasActiveFilters = search || selectedCompetitor !== "all" || selectedPlatform !== "all" || selectedStatus !== "all";

  const totalPages = Math.ceil((citationsData?.total || 0) / pageSize);

  const clearAllFilters = () => {
    setSearch("");
    setSelectedCompetitor("all");
    setSelectedPlatform("all");
    setSelectedStatus("all");
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
