import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Rocket,
  Bug,
  Sparkles,
  AlertTriangle,
  Shield,
  Trash2,
  Edit,
  Calendar,
  Tag,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AppVersion } from "@shared/schema";

const CHANGE_TYPES = [
  { value: "feature", label: "New Feature", icon: Sparkles, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { value: "bugfix", label: "Bug Fix", icon: Bug, color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  { value: "improvement", label: "Improvement", icon: Rocket, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { value: "breaking", label: "Breaking Change", icon: AlertTriangle, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { value: "security", label: "Security", icon: Shield, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
];

function getChangeTypeInfo(changeType: string) {
  return CHANGE_TYPES.find((t) => t.value === changeType) || CHANGE_TYPES[0];
}

function VersionCard({ version, onEdit, onDelete }: { 
  version: AppVersion; 
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeInfo = getChangeTypeInfo(version.changeType);
  const TypeIcon = typeInfo.icon;

  return (
    <Card className="hover-elevate" data-testid={`card-version-${version.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <Badge className={typeInfo.color}>
              <TypeIcon className="h-3 w-3 mr-1" />
              {typeInfo.label}
            </Badge>
            <Badge variant="outline" className="font-mono">
              <Tag className="h-3 w-3 mr-1" />
              v{version.version}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              data-testid={`button-edit-version-${version.id}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              data-testid={`button-delete-version-${version.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardTitle className="text-lg mt-2">{version.title}</CardTitle>
        <CardDescription className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {format(new Date(version.releasedAt), "MMMM d, yyyy 'at' h:mm a")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
          {version.releaseNotes}
        </div>
      </CardContent>
    </Card>
  );
}

export function VersionControlPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editVersion, setEditVersion] = useState<AppVersion | null>(null);
  const [formData, setFormData] = useState({
    version: "",
    title: "",
    releaseNotes: "",
    changeType: "feature",
  });

  const { data: versions, isLoading } = useQuery<AppVersion[]>({
    queryKey: ["/api/versions"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/versions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/versions"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Version added",
        description: "The new version has been published.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add version.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return await apiRequest("PATCH", `/api/versions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/versions"] });
      setEditVersion(null);
      resetForm();
      toast({
        title: "Version updated",
        description: "The version has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update version.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/versions/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/versions"] });
      toast({
        title: "Version deleted",
        description: "The version has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete version.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      version: "",
      title: "",
      releaseNotes: "",
      changeType: "feature",
    });
  };

  const openEditDialog = (version: AppVersion) => {
    setEditVersion(version);
    setFormData({
      version: version.version,
      title: version.title,
      releaseNotes: version.releaseNotes,
      changeType: version.changeType,
    });
  };

  const handleSubmit = () => {
    if (!formData.version || !formData.title || !formData.releaseNotes) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (editVersion) {
      updateMutation.mutate({ id: editVersion.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this version?")) {
      deleteMutation.mutate(id);
    }
  };

  const isDialogOpen = isAddDialogOpen || editVersion !== null;
  const closeDialog = () => {
    setIsAddDialogOpen(false);
    setEditVersion(null);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Version Control</h1>
          <p className="text-muted-foreground">
            Track and publish release notes for app updates
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}
          data-testid="button-add-version"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Release
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : versions && versions.length > 0 ? (
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-4 pr-4">
            {versions.map((version) => (
              <VersionCard
                key={version.id}
                version={version}
                onEdit={() => openEditDialog(version)}
                onDelete={() => handleDelete(version.id)}
              />
            ))}
          </div>
        </ScrollArea>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Rocket className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Releases Yet</h3>
            <p className="text-muted-foreground text-center mt-2 max-w-sm">
              Start documenting your app updates by adding your first release notes.
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                resetForm();
                setIsAddDialogOpen(true);
              }}
              data-testid="button-add-first-version"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Release
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editVersion ? "Edit Release" : "Add New Release"}
            </DialogTitle>
            <DialogDescription>
              {editVersion 
                ? "Update the release information below."
                : "Document a new app release with version number and release notes."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Version Number</label>
                <Input
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="1.0.0"
                  data-testid="input-version"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Change Type</label>
                <Select
                  value={formData.changeType}
                  onValueChange={(value) => setFormData({ ...formData, changeType: value })}
                >
                  <SelectTrigger data-testid="select-change-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANGE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Target URL Editing, Bug Fixes, Performance Improvements"
                data-testid="input-title"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Release Notes</label>
              <Textarea
                value={formData.releaseNotes}
                onChange={(e) => setFormData({ ...formData, releaseNotes: e.target.value })}
                placeholder="Describe what's new in this release...&#10;&#10;- Added feature X&#10;- Fixed bug Y&#10;- Improved performance of Z"
                rows={8}
                data-testid="input-release-notes"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use markdown-style formatting. Each line starting with "-" will be shown as a bullet point.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              data-testid="button-cancel-version"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-version"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editVersion
                ? "Update Release"
                : "Publish Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
