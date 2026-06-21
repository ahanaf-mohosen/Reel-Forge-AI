import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Coins,
  HelpCircle,
  ImagePlus,
  Loader2,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { adminDashboardQueryOptions, apiRequest, getQueryFn } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { PackagePriceDisplay, formatDiscountedPreview } from "@/components/package-price-display";
import { clampDiscountPercent } from "@shared/billingPricing";
import {
  ANNOUNCEMENT_FRAME_OPTIONS,
  ANNOUNCEMENT_FRAME_SCREEN_PERCENT,
  getAnnouncementFrameStyle,
  type AnnouncementFrameRatio,
} from "@shared/announcementFrame";

type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  listPriceCents?: number;
  priceCents: number;
  priceLabel: string;
  originalPriceLabel?: string;
  discountPercent?: number;
  description: string;
  popular?: boolean;
};

type EditablePackage = {
  id: string;
  name: string;
  credits: string;
  priceDollars: string;
  discountPercent: string;
  description: string;
  popular: boolean;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  frameRatio: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

const FAQ_KEY = "reelforge_admin_faq";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

const DEFAULT_FAQ: FaqItem[] = [
  {
    id: "1",
    question: "How do credits work?",
    answer: "Each video processing job uses credits based on clip count and video length. Buy packs in Settings → Billing.",
  },
  {
    id: "2",
    question: "When is OpenAI used?",
    answer: "OpenAI runs only when you add a reel style prompt in Advanced Options. Leave it blank for free local processing.",
  },
];

function PlanPriceDisplay({ pkg }: { pkg: CreditPackage }) {
  return (
    <div className="mt-1">
      <PackagePriceDisplay
        listPriceCents={pkg.listPriceCents}
        priceCents={pkg.priceCents}
        priceLabel={pkg.priceLabel}
        originalPriceLabel={pkg.originalPriceLabel}
        discountPercent={pkg.discountPercent ?? 0}
        size="lg"
      />
    </div>
  );
}

export function PlanPreviewCards({ packages }: { packages?: CreditPackage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Credit plans</CardTitle>
        <CardDescription>Packages shown in Settings → Billing</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(packages ?? []).map((pkg) => (
            <div
              key={pkg.id}
              className="relative rounded-xl border bg-card p-4 shadow-sm"
            >
              {pkg.popular && (
                <Badge className="absolute -top-2 right-3 text-[10px]">Popular</Badge>
              )}
              <p className="font-semibold">{pkg.name}</p>
              <PlanPriceDisplay pkg={pkg} />
              <p className="text-sm text-muted-foreground">{pkg.credits} credits</p>
              <p className="mt-2 text-xs text-muted-foreground">{pkg.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function toEditable(pkg: CreditPackage): EditablePackage {
  const listPriceCents = pkg.listPriceCents ?? pkg.priceCents;
  return {
    id: pkg.id,
    name: pkg.name,
    credits: String(pkg.credits),
    priceDollars: (listPriceCents / 100).toFixed(2),
    discountPercent: String(pkg.discountPercent ?? 0),
    description: pkg.description,
    popular: Boolean(pkg.popular),
  };
}

export function EditablePlanSettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ packages: CreditPackage[] }>({
    queryKey: ["/api/admin/plans"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const [draft, setDraft] = useState<EditablePackage[]>([]);

  useEffect(() => {
    if (data?.packages) {
      setDraft(data.packages.map(toEditable));
    }
  }, [data?.packages]);

  const saveMutation = useMutation({
    mutationFn: async (packages: EditablePackage[]) => {
      const payload = {
        packages: packages.map((pkg) => ({
          id: pkg.id,
          name: pkg.name.trim(),
          credits: Number.parseInt(pkg.credits, 10),
          priceCents: Math.round((Number.parseFloat(pkg.priceDollars) || 0) * 100),
          discountPercent: clampDiscountPercent(Number(pkg.discountPercent)),
          description: pkg.description.trim(),
          popular: pkg.popular,
        })),
      };
      const res = await apiRequest("PUT", "/api/admin/plans", payload);
      return res.json() as Promise<{ packages: CreditPackage[] }>;
    },
    onSuccess: (result) => {
      setDraft(result.packages.map(toEditable));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/summary"] });
      toast({ title: "Plans saved", description: "Billing packages updated for all users." });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePackage = (id: string, patch: Partial<EditablePackage>) => {
    setDraft((prev) =>
      prev.map((pkg) => {
        if (pkg.id !== id) {
          return patch.popular ? { ...pkg, popular: false } : pkg;
        }
        return { ...pkg, ...patch };
      }),
    );
  };

  const handleSave = () => {
    if (draft.some((pkg) => !pkg.name.trim() || !pkg.description.trim())) {
      toast({
        title: "Missing fields",
        description: "Each plan needs a name and description.",
        variant: "destructive",
      });
      return;
    }
    if (draft.some((pkg) => !Number.isFinite(Number(pkg.credits)) || Number(pkg.credits) < 1)) {
      toast({
        title: "Invalid credits",
        description: "Credits must be a positive number.",
        variant: "destructive",
      });
      return;
    }
    if (draft.some((pkg) => !Number.isFinite(Number(pkg.priceDollars)) || Number(pkg.priceDollars) < 0)) {
      toast({
        title: "Invalid price",
        description: "Price must be zero or greater.",
        variant: "destructive",
      });
      return;
    }
    if (
      draft.some((pkg) => {
        const discount = Number(pkg.discountPercent);
        return !Number.isFinite(discount) || discount < 0 || discount > 100;
      })
    ) {
      toast({
        title: "Invalid discount",
        description: "Discount must be between 0 and 100 percent.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(draft);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plan Settings</CardTitle>
        <CardDescription>Edit credit packages available in Settings → Billing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading plans...</p>
        ) : (
          <>
            {draft.map((pkg) => (
              <div key={pkg.id} className="rounded-xl border p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {pkg.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`popular-${pkg.id}`} className="text-xs text-muted-foreground">
                      Popular
                    </Label>
                    <Switch
                      id={`popular-${pkg.id}`}
                      checked={pkg.popular}
                      onCheckedChange={(popular) => updatePackage(pkg.id, { popular })}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${pkg.id}`}>Plan name</Label>
                    <Input
                      id={`name-${pkg.id}`}
                      value={pkg.name}
                      onChange={(e) => updatePackage(pkg.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`credits-${pkg.id}`}>Credits</Label>
                    <Input
                      id={`credits-${pkg.id}`}
                      type="number"
                      min={1}
                      value={pkg.credits}
                      onChange={(e) => updatePackage(pkg.id, { credits: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`price-${pkg.id}`}>List price (USD)</Label>
                    <Input
                      id={`price-${pkg.id}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={pkg.priceDollars}
                      onChange={(e) => updatePackage(pkg.id, { priceDollars: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`discount-${pkg.id}`}>Discount (%)</Label>
                    <Input
                      id={`discount-${pkg.id}`}
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      value={pkg.discountPercent}
                      onChange={(e) => updatePackage(pkg.id, { discountPercent: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Final price: {formatDiscountedPreview(pkg.priceDollars, pkg.discountPercent)}
                    </p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`desc-${pkg.id}`}>Description</Label>
                    <Textarea
                      id={`desc-${pkg.id}`}
                      rows={2}
                      value={pkg.description}
                      onChange={(e) => updatePackage(pkg.id, { description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save plan settings
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function UserPlanOverviewPanel({
  totalUsers,
  activeUsers,
  packages,
}: {
  totalUsers: number;
  activeUsers: number;
  packages?: CreditPackage[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Total users</p>
            <p className="text-3xl font-bold">{totalUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Active accounts</p>
            <p className="text-3xl font-bold text-emerald-600">{activeUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Credit plans</p>
            <p className="text-3xl font-bold">{packages?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>
      <PlanPreviewCards packages={packages} />
    </div>
  );
}

export function AnnouncementsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [frameRatio, setFrameRatio] = useState<AnnouncementFrameRatio>("1:1");
  const [publishActive, setPublishActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const { data, isLoading } = useQuery<{ announcements: Announcement[] }>({
    queryKey: ["/api/admin/announcements"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const items = data?.announcements ?? [];

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleImageSelect = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Maximum size is 5 MB.", variant: "destructive" });
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("title", title.trim() || "Announcement");
      formData.append("body", body.trim());
      formData.append("linkUrl", linkUrl.trim());
      formData.append("frameRatio", frameRatio);
      formData.append("active", String(publishActive));
      if (imageFile) formData.append("image", imageFile);

      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create announcement");
      }

      return res.json();
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      setLinkUrl("");
      setFrameRatio("1:1");
      setPublishActive(true);
      clearImage();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({
        title: publishActive ? "Announcement published" : "Announcement saved as inactive",
        description: publishActive ? "Users will see it as a popup when they sign in." : undefined,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to publish", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/announcements/${id}`, { active });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({
        title: variables.active ? "Announcement activated" : "Announcement deactivated",
        description: variables.active
          ? "Users will see this announcement as a popup."
          : "Hidden from users until you activate it again.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/announcements/${id}`);
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Announcement deleted permanently" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const addAnnouncement = () => {
    if (!title.trim() && !imageFile) {
      toast({
        title: "Image or title required",
        description: "Upload an image or enter a title for text-only announcements.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  const activeCount = items.filter((item) => item.active).length;
  const previewFrameStyle = getAnnouncementFrameStyle(frameRatio);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            New announcement
          </CardTitle>
          <CardDescription>
            Upload an image popup for users. Clicking the popup opens the link you set below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Maintenance window..."
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="We'll be upgrading servers on..."
            />
          </div>
          <div className="space-y-2">
            <Label>Link URL (optional)</Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com or /dashboard"
            />
            <p className="text-xs text-muted-foreground">
              Users are taken here when they click the popup image.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Frame size</Label>
            <Select
              value={frameRatio}
              onValueChange={(value) => setFrameRatio(value as AnnouncementFrameRatio)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose frame ratio" />
              </SelectTrigger>
              <SelectContent>
                {ANNOUNCEMENT_FRAME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Image frame is {ANNOUNCEMENT_FRAME_SCREEN_PERCENT}% (2.5/4) of the user&apos;s screen.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Image (optional)</Label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => handleImageSelect(e.target.files?.[0])}
            />
            {imagePreview ? (
              <div className="relative inline-block overflow-hidden rounded-lg border bg-muted/30">
                <div
                  className="relative overflow-hidden"
                  style={{ width: previewFrameStyle.width, height: previewFrameStyle.height }}
                >
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8"
                  onClick={clearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => imageInputRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Upload image
              </Button>
            )}
            <p className="text-xs text-muted-foreground">JPEG, PNG, GIF, or WebP · max 5 MB</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Publish as active</p>
              <p className="text-xs text-muted-foreground">Turn off to save as draft (inactive)</p>
            </div>
            <Switch checked={publishActive} onCheckedChange={setPublishActive} />
          </div>
          <Button onClick={addAnnouncement} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {publishActive ? "Publish announcement" : "Save as inactive"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">All announcements</CardTitle>
              <CardDescription>
                {activeCount} active · {items.length} total — users only see active items
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading announcements...</p>
          ) : items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No announcements yet</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg border p-4",
                  item.active ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20 opacity-90",
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-20 w-32 shrink-0 rounded-lg border object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <Badge variant={item.active ? "default" : "secondary"}>
                        {item.active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">{item.frameRatio || "1:1"}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.body || "—"}</p>
                    {item.linkUrl ? (
                      <p className="mt-1 truncate text-xs text-primary">{item.linkUrl}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Created {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
                      <Label htmlFor={`active-${item.id}`} className="text-xs text-muted-foreground">
                        {item.active ? "Deactivate" : "Activate"}
                      </Label>
                      <Switch
                        id={`active-${item.id}`}
                        checked={item.active}
                        disabled={updateMutation.isPending}
                        onCheckedChange={(active) => updateMutation.mutate({ id: item.id, active })}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(item)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Delete permanently
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{deleteTarget?.title}&quot; from the database. Signed-in users
              will no longer see it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function FaqSettingsPanel() {
  const { toast } = useToast();
  const [items, setItems] = useState<FaqItem[]>(() => loadJson(FAQ_KEY, DEFAULT_FAQ));
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    saveJson(FAQ_KEY, items);
  }, [items]);

  const addFaq = () => {
    if (!question.trim() || !answer.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), question: question.trim(), answer: answer.trim() },
    ]);
    setQuestion("");
    setAnswer("");
    toast({ title: "FAQ entry added" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-4 w-4" />
            Add FAQ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label>Question</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Answer</Label>
            <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} />
          </div>
          <Button onClick={addFaq}>Add FAQ</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">FAQ list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <p className="font-medium">{item.question}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.answer}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setItems((prev) => prev.filter((f) => f.id !== item.id))}
              >
                Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

type AdminSocialAccount = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string;
  platform: string;
  platformUserId: string;
  platformUsername: string | null;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdminBillingOverview = {
  totalCredits: number;
  walletCount: number;
  billingMode: string;
  planCounts: { planId: string; userCount: number }[];
  wallets: {
    userId: string;
    userEmail: string | null;
    userName: string;
    creditsBalance: number;
    planId: string;
    updatedAt: string;
  }[];
};

function formatPlatformLabel(platform: string) {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function formatPlanLabel(planId: string) {
  return planId.replace(/^demo_/, "").replace(/_/g, " ");
}

function tokenStatus(expiresAt: string | null) {
  if (!expiresAt) return { label: "Active", variant: "outline" as const };
  const expired = new Date(expiresAt).getTime() < Date.now();
  return expired
    ? { label: "Expired", variant: "destructive" as const }
    : { label: "Active", variant: "outline" as const };
}

export function SocialAccountsPanel() {
  const { data, isLoading } = useQuery<{
    total: number;
    byPlatform: Record<string, number>;
    accounts: AdminSocialAccount[];
  }>({
    queryKey: ["/api/admin/social-accounts"],
  });

  const platformStats = Object.entries(data?.byPlatform ?? {});

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Connected accounts</p>
            <p className="text-3xl font-bold">{data?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Platforms in use</p>
            <p className="text-3xl font-bold">{platformStats.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">YouTube connections</p>
            <p className="text-3xl font-bold">{data?.byPlatform?.youtube ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4" />
            Social Accounts
          </CardTitle>
          <CardDescription>
            OAuth connections across all users for YouTube, Facebook, and Instagram publishing
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading social accounts...
            </div>
          ) : !data?.accounts.length ? (
            <p className="p-6 text-sm text-muted-foreground">No social accounts connected yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">User</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right">Connected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.accounts.map((account) => {
                    const status = tokenStatus(account.tokenExpiresAt);
                    return (
                      <TableRow key={account.id}>
                        <TableCell className="pl-6">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{account.userName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {account.userEmail || account.userId.slice(0, 8)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{formatPlatformLabel(account.platform)}</Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">
                            {account.platformUsername || account.platformUserId}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {account.platformUserId.slice(0, 12)}
                            {account.platformUserId.length > 12 ? "…" : ""}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                          {new Date(account.updatedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function BillingOverviewPanel() {
  const { data, isLoading } = useQuery<AdminBillingOverview>({
    queryKey: ["/api/admin/billing/overview"],
    ...adminDashboardQueryOptions,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Total credits</p>
            <p className="text-3xl font-bold tabular-nums">{data?.totalCredits ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">User wallets</p>
            <p className="text-3xl font-bold tabular-nums">{data?.walletCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Billing mode</p>
            <p className="text-3xl font-bold capitalize">{data?.billingMode ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Active plans</p>
            <p className="text-3xl font-bold tabular-nums">{data?.planCounts?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {!!data?.planCounts?.length && (
        <div className="flex flex-wrap gap-2">
          {data.planCounts.map((plan) => (
            <Badge key={plan.planId} variant="outline" className="px-3 py-1">
              {formatPlanLabel(plan.planId)} · {plan.userCount}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4" />
            User Wallets
          </CardTitle>
          <CardDescription>Credit balances and plans for all users</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading billing data...
            </div>
          ) : !data?.wallets.length ? (
            <p className="p-6 text-sm text-muted-foreground">No billing wallets found yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="pr-6 text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.wallets.map((wallet) => (
                    <TableRow key={wallet.userId}>
                      <TableCell className="pl-6">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{wallet.userName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {wallet.userEmail || wallet.userId.slice(0, 8)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{formatPlanLabel(wallet.planId)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {wallet.creditsBalance}
                      </TableCell>
                      <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                        {new Date(wallet.updatedAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PaymentHistoryPanel({
  revenueCents,
  costCents,
  margin,
  billingRevenueCents,
  paymentCount,
  periodLabel = "Last 14 days",
}: {
  revenueCents: number;
  costCents: number;
  margin: number;
  billingRevenueCents: number;
  paymentCount: number;
  periodLabel?: string;
}) {
  const fmt = (c: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: "Gross revenue", value: fmt(revenueCents), icon: CheckCircle2 },
        { label: "Operating cost", value: fmt(costCents), icon: CheckCircle2 },
        { label: "Profit margin", value: `${margin}%`, icon: CheckCircle2 },
        {
          label: `Payments (${periodLabel.toLowerCase()})`,
          value: `${paymentCount} · ${fmt(billingRevenueCents)}`,
          icon: CheckCircle2,
        },
      ].map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-xl font-bold">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
