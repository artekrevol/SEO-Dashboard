import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Check,
  Clock,
  X,
  RefreshCw,
  Code,
  Link2,
  FileSearch,
  FileText,
  Zap,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Recommendation {
  id: number;
  url: string;
  keywordId?: number;
  type: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

interface RecommendationsListProps {
  data: Recommendation[];
  isLoading?: boolean;
  onStatusChange?: (id: number, status: string) => void;
}

const typeIcons: Record<string, any> = {
  content_refresh: RefreshCw,
  add_schema: Code,
  build_links: Link2,
  fix_indexability: FileSearch,
  fix_duplicate_content: FileText,
  optimize_meta: FileText,
  improve_cwv: Zap,
  add_internal_links: Link2,
};

const severityConfig: Record<string, { icon: any; color: string; border: string }> = {
  high: {
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    border: "border-l-red-500",
  },
  medium: {
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    border: "border-l-amber-500",
  },
  low: {
    icon: Info,
    color: "text-blue-600 dark:text-blue-400",
    border: "border-l-blue-500",
  },
};

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  open: {
    label: "Open",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "In Progress",
    icon: RefreshCw,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  done: {
    label: "Done",
    icon: Check,
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  dismissed: {
    label: "Dismissed",
    icon: X,
    className: "bg-muted text-muted-foreground",
  },
};

export function RecommendationsList({
  data,
  isLoading,
  onStatusChange,
}: RecommendationsListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredData = data.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || item.severity === severityFilter;
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesStatus && matchesSeverity && matchesType;
  });

  const uniqueTypes = [...new Set(data.map((item) => item.type))];

  const formatType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <Card data-testid="recommendations-list">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg font-medium">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="recommendations-list">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg font-medium">Recommendations</CardTitle>
          <Badge variant="secondary" className="font-mono">
            {filteredData.length}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-32" data-testid="select-severity-filter">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40" data-testid="select-type-filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatType(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Check className="mb-4 h-12 w-12" />
            <p className="text-lg font-medium">No recommendations</p>
            <p className="text-sm">All caught up! No action items matching your filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredData.map((item) => {
              const severity = severityConfig[item.severity] || severityConfig.low;
              const status = statusConfig[item.status] || statusConfig.open;
              const TypeIcon = typeIcons[item.type] || FileText;
              const SeverityIcon = severity.icon;
              const StatusIcon = status.icon;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-lg border border-l-4 p-4 hover-elevate",
                    severity.border
                  )}
                  data-testid={`recommendation-${item.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-0.5", severity.color)}>
                        <SeverityIcon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{item.title}</h4>
                          <Badge
                            variant="secondary"
                            className={cn("border-0", status.className)}
                          >
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <TypeIcon className="h-3 w-3" />
                            <span>{formatType(item.type)}</span>
                          </div>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 font-mono hover:text-foreground"
                            >
                              <span className="max-w-[200px] truncate">
                                {item.url.replace(/^https?:\/\//, "")}
                              </span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <span>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status !== "done" && item.status !== "dismissed" && (
                        <>
                          {item.status === "open" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onStatusChange?.(item.id, "in_progress")}
                              data-testid={`button-start-${item.id}`}
                            >
                              Start
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          )}
                          {item.status === "in_progress" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => onStatusChange?.(item.id, "done")}
                              data-testid={`button-complete-${item.id}`}
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onStatusChange?.(item.id, "dismissed")}
                            data-testid={`button-dismiss-${item.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
