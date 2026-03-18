"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createJob } from "@/lib/jobs";
import {
  getCreateJobFormValues,
  validateCreateJobInput,
  type JobFormState,
} from "@/lib/validators";

export async function createJobAction(
  _previousState: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const values = getCreateJobFormValues(formData);
  const validation = validateCreateJobInput(values);

  if (!validation.success) {
    return validation.state;
  }

  const job = createJob(validation.data);

  revalidatePath("/");
  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}`);
}
