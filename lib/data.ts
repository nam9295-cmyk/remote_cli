import type { EngineOption, Job, JobStatus } from "@/lib/types";

export const ENGINES: EngineOption[] = [
  {
    id: "gemini",
    name: "Gemini CLI",
    commandPreview: "gemini run --prompt <text>",
    description: "빠른 초안, 요약, 리서치 업무에 적합한 기본 엔진",
  },
  {
    id: "codex",
    name: "Codex CLI",
    commandPreview: "codex run --model gpt-5.4 <prompt>",
    description: "코드 생성과 수정, 프로젝트 자동화에 적합한 엔진",
  },
  {
    id: "custom",
    name: "Custom Runner",
    commandPreview: "./scripts/custom-runner.sh <job-id>",
    description: "사내 스크립트나 워크플로를 붙일 수 있는 확장 슬롯",
  },
];

export const jobs: Job[] = [
  {
    id: "job-2410",
    title: "랜딩 페이지 카피 초안 정리",
    engine: "gemini",
    status: "success",
    createdAt: "2026-03-17T08:00:00+09:00",
    updatedAt: "2026-03-17T08:14:00+09:00",
    resultSummary:
      "대표 검토용 3가지 카피 방향과 핵심 메시지 구조를 초안으로 정리했다.",
    prompt:
      "우리 서비스의 신규 방문자를 위한 랜딩 페이지 카피를 3가지 톤으로 제안하고, 각 톤에 맞는 Hero/Problem/Solution 섹션 문구까지 정리해줘.",
    workdir: "/Users/nam9295/Desktop/john_2.0/marketing",
    tags: ["copy", "landing"],
    logExcerpt: [
      "[08:00] job created",
      "[08:02] prompt compiled",
      "[08:12] summary generated",
      "[08:14] result saved",
    ],
  },
  {
    id: "job-2411",
    title: "관리자 페이지 반응형 QA 체크",
    engine: "codex",
    status: "running",
    createdAt: "2026-03-17T11:05:00+09:00",
    updatedAt: "2026-03-18T09:10:00+09:00",
    resultSummary:
      "모바일 뷰에서 카드 간격과 버튼 우선순위를 다시 점검하는 중이다.",
    prompt:
      "현재 관리자 페이지를 모바일 기준으로 다시 보고, 카드 간격, 버튼 우선순위, 헤더 고정 동작에 대한 수정안을 정리해줘.",
    workdir: "/Users/nam9295/Desktop/john_2.0/code/admin-web",
    tags: ["qa", "mobile", "ui"],
    logExcerpt: [
      "[11:05] job queued",
      "[11:07] repository indexed",
      "[09:04] responsive audit started",
      "[09:10] report still running",
    ],
  },
  {
    id: "job-2412",
    title: "고객 인터뷰 요약과 액션 아이템 추출",
    engine: "gemini",
    status: "queued",
    createdAt: "2026-03-18T07:35:00+09:00",
    updatedAt: "2026-03-18T07:35:00+09:00",
    resultSummary:
      "업로드 대기 중이며 실행이 시작되면 인터뷰 핵심 인사이트를 묶어낼 예정이다.",
    prompt:
      "고객 인터뷰 8건의 메모를 읽고 공통 pain point, 구매 저항, 제품 개선 아이디어를 표 형식으로 요약해줘.",
    workdir: "/Users/nam9295/Desktop/john_2.0/research",
    tags: ["research", "interview"],
    logExcerpt: ["[07:35] job queued", "[07:35] waiting for runner"],
  },
  {
    id: "job-2413",
    title: "주간 운영 리포트 자동화 시도",
    engine: "custom",
    status: "failed",
    createdAt: "2026-03-16T18:25:00+09:00",
    updatedAt: "2026-03-16T18:40:00+09:00",
    resultSummary:
      "리포트 CSV 경로를 찾지 못해 실패했다. 데이터 소스 매핑이 필요한 상태다.",
    prompt:
      "금주 운영 지표 CSV와 에러 로그를 읽고 주간 운영 리포트를 생성한 뒤 텔레그램 전송 포맷까지 맞춰줘.",
    workdir: "/Users/nam9295/Desktop/john_2.0/ops",
    tags: ["ops", "report"],
    logExcerpt: [
      "[18:25] custom runner started",
      "[18:31] loading metrics.csv",
      "[18:34] file not found: reports/metrics.csv",
      "[18:40] job failed",
    ],
  },
  {
    id: "job-2414",
    title: "신규 기능 PR 설명문 초안 생성",
    engine: "codex",
    status: "success",
    createdAt: "2026-03-15T15:20:00+09:00",
    updatedAt: "2026-03-15T15:29:00+09:00",
    resultSummary:
      "PR 설명문, QA 체크리스트, 릴리스 노트 초안을 한 세트로 생성했다.",
    prompt:
      "최근 변경 파일을 기준으로 PR 설명문과 QA 체크리스트, 짧은 릴리스 노트를 각각 작성해줘.",
    workdir: "/Users/nam9295/Desktop/john_2.0/code/mobile-web",
    tags: ["pr", "release"],
    logExcerpt: [
      "[15:20] diff collected",
      "[15:23] release note draft ready",
      "[15:29] output stored",
    ],
  },
];

export function getAllJobs() {
  return [...jobs].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function getRecentJobs(limit = 3) {
  return getAllJobs().slice(0, limit);
}

export function getJobById(id: string) {
  return jobs.find((job) => job.id === id);
}

export function getStatusCount(status: JobStatus) {
  return jobs.filter((job) => job.status === status).length;
}
