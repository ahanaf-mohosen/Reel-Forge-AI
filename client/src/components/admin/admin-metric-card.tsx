import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type MetricTone = "default" | "success" | "warning" | "danger";

const toneStyles: Record<MetricTone, { accent: string; icon: string }> = {
  default: {
    accent: "border-l-primary",
    icon: "bg-primary/10 text-primary",
  },
  success: {
    accent: "border-l-emerald-500",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    accent: "border-l-amber-500",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  danger: {
    accent: "border-l-destructive",
    icon: "bg-destructive/10 text-destructive",
  },
};

interface AdminMetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  tone?: MetricTone;
  className?: string;
}

export function AdminMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
  className,
}: AdminMetricCardProps) {
  const styles = toneStyles[tone];

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-5 shadow-sm border-l-4",
        styles.accent,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            styles.icon,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
