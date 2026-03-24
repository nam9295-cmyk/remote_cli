# Task 09 — Workspace Preview Profiles

## 목표
preview/screenshot 정책을 heuristic에서 명시적 profile 기반으로 바꾼다.

현재는 `.pen` 파일 존재 여부나 프롬프트 키워드로 Pencil 작업을 추정하는데,
클로즈 베타에서는 이 방식이 불안정하다.
workspace별로 preview 방식을 명시적으로 저장할 수 있어야 한다.

## 구현할 것
- active workspace 또는 별도 설정에 preview profile 저장
- preview type 예시:
  - `web_url`
  - `image_file`
  - `pencil_export`
- `veremote preview` 하위 명령 추가 검토
- 텔레그램 `/where` 또는 `/status`에 현재 preview profile 표시
- Pencil 정책은 명시적 `pencil_export`일 때만 강하게 적용

## 원하는 흐름
- 웹 프로젝트: `localhost` URL 캡처
- Pencil 작업: export PNG 경로 사용
- 둘 다 없으면 일반 작업만 fallback preview 허용
- Pencil profile은 실제 PNG 없으면 success 처리 금지

## 완료 기준
- preview 정책이 prompt heuristic이 아니라 workspace 설정에 의해 결정되어야 함
- 사용자가 현재 어떤 preview policy로 동작하는지 확인할 수 있어야 함
- Pencil workspace에서 잘못된 fallback success가 줄어들어야 함

## 코덱스 실행 프롬프트
```text
project_plan_cli.md와 09_workspace_preview_profiles.md를 읽고 preview 정책을 명시적 workspace profile 기반으로 바꿔줘.
web_url / image_file / pencil_export 같은 타입을 저장할 수 있게 하고,
현재 heuristic 기반 pencil 판별을 줄여줘.
가능하면 veremote preview 하위 명령도 같이 추가해줘.
변경 파일 목록과 직접 테스트 방법을 정리해줘.
```
