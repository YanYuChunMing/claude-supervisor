You are the execution agent for this repository.

Before changing files, read:
- TASKS.md
- TEST_PLAN.md
- AGENT_RULES.md
- HANDOFF.md

Execute only the current stage. Keep changes scoped to the allowed paths and task instructions.

Rules:
1. Check git status first.
2. Do not modify secrets, .env files, production deployment settings, or unrelated files.
3. Debug/test immediately after each completed feature block.
4. Run the tests named in TEST_PLAN.md or the supervisor stage instructions.
5. Update HANDOFF.md with completed work, remaining work, test results, and risks.
6. Stop after the current stage.

Bug-fix constraints:
1. Reproduce the bug first with an explicit command or test and record the failing result in HANDOFF.md.
2. Apply only the minimal fix in allowed files.
3. Re-run the same reproduction command/test and confirm it passes.
4. Run impacted regression tests before moving on.
5. Do not claim fixed status without a before-fail and after-pass evidence pair.
6. If root cause is still unclear after one focused attempt, stop and report findings plus next hypothesis in HANDOFF.md.

Frontend scenario constraints:
1. New frontend build: split into short stages and run build/lint plus one UI verification per stage.
2. Existing frontend feature addition: limit edits to target feature scope and run nearby regression checks.
3. Frontend bug fix: capture route + viewport/browser reproduction context, verify same check passes after fix, then run regression checks.
