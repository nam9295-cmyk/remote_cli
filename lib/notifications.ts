import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { NotificationLog, NotificationStatus } from "@/lib/types";

type NotificationLogRow = {
  id: string;
  job_id: string;
  channel_type: "telegram";
  sent_at: string;
  status: NotificationStatus;
  message_id: string | null;
  error_message: string | null;
};

function mapNotificationLog(row: NotificationLogRow): NotificationLog {
  return {
    id: row.id,
    jobId: row.job_id,
    channelType: row.channel_type,
    sentAt: row.sent_at,
    status: row.status,
    messageId: row.message_id,
    errorMessage: row.error_message,
  };
}

export function listNotificationLogsByJobId(jobId: string) {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM notification_logs WHERE job_id = ? ORDER BY sent_at DESC, id DESC",
    )
    .all(jobId) as NotificationLogRow[];

  return rows.map(mapNotificationLog);
}

export function createNotificationLog(input: {
  jobId: string;
  channelType: "telegram";
  sentAt?: string;
  status: NotificationStatus;
  messageId?: string | null;
  errorMessage?: string | null;
}) {
  const db = getDb();
  const sentAt = input.sentAt ?? new Date().toISOString();
  const id = `notif_${randomUUID()}`;

  db.prepare(`
    INSERT INTO notification_logs (
      id,
      job_id,
      channel_type,
      sent_at,
      status,
      message_id,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.jobId,
    input.channelType,
    sentAt,
    input.status,
    input.messageId ?? null,
    input.errorMessage ?? null,
  );

  return id;
}
