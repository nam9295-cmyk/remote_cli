# Task 02 — Active Workspace

## 목표
현재 터미널 폴더를 active workspace로 등록하고, 텔레그램 명령이 이 workspace 기준으로 실행될 수 있게 한다.

## 구현할 것
- ActiveWorkspace 저장 구조 추가
- 단일 active workspace 정책 구현
- cwd를 workspace path로 저장
- name은 현재 폴더명으로 자동 생성
- connect 시 기존 active workspace 교체
- heartbeat 또는 lastActiveAt 갱신 구조 추가

## 텔레그램 연결 알림
connect 성공 시 텔레그램으로 아래 정보 전송 가능하면 추가:
- 프로젝트명(폴더명)
- 경로
- 엔진
- 사용 가능한 명령 예시

## 완료 기준
- connect 후 active workspace가 DB 또는 상태 저장소에 남아야 함
- status에서 active workspace 정보가 보여야 함
- disconnect 후 active workspace가 해제되어야 함

## 코덱스 실행 프롬프트
```text
project_plan_cli.md와 tasks/02_active_workspace.md를 읽고 active workspace 기능을 구현해줘.
현재 cwd를 단일 active workspace로 저장하고, connect/status/disconnect에서 이를 읽고 갱신하게 해줘.
가능하면 텔레그램에 연결 성공 메시지도 보내줘.
변경 파일 목록과 테스트 방법을 함께 정리해줘.
```
