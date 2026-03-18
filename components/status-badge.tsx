import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";

const STATUS_THEME: Record<
  JobStatus,
  { label: string; className: string; dotClassName: string }
> = {
  queued: {
    label: "Queued",
    className: "bg-amber-100 text-amber-900 ring-amber-200",
    dotClassName: "bg-amber-500",
  },
  running: {
    label: "Running",
    className: "bg-sky-100 text-sky-900 ring-sky-200",
    dotClassName: "bg-sky-500",
  },
  success: {
    label: "Success",
    className: "bg-emerald-100 text-emerald-900 ring-emerald-200",
    dotClassName: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    className: "bg-rose-100 text-rose-900 ring-rose-200",
    dotClassName: "bg-rose-500",
  },
};

interface StatusBadgeProps {
  status: JobStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const theme = STATUS_THEME[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        theme.className,
      )}
    >
      <span className={cn("size-2 rounded-full", theme.dotClassName)} />
      {theme.label}
    </span>
  );
}
