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
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  resultSummary: string;
  prompt: string;
  workdir: string;
  tags: string[];
  logExcerpt: string[];
}
