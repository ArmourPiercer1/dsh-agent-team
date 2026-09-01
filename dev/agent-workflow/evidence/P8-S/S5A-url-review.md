# P8-S5A-URL — Independent Focused Review (diff-only)

**Verdict: APPROVE** — every re-run green; no findings above MINOR.

## Proof header
- worktree `D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P8S5AR`, detached `3aea351d4921debd57582ad227ca7545903586f2` = `27cb83b` (implementation) + evidence commit. Scope `5098a14..3aea351`: code = `5098a14..27cb83b`; `3aea351` adds only 43 evidence files under `dev/agent-workflow/evidence/P8-S/`.
- tree: clean pre-run; post-run only `?? S5A-url-review.md` + `?? S5A-url-review-live/` (this review's artifacts). node v24.20.0.
- code scope: exactly 5 files — `packages/runtime/src/plugin/host.ts` + 4 test-side (`p8s5a-production-assembly.test.ts`, `p8s5a-host-loadability.test.ts`, `p8s5a-artifacts.mjs`, `p8s5a-artifacts.d.mts`).
- live evidence: `dev/agent-workflow/evidence/P8-S/S5A-url-review-live/` (summary.json, run.log, 17 scenario JSONs, logs/, all logs below).
- test-use (`references/deepseek-harness-test-use`): BEFORE status EMPTY @ `cd5ef8148158c3a752a658978873241fdf8e2bbc`; AFTER status EMPTY @ same HEAD (harness own pre/post pristine checks true).

## Re-runs (worktree root; sanctioned toolchain)
1. **FRESH-CHAIN**: pre-run verified all `packages/*/dist` + `packages/runtime/node_modules/yaml` junction absent (nothing to remove). `node scripts/run-tests.mjs` → **1913/1913 PASS, 0 failed**, exit 0 — `fresh-chain.log`.
2. **DIST-CHAIN**: `tsc -p packages/legacy/tsconfig.build.json` (exit 0) → `tsc -p packages/runtime/tsconfig.build.json` (exit 0) → junction `packages/runtime/node_modules/yaml -> packages/domain/node_modules/yaml` → `node scripts/run-tests.mjs` → **1913/1913 PASS**, exit 0 — `dist-chain.log`, `build-legacy.log`, `build-runtime.log`.
3. **tsc 8-set** (separate invocations; legacy excluded by design): client, contracts, domain, remote, runtime, storage, testkit, tools → **8/8 exit 0** — `tsc-<pkg>.log`.
4. **test-use**: byte-clean before and after (header).
5. **OWN LIVE RE-RUN** (one foreground command, waited): `node packages/tools/harness/run.mjs --report-dir <live dir> --scenarios E1,E2,E3,E4,E5,E6,E7,W1,W2,W3,W5,W7,M1,M2,M3,M4,M5 --port 3181 --dsh-home .dsh-test-p8s5ar3 --dsh-home-e .dsh-test-p8s5ar3-e --lock-file references/.dsh-test-p8s5ar3.lock --mcp-ports 3492,3493` → exit 0, **harness PASS**; **17/17 pass=true, 0 failing assertions** (E5 = boot1-writes + boot2-restart, both pass). Fresh DSH_HOMEs (absent pre-run); lock acquired → released (file gone); ports 3181–3186 + 3492 free post-run (3492 free pre-run, 3493 unused); `:3080` = 200 before AND after. Mounted row entry: `file:///…/P8S5AR/packages/runtime/dist/packages/runtime/src/plugin/host.js` (BUILT).
6. **A7**: `node --check` rebuilt dist entry → exit 0; plain-Node import smoke, zero TS tooling (`a7-review-smoke.mjs`) → name/apply/validateTeamPluginConfig/inject all correct.

## Findings
| sev | location | rationale |
|---|---|---|
| MINOR | host.ts:284-287 | Legacy fail-closed message re-formatted: `entry (<file URL>) could not be loaded: <err>` → `could not be loaded: <c1: err \| c2: err>`. SAME code `TEAM_PLUGIN_GLUE_UNAVAILABLE`; in the dist world both entries name the same mirror file (c2 from dist depth = c1's file, walk-verified). Diagnostics superset; ruling fixes the code, not message text. No fix required. |
| MINOR (assessed) | host.ts:141-166 | Hook once-flag set-BEFORE → set-AFTER `register()`. Success path identical; failure path strictly LESS poisoning (pre-change a failed register left the flag true and later applies silently skipped registration; now each attempt retries and rethrows `errors[0]`, same surface, recovery possible). Failure-path-only improvement. |
| INFO | host.ts:265-270 | Source-world c1 walks five up to the `.worktrees` parent; verified `parent/src` and `parent/dist` absent and sibling worktrees emit only into their own `packages/*/dist` — no cross-worktree pickup path today. Test-world only; production hits c1 first. |
| INFO (carried) | S5A-url-result.md:44 | "packages/legacy/tsconfig.json untracked" note: file absent entirely in this worktree; no impact — legacy excluded from 8-set by design, builds via tracked `tsconfig.build.json` (exit 0 here). |

## D1–D4 status
- **D1 PASS.** Hook: c1 specifier byte-identical to pre-change (5098a14 L120-123 vs L148, same `new URL(spec, import.meta.url).href`); c1 from dist depth (5 up from `dist/packages/runtime/src/plugin/host.js` = `packages/runtime`) and c2 from source depth (4 up from `src/plugin` = wt root) resolve to the SAME `<wt>/packages/runtime/src/plugin/upstream-resolver.mjs` [exists] — URL-walk verified; production always hits c1 = the pre-change URL itself. Legacy: c1 byte-identical (L358-359 → L265); relative `import(c1)` resolves to the same module URL as pre-change (built mirror, exists post-build); shape check `typeof inspectLegacyTeam !== 'function'` preserved (L275-278); c2 from dist depth = c1's same mirror file (walk-verified) → corrupted/missing mirror fails closed on the same file. Surfaces: hook rethrows `errors[0]` = pre-change single-`register()` error; legacy same code.
- **D2 PASS.** `git diff 5098a14..27cb83b` = exactly the 5 files. `validateTeamPluginConfig` body byte-identical (72 lines extracted, compared equal); export list byte-identical (`validateTeamPluginConfig`, `name`, `inject`, `apply`); `apply(ctx, config?: unknown): Promise<void>` signature identical; `seams.ts` not in diff; diff adds NO import lines (only import-related diff text = two deleted `import.meta.url,` args) — no new `node:` builtins in .ts.
- **D3 PASS.** T1: 7 its, 80/80 `expect(` lines multiset-identical vs c902aac (zero removed); `assertArtifactsBuilt()` call removed (sanctioned repurpose); static source import `import * as hostEntry from '../src/plugin/host.js'`; T1.2 seams via source import, fixture cast `as unknown as LiveResidencyOverlayPort` at the port boundary (L465/468); honest header (built-artifact loadability out-of-chain A6/A7). T2: 3 its, 10→11 expects (+`inject`, 0 removed); former "plain JS built artifact" it re-anchored honestly to source level (header L14-19). `p8s5a-artifacts.mjs`: only `stubGlueUrl()` remains, `node:` surface kept in .mjs (L25-26), `.d.mts` consistent. p4t6 pin: `git diff c902aac..27cb83b -- packages/testkit` EMPTY — pin (515) + scanner byte-unchanged; green in both my chains.
- **D4 PASS (consistent).** Flake documented at `S5A-result.md:199-218` (pre-existing frozen-code race: parallel first-work re-probe, non-atomic `replaceState`, ~1-in-3 on runtime subset; S5A-immune via boot-time probe). This session: **0 flakes in 5 observations** (2 full chains + 3 `run-tests.mjs runtime` runs, 831/831 each — `d4-runtime-run{1,2,3}.log`).

## Flake observation
Not reproduced this session (5/5 PASS); consistent with the documented ~1-in-3 pre-existing baseline flake; the diff touches none of the frozen compatibility/probe code involved.
