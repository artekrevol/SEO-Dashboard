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
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Edit2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DataManagementProps {
  projectId: string | null;
}

export function DataManagementPage({ projectId }: DataManagementProps) {
  const { toast } = useToast();
  const [selectedKeywords, setSelectedKeywords] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterIntent, setFilterIntent] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const { data: keywords, isLoading } = useQuery({
    queryKey: ["/api/dashboard/keywords", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/keywords?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch keywords");
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

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const items = keywords?.items || [];
  
  const filteredItems = items.filter((k: any) => {
    if (filterIntent !== "all" && k.intent !== filterIntent) return false;
    // Priority is derived from difficulty/intent in the backend
    return true;
  });

  const handleSelectKeyword = (id: number) => {
    setSelectedKeywords((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedKeywords.length === filteredItems.length) {
      setSelectedKeywords([]);
    } else {
      setSelectedKeywords(filteredItems.map((k: any) => k.keywordId));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-data-management-title">
          Data Management
        </h1>
        <p className="text-muted-foreground">
          Manage and bulk update your keywords.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
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
        </div>
      </Card>

      {/* Bulk Actions */}
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

      {/* Keywords Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedKeywords.length === filteredItems.length && filteredItems.length > 0}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all"
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
                {filteredItems.map((keyword: any) => (
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

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No keywords found</p>
        </div>
      )}
    </div>
  );
}
