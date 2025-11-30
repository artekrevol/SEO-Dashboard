import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Clock } from "lucide-react";
import type { CrawlSchedule } from "@shared/schema";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ScheduledCrawlsPage({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    url: "",
    scheduledTime: "14:00",
    daysOfWeek: [1, 3, 5] as number[],
    isActive: true,
  });

  const { data: schedules = [], isLoading } = useQuery<CrawlSchedule[]>({
    queryKey: ["/api/crawl-schedules", projectId],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/crawl-schedules", {
        projectId,
        ...data,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crawl-schedules", projectId] });
      setFormData({ url: "", scheduledTime: "14:00", daysOfWeek: [1, 3, 5], isActive: true });
      setShowForm(false);
      toast({ title: "Schedule created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create schedule", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("PATCH", `/api/crawl-schedules/${editingId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crawl-schedules", projectId] });
      setFormData({ url: "", scheduledTime: "14:00", daysOfWeek: [1, 3, 5], isActive: true });
      setEditingId(null);
      setShowForm(false);
      toast({ title: "Schedule updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/crawl-schedules/${id}`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crawl-schedules", projectId] });
      toast({ title: "Schedule deleted" });
    },
  });

  const handleSubmit = () => {
    if (!formData.url || !formData.scheduledTime) {
      toast({ title: "Error", description: "URL and time are required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (schedule: CrawlSchedule) => {
    setFormData({
      url: schedule.url,
      scheduledTime: schedule.scheduledTime,
      daysOfWeek: schedule.daysOfWeek,
      isActive: schedule.isActive,
    });
    setEditingId(schedule.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-scheduled-crawls">
          Scheduled Page Crawls
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up automatic crawls for specific pages at predefined times and days
        </p>
      </div>

      {!showForm && (
        <Button onClick={() => setShowForm(true)} data-testid="button-add-schedule">
          <Plus className="w-4 h-4 mr-2" />
          Add Schedule
        </Button>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Schedule" : "Create New Schedule"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Page URL</label>
              <input
                type="text"
                placeholder="https://example.com/page"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                data-testid="input-url"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Crawl Time (24h format)</label>
              <input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="px-3 py-2 border rounded-md"
                data-testid="input-time"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Days of Week</label>
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const days = formData.daysOfWeek.includes(idx)
                        ? formData.daysOfWeek.filter((d) => d !== idx)
                        : [...formData.daysOfWeek, idx];
                      setFormData({ ...formData, daysOfWeek: days.sort() });
                    }}
                    className={`p-2 text-xs font-medium rounded ${
                      formData.daysOfWeek.includes(idx)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                    data-testid={`button-day-${day.toLowerCase()}`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-schedule"
              >
                {editingId ? "Update" : "Create"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({ url: "", scheduledTime: "14:00", daysOfWeek: [1, 3, 5], isActive: true });
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading schedules...</p>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No scheduled crawls yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id} data-testid={`card-schedule-${schedule.id}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm break-all" data-testid={`text-url-${schedule.id}`}>
                      {schedule.url}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground" data-testid={`text-time-${schedule.id}`}>
                        {schedule.scheduledTime}
                      </span>
                      <Badge variant={schedule.isActive ? "default" : "secondary"} data-testid={`badge-status-${schedule.id}`}>
                        {schedule.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {schedule.daysOfWeek.map((day) => (
                        <Badge key={day} variant="outline" className="text-xs" data-testid={`badge-day-${schedule.id}-${day}`}>
                          {DAYS[day].slice(0, 3)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(schedule)}
                      data-testid={`button-edit-${schedule.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(schedule.id)}
                      data-testid={`button-delete-${schedule.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
