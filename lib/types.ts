export type JobStatus = "queued" | "running" | "success" | "failed";
export type NotificationChannelType = "telegram";
export type NotificationStatus = "sent" | "failed";
export type JobMode = "run" | "edit";

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
  mode: JobMode;
  prompt: string;
  workspacePath: string | null;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  resultSummary: string | null;
  changedFiles: string[];
  previewImagePath: string | null;
  logPath: string | null;
  errorMessage: string | null;
}

export interface NotificationLog {
  id: string;
  jobId: string;
  channelType: NotificationChannelType;
  sentAt: string;
  status: NotificationStatus;
  messageId: string | null;
  errorMessage: string | null;
}

export interface ActiveWorkspace {
  id: string;
  path: string;
  name: string;
  engine: EngineId;
  isActive: boolean;
  connectedAt: string;
  lastHeartbeatAt: string | null;
  chatId: string | null;
}
