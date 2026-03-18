import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] px-8 py-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">
          Not Found
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-[color:var(--ink-strong)]">
          작업을 찾을 수 없습니다
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
          더미 데이터에 없는 작업 ID입니다. 목록으로 돌아가 다른 작업을 확인하세요.
        </p>
        <Link
          href="/jobs"
          className="mt-6 inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white"
        >
          작업 목록으로 이동
        </Link>
      </div>
    </div>
  );
}
