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
