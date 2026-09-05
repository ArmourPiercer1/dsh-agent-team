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
import type { AdmissionGuard, OverlaySlot, OverlaySlotName, TeamAgentBindResult, TeamAgentSetupSurface, TeamDomainReadHandle } from '../agent-setup/binder/index.js';
import type { MemberInstanceRecordDto, MemberInstanceRecordInput, SessionBindingDto } from '../../contracts/src/index.js';
/**
 * The durable TeamDomain WRITE surface — the fresh-member path's only
 * writer (invariant 41). The real adapter is
 * {@link createMemberDomainWritePort} (`./write-port.js`) over the P4
 * `TeamDomain` repositories; unit tests may inject a fake.
 *
 * Failure of either method aborts the fresh-create fail-closed: the
 * error propagates to the caller, the binder is NOT run, and the
 * durable state remains at whatever the writes committed (the write
 * ORDERING of the fresh path — record before binding — makes a crash
 * between the two recoverable by a re-run; see {@link createFreshMember}).
 */
export interface MemberDomainWritePort {
    /**
     * Durably put the MemberInstance record, keyed by member identity.
     * @param input - the contracts v1 input (branded ids; schemaVersion is
     *   stamped by the repository).
     * @returns the frozen stamped record.
     */
    putMemberInstance(input: MemberInstanceRecordInput): Promise<MemberInstanceRecordDto>;
    /**
     * Durably put the session-kind binding row, keyed by session id.
     * @param binding - the contracts v1 binding DTO (fresh member: the
     *   `team-member` row).
     * @returns the frozen stored row.
     */
    putSessionBinding(binding: SessionBindingDto): Promise<SessionBindingDto>;
}
/**
 * The narrow EPHEMERAL-residency surface — the evict path's only contact
 * with the live agent runtime (ruling R28 discipline: one injected
 * interface per effect, every member rationale-documented):
 *
 * 1. `hasResidency` — the eviction observation: is a live agent
 *    residency (the ephemeral handle) present for the session? Residency
 *    is EPHEMERAL (DevPlan §18.5), so this reads live state, never the
 *    durable truth.
 * 2. `dropResidency` — the eviction effect: dispose the live residency
 *    (the real DSH public seam: the agent handle's public dispose). It
 *    MUST be a no-op when the handle is absent ("the handle may be
 *    absent", DevPlan §18.5) — absence is a settled world, not an error.
 *
 * The binder's `TeamAgentSetupSurface` is NOT extended for this: the T1
 * surface is frozen and install/restore-only; eviction is a T6
 * operation with its own minimal port.
 */
export interface ResidencyPort {
    /**
     * Whether a live agent residency currently exists for the session.
     * @param sessionId - the bound DSH session id (a member child session).
     * @returns `true` when the ephemeral residency is present.
     */
    hasResidency(sessionId: string): boolean;
    /**
     * Drop the live residency of the session (no-op when absent).
     * @param sessionId - the bound DSH session id (a member child session).
     * @returns `true` when a live residency was dropped, `false` when the
     *   handle was already absent.
     */
    dropResidency(sessionId: string): boolean;
}
/**
 * The child-Session DURABILITY barrier (DevPlan §18.5 "Session durable").
 *
 * The settled member world requires BOTH the durable MemberInstance/binding
 * rows AND the durable child Session. The fresh path creates the child
 * session LAZILY (the upstream persistence coordinator records intent only;
 * the artifact is published by the first append's write-behind batch), so a
 * crash between the MemberInstance commit and that batch's publication would
 * leave a durable member row pointing at a session with NO artifact on disk
 * — a world the zero-durable-write cold path cannot repair (DevPlan §17.4
 * expected end states). This barrier is the fix: the fresh path calls it
 * BEFORE the first durable TeamDomain write, so after the operation resolves
 * the child artifact is guaranteed to exist on disk.
 *
 * Contract (fail-closed, idempotent):
 *
 * - After `ensureDurable` RESOLVES, the child session's artifact MUST exist
 *   on disk (a header-only JSONL artifact when the session has no events
 *   yet) AND every pending append of that session MUST be durable.
 * - It MUST be idempotent: calling it on an already-durable session — or on
 *   a resumed session, whose load path already marked it materialized — is
 *   a no-op.
 * - It MUST be fail-closed: a rejection propagates to the caller and the
 *   fresh path performs ZERO durable writes (the barrier runs before the
 *   MemberInstance put).
 *
 * The real public seam is the upstream
 * `sessions.flush(liveSession)` service method (the same call the upstream
 * ACP row makes at session creation; rc.1's replacement for the alpha.1
 * `sessionPersistence.ensureMaterialized`): the attached log writer's
 * flush materializes a header-only artifact when none exists. The module
 * never reaches that service itself (ruling R28 mock-first): the harness
 * binds the live session handle here.
 */
