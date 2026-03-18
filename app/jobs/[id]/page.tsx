import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { ENGINES, getJobById } from "@/lib/data";
import { formatDate } from "@/lib/utils";

type JobDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailPage({
  params,
}: JobDetailPageProps) {
  const { id } = await params;
  const job = getJobById(id);

  if (!job) {
    notFound();
  }

  const engine = ENGINES.find((item) => item.id === job.engine);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/jobs"
                className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]"
              >
                Back to Jobs
              </Link>
              <div className="rounded-full bg-[color:var(--surface-strong)] px-3 py-1 text-xs font-medium text-[color:var(--muted)]">
                {engine?.name ?? job.engine}
              </div>
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--ink-strong)] sm:text-4xl">
                {job.title}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
                {job.resultSummary}
              </p>
            </div>
          </div>
          <StatusBadge status={job.status} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Prompt
            </p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[color:var(--ink)]">
              {job.prompt}
            </p>
          </div>

          <div className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Runner Log Preview
            </p>
            <div className="mt-4 rounded-2xl bg-[color:var(--ink-strong)] px-4 py-4 font-mono text-sm leading-7 text-slate-100">
              {job.logExcerpt.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Meta
            </p>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3">
                <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-soft)]">
                  Job ID
                </dt>
                <dd className="mt-1 font-medium text-[color:var(--ink-strong)]">
                  {job.id}
                </dd>
              </div>
              <div className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3">
                <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-soft)]">
                  Created
                </dt>
                <dd className="mt-1 font-medium text-[color:var(--ink-strong)]">
                  {formatDate(job.createdAt)}
                </dd>
              </div>
              <div className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3">
                <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-soft)]">
                  Updated
                </dt>
                <dd className="mt-1 font-medium text-[color:var(--ink-strong)]">
                  {formatDate(job.updatedAt)}
                </dd>
              </div>
              <div className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3">
                <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-soft)]">
                  Workdir
                </dt>
                <dd className="mt-1 break-all font-medium text-[color:var(--ink-strong)]">
                  {job.workdir}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Tags
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {job.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[color:var(--surface-strong)] px-3 py-1 text-xs font-semibold text-[color:var(--muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-dashed border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Next Phase Note
            </p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              Task 02에서 실제 DB 저장, Task 03에서 실행 버튼과 로그 스트리밍,
              Task 04에서 텔레그램 전송 이력이 이 카드에 연결됩니다.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
