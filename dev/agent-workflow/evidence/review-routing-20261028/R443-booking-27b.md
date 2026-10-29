# R443 booking review — tail commit 193dcbff2 (p4t6 census booking)

**Reviewer seat (disclosed):** qiyuan-self / qwen3.8-27b (this review executed on the qwen3.8-27b model; read-only scope, worktree `.worktrees/rr-443b` removed at end). Scope: the single tail commit only — the PR code itself already passed full review.

**Verdict: PASS — zero findings.** The tail commit is exactly the ritual's "add one JSON, edit nothing"; the booking matches the current u7-w0 ledger schema, books exactly the one real scannable file this branch added, collides with no master booking, and the p4t6 suite is green (20/20) measured in a fresh detached worktree.

## Findings (≤5 lines)

- (none)

## Checks

1. **Tail commit is only the JSON.** `git log origin/task/u7r1-audit-hardening-20261029 --oneline -3` → head `193dcbff2 ci(census): book the u7-r1 audit-spec scannable increment …`, parent `6c37f76e7` (the merge-base refresh under which the PR code was already reviewed). `git show 193dcbff2` = one new file, `packages/testkit/test/p4t6-bookings/u7r1a.json` (13 lines), nothing else.
2. **Ritual shape (u7-w0).** Closed key set in `load-bookings.mjs` KEYS; JSON uses only `schema, lane, paths, expectedDelta, reason, tieNote` — no invented key. `schema="p4t6-booking/1"`; lane `U7R1A` non-empty, file `u7r1a.json` = `lane.toLowerCase()` (LANE_FILE grammar + loader filename check pass); `paths` non-empty `packages/**`; `expectedDelta {from:1389, to:1390}` integers, `to≥from`; tie holds: `paths.length 1 === 1390−1389`. Ritual prose (test file L42-45) requires measuring "scanner counts `<to>`, ledger derives … = `<from>`" with the file unbooked; `tieNote` records exactly that at head `6c37f76e7`: "scanner counts 1390, ledger derives 983 + 406 = 1389" (983 = `P4T6_BASE`, 406 = then-summed bookings) — measured, not copied from a chain value.
3. **Path list exact.** `git diff origin/master...origin/task/… --name-status` → `A packages/runtime/test/u7-agentstate-fs-store-audit.test.ts`, `A packages/testkit/test/p4t6-bookings/u7r1a.json`, plus `M` (in-place, not increments) on the src and dist copies of `fs-state-store.mjs`. Booking's `paths` = exactly the one real scannable spec added; the booking file lives in the ledger's own directory; the src edit is on an already-counted file. No over/under-booking (scanner's exact-total + booked-but-present legs confirm).
4. **Scanner run (mine).** Detached worktree at `193dcbff2`, root `node_modules` symlinked, `cd packages/testkit && ../../node_modules/.bin/vitest run test/p4t6-session-event-scan.test.ts` → `Test Files 1 passed (1) / Tests 20 passed (20)`.
5. **No master collision.** `diff <(git ls-tree … origin/master) <(… 193dcbff2)` of `p4t6-bookings/` → only `> u7r1a.json`; `git grep -e U7R1A -e u7r1a -e u7-agentstate-fs-store-audit origin/master -- packages/testkit/test/p4t6-bookings/` → empty; `U7R1A` absent from master's lane list → no same-lane, no path overlap.
6. **PR body root-cause section.** Appended: `## census reds root cause + booking (2026-10-29)` — names the process miss (original PR added its scannable file without the INCREMENT BOOKING RITUAL → 6 reds: coverage + 5 ledger-sensitivity controls), states the ritual performed, the measured unbooked numbers, and that p4t6 is 20/20 after booking (independently reproduced in check 4).
