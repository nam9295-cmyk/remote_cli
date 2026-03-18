# Task 04 — Edit Mode for Remote Vibe Coding

## 목표
텔레그램에서 `/edit <prompt>` 명령으로 현재 active workspace의 파일 수정 작업을 수행할 수 있게 한다.

## 구현할 것
- `/edit <prompt>` 명령 추가
- Job.mode = edit 저장
- worker 실행 시 edit 모드 전달
- 수정 결과 요약 저장
- 변경 파일 목록 저장
- 텔레그램 완료 메시지에 변경 파일 목록 포함

## 안전장치
- active workspace 없으면 거부
- 허용된 chat id만 허용
- prompt가 너무 짧거나 애매하면 경고 가능
- 필요한 경우 기본적으로 "변경 파일과 요약을 알려줘"를 내부적으로 덧붙여도 됨

## 완료 기준
- `/edit ...` 입력 시 실제 수정 작업이 돌아야 함
- 작업 완료 후 변경 파일 목록이 결과에 포함되어야 함
- 실패 시 errorMessage와 로그를 확인할 수 있어야 함

## 코덱스 실행 프롬프트
```text
project_plan_cli.md와 tasks/04_edit_mode.md를 읽고 텔레그램 원격 수정 모드를 구현해줘.
`/edit <prompt>`가 현재 active workspace 기준으로 실행되게 하고, 작업 완료 시 변경 파일 목록과 요약을 텔레그램으로 보내줘.
Job에 mode와 changedFiles를 저장하는 구조도 추가해줘.
변경 파일 목록과 테스트 방법을 정리해줘.
```
