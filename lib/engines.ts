import path from "node:path";
import type { EngineId, EngineOption } from "@/lib/types";

export interface EngineConfig extends EngineOption {
  command: string;
  buildArgs: (input: { jobId: string; prompt: string }) => string[];
  enabled: boolean;
}

const mockEngineScriptPath = path.join(process.cwd(), "scripts", "mock-engine.cjs");

function splitCommandString(command: string) {
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}

function resolveRuntimeCommand(commandFromEnv: string | undefined) {
  if (!commandFromEnv?.trim()) {
    return null;
  }

  const [command, ...baseArgs] = splitCommandString(commandFromEnv.trim());

  if (!command) {
    return null;
  }

  return { command, baseArgs };
}

const geminiRuntimeCommand = resolveRuntimeCommand(process.env.GEMINI_CLI_COMMAND);
const codexRuntimeCommand = resolveRuntimeCommand(process.env.CODEX_CLI_COMMAND);
const customRuntimeCommand = resolveRuntimeCommand(process.env.CUSTOM_CLI_COMMAND);

export const ENGINE_CONFIGS: Record<EngineId, EngineConfig> = {
  gemini: {
    id: "gemini",
    name: "Gemini CLI",
    description: "빠른 초안, 요약, 리서치 업무에 적합한 기본 엔진",
    commandPreview: "node scripts/mock-engine.cjs gemini <job-id> <prompt>",
    command: geminiRuntimeCommand?.command || process.execPath,
    buildArgs: ({ jobId, prompt }) =>
      geminiRuntimeCommand
        ? [...geminiRuntimeCommand.baseArgs, "-p", prompt]
        : [mockEngineScriptPath, "gemini", jobId, prompt],
    enabled: true,
  },
  codex: {
    id: "codex",
    name: "Codex CLI",
    description: "코드 생성과 수정, 프로젝트 자동화에 적합한 엔진",
    commandPreview: "node scripts/mock-engine.cjs codex <job-id> <prompt>",
    command: codexRuntimeCommand?.command || process.execPath,
    buildArgs: ({ jobId, prompt }) =>
      codexRuntimeCommand
        ? [...codexRuntimeCommand.baseArgs, "exec", "--full-auto", prompt]
        : [mockEngineScriptPath, "codex", jobId, prompt],
    enabled: true,
  },
  custom: {
    id: "custom",
    name: "Custom Runner",
    description: "사내 스크립트나 워크플로를 붙일 수 있는 확장 슬롯",
    commandPreview: "node scripts/mock-engine.cjs custom <job-id> <prompt>",
    command: customRuntimeCommand?.command || process.execPath,
    buildArgs: ({ jobId, prompt }) =>
      customRuntimeCommand
        ? [...customRuntimeCommand.baseArgs, jobId, prompt]
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
