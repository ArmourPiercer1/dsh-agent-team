# F3 / F11 / F9 / T1.4 Repair Round — Minimum Frozen Contract + Executable DAG + Task Packages

> Status: **planning deliverable (read-only plan; no code, no `docs/plans/active` edits, no push — by delegation constraint)**
> Authored by: dedicated planning subagent (planning-only scope)
> Date: 2026-09-07 (round: `repair-r1`)
> Baseline: `dsh-agent-team` @ `9b582a1` (= the third-party recommendation's review baseline; tracked tree clean apart from untracked campaign evidence + one modified test script `tests/mock/scripts/boot.mjs`)
> Host baseline: `references/deepseek-harness-test-use` @ `a66e4702` (0.1.2-rc.1, porcelain = 0 — the V2 plan carries this baseline "unless the user re-rules"); TEST_METHODS.md documents the same 0.1.2-rc.1 series (@ `76fda72979`, R122)
> Inputs cross-checked (all read in full or at the cited seams):
> `docs/ROUTER_RULES.md`, `docs/TEST_METHODS.md`, `tests/mock/evidence/NOTES.md`, `tests/mock/evidence/REPORT.md` (findings list via NOTES), `docs/plans/third-party/dsh-agent-team_F3_F11_F9_T1.4_repair_recommendation.md`, `docs/plans/active/TEAM_DTEST_WORKSPACE_PLAN_V2.md`, frozen docs `docs/plans/paused/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md` (§7.4, §25, §27, §28, §29, §32, §42 invariants), `…_UI_Design_20260829.md` (§9, §26, §27.5, §46), `…_Development_Plan_20260829.md` (§21.3, §32), `…_Task_Decomposition_and_Review_Method_20260829.md` (gate/blocker taxonomy via ROUTER_RULES summary), and current source at the seams listed in §2.

---

## 1. Verdict summary (independent cross-check of all four findings)

Every claim of the third-party recommendation was re-verified against source at HEAD `9b582a1`. Result: **all four diagnoses are correct; all four fixes are downstream-only (zero upstream/core change); the recommendation needs six material corrections** (N1–N6 below) before it can be frozen.

| Finding | Diagnosis verdict | Fix verdict | Public contract change |
|---|---|---|---|
| F3 — `team_report_progress` hang → root deadlock | **VERIFIED** (non-reentrant shared per-team chain held across the member turn; 4 hang points + 1 success point all explained by lock topology) | **ACCEPTED WITH CORRECTIONS** (3-phase lock split; corrections N1, N3, N6 + caveats H3/H4/H5) | **None** |
| F11 — ledger UI silent truncation | **VERIFIED** (global-sequence frontier compared to per-team count; **three** code sites + one doc comment, not two) | **ACCEPTED WITH CORRECTION** (count-based completion + tail check at all four sites; shifted-base test fixtures are mandatory) | **None** |
| F9 — no human ingress for `user-approval` | **VERIFIED AND NARROWER THAN ASSUMED** (the T12-B4 trusted human-principal boundary already exists; the domain rules are correct; only the command surface is missing) | **ACCEPTED (F9-A) WITH CORRECTIONS** (one versioned method, existing `team` category, existing T12-B4 derivation — no new trust architecture); **F9-B REJECTED** | **Yes — Remote v4 (versioned, user adjudication U1–U4)** |
| T1.4 — UI create structurally blocked for blueprints with required non-persona requirements | **VERIFIED** (two-worlds mismatch: UI probe sees client persona facts only; the post-creation admission gate sees row-config facts; same blueprint, different verdicts) | **ACCEPTED (T1-B) — now the ONLY downstream-only option** (T1-A verified infeasible on 0.1.2-rc.1, see §3.4) | **Yes (semantic, versioned) — rides the shared v4 (U4/U5)** |

**No core change.** All four fixes live in this repo's 9 packages (+ `tests/mock` scaffold for verification). `CORE PATCH BUDGET = 0` holds. If any leaf discovers a genuine upstream gap during implementation, that leaf emits a `CORE_SEAM_BLOCKER` in the fixed format (ROUTER_RULES §5.1) — it never patches upstream and never converts it into a todo.

### The six material corrections to the third-party doc (frozen into this plan)

| # | Correction | Evidence (HEAD `9b582a1`) |
|---|---|---|
| **N1** | The F3 split must **also cover the Root initial-work path** — `createAdmitRootInitialWork` holds the SAME shared `coordination.chains` across the root (leader) turn's delivery (both v1 `team.create` `initialWork` and v2 `team.admitInitialWork`). A leader `team_delegate`/`team_follow_up`/`team_report_progress` during that turn deadlocks identically. The standard "Create & Send" flow stays deadlockable if the split omits it. | `packages/runtime/action-router/root-initial-work.ts` L586–606 (`withTeamLock(input.teamLocks, …)` around gate + `executeRootInitialWorkLocked`); `packages/runtime/src/plugin/root.ts` L805–814 (wires `teamLocks: coordination.chains`, the same coordinator created at L778); `packages/runtime/src/plugin/live/agent-bindings.mjs` L1558–1641 (`deliverRootInput` = `followup` + `whenIdle` — the whole root turn) |
| **N2** | F11 has **four** client sites, not two: ① `state/team-ledger-store.ts` L246 (`frontier >= total`), ② `model/ledger-adapter.ts` L484 (`completeThrough >= total`), ③ `model/team-ledger-model.ts` L384 (`remainingCount = max(0, total - completeThrough)` — sequence minus count, the false "0 remaining" badge), ④ `model/team-ui-snapshot.ts` L280–285 (doc comment of the rule). All must move to count-based completion. | Verified at all four sites, §2.2 |
| **N3** | The recommendation's F3 pseudocode catch path (`return await withTeamLock(… failClosedSettleLocked(…))`) **returns** the settlement effect. Current behavior — and required behavior — is **throw-after-settle** (`WORK_DELIVERY_FAILED` typed rejection to the leader + durable `delivery-failed` fact; T3.8b evidence, NOTES L160). Copying the pseudocode verbatim would make a failed delivery report success — a user-observable regression. | `packages/runtime/action-router/work-execution.ts` L479–493 (settle, then `throw new TeamRuntimeError(WORK_DELIVERY_FAILED, …)`); NOTES L160 (leader received typed rejection + `workOutcome:"delivery-failed"` fact seq 56) |
| **N4** | F9 needs **no new trust architecture**: `packages/runtime/src/plugin/s6-principal.ts` (T12-B4) already provides the trusted human-principal boundary — `ServerPrincipalContext` = the DSH web seam's connection gate (HMAC per-home cookie + loopback fence + same-origin, enforced 401/403 **before dispatch**; authority basis = "the single anonymous authenticated OPERATOR of this DSH_HOME"), and every non-admission mutation method already derives `{kind:'human', humanId: <validated teamSessionId>}` with `isOwnedRoot` ownership checks. The recommendation's "new boundary … should be tested separately" framing is overstated; the remaining work is one catalog method + one derivation branch + one handler case + the frozen UI §26 panel. | `s6-principal.ts` L63–143 (connection-gate-only transport), L278–285 (spoof rejection), L315/L394 (human derivation) |
| **N5** | F9's draft param field `rootSessionId` violates the wire convention: every existing team-scoped method uses **`teamSessionId`** (e.g. `team.getLedgerPage`, `team.ensureRootLive`). The v4 method must use `teamSessionId`. Also: `decision` must stay the service's closed 2-value set `{'allow','deny'}` (UI §26.3's `escalate`/`request-revision` are future vocabulary, not this round). | `packages/remote/src/handlers/team.ts` L350/L365/L384 (`pageParams.teamSessionId`); `packages/runtime/control/service.ts` L838–839 (`decision` closed check) |
| **N6** | F3 Phase C (settle) **must not be gated by the request abort signal**. The settle (success or fail-closed) is a durable obligation; if the leader's request signal aborts mid-delivery, Phase C must still run. The recommendation is correct by omission (no signal on Phase C) but it must be stated and tested, because the current single acquisition passes `asAbortLike(request.signal)`. | `packages/runtime/action-router/router.ts` L132 (`asAbortLike(request.signal)` on the single acquisition); `work-execution.ts` L477 (`deps.signal` passed to `deliver`) |

Additional verified hidden hazards the recommendation does not mention (folded into task packages, §5):

- **H1 = N1** (root-initial-work sibling; strongly recommended → made mandatory in D5/U6).
- **H2** — messaging coordinator's **private** map held across the recipient turn: `messaging/coordinator.ts` L296 (`const teamLocks = new Map()`), L512/L544 (`withTeamLock(teamLocks, …)` around `deliverOne`), `deliverOne` → `sessionInput.submitAttributedInput` → `agent-bindings.mjs` L1368–1388 (`followup` + `whenIdle` — awaits the recipient's whole turn). If the *recipient's* model replies with `team_send_message` inside a message-triggered turn, that send re-acquires the same private map → same self-deadlock class. Latent (not in the round-1 data), but the T6.1 success case (NOTES L228) proves models call team tools inside such turns. Disposition: **separate leaf F3-C, or explicit risk-record + characterization test** (decision folded into U6; recommended: implement — one file, one pattern).
- **H3** — the split opens a new interleaving: a second follow-up on the *same instance* can be admitted while unit 1 is in delivery (the facade gate already accepts RUNNING targets — `packages/runtime/admission/gate.ts` L128–145, `WORK_ACCEPTING_STATES` = CREATED/RUNNING/SETTLED). Settlement converges cleanly (`settleAdmittedWork` re-reads fresh with explicit SETTLED/ARCHIVED/DISPOSED arms, `work-execution.ts` L593+), so this is a documented semantic relaxation, not a contract violation — but it must be designed in, documented in the module doc, and covered by a dedicated test.
- **H5** — frozen-fencing constraint: `packages/runtime/test/p8s5b-operation-fencing.test.ts` (R1–R6, esp. the R5 2D stagger grid) pins that two concurrent new-work *consultations* serialize on one chain (CR-8). The 3-phase fix preserves this **only if Phase A still contains the compatibility gate AND the admission CAS/fact under the chain**. This is a hard constraint on F3-A's design freedom.
- **H4 = N6** (Phase C signal rule), and **H3** as above.

**Why the existing tests missed both F3 and F11 (verified):**
- F11: every fixture in `packages/client/test/team-ledger-store.test.ts` (e.g. `catchUpScenario` L100–112: sequences 1–5, total 5; `lyingTotalScenario` L114–125; `refreshAppendScenario` L127–148) starts at sequence **1**, where frontier ≡ count and the unit mismatch is invisible. A shifted-base fixture would have failed pre-fix.
- F3: no test drives a member turn that re-enters the runtime under a shared chain with a real turn-awaiting delivery port.

---

## 2. Cross-check evidence map (finding → code, verified this session)

### 2.1 F3 — verified deadlock chain

```
leader team_delegate / team_follow_up
  → executeGuarded (control service's private map — packages/runtime/control/service.ts — independent of the shared chain)
  → runtime.performAction(delegate|follow-up)
  → isNewWorkAdmission (admission/gate.ts L148: category 'work'|'creation')
  → withTeamLock(coordination.chains, root, …, asAbortLike(request.signal))   ← ACQUIRED, HELD   [router.ts L121–133]
  → executeEffectLocked → runWorkAdmission/runDelegate (effects.ts L359–381)
  → executeWorkChain (work-execution.ts L334)  — module doc L15–19: "runs INSIDE the router's per-team lock"
  → CAS ADMIT_WORK + team-work-admitted fact + interval open
  → await workDelivery.deliver (work-execution.ts L467–493)
      → agent-bindings.mjs L1400–1458: handle.agent.followup → await whenIdle  ← MEMBER'S ENTIRE TURN, CHAIN STILL HELD
        │
        └─ member turn calls team_report_progress
             → argument validation pre-lock (typed rejection for bad enum — matches NOTES L113 "done" → TEAM_TOOL_BAD_ARGUMENTS)
             → executeGuarded (control private map — independent)
             → activity/ledger.ts recordProgress critical section 1: runtime.performAction(report-progress)
             → router: executeEffect → withTeamLock(coordination.chains, SAME root)
             → QUEUED behind the leader's own pending tail → waits forever   [coordination/index.ts L20–26: "Chains are NEVER re-entrant … deadlocks"]
```

Non-determinism fully explained: the `team_send_message` path does **not** hold the shared chain across a turn — the `send-message` effect commits only the intent fact under a brief shared-chain acquisition (`effects.ts` L228–249), and the delivery waits on the recipient's `whenIdle` under the **messaging coordinator's private map** (`messaging/coordinator.ts` L296/L512). Hence the T6.1 W2 relay-turn progress calls succeeded (NOTES L228) while every delegate/follow-up-triggered turn (NOTES L106–121 ×3, L169) deadlocked. No timeout exists anywhere on the cycle (the signal passed into `withTeamLock`/`deliver` is the leader's own request signal, which cannot abort while the leader is blocked on its own tool) → the hang is permanent.

### 2.2 F11 — verified sites (three code + one doc)

- Server semantics (no change): `packages/remote/src/handlers/team.ts` L363–387 — `nextAfterSequence` set **iff** `entriesAfter.length > limit` (i.e. `null` = server-confirmed tail for that team); `total = ports.ledger.countEntries(teamSessionId)` = **per-team** entry count; default limit 50 (`packages/remote/src/contracts/params.ts` L270). `sequence` space is **global across teams** in one domain (`packages/storage/repositories/ledger.ts` L85–119, single counter row per `team_domain`).
- ① `packages/client/src/state/team-ledger-store.ts` L240–250: `nextComplete = total !== null && frontier >= total` with `frontier` = highest **loaded sequence**; `continuePaging = tailReached === false && nextComplete === false`. dtestp6 (NOTES L235–240): page 1 = seq 69–118, cursor 118, total 68 → `118 >= 68` → stops with 18 entries (119–136) never fetched.
- ② `packages/client/src/model/ledger-adapter.ts` L484: `complete = state.total !== null && state.completeThrough >= state.total`.
- ③ `packages/client/src/model/team-ledger-model.ts` L384: `remainingCount = total === null ? 0 : Math.max(0, total - completeThrough)` — even after fixing ①–②, the "N remaining" badge stays dead for shifted-base teams (genuinely-partial states compute ≤ 0). Correct form: `Math.max(0, total - ledger.entries.length)`.
- ④ `packages/client/src/model/team-ui-snapshot.ts` L280–285: doc comment of the `partial` rule (`completeThrough < total`) — must be rewritten to the count semantics with ①–③.
- Blast radius (verified): `pendingControlByInstance` and historical `progress` rows are gated on `complete` (`team-ui-snapshot.ts` L293–300), so the wrongly-`complete` truncated ledger also **distributes pending badges from a 50-of-68 set** — F11 is not merely cosmetic. Fixing the four sites repairs this automatically (NOTES L240 "UI 的'全部已知完整'门控" confirmed in code).
- Adjacent, out of F11 scope (optional companion): `packages/client/src/ui/TeamLedger.tsx` L235–240 — `total === 0` renders the empty state and **swallows a tracker reject/RPC error** (NOTES L208 OBS(1)).

### 2.3 F9 — verified gaps and the existing boundary

- Client read-only: no resolve call anywhere in `packages/client/src` (only "待裁决" display strings, `TeamDock`/member-card badges, ledger rows — NOTES L167).
- Remote closed set: `packages/remote/src/contracts/catalog.ts` — 9 categories (DevPlan §21.3: "API 命名可调整，但 separation 固定", a floor "至少"), 26-method **versioned union** (23 v1 + v2 `team.admitInitialWork` + v3 `team.listRoots`/`team.ensureRootLive`); per-version sets `REMOTE_V2_ONLY_METHODS`/`REMOTE_V3_ONLY_METHODS` + typed `method-version-unsupported` rejection already exist as the established bump mechanism. **No control method in any version.**
- Domain rules correct and frozen: `packages/runtime/control/types.ts` L94–98 `CONTROL_RESOLVER_ROLES['user-approval'] = ['human']`; `control/service.ts` L877–884 role closure **before** envelope (invariant 37), L870–876 first-decision-authoritative, exactly-once consumption, external hard-policy precedence (NOTES L200–204 T4.7a).
- `resolveControl` **already accepts** a human caller: `control/service.ts` L822–843 (`caller: ActionCaller`, validated as `{kind:'human',humanId} | {kind:'instance',instanceId}`). Only the ingress is missing.
- **N4**: the T12-B4 `ServerPrincipalContext` boundary (connection-gate authority, spoof-rejecting human derivation) already exists — F9 reuses it; no new trust machinery.
- Frozen docs mandate the UI surface: Architecture §25.1 ("request explicit user approval" is a canonical control kind); UI §26.1–26.4 (pending-decision indicator → contextual decision panel with requester/kind/operation/reason/time/status + Allow/Deny-style labels + §26.4 external-policy-block display "Team decision: Allowed / Execution: Blocked by managed policy"). The F9 UI is the **specified** frozen surface that was never wired, not an extension.
- Residual state: the T4.1 user-approval request is permanently pending in the round-1 world (5 requests / 4 decisions / 1 consumed — NOTES L196); it becomes resolvable post-fix with **zero migration** (append-only ledger; a decision row is simply appended).

### 2.4 T1.4 — verified two-worlds mismatch

- Client assembles **persona facts only**: `packages/client/src/model/team-intent-model.ts` L395–408 (`intentEnvironmentFacts` → `[{domain:'persona', subject:<selected preset>, available:true, generation:0}]`).
- Host probe is a **pure caller-facts evaluator**: `packages/runtime/src/plugin/s6-remote.ts` L1412–1426 (`intent.probe` = `evaluateCompatibility({requirements, environmentFacts})`, no host facts consulted).
- required → complete → FATAL, no downgrade: `packages/runtime/compatibility/blueprint.ts` L72 (`complete: requirement.optional !== true`); Architecture §27.2 (FATAL ≠ Continue Anyway; invariant 47).
- **The probe evaluates a different world than the post-creation gate**: both `team.create` initial-work (`root-initial-work.ts` L587–595) and new-work admissions (`router.ts` L121–132) consume `options.environmentFacts()` = the **row config** `config.environmentFacts` (`root.ts` L589–595). The mock row config (`tests/mock/.dsh-home/profiles/web/cordis.patch.yml` L21–37) declares `tool/web`, `skill/base`, `persona/standard`, `mcpServer/dtest-mini` all `available: true`; blueprint `dtest-bp` requires `persona/standard` + `mcp/dtest-mini` (non-optional). Row-prober PASS (boot 08:25:41, NOTES L12/L68) vs UI probe FATAL (NOTES L61–64: "需求 req-mcp-dtest-mini — complete:true requirement unmet … structural FATAL, not downgradeable", Create button permanently disabled).
- Catalog is row-bound (single blueprint, `root.ts` L573); changing `optional` on the row blueprint is **unsafe** — F7 immutable snapshot (NOTES L166, `TEAM_RUNTIME_BLUEPRINT_HASH_MISMATCH`): editing the blueprint risks unresolving the bound snapshots of existing durable roots. **The fix must not touch the blueprint.**
- **T1-A infeasibility on rc.1 (verified this session against the upstream test-use checkout)**: the only client-visible inventory seam, `pluginInventory/list` (`references/deepseek-harness-test-use/packages/host/plugin-inventory/src/types.ts` L16–23), exposes per entry exactly `entryId / moduleName / enabled / fiberPhase` (+ preset roster rows with the same fields). **No** MCP facet identity (e.g. `dtest-mini`), no tool/skill/model-route availability. `moduleName` is a package specifier, not a capability facet. The client cannot derive capability facts from any public rc.1 seam → **T1-B is the only downstream-only option.**

---

## 3. Accepted / rejected third-party recommendations (explicit)

### 3.1 ACCEPTED (as amended by the corrections in §1)

| # | Recommendation item | Disposition |
|---|---|---|
| A1 | F3: 3-phase lock split — Phase A admit under lock / Phase B deliver without lock / Phase C settle under lock; reuse `withTeamLock`; no new public seam (coordination "no new seam" rule intact) | **ACCEPTED** — with N1 (also split the root-initial-work closure), N3 (throw-after-settle preserved, not the pseudocode's return), N6 (Phase C not gated by the request signal), H3 (overlap interleaving documented + tested), H5 (Phase A keeps gate + admission under the chain so p8s5b R5 stays green) |
| A2 | F3: forbidden patches — no coordinator bypass for report-progress, no second lock, no "auto re-entrant" coordinator, no fire-and-forget progress | **ACCEPTED** (all four remain forbidden in F3-A's task package) |
| A3 | F3: new invariant text — "Per-team serialization covers authoritative state transitions, not the lifetime of external/model execution. No shared TeamOperationCoordinator lock may be held across a member turn" — adopted into `coordination/index.ts` docs + review checklist | **ACCEPTED, EXTENDED** — "…may not be held across a member turn **or a root turn**" (N1) |
| A4 | F3 regression tests R1 (same-turn progress), R2 (multiple progress), R3 (concurrent other mutations) | **ACCEPTED** — plus mandatory additions: N3 delivery-failure throw test, H3 overlap test, N6 abort-mid-delivery test, F3B root-initial-work deadlock test, F3C (if adopted) messaging sibling test |
| A5 | F11: count-based completeness `complete = tailReached \|\| (total !== null && loadedUniqueEntryCount >= total)`, `continuePaging` its complement; wire schema unchanged; frozen tracker (`packages/remote/src/push/ledger-page.ts`) untouched | **ACCEPTED** — with N2 (all four sites: store, adapter, `team-ledger-model.ts` remainingCount, snapshot doc) and mandatory shifted-base fixtures (the exact blind spot) |
| A6 | F11: keep the `nextAfterSequence === null` tail premise; clarify (doc-only) that `total` is per-team | **ACCEPTED** — the premise is verified true in both handler implementations (`handlers/team.ts` L372–379; `s6-remote.ts` equivalent); the `packages/remote/src/contracts/types.ts` `total` comment may be clarified (documentation, not contract) |
| A7 | F9: F9-A — one versioned Remote contract change adding a human control-resolution command; host stamps the human principal; **no** client self-declared principal/role; `CONTROL_RESOLVER_ROLES` untouched; existing control durable semantics untouched | **ACCEPTED** — with N4 (reuse the existing T12-B4 boundary, no new trust architecture), N5 (`teamSessionId` wire field; `decision` stays `{'allow','deny'}`), D1 category placement = existing `team` category (see §4) |
| A8 | F9: adjudication text baseline (rec. §5.9) | **ACCEPTED as the adjudication template** — amended per N4/N5/D1 and re-issued in §4 (U1–U4) |
| A9 | F9: frozen UI §26 minimal panel (requester / kind / operation / reason / external-policy status / Allow / Deny) | **ACCEPTED** — it is the frozen UI §26.1–26.4 surface itself |
| A10 | T1.4: forbidden patches X1–X4 (no missing-fact re-interpretation, no required→WARNING downgrade, no persona-only preflight, no Continue-anyway) | **ACCEPTED** (re-affirmed; required→FATAL / optional→WARNING+ack / fail-closed on missing host fact all preserved) |
| A11 | T1.4: T1-B host-side fact completion as the preferred architecture ("更干净" long-term) | **ACCEPTED** — no longer a preference: T1-A is verified infeasible on rc.1 (§2.4), so T1-B is the **only** downstream-only option |
| A12 | T1.4: the change must be **versioned** even though the wire shape is unchanged (same request bytes, different host state → different result) | **ACCEPTED** — rides the shared v4 (D3) |
| A13 | Four new invariants (rec. §9.1–9.4) to be frozen this round | **ACCEPTED** — 9.1 extended per A3; 9.2/9.3/9.4 verbatim; see §6 |
| A14 | Two-batch structure: Batch 1 = F3+F11 (no protocol dispute, no public contract change); Batch 2 = F9+T1.4 (adjudicate first, then implement); CORE PATCH BUDGET = 0 | **ACCEPTED** — encoded as the DAG in §7 with the execution-discipline additions of `docs/ROUTER_RULES.md` (3 executions/leaf, 3 blind reviewers/gate, 3 substantive supplements/gate, git discipline) and `TEAM_DTEST_WORKSPACE_PLAN_V2.md` (3-boot one-world matrix) |
| A15 | Acceptance criteria (rec. §10) for all four findings | **ACCEPTED** — encoded verbatim as live-verification rows in §8 (D focused + G full) |

### 3.2 REJECTED (explicit, with reasons)

| # | Recommendation item | Disposition | Reason |
|---|---|---|---|
| R1 | **F9-B** (keep the Remote catalog frozen; typed-reject `user-approval` admission / defer the capability) | **REJECTED** | Removes a capability the frozen Architecture §25.1 explicitly names and the frozen UI §26 explicitly designs around; leaves the authority model unclosed (domain admits a `human` resolver the product can never satisfy). Only acceptable as an **explicit user ruling** with a recorded freeze-conflict note — i.e. if the user answers U1 with "no", the round records F9 as deferred, the UI shows the frozen §38 "Action required" state, and the T4.1 residue stays pending. The plan's default is F9-A. |
| R2 | A **new `control` category** for the v4 method (rec. §5.2 leans this way) | **REJECTED as the minimal option** (decision D1, user may still rule otherwise) | DevPlan §21.3 fixes the **separation** and is a floor ("至少"); adding a 10th category changes the frozen category set, while adding one method to the existing `team` category changes only the versioned method union. Control requests/decisions are TeamSession-aggregate durable state keyed by `rootSessionId` (Architecture §25.2) — a `team.*` scope is semantically exact. Smaller protocol surface, one ruling. |
| R3 | Rec. F9 draft params with `rootSessionId` | **REJECTED** (corrected) | Wire convention across every existing team-scoped method is `teamSessionId` (N5). |
| R4 | Rec. F3 pseudocode catch path verbatim (`return await withTeamLock(… failClosedSettleLocked(…))`) | **REJECTED** (corrected) | Must be throw-after-settle (N3); a returned settlement would report a failed delivery as success. |
| R5 | **T1-A** (client composition assembles all probe facts from a client-visible environment inventory) | **REJECTED — infeasible, not merely suboptimal** | Verified against rc.1: `pluginInventory/list` exposes no capability facets (§2.4). There is no public seam from which the client could derive `mcp/dtest-mini`-style availability; building one would require an upstream change (forbidden). |
| R6 | Provenance-tagged host-override/client-merge with per-fact provenance model (rec. §7.5 "更稳妥的内部模型") | **REJECTED as over-engineering** (simplified) | The strict rule (D4): client facts are accepted **only** for the `persona` domain; every other domain is taken exclusively from the host row facts (client capability claims are **discarded**, not overridden). This closes the fact-forging hole the recommendation worries about (a client can already forge `mcpServer/X available:true` against the pure probe) with a simpler, stricter rule and no internal provenance state. |
| R7 | Branded `LedgerSequence` / `LedgerEntryCount` types (rec. §3.6 "future hardening") | **DEFERRED** (not in this round) | Not required for the fix; the four-site correction + count-based completion + invariant 9.2 close the defect. Branded types are a candidate for a future hardening round. |
| R8 | F9 "new boundary … should be tested separately" as if new trust machinery were added (rec. §5.5) | **REJECTED as framed** (corrected to N4) | The boundary exists (T12-B4). What is tested: the new derivation branch (ownership check, spoof rejection) and the handler path — not a new trust architecture. |

### 3.3 Not decided by the third-party doc — required user decisions (this plan)

The third-party doc defers U1 (F9 bump) and U2 (T1-A/T1-B) to the user. The audits and this cross-check surface **four more** decisions the implementation cannot make. All seven are collected in §4 with recommended defaults. Batch 1 (F3/F11) needs **no** protocol ruling; only U6 (F3 scope) and U7 (regression scope) gate it, and both have non-blocking recommended defaults that the main agent may carry as recorded assumptions pending user confirmation — the user's explicit adjudications are still the gate for Batch 2.

---

## 4. Decisions required (user adjudication)

Format: `U#` id, options, recommendation, gates. The adjudication records land in `dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/adjudications.md` (main agent writes them after the user answers) and are hash-stamped into the CF2 contract-freeze record.

| # | Decision | Options | **Recommendation** | Gates |
|---|---|---|---|---|
| **U1** | Allow a Remote contract version bump (v4) for the F9 human control-resolution ingress? | (a) allow; (b) refuse → F9 deferred per R1 (capability deferred, UI "Action required", residue pending) | **(a) allow** — the adjudication text baseline is rec. §5.9 amended per N4/N5/D1 | CF2 → F9-H/F9-U/T14-H |
| **U2** | F9 method **category** placement | (a) existing `team` category; (b) new `control` category (10th — touches the frozen §21.3 separation set) | **(a) `team`** (R2) | CF2 |
| **U3** | F9 method **name + params** freeze | e.g. `team.resolveControl { teamSessionId: string, requestId: string, decision: 'allow'\|'deny', note?: string }`; host derives the human principal (T12-B4 pattern); **no** client principal/role fields on the wire; v1–v3 envelopes typed-reject the method (`method-version-unsupported`) | **As stated** (N5). Alternative name `control.resolve` only if U2=(b) | CF2 |
| **U4** | **Version strategy**: one shared v4 carrying both the F9 method **and** the T1.4 probe fact-completion semantics, vs separate v4 (F9) / v5 (T1.4) | (a) shared v4, two documented entries in the version record; (b) v4 = F9 only, v5 = T1.4 | **(a) shared v4** — one ruling, one client ship; the two changes are independent entries and either can be reverted by version without the other | CF2 |
| **U5** | T1.4 **authority placement + merge rule** | (a) T1-B strict: `intent.probe` evaluates host-completed environment — client facts accepted **only** for the `persona` domain; all other domains taken exclusively from the host row-config facts (the same injected source the post-creation admission gate consumes, `root.ts` L589–595); client capability claims discarded; missing host fact → unavailable → required FATAL, identical to the admission gate. (b) T1-A (rejected — infeasible, R5) | **(a) T1-B strict** (R6). Residual nuance to document, not block: the row's persona fact is a deployment default while the probe sees the *selected* preset — if they diverge against a required persona, the probe is **stricter** than the gate (refuses a creation that would be admitted) — safe direction | CF2 |
| **U6** | F3 **split scope + concurrency semantics** | (a) split **both** long-hold paths (member work chain **and** root-initial-work closure — N1); (b) member path only. Sub-decision: double-work-unit queuing after lock release (H3): (i) accept + document (FSM/convergence already safe; no new error code); (ii) add an in-flight guard with a new closed error code (heavier — new `contracts` surface + contracts version). Sub-decision: fail-closed wire behavior — preserve throw-after-settle (N3; a correctness requirement, not a choice) | **(a)+(i)+preserve** — (a) is non-negotiable for completeness (the standard "Create & Send" flow is the only team-creation path in the mock world); (i) keeps the frozen gate semantics (permissive about RUNNING targets) and avoids a new error vocabulary; N3 is recorded as a regression-test obligation | F3-A/F3-B start (assumed by default; user may confirm later — Batch 1 carries no protocol dispute) |
| **U7** | **Regression scope** for the V2 matrix rows outside the four findings: R-F2 / R-F5 / R-B7 — fix this round or re-verify as "behavior-unchanged fingerprint"? (V2 §0 makes this a user precondition; V2 §3 currently writes fix-verified PASS criteria for all 8 rows — audit finding #1) | (a) fix this round (adds new leaves); (b) re-verify unchanged this round — PASS = round-1 fingerprint persists, any change ⇒ new finding, recorded not gate-fail | **(b)** — the four-findings repair is the round's scope; the per-row criteria table in §8.2 encodes (b) as the default; the user may promote any row to "fix" with its own future leaf | A0 criteria table → G4 adjudication |

**External-wait structure:** U1–U5 are the round's only true external wait (they gate Batch 2 only). U6/U7 gate Batch 1 but have recorded recommended defaults; per the DAG (§7) Batch 1 starts off the near-zero-cost CF1 record while U1–U5 are still pending, so a late adjudication lands on an idle merge node (CF2), never on Batch 1's critical path.

---

## 5. Global invariants (frozen for this round)

### 5.1 What stays frozen (red lines — any violation is a gate failure, not a deviation)

1. **CORE PATCH BUDGET = 0** — `references/deepseek-harness-test-use` stays pristine (porcelain-empty after every run); no upstream source diff, no private-API import, no patch mechanism (Architecture invariants 1/3; DevPlan C1–C3).
2. **Frozen 20260829 documents untouched** — the four `docs/plans/paused/` docs remain read-only; `docs/plans/active/` is not edited by workers (this deliverable writes only under `dev/agent-workflow/evidence/`).
3. **`CONTROL_RESOLVER_ROLES` untouched** — `user-approval → ['human']` stays; leader/member still cannot stand in (invariants 36/37); external hard policy still gates every allow before the role check's downstream effects (Architecture §25.4, invariant 34); first-decision-authoritative, exactly-once allow consumption, "decision ≠ execution" (last-mile guard) all unchanged.
4. **Compatibility red lines** — required → `complete:true` → FATAL, no downgrade, no Continue-anyway (invariant 47); optional → WARNING + explicit ack; missing host fact → unavailable → fail-closed **identical to the admission gate**; blueprint snapshots immutable (no `optional` edits — F7).
5. **Per-team durable-mutation serialization preserved** — the single shared chain remains the only serialization seam for durable mutations; no new lock maps, no new public seams (coordination module doc L32–37 rule stays intact).
6. **Remote union versioning** — v1–v3 envelopes keep working; a new-version method from an old envelope is a typed `method-version-unsupported` rejection (the existing v2/v3 mechanism); no silent catalog edit (catalog module doc).
7. **Wire shapes** — `RemoteLedgerPageValue` (`entries`/`nextAfterSequence`/`total`), tool names/params/results, `WorkDeliveryResult`, settlement facts, error vocabularies: **unchanged**. Only `team.resolveControl` is added (v4-only), and only `intent.probe`'s **semantics** change (v4, same wire shape).
8. **Push red line** — no push except the two one-time user-authorized pushes (E2, H2); gated history is never force-pushed; `legacy-team-reference` is never a base (ROUTER_RULES §8; AGENTS.md red lines).
9. **Test-instance red lines** — verification runs only on the `tests/mock` world (port 3181 + minis 3491/3492, scratch in-workspace home per TEST_METHODS sandbox rules); `:3080` and the stable `D:\deepseek-harness` deployment are never touched; API keys are never printed (TEST_METHODS §3; V2 §0).

### 5.2 New invariants frozen this round (rec. §9, as amended)

- **INV-9.1 (runtime lock invariant)**: *"The shared per-team operation coordinator serializes authoritative state transitions only. It MUST NOT be held across model execution, member turns, **or root turns**, network calls, or other long-running external execution that can re-enter the Team runtime."* — adopted into `coordination/index.ts` module doc + the code-review checklist (N1 extension).
- **INV-9.2 (numeric domain invariant)**: *"Ledger sequence, log offset, entry count, page size, and loaded-count are distinct numeric domains and MUST NOT be compared as interchangeable scalar values."* — adopted into the F11 module docs (store header, adapter, section model, snapshot).
- **INV-9.3 (human authority invariant)**: *"Human authority is stamped only at a trusted host/UI boundary. Remote/client payloads MUST NOT be able to self-declare `caller.role = human`."* — adopted into the v4 contract record + `s6-principal.ts` docs.
- **INV-9.4 (compatibility completeness invariant)**: *"A compatibility verdict is authoritative only when every required requirement domain is represented by an authoritative environment fact source. Missing required facts remain fail-closed; the fix for incomplete observation is to complete the observation, not weaken the verdict."* — adopted into the v4 contract record + `s6-remote.ts` intent-port docs.

### 5.3 Documented semantic relaxations (recorded, not violations)

- **F3/H3**: after the lock split, two overlapping work units on one instance can be admitted-legal (second follow-up admitted while the first is in delivery). State converges via `settleAdmittedWork`'s fresh-read arms; no false evidence is ever produced. Documented in `work-execution.ts` module doc + a dedicated test. (U6 sub-decision (i).)
- **T1.4/persona**: the probe (selected preset) is strictly stricter than the gate (row default persona fact) when they diverge — safe direction, documented.
- **F9/single-operator model**: the human decider is "the authenticated operator of this DSH_HOME" (T12-B4); per-user identity is not distinguishable at this boundary (the upstream transport provides none) — recorded as the accepted authority basis; "no client self-declaration" (INV-9.3) is met.
- **F3/Phase C**: settle runs even after the request signal aborts (N6) — a deliberate strengthening of durability, documented.

---

## 6. Minimum frozen contract (what the round freezes, and what it does not)

**Frozen by this document (contract surface):**

1. **Batch 1 (F3 + F11): zero public contract change.** No remote method, no wire shape, no tool schema, no vocabulary, no upstream change. The only durable change is the lock-scope correction (runtime-internal) and the client completeness correction (client-internal), plus INV-9.1/9.2 doc adoption. This is recorded as **CF1** (hash-stamped) and is the gate for Batch 1 implementation.
2. **Batch 2 (F9 + T1.4): exactly one versioned remote change — `REMOTE_CONTRACT_VERSION_V4 = 4`** — containing, as two documented independent entries:
   - **Entry 1 (F9):** new method `team.resolveControl` (U2/U3), v4-only, closed param schema `{ teamSessionId, requestId, decision: 'allow'|'deny', note? }`, human principal host-derived via the existing T12-B4 `ServerPrincipalContext` (INV-9.3), v1–v3 envelopes typed-reject it.
   - **Entry 2 (T1.4):** `intent.probe` evaluates caller persona facts **merged with the row's authoritative environment facts** — client authority limited to the `persona` domain; capability domains host-only (U5); wire shape unchanged; required→FATAL / optional→WARNING / fail-closed on missing host fact preserved (INV-9.4).
   - Recorded as **CF2** (hash-stamped) after U1–U5 adjudication; both Batch-2 host tasks consume CF2, neither re-decides it.
3. **Not frozen by this round** (explicit non-claims): no new `contracts` package (domain) version; no new closed error vocabulary (H3 sub-decision (i)); no lifecycle FSM change; no `TeamLedger` schema change; no `tests/mock` scaffold changes beyond the established V2 asset set (scaffold changes are logged per item, never product code).

---

## 7. Executable DAG (nodes, serial/parallel edges, writers)

Convention: **one task = one branch = one worktree = one writer** (ROUTER_RULES §8.3). Verification nodes hold **no source branch** — they run against a disposable scratch world and write evidence under `dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/{focused,full,gate1,gate2,push1,push2}/` (main agent only). `int/repair-r1` is created by the main agent for the first integration; `legacy-team-reference` is never a base.

### 7.1 Node graph

```
PHASE 0 — PLANNING (main agent)
  A0  scope re-adjudication: 8-row V2 criteria table (§8.2); U7 default recorded
  A1  decision briefs for U1–U7 (this document §4 + rec. §5.9/§7.8 adjudication texts)
      │
      ├────────────► USER ADJUDICATION (the round's only external wait)
      │                U1–U5 (gate Batch 2)        U6, U7 (gate Batch 1 / G criteria)
      ▼
PHASE 1 — CONTRACT FREEZE (main agent, doc records, hash-stamped)
  CF1  Batch-1 "zero public contract change" record + INV-9.1/9.2 adoption list   ◄── U6, U7 (defaults ok)
  CF2  Batch-2 v4 freeze: U1–U5 adjudication record + method/params/merge-rule text + INV-9.3/9.4   ◄── U1–U5
      │
PHASE 2 — IMPLEMENTATION, BATCH 1          [gate: CF1]
  F11-L  (packages/client)  ──────────────┐  PARALLEL (disjoint packages)
  F3-A   (packages/runtime) ──┬───────────┘
      │                       (F3-B, F3-C after F3-A — pattern reuse; F3-B ∥ F3-C, disjoint files)
      ├──► F3-B  (packages/runtime, root-initial-work.ts only)
      └──► F3-C  (packages/runtime, messaging/coordinator.ts only)   [adopted per U6 default; else risk-record]
      │
PHASE 3 — FOCUSED VALIDATION (disposable scratch world; D evidence = fail-fast only, NOT round acceptance)  [gate: F11-L ∧ F3-A ∧ F3-B (∧ F3-C)]
  D0   dist rebuild (freshness gate) + fresh scratch home + preflight-check.mjs (1-min fail-fast)
  D-RUN one boot (3181/3491/3492; :3080 untouched):
        G-F3:  T2.6a canary (180s watchdog) → T2.6 full → B1/B2 sanity → B3 typed matrix → T2.10
        G-F11: team-B via API create (T1.4 still unfixed in Batch 1 ⇒ no UI create) → ≥50-fact fixture fill
               → R-F11 API half (suite-ledger-complete.mjs) + UI half
  D3   verdict: PASS → E0 │ fix-FAIL → back to F11-L|F3-* (executions 2..3) │ infra-FAIL → TEST_INFRA_BLOCKER (≤3, world rebuild)
      │
PHASE 4 — FIRST PUSH                      [gate: D3 PASS]
  E0  per-task review (non-implementer) + cherry-pick -x F11-L,F3-A,F3-B,F3-C → int/repair-r1
  E1  GATE-1: 3 blind independent reviewers (§8.3 reproduction floor)
  E2  user one-time approval → PUSH #1 (no force-push; SHA + evidence + log committed)
      │
PHASE 5 — IMPLEMENTATION, BATCH 2         [gate: CF2 ∧ PUSH #1]
  V4   (packages/remote + packages/client version handling)   — Batch-2 spine
      │
      ├──► F9-H  (packages/runtime s6-principal derivation branch + s6-remote handler case; remote port field)
      │        │
      │        └──► T14-H (packages/runtime s6-remote.ts intent port + root.ts row-facts wiring)   [AFTER F9-H: same file ⇒ serial]
      ├──► F9-U  (packages/client: frozen UI §26 decision panel + served-version gating)   [∥ F9-H/T14-H, disjoint package]
      └──► T14-V (verification-only, client; no product code change)                     [∥]
      │
PHASE 6 — FULL VALIDATION: V2 matrix, exactly ONE fresh world, 3 boots (TEST_METHODS isolation; G is the round's acceptance evidence)  [gate: F9-H ∧ T14-H ∧ F9-U]
  G0  fresh home (V2 §0) + dist rebuild + preflight
  G1  boot#1 (create, plain): P1 (G1 gate: **R-T14 UI create team-B w/ dtest-bp@1**) → P2 (R-F3 canary+full, B1–B3, T2.10)
      → R6 E2E (G2 gate, F5 no-reload check) → P3 → P4 (B4/B5, T4.3, **R-F9 human chain** = T4.1 allow half) → fixture fill (≥50 facts)
  G2  boot#2 (hardTools=true): kill-transition #1 (**R-B7 observation**) → T4.7 B6 → G4 (external-policy row semantics)
  G3  boot#3 (plain): kill-transition #2 (R-B7) → P5 checkpoint → **R-F2** → **R-F11** both halves → G5 → teardown
  G4  per-row regression adjudication (8 rows × A0-adjudicated criteria) + REPORT-V2.md / NOTES-V2.md
      │
PHASE 7 — SECOND PUSH + CLOSE
  H0  per-task review + cherry-pick -x V4,F9-H,F9-U,T14-H → int/repair-r1
  H1  GATE-2: 3 blind reviewers (reproduction floor = unit suites + Batch-2 focused live rows + artifact audit of the full-matrix evidence; NOT a 3× full-matrix rerun)
  H2  user one-time approval → PUSH #2 (SHA + evidence + log)
  H3  close: post-flight compliance (:3080 still 200, test-use porcelain empty, keys never printed, ports 3181/3491/3492 released),
      risk ledger (投机通过 entries), TODO closure → round CLOSED
```

### 7.2 Branch / worktree / writer table

| Node | Branch | Worktree | Writer |
|---|---|---|---|
| F11-L | `task/repair-r1-f11-ledger` | `.worktrees/repair-r1-f11` | F11-L worker only |
| F3-A | `task/repair-r1-f3-lock-scope` | `.worktrees/repair-r1-f3` | F3-A worker only |
| F3-B | `task/repair-r1-f3-root-initial-work` | `.worktrees/repair-r1-f3b` | F3-B worker only |
| F3-C | `task/repair-r1-f3-messaging-sibling` | `.worktrees/repair-r1-f3c` | F3-C worker only |
| V4 | `task/repair-r1-v4-catalog` | `.worktrees/repair-r1-v4` | V4 worker only |
| F9-H | `task/repair-r1-f9-host-ingress` | `.worktrees/repair-r1-f9h` | F9-H worker only |
| F9-U | `task/repair-r1-f9-client-ui` | `.worktrees/repair-r1-f9u` | F9-U worker only |
| T14-H | `task/repair-r1-t14-probe-merge` | `.worktrees/repair-r1-t14` | T14-H worker only |
| E0/H0 | `int/repair-r1` | main worktree | main agent only (cherry-pick -x, log, graph.yaml, evidence) |
| D/G | *(none — verification holds no source branch)* | — | main agent only (scratch world + evidence) |

### 7.3 Edges (serial vs parallel, explicit)

**Serial (hard dependencies):**
- `A0 → A1 → {USER}` — planning before adjudication; the briefs are planning's first outputs.
- `U6 → CF1 → {F11-L, F3-A}` — Batch 1 gate (U6 defaults may be carried as recorded assumptions).
- `U1–U5 → CF2 → {V4}` — Batch 2 gate.
- `F3-A → F3-B` and `F3-A → F3-C` — pattern reuse (the 3-phase split must exist before the siblings copy it).
- `F3-H chain: V4 → F9-H → T14-H` — V4 is the spine (F9-H consumes the frozen catalog); **F9-H → T14-H is serial by file** (both edit `packages/runtime/src/plugin/s6-remote.ts`; one writer at a time).
- `PUSH #1 → Batch 2 start` — Batch 2 builds on a reviewed, pushed base (clean cherry-picks, no rebase entanglement).
- `G nodes: G0 → G1 → G2 → G3 → G4` — the 3-boot topology is **world-state-serial by construction** (kill transitions are R-B7 observation points; P4 pending residue would pollute E2E, hence V2's E2E-forwarding rule). No intra-G parallelism is legal.
- `E0 → E1 → E2` and `H0 → H1 → H2` — review → gate → user-approved push.

**Parallel (legal, disjoint seams/packages):**
- `F11-L ∥ F3-A` — client ∥ runtime, disjoint packages (the round's only Batch-1 parallelism).
- `F3-B ∥ F3-C` — after F3-A; disjoint files (`root-initial-work.ts` ∥ `messaging/coordinator.ts`).
- `F9-U ∥ F9-H ∥ T14-H` — client panel ∥ runtime host tasks (disjoint packages); `T14-V` overlaps `T14-H` (verification-only).
- **Nothing else is parallel** — everything remaining is serial by world (G), by file (s6-remote.ts), or by gate.

### 7.4 Critical path

**Critical path (adjudication early — the normal case):**

```
A0 → A1 → USER(U1–U7) → CF1 → F3-A → F3-B → D0 → D-RUN → D3 → E0 → E1 → E2(PUSH#1)
     → CF2 → V4 → F9-H → T14-H → G0 → G1 → G2 → G3 → G4 → H0 → H1 → H2(PUSH#2) → H3
```

- `F11-L` runs in parallel with `F3-A` and is shorter (half a day) → the F3 chain dominates Batch 1.
- `F9-U` / `T14-V` / `F3-C` are off the critical path (disjoint-package/optional parallel leaves) unless they slip past their join node.
- **Critical path (adjudication after E2):** identical shape — CF2 joins at the Phase-5 gate with zero upstream cost (the design's point: a late ruling lands on an idle merge node, never on Batch 1).

**Indicative wall budget** (serial main-agent execution, V2 cost model): planning+briefs ~2h; CF ~1h; F3-A/F3-B/F3-C + F11-L ~4–8h (F11-L ∥ F3-A); D ~1h; GATE-1 ~2–3h; V4/F9-H/T14-H/F9-U ~5–9h (∥ where allowed); G (full matrix, 3 boots) ~3.5h (≈43 substantive + 15 micro model turns ≈ 72min hard model floor); GATE-2 ~2–3h ⇒ **≈ 1.5–2.5 days wall-clock**. Rework policy: 3 executions per leaf (ROUTER_RULES §2); ≤3 substantive supplements per gate (ROUTER_RULES §4); any 阻塞 stops **all** further development (ROUTER_RULES §5) — a C-level block halts the round, it is not routed around.

---

## 8. Task packages (leaves) — one seam, one cognitive model, bounded context, exact acceptance

Convention: **⊕ = persistent test** (lands in the repo, reruns at every build and in every gate repro); **◌ = disposable test** (scratch world / probe, evidence-only, never committed as product code). Each package: objective / **seam (1)** / **cognitive model (1)** / file scope / context set (what the worker's brief contains — nothing else) / acceptance / forbidden / non-regression gates / execution cap (3).

### 8.0 A0 — Planning scope re-adjudication (main agent, doc record)
- **Model:** "four findings = four defect classes, never one compatibility bucket" (rec. §12); "V2 §3 criteria assume all-rows-fixed while V2 §0 defers scope — the per-row criteria class is a scope decision, not a test detail."
- **Seam:** plan surface only (this document + `dev/agent-workflow/graph.yaml` + execution log). No code.
- **Context set:** V2 §0–§3 + rec. §1 + round-1 REPORT.md findings list.
- **Acceptance (⊕ doc-record):** the 8-row table below; every repair-scope finding mapped to exactly one (model, seam, batch, package); U7 default (b) recorded; scope additions (if the user picks "fix" for any row) each get their own future leaf or an explicit not-fixed mark.

### 8.1 F11-L — F11 ledger completeness (leaf, client, ~half a day; no dependencies; ships first)
- **Objective:** eliminate the sequence/count unit mismatch in the client ledger completeness chain. **No public contract change; files confined to `packages/client`.**
- **Seam (1):** the `team-ledger-store.ts` pagination/completeness decision + its three downstream projections (the seam that made the truncation *silent*).
- **Cognitive model (1):** *"distinct numeric domains (sequence, count) are never compared as interchangeable scalars; completion = `tailReached || (total !== null && loadedUniqueEntryCount >= total)`"* (INV-9.2).
- **Work (exact):**
  1. `src/state/team-ledger-store.ts`: `continuePaging = tailReached === false && !(total !== null && entriesBySequence.size >= total)` (keep publishing `completeThrough: frontier` — its documented "highest loaded sequence" meaning is unchanged).
  2. `src/model/ledger-adapter.ts` L484: `complete = state.total !== null && state.orderedSequences.length >= state.total`.
  3. `src/model/team-ledger-model.ts` L384: `remainingCount = total === null ? 0 : Math.max(0, total - ledger.entries.length)`.
  4. Docs: module docs of all four files (store header L26–32, adapter L461–468, section model L18–21, `team-ui-snapshot.ts` L280–285) + `TeamLedger.tsx` L22 → count semantics (INV-9.2 adoption).
  5. (Optional companion, include by default) `src/ui/TeamLedger.tsx` L235–240: render the error state in the zero-rows branch when `error !== undefined` (NOTES L208 OBS(1)).
- **Context set:** rec. §3 (F11) only + CF1 + the file list above + the 3-execution cap + evidence path `dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/f11/`.
- **Acceptance:**
  - ⊕ **F11-T1 (regression, red pre-fix)**: shifted base — fixture pages for one team: `[69..118, cursor 118, total 68]` then `[119..136, cursor null, total 68]`, limit 50 → exactly 2 `getLedgerPage` calls (`after` 0 then 118), final `orderedSequences.length === 68`, `completeThrough === 136`, `loading === false`, `error === undefined`.
  - ⊕ **F11-T2 (regression, red pre-fix, small)**: sequences 7–11, `total 5`, limit 2 → 3 calls (`7-8 | 9-10 | 11`), all 5 loaded. (Pre-fix stops after page 1: frontier 8 ≥ 5.)
  - ⊕ **F11-T3 (non-regression)**: existing `catchUpScenario` (base-1, total 5) and `refreshAppendScenario` unchanged and green; the tracker still gates every page (a lying-total page is still rejected `total-decreased`).
  - ⊕ **F11-T4 (adapter)**: state with 50 loaded of `total 68` (frontier 118) → `completeness: 'partial'` and `pendingControlByInstance: {}`; same state with all 68 loaded → `'complete'`, and a request-without-decision in the previously-missing 18 entries now produces a badge count (assert the §27.3 gating flips exactly at full load).
  - ⊕ **F11-T5 (section model, red pre-fix)**: `deriveTeamLedgerSection` with `total 68`, 50 loaded entries → `complete === false && remainingCount === 18` (pre-fix: `remainingCount === 0`).
  - ⊕ **F11-T6 (rec. §3.9 nine-case matrix)** in the store/adapter tests: sequence starts at 1 / at 69 / at 10000 / `total < first sequence` (no early completion) / multi-page / overlapping page replay / duplicate-sequence dedupe / cursor-null tail / `total` known vs `total === null` (null ⇒ complete only via `tailReached`, never claims `complete` early). Key assertion everywhere: **`loadedUniqueEntryCount == server total`**, never `frontier >= total`.
  - ◌ **F11-T7 (acceptance, optional pre-push)**: mock-world repro of NOTES L235–240 (dtestp6 shape: team #2, 68 facts, seq 69–136, reload) via the existing `tests/mock` harness — a second `getLedgerPage` request after reload and UI last row = seq 136. Its durable form is the R-F11 rows in G (below), not the one-off script.
- **Forbidden:** any change to `packages/remote` (frozen tracker `push/ledger-page.ts` included), server handler, wire schema; any change to the tracker's shape/correlation checks; branded types (deferred, R7).
- **Non-regression gates:** client `vitest` full suite + typecheck green; `git diff --stat` confined to `packages/client`.
- **Execution cap:** 3.

### 8.2 A0 output — 8-row regression criteria table (default: U7=(b))

| ID | round-1 conclusion | V2 row | **A0 default criteria class** |
|---|---|---|---|
| R-F3 | member `team_report_progress` non-deterministic hang (3 hangs vs 1 success) → root deadlock | T2.6a canary + T2.6 full | **fix-verified** (F3-A/F3-B repaired) |
| R-F11 | ledger UI silent truncation (unit mismatch) | API half (suite-ledger-complete) + UI half (team B ≥50 facts, G5 tail row) | **fix-verified** (F11-L repaired) |
| R-F9 | no human resolve channel | T4.1 allow half (UI human allow → guarded write → consumed) | **fix-verified** (F9-H/F9-U repaired) |
| R-T14 | UI create structurally blocked (required non-persona) | G1: UI create team-B with `dtest-bp@1` | **fix-verified** (T14-H repaired) |
| R-F2 | non-directive root cold-resume loses leader face | boot#3: open team-B → cold revive → last-tools assertion | **unchanged-fingerprint** (default U7=(b): PASS = round-1 fingerprint persists — leader face 11 = 10 team_* + mcp, UI/face consistent; any change ⇒ new finding, recorded not gate-fail) |
| R-F5 | UI state needs full-page reload to converge | G2/G4/G5 "no-reload first" checks | **unchanged-fingerprint** (record the convergence path; reload = fallback; not a gate fail) |
| R-B7 | kill→immediate restart hits live conflict (bootstrap FAILED, retry OK) | boot#1→#2, #2→#3 transitions (D6 recipe) | **unchanged-fingerprint** (PASS = the D6 recipe works and the observed first-attempt behavior matches round-1; "两次均首次 boot 成功" is the *fix-verified* reading and applies only if the user promotes R-B7 to fix-scope) |
| R-F4/F7/F10 | semantic clarifications (quota per-template / immutable snapshot / guard 4-op wrap) | covered by B3 / matrix / T4.5 | **unchanged-fingerprint** (typed results identical to round-1 fingerprints; behavior change = new finding, recorded) |

### 8.3 GATE-1 / GATE-2 mechanics (ROUTER_RULES §3, with an explicit reproduction floor)
- **Composition:** 3 fresh subagents, no session inheritance, mutually invisible, none participated in implementation; brief = gate definition + exit criteria + the four frozen docs' relevant sections + the CF1/CF2 records + commit range base→head + repro steps **only** (process docs — ROUTER_RULES, log, `dev/agent-workflow/` — are **not** review objects; no opinion relaying; each reviewer independently runs key verification).
- **Reproduction floor (keeps 2×3 reviewers affordable):** ⊕ unit suites for all four findings + one fresh boot running the changed findings' focused live rows (F3 canary, F9 chain, T1.4 UI-create, F11 API half) ≈ 45–60 min each; the full-matrix run is **audited from artifacts** (durable logs, domain dumps, gate snapshots), not rerun 3×.
- **Verdict flow:** all 3 ∈ {通过, 投机通过} ⇒ gate passes; any 补充内容 ⇒ compatibility check vs frozen docs (conflict ⇒ BLOCKED, not executed) ⇒ substantive supplement (≤3 per gate) ⇒ **full re-review by 3 fresh reviewers with zero leakage of the prior round**; any 阻塞 ⇒ stop everything, fixed-format report, user release required. 投机通过 ⇒ risk-ledger entry (append-only, ROUTER_RULES §6). E2/H2 = user one-time push authorization; push to origin; SHA recorded in evidence + log.

### 8.4 F3-A — F3 lock-scope fix, member work chain (leaf, runtime, core fix; 1–2 days)
- **Objective:** split the member work chain so no shared per-team chain acquisition spans a model turn. **No public contract change.**
- **Seam (1):** `TeamOperationCoordinator` acquisition boundaries in the action-router (`router.ts` / `effects.ts` / `work-execution.ts`; `coordination/index.ts` comment-only).
- **Cognitive model (1):** *"per-team serialization covers authoritative state transitions only; no coordinator lock across member-turn execution"* (INV-9.1).
- **Work (exact):** export/shape the 3 phases of `executeWorkChain`: **Phase A `admitWorkLocked`** = fresh read + dedup scan + CAS + admission fact + interval open, under `withTeamLock(teamLocks, root, …, asAbortLike(request.signal))` — **must keep the compatibility gate and the admission CAS/fact inside this acquisition (H5)**; **Phase B `deliverWork`** = the port call only, **no shared lock, and the request signal may abort the delivery (current behavior preserved)**; **Phase C `settleWorkLocked`** = interval close + `settleAdmittedWork` / fail-closed, re-acquired **without** the abort signal (N6/H4); **on delivery fault: Phase C runs, THEN `throw WORK_DELIVERY_FAILED`** (N3 — throw-after-settle preserved, never the pseudocode's return). `executeWorkChain` may remain the 3-phase orchestrator for existing test imports. Module doc: adopt the INV-9.1 text + the H3 overlap note.
- **Context set:** rec. §2 (F3) only + CF1 + the file list (`action-router/router.ts`, `action-router/effects.ts`, `action-router/work-execution.ts`, `coordination/index.ts` [doc note only]) + the non-regression suite list + 3-execution cap + evidence path `…/f3/`.
- **Acceptance:**
  - ⊕ **F3-T1 (the F3 regression; red pre-fix = deadlock)**: fake `workDelivery.deliver` that (a) awaits one microtask, (b) from *inside* `deliver` calls the **same** runtime's `performAction` with `report-progress` for the member caller (faithful variant: `activity.recordProgress` end-to-end), awaiting its result, (c) returns a succeeded `WorkDeliveryResult`. Assert: outer follow-up resolves; progress audit fact + activity row durably committed; work unit SETTLED with `memberResult` propagated. Pre-fix: detect the deadlock by bounding the awaited chain with a microtask-budget race (the repo's controlled-stagger idiom) and fail on non-termination.
  - ⊕ **F3-T2**: two sequential progress calls inside the simulated member turn → both recorded (per-subject `head+1` guard orders them).
  - ⊕ **F3-T3**: an unrelated same-team mutation (e.g. `resolve-control`) issued while `deliver` is pending resolves — delivery no longer serializes the team's other mutations.
  - ⊕ **F3-T4 (H3 new interleaving)**: concurrent follow-up on the *same instance* while unit 1 is in delivery (fake `deliver` waits on a flag): unit 2's Phase A admits (RUNNING accepted); unit 1's delivery then fails → no fake RUNNING at end, both settlement facts present (one `delivery-failed`, one `settled`), unit 2 settles via the fresh-read convergence (no spurious `DURABLE_WRITE_FAILED`). Module doc carries the "overlapping work units on one instance are admitted-legal" note.
  - ⊕ **F3-T5 (N6 abort)**: signal aborted before the Phase A wait → rejects with the abort reason (current behavior); aborted during delivery → delivery rejects → **fail-closed settlement still commits** (Phase C ignores the aborted signal).
  - ⊕ **F3-T6 (N3 delivery failure)**: delivery fault → leader receives typed `WORK_DELIVERY_FAILED` **and** the durable `delivery-failed` settlement fact exists (throw-after-settle; T3.8b wire behavior preserved).
- **Forbidden:** bypassing the coordinator for report-progress; a second lock map; an "auto re-entrant" coordinator; fire-and-forget progress; moving the compatibility gate or the admission CAS/fact out of Phase A (H5); changing the replay/resume/full retry protocol (fact-based; crash-window logic moves whole into Phase A, untouched).
- **Non-regression gates (all green, same suites as round-1):** `test/p8s3-work-chain.test.ts` (dedup/replay/resume/R6 fail-closed), `test/p8s5b-operation-fencing.test.ts` **full suite incl. the R5 2D stagger grid** (zero `NO_STATE_AFTER_REPROBE` with the shared chain — proves Phase A still closes CR-8), `test/p6t5-progress.test.ts`, plus the runtime typecheck/build.
- **Execution cap:** 3.

### 8.5 F3-B — F3 sibling: root initial-work path (leaf, runtime, ~half a day; after F3-A; U6 sub-decision (a) — mandatory)
- **Objective:** apply the same 3-phase split to the Root initial-work closure (N1). **No public contract change.**
- **Seam (1):** `createAdmitRootInitialWork`'s lock scope in `action-router/root-initial-work.ts` (the closure already separates the three steps — admission fact → `deliverRootWork` → terminal fact — so this is a lock-scope move, not a rewrite).
- **Cognitive model (1):** same as F3-A, extended: *"…no coordinator lock across a member turn **or a root turn**"* (INV-9.1 as adopted).
- **Context set:** rec. §2 + the N1 entry of this document + CF1 + `action-router/root-initial-work.ts` + the non-regression suite list + 3-execution cap + evidence path `…/f3/`.
- **Acceptance:**
  - ⊕ **F3B-T1 (red pre-fix = deadlock)**: fake `deliverRootWork` that from inside calls the leader's `performAction(delegate)` / `report-progress` on the same root → resolves post-fix, deadlocks pre-fix (microtask-budget race detection as F3-T1).
  - ⊕ **F3B-T2**: `test/tcm-m3-root-initial-work.test.ts` suite green (replay/retry/payload-mismatch/terminal-fact semantics unchanged — scanner + fingerprint contract intact).
- **Non-regression gates:** `tcm-m3-root-initial-work` + `tcm-m3-root-work-glue` + runtime typecheck/build.
- **Execution cap:** 3.

### 8.6 F3-C — F3 sibling: messaging coordinator private map (leaf, runtime, ~half a day; after F3-A; ∥ F3-B; adopted per U6 default — if the user declines, this leaf becomes a risk-ledger entry + one characterization test only)
- **Objective:** stop holding the messaging coordinator's **private** map across the recipient turn (H2): acquire for plan derivation + target liveness, release, call `sessionInput.submitAttributedInput` lock-free, re-acquire to commit the confirmation fact (the confirmation's `allocateSequence` is atomic on the domain write chain — `storage/repositories/ledger.ts` L94–104 — so concurrent confirms cannot interleave writes). **Files: `packages/runtime/messaging/coordinator.ts` only. No public contract change.**
- **Seam (1):** the messaging coordinator's private chain acquisition boundaries.
- **Cognitive model (1):** same as F3-A, applied to the second (private) chain: *"no chain — shared or private — may be held across a turn it observes."*
- **Context set:** the H2 entry of this document + CF1 + `messaging/coordinator.ts` + `agent-bindings.mjs` L1364–1389 (read-only context) + the p6t3 suite list + 3-execution cap + evidence path `…/f3/`.
- **Acceptance:**
  - ⊕ **F3C-T1 (red pre-fix = deadlock)**: fake `sessionInput.submitAttributedInput` that from inside issues a second `sendTeamMessage` through the same coordinator → resolves post-fix, deadlocks pre-fix.
  - ⊕ **F3C-T2**: `test/p6t3-send-delivery.test.ts` / `test/p6t3-restart.test.ts` green (R2/R3 recovery: intent survives delivery failure; `recoverPendingDeliveries` semantics unchanged).
- **Non-regression gates:** p6t3 suite + runtime typecheck/build.
- **Execution cap:** 3.

### 8.7 V4 — Remote v4 catalog + version handling (leaf, remote+client, Batch-2 spine; after CF2 ∧ PUSH #1)
- **Objective:** implement the shared v4 per CF2 (U1–U4): `REMOTE_CONTRACT_VERSION_V4 = 4`; extend `SUPPORTED_REMOTE_CONTRACT_VERSIONS`; `REMOTE_V4_ONLY_METHODS = ['team.resolveControl']` (U2/U3); version-aware closed param schema `{ teamSessionId, requestId, decision, note? }` in `params.ts`; client `callWithVersion('team.resolveControl', …, V4)` plumbing + served-version gating (response `contractVersion`) + `method-version-unsupported` passthrough. **One version record with two documented entries** (F9 method; T1.4 probe semantics — the T1.4 entry's *code* is T14-H, its *contract text* is frozen here).
- **Seam (1):** the remote contract catalog/version handling (`packages/remote` + the client's versioned-call surface).
- **Cognitive model (1):** *"a versioned union grows by explicit bump, never by silent edit; every old envelope keeps its exact typed behavior"* (INV-9.3 at the envelope level).
- **Context set:** CF2 (the U1–U5 adjudication record) + rec. §5 (F9) + `packages/remote/src/contracts/{version,catalog,params,types}.ts` + the existing v2/v3 bump precedent + 3-execution cap + evidence path `…/v4/`.
- **Acceptance:**
  - ⊕ v1–v3 callers of `team.resolveControl` → typed `method-version-unsupported`; v4 accepted.
  - ⊕ param validation: `teamSessionId`/`requestId`/`decision ∈ {allow,deny}` required; `note?` optional; any payload field carrying `callerRole`/`resolverRole`/`principal` is **stripped or typed-rejected** (INV-9.3 — no self-declaration).
  - ⊕ catalog fingerprint pinned to the CF2 hash (a catalog report test).
  - ⊕ client: served-version gating — an old host (v3) → the UI command surface is hidden/gated (buttons disabled, §26 pending state read-only); a new host (v4) → enabled.
- **Forbidden:** any v1–v3 envelope behavior change; any silent catalog edit; touching `packages/contracts` (domain v1 freeze).
- **Non-regression gates:** remote package full test suite (the v2/v3 bump tests must pass unmodified) + client version-handling tests + typecheck.
- **Execution cap:** 3.

### 8.8 F9-H — F9 host human-ingress (leaf, remote+runtime; after V4)
- **Objective:** wire the trusted-UI → host human-principal → control-service path (N4: reuse T12-B4, add nothing new).
- **Seam (1):** the trusted-UI → host HumanPrincipal boundary for control resolution (`s6-principal.ts` derivation branch + `s6-remote.ts` `team.resolveControl` handler case + one new `S6RemotePorts` field; `root.ts` already constructs the control service — wire it through; no new service).
- **Cognitive model (1):** *"human authority is stamped only at the trusted host/UI boundary; the payload is a command, never an identity"* (INV-9.3).
- **Context set:** CF2 + rec. §4–§5 (F9) + the N4 entry of this document + `s6-principal.ts` (existing derivation patterns L315/L394 + `isOwnedRoot`), `s6-remote.ts` handler table, `control/service.ts` `resolveControl` signature (read-only) + 3-execution cap + evidence path `…/f9/`.
- **Acceptance:**
  - ⊕ trusted command → host-stamped `{kind:'human', humanId:<validated teamSessionId>}` → `user-approval` resolved allow; durable `control-decision-recorded` with a human decider ref.
  - ⊕ **leader** resolve of a `user-approval` request → `CONTROL_RESOLVER_NOT_AUTHORIZED (allowed: [human])`; **member** → typed unauthorized (role closure unchanged, invariant 37).
  - ⊕ **no remote path can forge human**: a payload claiming a principal for a root the host does not own → typed rejection (the existing spoof-reject pattern, `s6-principal.ts` L278–285).
  - ⊕ exactly-once: re-resolve a consumed allow → `CONTROL_REQUEST_DECIDED` / `allow-consumed` behavior preserved.
  - ⊕ external hard policy still denies first (`CONTROL_EXTERNAL_POLICY_DENIED` precedes; T4.7a fingerprint preserved — no regression of the durable deny with `reason: 'external-policy'`).
- **Forbidden:** changing `CONTROL_RESOLVER_ROLES`; accepting any client-claimed principal/role field; relaxing first-decision-authoritative or exactly-once semantics.
- **Non-regression gates:** the existing control service suite (authority/roles/exactly-once/external-policy) + runtime typecheck.
- **Execution cap:** 3.

### 8.9 F9-U — F9 client UI decision surface (leaf, client; after CF2; ∥ F9-H/T14-H)
- **Objective:** implement the **frozen UI §26 surface** that was never wired: pending-control filter / contextual decision panel + Allow/Deny.
- **Seam (1):** the control details panel (pending detail view + [Allow]/[Deny] + `callWithVersion('team.resolveControl', …, V4)` + decision badge + §26.4 external-policy-block display).
- **Cognitive model (1):** *"the decision panel is the human ingress — a decision is a Team coordination fact, never the tool execution itself"* (UI §26.3; Architecture §25.3).
- **Context set:** CF2 + UI frozen doc §26.1–26.4 + §38 (error/limitation vocabulary) + rec. §5.6 minimal UI list + the existing pending-badge components (`TeamDock`, member-card `data-member-waiting`, `TeamLedger` rows — all data already present in ledger rows) + 3-execution cap + evidence path `…/f9/`.
- **Acceptance (⊕ persistent Playwright spec in the `tests/mock` scaffold):**
  - detail renders requester / kind / requested operation / reason / creation time / status / requested authority (all fields per §26.2, all already present in the ledger rows the client receives);
  - **Allow** → ledger human-decision row (decider `kind:'human'`) + member's guarded operation proceeds under exactly-once (the R-F9 live row in G is the durable form);
  - **Deny** → zero-side-effect row (request stays decided, no execution);
  - no human affordance for kinds where `human` is not in `CONTROL_RESOLVER_ROLES` (e.g. a `leader-approval` request shows the panel but the affordances reflect the closed role set);
  - §26.4 display: allow-under-external-policy renders "Team decision: Allowed / Execution: Blocked by managed policy" — never "approval failed";
  - served-version gating per V4 (v3 host → panel read-only, no buttons).
- **Forbidden:** client-claimed principal fields in any request payload; rendering a decision as execution; adding `escalate`/`request-revision` vocabulary (future, N5).
- **Non-regression gates:** client test suite (existing `TeamLedger`/dock specs) + typecheck.
- **Execution cap:** 3.

### 8.10 T14-H — T1.4 host probe fact-completion (leaf, runtime; **after F9-H** — same file `s6-remote.ts` ⇒ serial)
- **Objective:** make `intent.probe` a **faithful predictor** of the post-creation admission gate (U5/T1-B strict).
- **Seam (1):** the host `intent.probe` fact assembly in `s6-remote.ts` (+ `S6RemoteOptions.environmentFacts` + `root.ts` passing `config.environmentFacts` at the S6 construction — the **same injected source the admission gate consumes**, `root.ts` L589–595).
- **Cognitive model (1):** *"the probe and the gate must evaluate the same world; complete the observation, never weaken the verdict"* (INV-9.4).
- **Context set:** CF2 (Entry 2) + rec. §6–§7 (T1.4) + the U5 strict merge rule + `s6-remote.ts` intent port (L1412–1426), `root.ts` L589–611/L1498 area (wiring), `compatibility/blueprint.ts` (read-only) + 3-execution cap + evidence path `…/t14/`.
- **Work (exact):** `S6RemoteOptions` gains `environmentFacts`; the `intent.probe` implementation becomes: `hostFacts = options.environmentFacts`; `facts = hostFacts ∪ { client persona fact }` where **client facts are accepted ONLY for the `persona` domain** (client `persona` wins — the selected preset is user intent; every other client domain is discarded); then the existing pure `evaluateCompatibility`. Version record entry (already frozen in CF2): "intent.probe evaluates caller persona facts merged with the row's authoritative environment facts; capability domains are host-only."
- **Acceptance:**
  - ⊕ required MCP **present** in row facts ⇒ pre-create **PASS** (pre-fix FATAL — the T1.4 repro).
  - ⊕ required MCP **absent** from row facts ⇒ **FATAL** (fail-closed preserved, identical to the admission gate).
  - ⊕ optional requirement absent ⇒ **WARNING** + explicit ack path unchanged.
  - ⊕ persona mismatch ⇒ unchanged frozen behavior (the selected preset still drives the persona fact; §7.4 complete:true conflict semantics untouched).
  - ⊕ **(T1-B specific)** client asserting `mcpServer/X available:true` while host row facts say unavailable ⇒ **host fact wins** (client capability claim discarded — the forgery hole closed).
  - ⊕ probe/gate parity: for the same blueprint, every capability-domain verdict of the probe equals the admission gate's verdict on the same row facts (the predictor property, Architecture §7.4).
- **Forbidden:** X1–X4 (rec. §6.3); any `optional`/blueprint edit (F7); any change to the compatibility engine or its closed requirement domains; persona-domain client authority beyond the selected preset.
- **Non-regression gates:** the existing compatibility/admission suites + `s6-remote` test suite + runtime typecheck.
- **Execution cap:** 3.

### 8.11 T14-V — T1.4 verification-only (client, ∥ T14-H; no product code change)
- **Objective:** confirm the create-gate UX on merged probe results (probe call shape unchanged; panel rendering of PASS/WARNING/FATAL on the v4 host).
- **Seam (1):** the TeamCreationPanel probe→lane rendering path (read-only verification + spec assertions only).
- **Cognitive model (1):** same as T14-H (INV-9.4), from the user's side.
- **Acceptance:** the R-T14 live row in G **is** this leaf's durable form (UI create team-B with `dtest-bp@1` required-mcp → probe OPEN/PASS → create → admission PASS → root live). Any client code change discovered as *necessary* here is a deviation that must return to F9-U/T14-H scope with a logged reason — T14-V itself ships zero product diff.
- **Execution cap:** 3 (verification attempts; a fix-FAIL routes to the owning leaf's remaining executions, not to T14-V).

### 8.12 D — Focused validation (main agent; disposable scratch world; fail-fast only — **not** round acceptance; every D row reruns inside G)
- **Model:** "live-world observation: liveness + completeness, on the smallest world that can deadlock or truncate."
- **Seam (1):** the `tests/mock` harness world (boot.mjs, 3181, MCP 3491/3492, scratch in-workspace home — TEST_METHODS sandbox rules; :3080 untouched; API key never printed).
- **Why API create for team-B here:** T1.4 is unfixed in Batch 1, so V2's G1 UI-create path is structurally blocked; V2 §3 R-T14 FAIL behavior already defines the directive/API fallback. API/directive create is unaffected by T1.4 (the host-side gate sees full facts).
- **Exact acceptance (D3 PASS = all):**
  - G-F3: T2.6a canary `<180s` return + `progress-recorded` fact + turn end; T2.6 full (completed + UI activity/progress + ledger); B1/B2 delegate/follow_up settle with identity block; B3 six typed fingerprints **unchanged** (F3 must not alter typed-rejection paths); T2.10 archive/restore typed rejections unchanged (R-F4/F7/F10 fingerprint check).
  - G-F11: fixture ≥50 facts, non-first team; API half `Σ == total` to `cursor=null` + tail seq == durable domain tail; UI half renders the durable tail row, completeness indicator == server truth.
  - Blast radius: D5 watchdog clean everywhere; **no new finding beyond the regression table** (V2 redline: verify-phase code changes are scaffold-only, logged per item); post-flight: scratch world torn down, test-use porcelain empty, :3080 still 200.
- **Verdict routing:** fix-FAIL → back to F11-L/F3-* as execution 2/3 (ROUTER_RULES §2); a 3rd failure touching gate semantics ⇒ BLOCKED (§5, stop, user); infra-FAIL (boot/pre-flight) ⇒ `TEST_INFRA_BLOCKER`, world rebuild, ≤3.

### 8.13 G0–G4 — Full validation (main agent; one fresh world; the round's acceptance evidence)
- **Seams (1 each):** G0 = world assembly; G1 = live-work world (create → work → governance → control); G2 = policy-denied world (external hard policy); G3 = persistence world (resume/revive/teardown); G4 = report surface.
- **Exact acceptance:** V2 §3 table with **A0-adjudicated per-row criteria (§8.2)**: fix-verified rows R-F3 / R-F9 / R-F11 / R-T14 must PASS with fixed behavior (rec. §10 acceptance, verbatim: F3 = member can call `team_report_progress` multiple times in the same delegate/follow_up turn, all calls return, delegate settles, durable progress complete; F11 = pagination to the real tail, no UI omission, completeness == server truth; F9 = member request → UI visible → human Allow → durable human decision → member continues exactly-once, leader/member resolve → typed unauthorized; T1.4 = present⇒PASS / absent⇒FATAL / optional⇒WARNING+ack / persona unchanged); unchanged rows R-F2 / R-F5 / R-B7 PASS = round-1 fingerprint persists (any change ⇒ new finding, recorded); R-F4/F7/F10 = typed fingerprints unchanged; R6 E2E full assertion set (sentinel 93B verbatim, `work-admitted`×3, SETTLED×3, leader report with exact paths); P5 checkpoint (deterministic instance ids across restart, tool faces, durable recovery); G4 deliverables `REPORT-V2.md` + `NOTES-V2.md` + post-flight compliance list (:3080 200, test-use porcelain empty, ports released, keys never printed).
- **World discipline:** 3 boots, world-state-serial by construction (kill transitions are R-B7 observation points; E2E-before-P3/P4 per V2 §2.5); one fresh home per V2 §0; no intra-G parallelism; verify-phase code changes = scaffold-only, logged per item.

---

## 9. Test inventory — persistent (⊕) vs disposable (◌)

| Class | Items |
|---|---|
| **⊕ Persistent — unit (land in `packages/*/test`, rerun at every build and in every gate repro)** | F3: F3-T1..T6 (incl. deterministic deadlock repro), F3B-T1/T2, F3C-T1/T2 (if adopted) + non-regression: p8s3-work-chain, p8s5b-operation-fencing (R5 grid), tcm-m3-root-initial-work, tcm-m3-root-work-glue, p6t3-send-delivery/restart, p6t5-progress. F11: F11-T1..T6 (nine-case matrix + shifted-base red tests + projection consistency) + existing scenario non-regression. F9: v4 version rejection v1–v3, param validation, no-self-declaration, leader/member `NOT_AUTHORIZED`, exactly-once, external-policy precedence, served-version gating. T1.4: present⇒PASS / absent⇒FATAL / optional⇒WARNING+ack / persona-unchanged / client-cannot-override-host / probe-gate parity |
| **⊕ Persistent — Playwright (mock harness: `tests/mock` scaffold + `scripts/` + `gates/*.json` — the established persistent regression asset, V1→V2 precedent)** | R-F3 canary+full row; R-F11 API+UI halves; R-F9 human-chain row (T4.1 allow half); R-T14 UI-create row; R6 E2E assertion set; G1–G5 gate configs; fixture protocol (team B ≥50 facts, API-create in D / UI-create in G); F9-U panel spec (fields, allow/deny, §26.4 display, version gating) |
| **◌ Disposable (scratch, evidence-only, never committed as product code)** | The D-world scratch home + all its forensics; T0-style dry runs; any single-shot canary variant not covered by a persistent row; scratch prompt experiments; the A3-style upstream seam probe (already performed by the planning subagent — its **conclusion** persists in this document §2.4/R5, its scratch notes do not). Rule: a disposable probe's *conclusion* persists (in adjudication/evidence records), its *world and scripts* do not; if a probe proves out, a persistent spec is written before it may be retired |
| **Never** | Product-code edits during D/G (V2 redline — failures are findings or fix-loop returns to the owning leaf); writes to `references/deepseek-harness-test-use` (pristine; porcelain-empty check after every run); anything on :3080 or the stable DSH_HOME |

---

## 10. First-push and second-push scope (explicit)

### 10.1 PUSH #1 (E2 — after GATE-1)
- **Scope: Batch 1 only** — `F11-L`, `F3-A`, `F3-B`, `F3-C` (if adopted; otherwise its characterization-test + risk-ledger entry), cherry-picked with `-x` onto `int/repair-r1` from their task branches.
- **Contract content: none** — zero public contract change (CF1). The push carries the runtime lock-scope correction, the client completeness correction, INV-9.1/9.2 doc adoptions, and all ⊕ unit tests of Batch 1.
- **Evidence pushed with it:** CF1 record; D focused-validation evidence (`…/focused/`); GATE-1 reviewer verdicts + reproduction logs (`…/gate1/`); execution-log entries; SHA recorded.
- **Preconditions:** D3 PASS; per-task non-implementer reviews done; GATE-1 = 3×{通过, 投机通过}; user one-time push authorization (AGENTS.md red line — no push without it).
- **What it is NOT:** no v4, no F9/T1.4 code, no full-matrix evidence (that is PUSH #2), no `docs/plans/active` edits.

### 10.2 PUSH #2 (H2 — after GATE-2)
- **Scope: Batch 2** — `V4`, `F9-H`, `F9-U`, `T14-H` (T14-V ships zero diff), cherry-picked with `-x` onto `int/repair-r1`.
- **Contract content: exactly the shared v4** (CF2) — the `team.resolveControl` method (v4-only, closed params, host-derived human principal) + the `intent.probe` host-completed-environment semantics entry; the version record with its two documented entries; INV-9.3/9.4 adoptions.
- **Evidence pushed with it:** CF2 record; the **full V2 matrix** evidence (`…/full/`: 3 boots, one fresh world, per-row adjudications, durable logs, domain dumps, gate snapshots); `REPORT-V2.md` + `NOTES-V2.md`; GATE-2 reviewer verdicts + artifact-audit logs (`…/gate2/`); post-flight compliance list; SHA recorded.
- **Preconditions:** PUSH #1 landed; CF2 frozen (U1–U5 adjudicated); G0–G4 all PASS per §8.13 (fix-verified rows with fixed behavior; unchanged rows fingerprint-stable; R6 E2E full set); GATE-2 = 3×{通过, 投机通过}; user one-time push authorization.
- **Then (main agent, post-push):** `int/repair-r1` → `master` per the round's gate outcome (ROUTER_RULES §8: gate-passed history enters master; the push targets themselves are the user's per-push ruling — U-list item 4 in the original planning brief: the two one-time push authorizations and their remote refs are confirmed at E2/H2).

---

## 11. Rework, blockers, and open items

- **3 executions per leaf** (ROUTER_RULES §2): counted per task in the execution log; a local-only block may be skipped with TODO + evidence (TODO closed before the phase gate); a gate-semantics block after 3 executions ⇒ **blocked** state (ROUTER_RULES §5).
- **Blocker taxonomy** (task-doc §6 via ROUTER_RULES §5): `CORE_SEAM_BLOCKER` (fixed format — no upstream patch, ever), `CONTRACT_CHANGE_REQUEST` (LOCKED_SURFACE — e.g. if F9-H discovers `s6-remote.ts`'s port surface needs a second task's frozen field, it requests; it does not edit), `SPEC_CONFLICT`, `DEPENDENCY_BLOCKER`, `TEST_INFRA_BLOCKER` (≤3 world rebuilds in D).
- **阻塞 semantics:** stop **all** further development; no cross-gate, no "try-first" tasks; fixed-format report; user release required before any retry of the blocked gate.
- **投机通过:** risk-ledger entry (append-only) for GATE-1/GATE-2; subsequent bug work must consult the ledger first (ROUTER_RULES §6).
- **Open items reserved for the user** (all in §4): U1 (v4 bump), U2 (category), U3 (method+params), U4 (shared v4), U5 (T1-B strict), U6 (F3 scope incl. root-initial-work, queuing, throw-preserve), U7 (R-F2/R-F5/R-B7 scope), plus the two one-time push authorizations (E2/H2) and their remote refs.

---

## 12. Evidence paths (primary)

- Observation record: `tests/mock/evidence/NOTES.md` (F3: L106–121, L169, L228; F11: L235–240; F9: L167, L173–178, L196; T1.4: L61–72; T3.8b throw-after-settle: L160; T4.7a external-policy: L200–204; F7 immutable snapshot: L166), `tests/mock/evidence/REPORT.md`.
- Third-party doc audited: `docs/plans/third-party/dsh-agent-team_F3_F11_F9_T1.4_repair_recommendation.md` (F3 §2; F11 §3; F9 §4–§5; T1.4 §6–§7; invariants §9; acceptance §10; decisions §11–§12).
- Source evidence (all verified this session at HEAD `9b582a1`):
  - F3: `packages/runtime/action-router/{router.ts L96–146, work-execution.ts L15–19/L334–511/L593+, effects.ts L228–279/L359–389, root-initial-work.ts L553–607}`, `packages/runtime/coordination/index.ts`, `packages/runtime/admission/gate.ts L128–150`, `packages/runtime/messaging/coordinator.ts L296/L317/L415/L495–544`, `packages/runtime/src/plugin/live/agent-bindings.mjs L1364–1389/L1400–1458/L1558–1641`, `packages/runtime/src/plugin/root.ts L573/L589–611/L778–814`.
  - F11: `packages/client/src/{state/team-ledger-store.ts L200–274, model/ledger-adapter.ts L461–486, model/team-ledger-model.ts L377–392, model/team-ui-snapshot.ts L280–300, ui/TeamLedger.tsx L235–240}`, `packages/remote/src/handlers/team.ts L363–387`, `packages/remote/src/contracts/params.ts L270`, `packages/storage/repositories/ledger.ts L85–119`, `packages/client/test/team-ledger-store.test.ts L100–148`.
  - F9: `packages/remote/src/contracts/catalog.ts` (full), `packages/runtime/control/{types.ts L94–98/L174–175, service.ts L822–889}`, `packages/runtime/src/plugin/s6-principal.ts` (T12-B4 boundary), UI frozen doc §26.1–26.4, Architecture §25.
  - T1.4: `packages/client/src/model/team-intent-model.ts L395–408`, `packages/runtime/src/plugin/s6-remote.ts L1412–1426`, `packages/runtime/compatibility/blueprint.ts L37–76`, `packages/runtime/src/plugin/root.ts L573/L589–611`, `tests/mock/.dsh-home/profiles/web/cordis.patch.yml L1–55`, upstream `references/deepseek-harness-test-use/packages/host/plugin-inventory/src/types.ts L16–23` (T1-A infeasibility).
- Baseline confirmation: `git log` — HEAD `9b582a1` = the doc's review baseline; working tree carries only untracked evidence + one modified test script (`tests/mock/scripts/boot.mjs`, non-product); test-use @ `a66e4702` porcelain = 0.

---

*Planning deliverable complete. Next actor: the main agent — issue U1–U7 to the user, carry A0 (the §8.2 table) into `dev/agent-workflow/graph.yaml`, write CF1 off the U6/U7 defaults, and start F11-L ∥ F3-A on their task branches. No code, no `docs/plans/active` edits, no push were performed by this planning subagent.*
