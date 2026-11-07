# Stage 2 — A6 product stack + A5/A6 joint Preview

- Date: 2026-11-08 (local)
- Scope: isolated stack/preview only. No master merge, no un-draft, no
  production enablement, no release, no change to the Alpha.6 default opt-in.

## 1. Refreshed baseline and refs

`git fetch origin --prune` moved `origin/master` from `fed66fbd8` to:

| ref | exact SHA | note |
|---|---|---|
| `origin/master` | `c8af5fc6f0b5d157e81a1521e57383f4a0dfe0a3` | #663 ARGV-ERRATA, 2026-11-08 |
| base | `8067f631f37f233977d508b78809be067615211c` | unchanged A5/A6 merge-base |
| A5 commits since base | 119 | recomputed after fetch |
| A6 commits since base | 283 | unchanged |
| `archive/a6-int-20261108` | `e2135cb4e8b0452ca07edadb46b0ca1f121057f2` | original A6 docs HEAD preserved |
| `alpha6/stack-20261108` | `bf2d693c85856f3c6c0a286e02270e146d0bb71f` | 9 product + 1 docs/evidence |
| `preview/alpha5-alpha6-rc1` | `0e5528b98aa69fdda671c8aae16f9631e8735699` | **merge commit** of A5 + A6 stack; later commits on this ref are evidence-only |
| original product HEAD | `54f39e09d` | preserved in archive |
| original docs HEAD | `e2135cb4e` | preserved in archive |

Preview merge parents: first `c8af5fc6f` (A5), second `bf2d693c8` (A6 stack).

New branches were pushed as Draft refs; no force-push, no update to
`alpha6/int-20261103`, no master write.

## 2. G1–G9 + D1

All commits are on `alpha6/stack-20261108` after `c8af5fc6f`.

| slice | commit | files | lines | test evidence |
|---|---|---:|---:|---|
| G1 grammar/router | `4bb14410a` | 18 | +1450/−2 | 25 passed |
| G2 ReviewCapability | `161426de4` | 6 | +646/−0 | 12 passed |
| G3 case chain | `ee2059faf` | 35 | +2434/−78 | 4 passed |
| G4 current-leg transfer | `919148529` | 15 | +1211/−14 | 5 passed |
| G5 wake coordinator | `9ded0c2b5` | 7 | +1687/−0 | 44 passed |
| G6 wake delivery/inbox | `bfac1d5d2` | 10 | +551/−229 | 6 passed |
| G7 Officer access | `61ce7b54c` | 20 | +714/−66 | 3 passed |
| G8 PR6 + integration consolidation | `7554d047d` | 187 | +14022/−388 | 35 passed |
| G9 closing settlements/result | `40b6b4b01` | 98 | +3690/−294 | 106 passed |
| D1 docs/evidence | `bf2d693c8` | 418 | +53478/−0 | n/a (docs only) |

Per-slice targeted tests were run at each detached commit in a separate
worktree; raw logs are `slice-g1.log` … `slice-g9.log`.

Important boundary disclosure: G1–G7 are the first landing states of their
logical slices. G8 is deliberately the **PR6 + integration-consolidation**
slice and therefore also carries the later review-P0/final refinements that
touch earlier lanes; it is not a pure PR6-only diff. This is why the sum of
the slice diffs is larger than the final product diff and why each slice was
tested at its own commit rather than inferred from the final tree.

## 3. Semantic overlap review

The six A5/A6 shared files were merged deliberately, not by taking one side:

| file | combined behavior | residual difference vs A6 |
|---|---|---|
| `packages/domain/blueprint/src/index.ts` | A6 v5 grammar/router exports plus A5 v4 member-ceiling exports | +4 A5 export lines |
| `packages/runtime/src/plugin/host.ts` | A5 `a5sfRealmProvider`/lazy realm provider plus A6 turn-latch events | +98 A5 lines |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | A5 `a5sf` realm mount/disposer plus A6 `onExecutionResult` callback | +580/−11 A5-side replacements |
| `packages/runtime/src/plugin/root.ts` | A5 `closeNewWork`/`reopenNewWork` plus A6 owner stamp/settlement/execution-result | +13/−5 A5 replaces A6 no-op |
| `packages/runtime/src/plugin/types.ts` | A5 `a5sfEvidencePath`/`a5sfMemberPolicies` plus A6 `alpha6ReviewRouting`/wake/latch types | +223 A5 lines |
| `packages/runtime/tsconfig.json` | A5 `controlled-fs`/`sandbox-provider`/`member-io-policy`/`team-services`/`team-sandbox` plus A6 `review-router`/`review-authority`/`review-wake`/`alpha6` | +7/−2 A5 lanes |

Verification that both sides survive:

- A5: `a5sfRealmProvider` is read at `host.ts:2393`; `mountMemberA5sfRealm`
  and realm row disposer are imported at `agent-bindings.mjs:492`;
  `closeNewWork`/`reopenNewWork` are live at `root.ts:2201/2204`;
  `a5sfEvidencePath`/`a5sfMemberPolicies` remain in `types.ts`.
