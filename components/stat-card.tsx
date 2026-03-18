interface StatCardProps {
  label: string;
  value: string;
  description: string;
}

export function StatCard({ label, value, description }: StatCardProps) {
  return (
    <div className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted-soft)]">
        {label}
      </p>
      <p className="mt-3 font-display text-4xl font-semibold text-[color:var(--ink-strong)]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
        {description}
      </p>
    </div>
  );
}
