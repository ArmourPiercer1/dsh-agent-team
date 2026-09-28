/**
 * pre-alpha3 PR-B — the canonical EffectivePolicy read plane (plan §B.2,
 * ADR-03 successor): the SINGLE public read entry through which every
 * consumer (the live request boundary, the activation step 8, the
 * inspect-config action, the effective-config projection, the model-state
 * view) obtains one member's effective policy from the DURABLE facts.
 *
 * The plane replaces the two historically divergent production assemblies:
 * the request surface's `resolveActivationPolicy` (overrides only, the
 * PolicyState layer pinned to `default`, the blueprint/template layers
 * caller-supplied) and the config view's `assembleEffectivePolicyInput`
 * (a step-horizon read of the process-local mutation store). Both are
 * retired from the production decision path; their frozen building blocks
 * are REUSED VERBATIM (never re-implemented):
 *
 * - `selectPolicyOverrides` (P8-S4B deterministic slot selection) — the
 *   override winners;
 * - `resolveEffectivePolicy` (P3-T4 frozen resolver) — the layer merge;
 * - the production `PolicyReader` (the bound-snapshot static facts: the
 *   blueprint envelope, the per-member template policy, the external hard
 *   facts) — the SAME reader the governance mutation authority uses for
 *   its write-time checks (one static-facts authority);
 * - the durable PolicyState commits (the ledger-backed transition list in
 *   admission order) — the committed state layer.
 *
 * The STEP CONCEPT is retired as a production decision source (plan §B.2):
 * the committed PolicyState is the LAST durable transition in admission
 * order — the step fields (`requestedAtStep` / `effectiveFromStep`) remain
 * parseable/displayable on the legacy records but no longer decide what is
 * effective. In the production flow every committed transition carries the
 * pinned pair (requested 0 / effective 1), so "last in admission order"
 * is exactly the state every committed switch intends to be live at the
 * NEXT request boundary — the committed/applied split is expressed by the
 * views (`pendingNextBoundary` / the process-local `appliedRecordIds`
 * set), not by a fake runtime clock.
 *
 * The read is PURE (no I/O): the caller supplies every durable fact.
 *
 * @module @dsh-agent-team/runtime/effective-policy
 */
import { DEFAULT_POLICY_STATE_ID, } from '../../domain/policy/src/index.js';
/**
 * The committed PolicyState of the durable transition list: the LAST
 * transition in admission order (the production step clock is retired —
 * plan §B.2; the pinned (0, 1) pair makes admission order the honest
 * commitment order). `null` transition = the implicit `default` state.
 */
export function committedPolicyState(transitions) {
    const last = transitions.length > 0 ? transitions[transitions.length - 1] : undefined;
    if (last === undefined) {
        return { state: { stateId: DEFAULT_POLICY_STATE_ID }, transition: null };
    }
    return { state: last.state, transition: last };
}
/** The override refs scoped to one member (team scope + this instance). */
export function memberOverrideRefs(overrides, instanceId) {
    return overrides
        .filter((record) => record.scope === 'team' || record.instanceId === instanceId)
        .map((record) => ({
        recordId: record.recordId,
        kind: record.kind,
        scope: record.scope,
        generation: record.generation,
        updatedAt: record.updatedAt,
        values: record.values,
    }));
}
/** The generation of one selected slot winner (0 = none / not found). */
export function winnerGeneration(overrides, recordId) {
    if (recordId === undefined)
        return 0;
    const record = overrides.find((candidate) => candidate.recordId === recordId);
    return record === undefined ? 0 : record.generation;
}
//# sourceMappingURL=types.js.map