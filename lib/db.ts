import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { INITIAL_JOBS } from "@/lib/data";

const APP_ROOT = process.env.VEREMOTE_APP_ROOT || process.cwd();
const DATA_DIR = path.join(APP_ROOT, "data");
const DATABASE_PATH = path.join(DATA_DIR, "remote-cli.sqlite");

type GlobalWithDb = typeof globalThis & {
  remoteCliDb?: DatabaseSync;
};

function seedJobs(db: DatabaseSync) {
  const insert = db.prepare(`
    INSERT INTO jobs (
      id,
      title,
      engine,
      prompt,
      status,
      created_at,
      updated_at,
      started_at,
      finished_at,
      result_summary,
      preview_image_path,
      log_path,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");

  try {
    for (const job of INITIAL_JOBS) {
      insert.run(
        job.id,
        job.title,
        job.engine,
        job.prompt,
        job.status,
        job.createdAt,
        job.updatedAt,
        job.startedAt,
        job.finishedAt,
        job.resultSummary,
        job.previewImagePath,
        job.logPath,
        job.errorMessage,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function initializeDatabase(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      engine TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      result_summary TEXT,
      preview_image_path TEXT,
      log_path TEXT,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      channel_type TEXT NOT NULL CHECK (channel_type IN ('telegram')),
      sent_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
      message_id TEXT,
      error_message TEXT,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS active_workspace (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      engine TEXT NOT NULL CHECK (engine IN ('gemini', 'codex', 'custom')),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      connected_at TEXT NOT NULL,
      last_heartbeat_at TEXT,
      chat_id TEXT
    );

    CREATE TABLE IF NOT EXISTS telegram_polling_state (
      id TEXT PRIMARY KEY,
      last_update_id INTEGER NOT NULL DEFAULT 0,
      last_polled_at TEXT,
      last_command_text TEXT,
      last_result_text TEXT
    );

    CREATE INDEX IF NOT EXISTS jobs_updated_at_idx ON jobs(updated_at DESC);
    CREATE INDEX IF NOT EXISTS notification_logs_job_id_idx ON notification_logs(job_id, sent_at DESC);
  `);

  db.prepare(`
    INSERT INTO telegram_polling_state (
      id,
      last_update_id,
      last_polled_at,
      last_command_text,
      last_result_text
    )
    VALUES ('main', 0, NULL, NULL, NULL)
    ON CONFLICT(id) DO NOTHING
  `).run();

  db.prepare(`
    UPDATE jobs
    SET
      status = 'failed',
      finished_at = updated_at,
      error_message = 'Runner state was reset during startup.',
      result_summary = '이전 실행 상태를 복구하지 못해 failed 로 전환되었습니다.'
    WHERE status = 'running' AND log_path IS NULL
  `).run();

  const row = db
    .prepare("SELECT COUNT(*) AS count FROM jobs")
    .get() as { count: number };

  if (row.count === 0) {
    seedJobs(db);
  }
}

export function getDatabasePath() {
  return DATABASE_PATH;
}

export function getDb() {
  const globalWithDb = globalThis as GlobalWithDb;

  if (!globalWithDb.remoteCliDb) {
    mkdirSync(DATA_DIR, { recursive: true });
    globalWithDb.remoteCliDb = new DatabaseSync(DATABASE_PATH);
    initializeDatabase(globalWithDb.remoteCliDb);
  }

  return globalWithDb.remoteCliDb;
}
