# veremote CLI 프로젝트 기획안

## 1. 현재 포지션
veremote는 웹 대시보드보다 **CLI + daemon + telegram + worker** 흐름을 중심으로 쓰는
개인형/소수 사용자용 원격 바이브코딩 도구이다.

이번 계획의 기준점은 공개 SaaS가 아니라
[`veremote_close_beta_goal.md`](/Users/nam9295/Desktop/john_2.0/code/remote_cli/cli_plan/veremote_close_beta_goal.md)
에 정의한 **클로즈 베타 품질**이다.

## 2. 이미 완료된 기반 단계
아래 단계는 현재 코드베이스에 이미 반영된 것으로 보고, 다시 구현 대상으로 잡지 않는다.

1. CLI 엔트리와 `veremote` 기본 실행
2. active workspace 저장/조회/해제
3. active workspace 기준 텔레그램 `/where`, `/run`
4. `/edit` 모드, 변경 파일 저장/알림
5. `veremote daemon`, fullscreen TUI, 엔진 전환, 텔레그램 자동 연결

즉 01~05는 **기반 완성** 상태로 보고,
이제부터는 기능 추가보다 **보안 경계, 상태 명확성, 설치성, preview 품질**을 우선한다.

## 3. 현재 제품에서 이미 되는 것
- 현재 폴더를 active workspace로 연결
- `veremote`, `veremote connect/status/disconnect/daemon/engine`
- 텔레그램 `/help`, `/where`, `/engine`, `/status`, `/last`, `/job`, `/screenshot`, `/run`, `/edit`
- Gemini 기본 실행, Codex 보조 엔진 전환
- 변경 파일 목록/요약/상태 전송
- Pencil 작업 진행 메시지와 PNG 정책
- preview image / localhost screenshot / fallback preview 흐름

## 4. 클로즈 베타 전 남은 핵심 과제

### P0
1. workspace/명령 실행 경계 보강
2. `/tail` 포함 진행 상태 확인 개선
3. daemon/workspace 잠금/복구 안정화

### P1
1. `veremote init`
2. `veremote doctor`
3. clean machine 설치 검증
4. README/온보딩 문서 정리

### P2
1. Pencil/web preview 정책을 heuristic 대신 명시적 profile로 정리
2. 결과 메시지/스크린샷 UX 보강
3. Codex 품질 개선

## 5. 다음 작업 순서
이제부터는 아래 task md 순서대로 진행한다.

1. `06_close_beta_guardrails.md`
2. `07_job_tail_and_recovery.md`
3. `08_init_and_doctor.md`
4. `09_workspace_preview_profiles.md`
5. `10_readme_and_beta_smoke_test.md`

## 6. 작업 원칙
- 새 기능보다 **클로즈 베타 신뢰성**을 우선한다.
- 이미 되는 흐름은 다시 손대지 않고, 실제 베타 사용 시 불편하거나 위험한 부분을 먼저 줄인다.
- 웹은 보조 흐름으로 두고, core는 CLI + telegram 기준으로 판단한다.
- 각 단계 구현 후에는 항상 사용자 입장에서 직접 테스트 순서를 정리한다.
