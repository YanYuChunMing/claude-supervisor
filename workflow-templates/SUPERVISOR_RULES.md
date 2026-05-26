# Supervisor Rules

Supervisor is a deterministic process controller and hard-rule checker. It does not interpret product intent and does not replace Codex review.

## Inputs

- Target project path.
- Stage name.
- `<project>/supervisor.config.json`.
- Stage `promptFile`, usually `CLAUDE_PROMPT.md`.

## Required Behavior

- Run exactly one configured stage.
- Invoke Claude Code with `claude -p`.
- Apply the configured `permissionMode` and `allowedTools`.
- Enforce `timeoutMinutes`.
- Save Claude output to `claude.log`.
- Run all configured `testCommands` after Claude exits.
- Save test output to `tests.log`.
- Collect `git status --porcelain`, `git diff --name-only`, and `git diff`.
- Save diff output to `diff.patch`.
- Evaluate changed files against `pathPolicy`.
- Generate `REVIEW_REQUEST.md` and `status.json`.
- Print only machine-readable JSON to stdout.
- Print diagnostics to stderr.

## Status Rules

Return `blocked` when:
- Claude times out.
- Any changed file matches `blockedPaths`.

Return `needs_review` when:
- Claude exits non-zero.
- Any test command fails.
- Any changed file matches `sensitivePaths`.
- Any changed file is outside `allowedPaths`.
- Changed file count exceeds `maxChangedFiles`.
- Diff line count exceeds `maxDiffLines`.

Return `passed` only when:
- Claude exits zero.
- No timeout occurs.
- All tests pass.
- No blocked, sensitive, or outside-allowed path issues exist.
- Diff size limits are not exceeded.

## Non-Goals

- No product judgment.
- No real-time yes/no approval.
- No automatic git commit, push, merge, or deploy.
- No automatic continuation to the next stage.
