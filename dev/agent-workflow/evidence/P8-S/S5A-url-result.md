# P8-S5A-URL (ADR-1) — Result

**Verdict:** **PASS — all 7 acceptance criteria (A1–A7) met.** One attempt; no ARCHITECTURE_DECISION_REQUIRED.

**Branch/SHAs:** `task/P8-S5-production-composition`; base `5098a14`; commit 1 = implementation `27cb83b`; commit 2 = this evidence. No push.

## What changed (5 files, +188/−148)
- `packages/runtime/src/plugin/host.ts` — the ONLY production change, semantics-preserving:
  - `registerUpstreamResolverOnce()`: single `register()` → candidate search over file URLs, **DIST first**: `../../../../../src/plugin/upstream-resolver.mjs` (dist depth → the EXACT pre-change source-tree hook; tsc never copies the .mjs), then `../../../../packages/runtime/src/plugin/upstream-resolver.mjs` (source depth → the SAME file). Once-flag set only after success; total failure rethrows the first candidate's error (the same `ERR_MODULE_NOT_FOUND` surface — no new error surface).
  - New `loadLegacyInspect()`: single literal import → candidate search over relative specifiers, **DIST first**: `../../../../../dist/packages/legacy/session-reader/index.js` (dist depth → the BUILT mirror, the EXACT pre-change file), then `../../../legacy/session-reader/index.js` (source depth → session-reader TS source; runner hook `.js`→`.ts`). Total failure → `TEAM_PLUGIN_GLUE_UNAVAILABLE` (SAME stable code). Candidate 2 resolved FROM the dist depth points at the same built mirror as candidate 1: a corrupted-mirror production run still fails closed on the same file.
  - Bootstrap legacy block → `const legacyInspect = await loadLegacyInspect()`.
  - UNTOUCHED: row-config closed field set, `apply(ctx, config)` contract, export shape (`name`/`apply`/`validateTeamPluginConfig`/`inject`), stable error codes, S6 seam API; no new `node:` imports.
- `p8s5a-production-assembly.test.ts` (T1, still exactly 7 its): entry imported from TS SOURCE (`import * as hostEntry from '../src/plugin/host.js'`); T1.2 seams via source import (fixture cast at the port-type boundary); honest header (in-chain = source-level; built-artifact loadability out-of-chain, A6/A7).
- `p8s5a-host-loadability.test.ts` (T2, still exactly 3 its): static source import; `inject` assertion added inside an existing it; honest header.
- `p8s5a-artifacts.{mjs,d.mts}`: repurposed — keep `stubGlueUrl()` only (row-owned `config.glueUrl` channel); fail-fast artifact guard removed (wrong contract: chain must be green fresh). File set unchanged.

## Mechanism + probe evidence
Two sites × two layouts, production layout first at every site:

| site | DIST layout (production) | SOURCE layout (test runner) |
|---|---|---|
| resolver hook (file URLs for `register()`) | 5×`../` → `<wt>/packages/runtime` + `src/plugin/upstream-resolver.mjs` = pre-change file | 4×`../` → worktree root → SAME file |
| legacy entry (relative specifiers) | 5×`../` → built mirror `dist/packages/legacy/session-reader/index.js` = pre-change file | 3×`../` → `packages/legacy/session-reader/index.js` (TS source; hook `.js`→`.ts`) |

Predecessor probes (`tc-s5a-a3-probe-runtime.log`, S5A-attempt3-result.md) motivate both candidates: PROBE-A source import OK for shape; PROBE-B pre-change hook URL from source depth → `ERR_MODULE_NOT_FOUND …\.worktrees\src\plugin\upstream-resolver.mjs`; PROBE-C pre-change legacy URL → `TEAM_PLUGIN_GLUE_UNAVAILABLE …\.worktrees\dist\packages\legacy\session-reader\index.js`. Candidate arrays are `readonly string[]` (not `as const`) so tsc types `import(candidate)` as `any`.

**Production identity:** the live harness still mounts the BUILT entry `dist/packages/runtime/src/plugin/host.js`; from that depth candidate 1 at BOTH sites resolves to exactly the pre-change files → production behavior bit-identical. The source layout is reachable only under the unit-test runner.

## Acceptance (A1–A7)
| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | Fresh chain (ALL `packages/*/dist` + yaml junction removed) | ✅ **1913/1913, 0 failed** | `tc-s5a-url-fresh-chain.log` |
| A2 | Sanctioned rebuild (legacy tsc → runtime tsc → yaml junction) + rerun | ✅ **1913/1913** | `tc-s5a-url-dist-chain.log` |
| A3 | tsc × 8 (client, contracts, domain, remote, runtime, storage, testkit, tools; legacy excluded by design) | ✅ **8/8 exit 0** | separate `-p packages/<pkg>/tsconfig.json` |
| A4 | diff `5098a14..HEAD` scoped | ✅ exactly the 5 sanctioned files; `5 files changed, 188 insertions(+), 148 deletions(-)` | `git diff --stat` |
| A5 | test-use byte-clean | ✅ status empty @ `cd5ef8148158c3a752a658978873241fdf8e2bbc` | git status (main repo root) |
| A6 | FULL LIVE RE-RUN after A2: 17 scenarios, fresh `references/.dsh-test-p8s5a3`, lock `references/.dsh-test-p8s5a3.lock`, ports 3181–3186 + mini-MCP **3492** (free; 3493 not needed) | ✅ **17/17 pass=true, overall pass=true**; :3080 200 before+after; test-use pristine before+after; lock released; ports released | `S5A-url-live/summary.json`, `run.log` |
| A7 | Out-of-chain loadability | ✅ `node --check` rebuilt dist entry exit 0; plain-Node import smoke (zero TS tooling): name/apply/validateTeamPluginConfig/inject all OK | `S5A-url-live/a7-smoke.log`, `a7-smoke.mjs` |

## Pin status
p4t6 file-count pin: **UNCHANGED (515)** — all changes are in-place edits of existing files under `packages/**` (identical file set); pin test green in both A1 and A2 chains. Scanner byte-unchanged.

## Blockers
None. Carried provenance note (out of scope): `packages/legacy/tsconfig.json` is untracked (reconstructed during S5A). No impact: legacy is EXCLUDED from the sanctioned A3 8-set by design; the legacy package builds via its tracked `tsconfig.build.json` (A2 recipe, exit 0).
