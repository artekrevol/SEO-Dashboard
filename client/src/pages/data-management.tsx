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
import { Trash2, Plus, Settings, FileText, Globe, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DataManagementProps {
  projectId: string | null;
}

export function DataManagementPage({ projectId }: DataManagementProps) {
  const { toast } = useToast();
  const [selectedKeywords, setSelectedKeywords] = useState<number[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [filterIntent, setFilterIntent] = useState<string>("all");
  const [newPageUrl, setNewPageUrl] = useState<string>("");

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
  
  const filteredKeywords = keywordItems.filter((k: any) => {
    if (filterIntent !== "all" && k.intent !== filterIntent) return false;
    return true;
  });

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

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-data-management-title">
          Data Management
        </h1>
        <p className="text-muted-foreground">
          Manage keywords and pages for your SEO tracking.
        </p>
      </div>

      <Tabs defaultValue="keywords" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="keywords" data-testid="tab-keywords" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Keywords ({keywordItems.length})
          </TabsTrigger>
          <TabsTrigger value="pages" data-testid="tab-pages" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Pages ({pageItems.length})
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
                          <TableHead>Position</TableHead>
                          <TableHead>Difficulty</TableHead>
                          <TableHead>Intent</TableHead>
                          <TableHead>Search Volume</TableHead>
                          <TableHead>Opportunity</TableHead>
                          <TableHead className="w-20 text-right">Actions</TableHead>
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
                          <TableHead>Avg Position</TableHead>
                          <TableHead>Keywords in Top 10</TableHead>
                          <TableHead>Indexable</TableHead>
                          <TableHead>Schema</TableHead>
                          <TableHead>Core Web Vitals</TableHead>
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
                            <TableCell data-testid={`text-avg-position-${page.id}`}>
                              {page.avgPosition > 0 ? page.avgPosition.toFixed(1) : "-"}
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
                            <TableCell>
                              <Badge
                                variant={page.hasSchema ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {page.hasSchema ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={page.coreWebVitalsOk ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {page.coreWebVitalsOk ? "Pass" : "Unknown"}
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
      </Tabs>
    </div>
  );
}
