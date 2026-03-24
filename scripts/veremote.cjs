#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const blessed = require("blessed");
const {
  getRunningDaemonPid,
  isExistingDirectory,
  normalizePreviewType,
} = require("./veremote-guardrails.cjs");

const APP_ROOT = process.env.VEREMOTE_APP_ROOT || path.resolve(__dirname, "..");
loadLocalEnvFile();
const DATABASE_PATH = path.join(APP_ROOT, "data", "remote-cli.sqlite");
const ENV_PATH = path.join(APP_ROOT, ".env.local");
const WORKER_PATH = path.join(APP_ROOT, "scripts", "run-job-worker.cjs");
const DAEMON_PATH = path.join(APP_ROOT, "scripts", "run-telegram-polling.cjs");
const DAEMON_PID_PATH = path.join(APP_ROOT, "data", "veremote-daemon.pid");
const LOGO_PATH = path.join(APP_ROOT, "assets", "logo.txt");
const CURRENT_CWD = process.cwd();
const DEFAULT_ENGINE = "gemini";
const ALLOWED_ENGINES = new Set(["gemini", "codex", "custom"]);
const PREVIEW_TYPE_LABELS = {
  web_url: "web_url",
  image_file: "image_file",
  pencil_export: "pencil_export",
};
const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_CHAT_ID.trim();
const DEFAULT_LOGO_LINES = [
  "                                         _   ",
  " __   _____ _ __ _   _  __ _  ___  _   _| |_ ",
  " \\ \\ / / _ \\ '__| | | |/ _` |/ _ \\| | | | __|",
  "  \\ V /  __/ |  | |_| | (_| | (_) | |_| | |_ ",
  "   \\_/ \\___|_|   \\__, |\\__, |\\___/ \\__,_|\\__|",
  "                 |___/ |___/                 ",
];
const HELP_ROWS = [
  ["ask <prompt>", "Auto-pick run or edit from your prompt"],
  ["run <prompt>", "Start a read-only job in the current workspace"],
  ["edit <prompt>", "Allow file changes inside the active workspace"],
  ["engine <name>", "Switch engine: gemini, codex, custom"],
  ["preview ...", "Set preview policy: url, image, pencil, clear"],
  ["where", "Show the current workspace path and engine"],
  ["status", "Show the full workspace summary"],
  ["help", "Show the command reference"],
  ["exit", "Leave veremote"],
];
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  brand: "\x1b[38;5;181m",
  line: "\x1b[38;5;245m",
  label: "\x1b[38;5;109m",
  success: "\x1b[38;5;108m",
  warning: "\x1b[38;5;179m",
};
const THEME = {
  bg: "#111214",
  panel: "#17191d",
  panelAlt: "#131519",
  border: "#4b5563",
  brand: "#d8b8c8",
  accent: "#96b8b1",
  text: "#f3ede5",
  muted: "#b6b0a8",
  success: "#a7c080",
  warning: "#d9a066",
};
const EDIT_INTENT_PATTERN =
  /(수정|바꿔|변경|고쳐|추가|삭제|지워|리팩토링|리네임|이동|생성|만들어|적용|키워|줄여|늘려|update|edit|change|modify|fix|create|remove|delete|rename|replace|refactor|increase|decrease|add )/i;

function getJobsTableSql(db) {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'jobs'")
    .get();

  return row ? row.sql : null;
}

function ensureExtendedJobStatuses(db) {
  const jobsTableSql = getJobsTableSql(db);

  if (!jobsTableSql || jobsTableSql.includes("export_failed")) {
    return;
  }

  db.exec(`
    ALTER TABLE jobs RENAME TO jobs_old;

    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      engine TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'run' CHECK (mode IN ('run', 'edit')),
      prompt TEXT NOT NULL,
      workspace_path TEXT,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed', 'partial', 'export_failed')),
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

    INSERT INTO jobs (
      id, title, engine, mode, prompt, workspace_path, status, created_at, updated_at,
      started_at, finished_at, result_summary, changed_files_json, preview_image_path, log_path, error_message
    )
    SELECT
      id, title, engine, mode, prompt, workspace_path, status, created_at, updated_at,
      started_at, finished_at, result_summary, changed_files_json, preview_image_path, log_path, error_message
    FROM jobs_old;

    DROP TABLE jobs_old;
  `);
}

