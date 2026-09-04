# P9 UI kickoff prep — written during T12 vertical phase (main-agent memo, NOT a plan)

Purpose: so P9 starts immediately on T12 `VERDICT=GO` with zero re-derivation. User pre-authorized start without approval (goal FINAL STEP).

## Entry gate (P9 plan §1, L66-85) — verbatim-verified 2026-09-02 22:55
- `VERDICT=GO` → enter P9. `REFACTOR` → backend salvage first, NO UI. `STOP-CANDIDATE` → project-level adjudication, no P9.
- First hard boundary: **P9 does not modify backend architecture.** Missing data path: 1) check `dev/agent-workflow/evidence/P8-S/backend-contract-freeze.md` (sole backend contract reference for P9/P10); 2) if CLIENT_LOCAL/NATIVE_PROVEN → implement in client/native seam; 3) if clearly unsupported → downgrade/hide feature; 4) only freeze-doc-vs-actual-code contradiction → `CONTRACT_CHANGE_REQUEST`; 5) never directly modify Remote catalog / Projection schema / TeamDomain / Session log semantics to make UI work.

## Baseline interpretation note (RECORD IN P9 START BRIEF)
- Plan text L7 pins `int/P8-S-backend-closure@7d07330` as "primary implementation baseline" — that pin predates T12 (plan written at T12 start, §0 says P9 proceeds "在 T+12 Production Vertical Closure 已得到 VERDICT=GO 的前提下").
- Correct P9 start baseline = **final tip of int/T12-production-closure** (7d07330 + 17 T12 commits + vertical-phase commits incl. the runtime `yaml` dep fix). T12 tip is a strict descendant of the plan's pin.
- Legacy asset baseline: `references/deepseek-harness` @ `506191ba893ac55980dd09680c438710ab24095b`, tree `a45fd296be6546844c5fae2024bb1a12f831b312` — VERIFIED present in frozen reference (ancestor of frozen HEAD `a3ab3199`, tag `legacy-agent-team-pre-vnext`, exact tree-hash match). No fetch needed.

