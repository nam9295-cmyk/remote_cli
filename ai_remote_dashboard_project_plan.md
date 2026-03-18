# AI Remote Dashboard 프로젝트 기획안

## 1. 프로젝트 개요
이 프로젝트는 PC/Mac에서 실행되는 AI CLI(Gemini, Codex, 기타 커스텀 CLI)를 웹 대시보드에서 제어하고, 작업 결과를 텔레그램 채팅방에서 대표와 함께 확인할 수 있도록 만드는 원격 작업 대시보드이다.

핵심 방향은 다음과 같다.
- 실제 실행은 내 컴퓨터에서 수행
- 휴대폰에서는 결과 확인과 간단한 모니터링
- 대표와는 텔레그램 채팅방에서 결과 공유
- 복잡한 협업 에디터보다 가볍고 실용적인 구조 우선

## 2. 목표
### 2-1. 핵심 목표
- 웹에서 작업을 생성하고 AI CLI를 실행한다.
- 실행 로그와 상태를 실시간으로 본다.
- 작업 완료/실패 시 텔레그램으로 자동 알림을 보낸다.
- 대표와 같은 텔레그램 채팅방에서 결과를 함께 확인한다.
- 나중에 Gemini, Codex, Custom CLI를 모두 지원할 수 있게 구조를 만든다.

### 2-2. 이번 버전에서 하지 않을 것
- 텔레그램에서 직접 긴 명령을 입력해 작업 실행하기
- 다중 사용자 권한/역할 관리
- 복잡한 실시간 공동 편집
- 외부 공개용 SaaS 수준 멀티테넌트 구조

## 3. 사용자 시나리오
### 시나리오 A: 내가 작업 실행
1. 웹 대시보드 접속
2. 새 작업 생성
3. 엔진 선택(Gemini / Codex / Custom)
4. 프롬프트 입력
5. 실행 시작
6. 로그 확인
7. 완료되면 결과 저장
8. 텔레그램 채팅방에 자동 공유

### 시나리오 B: 대표가 결과 확인
1. 텔레그램 채팅방에서 완료 메시지 확인
2. 제목 / 상태 / 요약 / 링크 / 이미지 미리보기 확인
3. 필요하면 옆에서 같이 보고 피드백

## 4. MVP 범위
### 필수 기능
- 작업 생성
- 작업 목록 조회
- 작업 상세 보기
- CLI 실행
- 상태 표시 (대기 / 실행중 / 완료 / 실패)
- 로그 저장
- 결과 요약 저장
- 텔레그램 알림 전송
- 결과 링크 공유

### 있으면 좋은 기능
- 결과 이미지 첨부
- 최근 작업 필터
- 엔진별 필터
- 실패 사유 요약

## 5. 화면 구조
### 5-1. 홈 / 대시보드
목적: 최근 작업을 빠르게 확인

구성:
- 상단 헤더
- 새 작업 버튼
- 최근 작업 리스트
- 상태 배지
- 엔진 필터

### 5-2. 새 작업 페이지
목적: 새 작업 생성

구성:
- 작업 제목
- 엔진 선택
- 프롬프트 입력창
- 실행 버튼
- 선택 옵션(작업 폴더, 태그 등)

### 5-3. 작업 상세 페이지
목적: 로그와 결과 확인

구성:
- 작업 제목
- 상태
- 실행 시간
- 로그 영역
- 결과 요약
- 결과 이미지 미리보기
- 텔레그램 전송 이력

### 5-4. 설정 페이지
목적: 로컬 환경 설정

구성:
- 엔진 실행 명령 설정
- 텔레그램 봇 토큰 설정
- 채팅방 ID 설정
- 저장 경로 설정

## 6. 데이터 구조
### Job
- id
- title
- engine
- prompt
- status
- createdAt
- updatedAt
- startedAt
- finishedAt
- resultSummary
- previewImagePath
- logPath
- errorMessage

### Engine
- id
- name
- command
- argsTemplate
- enabled

### NotificationLog
- id
- jobId
- channelType
- sentAt
- status
- messageId

## 7. 상태 설계
- queued
- running
- success
- failed
- canceled

## 8. 기술 스택 제안
- Next.js
- Tailwind CSS
- Node.js
- SQLite
- child_process.spawn
- Telegram Bot API

## 9. 폴더 구조 제안
```text
project-root/
  app/
    page.tsx
    jobs/
      page.tsx
      [id]/page.tsx
    new/page.tsx
    settings/page.tsx
  components/
    job-card.tsx
    status-badge.tsx
    log-viewer.tsx
    preview-panel.tsx
  lib/
    db.ts
    engines.ts
    telegram.ts
    job-runner.ts
    validators.ts
  data/
  tasks/
    01_setup.md
    02_jobs.md
    03_runner.md
    04_telegram.md
    05_ui_polish.md
  project_plan.md
```

## 10. 개발 순서
### 1단계: 기본 세팅
- Next.js 프로젝트 생성
- Tailwind 설정
- 라우트 생성
- 더미 데이터로 UI 뼈대 구성

### 2단계: 작업 CRUD
- 작업 생성
- 작업 목록
- 작업 상세
- SQLite 연결

### 3단계: 실행부 연결
- child_process.spawn으로 CLI 실행
- 로그 스트리밍
- 상태 업데이트

### 4단계: 텔레그램 연동
- 완료 알림
- 실패 알림
- 링크/요약/이미지 전송

### 5단계: UI 정리
- 모바일 최적화
- 카드 디자인 개선
- 로그 가독성 개선

## 11. 코덱스에게 시킬 방식
채팅 누적 대신 아래 방식 사용.

### 원칙
- project_plan.md를 기준 문서로 둔다.
- tasks 폴더에 단계별 md를 둔다.
- 코덱스에게 한 번에 한 단계만 시킨다.
- 구현 후 변경 파일 목록과 다음 단계 제안을 요구한다.

### 예시 프롬프트
```text
project_plan.md와 tasks/01_setup.md를 읽고 setup 단계만 구현해줘.
홈 / 새 작업 / 작업상세 / 설정 페이지 라우트를 만들고,
더미 데이터 기반 UI를 먼저 구현해줘.
구현 후 변경 파일 목록과 다음 단계 제안까지 정리해줘.
```

## 12. 왜 이 방식이 좋은가
- 긴 채팅 누적보다 빠르다.
- 요구사항이 덜 묻힌다.
- 새 채팅방으로 옮겨도 이어가기 쉽다.
- 대표와 공유하기 쉽다.
- 프로젝트 기준 문서가 남는다.

## 13. 다음 액션
1. project_plan.md 저장
2. tasks 폴더 생성
3. 01_setup.md 작성
4. 코덱스에게 01_setup 단계부터 실행 요청
5. 단계별 검수 후 다음 md로 진행
