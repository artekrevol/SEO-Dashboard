import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ProjectSelector } from "@/components/project-selector";
import { DateRangePicker } from "@/components/date-range-picker";
import { Dashboard } from "@/pages/dashboard";
import { KeywordsPage } from "@/pages/keywords";
import { PagesPage } from "@/pages/pages";
import { RecommendationsPage } from "@/pages/recommendations";
import { CompetitorsPage } from "@/pages/competitors";
import { DataManagementPage } from "@/pages/data-management";
import { ScheduledCrawlsPage } from "@/pages/scheduled-crawls";
import NotFound from "@/pages/not-found";
import { DateRange } from "react-day-picker";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";

function AppContent() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery<{ projects: Project[] }>({
    queryKey: ["/api/projects"],
  });

  const projects = projectsData?.projects || [];

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; domain: string }) => {
      return await apiRequest("POST", "/api/projects", data);
    },
    onSuccess: async (response) => {
      const newProject = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setSelectedProjectId(newProject.id);
      toast({
        title: "Project created",
        description: "Your new project has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project.",
        variant: "destructive",
      });
    },
  });

  const handleCreateProject = (data: { name: string; domain: string }) => {
    createProjectMutation.mutate(data);
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ProjectSelector
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
                onCreateProject={handleCreateProject}
                isCreating={createProjectMutation.isPending}
              />
            </div>
            <div className="flex items-center gap-4">
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            <Switch>
              <Route path="/">
                <Dashboard projectId={selectedProjectId} />
              </Route>
              <Route path="/keywords">
                <KeywordsPage projectId={selectedProjectId} />
              </Route>
              <Route path="/pages">
                <PagesPage projectId={selectedProjectId} />
              </Route>
              <Route path="/recommendations">
                <RecommendationsPage projectId={selectedProjectId} />
              </Route>
              <Route path="/competitors">
                <CompetitorsPage projectId={selectedProjectId} />
              </Route>
              <Route path="/data-management">
                <DataManagementPage projectId={selectedProjectId || ""} />
              </Route>
              <Route path="/scheduled-crawls">
                <ScheduledCrawlsPage projectId={selectedProjectId || ""} />
              </Route>
              <Route path="/rankings">
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <h2 className="text-xl font-semibold">Rankings</h2>
                    <p className="mt-2 text-muted-foreground">
                      Historical rank tracking coming soon.
                    </p>
                  </div>
                </div>
              </Route>
              <Route path="/reports">
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <h2 className="text-xl font-semibold">Reports</h2>
                    <p className="mt-2 text-muted-foreground">
                      Custom SEO reports coming soon.
                    </p>
                  </div>
                </div>
              </Route>
              <Route path="/settings">
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <h2 className="text-xl font-semibold">Settings</h2>
                    <p className="mt-2 text-muted-foreground">
                      Project and API settings coming soon.
                    </p>
                  </div>
                </div>
              </Route>
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="seo-dashboard-theme">
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
