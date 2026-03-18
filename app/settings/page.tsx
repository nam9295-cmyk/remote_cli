import { SectionHeader } from "@/components/section-header";
import { getDatabasePath } from "@/lib/db";
import { getLogsDirectory } from "@/lib/jobs";
import { ENGINES } from "@/lib/engines";

export default function SettingsPage() {
  const databasePath = getDatabasePath();
  const logsDirectory = getLogsDirectory();

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Settings"
        title="로컬 실행 환경 설정"
        description="실제 저장은 아직 없지만, 이후 단계에서 연결될 설정 구조를 먼저 정리합니다."
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6">
          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-sm">
            <h2 className="font-display text-2xl font-semibold text-[color:var(--ink-strong)]">
              Engine Commands
            </h2>
            <div className="mt-5 space-y-4">
              {ENGINES.map((engine) => (
                <div
                  key={engine.id}
                  className="rounded-[24px] bg-[color:var(--surface-strong)] p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[color:var(--ink-strong)]">
                        {engine.name}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                        {engine.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--line)]">
                      enabled
                    </span>
                  </div>
                  <input
                    defaultValue={engine.commandPreview}
                    className="mt-4 w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              실제 CLI를 붙이려면 `.env.local`에 예시처럼 넣으면 됩니다.
              `GEMINI_CLI_COMMAND=gemini`
              `CODEX_CLI_COMMAND=codex`
              또는 `npx @google/gemini-cli`, `npx @openai/codex` 같은 형식도 가능합니다.
            </div>
          </div>

          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-sm">
            <h2 className="font-display text-2xl font-semibold text-[color:var(--ink-strong)]">
              Storage
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[color:var(--ink-strong)]">
                  작업 DB 경로
                </span>
                <input
                  defaultValue={databasePath}
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[color:var(--ink-strong)]">
                  로그 저장 경로
                </span>
                <input
                  defaultValue={logsDirectory}
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none"
                />
              </label>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-sm">
            <h2 className="font-display text-2xl font-semibold text-[color:var(--ink-strong)]">
              Telegram
            </h2>
            <div className="mt-5 space-y-4">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[color:var(--ink-strong)]">
                  Bot Token
                </span>
                <input
                  placeholder="TELEGRAM_BOT_TOKEN"
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[color:var(--ink-strong)]">
                  Chat ID
                </span>
                <input
                  placeholder="TELEGRAM_CHAT_ID"
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[color:var(--ink-strong)]">
                  Public Base URL
                </span>
                <input
                  placeholder="https://your-dashboard.example.com"
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none"
                />
              </label>
            </div>
            <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              작업이 `success` 또는 `failed`로 끝나면 텔레그램 메시지를 자동으로
              전송합니다. 토큰이나 채팅방 정보가 없으면 전송 실패 이력이 상세 화면에
              기록됩니다.
            </div>
          </div>

          <div className="rounded-[32px] border border-dashed border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-sm">
            <h2 className="font-display text-2xl font-semibold text-[color:var(--ink-strong)]">
              Setup Scope
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--muted)]">
              <li>실제 저장은 Task 02에서 SQLite와 함께 연결됩니다.</li>
              <li>`*_CLI_COMMAND` 환경변수를 지정하면 실제 CLI 명령으로 교체됩니다.</li>
              <li>텔레그램 전송과 이력 저장은 Task 04에서 붙입니다.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