function loadLocalEnvFile() {
  const envPath = path.join(APP_ROOT, ".env.local");

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

function ensureDb() {
  fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

  const db = new DatabaseSync(DATABASE_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      engine TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'run' CHECK (mode IN ('run', 'edit')),
      prompt TEXT NOT NULL,
      workspace_path TEXT,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed', 'partial', 'export_failed')),
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

    CREATE TABLE IF NOT EXISTS active_workspace (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      engine TEXT NOT NULL CHECK (engine IN ('gemini', 'codex', 'custom')),
      preview_type TEXT CHECK (preview_type IN ('web_url', 'image_file', 'pencil_export')),
      preview_target TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      connected_at TEXT NOT NULL,
      last_heartbeat_at TEXT,
      chat_id TEXT
    );
  `);

  const migrationStatements = [
    "ALTER TABLE jobs ADD COLUMN mode TEXT NOT NULL DEFAULT 'run' CHECK (mode IN ('run', 'edit'))",
    "ALTER TABLE jobs ADD COLUMN workspace_path TEXT",
    "ALTER TABLE jobs ADD COLUMN changed_files_json TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE active_workspace ADD COLUMN preview_type TEXT",
    "ALTER TABLE active_workspace ADD COLUMN preview_target TEXT",
  ];

  for (const statement of migrationStatements) {
    try {
      db.exec(statement);
    } catch {
      // Column already exists.
    }
  }

  ensureExtendedJobStatuses(db);

  return db;
}

function getWorkspaceName(workspacePath) {
  const baseName = path.basename(workspacePath);
  return baseName || workspacePath;
}

function getActiveWorkspace(db) {
  return (
    db.prepare("SELECT * FROM active_workspace WHERE id = 'main'").get() || null
  );
}

function getPreviewProfile(workspace) {
  if (!workspace || !workspace.preview_type) {
    return {
      type: null,
      target: null,
    };
  }

  return {
    type: workspace.preview_type,
    target: workspace.preview_target || null,
  };
}

function formatPreviewProfile(workspace) {
  const profile = getPreviewProfile(workspace);

  if (!profile.type) {
    return "none";
  }

  return profile.target ? `${PREVIEW_TYPE_LABELS[profile.type] || profile.type} (${profile.target})` : profile.type;
}

function connectWorkspace(db, options = {}) {
  const now = new Date().toISOString();
  const existing = getActiveWorkspace(db);
  const selectedEngine =
    options.engine ||
    (existing &&
    existing.is_active &&
    existing.path === CURRENT_CWD &&
    ALLOWED_ENGINES.has(existing.engine)
      ? existing.engine
      : DEFAULT_ENGINE);
  const didChange =
    !existing ||
    !existing.is_active ||
    existing.path !== CURRENT_CWD ||
    existing.engine !== selectedEngine;
  const selectedPreviewType =
    Object.prototype.hasOwnProperty.call(options, "previewType")
      ? options.previewType
      : existing &&
          existing.is_active &&
          existing.path === CURRENT_CWD &&
          existing.preview_type
        ? existing.preview_type
        : null;
  const selectedPreviewTarget =
    Object.prototype.hasOwnProperty.call(options, "previewTarget")
      ? options.previewTarget
      : existing &&
          existing.is_active &&
          existing.path === CURRENT_CWD &&
          existing.preview_target
        ? existing.preview_target
        : null;

  db.prepare(`
    INSERT INTO active_workspace (
      id,
      path,
      name,
      engine,
      preview_type,
      preview_target,
      is_active,
      connected_at,
      last_heartbeat_at,
      chat_id
    )
    VALUES ('main', ?, ?, ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      path = excluded.path,
      name = excluded.name,
      engine = excluded.engine,
      preview_type = excluded.preview_type,
      preview_target = excluded.preview_target,
      is_active = excluded.is_active,
      connected_at = excluded.connected_at,
      last_heartbeat_at = excluded.last_heartbeat_at,
      chat_id = excluded.chat_id
  `).run(
    CURRENT_CWD,
    getWorkspaceName(CURRENT_CWD),
    selectedEngine,
    selectedPreviewType,
    selectedPreviewTarget,
    now,
    now,
    TELEGRAM_CHAT_ID || null,
  );

  return {
    workspace: getActiveWorkspace(db),
    didChange,
    replacedPath:
      existing && existing.path !== CURRENT_CWD ? existing.path : null,
  };
}

function setWorkspaceEngine(db, engine) {
  if (!ALLOWED_ENGINES.has(engine)) {
    return {
      ok: false,
      error: `Unsupported engine: ${engine}`,
      workspace: getActiveWorkspace(db),
    };
  }

  const result = connectWorkspace(db, { engine });

  return {
    ok: true,
    workspace: result.workspace,
    didChange: result.didChange,
    replacedPath: result.replacedPath,
  };
}

function setWorkspacePreview(db, previewType, previewTarget) {
  const normalizedType = normalizePreviewType(previewType);
  const workspace = getActiveWorkspace(db);

  if (!workspace || !workspace.is_active) {
    return {
      ok: false,
      error: "No active workspace is connected yet.",
      workspace: null,
    };
  }

  if (previewType && !normalizedType && String(previewType || "").trim()) {
    return {
      ok: false,
      error: `Unsupported preview type: ${previewType}`,
      workspace,
    };
  }

  const normalizedTarget = normalizedType
    ? String(previewTarget || "").trim()
    : null;

  if (normalizedType && !normalizedTarget) {
    return {
      ok: false,
      error: "Preview target is required for url, image, and pencil preview types.",
      workspace,
    };
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE active_workspace
    SET
      preview_type = ?,
      preview_target = ?,
      last_heartbeat_at = ?,
      chat_id = COALESCE(?, chat_id)
    WHERE id = 'main'
  `).run(normalizedType, normalizedTarget, now, TELEGRAM_CHAT_ID || null);

  return {
    ok: true,
    workspace: getActiveWorkspace(db),
  };
}

function touchWorkspace(db) {
  const workspace = getActiveWorkspace(db);

  if (!workspace) {
    return null;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE active_workspace
    SET
      last_heartbeat_at = ?,
      chat_id = COALESCE(?, chat_id)
    WHERE id = 'main'
  `).run(now, TELEGRAM_CHAT_ID || null);

  return getActiveWorkspace(db);
}

function disconnectWorkspace(db) {
  const existing = getActiveWorkspace(db);
  db.prepare("DELETE FROM active_workspace WHERE id = 'main'").run();
  return existing;
}

function ensureCurrentWorkspace(db) {
  const workspace = getActiveWorkspace(db);

  if (!workspace || !workspace.is_active || workspace.path !== CURRENT_CWD) {
    return connectWorkspace(db).workspace;
  }

  return touchWorkspace(db);
}

function isTelegramConfigured() {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim(),
  );
}

function buildWorkspaceTelegramText(workspace) {
  return [
    "[veremote] workspace connected",
    `project: ${workspace.name}`,
    `path: ${workspace.path}`,
    `engine: ${workspace.engine}`,
    `preview: ${formatPreviewProfile(workspace)}`,
    "",
    "commands:",
    "/where",
    "/engine gemini",
    "/engine codex",
    "/run 이 프로젝트를 한 줄로 요약해줘",
    "/edit Header.tsx의 메인 타이틀을 더 크게 수정해줘",
    "/job last",
    "/tail last",
    "/screenshot last",
    "",
    "policy:",
    "/run = read-only",
    "/edit = workspace 내부 파일 수정 허용",
  ].join("\n");
}

async function sendWorkspaceConnectedTelegramMessage(workspace) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return {
      ok: false,
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
        text: buildWorkspaceTelegramText(workspace),
        disable_web_page_preview: true,
      }),
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        errorMessage:
          payload.description ||
          `Telegram API request failed with status ${response.status}.`,
      };
    }

    return {
      ok: true,
      messageId: String(payload.result.message_id),
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function createLogPath(jobId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(APP_ROOT, "data", "logs", `${jobId}-${timestamp}.log`);
}

function createJob(db, input) {
  const now = new Date().toISOString();
  const jobId = `job_${crypto.randomUUID()}`;
  const safePrompt = input.prompt.trim();
  const clippedPrompt =
    safePrompt.length > 42 ? `${safePrompt.slice(0, 42)}…` : safePrompt;
  const titlePrefix = input.mode === "edit" ? "Edit" : "Run";
  const engine = input.engine || DEFAULT_ENGINE;
  const promptWithMode =
    input.mode === "edit"
      ? `Edit mode. File changes are allowed only inside the active workspace. Always report the changed files and the edit summary.\n\n${safePrompt}`
      : `Run mode. Stay read-only and do not modify files. Analyze, inspect, summarize, or execute non-editing steps only.\n\n${safePrompt}`;

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
    jobId,
    `${titlePrefix}: ${clippedPrompt}`,
    engine,
    input.mode,
    promptWithMode,
    input.workspacePath || null,
    "queued",
    now,
    now,
    null,
    null,
    "작업이 생성되었습니다. 실행 전까지는 queued 상태로 유지됩니다.",
    "[]",
    null,
    null,
    null,
  );

  return {
    id: jobId,
    engine,
    mode: input.mode,
    title: `${titlePrefix}: ${clippedPrompt}`,
  };
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

function markJobAsFailed(db, jobId, message, logPath) {
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

function getJobSnapshot(db, jobId) {
  return (
    db
      .prepare(`
        SELECT
          id,
          title,
          mode,
          status,
          engine,
          log_path,
          result_summary,
          error_message,
          changed_files_json
        FROM jobs
        WHERE id = ?
      `)
      .get(jobId) || null
  );
}

function launchJobRunner(jobId, workspace) {
  const workspacePath = workspace.path;

  if (!isExistingDirectory(workspacePath)) {
    throw new Error(`Active workspace path is not a readable directory: ${workspacePath}`);
  }

  const child = spawn(process.execPath, [WORKER_PATH, jobId], {
    cwd: workspacePath,
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      VEREMOTE_APP_ROOT: APP_ROOT,
      VEREMOTE_WORKSPACE_PATH: workspacePath,
      VEREMOTE_PREVIEW_TYPE: workspace.preview_type || "",
      VEREMOTE_PREVIEW_TARGET: workspace.preview_target || "",
    },
  });

  child.unref();
}

function detectRequestedMode(prompt) {
  return EDIT_INTENT_PATTERN.test(prompt) ? "edit" : "run";
}

function queueJob(db, mode, prompt) {
  if (!prompt.trim()) {
    return {
      ok: false,
      error: `Usage: ${mode} <prompt>`,
    };
  }

  const workspace = ensureCurrentWorkspace(db);

  if (!workspace || !workspace.path || !isExistingDirectory(workspace.path)) {
    return {
      ok: false,
      error: "Active workspace path is missing or unavailable. Run `veremote connect` in a valid project folder first.",
    };
  }

  const job = createJob(db, {
    mode,
    engine: workspace.engine,
    prompt,
    workspacePath: workspace.path,
  });
  const logPath = createLogPath(job.id);

  try {
    markJobAsRunning(db, job.id, logPath);
    launchJobRunner(job.id, workspace);

    return {
      ok: true,
      job,
      workspace,
      logPath,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Runner launch failed.";
    markJobAsFailed(db, job.id, message, logPath);

    return {
      ok: false,
      error: `Failed to start job ${job.id}: ${message}`,
      job,
      workspace,
      logPath,
    };
  }
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

function formatClock(value = new Date()) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(value);
  } catch {
    return value.toISOString().slice(11, 19);
  }
}

function readLogoLines() {
  try {
    const content = fs.readFileSync(LOGO_PATH, "utf8");
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.length > 0 ? lines : DEFAULT_LOGO_LINES;
  } catch {
    return DEFAULT_LOGO_LINES;
  }
}

function getTextWidth(text) {
  return Array.from(text).length;
}

function centerText(text, width) {
  const textWidth = getTextWidth(text);
  const leftPadding = Math.max(0, Math.floor((width - textWidth) / 2));
  const rightPadding = Math.max(0, width - textWidth - leftPadding);
  return `${" ".repeat(leftPadding)}${text}${" ".repeat(rightPadding)}`;
}

function paint(text, ...codes) {
  return `${codes.join("")}${text}${ANSI.reset}`;
}

function getStatusRows(workspace) {
  const isConnected = Boolean(workspace && workspace.is_active);
  const relation = !workspace
    ? "-"
    : workspace.path === CURRENT_CWD
      ? "current cwd is active"
      : "different folder is active";

  const rows = [
    ["Current cwd", CURRENT_CWD],
    ["Default engine", DEFAULT_ENGINE],
    ["Connected", isConnected ? "connected" : "disconnected"],
    ["Relation", relation],
    ["Active path", workspace ? workspace.path : "-"],
    ["Active name", workspace ? workspace.name : "-"],
    ["Active engine", workspace ? workspace.engine : DEFAULT_ENGINE],
    ["Preview", workspace ? formatPreviewProfile(workspace) : "none"],
    ["Connected at", workspace ? formatTimestamp(workspace.connected_at) : "-"],
    [
      "Heartbeat",
      workspace ? formatTimestamp(workspace.last_heartbeat_at) : "-",
    ],
  ];

  if (workspace && workspace.chat_id) {
    rows.push(["Telegram chat", workspace.chat_id]);
  }

  return rows;
}

function printHeader() {
  const logoLines = readLogoLines();
  const viewportWidth = Math.max(64, Math.min(process.stdout.columns || 96, 120));

  console.log("");
  for (const line of logoLines) {
    console.log(paint(centerText(line, viewportWidth), ANSI.bold, ANSI.brand));
  }
  console.log("");
}

function printMessage(message) {
  console.log(message);
  console.log("");
}

function printStatus(workspace) {
  const rows = getStatusRows(workspace);
  const connectedValue =
    workspace && workspace.is_active
      ? paint("connected", ANSI.success)
      : paint("disconnected", ANSI.warning);

  console.log(paint("Workspace", ANSI.label));
  console.log(paint("─────────", ANSI.line));

  for (const [label, value] of rows) {
    const renderedValue =
      label === "Connected" ? connectedValue : value;
    console.log(`${label.padEnd(14)} ${renderedValue}`);
  }

  console.log("");
}

function printUsage() {
  console.log(paint("Usage", ANSI.label));
  console.log(paint("─────", ANSI.line));
  console.log("veremote");
  console.log("veremote help");
  console.log("veremote init");
  console.log("veremote doctor");
  console.log("veremote connect");
  console.log("veremote engine <gemini|codex|custom>");
  console.log("veremote preview");
  console.log("veremote preview <url|image|pencil> <target>");
  console.log("veremote preview <clear|none>");
  console.log("veremote status");
  console.log("veremote disconnect");
  console.log("veremote daemon");
  console.log("");
}

function printHelp() {
  console.log(paint("Commands", ANSI.label));
  console.log(paint("────────", ANSI.line));

  for (const [command, description] of HELP_ROWS) {
    console.log(`${paint(command.padEnd(15), ANSI.bold)} ${description}`);
  }

  console.log("");
  console.log(paint("Setup", ANSI.label));
  console.log(paint("─────", ANSI.line));
  console.log(`${paint("init".padEnd(15), ANSI.bold)} Create a starter .env.local if missing`);
  console.log(`${paint("doctor".padEnd(15), ANSI.bold)} Check env, engines, playwright, db, daemon`);
  console.log("");
}

function splitCommandString(command) {
  const parts = String(command || "").match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}

function getConfiguredCommand(envKey, fallbackCommand) {
  const raw = process.env[envKey] && process.env[envKey].trim();

  if (!raw) {
    return {
      raw: fallbackCommand,
      binary: fallbackCommand,
      source: "default",
    };
  }

  const [binary] = splitCommandString(raw);
  return {
    raw,
    binary: binary || fallbackCommand,
    source: envKey,
  };
}

function getEnvTemplate() {
  return [
    "# veremote local configuration",
    "# Fill in the values you actually use, then run `veremote doctor`.",
    "",
    "TELEGRAM_BOT_TOKEN=",
    "TELEGRAM_CHAT_ID=",
    "TELEGRAM_POLLING_ENABLED=true",
    "TELEGRAM_POLLING_INTERVAL_MS=1000",
    "",
    "# Web detail links / localhost screenshot target",
    "PUBLIC_BASE_URL=http://localhost:3000",
    "WORKSPACE_PREVIEW_URL=http://localhost:3000",
    "",
    "# Optional: use a real exported PNG instead of localhost capture",
    "# WORKSPACE_PREVIEW_IMAGE_PATH=/absolute/path/to/export.png",
    "",
    "# Optional: allow preview files outside the workspace root",
    "# VEREMOTE_ALLOWED_PREVIEW_ROOTS=/absolute/path/to/exports",
    "",
    "# Engines",
    "GEMINI_CLI_COMMAND=gemini",
    "CODEX_CLI_COMMAND=codex",
    "# CUSTOM_CLI_COMMAND=",
    "",
  ].join("\n");
}

function writeInitEnvFile() {
  if (fs.existsSync(ENV_PATH)) {
    return {
      created: false,
      path: ENV_PATH,
    };
  }

  fs.writeFileSync(ENV_PATH, getEnvTemplate(), "utf8");
  return {
    created: true,
    path: ENV_PATH,
  };
}

function ensureSupportDirectories() {
  const directories = [
    path.dirname(DATABASE_PATH),
    path.join(APP_ROOT, "data", "logs"),
  ];

  for (const directory of directories) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function canWriteToDirectory(directoryPath) {
  try {
    fs.mkdirSync(directoryPath, { recursive: true });
    const probePath = path.join(directoryPath, `.veremote-write-check-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probePath, "ok", "utf8");
    fs.rmSync(probePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

function getCommandPath(binary) {
  if (!binary) {
    return null;
  }

  const result = spawnSync("which", [binary], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return null;
  }

  return (result.stdout || "").trim() || null;
}

function runQuickNodeCheck(script) {
  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: APP_ROOT,
    encoding: "utf8",
    timeout: 20000,
  });

  return {
    ok: result.status === 0,
    output: `${result.stdout || ""}${result.stderr || ""}`.trim(),
  };
}

function createDoctorCheck(status, label, detail) {
  return { status, label, detail };
}

function printDoctorChecks(checks) {
  console.log(paint("Doctor", ANSI.label));
  console.log(paint("──────", ANSI.line));

  const counts = {
    ok: 0,
    warn: 0,
    fail: 0,
  };

  for (const check of checks) {
    counts[check.status] += 1;
    const tag =
      check.status === "ok"
        ? paint("OK  ", ANSI.success)
        : check.status === "warn"
          ? paint("WARN", ANSI.warning)
          : paint("FAIL", "\x1b[38;5;203m");
    console.log(`${tag} ${check.label}`);
    if (check.detail) {
      console.log(`     ${check.detail}`);
    }
  }

  console.log("");
  console.log(
    `summary: ok ${counts.ok} | warn ${counts.warn} | fail ${counts.fail}`,
  );
  console.log("");
}

function runInitCommand() {
  ensureSupportDirectories();
  const result = writeInitEnvFile();

  printMessage(
    result.created
      ? `Created ${result.path}`
      : `${result.path} already exists. Left it unchanged.`,
  );

  console.log(paint("Next", ANSI.label));
  console.log(paint("────", ANSI.line));
  console.log(`1. Open ${result.path} and fill in the values you need.`);
  console.log("2. Run `veremote doctor`.");
  console.log("3. Run `veremote connect` in your project folder.");
  console.log("");
}

function runDoctorCommand() {
  ensureSupportDirectories();

  const db = ensureDb();
  const workspace = getActiveWorkspace(db);
  const daemonPid = getRunningDaemonPid(DAEMON_PID_PATH, DAEMON_PATH);
  const geminiConfig = getConfiguredCommand("GEMINI_CLI_COMMAND", "gemini");
  const codexConfig = getConfiguredCommand("CODEX_CLI_COMMAND", "codex");
  const npmVersion = spawnSync("npm", ["--version"], { encoding: "utf8" });
  const playwrightModuleCheck = runQuickNodeCheck(
    "try { require('playwright'); console.log('playwright module ok'); } catch (error) { console.error(error.message); process.exit(1); }",
  );
  const chromiumCheck = runQuickNodeCheck(
    "const { chromium } = require('playwright'); chromium.launch({ headless: true }).then(async (browser) => { await browser.close(); console.log('chromium launch ok'); }).catch((error) => { console.error(error.message); process.exit(1); });",
  );

  const checks = [];

  checks.push(
    createDoctorCheck(
      process.version ? "ok" : "fail",
      `Node.js ${process.version}`,
      `binary: ${process.execPath}`,
    ),
  );

  checks.push(
    createDoctorCheck(
      npmVersion.status === 0 ? "ok" : "fail",
      "npm availability",
      npmVersion.status === 0
        ? `version: ${(npmVersion.stdout || "").trim()}`
        : (npmVersion.stderr || npmVersion.error?.message || "npm command failed").trim(),
    ),
  );

  checks.push(
    createDoctorCheck(
      fs.existsSync(ENV_PATH) ? "ok" : "warn",
      ".env.local",
      fs.existsSync(ENV_PATH)
        ? `found at ${ENV_PATH}`
        : `missing. Run \`veremote init\` to create ${ENV_PATH}`,
    ),
  );

  checks.push(
    createDoctorCheck(
      process.env.TELEGRAM_BOT_TOKEN?.trim() ? "ok" : "warn",
      "Telegram bot token",
      process.env.TELEGRAM_BOT_TOKEN?.trim()
        ? "configured"
        : "missing TELEGRAM_BOT_TOKEN",
    ),
  );

  checks.push(
    createDoctorCheck(
      process.env.TELEGRAM_CHAT_ID?.trim() ? "ok" : "warn",
      "Telegram chat id",
      process.env.TELEGRAM_CHAT_ID?.trim()
        ? `configured: ${process.env.TELEGRAM_CHAT_ID.trim()}`
        : "missing TELEGRAM_CHAT_ID",
    ),
  );

  checks.push(
    createDoctorCheck(
      process.env.TELEGRAM_POLLING_ENABLED === "true" ? "ok" : "warn",
      "Telegram polling",
      process.env.TELEGRAM_POLLING_ENABLED === "true"
        ? `enabled (${process.env.TELEGRAM_POLLING_INTERVAL_MS || "3000"}ms)`
        : "disabled. Set TELEGRAM_POLLING_ENABLED=true",
    ),
  );

  for (const commandConfig of [geminiConfig, codexConfig]) {
    const resolvedPath = getCommandPath(commandConfig.binary);
    checks.push(
      createDoctorCheck(
        resolvedPath ? "ok" : "warn",
        `${commandConfig.binary} command`,
        resolvedPath
          ? `${commandConfig.source}: ${resolvedPath}`
          : `not found for ${commandConfig.source === "default" ? "default command" : commandConfig.source} (${commandConfig.raw})`,
      ),
    );
  }

  checks.push(
    createDoctorCheck(
      playwrightModuleCheck.ok ? "ok" : "warn",
      "Playwright package",
      playwrightModuleCheck.ok ? playwrightModuleCheck.output : playwrightModuleCheck.output || "playwright module missing",
    ),
  );

  checks.push(
    createDoctorCheck(
      chromiumCheck.ok ? "ok" : "warn",
      "Playwright Chromium",
      chromiumCheck.ok
        ? chromiumCheck.output
        : `${chromiumCheck.output || "chromium launch failed"} | try: npx playwright install chromium`,
    ),
  );

  checks.push(
    createDoctorCheck(
      canWriteToDirectory(path.dirname(DATABASE_PATH)) ? "ok" : "fail",
      "Database directory write access",
      path.dirname(DATABASE_PATH),
    ),
  );

  checks.push(
    createDoctorCheck(
      workspace && workspace.is_active ? "ok" : "warn",
      "Active workspace",
      workspace && workspace.is_active
        ? `${workspace.path} (${workspace.engine})`
        : "no active workspace. Run `veremote connect` in your project folder",
    ),
  );

  checks.push(
    createDoctorCheck(
      workspace && workspace.preview_type ? "ok" : "warn",
      "Workspace preview profile",
      workspace ? formatPreviewProfile(workspace) : "none",
    ),
  );

  checks.push(
    createDoctorCheck(
      daemonPid ? "ok" : "warn",
      "Telegram daemon",
      daemonPid
        ? `running (pid ${daemonPid})`
        : "not running. Start with `veremote daemon` or open `veremote`",
    ),
  );

  if (process.env.WORKSPACE_PREVIEW_URL?.trim()) {
    checks.push(
      createDoctorCheck(
        "ok",
        "Preview URL",
        process.env.WORKSPACE_PREVIEW_URL.trim(),
      ),
    );
  }

  if (process.env.WORKSPACE_PREVIEW_IMAGE_PATH?.trim()) {
    const previewPath = path.isAbsolute(process.env.WORKSPACE_PREVIEW_IMAGE_PATH.trim())
      ? process.env.WORKSPACE_PREVIEW_IMAGE_PATH.trim()
      : path.join(CURRENT_CWD, process.env.WORKSPACE_PREVIEW_IMAGE_PATH.trim());
    checks.push(
      createDoctorCheck(
        fs.existsSync(previewPath) ? "ok" : "warn",
        "Preview image path",
        fs.existsSync(previewPath)
          ? previewPath
          : `missing file: ${previewPath}`,
      ),
    );
  }

  printDoctorChecks(checks);
  db.close();
}

function assertDefaultEngine() {
  if (!ALLOWED_ENGINES.has(DEFAULT_ENGINE)) {
    console.error(`Unsupported default engine: ${DEFAULT_ENGINE}`);
    process.exit(1);
  }
}

function createTuiWidgets(screen) {
  const logoLines = readLogoLines();
  const headerHeight = logoLines.length + 4;
  const summaryTop = headerHeight;
  const contentTop = summaryTop + 4;
  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: headerHeight,
    style: {
      fg: THEME.text,
      bg: THEME.panelAlt,
    },
  });

  const headerTopOffset = 1;
  logoLines.forEach((line, index) => {
    blessed.box({
      parent: header,
      top: headerTopOffset + index,
      left: 1,
      right: 1,
      height: 1,
      align: "center",
      content: line,
      style: {
        fg: THEME.brand,
        bold: true,
      },
    });
  });

  const summary = blessed.box({
    parent: screen,
    top: summaryTop,
    left: 0,
    width: "100%",
    height: 4,
    border: "line",
    label: " Summary ",
    tags: false,
    style: {
      fg: THEME.text,
      bg: THEME.panel,
      border: { fg: THEME.border },
      label: { fg: THEME.brand, bold: true },
    },
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
  });

  const help = blessed.box({
    parent: screen,
    top: contentTop,
    left: 0,
    width: 32,
    bottom: 5,
    border: "line",
    label: " Commands ",
    tags: false,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    mouse: true,
    style: {
      fg: THEME.text,
      bg: THEME.panelAlt,
      border: { fg: THEME.border },
      label: { fg: THEME.brand, bold: true },
      scrollbar: { bg: THEME.border },
    },
    scrollbar: {
      ch: " ",
      bg: THEME.border,
    },
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
  });

  const conversation = blessed.log({
    parent: screen,
    top: contentTop,
    left: 32,
    width: "100%-32",
    bottom: 5,
    border: "line",
    label: " Conversation / Logs ",
    tags: false,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    mouse: true,
    scrollbar: {
      ch: " ",
      bg: THEME.border,
    },
    style: {
      fg: THEME.text,
      bg: THEME.panel,
      border: { fg: THEME.border },
      label: { fg: THEME.brand, bold: true },
      scrollbar: { bg: THEME.border },
    },
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
  });

  const promptFrame = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: "100%",
    height: 5,
    border: "line",
    label: " Prompt ",
    style: {
      fg: THEME.text,
      bg: THEME.panelAlt,
      border: { fg: THEME.border },
      label: { fg: THEME.brand, bold: true },
    },
  });

  blessed.box({
    parent: promptFrame,
    top: 1,
    left: 2,
    width: 2,
    height: 1,
    content: ">",
    style: {
      fg: THEME.brand,
      bold: true,
    },
  });

  const input = blessed.textbox({
    parent: promptFrame,
    top: 1,
    left: 4,
    right: 2,
    height: 1,
    inputOnFocus: true,
    keys: true,
    mouse: true,
    multiline: false,
    style: {
      fg: THEME.text,
      bg: THEME.panelAlt,
    },
  });

  blessed.box({
    parent: promptFrame,
    bottom: 1,
    left: 2,
    right: 2,
    height: 1,
    content: "Enter submit | PgUp/PgDn scroll logs | Ctrl+C / Ctrl+D quit",
    style: {
      fg: THEME.muted,
      bg: THEME.panelAlt,
    },
  });

  return {
    screen,
    summary,
    help,
    conversation,
    input,
  };
}

