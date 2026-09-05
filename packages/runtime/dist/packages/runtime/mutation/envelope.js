/**
 * P7-T2 — the team autonomy/mutation envelope check of the mutation intake
 * (Architecture §19.3; invariants 36/37).
 *
 * The envelope is NOT re-computed here: this module reuses the FROZEN
 * P3-T4 `validatePolicyInput` envelope precomputation (blueprint
 * `autonomyEnvelope` ∩ member template `mutationEnvelope`, per cell;
 * absent/deny → ∅) — the single source of the §19.3 boundary semantics.
 *
 * Two checks exist, matching the two frozen escalation codes:
 *
 * - **member origin** (`MEMBER_SELF_ESCALATION`, invariant 37): the
 *   member's OWN cell envelope (blueprint ∩ that member's template
 *   mutationEnvelope);
 * - **leader origin** (`LEADER_OUT_OF_ENVELOPE`, invariant 36): a
 *   template-scoped overlay applies to EVERY member, so the leader is
 *   checked against the intersection of every registered member's cell
 *   envelope. When no member instance is registered yet there is no
 *   template envelope to intersect with — the check is skipped (the first
 *   registration cannot violate a boundary that has no members to bind);
 *   this is the design decision recorded in the P7-T2 design note.
 *
 * `deny` entries are ALWAYS admitted: a tightening overlay can never
 * escape the envelope (the resolver admits deny overlays unconditionally —
 * the same rule applied here at intake so the rejection is fail-closed at
 * the boundary, not only at resolution time).
 *
 * Human origin is checked here for NOTHING: the human override is not
 * bounded by the Team autonomy envelope (invariant 34) — it IS bounded by
 * the external hard facts, which the service checks separately for every
 * origin.
 *
 * @module @dsh-agent-team/runtime/mutation/envelope
 */
import { CAPABILITY_NAME_VALUES, DEFAULT_POLICY_STATE_ID, POLICY_ERROR_CODES, PolicyResolutionError, validatePolicyInput, } from '../../domain/policy/src/index.js';
import { MutationError, MUTATION_ERROR_CODES } from './errors.js';
/**
 * The cell envelope items of ONE member (the frozen computation):
 * blueprint `autonomyEnvelope` ∩ that member's template `mutationEnvelope`,
 * per capability (absent/deny on either side → empty set).
 *
 * @throws {@link MutationError} `MALFORMED_MUTATION_INPUT` when the stored
 *   blueprint/template facts are structurally malformed (the frozen
 *   `MALFORMED_POLICY_INPUT` mapped into this module's closed surface —
 *   a stored-facts integrity failure, not a request-shape failure).
 */
export function memberEnvelopeItems(teamSessionId, member, blueprint, template) {
    try {
        return validatePolicyInput({
            teamSessionId,
            member,
            blueprint,
            template,
            policyState: { stateId: DEFAULT_POLICY_STATE_ID },
            // The envelope is the blueprint ∩ template boundary — independent of
            // the external hard facts; the frozen input shape requires the field.
            external: { hard: {}, capabilityExists: {} },
        }).envelopeItems;
    }
    catch (error) {
        throw wrapFrozenValidation(error, 'envelope', teamSessionId);
    }
}
/**
 * The LEADER's effective envelope: the intersection of every registered
 * member's cell envelope (a template-scoped overlay must fit the boundary
 * of every member it will apply to). Returns `undefined` when no member
 * is registered (check skipped — see the module doc).
 */
export function teamEnvelopeItems(teamSessionId, members, blueprint, templateFor) {
    if (members.length === 0)
        return undefined;
    let intersection;
    for (const member of members) {
        const items = memberEnvelopeItems(teamSessionId, member, blueprint, templateFor(teamSessionId, member));
        if (intersection === undefined) {
            intersection = new Map();
            for (const capability of CAPABILITY_NAME_VALUES) {
                intersection.set(capability, new Set(items.get(capability)));
            }
            continue;
        }
        for (const capability of CAPABILITY_NAME_VALUES) {
            const previous = intersection.get(capability);
            const current = items.get(capability);
            const kept = new Set();
            if (previous !== undefined && current !== undefined) {
                for (const item of previous) {
                    if (current.has(item))
                        kept.add(item);
                }
            }
            intersection.set(capability, kept);
        }
    }
    return intersection;
}
/**
 * The intake check of ONE agent-origin cell value against its envelope.
 *
 * - `deny` values always pass (tightening can never escalate);
 * - an `allow` value passes only when EVERY item is inside the cell's
 *   envelope item set (an `undefined` envelope means "no check" — the
 *   no-registered-members leader case);
 * - a violation throws the frozen code string of the actor origin
 *   (`MEMBER_SELF_ESCALATION` / `LEADER_OUT_OF_ENVELOPE`) with the
 *   violating items and the cell envelope in `details`.
 */
export function checkAgainstEnvelope(capability, entry, envelope, origin) {
    if (entry.kind === 'deny')
        return;
    if (envelope === undefined)
        return;
    const allowed = envelope.get(capability);
    const missing = [];
    for (const item of entry.items) {
        if (allowed === undefined || !allowed.has(item))
            missing.push(item);
    }
    if (missing.length === 0)
        return;
    const code = origin === 'member'
        ? MUTATION_ERROR_CODES.MEMBER_SELF_ESCALATION
        : MUTATION_ERROR_CODES.LEADER_OUT_OF_ENVELOPE;
    const message = origin === 'member'
        ? `member self-escalation rejected: capability '${capability}' allow items outside the team autonomy envelope`
        : `leader out of envelope: capability '${capability}' allow items outside the intersection of all member envelopes`;
    throw new MutationError(code, message, {
        capability,
        items: missing,
        envelope: allowed ? [...allowed].sort() : [],
    });
}
/**
 * Maps a frozen-domain validation failure raised while reading the stored
 * facts into this module's closed error surface (preserving the
 * identity-boundary code string verbatim; structural failures become
 * `MALFORMED_MUTATION_INPUT` with the stage/source in `details`).
 */
function wrapFrozenValidation(error, stage, teamSessionId) {
    if (error instanceof PolicyResolutionError && error.code === POLICY_ERROR_CODES.IDENTITY_SCOPE_MISMATCH) {
        return new MutationError(MUTATION_ERROR_CODES.IDENTITY_SCOPE_MISMATCH, error.message, { stage, ...error.details });
    }
    const details = { stage, teamSessionId };
    if (error instanceof PolicyResolutionError) {
        details.frozenCode = error.code;
        details.problem = error.details;
    }
    else {
        details.problem = error instanceof Error ? error.message : String(error);
    }
    return new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed stored policy facts at stage '${stage}' for TeamSession '${teamSessionId}'`, details);
}
//# sourceMappingURL=envelope.js.map