export interface SessionDurabilityPort {
    /**
     * Make the child session's artifact durable (see the interface docs).
     * @param childSessionId - the derived durable child DSH session id (the
     *   fresh path's ONLY identity for this barrier).
     * @returns resolves when the artifact is durable; rejects on seam failure.
     */
    ensureDurable(childSessionId: string): Promise<void>;
}
/**
 * Every injected handle of the member residency. The module owns NO
 * state beyond this injection: the binder instance is created per call.
 */
export interface MemberResidencyPorts {
    /**
     * The binder's read-only TeamDomain handle (invariant 41 authority,
     * read side). The same handle must observe the writes of
     * {@link MemberResidencyPorts.writes} (true for one open TeamDomain).
     */
    readonly teamDomain: TeamDomainReadHandle;
    /** The durable write surface (fresh-member path only). */
    readonly writes: MemberDomainWritePort;
    /**
     * The child-Session durability barrier (fresh-member path ONLY — the
     * cold and evict paths never call it: the cold path is zero-durable-write
     * by construction). REQUIRED, not optional: the fresh path must not be
     * able to silently skip the 18.5 "Session durable" barrier — a missing
     * wiring is a type error (fail-loud convention).
     */
    readonly sessionDurability: SessionDurabilityPort;
    /**
     * The agent-setup surface — the only contact point to the agent
     * runtime for install/restore (ruling R28 mock-first; the real DSH
     * public seam in the harness).
     */
    readonly surface: TeamAgentSetupSurface;
    /** The ephemeral residency surface (evict path only). */
    readonly residency: ResidencyPort;
    /**
     * Overlay slot overrides; absent keys keep the binder's identity
     * defaults. The harness injects the real T2 (persona) / T3 (model) /
     * T4 (capability) slots here (the root-substrate wiring, DevPlan
     * §18.2, lives in those slot implementations).
     */
    readonly slots?: Partial<Record<OverlaySlotName, OverlaySlot>>;
    /** The admission guard; absent = the binder's admitting default. */
    readonly admissionGuard?: AdmissionGuard;
    /**
     * Clock for the MemberInstance `createdAt` stamp (UTC ISO-8601).
     * Injected for deterministic tests; default = system clock.
     */
    readonly now?: () => string;
}
/**
 * The member CREATION SPEC — the canonical identity input of one member
 * slot of the Team (DevPlan §18.1; the coordinator's provisioning
 * request). Every field is validated fail-closed by
 * {@link deriveMemberIdentity} (`./identity.js`) before any effect:
 *
 * - `rootSessionId` — the Team root (must be a bound Team root,
 *   invariant 8);
 * - `templateId` — the static template identity (invariant 19: NOT a
 *   runtime identity);
 * - `label` — human-facing label (invariant 19: NOT a runtime identity);
 * - `groupId` — opaque grouping metadata (invariant 20, optional);
 * - `workspace` — effective workspace (optional; absent = inherited,
 *   §21.2; never Team identity, invariant 27).
 *
 * The spec is the WHOLE identity input: a re-drive of the same spec
 * always derives the same `(instanceId, childSessionId)` (I1c replay
 * convergence); a different spec derives a different identity (a
 * different logical creation — the coordinator owns spec uniqueness per
 * team).
 */
