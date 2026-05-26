# Operations

## Standard Stage Run

```powershell
node D:\AAA_MY\AAAMyGit\claude-supervisor\src\cli.js run --project C:\path\to\project --stage stage-001
```

Read the stdout JSON first. Then inspect:

- `reviewFile`
- `statusFile`
- `diffFile`
- `logFile`
- `<runDir>/tests.log`

## Review Checklist

Before approving a stage:

- Confirm `status` is not `blocked`.
- Read `REVIEW_REQUEST.md`.
- Inspect `diff.patch`.
- Confirm `testsPassed=true` when tests are expected.
- Confirm `HANDOFF.md` was updated when the stage required implementation work.
- Confirm no blocked or sensitive files changed unexpectedly.

## Bug Fix Workflow

For bug-fix stages:

1. Record reproduction steps in `TASKS.md` and `TEST_PLAN.md`.
2. Require Claude to reproduce the bug before fixing it.
3. Require before-fail and after-pass evidence.
4. Require regression coverage or a deterministic manual check.
5. Reject unrelated refactors.

## Frontend Workflow

For new frontend work:

- Split work into scaffold, layout/routing, data/state, feature pages, and integration stages.
- Require build, lint, and one UI verification per stage.

For existing frontend feature work:

- Keep `allowedPaths` limited to the target feature and direct dependencies.
- Run neighboring flow regression checks.

For frontend bug fixes:

- Capture route, viewport/device, and browser condition.
- Re-run the exact reproduction check after the fix.

## Failure Handling

### `blocked`

Stop. Inspect `REVIEW_REQUEST.md`, `status.json`, and `diff.patch`. Do not run the next stage until the cause is understood.

### `needs_review`

Review the artifacts. Either approve manually, dispatch a corrective stage, or ask for clarification.

### `passed`

Still inspect the diff and handoff before continuing. `passed` means process checks passed, not that product intent is automatically correct.

## Test Lab

A persistent test lab exists at:

```text
D:\AAA_MY\AAAMyGit\supervisor-test-lab
```

Use it to validate policy behavior before relying on new supervisor changes in larger projects.
