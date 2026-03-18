#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const jobId = process.argv[2];
const appRoot = process.env.VEREMOTE_APP_ROOT || process.cwd();
const workspacePath = process.env.VEREMOTE_WORKSPACE_PATH || process.cwd();
const databasePath = path.join(appRoot, "data", "remote-cli.sqlite");
const mockEngineScriptPath = path.join(appRoot, "scripts", "mock-engine.cjs");

if (!jobId) {
  process.exit(1);
}

function splitCommandString(command) {
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}

function resolveRuntimeCommand(commandFromEnv) {
  if (!commandFromEnv || !commandFromEnv.trim()) {
    return null;
  }

  const [command, ...baseArgs] = splitCommandString(commandFromEnv.trim());

  if (!command) {
    return null;
  }

  return { command, baseArgs };
}

function getEngineConfig(engineId) {
  const geminiRuntimeCommand = resolveRuntimeCommand(process.env.GEMINI_CLI_COMMAND);
  const codexRuntimeCommand = resolveRuntimeCommand(process.env.CODEX_CLI_COMMAND);
  const customRuntimeCommand = resolveRuntimeCommand(process.env.CUSTOM_CLI_COMMAND);
  const configs = {
    gemini: {
      command: (geminiRuntimeCommand && geminiRuntimeCommand.command) || process.execPath,
      buildArgs(prompt, mode) {
        return geminiRuntimeCommand
          ? [
              ...geminiRuntimeCommand.baseArgs,
              ...(mode === "edit" ? ["--approval-mode", "auto_edit"] : []),
              "-p",
              prompt,
            ]
          : [mockEngineScriptPath, "gemini", jobId, prompt];
      },
    },
    codex: {
      command: (codexRuntimeCommand && codexRuntimeCommand.command) || process.execPath,
      buildArgs(prompt) {
        return codexRuntimeCommand
          ? [...codexRuntimeCommand.baseArgs, "exec", "--full-auto", prompt]
          : [mockEngineScriptPath, "codex", jobId, prompt];
      },
    },
    custom: {
      command: (customRuntimeCommand && customRuntimeCommand.command) || process.execPath,
      buildArgs(prompt) {
        return customRuntimeCommand
          ? [...customRuntimeCommand.baseArgs, jobId, prompt]
          : [mockEngineScriptPath, "custom", jobId, prompt];
      },
    },
  };

  return configs[engineId];
}

function openDb() {
  const db = new DatabaseSync(databasePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      engine TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'run' CHECK (mode IN ('run', 'edit')),
      prompt TEXT NOT NULL,
      workspace_path TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      result_summary TEXT,
      changed_files_json TEXT NOT NULL DEFAULT '[]',
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
      error_message TEXT
    );
  `);

  const migrationStatements = [
    "ALTER TABLE jobs ADD COLUMN mode TEXT NOT NULL DEFAULT 'run' CHECK (mode IN ('run', 'edit'))",
    "ALTER TABLE jobs ADD COLUMN workspace_path TEXT",
    "ALTER TABLE jobs ADD COLUMN changed_files_json TEXT NOT NULL DEFAULT '[]'",
  ];

  for (const statement of migrationStatements) {
    try {
      db.exec(statement);
    } catch {
      // Column already exists.
    }
  }

  return db;
}

function getJob(db) {
  return db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
}

function updateSuccess(db, logPath, summary, changedFiles) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs
    SET
      status = 'success',
      updated_at = ?,
      finished_at = ?,
      result_summary = ?,
      changed_files_json = ?,
      log_path = ?,
      error_message = NULL
    WHERE id = ?
  `).run(now, now, summary, JSON.stringify(changedFiles || []), logPath, jobId);
}

