import { ENGINES } from "@/lib/engines";
import type { EngineId } from "@/lib/types";

export interface CreateJobFormValues {
  title: string;
  engine: string;
  prompt: string;
}

export interface JobFormState {
  fields: CreateJobFormValues;
  errors: Partial<Record<keyof CreateJobFormValues, string>>;
  formError?: string;
  revision: string;
}

export const INITIAL_JOB_FORM_STATE: JobFormState = {
  fields: {
    title: "",
    engine: "codex",
    prompt: "",
  },
  errors: {},
  revision: "initial",
};

export function getCreateJobFormValues(formData: FormData): CreateJobFormValues {
  return {
    title: String(formData.get("title") ?? ""),
    engine: String(formData.get("engine") ?? ""),
    prompt: String(formData.get("prompt") ?? ""),
  };
}

export function validateCreateJobInput(values: CreateJobFormValues) {
  const fields: CreateJobFormValues = {
    title: values.title.trim(),
    engine: values.engine.trim(),
    prompt: values.prompt.trim(),
  };

  const errors: JobFormState["errors"] = {};

  if (!fields.title) {
    errors.title = "작업 제목은 필수입니다.";
  } else if (fields.title.length > 120) {
    errors.title = "작업 제목은 120자 이내로 입력하세요.";
  }

  if (!fields.engine) {
    errors.engine = "엔진을 선택하세요.";
  } else if (!ENGINES.some((engine) => engine.id === fields.engine)) {
    errors.engine = "지원하지 않는 엔진입니다.";
  }

  if (!fields.prompt) {
    errors.prompt = "프롬프트는 필수입니다.";
  } else if (fields.prompt.length > 5000) {
    errors.prompt = "프롬프트는 5000자 이내로 입력하세요.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false as const,
      state: {
        fields,
        errors,
        revision: crypto.randomUUID(),
      },
    };
  }

  return {
    success: true as const,
    data: {
      title: fields.title,
      engine: fields.engine as EngineId,
      prompt: fields.prompt,
    },
  };
}