export interface MemberCreateSpec {
    /** The Team root session id (branded `RootSessionId` value). */
    readonly rootSessionId: string;
    /** The static template id (branded `TemplateId` value). */
    readonly templateId: string;
    /** The human-facing label (non-empty, no control chars, <= 128). */
    readonly label: string;
    /** Opaque grouping metadata (optional; no control chars, <= 128). */
    readonly groupId?: string;
    /** Effective workspace (optional; no control chars, <= 1024). */
    readonly workspace?: string;
}
/**
 * The DERIVED stable member identity: the runtime identity
 * `(rootSessionId, instanceId)` (invariant 18) plus the durable child
 * session (invariant 23). Produced ONLY by
 * {@link deriveMemberIdentity} (`./identity.js`) — never minted by the
 * binder, never read from a label. Named `DerivedMemberIdentity` to stay
 * distinct from the contracts composite-key type `MemberIdentity`
 * (`{rootSessionId, instanceId}`).
 */
export interface DerivedMemberIdentity {
    /** The member's stable instance id, unique within the TeamSession. */
    readonly instanceId: string;
    /** The durable child DSH session id (never re-pointed, invariant 24). */
    readonly childSessionId: string;
}
/**
 * The cold / evict request: the composite member identity (invariant
 * 18). No spec fields — the durable record is the source of truth.
 */
export interface MemberIdentityInput {
    /** The Team root session id. */
    readonly rootSessionId: string;
    /** The member's stable instance id. */
    readonly instanceId: string;
}
/**
 * The durable TeamDomain state of one member, observed after the
 * operation (read through the same read handle the binder uses).
 */
export interface MemberResidencyDurableState {
    /** The durable MemberInstance record. */
    readonly member: MemberInstanceRecordDto;
    /** The durable `team-member` session binding row. */
    readonly binding: SessionBindingDto;
    /**
     * `true` when THIS operation performed durable writes (fresh create,
     * or a convergent re-drive that repaired a lost record); `false` for
     * an idempotent re-run and for the cold path (read-only by
     * construction).
     */
    readonly wrote: boolean;
}
/**
 * The fresh-member result: the durable state plus the binder's
 * agent-setup result (all three overlay slots installed + admission).
 */
export interface FreshMemberResult {
    /** The bind path that was executed. */
    readonly path: 'fresh-member';
    /** The durable state (always present on success). */
    readonly durable: MemberResidencyDurableState;
    /** The binder's result for the agent-setup step. */
    readonly bind: TeamAgentBindResult;
}
/**
 * The cold-member result: the durable state (ABSENT for the `absent`
 * no-op) plus the binder's agent-setup result (ABSENT for the `absent`
 * no-op — the binder is never consulted without a durable record).
 */
export interface ColdMemberResult {
    /** The bind path that was executed. */
    readonly path: 'cold-member';
    /**
     * `true` when this identity has no durable MemberInstance record: the
     * zero-record, zero-effect no-op (the member analogue of the
     * ordinary-root no-op). `durable` and `bind` are absent in that case.
     */
    readonly noopReason?: 'absent';
    /** The durable state (absent for the `absent` no-op). */
    readonly durable?: MemberResidencyDurableState;
    /** The binder's result for the agent-setup step (absent for the no-op). */
    readonly bind?: TeamAgentBindResult;
}
/**
 * The evict-settled result: the durable record (UNCHANGED — eviction
 * never writes, deletes, or transitions) plus the residency drop
 * outcome.
 */
export interface EvictSettledMemberResult {
    /** The evict path marker. */
    readonly path: 'evict-settled';
    /** The durable MemberInstance record (unchanged by the operation). */
    readonly member: MemberInstanceRecordDto;
    /**
     * `true` when a live residency was dropped; `false` when the handle
     * was already absent (a settled world — the eviction still succeeds,
     * DevPlan §18.5 "the handle may be absent").
     */
    readonly residencyDropped: boolean;
}
//# sourceMappingURL=types.d.ts.map