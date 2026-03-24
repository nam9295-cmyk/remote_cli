# Task 07 — Job Tail & Recovery

## 목표
원격 작업이 느릴 때도 사용자가 텔레그램에서 현재 상태를 쉽게 이해할 수 있게 한다.

지금 `/job`와 `/last`는 기본 확인은 되지만,
클로즈 베타에서는 **진행 로그 확인**과 **id 없이 재조회**가 더 쉬워져야 한다.

## 구현할 것
- `/tail <id>` 또는 `/tail last` 추가
- `/job last` 지원
- `/screenshot last` 지원
- `/last` 응답을 더 짧고 명확하게 정리
- running/queued/partial/export_failed 상태 설명 개선
- daemon 또는 worker 비정상 종료 후 stale running job 정리 정책 보강

## 사용자 관점
- 긴 job id를 복사하지 않아도 마지막 작업을 확인할 수 있어야 함
- 텔레그램에서 “지금 뭐하고 있는지”를 1~2개 명령으로 볼 수 있어야 함
- 실행 중/실패/partial 차이를 메시지만 보고 이해할 수 있어야 함

## 완료 기준
- `/tail last`가 마지막 작업 로그 일부를 보여야 함
- `/job last`와 `/screenshot last`가 동작해야 함
- 오래된 running 상태가 영원히 남지 않도록 기본 복구 흐름이 있어야 함

## 코덱스 실행 프롬프트
```text
project_plan_cli.md와 07_job_tail_and_recovery.md를 읽고 텔레그램 상태 확인 경험을 개선해줘.
/tail <id>, /tail last, /job last, /screenshot last 를 우선 지원하고,
running/partial/export_failed 상태를 사용자가 더 쉽게 이해하도록 메시지를 정리해줘.
가능하면 stale running job 복구도 같이 보강해줘.
변경 파일 목록과 직접 테스트 순서를 정리해줘.
```