function updateFailure(db, logPath, message, changedFiles) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs
    SET
      status = 'failed',
      updated_at = ?,
      finished_at = ?,
      result_summary = ?,
      changed_files_json = ?,
      log_path = COALESCE(?, log_path),
      error_message = ?
    WHERE id = ?
  `).run(
    now,
    now,
    "작업 실행 중 오류가 발생했습니다.",
    JSON.stringify(changedFiles || []),
    logPath,
    message,
    jobId,
  );
}

function appendLine(stream, line) {
  stream.write(`${line}\n`);
}

function mapJob(row) {
  let changedFiles = [];

  try {
    changedFiles = row.changed_files_json ? JSON.parse(row.changed_files_json) : [];
  } catch {
    changedFiles = [];
  }

  return {
    id: row.id,
    title: row.title,
    engine: row.engine,
    mode: row.mode || "run",
    prompt: row.prompt,
    workspacePath: row.workspace_path || null,
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

function shouldIgnoreWorkspaceEntry(relativePath) {
  return (
    relativePath === ".git" ||
    relativePath === ".next" ||
    relativePath === "node_modules" ||
    relativePath === "data" ||
    relativePath.startsWith(".git/") ||
    relativePath.startsWith(".next/") ||
    relativePath.startsWith("node_modules/") ||
    relativePath.startsWith("data/")
  );
}

function snapshotWorkspace(rootPath) {
  const snapshot = new Map();

  function visit(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, absolutePath).split(path.sep).join("/");

      if (!relativePath || shouldIgnoreWorkspaceEntry(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const stats = fs.statSync(absolutePath);
      snapshot.set(relativePath, `${stats.size}:${stats.mtimeMs}`);
    }
  }

  visit(rootPath);
  return snapshot;
}

function diffWorkspaceSnapshots(before, after) {
  const changed = [];
  const allPaths = new Set([...before.keys(), ...after.keys()]);

  for (const relativePath of [...allPaths].sort()) {
    const previous = before.get(relativePath);
    const next = after.get(relativePath);

    if (!previous && next) {
      changed.push(`created:${relativePath}`);
      continue;
    }

    if (previous && !next) {
      changed.push(`deleted:${relativePath}`);
      continue;
    }

    if (previous !== next) {
      changed.push(`modified:${relativePath}`);
    }
  }

  return changed;
}

function insertNotificationLog(db, input) {
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
    `notif_${crypto.randomUUID()}`,
    input.jobId,
    "telegram",
    input.sentAt,
    input.status,
    input.messageId || null,
    input.errorMessage || null,
  );
}

function buildJobDetailUrl(jobIdValue) {
  const baseUrl = process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim();

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, "")}/jobs/${jobIdValue}`;
}

function buildTelegramText(job) {
  const lines = [
    job.status === "success" ? "[Remote CLI] 작업 완료" : "[Remote CLI] 작업 실패",
    `제목: ${job.title}`,
    `엔진: ${job.engine}`,
    `상태: ${job.status}`,
  ];

  if (job.status === "success" && job.resultSummary) {
    lines.push(`요약: ${job.resultSummary}`);
  }

  if (job.mode === "edit") {
    const changedFiles = Array.isArray(job.changedFiles) ? job.changedFiles : [];
    lines.push(
      `변경 파일: ${changedFiles.length > 0 ? changedFiles.join(", ") : "없음"}`,
    );
  }

  if (job.status === "failed" && job.errorMessage) {
    lines.push(`에러: ${job.errorMessage}`);
  }

  const detailUrl = buildJobDetailUrl(job.id);

  if (detailUrl) {
    lines.push(`상세: ${detailUrl}`);
  }

  return lines.join("\n");
}

