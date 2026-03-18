"use client";

import { useFormStatus } from "react-dom";

interface RunJobButtonProps {
  disabled?: boolean;
}

export function RunJobButton({ disabled }: RunJobButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "실행 요청 중..." : disabled ? "실행 중" : "작업 실행"}
    </button>
  );
}
