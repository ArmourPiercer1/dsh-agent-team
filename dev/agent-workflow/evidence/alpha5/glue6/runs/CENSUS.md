# GLUE-6 root vitest census — double capture

Tree: branch `alpha5-glue6-fix`, fix commit `3b1b515f` (base master
`230022598dc96a377e25039bb55a27776a682552`), full `pnpm -r run build` run first
(that build changed ZERO tracked bytes — the committed install surface is what a
real build produces).

| capture | command | files | legs | red files | red legs | duration | sha256 |
|---------|---------|-------|------|-----------|----------|----------|--------|
| 1 | `pnpm exec vitest run` | **563** | **7091** | 4 | 9 | 129.71s | `2a5a68dedf7927cb…` |
| 2 | `pnpm exec vitest run` | **563** | **7091** | 4 | 9 | 132.92s | `497d5ee272a70f83…` |

**Red identity: cap1 == cap2, byte-identical title sets, and equal to the
published 9-red baseline (`nine-root-2162f6a7.md`) exactly:**

- `packages/runtime/test/p6t3-mediation.test.ts` × 5 (legs 1, 3, 4, 5, 7)
- `packages/runtime/test/p6t3-restart.test.ts` × 2 (legs 2, 5)
- `packages/tools/test/p6t6-actions.test.ts` × 1 (worker → leader direct delivery)
- `packages/domain/test/t2-blueprint-hash.test.ts` × 1 (absent optional singles → explicit null)

NEW reds from this round: **0**. Counts vs the GLUE-5 census (562 files / 7086
legs): **+1 file / +5 legs = exactly this round's new unit suite**
`packages/runtime/test/a5g6-install-face-render.test.ts` (5 legs, all green).

Full logs: [`census-capture-1.log`](census-capture-1.log),
[`census-capture-2.log`](census-capture-2.log).

## Disclosed capture that was DROPPED (rig environment, not a code red)

The FIRST capture pair was run before building every package in this worktree and
showed a **10th** red: `packages/testkit/test/a4p7-merge-gate.test.ts > the
composition smoke leg > is green …` with
`FAIL client plugin (packages/client): built entry is missing — run pnpm build
first`. That is this worktree missing gitignored build output
(`packages/client/dist`, `.gitignore:28 dist/`), not a behaviour change: after
`pnpm -r run build` the same suite is **35/35 green** (including its
carries-build leg) and the capture pair above is the honest record. The two
discarded logs are not committed (they describe a rig state this evidence does
not claim).
