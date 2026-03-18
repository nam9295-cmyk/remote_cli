import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-[28px] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-strong)] px-6 py-12 text-center shadow-sm">
      <div className="mx-auto max-w-md space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">
          Empty State
        </p>
        <h3 className="font-display text-2xl font-semibold text-[color:var(--ink-strong)]">
          {title}
        </h3>
        <p className="text-sm leading-6 text-[color:var(--muted)]">
          {description}
        </p>
        {action ? <div className="pt-3">{action}</div> : null}
      </div>
    </div>
  );
}
