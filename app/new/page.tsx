import Link from "next/link";
import { NewJobForm } from "@/components/new-job-form";
import { SectionHeader } from "@/components/section-header";
import { ENGINES } from "@/lib/engines";

export default function NewJobPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="New Job"
        title="새 작업 생성"
        description="입력 검증 후 SQLite에 저장하고, 생성이 끝나면 상세 화면으로 이동합니다."
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-sm">
          <NewJobForm engines={ENGINES} />
        </section>

        <aside className="space-y-4">
          {ENGINES.map((engine) => (
            <div
              key={engine.id}
              className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                {engine.name}
              </p>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                {engine.description}
              </p>
              <div className="mt-4 rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3 font-mono text-xs text-[color:var(--ink)]">
                {engine.commandPreview}
              </div>
            </div>
          ))}
          <div className="rounded-[28px] border border-dashed border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Stored Flow
            </p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              생성 시 `title`, `engine`, `prompt`, `status`, 타임스탬프가 SQLite에
              저장되고 상세 페이지로 이동합니다.
            </p>
            <Link
              href="/jobs"
              className="mt-4 inline-flex items-center rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--ink-strong)]"
            >
              저장된 작업 보기
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
