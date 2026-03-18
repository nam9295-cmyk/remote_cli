#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const appRoot = process.env.VEREMOTE_APP_ROOT || path.resolve(__dirname, "..");
loadLocalEnvFile();
const DAEMON_PID_PATH = path.join(appRoot, "data", "veremote-daemon.pid");
const token = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.trim();
const allowedChatId =
  process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_CHAT_ID.trim();
const pollingEnabled = process.env.TELEGRAM_POLLING_ENABLED === "true";
const pollingIntervalMs = Number(process.env.TELEGRAM_POLLING_INTERVAL_MS || "3000");
const publicBaseUrl = process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim();
const databasePath = path.join(appRoot, "data", "remote-cli.sqlite");
const workerPath = path.join(appRoot, "scripts", "run-job-worker.cjs");
const logsDir = path.join(appRoot, "data", "logs");

if (!pollingEnabled) {
  console.error("TELEGRAM_POLLING_ENABLED is not true.");
  process.exit(1);
}

if (!token || !allowedChatId) {
  console.error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.");
  process.exit(1);
}

function loadLocalEnvFile() {
  const envPath = path.join(appRoot, ".env.local");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createDb() {
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

    CREATE TABLE IF NOT EXISTS telegram_polling_state (
      id TEXT PRIMARY KEY,
      last_update_id INTEGER NOT NULL DEFAULT 0,
      last_polled_at TEXT,
      last_command_text TEXT,
      last_result_text TEXT
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

    INSERT INTO telegram_polling_state (
      id,
      last_update_id,
      last_polled_at,
      last_command_text,
      last_result_text
    )
    VALUES ('main', 0, NULL, NULL, NULL)
    ON CONFLICT(id) DO NOTHING;
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

function getState(db) {
  return db
    .prepare("SELECT * FROM telegram_polling_state WHERE id = 'main'")
    .get();
}

function updateState(db, values) {
  const current = getState(db);
  db.prepare(`
    UPDATE telegram_polling_state
    SET
      last_update_id = ?,
      last_polled_at = ?,
      last_command_text = ?,
      last_result_text = ?
    WHERE id = 'main'
  `).run(
    Object.prototype.hasOwnProperty.call(values, "lastUpdateId")
      ? values.lastUpdateId
      : current.last_update_id,
    Object.prototype.hasOwnProperty.call(values, "lastPolledAt")
      ? values.lastPolledAt
      : current.last_polled_at,
    Object.prototype.hasOwnProperty.call(values, "lastCommandText")
      ? values.lastCommandText
      : current.last_command_text,
    Object.prototype.hasOwnProperty.call(values, "lastResultText")
      ? values.lastResultText
      : current.last_result_text,
  );
}

function createLogPath(jobId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(logsDir, `${jobId}-${timestamp}.log`);
}

function createJob(db, input) {
  const now = new Date().toISOString();
  const job = {
    id: `job_${crypto.randomUUID()}`,
    title: input.title,
    engine: input.engine,
    prompt: input.prompt,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    resultSummary: "작업이 생성되었습니다. 실행 전까지는 queued 상태로 유지됩니다.",
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
    input.mode || "run",
    job.prompt,
    input.workspacePath || null,
    job.status,
    job.createdAt,
    job.updatedAt,
    job.startedAt,
    job.finishedAt,
    job.resultSummary,
    "[]",
    job.previewImagePath,
    job.logPath,
    job.errorMessage,
  );

  return job;
}

function getActiveWorkspace(db) {
  return db.prepare("SELECT * FROM active_workspace WHERE id = 'main'").get();
}

function touchActiveWorkspace(db) {
  const workspace = getActiveWorkspace(db);

  if (!workspace) {
    return null;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE active_workspace
    SET
      last_heartbeat_at = ?
    WHERE id = 'main'
  `).run(now);

  return getActiveWorkspace(db);
}

function markJobAsRunning(db, jobId, logPath) {
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

function markJobAsFailed(db, jobId, logPath, message) {
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
    message,
    jobId,
  );
}

function launchJobRunner(jobId, workspacePath) {
  const child = spawn(process.execPath, [workerPath, jobId], {
    detached: true,
    stdio: "ignore",
    cwd: workspacePath,
    env: {
      ...process.env,
      VEREMOTE_APP_ROOT: appRoot,
      VEREMOTE_WORKSPACE_PATH: workspacePath,
    },
  });
  child.unref();
}

function getRecentJobs(db, limit) {
  return db
    .prepare("SELECT * FROM jobs ORDER BY updated_at DESC LIMIT ?")
    .all(limit);
}

function getLastJob(db) {
  return db
    .prepare("SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 1")
    .get();
}

function getJobById(db, jobId) {
  return db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
}

function getJobUrl(jobId) {
  if (!publicBaseUrl) {
    return null;
  }
  return `${publicBaseUrl.replace(/\/$/, "")}/jobs/${jobId}`;
}

async function telegramApi(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || `Telegram API ${method} failed.`);
  }

  return payload.result;
}

async function getUpdates(offset) {
  return telegramApi("getUpdates", {
    offset,
    timeout: 0,
    allowed_updates: ["message"],
  });
}

async function sendMessage(text) {
  return telegramApi("sendMessage", {
    chat_id: allowedChatId,
    text,
    disable_web_page_preview: true,
  });
}

function writeDaemonPidFile() {
  fs.mkdirSync(path.dirname(DAEMON_PID_PATH), { recursive: true });
  fs.writeFileSync(DAEMON_PID_PATH, `${process.pid}\n`, "utf8");
}

function removeDaemonPidFile() {
  try {
    const currentValue = fs.readFileSync(DAEMON_PID_PATH, "utf8").trim();
    if (!currentValue || Number(currentValue) === process.pid) {
      fs.rmSync(DAEMON_PID_PATH, { force: true });
    }
  } catch {
    // Ignore cleanup errors.
  }
}

function buildDaemonStartedText(workspace) {
  const lines = [
    "[veremote] telegram daemon connected",
    `status: listening`,
    `chat: ${allowedChatId}`,
  ];

  if (workspace && workspace.is_active) {
    lines.push(`project: ${workspace.name}`);
    lines.push(`path: ${workspace.path}`);
    lines.push(`engine: ${workspace.engine}`);
    lines.push("commands: /where, /run <prompt>, /edit <prompt>");
  } else {
    lines.push("workspace: none");
    lines.push("hint: run `veremote connect` locally first");
  }

  return lines.join("\n");
}

function normalizeCommand(text) {
  const trimmed = text.trim();
  const [rawCommand, ...rest] = trimmed.split(/\s+/);
  const command = rawCommand.replace(/@.+$/, "");
  return { command, argsText: rest.join(" "), rawText: trimmed };
}

function truncate(value, length) {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function handleCommand(db, text) {
  const { command, argsText, rawText } = normalizeCommand(text);

  if (!rawText.startsWith("/")) {
    return { replyText: null, resultText: "ignored non-command" };
  }

  if (command === "/help" || command === "/start") {
    return {
      replyText: [
        "사용 가능한 명령:",
        "/help",
        "/where",
        "/status",
        "/last",
        "/job <id>",
        "/run <prompt>",
        "/edit <prompt>",
      ].join("\n"),
      resultText: "help sent",
    };
  }

  if (command === "/where") {
    const workspace = touchActiveWorkspace(db);

    if (!workspace || !workspace.is_active) {
      return {
        replyText:
          "현재 연결된 workspace가 없습니다.\n로컬 터미널에서 veremote connect 를 먼저 실행해주세요.",
        resultText: "where empty",
      };
    }

    return {
      replyText: [
        "현재 active workspace:",
        `project: ${workspace.name}`,
        `path: ${workspace.path}`,
        `engine: ${workspace.engine}`,
        `status: ${workspace.is_active ? "active" : "inactive"}`,
        `last active: ${formatTimestamp(workspace.last_heartbeat_at || workspace.connected_at)}`,
      ].join("\n"),
      resultText: "where sent",
    };
  }

  if (command === "/status") {
    const jobs = getRecentJobs(db, 5);
    const lines = jobs.length
      ? jobs.map((job) => `${job.id} — ${truncate(job.title, 24)} — ${job.status} — ${job.engine}`)
      : ["아직 작업이 없습니다."];

    return {
      replyText: ["최근 작업:", ...lines].join("\n"),
      resultText: "status sent",
    };
  }

  if (command === "/last") {
    const job = getLastJob(db);

    if (!job) {
      return { replyText: "아직 작업이 없습니다.", resultText: "last empty" };
    }

    const detailUrl = getJobUrl(job.id);
    const lines = [
      `id: ${job.id}`,
      `title: ${job.title}`,
      `status: ${job.status}`,
      `engine: ${job.engine}`,
      `summary: ${job.result_summary || "-"}`,
    ];

    if (job.mode) {
      lines.push(`mode: ${job.mode}`);
    }

    if (job.changed_files_json) {
      try {
        const changedFiles = JSON.parse(job.changed_files_json);
        if (Array.isArray(changedFiles) && changedFiles.length > 0) {
          lines.push(`changed: ${changedFiles.join(", ")}`);
        }
      } catch {
        // Ignore malformed stored data.
      }
    }

    if (detailUrl) {
      lines.push(`detail: ${detailUrl}`);
    }

    return {
      replyText: lines.join("\n"),
      resultText: `last sent for ${job.id}`,
    };
  }

  if (command === "/job") {
    const jobId = argsText.trim();

    if (!jobId) {
      return {
        replyText: "사용법: /job <id>",
        resultText: "job usage sent",
      };
    }

    const job = getJobById(db, jobId);

    if (!job) {
      return {
        replyText: `작업을 찾을 수 없습니다: ${jobId}`,
        resultText: `job not found ${jobId}`,
      };
    }

    const detailUrl = getJobUrl(job.id);
    const lines = [
      `id: ${job.id}`,
      `title: ${job.title}`,
      `status: ${job.status}`,
      `engine: ${job.engine}`,
      `summary: ${job.result_summary || "-"}`,
    ];

    if (job.mode) {
      lines.push(`mode: ${job.mode}`);
    }

    if (job.changed_files_json) {
      try {
        const changedFiles = JSON.parse(job.changed_files_json);
        if (Array.isArray(changedFiles) && changedFiles.length > 0) {
          lines.push(`changed: ${changedFiles.join(", ")}`);
        }
      } catch {
        // Ignore malformed stored data.
      }
    }

    if (detailUrl) {
      lines.push(`detail: ${detailUrl}`);
    }

    return {
      replyText: lines.join("\n"),
      resultText: `job sent for ${job.id}`,
    };
  }

  if (command === "/run") {
    const prompt = argsText.trim();

    if (!prompt) {
      return {
        replyText: "사용법: /run <prompt>",
        resultText: "run usage sent",
      };
    }

    const workspace = touchActiveWorkspace(db);

    if (!workspace || !workspace.is_active) {
      return {
        replyText:
          "현재 연결된 workspace가 없습니다.\n로컬 터미널에서 veremote connect 를 먼저 실행해주세요.",
        resultText: "run blocked without workspace",
      };
    }

    const title = `Telegram run — ${truncate(prompt, 28)}`;
    const job = createJob(db, {
      title,
      engine: workspace.engine,
      mode: "run",
      prompt: [
        "Run mode. Focus on analysis or execution without changing files unless the prompt explicitly requires it.",
        "",
        prompt,
      ].join("\n"),
      workspacePath: workspace.path,
    });
    const logPath = createLogPath(job.id);
    try {
      markJobAsRunning(db, job.id, logPath);
      launchJobRunner(job.id, workspace.path);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Telegram run launch failed.";
      markJobAsFailed(db, job.id, logPath, message);
      return {
        replyText: `작업 실행을 시작하지 못했습니다.\nerror: ${message}`,
        resultText: `run failed for ${job.id}`,
      };
    }

    const detailUrl = getJobUrl(job.id);
    const lines = [
      "작업이 생성되고 바로 실행을 시작했습니다.",
      `id: ${job.id}`,
      `title: ${job.title}`,
      `engine: ${workspace.engine}`,
      `workspace: ${workspace.name}`,
    ];

    if (detailUrl) {
      lines.push(`detail: ${detailUrl}`);
    }

    return {
      replyText: lines.join("\n"),
      resultText: `run launched for ${job.id}`,
    };
  }

  if (command === "/edit") {
    const prompt = argsText.trim();

    if (!prompt) {
      return {
        replyText: "사용법: /edit <prompt>",
        resultText: "edit usage sent",
      };
    }

    if (prompt.length < 8) {
      return {
        replyText:
          "프롬프트가 너무 짧습니다.\n어떤 파일을 어떻게 바꾸고 싶은지 조금 더 구체적으로 적어주세요.",
        resultText: "edit prompt too short",
      };
    }

    const workspace = touchActiveWorkspace(db);

    if (!workspace || !workspace.is_active) {
      return {
        replyText:
          "현재 연결된 workspace가 없습니다.\n로컬 터미널에서 veremote connect 를 먼저 실행해주세요.",
        resultText: "edit blocked without workspace",
      };
    }

    const title = `Telegram edit — ${truncate(prompt, 27)}`;
    const job = createJob(db, {
      title,
      engine: workspace.engine,
      mode: "edit",
      prompt: [
        "Edit mode. You may modify files when needed.",
        "반드시 변경 파일 목록과 수정 요약을 남겨주세요.",
        "",
        prompt,
      ].join("\n"),
      workspacePath: workspace.path,
    });
    const logPath = createLogPath(job.id);
    try {
      markJobAsRunning(db, job.id, logPath);
      launchJobRunner(job.id, workspace.path);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Telegram edit launch failed.";
      markJobAsFailed(db, job.id, logPath, message);
      return {
        replyText: `수정 작업을 시작하지 못했습니다.\nerror: ${message}`,
        resultText: `edit failed for ${job.id}`,
      };
    }

    const detailUrl = getJobUrl(job.id);
    const lines = [
      "수정 작업이 생성되고 바로 실행을 시작했습니다.",
      `id: ${job.id}`,
      `title: ${job.title}`,
      `engine: ${workspace.engine}`,
      `workspace: ${workspace.name}`,
      "mode: edit",
    ];

    if (detailUrl) {
      lines.push(`detail: ${detailUrl}`);
    }

    return {
      replyText: lines.join("\n"),
      resultText: `edit launched for ${job.id}`,
    };
  }

  return {
    replyText: "지원하지 않는 명령입니다. /help 를 입력하세요.",
    resultText: `unsupported command ${command}`,
  };
}

async function bootstrapTelegramPolling() {
  await telegramApi("deleteWebhook", {
    drop_pending_updates: false,
  });

  const db = createDb();
  writeDaemonPidFile();
  const cleanup = () => {
    removeDaemonPidFile();
    db.close();
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
  console.log(`[telegram-polling] started. interval=${pollingIntervalMs}ms`);
  const workspace = getActiveWorkspace(db);

  if (workspace && workspace.is_active) {
    console.log(
      `[telegram-polling] active workspace=${workspace.name} (${workspace.path}) engine=${workspace.engine}`,
    );
  } else {
    console.log("[telegram-polling] no active workspace connected yet.");
  }

  try {
    await sendMessage(buildDaemonStartedText(workspace));
  } catch (error) {
    console.error("[telegram-polling] failed to send startup message", error);
  }

  while (true) {
    try {
      const state = getState(db);
      const updates = await getUpdates((state.last_update_id || 0) + 1);
      const polledAt = new Date().toISOString();

      updateState(db, {
        lastPolledAt: polledAt,
      });

      for (const update of updates) {
        const updateId = update.update_id;
        const message = update.message;
        const text = message && typeof message.text === "string" ? message.text : null;
        const chatId = message && message.chat ? String(message.chat.id) : null;

        if (!text || !chatId) {
          updateState(db, {
            lastUpdateId: updateId,
            lastPolledAt: polledAt,
            lastCommandText: null,
            lastResultText: "ignored non-text update",
          });
          continue;
        }

        if (chatId !== allowedChatId) {
          updateState(db, {
            lastUpdateId: updateId,
            lastPolledAt: polledAt,
            lastCommandText: text,
            lastResultText: `ignored chat ${chatId}`,
          });
          continue;
        }

        try {
          const handled = await handleCommand(db, text);

          if (handled.replyText) {
            await sendMessage(handled.replyText);
          }

          updateState(db, {
            lastUpdateId: updateId,
            lastPolledAt: polledAt,
            lastCommandText: text,
            lastResultText: handled.resultText,
          });
        } catch (error) {
          updateState(db, {
            lastUpdateId: updateId,
            lastPolledAt: polledAt,
            lastCommandText: text,
            lastResultText:
              error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      const dbState = createDb();
      updateState(dbState, {
        lastPolledAt: new Date().toISOString(),
        lastResultText:
          error instanceof Error ? error.message : String(error),
      });
      dbState.close();
      console.error("[telegram-polling]", error);
    }

    await sleep(pollingIntervalMs);
  }
}

bootstrapTelegramPolling().catch((error) => {
  removeDaemonPidFile();
  console.error(error);
  process.exit(1);
});
