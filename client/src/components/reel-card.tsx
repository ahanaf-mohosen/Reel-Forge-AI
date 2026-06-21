import { useState } from "react";
import { Download, Copy, Edit, Play, Clock, Check, Lock } from "lucide-react";
import { SiInstagram, SiFacebook, SiYoutube } from "react-icons/si";
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
  onDownload?: (id: string) => void;
}

export function ReelCard({ reel, isSelected, onSelect, onEdit, onDownload }: ReelCardProps) {
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

  const handleShareToPlatform = async (e: React.MouseEvent, platform: 'instagram' | 'facebook' | 'youtube') => {
    e.stopPropagation();
    
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to share your reels.",
      });
      return;
    }

    if (!reel.url) {
      toast({
        title: "Video not ready",
        description: "This reel is not ready to share yet.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Uploading...",
      description: `Sharing to ${platform}. This may take a moment.`,
    });

    try {
      const endpoint = `/api/social/${platform}/upload`;
      const payload = platform === 'youtube'
        ? { videoPath: reel.url.replace('/outputs/', ''), title: reel.caption.substring(0, 100), description: reel.caption }
        : platform === 'instagram'
        ? { videoUrl: `${window.location.origin}${reel.url}`, caption: reel.caption }
        : { videoPath: reel.url.replace('/outputs/', ''), caption: reel.caption };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.message?.includes('not connected')) {
          toast({
            title: "Account not connected",
            description: `Please connect your ${platform} account in Settings → Social Accounts.`,
            variant: "destructive",
          });
        } else {
          throw new Error(result.message || 'Upload failed');
        }
        return;
      }

      toast({
        title: "Successfully shared!",
        description: `Your reel has been posted to ${platform}.`,
      });

      if (result.url) {
        setTimeout(() => {
          window.open(result.url, '_blank');
        }, 1000);
      }
    } catch (error: any) {
      console.error(`${platform} upload error:`, error);
      toast({
        title: "Upload failed",
        description: error.message || `Failed to share to ${platform}. Please try again.`,
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

        <div className="absolute top-3 right-3 flex gap-1">
          <button
            onClick={(e) => handleShareToPlatform(e, 'instagram')}
            className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="Share to Instagram"
          >
            <SiInstagram className="w-3 h-3 text-white" />
          </button>
          <button
            onClick={(e) => handleShareToPlatform(e, 'facebook')}
            className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="Share to Facebook"
          >
            <SiFacebook className="w-3 h-3 text-white" />
          </button>
          <button
            onClick={(e) => handleShareToPlatform(e, 'youtube')}
            className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="Share to YouTube"
          >
            <SiYoutube className="w-3 h-3 text-white" />
          </button>
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
              onClick={(e) => {
                e.stopPropagation();
                onEdit(reel.id);
              }}
              data-testid={`button-edit-${reel.id}`}
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