- A6: `alpha6ReviewRouting` is read in `root.ts:2444/2454`; owner settlement
  and `executionResults` are at `root.ts:2883/3183`; the execution-result
  callback is at `agent-bindings.mjs:3209`; `parseBlueprintV5` and
  `BLUEPRINT_V5_*` remain exported from blueprint `index.ts`.
- The merged tree typechecks (`typecheck.log`, all packages clean).

`SESSION_ROUTER_LOG.md` was kept on the A5 side as the append-only log; A6
run evidence is consolidated separately under `dev/agent-workflow/evidence/`.
Dist was rebuilt from the merged source, never hand-merged; the source maps
that conflicted in the dry run were discarded and regenerated.

`arc-a-protected-center.json` now has 31 overrides: the A5 and A6 named
bookings plus one **combined-tree** override for
`agent-bindings.mjs` sha256 `164c42491f466c470e000d108ece0e835f556f46fc0bdaff8e7b239d0fb53ad1`.
`u6-arc-a-fitness.test.ts` passes 12/12 on the final tree.

The A6-era blueprint-fence baseline (10 identities) and A6's removal of the
stale `a5-m1-auth-bridge.test.ts::L1264::v2` adjudication were applied to the
combined tree; both testkit fence tests then pass.

## 4. Tree parity with original A6 `54f39e09d`

Scope: the 100 source/test/script/ledger files A6 changed since `8067f631f`
(excluding generated dist).

| result | count |
|---|---:|
| A6-changed product files present in stack | 100 / 100 |
| byte-identical to A6 | 93 |
| intentional combined-tree differences | 7 |

The 7 differences are exactly the six shared files above plus
`dev/agent-workflow/ledgers/arc-a-protected-center.json` (A5 + A6 + combined
booking). There is no A6-only product file missing and no A6 product change
silently dropped. A5-only files (for example `a5sf-*` suites and
`team-sandbox/src`) are additionally present, as expected for a union tree.

Generated artifacts: `artifacts-at-head` passed with 2072 files compared,
drift 0, and the committed surface is a fresh build of itself. No `.map`
file was hand-merged.

## 5. Tests and gate

- Per-slice: 240 targeted tests passed across G1–G9.
- A6 final suites on Preview: 277 tests passed (90 in G1–G5 set + 187 in
  G6–G9/ARC set).
- Typecheck: all packages clean.
- Testkit fence/merge-gate: 108/108 after the test-use symlink and stale
  adjudication correction.
- Full gate at `0e5528b98` and again at the evidence tip: **8/9 PASS**. The only failing leg is census,
  with exactly one NEW RED:

  `packages/runtime/test/a5sf-os-runner.test.ts::P1-07 ... refuses a
  network-deny policy when the backend cannot enforce it` — expected
  `ENFORCEMENT_UNAVAILABLE`, got `ok:true`.

  This is **pre-existing on Alpha.5 `c8af5fc6f`**, not caused by the A6
  stack: the same test fails identically in a clean A5 checkout on this
  host because the kernel's Landlock ABI can enforce network isolation, so
  the test's "backend cannot enforce" premise is no longer true here. It is
  disclosed, not waived. Census `newCollections=0`.
- Artifact drift: 0.

## 6. Real Host behavior

Command (isolated worktree/HOME/ports):

```
C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 \
node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --host-port 3902 --mock-port 3903 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/a6-preview-host-r1" --keep
```

Result: real Host 0.2.0-rc.2 booted, explicit `alpha6ReviewRouting` v5 row,
**A6-1…A6-6 all PASS**: `wakes=3 leaderWakes=0 resolves=1 executed=true
requests=2 decisions=2 consumptions=2 pending=0`. The Member ask produced a
model-visible Officer wake; the Officer resolved via
`team_resolve_control`; the original command executed once; no pending leg.
Raw evidence is under `dev/agent-workflow/evidence/a6-preview-host-r1/`.

Not claimed: the run's summary does not read a durable `execution-result`
fact (the A6 open gap on the normal lane remains). This is an open risk, not
a PASS row.

## 7. Open compatibility / acceptance risks

1. **A5 census baseline vs this host**: one environmental red
   (`a5sf-os-runner` network-deny) exists at the A5 base itself; a clean
   A5 gate on this host is not 9/9 either. Not a stack regression.
2. **Automatic `succeeded` execution-result fact**: still not proven on the
   normal real-Host allow lane; only unknown/invalidation paths are covered.
3. **ACCEPTED-but-never-CLAIMED Inbox crash matrix**: unchanged/open.
4. **G8 consolidation breadth**: final review-P0 fixes live in G8 rather
   than being distributed back into G1–G7; slice ownership is documented but
   a line-level reviewer must use the original archive for final blame.
5. **A5 master is moving**: Preview is pinned to `c8af5fc6f`; the later A5
   independent merge/retarget must re-run this semantic review and the gate.
6. **No independent review yet**: Preview remains Draft / DO-NOT-MERGE.
