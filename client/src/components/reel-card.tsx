import { useState } from "react";
import { Download, Copy, Edit, RefreshCw, Play, Clock, Check, Lock } from "lucide-react";
import { SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Reel } from "@shared/schema";

interface ReelCardProps {
  reel: Reel;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onDownload?: (id: string) => void;
}

export function ReelCard({ reel, isSelected, onSelect, onEdit, onRegenerate, onDownload }: ReelCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const handleDownload = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in with Google to download your reels.",
      });
      return;
    }
    onDownload?.(reel.id);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(reel.caption);
      setCopied(true);
      toast({
        title: "Caption copied!",
        description: "The caption has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy caption to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card 
      className={`overflow-hidden group cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onSelect?.(reel.id)}
      data-testid={`card-reel-${reel.id}`}
    >
      <div className="relative aspect-[9/16] bg-black rounded-t-lg overflow-hidden">
        {reel.url ? (
          <video
            src={reel.url}
            className="w-full h-full object-contain"
            loop
            playsInline
            controls
            data-testid={`video-reel-${reel.id}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Play className="w-12 h-12 text-muted-foreground/50" />
          </div>
        )}

        <Badge className="absolute top-3 left-3 bg-black/70 text-white border-none pointer-events-none">
          <Clock className="w-3 h-3 mr-1" />
          {formatDuration(reel.duration)}
        </Badge>

        <div className="absolute top-3 right-3 flex gap-1 pointer-events-none">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
            <SiInstagram className="w-3 h-3 text-white" />
          </div>
          <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center">
            <SiTiktok className="w-3 h-3 text-white" />
          </div>
          <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
            <SiYoutube className="w-3 h-3 text-white" />
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        <p className="text-sm line-clamp-2" data-testid={`text-caption-${reel.id}`}>
          {reel.caption}
        </p>

        <div className="flex flex-wrap gap-2">
          {isAuthenticated ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              data-testid={`button-download-${reel.id}`}
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              data-testid={`button-download-${reel.id}`}
            >
              <Lock className="w-4 h-4 mr-1" />
              Sign In to Download
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCaption}
            data-testid={`button-copy-caption-${reel.id}`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Caption
              </>
            )}
          </Button>

          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(reel.id)}
              data-testid={`button-edit-${reel.id}`}
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}

          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRegenerate(reel.id)}
              data-testid={`button-regenerate-${reel.id}`}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
