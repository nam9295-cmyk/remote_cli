"use client";

import { useActionState } from "react";
import { createJobAction } from "@/app/new/actions";
import type { EngineOption } from "@/lib/types";
import { INITIAL_JOB_FORM_STATE } from "@/lib/validators";

interface NewJobFormProps {
  engines: EngineOption[];
}

export function NewJobForm({ engines }: NewJobFormProps) {
  const [state, formAction, isPending] = useActionState(
    createJobAction,
    INITIAL_JOB_FORM_STATE,
  );

  return (
    <form key={state.revision} action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="title"
          className="text-sm font-semibold text-[color:var(--ink-strong)]"
        >
          작업 제목
        </label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={state.fields.title}
          placeholder="예: 주간 운영 리포트 자동 생성"
          aria-invalid={Boolean(state.errors.title)}
          className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
        />
        {state.errors.title ? (
          <p className="text-sm text-rose-700">{state.errors.title}</p>
        ) : null}
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
          name="engine"
          defaultValue={state.fields.engine}
          aria-invalid={Boolean(state.errors.engine)}
          className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
        >
          {engines.map((engine) => (
            <option key={engine.id} value={engine.id}>
              {engine.name}
            </option>
          ))}
        </select>
        {state.errors.engine ? (
          <p className="text-sm text-rose-700">{state.errors.engine}</p>
        ) : null}
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
          name="prompt"
          rows={10}
          defaultValue={state.fields.prompt}
          placeholder="무엇을 시키고 싶은지 구체적으로 입력하세요."
          aria-invalid={Boolean(state.errors.prompt)}
          className="w-full rounded-3xl border border-[color:var(--line)] bg-white px-4 py-4 text-sm leading-6 outline-none transition focus:border-[color:var(--accent)]"
        />
        {state.errors.prompt ? (
          <p className="text-sm text-rose-700">{state.errors.prompt}</p>
        ) : null}
      </div>

      {state.formError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
          {state.formError}
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
        저장 후 상세 화면으로 이동합니다. 실행 버튼과 로그 스트리밍은 다음 단계에서
        연결됩니다.
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "저장 중..." : "작업 생성"}
        </button>
      </div>
    </form>
  );
}
