import { useState } from "react";
import { useLocation, Link } from "wouter";
import { ChevronRight, Coins, Home } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { UploadPanel } from "@/components/upload-panel";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type BillingSummary = {
  creditsBalance: number;
  estimatedCostPerReel: number;
  mode: "demo" | "live";
};

export default function Create() {
  const [, setLocation] = useLocation();
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const { data: billing } = useQuery<BillingSummary>({
    queryKey: ["/api/billing/summary"],
    retry: false,
  });

  const handleUpload = async (data: { type: 'file' | 'youtube'; file?: File; url?: string; options: any }) => {
    setIsUploading(true);
    try {
      let response: { projectId?: string } | undefined;

      if (data.type === 'file' && data.file) {
        const formData = new FormData();
        formData.append('video', data.file);
        formData.append('options', JSON.stringify(data.options));

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
          cache: 'no-store',
        });

        if (res.status === 402) {
          const err = await res.json();
          throw new Error(err.message || 'Insufficient credits');
        }

        if (res.status === 413) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Video must be 1 GB or smaller');
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Upload failed');
        }

        response = await res.json();
      } else if (data.type === 'youtube' && data.url) {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
          body: JSON.stringify({
            url: data.url,
            options: data.options,
          }),
        });

        if (res.status === 402) {
          const err = await res.json();
          throw new Error(err.message || 'Insufficient credits');
        }

        if (res.status === 413) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Video must be 1 GB or smaller');
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || err.error || 'YouTube download failed');
        }

        response = await res.json();
      }

      if (response?.projectId) {
        toast({
          title: "Upload successful!",
          description: "Your video is now being processed.",
        });
        setLocation(`/processing/${response.projectId}`);
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "There was an error uploading your video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6" data-testid="create-page">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/dashboard" className="hover:text-foreground flex items-center gap-1">
          <Home className="w-4 h-4" />
          Dashboard
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">Create Reel</span>
      </nav>

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            {billing && (
              <Badge variant="outline" className="gap-1.5 font-normal">
                <Coins className="h-3.5 w-3.5" />
                {billing.creditsBalance} credits
              </Badge>
            )}
            {billing?.mode === "demo" && (
              <Badge variant="secondary" className="font-normal">
                Local AI · no API fees
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">Create New Reel</h1>
          <p className="text-muted-foreground">
            Upload a video file or paste a YouTube link to get started. Our AI will find the best moments
            and create scroll-stopping reels for you.
            {billing && (
              <> Each run uses about <strong>{billing.estimatedCostPerReel}</strong> credits.</>
            )}
          </p>
        </div>

        <UploadPanel onUpload={handleUpload} isUploading={isUploading} />

        <div className="mt-8 p-4 bg-muted/30 rounded-lg">
          <h3 className="font-medium mb-2">Tips for best results:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Videos with clear audio work best for AI analysis</li>
            <li>• Longer videos (5+ minutes) tend to have more highlight moments</li>
            <li>• Educational and storytelling content performs well</li>
            <li>• Ensure your video has good lighting and audio quality</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
