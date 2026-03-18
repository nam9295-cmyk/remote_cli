import path from "node:path";
import type { EngineId, EngineOption } from "@/lib/types";

export interface EngineConfig extends EngineOption {
  command: string;
  buildArgs: (input: { jobId: string; prompt: string }) => string[];
  enabled: boolean;
}

const mockEngineScriptPath = path.join(process.cwd(), "scripts", "mock-engine.cjs");

export const ENGINE_CONFIGS: Record<EngineId, EngineConfig> = {
  gemini: {
    id: "gemini",
    name: "Gemini CLI",
    description: "빠른 초안, 요약, 리서치 업무에 적합한 기본 엔진",
    commandPreview: "node scripts/mock-engine.cjs gemini <job-id> <prompt>",
    command: process.env.GEMINI_CLI_COMMAND || process.execPath,
    buildArgs: ({ jobId, prompt }) =>
      process.env.GEMINI_CLI_COMMAND
        ? [jobId, prompt]
        : [mockEngineScriptPath, "gemini", jobId, prompt],
    enabled: true,
  },
  codex: {
    id: "codex",
    name: "Codex CLI",
    description: "코드 생성과 수정, 프로젝트 자동화에 적합한 엔진",
    commandPreview: "node scripts/mock-engine.cjs codex <job-id> <prompt>",
    command: process.env.CODEX_CLI_COMMAND || process.execPath,
    buildArgs: ({ jobId, prompt }) =>
      process.env.CODEX_CLI_COMMAND
        ? [jobId, prompt]
        : [mockEngineScriptPath, "codex", jobId, prompt],
    enabled: true,
  },
  custom: {
    id: "custom",
    name: "Custom Runner",
    description: "사내 스크립트나 워크플로를 붙일 수 있는 확장 슬롯",
    commandPreview: "node scripts/mock-engine.cjs custom <job-id> <prompt>",
    command: process.env.CUSTOM_CLI_COMMAND || process.execPath,
    buildArgs: ({ jobId, prompt }) =>
      process.env.CUSTOM_CLI_COMMAND
        ? [jobId, prompt]
        : [mockEngineScriptPath, "custom", jobId, prompt],
    enabled: true,
  },
};

export const ENGINES: EngineOption[] = Object.values(ENGINE_CONFIGS).map(
  ({ id, name, description, commandPreview }) => ({
    id,
    name,
    description,
    commandPreview,
  }),
);

export function getEngineConfig(engineId: EngineId) {
  return ENGINE_CONFIGS[engineId];
}
