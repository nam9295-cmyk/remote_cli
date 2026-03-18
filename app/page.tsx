import Link from "next/link";
import { JobCard } from "@/components/job-card";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { getRecentJobs, getStatusCount } from "@/lib/data";

export default function HomePage() {
  const recentJobs = getRecentJobs(3);

  return (
    <div className="space-y-8">
      <section className="rounded-[36px] border border-[color:var(--line)] bg-[color:var(--surface)] px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--accent)]">
              Home
            </p>
            <div className="space-y-4">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-[color:var(--ink-strong)] sm:text-5xl">
                원격에서 AI 작업을 만들고,
                <br />
                모바일에서도 바로 확인하는 대시보드
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[color:var(--muted)]">
                이 단계에서는 실제 실행기 연결 없이도 작업 생성 흐름과 상태 확인 UI를
                빠르게 검토할 수 있도록 기본 구조를 준비했습니다.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/new"
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              >
                새 작업 만들기
              </Link>
              <Link
                href="/jobs"
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white/70 px-5 py-3 text-sm font-semibold text-[color:var(--ink-strong)] transition hover:bg-white"
              >
                작업 목록 보기
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <StatCard
              label="Queued"
              value={String(getStatusCount("queued"))}
              description="실행 대기 중인 작업"
            />
            <StatCard
              label="Running"
              value={String(getStatusCount("running"))}
              description="현재 로컬 실행기와 연결될 예정인 작업"
            />
            <StatCard
              label="Success"
              value={String(getStatusCount("success"))}
              description="최근 정상 완료된 작업"
            />
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="Recent Jobs"
          title="최근 작업"
          description="홈 화면에서 최근 작업을 바로 훑어보고 상세 화면으로 이동할 수 있습니다."
          action={
            <Link
              href="/jobs"
              className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold text-[color:var(--ink-strong)] transition hover:bg-white"
            >
              전체 보기
            </Link>
          }
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {recentJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </section>
    </div>
  );
}
