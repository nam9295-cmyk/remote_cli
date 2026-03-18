"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Dashboard", shortLabel: "Home" },
  { href: "/jobs", label: "Jobs", shortLabel: "Jobs" },
  { href: "/new", label: "New Task", shortLabel: "New" },
  { href: "/settings", label: "Settings", shortLabel: "Settings" },
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--ink)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col md:flex-row">
        <aside className="hidden w-72 shrink-0 border-r border-[color:var(--line)] px-6 py-8 md:flex md:flex-col">
          <Link href="/" className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
              AI Remote Dashboard
            </p>
            <div>
              <h1 className="font-display text-3xl font-semibold text-[color:var(--ink-strong)]">
                Remote CLI
              </h1>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                실행은 로컬에서, 확인은 웹과 모바일에서 하는 운영 대시보드.
              </p>
            </div>
          </Link>

          <nav className="mt-10 space-y-2">
            {navigation.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-[color:var(--surface)] text-[color:var(--ink-strong)] shadow-sm"
                      : "text-[color:var(--muted)] hover:bg-white/70 hover:text-[color:var(--ink)]",
                  )}
                >
                  <span>{item.label}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-soft)]">
                    go
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">
              Setup Phase
            </p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              현재 화면은 더미 데이터로 동작합니다. 다음 단계에서 실제 저장과 실행기를 연결합니다.
            </p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-[color:var(--background)]/90 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)] md:hidden">
                  AI Remote Dashboard
                </p>
                <h2 className="font-display text-xl font-semibold text-[color:var(--ink-strong)]">
                  작업 상태를 빠르게 확인하고 다음 액션을 정리합니다.
                </h2>
              </div>
              <Link
                href="/new"
                className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
              >
                새 작업
              </Link>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-10">
            {children}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--line)] bg-[color:var(--surface)]/95 px-3 py-3 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
          {navigation.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-2xl px-3 py-3 text-center text-xs font-semibold transition",
                  isActive
                    ? "bg-[color:var(--accent)] text-white"
                    : "bg-[color:var(--surface-strong)] text-[color:var(--muted)]",
                )}
              >
                {item.shortLabel}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
