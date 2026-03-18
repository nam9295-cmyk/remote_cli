# Task 03 — Telegram Workspace Commands

## 목표
텔레그램 명령이 active workspace를 기준으로 동작하도록 바꾼다.

## 구현할 것
- `/where` 명령 추가
- `/help` 갱신
- `/status`, `/last`는 유지
- `/run <prompt>` 는 active workspace 기준 실행
- active workspace가 없으면 안내 메시지 반환
- 허용 chat id만 처리 유지

## `/where` 응답 예시
- 현재 프로젝트명
- 현재 경로
- 현재 엔진
- 상태(active/inactive)
- 마지막 활성 시간

## `/run`
- 별도 프로젝트 key 없이 현재 active workspace 기준으로 Job 생성
- mode는 run
- 파일 수정 금지 기본 문구를 내부적으로 보강해도 됨

## 완료 기준
- 텔레그램에서 `/where` 입력 시 현재 연결된 폴더가 보여야 함
- `/run ...` 입력 시 active workspace 기준으로 작업이 생성/실행되어야 함
- active workspace가 없으면 친절한 오류 메시지가 와야 함

## 코덱스 실행 프롬프트
```text
project_plan_cli.md와 tasks/03_telegram_workspace_commands.md를 읽고 텔레그램 명령을 active workspace 기준으로 전환해줘.
`/where`를 추가하고, `/run <prompt>`가 현재 active workspace 경로에서 실행되게 해줘.
active workspace가 없으면 실행하지 말고 안내 메시지를 보내줘.
변경 파일 목록과 테스트 방법을 정리해줘.
```
