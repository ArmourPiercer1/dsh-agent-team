G6-R1 step 5 — cross-task invariant combination review (reviewer 1, source-level)
Delta: 11b0584473c78e6d1aed179f3a06b5fb7fa0db2d .. 54950fb60f60d2318cc2e10af800e37c50f87192
Method: direct reads of the delta sources in this worktree (line cites below are against the tip of the delta).

(a) ActivationProvider sole creation entry; quota only at step 7; admit-once
  PASS
  - provider.ts:129-147 createActivationProvider: per-team promise chain (`teamLocks`) serializes ALL durable
    writes of one team; per-(domain,root) provisioning coordinator cache.
  - provider.ts:526-710 `activate` order: step 0 grammar → 1 TeamSession → 2 bound Blueprint (hash-checked) →
    admit-once identity `activationOperationIdentity(rootSessionId, source, requestToken)` (549-553) →
    existing durable op ⇒ `reDriveActivation` (554-557; NO re-admission, NO re-quota) → 3-5 address/caller/
    source → delegation target resolution ('continue' short-circuit 606-616 is read-only) → 6 compatibility →
    steps 7-15 INSIDE `withTeamLock` (631-709): 7 quota (637-638), 8 policy, 9 overlay bounds, 10 fields,
    11 allocateCheckedInstanceId (collision-checked under the lock; loud INSTANCE_ID_CONFLICT on identity
    divergence 657-664), 12 journal prepare = durable reservation (666-676), 13 child Agent+Session,
    14 TeamDomain bind, 15 commit MemberInstance + projection.
  - checks.ts:416-469 `countTeamQuota`: committed members PLUS in-flight PREPARED provisioning operations count
    toward BOTH team totals and concurrent-active AND per-template quotas (doc lines 424-431 explicitly: counting
    only committed records "would let parallel activations over-create (the G6 quota-race gate)").
  - checks.ts:498-531 `checkQuota`: all four bounds use `count + 1 > max` rejection semantics.
  - action-router/effects.ts:403-445 `runCreateMember`/`callProvider`: the facade's create effect builds a
    `MemberActivationRequest` and calls `ctx.activationProvider.activate` ONLY (invariant 26); the delegate
    effect (384-397) uses the provider for 'create' and a read-only fresh-view admission for 'continue'.
  - No other MemberInstance write path exists in the delta: tools layer has zero durable-domain access (E7 scan),
    messaging/activity/control write only their own fact families + session input via the public port.

(b) Facade instanceId-first; label/template → ACTION_ADDRESSING_REJECTED (live-verified)
  PASS
  - router.ts:12-28 documented enforcement order: step 2 resolves the target instanceId-first
    `(rootSessionId, instanceId)` ONLY (inv 18); label/template tokens REJECTED (inv 19).
  - admission/resolve.ts:165-202 `resolveInstanceToken`: token that parses as a template id →
    ACTION_ADDRESSING_REJECTED {kind:'template-id'}; a label matching a member → {kind:'member-label'};
    anything else not an instance id → {kind:'not-an-instance-id'}. Never silently resolved.
  - Live: E2 — label + template targets all rejected with TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED, member count
    unchanged (zero side effects); E5b fresh-token path re-confirms instance addressing end-to-end.

(c) Messaging two-record separation (facade ledger fact + target ordinary attributed input)
  PASS
  - messaging/types.ts:7-36: record (A) = TeamDomain LEDGER row (team-wide coordination fact, committed by the
    P6-T2 facade BEFORE delivery); record (B) = ordinary attributed input on the target Session via the injected
    SessionInputPort (the real public Session input API); "No Team-specific DSH SessionEvent vocabulary exists
    anywhere (invariant 42)".
  - messaging/coordinator.ts:318-459 `deliverOne` (ONE code path for live send and recovery): fresh plan + fresh
    target view (R1) → target liveness gate (CREATED/RUNNING/SETTLED; failure leaves the intent durable, R2/R4) →
    (a) `options.sessionInput.submitAttributedInput(input)` (416; AttributedSessionInput carries
    sessionId=target.childSessionId + attribution{kind:'team-relay', from…, intendedForInstanceId, correlation
    {requestToken, factSequence}}) → (b) confirmation fact `team-message-delivered` committed to the ledger with a
    fresh sequence (430-455; exactly-once per logical delivery).
  - R3 restart recovery (60-68, 556-633): scans durable ledger for intents lacking a confirmation fact;
    exactly-once on TeamLedger, at-least-once on session input.
  - Live: E5a delivery to the leader's bound root session with fact+delivered sequences; E5b "no pending delivery
    was skipped at recovery", post-restart message delivered with new durable sequences.
  - The p4t6 scanner (unchanged in the delta; count-maintenance only) still reports zero denylist hits in the
    whole tree — re-verified in my full test rerun (1214/1214).

