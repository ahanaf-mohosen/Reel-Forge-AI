import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Video, Clock, Eye, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/stats-card";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();

  const { data: projects, isLoading, error } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Project deleted",
        description: "The project has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete",
        description: "Could not delete the project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const stats = {
    reelsGenerated: projects?.reduce((acc, p) => p.status === 'completed' ? acc + 3 : acc, 0) || 0,
    totalViews: 0,
    timeSaved: (projects?.filter(p => p.status === 'completed').length || 0) * 45,
  };

  const recentProjects = projects?.slice(0, 6) || [];

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          title="Something went wrong"
          description="Could not load your projects. Please refresh the page."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8" data-testid="dashboard-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome back!</h1>
          <p className="text-muted-foreground">
            Ready to create some viral content?
          </p>
        </div>
        <Button asChild data-testid="button-create-new">
          <Link href="/create">
            <Plus className="w-4 h-4 mr-2" />
            Create New Reel
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <StatsCard
              title="Reels Generated"
              value={stats.reelsGenerated}
              icon={Video}
              description="Total reels created"
            />
            <StatsCard
              title="Total Views"
              value={stats.totalViews.toLocaleString()}
              icon={Eye}
              description="Across all platforms"
            />
            <StatsCard
              title="Time Saved"
              value={`${stats.timeSaved} min`}
              icon={Clock}
              description="Compared to manual editing"
            />
          </>
        )}
      </div>

      <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Plus className="w-10 h-10 text-primary" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-1">Create Your Next Viral Reel</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Upload a video or paste a YouTube link to get started. Our AI will find the best moments for you.
              </p>
              <Button asChild data-testid="button-quick-create">
                <Link href="/create">
                  Get Started
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Projects</h2>
          {recentProjects.length > 0 && (
            <Button variant="ghost" asChild data-testid="link-view-all">
              <Link href="/library">View All</Link>
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <Skeleton className="aspect-video" />
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : recentProjects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create your first reel to get started. Upload a video and let our AI do the magic!"
            action={{
              label: "Create Your First Reel",
              href: "/create",
            }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
