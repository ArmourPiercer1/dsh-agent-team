/**
 * TeamAgentBinder — the single idempotent orchestration core of P5 (TaskDoc
 * §11.5 P5-T1; DevPlan §18.1).
 *
 * ONE class covers the FOUR bind paths:
 *
 * - {@link TeamAgentBinder.bindFreshRoot}       (bind fresh Root)
 * - {@link TeamAgentBinder.bindFreshMember}     (bind fresh Member)
 * - {@link TeamAgentBinder.rehydrateColdRoot}   (rehydrate cold Root)
 * - {@link TeamAgentBinder.rehydrateColdMember} (rehydrate cold Member)
 *
 * and is IDEMPOTENT (DevPlan §18.1 "且 idempotent"):
 *
 * - a repeated bind of an already-bound target on a live residency is a
 *   NO-OP: no duplicate install, no duplicate restore, no duplicate session
 *   event, and the returned identity is stable (deep-equal) across calls;
 * - the binder never records the same `(sessionId, name, detail)` event
 *   twice, even across a failed bind and its retry;
 * - fresh vs cold is a CALLER decision (the four explicit methods); the
 *   binder enforces the difference: the fresh path installs the overlay
 *   slots (the fresh-time effects, through the injected slots + surface),
 *   while the cold path ONLY restores the scope from the durable records
 *   (no slot `apply`, no `installOverlay`) — fresh-time side effects are
 *   never re-run on a cold rehydrate (DevPlan §18.5: Agent residency is
 *   ephemeral, TeamDomain is durable).
 *
 * Orchestration order (owned by the binder — ruling R28: "owns：编排顺序 +
 * overlay 槽位契约 + admission 决策点"):
 *
 * 1. Session-kind resolution (READ-ONLY durable lookup): unbound or
 *    `ordinary` → successful no-effect no-op; a kind mismatch (root path on
 *    a `team-member` session or vice versa) → fail-closed
 *    `BINDER_TARGET_KIND_MISMATCH`;
 * 2. Durable record load (READ-ONLY): the required record must exist
 *    (otherwise `BINDER_TARGET_NOT_FOUND` — the binder never creates
 *    TeamDomain records); member paths cross-check the binding against the
 *    MemberInstance record (`BINDER_RECORD_CONFLICT`) and refuse terminal
 *    `DISPOSED` members (`BINDER_MEMBER_DISPOSED`);
 * 3. Idempotency check: bound entry + live residency carrying the full
 *    slot set → no-op (`already-bound`);
 * 4. Fresh: per slot in {@link OVERLAY_SLOT_ORDER} — slot `apply`, surface
 *    `installOverlay`, `agent-setup/overlay-installed` event. Cold: surface
 *    `restoreScope`, `agent-setup/scope-restored` event. Any failure is
 *    FATAL before work (`BINDER_OVERLAY_FAILED`): no later step runs and
 *    the target is not registered;
 * 5. Admission decision (the binder's decision point BEFORE work,
 *    fail-closed): the injected guard decides; a throwing guard is a
 *    rejection with `ADMISSION_GUARD_ERROR`; `agent-setup/admission-decided`
 *    event. T2's persona `complete:true` FATAL gate runs in the persona
 *    slot's `apply` — i.e. BEFORE this admission decision;
 * 6. Finalize: register the bound entry (identity + admission state) and
 *    return the result. The caller gates any Team work on `admitted`.
 *
 * The binder NEVER writes the durable truth: it holds only the injected
 * READ-ONLY {@link TeamDomainReadHandle} (ruling R28; DevPlan §18.1 "binder
 * 负责安装 overlay，不拥有 TeamDomain truth"). It never emits any Team
 * SessionEvent vocabulary (vNext has no Team SessionEvents — the recorded
 * events are the public Agent setup/session events of
 * {@link AGENT_SETUP_EVENT_NAMES}).
 *
 * T1 is mock-first: the surface and (in tests) the read handle are fakes /
 * test seams; the real DSH public seam binding lands in T5/T6.
 *
 * @module @dsh-agent-team/runtime/agent-setup/binder/binder
 */
