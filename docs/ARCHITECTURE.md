# Architecture

## Purpose

Claude Supervisor is a deterministic CLI wrapper around Claude Code. It keeps long-running implementation work stage-bounded and produces evidence that Codex or a human reviewer can inspect before the next stage.

## Components

### CLI

`src/cli.js` parses command-line arguments and prints a single JSON summary to stdout. Human diagnostics are written to stderr.

### Runner

`src/runner.js` coordinates the stage lifecycle:

1. Load project config.
2. Resolve the selected stage.
3. Read the stage prompt.
4. Run Claude.
5. Run configured tests.
6. Collect Git state.
7. Evaluate path policy.
8. Write review artifacts.
9. Return the summary JSON.

### Process Utilities

`src/processUtils.js` wraps child process execution with timeout handling and stdout/stderr capture. Windows command execution uses explicit `cmd.exe` wrapping for shell commands.

### Git Collection

`src/git.js` collects both tracked and untracked file changes by combining:

- `git status --porcelain`
- `git diff --name-only`
- `git diff`

Supervisor-generated `.supervisor/**` artifacts are excluded from changed-file policy checks.

### Path Policy

`src/pathPolicy.js` evaluates changed files against:

- `allowedPaths`
- `blockedPaths`
- `sensitivePaths`

Blocked path changes force `blocked`. Sensitive or outside-allowed changes force `needs_review`.

### Reporting

`src/report.js` decides the stage status and writes:

- `REVIEW_REQUEST.md`
- `status.json`
- `diff.patch`
- `claude.log`
- `tests.log`

## Data Flow

```text
supervisor.config.json
  -> selected stage
  -> promptFile
  -> claude -p
  -> tests
  -> git status/diff
  -> path policy
  -> status decision
  -> review artifacts + stdout JSON
```

## Design Boundaries

Supervisor does not judge product correctness. It verifies process signals: command results, tests, path policy, diff limits, and whether a mutating stage produced changes.

Supervisor does not mediate interactive Claude permissions. If Claude asks for approval and exits without changes, the `requireChanges` guard should return `needs_review`.
