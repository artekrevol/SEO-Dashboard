import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface QuickWinKeyword {
  keywordId: number;
  keyword: string;
  cluster: string | null;
  location: string;
  currentPosition: number;
  searchVolume: number;
  difficulty: number;
  intent: string;
  opportunityScore: number;
  targetUrl: string;
}

export function QuickWinsPage({ projectId }: { projectId: string }) {
  const { data: quickWins = [], isLoading } = useQuery<QuickWinKeyword[]>({
    queryKey: ["/api/quick-wins", projectId],
  });

  if (isLoading) {
    return <div className="p-8">Loading quick wins...</div>;
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-green-600" />
        <h1 className="text-3xl font-bold">Quick Wins</h1>
      </div>

      <p className="text-muted-foreground">
        High-opportunity keywords positioned just outside the top 5. Easy wins with targeted optimization.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>{quickWins.length} opportunities found</CardTitle>
        </CardHeader>
        <CardContent>
          {quickWins.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <AlertCircle className="w-4 h-4" />
              <p>No keywords match the quick wins criteria yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead>Opportunity</TableHead>
                    <TableHead>Cluster</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quickWins.map((win) => (
                    <TableRow key={win.keywordId} data-testid={`row-quick-win-${win.keywordId}`}>
                      <TableCell className="font-medium" data-testid={`text-keyword-${win.keywordId}`}>
                        {win.keyword}
                      </TableCell>
                      <TableCell data-testid={`text-position-${win.keywordId}`}>{win.currentPosition}</TableCell>
                      <TableCell data-testid={`text-volume-${win.keywordId}`}>{win.searchVolume}</TableCell>
                      <TableCell data-testid={`text-difficulty-${win.keywordId}`}>{Math.round(win.difficulty)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          data-testid={`badge-intent-${win.keywordId}`}
                        >
                          {win.intent}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-opportunity-${win.keywordId}`}>
                        {Math.round(win.opportunityScore)}
                      </TableCell>
                      <TableCell data-testid={`text-cluster-${win.keywordId}`}>{win.cluster || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
