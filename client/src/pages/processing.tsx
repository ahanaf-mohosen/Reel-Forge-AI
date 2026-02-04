import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Home, X, Video, FileVideo, Clock, HardDrive, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProcessingSteps } from "@/components/processing-steps";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, ProcessingStatus } from "@shared/schema";

export default function Processing() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const { toast } = useToast();

  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: ['/api/projects', id],
    refetchInterval: (data) => {
      if (!data) return 2000;
      const status = data.status;
      if (status === 'completed' || status === 'failed') return false;
      return 2000;
    },
  });

  useEffect(() => {
    if (project?.status === 'completed') {
      setLocation(`/results/${id}`);
    }
  }, [project?.status, id, setLocation]);

  const handleCancel = async () => {
    try {
      await apiRequest('POST', `/api/projects/${id}/cancel`);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Processing cancelled",
        description: "The project has been cancelled.",
      });
      setLocation('/dashboard');
    } catch (error) {
      toast({
        title: "Failed to cancel",
        description: "Could not cancel the processing. Please try again.",
        variant: "destructive",
      });
    }
    setShowCancelDialog(false);
  };

  const handleRetry = async () => {
    try {
      await apiRequest('POST', `/api/projects/${id}/retry`);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
      toast({
        title: "Retrying...",
        description: "The processing has been restarted.",
      });
    } catch (error) {
      toast({
        title: "Failed to retry",
        description: "Could not restart processing. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
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

  const isFailed = project.status === 'failed';

  return (
    <div className="p-6" data-testid="processing-page">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/dashboard" className="hover:text-foreground flex items-center gap-1">
          <Home className="w-4 h-4" />
          Dashboard
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">Processing</span>
      </nav>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center border-b">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              {isFailed ? (
                <AlertCircle className="w-10 h-10 text-destructive" />
              ) : (
                <Video className="w-10 h-10 text-primary animate-pulse-soft" />
              )}
            </div>
            <CardTitle className="text-xl">
              {isFailed ? 'Processing Failed' : 'Processing Your Video'}
            </CardTitle>
            <p className="text-muted-foreground">
              {isFailed 
                ? project.error || 'An error occurred while processing your video.'
                : 'Please wait while our AI analyzes your content...'
              }
            </p>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {project.originalVideo && (
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                  <FileVideo className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{project.originalVideo.filename}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(project.originalVideo.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      {formatFileSize(project.originalVideo.size)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!isFailed && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-medium">{Math.round(project.progress)}%</span>
                </div>
                <Progress 
                  value={project.progress} 
                  className="h-3"
                  data-testid="progress-bar"
                />
                {project.estimatedTimeRemaining && project.estimatedTimeRemaining > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Estimated time remaining: {Math.ceil(project.estimatedTimeRemaining / 60)} minutes
                  </p>
                )}
              </div>
            )}

            <ProcessingSteps 
              currentStatus={project.status} 
              progress={project.progress} 
            />

            <div className="flex justify-center gap-4 pt-4">
              {isFailed ? (
                <>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard">Go Back</Link>
                  </Button>
                  <Button onClick={handleRetry} data-testid="button-retry">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setShowCancelDialog(true)}
                  data-testid="button-cancel"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel Processing
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Processing?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel? All progress will be lost and you'll need to start over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Processing</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground">
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