async function sendTelegramNotification(job) {
  const token = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_CHAT_ID.trim();
  const sentAt = new Date().toISOString();

  if (!token || !chatId) {
    return {
      sentAt,
      status: "failed",
      errorMessage:
        "TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 환경변수가 설정되지 않았습니다.",
    };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildTelegramText(job),
        disable_web_page_preview: true,
      }),
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      return {
        sentAt,
        status: "failed",
        errorMessage:
          payload.description || `Telegram API request failed with status ${response.status}.`,
      };
    }

    return {
      sentAt,
      status: "sent",
      messageId: String(payload.result.message_id),
      errorMessage: null,
    };
  } catch (error) {
    return {
      sentAt,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const db = openDb();
  const job = getJob(db);

  if (!job) {
    process.exit(1);
  }

  const engine = getEngineConfig(job.engine);

  if (!engine) {
    updateFailure(db, job.log_path, `Unsupported engine: ${job.engine}`, []);
    process.exit(1);
  }

  const logPath = job.log_path || path.join(appRoot, "data", "logs", `${jobId}.log`);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  appendLine(logStream, `[${new Date().toISOString()}] starting ${job.engine} runner`);
  const workspaceSnapshotBefore =
    job.mode === "edit" ? snapshotWorkspace(workspacePath) : new Map();

  const child = spawn(engine.command, engine.buildArgs(job.prompt, job.mode), {
    cwd: workspacePath,
    env: {
      ...process.env,
      VEREMOTE_JOB_MODE: job.mode || "run",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  appendLine(
    logStream,
    `[worker] command: ${engine.command} ${engine.buildArgs(job.prompt, job.mode).join(" ")}`,
  );

  let lastStdoutLine = "";
  let stderrLines = [];
  let settled = false;

  function settleFailure(message) {
    if (settled) {
      return;
    }

    settled = true;
    const changedFiles =
      job.mode === "edit"
        ? diffWorkspaceSnapshots(workspaceSnapshotBefore, snapshotWorkspace(workspacePath))
        : [];
    updateFailure(db, logPath, message, changedFiles);
    const failedJob = mapJob(getJob(db));
    sendTelegramNotification(failedJob)
      .then((result) => {
        insertNotificationLog(db, {
          jobId,
          sentAt: result.sentAt,
          status: result.status,
          messageId: result.messageId,
          errorMessage: result.errorMessage,
        });
      })
      .finally(() => {
        logStream.end();
        db.close();
      });
  }

  function settleSuccess(summary, code) {
    if (settled) {
      return;
    }

    settled = true;
    appendLine(logStream, `[worker] process completed with exit code ${code}`);
    const changedFiles =
      job.mode === "edit"
        ? diffWorkspaceSnapshots(workspaceSnapshotBefore, snapshotWorkspace(workspacePath))
        : [];
    if (changedFiles.length > 0) {
      appendLine(logStream, `[worker] changed files: ${changedFiles.join(", ")}`);
    }
    updateSuccess(db, logPath, summary, changedFiles);
    const successfulJob = mapJob(getJob(db));
    sendTelegramNotification(successfulJob)
      .then((result) => {
        insertNotificationLog(db, {
          jobId,
          sentAt: result.sentAt,
          status: result.status,
          messageId: result.messageId,
          errorMessage: result.errorMessage,
        });
      })
      .finally(() => {
        logStream.end();
        db.close();
      });
  }

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    logStream.write(text);

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length > 0) {
      lastStdoutLine = lines[lines.length - 1];
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    logStream.write(text);
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    stderrLines = stderrLines.concat(lines).slice(-20);
  });

  child.on("error", (error) => {
    appendLine(logStream, `[worker] spawn error: ${error.message}`);
    settleFailure(error.message);
  });

  child.on("close", (code) => {
    if (settled) {
      return;
    }

    const summaryMatch = lastStdoutLine.match(/^RESULT_SUMMARY:\s*(.+)$/);
    const summary =
      summaryMatch?.[1] ||
      lastStdoutLine ||
      (code === 0
        ? "Runner finished without an explicit summary."
        : "Runner exited with a non-zero status.");

    if (code === 0) {
      settleSuccess(summary, code);
    } else {
      const errorMessage =
        stderrLines[stderrLines.length - 1] || `Process exited with code ${code ?? "unknown"}`;
      appendLine(logStream, `[worker] process failed with exit code ${code}`);
      settleFailure(errorMessage);
    }
  });
}

main().catch((error) => {
  const db = openDb();
  const message = error instanceof Error ? error.message : String(error);
  updateFailure(db, null, message, []);
  db.close();
  process.exit(1);
});