(d) Control: first decision authoritative; no cached authority; external hard policy > allow; consultGuard
  PASS
  - control/service.ts:91-93 (invariant 45): the in-process holds NO cached authority state — every operation
    re-reads the durable repositories fresh; the `teamLocks` map is a concurrency chain, not authority.
  - control/service.ts:860-876 `resolveControl` under the team lock: `state.decisions.some(...)` →
    CONTROL_REQUEST_DECIDED "the first decision is authoritative" (870-876); role closure BEFORE the envelope
    (877-882, inv 37); stale target → durable `stale-denied` decision row FIRST then CONTROL_REQUEST_STALE
    (~905-919).
  - control/service.ts:923-946: an `allow` against an externally denied capability is impossible — recorded as
    deny with `reason:'external-policy'` FIRST (Architecture 25.4 / invariant 34: human override ≤ external hard
    policy).
  - control/service.ts:995-1140 `guardOperation` (the last-mile guard, under the team lock): malformed scope →
    CONTROL_GUARD_MALFORMED; team missing / member missing / lifecycle not CREATED|RUNNING|SETTLED → TARGET_STALE;
    no matching durable request (scope key root,target,action,toolName?,correlation) → NO_REQUEST; undetermined →
    REQUEST_PENDING; stale-denied → REQUEST_STALE; deny → DECISION_DENY; allow already consumed → ALLOW_CONSUMED;
    scope mismatch → SCOPE_MISMATCH; >1 unconsumed allow for one scope → throws CONTROL_GUARD_AMBIGUOUS (refuses
    to guess, 1102-1111); exactly one unconsumed allow + matching scope → commits a durable
    `control-allow-consumed` fact (1119-1131) and returns allowed:true.
  - tools/src/guard.ts:1-91 `consultGuard` (SD-GUARD): allowed → proceed (the guard consumed the allow —
    exactly-once); NO_REQUEST → proceed (documented deviation: the tool layer hosts the whole team surface, the
    leader's ordinary autonomy path must stay open; the runtime facade still enforces identity/authority/envelope/
    quota); every other reason → fail closed, runtime NEVER called, zero side effects. "The control service
    remains the SOLE authority on approval state: the tool layer adds no second check, no second cache, and no
    bypass."
  - tools/src/tools.ts:251-281 `executeGuarded`: a well-formed instance id ALWAYS consults the guard immediately
    before execution; a non-instance token (label/template) cannot form a guard scope and is routed straight to
    the facade, where instance-addressed resolution live-rejects it (ACTION_ADDRESSING_REJECTED) — it can never
    execute.
  - Live: E5b — boot-1 pending request survives restart; leader allow; guarded follow-up with the SAME
    correlation token EXECUTED (persisted allow consumed); retry of the SAME token BLOCKED (allow-consumed,
    exactly-once); fresh token with no request row proceeds (no-request deviation); after consumption the request
    row is decided.

(e) Activity: two-phase write; out-of-order REJECT strict head+1; pure projection
  PASS
  - activity/ledger.ts:1-57 header: every durable activity row written EXACTLY ONCE in two serialized critical
    sections — (1) THE FACADE (P6-T2 authority) via `performAction` `report-progress` (identity/role/liveness +
    `team-coordination-recorded` audit fact); (2) THE GUARDED COMMIT under the module's own per-team lock
    (reusing `withTeamLock` from action-router/effects): FRESH durable re-read, then (a) the out-of-order guard —
    claimed per-subject `sequence` must equal durable head + 1 EXACTLY, else ACTIVITY_SEQUENCE_STALE with
    `kind:'stale'` (claimed ≤ head — "a stale update can NEVER overwrite newer state") or `kind:'gap'` (claimed >
    head+1 — "a gap is never silently filled"); (b) interval guards (one open interval per
    (instanceId, subject, correlation)). Any guard failure → ZERO durable writes; repair by re-report at the
    re-read head+1.
  - activity/ledger.ts:268-300: the guarded commit implementation (head = max durable sequence; expected = head+1;
    mismatch rejects).
  - Purity: "It never reads or writes lifecycle state, member records, or quota counters; nothing downstream may
    consume an activity row as a lifecycle/completion decision (DevPlan §19.5)" (ledger.ts:53-57).
  - Live: E5a progress sequences 1,2 on subject 'e5'; E5b rows 1,2 survive restart and the post-restart report
    continues the per-subject sequence at 3 (strict head+1 across the restart).

(f) Tools layer depends only on the TeamRuntime public surface + public tool registration
  PASS
  - tools/src/index.ts:1-19 (package boundary): EVERY tool delegates to the TeamRuntime public surface (the facade
    plus the sanctioned satellites: control last-mile guard, messaging coordinator, activity ledger); "The package
    holds no team state, performs no durable write of its own, and registers through the host's public tool
    registration only (the P2-T4 characterized seam)."
  - tools/src/tools.ts:47-88 imports: only public package roots (runtime/admission|control|messaging|activity
    index.js, contracts) + local module files; NO storage/repositories import in the tools package source.
  - tools/src/types.ts:167-181 `TeamToolsOptions`: the injected surface is exactly { teamRuntime, controlService,
    messaging, activity, resolveCaller }.
  - tools/src/tools.ts:390-583: every tool body calls `ctx.options.teamRuntime.performAction` (the facade) or the
    sanctioned satellite methods; guarded work ops go through `executeGuarded` first.
  - E7 live static scan over exactly the five committed tool-layer source files (guard.ts, index.ts, tokens.ts,
    tools.ts, types.ts): zero violations (no direct durable-domain writes, no agent creation, no legacy
    SessionEvent vocabulary); the same rules are pinned by test/p6t6-bypass-scan.test.ts (passing in my rerun).

Cross-cutting checks
  - p6t6-bypass-scan target set == the five tools/src files (E7 assertion "scan covers exactly the five committed
    tool-layer source files"; the scan file list is pinned in the test).
  - All p6t1..p6t6 + p4t6 suites pass in my independent full rerun (1214/1214) and targeted rerun (560/560).
  - Domain reuse: the provider consumes the pre-delta (G3) `resolveDelegationTarget`
    (packages/domain/member/src/context-policy) whose persistent/fresh_per_delegation semantics are pinned by
    pre-delta t3-member-context-policy tests (fresh_per_delegation ⇒ kind:'create' even with an active member;
    persistent ⇒ continue on the existing work-accepting member) — the delta does not alter them.

CONCLUSION: invariants (a)-(f) hold in combination at the source level and are consistent with the live E1-E7
results; no combination gap found.
