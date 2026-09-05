/**
 * P6-T2 — TeamRuntime types: the unified authority facade for
 * runtime/control actions against EXISTING members.
 *
 * The facade is the single entry every later Team tool (P6-T6) and UI
 * Remote (P8) must call: one `performAction(request)` that enforces the
 * documented order — (1) instanceId-first target resolution, (2) caller
 * identity+role from the TeamDomain, (3) caller authority + mutation
 * envelope, (4) compatibility/admission, (5) quota, (6) durable effects —
 * and returns a lossless-JSON result (no live objects cross the boundary).
 *
 * Reuse, not duplication:
 * - creation (delegate-create / explicit create) is delegated to the
 *   P6-T1 ActivationProvider — the router calls it, never re-implements it
 *   (invariant 26: every new creation via the ActivationProvider);
 * - the mutation-envelope arithmetic reuses the P6-T1 pure seam
 *   (`computeOverlayBounds` semantics: intersection, fail closed);
 * - the compatibility gate reuses the domain/compatibility engine through
 *   the P6-T1 bridge (`evaluateActivationCompatibility`);
 * - the effective-config read reuses the domain/policy two-stage resolver
 *   through the P6-T1 seam (`resolveActivationPolicy`);
 * - durable writes go ONLY through the injected TeamDomain repositories
 *   (invariant 41).
 */
// --- caller roles ----------------------------------------------------------------
/** The closed caller roles the facade resolves from the TeamDomain. */
export const CALLER_ROLES = {
    /** A non-instance principal: the team owner (never envelope-bound; may
     *  exceed team autonomy but not the External Hard Policy, invariant 34). */
    HUMAN: 'human',
    /** The LeaderInstance (inv 36: bounded by the team autonomy envelope). */
    LEADER: 'leader',
    /** An ordinary member instance (bounded by team ∩ template ∩ instance
     *  overlay; cannot self-escalate, invariant 37). */
    MEMBER: 'member',
};
/** Every caller role value, for membership checks. */
export const CALLER_ROLE_VALUES = Object.values(CALLER_ROLES);
// --- shared helpers -----------------------------------------------------------------
/**
 * The per-capability effective values of a resolved policy, in canonical
 * capability order (lossless-JSON view for `config-inspected`).
 *
 * Reuses the P6-T1 seam semantics: every closed capability appears exactly
 * once.
 */
export function effectivePolicyView(values, capabilities) {
    const view = {};
    for (const name of capabilities) {
        const entry = values[name];
        if (entry !== undefined) {
            view[name] = entry;
        }
    }
    return view;
}
/** A stable, lossless-JSON summary of one member record (list view). */
export function memberSummary(member) {
    return {
        instanceId: member.instanceId,
        templateId: member.templateId,
        label: member.label,
        lifecycle: member.lifecycle,
        childSessionId: member.childSessionId,
    };
}
//# sourceMappingURL=types.js.map