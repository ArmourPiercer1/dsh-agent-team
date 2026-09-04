# P9 Start Brief — UI T+12→T+24 Legacy-Reuse Implementation & Test

Written by the main agent 2026-09-03 ~08:40. This brief is the entry authority for the P9 builder; the frozen plan remains the final authority.

## 0. Entry gate — SATISFIED
- T12 `VERDICT = GO` (stamped 2026-09-03; `dev/agent-workflow/evidence/T12/T12-decision.md` final; §15.1 16/16).
- User pre-authorized P9 start without further approval (2026-09-02 directive; goal FINAL STEP).
- Plan: `docs/plans/active/DSH_Agent_Team_vNext_P9_UI_T12_T24_Legacy_Reuse_Implementation_Test_Plan.md` (2309 ln, FROZEN — never edit). Read §0 (executive decision), §1 (entry gate + first hard boundary), §13 (wall-clock schedule / S-phases), §21 (DoD, 15 conditions), §22 (what P10 receives), §23 (final execution order), §24 (bottom line: 3 hard criteria) before any implementation.

## 1. Baseline
- Worktree: `.worktrees/P9` (create nothing else for the main lane), branch `task/P9-ui-legacy-reuse`, HEAD `b2b7bb6` = final tip of `int/T12-production-closure`.
- Baseline interpretation (RECORDED per p9-kickoff-prep.md): plan L7 pins `int/P8-S-backend-closure@7d07330`; the correct start baseline is the T12 final tip — a strict descendant (7d07330 + 17 integration + 13 T12-V + 1 pin fix). The T12 tip already carries: runtime `yaml` dep fix (`cc545d3`), junction bridge + dist-glueUrl boot kit (T12-V2/V5/V8), vertical runner `packages/tools/harness/t12-vertical.mjs` (idempotent junction-bridge + dist-build/glue steps — borrow/adapt that section for P9 boots, do not re-derive).
- Legacy asset baseline (FROZEN, READ-ONLY): `references/deepseek-harness` @ `506191ba893ac55980dd09680c438710ab24095b`, tree `a45fd296be6546844c5fae24bb1a12f831b312` — verified present. The legacy UI already provides a complete Team tab / Dock / Timeline / Members / Feed + styles + 14 tests; the vNext client is currently a skeleton. P9 = real reuse, NOT a second clean rewrite.
- §0 architecture (binding): keep legacy presentation layer; thin vNext data layer ONLY — TeamRemoteClient (~150-250 LOC REIMPLEMENT), TeamProjectionStore (generation-safe cache, reuse P8 algorithm), TeamLedgerStore (frozen cursor rule, reuse createLedgerPageTracker/verifyLedgerPageAnchor), TeamUiSnapshot (normalized adapter, NO authority). Authority ONLY from frozen `team.getProjection` / `team.getLedgerPage` / Remote commands / Native DSH public surfaces. NO browser-side TeamDomain re-derivation.

