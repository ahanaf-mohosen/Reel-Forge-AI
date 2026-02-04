import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadPanel } from "@/components/upload-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import logoImage from "@assets/logo.png";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();

  const handleUpload = async (data: { type: 'file' | 'youtube' | 'url'; file?: File; url?: string; options: any }) => {
    setIsUploading(true);
    try {
      if (data.type === 'file' && data.file) {
        const formData = new FormData();
        formData.append('video', data.file);
        formData.append('options', JSON.stringify(data.options));
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        const response = await res.json();
        
        if (!res.ok) {
          throw new Error(response.error || 'Upload failed');
        }

        if (response?.projectId) {
          setLocation(`/processing/${response.projectId}`);
        } else {
          throw new Error('No project ID returned');
        }
      } else {
        throw new Error('Please select a video file');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "There was an error uploading your video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img 
              src={logoImage} 
              alt="Reels Forge.AI" 
              className="h-8 w-auto"
            />
          </Link>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isLoading ? (
              <div className="h-9 w-20 animate-pulse bg-muted rounded-md" />
            ) : isAuthenticated && user ? (
              <>
                <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <Avatar className="h-8 w-8 ring-2 ring-secondary/30">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || 'User'} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:inline">
                    {user.firstName || 'User'}
                  </span>
                </Link>
                <Button variant="ghost" size="sm" asChild data-testid="button-logout">
                  <a href="/api/logout">
                    <LogOut className="h-4 w-4 mr-1" />
                    Log Out
                  </a>
                </Button>
              </>
            ) : (
              <Button asChild data-testid="button-login">
                <Link href="/auth">Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-6">
        <Card className="w-full max-w-lg shadow-lg border-border/50">
          <CardContent className="p-6">
            <UploadPanel onUpload={handleUpload} isUploading={isUploading} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
