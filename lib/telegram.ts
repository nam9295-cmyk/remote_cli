import type { Job } from "@/lib/types";

interface TelegramNotificationResult {
  ok: boolean;
  messageId?: string;
  errorMessage?: string;
}

function getJobDetailUrl(jobId: string) {
  const baseUrl = process.env.PUBLIC_BASE_URL?.trim();

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, "")}/jobs/${jobId}`;
}

function buildTelegramText(job: Job) {
  const lines = [
    job.status === "success" ? "[Remote CLI] 작업 완료" : "[Remote CLI] 작업 실패",
    `제목: ${job.title}`,
    `엔진: ${job.engine}`,
    `상태: ${job.status}`,
  ];

  if (job.status === "success" && job.resultSummary) {
    lines.push(`요약: ${job.resultSummary}`);
  }

  if (job.mode === "edit") {
    lines.push(
      `변경 파일: ${job.changedFiles.length > 0 ? job.changedFiles.join(", ") : "없음"}`,
    );
  }

  if (job.status === "failed" && job.errorMessage) {
    lines.push(`에러: ${job.errorMessage}`);
  }

  const detailUrl = getJobDetailUrl(job.id);

  if (detailUrl) {
    lines.push(`상세: ${detailUrl}`);
  }

  return lines.join("\n");
}

export async function sendTelegramJobNotification(
  job: Job,
): Promise<TelegramNotificationResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return {
      ok: false,
      errorMessage:
        "TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 환경변수가 설정되지 않았습니다.",
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramText(job),
      disable_web_page_preview: true,
    }),
  });

  const payload = (await response.json()) as
    | {
        ok: true;
        result: {
          message_id: number | string;
        };
      }
    | {
        ok: false;
        description?: string;
      };

  if (!response.ok || !payload.ok) {
    return {
      ok: false,
      errorMessage:
        "description" in payload && payload.description
          ? payload.description
          : `Telegram API request failed with status ${response.status}.`,
    };
  }

  return {
    ok: true,
    messageId: String(payload.result.message_id),
  };
}
