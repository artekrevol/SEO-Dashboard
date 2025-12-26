import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Bot, 
  ExternalLink, 
  FileText, 
  Quote, 
  TrendingUp, 
  Globe, 
  List, 
  BookOpen,
  HelpCircle,
  ShoppingBag,
  Newspaper,
  Star
} from "lucide-react";

interface AiMentionsAnalytics {
  totalCitations: number;
  uniqueDomains: number;
  topCitedDomains: Array<{ domain: string; citationCount: number; uniqueKeywords: number }>;
  keywordsWithAiOverview: number;
  recentCitations: Array<{
    keyword: string;
    domain: string;
    pageTitle: string | null;
    citedText: string | null;
    referencePosition: number | null;
    capturedAt: string;
  }>;
  contentTypeBreakdown: Array<{ contentType: string; count: number }>;
}

interface AiOverviewCitation {
  id: number;
  snapshotId: number;
  keywordId: number;
  projectId: string;
  domain: string;
  url: string;
  pageTitle: string | null;
  sourceName: string | null;
  citedText: string | null;
  aiGeneratedContext: string | null;
  referencePosition: number | null;
  isElementLevel: boolean | null;
  contentType: string | null;
  capturedAt: string;
}

interface AiMentionsPanelProps {
  projectId: string;
}

const contentTypeIcons: Record<string, typeof FileText> = {
  guide: BookOpen,
  article: FileText,
  review: Star,
  faq: HelpCircle,
  list: List,
  product: ShoppingBag,
  definition: BookOpen,
  news: Newspaper,
};

const contentTypeLabels: Record<string, string> = {
  guide: "How-to Guide",
  article: "Article",
  review: "Review",
  faq: "FAQ",
  list: "List/Listicle",
  product: "Product Page",
  definition: "Definition",
  news: "News",
};

function ContentTypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const Icon = contentTypeIcons[type] || FileText;
  const label = contentTypeLabels[type] || type;
  
  return (
    <Badge variant="outline" className="text-xs gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export function AiMentionsPanel({ projectId }: AiMentionsPanelProps) {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const { data: analytics, isLoading } = useQuery<AiMentionsAnalytics>({
    queryKey: ["/api/ai-mentions/analytics", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/ai-mentions/analytics?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch AI mentions analytics");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: domainCitations, isLoading: domainLoading } = useQuery<AiOverviewCitation[]>({
    queryKey: ["/api/ai-mentions/domain", selectedDomain, { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/ai-mentions/domain/${encodeURIComponent(selectedDomain!)}?projectId=${projectId}&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch domain citations");
      return res.json();
    },
    enabled: !!selectedDomain && !!projectId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!analytics || analytics.totalCitations === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bot className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No AI Overview Citations Yet</h3>
        <p className="text-muted-foreground mt-2 max-w-md">
          AI Overview citation data is collected during keyword ranking crawls. 
          Run a ranking crawl to start seeing which domains are cited in Google's AI Overviews.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Citations</CardTitle>
            <Quote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-citations">
              {analytics.totalCitations.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              References captured from AI Overviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Domains</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-unique-domains">
              {analytics.uniqueDomains.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Different sources cited by Google
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Keywords with AI</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-keywords-with-ai">
              {analytics.keywordsWithAiOverview.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Keywords showing AI Overview in SERPs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Citations/Domain</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-citations">
              {analytics.uniqueDomains > 0 
                ? (analytics.totalCitations / analytics.uniqueDomains).toFixed(1)
                : "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              Average mentions per domain
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Cited Domains
            </CardTitle>
            <CardDescription>
              Domains most frequently cited in AI Overviews for your tracked keywords
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead className="text-right">Citations</TableHead>
                    <TableHead className="text-right">Keywords</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.topCitedDomains.map((domain, idx) => (
                    <TableRow key={domain.domain}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          className="p-0 h-auto text-left justify-start text-primary hover:underline"
                          onClick={() => setSelectedDomain(domain.domain)}
                          data-testid={`link-domain-${idx}`}
                        >
                          <span className="text-muted-foreground mr-2 w-5 text-right">
                            #{idx + 1}
                          </span>
                          {domain.domain}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {domain.citationCount}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {domain.uniqueKeywords}
                      </TableCell>
                    </TableRow>
                  ))}
                  {analytics.topCitedDomains.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No citation data available yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Content Type Breakdown
            </CardTitle>
            <CardDescription>
              Types of content Google cites in AI Overviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.contentTypeBreakdown.map((item) => {
                const Icon = contentTypeIcons[item.contentType] || FileText;
                const label = contentTypeLabels[item.contentType] || item.contentType;
                const percentage = (item.count / analytics.totalCitations * 100).toFixed(1);
                
                return (
                  <div key={item.contentType} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-32 flex-shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{label}</span>
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-16 text-right">
                      {item.count} ({percentage}%)
                    </span>
                  </div>
                );
              })}
              {analytics.contentTypeBreakdown.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Content type analysis not yet available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Quote className="h-5 w-5" />
            Recent AI Overview Citations
          </CardTitle>
          <CardDescription>
            Latest citations captured from AI Overviews with excerpts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {analytics.recentCitations.map((citation, idx) => (
                <div 
                  key={idx} 
                  className="border rounded-lg p-4 space-y-2"
                  data-testid={`citation-card-${idx}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {citation.keyword}
                        </Badge>
                        {citation.referencePosition && (
                          <Badge variant="outline" className="text-xs">
                            Ref #{citation.referencePosition}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium truncate">
                        {citation.pageTitle || citation.domain}
                      </p>
                      <p className="text-sm text-muted-foreground">{citation.domain}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(citation.capturedAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {citation.citedText && (
                    <blockquote className="border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground italic">
                      "{citation.citedText.substring(0, 200)}
                      {citation.citedText.length > 200 ? "..." : ""}"
                    </blockquote>
                  )}
                </div>
              ))}
              {analytics.recentCitations.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No recent citations captured yet
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDomain} onOpenChange={() => setSelectedDomain(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Citations for {selectedDomain}
            </DialogTitle>
            <DialogDescription>
              All AI Overview citations where this domain appears
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[500px] mt-4">
            {domainLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {domainCitations?.map((citation) => (
                  <div key={citation.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {citation.referencePosition && (
                            <Badge variant="outline" className="text-xs">
                              Position #{citation.referencePosition}
                            </Badge>
                          )}
                          <ContentTypeBadge type={citation.contentType} />
                          {citation.isElementLevel && (
                            <Badge variant="secondary" className="text-xs">
                              Element-level
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium">
                          {citation.pageTitle || citation.url}
                        </p>
                        {citation.sourceName && (
                          <p className="text-sm text-muted-foreground">
                            Source: {citation.sourceName}
                          </p>
                        )}
                      </div>
                      <a 
                        href={citation.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    
                    {citation.citedText && (
                      <blockquote className="border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground italic">
                        "{citation.citedText.substring(0, 300)}
                        {citation.citedText.length > 300 ? "..." : ""}"
                      </blockquote>
                    )}
                    
                    {citation.aiGeneratedContext && (
                      <div className="bg-muted/50 rounded-md p-2 text-sm">
                        <span className="text-muted-foreground">AI Context: </span>
                        {citation.aiGeneratedContext.substring(0, 200)}
                        {citation.aiGeneratedContext.length > 200 ? "..." : ""}
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      Captured: {new Date(citation.capturedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
                {(!domainCitations || domainCitations.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    No citations found for this domain
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
