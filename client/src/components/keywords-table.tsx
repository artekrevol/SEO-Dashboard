import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ArrowUp, ArrowDown, Minus, Search, ExternalLink, TrendingUp, Filter, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeywordData {
  keywordId: number;
  keyword: string;
  cluster?: string;
  currentPosition: number;
  positionDelta: number;
  searchVolume: number;
  difficulty: number;
  intent: string;
  opportunityScore: number;
  serpFeatures: string[];
  url: string;
}

interface KeywordsTableProps {
  data: KeywordData[];
  isLoading?: boolean;
  onFilteredDataChange?: (filteredData: KeywordData[]) => void;
}

const intentColors: Record<string, string> = {
  informational: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  commercial: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  transactional: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  navigational: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const serpFeatureLabels: Record<string, string> = {
  featured_snippet: "Featured Snippet",
  local_pack: "Local Pack",
  knowledge_panel: "Knowledge Panel",
  video: "Video",
  images: "Images",
  shopping: "Shopping",
  news: "News",
  people_also_ask: "People Also Ask",
  sitelinks: "Sitelinks",
};

const positionBrackets = [
  { id: "1-3", label: "Top 3", min: 1, max: 3 },
  { id: "4-10", label: "4-10", min: 4, max: 10 },
  { id: "11-20", label: "11-20", min: 11, max: 20 },
  { id: "21-50", label: "21-50", min: 21, max: 50 },
  { id: "51+", label: "51+", min: 51, max: 999 },
];

type OpportunityPreset = "high" | "medium" | null;
type DifficultyPreset = "easy" | "medium" | "hard" | null;

export function KeywordsTable({ data, isLoading, onFilteredDataChange }: KeywordsTableProps) {
  const [search, setSearch] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("opportunity");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedSerpFeatures, setSelectedSerpFeatures] = useState<string[]>([]);
  const [selectedClusters, setSelectedClusters] = useState<string[]>([]);
  const [opportunityRange, setOpportunityRange] = useState<[number, number]>([0, 100]);
  const [difficultyRange, setDifficultyRange] = useState<[number, number]>([0, 100]);
  const [volumeMin, setVolumeMin] = useState<number>(0);
  const [opportunityPreset, setOpportunityPreset] = useState<OpportunityPreset>(null);
  const [difficultyPreset, setDifficultyPreset] = useState<DifficultyPreset>(null);

  const uniqueClusters = useMemo(() => {
    const clusters = new Set<string>();
    data.forEach((item) => {
      if (item.cluster) clusters.add(item.cluster);
    });
    return Array.from(clusters).sort();
  }, [data]);

  const allSerpFeatures = useMemo(() => {
    const features = new Set<string>();
    data.forEach((item) => {
      item.serpFeatures?.forEach((f) => features.add(f));
    });
    return Array.from(features).sort();
  }, [data]);

  const activeFilters = useMemo(() => {
    const filters: { type: string; label: string; onRemove: () => void }[] = [];
    
    if (search) {
      filters.push({ type: "search", label: `"${search}"`, onRemove: () => setSearch("") });
    }
    if (intentFilter !== "all") {
      filters.push({ type: "intent", label: `Intent: ${intentFilter}`, onRemove: () => setIntentFilter("all") });
    }
    selectedPositions.forEach((posId) => {
      const bracket = positionBrackets.find((b) => b.id === posId);
      if (bracket) {
        filters.push({ 
          type: "position", 
          label: `Position: ${bracket.label}`, 
          onRemove: () => setSelectedPositions((prev) => prev.filter((p) => p !== posId)) 
        });
      }
    });
    if (opportunityRange[0] > 0 || opportunityRange[1] < 100) {
      filters.push({ 
        type: "opportunity", 
        label: `Opportunity: ${opportunityRange[0]}-${opportunityRange[1]}`, 
        onRemove: () => { setOpportunityRange([0, 100]); setOpportunityPreset(null); } 
      });
    }
    if (difficultyRange[0] > 0 || difficultyRange[1] < 100) {
      filters.push({ 
        type: "difficulty", 
        label: `Difficulty: ${difficultyRange[0]}-${difficultyRange[1]}`, 
        onRemove: () => { setDifficultyRange([0, 100]); setDifficultyPreset(null); } 
      });
    }
    selectedSerpFeatures.forEach((feature) => {
      filters.push({ 
        type: "serp", 
        label: serpFeatureLabels[feature] || feature, 
        onRemove: () => setSelectedSerpFeatures((prev) => prev.filter((f) => f !== feature)) 
      });
    });
    selectedClusters.forEach((cluster) => {
      filters.push({ 
        type: "cluster", 
        label: `Cluster: ${cluster}`, 
        onRemove: () => setSelectedClusters((prev) => prev.filter((c) => c !== cluster)) 
      });
    });
    if (volumeMin > 0) {
      filters.push({ 
        type: "volume", 
        label: `Volume: ≥${volumeMin.toLocaleString()}`, 
        onRemove: () => setVolumeMin(0) 
      });
    }
    
    return filters;
  }, [search, intentFilter, selectedPositions, opportunityRange, difficultyRange, selectedSerpFeatures, selectedClusters, volumeMin]);

  const hasActiveFilters = activeFilters.length > 0;

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setIntentFilter("all");
    setSelectedPositions([]);
    setSelectedSerpFeatures([]);
    setSelectedClusters([]);
    setOpportunityRange([0, 100]);
    setDifficultyRange([0, 100]);
    setVolumeMin(0);
    setOpportunityPreset(null);
    setDifficultyPreset(null);
  }, []);

  const togglePosition = (positionId: string) => {
    setSelectedPositions((prev) =>
      prev.includes(positionId)
        ? prev.filter((p) => p !== positionId)
        : [...prev, positionId]
    );
  };

  const toggleSerpFeature = (feature: string) => {
    setSelectedSerpFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  };

  const toggleCluster = (cluster: string) => {
    setSelectedClusters((prev) =>
      prev.includes(cluster)
        ? prev.filter((c) => c !== cluster)
        : [...prev, cluster]
    );
  };

  const setOpportunityWithPreset = (min: number, max: number, preset: OpportunityPreset) => {
    setOpportunityRange([min, max]);
    setOpportunityPreset(preset);
  };

  const setDifficultyWithPreset = (min: number, max: number, preset: DifficultyPreset) => {
    setDifficultyRange([min, max]);
    setDifficultyPreset(preset);
  };

  const handleOpportunitySliderChange = (value: [number, number]) => {
    setOpportunityRange(value);
    setOpportunityPreset(null);
  };

  const handleDifficultySliderChange = (value: [number, number]) => {
    setDifficultyRange(value);
    setDifficultyPreset(null);
  };

  const filteredData = useMemo(() => {
    const result = data
      .filter((item) => {
        const matchesSearch = item.keyword.toLowerCase().includes(search.toLowerCase());
        const matchesIntent = intentFilter === "all" || item.intent === intentFilter;
        
        const matchesPosition =
          selectedPositions.length === 0 ||
          selectedPositions.some((posId) => {
            const bracket = positionBrackets.find((b) => b.id === posId);
            return bracket && item.currentPosition >= bracket.min && item.currentPosition <= bracket.max;
          });

        const matchesSerpFeatures =
          selectedSerpFeatures.length === 0 ||
          selectedSerpFeatures.some((f) => item.serpFeatures?.includes(f));

        const matchesCluster =
          selectedClusters.length === 0 ||
          (item.cluster && selectedClusters.includes(item.cluster));

        const matchesOpportunity =
          item.opportunityScore >= opportunityRange[0] &&
          item.opportunityScore <= opportunityRange[1];

        const matchesDifficulty =
          item.difficulty >= difficultyRange[0] &&
          item.difficulty <= difficultyRange[1];

        const matchesVolume = item.searchVolume >= volumeMin;

        return (
          matchesSearch &&
          matchesIntent &&
          matchesPosition &&
          matchesSerpFeatures &&
          matchesCluster &&
          matchesOpportunity &&
          matchesDifficulty &&
          matchesVolume
        );
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "opportunity":
            return b.opportunityScore - a.opportunityScore;
          case "position":
            return a.currentPosition - b.currentPosition;
          case "volume":
            return b.searchVolume - a.searchVolume;
          case "difficulty":
            return a.difficulty - b.difficulty;
          default:
            return 0;
        }
      });
    
    if (onFilteredDataChange) {
      onFilteredDataChange(result);
    }
    
    return result;
  }, [data, search, intentFilter, selectedPositions, selectedSerpFeatures, selectedClusters, opportunityRange, difficultyRange, volumeMin, sortBy, onFilteredDataChange]);

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty < 30) return "text-emerald-600 dark:text-emerald-400";
    if (difficulty < 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getOpportunityColor = (score: number) => {
    if (score >= 70) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    if (score >= 40) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    return "bg-muted text-muted-foreground";
  };

  if (isLoading) {
    return (
      <Card data-testid="keywords-table">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg font-medium">Keyword Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-8 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="keywords-table">
      <CardHeader className="flex flex-col gap-4 pb-4">
        <div className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-medium">Keyword Performance</CardTitle>
            {hasActiveFilters && (
              <Badge variant="secondary" className="font-normal" data-testid="badge-filter-count">
                {filteredData.length} of {data.length}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
                data-testid="input-keyword-search"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36" data-testid="select-sort">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="opportunity">Opportunity</SelectItem>
                <SelectItem value="position">Position</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
                <SelectItem value="difficulty">Difficulty</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={intentFilter} onValueChange={setIntentFilter}>
            <SelectTrigger 
              className={cn("w-40", intentFilter !== "all" && "border-primary")} 
              data-testid="select-intent-filter"
            >
              <SelectValue placeholder="Intent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Intents</SelectItem>
              <SelectItem value="informational">Informational</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="transactional">Transactional</SelectItem>
              <SelectItem value="navigational">Navigational</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className={cn(
                  "gap-1",
                  selectedPositions.length > 0 && "border-primary bg-primary/5"
                )}
                data-testid="button-position-filter"
              >
                <Filter className="h-4 w-4" />
                Position
                {selectedPositions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                    {selectedPositions.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-2">
                <p className="text-sm font-medium">Position Brackets</p>
                {positionBrackets.map((bracket) => (
                  <label
                    key={bracket.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover-elevate"
                  >
                    <Checkbox
                      checked={selectedPositions.includes(bracket.id)}
                      onCheckedChange={() => togglePosition(bracket.id)}
                      data-testid={`checkbox-position-${bracket.id}`}
                    />
                    <span className="text-sm">{bracket.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className={cn(
                  "gap-1",
                  (opportunityRange[0] > 0 || opportunityRange[1] < 100) && "border-primary bg-primary/5"
                )}
                data-testid="button-opportunity-filter"
              >
                <TrendingUp className="h-4 w-4" />
                Opportunity
                {(opportunityRange[0] > 0 || opportunityRange[1] < 100) && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                    {opportunityRange[0]}-{opportunityRange[1]}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-4">
                <p className="text-sm font-medium">Opportunity Score</p>
                <div className="px-2">
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={opportunityRange}
                    onValueChange={handleOpportunitySliderChange}
                    data-testid="slider-opportunity"
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Min: {opportunityRange[0]}</span>
                  <span>Max: {opportunityRange[1]}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={opportunityPreset === "high" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOpportunityWithPreset(60, 100, "high")}
                    data-testid="button-high-opportunity"
                  >
                    High (60+)
                  </Button>
                  <Button
                    variant={opportunityPreset === "medium" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOpportunityWithPreset(30, 60, "medium")}
                    data-testid="button-medium-opportunity"
                  >
                    Medium
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className={cn(
                  "gap-1",
                  (difficultyRange[0] > 0 || difficultyRange[1] < 100) && "border-primary bg-primary/5"
                )}
                data-testid="button-difficulty-filter"
              >
                Difficulty
                {(difficultyRange[0] > 0 || difficultyRange[1] < 100) && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                    {difficultyRange[0]}-{difficultyRange[1]}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-4">
                <p className="text-sm font-medium">Keyword Difficulty</p>
                <div className="px-2">
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={difficultyRange}
                    onValueChange={handleDifficultySliderChange}
                    data-testid="slider-difficulty"
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Min: {difficultyRange[0]}</span>
                  <span>Max: {difficultyRange[1]}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={difficultyPreset === "easy" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDifficultyWithPreset(0, 30, "easy")}
                    className={cn(difficultyPreset !== "easy" && "text-emerald-600 dark:text-emerald-400")}
                    data-testid="button-easy-difficulty"
                  >
                    Easy
                  </Button>
                  <Button
                    variant={difficultyPreset === "medium" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDifficultyWithPreset(30, 60, "medium")}
                    className={cn(difficultyPreset !== "medium" && "text-amber-600 dark:text-amber-400")}
                    data-testid="button-medium-difficulty"
                  >
                    Medium
                  </Button>
                  <Button
                    variant={difficultyPreset === "hard" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDifficultyWithPreset(60, 100, "hard")}
                    className={cn(difficultyPreset !== "hard" && "text-red-600 dark:text-red-400")}
                    data-testid="button-hard-difficulty"
                  >
                    Hard
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {allSerpFeatures.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="default"
                  className={cn(
                    "gap-1",
                    selectedSerpFeatures.length > 0 && "border-primary bg-primary/5"
                  )}
                  data-testid="button-serp-filter"
                >
                  SERP Features
                  {selectedSerpFeatures.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                      {selectedSerpFeatures.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="start">
                <div className="space-y-2">
                  <p className="text-sm font-medium">SERP Features</p>
                  <div className="max-h-64 overflow-y-auto">
                    {allSerpFeatures.map((feature) => (
                      <label
                        key={feature}
                        className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover-elevate"
                      >
                        <Checkbox
                          checked={selectedSerpFeatures.includes(feature)}
                          onCheckedChange={() => toggleSerpFeature(feature)}
                          data-testid={`checkbox-serp-${feature}`}
                        />
                        <span className="text-sm">{serpFeatureLabels[feature] || feature}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {uniqueClusters.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="default"
                  className={cn(
                    "gap-1",
                    selectedClusters.length > 0 && "border-primary bg-primary/5"
                  )}
                  data-testid="button-cluster-filter"
                >
                  Clusters
                  {selectedClusters.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                      {selectedClusters.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="start">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Keyword Clusters</p>
                  <div className="max-h-64 overflow-y-auto">
                    {uniqueClusters.map((cluster) => (
                      <label
                        key={cluster}
                        className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover-elevate"
                      >
                        <Checkbox
                          checked={selectedClusters.includes(cluster)}
                          onCheckedChange={() => toggleCluster(cluster)}
                          data-testid={`checkbox-cluster-${cluster}`}
                        />
                        <span className="text-sm capitalize">{cluster}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className={cn("gap-1", volumeMin > 0 && "border-primary bg-primary/5")}
                data-testid="button-volume-filter"
              >
                Volume
                {volumeMin > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                    ≥{volumeMin.toLocaleString()}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-4">
                <p className="text-sm font-medium">Minimum Search Volume</p>
                <Input
                  type="number"
                  min={0}
                  value={volumeMin}
                  onChange={(e) => setVolumeMin(parseInt(e.target.value) || 0)}
                  placeholder="Min volume"
                  data-testid="input-min-volume"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={volumeMin === 100 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVolumeMin(100)}
                    data-testid="button-volume-100"
                  >
                    100+
                  </Button>
                  <Button
                    variant={volumeMin === 500 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVolumeMin(500)}
                    data-testid="button-volume-500"
                  >
                    500+
                  </Button>
                  <Button
                    variant={volumeMin === 1000 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVolumeMin(1000)}
                    data-testid="button-volume-1000"
                  >
                    1K+
                  </Button>
                  <Button
                    variant={volumeMin === 5000 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVolumeMin(5000)}
                    data-testid="button-volume-5000"
                  >
                    5K+
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="gap-1 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>

        {hasActiveFilters && activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" data-testid="active-filters-row">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {activeFilters.map((filter, index) => (
              <Badge
                key={`${filter.type}-${index}`}
                variant="secondary"
                className="cursor-pointer gap-1 pl-2 pr-1"
                onClick={filter.onRemove}
                data-testid={`badge-filter-${filter.type}-${index}`}
              >
                {filter.label}
                <X className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Keyword</TableHead>
                <TableHead className="text-center">Position</TableHead>
                <TableHead className="text-center">Change</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-center">Difficulty</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead className="text-center">Opportunity</TableHead>
                <TableHead>SERP Features</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8" />
                      <p>No keywords match your filters</p>
                      {hasActiveFilters && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearAllFilters}
                          data-testid="button-clear-filters-empty"
                        >
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow
                    key={item.keywordId}
                    className="hover-elevate"
                    data-testid={`row-keyword-${item.keywordId}`}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{item.keyword}</span>
                        <div className="flex items-center gap-2">
                          {item.cluster && (
                            <Badge variant="outline" className="text-xs">
                              {item.cluster}
                            </Badge>
                          )}
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <span className="max-w-[150px] truncate font-mono">
                                {item.url.replace(/^https?:\/\//, "")}
                              </span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-lg font-semibold">{item.currentPosition}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1 text-sm font-medium",
                          item.positionDelta > 0 && "text-emerald-600 dark:text-emerald-400",
                          item.positionDelta < 0 && "text-red-600 dark:text-red-400",
                          item.positionDelta === 0 && "text-muted-foreground"
                        )}
                      >
                        {item.positionDelta > 0 && <ArrowUp className="h-3 w-3" />}
                        {item.positionDelta < 0 && <ArrowDown className="h-3 w-3" />}
                        {item.positionDelta === 0 && <Minus className="h-3 w-3" />}
                        <span>{Math.abs(item.positionDelta)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.searchVolume.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("font-medium", getDifficultyColor(item.difficulty))}>
                        {item.difficulty}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn("border-0 capitalize", intentColors[item.intent])}
                      >
                        {item.intent}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={cn("border-0", getOpportunityColor(item.opportunityScore))}
                      >
                        <TrendingUp className="mr-1 h-3 w-3" />
                        {item.opportunityScore.toFixed(0)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.serpFeatures?.slice(0, 3).map((feature) => (
                          <Badge
                            key={feature}
                            variant="outline"
                            className="text-xs"
                          >
                            {serpFeatureLabels[feature] || feature}
                          </Badge>
                        ))}
                        {item.serpFeatures && item.serpFeatures.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{item.serpFeatures.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
