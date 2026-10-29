# EXISTING-GOVERNANCE — how one governed Team tool call flows TODAY (master @ f7fbc0f67)

All paths repo-relative; line numbers on master. Two governed funnels coexist and BOTH run, per call:
the **static pipeline** (alpha.2 A5 pre-execute adapter on `tools/pre-execute` + end-cap guard) and the
**dynamic PA plane** (alpha.5 admission inside the plane row's `execute`, before its effect backend).
The closed-world Guard (alpha.5 PR1 tool-dispatch) wraps both on the three host seams.

## End-to-end flow (one call, e.g. `team_bash` / read-row / native-inherited governed name)

0. **Mount (once per agent setup)** — `agent-bindings.mjs:agentSetup`
   - `installScopedToolGuard` **agent-bindings.mjs:2449** → `tool-dispatch/install.ts` PREPARING order:
     1. `tools.guard` (closed-world body) install.ts:338 → arm :1016
     2. `tools.restrict`-style mask via caller's `applyBuiltInToolDeny` (MaskPort, install.ts header :1–50)
     3. stable Dispatcher definition register :495 region (guard body)
     4. presets/MCP/scope validation, `tools.get` REQUIRED seam check install.ts:350–383
     5. required listener set armed: `tools/pre-execute` door install.ts:758, `tools/result` settled edge
        install.ts:788–837, `tools/execute` dispatch gate install.ts:947–1012, `tools/change` watcher
        install.ts:1037 — then PUBLISH (scoped-dispatcher state PREPARING→ACTIVE); `publishPaMount`
        pa-mount-registry.mjs:36 (agent-bindings.mjs ~:3053) publishes (teamRoot, instanceId) → mount identity.
   - static pipeline installed LAST: `installParameterPermissionListener` **agent-bindings.mjs:3326** →
     `operation-permission/pre-execute-adapter.ts:897` (agent-scoped `tools/pre-execute` listener + MONOTONIC
     end-cap guard on `tools.guard` — the H1 anti-listener-ordering P0 fix, pre-execute-adapter.ts:70–90).
   - plane rows placed into the agent's OWN layer (own layer chains LAST) + bindOwnTools: team-tool-plane.mjs:1884–1900
     (`PLANE_PLACEMENT_CONFLICT` fail-closed :1891).
   - native takeover law (read/bash/jobs at native spellings only): team-tool-plane.mjs:465–479.

1. **Host dispatch begins** (pristine host @639ed01539 `packages/core/tools/src/index.ts`): guard stage
   → pre-execute waterfall → execute waterfall → `resolveExecution` :1578 (LATE re-resolve) → Body :1581.

2. **`tools.guard` stage** — closed-world Guard body (tool-dispatch/scoped-dispatcher.ts guard; decision
   `closed-world-guard.ts:guardDecision`):
   - state first: not ACTIVE → refuse `ADAPTER_DRAINING` (closed-world-guard.ts, "STATE FIRST" arm)
   - agent identity absent/foreign → `TOOL_BINDING_UNVERIFIED` (NEG-2 anti-laundering)
   - name not in the governed surface → `TEAM_TOOL_UNGOVERNED`; bound-but-UNVERIFIED (native shadowed /
     drift / unreadable) → typed refusal. **No native fallback exists on this path** — an unverified name is
     refused before any Body (see §7).
   - verified → pass (guard has no "allow", it only refuses; also hosts the end-cap DENY of the static pipeline).

3. **`tools/pre-execute` listeners** (two, in this funnel):
   a. **outer door lease** — install.ts:758–769: dispatcher not ACTIVE → `refuse('pre-execute')`; else lease + `next()`.
   b. **A5 static adapter** — pre-execute-adapter.ts (frozen pipeline, header diagram :10–60):
      - `classifyPermissionTool(exec.name)` pre-execute-adapter.ts:1307 → unsupported tool = pass-through `next()`
        (zero control rows; **this is where a NON-permission-family name leaves the static pipeline — for Team
        agents the closed-world guard is what keeps that pass-through safe**, plus the plane rows' own in-body PA)
      - `canonicalizeOperation(...)` :1325 (fail closed = deny, never `next()`) → canonical-operation.ts per-tool
        projections :668–709 (read window / write contentHash / edit hashes / lsp fields / shell command+workdir+
        runInBackground+timeout+sandbox)
      - `resolveOperationPermission(policy, op, rules)` :1480 (permission-resolver.ts — pure static decision)
      - **artifact-grant floor (read-only)** :1636 — `read` + strict lane → durable artifact-read grant check
        (a floor, never a ceiling) → `checkExternalOperation` live recheck :1246 → allow ⇒ **mark the exec object** + `next()`
      - leader exec-class dual gate (bash/pwsh without exec token → ask lane) — pre-execute-adapter.ts:32–36/:589–608
      - **ask lane**: `controlService.requestControl` :1948 (durable ApprovalCase row; kind user-approval|leader-approval)
        → `awaitControlDecision(..., signal)` :1990 (control/service.ts:3759) → allow ⇒
        `controlService.guardOperation(exact scope + fingerprint)` :2130 → control/service.ts:3240 — the durable
        **check-and-reserve consume** (`ALLOW_CONSUMED` replay refusal :3505; `consumedAt` fact :3639; the live
        external-hard recheck runs INSIDE the guard, before the consumption write) → allowed ⇒ `next()`;
        blocked ⇒ `{kind:'deny'}`.
      - **end-cap guard** (same install, monotonic on `tools.guard`): supported-name + UNMARKED exec (a hostile
        waterfall short-circuited the pipeline) → DENY `END_CAP_DENIAL_REASON` (pre-execute-adapter.ts:742).

4. **`tools/execute` dispatch gate (nearest the Body)** — install.ts:947–1012, THE H0-relevant seam:
   - `dispatcher.active()` :952 else throw-before-Body
   - **re-runs `dispatcher.guard(...)`** :957 (the whole closed-world question again, incl. live
     `readDefinition(name)` = `tools.get(name, runtimeAgent)` fingerprint compare, install.ts:396–410)
   - pending-call `arm(name, readDefinition)` :973 (pinned identity; re-arm replaces the verified binding = "armed once")
   - signal fuse `armWrapperSignal` :993 → install.ts:882+ (touches ONLY `exec.signal`, forwards the incoming
     signal + cause verbatim, restores in `finally`) — then **`await next()` install.ts:1005**;
     failure to make the call cancellable ⇒ throw (refuses rather than run unguardable).
   - `tools/change` watcher (LOAD-BEARING since A5-B3) install.ts:1018–1054: on a governed name's visible
     binding moving while a call is armed → revalidate + **raise the armed calls' signals** → the host's own
     pre-resolve abort check (host :1569/:1572) answers `ABORTED_BEFORE_DISPATCH` — a swap in the
     door→resolve window never resolves a Body.
   - `tools/result` settled edge install.ts:788–837: lease end + `noteCallEdgeDefinition` drift withdrawal +
     outcome classification `ABORTED_BEFORE_DISPATCH`=cancelled-before-body vs `ABORTED`=terminated-after-body-start.

5. **Body = plane row `execute`** (for plane names): a5p5 `runToolCall` pipeline
   (packages/tools/a5p5-tools/src/pipeline.ts: derive effects read-time → injected sync `decide` deny-lane
   re-check :103 (team-tool-plane.mjs createLaneDecide :523 — can only tighten) → **async PA edge** →
   backend.run → lease settle/spill → render).
   **Dynamic PA admission (PA admit)**: `paAdmit` team-tool-plane.mjs:~1011–1220:
   - `ensureAuthorityCurrent` (agent-bindings.mjs:2658 leg) republishes this call's generation on the bindings BEFORE capturing the AdmissionRequest
   - call-level facts read via `readPaCallFactsForCall` pa-mount-registry.mjs:362 (policy projection, ceiling,
     live binding entry, durable overlay generation) — `paBindingIdentityGap` team-tool-plane.mjs:663 refuses drift
   - `assembly.admitCall(request)` **team-tool-plane.mjs:1158** (tool-admission/admission-kernel.ts:222+) —
     allow/ask/deny against effect set + generations; deny ⇒ typed refusal, **zero grant, zero control row, body not run**
   - ask ⇒ `controlLeg` = `createPaControlLeg` **agent-bindings.mjs:2614** → pa-control-bridge.ts:
     requestControl → awaitControlDecision → `assembly.issueApprovedGrant` (PA-kernel-side mint,
     grant-mint.ts:74 `mintOperationGrant`) → `guardOperation` (the durable Control consume, control/service.ts:3240).
     No control service ⇒ `deny` (agent-bindings.mjs:2610–2611 — pending never means allow).
   - **execution edge (one-shot consume)**: `paAdmitEdge` team-tool-plane.mjs:1221 → fresh clock + generation
     recheck → `assembly.consumeForExecution(grant, ...)` **team-tool-plane.mjs:1406** → PA grant ledger
     consume (grant-mint.ts:111) + lease; replay/stale/expired ⇒ refusal before backend.
6. **Effect backend executes under constraints**: confined shell / anchored search+glob / governed read / jobs
   bridge (plane-effect-backends.mjs) or C-FS provider (`controlled-fs`) — effects happen only through
   kernel-consumed capabilities (Landlock launcher / FD-anchored open / owner fences).
7. **Settlement**: pipeline lease settle + spill attribution (a5p5 pipeline), result render (host render
   contract team-tool-plane.mjs:85–143), host `tools/result` → dispatcher lease end + outcome classification.

## Per-question answers

1. **Registration**: plane rows — `agentCtx.tools.register` in agentSetup (`agent-bindings.mjs:2553` loop;
   plane placement `team-tool-plane.mjs:1884+` via `createGovernedToolDefinitions`, a5p5 register.ts:151).
   Seams: `ctx.tools.register/guard/restrict/schemas(scope)` (public). No global mount ever (per-scope law).
2. **Interception**: three dispatcher seams + static adapter, order guard→pre-execute→execute→result,
   guard first-armed/last-removed (install.ts header; scoped-dispatcher `beginDrain` keeps the mask until
   self-counted zero). Precedence hazard (a prepended `tools/execute` listener vetoing the Team listener) is
   answered by the **monotonic end-cap guard**, not by listener order (pre-execute-adapter.ts:70–90).
3. **PA admission**: `admission-kernel.ts` (`createProductionAdmissionAssembly` :1034, `admitCall` via
   team-tool-plane.mjs:1158) — inside the row Body, before the backend. Identity inputs: live Binding entry +
   generations + policy projection + ceiling from the ONE call-level reader (pa-mount-registry.mjs:173–477).
   Pre-BODY hard refusals remain with the static pipeline + guard; PA is defense-in-depth pre-effect.
4. **Control ask**: `controlService.requestControl` (control/service.ts:2141) — durable row; leader ⇒
   user-approval, member ⇒ leader-approval (agent-bindings.mjs:3160–3167 "routing bit"; PTC row is a separate
   named bridge on `approval/request`, host.ts:2251). Reply maps back via `awaitControlDecision` (:3759) wait bridge.
5. **Grant**: minted ONLY center-side — PA kernel `mintOperationGrant` (grant-mint.ts:74, `grantIdForCall`
   admission-kernel.ts:198) or via the Control-consumed path (pa-control-bridge.ts:40 `issueApprovedGrant`);
   consumed at `consumeForExecution` (admission-kernel; one-shot, finite clock, lease) and, for the Control
   half, `guardOperation` consume-exactly-once (control/service.ts:3240, `ALLOW_CONSUMED` :3505).
   **Replay = typed refusal at both ledgers.** Family never mints/approves/consumes (CI-06 holds today).
6. **Fresh recheck / generation**: authority generation published/refreshed per call boundary
   (agent-bindings.mjs:4295/:4329 + the `ensureAuthorityCurrent` leg :2658); drift ⇒ `authority-generation-drift`
   refusal (kernel) / `GRANT_STALE` (execution edge); binding revision drift ⇒ guard unverified refusal;
   mid-call Definition move ⇒ armed-signal abort + settled-edge drift withdrawal.
7. **Native fallback prevention**: (a) closed-world guard refuses unverified/ungoverned names per governed agent
   (closed-world-guard.ts); (b) takeover only at the 5 sanctioned native spellings (team-tool-plane.mjs:465–479);
   (c) own-layer placement chains LAST so ancestor same-names fail the identity compare; (d) mask stays during
   drain (NEG-1); (e) teardown before publish → AgentSetup rollback; (f) for non-permission names the static
   adapter passes through BY DESIGN — safety rests on the guard + the row's own PA, which is precisely why the
   architecture demands the unified pre-body kernel (condition 5) rather than per-row bodies.
8. **H0 identity re-verification TODAY — PARTIAL, not absent**:
   - the dispatch door re-asks the FULL closed-world verdict (identity vs live `tools.get(name, agent)`
     fingerprint) at install.ts:957 before `next()` — this is the H0 a–f "identity verified" check, present;
   - the window AFTER that check but BEFORE host `resolveExecution` is closed by the armed signal +
     `tools/change` sync raise → host's own `ABORTED_BEFORE_DISPATCH` (install.ts:1018–1054; the same mechanism
     U4 sup-a re-proved, cells eq1–eq4);
   - **what today's flow does NOT do (the sup-a deltas):** (i) there is no single **center-owned approval
     table** spanning ALL governed names — the guard table covers the dispatcher surface, the PA mount covers
     call facts, the static adapter decides per-name classes; a name governed by one funnel but not another
     (e.g. a SAFE_UNMANAGED name like `todo_write` on a governed agent: static pipeline passes it, no PA row exists) is
     NOT re-verified as an *admitted call*; (ii) post-`next()` drift on a SUCCESS is recorded as a binding
     withdrawal (settled-edge note, "armed once" law) rather than fail-closed to a refusal as sup-a's eq3
     proposes — a disclosed divergence; (iii) the identity law is triplicated across three surfaces rather
     than one Kernel read. U6's next()-guard therefore hooks **exactly today's seam set**
     (`tools.guard` body + `tools/pre-execute` door + `tools/execute` gate + `tools/change` watcher +
     `tools/result` edge, all in `tool-dispatch/install.ts`) — the target is one Kernel-owned approval table
     behind that same arm order, NOT a new hook.
9. **Body execution**: plane rows (a5p5 pipeline → backends), native-inherited governed names run their native
   Body ONLY after the guard verifies the pinned Binding (verified-native lane); team_* tools run through
   root/glue ports (`executeTool` agent-bindings.mjs:5589). Settlement: lease/spill (pipeline), dispatcher
   lease + outcome class (install.ts), Control/PA audit facts (control rows, PA ledger).

## Gaps vs target (evidenced)

1. **Three decision funnels, one call** (guard / static adapter / in-body PA): the same identity+generation+ceiling
     question is asked three times with three code paths, over three partly-disjoint name sets: the guard covers
     every name on the governed agent, the static adapter only the seven permission tools (+ end-cap on those
     classes), the dynamic effect-based PA only the plane rows (team_grep/team_glob/team_bash/read/job_*); a
     SAFE_UNMANAGED inherited name (e.g. `todo_write`) is identity-guarded but has NO admission decision at all;
     no single Kernel state machine (§3 of architecture).
2. **The closed-world name knowledge lives in center tables** (`PLANE_RESERVED_NATIVE` ~60 names,
   SAFE_UNMANAGED/KNOWN_SENSITIVE, per-tool canonicalization switch) instead of Family Contributions (§4 boundaries).
3. **PA admits inside the Body** — pre-effect, not pre-BODY; the architecture's condition-5 order (kernel decide,
   family execute) requires the admit to move to the guarded dispatch path without a second ledger.
4. **No generic Family registration**: every family is hand-wired inside `agentSetup` (sup-b's finding);
   `registerA5GovernedFamily` (PR #360) prototypes the registration law but the families still reach center files.
5. **Post-success drift divergence** (see 8-ii) — sup-a closed it with a post-check; master chose the P8 "armed
   once" withdrawal law; U6 must re-decide explicitly, not silently inherit either.
6. **`mcp__` prefix law in glue** (agent-bindings.mjs:723) — Family-prefix knowledge outside the Registry.
