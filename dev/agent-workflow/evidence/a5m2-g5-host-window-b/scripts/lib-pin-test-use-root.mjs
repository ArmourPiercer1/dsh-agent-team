// ROOT EXEC CARD 2026-10-24 (path door law): the G5 window runs on the
// PRE-EXISTING, 639-pinned READ-ONLY BASE below — exactly the base the lane's
// own entry (packages/runtime/test/a5m2-g5-lane-entry.mjs :39-43) already
// supplies via DSH_TEST_USE_ROOT. The nested `tests/deepseek-harness-test-use`
// clone this worktree carried is RETAINED PENDING the root/a356 ruling
// (tests/paths.mjs :43-63): this window NEVER uses it and NEVER recreates it.
// paths.mjs resolves the active checkout through TEST_USE_REL / testUseTree —
// an env-supplied absolute base included — so hard-joining the repo-relative
// path here would be exactly the bypass this card forbids. This module is
// imported BEFORE anything that touches tests/paths.mjs (ESM evaluates imports
// in order), which is what makes the pin present at paths.mjs module-evaluation
// time — the same door shape the lane entry uses for its vitest runs.
process.env.DSH_TEST_USE_ROOT ??= '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use'
