import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { EngineId, Job, JobMode, JobStatus } from "@/lib/types";

type JobRow = {
  id: string;
  title: string;
  engine: EngineId;
  mode: JobMode;
  prompt: string;
  workspace_path: string | null;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  result_summary: string | null;
  changed_files_json: string | null;
  preview_image_path: string | null;
  log_path: string | null;
  error_message: string | null;
};

export interface CreateJobInput {
  title: string;
  engine: EngineId;
  mode?: JobMode;
  prompt: string;
  workspacePath?: string | null;
}

const LOGS_DIR = path.join(process.cwd(), "data", "logs");

function mapJob(row: JobRow): Job {
  let changedFiles: string[] = [];

  try {
    changedFiles = row.changed_files_json ? JSON.parse(row.changed_files_json) : [];
  } catch {
    changedFiles = [];
  }

  return {
    id: row.id,
    title: row.title,
    engine: row.engine,
    mode: row.mode,
    prompt: row.prompt,
    workspacePath: row.workspace_path,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    resultSummary: row.result_summary,
    changedFiles,
    previewImagePath: row.preview_image_path,
    logPath: row.log_path,
    errorMessage: row.error_message,
  };
}

export function listJobs() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM jobs ORDER BY updated_at DESC").all() as JobRow[];

  return rows.map(mapJob);
}

export function getRecentJobs(limit = 3) {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM jobs ORDER BY updated_at DESC LIMIT ?")
    .all(limit) as JobRow[];

  return rows.map(mapJob);
}

export function getJobById(id: string) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
    | JobRow
    | undefined;

  return row ? mapJob(row) : null;
}

export function getStatusCount(status: JobStatus) {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM jobs WHERE status = ?")
    .get(status) as { count: number };

  return row.count;
}

export function createJob(input: CreateJobInput) {
  const db = getDb();
  const now = new Date().toISOString();

  const job: Job = {
    id: `job_${randomUUID()}`,
    title: input.title,
    engine: input.engine,
    mode: input.mode ?? "run",
    prompt: input.prompt,
    workspacePath: input.workspacePath ?? null,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    resultSummary: "작업이 생성되었습니다. 실행 전까지는 queued 상태로 유지됩니다.",
    changedFiles: [],
    previewImagePath: null,
    logPath: null,
    errorMessage: null,
  };

  db.prepare(`
    INSERT INTO jobs (
      id,
      title,
      engine,
      mode,
      prompt,
      workspace_path,
      status,
      created_at,
      updated_at,
      started_at,
      finished_at,
      result_summary,
      changed_files_json,
      preview_image_path,
      log_path,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    job.id,
    job.title,
    job.engine,
    job.mode,
    job.prompt,
    job.workspacePath,
    job.status,
    job.createdAt,
    job.updatedAt,
    job.startedAt,
    job.finishedAt,
    job.resultSummary,
    JSON.stringify(job.changedFiles),
    job.previewImagePath,
    job.logPath,
    job.errorMessage,
  );

  return job;
}

export function getLogsDirectory() {
  mkdirSync(LOGS_DIR, { recursive: true });
  return LOGS_DIR;
}

export function createLogPath(jobId: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(getLogsDirectory(), `${jobId}-${timestamp}.log`);
}

export function markJobAsRunning(jobId: string, logPath: string) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE jobs
    SET
      status = 'running',
      started_at = ?,
      finished_at = NULL,
      updated_at = ?,
      result_summary = ?,
      log_path = ?,
      error_message = NULL
    WHERE id = ?
  `).run(
    now,
    now,
    "Runner started. 로그가 생성되는 중입니다.",
    logPath,
    jobId,
  );
}

export function markJobAsSuccess(jobId: string, resultSummary: string, logPath: string) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE jobs
    SET
      status = 'success',
      updated_at = ?,
      finished_at = ?,
      result_summary = ?,
      log_path = ?,
      error_message = NULL
    WHERE id = ?
  `).run(now, now, resultSummary, logPath, jobId);
}

export function markJobAsFailed(jobId: string, errorMessage: string, logPath: string | null) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE jobs
    SET
      status = 'failed',
      updated_at = ?,
      finished_at = ?,
      result_summary = ?,
      log_path = COALESCE(?, log_path),
      error_message = ?
    WHERE id = ?
  `).run(
    now,
    now,
    "작업 실행 중 오류가 발생했습니다.",
    logPath,
    errorMessage,
    jobId,
  );
}

export function readJobLogTail(logPath: string | null, maxLines = 120) {
  if (!logPath) {
    return [];
  }

  try {
    const content = readFileSync(logPath, "utf8");

    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-maxLines);
  } catch {
    return [];
  }
}
