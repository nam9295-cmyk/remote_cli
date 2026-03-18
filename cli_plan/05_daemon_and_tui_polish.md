# Task 05 — Daemon & CLI/TUI Polish

## 목표
텔레그램 polling과 veremote CLI를 더 자연스럽게 통합하고, 터미널 사용 경험을 다듬는다.

## 구현할 것
- `veremote daemon` 명령 추가
- 기존 telegram polling 스크립트를 daemon으로 흡수 또는 래핑
- 로고/색상/상태 출력 개선
- `veremote` 단독 실행 시 connect + 상태 출력 흐름 정리
- 향후 TUI 확장 가능한 구조로 정리

## UX 목표
- `veremote` 입력 시 베리굿 느낌 로고
- 현재 workspace/engine/status 표시
- 텔레그램 명령 사용 예시 표시
- daemon 실행 시 polling 상태 출력

## 완료 기준
- `veremote daemon`으로 텔레그램 명령 수신기가 실행돼야 함
- 웹 없이 CLI 중심으로 사용 가능해야 함
- 사용자가 실행/확인 흐름을 쉽게 이해할 수 있어야 함

## 코덱스 실행 프롬프트
```text
project_plan_cli.md와 tasks/05_daemon_and_tui_polish.md를 읽고 CLI 중심 구조를 마무리해줘.
`veremote daemon` 명령을 추가해서 텔레그램 polling을 CLI 명령으로 흡수하고,
`veremote` 실행 시 로고, 현재 workspace, engine, 상태, 사용 예시가 보기 좋게 나오도록 다듬어줘.
변경 파일 목록과 사용자 테스트 순서를 정리해줘.
```
