# p6t1-parallel A/B attribution — PR #44 round-1 + round-2 (2026-09-30)

## Context

PR #44 round-1 independent review (qiyuan-inter/gpt-6-sol) = FAIL, exactly ONE major: the reviewer's mandated p6t1-parallel isolation rerun was RED on the reviewer's run — `pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts` => **2/9 failed (p1.errors.length 1 vs 0; committedOps/memberCount/distinctChildren 1 vs 2 — the classic timing-race signature)**. Parent adjudication (gate semantics, not a re-litigation of the finding): the sufficiency test for "known flake, not a regression" = **A/B attribution against the base tree** — a folded-tree p6t1 failure is exonerated ONLY if the identical signature family reproduces on the base tree (the standing baseline carve-out "p6t1-parallel flaky ~1/3, run isolated if it appears" made precise).

PR #44 round-2 independent review = FAIL, exactly TWO majors, BOTH evidence-hygiene (attribution CONTENT verified green by the reviewer: test file byte-identical across trees; `base-run3.log` = exact round-1 signature L154 1-vs-0 / L167 1-vs-2 / 2-of-9 / exit 1; folded 5/5 green + base 4/5 green; delta exactly 13 files {11 evidence + append-only log + graph, zero product/test/kit/classifier/dist/pin}; both diff --check ranges exit 0; worktree clean):

