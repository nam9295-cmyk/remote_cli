# Task 10 — README & Beta Smoke Test

## 목표
클로즈 베타 사용자가 실제로 따라 할 수 있는 설치/온보딩 문서를 만든다.

코드가 돌아가는 것만으로는 부족하고,
다른 사람이 “어떻게 설치하고, 어떻게 연결하고, 어떻게 테스트하는지”를
문서만 보고 이해할 수 있어야 한다.

## 구현할 것
- README 정리
- 설치 방법
- `npm link` / 글로벌 사용 흐름
- `veremote init`
- `veremote doctor`
- `veremote connect`
- 텔레그램 연결 방법
- Gemini/Codex 엔진 전환 방법
- web/pencil preview 설정 방법
- 클로즈 베타 smoke test 체크리스트

## smoke test 예시
1. clean machine install
2. `veremote init`
3. `veremote doctor`
4. `veremote connect`
5. 텔레그램 `/where`
6. `/run ...`
7. `/edit ...`
8. `/screenshot last`

## 완료 기준
- README만 보고 첫 실행이 가능해야 함
- 베타 참가자가 직접 따라 할 수 있는 체크리스트가 있어야 함
- 설치 실패/연결 실패 시 어디를 봐야 하는지 문서에 나와 있어야 함

## 코덱스 실행 프롬프트
```text
project_plan_cli.md와 10_readme_and_beta_smoke_test.md를 읽고 클로즈 베타용 README와 온보딩 문서를 정리해줘.
설치, init, doctor, connect, telegram 연결, engine 전환, preview 설정, smoke test 체크리스트까지 한 번에 이해되게 정리해줘.
문서 변경 파일 목록과 사용자가 직접 따라 하는 순서도 같이 정리해줘.
```
