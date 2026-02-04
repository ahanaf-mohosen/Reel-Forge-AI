import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Filter, SortAsc, Plus, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

export default function Library() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
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

  const filteredProjects = projects
    ?.filter((project) => {
      const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    }) || [];

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
    <div className="p-6" data-testid="library-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-muted-foreground">
            All your video projects in one place
          </p>
        </div>
        <Button asChild data-testid="button-create-project">
          <Link href="/create">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Ready</SelectItem>
              <SelectItem value="uploading">Uploading</SelectItem>
              <SelectItem value="transcribing">Transcribing</SelectItem>
              <SelectItem value="analyzing">Analyzing</SelectItem>
              <SelectItem value="cutting">Cutting</SelectItem>
              <SelectItem value="formatting">Formatting</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]" data-testid="select-sort">
              <SortAsc className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="name">By Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <Skeleton className="aspect-video" />
              <CardContent className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        projects && projects.length > 0 ? (
          <EmptyState
            title="No projects found"
            description="Try adjusting your search or filters"
          />
        ) : (
          <EmptyState
            title="No projects yet"
            description="Create your first reel to get started. Upload a video and let our AI do the magic!"
            action={{
              label: "Create Your First Reel",
              href: "/create",
            }}
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {filteredProjects.length > 0 && (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Showing {filteredProjects.length} of {projects?.length || 0} projects
        </div>
      )}
    </div>
  );
}
