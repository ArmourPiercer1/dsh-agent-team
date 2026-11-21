# The 16 migrated capability suites — measured, not assumed

**Measured:** 2026-11-22 (round 30) on `vnext/a1-cut`.
**Command:** `node <main-worktree>/node_modules/.pnpm/vitest@…/vitest.mjs run <the 16 files in
migrated-entry-imports.json>` from this worktree.
**Before this round:** 238 tests, **230 passed, 8 failed** across 7 files.
**After the `resolvePaMount` fix:** 238 tests, **233 passed, 5 failed** across 5 files.

The prior state of this evidence was `migrated-entry-imports.json` with `"missing": []` — i.e. the files
IMPORT the new entry (`vnext/root.js` / `vnext/agent-bindings.mjs`). That is an import migration, not a
behaviour migration, and nothing had ever RUN them: `vitest` in this worktree's `.bin` points at a
deleted sibling worktree's `node_modules`, so the suite looked un-runnable. It runs from the main
worktree's install. This file records what that revealed.

## Fixed in this round

**`ReferenceError: resolvePaMount is not defined`** (f15-mcp-live-loss L4 + L7, 2 tests). The A1 cut
retired `pa-mount-registry.mjs` — including the `publishPaMount`/`revokePaMount`/`resolvePaMount` index —
but `publishAuthorityGeneration` in the new `agent-bindings.mjs` still CALLED it. On any path that
publishes an authority generation the module threw. It is now an optional seam
(`resolveMemberMount(teamRoot, memberInstanceId)`): when wired, the refresh works as before; when not
wired, the publish is skipped with an explicit observation and `{refreshed: false, reason: 'no-mount-seam'}`
instead of a crash. **Not claimed:** the product wires no mount seam today, so the authority-generation
refresh cannot fire in the assembled product — that is a C-stage wiring item, now visible instead of
fatal.

## The five that remain (classified, with the action each needs)

| # | suite / leg | failure | class | action |
| --- | --- | --- | --- | --- |
| 1 | `a3p4-pr4-production-entry-regression` "E3 — REAL createAgentBindings consumes a FILLED plane ref" | `the glue installed a pre-execute leg on tpl-a: expected 0 to be greater than 0` | **BEHAVIOUR** — a real capability the old entry installed and the new one does not (the BLOCK-5 decision side) | the centre installs its admission leg through `installMemberExecution`; this leg asks whether the glue itself installs one. Decide whether the new composition owes a glue-level leg or whether the test pins the retired shape — decide with evidence, do not edit the expectation first |
| 2 | `a3p5-permission-read-wiring` group A | `projection referenced outside lane+wire seam: …` | **LAYOUT PIN** on the old root's imports | the pin must be re-expressed against the new root; the seam law itself should survive |
| 3 | `a4p6-start-gate-entrances` BLOCKER 1 | `expected '…P8-S5A — the production root …' to contain "from './s6-remote.js'"` | **LAYOUT PIN** — source-text assertion that the new `root.ts` still imports `s6-remote.js` | either the new root genuinely lost the s6-remote wiring (then a capability loss to restore) or the pin is stale; the test's own intent is "every entrance is built by ONE mapper", which must be re-anchored, not deleted |
| 4 | `a4p7-ceiling-port-assembly-pin` a4-76 | `ENOENT …/src/plu…` | **LAYOUT PIN** (opens a retired path) | re-point at the new module that carries the ceiling-port line |
| 5 | `a4p7-live-descendant-authority` §7.6 row 5 | `the walk lost packages/runtime/operation-permission/pre-execute-adapter.ts` | **LAYOUT PIN with a real question** — the walk asserts where the pre-execute adapter lives | if the adapter is genuinely retired, the walk must follow the new edge; if the capability moved without a successor, that is a regression |
| 6 | `team-session-activation-glue` G8 | `expected false to be true` for `bothFulfilled` | **BEHAVIOUR** — remote-ensure ∥ work-delivery lazy ensure on one cold member: one resume, both paths fulfilled | real concurrency law; must be fixed in the glue, not the test |

Note 1 and 6 are behaviour; 2–5 are pins that must be RE-ANCHORED to the new assembly without weakening
what they assert. Classification is by reading the failure message only; each one needs its own
investigation before the expectation is touched — the rule that produced the SLICE-16 correction (an arm
that encoded a defect as an expectation) cuts both ways.

## Why this is the A1 completion gate, not a side quest

The objective's A1 clause is "16 个保留能力历史测试迁移到新入口". Import-migration was done; behaviour
migration was not measured until now. 233/238 passing is the honest current number, and the five above
are the remaining A1 work.
