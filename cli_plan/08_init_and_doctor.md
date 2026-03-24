# Task 08 — Init & Doctor

## 목표
다른 사람이 설치해서 써볼 수 있도록 초기 설정 흐름을 만든다.

클로즈 베타에서 가장 중요한 것은
“개발자인 내가 아는 환경에서만 되는 도구”를 벗어나는 것이다.
이번 단계에서는 설치성/설정성을 보강한다.

## 구현할 것
- `veremote init`
- `veremote doctor`
- `.env.local` 또는 설정 파일 초안 생성 흐름
- telegram / gemini / codex / playwright / db 경로 기본 점검
- 실패 시 무엇을 해야 하는지 친절한 진단 메시지 제공

## `veremote init`
- 필요한 설정 항목 안내
- 기본 env 템플릿 생성
- 설치 후 다음 단계(`veremote doctor`, `veremote connect`) 안내

## `veremote doctor`
- Node/npm 실행 가능 여부
- `gemini`, `codex` 명령 존재 여부
- 텔레그램 필수 env 확인
- playwright chromium 설치 여부
- sqlite/db 디렉토리 쓰기 가능 여부
- 현재 workspace 연결 상태 확인

## 완료 기준
- 새 환경에서 `veremote init`으로 기본 설정 파일을 만들 수 있어야 함
- `veremote doctor`가 missing dependency와 해결 힌트를 보여야 함
- 사용자가 README 없이도 최소한 어디가 부족한지 알 수 있어야 함

## 코덱스 실행 프롬프트
```text
project_plan_cli.md와 08_init_and_doctor.md를 읽고 클로즈 베타용 init/doctor 명령을 구현해줘.
다른 사람이 설치했을 때 필요한 환경변수, CLI, playwright, telegram 설정 상태를 한 번에 점검할 수 있게 해줘.
init은 기본 설정 파일 초안을 만들고, doctor는 부족한 점과 해결 방법을 보여주게 해줘.
변경 파일 목록과 직접 테스트 방법을 사용자 입장에서 정리해줘.
```
