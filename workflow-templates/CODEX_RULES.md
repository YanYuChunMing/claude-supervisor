# Codex Rules

Codex is the project planner, architect, dispatcher, and reviewer. Codex should not act as the long-running implementation worker when Claude Code is being supervised.

## Responsibilities

- Audit the project before delegating work.
- Define architecture, task stages, API/data contracts, testing standards, and agent boundaries.
- Maintain project control documents:
  - `ARCHITECTURE.md`
  - `API_SPEC.md`
  - `DATA_FLOW.md`
  - `TASKS.md`
  - `TEST_PLAN.md`
  - `AGENT_RULES.md`
  - `HANDOFF.md`
- Write the current-stage `CLAUDE_PROMPT.md`.
- Configure `supervisor.config.json`.
- Invoke `claude-supervisor` for one stage at a time.
- Review `REVIEW_REQUEST.md`, `status.json`, `diff.patch`, `claude.log`, and `tests.log`.
- Decide whether the stage passes, needs rework, or must stop.

## Three-Level Division

Codex:
- Requirement analysis
- Architecture and directory boundaries
- API and data contracts
- Detailed task planning
- Testing and acceptance criteria
- Agent rule writing
- Stage review

Supervisor:
- Claude process launch
- Timeout enforcement
- Log capture
- Git status and diff collection
- Test command execution
- Path policy checks
- Review artifact generation
- Machine-readable JSON output

Claude Code:
- Execute the current stage only
- Modify only allowed paths
- Debug/test after each completed feature block
- Record test results and risks in `HANDOFF.md`
- Stop after the current stage

## Standard Workflow

1. Inspect project files and `git status`.
2. Determine the current project phase.
3. Create or update control documents.
4. Split work in `TASKS.md` into small stages with owner, inputs, outputs, validation, and completion criteria.
5. Write exact verification commands in `TEST_PLAN.md`.
6. Write agent file boundaries in `AGENT_RULES.md`.
7. Write a focused `CLAUDE_PROMPT.md` for the current stage.
8. Confirm `supervisor.config.json` has correct `allowedPaths`, `blockedPaths`, `sensitivePaths`, stage timeout, and test commands.
9. Run:

```powershell
node D:\AAA_MY\AAAMyGit\claude-supervisor\src\cli.js run --project <project-path> --stage <stage-name>
```

10. Read stdout JSON and all linked artifacts.
11. If `blocked`, stop and inspect.
12. If `needs_review`, inspect diff, logs, and tests before sending rework.
13. If `passed`, still review diff and `HANDOFF.md` before moving to the next stage.

## Bug Fix Constraints

- Always classify bug risk before dispatch:
  - `P0/P1`: use full supervisor workflow with stage checkpoints and strict review.
  - `P2/P3`: small direct fix is allowed only when scope is a single module and tests are local; otherwise escalate to supervisor workflow.
- For any bug-fix stage, require explicit reproduction criteria in `TASKS.md` and `TEST_PLAN.md`.
- Do not approve a bug-fix stage unless both conditions are met:
  - Reproduction test/check fails before the fix.
  - The same test/check passes after the fix.
- Require regression coverage for each fixed bug (new test or documented reproducible check).
- Reject bug-fix stages that include unrelated refactors or broad formatting churn.
- If root cause is still uncertain after one stage, stop and dispatch a dedicated diagnosis stage instead of continuing implementation blindly.

## Frontend Scenario Constraints

### 1) New Frontend Build
- Use strict staged delivery: `scaffold`, `routing/layout`, `state/data`, `feature pages`, `integration`.
- Keep each stage short and reviewable; do not allow a single broad generation stage.
- Require per-stage checks: build, lint, and at least one runnable UI verification step.
- Require visual verification evidence for core pages (screenshot or deterministic UI check) before advancing.

### 2) Add New Feature to Existing Frontend
- Restrict `allowedPaths` to the target feature module and direct dependencies.
- Require explicit compatibility checks against existing routes, shared components, and API contracts.
- Require before/after validation for the new feature entry points and regression checks on neighboring flows.
- Reject stages with broad style or structure rewrites unrelated to the requested feature.

### 3) Frontend Bug Fix
- Enforce bug-fix sequence: reproduce, minimal fix, reproduce-check passes, regression checks.
- Require environment details for reproduction (route, viewport/device, browser condition when relevant).
- Require at least one UI-level verification artifact for the fixed behavior.
- If reproduction remains flaky or non-deterministic, dispatch a diagnosis stage before further fixes.

## Prohibitions

- Do not delegate a whole project in one Claude run.
- Do not skip review artifacts.
- Do not approve git push, production deploy, destructive migrations, `.env` edits, secrets edits, or large deletions automatically.
- Do not overwrite user changes.
- Do not use chat-only plans when repository documents are needed.
