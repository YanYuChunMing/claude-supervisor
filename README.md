# Claude Supervisor

Claude Supervisor is a small Node.js CLI for running Claude Code in bounded, reviewable stages. It is designed for a Codex-led workflow where Codex plans and reviews, Supervisor enforces process boundaries, and Claude Code performs the implementation work.

## What It Does

Claude Supervisor runs one configured stage at a time:

```text
Codex plans the stage
  -> Supervisor runs claude -p
  -> Supervisor captures logs, tests, git status, and git diff
  -> Supervisor applies path and size policies
  -> Codex reviews REVIEW_REQUEST.md and status.json
```

It is intentionally not a full agent platform. It is a deterministic control layer around a single Claude Code stage.

## Features

- Stage-based `claude -p` execution.
- Per-stage timeout.
- Machine-readable JSON on stdout.
- Review artifacts per run:
  - `REVIEW_REQUEST.md`
  - `status.json`
  - `diff.patch`
  - `claude.log`
  - `tests.log`
- Path policy checks for allowed, blocked, and sensitive files.
- Untracked file detection.
- `.supervisor/**` artifact exclusion.
- `requireChanges` guard for no-op stages.
- Reusable workflow templates for Codex, Supervisor, and Claude Code.

## Requirements

- Node.js 20 or newer.
- Git.
- Claude Code CLI available as `claude` when running real Claude stages.

## Install

Run from this repository:

```powershell
npm install
npm test
```

Run directly:

```powershell
node src/cli.js run --project C:\path\to\project --stage stage-001
```

After publishing or linking:

```powershell
npx claude-supervisor run --project C:\path\to\project --stage stage-001
```

## Target Project Setup

Each supervised target project should contain:

```text
supervisor.config.json
CLAUDE_PROMPT.md
TASKS.md
TEST_PLAN.md
AGENT_RULES.md
HANDOFF.md
```

Reusable templates are stored in:

```text
workflow-templates/
```

Use these templates as starting points:

- `CODEX_RULES.md`
- `SUPERVISOR_RULES.md`
- `CLAUDE_PROMPT.md`
- `CLAUDE_PROMPT_MINIMAL.md`
- `supervisor.config.json`

## Usage

```powershell
node D:\AAA_MY\AAAMyGit\claude-supervisor\src\cli.js run --project C:\path\to\project --stage stage-001
```

The target project must be a Git repository. Run artifacts are written to:

```text
<project>/.supervisor/runs/<run-id>/
```

stdout is reserved for JSON:

```json
{
  "ok": false,
  "project": "C:\\path\\to\\project",
  "stage": "stage-001",
  "status": "needs_review",
  "runDir": "C:\\path\\to\\project\\.supervisor\\runs\\20260526-180000-stage-001",
  "timedOut": false,
  "claudeExitCode": 0,
  "testsPassed": false,
  "changedFiles": 8,
  "pathViolations": 1,
  "sensitiveChanges": 1,
  "reviewFile": "C:\\path\\to\\project\\.supervisor\\runs\\20260526-180000-stage-001\\REVIEW_REQUEST.md",
  "statusFile": "C:\\path\\to\\project\\.supervisor\\runs\\20260526-180000-stage-001\\status.json",
  "diffFile": "C:\\path\\to\\project\\.supervisor\\runs\\20260526-180000-stage-001\\diff.patch",
  "logFile": "C:\\path\\to\\project\\.supervisor\\runs\\20260526-180000-stage-001\\claude.log"
}
```

Diagnostics and stack traces are written to stderr.

## Status Values

- `passed`: Claude exited successfully, tests passed, path checks passed, diff limits were not exceeded, and required changes were detected when applicable.
- `needs_review`: non-blocking risk exists, tests failed, Claude exited non-zero, sensitive files changed, outside-allowed files changed, limits were exceeded, or no changes were detected for a mutating stage.
- `blocked`: Claude timed out or changed a blocked path.
- `error`: Supervisor failed before producing normal run artifacts.

## Documentation

- [Configuration](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Operations](docs/OPERATIONS.md)
- [Workflow Templates](workflow-templates/)

## Development

```powershell
npm test
npm pack --dry-run
```

The test suite uses Node's built-in test runner.

## Current Limitations

- No real-time yes/no permission mediation.
- No daemon mode.
- No multi-project queue.
- No automatic commit, push, merge, or deploy.
- Stage success is based on process evidence and policy checks; Codex or a human should still review artifacts.

## License

MIT.
