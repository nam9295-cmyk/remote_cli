#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const token = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.trim();
const allowedChatId =
  process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_CHAT_ID.trim();
const pollingEnabled = process.env.TELEGRAM_POLLING_ENABLED === "true";
const pollingIntervalMs = Number(process.env.TELEGRAM_POLLING_INTERVAL_MS || "3000");
const publicBaseUrl = process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim();
const databasePath = path.join(process.cwd(), "data", "remote-cli.sqlite");
const workerPath = path.join(process.cwd(), "scripts", "run-job-worker.cjs");
const logsDir = path.join(process.cwd(), "data", "logs");

if (!pollingEnabled) {
  console.error("TELEGRAM_POLLING_ENABLED is not true.");
  process.exit(1);
}

if (!token || !allowedChatId) {
  console.error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.");
  process.exit(1);
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
      prompt TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      result_summary TEXT,
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
  `).run(
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

  return job;
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

function launchJobRunner(jobId) {
  const child = spawn(process.execPath, [workerPath, jobId], {
    detached: true,
    stdio: "ignore",
    env: process.env,
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

function normalizeCommand(text) {
  const trimmed = text.trim();
  const [rawCommand, ...rest] = trimmed.split(/\s+/);
  const command = rawCommand.replace(/@.+$/, "");
  return { command, argsText: rest.join(" "), rawText: trimmed };
}

function truncate(value, length) {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
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
        "/status",
        "/last",
        "/job <id>",
        "/run gemini <prompt>",
      ].join("\n"),
      resultText: "help sent",
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

    if (detailUrl) {
      lines.push(`detail: ${detailUrl}`);
    }

    return {
      replyText: lines.join("\n"),
      resultText: `job sent for ${job.id}`,
    };
  }

  if (command === "/run") {
    const [engine, ...promptParts] = argsText.split(/\s+/);
    const prompt = promptParts.join(" ").trim();

    if (engine !== "gemini" || !prompt) {
      return {
        replyText: "사용법: /run gemini <prompt>",
        resultText: "run usage sent",
      };
    }

    const title = `Telegram run — ${truncate(prompt, 28)}`;
    const job = createJob(db, {
      title,
      engine: "gemini",
      prompt,
    });
    const logPath = createLogPath(job.id);
    try {
      markJobAsRunning(db, job.id, logPath);
      launchJobRunner(job.id);
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
      "engine: gemini",
    ];

    if (detailUrl) {
      lines.push(`detail: ${detailUrl}`);
    }

    return {
      replyText: lines.join("\n"),
      resultText: `run launched for ${job.id}`,
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
  console.log(`[telegram-polling] started. interval=${pollingIntervalMs}ms`);

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
  console.error(error);
  process.exit(1);
});