function buildSummaryText(workspace) {
  const statusText =
    workspace && workspace.is_active ? "connected" : "disconnected";
  const workspaceText = workspace ? workspace.name : "-";
  const engineText = workspace ? workspace.engine : DEFAULT_ENGINE;
  const pathText = workspace ? workspace.path : "No active workspace";
  const heartbeat = workspace ? formatTimestamp(workspace.last_heartbeat_at) : "-";
  const previewText = workspace ? formatPreviewProfile(workspace) : "none";

  return [
    `workspace  ${workspaceText}   |   engine  ${engineText}   |   status  ${statusText}`,
    pathText,
    `cwd: ${CURRENT_CWD}   |   heartbeat: ${heartbeat}   |   preview: ${previewText}`,
  ].join("\n");
}

function buildHelpText() {
  const lines = HELP_ROWS.map(
    ([command, description]) => `${command.padEnd(15)} ${description}`,
  );

  lines.push("");
  lines.push("tips");
  lines.push("ask <prompt> auto-picks run or edit from your wording");
  lines.push("engine gemini / engine codex switches the active engine");
  lines.push("preview url http://localhost:3000 sets web screenshots");
  lines.push("preview image ./export.png or preview pencil ./export.png sets explicit preview policy");
  lines.push("status / where append details to the log panel");
  lines.push("plain sentences also start a background job automatically");
  lines.push("telegram examples: where engine codex ask ... edit ... job last tail last screenshot last");
  lines.push("run `veremote daemon` in another terminal to receive telegram commands");
  lines.push("the prompt stays pinned to the bottom");

  return lines.join("\n");
}

