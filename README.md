# veremote

veremote is a close-beta CLI for remotely nudging your local coding workspace through Telegram.

It is optimized for a single active workspace on your machine:

- connect the current folder as the active workspace
- check where it is from Telegram
- send a natural-language request from Telegram
- let veremote auto-pick read-only `run` or bounded `edit`
- receive text summaries, changed files, and preview images

This repository is not published to npm yet. For now, beta users install it from source and expose the `veremote` command with `npm link`.

## Current Beta Scope

What works now:

- `veremote` fullscreen TUI
- `veremote init`, `doctor`, `connect`, `status`, `disconnect`, `engine`, `preview`, `daemon`
- Telegram commands: `/help`, `/where`, `/engine`, `/status`, `/last`, `/job`, `/tail`, `/screenshot`, `/ask`, `/run`, `/edit`
- Telegram natural-language input in Korean and English for common run/edit and status flows
- Gemini as the default engine
- Codex as an optional secondary engine
- Web preview via localhost screenshot
- Pencil preview via an explicit exported PNG path

What this is not:

- multi-user SaaS
- a team collaboration platform
- zero-config installer for non-technical users

## Requirements

- macOS or Linux shell environment
- Node.js 24.x recommended
- npm 11.x or compatible
- Telegram bot token and chat id
- at least one engine installed locally:
  - `gemini`
  - `codex`
- for web screenshots: Playwright Chromium

Install Chromium once:

```bash
npx playwright install chromium
```

## Install From Source

Clone the repository, install dependencies, then expose the global command:

```bash
git clone <your-repo-url>
cd remote_cli
npm install
npm link
```

After that, the following should work:

```bash
veremote
veremote status
veremote help
```

If `veremote` is not found after `npm link`, open a new terminal or run:

```bash
hash -r
```

## First-Time Setup

Create a starter env file:

```bash
veremote init
```

This creates `.env.local` if it does not already exist.

Run the built-in checks:

```bash
veremote doctor
```

Doctor verifies:

- `.env.local`
- Telegram configuration
- `gemini` / `codex` availability
- Playwright / Chromium
- database and runtime directories
- active workspace state
- daemon state

## `.env.local`

`veremote init` generates this template:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_POLLING_ENABLED=true
TELEGRAM_POLLING_INTERVAL_MS=1000

PUBLIC_BASE_URL=http://localhost:3000
WORKSPACE_PREVIEW_URL=http://127.0.0.1:5173
# WORKSPACE_PREVIEW_IMAGE_PATH=/absolute/path/to/export.png
# VEREMOTE_ALLOWED_PREVIEW_ROOTS=/absolute/path/to/exports

GEMINI_CLI_COMMAND=gemini
CODEX_CLI_COMMAND=codex
# CUSTOM_CLI_COMMAND=
```

Recommended defaults:

- keep `GEMINI_CLI_COMMAND=gemini`
- add `CODEX_CLI_COMMAND=codex` only if Codex CLI is installed
- use `WORKSPACE_PREVIEW_URL` for web work
- use `veremote preview pencil <path>` for Pencil exports instead of relying on the env file alone

## Connect a Workspace

Move into the project folder you want to control, then connect it:

```bash
cd /path/to/your/project
veremote connect
```

What happens:

- the current folder becomes the single active workspace
- a Telegram connection message is sent if Telegram is configured
- `veremote status` will show the active path, engine, preview profile, and daemon state

Disconnect later with:

```bash
veremote disconnect
```

## Start veremote

Local fullscreen TUI:

```bash
veremote
```

Standalone Telegram polling daemon:

```bash
veremote daemon
```

In the fullscreen TUI, you can type:

- `ask <prompt>`
- `run <prompt>`
- `edit <prompt>`
- `engine gemini`
- `engine codex`
- `preview url http://127.0.0.1:5173`
- `preview image ./export.png`
- `preview pencil ./export.png`
- `preview clear`
- `status`
- `where`
- `help`
- `exit`

Exit keys:

- `Ctrl+C`
- `Ctrl+D`

## Engine Switching

Check the current engine:

```bash
veremote engine
```

Switch to Gemini:

```bash
veremote engine gemini
```

