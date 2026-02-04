import { useState, useRef, useCallback } from "react";
import { Upload, Link as LinkIcon, Youtube, FileVideo, X, Loader2, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface UploadPanelProps {
  onUpload: (data: { type: 'file' | 'youtube' | 'url'; file?: File; url?: string; options: UploadOptions }) => void;
  isUploading?: boolean;
  compact?: boolean;
}

interface UploadOptions {
  clipCount: number;
  minDuration: number;
  maxDuration: number;
}

export function UploadPanel({ onUpload, isUploading = false, compact = false }: UploadPanelProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'youtube' | 'url'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<UploadOptions>({
    clipCount: 3,
    minDuration: 20,
    maxDuration: 40,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = () => {
    if (activeTab === 'file' && selectedFile) {
      onUpload({ type: 'file', file: selectedFile, options });
    } else if (activeTab === 'youtube' && youtubeUrl) {
      onUpload({ type: 'youtube', url: youtubeUrl, options });
    } else if (activeTab === 'url' && videoUrl) {
      onUpload({ type: 'url', url: videoUrl, options });
    }
  };

  const canSubmit = 
    (activeTab === 'file' && selectedFile) ||
    (activeTab === 'youtube' && youtubeUrl.length > 0) ||
    (activeTab === 'url' && videoUrl.length > 0);

  return (
    <div className={cn("w-full", compact ? "" : "max-w-2xl")}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="file" className="gap-2" data-testid="tab-file-upload">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload File</span>
            </TabsTrigger>
            <TabsTrigger value="youtube" className="gap-2 opacity-50" disabled data-testid="tab-youtube">
              <Youtube className="w-4 h-4" />
              <span className="hidden sm:inline">YouTube</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1 hidden sm:inline">Soon</Badge>
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-2 opacity-50" disabled data-testid="tab-url">
              <LinkIcon className="w-4 h-4" />
              <span className="hidden sm:inline">URL</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1 hidden sm:inline">Soon</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 transition-colors text-center",
                isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                selectedFile && "border-primary bg-primary/5"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-file"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-file"
              />
              
              {selectedFile ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileVideo className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    data-testid="button-remove-file"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 cursor-pointer">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">
                      Drag and drop your video here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse (MP4, MOV, AVI up to 500MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="youtube">
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Youtube className="w-8 h-8 text-destructive" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Paste a YouTube video URL to extract and analyze
                </p>
              </div>
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                data-testid="input-youtube-url"
              />
            </div>
          </TabsContent>

          <TabsContent value="url">
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <LinkIcon className="w-8 h-8 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Enter a direct link to a video file
                </p>
              </div>
              <Input
                placeholder="https://example.com/video.mp4"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                data-testid="input-video-url"
              />
            </div>
          </TabsContent>
        </Tabs>

        {!compact && (
          <div className="mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOptions(!showOptions)}
              className="text-muted-foreground"
              data-testid="button-toggle-options"
            >
              {showOptions ? 'Hide' : 'Show'} Advanced Options
            </Button>
            
            {showOptions && (
              <div className="mt-4 space-y-6 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-sm">Number of Reels: {options.clipCount}</Label>
                  <Slider
                    value={[options.clipCount]}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={([v]) => setOptions({ ...options, clipCount: v })}
                    data-testid="slider-clip-count"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Clip Duration: {options.minDuration}s - {options.maxDuration}s</Label>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Slider
                        value={[options.minDuration]}
                        min={10}
                        max={options.maxDuration - 5}
                        step={5}
                        onValueChange={([v]) => setOptions({ ...options, minDuration: v })}
                        data-testid="slider-min-duration"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Slider
                        value={[options.maxDuration]}
                        min={options.minDuration + 5}
                        max={90}
                        step={5}
                        onValueChange={([v]) => setOptions({ ...options, maxDuration: v })}
                        data-testid="slider-max-duration"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <Button
          className="w-full mt-6"
          size="lg"
          disabled={!canSubmit || isUploading}
          onClick={handleSubmit}
          data-testid="button-generate-reels"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Reels
            </>
          )}
        </Button>
    </div>
  );
}
