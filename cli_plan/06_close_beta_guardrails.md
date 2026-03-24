# Task 06 — Close Beta Guardrails

## 목표
클로즈 베타에 필요한 최소 보안 경계를 만든다.

지금은 기능은 되지만, 외부 사용자가 써보기에는
workspace 경계와 실행 정책이 너무 느슨하다.
이번 단계에서는 **공개 제품 수준**이 아니라,
**소수 사용자에게 배포해도 크게 위험하지 않은 최소 안전장치**를 넣는다.

## 구현할 것
- active workspace 바깥 경로 접근 금지 규칙 정리
- worker 실행 시 workspace boundary 검증
- `run` / `edit` 정책 차이 명확화
- 허용 엔진/허용 명령 검증 강화
- daemon 중복 실행/잘못된 pid 상태 처리 정리
- runtime 파일(`pid`, temp preview 등) 정리 규칙 보강

## 구체 포인트
- active workspace path가 없거나 유효하지 않으면 실행 거부
- worker가 workspace 바깥 preview/image path를 임의로 읽지 못하게 제한
- Pencil preview/image path도 workspace 기준 또는 명시적 allowlist로 제한
- `run`은 분석/요약 우선, `edit`만 수정 허용이라는 정책을 코드/문서에 일치시킴
- stale daemon pid가 있으면 자동 정리 또는 명확한 에러 메시지 제공

## 완료 기준
- active workspace 밖 경로나 잘못된 preview path로는 작업이 실행되지 않아야 함
- daemon pid 꼬임으로 인해 `veremote`가 잘못된 “already running” 상태에 빠지지 않아야 함
- `run` / `edit` 정책이 상태 메시지와 문서에서 일관되게 보여야 함

## 코덱스 실행 프롬프트
```text
project_plan_cli.md와 06_close_beta_guardrails.md를 읽고 클로즈 베타용 최소 안전장치를 구현해줘.
이미 되는 기능은 유지하고, active workspace 경계/preview 경로/daemon pid/runtime 파일 처리 쪽을 우선 보강해줘.
run과 edit 정책도 더 명확하게 맞춰줘.
변경 파일 목록과 직접 테스트 방법을 사용자 입장에서 정리해줘.
```