import type { OverlaySlotName, TeamAgentBindResult, TeamAgentBinderOptions } from './types.js';
/** The origin of a failed overlay effect (the `BINDER_OVERLAY_FAILED` detail). */
export type OverlayFailureOrigin = OverlaySlotName | 'restore' | 'event-recording';
/**
 * The single TeamAgentBinder class (DevPlan §18.1). See the module docs
 * for the orchestration order, the idempotency contract, and the
 * fail-closed error semantics.
 */
export declare class TeamAgentBinder {
    private readonly surface;
    private readonly teamDomain;
    private readonly slots;
    private readonly admissionGuard;
    private readonly bound;
    private readonly emittedEvents;
    /**
     * @param options - the injected surface, read-only TeamDomain handle,
     *   optional slot overrides (identity defaults fill the rest), and
     *   optional admission guard (the default admitting guard fills the
     *   rest). Construction is fail-fast: a malformed option throws a
     *   `TypeError` (a programming error, not a bind-time contract error).
     */
    constructor(options: TeamAgentBinderOptions);
    /**
     * Bind a FRESH Root: the first-time overlay installation on the root
     * agent residency (DevPlan §18.1 "bind fresh Root").
     * @param rootSessionId - the root DSH session id (= TeamSessionId,
     *   invariant 9).
     * @returns the bind result (ordinary session → no-effect no-op; team root
     *   → full fresh install + admission decision).
     * @throws {@link TeamAgentBinderError} on kind mismatch, missing or
     *   conflicting durable records, or a failed overlay effect (fail-closed).
     */
    bindFreshRoot(rootSessionId: string): TeamAgentBindResult;
    /**
     * Bind a FRESH Member: the first-time overlay installation on the member
     * child agent residency (DevPlan §18.1 "bind fresh Member").
     * @param childSessionId - the member's durable child DSH session id
     *   (invariant 23).
     * @returns the bind result (ordinary session → no-effect no-op).
     * @throws {@link TeamAgentBinderError} as in {@link bindFreshRoot}, plus
     *   `BINDER_MEMBER_DISPOSED` for a terminal member.
     */
    bindFreshMember(childSessionId: string): TeamAgentBindResult;
    /**
     * Rehydrate a COLD Root: restore the root scope from the durable
     * TeamSession record onto a (re)created agent residency WITHOUT re-running
     * fresh-time side effects (DevPlan §18.1 "rehydrate cold Root"; DevPlan
     * §18.5 residency is ephemeral).
     * @param rootSessionId - the root DSH session id (= TeamSessionId).
     * @returns the bind result (ordinary session → no-effect no-op; a cold
     *   rehydrate re-decides admission).
     * @throws {@link TeamAgentBinderError} as in {@link bindFreshRoot}.
     */
    rehydrateColdRoot(rootSessionId: string): TeamAgentBindResult;
    /**
     * Rehydrate a COLD Member: restore the member scope from the durable
     * MemberInstance record + session binding onto a (re)created agent
     * residency WITHOUT re-running fresh-time side effects (DevPlan §18.1
     * "rehydrate cold Member").
     * @param childSessionId - the member's durable child DSH session id.
     * @returns the bind result (ordinary session → no-effect no-op).
     * @throws {@link TeamAgentBinderError} as in {@link bindFreshMember}.
     */
    rehydrateColdMember(childSessionId: string): TeamAgentBindResult;
    /** The shared orchestration of the four bind paths (see module docs). */
    private bind;
    /** Wrap one failed overlay effect as the closed `BINDER_OVERLAY_FAILED`. */
    private overlayFailure;
    /**
     * Record one event through the surface, deduplicated per session on the
     * full event record `(name, detail)`: the binder never records the same
     * event record twice for one session (even across a failed bind and its
     * retry).
     */
    private emit;
}
//# sourceMappingURL=binder.d.ts.map