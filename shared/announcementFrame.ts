export const ANNOUNCEMENT_FRAME_RATIOS = ["1:1", "4:4", "16:9", "9:16"] as const;

export type AnnouncementFrameRatio = (typeof ANNOUNCEMENT_FRAME_RATIOS)[number];

/** Popup image frame uses 2.5/4 (62.5%) of the viewport. */
export const ANNOUNCEMENT_FRAME_SCREEN_FRACTION = 2.5 / 4;

export const ANNOUNCEMENT_FRAME_SCREEN_PERCENT = ANNOUNCEMENT_FRAME_SCREEN_FRACTION * 100;

export const ANNOUNCEMENT_FRAME_OPTIONS: {
  value: AnnouncementFrameRatio;
  label: string;
  aspectClass: string;
}[] = [
  { value: "1:1", label: "1:1 (Square)", aspectClass: "aspect-square" },
  { value: "4:4", label: "4:4 (Standard)", aspectClass: "aspect-[4/3]" },
  { value: "16:9", label: "16:9 (Wide)", aspectClass: "aspect-video" },
  { value: "9:16", label: "9:16 (Portrait)", aspectClass: "aspect-[9/16]" },
];

export function normalizeAnnouncementFrameRatio(
  ratio: string | null | undefined,
): AnnouncementFrameRatio {
  if (ratio && ANNOUNCEMENT_FRAME_RATIOS.includes(ratio as AnnouncementFrameRatio)) {
    return ratio as AnnouncementFrameRatio;
  }
  return "1:1";
}

export function getAnnouncementFrameAspectClass(ratio: string | null | undefined): string {
  const normalized = normalizeAnnouncementFrameRatio(ratio);
  return (
    ANNOUNCEMENT_FRAME_OPTIONS.find((option) => option.value === normalized)?.aspectClass ??
    "aspect-square"
  );
}

export function getAnnouncementFrameStyle(
  ratio: string | null | undefined,
): { width: string; height: string } {
  const normalized = normalizeAnnouncementFrameRatio(ratio);
  const vw = `${ANNOUNCEMENT_FRAME_SCREEN_PERCENT}vw`;
  const vh = `${ANNOUNCEMENT_FRAME_SCREEN_PERCENT}vh`;

  switch (normalized) {
    case "16:9":
      return {
        width: vw,
        height: `calc(${vw} * 9 / 16)`,
      };
    case "9:16":
      return {
        width: `calc(${vh} * 9 / 16)`,
        height: vh,
      };
    case "4:4":
      return {
        width: vw,
        height: `calc(${vw} * 3 / 4)`,
      };
    case "1:1":
    default:
      return {
        width: `min(${vw}, ${vh})`,
        height: `min(${vw}, ${vh})`,
      };
  }
}

export function getAnnouncementPopupMaxWidth(ratio: string | null | undefined): string {
  const normalized = normalizeAnnouncementFrameRatio(ratio);
  if (normalized === "9:16") {
    return `max-w-[min(95vw,calc(${ANNOUNCEMENT_FRAME_SCREEN_PERCENT}vh*9/16))]`;
  }
  return `max-w-[min(95vw,${ANNOUNCEMENT_FRAME_SCREEN_PERCENT}vw)]`;
}