Switch to Codex:

```bash
veremote engine codex
```

The active workspace engine is also used by Telegram `/run` and `/edit`.

Telegram equivalents:

```text
/engine
/engine gemini
/engine codex
```

Natural-language equivalents also work:

```text
what engine am I using?
switch to codex
엔진 뭐야?
엔진 제미나이로 바꿔줘
```

## Preview Profiles

veremote uses an explicit preview profile for each active workspace.

### Web preview

Use this when your project is running on localhost and you want a real browser screenshot:

```bash
veremote preview url http://127.0.0.1:5173
```

### Image file preview

Use this when a fixed PNG file should be sent back:

```bash
veremote preview image ./preview/latest.png
```

### Pencil export preview

Use this when the workspace should be treated as a Pencil workflow and success depends on a real exported PNG:

```bash
veremote preview pencil ./exports/final.png
```

### Clear preview

```bash
veremote preview clear
```

Check the current preview profile:

```bash
veremote preview
veremote status
```

## Telegram Commands

These commands only work for the configured `TELEGRAM_CHAT_ID`.

Available commands:

```text
/help
/where
/engine
/engine gemini
/engine codex
/status
/last
/job last
/tail last
/screenshot last
/ask <prompt>
/run <prompt>
/edit <prompt>
```

Natural-language requests also work.

Examples:

```text
푸터를 더 크게 수정해줘
히어로 섹션이 어떻게 되어있어?
지금 어디 연결돼 있어?
마지막 작업 보여줘
최근 로그 보여줘
스크린샷 보내줘

make the footer bigger
explain the hero section
where am I connected?
show me the last job
show recent logs
send me the screenshot
```

Typical flow:

1. run `veremote connect` in the project folder
2. start `veremote` or `veremote daemon`
3. send `where` or `지금 어디 연결돼 있어?`
4. send a natural-language request or `/ask ...`
5. inspect `job last`, `tail last`, `screenshot last`

## `ask`, `run`, and `edit`

The simplest flow is to just send a sentence.

veremote will auto-pick:

- `edit` when your message clearly asks to modify files
- `run` when your message asks to inspect, explain, summarize, or check

You can still force a mode when you want:

- `/ask <prompt>` or `ask <prompt>` for auto mode
- `/run <prompt>` or `run <prompt>` for read-first work
- `/edit <prompt>` or `edit <prompt>` for bounded edits inside the active workspace

`/run` and `run <prompt>` are intended for read-first work:

- summarize
- inspect
- explain
- check structure

`/edit` and `edit <prompt>` are intended for bounded edits inside the active workspace.

veremote does not support arbitrary path targeting outside the active workspace as part of the normal beta flow.

## Pencil Policy

If the workspace preview profile is `pencil_export`, the final result is judged by a real PNG.

For Pencil preview jobs:

- progress messages are sent during the job
- success requires a real exported PNG
- fallback text or a fake placeholder image does not count as success
- if the PNG is missing, the job ends as `export_failed` or `partial`

## Logs, Database, and Preview Files

Runtime files are stored here:

- database: `data/remote-cli.sqlite`
- job logs: `data/logs/`
- daemon pid: `data/veremote-daemon.pid`

Per-workspace preview images are stored under the active project:

- `.veremote/previews/<job-id>.png`

Useful Telegram inspection commands:

- `/job last`
- `/tail last`
- `/screenshot last`

## If Something Fails

Start here:

```bash
veremote doctor
veremote status
```

Then check:

1. Is the correct project folder connected with `veremote connect`?
2. Is the daemon running through `veremote` or `veremote daemon`?
3. Does `.env.local` have valid Telegram values?
4. Is the selected engine actually installed on this machine?
5. For web preview, is the local dev server actually running?
6. For Pencil preview, does the PNG file really exist at the configured path?

For Telegram-side inspection:

```text
where
job last
tail last
screenshot last
```

## Beta Onboarding and Smoke Test

Detailed onboarding:

- [docs/close-beta-onboarding.md](docs/close-beta-onboarding.md)

Close-beta smoke test checklist:

- [docs/close-beta-smoke-test.md](docs/close-beta-smoke-test.md)
