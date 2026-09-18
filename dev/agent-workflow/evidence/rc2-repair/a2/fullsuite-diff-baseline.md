# A2 full-suite gate — post-change vs baseline

## Baseline

- Source of record: `baseline-fullsuite-a2x.log` (=
  `dev/agent-workflow/evidence/fix-alpha2-explicit-agent-setup-compat/after-final-fullsuite.log`,
  the a2x round's final full-suite log, cited by the brief).
- a2x log: `Test Files 6 failed | 162 passed (168)` /
  `Tests 8 failed | 1875 passed (1883)` — run in the a2x worktree.
- The a2x tree lacks `packages/runtime/test/f1-webserver-shim-isolation.test.ts`
  (tracked at this branch's base 3b4912a, +3 tests), so the base state of THIS
  worktree is `8 failed | 1878 passed (1886)` — exactly the brief's cited
  baseline ("~8 failed | 1878 passed of 1886").

## Post-change (this branch, `fullsuite-post-change.log`)

`Test Files 7 failed | 164 passed (171)` / `Tests 9 failed | 1889 passed (1898)`

- +12 tests = the new A2 suite (all pass:
  `bound-blueprint-persona-root` 8/8, `bound-blueprint-persona-live` 4/4).
- The 8 baseline failures are ALL present with identical test names:
  d3-member-identity-context D3-4; p6t3-mediation tests 1/3/4/5/7;
  p6t3-restart tests 2/5; load failures p8s3b-result-effects,
  t12a-b2-child-identity, t12a-glue-handoff-ports.
- The single extra failure:
  `p6t1-parallel > P6-T1 P3 ... exactly three fail
  QUOTA_MEMBER_MAX_INSTANCES` — the brief's documented known flake
  ("p6t1-parallel may flake 2–3 under full load — isolation 9/9 is the known
  precedent; rerun in isolation if it appears").

## Flake adjudication (10-run isolated comparison, same machine)

Command: `vitest run packages/runtime/test/p6t1-parallel.test.ts`, 10 runs on
the base src (3 src files reverted) and 10 runs on this branch's src.

- Base x10: 8 green, 2 runs with `2 failed | 7 passed` (both at loop start,
  hot machine after a prior full-suite run).
- Mine x10: 7 green, 3 runs with failures (5/2/1 failed; all at hot starts).
- Identical failure signature in both: the quota-race test expecting
  `ACTIVATION_QUOTA_MEMBER_MAX_INSTANCES` but getting
  `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL (reprobe-failed)` — a timing race in
  the compatibility authority's async inline reprobe under 5 parallel
  activations. The compatibility/admission code is untouched by this change
  (owned surface: root persona source + host resolver passthrough + glue skip
  condition, all post-admission), and the base reproduces the same failure
  under the same hot-start conditions.

Verdict: pre-existing load-dependent flake, NOT a new failure from this
change. Zero new failures: the post-change failure set minus the documented
flake is EXACTLY the baseline set.

Note: a FIRST full-suite run on this branch (before the final typecheck
fixes) also showed the exact 8-failure baseline set
(`8 failed | 1889 passed (1898)` modulo the +12 — i.e. the flake did not
trigger there); the flake is run-to-run, as adjudicated above.
