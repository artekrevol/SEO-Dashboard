import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  Search,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TaskExecutionLog } from "@shared/schema";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "crawl", label: "Crawls" },
  { value: "sync", label: "Sync" },
  { value: "import", label: "Import" },
  { value: "export", label: "Export" },
  { value: "api", label: "API" },
  { value: "scheduled_job", label: "Scheduled Jobs" },
  { value: "report", label: "Reports" },
  { value: "gsc", label: "Search Console" },
  { value: "system", label: "System" },
];

const LEVELS = [
  { value: "all", label: "All Levels" },
  { value: "error", label: "Errors" },
  { value: "warn", label: "Warnings" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
];

function getLevelIcon(level: string) {
  switch (level) {
    case "error":
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case "warn":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />;
    case "debug":
      return <Bug className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Info className="h-4 w-4" />;
  }
}

function getLevelBadgeVariant(level: string): "destructive" | "outline" | "secondary" | "default" {
  switch (level) {
    case "error":
      return "destructive";
    case "warn":
      return "outline";
    case "info":
      return "secondary";
    default:
      return "default";
  }
}

function LogEntryCard({ log, onExpand }: { log: TaskExecutionLog; onExpand: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border rounded-md p-3 hover-elevate cursor-pointer"
      onClick={() => setExpanded(!expanded)}
      data-testid={`log-entry-${log.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getLevelIcon(log.level)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getLevelBadgeVariant(log.level)} className="text-xs">
              {log.level.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {log.category}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {log.taskType}
            </span>
          </div>
          <p className="text-sm mt-1 truncate">{log.message}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
            </span>
            {log.duration && (
              <span>{log.duration}ms</span>
            )}
            {log.projectId && (
              <span className="truncate max-w-[100px]">{log.projectId}</span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          data-testid={`toggle-log-${log.id}`}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Task ID</h4>
            <code className="text-xs bg-muted px-2 py-1 rounded">{log.taskId}</code>
          </div>

          {log.details ? (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Details</h4>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                {(() => {
                  try {
                    return JSON.stringify(log.details, null, 2);
                  } catch {
                    return String(log.details);
                  }
                })()}
              </pre>
            </div>
          ) : null}

          {log.errorStack && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Error Stack</h4>
              <pre className="text-xs bg-destructive/10 text-destructive p-2 rounded overflow-auto max-h-40">
                {log.errorStack}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SystemLogsPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState(100);

  const { data: logsData, isLoading, refetch, isFetching } = useQuery<{ logs: TaskExecutionLog[] }>({
    queryKey: ["/api/task-logs", { category, level, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (level !== "all") params.set("level", level);
      params.set("limit", String(limit));
      const res = await fetch(`/api/task-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery<{
    summary: {
      totalLogs: number;
      errorCount: number;
      warnCount: number;
      infoCount: number;
      debugCount: number;
      byCategory: Record<string, number>;
      recentErrors: TaskExecutionLog[];
    };
  }>({
    queryKey: ["/api/task-logs/summary"],
  });

  const cleanupMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("DELETE", `/api/task-logs/cleanup?olderThanDays=${days}`);
    },
    onSuccess: async (res) => {
      const data = await res.json();
      toast({
        title: "Cleanup Complete",
        description: `Deleted ${data.deletedCount} logs older than ${data.cutoffDate}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/task-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-logs/summary"] });
    },
    onError: () => {
      toast({
        title: "Cleanup Failed",
        description: "Failed to clean up old logs",
        variant: "destructive",
      });
    },
  });

  const logs = logsData?.logs || [];
  const summary = summaryData?.summary;

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(query) ||
      log.taskId.toLowerCase().includes(query) ||
      log.taskType.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">System Logs</h1>
          <p className="text-muted-foreground">
            Monitor background tasks, crawls, and system operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-logs"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-cleanup-logs">
                <Trash2 className="h-4 w-4 mr-2" />
                Cleanup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clean Up Old Logs</DialogTitle>
                <DialogDescription>
                  Delete logs older than a specified number of days. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => cleanupMutation.mutate(30)}
                  disabled={cleanupMutation.isPending}
                  data-testid="button-cleanup-30-days"
                >
                  Delete 30+ days old
                </Button>
                <Button
                  variant="outline"
                  onClick={() => cleanupMutation.mutate(7)}
                  disabled={cleanupMutation.isPending}
                  data-testid="button-cleanup-7-days"
                >
                  Delete 7+ days old
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-logs">
              {summary?.totalLogs || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="stat-errors">
              {summary?.errorCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500" data-testid="stat-warnings">
              {summary?.warnCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500" data-testid="stat-info">
              {summary?.infoCount || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Log Entries</CardTitle>
          <CardDescription>
            View and filter system execution logs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-logs"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]" data-testid="select-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-[150px]" data-testid="select-level">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((lvl) => (
                  <SelectItem key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-[120px]" data-testid="select-limit">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 logs</SelectItem>
                <SelectItem value="100">100 logs</SelectItem>
                <SelectItem value="250">250 logs</SelectItem>
                <SelectItem value="500">500 logs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No logs found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search or filters"
                  : "System logs will appear here as tasks run"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2 pr-4">
                {filteredLogs.map((log) => (
                  <LogEntryCard
                    key={log.id}
                    log={log}
                    onExpand={() => {}}
                  />
                ))}
              </div>
            </ScrollArea>
          )}

          {filteredLogs.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
              <span>Showing {filteredLogs.length} of {logs.length} logs</span>
              {filteredLogs.length === limit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLimit(limit + 100)}
                  data-testid="button-load-more"
                >
                  Load more
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {summary?.recentErrors && summary.recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Recent Errors
            </CardTitle>
            <CardDescription>
              Latest error logs requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.recentErrors.slice(0, 5).map((log) => (
                <LogEntryCard
                  key={log.id}
                  log={log}
                  onExpand={() => {}}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SystemLogsPage;
