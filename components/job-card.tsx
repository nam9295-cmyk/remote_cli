import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/utils";
import { ENGINES } from "@/lib/data";
import type { Job } from "@/lib/types";

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const engine = ENGINES.find((item) => item.id === job.engine);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent-soft)] hover:shadow-[0_24px_70px_rgba(15,23,42,0.1)]"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex rounded-full bg-[color:var(--surface-strong)] px-3 py-1 text-xs font-medium text-[color:var(--muted)]">
              {engine?.name ?? job.engine}
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-[color:var(--ink-strong)] transition group-hover:text-[color:var(--accent)]">
                {job.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                {job.resultSummary ?? "아직 결과 요약이 없습니다."}
              </p>
            </div>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <div className="grid gap-3 text-sm text-[color:var(--muted)] sm:grid-cols-2">
          <div className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-soft)]">
              Created
            </p>
            <p className="mt-1 font-medium text-[color:var(--ink)]">
              {formatDate(job.createdAt)}
            </p>
          </div>
          <div className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-soft)]">
              Updated
            </p>
            <p className="mt-1 font-medium text-[color:var(--ink)]">
              {formatDate(job.updatedAt)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
