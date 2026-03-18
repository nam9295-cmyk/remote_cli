import Link from "next/link";
import { SectionHeader } from "@/components/section-header";
import { ENGINES } from "@/lib/data";

export default function NewJobPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="New Job"
        title="새 작업 생성"
        description="Setup 단계에서는 실제 저장 없이 폼 구조와 입력 우선순위만 먼저 잡습니다."
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-sm">
          <form className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="title"
                className="text-sm font-semibold text-[color:var(--ink-strong)]"
              >
                작업 제목
              </label>
              <input
                id="title"
                type="text"
                placeholder="예: 주간 운영 리포트 자동 생성"
                className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="engine"
                className="text-sm font-semibold text-[color:var(--ink-strong)]"
              >
                엔진 선택
              </label>
              <select
                id="engine"
                className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                defaultValue="codex"
              >
                {ENGINES.map((engine) => (
                  <option key={engine.id} value={engine.id}>
                    {engine.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="prompt"
                className="text-sm font-semibold text-[color:var(--ink-strong)]"
              >
                프롬프트
              </label>
              <textarea
                id="prompt"
                rows={8}
                placeholder="무엇을 시키고 싶은지 구체적으로 입력하세요."
                className="w-full rounded-3xl border border-[color:var(--line)] bg-white px-4 py-4 text-sm leading-6 outline-none transition focus:border-[color:var(--accent)]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="workdir"
                  className="text-sm font-semibold text-[color:var(--ink-strong)]"
                >
                  작업 폴더
                </label>
                <input
                  id="workdir"
                  type="text"
                  placeholder="/Users/nam9295/Desktop/project"
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="tags"
                  className="text-sm font-semibold text-[color:var(--ink-strong)]"
                >
                  태그
                </label>
                <input
                  id="tags"
                  type="text"
                  placeholder="ops, report, mobile"
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              아직 저장 기능은 연결되지 않았습니다. Task 02에서 입력 검증과 실제
              DB 저장을 붙이면 이 폼이 바로 동작하게 됩니다.
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              >
                작업 생성 UI 확인
              </button>
              <Link
                href="/jobs"
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--ink-strong)]"
              >
                목록으로 이동
              </Link>
            </div>
          </form>
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
        </aside>
      </div>
    </div>
  );
}