## Pre-existing fixes that P9-start must absorb (per DoD #11 "full repo test/typecheck/build/smoke 通过")
1. **tools build TS6059** (pre-existing at base, recorded in T12-decision.md §pre-existing #1): `packages/tools/src/tools.ts:76` imports `../../contracts/src/index.js`; fix = point import at contracts public entry (P10-scoped in T12, but DoD #11 forces it at P9 start).
2. **composition-smoke stale path** (§pre-existing #2): smoke script (P1-T4 `932edb1`) expects `dist/plugin/host.js`; real entry post-P8-S5A is `dist/packages/runtime/src/plugin/host.js`. Corrected-path diag staged at `t12-13-smoke-diag.mjs` — expected PASS once the yaml fix is in the T12-int tip (vertical phase delivers it).
3. **yaml packaging defect** (§pre-existing #3): fixed IN T12 vertical phase (runtime package.json + lockfile). After cherry-pick + install into T12-int, re-run `t12-13-smoke-diag.mjs` → expect host+client PASS. That green diag is the P9-start baseline for DoD #11.

## DoD (P9 plan §21, L2199-2217) — 15 conditions
1. @dsh-agent-team/client no longer skeleton; real mount on public DSH client seam
2. Team root/member/ordinary/legacy perspectives display correctly
3. Projection uses P8 generation guard (no stale-response rollback)
4. Ledger uses frozen cursor rule; history not via Session messages
5. New Team flow works or explicitly downgraded per frozen native seam
6. Members/Timeline/Dock/Team tab heavily reuse old implementation
7. vNext-only member/config/policy/compat commands via frozen Remote
8. native Chat/Trajectory/Fork not copied / no synthetic injection
9. synthetic marker + DOM navigation hack removed
10. 14 legacy tests each with migrate/drop evidence
11. full repo test/typecheck/build/smoke green (⇒ fixes above)
12. ≥1 honest production-host UI vertical path with evidence
13. reuse-audit.md proves no second clean rewrite
14. CORE PATCH BUDGET = 0
15. backend frozen contract not silent-edited

## Execution order (P9 plan §23, L2252-2287) — 32-item checklist
T+12 GO → pins (vNext tip + legacy 506191b) → read backend-contract-freeze → 45m public host seam map → copy legacy UI verbatim → copy legacy tests verbatim → TSX/browser plumbing → TeamRemoteClient → TeamProjectionStore (P8 helpers) → TeamLedgerStore (P8 helpers) → Projection→TeamUiSnapshot adapter → Ledger→TeamUiLedgerModel adapter → migrate timeline → migrate members → migrate dock → adapt TeamView → adapt TeamFeed→TeamLedger → Task board → activity-derived UI → DROP synthetic Chat marker → DROP TeamMirror/messagesBefore → DROP DOM tab switch → New Team flow → Member command flows → Config/Policy/Compatibility UI → Handoff/legacy where frozen-supported → native nav/Chat/Trajectory/Fork integration → port 14 legacy tests w/ explicit decisions → generation/cursor/negative tests → honest browser vertical smoke → full repo gates → reuse audit → P9_VERDICT.

## Three hard review criteria (§24)
1. 旧资产是否被真实复用 (legacy assets actually reused)
2. 旧 authority 技术债是否被切断 (old authority tech-debt cut)
3. vNext backend contract 原样消费，无 UI 反向污染 (frozen contract consumed as-is)

## Parallel-session constraints (P9P proto track — ACTIVE, other session)
- NEVER touch: `.worktrees\P9P` (dirty, other session's), `.worktrees\P9P-UI`, master (b27ff8a = other session's R90), graph.yaml `current_phase: P9-PROTO` (L2) + `p9_prototype:` block (L12-24).
- P9 UI lane = own new worktree + own branch off T12 tip; own `p9_ui:` or task-map entry when bookkeeping is due.
- Re-verify graph.yaml + SESSION_ROUTER_LOG.md mtimes IMMEDIATELY before any append (other session commits bookkeeping frequently — last seen 22:39 R90).
- P9P's router-log entry independently corroborates the yaml defect fix ("runtime yaml dep") — no action needed, noted for the record.

## Ports / sacrosanct (unchanged from T12)
- :3080 + `D:\deepseek-harness\` sacrosanct. T12 test ports (3181-3186/3492-3500) free after vertical phase; P9 UI vertical smoke will need its own port allocation per TEST_METHODS.md (3180 family) — allocate at P9 start, check liveness first.

## Fresh-worktree production-boot preconditions (machine-proven in the T12 vertical, 2026-09-02 ~00:10)
Any P9 world that boots the production row from a worktree needs three environment preconditions — NONE of them is part of the sanctioned repo state (all are untracked build/env artifacts):
1. **Upstream junction bridge** (defect #4): junctions for `@deepseek-ai/{dsh-agent,dsh-llm,dsh-mcp-client,dsh-session,dsh-storage-domain}` → test-use `.pnpm/node_modules/@deepseek-ai/*`. Proven placement `packages/runtime/node_modules/@deepseek-ai/` (Node upward search from seam `packages/runtime/root-binding/harness/` and glue `packages/runtime/src/plugin/live/` hits it first; a `packages/node_modules` placement also works).
2. **Dist build + dist-glueUrl** (defect #5, FINAL form per T12-V8 `ed56641`): the glue boots from a byte-identical copy INSIDE the dist tree (`dist/packages/runtime/src/plugin/live/agent-bindings.mjs`), so its relative tsc-style `.js` imports into the source tree (blueprint L145, persona L146) resolve within the dist mirror (tsc rootDir = repo root; 254 .js). The dist build (sanctioned tsc build chain) is mandatory before any boot. The earlier dist-mirror→source `.js` copy step was DROPPED in T12-V8 as redundant under dist-glueUrl — do not re-add it.
3. **`yaml` declared in `packages/runtime/package.json`** — DONE in T12-V `cc545d3`, present at the T12 tip.
A P9 worktree CLONED/BUILT from the T12 tip inherits the junction bridge only as untracked artifacts if it never runs `git clean`; a truly fresh worktree must redo the prep (junctions + dist build). The T12 vertical runner (`packages/tools/harness/t12-vertical.mjs`) carries the idempotent junction-bridge + dist-build/glue steps by the end of the vertical phase — P9 should borrow/adapt that runner section rather than re-deriving.
