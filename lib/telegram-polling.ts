import { getDb } from "@/lib/db";

type TelegramPollingStateRow = {
  id: string;
  last_update_id: number;
  last_polled_at: string | null;
  last_command_text: string | null;
  last_result_text: string | null;
};

export interface TelegramPollingState {
  enabled: boolean;
  intervalMs: number;
  lastUpdateId: number;
  lastPolledAt: string | null;
  lastCommandText: string | null;
  lastResultText: string | null;
}

export function getTelegramPollingState(): TelegramPollingState {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM telegram_polling_state WHERE id = 'main'")
    .get() as TelegramPollingStateRow | undefined;

  return {
    enabled: process.env.TELEGRAM_POLLING_ENABLED === "true",
    intervalMs: Number(process.env.TELEGRAM_POLLING_INTERVAL_MS ?? "3000"),
    lastUpdateId: row?.last_update_id ?? 0,
    lastPolledAt: row?.last_polled_at ?? null,
    lastCommandText: row?.last_command_text ?? null,
    lastResultText: row?.last_result_text ?? null,
  };
}
