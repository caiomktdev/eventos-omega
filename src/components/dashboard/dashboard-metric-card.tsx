import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricAccent = "primary" | "blue" | "emerald" | "violet";

const ACCENT: Record<
  MetricAccent,
  { icon: string; bg: string; border: string; value: string }
> = {
  primary: {
    icon: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/15",
    value: "text-foreground",
  },
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/15",
    value: "text-foreground",
  },
  emerald: {
    icon: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/15",
    value: "text-foreground",
  },
  violet: {
    icon: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/15",
    value: "text-foreground",
  },
};

interface DashboardMetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  accent?: MetricAccent;
}

export function DashboardMetricCard({
  title,
  value,
  description,
  icon: Icon,
  accent = "primary",
}: DashboardMetricCardProps) {
  const styles = ACCENT[accent];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
        styles.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </p>
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.75rem]",
              styles.value
            )}
          >
            {value}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
            styles.bg
          )}
        >
          <Icon className={cn("h-4 w-4", styles.icon)} />
        </div>
      </div>
    </div>
  );
}
