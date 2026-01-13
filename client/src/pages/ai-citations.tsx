import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  TrendingUp,
  TrendingDown,
  FileText,
  ExternalLink,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  MessageSquare,
  Globe,
  Sparkles,
} from "lucide-react";
import { SiGoogle, SiOpenai } from "react-icons/si";

interface AiCitationsPageProps {
  projectId: string | null;
}

interface LlmCitationSummary {
  brand: {
    totalMentions: number;
    aiSearchVolume: number;
    impressions: number;
    pagesCount: number;
    trend: number;
  };
  platforms: {
    google: {
      mentions: number;
      aiSearchVolume: number;
      impressions: number;
    };
    chatgpt: {
      mentions: number;
      aiSearchVolume: number;
      impressions: number;
    };
  };
  lastRun: string | null;
}

interface LlmCitationItem {
  id: number;
  question: string;
  answerExcerpt: string | null;
  citedUrl: string;
  citedDomain: string;
  citedPageTitle: string | null;
  sourceName: string | null;
  snippet: string | null;
  referencePosition: number;
  aiSearchVolume: number | null;
  impressions: number | null;
  platform: string;
  createdAt: string;
}

interface LlmCitationTopPage {
  id: number;
  url: string;
  domain: string;
  pageTitle: string | null;
  mentionsCount: number;
  aiSearchVolume: number | null;
  impressions: number | null;
  platform: string;
}

interface LlmCompetitor {
  id: number;
  domain: string;
  name: string;
  isActive: boolean;
}

interface CompetitorGap {
  competitorDomain: string;
  competitorName: string;
  mentionsCount: number;
  brandMentionsCount: number;
  gap: number;
  aiSearchVolume: number;
  platform: string;
}

