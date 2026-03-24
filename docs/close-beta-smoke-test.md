# veremote Close Beta Smoke Test

Use this checklist before asking a beta user to try the tool.

## Goal

A beta user should be able to install veremote from source, connect one project, run a remote prompt from Telegram, and receive a trustworthy result and preview.

## Preflight

- Node.js 24.x installed
- npm installed
- `gemini` installed
- optional: `codex` installed
- Telegram bot token created
- Telegram chat id confirmed
- repository cloned locally

## Smoke Test Checklist

### 1. Clean install

From the repository root:

```bash
npm install
npm link
npx playwright install chromium
```

Expected:

- install succeeds
- `veremote` command is available

### 2. Init

```bash
veremote init
```

Expected:

- `.env.local` is created if missing
- existing `.env.local` is not overwritten

### 3. Fill `.env.local`

Required:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `GEMINI_CLI_COMMAND`

Optional:

- `CODEX_CLI_COMMAND`
- `WORKSPACE_PREVIEW_URL`
- `WORKSPACE_PREVIEW_IMAGE_PATH`
- `VEREMOTE_ALLOWED_PREVIEW_ROOTS`

### 4. Doctor

```bash
veremote doctor
```

Expected:

- no unexpected `FAIL`
- Telegram values detected
- engine command detected
- Chromium check passes if web screenshots are required

### 5. Connect a project

```bash
cd /path/to/project
veremote connect
veremote status
```

Expected:

- active workspace is the current folder
- engine is visible
- preview profile is visible

### 6. Preview profile

Choose one:

Web:

```bash
veremote preview url http://localhost:3000
```

Pencil:

```bash
veremote preview pencil ./exports/final.png
```

Image file:

```bash
veremote preview image ./preview/latest.png
```

Expected:

- `veremote preview` shows the configured profile
- `veremote status` reflects the same profile

### 7. Runtime start

```bash
veremote
```

Expected:

- fullscreen TUI opens
- current workspace is shown
- Telegram daemon starts or is detected as already running

### 8. Telegram workspace check

In Telegram:

```text
/where
```

Expected:

- current workspace path
- current engine
- preview profile

### 9. Telegram read-only run

In Telegram:

```text
/run 이 프로젝트 구조를 3줄로 요약해줘
```

Expected:

- job creation reply
- `/job last` shows running or success
- `/tail last` shows recent logs

### 10. Telegram edit

In Telegram:

```text
/edit README에 테스트 문장 한 줄 추가해줘
```

Expected:

- job creation reply
- changed files are reported on completion
- `/job last` shows summary and mode
- `/screenshot last` returns a preview image

### 11. Engine switch

Local or Telegram:

```bash
veremote engine codex
veremote engine gemini
```

or

```text
/engine codex
/engine gemini
```

Expected:

- engine change is acknowledged
- `/where` reflects the new engine

### 12. Recovery checks

Expected:

- `Ctrl+C`, `Esc`, or `Ctrl+D` exits the fullscreen TUI
- `veremote status` still works after reopening
- daemon does not duplicate endlessly
- stale running jobs can be inspected with `/job last` and `/tail last`

## Failure Triage

If something fails, check in this order:

1. `veremote doctor`
2. `veremote status`
3. `.env.local`
4. local engine install
5. localhost server or PNG preview path
6. Telegram `/where`
7. Telegram `/job last`
8. Telegram `/tail last`

## Pass Criteria

Treat the smoke test as passed when:

1. a clean machine can install and expose `veremote`
2. `init` and `doctor` are understandable
3. a project can be connected without confusion
4. Telegram can run `/where`, `/run`, and `/edit`
5. the user can inspect the latest job without copying a long id
6. a real preview image can be returned for the chosen preview profile
