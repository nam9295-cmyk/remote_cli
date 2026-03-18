"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { launchJobRunner } from "@/lib/job-runner";
import { createLogPath, getJobById, markJobAsFailed, markJobAsRunning } from "@/lib/jobs";

export async function runJobAction(jobId: string) {
  const job = getJobById(jobId);

  if (!job) {
    redirect("/jobs");
  }

  if (job.status === "running") {
    redirect(`/jobs/${jobId}`);
  }

  const logPath = createLogPath(jobId);

  try {
    markJobAsRunning(jobId, logPath);
    launchJobRunner(jobId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Runner launch failed.";

    markJobAsFailed(jobId, message, logPath);
  }

  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}`);
}