## 2. First hard boundary (plan §1, verbatim meaning)
1. **P9 does not modify backend architecture.**
2. Missing data path: (a) check `dev/agent-workflow/evidence/P8-S/backend-contract-freeze.md` (sole backend contract reference for P9/P10); (b) if CLIENT_LOCAL/NATIVE_PROVEN → implement in client/native seam; (c) if clearly unsupported → downgrade/hide feature; (d) only freeze-doc-vs-actual-code contradiction → `CONTRACT_CHANGE_REQUEST` (report, do not act); (e) NEVER directly modify Remote catalog / Projection schema / TeamDomain / Session log semantics to make UI work.
3. CORE PATCH BUDGET = 0 — never touch `references/deepseek-harness-test-use` (pristine upstream @ cd5ef814) or `D:\deepseek-harness\`.
4. No push (red line; no authorization exists).

## 3. Parallel-session isolation (NEVER touch)
- `.worktrees/P9P`, `.worktrees/P9P-UI` (other session's assets, one has uncommitted work — leave alone)
- master (local `b27ff8a` = other session's R90; origin/master `8000ede`), `p9_prototype:` block + `current_phase` in graph.yaml (P9P-owned)
- `p9_prototype/` directories, `current_phase`
- `references/deepseek-harness` (frozen legacy — read-only), `references/deepseek-harness-test-use` (pristine — read-only)
- `dev/agent-workflow/graph.yaml` + `dev/agent-workflow/SESSION_ROUTER_LOG.md` — MAIN-AGENT-ONLY bookkeeping; the builder must NOT append to these.
- `:3080` + `D:\deepseek-harness\` — sacrosanct (probe-only).

## 4. Sanctioned toolchain (from TEST_METHODS.md / T12 practice)
- `pnpm install --ignore-scripts` (never pnpm run/exec)
- tests: `node scripts/run-tests.mjs [pkg...]` (never vitest CLI / tsx / esbuild / vite)
- typecheck: `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json`; build: `... tsconfig.build.json` — tsc SEPARATE invocations
- NodeNext + `.js` extensions + erasable TS only in the 9 vNext packages
- Ports: 3180 family per TEST_METHODS.md — CHECK LIVENESS before every boot; release after; mock/mini-MCP ports per T12 layout (3492-3500 family) if a live backend is needed
- **tsc build side effect (T12-disclosed)**: the build emits .js/.d.ts/.map inline under `packages/{contracts,domain,runtime,storage}/src` (~644 artifacts). Clean them (`git clean -f packages/`) before any p4t6 re-scan / full-suite re-run; canonical order = full-tests BEFORE build, or clean after build.
- Known pre-existing (P10-class, do NOT block, do NOT "fix" silently): tools build TS6059 (`tools.ts:76` contracts-src import); composition-smoke official-script stale P1-T4 path (corrected-path diag: `evidence/T12/t12-13-smoke-diag.mjs`); p6t1-parallel flake (~1/3, pre-existing).

## 5. Reuse classification (binding vocabulary)
Every legacy file/component gets exactly one of: **DIRECT COPY / MECHANICAL ADAPT / REIMPLEMENT / DROP** — recorded with per-file evidence in `dev/agent-workflow/evidence/P9/reuse-audit.md` (DoD 13: proves no second clean rewrite happened). The 14 legacy tests each get migrate/drop evidence (DoD 10).

## 6. Phases & gates (follow plan §13 order)
S1 legacy inventory + reuse-audit skeleton → S2 thin data layer (TeamRemoteClient/TeamProjectionStore/TeamLedgerStore/TeamUiSnapshot) → S3 component reuse (old-test-first → fixture adapter → compile → semantic adjustments only) → gates P9-G1..G4 (plan L1400-1514) → S5 vNext-only controls (G5: no optimistic authority patch / Remote typed result preserved / projection refresh / rendered final state) → S6.. → S7 test migration + negative tests → S8 production-host vertical browser smoke (≥1 honest path, DoD 12) → S9 closure review + freeze.
Per-component method (plan L1497-1504): old test first → fixture adapter → compile → only then semantic adjustments.

## 7. Definition of Done (plan §21, 15) + bottom line (plan §24, 3)
DoD: client plugin real mount on public DSH client seam; root/member/ordinary/legacy perspectives correct; generation-guarded Projection (no stale-response rollback); cursor-rule Ledger (no Session-messages dependence); New Team flow works or explicitly downgraded per frozen native seam; heavy legacy reuse in Members/Timeline/Dock/Team tab; vNext-only commands via frozen Remote; no native Chat/Trajectory/Fork copy or synthetic injection; synthetic markers + DOM navigation hacks deleted; 14 legacy tests migrate/drop evidence; full repo test/typecheck/build/smoke PASS; ≥1 honest production-host UI vertical path evidenced; reuse-audit.md proves no second clean rewrite; CORE PATCH BUDGET = 0; backend frozen contract not silent-edited.
Bottom line (the 3 hard review criteria): (1) 旧资产是否被真实复用 (2) 旧 authority 技术债是否被切断 (3) vNext backend contract 是否被原样消费而未被 UI 反向污染.

## 8. Evidence & reporting protocol
- Evidence home: `dev/agent-workflow/evidence/P9/` (create; UTF-8; per-phase snapshots named `p9-s<phase>-<artifact>.{log,json,md}`).
- Never redirect harness stdout into a report dir's own log (T12 run #9 lesson).
- Report to the main agent at: each gate verdict (G1..G5), every blocker (fixed format per ROUTER_RULES), and on phase completion. The main agent audits independently and owns graph.yaml / SESSION_ROUTER_LOG.md bookkeeping + any cherry-picks to an int branch.
- Single writer rule: you are the only writer on `task/P9-ui-legacy-reuse`. If a parallel lane is needed later, the main agent carves it (1 task = 1 branch = 1 worktree = 1 writer).

## 9. First actions (this kickoff)
1. Read the frozen plan §0/§1/§13/§21/§23/§24 + `docs/ROUTER_RULES.md` + `docs/TEST_METHODS.md` (session-start mandate).
2. Run baseline validation in `.worktrees/P9`: `pnpm install --ignore-scripts` + full `node scripts/run-tests.mjs` (expect 2170/2170) + tsc 8-set typecheck — record to `evidence/P9/p9-baseline-validation.log`.
3. S1: inventory the legacy UI (frozen `references/deepseek-harness` @ tree a45fd29: `packages/team` client tree + 14 tests) → draft `reuse-audit.md` skeleton with the 4-class classification per file.
4. Report baseline result + S1 inventory draft to the main agent.
