import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Clock, 
  Play, 
  Search, 
  FileText, 
  Users, 
  Link2, 
  Settings2,
  Loader2,
  CheckCircle2,
  XCircle,
  Calendar,
  History,
  RefreshCw,
  AlertCircle,
  Timer,
  Activity
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CrawlSchedule, Keyword, CrawlResult } from "@shared/schema";

interface CrawlResultWithCST extends CrawlResult {
  startedAtCST: string | null;
  completedAtCST: string | null;
  durationFormatted: string | null;
}

interface RunningCrawlProgress {
  id: number;
  type: string;
  status: string;
  currentStage: string | null;
  itemsTotal: number;
  itemsProcessed: number;
  estimatedDurationSec: number | null;
  startedAt: string;
  elapsedSec: number;
  progressPercent: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CRAWL_TYPE_CONFIG: Record<string, { 
  icon: typeof Search; 
  label: string; 
  description: string;
  color: string;
}> = {
  keywords: { 
    icon: Search, 
    label: "Keyword Rankings", 
    description: "Fetch SERP positions and search volume for tracked keywords",
    color: "text-blue-600 dark:text-blue-400"
  },
  pages: { 
    icon: FileText, 
    label: "Page Metrics", 
    description: "Crawl pages for Core Web Vitals, indexability, and content analysis",
    color: "text-green-600 dark:text-green-400"
  },
  competitors: { 
    icon: Users, 
    label: "Competitor Analysis", 
    description: "Track competitor rankings and domain metrics",
    color: "text-purple-600 dark:text-purple-400"
  },
  backlinks: { 
    icon: Link2, 
    label: "Backlink Check", 
    description: "Monitor referring domains and new/lost backlinks",
    color: "text-orange-600 dark:text-orange-400"
  },
  technical: { 
    icon: Settings2, 
    label: "Technical Audit", 
    description: "Full site crawl for technical SEO issues",
    color: "text-red-600 dark:text-red-400"
  },
};

type ManualCrawlType = "all_keywords" | "selected_keywords" | "all_pages" | "all_competitors";

export function ScheduledCrawlsPage({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showManualCrawlDialog, setShowManualCrawlDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [manualCrawlType, setManualCrawlType] = useState<ManualCrawlType>("all_keywords");
  const [selectedKeywords, setSelectedKeywords] = useState<number[]>([]);
  const [runningCrawl, setRunningCrawl] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    url: "",
    type: "keywords" as string,
    frequency: "scheduled" as string,
    scheduledTime: "09:00",
    daysOfWeek: [1, 3, 5] as number[],
    isActive: true,
    config: {} as Record<string, unknown>,
  });

