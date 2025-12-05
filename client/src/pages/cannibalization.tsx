import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Search,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileWarning,
  Lightbulb,
  Filter,
  MoreHorizontal,
  Eye,
  EyeOff,
  ArrowUpRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface KeywordPageConflict {
  id: number;
  projectId: string;
  keyword: string;
  keywordId: number | null;
  primaryUrl: string;
  conflictingUrl: string;
  primaryPosition: number | null;
  conflictingPosition: number | null;
  searchVolume: number | null;
  severity: string;
  status: string;
  conflictType: string;
  suggestedAction: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  notes: string | null;
}

interface ConflictSummary {
  total: number;
  active: number;
  resolved: number;
  ignored: number;
  bySeverity: {
    high: number;
    medium: number;
    low: number;
  };
}

export default function CannibalizationPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedConflict, setSelectedConflict] = useState<KeywordPageConflict | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const projectsQuery = useQuery<{ projects: { id: string; name: string }[] }>({
    queryKey: ["/api/projects"],
  });

  const projects = projectsQuery.data?.projects || [];

  const conflictsQuery = useQuery<{ conflicts: KeywordPageConflict[] }>({
    queryKey: ["/api/cannibalization", selectedProjectId, statusFilter, severityFilter, searchKeyword],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (severityFilter !== "all") params.append("severity", severityFilter);
      if (searchKeyword) params.append("keyword", searchKeyword);
      const response = await fetch(`/api/cannibalization?${params}`);
      return response.json();
    },
    enabled: !!selectedProjectId,
  });

  const summaryQuery = useQuery<ConflictSummary>({
    queryKey: ["/api/cannibalization/summary", selectedProjectId],
    queryFn: async () => {
      const response = await fetch(`/api/cannibalization/summary?projectId=${selectedProjectId}`);
      return response.json();
    },
    enabled: !!selectedProjectId,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/cannibalization/scan", { projectId: selectedProjectId });
      return response.json();
    },
    onSuccess: (data: { message: string }) => {
      toast({
        title: "Scan Complete",
        description: data.message,
      });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith("/api/cannibalization") });
    },
    onError: (error: Error) => {
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const response = await apiRequest("PATCH", `/api/cannibalization/${id}`, { status, notes });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith("/api/cannibalization") });
      setIsDetailsOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/cannibalization/${id}/promote`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Promoted to Recommendation", description: "Conflict has been added to your action items" });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    },
    onError: (error: Error) => {
      toast({ title: "Promotion failed", description: error.message, variant: "destructive" });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "low":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "ignored":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname || "/";
    } catch {
      return url;
    }
  };

  const conflicts = conflictsQuery.data?.conflicts || [];
  const summary = summaryQuery.data;

  if (projectsQuery.isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileWarning className="h-6 w-6 text-orange-500" />
            Cannibalization Detection
          </h1>
          <p className="text-muted-foreground mt-1">
            Identify and resolve keyword conflicts where multiple pages compete for the same rankings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[240px]" data-testid="select-project">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id} data-testid={`select-project-${project.id}`}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProjectId && (
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              data-testid="button-scan-cannibalization"
            >
              {scanMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Run Scan
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Conflicts</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-conflicts">
              {summary?.total ?? "-"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-orange-500" data-testid="text-active-conflicts">
              {summary?.active ?? "-"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High Severity</CardDescription>
            <CardTitle className="text-3xl text-red-500" data-testid="text-high-severity">
              {summary?.bySeverity?.high ?? "-"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resolved</CardDescription>
            <CardTitle className="text-3xl text-green-500" data-testid="text-resolved-conflicts">
              {summary?.resolved ?? "-"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Keyword Conflicts
          </CardTitle>
          <CardDescription>
            Pages competing for the same keywords, potentially diluting ranking potential
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search keywords..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
                data-testid="input-search-keyword"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-severity-filter">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {conflictsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : conflicts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileWarning className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No cannibalization issues found</p>
              <p className="text-sm mt-1">Run a scan to detect keyword conflicts across your pages</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Primary Page</TableHead>
                    <TableHead>Conflicting Page</TableHead>
                    <TableHead className="text-center">Positions</TableHead>
                    <TableHead className="text-center">Volume</TableHead>
                    <TableHead className="text-center">Severity</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conflicts.map((conflict) => (
                    <TableRow 
                      key={conflict.id} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => {
                        setSelectedConflict(conflict);
                        setNotes(conflict.notes || "");
                        setIsDetailsOpen(true);
                      }}
                      data-testid={`row-conflict-${conflict.id}`}
                    >
                      <TableCell className="font-medium max-w-[180px]">
                        <div className="truncate" title={conflict.keyword}>
                          {conflict.keyword}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px]">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground truncate" title={conflict.primaryUrl}>
                          {formatUrl(conflict.primaryUrl)}
                          <span className="text-green-600 font-medium">#{conflict.primaryPosition}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px]">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground truncate" title={conflict.conflictingUrl}>
                          {formatUrl(conflict.conflictingUrl)}
                          <span className="text-orange-600 font-medium">#{conflict.conflictingPosition}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-green-600 font-medium">{conflict.primaryPosition}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-orange-600 font-medium">{conflict.conflictingPosition}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {conflict.searchVolume?.toLocaleString() || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getSeverityColor(conflict.severity)}>
                          {conflict.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getStatusColor(conflict.status)}>
                          {conflict.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${conflict.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedConflict(conflict);
                                setNotes(conflict.notes || "");
                                setIsDetailsOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                promoteMutation.mutate(conflict.id);
                              }}
                            >
                              <ArrowUpRight className="h-4 w-4 mr-2" />
                              Promote to Recommendation
                            </DropdownMenuItem>
                            {conflict.status === "active" && (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({ id: conflict.id, status: "resolved" });
                                  }}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Mark Resolved
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({ id: conflict.id, status: "ignored" });
                                  }}
                                >
                                  <EyeOff className="h-4 w-4 mr-2" />
                                  Ignore
                                </DropdownMenuItem>
                              </>
                            )}
                            {conflict.status !== "active" && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatusMutation.mutate({ id: conflict.id, status: "active" });
                                }}
                              >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Reopen
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-orange-500" />
              Cannibalization Details
            </DialogTitle>
            <DialogDescription>
              Review conflict details and take action
            </DialogDescription>
          </DialogHeader>
          {selectedConflict && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Keyword</p>
                  <p className="font-medium">{selectedConflict.keyword}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Search Volume</p>
                  <p className="font-medium">{selectedConflict.searchVolume?.toLocaleString() || "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-green-600 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Primary Page (#{selectedConflict.primaryPosition})
                  </p>
                  <a
                    href={selectedConflict.primaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1 break-all"
                  >
                    {formatUrl(selectedConflict.primaryUrl)}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-600 mb-1 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    Conflicting Page (#{selectedConflict.conflictingPosition})
                  </p>
                  <a
                    href={selectedConflict.conflictingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1 break-all"
                  >
                    {formatUrl(selectedConflict.conflictingUrl)}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              </div>

              {selectedConflict.suggestedAction && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
                    <Lightbulb className="h-4 w-4" />
                    Suggested Action
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-300">
                    {selectedConflict.suggestedAction}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                <Textarea
                  placeholder="Add notes about this conflict..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  data-testid="textarea-notes"
                />
              </div>

              <div className="flex items-center gap-2">
                <Badge className={getSeverityColor(selectedConflict.severity)}>
                  {selectedConflict.severity} severity
                </Badge>
                <Badge className={getStatusColor(selectedConflict.status)}>
                  {selectedConflict.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Detected: {new Date(selectedConflict.detectedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedConflict && notes !== selectedConflict.notes) {
                  updateStatusMutation.mutate({ 
                    id: selectedConflict.id, 
                    status: selectedConflict.status,
                    notes 
                  });
                } else {
                  setIsDetailsOpen(false);
                }
              }}
              data-testid="button-save-notes"
            >
              {notes !== selectedConflict?.notes ? "Save Notes" : "Close"}
            </Button>
            {selectedConflict?.status === "active" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate({ id: selectedConflict.id, status: "ignored", notes })}
                  data-testid="button-ignore"
                >
                  <EyeOff className="h-4 w-4 mr-2" />
                  Ignore
                </Button>
                <Button
                  onClick={() => updateStatusMutation.mutate({ id: selectedConflict.id, status: "resolved", notes })}
                  data-testid="button-resolve"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Resolved
                </Button>
              </>
            )}
            {selectedConflict && (
              <Button
                variant="default"
                onClick={() => {
                  promoteMutation.mutate(selectedConflict.id);
                  setIsDetailsOpen(false);
                }}
                data-testid="button-promote"
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Promote to Recommendation
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
