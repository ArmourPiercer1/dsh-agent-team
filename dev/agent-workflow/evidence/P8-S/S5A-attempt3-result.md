# P8-S5A ATTEMPT 3/3 (FINAL) — Result

**Verdict:** **ARCHITECTURE_DECISION_REQUIRED** — per packet item 4: the mandated test-design-only fix (both tests import the entry from TS source) *requires* a production-source change to `packages/runtime/src/plugin/host.ts`. STOPPED as instructed; no production source patched.

**Branch/SHAs:** `task/P8-S5-production-composition`; task HEAD unchanged = `c902aac6253c7caf062ef7917b37b2d0663e4b71` (S5A attempt 2); this commit is **evidence-only** (its own SHA in the subject). Base-of-base `24c4f18` (S4PIN: "chain 1903/1903, tsc 8/8").

## Blockers
**Type:** `ARCHITECTURE_DECISION_REQUIRED`
**Question:** May the follow-up include a minimal, semantics-preserving change to `packages/runtime/src/plugin/host.ts` making the two `import.meta.url`-derived URLs resolve from BOTH the dist mirror (production) and the TS-source (test) location — e.g. candidate search (dist → source fallback) — for (a) the upstream-resolver hook (L113–125, `../../../../../src/plugin/upstream-resolver.mjs`) and (b) the frozen legacy reader entry (L358–361, `../../../../../dist/packages/legacy/session-reader/index.js`) — without touching row-config surface, stable error codes, or the apply contract?

**Why test-design alone cannot close A1** (empirical, `tc-s5a-a3-probe-runtime.log`):
- **PROBE-A:** source import of `../src/plugin/host.js` works for shape assertions: `name=dsh-agent-team, apply=function, inject=[agents,storageDomain,sessionPersistence], validate=function` (full JSON in the probe log).
- **PROBE-B:** `apply()` bootstrap from source dies at `register()`: `ERR_MODULE_NOT_FOUND …\.worktrees\src\plugin\upstream-resolver.mjs` (5×`../` from `src/plugin/host.ts` escapes the repo root).
- **PROBE-C:** with the resolver flag preset, next dies at the legacy-entry import: `TeamPluginError(TEAM_PLUGIN_GLUE_UNAVAILABLE)` for `…\.worktrees\dist\packages\legacy\session-reader\index.js`.

→ `p8s5a-production-assembly.test.ts` (7 apply scenarios) cannot run from TS source under any test-only change (validator field set is closed; no URL-override channel). `p8s5a-host-loadability.test.ts` (shape/validator) CAN run from source (PROBE-A). A1 needs T1-from-source ⇒ host.ts change ⇒ this blocker.

## Acceptance matrix (attempt 3)
| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | Fresh chain ALL PASS, total 1913 | ❌ not achievable test-only (RED reproduced) | `tc-s5a-a3-fresh-chain.log`: fresh state (no dist, no in-src artifacts) → **1903/2** — both p8s5a tests die at module import (missing built artifacts), the reported defect |
| A2 | Dist-present chain same green/total | ✅ **1913/1913** | `tc-s5a-a3-dist-restored.log` — final state = sanctioned recipe (legacy build → `packages/runtime/dist` mirror, runtime build, `yaml` junction) + no in-src leftovers; matches main-agent audit `tc-s5a-audit-chain.log` (22:46, 1913/1913; was untracked, committed here) |
| A3 | tsc per package (8 invocations) exit 0 | ✅ **8/8** | `tsc -p packages/{contracts,domain,storage,runtime,testkit,remote,legacy,client}/tsconfig.json` (sanctioned 8-set of S3/S4B evidence — noEmit typecheck; `tools` never in it) all exit 0. Provenance: `packages/legacy/tsconfig.json` is **untracked** at base and HEAD (referenced by S4B/S4PIN-era evidence 14:33–14:50, later lost from the worktree); reconstructed per sibling pattern (`extends ./tsconfig.build.json` + `noEmit`), left untracked; legacy sources unchanged since base |
| A4 | diff `c902aac..HEAD` only under `packages/runtime/test/` | ✅ trivially — **zero code changes** (blocked per item 4); diff empty; evidence-only commit | — |
| A5 | test-use byte-clean | ✅ maintained — nothing written under `references/`; test-use remains `cd5ef814` | — |

**p4t6 pin:** 515 unchanged, GREEN in the A2 run; scanner byte-unchanged.

## State as found (fidelity note)
At session start the worktree carried **637 untracked build artifacts** (in-src `.js/.d.ts/.map` from non-sanctioned per-package `tsconfig.build.json` emits) + stale `.tmp-fault`: that state measured **1905/4** (`tc-s5a-a3-baseline-dist.log`: p4t6 674 vs pin 515; g8s1 ENOTEMPTY). Contamination post-dates the 22:46 audit (1913/1913, no leftovers); removed before A1/A2 so both measure true fresh/dist states.

## Secondary findings (out of scope, flagged for router)
1. `packages/tools` **emit** build (`tsconfig.build.json`) exits 2 (TS6059 rootDir) in every state tested (fresh, dist-present, with in-src leftovers): cross-package relative imports resolve to `.ts` sources outside `rootDir`; in-src `.js` leftovers do NOT change NodeNext tsc resolution (`.js` specifiers resolve to `.ts` siblings first). `packages/tools/src` unchanged since `24c4f18` ⇒ latent, pre-S5A; `tools` is outside the sanctioned A3 set ⇒ A3 unaffected.
2. `packages/legacy/tsconfig.json` provenance gap (A3): earlier "tsc 8/8" claims depended on this untracked file; a true fresh checkout reproduces only 7 of the 8 typechecks from the committed tree.
3. Main-agent audit log was untracked; committed alongside this report.

## Worktree final state
HEAD = this evidence commit on `c902aac`; dist mirror + `yaml` junction present (sanctioned recipe); **no** in-src leftovers; temporary probe test deleted; `packages/legacy/tsconfig.json` reconstructed (untracked, documented); untracked remainder: this report + 5 logs. **No push.**
