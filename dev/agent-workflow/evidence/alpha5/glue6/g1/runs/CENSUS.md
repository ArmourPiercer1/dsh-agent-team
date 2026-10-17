# ALPHA5-G1 root vitest census — double capture

Tree: branch `alpha5-g1-denyfix`, final HEAD `dcf71bdb` (RED `ef8cb081` → fix
`7605d5a6` src+dist-mirror-same-commit → success-arm pin `dcf71bdb`), base master
`fe829038`. Full `pnpm build` + `pnpm build:composition` had been run in this
worktree before the captures (the `check:artifacts-at-head` drift=0 gate demands
the committed mirror IS a fresh build of itself); that build emits only
tracked-mirror bytes plus gitignored `packages/client/dist`.

| capture | command | files | legs | red files | red legs | duration | sha256 |
|---------|---------|-------|------|-----------|----------|----------|--------|
| 1 | `pnpm exec vitest run` | **563** | **7097** | 4 | 9 | 129.23s | `f175fbd6dd4b86b34a1b0e66…` |
| 2 | `pnpm exec vitest run` | **563** | **7097** | 4 | 9 | 127.71s | `c28f1f61934219827f3ed5d8…` |

**Red identity: cap1 == cap2, byte-identical arithmetic and title sets, and the
red set equals the published 9-red baseline (GLUE-6 CENSUS) exactly:**

- `packages/runtime/test/p6t3-mediation.test.ts` × 5 (legs 1, 3, 4, 5, 7)
- `packages/runtime/test/p6t3-restart.test.ts` × 2 (legs 2, 5)
- `packages/tools/test/p6t6-actions.test.ts` × 1 (worker → leader direct delivery)
- `packages/domain/test/t2-blueprint-hash.test.ts` × 1 (absent optional singles → explicit null)

NEW reds from this round: **0**. Counts vs the base census (562 files / 7086
legs): **+1 file / +11 legs = exactly this round's new suite**
`packages/runtime/test/alpha5-g1-deny-lane.test.ts` (11 legs, all green,
present in both captures as `✓ … (11 tests)`).

## Disclosed captures that were DROPPED (rig environment, not code reds)

1. **Scratch-contaminated pair (discarded, logs overwritten):** one full-suite
   capture was interrupted (`job_kill`) mid-run for queue reasons; vitest
   workers died before their `afterAll` cleanup and leaked
   `packages/testkit/test/.tmp-fault/` scratch dirs. The NEXT capture pair then
   showed a spurious `control-guard-coupling.test.ts` COLLECTION error
   (`team_domain already exists … 10 stamp rows`, a pre-existing shared-basename
   scratch race in `p6t1-helpers.createP6T1World`, a file this round never
   touches) plus 9 reds / 7095 legs. Clearing the pure-gitignored scratch base
   and re-running produced the clean pair above. This is a PRE-EXISTING test
   hygiene race under interrupted runs, recorded here as a side observation,
   NOT fixed in this lane.
2. **The base-capture window saw two extra reds** (`a3p3-governance-lane-hygiene
   > ONE audited consumer set`, `rc2-sanitize-evidence > S13` — the latter a
   5000 ms timeout flake) during a period of concurrent kit/live-leg load; both
   are green in the quiet final pair (4/4 legs across the two captures). The
   honest identity claim is therefore: the FINAL pair is cap1==cap2 == published
   9-red baseline, and the two window-flakes are disclosed, not hidden.
3. **`a4p7-merge-gate > composition smoke leg`** was RED at base in the
   18:2xZ window capture (`packages/client/dist` absent — this worktree had
   never been built) and is GREEN from the first build onward: a gitignored
   build-output state, not a behaviour change. The GLUE-6 CENSUS disclosed the
   identical rig phenomenon; same disclosure standard applied here.

Full logs: [`census-capture-1.log`](census-capture-1.log),
[`census-capture-2.log`](census-capture-2.log).
