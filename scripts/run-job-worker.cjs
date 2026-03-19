#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const sharp = require("sharp");
const { chromium } = require("playwright");

const jobId = process.argv[2];
const appRoot = process.env.VEREMOTE_APP_ROOT || process.cwd();
const workspacePath = process.env.VEREMOTE_WORKSPACE_PATH || process.cwd();
const databasePath = path.join(appRoot, "data", "remote-cli.sqlite");
const mockEngineScriptPath = path.join(appRoot, "scripts", "mock-engine.cjs");
const FAILURE_LIKE_STATUSES = new Set(["failed", "partial", "export_failed"]);

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

  ensureExtendedJobStatuses(db);

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

function updateTerminalStatus(db, status, logPath, summary, message, changedFiles) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs
    SET
      status = ?,
      updated_at = ?,
      finished_at = ?,
      result_summary = ?,
      changed_files_json = ?,
      log_path = COALESCE(?, log_path),
      error_message = ?
    WHERE id = ?
  `).run(
    status,
    now,
    now,
    summary,
    JSON.stringify(changedFiles || []),
    logPath,
    message,
    jobId,
  );
}

function setPreviewImagePath(db, previewImagePath) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs
    SET
      updated_at = ?,
      preview_image_path = ?
    WHERE id = ?
  `).run(now, previewImagePath, jobId);
}

