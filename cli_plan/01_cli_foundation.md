# Task 01 — CLI Foundation

## 목표
웹 중심 구조에 CLI 엔트리를 추가하고 `veremote` 명령이 동작하는 기초를 만든다.

## 구현할 것
- CLI 엔트리 파일 추가
- `veremote` 기본 실행
- `veremote connect`
- `veremote status`
- `veremote disconnect`
- package.json에 bin/scripts 연결
- 현재 cwd 출력
- 기본 로고/환영 메시지 출력

## 요구사항
- 현재 폴더에서 `veremote` 또는 `npm run veremote` 형태로 실행 가능
- 최소한 현재 cwd, 현재 엔진(gemini 기본), 연결 상태를 출력
- 기존 웹/DB 구조를 깨지 않음

## 완료 기준
- 터미널에서 실행 시 veremote 로고와 cwd가 보여야 함
- connect/status/disconnect 명령이 동작해야 함

## 코덱스 실행 프롬프트
```text
project_plan_cli.md와 tasks/01_cli_foundation.md를 읽고 CLI 기반 veremote의 기초를 구현해줘.
웹 기능은 유지하되, CLI가 새 진입점이 되도록 만들어줘.
`veremote`, `veremote connect`, `veremote status`, `veremote disconnect`가 동작하게 하고,
현재 cwd와 기본 엔진 상태를 보기 좋게 출력해줘.
변경 파일 목록과 내가 직접 테스트하는 방법도 정리해줘.
```
