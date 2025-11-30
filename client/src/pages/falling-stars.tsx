import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface FallingStarKeyword {
  keywordId: number;
  keyword: string;
  cluster: string | null;
  location: string;
  currentPosition: number;
  positionDelta: number;
  searchVolume: number;
  difficulty: number;
  intent: string;
  targetUrl: string;
  isCoreKeyword: boolean;
}

export function FallingStarsPage({ projectId }: { projectId: string }) {
  const { data: fallingStars = [], isLoading } = useQuery<FallingStarKeyword[]>({
    queryKey: ["/api/falling-stars", projectId],
  });

  if (isLoading) {
    return <div className="p-8">Loading falling stars...</div>;
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-2">
        <TrendingDown className="w-6 h-6 text-red-600" />
        <h1 className="text-3xl font-bold">Falling Stars</h1>
      </div>

      <p className="text-muted-foreground">
        Keywords that were recently in top 10 but have dropped significantly. Defend these rankings immediately.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            {fallingStars.length} keywords at risk
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fallingStars.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <AlertTriangle className="w-4 h-4" />
              <p>No falling keywords detected. Great job maintaining rankings!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Drop</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead>Core</TableHead>
                    <TableHead>Cluster</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fallingStars.map((star) => (
                    <TableRow key={star.keywordId} data-testid={`row-falling-star-${star.keywordId}`}>
                      <TableCell className="font-medium" data-testid={`text-keyword-${star.keywordId}`}>
                        {star.keyword}
                      </TableCell>
                      <TableCell data-testid={`text-position-${star.keywordId}`}>{star.currentPosition}</TableCell>
                      <TableCell className="text-red-600 font-semibold" data-testid={`text-drop-${star.keywordId}`}>
                        {star.positionDelta}
                      </TableCell>
                      <TableCell data-testid={`text-volume-${star.keywordId}`}>{star.searchVolume}</TableCell>
                      <TableCell data-testid={`text-difficulty-${star.keywordId}`}>{Math.round(star.difficulty)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-intent-${star.keywordId}`}>
                          {star.intent}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {star.isCoreKeyword && (
                          <Badge className="bg-red-100 text-red-800" data-testid={`badge-core-${star.keywordId}`}>
                            Core
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-cluster-${star.keywordId}`}>{star.cluster || "-"}</TableCell>
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
