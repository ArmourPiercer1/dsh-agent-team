# P8-S5A Independent Review (attempt 2)

**Verdict: APPROVE** — one MINOR finding (non-blocking), one INFO note. No MAJOR/CRITICAL.

- Worktree: `D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P8S5A-R`, detached `c902aac6253c7caf062ef7917b37b2d0663e4b71`, base `24c4f182b4a82bec8b2f07ff90885b5607501970` (64 files, +16089/−1015). Tree clean at review time.
- Read-only on all code. Writes confined to this file + `S5A-review-live2/`. Sanctioned toolchain only (`node scripts/run-tests.mjs`, `node node_modules/typescript/bin/tsc -p`).
- Live evidence: `dev/agent-workflow/evidence/P8-S/S5A-review-live2/` (chain log, 18 scenario JSONs + summary/run.log/logs, diff captures, smoke).

## Re-runs (all by this reviewer)

| # | Check | Result |
|---|---|---|
| 1 | `node scripts/run-tests.mjs` (full chain) | **1913/1913 PASS** (7212 ms), first try, no flake observed |
| 2 | `node node_modules/typescript/bin/tsc -p` ×8 packages | all exit 0 |
| 3 | Frozen-region diffs base..HEAD: `packages/contracts`, `packages/remote` | empty; no edits under domain/storage/client/legacy-src/testkit(except pin)/docs/references/scripts; only out-of-area entries = NEW `dev/` evidence files + expected NEW `packages/legacy/tsconfig.build.json` (build config, not src) |
| 4 | p4t6 pin 515 | byte-frozen scanner (`session-event-scan.mjs` quiet-diff exit 0); title/enumeration lists exactly the 13 S5A files; independent rule-replicated walk = **515** exactly; explicit `run-tests.mjs testkit` subset = 124/124 PASS |
| 5 | Build + plain-Node loadability | `tsc -p packages/runtime/tsconfig.build.json` exit 0; `node --check dist/.../plugin/host.js` exit 0; plain-Node `import()` smoke (no TS loader): name=`dsh-agent-team`, apply/validateTeamPluginConfig functions, inject=`[agents,storageDomain,sessionPersistence]`, `validateTeamPluginConfig(null)` throws — 7/7 ok |
| 6 | test-use byte-clean | BEFORE: clean @ `cd5ef8148158c3a752a658978873241fdf8e2bbc`; AFTER: clean @ same HEAD; harness postflight pristine=true |
| 7 | OWN live re-run, one foreground command, all 17 scenarios | **17/17 PASS** (18 JSONs incl. E5-boot1-writes/E5-boot2-restart; all pass=true, failing=0); ports 3183–3186, MCP 3492, fresh homes `.dsh-test-p8s5ar2`/`-e`; postflight: test-use pristine, :3080=200, lock released, junction farm removed — both re-verified after. |

## Code review R1–R10

- **R1 A01–A29 wiring** ✓ — single assembly point `createTeamProductionRoot` (root.ts:384) uses brief-listed canonical factories; loud failure (apply never rejects, `ready` rejects with stable codes), stop semantics close root+domain (host.ts:444-454).
- **R2 S6 seams** ✓ — `createInstallSeam` install-once + typed not-installed code (seams.ts:84-117); 4 named seams (126/139/151/164); fail-closed activate-on-install proxy (192-200); instantiated at root.ts:713; S5 implements no S6 semantics.
- **R3 tools row** ✓ — plugin.mjs is a thin observability row; no backend graph construction; governance route derives principal server-side (`teamRoot.live.governanceAuthority` plugin.mjs:554, 403 on unknown 561-564, `admitGovernanceOverride` 580-582); sole dynamic import = built dist mutation module (242). run.mjs: 39 byte-identical check pairs + 1 av8→av12 pair (differs only `activityVersion===8`→`===12`); 0 pure-condition changes; details null-safe except documented E1 enrichment.
- **R4 harness row** ✓ — `PRODUCTION_ROW_NAME` (run.mjs:281) = file URL of built `dist/.../plugin/host.js`; zero TS tooling on production boot; inject services are public upstream (storageDomain grep + live proof).
- **R5 seed** ✓ — `seedBootWorld` (root.ts:739-807): exact three-row world, idempotent (`get(...)===undefined` guards), same repositories as live.
- **R6 boot probe (x)** ✓ — one `environmentFacts` thunk (402-408) shared by prober (417)/authority (424)/facade (605); idempotent guard + frozen trigger `STALE_GENERATION_BEFORE_NEW_WORK`; generation 1→2 confined to documented T1.1/T1.5 expectations (test L797/L800, L864/L869).
- **R7 tests** ✓ — pin delta analyzed (502→515, +13 files enumerated); runtime.test.ts delta = documented (o)/(u) skeleton-contract replacement, strictly stronger (see INFO). Flake anchors + P6-T1 direct-construction (p6t1-helpers.ts:407/474) confirmed; flake correctly scoped pre-existing/frozen/out-of-scope.
- **R8 race** ✓ — race real but frozen-code/pre-existing (probe.ts:207-218 per-prober lock, 234-251 non-atomic replaceState; gate.ts:94 per-consultation authority; provider.ts:629); production immune via boot probe (x); P6-T1 unreachable for (x) by construction.
- **R9 red lines** ✓ — 4 `SessionEvent` grep hits all benign (detection-vocab doc, no-op stub, negative doc, test stub); no legacy-vocab authority, no SessionController mirror (negative doc only), no subagent-as-MemberInstance, groupId/label are record data fields only, no client-declared caller authority, single Team authority, CORE PATCH BUDGET 0 (test-use clean).
- **R10 build** ✓ — `noCheck:true` legacy build acceptable (frozen evidence-only pkg, pre-existing TS2540/TS2345 documented run.mjs:475-479); seam contract typed+checked in runtime; node-min.d.ts structural shim; runtime tsc checked exit 0.

## Findings

| Sev | Location | Finding |
|---|---|---|
| MINOR | commit c902aac (dev/ files) | New `dev/agent-workflow/evidence/P8-S/` artifacts (S5A-result.md, S5A-live/*) are bundled into the implementation commit; repo convention separates "evidence" commits (cf. e8fd5ab/f3b44a5/b33642e). All additions, zero modifications to existing dev/ files, no semantic impact. Non-blocking. |
| INFO | review-packet R7 wording | Packet attributes "2→3 / 1→2 updates" to the runtime.test.ts delta; they are actually in `p8s5a-production-assembly.test.ts` T1.1 (L797/L800), T1.5 (L864/L869). The real runtime.test.ts delta is the documented (o)/(u) replacement — stricter. No defect. |

**Flake note:** full chain passed 1913/1913 on first attempt; no p6t1 flake observed. The documented ~1-in-3 flake is in frozen code (pre-existing), out of S5A scope — consistent with worker's scoping.
