import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Home, Download, Plus, Video, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ReelCard } from "@/components/reel-card";
import { useToast } from "@/hooks/use-toast";
import type { Project, Reel } from "@shared/schema";

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery<Project>({
    queryKey: ['/api/projects', id],
  });

  const { data: reels, isLoading: reelsLoading } = useQuery<Reel[]>({
    queryKey: ['/api/projects', id, 'reels'],
    enabled: !!project && project.status === 'completed',
  });

  const handleDownload = async (reelId: string) => {
    try {
      const response = await fetch(`/api/reels/${id}/${reelId}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reel_${reelId}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download started!",
        description: "Your reel is being downloaded.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the reel. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAll = async () => {
    if (!reels) return;
    
    for (const reel of reels) {
      await handleDownload(reel.id);
    }
  };

  const handleEdit = (reelId: string) => {
    toast({
      title: "Editor coming soon",
      description: "The reel editor is still in development.",
    });
  };

  const handleRegenerate = (reelId: string) => {
    toast({
      title: "Regeneration coming soon",
      description: "This feature is still in development.",
    });
  };

  if (projectLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton className="aspect-[9/16]" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The project you're looking for doesn't exist or has been deleted.
            </p>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="results-page">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/dashboard" className="hover:text-foreground flex items-center gap-1">
          <Home className="w-4 h-4" />
          Dashboard
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/library" className="hover:text-foreground">
          Library
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">{project.name}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" data-testid="project-name">{project.name}</h1>
          <p className="text-muted-foreground">
            Created {new Date(project.createdAt).toLocaleDateString()} • {reels?.length || 0} reels generated
          </p>
        </div>
        
        <div className="flex gap-2">
          {reels && reels.length > 0 && (
            <Button onClick={handleDownloadAll} data-testid="button-download-all">
              <Download className="w-4 h-4 mr-2" />
              Download All
            </Button>
          )}
          <Button variant="outline" asChild data-testid="button-create-new">
            <Link href="/create">
              <Plus className="w-4 h-4 mr-2" />
              Create New
            </Link>
          </Button>
        </div>
      </div>

      {reelsLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton className="aspect-[9/16]" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !reels || reels.length === 0 ? (
        <Card className="p-12 text-center">
          <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Reels Generated Yet</h3>
          <p className="text-muted-foreground mb-4">
            Your reels are still being processed. Check back in a moment.
          </p>
          <Button variant="outline" asChild>
            <Link href={`/processing/${id}`}>View Progress</Link>
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {reels.map((reel) => (
              <ReelCard
                key={reel.id}
                reel={reel}
                isSelected={selectedReelId === reel.id}
                onSelect={(reelId) => setSelectedReelId(selectedReelId === reelId ? null : reelId)}
                onDownload={handleDownload}
                onEdit={handleEdit}
                onRegenerate={handleRegenerate}
              />
            ))}
          </div>

          {selectedReelId && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Why This Moment?</h2>
              </div>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {reels.find(r => r.id === selectedReelId)?.reason || 
                     `Clip from ${reels.find(r => r.id === selectedReelId)?.start}s to ${reels.find(r => r.id === selectedReelId)?.end}s`}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
