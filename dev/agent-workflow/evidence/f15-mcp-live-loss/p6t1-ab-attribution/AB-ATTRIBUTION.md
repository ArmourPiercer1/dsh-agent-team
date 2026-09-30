# p6t1-parallel A/B attribution — PR #44 round-1 (2026-09-30)

## Context

PR #44 round-1 independent review (qiyuan-inter/gpt-6-sol) = FAIL, exactly ONE major: the reviewer's mandated p6t1-parallel isolation rerun was RED on the reviewer's run — `pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts` => **2/9 failed (p1.errors.length 1 vs 0; committedOps/memberCount/distinctChildren 1 vs 2 — the classic timing-race signature)**. Parent adjudication (gate semantics, not a re-litigation of the finding): the sufficiency test for "known flake, not a regression" = **A/B attribution against the base tree** — a folded-tree p6t1 failure is exonerated ONLY if the identical signature family reproduces on the base tree (the standing baseline carve-out "p6t1-parallel flaky ~1/3, run isolated if it appears" made precise).

## Pre-committed signature family (SIG-FAMILY, no discretion)

p6t1-parallel **parallel-activation timing race**: any failure in `packages/runtime/test/p6t1-parallel.test.ts` where one of the fixed-point counters `{errors.length, committedOps, memberCount, distinctChildren}` in any of the N-parallel-activation describe blocks (P1–P4) deviates from its expected value — i.e. incomplete commit/member/child fan-out under parallel activation. All prior occurrences (the reviewer's round-1 fold-tree red; the adjudication-round full-suite runs 1/2 P2 L193 failures) are members of this family.

## Trees, invocation, identity

- **FOLDED**: `.worktrees/f15-mcp-live-loss` @ `4940b5e2` (PR #44 head at run time)
- **BASE**: `.worktrees/pre-alpha3-pre-e-requirement-recovery` @ `06b094ab` (pre-e tip = PR #44 base)
- Invocation (identical): `pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts`
- Test-file identity: `git diff 06b094ab 4940b5e2 -- packages/runtime/test/p6t1-parallel.test.ts` = **empty (byte-identical)** → the A/B isolates the fold delta only.

## Run-by-run (2026-09-30, UTC; full logs = folded-run1..5.log / base-run1..5.log)

| run | FOLDED @ 4940b5e2 | BASE @ 06b094ab |
| --- | --- | --- |
| 1 (01:28:50 / 01:29:13) | GREEN 9/9, exit 0 | GREEN 9/9, exit 0 |
| 2 (01:28:51 / 01:29:14) | GREEN 9/9, exit 0 | GREEN 9/9, exit 0 |
| 3 (01:28:52 / 01:29:15) | GREEN 9/9, exit 0 | **RED 2/9, exit 1** — P1 ×2 (below) |
| 4 (01:28:53 / 01:29:16) | GREEN 9/9, exit 0 | GREEN 9/9, exit 0 |
| 5 (01:28:54 / 01:29:17) | GREEN 9/9, exit 0 | GREEN 9/9, exit 0 |

**BASE RUN 3 signature** (`base-run3.log`):

- FAIL `P6-T1 P1: N=2 same-template parallel activations both succeed > two activated results with distinct instance ids and child Sessions` — `p6t1-parallel.test.ts:154 expect(p1?.errors.length).toBe(0)` → **Received 1**
- FAIL `P6-T1 P1: N=2 same-template parallel activations both succeed > two COMMITTED operations, two members, two distinct child Sessions` — `p6t1-parallel.test.ts:167 expect(p1?.committedOps).toBe(2)` → **Received 1** (memberCount/distinctChildren are the same test's next assertions — 1 vs 2 family)

→ **byte-identical signature to the reviewer's fold-tree red**: same 2 tests, same lines (154/167), same values (1 vs 0; 1 vs 2), same count (2/9). The BASE tree (which by construction contains none of the F15/fold code) independently reproduces the failure.

**FOLDED 5/5 green note**: the flake is intermittent (isolated-mode rate observed on this host ≈ 1/5 over the BASE loop; folded-tree occurrences on record = the reviewer's round-1 red on the same code + the adjudication-round full-suite runs 1/2 with 3 and 1 same-family failures). A 5/5 green streak does not exclude an intermittent flake (P(5 green | rate 1/3) ≈ 13%).

## Attribution (pre-committed rule, no discretion)

IDENTICAL signature family on both trees (folded: the reviewer's red on 4940b5e2 code + same-code full-suite reds; base: BASE RUN 3) ⇒ **pre-existing known flake, A/B-proven** ⇒ the zero-new gate stands: full-run failure set = exact 9F/19F + the A/B-attributed p6t1-parallel flake; the adjudication-round full-suite run-2 exact-9F/19F green run stays the confirmation of record.

## Gate-confirmation run

Confirmation of record = **FOLDED RUN 1** (`folded-run1.log`, 2026-09-30 01:28:50Z, @ 4940b5e2, GREEN 9/9, exit 0 — a fresh green isolated run on the pushed tip itself); runs 2–5 green as well (`folded-run2..5.log`).

## Worktree states (red-line checks)

- FOLDED: `git status --short` empty before and after the loop (no untracked scratch).
- BASE (pre-e worktree): `git status --porcelain` empty before AND after the loop; HEAD unchanged (`06b094ab`); zero tracked-file diff; nothing committed; the run produced no untracked scratch (the vitest cache lives inside the gitignored `node_modules`). Pristine after run, as mandated.
