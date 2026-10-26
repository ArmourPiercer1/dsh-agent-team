# U7-1 / PR #393 adversarial review (r1)

## Verdict

**PASS-WITH-FINDINGS** — no code defect found in the reviewed governance change, but two environment disclosures prevent a fully independent reproduction in this checkout. Merge is recommended only with the PR's attached census evidence retained and the required clean CI environment available.

## Findings

### F-1 — ENV_BLOCK (disclosure, not a PR defect)

- **Severity:** medium verification limitation
- **File/line:** `scripts/ci-pr-gate.mjs:1538-1550`
- **Classification:** disclosure / environment block
- **Defect:** none established. The exact census command refuses before spawning Vitest because this review worktree does not contain the gitignored pristine checkout `tests/deepseek-harness-test-use`. This is the documented test-method prerequisite, not a silently tolerated regression.
- **Observed tail (verbatim):**

```text
DSH-CI-LEG leg=census verdict=fail seconds=0 detail=(undeclared refusal — the instrument could not grade this checkout; if that is intended, declare it: --allow-refused census) REFUSED before spawning vitest: tests/deepseek-harness-test-use (the pristine test host, gitignored, pinned by tests/paths.mjs) is absent from this checkout, and census legs that resolve it cannot be graded here.
```

### F-2 — ENV_BLOCK (known pre-existing a4p7 limitation, not a PR defect)

- **Severity:** low verification limitation
- **File/line:** `packages/testkit/test/a4p7-merge-gate.test.ts` (pre-existing lint-visibility path)
- **Classification:** disclosure / known pre-existing issue
- **Defect:** none attributed to this PR. Running the focused merge-gate test in this non-root/non-provisioned worktree also hit the known `MODULE_NOT_FOUND` lint-visibility census condition, plus absent build/install artifacts. The requested user rule explicitly says the MODULE_NOT_FOUND a4p7 lint-visibility census is not a finding.

## Verified

### Sanctions

- `docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md:693-705` states the fixed constraint: LeaderInstance is the root Agent/Session and has no `childSessionId`.
- `docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md:2693-2714` states creation of the root DSH Agent/Session and `LeaderInstance = Root Agent/Session`.
- `docs/plans/finished/0.1.1-alpha.1-minimal-capability-wiring-plan.md:454-464` requires new capability fields to enter the Blueprint normalized/hash representation.
- `dev/agent-workflow/SESSION_ROUTER_LOG.md:2135-2142` records the user-ruled `0.1.0-rc.1` release and its published contents; line 2138 explicitly includes “messaging relay to root leader 修复”.

### Edited tests / security assertions

Diff inspection covered all four edited test files (the nine titled identities map to 4 files):

- `packages/domain/test/t2-blueprint-hash.test.ts`: expected value extended with `capabilities: null`; exact-key `toEqual` remains.
- `packages/runtime/test/p6t3-mediation.test.ts`: expected leader session changed from stale child session to root session; mediation, envelope denial, zero-writes, coordination, attribution, and legacy-child silence assertions remain.
- `packages/runtime/test/p6t3-restart.test.ts`: observer and fault-injection target changed to root session; recovery and abort assertions remain.
- `packages/tools/test/p6t6-actions.test.ts`: expected delivered session changed to root session; delivery/attribution assertions remain.

No assertion was deleted, widened, or relaxed; no test case was removed.

### Commands and verbatim tails

1. `node scripts/ci-pr-gate.mjs --self-test`

```text
DSH-CI-SELFTEST pass 94 assertions (verdict algebra: identity sets, escalation, missing-token, fence refusal)
```

2. `pnpm exec vitest run packages/domain/test/t2-blueprint-hash.test.ts packages/runtime/test/p6t3-mediation.test.ts packages/runtime/test/p6t3-restart.test.ts packages/tools/test/p6t6-actions.test.ts --reporter=dot`

```text
Test Files  4 passed (4)
Tests  44 passed (44)
Duration  1.71s (transform 3.18s, setup 0ms, tests 78ms, environment 0ms)
```

3. `bash dev/agent-workflow/evidence/u7-1-old-reds-20261026/mutation-controls.sh`

```text
M0-unmutated exit=0  Tests 44 passed (44)
M1-leader-target-child-session exit=1  Tests 8 failed | 18 passed (26)
M2-mediation-grant-bypassed exit=1  Tests 10 failed | 16 passed (26)
M3-hash-capabilities-key-dropped exit=1  Tests 1 failed | 17 passed (18)
M4-hash-capabilities-absent-as-object exit=1  Tests 1 failed | 17 passed (18)
porcelain(product files): []
```

4. Exact requested parser controls, exercised with injected predecessor readers: (a) 8/9, (b) made-up 10th, (c) wrong predecessor, (d) leftover titled red, (e) empty without sentinel, (f) missing predecessor — all refused. A valid sentinel plus exact predecessor set parses to zero.

5. Regression visibility: `compareCensus([], ['TEST packages/a/test/x.test.ts::X']).verdict` returned `fail`; with the new empty baseline every retired test that regresses is a NEW red and fails the census leg.

6. Race relocation: diff confirms the two controls move from `packages/testkit/test/` to `scripts/`, while the test still plants both files, asserts the lint universe increases by exactly two, and retains the merge-gate checks. No p4t6 assertion was relaxed.

## Could not verify independently

- The exact live census command could not run because `tests/deepseek-harness-test-use` is absent in this review checkout; the PR evidence records the provisioned C1 run.
- The focused a4p7 merge-gate test could not close in this unprovisioned worktree because of missing build/install artifacts and the explicitly known non-root `MODULE_NOT_FOUND` lint-visibility condition.
- No host was booted, and no `:3080` or `~/.dsh` operation was performed.
