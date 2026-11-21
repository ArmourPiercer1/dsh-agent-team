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

## Round 31: the four LAYOUT PINS are re-anchored — 237/238

Four of the five were pins on the retired root/route, re-expressed against the new assembly
**without weakening what they assert**:

| suite | what changed | what did NOT change |
| --- | --- | --- |
| `a4p6-start-gate-entrances` BLOCKER 1 | `from './s6-remote.js'` → `from '../s6-remote.js'` (the root moved one directory down) | the law: the root imports the ONE `governanceStartRefusal` mapper and declares none of the three wire codes |
| `a3p5-permission-read-wiring` group A | the seam allow-list now accepts `plugin/vnext/root.ts` as well as `plugin/root.ts` | the law: `createPermissionReadProjection` has exactly ONE production consumer, and the decision-lane input is byte-stable across reads |
| `a4p7-ceiling-port-assembly-pin` PIN-4 | reads `src/plugin/vnext/root.ts` instead of the deleted `src/plugin/root.ts` | the census: exactly one producer of the ceiling reader, exactly one `{ authorityCeiling: permissionAuthorityCeiling }` |
| `a4p7-live-descendant-authority` §7.6 row 5 | walks `src/plugin/vnext` and names `admission.ts` / `centre-config.ts` where it used to name the retired `pre-execute-adapter.ts` | the law: the authority path never reaches a directory-listing API — and the walk now covers the CENTRE, which is where authority lives after the cut (strictly stronger coverage than before) |

Re-measured: **237/238**. The one that remains is the one that cannot be re-anchored, because it is not a
pin.

## The one that remains: E3 — the durable overlay no longer reaches the decision side

| # | suite / leg | failure | class | action |
| --- | --- | --- | --- | --- |
| 1 | `a3p4-pr4-production-entry-regression` "E3" | `the glue installed a pre-execute leg on tpl-a: expected 0 to be greater than 0` | **BEHAVIOUR — REAL CAPABILITY LOSS** | see below |
| 2 | `a3p5-permission-read-wiring` group A | projection outside the seam | LAYOUT PIN | **RE-ANCHORED** (round 31) |
| 3 | `a4p6-start-gate-entrances` BLOCKER 1 | missing `from './s6-remote.js'` | LAYOUT PIN | **RE-ANCHORED** (round 31) |
| 4 | `a4p7-ceiling-port-assembly-pin` a4-76 | `ENOENT …/src/plugin/root.ts` | LAYOUT PIN | **RE-ANCHORED** (round 31) |
| 5 | `a4p7-live-descendant-authority` §7.6 row 5 | walk lost `pre-execute-adapter.ts` | LAYOUT PIN | **RE-ANCHORED** (round 31, walk now covers the centre) |
| 6 | `team-session-activation-glue` G8 | `bothFulfilled === false` once | **FLAKY** | passed 3 further full runs and in isolation; one occurrence under parallel load is recorded as a flake risk, not a pass — the arm must be made deterministic before D |

Note 1 and 6 are behaviour; 2–5 are pins that must be RE-ANCHORED to the new assembly without weakening
what they assert. Classification is by reading the failure message only; each one needs its own
investigation before the expectation is touched — the rule that produced the SLICE-16 correction (an arm
that encoded a defect as an expectation) cuts both ways.

## Why this is the A1 completion gate, not a side quest

The objective's A1 clause is "16 个保留能力历史测试迁移到新入口". Import-migration was done; behaviour
migration was not measured until now. 233/238 passing is the honest current number, and the five above
are the remaining A1 work.

### Why E3 is not a pin

The old entry installed a **pre-execute adapter that consulted the durable permission overlay per call**.
The A1 cut retired that adapter with the execution route, and the new centre judges a call against the
COMPILED binding lanes only. So a `grantInstance` deny persisted AFTER the member was bound has **no
decision-side effect** until something recompiles the binding — i.e. the Alpha.4 durable overlay lost its
execution-time enforcement. That is exactly the "入口整体替换后的 Team 功能损失" risk in the objective, and
it is a capability the 06 contract preserves.

The test's expectation is right and its assertion (`the glue installed a pre-execute leg`) is the honest
way to state it: the glue installs NO decision leg today.

**Design decision needed (C stage), not a test edit.** The centre must stay the ONE decision point, so
the options are (a) the centre consults an injected overlay-decision port per call, next to the lane
verdict (the old adapter's semantics, moved under the centre's authority), or (b) the overlay mutations
are compiled INTO the binding and the generation recheck recompiles it. (a) is closer to the retired
behaviour and keeps one decision function; (b) keeps admission synchronous but makes every mutation a
recompile. This must be decided with the Control allow/ask/deny wiring, because both are the same
question: what is the ONE place a durable restriction becomes a verdict.

**Not claimed:** the overlay is not enforced at execution time by the new centre today. No row in
`CAPABILITY-MATRIX-C.md` may say otherwise.
