import { Link } from "wouter";
import { MoreHorizontal, Play, Trash2, Eye, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@shared/schema";

interface ProjectCardProps {
  project: Project;
  onDelete?: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'uploading':
      case 'transcribing':
      case 'analyzing':
      case 'cutting':
      case 'formatting':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Ready';
      case 'failed':
        return 'Failed';
      case 'uploading':
        return 'Uploading';
      case 'transcribing':
        return 'Transcribing';
      case 'analyzing':
        return 'Analyzing';
      case 'cutting':
        return 'Cutting';
      case 'formatting':
        return 'Formatting';
      default:
        return status;
    }
  };

  const isProcessing = !['completed', 'failed'].includes(project.status);
  const linkTo = isProcessing ? `/processing/${project.id}` : `/results/${project.id}`;

  return (
    <Card className="group overflow-hidden hover-elevate" data-testid={`card-project-${project.id}`}>
      <Link href={linkTo}>
        <div className="relative aspect-video bg-muted">
          {project.thumbnail ? (
            <img
              src={project.thumbnail}
              alt={project.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Video className="w-12 h-12 text-muted-foreground/50" />
            </div>
          )}
          
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-5 h-5 text-primary fill-primary ml-0.5" />
                )}
              </div>
            </div>
          </div>

          <Badge 
            className={`absolute top-2 right-2 ${getStatusColor(project.status)}`}
            data-testid={`badge-status-${project.id}`}
          >
            {getStatusLabel(project.status)}
          </Badge>
        </div>
      </Link>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium truncate" data-testid={`text-project-name-${project.id}`}>
              {project.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-project-menu-${project.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={linkTo} className="flex items-center gap-2" data-testid={`link-view-project-${project.id}`}>
                  <Eye className="h-4 w-4" />
                  View
                </Link>
              </DropdownMenuItem>
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(project.id)}
                  data-testid={`button-delete-project-${project.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
