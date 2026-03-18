# veremote CLI 프로젝트 기획안

## 1. 프로젝트 개요
veremote는 현재 터미널 작업 폴더를 기준으로 AI 작업을 원격 제어할 수 있는 CLI 도구이다.
사용자는 프로젝트 폴더에서 `veremote`를 실행해 현재 폴더를 active workspace로 연결하고,
텔레그램에서 현재 연결된 워크스페이스를 확인하거나 `/run`, `/edit` 명령으로 원격 작업을 수행한다.

핵심 목표:
- 웹 UI 없이 CLI 중심으로 사용
- 현재 작업 디렉토리(cwd)를 기준으로 동작
- 텔레그램에서 현재 연결된 폴더 확인 가능
- 텔레그램에서 읽기/수정 명령 가능
- 결과 및 상태는 텔레그램으로 회신
- Job / Log / Notification 구조는 재사용

## 2. 핵심 사용자 흐름

### 로컬 터미널
1. 사용자가 프로젝트 폴더로 이동
2. `veremote` 실행
3. 현재 폴더가 active workspace로 등록됨
4. 텔레그램으로 연결 안내 메시지 전송 가능

### 텔레그램
1. `/where` 입력
2. 현재 연결된 폴더/엔진/상태 확인
3. `/run ...` 또는 `/edit ...` 입력
4. active workspace 기준으로 작업 실행
5. 결과 요약, 변경 파일, 상태를 텔레그램으로 수신

## 3. 설계 원칙
- 프로젝트 등록 방식보다 현재 폴더 기반 방식 우선
- 단일 active workspace부터 시작
- 읽기(run)와 수정(edit) 명령 분리
- 허용된 텔레그램 chat에서 온 명령만 처리
- 경로를 텔레그램에 직접 입력하지 않도록 함
- active workspace가 없으면 텔레그램 명령 거부

## 4. 핵심 명령

### 로컬 CLI
- `veremote`
- `veremote connect`
- `veremote status`
- `veremote disconnect`
- `veremote daemon`

### 텔레그램
- `/help`
- `/where`
- `/status`
- `/last`
- `/run <prompt>`
- `/edit <prompt>`

## 5. 핵심 데이터 구조

### ActiveWorkspace
- id
- path
- name
- engine
- isActive
- connectedAt
- lastHeartbeatAt
- chatId

### Job
- id
- title
- engine
- prompt
- mode (run/edit)
- workspacePath
- status
- createdAt
- updatedAt
- startedAt
- finishedAt
- resultSummary
- changedFilesJson
- logPath
- errorMessage

### NotificationLog
- id
- jobId
- channelType
- sentAt
- status
- messageId
- errorMessage

## 6. 동작 구조

### connect
- 현재 cwd를 active workspace로 등록
- 기존 active workspace가 있으면 교체
- 기본 엔진을 gemini로 설정 가능
- 텔레그램에 연결 메시지 전송 가능

### daemon
- 텔레그램 polling 수신
- `/where`, `/run`, `/edit` 처리
- active workspace 기준으로 Job 생성/실행
- 완료 시 텔레그램 결과 회신

### run
- 기본적으로 읽기/요약/분석용
- 파일 수정은 하지 않는 모드

### edit
- 파일 수정 허용 모드
- 결과 메시지에 변경 파일 목록 포함

## 7. 추천 UX

### `veremote` 실행 시
- 베리굿 느낌 ASCII 로고
- 현재 워크스페이스 경로 표시
- 현재 엔진 표시
- active workspace 연결 성공 메시지
- 텔레그램에 연결 상태 알림

### 텔레그램 예시
- `/where`
- `/run 이 프로젝트를 한 줄로 요약해줘`
- `/edit Header.tsx의 메인 타이틀을 더 크게 수정해줘`

## 8. 개발 순서
1. CLI 엔트리 추가
2. active workspace 등록/조회/해제 기능
3. 텔레그램 명령을 active workspace 기반으로 변경
4. `/where`, `/run`, `/edit` 구현
5. edit 결과에 변경 파일 목록 포함
6. daemon 통합
7. CLI 시각 스타일 개선

## 9. 이번 전환에서 정리할 것
- 웹 페이지 라우트는 우선 유지해도 되지만 메인 사용 흐름에서는 제외
- 웹 중심 문구를 CLI 중심 문구로 변경
- Settings UI 대신 CLI 상태 출력 우선
- polling은 향후 `veremote daemon`으로 흡수

## 10. 코덱스 작업 원칙
- 단계별 task md 파일만 읽고 작업
- 한 번에 큰 리팩토링보다 점진적 전환
- 기존 DB/워커/알림 구조 최대 재사용
- 구현 후 사용자 테스트 방법을 꼭 설명