- **FINDING 1 (major)**: the 10 raw A/B logs contain no invocation line (they start at vitest's RUN header) — the "identical invocation on both trees" claim is not independently verifiable from the committed artifacts.
- **FINDING 2 (major)**: `AB-ATTRIBUTION.md` row 5 said folded run 5 = 01:28:54 but `folded-run5.log` says "Start at 09:28:55" (+8 local; 01:28:55 UTC) — a 1s transcription error.

Round-2 fix (this file = a disclosed EDIT; the dataset-1 raw logs are UNTOUCHED): dataset-1 table re-audited cell-by-cell against the raw logs (one correction, enumerated below); `invocations.md` added for dataset 1; **DATASET 2** = a fresh 10-run A/B loop with SELF-EMBEDDED invocation headers in every raw log (directory `dataset2/`); standing protocol section added.

## Pre-committed signature family (SIG-FAMILY, no discretion)

p6t1-parallel **parallel-activation timing race**: any failure in `packages/runtime/test/p6t1-parallel.test.ts` where one of the fixed-point counters `{errors.length, committedOps, memberCount, distinctChildren}` in any of the N-parallel-activation describe blocks (P1–P4) deviates from its expected value — i.e. incomplete commit/member/child fan-out under parallel activation. All observed occurrences (the reviewer's round-1 fold-tree red; the adjudication-round full-suite runs 1/2 P2 L193 failures; dataset-1 BASE RUN 3; dataset-2 FOLDED RUN 4) are members of this family, and all are byte-identical in test/line/value/count.

## Trees, invocation, identity

- **FOLDED**: `.worktrees/f15-mcp-live-loss` — dataset 1 @ `4940b5e2` (PR #44 head at run time); dataset 2 @ `c0f57caa` (code identical to `4940b5e2` — bookkeeping-only delta, reviewer-verified in round 2).
- **BASE**: `.worktrees/pre-alpha3-pre-e-requirement-recovery` @ `06b094ab` (pre-e tip = PR #44 base), both datasets.
- Invocation (identical, verbatim): `pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts`
- Test-file identity: `git diff 06b094ab 4940b5e2 -- packages/runtime/test/p6t1-parallel.test.ts` = **empty (byte-identical)** → the A/B isolates the fold delta only.

## DATASET 1 — run-by-run (2026-09-30 UTC; raw logs = `folded-run1..5.log` / `base-run1..5.log`; invocation record = `invocations.md`)

Timestamps = each log's vitest `Start at` line (host tz +08:00), converted to UTC.

| run | FOLDED @ 4940b5e2 | BASE @ 06b094ab |
| --- | --- | --- |
| 1 | GREEN 9/9, exit 0, Start 09:28:50 = 01:28:50Z | GREEN 9/9, exit 0, Start 09:29:13 = 01:29:13Z |
| 2 | GREEN 9/9, exit 0, Start 09:28:51 = 01:28:51Z | GREEN 9/9, exit 0, Start 09:29:14 = 01:29:14Z |
| 3 | GREEN 9/9, exit 0, Start 09:28:52 = 01:28:52Z | **RED 2/9, exit 1, Start 09:29:15 = 01:29:15Z** — P1 ×2 (below) |
| 4 | GREEN 9/9, exit 0, Start 09:28:53 = 01:28:53Z | GREEN 9/9, exit 0, Start 09:29:16 = 01:29:16Z |
| 5 | GREEN 9/9, exit 0, Start 09:28:55 = **01:28:55Z** | GREEN 9/9, exit 0, Start 09:29:17 = 01:29:17Z |

**Round-2 correction (FINDING 2), re-audit cell-by-cell against the raw logs (copied from the logs, not memory):** exactly ONE mismatch found — row 5, FOLDED timestamp `01:28:54Z` → **`01:28:55Z`** (`folded-run5.log` "Start at 09:28:55" +8 = 01:28:55 UTC; the original cell came from the loop-echo clock, which fired 1 s before the vitest boot). All other 9 timestamp cells, all 10 green/red cells, and all signature values match the raw logs. No other corrections.

**DATASET 1 BASE RUN 3 signature** (`base-run3.log`) — byte-identical to the reviewer's fold-tree red:

- FAIL `P6-T1 P1: N=2 same-template parallel activations both succeed > two activated results with distinct instance ids and child Sessions` — `p6t1-parallel.test.ts:154 expect(p1?.errors.length).toBe(0)` → **Received 1**
- FAIL `P6-T1 P1: N=2 same-template parallel activations both succeed > two COMMITTED operations, two members, two distinct child Sessions` — `p6t1-parallel.test.ts:167 expect(p1?.committedOps).toBe(2)` → **Received 1** (memberCount/distinctChildren are the same test's next assertions — 1 vs 2 family)

Same 2 tests, same lines (154/167), same values (1 vs 0; 1 vs 2), same count (2/9). The BASE tree (which by construction contains none of the F15/fold code) independently reproduces the failure.

**DATASET 1 FOLDED 5/5 green note**: the flake is intermittent (isolated-mode rate observed on this host ≈ 1/5 over the dataset-1 BASE loop; folded-tree occurrences on record = the reviewer's round-1 red on the same code + the adjudication-round full-suite runs 1/2 with 3 and 1 same-family failures). A 5/5 green streak does not exclude an intermittent flake (P(5 green | rate 1/3) ≈ 13%).

## DATASET 2 — run-by-run (2026-09-30 UTC; raw logs = `dataset2/folded-run1..5.log` / `dataset2/base-run1..5.log`)

Every raw log SELF-EMBEDS its provenance: the verbatim invocation string, the worktree, the HEAD, and the UTC start timestamp as a `#`-prefixed header, then the full vitest output, then the exit code. Example (verbatim, `dataset2/folded-run1.log` head):

```
# p6t1-parallel A/B — DATASET 2, run 1 (TREE: FOLDED = f15 worktree)
# WORKTREE: /home/user/dsh-plugins/dsh-agent-team/.worktrees/f15-mcp-live-loss
# HEAD: c0f57caaad6ad54888cf940e148a7bbcf720bd46
# CMD: pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts
# START: 2026-09-30T01:40:50Z
────────────────────────────────────────────────────────────
```

All cells below copied verbatim from the raw logs (`# START:` header, vitest `Tests` line, `# EXIT:` line).

| run | FOLDED @ c0f57caa | BASE @ 06b094ab |
| --- | --- | --- |
| 1 | GREEN — Tests 9 passed (9), EXIT 0, START 01:40:50Z | GREEN — Tests 9 passed (9), EXIT 0, START 01:41:50Z |
| 2 | GREEN — Tests 9 passed (9), EXIT 0, START 01:40:51Z | GREEN — Tests 9 passed (9), EXIT 0, START 01:41:51Z |
| 3 | GREEN — Tests 9 passed (9), EXIT 0, START 01:40:52Z | GREEN — Tests 9 passed (9), EXIT 0, START 01:41:52Z |
| 4 | **RED — Tests 2 failed \| 7 passed (9), EXIT 1, START 01:40:53Z** — P1 ×2 (below) | GREEN — Tests 9 passed (9), EXIT 0, START 01:41:53Z |
| 5 | GREEN — Tests 9 passed (9), EXIT 0, START 01:40:54Z | GREEN — Tests 9 passed (9), EXIT 0, START 01:41:54Z |

**DATASET 2 FOLDED RUN 4 signature** (`dataset2/folded-run4.log`) — byte-identical to the reviewer's fold-tree red and to dataset-1 BASE RUN 3: same 2 P1 tests, same lines (154/167), same values (1 vs 0; 1 vs 2), same count (2/9).

## Protocol (standing, from the round-2 findings)

1. A/B evidence runs **MUST embed the invocation + timestamp header in each raw log**: the verbatim command string, the tree/worktree it ran in, the HEAD, the UTC start timestamp, then the full vitest output, then the exit code. A committed raw log that does not carry its own provenance is not independently verifiable (FINDING 1).
2. **Table cells are copied from the logs verbatim** — never from the loop-echo clock or from memory (FINDING 2: the loop-echo clock can lead the vitest `Start at` clock by 1 s).
3. The pre-e (BASE) worktree is run-execution-only and must be pristine after every loop (verified pre/post by `git status --porcelain` + `git rev-parse HEAD`; nothing written into it — dataset-2 logs were written into the f15 worktree's evidence directory).

## Attribution status

**Round-1 conclusion (DATASET 1, reviewer-verified in round 2)**: IDENTICAL signature family on both trees (folded: the reviewer's red on `4940b5e2` code + same-code full-suite reds; base: DATASET 1 BASE RUN 3) ⇒ **pre-existing known flake, A/B-proven** ⇒ the zero-new gate stands: full-run failure set = exact 9F/19F + the A/B-attributed p6t1-parallel flake; the adjudication-round full-suite run-2 exact-9F/19F green run stays the confirmation of record.

**After DATASET 2 (recorded, no discretion)**: the round-2 letter anticipated two cases — (a) any base-run in dataset 2 red with the same family ⇒ corroboration; (b) all 10 dataset-2 runs green ⇒ the attribution stands on dataset 1's base-run3, dataset 2 contributing the verifiable-invocation demonstration + doubled sample. **Neither case occurred**: **FOLDED RUN 4 went RED (byte-identical same-family signature) while BASE was clean in 5 runs**. This configuration is exactly the round-1 pre-committed attribution rule's STOP branch (verbatim): "BASE clean in 5 runs while the FOLDED tree goes red ⇒ STOP + full capture + report (fold-induced suspicion — I take it from there; no push)." ⇒ **STOP + full capture + NO PUSH; the parent takes it from there.**

The tension is recorded for the parent's adjudication, NOT self-resolved: (i) the round-1 exoneration clause ("IDENTICAL signature family on both trees") is satisfied by the cumulative DATASET 1 + DATASET 2 record — folded occurrences: the reviewer's round-1 red + DATASET 2 FOLDED RUN 4; base occurrence: DATASET 1 BASE RUN 3 (reviewer-verified byte-identical); (ii) the DATASET 2 FOLDED red is the same byte-identical signature as the proven pre-existing flake, manifesting on the folded tree in isolated mode (consistent with the reviewer's round-1 fold-tree red); (iii) the round-2 letter's "Do NOT re-open the attribution" + "either way the zero-new gate position is unchanged" anticipated only the two benign cases. Under the pre-committed rule, the STOP branch takes precedence over any self-adjudication: **no push; PR #44 head stays at `c0f57caa`; the local bookkeeping commit is the full capture.**

## Gate-confirmation runs

Confirmation of record = **DATASET 1 FOLDED RUN 1** (`folded-run1.log`, Start 09:28:50 = 01:28:50Z, @ `4940b5e2`, GREEN 9/9, exit 0 — a green isolated run on the pushed tip; dataset-1 runs 2–5 green as well). DATASET 2 adds further green isolated runs on `c0f57caa` (folded runs 1–3, 5).

## Worktree states (red-line checks)

- DATASET 1 — FOLDED: `git status --short` empty before and after the loop. BASE (pre-e worktree): `git status --porcelain` empty before AND after; HEAD unchanged (`06b094ab`); zero tracked-file diff; nothing committed; no untracked scratch (vitest cache inside gitignored `node_modules`).
- DATASET 2 — FOLDED: writer worktree (this evidence directory is where the dataset-2 logs were written; committed with the round-2 bookkeeping). BASE (pre-e worktree): `git status --porcelain` empty before AND after the loop (verified at 01:41:4xZ pre / 01:41:56Z post); HEAD unchanged (`06b094ab`); zero tracked-file diff; nothing committed; nothing written into the tree (log paths target the f15 worktree's evidence directory).

## DATASET 3 — run-by-run (2026-09-30 UTC; raw logs = `dataset3/folded-run1..5.log` / `dataset3/base-run1..5.log`; invocation record = `invocations.md`, DATASET-3 entry)

**Context**: PR-F (pre-alpha3 final closure; fold `3b7039e8` on base `0a0a19a6` = the PR #44 merge tip). The fold-tree p6t1 battery (PR-F full-suite + isolated runs) went RED with the **P2 family** signature (L193, `errors.length` N-vs-0, spurious activation errors — `p6t1-isolated-run2`, 2-vs-0); the pre-committed STOP fired ("no base-tree occurrence ANYWHERE in the cumulative record AND a folded red"). Parent adjudication (binding): OPTION B — dataset-3 A/B against the exact PR-F base point `0a0a19a6` decides fold-introduced (must fix before PR) vs pre-existing (recorded debt), under the pre-declared outcome matrix (i)/(ii)/(iii).

**Trees** (dataset 3):
- **FOLDED** = `.worktrees/pre-alpha3-prf-closure` @ `3b7039e8` (the increment-1 tip under test). The runs carry UNTRACKED kit-only edits (`tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs` — Part-2 kit fixes, NOT imported by the test under run); `packages/` + the runtime test tree = exact HEAD state (verified: `git status --porcelain --untracked-files=no` empty pre/post). Each folded log carries a `# NOTE:` line disclosing this.
- **BASE** = scratch worktree `.worktrees/p6t1-ab-ds3-base` @ `0a0a19a6` (detached HEAD; created, run, and DELETED after the base loop — the deletion is disclosed as a sub-artifact below; per-log vitest `RUN` headers preserve the worktree attribution of record for the deleted tree).

**Test-file identity**: `git diff 0a0a19a6 3b7039e8 -- packages/runtime/test/p6t1-parallel.test.ts packages/runtime/test/p6t1-helpers.ts` = **empty (byte-identical)** → the A/B isolates the increment-1 product delta only.

All cells below copied verbatim from the raw logs (`# START:` header, vitest `Tests` line, `# EXIT:` line). Per-log worktree attribution via the vitest `RUN` header: 5/5 base logs = `RUN v4.1.11 /home/user/dsh-plugins/dsh-agent-team/.worktrees/p6t1-ab-ds3-base`; 5/5 folded logs = `RUN v4.1.11 /home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-prf-closure`.

| run | FOLDED @ 3b7039e8 | BASE @ 0a0a19a6 |
| --- | --- | --- |
| 1 | GREEN — Tests 9 passed (9), EXIT 0, START 05:55:23Z | GREEN — Tests 9 passed (9), EXIT 0, START 05:50:35Z |
| 2 | GREEN — Tests 9 passed (9), EXIT 0, START 05:55:24Z | **RED — Tests 1 failed \| 8 passed (9), EXIT 1, START 05:50:36Z** — P3 ×1 (below) |
| 3 | GREEN — Tests 9 passed (9), EXIT 0, START 05:55:26Z | GREEN — Tests 9 passed (9), EXIT 0, START 05:50:37Z |
| 4 | GREEN — Tests 9 passed (9), EXIT 0, START 05:55:27Z | GREEN — Tests 9 passed (9), EXIT 0, START 05:50:38Z |
| 5 | **RED — Tests 3 failed \| 6 passed (9), EXIT 1, START 05:55:28Z** — P1 ×2 + P2 ×1 (below) | GREEN — Tests 9 passed (9), EXIT 0, START 05:50:39Z |

**DATASET 3 BASE RUN 2 signature** (`dataset3/base-run2.log`) — a **NEW family (P3, L231)**, NOT a member of the pre-committed SIG-FAMILY (error-code identity, not a fixed-point counter deviation):

- `FAIL P6-T1 P3: the quota race — five parallel, two may admit (no over-create) > exactly three fail QUOTA_MEMBER_MAX_INSTANCES (the binding fixture quota)`
- `Error: assertActivationCode: expected ActivationError code 'ACTIVATION_QUOTA_MEMBER_MAX_INSTANCES' but got ActivationError/ACTIVATION_COMPATIBILITY_BLOCKED_FATAL: activation: compatibility could not be established (reprobe-failed) — admission fails closed (invariant 50)` (p6t1-parallel.test.ts:231; `reprobe-failed` = `packages/runtime/compatibility/authority.ts` L154 `REPROBE_FAILED`)
- Run profile (from the other P3 assertions, which PASSED — 1/9 failed): exactly two activations succeeded (L223-225), `errors.length === 3` (L228), final durable state EXACTLY two members / two COMMITTED operations / two distinct child Sessions (L235-239) — **no over-create, invariants preserved**; the sole deviation is that one of the three rejected activations closed `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL` (compatibility reprobe-failed, fail-closed) instead of the quota code.

**DATASET 3 FOLDED RUN 5 signature** (`dataset3/folded-run5.log`) — three failures, two families:

- **P1 ×2** — byte-identical to the proven pre-existing flake: L154 `AssertionError: expected 1 to be +0` (`errors.length` 1-vs-0) + L167 `AssertionError: expected 1 to be 2` (the dataset-1 BASE RUN 3 / reviewer round-1 / dataset-2 FOLDED RUN 4 signature).
- **P2 ×1 — the STOP signature**: `FAIL P6-T1 P2: N=5 same-template parallel activations all succeed (raised quotas) > five activated results, five COMMITTED operations, five members, five child Sessions` — `AssertionError: expected 3 to be +0` (p6t1-parallel.test.ts:193, `errors.length` 3-vs-0 — the spurious-activation-errors class of `p6t1-isolated-run2`'s 2-vs-0, same line, same assertion, one different count).

**Outcome matrix application (binding — executed, no self-adjudication)**:

- (i) requires the P2 signature on BASE (any run: L193 N=5 2-vs-0 assertion class, spurious activation errors) — **NOT met**: the only BASE red is the P3 L231 code-identity class (different test, line, and assertion class).
- (ii) requires BASE 5/5 GREEN — **NOT met** (base run 2 red).
- (iii) AMBIGUOUS — "base red with a different signature" — **MET** ⇒ **HALT push/PR + escalate with the full data** (the escalation carries this record + the folded half + the cumulative cross-dataset picture below; the kit-side Part-2 work continues, as needed on every branch).

**Attribution observations (data for the parent's ruling — NOT self-adjudicated)**:

1. The P3 `reprobe-failed` class is demonstrably **PRE-EXISTING at `0a0a19a6`** (it occurs on the base tree); it cannot be fold-introduced. It is a new family relative to the pre-committed SIG-FAMILY (error-code identity under parallel load; no over-create; final state exact).
2. The **P2 family (L193) REMAINS without ANY base-tree occurrence across the cumulative record** — datasets 1+2+3 base runs: 15 total (base points `06b094ab` ×10, `0a0a19a6` ×5); base reds = P1 ×1 (ds1 run3) + P3 ×1 (ds3 run2); **no P2**. Folded P2 reds on record: the PR #44 adjudication-round full-suite runs 1/2, PR-F `p6t1-isolated-run2` (2-vs-0), dataset-3 FOLDED RUN 5 (3-vs-0).
3. Folded run 5's co-occurrence (P1 ×2 + P2 ×1 in ONE run) is signature polymorphism of the parallel-activation race — noted for the root-cause ruling; not asserted as a new family.
4. Dataset-3 per-run red rate: 2/10 (one per tree, distinct signatures); no run carries reds on both trees.
5. The increment-1 product delta the A/B isolates (non-test, non-dist): `packages/runtime/src/plugin/bound-blueprint.ts` (the parent's prime suspect — the F11 re-land), `packages/runtime/admission/{index,types}.ts`, `packages/runtime/action-router/effects.ts`, `packages/runtime/mutation/*` (cell-provenance et al.), `packages/remote/src/**` (contracts/handlers), `packages/client/src/**` (UI — not on the p6t1 domain path), `packages/tools/src/tools.ts`. The p6t1 domain path (activation → admission → compatibility authority) intersects `admission/` + `action-router/effects.ts` + `src/plugin/bound-blueprint.ts` — the root-cause scope if the P2 family is ruled fold-introduced.

**Worktree states (red-line checks)**:

- **BASE** (scratch `.worktrees/p6t1-ab-ds3-base` @ `0a0a19a6`): `git status --porcelain` empty before AND after the loop (verified 05:50:35Z pre / 05:50:40Z post); HEAD unchanged (`0a0a19a6`); zero tracked-file diff; nothing written into the tree (logs target the PR-F worktree's evidence directory); **DELETED after the loop** (`git worktree remove`) — disclosed here as a sub-artifact of this task; per-log attribution preserved in each raw log's vitest `RUN` header.
- **FOLDED** (`.worktrees/pre-alpha3-prf-closure` @ `3b7039e8`): tracked-file status empty before AND after the loop (verified 05:55:23Z pre / 05:55:29Z post); HEAD unchanged (`3b7039e8`); untracked kit edits present throughout (disclosed per log in the `# NOTE:` line; not imported by the test under run).
- **Dependency-setup disclosure**: the scratch `pnpm install` FAILED in the sandbox (`[ERR_SQLITE_ERROR] unable to open database file` — the pnpm store at `/home/user/.local/share/pnpm/store/v11` is outside the workspace-write sandbox). The scratch `node_modules` was instead a full `cp -a` copy (608M, no hardlinks) from the PR-F worktree — valid because `pnpm-lock.yaml` + every `package.json` are byte-identical between `0a0a19a6` and `3b7039e8` (verified: `git diff 0a0a19a6 3b7039e8 -- pnpm-lock.yaml package.json packages/*/package.json` = empty) and the per-package `node_modules` link trees were copied along. The first base-loop iteration (05:49:4xZ, root-only copy) produced 5× `Cannot find package 'yaml'` import failures (NO TESTS ran — invalid evidence); those five logs were overwritten by the valid loop (05:50:3xZ). The invalid attempt is disclosed here and in `invocations.md`.

---

# DATASET 3B — base-only ×10 (the parent's branch-(iii) combined path, item (2))

## Context

The parent ruling (recorded VERBATIM in the section below) resolved branch (iii) as a COMBINED path: P2 (the unexonerated L193 signature) is resolved by (1) a scoped diff-review of the increment-1 delta (deliverable: a written verdict) and (2) **DATASET 3B — base-only ×10** on a fresh scratch worktree @ `0a0a19a6`. Outcomes (parent's verbatim logic): "ANY base P2 → exoneration by direct observation (overrides the diff-review verdict, F15 precedent) → P2 recorded as A/B-attributed pre-existing; 0/10 base → the diff-review verdict carries (β → debt record; α → my fix ruling)."

## Trees

- **BASE**: scratch worktree `.worktrees/p6t1-ab-ds3b-base` RECREATED @ `0a0a19a603db7ef5c560a05895835462372f5910` (the same base as datasets 1/2/3). `node_modules` = full `cp -a` from the PR-F worktree (the scratch `pnpm install` fails in this sandbox — `[ERR_SQLITE_ERROR] unable to open database file` on the store outside the sandbox — same as the dataset-3 scratch; valid because `pnpm-lock.yaml` + every `package.json` are byte-identical between `0a0a19a6` and `3b7039e8`, verified by empty `git diff` on those paths). The FIRST per-package copy attempt used a broken path-strip loop and produced `cp: cannot create directory` failures into a spurious nested path — fixed with an explicit `cd`-anchored loop before any test ran (disclosed in `invocations.md`); no partial state existed (the fresh checkout had no per-package `node_modules`), verified valid via `pnpm exec vitest --version` (vitest 4.1.11, node v24.21.0) before the loop.
- **Test file**: `packages/runtime/test/p6t1-parallel.test.ts` BYTE-IDENTICAL between the two trees (verified for datasets 3/3b; the A/B protocol).
- **Asymmetry (by design, rationale recorded per the ruling)**: base-only ×10 — the dataset tests the BASE occurrence rate of the unexonerated P2 signature. The folded rate is already recorded (~3/~30 across the full-suite rounds; see the cumulative table). No folded cells in this dataset.

## Cell record (verbatim from the self-embedded logs, `dataset3b/`)

| cell | tree | START (UTC) | result | EXIT |
|---|---|---|---|---|
| base-run01 | base 0a0a19a6 | 2026-09-30T06:02:19Z | 9/9 GREEN | 0 |
| base-run02 | base 0a0a19a6 | 2026-09-30T06:02:21Z | 9/9 GREEN | 0 |
| base-run03 | base 0a0a19a6 | 2026-09-30T06:02:22Z | 9/9 GREEN | 0 |
| base-run04 | base 0a0a19a6 | 2026-09-30T06:02:23Z | 9/9 GREEN | 0 |
| **base-run05** | base 0a0a19a6 | 2026-09-30T06:02:24Z | **1 FAILED / 8 passed — P2** | 1 |
| base-run06 | base 0a0a19a6 | 2026-09-30T06:02:25Z | 9/9 GREEN | 0 |
| base-run07 | base 0a0a19a6 | 2026-09-30T06:02:26Z | 9/9 GREEN | 0 |
| base-run08 | base 0a0a19a6 | 2026-09-30T06:02:27Z | 9/9 GREEN | 0 |
| base-run09 | base 0a0a19a6 | 2026-09-30T06:02:28Z | 9/9 GREEN | 0 |
| base-run10 | base 0a0a19a6 | 2026-09-30T06:02:29Z | 9/9 GREEN | 0 |

**base-run05 = P2 ON THE BASE TREE** — the exact unexonerated signature:

```
 FAIL  packages/runtime/test/p6t1-parallel.test.ts > P6-T1 P2: N=5 same-template parallel activations all succeed (raised quotas) > five activated results, five COMMITTED operations, five members, five child Sessions
AssertionError: expected 2 to be +0 // Object.is equality
- Expected
+ Received
- 0
+ 2
```

(test L193 — `errors.length` 2-vs-0, same N=5 raised-quotas world; log `dataset3b/base-run05.log`).

## Matrix application (the parent's outcome logic)

**ANY base P2 → exoneration by direct observation.** base-run05 IS a base P2 (1/10). Therefore, per the parent's (b)(2) clause (F15 precedent):

> **P2 is EXONERATED by direct observation: A/B-attributed pre-existing on `0a0a19a6`.**

- The diff-review verdict (b)(1) is **OVERRIDDEN** by this direct observation (the parent's verbatim clause: "overrides the diff-review verdict, F15 precedent"). The diff-review's scoped file list (dataset-3 section, observation 5) remains recorded in case a root-cause pass is ever re-adjudicated; no α/β verdict was produced and none is required — the P2 verdict record for the final report is the exoneration reasoning (this section). No product fix was applied or proposed (the α path never triggered; red line: zero product changes from this task).
- Cumulative base P2 record: **1/25** (datasets 1/2/3 = 0/15; dataset-3b = 1/10). The folded record stands as recorded (~3/~30 across the full-suite rounds — the corrected count is settled in the final cumulative table, pending the original-raw-log re-verification ordered by the parent).

## Worktree state

- **BASE scratch** `.worktrees/p6t1-ab-ds3b-base`: `git status --porcelain` empty before AND after the loop; HEAD unchanged (`0a0a19a603db7ef5c560a05895835462372f5910`); **DELETED after the loop** (`git worktree remove --force`, 2026-09-30, post-loop verification: zero `p6t1-ab*` worktrees remain) — disclosed per the ruling ("worktree deleted + disclosed after").
- **FOLDED** (`.worktrees/pre-alpha3-prf-closure`): untouched by this dataset (base-only); untracked kit edits present (disclosed per the dataset-3 record).

---

# PARENT RULING (branch (iii) — received 2026-09-30, recorded verbatim per the ruling's own instruction)

The ruling resolved branch (iii) as a **COMBINED path**. Halt scope CONFIRMED (push/PR + increment-2 commit hold; kit re-run + Part-3 non-p6t1 continue). Dataset-3 record quality ACCEPTED.

**(a) P3** — "P3 reprobe-failed (L231) → FOLD INTO THE KNOWN-DEBT STATEMENT as family P3, NO dedicated root-cause pass." Rationale (verbatim): base-tree property (1/15 base, zero folded occurrences — cannot be fold-introduced); invariants preserved (no over-create; exact counts; deviation = rejection error-CODE identity, quota vs compatibility reprobe-failed, parallel reprobe race at compatibility/authority.ts L154 INV-50 fail-closed); not a gate input (zero-new gate reads FOLDED full runs — none showed P3). Family definition (exact, verbatim): "P3 = L231 code-identity — expected ACTIVATION_QUOTA_MEMBER_MAX_INSTANCES, got ACTIVATION_COMPATIBILITY_BLOCKED_FATAL (reprobe-failed); run profile 2 admitted / 3 rejected / final state exactly 2 members + 2 COMMITTED + 2 child Sessions; invariants preserved in every observed instance; observed base-only so far (1/15)." Guard clause (verbatim): "if P3 appears on the FOLDED tree, re-adjudicate immediately."

**(b) P2** — "COMBINED: (1) SCOPED DIFF-REVIEW root-cause on the increment-1 delta (scope = admission/{index,types}.ts [+335 — verify if types-only/behaviorally inert], action-router/effects.ts, src/plugin/bound-blueprint.ts [+110 F11 re-land], mutation/cell-provenance.ts [A' recordAdmitsCapability — determine concretely whether values.mcp is present/absent in the P2 N=5 fresh-team world], plus any other on-path file with call chain; question = does any on-path change plausibly ADD spurious activation REJECTIONS under N=5 parallel load or alter rejection code identity; verdict forms: (α) specific change + mechanism + PROPOSED fix → REPORT, do NOT apply, parent rules before application + FULL re-verification [static 8 + dual kits fresh-world zero leg move + prf kit green + full-unit ×2 + p6t1 isolated ≥5]; (β) per-file exoneration → P2 recorded as known debt with attribution note; deliverable = WRITTEN VERDICT, no product changes) + (2) DATASET-3B base-only ×10 (recreate scratch @ 0a0a19a6, same self-embedded protocol, labeled `# p6t1-parallel A/B — DATASET 3B, run N (TREE: base)`, evidence into `p6t1-ab-attribution/dataset3b/`, HEAD verified pre/post, worktree deleted + disclosed after; ASYMMETRIC by design — rationale to be recorded in invocations.md)." Outcomes (verbatim): "ANY base P2 → exoneration by direct observation (overrides the diff-review verdict, F15 precedent) → P2 recorded as A/B-attributed pre-existing; 0/10 base → the diff-review verdict carries (β → debt record; α → my fix ruling)."

**ALSO (binding, verbatim):** "BEFORE the final cumulative table: RE-VERIFY the 'PR#44 adjudication full-suite 1/2' P2 attribution from the ORIGINAL raw log (cite evidence path + line) — the cells-copied-from-raw-logs protocol applies to the cumulative table; if that run was actually P1-family, correct the P2 folded count (2, not 3) in the appended table (append a correction line; do not edit dataset-1/2 rows)."

**(c)** — "YES, covered by (2) = dataset-3b ×10."

**KNOWN-DEBT STATEMENT (final form, verbatim, per the ruling)** — lands in the increment-2 log entry + this AB-ATTRIBUTION.md append once the P2 branch resolves: "p6t1-parallel = KNOWN DEBT (concurrency timing-flake family, A/B-attributed): P1 [L154 errors.length 1-vs-0 + L167 committedOps 1-vs-2, N=2], P2 [L193 errors.length >0 (observed 2-3 vs 0), N=5 raised quotas — <attribution per branch outcome>], P3 [L231 code-identity quota-vs-reprobe-failed, base-only so far, invariants preserved]. Cumulative A/B record: datasets 1/2/3/3b (paths). Zero-new gate = folded full-run failure set ⊆ {9F|19F exact baseline} + this debt family on isolated p6t1 reruns (≥5, per F.6 '并发/重启相关 flaky suite 独立多次复跑'). Guard clauses: any NEW signature beyond P1/P2/P3 = STOP; any P3 on folded = re-adjudicate."

**At the recording moment (dataset-3b complete), the P2 attribution slot resolves to:** "A/B-attributed pre-existing by direct observation on 0a0a19a6 (dataset-3b run05: L193 2-vs-0; cumulative base 1/25)."

**SEQUENCING (binding, verbatim):** 1. NOW: start dataset-3b (bg) + kit fresh-world re-run (done). 2. While running: diff-review. 3. On kit GREEN: Part-3 (20-scenario mapping table from fresh runs, LONG SMOKE plan L1112-1122, F.5 docs + 5 DEFERRED) — p6t1-independent, continue freely. 4. Increment-2 commit + push + PR ONLY after: P2 branch resolved (exonerated OR fix applied+verified) + dataset-3b complete + debt statement final. 5. Both diff --check ranges (0a0a19a6..HEAD AND 46929e6d..HEAD) → FF push → PR (DO-NOT-MERGE) → final report (add: the P2 verdict record [α/β + mechanism or exoneration reasoning], dataset-3b table, the corrected cumulative P2 count, the G8 latent-bug fix).

"Red lines unchanged. Record this ruling VERBATIM in the increment-2 log entry (parent ruling on P2/P3: combined branch, scoped diff-review, dataset-3b, family definitions, guard clauses). Go."

---

# KNOWN-DEBT STATEMENT (FINAL — P2 branch resolved by dataset-3b exoneration)

p6t1-parallel = KNOWN DEBT (concurrency timing-flake family, A/B-attributed): P1 [L154 errors.length 1-vs-0 + L167 committedOps 1-vs-2, N=2], P2 [L193 errors.length >0 (observed 2-3 vs 0), N=5 raised quotas — A/B-attributed pre-existing by direct observation on 0a0a19a6 (dataset-3b run05: L193 2-vs-0; cumulative base 1/25)], P3 [L231 code-identity quota-vs-reprobe-failed, base-only so far, invariants preserved]. Cumulative A/B record: dataset-1 (`dataset1/`), dataset-2 (`dataset2/`), dataset-3 (`dataset3/`), dataset-3b (`dataset3b/`) — paths under this directory. Zero-new gate = folded full-run failure set ⊆ {9F|19F exact baseline} + this debt family on isolated p6t1 reruns (≥5, per F.6 '并发/重启相关 flaky suite 独立多次复跑'). Guard clauses: any NEW signature beyond P1/P2/P3 = STOP; any P3 on folded = re-adjudicate.

**P2 verdict record (for the final report — exoneration reasoning per the parent's clause "α/β + mechanism OR exoneration reasoning"):** the diff-review verdict (b)(1) is OVERRIDDEN by direct observation per the parent's (b)(2) verbatim clause ("ANY base P2 → exoneration by direct observation (overrides the diff-review verdict, F15 precedent)"): dataset-3b base-run05 (0a0a19a6, scratch worktree, self-embedded log `dataset3b/base-run05.log`) reproduced the exact unexonerated signature (L193 `expected 2 to be +0`, N=5 raised quotas) ON THE BASE TREE — therefore P2 is A/B-attributed pre-existing (fold-introduction excluded: the signature occurs where the increment-1 delta is absent). No product fix applied or proposed (α never triggered; zero product changes from this task). The diff-review scoped file list (dataset-3 section, observation 5) is preserved should a root-cause pass be re-adjudicated.

---

# RE-VERIFICATION — "PR#44 adjudication full-suite 1/2" P2 attribution (ordered by the parent, BEFORE the final cumulative table)

Protocol applied (parent, verbatim): "RE-VERIFY the 'PR#44 adjudication full-suite 1/2' P2 attribution from the ORIGINAL raw log (cite evidence path + line) — the cells-copied-from-raw-logs protocol applies to the cumulative table; if that run was actually P1-family, correct the P2 folded count (2, not 3) in the appended table (append a correction line; do not edit dataset-1/2 rows)."

**Original raw logs located** (PR #44 adjudication-round full-suite pair — the two runs recorded in the prior cumulative record as "the adjudication-round full-suite runs 1/2"):

- `dev/agent-workflow/evidence/pre-alpha3-refactor/pr-e/pf1-fix-gates/suite-run1.log` — executed in the PR #44 tree (vitest `RUN v4.1.11 /home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-pre-e-requirement-recovery`).
- `dev/agent-workflow/evidence/pre-alpha3-refactor/pr-e/pf1-fix-gates/suite-run2.log` — same tree, same invocation.

(Paths cited as found in both the pre-e and f15 worktree copies — the evidence directory is identical in both; the PR-F worktree's copy is the committed one.)

**suite-run1.log (run 1 of 2):**
- L341: `✓ packages/runtime/test/p6t1-parallel.test.ts (9 tests) 7ms` — **p6t1-parallel GREEN (9/9)**
- Summary: `Test Files  9 failed | 390 passed (399)` / `Tests  19 failed | 4595 passed (4614)` — the EXACT 9F|19F baseline, zero deviation.

**suite-run2.log (run 2 of 2):**
- L543: `❯ packages/runtime/test/p6t1-parallel.test.ts (9 tests | 1 failed) 12ms`
- L1425: `FAIL  packages/runtime/test/p6t1-parallel.test.ts > P6-T1 P2: N=5 same-template parallel activations all succeed (raised quotas) > five activated results, five COMMITTED operations, five members, five child Sessions`
- L1426: `AssertionError: expected 4 to be +0 // Object.is equality`
- L1434: `❯ packages/runtime/test/p6t1-parallel.test.ts:193:31` — **the P2 fixed-point counter (`errors.length`), line 193 — the P2 family, NOT the P1 family** (P1 = L154 errors.length 1-vs-0 + L167 committedOps 1-vs-2, the N=2 world; no P1 test failed in either run)
- L1557-1558: `Test Files  10 failed | 389 passed (399)` / `Tests  20 failed | 4594 passed (4614)` = exact 9F|19F baseline + exactly 1 (the P2 test); the non-p6t1 failure identity verified cell-by-cell = the exact baseline set (t1-capability-schema 9 / t2-blueprint-hash 1 / d3-member-identity-context 1 / p6t3-mediation 5 / p6t3-restart 2 / p6t6-actions 1 + file-level p8s3b-result-effects / t12a-b2-child-identity / t12a-glue-handoff-ports).

**VERDICT: the P2 attribution is CONFIRMED from the original raw log.** The single p6t1-parallel failure across the adjudication full-suite pair is the P2 family (L193:31, `errors.length` 4-vs-0, the N=5 raised-quotas test) on RUN 2. It was NOT P1-family. Therefore:

1. **The folded P2 count STAYS 3** (no correction to 2): (1) PR #44 adjudication full-suite — `suite-run2.log` P2 L193:31 (this re-verification) + (2) PR-F `p6t1-isolated-run2` (L193 2-vs-0) + (3) dataset-3 FOLDED RUN 5 (L193 3-vs-0).
2. **Correction line for the cumulative table (appended, per the order — no dataset-1/2 rows edited):** the prior record's label "adjudication-round full-suite runs 1/2" (implying both runs failed) is imprecise per the raw logs — **run 1 of the pair was the EXACT 9F|19F baseline with p6t1-parallel GREEN (L341); only run 2 (of the 2) carried the p6t1 failure, and it was the P2 family (L193:31, 4-vs-0)**. The occurrence count from this pair is 1 (not 2); the cumulative folded P2 count is unaffected (3) because the prior record already counted this pair as one P2 occurrence.
3. **Observed-value range refinement (family identity unchanged):** the L193 `errors.length` counter has now been observed at 2 (PR-F isolated-run2; dataset-3b run05), 3 (dataset-3 folded-run5), and **4** (this re-verified suite-run2) — the family is defined by test + line + counter (not by a specific value), consistent with the known-debt statement's "errors.length >0".
