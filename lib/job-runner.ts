import { spawn } from "node:child_process";
import path from "node:path";

export function launchJobRunner(jobId: string) {
  const workerPath = path.join(process.cwd(), "scripts", "run-job-worker.cjs");

  const child = spawn(process.execPath, [workerPath, jobId], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });

  child.unref();
}
