import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { INITIAL_JOBS } from "@/lib/data";

const DATA_DIR = path.join(process.cwd(), "data");
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

    CREATE INDEX IF NOT EXISTS jobs_updated_at_idx ON jobs(updated_at DESC);
    CREATE INDEX IF NOT EXISTS notification_logs_job_id_idx ON notification_logs(job_id, sent_at DESC);
  `);

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
