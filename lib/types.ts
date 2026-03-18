export type JobStatus = "queued" | "running" | "success" | "failed";

export type EngineId = "gemini" | "codex" | "custom";

export interface EngineOption {
  id: EngineId;
  name: string;
  commandPreview: string;
  description: string;
}

export interface Job {
  id: string;
  title: string;
  engine: EngineId;
  prompt: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  resultSummary: string | null;
  previewImagePath: string | null;
  logPath: string | null;
  errorMessage: string | null;
}