function updateFailure(db, logPath, message, changedFiles) {
  updateTerminalStatus(
    db,
    "failed",
    logPath,
    "작업 실행 중 오류가 발생했습니다.",
    message,
    changedFiles,
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
    relativePath === ".veremote" ||
    relativePath === "node_modules" ||
    relativePath === "data" ||
    relativePath.startsWith(".git/") ||
    relativePath.startsWith(".next/") ||
    relativePath.startsWith(".veremote/") ||
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

function getStatusHeadline(job) {
  if (job.status === "success") {
    return "[Remote CLI] 작업 완료";
  }

  if (job.status === "partial") {
    return "[Remote CLI] 작업 부분 완료";
  }

  if (job.status === "export_failed") {
    return "[Remote CLI] export 실패";
  }

  return "[Remote CLI] 작업 실패";
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(value, maxChars, maxLines) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (!text) {
    return [];
  }

  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;

    if (lines.length >= maxLines - 1) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (words.join(" ").length > lines.join(" ").length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(0, maxChars - 1))}…`;
  }

  return lines;
}

function createPreviewImagePath() {
  const previewDir = path.join(workspacePath, ".veremote", "previews");
  fs.mkdirSync(previewDir, { recursive: true });
  return path.join(previewDir, `${jobId}.png`);
}

function resolveWorkspaceAssetPath(assetPath) {
  if (!assetPath || !assetPath.trim()) {
    return null;
  }

  const trimmed = assetPath.trim();
  return path.isAbsolute(trimmed) ? trimmed : path.join(workspacePath, trimmed);
}

function getReferenceTime(job) {
  const timestamp = new Date(job.startedAt || job.createdAt || Date.now()).getTime();
  return Number.isNaN(timestamp) ? Date.now() : timestamp;
}

function isFreshEnough(filePath, referenceTime) {
  try {
    return fs.statSync(filePath).mtimeMs >= referenceTime - 1500;
  } catch {
    return false;
  }
}

function hasPenFiles(rootPath, maxDepth = 3) {
  function visit(currentPath, depth) {
    if (depth > maxDepth) {
      return false;
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, absolutePath).split(path.sep).join("/");

      if (!relativePath || shouldIgnoreWorkspaceEntry(relativePath)) {
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".pen")) {
        return true;
      }

      if (entry.isDirectory() && visit(absolutePath, depth + 1)) {
        return true;
      }
    }

    return false;
  }

  try {
    return visit(rootPath, 0);
  } catch {
    return false;
  }
}

function isPencilJob(job) {
  const prompt = String(job.prompt || "").toLowerCase();
  return (
    Boolean(process.env.WORKSPACE_PREVIEW_IMAGE_PATH?.trim()) ||
    prompt.includes("pencil") ||
    prompt.includes(".pen") ||
    hasPenFiles(job.workspacePath || workspacePath)
  );
}

function parseChangedPath(entry) {
  const separatorIndex = entry.indexOf(":");
  return separatorIndex === -1 ? entry : entry.slice(separatorIndex + 1);
}

function findLatestPngInWorkspace(rootPath, referenceTime) {
  const candidates = [];

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

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".png")) {
        continue;
      }

      try {
        const stats = fs.statSync(absolutePath);
        if (stats.mtimeMs >= referenceTime - 1500) {
          candidates.push({ absolutePath, mtimeMs: stats.mtimeMs });
        }
      } catch {
        // Ignore unreadable file.
      }
    }
  }

  try {
    visit(rootPath);
  } catch {
    return null;
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.absolutePath || null;
}

function resolvePencilExportImage(job, changedFiles) {
  const referenceTime = getReferenceTime(job);
  const configuredImagePath = resolveWorkspaceAssetPath(
    process.env.WORKSPACE_PREVIEW_IMAGE_PATH,
  );

  if (
    configuredImagePath &&
    fs.existsSync(configuredImagePath) &&
    isFreshEnough(configuredImagePath, referenceTime)
  ) {
    return configuredImagePath;
  }

  const changedPng = (changedFiles || [])
    .map(parseChangedPath)
    .filter((relativePath) => relativePath.toLowerCase().endsWith(".png"))
    .map((relativePath) => path.join(workspacePath, relativePath))
    .filter((absolutePath) => fs.existsSync(absolutePath) && isFreshEnough(absolutePath, referenceTime))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];

  if (changedPng) {
    return changedPng;
  }

  return findLatestPngInWorkspace(workspacePath, referenceTime);
}

async function generatePreviewFromImageFile(sourcePath) {
  const previewPath = createPreviewImagePath();
  await sharp(sourcePath).png().toFile(previewPath);
  return previewPath;
}

async function generatePreviewFromUrl(previewUrl) {
  const previewPath = createPreviewImagePath();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1024 },
      deviceScaleFactor: 2,
    });
    await page.goto(previewUrl, { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({
      path: previewPath,
      fullPage: true,
      type: "png",
    });
  } finally {
    await browser.close();
  }

  return previewPath;
}

async function generatePreviewImage(job) {
  const previewPath = createPreviewImagePath();
  const workspaceName = path.basename(job.workspacePath || workspacePath) || workspacePath;
  const summaryLines = wrapText(
    job.status === "failed" ? job.errorMessage || job.resultSummary : job.resultSummary,
    42,
    5,
  );
  const changedFiles = Array.isArray(job.changedFiles) ? job.changedFiles.slice(0, 4) : [];
  const accent = job.status === "success" ? "#b7d3a8" : "#e7b18b";
  const changedSection =
    job.mode === "edit"
      ? changedFiles.map((line, index) => `<text x="88" y="${620 + index * 36}" font-size="24" fill="#c9d1d9">${escapeXml(line)}</text>`).join("")
      : "";
  const changedLabel =
    job.mode === "edit"
      ? `<text x="88" y="580" font-size="24" fill="#d8b8c8">changed files</text>`
      : "";
  const summarySection = summaryLines
    .map((line, index) => `<text x="88" y="${364 + index * 42}" font-size="30" fill="#f2ede7">${escapeXml(line)}</text>`)
    .join("");

  const svg = `
    <svg width="1400" height="900" viewBox="0 0 1400 900" xmlns="http://www.w3.org/2000/svg">
      <rect width="1400" height="900" fill="#111214"/>
      <rect x="36" y="36" width="1328" height="828" rx="32" fill="#17191d" stroke="#444c56" stroke-width="2"/>
      <text x="88" y="122" font-size="42" font-weight="700" fill="#d8b8c8">veremote</text>
      <text x="88" y="178" font-size="22" fill="#96b8b1">workspace ${escapeXml(workspaceName)}  •  engine ${escapeXml(job.engine)}  •  mode ${escapeXml(job.mode)}</text>
      <text x="88" y="250" font-size="54" font-weight="700" fill="#f8f4ef">${escapeXml(job.title)}</text>
      <text x="88" y="305" font-size="26" fill="${accent}">status ${escapeXml(job.status)}</text>
      <text x="88" y="328" font-size="24" fill="#d8b8c8">summary</text>
      ${summarySection}
      ${changedLabel}
      ${changedSection}
      <text x="88" y="810" font-size="22" fill="#8b949e">job ${escapeXml(job.id)}</text>
      <text x="88" y="844" font-size="20" fill="#6e7681">${escapeXml(job.previewImagePath || previewPath)}</text>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(previewPath);
  return previewPath;
}

async function generateBestPreviewImage(job, logStream) {
  const pencilJob = isPencilJob(job);
  const changedFiles = Array.isArray(job.changedFiles) ? job.changedFiles : [];

  if (pencilJob) {
    const sourcePath = resolvePencilExportImage(job, changedFiles);

    if (!sourcePath) {
      throw new Error("Pencil 작업의 실제 export PNG를 찾지 못했습니다.");
    }

    appendLine(logStream, `[worker] using pencil export image: ${sourcePath}`);
    return generatePreviewFromImageFile(sourcePath);
  }

  const configuredImagePath = resolveWorkspaceAssetPath(
    process.env.WORKSPACE_PREVIEW_IMAGE_PATH,
  );

  if (configuredImagePath) {
    if (fs.existsSync(configuredImagePath)) {
      appendLine(logStream, `[worker] using configured preview image: ${configuredImagePath}`);
      return generatePreviewFromImageFile(configuredImagePath);
    }

    appendLine(logStream, `[worker] configured preview image missing: ${configuredImagePath}`);
  }

  const configuredPreviewUrl =
    (process.env.WORKSPACE_PREVIEW_URL && process.env.WORKSPACE_PREVIEW_URL.trim()) || null;

  if (configuredPreviewUrl) {
    try {
      appendLine(logStream, `[worker] capturing preview url: ${configuredPreviewUrl}`);
      return await generatePreviewFromUrl(configuredPreviewUrl);
    } catch (error) {
      appendLine(
        logStream,
        `[worker] preview url capture failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  appendLine(logStream, "[worker] falling back to summary preview image");
  return generatePreviewImage(job);
}

function buildTelegramText(job) {
  const lines = [
    getStatusHeadline(job),
    `제목: ${job.title}`,
    `엔진: ${job.engine}`,
    `상태: ${job.status}`,
  ];

  if (
    (job.status === "success" ||
      job.status === "partial" ||
      job.status === "export_failed") &&
    job.resultSummary
  ) {
    lines.push(`요약: ${job.resultSummary}`);
  }

  if (job.mode === "edit") {
    const changedFiles = Array.isArray(job.changedFiles) ? job.changedFiles : [];
    lines.push(
      `변경 파일: ${changedFiles.length > 0 ? changedFiles.join(", ") : "없음"}`,
    );
  }

  if (FAILURE_LIKE_STATUSES.has(job.status) && job.errorMessage) {
    lines.push(`에러: ${job.errorMessage}`);
  }

  if (job.previewImagePath) {
    lines.push(`PNG: ${job.previewImagePath}`);
  }

  const detailUrl = buildJobDetailUrl(job.id);

  if (detailUrl) {
    lines.push(`상세: ${detailUrl}`);
  }

  return lines.join("\n");
}

async function sendTelegramPhoto(token, chatId, photoPath, caption) {
  const formData = new FormData();
  formData.set("chat_id", chatId);
  formData.set("caption", caption.slice(0, 900));
  formData.set(
    "photo",
    new Blob([fs.readFileSync(photoPath)]),
    path.basename(photoPath),
  );

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(
      payload.description || `Telegram API request failed with status ${response.status}.`,
    );
  }

  return payload.result;
}

async function sendTelegramText(token, chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(
      payload.description || `Telegram API request failed with status ${response.status}.`,
    );
  }

  return payload.result;
}

async function sendTelegramProgress(job, stage, extraLines = []) {
  const token = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_CHAT_ID.trim();

  if (!token || !chatId) {
    return null;
  }

  return sendTelegramText(
    token,
    chatId,
    [
      "[Pencil] 진행 상황",
      `단계: ${stage}`,
      `작업: ${job.id}`,
      `제목: ${job.title}`,
      `엔진: ${job.engine}`,
      ...extraLines,
    ].join("\n"),
  );
}

async function sendTelegramNotification(job, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_CHAT_ID.trim();
  const sentAt = new Date().toISOString();
  const requirePreview = Boolean(options.requirePreview);
  const forceText = Boolean(options.forceText);

  if (!token || !chatId) {
    return {
      sentAt,
      status: "failed",
      errorMessage:
        "TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 환경변수가 설정되지 않았습니다.",
    };
  }

  try {
    const text = buildTelegramText(job);

    if (!forceText && job.previewImagePath && fs.existsSync(job.previewImagePath)) {
      const payload = await sendTelegramPhoto(token, chatId, job.previewImagePath, text);
      return {
        sentAt,
        status: "sent",
        messageId: String(payload.message_id),
        errorMessage: null,
      };
    }

    if (requirePreview) {
      return {
        sentAt,
        status: "failed",
        errorMessage: "실제 PNG가 없어 이미지 전송을 완료하지 못했습니다.",
      };
    }

    const payload = await sendTelegramText(token, chatId, text);

    return {
      sentAt,
      status: "sent",
      messageId: String(payload.message_id),
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
  const pencilJob = isPencilJob(job);

  if (pencilJob) {
    await sendTelegramProgress(job, "작업 시작", [
      `workspace: ${job.workspacePath || workspacePath}`,
    ]).catch(() => null);
    await sendTelegramProgress(job, "수정 중", [
      `mode: ${job.mode}`,
    ]).catch(() => null);
  }

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
  let cleanedUp = false;

  function finalize() {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    logStream.end();
    db.close();
  }

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
        finalize();
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
    Promise.resolve()
      .then(() => {
        if (!pencilJob) {
          return null;
        }

        return sendTelegramProgress(successfulJob, "export 중");
      })
      .then(() => generateBestPreviewImage({ ...successfulJob, changedFiles }, logStream))
      .then((previewImagePath) => {
        setPreviewImagePath(db, previewImagePath);
        appendLine(logStream, `[worker] preview image saved: ${previewImagePath}`);
        return mapJob(getJob(db));
      })
      .then((jobWithPreview) => {
        if (!pencilJob) {
          return sendTelegramNotification(jobWithPreview);
        }

        return sendTelegramProgress(jobWithPreview, "이미지 전송 중", [
          `png: ${jobWithPreview.previewImagePath}`,
        ])
          .catch(() => null)
          .then(() => sendTelegramNotification(jobWithPreview, { requirePreview: true }));
      })
      .then((result) => {
        if (pencilJob && result.status === "failed") {
          updateTerminalStatus(
            db,
            "partial",
            logPath,
            successfulJob.resultSummary || summary,
            result.errorMessage || "실제 PNG 전송에 실패했습니다.",
            changedFiles,
          );

          return sendTelegramNotification(mapJob(getJob(db)), { forceText: true })
            .then((fallbackResult) => {
              insertNotificationLog(db, {
                jobId,
                sentAt: fallbackResult.sentAt,
                status: fallbackResult.status,
                messageId: fallbackResult.messageId,
                errorMessage: fallbackResult.errorMessage,
              });
            });
        }

        insertNotificationLog(db, {
          jobId,
          sentAt: result.sentAt,
          status: result.status,
          messageId: result.messageId,
          errorMessage: result.errorMessage,
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        appendLine(logStream, `[worker] preview pipeline failed: ${message}`);

        if (pencilJob) {
          updateTerminalStatus(
            db,
            "export_failed",
            logPath,
            successfulJob.resultSummary || summary,
            message,
            changedFiles,
          );

          return sendTelegramNotification(mapJob(getJob(db)))
            .then((result) => {
              insertNotificationLog(db, {
                jobId,
                sentAt: result.sentAt,
                status: result.status,
                messageId: result.messageId,
                errorMessage: result.errorMessage,
              });
            });
        }

        updateFailure(db, logPath, message, changedFiles);
        return sendTelegramNotification(mapJob(getJob(db)))
          .then((result) => {
            insertNotificationLog(db, {
              jobId,
              sentAt: result.sentAt,
              status: result.status,
              messageId: result.messageId,
              errorMessage: result.errorMessage,
            });
          });
      })
      .finally(() => {
        finalize();
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
