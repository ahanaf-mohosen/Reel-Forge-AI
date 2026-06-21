import { useState, useRef, useCallback } from "react";
import { Upload, Youtube, FileVideo, X, Loader2, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { UploadOptions, PanelStyle, PanelTextAlign } from "@shared/schema";
import { Link } from "wouter";

type BrandingUser = {
  brandLogoUrl?: string | null;
  name?: string;
  firstName?: string;
};

interface UploadPanelProps {
  onUpload: (data: { type: 'file' | 'youtube'; file?: File; url?: string; options: UploadOptions }) => void;
  isUploading?: boolean;
  compact?: boolean;
}

function isYouTubeUrlInput(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return parsed.pathname.length > 1;
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/live/")) {
        return parsed.pathname.split("/").filter(Boolean).length >= 2;
      }
      return parsed.pathname === "/watch" && Boolean(parsed.searchParams.get("v"));
    }
    return false;
  } catch {
    return false;
  }
}

export function UploadPanel({ onUpload, isUploading = false, compact = false }: UploadPanelProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<UploadOptions>({
    clipCount: 3,
    minDuration: 20,
    maxDuration: 40,
    reelPrompt: "",
    topPanelText: "",
    bottomPanelText: "",
    topPanelStyle: "black",
    bottomPanelStyle: "black",
    topPanelFontSize: 72,
    bottomPanelFontSize: 72,
    topPanelTextColor: "#FFFFFF",
    bottomPanelTextColor: "#FFFFFF",
    topPanelTextAlign: "center",
    bottomPanelTextAlign: "center",
    watermarkEnabled: false,
    watermarkText: "",
    watermarkOpacity: 45,
    logoEnabled: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: currentUser } = useQuery<BrandingUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const hasBrandLogo = Boolean(currentUser?.brandLogoUrl);

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

  const buildOptions = (): UploadOptions => ({
    clipCount: options.clipCount,
    minDuration: options.minDuration,
    maxDuration: options.maxDuration,
    ...(options.reelPrompt?.trim() ? { reelPrompt: options.reelPrompt.trim() } : {}),
    ...(options.topPanelText?.trim()
      ? {
          topPanelText: options.topPanelText.trim(),
          topPanelStyle: options.topPanelStyle ?? "black",
          topPanelFontSize: options.topPanelFontSize,
          topPanelTextColor: options.topPanelTextColor,
          topPanelTextAlign: options.topPanelTextAlign ?? "center",
        }
      : {}),
    ...(options.bottomPanelText?.trim()
      ? {
          bottomPanelText: options.bottomPanelText.trim(),
          bottomPanelStyle: options.bottomPanelStyle ?? "black",
          bottomPanelFontSize: options.bottomPanelFontSize,
          bottomPanelTextColor: options.bottomPanelTextColor,
          bottomPanelTextAlign: options.bottomPanelTextAlign ?? "center",
        }
      : {}),
    ...(options.watermarkEnabled ? { watermarkEnabled: true as const } : {}),
    ...(options.watermarkEnabled && options.watermarkText?.trim()
      ? { watermarkText: options.watermarkText.trim() }
      : {}),
    ...(options.watermarkEnabled && options.watermarkOpacity !== undefined
      ? { watermarkOpacity: options.watermarkOpacity }
      : {}),
    ...(options.logoEnabled && hasBrandLogo ? { logoEnabled: true as const } : {}),
  });

  const handleSubmit = () => {
    const payload = buildOptions();
    if (activeTab === 'file' && selectedFile) {
      onUpload({ type: 'file', file: selectedFile, options: payload });
    } else if (activeTab === 'youtube' && youtubeUrl.trim()) {
      onUpload({ type: 'youtube', url: youtubeUrl.trim(), options: payload });
    }
  };

  const canSubmit =
    (activeTab === 'file' && selectedFile) ||
    (activeTab === 'youtube' && isYouTubeUrlInput(youtubeUrl));

  return (
    <div className={cn("w-full", compact ? "" : "max-w-2xl")}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="file" className="gap-2" data-testid="tab-file-upload">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload File</span>
            </TabsTrigger>
            <TabsTrigger value="youtube" className="gap-2" data-testid="tab-youtube">
              <Youtube className="w-4 h-4" />
              <span className="hidden sm:inline">YouTube</span>
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
                      or click to browse (MP4, MOV, AVI up to 1 GB)
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
                placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                data-testid="input-youtube-url"
              />
              {youtubeUrl.trim() && !isYouTubeUrlInput(youtubeUrl) && (
                <p className="text-xs text-destructive">Enter a valid YouTube link.</p>
              )}
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
                  <Label htmlFor="reel-prompt" className="text-sm font-medium">
                    Reel style prompt
                  </Label>
                  <Textarea
                    id="reel-prompt"
                    placeholder="Optional — leave empty for default AI behavior. Or describe your style: motivational hooks, funny punchlines, educational tips..."
                    value={options.reelPrompt ?? ""}
                    onChange={(e) => setOptions({ ...options, reelPrompt: e.target.value })}
                    rows={3}
                    className="resize-none"
                    data-testid="input-reel-prompt"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Leave blank for free default processing (no OpenAI). Add a prompt to use OpenAI for custom style.
                  </p>
                </div>

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

                <p className="text-xs text-muted-foreground border-t pt-3">
                  Output format: 9:16 vertical · 16:9 fit · blurred background fill
                </p>

                <div className="space-y-4 border-t pt-4">
                  <div>
                    <Label className="text-sm font-medium">Branding overlays</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      All optional — add text panels, watermark, or your saved logo to every reel.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {(
                      [
                        {
                          id: "top",
                          label: "Top panel text",
                          placeholder: "e.g. Daily motivation",
                          textKey: "topPanelText" as const,
                          styleKey: "topPanelStyle" as const,
                          fontSizeKey: "topPanelFontSize" as const,
                          colorKey: "topPanelTextColor" as const,
                          alignKey: "topPanelTextAlign" as const,
                        },
                        {
                          id: "bottom",
                          label: "Bottom panel text",
                          placeholder: "e.g. Follow for more",
                          textKey: "bottomPanelText" as const,
                          styleKey: "bottomPanelStyle" as const,
                          fontSizeKey: "bottomPanelFontSize" as const,
                          colorKey: "bottomPanelTextColor" as const,
                          alignKey: "bottomPanelTextAlign" as const,
                        },
                      ] as const
                    ).map((panel) => (
                      <div key={panel.id} className="space-y-3 rounded-lg border p-3">
                        <Label htmlFor={`${panel.id}-panel-text`} className="text-sm">
                          {panel.label}
                        </Label>
                        <Textarea
                          id={`${panel.id}-panel-text`}
                          placeholder={panel.placeholder}
                          rows={3}
                          value={options[panel.textKey] ?? ""}
                          onChange={(e) => setOptions({ ...options, [panel.textKey]: e.target.value })}
                          data-testid={`input-${panel.id}-panel-text`}
                        />
                        <p className="text-xs text-muted-foreground">Supports multiple lines.</p>
                        <Select
                          value={options[panel.styleKey] ?? "black"}
                          onValueChange={(value: PanelStyle) =>
                            setOptions({ ...options, [panel.styleKey]: value })
                          }
                        >
                          <SelectTrigger data-testid={`select-${panel.id}-panel-style`}>
                            <SelectValue placeholder="Panel style" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transparent">Transparent</SelectItem>
                            <SelectItem value="black">Black bar</SelectItem>
                            <SelectItem value="white">White bar</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Font size</span>
                            <span className="text-muted-foreground">{options[panel.fontSizeKey] ?? 72}px</span>
                          </div>
                          <Slider
                            value={[options[panel.fontSizeKey] ?? 72]}
                            min={24}
                            max={160}
                            step={4}
                            onValueChange={([value]) =>
                              setOptions({ ...options, [panel.fontSizeKey]: value })
                            }
                            data-testid={`slider-${panel.id}-panel-font-size`}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm">Text color</Label>
                            <Input
                              type="color"
                              value={options[panel.colorKey] ?? "#FFFFFF"}
                              onChange={(e) => setOptions({ ...options, [panel.colorKey]: e.target.value })}
                              className="h-10 p-1"
                              data-testid={`input-${panel.id}-panel-color`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Text align</Label>
                            <Select
                              value={options[panel.alignKey] ?? "center"}
                              onValueChange={(value: PanelTextAlign) =>
                                setOptions({ ...options, [panel.alignKey]: value })
                              }
                            >
                              <SelectTrigger data-testid={`select-${panel.id}-panel-align`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="right">Right</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-lg border px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Watermark</p>
                        <p className="text-xs text-muted-foreground">Centered on the main frame diagonal (bottom-left to top-right)</p>
                      </div>
                      <Switch
                        checked={options.watermarkEnabled ?? false}
                        onCheckedChange={(checked) => setOptions({ ...options, watermarkEnabled: checked })}
                        data-testid="switch-watermark"
                      />
                    </div>
                    {options.watermarkEnabled && (
                      <div className="space-y-2">
                        <Label htmlFor="watermark-text" className="text-sm">Watermark text</Label>
                        <Input
                          id="watermark-text"
                          placeholder="e.g. @yourbrand"
                          value={options.watermarkText ?? ""}
                          onChange={(e) => setOptions({ ...options, watermarkText: e.target.value })}
                          data-testid="input-watermark-text"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave blank to use your profile name.
                        </p>
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-sm">
                            <Label>Transparency</Label>
                            <span className="text-muted-foreground">{options.watermarkOpacity ?? 45}%</span>
                          </div>
                          <Slider
                            value={[options.watermarkOpacity ?? 45]}
                            min={10}
                            max={90}
                            step={5}
                            onValueChange={([value]) =>
                              setOptions({ ...options, watermarkOpacity: value })
                            }
                            data-testid="slider-watermark-opacity"
                          />
                          <p className="text-xs text-muted-foreground">
                            Lower = more transparent. Higher = more visible.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Brand logo</p>
                      <p className="text-xs text-muted-foreground">
                        {hasBrandLogo
                          ? "Uses the logo saved in Settings"
                          : (
                            <>
                              Upload a logo in{" "}
                              <Link href="/settings" className="text-primary underline-offset-2 hover:underline">
                                Settings
                              </Link>
                            </>
                          )}
                      </p>
                    </div>
                    <Switch
                      checked={options.logoEnabled ?? false}
                      disabled={!hasBrandLogo}
                      onCheckedChange={(checked) => setOptions({ ...options, logoEnabled: checked })}
                      data-testid="switch-brand-logo"
                    />
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
