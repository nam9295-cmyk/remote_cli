#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const jobId = process.argv[2];
const databasePath = path.join(process.cwd(), "data", "remote-cli.sqlite");
const mockEngineScriptPath = path.join(process.cwd(), "scripts", "mock-engine.cjs");

if (!jobId) {
  process.exit(1);
}

function getEngineConfig(engineId) {
  const configs = {
    gemini: {
      command: process.env.GEMINI_CLI_COMMAND || process.execPath,
      buildArgs(prompt) {
        return process.env.GEMINI_CLI_COMMAND
          ? [jobId, prompt]
          : [mockEngineScriptPath, "gemini", jobId, prompt];
      },
    },
    codex: {
      command: process.env.CODEX_CLI_COMMAND || process.execPath,
      buildArgs(prompt) {
        return process.env.CODEX_CLI_COMMAND
          ? [jobId, prompt]
          : [mockEngineScriptPath, "codex", jobId, prompt];
      },
    },
    custom: {
      command: process.env.CUSTOM_CLI_COMMAND || process.execPath,
      buildArgs(prompt) {
        return process.env.CUSTOM_CLI_COMMAND
          ? [jobId, prompt]
          : [mockEngineScriptPath, "custom", jobId, prompt];
      },
    },
  };

  return configs[engineId];
}

function openDb() {
  return new DatabaseSync(databasePath);
}

function getJob(db) {
  return db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
}

function updateSuccess(db, logPath, summary) {
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
  `).run(now, now, summary, logPath, jobId);
}

function updateFailure(db, logPath, message) {
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
  `).run(now, now, "작업 실행 중 오류가 발생했습니다.", logPath, message, jobId);
}

function appendLine(stream, line) {
  stream.write(`${line}\n`);
}

async function main() {
  const db = openDb();
  const job = getJob(db);

  if (!job) {
    process.exit(1);
  }

  const engine = getEngineConfig(job.engine);

  if (!engine) {
    updateFailure(db, job.log_path, `Unsupported engine: ${job.engine}`);
    process.exit(1);
  }

  const logPath = job.log_path || path.join(process.cwd(), "data", "logs", `${jobId}.log`);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  appendLine(logStream, `[${new Date().toISOString()}] starting ${job.engine} runner`);

  const child = spawn(engine.command, engine.buildArgs(job.prompt), {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let lastStdoutLine = "";
  let stderrLines = [];
  let settled = false;

  function settleFailure(message) {
    if (settled) {
      return;
    }

    settled = true;
    updateFailure(db, logPath, message);
    logStream.end();
    db.close();
  }

  function settleSuccess(summary, code) {
    if (settled) {
      return;
    }

    settled = true;
    appendLine(logStream, `[worker] process completed with exit code ${code}`);
    updateSuccess(db, logPath, summary);
    logStream.end();
    db.close();
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
  updateFailure(db, null, message);
  db.close();
  process.exit(1);
});
