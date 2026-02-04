import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { Link } from "wouter";
import { UploadPanel } from "@/components/upload-panel";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Create() {
  const [, setLocation] = useLocation();
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (data: { type: 'file' | 'youtube' | 'url'; file?: File; url?: string; options: any }) => {
    setIsUploading(true);
    try {
      let response;
      
      if (data.type === 'file' && data.file) {
        const formData = new FormData();
        formData.append('video', data.file);
        formData.append('options', JSON.stringify(data.options));
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!res.ok) {
          throw new Error('Upload failed');
        }
        
        response = await res.json();
      } else if (data.url) {
        response = await apiRequest('POST', '/api/upload', {
          url: data.url,
          type: data.type,
          options: data.options,
        });
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
        description: "There was an error uploading your video. Please try again.",
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
          <h1 className="text-3xl font-bold mb-2">Create New Reel</h1>
          <p className="text-muted-foreground">
            Upload your video or paste a URL to get started. Our AI will find the best moments 
            and create scroll-stopping reels for you.
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