  const { data: schedules = [], isLoading } = useQuery<CrawlSchedule[]>({
    queryKey: ["/api/crawl-schedules", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/crawl-schedules?projectId=${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch schedules");
      return response.json();
    },
  });

  const { data: keywords = [] } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/keywords?projectId=${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch keywords");
      const data = await response.json();
      return data.keywords || [];
    },
  });

  const { data: crawlHistory, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery<{
    results: CrawlResultWithCST[];
  }>({
    queryKey: ["/api/crawl-results", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/crawl-results?projectId=${projectId}&limit=50`);
      if (!response.ok) throw new Error("Failed to fetch crawl history");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: runningCrawls = [] } = useQuery<RunningCrawlProgress[]>({
    queryKey: ["/api/crawl-results/running", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/crawl-results/running?projectId=${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch running crawls");
      return response.json();
    },
    refetchInterval: 3000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/crawl-schedules", {
        projectId,
        ...data,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crawl-schedules", projectId] });
      resetForm();
      toast({ title: "Schedule created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create schedule", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<typeof formData> & { id: number }) => {
      const { id, ...updateData } = data;
      const response = await apiRequest("PATCH", `/api/crawl-schedules/${id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crawl-schedules", projectId] });
      resetForm();
      toast({ title: "Schedule updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/crawl-schedules/${id}`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crawl-schedules", projectId] });
      toast({ title: "Schedule deleted" });
    },
  });

  const runCrawlMutation = useMutation({
    mutationFn: async (params: { crawlType: string; scope: string; keywordIds?: number[] }) => {
      const response = await apiRequest("POST", "/api/crawl/trigger", {
        projectId,
        crawlType: params.crawlType,
        scope: params.scope,
        ...(params.keywordIds && { keywordIds: params.keywordIds }),
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({ 
        title: "Crawl Started", 
        description: `${variables.crawlType} crawl has been queued for execution.` 
      });
      setShowManualCrawlDialog(false);
      setSelectedKeywords([]);
      queryClient.invalidateQueries({ queryKey: ["/api/crawl-results", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/crawl-results/running", projectId] });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to start crawl", 
        variant: "destructive" 
      });
    },
  });

  const runScheduledCrawlMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      setRunningCrawl(scheduleId);
      const response = await apiRequest("POST", `/api/crawl-schedules/${scheduleId}/run?projectId=${projectId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crawl-schedules", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/crawl-results", projectId] });
      toast({ title: "Crawl executed successfully" });
      setRunningCrawl(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run crawl", variant: "destructive" });
      setRunningCrawl(null);
    },
  });

  const resetForm = () => {
    setFormData({
      url: "",
      type: "keywords",
      frequency: "scheduled",
      scheduledTime: "09:00",
      daysOfWeek: [1, 3, 5],
      isActive: true,
      config: {},
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!formData.scheduledTime) {
      toast({ title: "Error", description: "Time is required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ ...formData, id: editingId });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (schedule: CrawlSchedule) => {
    setFormData({
      url: schedule.url || "",
      type: schedule.type,
      frequency: schedule.frequency || "scheduled",
      scheduledTime: schedule.scheduledTime,
      daysOfWeek: schedule.daysOfWeek,
      isActive: schedule.isActive,
      config: (schedule.config as Record<string, unknown>) || {},
    });
    setEditingId(schedule.id);
    setShowForm(true);
  };

  const toggleScheduleActive = (schedule: CrawlSchedule) => {
    updateMutation.mutate({ 
      id: schedule.id, 
      isActive: !schedule.isActive 
    });
  };

  const handleManualCrawl = () => {
    const crawlMap: Record<ManualCrawlType, { crawlType: string; scope: string }> = {
      all_keywords: { crawlType: "keyword_ranks", scope: "all" },
      selected_keywords: { crawlType: "keyword_ranks", scope: "selected" },
      all_pages: { crawlType: "pages_health", scope: "all" },
      all_competitors: { crawlType: "competitors", scope: "all" },
    };
    
    const params = crawlMap[manualCrawlType];
    runCrawlMutation.mutate({
      ...params,
      ...(manualCrawlType === "selected_keywords" && { keywordIds: selectedKeywords }),
    });
  };

  const groupedSchedules = schedules.reduce((acc, schedule) => {
    const type = schedule.type || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(schedule);
    return acc;
  }, {} as Record<string, CrawlSchedule[]>);

  const formatLastRun = (date: Date | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    if (status === "success") return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
    if (status === "error") return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-scheduled-crawls">
            Scheduled Crawls
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage automated data collection for keywords, pages, and competitors
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowManualCrawlDialog(true)}
            data-testid="button-manual-crawl"
          >
            <Play className="w-4 h-4 mr-2" />
            Run Manual Crawl
          </Button>
          <Button onClick={() => setShowForm(true)} data-testid="button-add-schedule">
            <Plus className="w-4 h-4 mr-2" />
            Add Schedule
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Schedule" : "Create New Schedule"}</CardTitle>
            <CardDescription>Configure when and what data to collect</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Crawl Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger data-testid="select-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CRAWL_TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <config.icon className={`w-4 h-4 ${config.color}`} />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger data-testid="select-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="scheduled">Scheduled Days</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Crawl Time (24h format)</Label>
              <Input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="w-40"
                data-testid="input-time"
              />
            </div>

            {formData.frequency === "scheduled" && (
              <div className="space-y-2">
                <Label>Days of Week</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((day, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      size="sm"
                      variant={formData.daysOfWeek.includes(idx) ? "default" : "outline"}
                      onClick={() => {
                        const days = formData.daysOfWeek.includes(idx)
                          ? formData.daysOfWeek.filter((d) => d !== idx)
                          : [...formData.daysOfWeek, idx].sort((a, b) => a - b);
                        setFormData({ ...formData, daysOfWeek: days });
                      }}
                      data-testid={`button-day-${day.toLowerCase()}`}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Custom URL (optional)</Label>
              <Input
                type="text"
                placeholder="Leave empty to use default endpoint"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                data-testid="input-url"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-active"
              />
              <Label>Active</Label>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-schedule"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {editingId ? "Update" : "Create"}
              </Button>
              <Button
                variant="outline"
                onClick={resetForm}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Scheduled Crawls</h3>
            <p className="text-muted-foreground mb-4">
              Set up automated crawls to keep your SEO data fresh and up-to-date
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">All ({schedules.length})</TabsTrigger>
            {Object.entries(groupedSchedules).map(([type, items]) => {
              const config = CRAWL_TYPE_CONFIG[type];
              return (
                <TabsTrigger key={type} value={type} data-testid={`tab-${type}`}>
                  {config?.label || type} ({items.length})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {Object.entries(groupedSchedules).map(([type, items]) => (
              <CrawlTypeSection
                key={type}
                type={type}
                schedules={items}
                onEdit={handleEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
                onToggle={toggleScheduleActive}
                onRun={(id) => runScheduledCrawlMutation.mutate(id)}
                runningCrawl={runningCrawl}
                formatLastRun={formatLastRun}
                getStatusBadge={getStatusBadge}
              />
            ))}
          </TabsContent>

          {Object.entries(groupedSchedules).map(([type, items]) => (
            <TabsContent key={type} value={type} className="space-y-4">
              <CrawlTypeSection
                type={type}
                schedules={items}
                onEdit={handleEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
                onToggle={toggleScheduleActive}
                onRun={(id) => runScheduledCrawlMutation.mutate(id)}
                runningCrawl={runningCrawl}
                formatLastRun={formatLastRun}
                getStatusBadge={getStatusBadge}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {runningCrawls.length > 0 && (
        <Card className="mt-6 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-lg">Active Crawls</CardTitle>
                <CardDescription>{runningCrawls.length} crawl{runningCrawls.length > 1 ? 's' : ''} in progress</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {runningCrawls.map((crawl) => (
              <RunningCrawlCard key={crawl.id} crawl={crawl} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                <History className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Crawl History</CardTitle>
                <CardDescription>Recent crawl executions with results (CST timezone)</CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchHistory()}
              disabled={isLoadingHistory}
              data-testid="button-refresh-history"
            >
              {isLoadingHistory ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !crawlHistory?.results?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No crawl history yet</p>
              <p className="text-sm mt-1">Run a crawl to see execution results here</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {crawlHistory.results.map((result) => (
                <CrawlHistoryItem key={result.id} result={result} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showManualCrawlDialog} onOpenChange={setShowManualCrawlDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Run Manual Crawl</DialogTitle>
            <DialogDescription>
              Execute a one-time crawl to refresh your data immediately
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Crawl Type</Label>
              <Select
                value={manualCrawlType}
                onValueChange={(value) => setManualCrawlType(value as ManualCrawlType)}
              >
                <SelectTrigger data-testid="select-manual-crawl-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_keywords">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-blue-600" />
                      All Keywords
                    </div>
                  </SelectItem>
                  <SelectItem value="selected_keywords">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-blue-600" />
                      Selected Keywords
                    </div>
                  </SelectItem>
                  <SelectItem value="all_pages">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-600" />
                      All Pages
                    </div>
                  </SelectItem>
                  <SelectItem value="all_competitors">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      All Competitors
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {manualCrawlType === "selected_keywords" && (
              <div className="space-y-2">
                <Label>Select Keywords ({selectedKeywords.length} selected)</Label>
                <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                  {keywords.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">No keywords found</p>
                  ) : (
                    keywords.map((kw) => (
                      <label 
                        key={kw.id} 
                        className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedKeywords.includes(kw.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKeywords([...selectedKeywords, kw.id]);
                            } else {
                              setSelectedKeywords(selectedKeywords.filter(id => id !== kw.id));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{kw.keyword}</span>
                        {kw.cluster && (
                          <Badge variant="outline" className="text-xs">{kw.cluster}</Badge>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowManualCrawlDialog(false);
                setSelectedKeywords([]);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleManualCrawl}
              disabled={
                runCrawlMutation.isPending || 
                (manualCrawlType === "selected_keywords" && selectedKeywords.length === 0)
              }
              data-testid="button-run-manual-crawl"
            >
              {runCrawlMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Start Crawl
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CrawlTypeSection({
  type,
  schedules,
  onEdit,
  onDelete,
  onToggle,
  onRun,
  runningCrawl,
  formatLastRun,
  getStatusBadge,
}: {
  type: string;
  schedules: CrawlSchedule[];
  onEdit: (schedule: CrawlSchedule) => void;
  onDelete: (id: number) => void;
  onToggle: (schedule: CrawlSchedule) => void;
  onRun: (id: number) => void;
  runningCrawl: number | null;
  formatLastRun: (date: Date | null) => string;
  getStatusBadge: (status: string | null) => React.ReactNode;
}) {
  const config = CRAWL_TYPE_CONFIG[type] || {
    icon: Settings2,
    label: type,
    description: "Custom crawl schedule",
    color: "text-gray-600",
  };
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg">{config.label}</CardTitle>
            <CardDescription>{config.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
              data-testid={`card-schedule-${schedule.id}`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <Switch
                  checked={schedule.isActive}
                  onCheckedChange={() => onToggle(schedule)}
                  data-testid={`switch-schedule-${schedule.id}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium" data-testid={`text-time-${schedule.id}`}>
                      {schedule.scheduledTime}
                    </span>
                    <Badge variant={schedule.isActive ? "default" : "secondary"}>
                      {schedule.isActive ? "Active" : "Paused"}
                    </Badge>
                    {schedule.lastRunStatus && getStatusBadge(schedule.lastRunStatus)}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      {schedule.frequency === "daily" 
                        ? "Every day" 
                        : schedule.frequency === "weekly"
                          ? "Weekly"
                          : schedule.daysOfWeek.map(d => DAYS[d]).join(", ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Last run: {formatLastRun(schedule.lastRunAt)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRun(schedule.id)}
                  disabled={runningCrawl === schedule.id}
                  title="Run now"
                  data-testid={`button-run-${schedule.id}`}
                >
                  {runningCrawl === schedule.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEdit(schedule)}
                  data-testid={`button-edit-${schedule.id}`}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(schedule.id)}
                  data-testid={`button-delete-${schedule.id}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CrawlHistoryItem({ result }: { result: CrawlResultWithCST }) {
  const getStatusIcon = () => {
    switch (result.status) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "error":
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = () => {
    switch (result.status) {
      case "success":
        return <Badge variant="default" className="bg-green-600">Success</Badge>;
      case "error":
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "running":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Running</Badge>;
      default:
        return <Badge variant="secondary">{result.status}</Badge>;
    }
  };

  const getCrawlTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      keyword_ranks: "Keyword Rankings",
      keywords: "Keywords",
      pages: "Page Metrics",
      competitors: "Competitor Analysis",
      backlinks: "Backlink Check",
      technical: "Technical Audit",
      manual: "Manual Crawl",
    };
    return typeMap[type] || type;
  };

  const metadata = result.details as Record<string, unknown> | null;

  return (
    <div 
      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover-elevate"
      data-testid={`crawl-result-${result.id}`}
    >
      <div className="flex-shrink-0 pt-0.5">
        {getStatusIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{getCrawlTypeLabel(result.type)}</span>
          {getStatusBadge()}
          {result.durationFormatted && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="w-3 h-3" />
              {result.durationFormatted}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate" title={result.message || ""}>
          {result.message || "No message"}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-muted-foreground">
            Started: {result.startedAtCST || "N/A"}
          </span>
          {metadata && typeof metadata === "object" && (
            <>
              {metadata.keywordsUpdated !== undefined && (
                <Badge variant="outline" className="text-xs">
                  {String(metadata.keywordsUpdated)} keywords updated
                </Badge>
              )}
              {metadata.competitorsFound !== undefined && (
                <Badge variant="outline" className="text-xs">
                  {String(metadata.competitorsFound)} competitors found
                </Badge>
              )}
              {metadata.errorCount !== undefined && Number(metadata.errorCount) > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {String(metadata.errorCount)} errors
                </Badge>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RunningCrawlCard({ crawl }: { crawl: RunningCrawlProgress }) {
  const getCrawlTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      keyword_ranks: "Keyword Rankings",
      keywords: "Keywords",
      pages: "Page Metrics",
      pages_health: "Page Metrics",
      competitors: "Competitor Analysis",
      backlinks: "Backlink Check",
      competitor_backlinks: "Competitor Backlinks",
      technical: "Technical Audit",
      deep_discovery: "Deep Discovery",
    };
    return typeMap[type] || type;
  };

  const getStageLabel = (stage: string | null) => {
    if (!stage) return "Initializing...";
    const stageMap: Record<string, string> = {
      initializing: "Initializing...",
      fetching_keywords: "Fetching keywords...",
      processing_rankings: "Processing rankings...",
      saving_results: "Saving results...",
      fetching_pages: "Fetching page data...",
      analyzing_content: "Analyzing content...",
      fetching_competitors: "Fetching competitor data...",
      processing_backlinks: "Processing backlinks...",
      completing: "Completing...",
    };
    return stageMap[stage] || stage;
  };

  const formatElapsedTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const formatEstimatedRemaining = (estimatedSec: number | null, elapsedSec: number) => {
    if (!estimatedSec) return null;
    const remaining = Math.max(0, estimatedSec - elapsedSec);
    if (remaining === 0) return "Almost done...";
    return `~${formatElapsedTime(remaining)} remaining`;
  };

  const config = CRAWL_TYPE_CONFIG[crawl.type] || {
    icon: Settings2,
    label: crawl.type,
    color: "text-gray-600",
  };
  const Icon = config.icon;

  return (
    <div 
      className="p-4 rounded-lg border bg-card"
      data-testid={`running-crawl-${crawl.id}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.color}`} />
          <span className="font-medium">{getCrawlTypeLabel(crawl.type)}</span>
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Running
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {formatElapsedTime(crawl.elapsedSec)}
          </span>
          {formatEstimatedRemaining(crawl.estimatedDurationSec, crawl.elapsedSec) && (
            <span className="text-xs">
              {formatEstimatedRemaining(crawl.estimatedDurationSec, crawl.elapsedSec)}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{getStageLabel(crawl.currentStage)}</span>
          <span className="font-medium">{crawl.progressPercent}%</span>
        </div>
        <Progress value={crawl.progressPercent} className="h-2" />
        {crawl.itemsTotal > 0 && (
          <p className="text-xs text-muted-foreground">
            {crawl.itemsProcessed} of {crawl.itemsTotal} items processed
          </p>
        )}
      </div>
    </div>
  );
}
