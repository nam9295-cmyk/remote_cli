import Link from "next/link";
import { notFound } from "next/navigation";
import { runJobAction } from "@/app/jobs/[id]/actions";
import { RunJobButton } from "@/components/run-job-button";
import { StatusBadge } from "@/components/status-badge";
import { ENGINES } from "@/lib/engines";
import { getJobById, readJobLogTail } from "@/lib/jobs";
import { formatDate } from "@/lib/utils";

type JobDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: JobDetailPageProps) {
  const { id } = await params;
  const job = getJobById(id);

  if (!job) {
    notFound();
  }

  const engine = ENGINES.find((item) => item.id === job.engine);
  const runJob = runJobAction.bind(null, job.id);
  const logLines = readJobLogTail(job.logPath);

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
                {job.resultSummary ?? "아직 결과 요약이 없습니다."}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <StatusBadge status={job.status} />
            <form action={runJob}>
              <RunJobButton disabled={job.status === "running"} />
            </form>
          </div>
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
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                Runner Log
              </p>
              {job.logPath ? (
                <span className="text-xs font-medium text-[color:var(--muted)]">
                  최근 {logLines.length}줄
                </span>
              ) : null}
            </div>
            {logLines.length > 0 ? (
              <div className="mt-4 rounded-2xl bg-[color:var(--ink-strong)] px-4 py-4 font-mono text-sm leading-7 text-slate-100">
                {logLines.map((line, index) => (
                  <p key={`${index}-${line}`} className="whitespace-pre-wrap break-words">
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                아직 실행 로그가 없습니다. 작업 실행 버튼을 누르면 로그 파일이
                생성됩니다.
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Result Summary
            </p>
            <p className="mt-4 text-sm leading-7 text-[color:var(--ink)]">
              {job.resultSummary ?? "아직 결과 요약이 없습니다."}
            </p>
          </div>

          {job.errorMessage ? (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
                Error Message
              </p>
              <p className="mt-4 text-sm leading-7 text-rose-900">
                {job.errorMessage}
              </p>
            </div>
          ) : null}
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
                  Started
                </dt>
                <dd className="mt-1 font-medium text-[color:var(--ink-strong)]">
                  {formatDate(job.startedAt)}
                </dd>
              </div>
              <div className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3">
                <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-soft)]">
                  Finished
                </dt>
                <dd className="mt-1 font-medium text-[color:var(--ink-strong)]">
                  {formatDate(job.finishedAt)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Stored Paths
            </p>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3">
                <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-soft)]">
                  Log Path
                </dt>
                <dd className="mt-1 break-all font-medium text-[color:var(--ink-strong)]">
                  {job.logPath ?? "-"}
                </dd>
              </div>
              <div className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3">
                <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-soft)]">
                  Preview Image
                </dt>
                <dd className="mt-1 break-all font-medium text-[color:var(--ink-strong)]">
                  {job.previewImagePath ?? "-"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[28px] border border-dashed border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Runner Notes
            </p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              보안을 위해 엔진 실행은 미리 정의된 명령만 허용합니다. 기본값은
              프로젝트 내 mock runner이고, 환경변수로 실제 CLI 명령을 지정하면
              그 명령으로 대체됩니다.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
