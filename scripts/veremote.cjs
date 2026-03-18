#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const APP_ROOT = process.env.VEREMOTE_APP_ROOT || path.resolve(__dirname, "..");
const DATABASE_PATH = path.join(APP_ROOT, "data", "remote-cli.sqlite");
const CURRENT_CWD = process.cwd();
const DEFAULT_ENGINE = "gemini";
const ALLOWED_ENGINES = new Set(["gemini", "codex", "custom"]);
const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_CHAT_ID.trim();

const LOGO = [
  "veremote",
  "========",
  "remote control for your current workspace",
];

function ensureDb() {
  fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

  const db = new DatabaseSync(DATABASE_PATH);
  db.exec(`
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
  `);

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

function connectWorkspace(db) {
  const now = new Date().toISOString();
  const existing = getActiveWorkspace(db);

  db.prepare(`
    INSERT INTO active_workspace (
      id,
      path,
      name,
      engine,
      is_active,
      connected_at,
      last_heartbeat_at,
      chat_id
    )
    VALUES ('main', ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      path = excluded.path,
      name = excluded.name,
      engine = excluded.engine,
      is_active = excluded.is_active,
      connected_at = excluded.connected_at,
      last_heartbeat_at = excluded.last_heartbeat_at,
      chat_id = excluded.chat_id
  `).run(
    CURRENT_CWD,
    getWorkspaceName(CURRENT_CWD),
    DEFAULT_ENGINE,
    now,
    now,
    TELEGRAM_CHAT_ID || null,
  );

  return {
    workspace: getActiveWorkspace(db),
    replacedPath:
      existing && existing.path !== CURRENT_CWD ? existing.path : null,
  };
}

function disconnectWorkspace(db) {
  const existing = getActiveWorkspace(db);
  db.prepare("DELETE FROM active_workspace WHERE id = 'main'").run();
  return existing;
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

function printHeader() {
  for (const line of LOGO) {
    console.log(line);
  }
  console.log("");
}

function printMessage(message) {
  console.log(message);
  console.log("");
}

function printStatus(workspace) {
  const isConnected = Boolean(workspace && workspace.is_active);
  const relation = !workspace
    ? "-"
    : workspace.path === CURRENT_CWD
      ? "current cwd is active"
      : "different folder is active";

  const rows = [
    ["Current cwd", CURRENT_CWD],
    ["Default engine", DEFAULT_ENGINE],
    ["Connected", isConnected ? "yes" : "no"],
    ["Relation", relation],
    ["Active path", workspace ? workspace.path : "-"],
    ["Active name", workspace ? workspace.name : "-"],
    ["Active engine", workspace ? workspace.engine : DEFAULT_ENGINE],
    ["Connected at", workspace ? formatTimestamp(workspace.connected_at) : "-"],
    [
      "Heartbeat",
      workspace ? formatTimestamp(workspace.last_heartbeat_at) : "-",
    ],
  ];

  if (workspace && workspace.chat_id) {
    rows.push(["Telegram chat", workspace.chat_id]);
  }

  console.log("Workspace Status");
  console.log("----------------");

  for (const [label, value] of rows) {
    console.log(`${label.padEnd(14)} ${value}`);
  }

  console.log("");
}

function printUsage() {
  console.log("Usage");
  console.log("-----");
  console.log("veremote");
  console.log("veremote connect");
  console.log("veremote status");
  console.log("veremote disconnect");
  console.log("");
}

function assertDefaultEngine() {
  if (!ALLOWED_ENGINES.has(DEFAULT_ENGINE)) {
    console.error(`Unsupported default engine: ${DEFAULT_ENGINE}`);
    process.exit(1);
  }
}

function main() {
  assertDefaultEngine();

  const command = process.argv[2] || "connect";
  const db = ensureDb();

  printHeader();

  if (command === "connect") {
    const result = connectWorkspace(db);
    printMessage("Connected current folder as the active workspace.");

    if (result.replacedPath) {
      printMessage(`Replaced previous workspace: ${result.replacedPath}`);
    }

    printStatus(result.workspace);
    return;
  }

  if (command === "status") {
    const workspace = getActiveWorkspace(db);
    printMessage(
      workspace
        ? "Active workspace is available."
        : "No active workspace is connected yet.",
    );
    printStatus(workspace);
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
    return;
  }

  if (command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.log("");
  printUsage();
  process.exit(1);
}

main();
