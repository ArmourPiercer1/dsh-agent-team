/**
 * The cold-root rehydration path (P5-T5; DevPlan §18.1 "rehydrate cold
 * Root" + §18.5 "residency is ephemeral", productized from the P2-T2
 * ROOT_COLD_BINDING characterization).
 *
 * {@link rehydrateColdTeamRoot} restores the root scope of an EXISTING
 * Team root onto the (re)created agent residency after a process
 * restart, from the durable TeamDomain — the source of truth
 * (invariant 41) — WITHOUT fresh-time side effects:
 *
 * - NO slot `apply` (the T2/T3/T4 slot implementations are fresh-time
 *   effectors; the cold path routes around them entirely);
 * - NO `installOverlay` (the residency's slot set is RESTORED wholesale
 *   through the surface's `restoreScope`);
 * - the admission decision is RE-DECIDED with the guard supplied at
 *   this call (admission is a fresh decision per residency, never a
 *   replay of a stored one — the durable record stores no admission
 *   state in contracts v1).
 *
 * The binder (P5-T1) is the sole authority over the agent-setup step
 * and is invoked directly; this module adds the durable-state
 * observation (read-only) and the ordinary-session contract:
 *
 * - ordinary / unbound session → the binder's zero-effect no-op:
 *   `bind.noopReason === 'ordinary'`, `durable` ABSENT, zero surface
 *   calls, zero durable writes (the "ordinary root" must-test).
 * - `team-root` binding with an absent TeamSession record → the binder's
 *   fail-closed `BINDER_TARGET_NOT_FOUND` propagates (zero surface
 *   effect).
 * - a session bound as `team-member` → the binder's fail-closed
 *   `BINDER_TARGET_KIND_MISMATCH` propagates.
 *
 * The path performs NO durable write by construction (`wrote: false`);
 * every effect is on the ephemeral residency only.
 *
 * @module @dsh-agent-team/runtime/root-binding/cold-root
 */
import { TeamAgentBinder } from '../agent-setup/binder/index.js';
/**
 * Rehydrate a COLD Team root: restore the root scope from the durable
 * TeamDomain onto the (re)created agent residency (see the module docs
 * for the effect-freeze contract and the ordinary-session no-op).
 *
 * @param ports - the injected handles (read handle, surface, optional
 *   slot/guard overrides; the write port is NOT consulted on this path).
 * @param input - the session to rehydrate (no identity fields — the
 *   durable record is the source of truth).
 * @returns the result: `durable` (read-only, `wrote: false`) for a team
 *   root — including the idempotent `already-bound` re-run — ABSENT for
 *   the ordinary no-op; plus the binder's cold-root bind result
 *   (scope-restored event + re-decided admission).
 * @throws the binder's fail-closed errors (`BINDER_TARGET_NOT_FOUND`,
 *   `BINDER_TARGET_KIND_MISMATCH`, `BINDER_OVERLAY_FAILED` for a
 *   failing `restoreScope`) — before or during the agent-setup step,
 *   never after any durable effect (there is none on this path).
 */
export async function rehydrateColdTeamRoot(ports, input) {
    const sessionId = String(input.rootSessionId);
    // The binder is the sole authority over the agent-setup step: the cold
    // path restores the scope (no slot apply / no installOverlay) and
    // re-decides admission; ordinary sessions are a zero-effect no-op.
    const binder = new TeamAgentBinder({
        surface: ports.surface,
        teamDomain: ports.teamDomain,
        ...(ports.slots !== undefined ? { slots: ports.slots } : {}),
        ...(ports.admissionGuard !== undefined ? { admissionGuard: ports.admissionGuard } : {}),
    });
    const bind = binder.rehydrateColdRoot(sessionId);
    // Durable-state observation (read-only). Present only when the session
    // IS a team root — in which case the binder has already verified both
    // the 'team-root' binding and the TeamSession record (fail-closed).
    let durable;
    if (bind.noopReason !== 'ordinary') {
        const teamSession = ports.teamDomain.getTeamSession(sessionId);
        const binding = ports.teamDomain.getSessionBinding(sessionId);
        if (teamSession === undefined || binding === undefined || binding.kind !== 'team-root') {
            // Defensive: unreachable (the binder threw first for every such
            // state); kept fail-closed so a binder contract change can never
            // surface an inconsistent durable view.
            throw new Error(`cold root rehydration of session '${sessionId}' observed a non-team-root durable state after a non-ordinary bind result (binder contract violation)`);
        }
        durable = { teamSession, binding, wrote: false };
    }
    return { path: 'cold-root', durable, bind };
}
//# sourceMappingURL=cold-root.js.map