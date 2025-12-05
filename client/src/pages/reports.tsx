import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, 
  Mail, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Send, 
  Eye, 
  Trash2, 
  Edit, 
  Play, 
  Loader2,
  RefreshCw,
  FileText
} from "lucide-react";
import type { ScheduledReport, ReportRun, Project } from "@shared/schema";

const REPORT_TYPES = [
  { value: "weekly_summary", label: "Weekly Summary" },
  { value: "monthly_report", label: "Monthly Report" },
  { value: "executive_brief", label: "Executive Brief" },
  { value: "competitor_analysis", label: "Competitor Analysis" },
  { value: "keyword_performance", label: "Keyword Performance" },
];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function formatDate(date: Date | string | null): string {
  if (!date) return "Never";
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
    case "failed":
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    case "generating":
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Generating</Badge>;
    case "sending":
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Send className="w-3 h-3 mr-1" />Sending</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("scheduled");

  const [newReport, setNewReport] = useState({
    name: "",
    reportType: "weekly_summary",
    frequency: "weekly",
    dayOfWeek: 1,
    dayOfMonth: 1,
    timeOfDay: "09:00",
    recipients: "",
    includeExecutiveSummary: true,
    includeTrends: true,
    includeRecommendations: true,
    includeCompetitors: false,
  });

  const [manualReport, setManualReport] = useState({
    reportType: "weekly_summary",
    recipients: "",
    includeExecutiveSummary: true,
    includeTrends: true,
    includeRecommendations: true,
    includeCompetitors: false,
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery<{ projects?: Project[] }>({
    queryKey: ["/api/projects"],
  });

  const projects = projectsData?.projects || (Array.isArray(projectsData) ? projectsData : []);

  const { data: scheduledReportsData, isLoading: reportsLoading, refetch: refetchReports } = useQuery<{ reports: ScheduledReport[] }>({
    queryKey: [`/api/scheduled-reports?projectId=${selectedProjectId}`],
    enabled: !!selectedProjectId,
  });

  const { data: reportRunsData, isLoading: runsLoading, refetch: refetchRuns } = useQuery<{ runs: ReportRun[] }>({
    queryKey: [`/api/report-runs?projectId=${selectedProjectId}`],
    enabled: !!selectedProjectId,
  });

  const scheduledReports = scheduledReportsData?.reports || [];
  const reportRuns = reportRunsData?.runs || [];

  const createReportMutation = useMutation({
    mutationFn: async (data: typeof newReport) => {
      const recipients = data.recipients.split(",").map(e => e.trim()).filter(e => e);
      const response = await apiRequest("POST", "/api/scheduled-reports", {
        projectId: selectedProjectId,
        ...data,
        recipients,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Scheduled report created successfully" });
      setIsCreateDialogOpen(false);
      setNewReport({
        name: "",
        reportType: "weekly_summary",
        frequency: "weekly",
        dayOfWeek: 1,
        dayOfMonth: 1,
        timeOfDay: "09:00",
        recipients: "",
        includeExecutiveSummary: true,
        includeTrends: true,
        includeRecommendations: true,
        includeCompetitors: false,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/scheduled-reports?projectId=${selectedProjectId}`] });
    },
    onError: (error) => {
      toast({ title: "Failed to create report", description: String(error), variant: "destructive" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/scheduled-reports/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Report deleted" });
      queryClient.invalidateQueries({ queryKey: [`/api/scheduled-reports?projectId=${selectedProjectId}`] });
    },
    onError: (error) => {
      toast({ title: "Failed to delete report", description: String(error), variant: "destructive" });
    },
  });

  const toggleReportMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/scheduled-reports/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Report updated" });
      queryClient.invalidateQueries({ queryKey: [`/api/scheduled-reports?projectId=${selectedProjectId}`] });
    },
    onError: (error) => {
      toast({ title: "Failed to update report", description: String(error), variant: "destructive" });
    },
  });

  const sendManualReportMutation = useMutation({
    mutationFn: async (data: typeof manualReport) => {
      const recipients = data.recipients.split(",").map(e => e.trim()).filter(e => e);
      const response = await apiRequest("POST", "/api/reports/send", {
        projectId: selectedProjectId,
        ...data,
        recipients,
      });
      return response.json();
    },
    onSuccess: (result: { success: boolean; message: string }) => {
      toast({ title: result.success ? "Report sent" : "Report generation in progress", description: result.message });
      setIsSendDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/report-runs", selectedProjectId] });
    },
    onError: (error) => {
      toast({ title: "Failed to send report", description: String(error), variant: "destructive" });
    },
  });

  const previewReportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reports/preview", {
        projectId: selectedProjectId,
        ...manualReport,
      });
      return response.json();
    },
    onSuccess: (result: { html: string }) => {
      setPreviewHtml(result.html);
    },
    onError: (error) => {
      toast({ title: "Failed to generate preview", description: String(error), variant: "destructive" });
    },
  });

  if (projectsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Email Reports</h1>
          <p className="text-muted-foreground">Schedule and send automated SEO reports</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[240px]" data-testid="select-project">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project: Project) => (
                <SelectItem key={project.id} value={project.id} data-testid={`project-option-${project.id}`}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProjectId && (
            <>
              <Button
                variant="outline"
                onClick={() => { refetchReports(); refetchRuns(); }}
                data-testid="button-refresh"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-send-now">
                    <Send className="w-4 h-4 mr-2" />
                    Send Now
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Send Manual Report</DialogTitle>
                    <DialogDescription>Send a one-time report immediately</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Report Type</Label>
                        <Select 
                          value={manualReport.reportType} 
                          onValueChange={(v) => setManualReport(prev => ({ ...prev, reportType: v }))}
                        >
                          <SelectTrigger data-testid="select-manual-report-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REPORT_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Recipients (comma separated)</Label>
                        <Input
                          placeholder="email@example.com, email2@example.com"
                          value={manualReport.recipients}
                          onChange={(e) => setManualReport(prev => ({ ...prev, recipients: e.target.value }))}
                          data-testid="input-manual-recipients"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Include Sections</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={manualReport.includeExecutiveSummary}
                            onCheckedChange={(v) => setManualReport(prev => ({ ...prev, includeExecutiveSummary: v }))}
                            data-testid="switch-manual-executive-summary"
                          />
                          <Label className="text-sm">Executive Summary</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={manualReport.includeTrends}
                            onCheckedChange={(v) => setManualReport(prev => ({ ...prev, includeTrends: v }))}
                            data-testid="switch-manual-trends"
                          />
                          <Label className="text-sm">Trends</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={manualReport.includeRecommendations}
                            onCheckedChange={(v) => setManualReport(prev => ({ ...prev, includeRecommendations: v }))}
                            data-testid="switch-manual-recommendations"
                          />
                          <Label className="text-sm">Recommendations</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={manualReport.includeCompetitors}
                            onCheckedChange={(v) => setManualReport(prev => ({ ...prev, includeCompetitors: v }))}
                            data-testid="switch-manual-competitors"
                          />
                          <Label className="text-sm">Competitors</Label>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => previewReportMutation.mutate()}
                      disabled={previewReportMutation.isPending}
                      className="w-full"
                      data-testid="button-preview-report"
                    >
                      {previewReportMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4 mr-2" />
                      )}
                      Preview Report
                    </Button>
                    {previewHtml && (
                      <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto bg-background">
                        <iframe
                          srcDoc={previewHtml}
                          className="w-full h-[280px] border-0"
                          title="Report Preview"
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSendDialogOpen(false)} data-testid="button-cancel-send">
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => sendManualReportMutation.mutate(manualReport)}
                      disabled={sendManualReportMutation.isPending || !manualReport.recipients}
                      data-testid="button-confirm-send"
                    >
                      {sendManualReportMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send Report
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-schedule">
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Scheduled Report</DialogTitle>
                    <DialogDescription>Set up an automated report schedule</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Report Name</Label>
                      <Input
                        placeholder="Weekly SEO Summary"
                        value={newReport.name}
                        onChange={(e) => setNewReport(prev => ({ ...prev, name: e.target.value }))}
                        data-testid="input-report-name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Report Type</Label>
                        <Select 
                          value={newReport.reportType} 
                          onValueChange={(v) => setNewReport(prev => ({ ...prev, reportType: v }))}
                        >
                          <SelectTrigger data-testid="select-report-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REPORT_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Select 
                          value={newReport.frequency} 
                          onValueChange={(v) => setNewReport(prev => ({ ...prev, frequency: v }))}
                        >
                          <SelectTrigger data-testid="select-frequency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FREQUENCIES.map(freq => (
                              <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {(newReport.frequency === "weekly" || newReport.frequency === "biweekly") && (
                        <div className="space-y-2">
                          <Label>Day of Week</Label>
                          <Select 
                            value={String(newReport.dayOfWeek)} 
                            onValueChange={(v) => setNewReport(prev => ({ ...prev, dayOfWeek: Number(v) }))}
                          >
                            <SelectTrigger data-testid="select-day-of-week">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map(day => (
                                <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {newReport.frequency === "monthly" && (
                        <div className="space-y-2">
                          <Label>Day of Month</Label>
                          <Select 
                            value={String(newReport.dayOfMonth)} 
                            onValueChange={(v) => setNewReport(prev => ({ ...prev, dayOfMonth: Number(v) }))}
                          >
                            <SelectTrigger data-testid="select-day-of-month">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 28 }, (_, i) => (
                                <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Time of Day</Label>
                        <Input
                          type="time"
                          value={newReport.timeOfDay}
                          onChange={(e) => setNewReport(prev => ({ ...prev, timeOfDay: e.target.value }))}
                          data-testid="input-time-of-day"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Recipients (comma separated)</Label>
                      <Input
                        placeholder="email@example.com, email2@example.com"
                        value={newReport.recipients}
                        onChange={(e) => setNewReport(prev => ({ ...prev, recipients: e.target.value }))}
                        data-testid="input-recipients"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Include Sections</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={newReport.includeExecutiveSummary}
                            onCheckedChange={(v) => setNewReport(prev => ({ ...prev, includeExecutiveSummary: v }))}
                            data-testid="switch-executive-summary"
                          />
                          <Label className="text-sm">Executive Summary</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={newReport.includeTrends}
                            onCheckedChange={(v) => setNewReport(prev => ({ ...prev, includeTrends: v }))}
                            data-testid="switch-trends"
                          />
                          <Label className="text-sm">Trends</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={newReport.includeRecommendations}
                            onCheckedChange={(v) => setNewReport(prev => ({ ...prev, includeRecommendations: v }))}
                            data-testid="switch-recommendations"
                          />
                          <Label className="text-sm">Recommendations</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={newReport.includeCompetitors}
                            onCheckedChange={(v) => setNewReport(prev => ({ ...prev, includeCompetitors: v }))}
                            data-testid="switch-competitors"
                          />
                          <Label className="text-sm">Competitors</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createReportMutation.mutate(newReport)}
                      disabled={createReportMutation.isPending || !newReport.name || !newReport.recipients}
                      data-testid="button-confirm-create"
                    >
                      {createReportMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Schedule
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {!selectedProjectId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Mail className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Select a project to manage email reports
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="scheduled" data-testid="tab-scheduled">
              <Clock className="w-4 h-4 mr-2" />
              Scheduled Reports
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <FileText className="w-4 h-4 mr-2" />
              Report History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Reports</CardTitle>
                <CardDescription>Automated reports sent on a regular schedule</CardDescription>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : scheduledReports.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No scheduled reports yet</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setIsCreateDialogOpen(true)}
                      data-testid="button-create-first-schedule"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Schedule
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Recipients</TableHead>
                        <TableHead>Next Send</TableHead>
                        <TableHead>Last Sent</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledReports.map((report) => (
                        <TableRow key={report.id} data-testid={`row-scheduled-report-${report.id}`}>
                          <TableCell className="font-medium">{report.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {REPORT_TYPES.find(t => t.value === report.reportType)?.label || report.reportType}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{report.frequency}</TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">
                              {(report.recipients as string[])?.length || 0} recipients
                            </span>
                          </TableCell>
                          <TableCell>{formatDate(report.nextScheduledAt)}</TableCell>
                          <TableCell>{formatDate(report.lastSentAt)}</TableCell>
                          <TableCell>
                            <Switch
                              checked={report.isActive ?? true}
                              onCheckedChange={(checked) => 
                                toggleReportMutation.mutate({ id: report.id, isActive: checked })
                              }
                              data-testid={`switch-active-${report.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteReportMutation.mutate(report.id)}
                              disabled={deleteReportMutation.isPending}
                              data-testid={`button-delete-${report.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
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

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Report History</CardTitle>
                <CardDescription>Past report runs and their status</CardDescription>
              </CardHeader>
              <CardContent>
                {runsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : reportRuns.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No reports sent yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report Type</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead>Emails Sent</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportRuns.map((run) => (
                        <TableRow key={run.id} data-testid={`row-report-run-${run.id}`}>
                          <TableCell>
                            <Badge variant="outline">
                              {REPORT_TYPES.find(t => t.value === run.reportType)?.label || run.reportType}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{run.triggerType}</TableCell>
                          <TableCell>{formatDate(run.startedAt)}</TableCell>
                          <TableCell>{formatDate(run.completedAt)}</TableCell>
                          <TableCell>{run.emailsSent || 0}</TableCell>
                          <TableCell>{getStatusBadge(run.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
