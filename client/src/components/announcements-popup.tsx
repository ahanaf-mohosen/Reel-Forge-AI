import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  getAnnouncementFrameStyle,
  getAnnouncementPopupMaxWidth,
} from "@shared/announcementFrame";

type Announcement = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  frameRatio: string | null;
  active: boolean;
  createdAt: string;
};

type AuthUser = {
  isAdmin?: boolean;
};

export const DISMISSED_ANNOUNCEMENTS_KEY = "reelforge_dismissed_announcements";

function loadDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]) {
  sessionStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify(ids));
}

export function resetDismissedAnnouncements() {
  sessionStorage.removeItem(DISMISSED_ANNOUNCEMENTS_KEY);
}

function openAnnouncementLink(linkUrl: string) {
  const url = linkUrl.trim();
  if (!url) return;

  if (url.startsWith("/")) {
    window.location.href = url;
    return;
  }

  const absolute = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
  window.open(absolute, "_blank", "noopener,noreferrer");
}

export function AnnouncementsPopup() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isAdmin = Boolean((user as AuthUser | null)?.isAdmin);
  const [dismissed, setDismissed] = useState<string[]>(() => loadDismissed());
  const [open, setOpen] = useState(false);

  const { data } = useQuery<{ announcements: Announcement[] }>({
    queryKey: ["/api/announcements"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isAuthenticated && !authLoading && !isAdmin,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 30_000,
  });

  const visible = useMemo(
    () => (data?.announcements ?? []).filter((item) => !dismissed.includes(item.id)),
    [data?.announcements, dismissed],
  );

  const current = visible[0] ?? null;
  const hasImage = Boolean(current?.imageUrl);
  const hasLink = Boolean(current?.linkUrl?.trim());
  const displayTitle = current?.title?.trim() || "";
  const displayBody = current?.body?.trim() || "";
  const frameRatio = current?.frameRatio ?? "1:1";
  const frameStyle = getAnnouncementFrameStyle(frameRatio);

  useEffect(() => {
    if (current) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [current?.id]);

  const dismissCurrent = () => {
    if (!current) return;

    const nextDismissed = [...new Set([...dismissed, current.id])];
    setDismissed(nextDismissed);
    saveDismissed(nextDismissed);
    setOpen(false);
  };

  const handleFrameClick = () => {
    if (!current) return;

    if (current.linkUrl?.trim()) {
      openAnnouncementLink(current.linkUrl);
    }
    dismissCurrent();
  };

  if (!isAuthenticated || authLoading || isAdmin || !current) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          dismissCurrent();
        } else {
          setOpen(true);
        }
      }}
    >
      <DialogContent
        className={cn(
          "z-[100] w-auto gap-0 overflow-hidden rounded-lg border bg-background p-0 shadow-xl [&>button]:right-3 [&>button]:top-3",
          getAnnouncementPopupMaxWidth(frameRatio),
        )}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          dismissCurrent();
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={handleFrameClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleFrameClick();
            }
          }}
          className={cn("w-full text-left outline-none", hasLink ? "cursor-pointer" : "cursor-default")}
          aria-label={hasLink ? "Open announcement" : "Dismiss announcement"}
        >
          {hasImage ? (
            <div
              className="relative shrink-0 overflow-hidden bg-muted"
              style={{ width: frameStyle.width, height: frameStyle.height }}
            >
              <img
                src={current.imageUrl!}
                alt={displayTitle || "Announcement"}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center border-b bg-primary/10 px-6 py-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Bell className="h-7 w-7" />
              </div>
            </div>
          )}

          <div className="space-y-2 px-5 py-4">
            {(displayTitle || displayBody) && (
              <DialogHeader className="space-y-2 text-left">
                {displayTitle ? (
                  <DialogTitle className="text-base font-semibold leading-snug">
                    {displayTitle}
                  </DialogTitle>
                ) : (
                  <DialogTitle className="sr-only">Announcement</DialogTitle>
                )}
                {displayBody ? (
                  <DialogDescription className="text-sm leading-relaxed text-foreground/80">
                    {displayBody}
                  </DialogDescription>
                ) : null}
              </DialogHeader>
            )}

            {hasLink && (
              <p className="text-xs font-medium text-primary">Click to open link</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
