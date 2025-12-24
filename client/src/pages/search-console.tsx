import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Search,
  RefreshCw,
  Link2,
  Unlink,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Globe,
  Loader2,
  FileSearch,
  TrendingUp,
  MousePointer,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import type { Project, GscQueryStats, GscUrlInspection } from "@shared/schema";

interface GscStatus {
  connected: boolean;
  isConnected?: boolean;
  siteUrl?: string;
  tokenExpired?: boolean;
  lastSyncAt?: string | null;
  syncErrorMessage?: string | null;
}

interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

interface GscSummary {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  topPages: Array<{ page: string; clicks: number; impressions: number; position: number }>;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
}

function formatPercent(num: number): string {
  return `${(num * 100).toFixed(2)}%`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "Never";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getIndexStatusBadge(status: string | null) {
  if (!status) return <Badge variant="secondary">Unknown</Badge>;
  
  switch (status.toLowerCase()) {
    case "indexed":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Indexed</Badge>;
    case "submitted_and_indexed":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Indexed</Badge>;
    case "not_indexed":
    case "excluded":
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />Not Indexed</Badge>;
    case "discovered":
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><AlertTriangle className="w-3 h-3 mr-1" />Discovered</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function SearchConsolePage() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [siteUrl, setSiteUrl] = useState("");
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [inspectUrl, setInspectUrl] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: projectsData, isLoading: projectsLoading } = useQuery<{ projects?: Project[] }>({
    queryKey: ["/api/projects"],
  });

  const projects = projectsData?.projects || (Array.isArray(projectsData) ? projectsData : []);

  const { data: gscStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<GscStatus>({
    queryKey: [`/api/gsc/status?projectId=${selectedProjectId}`],
    enabled: !!selectedProjectId,
  });

  const { data: gscSummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<GscSummary>({
    queryKey: [`/api/gsc/summary?projectId=${selectedProjectId}`],
    enabled: !!selectedProjectId && gscStatus?.connected && gscStatus?.isConnected,
  });

  const { data: queriesData, isLoading: queriesLoading } = useQuery<{ stats: GscQueryStats[] }>({
    queryKey: [`/api/gsc/queries?projectId=${selectedProjectId}`],
    enabled: !!selectedProjectId && gscStatus?.connected && gscStatus?.isConnected,
  });

  const { data: inspectionsData, isLoading: inspectionsLoading, refetch: refetchInspections } = useQuery<{ inspections: GscUrlInspection[] }>({
    queryKey: [`/api/gsc/inspections?projectId=${selectedProjectId}`],
    enabled: !!selectedProjectId && gscStatus?.connected && gscStatus?.isConnected,
  });

  // Fetch available GSC sites for the connected account
  const { data: sitesData, isLoading: sitesLoading, refetch: refetchSites } = useQuery<{ sites: GscSite[]; error?: string }>({
    queryKey: [`/api/gsc/sites?projectId=${selectedProjectId}`],
    enabled: !!selectedProjectId && gscStatus?.connected,
  });

  const getAuthUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/gsc/auth-url?projectId=${selectedProjectId}&siteUrl=${encodeURIComponent(siteUrl)}`);
      return response.json();
    },
    onSuccess: (result: { authUrl?: string; error?: string }) => {
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        return;
      }
      if (result.authUrl) {
        window.location.href = result.authUrl;
      }
    },
    onError: (error) => {
      toast({ title: "Failed to start connection", description: String(error), variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/gsc/disconnect?projectId=${selectedProjectId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Disconnect failed" }));
        throw new Error(errorData.error || `Disconnect failed: ${response.status}`);
      }
      // Handle 204 No Content or empty responses
      const contentLength = response.headers.get("content-length");
      if (response.status === 204 || contentLength === "0" || !contentLength) {
        return { success: true };
      }
      return response.json().catch(() => ({ success: true }));
    },
    onSuccess: () => {
      toast({ title: "Disconnected from Google Search Console" });
      queryClient.invalidateQueries({ queryKey: [`/api/gsc/status?projectId=${selectedProjectId}`] });
    },
    onError: (error) => {
      toast({ title: "Failed to disconnect", description: String(error), variant: "destructive" });
    },
  });

  // Reconnect handler: disconnect using mutation then open connect dialog
  const handleReconnect = async () => {
    // Store current site URL before disconnect clears state
    const previousSiteUrl = gscStatus?.siteUrl || "";
    try {
      await disconnectMutation.mutateAsync();
      // On success, prefill and open connect dialog
      setSiteUrl(previousSiteUrl);
      setIsConnectDialogOpen(true);
    } catch {
      // Error already handled by mutation's onError
    }
  };

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/gsc/sync", { projectId: selectedProjectId, daysBack: 7 });
      return response.json();
    },
    onSuccess: (result: { synced: number; errors: number }) => {
      toast({ title: "Sync completed", description: `Synced ${result.synced} records` });
      queryClient.invalidateQueries({ queryKey: [`/api/gsc/summary?projectId=${selectedProjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/gsc/queries?projectId=${selectedProjectId}`] });
      refetchStatus();
    },
    onError: (error) => {
      toast({ title: "Sync failed", description: String(error), variant: "destructive" });
    },
  });

  const inspectMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/gsc/inspect", { projectId: selectedProjectId, url });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "URL inspected successfully" });
      setInspectUrl("");
      refetchInspections();
    },
    onError: (error) => {
      toast({ title: "Inspection failed", description: String(error), variant: "destructive" });
    },
  });

  const updateSiteUrlMutation = useMutation({
    mutationFn: async (newSiteUrl: string) => {
      const response = await apiRequest("PATCH", `/api/gsc/site-url?projectId=${selectedProjectId}`, { siteUrl: newSiteUrl });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Site URL updated", description: "Syncing data with new site..." });
      queryClient.invalidateQueries({ queryKey: [`/api/gsc/status?projectId=${selectedProjectId}`] });
      // Trigger a sync after changing site URL
      syncMutation.mutate();
    },
    onError: (error) => {
      toast({ title: "Failed to update site URL", description: String(error), variant: "destructive" });
    },
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gscSuccess = urlParams.get("gsc_success");
    const gscError = urlParams.get("gsc_error");
    const projectFromUrl = urlParams.get("project");

    if (gscSuccess && projectFromUrl) {
      toast({ title: "Connected to Google Search Console" });
      setSelectedProjectId(projectFromUrl);
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (gscError) {
      const errorMessages: Record<string, string> = {
        auth_denied: "Authorization was denied",
        missing_params: "Missing required parameters",
        invalid_state: "Invalid state parameter",
        token_exchange_failed: "Failed to exchange token",
        callback_failed: "Callback failed",
      };
      toast({ 
        title: "Connection failed", 
        description: errorMessages[gscError] || gscError, 
        variant: "destructive" 
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  if (projectsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Google Search Console</h1>
          <p className="text-muted-foreground">View search performance and indexing status</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[240px]" data-testid="select-project">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project: Project) => (
                <SelectItem key={project.id} value={project.id} data-testid={`project-option-${project.id}`}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProjectId && gscStatus?.connected && (
            <Button
              variant="outline"
              onClick={() => { refetchStatus(); refetchSummary(); }}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {!selectedProjectId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Select a project to view Search Console data
            </p>
          </CardContent>
        </Card>
      ) : statusLoading ? (
        <Skeleton className="h-[400px] w-full" />
      ) : !gscStatus?.connected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Globe className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Connect Google Search Console</p>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Link your Google Search Console account to see search performance, indexing status, and more.
            </p>
            <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-connect">
                  <Link2 className="w-4 h-4 mr-2" />
                  Connect Search Console
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect Google Search Console</DialogTitle>
                  <DialogDescription>
                    Enter your website URL as it appears in Search Console
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Site URL</Label>
                    <Input
                      placeholder="https://example.com/"
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                      data-testid="input-site-url"
                    />
                    <p className="text-sm text-muted-foreground">
                      Use the exact URL format from your Search Console property
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsConnectDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => getAuthUrlMutation.mutate()}
                    disabled={!siteUrl || getAuthUrlMutation.isPending}
                    data-testid="button-authorize"
                  >
                    {getAuthUrlMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Authorize with Google
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <div>
                <CardTitle className="text-lg">Connection Status</CardTitle>
                <CardDescription>{gscStatus.siteUrl}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {gscStatus.tokenExpired ? (
                  <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Token Expired
                  </Badge>
                ) : (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  data-testid="button-sync"
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Sync Data
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect"
                >
                  <Unlink className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Token Expired Alert - Prominent Warning */}
              {gscStatus.tokenExpired && (
                <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10" data-testid="alert-token-expired">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-700 dark:text-yellow-500">Authentication Required</AlertTitle>
                  <AlertDescription className="text-yellow-600 dark:text-yellow-400">
                    <p className="mb-3">
                      Your Google Search Console access token has expired. This happens when the token hasn't been 
                      refreshed for an extended period. Click below to reconnect your account.
                    </p>
                    <Button 
                      size="sm" 
                      onClick={handleReconnect}
                      disabled={disconnectMutation.isPending}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      data-testid="button-reconnect-gsc"
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4 mr-2" />
                      )}
                      {disconnectMutation.isPending ? "Reconnecting..." : "Reconnect Now"}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-sm text-muted-foreground">
                Last synced: {formatDate(gscStatus.lastSyncAt || null)}
              </p>
              
              {/* Site Selector */}
              {sitesData?.sites && sitesData.sites.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                  <Label className="text-sm font-medium">Switch Property:</Label>
                  <Select 
                    value={gscStatus.siteUrl || ""} 
                    onValueChange={(value) => {
                      if (value && value !== gscStatus.siteUrl) {
                        updateSiteUrlMutation.mutate(value);
                      }
                    }}
                    disabled={updateSiteUrlMutation.isPending}
                  >
                    <SelectTrigger className="w-[300px]" data-testid="select-gsc-site">
                      <SelectValue placeholder="Select a site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sitesData.sites.map((site) => (
                        <SelectItem 
                          key={site.siteUrl} 
                          value={site.siteUrl}
                          data-testid={`site-option-${site.siteUrl}`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{site.siteUrl}</span>
                            <Badge variant="outline" className="text-xs">
                              {site.permissionLevel === "siteFullUser" ? "Full Access" : 
                               site.permissionLevel === "siteOwner" ? "Owner" :
                               site.permissionLevel === "siteUnverifiedUser" ? "Unverified" : 
                               site.permissionLevel}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {updateSiteUrlMutation.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}

              {/* Error Message Display */}
              {gscStatus.syncErrorMessage && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Sync Error</p>
                    <p className="text-sm text-destructive/80">{gscStatus.syncErrorMessage}</p>
                    {gscStatus.syncErrorMessage.includes("permission") && sitesData?.sites && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Try switching to a property with "Full Access" above.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview" data-testid="tab-overview">
                <BarChart3 className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="queries" data-testid="tab-queries">
                <Search className="w-4 h-4 mr-2" />
                Top Queries
              </TabsTrigger>
              <TabsTrigger value="pages" data-testid="tab-pages">
                <FileSearch className="w-4 h-4 mr-2" />
                Top Pages
              </TabsTrigger>
              <TabsTrigger value="indexing" data-testid="tab-indexing">
                <Eye className="w-4 h-4 mr-2" />
                URL Inspection
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              {summaryLoading ? (
                <div className="grid grid-cols-4 gap-4">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : gscSummary ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Clicks</p>
                          <p className="text-2xl font-bold" data-testid="text-total-clicks">
                            {formatNumber(gscSummary.totalClicks)}
                          </p>
                        </div>
                        <MousePointer className="w-8 h-8 text-primary opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Impressions</p>
                          <p className="text-2xl font-bold" data-testid="text-total-impressions">
                            {formatNumber(gscSummary.totalImpressions)}
                          </p>
                        </div>
                        <Eye className="w-8 h-8 text-primary opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Average CTR</p>
                          <p className="text-2xl font-bold" data-testid="text-avg-ctr">
                            {formatPercent(gscSummary.avgCtr)}
                          </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-primary opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Average Position</p>
                          <p className="text-2xl font-bold" data-testid="text-avg-position">
                            {gscSummary.avgPosition.toFixed(1)}
                          </p>
                        </div>
                        <BarChart3 className="w-8 h-8 text-primary opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No data available. Try syncing to fetch latest data.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="queries" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Top Search Queries</CardTitle>
                  <CardDescription>Queries that brought users to your site</CardDescription>
                </CardHeader>
                <CardContent>
                  {summaryLoading ? (
                    <Skeleton className="h-64" />
                  ) : gscSummary?.topQueries && gscSummary.topQueries.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Query</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">Position</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gscSummary.topQueries.map((query, index) => (
                          <TableRow key={index} data-testid={`row-query-${index}`}>
                            <TableCell className="font-medium">{query.query}</TableCell>
                            <TableCell className="text-right">{formatNumber(query.clicks)}</TableCell>
                            <TableCell className="text-right">{formatNumber(query.impressions)}</TableCell>
                            <TableCell className="text-right">{query.position.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">No query data available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pages" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Top Pages</CardTitle>
                  <CardDescription>Pages with the most search traffic</CardDescription>
                </CardHeader>
                <CardContent>
                  {summaryLoading ? (
                    <Skeleton className="h-64" />
                  ) : gscSummary?.topPages && gscSummary.topPages.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Page</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">Position</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gscSummary.topPages.map((page, index) => (
                          <TableRow key={index} data-testid={`row-page-${index}`}>
                            <TableCell className="font-medium max-w-xs truncate">{page.page}</TableCell>
                            <TableCell className="text-right">{formatNumber(page.clicks)}</TableCell>
                            <TableCell className="text-right">{formatNumber(page.impressions)}</TableCell>
                            <TableCell className="text-right">{page.position.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">No page data available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="indexing" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>URL Inspection</CardTitle>
                    <CardDescription>Check indexing status of your URLs</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Enter URL to inspect..."
                      value={inspectUrl}
                      onChange={(e) => setInspectUrl(e.target.value)}
                      className="w-[300px]"
                      data-testid="input-inspect-url"
                    />
                    <Button
                      onClick={() => inspectMutation.mutate(inspectUrl)}
                      disabled={!inspectUrl || inspectMutation.isPending}
                      data-testid="button-inspect"
                    >
                      {inspectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4 mr-2" />
                      )}
                      Inspect
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {inspectionsLoading ? (
                    <Skeleton className="h-64" />
                  ) : inspectionsData?.inspections && inspectionsData.inspections.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>URL</TableHead>
                          <TableHead>Indexing Status</TableHead>
                          <TableHead>Coverage</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>Last Crawled</TableHead>
                          <TableHead>Inspected</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inspectionsData.inspections.map((inspection) => (
                          <TableRow key={inspection.id} data-testid={`row-inspection-${inspection.id}`}>
                            <TableCell className="font-medium max-w-xs truncate">{inspection.url}</TableCell>
                            <TableCell>{getIndexStatusBadge(inspection.indexingStatus)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{inspection.coverageState || "Unknown"}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{inspection.mobileUsability || "Unknown"}</Badge>
                            </TableCell>
                            <TableCell>{formatDate(inspection.lastCrawlTime)}</TableCell>
                            <TableCell>{formatDate(inspection.lastInspectedAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      No URL inspections yet. Enter a URL above to check its indexing status.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
