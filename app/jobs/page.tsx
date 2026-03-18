import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { JobCard } from "@/components/job-card";
import { SectionHeader } from "@/components/section-header";
import { listJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default function JobsPage() {
  const jobs = listJobs();

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Jobs"
        title="작업 목록"
        description="SQLite에 저장된 작업을 최신 업데이트 순으로 보여줍니다."
        action={
          <Link
            href="/new"
            className="inline-flex items-center rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            새 작업
          </Link>
        }
      />

      {jobs.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="아직 작업이 없습니다"
          description="새 작업을 만들면 목록과 상세 화면에서 바로 확인할 수 있습니다."
          action={
            <Link
              href="/new"
              className="inline-flex items-center rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              첫 작업 만들기
            </Link>
          }
        />
      )}
    </div>
  );
}