function runDaemonProcess() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [DAEMON_PATH], {
      cwd: APP_ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        VEREMOTE_APP_ROOT: APP_ROOT,
      },
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || code === null) {
        resolve();
        return;
      }

      reject(new Error(`Daemon exited with code ${code}.`));
    });
  });
}

function ensureBackgroundDaemonStarted() {
  const existingPid = getRunningDaemonPid(DAEMON_PID_PATH, DAEMON_PATH);

  if (existingPid) {
    return {
      started: false,
      pid: existingPid,
    };
  }

  const child = spawn(process.execPath, [DAEMON_PATH], {
    cwd: APP_ROOT,
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      VEREMOTE_APP_ROOT: APP_ROOT,
    },
  });

  child.unref();

  return {
    started: true,
    pid: child.pid,
  };
}

function appendConversation(conversation, text) {
  const lines = Array.isArray(text) ? text : String(text).split(/\r?\n/);

  for (const line of lines) {
    if (!line) {
      conversation.log("");
      continue;
    }

    conversation.log(`[${formatClock()}] ${line}`);
  }
}

function formatStatusLog(workspace) {
  return getStatusRows(workspace).map(
    ([label, value]) => `${label}: ${value}`,
  );
}

function formatWhereLog(workspace) {
  return [
    `Workspace: ${workspace ? workspace.path : "-"}`,
    `Engine: ${workspace ? workspace.engine : DEFAULT_ENGINE}`,
    `Preview: ${workspace ? formatPreviewProfile(workspace) : "none"}`,
    `Current cwd: ${CURRENT_CWD}`,
  ];
}

