# veremote Close Beta Onboarding

This guide is for a beta user setting up veremote on their own machine for the first time.

## 1. Install

From the repository root:

```bash
npm install
npm link
npx playwright install chromium
```

## 2. Create `.env.local`

Generate the starter file:

```bash
veremote init
```

Open `.env.local` and fill in:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `GEMINI_CLI_COMMAND`
- `CODEX_CLI_COMMAND` if you want Codex available

Keep these unless you have a reason to change them:

- `TELEGRAM_POLLING_ENABLED=true`
- `TELEGRAM_POLLING_INTERVAL_MS=1000`

## 3. Verify the Machine

Run:

```bash
veremote doctor
```

You want `OK` or understandable `WARN` results before going further.

Fix anything marked `FAIL` first.

## 4. Connect a Project

Move into the project folder you want to control:

```bash
cd /path/to/project
veremote connect
```

Then verify:

```bash
veremote status
```

You should see:

- active workspace path
- active engine
- preview profile
- daemon state

## 5. Choose an Engine

Local:

```bash
veremote engine gemini
veremote engine codex
```

Telegram:

```text
/engine
/engine gemini
/engine codex
```

Gemini is the default beta engine.

## 6. Choose a Preview Strategy

### Web app on localhost

```bash
veremote preview url http://localhost:3000
```

Use this when the edited result should be captured from a running local page.

### Fixed PNG file

```bash
veremote preview image ./preview/latest.png
```

Use this when your workflow writes a PNG that should be sent back directly.

### Pencil export PNG

```bash
veremote preview pencil ./exports/final.png
```

Use this when a real exported Pencil PNG is the final output.

Check the current profile:

```bash
veremote preview
```

## 7. Start the Runtime

Either open the local TUI:

```bash
veremote
```

Or run the polling daemon directly:

```bash
veremote daemon
```

`veremote` is usually enough because it also handles daemon startup if needed.

## 8. First Telegram Check

In Telegram, send:

```text
/where
```

You should receive:

- workspace name
- workspace path
- engine
- preview profile
- active status

## 9. First Remote Read-Only Run

Try:

```text
/run 이 프로젝트 구조를 3줄로 요약해줘
```

Then inspect:

```text
/job last
/tail last
```

## 10. First Remote Edit

Try a small, safe edit:

```text
/edit README에 테스트 문장 한 줄 추가해줘
```

Then inspect:

```text
/job last
/tail last
/screenshot last
```

If your preview profile is configured correctly, you should receive a real preview image.

## 11. If You Get Stuck

Run locally:

```bash
veremote doctor
veremote status
```

Then check:

1. is the correct folder connected?
2. is the engine installed?
3. is Telegram configured?
4. is localhost running for web preview?
5. does the configured PNG path exist for Pencil or image preview?

## 12. Recommended Beta Routine

For daily use:

1. open a project folder
2. run `veremote connect`
3. run `veremote`
4. send `/where`
5. use `/run` for checks
6. use `/edit` for bounded changes
7. use `/job last`, `/tail last`, `/screenshot last` to inspect results
