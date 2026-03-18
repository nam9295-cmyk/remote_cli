import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { JobCard } from "@/components/job-card";
import { SectionHeader } from "@/components/section-header";
import { getAllJobs } from "@/lib/data";

export default function JobsPage() {
  const jobs = getAllJobs();

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Jobs"
        title="작업 목록"
        description="더미 데이터 기반으로 상태와 결과 요약을 확인하는 초기 목록 화면입니다."
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
          description="다음 단계에서 실제 저장 구조를 붙이면 여기에서 생성한 작업을 다시 볼 수 있습니다."
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
