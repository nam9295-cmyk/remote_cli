# Task 06 — Telegram Command Input (Polling)

## 목표
텔레그램에서 간단한 명령을 보내면, 대시보드 앱이 그 명령을 읽고 기존 작업 DB/워커 구조를 재사용해 작업 조회 및 실행까지 처리한다.

## 구현 방식
- webhook이 아니라 `getUpdates` 기반 polling 방식으로 구현
- 로컬 개발 환경에서도 바로 테스트 가능하게 구성
- 기존 Job 생성 / 실행 / NotificationLog 구조를 최대한 재사용

## 왜 polling을 먼저 쓰는가
- Telegram Bot API는 업데이트 수신 방식으로 `getUpdates`와 webhook 두 방식을 제공한다.
- 두 방식은 상호배타적이다.
- 로컬 환경에서는 공개 HTTPS 주소 없이도 polling으로 바로 테스트할 수 있다.
- 현재 프로젝트 단계에서는 webhook보다 polling이 구현과 디버깅이 쉽다.

## 이번 단계에서 구현할 것

### 1. 텔레그램 명령 수신 루프
- 주기적으로 `getUpdates` 호출
- 마지막 처리한 `update_id` 저장
- 중복 처리 방지
- 허용된 chat id만 처리

### 2. 명령 파서
우선 지원 명령:
- `/help`
- `/status`
- `/last`
- `/job <id>`
- `/run gemini <prompt>`

### 3. 응답 메시지
- `/help`: 사용 가능한 명령 목록
- `/status`: 최근 작업 5개 정도를 제목/상태/엔진과 함께 요약
- `/last`: 가장 최근 작업의 결과 요약과 링크
- `/job <id>`: 특정 작업의 제목, 상태, 결과 요약
- `/run gemini <prompt>`: 새 작업 생성 → 즉시 실행 → 생성 안내 메시지 반환 → 완료 시 기존 완료 알림 유지

### 4. 보안/안전장치
- `TELEGRAM_CHAT_ID`와 일치하는 chat에서 온 명령만 처리
- `run`은 우선 `gemini`만 허용
- 긴 자유 메시지 전체 실행 금지
- 슬래시 명령만 처리
- 파일 수정이 필요한 프롬프트는 사용자가 명시할 때까지 금지하는 기본 문구 추가 가능

## 권장 구조

### 환경변수
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `PUBLIC_BASE_URL`
- `TELEGRAM_POLLING_ENABLED=true`
- `TELEGRAM_POLLING_INTERVAL_MS=3000`

### 저장소/파일
- `lib/telegram-command.ts`
- `lib/telegram-polling.ts`
- `lib/telegram-parser.ts`
- `scripts/run-telegram-polling.cjs` 또는 서버 내부 polling 시작점
- update_id 저장용 간단한 파일 또는 DB 테이블

## update_id 처리
- 마지막 처리한 `update_id`를 저장
- 다음 polling 때는 `offset = last_update_id + 1` 로 호출
- 이미 처리한 업데이트 재실행 방지

## 응답 형식 예시

### /help
사용 가능한 명령:
- /status
- /last
- /job 12
- /run gemini 질문내용

### /status
최근 작업:
#12 Gemini 연결 테스트 — success — gemini
#13 로고 문구 요약 — failed — gemini

### /run gemini ...
작업이 생성되었습니다.
- id: 21
- title: Telegram run
- engine: gemini

완료되면 기존 완료 알림이 다시 전송됩니다.

## UI 반영
- 설정 페이지에 “Telegram command polling” 상태 표시
- 최근 명령 처리 결과 또는 마지막 polling 시간 표시 가능하면 추가
- 작업 상세에는 기존처럼 Telegram 전송 이력 유지

## 하지 않을 것
- webhook 방식
- 텔레그램에서 파일 업로드 명령 처리
- 다중 chat 동시 지원
- 사용자별 권한 시스템
- Codex/Gemini 외 복잡한 자유 실행 명령

## 완료 기준
- 텔레그램에서 `/help` 입력 시 응답이 와야 한다.
- `/status`, `/last`, `/job <id>` 가 동작해야 한다.
- `/run gemini 질문` 입력 시 새 작업이 생성되고 실행되어야 한다.
- 완료 시 기존 알림 흐름이 유지되어야 한다.
- 같은 update가 두 번 처리되지 않아야 한다.

## 테스트 시나리오
1. 텔레그램에서 `/help`
2. 텔레그램에서 `/status`
3. 웹에서 기존 작업 하나 생성 후 `/last`
4. 텔레그램에서 `/run gemini 이 프로젝트를 한 줄로 요약해줘. 한글로 답하고 파일 수정은 하지마.`
5. 작업 생성 안내 메시지 확인
6. 완료 알림 확인
7. 웹 대시보드에서 실제 Job 생성 여부 확인

## 코덱스 실행 프롬프트
```text
project_plan.md와 tasks/06_telegram_commands.md를 읽고 텔레그램 명령 수신 기능을 구현해줘.

요구사항:
1. webhook 말고 getUpdates polling 방식으로 구현
2. TELEGRAM_CHAT_ID와 일치하는 chat에서 온 명령만 처리
3. /help, /status, /last, /job <id> 명령부터 구현
4. /run gemini <prompt> 명령도 지원
5. 마지막 처리한 update_id를 저장해서 중복 처리 방지
6. 기존 Job DB/워커/알림 구조를 재사용
7. 구현 후 내가 텔레그램에서 실제로 어떤 명령을 쳐서 테스트하면 되는지 사용자 입장에서 단계별로 설명
8. 변경 파일 목록과 이후 확장 포인트도 함께 정리
```

## 참고
Telegram Bot API는 HTTP 기반 인터페이스이며, 업데이트 수신은 `getUpdates` 또는 webhook 두 방식 중 하나를 사용한다. `getUpdates`는 로컬 테스트에 유리하고, webhook은 공개 HTTPS 엔드포인트가 필요하다. 또한 두 방식은 동시에 사용할 수 없다.
