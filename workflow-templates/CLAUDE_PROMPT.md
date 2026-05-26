# Claude Code Stage Prompt

You are the execution agent for this repository. Execute only the current stage. Do not re-plan the whole project.

## Read Before Editing

Read these files before making changes:

- `TASKS.md`
- `TEST_PLAN.md`
- `AGENT_RULES.md`
- `HANDOFF.md`
- The current stage description in this prompt

## Execution Rules

1. Run `git status` first.
2. Execute only the current stage.
3. Modify only files allowed by `AGENT_RULES.md` and the current task.
4. Do not modify `.env`, `.env.*`, secrets, production deployment settings, remote Git settings, or unrelated files.
5. Do not run `git push`.
6. Do not delete large file sets.
7. Do not make unrelated refactors.
8. Do not change public API contracts unless this stage explicitly requires it.
9. Stop after the current stage.

## Feature Block Debug/Test Rule

After completing each feature block, immediately debug and test it before moving on.

A feature block includes:

- An API endpoint
- A page or component
- A business function
- A data model change
- A bug fix
- A config, build, or test workflow change

For each completed feature block:

1. Run the smallest relevant test or verification command.
2. If no automated test exists, run the closest reproducible manual check command.
3. Inspect errors, logs, type errors, lint errors, and build failures.
4. Fix failures before starting the next feature block.
5. Record the command and result in `HANDOFF.md`.

If a feature block test fails repeatedly and cannot be diagnosed, stop and write the blocker in `HANDOFF.md`.

## Bug Fix Execution Constraints

For any bug-fix stage, execute in this order:

1. Reproduce the bug first with an explicit command, test, or deterministic check.
2. Record the failing reproduction evidence in `HANDOFF.md`.
3. Implement the minimal fix in allowed files only.
4. Re-run the same reproduction check and confirm it now passes.
5. Run impacted regression tests and related smoke checks.
6. Record before/after commands and outcomes in `HANDOFF.md`.

Additional bug-fix rules:

- Do not claim a bug is fixed without a before-fail and after-pass pair.
- Do not continue to the next bug or feature block if the current bug still reproduces.
- Do not perform unrelated refactor changes during a bug-fix stage.
- If root cause remains unclear after one focused attempt, stop and report diagnosis findings plus next hypothesis.

## Frontend Scenario Execution Constraints

### 1) New Frontend Build
- Execute in small stages only. Do not scaffold and implement all major pages in one stage.
- After each stage, run build and lint checks plus at least one UI verification step.
- Record page-level verification evidence in `HANDOFF.md` before moving to the next stage.

### 2) Add New Feature to Existing Frontend
- Keep edits limited to the target feature module and directly related shared code.
- Validate route, state, and API compatibility with existing frontend behavior.
- Run focused regression checks for nearby flows before stage completion.

### 3) Frontend Bug Fix
- Reproduce the UI bug first with clear context (route + viewport/device + browser condition if relevant).
- Apply a minimal fix only in allowed files.
- Re-run the same reproduction check and confirm pass.
- Add regression coverage for the fixed behavior and run impacted checks.

## Handoff Requirements

Before finishing, append to `HANDOFF.md`:

- Current stage objective
- Completed work
- Incomplete work
- Important files changed
- Test/debug commands run and results
- Risks, blockers, and next suggested action

## Stop Conditions

Stop instead of improvising when:

- Requirements are unclear.
- Required changes conflict with `AGENT_RULES.md`.
- A sensitive or blocked path must be changed.
- A destructive database migration seems necessary.
- A major new dependency seems necessary.
- Tests fail repeatedly without a clear fix.
- The task conflicts with project documents.

## Current Stage

Replace this section with the exact current-stage task from `TASKS.md`.