export default function AiCitationsPage({ projectId }: AiCitationsPageProps) {
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<"all" | "google" | "chatgpt">("all");
  const [newCompetitorDomain, setNewCompetitorDomain] = useState("");
  const [isAddingCompetitor, setIsAddingCompetitor] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<LlmCitationItem | null>(null);

  const { data: summaryData, isLoading: summaryLoading } = useQuery<LlmCitationSummary>({
    queryKey: ["/api/llm-citations/summary", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/llm-citations/summary?projectId=${projectId}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery<{ items: LlmCitationItem[]; total: number }>({
    queryKey: ["/api/llm-citations/items", { projectId, platform: selectedPlatform }],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId: projectId! });
      if (selectedPlatform !== "all") params.append("platform", selectedPlatform);
      const res = await fetch(`/api/llm-citations/items?${params}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: topPagesData, isLoading: topPagesLoading } = useQuery<{ pages: LlmCitationTopPage[] }>({
    queryKey: ["/api/llm-citations/top-pages", { projectId, platform: selectedPlatform }],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId: projectId! });
      if (selectedPlatform !== "all") params.append("platform", selectedPlatform);
      const res = await fetch(`/api/llm-citations/top-pages?${params}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: gapsData, isLoading: gapsLoading } = useQuery<{ gaps: CompetitorGap[] }>({
    queryKey: ["/api/llm-citations/gaps", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/llm-citations/gaps?projectId=${projectId}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: competitorsData } = useQuery<{ competitors: LlmCompetitor[] }>({
    queryKey: ["/api/llm-citations/competitors", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/llm-citations/competitors?projectId=${projectId}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const syncCitationsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/crawls/trigger", { 
        projectId, 
        crawlType: "llm_citations",
        scope: "all",
      });
    },
    onSuccess: () => {
      toast({
        title: "AI citations sync started",
        description: "Fetching data from Google AI Overview and ChatGPT.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/summary", { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/items", { projectId }] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start AI citations sync.",
        variant: "destructive",
      });
    },
  });

  const addCompetitorMutation = useMutation({
    mutationFn: async (domain: string) => {
      return await apiRequest("POST", "/api/llm-citations/competitors", { projectId, domain });
    },
    onSuccess: () => {
      toast({ title: "Competitor added", description: "The competitor will be tracked in future crawls." });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/competitors", { projectId }] });
      setNewCompetitorDomain("");
      setIsAddingCompetitor(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add competitor.", variant: "destructive" });
    },
  });

  const deleteCompetitorMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/llm-citations/competitors/${id}`, {});
    },
    onSuccess: () => {
      toast({ title: "Competitor removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-citations/competitors", { projectId }] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove competitor.", variant: "destructive" });
    },
  });

  if (!projectId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Please select a project to view AI Citations.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = summaryData || {
    brand: { totalMentions: 0, aiSearchVolume: 0, impressions: 0, pagesCount: 0, trend: 0 },
    platforms: {
      google: { mentions: 0, aiSearchVolume: 0, impressions: 0 },
      chatgpt: { mentions: 0, aiSearchVolume: 0, impressions: 0 },
    },
    lastRun: null,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Citations</h1>
          <p className="text-muted-foreground">
            Track brand mentions across AI platforms like Google AI Overview and ChatGPT
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncCitationsMutation.mutate()}
            disabled={syncCitationsMutation.isPending}
            data-testid="button-sync-citations"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncCitationsMutation.isPending ? "animate-spin" : ""}`} />
            Sync AI Citations
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-mentions">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AI Mentions</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary.brand.totalMentions.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {summary.brand.trend > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : summary.brand.trend < 0 ? (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  ) : null}
                  <span className={summary.brand.trend > 0 ? "text-green-500" : summary.brand.trend < 0 ? "text-red-500" : ""}>
                    {summary.brand.trend > 0 ? "+" : ""}{summary.brand.trend}% vs last period
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-ai-search-volume">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Search Volume</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary.brand.aiSearchVolume.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Monthly AI-driven searches</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-impressions">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary.brand.impressions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Across all AI platforms</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-pages-cited">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pages Cited</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary.brand.pagesCount}</div>
                <p className="text-xs text-muted-foreground">Unique pages referenced</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-google-ai">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SiGoogle className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base">Google AI Overview</CardTitle>
            </div>
            <Badge variant="secondary">{summary.platforms.google.mentions} mentions</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">AI Search Volume</p>
                <p className="font-medium">{summary.platforms.google.aiSearchVolume.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Impressions</p>
                <p className="font-medium">{summary.platforms.google.impressions.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-chatgpt">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SiOpenai className="h-5 w-5" />
              <CardTitle className="text-base">ChatGPT</CardTitle>
            </div>
            <Badge variant="secondary">{summary.platforms.chatgpt.mentions} mentions</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">AI Search Volume</p>
                <p className="font-medium">{summary.platforms.chatgpt.aiSearchVolume.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Impressions</p>
                <p className="font-medium">{summary.platforms.chatgpt.impressions.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: ChatGPT data is only available for US English searches
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="citations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="citations" data-testid="tab-citations">Citations</TabsTrigger>
          <TabsTrigger value="top-pages" data-testid="tab-top-pages">Top Pages</TabsTrigger>
          <TabsTrigger value="gaps" data-testid="tab-gaps">Competitor Gaps</TabsTrigger>
          <TabsTrigger value="competitors" data-testid="tab-competitors">Competitors</TabsTrigger>
        </TabsList>

        <TabsContent value="citations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Citations</CardTitle>
              <CardDescription>
                Questions where your brand was cited in AI responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {itemsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !itemsData?.items?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No citations found yet.</p>
                  <p className="text-sm">Click "Fetch" above to start collecting AI citation data.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead>Cited Page</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Position</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsData.items.slice(0, 10).map((item) => (
                      <TableRow 
                        key={item.id} 
                        data-testid={`row-citation-${item.id}`}
                        className="cursor-pointer hover-elevate"
                        onClick={() => setSelectedCitation(item)}
                      >
                        <TableCell className="max-w-xs">
                          <p className="font-medium truncate">{item.question}</p>
                          {item.snippet && (
                            <p className="text-xs text-muted-foreground truncate">{item.snippet}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-primary">
                            <span className="truncate max-w-[200px]">{item.citedPageTitle || item.citedUrl}</span>
                            <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.platform === "google" ? (
                              <><SiGoogle className="h-3 w-3 mr-1" /> Google AI</>
                            ) : (
                              <><SiOpenai className="h-3 w-3 mr-1" /> ChatGPT</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">#{item.referencePosition}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.aiSearchVolume?.toLocaleString() || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Cited Pages</CardTitle>
              <CardDescription>
                Your pages most frequently cited in AI responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topPagesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !topPagesData?.pages?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No top pages found yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Mentions</TableHead>
                      <TableHead className="text-right">AI Volume</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPagesData.pages.map((page) => (
                      <TableRow key={page.id} data-testid={`row-page-${page.id}`}>
                        <TableCell>
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <span className="truncate max-w-[300px]">{page.pageTitle || page.url}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {page.platform === "google" ? "Google AI" : "ChatGPT"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{page.mentionsCount}</TableCell>
                        <TableCell className="text-right">{page.aiSearchVolume?.toLocaleString() || "-"}</TableCell>
                        <TableCell className="text-right">{page.impressions?.toLocaleString() || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Competitor Citation Gaps</CardTitle>
              <CardDescription>
                Topics where competitors are cited but you are not
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gapsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !gapsData?.gaps?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No competitor gaps found yet.</p>
                  <p className="text-sm">Add competitors and fetch data to identify opportunities.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competitor</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Their Mentions</TableHead>
                      <TableHead className="text-right">Your Mentions</TableHead>
                      <TableHead className="text-right">Gap</TableHead>
                      <TableHead className="text-right">AI Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gapsData.gaps.map((gap, idx) => (
                      <TableRow key={idx} data-testid={`row-gap-${idx}`}>
                        <TableCell className="font-medium">{gap.competitorName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {gap.platform === "google" ? "Google AI" : "ChatGPT"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{gap.mentionsCount}</TableCell>
                        <TableCell className="text-right">{gap.brandMentionsCount}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={gap.gap > 10 ? "destructive" : "secondary"}>
                            -{gap.gap}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{gap.aiSearchVolume.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Tracked Competitors</CardTitle>
                <CardDescription>
                  Competitors to track for AI citation comparison
                </CardDescription>
              </div>
              <Dialog open={isAddingCompetitor} onOpenChange={setIsAddingCompetitor}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-competitor">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Competitor
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Competitor</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="competitor.com"
                      value={newCompetitorDomain}
                      onChange={(e) => setNewCompetitorDomain(e.target.value)}
                      data-testid="input-competitor-domain"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsAddingCompetitor(false)}
                        data-testid="button-cancel-competitor"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => addCompetitorMutation.mutate(newCompetitorDomain)}
                        disabled={!newCompetitorDomain || addCompetitorMutation.isPending}
                        data-testid="button-save-competitor"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {!competitorsData?.competitors?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No competitors added yet.</p>
                  <p className="text-sm">Add competitors to track their AI citation presence.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competitorsData.competitors.map((comp) => (
                      <TableRow key={comp.id} data-testid={`row-competitor-${comp.id}`}>
                        <TableCell className="font-medium">{comp.domain}</TableCell>
                        <TableCell>
                          <Badge variant={comp.isActive ? "default" : "secondary"}>
                            {comp.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCompetitorMutation.mutate(comp.id)}
                            data-testid={`button-delete-competitor-${comp.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={!!selectedCitation} onOpenChange={(open) => !open && setSelectedCitation(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Citation Details
            </SheetTitle>
            <SheetDescription>
              Details about this AI citation
            </SheetDescription>
          </SheetHeader>
          {selectedCitation && (
            <ScrollArea className="h-[calc(100vh-120px)] mt-4">
              <div className="space-y-6 pr-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Question / Query</h4>
                  <p className="text-base">{selectedCitation.question}</p>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Platform</h4>
                  <Badge variant="outline" className="text-sm">
                    {selectedCitation.platform === "google" ? (
                      <><SiGoogle className="h-4 w-4 mr-2" /> Google AI Overview</>
                    ) : (
                      <><SiOpenai className="h-4 w-4 mr-2" /> ChatGPT</>
                    )}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Reference Position</h4>
                    <Badge variant="secondary" className="text-lg">#{selectedCitation.referencePosition}</Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">AI Search Volume</h4>
                    <p className="text-lg font-medium">{selectedCitation.aiSearchVolume?.toLocaleString() || "N/A"}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Cited Page</h4>
                  <Card>
                    <CardContent className="p-4">
                      <p className="font-medium mb-1">{selectedCitation.citedPageTitle || "Untitled Page"}</p>
                      <a
                        href={selectedCitation.citedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-sm break-all"
                        data-testid="link-cited-url"
                      >
                        {selectedCitation.citedUrl}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                      <p className="text-xs text-muted-foreground mt-2">Domain: {selectedCitation.citedDomain}</p>
                    </CardContent>
                  </Card>
                </div>

                {selectedCitation.snippet && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Citation Snippet</h4>
                    <Card className="bg-muted/50">
                      <CardContent className="p-4">
                        <p className="text-sm italic">"{selectedCitation.snippet}"</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {selectedCitation.answerExcerpt && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">AI Answer Excerpt</h4>
                    <Card className="bg-muted/50">
                      <CardContent className="p-4">
                        <p className="text-sm">{selectedCitation.answerExcerpt}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Impressions</h4>
                    <p className="text-base">{selectedCitation.impressions?.toLocaleString() || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Source</h4>
                    <p className="text-base">{selectedCitation.sourceName || "Direct"}</p>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCitation(null)}
                    data-testid="button-close-drawer"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Users({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