function parsePreviewCommandInput(rawInput) {
  const trimmed = String(rawInput || "").trim();

  if (!trimmed) {
    return {
      action: "show",
      type: null,
      target: null,
    };
  }

  const [rawType, ...rest] = trimmed.split(/\s+/);
  const normalizedType = normalizePreviewType(rawType);

  if (!normalizedType && rawType !== "clear" && rawType !== "none") {
    return {
      action: "invalid",
      type: rawType,
      target: rest.join(" ").trim(),
    };
  }

  if (!normalizedType) {
    return {
      action: "clear",
      type: null,
      target: null,
    };
  }

  return {
    action: "set",
    type: normalizedType,
    target: rest.join(" ").trim(),
  };
}

function startFullScreenTui(db) {
  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    dockBorders: true,
    autoPadding: false,
    title: "veremote",
    warnings: false,
  });

  const widgets = createTuiWidgets(screen);
  const state = {
    closing: false,
    watchers: new Map(),
  };

  function refreshSummary() {
    widgets.summary.setContent(buildSummaryText(getActiveWorkspace(db)));
  }

  function registerWatcher(jobId, logPath) {
    state.watchers.set(jobId, {
      jobId,
      logPath,
      lastContent: "",
      lastStatus: "running",
      completedAt: null,
    });
  }

  function appendSystem(text) {
    appendConversation(widgets.conversation, text);
    screen.render();
  }

  function pollWatchers() {
    for (const [jobId, watcher] of state.watchers) {
      if (watcher.logPath && fs.existsSync(watcher.logPath)) {
        try {
          const content = fs.readFileSync(watcher.logPath, "utf8");

          if (content !== watcher.lastContent) {
            const delta = content.startsWith(watcher.lastContent)
              ? content.slice(watcher.lastContent.length)
              : content;

            watcher.lastContent = content;

            const lines = delta.split(/\r?\n/).filter(Boolean);
            for (const line of lines) {
              appendConversation(
                widgets.conversation,
                `job ${jobId.slice(0, 8)} | ${line}`,
              );
            }
          }
        } catch {
          // Ignore transient log read failures.
        }
      }

      const snapshot = getJobSnapshot(db, jobId);

      if (!snapshot) {
        state.watchers.delete(jobId);
        continue;
      }

      if (snapshot.status !== watcher.lastStatus) {
        watcher.lastStatus = snapshot.status;

        if (snapshot.status === "success") {
          appendConversation(
            widgets.conversation,
            `job ${jobId} completed: ${snapshot.result_summary || "success"}`,
          );
          watcher.completedAt = Date.now();
        }

        if (snapshot.status === "failed") {
          appendConversation(
            widgets.conversation,
            `job ${jobId} failed: ${snapshot.error_message || "unknown error"}`,
          );
          watcher.completedAt = Date.now();
        }

        if (snapshot.status === "partial" || snapshot.status === "export_failed") {
          appendConversation(
            widgets.conversation,
            `job ${jobId} ${snapshot.status}: ${snapshot.error_message || snapshot.result_summary || snapshot.status}`,
          );
          watcher.completedAt = Date.now();
        }
      }

      if (
        watcher.completedAt &&
        Date.now() - watcher.completedAt > 2000
      ) {
        state.watchers.delete(jobId);
      }
    }

    refreshSummary();
    screen.render();
  }

  function cleanup() {
    if (state.closing) {
      return;
    }

    state.closing = true;
    clearInterval(intervalId);
    db.close();
    screen.destroy();
    process.exit(0);
  }

  async function handleTuiCommand(rawInput) {
    const trimmed = rawInput.trim();

    if (!trimmed) {
      return;
    }

    appendSystem(`> ${trimmed}`);

    const [command, ...rest] = trimmed.split(" ");
    const prompt = rest.join(" ").trim();

    if (command === "run" || command === "edit" || command === "ask") {
      const requestedMode = command === "ask" ? detectRequestedMode(prompt) : command;
      const result = queueJob(db, requestedMode, prompt);

      if (!result.ok) {
        appendSystem(result.error);
        refreshSummary();
        return;
      }

      appendSystem([
        `started ${requestedMode} job ${result.job.id}`,
        `engine: ${result.workspace.engine}`,
        `workspace: ${result.workspace.path}`,
        command === "ask" ? `selected by prompt: ${requestedMode}` : null,
      ].filter(Boolean));
      registerWatcher(result.job.id, result.logPath);
      refreshSummary();
      return;
    }

    if (command === "engine") {
      if (!prompt) {
        const workspace = touchWorkspace(db);
        appendSystem(`Current engine: ${workspace ? workspace.engine : DEFAULT_ENGINE}`);
        refreshSummary();
        return;
      }

      const nextEngine = prompt.split(/\s+/)[0].trim();
      const result = setWorkspaceEngine(db, nextEngine);

      if (!result.ok) {
        appendSystem(`${result.error}. Allowed: gemini, codex, custom`);
        refreshSummary();
        return;
      }

      appendSystem([
        `engine switched to ${result.workspace.engine}`,
        `workspace: ${result.workspace.path}`,
      ]);
      refreshSummary();
      return;
    }

    if (command === "preview") {
      const parsed = parsePreviewCommandInput(prompt);

      if (parsed.action === "show") {
        const workspace = touchWorkspace(db);
        appendSystem(`Current preview: ${workspace ? formatPreviewProfile(workspace) : "none"}`);
        refreshSummary();
        return;
      }

      if (parsed.action === "invalid") {
        appendSystem(`Unsupported preview type: ${parsed.type}`);
        appendSystem("Usage: preview url <target> | preview image <target> | preview pencil <target> | preview clear");
        refreshSummary();
        return;
      }

      const result = setWorkspacePreview(db, parsed.type, parsed.target);

      if (!result.ok) {
        appendSystem(result.error);
        refreshSummary();
        return;
      }

      appendSystem(`preview set to ${formatPreviewProfile(result.workspace)}`);
      refreshSummary();
      return;
    }

    if (command === "where") {
      appendSystem(formatWhereLog(touchWorkspace(db)));
      refreshSummary();
      return;
    }

    if (command === "status") {
      appendSystem(formatStatusLog(touchWorkspace(db)));
      refreshSummary();
      return;
    }

    if (command === "help") {
      appendSystem(buildHelpText());
      return;
    }

    if (command === "exit" || command === "quit" || command === ":q" || command === "q") {
      cleanup();
      return;
    }

    if (trimmed.length >= 6) {
      const requestedMode = detectRequestedMode(trimmed);
      const result = queueJob(db, requestedMode, trimmed);

      if (!result.ok) {
        appendSystem(result.error);
        refreshSummary();
        return;
      }

      appendSystem([
        `started ${requestedMode} job ${result.job.id}`,
        `engine: ${result.workspace.engine}`,
        `workspace: ${result.workspace.path}`,
        `selected by prompt: ${requestedMode}`,
      ]);
      registerWatcher(result.job.id, result.logPath);
      refreshSummary();
      return;
    }

    appendSystem(`Unknown command: ${command}`);
    appendSystem("Type `help` to see the available commands.");
  }

  const result = connectWorkspace(db);

  widgets.help.setContent(buildHelpText());
  refreshSummary();
  appendSystem("Connected current folder and opened the fullscreen TUI.");

  if (result.replacedPath) {
    appendSystem(`replaced previous workspace: ${result.replacedPath}`);
  }

  if (result.didChange) {
    sendWorkspaceConnectedTelegramMessage(result.workspace).then((telegramResult) => {
      if (telegramResult.ok) {
        appendSystem("telegram connection message sent.");
        return;
      }

      if (isTelegramConfigured()) {
        appendSystem(`telegram connection message failed: ${telegramResult.errorMessage}`);
      }
    });
  }

  const daemonResult = ensureBackgroundDaemonStarted();

  if (daemonResult.started) {
    appendSystem(`telegram daemon started in background (pid ${daemonResult.pid}).`);
  } else if (daemonResult.pid) {
    appendSystem(`telegram daemon already running (pid ${daemonResult.pid}).`);
  }

  appendSystem("Type `help` for commands. The prompt stays pinned to the bottom.");
  appendSystem("Telegram examples: where, engine codex, ask 이 프로젝트를 한 줄로 요약해줘, edit Header.tsx의 타이틀을 더 크게 수정해줘, job last, tail last, screenshot last");
  appendSystem("Local preview examples: preview url http://localhost:3000 | preview image ./export.png | preview pencil ./export.png | preview clear");
  appendSystem("Telegram command listener is kept in sync automatically while veremote is open.");

  const intervalId = setInterval(pollWatchers, 1000);

  widgets.input.on("submit", async (value) => {
    widgets.input.clearValue();
    screen.render();
    await handleTuiCommand(value || "");
    widgets.input.focus();
    screen.render();
  });

  widgets.input.focus();

  const exitKeys = ["C-c", "C-d"];
  screen.key(exitKeys, cleanup);
  widgets.input.key(exitKeys, cleanup);
  widgets.conversation.key(exitKeys, cleanup);
  widgets.help.key(exitKeys, cleanup);
  screen.key(["pageup"], () => {
    widgets.conversation.scroll(-8);
    screen.render();
  });
  screen.key(["pagedown"], () => {
    widgets.conversation.scroll(8);
    screen.render();
  });

  screen.on("resize", () => {
    screen.render();
  });

  screen.render();
}

