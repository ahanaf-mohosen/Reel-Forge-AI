export type AdminDateRangePreset =
  | "1d"
  | "7d"
  | "14d"
  | "30d"
  | "6m"
  | "1y"
  | "custom";

export type ResolvedAdminDateRange = {
  preset: AdminDateRangePreset;
  start: Date;
  end: Date;
  label: string;
  dayCount: number;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function subtractMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return startOfDay(d);
}

function normalizePreset(preset: string | undefined): AdminDateRangePreset | "custom" {
  if (!preset) return "14d";
  if (preset === "half_month") return "6m";
  return preset as AdminDateRangePreset;
}

export function resolveAdminDateRange(
  preset: string | undefined,
  startInput?: string,
  endInput?: string,
): ResolvedAdminDateRange {
  const now = new Date();
  const end = endOfDay(now);
  const normalized = normalizePreset(preset);

  if (normalized === "custom") {
    const parsedStart = startInput ? parseDateInput(startInput) : null;
    const parsedEnd = endInput ? parseDateInput(endInput) : null;
    const start = startOfDay(parsedStart ?? new Date(end.getTime() - 13 * 86400000));
    const customEnd = endOfDay(parsedEnd ?? now);
    const safeStart = start <= customEnd ? start : startOfDay(customEnd);
    const dayCount =
      Math.floor((customEnd.getTime() - safeStart.getTime()) / 86400000) + 1;

    return {
      preset: "custom",
      start: safeStart,
      end: customEnd,
      label: `${safeStart.toISOString().slice(0, 10)} – ${customEnd.toISOString().slice(0, 10)}`,
      dayCount: Math.max(1, dayCount),
    };
  }

  const dayBased: Record<"1d" | "7d" | "14d" | "30d" | "1y", { days: number; label: string }> = {
    "1d": { days: 1, label: "Last 1 day" },
    "7d": { days: 7, label: "Last 7 days" },
    "14d": { days: 14, label: "Last 14 days" },
    "30d": { days: 30, label: "Last 30 days" },
    "1y": { days: 365, label: "Last year" },
  };

  if (normalized === "6m") {
    const start = subtractMonths(end, 6);
    const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return {
      preset: "6m",
      start,
      end,
      label: "Last 6 months",
      dayCount: Math.max(1, dayCount),
    };
  }

  const config = dayBased[normalized as keyof typeof dayBased] ?? dayBased["14d"];
  const start = startOfDay(new Date(end.getTime() - (config.days - 1) * 86400000));

  return {
    preset: normalized in dayBased ? (normalized as AdminDateRangePreset) : "14d",
    start,
    end,
    label: config.label,
    dayCount: config.days,
  };
}

export function buildDailyBuckets(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);

  while (cursor <= last) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

export const ADMIN_DATE_RANGE_OPTIONS: { value: AdminDateRangePreset; label: string }[] = [
  { value: "1d", label: "Last 1 day" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last year" },
  { value: "custom", label: "Custom range" },
];
