import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Settings, TrendingUp, TrendingDown, Save, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface QuickWinsSettings {
  id?: number;
  projectId?: string;
  minPosition: number;
  maxPosition: number;
  minVolume: number;
  maxDifficulty: number;
  validIntents: string[];
  enabled: boolean;
}

interface FallingStarsSettings {
  id?: number;
  projectId?: string;
  windowDays: number;
  minDropPositions: number;
  minPreviousPosition: number;
  minVolume: number;
  enabled: boolean;
}

const defaultQuickWins: QuickWinsSettings = {
  minPosition: 6,
  maxPosition: 20,
  minVolume: 50,
  maxDifficulty: 70,
  validIntents: ["commercial", "transactional"],
  enabled: true,
};

const defaultFallingStars: FallingStarsSettings = {
  windowDays: 7,
  minDropPositions: 5,
  minPreviousPosition: 10,
  minVolume: 0,
  enabled: true,
};

const intentOptions = [
  { value: "informational", label: "Informational" },
  { value: "commercial", label: "Commercial" },
  { value: "transactional", label: "Transactional" },
  { value: "navigational", label: "Navigational" },
];

export function SettingsPage({ projectId }: { projectId: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [quickWins, setQuickWins] = useState<QuickWinsSettings>(defaultQuickWins);
  const [fallingStars, setFallingStars] = useState<FallingStarsSettings>(defaultFallingStars);

  const { data: quickWinsData, isLoading: quickWinsLoading } = useQuery<QuickWinsSettings>({
    queryKey: ["/api/settings/quick-wins", { projectId }],
    queryFn: async () => {
      if (!projectId) return defaultQuickWins;
      const res = await fetch(`/api/settings/quick-wins?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch quick wins settings");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: fallingStarsData, isLoading: fallingStarsLoading } = useQuery<FallingStarsSettings>({
    queryKey: ["/api/settings/falling-stars", { projectId }],
    queryFn: async () => {
      if (!projectId) return defaultFallingStars;
      const res = await fetch(`/api/settings/falling-stars?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch falling stars settings");
      return res.json();
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (quickWinsData) {
      setQuickWins(quickWinsData);
    }
  }, [quickWinsData]);

  useEffect(() => {
    if (fallingStarsData) {
      setFallingStars(fallingStarsData);
    }
  }, [fallingStarsData]);

  const saveQuickWinsMutation = useMutation({
    mutationFn: async (settings: QuickWinsSettings) => {
      if (!projectId) {
        throw new Error("No project selected");
      }
      const res = await apiRequest("POST", "/api/settings/quick-wins", {
        ...settings,
        projectId,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || "Failed to save settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/quick-wins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quick-wins"] });
      toast({
        title: "Settings saved",
        description: "Quick Wins settings have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save Quick Wins settings.",
        variant: "destructive",
      });
    },
  });

  const saveFallingStarsMutation = useMutation({
    mutationFn: async (settings: FallingStarsSettings) => {
      if (!projectId) {
        throw new Error("No project selected");
      }
      const res = await apiRequest("POST", "/api/settings/falling-stars", {
        ...settings,
        projectId,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || "Failed to save settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/falling-stars"] });
      queryClient.invalidateQueries({ queryKey: ["/api/falling-stars"] });
      toast({
        title: "Settings saved",
        description: "Falling Stars settings have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save Falling Stars settings.",
        variant: "destructive",
      });
    },
  });

  const handleIntentToggle = (intent: string) => {
    setQuickWins((prev) => {
      const newIntents = prev.validIntents.includes(intent)
        ? prev.validIntents.filter((i) => i !== intent)
        : [...prev.validIntents, intent];
      return { ...prev, validIntents: newIntents };
    });
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view settings</p>
      </div>
    );
  }

  const isLoading = quickWinsLoading || fallingStarsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
      </div>
      <p className="text-muted-foreground">
        Configure thresholds for Quick Wins and Falling Stars detection.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <CardTitle>Quick Wins</CardTitle>
              </div>
              <Switch
                checked={quickWins.enabled}
                onCheckedChange={(checked) =>
                  setQuickWins((prev) => ({ ...prev, enabled: checked }))
                }
                data-testid="switch-quick-wins-enabled"
              />
            </div>
            <CardDescription>
              Identify high-opportunity keywords positioned just outside the top rankings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="qw-min-pos">Min Position</Label>
                <Input
                  id="qw-min-pos"
                  type="number"
                  min={1}
                  value={quickWins.minPosition}
                  onChange={(e) =>
                    setQuickWins((prev) => ({
                      ...prev,
                      minPosition: parseInt(e.target.value) || 1,
                    }))
                  }
                  data-testid="input-quick-wins-min-position"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum position to consider (default: 6)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qw-max-pos">Max Position</Label>
                <Input
                  id="qw-max-pos"
                  type="number"
                  min={1}
                  value={quickWins.maxPosition}
                  onChange={(e) =>
                    setQuickWins((prev) => ({
                      ...prev,
                      maxPosition: parseInt(e.target.value) || 20,
                    }))
                  }
                  data-testid="input-quick-wins-max-position"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum position to consider (default: 20)
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="qw-min-vol">Min Search Volume</Label>
                <Input
                  id="qw-min-vol"
                  type="number"
                  min={0}
                  value={quickWins.minVolume}
                  onChange={(e) =>
                    setQuickWins((prev) => ({
                      ...prev,
                      minVolume: parseInt(e.target.value) || 0,
                    }))
                  }
                  data-testid="input-quick-wins-min-volume"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum monthly search volume
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qw-max-diff">Max Difficulty</Label>
                <Input
                  id="qw-max-diff"
                  type="number"
                  min={0}
                  max={100}
                  value={quickWins.maxDifficulty}
                  onChange={(e) =>
                    setQuickWins((prev) => ({
                      ...prev,
                      maxDifficulty: parseInt(e.target.value) || 70,
                    }))
                  }
                  data-testid="input-quick-wins-max-difficulty"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum keyword difficulty (0-100)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Valid Intents</Label>
              <div className="flex flex-wrap gap-3">
                {intentOptions.map((intent) => (
                  <label
                    key={intent.value}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Checkbox
                      checked={quickWins.validIntents.includes(intent.value)}
                      onCheckedChange={() => handleIntentToggle(intent.value)}
                      data-testid={`checkbox-qw-intent-${intent.value}`}
                    />
                    <span className="text-sm">{intent.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Only keywords with selected intents will be shown
              </p>
            </div>

            <div className="flex justify-between gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => setQuickWins(quickWinsData || defaultQuickWins)}
                data-testid="button-reset-quick-wins"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                onClick={() => saveQuickWinsMutation.mutate(quickWins)}
                disabled={saveQuickWinsMutation.isPending}
                data-testid="button-save-quick-wins"
              >
                <Save className="mr-2 h-4 w-4" />
                {saveQuickWinsMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <CardTitle>Falling Stars</CardTitle>
              </div>
              <Switch
                checked={fallingStars.enabled}
                onCheckedChange={(checked) =>
                  setFallingStars((prev) => ({ ...prev, enabled: checked }))
                }
                data-testid="switch-falling-stars-enabled"
              />
            </div>
            <CardDescription>
              Alert when keywords drop significantly in rankings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fs-window">Lookback Window (Days)</Label>
                <Input
                  id="fs-window"
                  type="number"
                  min={1}
                  max={30}
                  value={fallingStars.windowDays}
                  onChange={(e) =>
                    setFallingStars((prev) => ({
                      ...prev,
                      windowDays: parseInt(e.target.value) || 7,
                    }))
                  }
                  data-testid="input-falling-stars-window"
                />
                <p className="text-xs text-muted-foreground">
                  Days to look back for position changes
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-min-drop">Min Position Drop</Label>
                <Input
                  id="fs-min-drop"
                  type="number"
                  min={1}
                  value={fallingStars.minDropPositions}
                  onChange={(e) =>
                    setFallingStars((prev) => ({
                      ...prev,
                      minDropPositions: parseInt(e.target.value) || 5,
                    }))
                  }
                  data-testid="input-falling-stars-min-drop"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum positions to drop to trigger alert
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fs-min-prev-pos">Min Previous Position</Label>
                <Input
                  id="fs-min-prev-pos"
                  type="number"
                  min={1}
                  value={fallingStars.minPreviousPosition}
                  onChange={(e) =>
                    setFallingStars((prev) => ({
                      ...prev,
                      minPreviousPosition: parseInt(e.target.value) || 10,
                    }))
                  }
                  data-testid="input-falling-stars-min-prev-position"
                />
                <p className="text-xs text-muted-foreground">
                  Only alert if previous position was in top N
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-min-vol">Min Search Volume</Label>
                <Input
                  id="fs-min-vol"
                  type="number"
                  min={0}
                  value={fallingStars.minVolume}
                  onChange={(e) =>
                    setFallingStars((prev) => ({
                      ...prev,
                      minVolume: parseInt(e.target.value) || 0,
                    }))
                  }
                  data-testid="input-falling-stars-min-volume"
                />
                <p className="text-xs text-muted-foreground">
                  Filter low-volume keywords (0 = no filter)
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="mb-2 text-sm font-medium">Current Thresholds</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Window: {fallingStars.windowDays} days
                </Badge>
                <Badge variant="outline">
                  Min drop: {fallingStars.minDropPositions} positions
                </Badge>
                <Badge variant="outline">
                  Was in top {fallingStars.minPreviousPosition}
                </Badge>
                {fallingStars.minVolume > 0 && (
                  <Badge variant="outline">
                    Min volume: {fallingStars.minVolume.toLocaleString()}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex justify-between gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => setFallingStars(fallingStarsData || defaultFallingStars)}
                data-testid="button-reset-falling-stars"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                onClick={() => saveFallingStarsMutation.mutate(fallingStars)}
                disabled={saveFallingStarsMutation.isPending}
                data-testid="button-save-falling-stars"
              >
                <Save className="mr-2 h-4 w-4" />
                {saveFallingStarsMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