async function runCommandMode(command) {
  printHeader();

  if (command === "init") {
    runInitCommand();
    return;
  }

  if (command === "doctor") {
    runDoctorCommand();
    return;
  }

  const db = ensureDb();

  if (command === "connect") {
    const result = connectWorkspace(db);
    printMessage("Connected current folder as the active workspace.");

    if (result.replacedPath) {
      printMessage(`Replaced previous workspace: ${result.replacedPath}`);
    }

    printStatus(result.workspace);

    if (result.didChange) {
      const telegramResult = await sendWorkspaceConnectedTelegramMessage(
        result.workspace,
      );

      if (telegramResult.ok) {
        printMessage("Telegram connection message sent.");
      } else if (isTelegramConfigured()) {
        printMessage(
          `Telegram connection message failed: ${telegramResult.errorMessage}`,
        );
      }
    }

    db.close();
    return;
  }

  if (command === "engine") {
    const nextEngine = process.argv[3];

    if (!nextEngine) {
      const workspace = getActiveWorkspace(db) ? touchWorkspace(db) : null;
      printMessage(`Current engine: ${workspace ? workspace.engine : DEFAULT_ENGINE}`);
      printStatus(workspace);
      db.close();
      return;
    }

    const result = setWorkspaceEngine(db, nextEngine);

    if (!result.ok) {
      db.close();
      console.error(`${result.error}. Allowed: gemini, codex, custom`);
      process.exit(1);
    }

    printMessage(`Active engine changed to ${result.workspace.engine}.`);

    if (result.replacedPath) {
      printMessage(`Replaced previous workspace: ${result.replacedPath}`);
    }

    printStatus(result.workspace);
    db.close();
    return;
  }

  if (command === "preview") {
    const parsed = parsePreviewCommandInput(process.argv.slice(3).join(" "));

    if (parsed.action === "show") {
      const workspace = getActiveWorkspace(db) ? touchWorkspace(db) : null;
      printMessage(`Current preview: ${workspace ? formatPreviewProfile(workspace) : "none"}`);
      printStatus(workspace);
      db.close();
      return;
    }

    if (parsed.action === "invalid") {
      db.close();
      console.error(`Unsupported preview type: ${parsed.type}`);
      console.log("Usage: veremote preview <url|image|pencil> <target>");
      console.log("       veremote preview <clear|none>");
      process.exit(1);
    }

    const result = setWorkspacePreview(db, parsed.type, parsed.target);

    if (!result.ok) {
      db.close();
      console.error(result.error);
      process.exit(1);
    }

    printMessage(`Preview profile changed to ${formatPreviewProfile(result.workspace)}.`);
    printStatus(result.workspace);
    db.close();
    return;
  }

  if (command === "status") {
    const workspace = getActiveWorkspace(db) ? touchWorkspace(db) : null;
    printMessage(
      workspace
        ? "Active workspace is available."
        : "No active workspace is connected yet.",
    );
    printStatus(workspace);
    db.close();
    return;
  }

  if (command === "disconnect") {
    const workspace = disconnectWorkspace(db);
    printMessage(
      workspace
        ? `Disconnected workspace: ${workspace.path}`
        : "Nothing to disconnect.",
    );
    printStatus(null);
    db.close();
    return;
  }

  if (command === "daemon") {
    const workspace = getActiveWorkspace(db) ? touchWorkspace(db) : null;
    const existingPid = getRunningDaemonPid(DAEMON_PID_PATH, DAEMON_PATH);

    if (existingPid) {
      printMessage(`veremote daemon is already running (pid ${existingPid}).`);

      if (workspace) {
        printStatus(workspace);
      }

      db.close();
      return;
    }

    printMessage("Starting veremote daemon for Telegram polling.");

    if (workspace) {
      printStatus(workspace);
      printMessage("Telegram examples: /where, /engine codex, /run <prompt>, /edit <prompt>, /job last, /tail last, /screenshot last");
      printMessage("Local preview examples: veremote preview url <url> | veremote preview image <path> | veremote preview pencil <path> | veremote preview clear");
    } else {
      printMessage(
        "No active workspace is connected yet. Telegram commands that require a workspace will be rejected until you run `veremote connect`.",
      );
    }

    db.close();
    await runDaemonProcess();
    return;
  }

  if (command === "help" || command === "--help" || command === "-h") {
    printUsage();
    printHelp();
    db.close();
    return;
  }

  db.close();
  console.error(`Unknown command: ${command}`);
  console.log("");
  printUsage();
  process.exit(1);
}

function main() {
  assertDefaultEngine();

  const command = process.argv[2];

  if (!command) {
    startFullScreenTui(ensureDb());
    return;
  }

  return runCommandMode(command);
}

Promise.resolve(main()).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
