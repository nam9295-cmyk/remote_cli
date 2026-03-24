/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const PREVIEW_TYPES = new Set(["web_url", "image_file", "pencil_export"]);

function normalizeAbsolutePath(targetPath) {
  if (!targetPath || !String(targetPath).trim()) {
    return null;
  }

  return path.resolve(String(targetPath).trim());
}

function getRealPathIfExists(targetPath) {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return null;
  }
}

function isPathInside(rootPath, targetPath) {
  const normalizedRoot = normalizeAbsolutePath(rootPath);
  const normalizedTarget = normalizeAbsolutePath(targetPath);

  if (!normalizedRoot || !normalizedTarget) {
    return false;
  }

  const relative = path.relative(normalizedRoot, normalizedTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isExistingDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function parseAllowedPreviewRoots(workspacePath, rawValue) {
  const values = String(rawValue || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values
    .map((value) => (path.isAbsolute(value) ? value : path.join(workspacePath, value)))
    .map((value) => normalizeAbsolutePath(value))
    .filter(Boolean);
}

function normalizePreviewType(rawType) {
  const value = String(rawType || "").trim().toLowerCase();

  if (!value || value === "none" || value === "clear" || value === "off") {
    return null;
  }

  if (value === "url" || value === "web") {
    return "web_url";
  }

  if (value === "image" || value === "file") {
    return "image_file";
  }

  if (value === "pencil" || value === "export") {
    return "pencil_export";
  }

  if (PREVIEW_TYPES.has(value)) {
    return value;
  }

  return null;
}

function resolveAllowedPreviewPath(workspacePath, assetPath, allowedRoots = []) {
  if (!assetPath || !String(assetPath).trim()) {
    return {
      ok: true,
      path: null,
    };
  }

  const rawValue = String(assetPath).trim();
  const candidatePath = normalizeAbsolutePath(
    path.isAbsolute(rawValue) ? rawValue : path.join(workspacePath, rawValue),
  );

  if (!candidatePath) {
    return {
      ok: false,
      path: null,
      error: "미리보기 경로를 해석하지 못했습니다.",
    };
  }

  const rootCandidates = [normalizeAbsolutePath(workspacePath), ...allowedRoots].filter(Boolean);
  const lexicalAllowed = rootCandidates.some((rootPath) => isPathInside(rootPath, candidatePath));
  const realCandidatePath = getRealPathIfExists(candidatePath);
  const realAllowed = realCandidatePath
    ? rootCandidates
        .map((rootPath) => getRealPathIfExists(rootPath) || rootPath)
        .some((rootPath) => isPathInside(rootPath, realCandidatePath))
    : lexicalAllowed;

  if (!lexicalAllowed || !realAllowed) {
    return {
      ok: false,
      path: candidatePath,
      error: "workspace 밖 preview/image 경로는 허용되지 않습니다.",
    };
  }

  return {
    ok: true,
    path: realCandidatePath || candidatePath,
  };
}

function readPidFile(pidFilePath) {
  try {
    const raw = fs.readFileSync(pidFilePath, "utf8").trim();

    if (!raw) {
      return null;
    }

    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      return {
        pid: Number(parsed.pid),
        script: parsed.script || null,
        appRoot: parsed.appRoot || null,
        startedAt: parsed.startedAt || null,
      };
    }

    return {
      pid: Number(raw),
      script: null,
      appRoot: null,
      startedAt: null,
    };
  } catch {
    return null;
  }
}

function writePidFile(pidFilePath, metadata) {
  fs.mkdirSync(path.dirname(pidFilePath), { recursive: true });
  fs.writeFileSync(
    pidFilePath,
    JSON.stringify(
      {
        pid: metadata.pid,
        script: metadata.script || null,
        appRoot: metadata.appRoot || null,
        startedAt: metadata.startedAt || new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
}

function removePidFile(pidFilePath) {
  fs.rmSync(pidFilePath, { force: true });
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getProcessCommand(pid) {
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function getRunningDaemonPid(pidFilePath, expectedScriptPath) {
  const metadata = readPidFile(pidFilePath);

  if (!metadata || !Number.isInteger(metadata.pid) || metadata.pid <= 0) {
    removePidFile(pidFilePath);
    return null;
  }

  if (!isProcessAlive(metadata.pid)) {
    removePidFile(pidFilePath);
    return null;
  }

  const command = getProcessCommand(metadata.pid);
  const expectedScriptName = path.basename(expectedScriptPath);

  if (command && !command.includes(expectedScriptName)) {
    removePidFile(pidFilePath);
    return null;
  }

  return metadata.pid;
}

function claimDaemonPidFile(pidFilePath, pid, expectedScriptPath, appRoot) {
  const existingPid = getRunningDaemonPid(pidFilePath, expectedScriptPath);

  if (existingPid && existingPid !== pid) {
    return {
      ok: false,
      pid: existingPid,
    };
  }

  writePidFile(pidFilePath, {
    pid,
    script: expectedScriptPath,
    appRoot,
  });

  return {
    ok: true,
    pid,
  };
}

module.exports = {
  claimDaemonPidFile,
  getRunningDaemonPid,
  isExistingDirectory,
  isPathInside,
  normalizePreviewType,
  normalizeAbsolutePath,
  parseAllowedPreviewRoots,
  removePidFile,
  resolveAllowedPreviewPath,
};
