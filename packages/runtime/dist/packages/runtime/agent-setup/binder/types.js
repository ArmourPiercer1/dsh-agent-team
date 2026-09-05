/**
 * TeamAgentBinder contract surface (TaskDoc §11.5 P5-T1; DevPlan §18.1).
 *
 * This module defines the frozen CONTRACT of the P5-T1 binder skeleton:
 *
 * - the NARROW injected public Agent setup surface
 *   ({@link TeamAgentSetupSurface}) — mock-first in T1; the real DSH public
 *   seam binding lands in T5/T6 (ruling R28: "真实 DSH 公开面绑定属 T5/T6;
 *   T1 一律 mock-first");
 * - the three overlay SLOT contracts (persona / model / capability) — T1
 *   ships the identity (no-op) defaults only; T2 (persona), T3 (model) and
 *   T4 (capability) fill in the business logic. The binder installs the
 *   overlays; it never implements their semantics;
 * - the admission GUARD contract — the binder's decision point BEFORE work
 *   (fail-closed); T2's `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` FATAL gate
 *   lives in the persona slot's `apply` (before this admission decision);
 *   T1 leaves only the decision point and the error-code channel;
 * - the READ-ONLY TeamDomain handle — the binder never owns or writes the
 *   durable truth (DevPlan §18.1: "binder 负责安装 overlay，不拥有
 *   TeamDomain truth"; invariant 41: TeamDomain is the SOLE control-plane
 *   authority).
 *
 * What the binder does NOT define here (and must never grow):
 *
 * - no Team SessionEvent vocabulary of any kind (vNext has no Team
 *   SessionEvents; the recorded events are the public Agent
 *   setup/session events, `agent-setup/*`, see
 *   {@link AGENT_SETUP_EVENT_NAMES});
 * - no TeamDomain record production (the binder reads, it does not write);
 * - no legacy `packages/team` vocabulary (global forbidden block).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no runtime
 * environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/binder/types
 */
/**
 * The binder-owned fixed installation order of the overlay slots (the
 * binder owns the orchestration order — ruling R28). The order is frozen
 * for the P5-T2/T3/T4 slot implementations: persona first (its FATAL
 * conflict check must run before any later slot and before the admission
 * decision, DevPlan §18.3), then model, then capability.
 */
export const OVERLAY_SLOT_ORDER = ['persona', 'model', 'capability'];
/**
 * The closed vNext event vocabulary the binder records through the
 * surface (allowed dependency: "public Agent setup/session events" —
 * TaskDoc §11.5 P5-T1). These are public agent-setup events, NOT Team
 * SessionEvents: the names deliberately live in the `agent-setup/*`
 * namespace and contain none of the legacy `team/*` event strings.
 */
export const AGENT_SETUP_EVENT_NAMES = {
    /** One per overlay slot, emitted after that slot is installed (fresh path). */
    overlayInstalled: 'agent-setup/overlay-installed',
    /** One per cold rehydrate, emitted after the scope is restored onto the residency. */
    scopeRestored: 'agent-setup/scope-restored',
    /** One per bind, emitted after the admission decision (detail = admission code). */
    admissionDecided: 'agent-setup/admission-decided',
};
//# sourceMappingURL=types.js.map