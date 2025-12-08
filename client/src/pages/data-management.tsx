import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Plus, Settings, FileText, Globe, ExternalLink, Users, TrendingUp, Search, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DataManagementProps {
  projectId: string | null;
}

export function DataManagementPage({ projectId }: DataManagementProps) {
  const { toast } = useToast();
  const [selectedKeywords, setSelectedKeywords] = useState<number[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [filterIntent, setFilterIntent] = useState<string>("all");
  const [newPageUrl, setNewPageUrl] = useState<string>("");
  const [competitorSearch, setCompetitorSearch] = useState<string>("");
  const [newKeyword, setNewKeyword] = useState<string>("");
  const [newKeywordUrl, setNewKeywordUrl] = useState<string>("");
  const [newCompetitorDomain, setNewCompetitorDomain] = useState<string>("");
  const [editUrlKeyword, setEditUrlKeyword] = useState<{ id: number; keyword: string; currentUrl: string } | null>(null);
  const [editTargetUrl, setEditTargetUrl] = useState<string>("");

  const { data: keywords, isLoading: keywordsLoading } = useQuery({
    queryKey: ["/api/dashboard/keywords", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/keywords?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch keywords");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: pages, isLoading: pagesLoading } = useQuery({
    queryKey: ["/api/dashboard/pages", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/pages?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch pages");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: competitors, isLoading: competitorsLoading } = useQuery({
    queryKey: ["/api/competitors/summary", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/competitors/summary?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch competitors");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: project } = useQuery({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      return data.projects?.find((p: any) => p.id === projectId);
    },
    enabled: !!projectId,
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/keywords/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/keywords", { projectId }] });
      toast({
        title: "Keyword deleted",
        description: "The keyword has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete keyword.",
        variant: "destructive",
      });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/pages/${id}?projectId=${projectId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete page");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pages", { projectId }] });
      toast({
        title: "Page deleted",
        description: "The page has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete page.",
        variant: "destructive",
      });
    },
  });

  const deleteCompetitorMutation = useMutation({
    mutationFn: async (domain: string) => {
      const response = await fetch(`/api/competitors/${encodeURIComponent(domain)}?projectId=${projectId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete competitor");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitors/summary", { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/competitors", { projectId }] });
      toast({
        title: "Competitor removed",
        description: data.message || "The competitor has been removed from tracking.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove competitor.",
        variant: "destructive",
      });
    },
  });

  const bulkDeletePagesMutation = useMutation({
    mutationFn: async (pageIds: number[]) => {
      return await apiRequest("DELETE", "/api/pages/bulk", { projectId, pageIds });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pages", { projectId }] });
      setSelectedPages([]);
      toast({
        title: "Pages deleted",
        description: `${data.deletedCount} page(s) have been removed.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete pages.",
        variant: "destructive",
      });
    },
  });

  const addPageMutation = useMutation({
    mutationFn: async (url: string) => {
      return await apiRequest("POST", "/api/pages", { projectId, url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pages", { projectId }] });
      setNewPageUrl("");
      toast({
        title: "Page added",
        description: "The page has been added for tracking.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add page. Make sure it's a valid URL.",
        variant: "destructive",
      });
    },
  });

  const addKeywordMutation = useMutation({
    mutationFn: async ({ keyword, targetUrl }: { keyword: string; targetUrl?: string }) => {
      return await apiRequest("POST", "/api/keywords", { 
        projectId, 
        keyword,
        targetUrl: targetUrl || null,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/keywords", { projectId }] });
      setNewKeyword("");
      setNewKeywordUrl("");
      toast({
        title: "Keyword added",
        description: "The keyword has been added for tracking.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add keyword.",
        variant: "destructive",
      });
    },
  });

  const updateKeywordUrlMutation = useMutation({
    mutationFn: async ({ keywordId, targetUrl }: { keywordId: number; targetUrl: string | null }) => {
      return await apiRequest("PATCH", `/api/keywords/${keywordId}`, { targetUrl });
    },
    onSuccess: () => {
      // Invalidate all keyword queries to ensure data is refreshed
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/keywords"], exact: false });
      setEditUrlKeyword(null);
      setEditTargetUrl("");
      toast({
        title: "Target URL updated",
        description: "The keyword's target URL has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update target URL.",
        variant: "destructive",
      });
    },
  });

  const openEditUrlDialog = (keyword: any) => {
    setEditUrlKeyword({
      id: keyword.keywordId,
      keyword: keyword.keyword,
      currentUrl: keyword.url || "",
    });
    setEditTargetUrl(keyword.url || "");
  };

  const handleSaveTargetUrl = () => {
    if (!editUrlKeyword) return;
    updateKeywordUrlMutation.mutate({
      keywordId: editUrlKeyword.id,
      targetUrl: editTargetUrl.trim() || null,
    });
  };

  const addCompetitorMutation = useMutation({
    mutationFn: async (domain: string) => {
      return await apiRequest("POST", "/api/competitors", { projectId, domain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitors/summary", { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/competitors", { projectId }] });
      setNewCompetitorDomain("");
      toast({
        title: "Competitor added",
        description: "The competitor has been added for tracking.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add competitor. Make sure the domain is valid.",
        variant: "destructive",
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: any) => {
      return await apiRequest("PATCH", "/api/data/keywords/bulk", {
        keywordIds: selectedKeywords,
        updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/keywords", { projectId }] });
      setSelectedKeywords([]);
      toast({
        title: "Keywords updated",
        description: `${selectedKeywords.length} keywords have been updated.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update keywords.",
        variant: "destructive",
      });
    },
  });

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Settings className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Project Selected</h2>
          <p className="mt-2 text-muted-foreground">Select a project to manage data.</p>
        </div>
      </div>
    );
  }

  const keywordItems = keywords?.items || [];
  const pageItems = pages?.items || [];
  
  const projectDomain = project?.domain?.toLowerCase().replace(/^www\./, '') || '';
  const competitorItems = (competitors?.competitors || []).filter((c: any) => {
    const competitorDomain = c.competitorDomain.toLowerCase().replace(/^www\./, '');
    return competitorDomain !== projectDomain && 
           competitorDomain !== 'tekrevol.com' &&
           !competitorDomain.includes('tekrevol');
  });
  
  const filteredKeywords = keywordItems.filter((k: any) => {
    if (filterIntent !== "all" && k.intent !== filterIntent) return false;
    return true;
  });

  const filteredCompetitors = competitorItems.filter((c: any) =>
    c.competitorDomain.toLowerCase().includes(competitorSearch.toLowerCase())
  );

  const handleSelectKeyword = (id: number) => {
    setSelectedKeywords((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllKeywords = () => {
    if (selectedKeywords.length === filteredKeywords.length) {
      setSelectedKeywords([]);
    } else {
      setSelectedKeywords(filteredKeywords.map((k: any) => k.keywordId));
    }
  };

  const handleSelectPage = (id: number) => {
    setSelectedPages((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllPages = () => {
    if (selectedPages.length === pageItems.length) {
      setSelectedPages([]);
    } else {
      setSelectedPages(pageItems.map((p: any) => p.id));
    }
  };

  const handleSelectCompetitor = (domain: string) => {
    setSelectedCompetitors((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const handleSelectAllCompetitors = () => {
    if (selectedCompetitors.length === filteredCompetitors.length) {
      setSelectedCompetitors([]);
    } else {
      setSelectedCompetitors(filteredCompetitors.map((c: any) => c.competitorDomain));
    }
  };

  const handleAddPage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPageUrl.trim()) {
      addPageMutation.mutate(newPageUrl.trim());
    }
  };

  const handleBulkDeletePages = () => {
    if (window.confirm(`Delete ${selectedPages.length} pages?`)) {
      bulkDeletePagesMutation.mutate(selectedPages);
    }
  };

  const handleBulkDeleteCompetitors = () => {
    if (window.confirm(`Remove ${selectedCompetitors.length} competitors from tracking?`)) {
      selectedCompetitors.forEach((domain) => deleteCompetitorMutation.mutate(domain));
      setSelectedCompetitors([]);
    }
  };

  const getPressureColor = (index: number) => {
    if (index >= 60) return "bg-red-500";
    if (index >= 30) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-data-management-title">
          Data Management
        </h1>
        <p className="text-muted-foreground">
          Manage keywords, pages, and competitors for your SEO tracking.
        </p>
      </div>

      <Tabs defaultValue="keywords" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="keywords" data-testid="tab-keywords" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Keywords ({keywordItems.length})
          </TabsTrigger>
          <TabsTrigger value="pages" data-testid="tab-pages" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Pages ({pageItems.length})
          </TabsTrigger>
          <TabsTrigger value="competitors" data-testid="tab-competitors" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Competitors ({competitorItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keywords" className="mt-6 space-y-4">
          {keywordsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-96" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Add New Keyword</CardTitle>
                </CardHeader>
                <CardContent>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newKeyword.trim()) {
                        addKeywordMutation.mutate({ 
                          keyword: newKeyword.trim(), 
                          targetUrl: newKeywordUrl.trim() || undefined 
                        });
                      }
                    }} 
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                  >
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Keyword</label>
                      <Input
                        placeholder="Enter keyword to track..."
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        data-testid="input-new-keyword"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Target URL (optional)</label>
                      <Input
                        type="url"
                        placeholder="https://www.example.com/page"
                        value={newKeywordUrl}
                        onChange={(e) => setNewKeywordUrl(e.target.value)}
                        data-testid="input-new-keyword-url"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={addKeywordMutation.isPending || !newKeyword.trim()}
                      data-testid="button-add-keyword"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Keyword
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Filters</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                  <div className="flex-1 max-w-xs">
                    <label className="text-xs text-muted-foreground">Intent</label>
                    <Select value={filterIntent} onValueChange={setFilterIntent}>
                      <SelectTrigger data-testid="select-filter-intent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Intents</SelectItem>
                        <SelectItem value="informational">Informational</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="transactional">Transactional</SelectItem>
                        <SelectItem value="navigational">Navigational</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {selectedKeywords.length > 0 && (
                <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      {selectedKeywords.length} keyword{selectedKeywords.length !== 1 ? "s" : ""} selected
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => bulkUpdateMutation.mutate({ isActive: true })}
                      disabled={bulkUpdateMutation.isPending}
                      data-testid="button-bulk-activate"
                    >
                      Activate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => bulkUpdateMutation.mutate({ isActive: false })}
                      disabled={bulkUpdateMutation.isPending}
                      data-testid="button-bulk-deactivate"
                    >
                      Deactivate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm(`Delete ${selectedKeywords.length} keywords?`)) {
                          selectedKeywords.forEach((id) => deleteKeywordMutation.mutate(id));
                        }
                      }}
                      disabled={deleteKeywordMutation.isPending}
                      data-testid="button-bulk-delete"
                    >
                      Delete
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedKeywords.length === filteredKeywords.length && filteredKeywords.length > 0}
                              onCheckedChange={handleSelectAllKeywords}
                              data-testid="checkbox-select-all-keywords"
                            />
                          </TableHead>
                          <TableHead>Keyword</TableHead>
                          <TableHead>Target URL</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Difficulty</TableHead>
                          <TableHead>Intent</TableHead>
                          <TableHead>Search Volume</TableHead>
                          <TableHead>Opportunity</TableHead>
                          <TableHead className="w-24 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredKeywords.map((keyword: any) => (
                          <TableRow key={keyword.keywordId} data-testid={`row-keyword-${keyword.keywordId}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedKeywords.includes(keyword.keywordId)}
                                onCheckedChange={() => handleSelectKeyword(keyword.keywordId)}
                                data-testid={`checkbox-keyword-${keyword.keywordId}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{keyword.keyword}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 max-w-[200px]">
                                {keyword.url ? (
                                  <a
                                    href={keyword.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground hover:text-foreground truncate"
                                    data-testid={`link-url-${keyword.keywordId}`}
                                  >
                                    {keyword.url.replace(/^https?:\/\//, "")}
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">No URL</span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 flex-shrink-0"
                                  onClick={() => openEditUrlDialog(keyword)}
                                  data-testid={`button-edit-url-${keyword.keywordId}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span data-testid={`text-position-${keyword.keywordId}`}>{keyword.currentPosition}</span>
                                {keyword.positionDelta !== 0 && (
                                  <Badge
                                    variant={keyword.positionDelta > 0 ? "secondary" : "destructive"}
                                    className="text-xs"
                                  >
                                    {keyword.positionDelta > 0 ? "+" : ""}{keyword.positionDelta}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span data-testid={`text-difficulty-${keyword.keywordId}`}>{keyword.difficulty}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {keyword.intent}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`text-volume-${keyword.keywordId}`}>
                              {keyword.searchVolume.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <span data-testid={`text-opportunity-${keyword.keywordId}`}>
                                {parseFloat(keyword.opportunityScore).toFixed(0)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteKeywordMutation.mutate(keyword.keywordId)}
                                disabled={deleteKeywordMutation.isPending}
                                data-testid={`button-delete-keyword-${keyword.keywordId}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {filteredKeywords.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No keywords found</p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="pages" className="mt-6 space-y-4">
          {pagesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-96" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Add New Page</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddPage} className="flex gap-2">
                    <Input
                      type="url"
                      placeholder="https://www.example.com/page"
                      value={newPageUrl}
                      onChange={(e) => setNewPageUrl(e.target.value)}
                      className="flex-1"
                      data-testid="input-new-page-url"
                    />
                    <Button
                      type="submit"
                      disabled={addPageMutation.isPending || !newPageUrl.trim()}
                      data-testid="button-add-page"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Page
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {selectedPages.length > 0 && (
                <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      {selectedPages.length} page{selectedPages.length !== 1 ? "s" : ""} selected
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBulkDeletePages}
                      disabled={bulkDeletePagesMutation.isPending}
                      data-testid="button-bulk-delete-pages"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedPages.length === pageItems.length && pageItems.length > 0}
                              onCheckedChange={handleSelectAllPages}
                              data-testid="checkbox-select-all-pages"
                            />
                          </TableHead>
                          <TableHead>URL</TableHead>
                          <TableHead>Total Keywords</TableHead>
                          <TableHead>Ranked</TableHead>
                          <TableHead>Avg Position</TableHead>
                          <TableHead>Top 3</TableHead>
                          <TableHead>Top 10</TableHead>
                          <TableHead>Indexable</TableHead>
                          <TableHead className="w-20 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageItems.map((page: any) => (
                          <TableRow key={page.id} data-testid={`row-page-${page.id}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedPages.includes(page.id)}
                                onCheckedChange={() => handleSelectPage(page.id)}
                                data-testid={`checkbox-page-${page.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium max-w-md">
                              <div className="flex items-center gap-2">
                                <span className="truncate" title={page.url}>
                                  {page.url.replace(/^https?:\/\//, "")}
                                </span>
                                <a
                                  href={page.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </TableCell>
                            <TableCell data-testid={`text-total-keywords-${page.id}`}>
                              {page.totalKeywords || 0}
                            </TableCell>
                            <TableCell data-testid={`text-ranked-${page.id}`}>
                              {page.rankedKeywords || 0}
                            </TableCell>
                            <TableCell data-testid={`text-avg-position-${page.id}`}>
                              {page.avgPosition > 0 ? page.avgPosition.toFixed(1) : "-"}
                            </TableCell>
                            <TableCell data-testid={`text-top3-${page.id}`}>
                              {page.keywordsInTop3 || 0}
                            </TableCell>
                            <TableCell data-testid={`text-top10-${page.id}`}>
                              {page.keywordsInTop10 || 0}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={page.isIndexable ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {page.isIndexable ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deletePageMutation.mutate(page.id)}
                                disabled={deletePageMutation.isPending}
                                data-testid={`button-delete-page-${page.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {pageItems.length === 0 && (
                <div className="text-center py-12">
                  <Globe className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No pages tracked</h3>
                  <p className="mt-2 text-muted-foreground">Add pages to start tracking their SEO performance.</p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="competitors" className="mt-6 space-y-4">
          {competitorsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-96" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Add New Competitor</CardTitle>
                </CardHeader>
                <CardContent>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newCompetitorDomain.trim()) {
                        addCompetitorMutation.mutate(newCompetitorDomain.trim());
                      }
                    }} 
                    className="flex gap-2"
                  >
                    <Input
                      placeholder="competitor.com"
                      value={newCompetitorDomain}
                      onChange={(e) => setNewCompetitorDomain(e.target.value)}
                      className="flex-1"
                      data-testid="input-new-competitor"
                    />
                    <Button
                      type="submit"
                      disabled={addCompetitorMutation.isPending || !newCompetitorDomain.trim()}
                      data-testid="button-add-competitor"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Competitor
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Search Competitors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by domain..."
                      value={competitorSearch}
                      onChange={(e) => setCompetitorSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-competitor-search"
                    />
                  </div>
                </CardContent>
              </Card>

              {selectedCompetitors.length > 0 && (
                <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      {selectedCompetitors.length} competitor{selectedCompetitors.length !== 1 ? "s" : ""} selected
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBulkDeleteCompetitors}
                      disabled={deleteCompetitorMutation.isPending}
                      data-testid="button-bulk-delete-competitors"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Selected
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedCompetitors.length === filteredCompetitors.length && filteredCompetitors.length > 0}
                              onCheckedChange={handleSelectAllCompetitors}
                              data-testid="checkbox-select-all-competitors"
                            />
                          </TableHead>
                          <TableHead>Competitor Domain</TableHead>
                          <TableHead className="text-center">Shared Keywords</TableHead>
                          <TableHead className="text-center">Above Us</TableHead>
                          <TableHead className="text-center">Avg Position</TableHead>
                          <TableHead className="text-center">Total Volume</TableHead>
                          <TableHead className="w-[150px]">Pressure Index</TableHead>
                          <TableHead className="w-20 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCompetitors.map((competitor: any) => (
                          <TableRow key={competitor.competitorDomain} data-testid={`row-competitor-${competitor.competitorDomain}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedCompetitors.includes(competitor.competitorDomain)}
                                onCheckedChange={() => handleSelectCompetitor(competitor.competitorDomain)}
                                data-testid={`checkbox-competitor-${competitor.competitorDomain}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{competitor.competitorDomain}</span>
                                <a
                                  href={`https://${competitor.competitorDomain}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="font-mono">
                                {competitor.sharedKeywords}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "font-mono border-0",
                                  competitor.keywordsAboveUs > 0
                                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                )}
                              >
                                {competitor.keywordsAboveUs}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {competitor.avgCompetitorPosition.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {competitor.totalVolume.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-mono">{competitor.pressureIndex}</span>
                                </div>
                                <Progress
                                  value={competitor.pressureIndex}
                                  className="h-1.5"
                                  indicatorClassName={getPressureColor(competitor.pressureIndex)}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteCompetitorMutation.mutate(competitor.competitorDomain)}
                                disabled={deleteCompetitorMutation.isPending}
                                data-testid={`button-delete-competitor-${competitor.competitorDomain}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {filteredCompetitors.length === 0 && (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No competitors found</h3>
                  <p className="mt-2 text-muted-foreground">
                    {competitorSearch 
                      ? "No competitors match your search. Try a different term."
                      : "Run a rankings sync to discover competitors from SERP data."}
                  </p>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editUrlKeyword !== null} onOpenChange={(open) => !open && setEditUrlKeyword(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Target URL</DialogTitle>
            <DialogDescription>
              Set or update the target URL for "{editUrlKeyword?.keyword}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Target URL</label>
            <Input
              value={editTargetUrl}
              onChange={(e) => setEditTargetUrl(e.target.value)}
              placeholder="https://example.com/page"
              data-testid="input-edit-target-url-dm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Leave empty to clear the target URL. The URL should be a full URL including https://
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditUrlKeyword(null)}
              data-testid="button-cancel-edit-url-dm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTargetUrl}
              disabled={updateKeywordUrlMutation.isPending}
              data-testid="button-save-target-url-dm"
            >
              {updateKeywordUrlMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
