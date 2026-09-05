/**
 * MemberResidency — the productized member create/resume residency
 * (P5-T6; TaskDoc §11.5 P5-T6 card; ruling R34 owned surface
 * `packages/runtime/member-residency/**`).
 *
 * This module is the MEMBER_CREATE_RESUME productization of the DevPlan
 * §18.5 residency model: it orchestrates the durable TeamDomain writes
 * (the fresh-create path ONLY) around the P5-T1 `TeamAgentBinder`, so
 * that a member of a bound Team becomes — or comes back as — a resident
 * agent with its full overlay scope, through public seams only.
 *
 * Frozen object-model facts honored here (invariant numbers refer to the
 * frozen Architecture document §42):
 *
 * - Invariant 18 — the member runtime identity is the composite
 *   `(rootSessionId, instanceId)`; both components are stored and
 *   addressed, never a label, never a legacy `memberId`.
 * - Invariant 19 — no label/template addressing: the creation SPEC is
 *   the input, the DERIVED `(instanceId, childSessionId)` is the
 *   runtime identity ({@link deriveMemberIdentity}, `./identity.js`);
 *   re-drives of the same spec always reconstruct the same identity
 *   (Architecture §18.2 stable operation identity).
 * - Invariant 23 — every MemberInstance binds exactly one durable child
 *   Session (`childSessionId`); the binding is never re-pointed
 *   (invariant 24).
 * - Invariant 41 — the TeamDomain sidecar is the SOLE durable
 *   control-plane authority. Every durable write of this module goes
 *   through the injected {@link MemberDomainWritePort}; the binder
 *   (P5-T1) only ever reads.
 * - Invariant 42 — vNext has NO Team SessionEvents. This module emits no
 *   SessionEvents; its observability channel is the binder's
 *   `agent-setup/*` event RECORDS routed through the injected
 *   `TeamAgentSetupSurface` (the T1 event emitter).
 * - DevPlan §18.5 — MemberInstance and its child Session are DURABLE;
 *   the Agent residency is EPHEMERAL. The fresh path durably commits
 *   BEFORE the ephemeral agent-setup step (a crash between the two
 *   leaves a valid COLD member — the cold path is the recovery); the
 *   cold path restores the scope WITHOUT fresh-time side effects (no
 *   slot `apply`, no `installOverlay`); evicting a SETTLED residency
 *   drops the residency only — the durable records are NOT deleted, and
 *   the reverse (a dropped residency) never changes the lifecycle
 *   (Architecture §31: lifecycle != residency).
 * - DevPlan §18.2 — a member inherits the ROOT AgentPreset substrate;
 *   there is NO per-member preset selector. This module carries no
 *   substrate logic of its own: the substrate wiring lives in the
 *   injected overlay slots (T2 persona / T3 model / T4 capability),
 *   which the harness constructs with the root-keyed substrate seam.
 *   The module's "四槽位" (four-slot) install is the complete overlay
 *   set — the three frozen overlay slots
 *   (`persona`, `model`, `capability`, `OVERLAY_SLOT_ORDER`) — plus the
 *   admission GUARD decision point, all of which the binder installs /
 *   decides on every fresh and cold bind (the T1 contract).
 *
 * The three entry points:
 *
 * - {@link createFreshMember} (`./fresh-member.js`) — the first-time
 *   creation of one member: derive the identity from the spec, make the
 *   child Session artifact DUREABLE (the 18.5 "Session durable" barrier,
 *   BEFORE any durable write), persist the MemberInstance record (BEFORE)
 *   and the `team-member` session binding (idempotent + convergent
 *   re-runs skip the writes), then run the binder's fresh-member path
 *   (all three overlay slots installed + the admission decision).
 * - {@link rehydrateColdMember} (`./cold-member.js`) — the process-
 *   restart / re-admit path: restore the member scope from the durable
 *   TeamDomain onto the (re)created agent residency; an identity with no
 *   durable record is a zero-record, zero-effect no-op (`noopReason ===
 *   'absent'`, `durable` absent). Re-admission after an evict is this
 *   same path (idempotent; no duplicate records).
 * - {@link evictSettledMember} (`./evict.ts`) — the SETTLED-residency
 *   eviction: drop the live agent residency only (the handle may be
 *   absent — that is a no-op drop); the durable MemberInstance record
 *   and session binding are NOT deleted, and the lifecycle is NOT
 *   changed (Architecture §31).
 *
 * A member is NOT a continuable subagent: the only durable effects of
 * this module are the two TeamDomain rows, and the only agent-runtime
 * effects go through the four-method T1 surface — no subagent
 * registration channel exists in the port set (the negative property
 * must-tested in `packages/runtime/test/p5t6-*.test.ts` and asserted on
 * the real instance in the harness).
 *
 * Pure module: no I/O, no host imports, no `node:` builtins. All handles
 * are injected (mock-first unit tests; the real-instance harness binds
 * the DSH public seams through the same interfaces).
 *
 * @module @dsh-agent-team/runtime/member-residency/types
 */
export {};
//# sourceMappingURL=types.js.map