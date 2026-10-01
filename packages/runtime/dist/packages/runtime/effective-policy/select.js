/**
 * The deterministic overlay/override selection from the durable `overrides`
 * store into the policy resolver's overlay slots (step 8 input half) — the
 * frozen P8-S4B selection, relocated verbatim (pre-alpha3 PR-B) from
 * `activation/checks.ts` into the canonical read plane so the ONE assembly
 * entry imports its building blocks without a module cycle. The
 * `activation` package re-exports it unchanged (API surface intact).
 *
 * Mapping (closed, documented ruling):
 * - `kind: 'autonomy-overlay'`, `scope: 'team'` → the `templateOverlay`
 *   slot;
 * - `kind: 'autonomy-overlay'`, `scope: 'instance'` (this instance) → the
 *   `instanceOverlay` slot;
 * - `kind: 'human-override'` → the `humanOverride` slot (the instance-
 *   scoped slot's LATEST event wins over the team-scoped slot's LATEST
 *   event, per the policy contract; a slot whose latest event is a RESET
 *   TOMBSTONE — an empty values set, the audit-preserving reset, PR-A /
 *   ADR-05 — has NO effective value for that slot and the precedence
 *   falls to the team slot, which falls to the lower layers when IT is a
 *   tombstone; an OLDER event of the same slot is never resurrected —
 *   the pre-reset history is audit-only);
 * - multiple candidates for one slot: the HIGHEST `generation` wins, ties
 *   broken by the LEXICOGRAPHICALLY SMALLEST `recordId` (deterministic;
 *   multi-overlay composition is owned by the later governance work).
 *
 * The stored `values` payload passes through UNTOUCHED: the policy resolver
 * re-validates it (a malformed stored payload fails closed in step 8).
 *
 * @param overrides - the durable governance override records (all teams).
 * @param rootSessionId - the team (root) session id.
 * @param instanceId - the instance being activated.
 * @returns the selected overlay slots (absent when no candidate exists).
 */
import { parseRootSessionId } from '../../contracts/src/index.js';
export function selectPolicyOverrides(overrides, rootSessionId, instanceId) {
    const root = parseRootSessionId(rootSessionId);
    const inTeam = (record) => record.rootSessionId === root;
    const candidates = (records) => records.slice().sort((a, b) => {
        if (a.generation !== b.generation)
            return a.generation < b.generation ? 1 : -1;
        return a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0;
    });
    const templateCandidates = candidates(overrides.filter((record) => inTeam(record) && record.scope === 'team' && record.kind === 'autonomy-overlay'));
    const instanceCandidates = candidates(overrides.filter((record) => inTeam(record) && record.scope === 'instance' && record.instanceId === instanceId && record.kind === 'autonomy-overlay'));
    const humanTeam = candidates(overrides.filter((record) => inTeam(record) && record.scope === 'team' && record.kind === 'human-override'));
    const humanInstance = candidates(overrides.filter((record) => inTeam(record) && record.scope === 'instance' && record.instanceId === instanceId && record.kind === 'human-override'));
    const result = {};
    const template = templateCandidates[0];
    if (template !== undefined && template.origin !== undefined) {
        result.templateOverlay = {
            overlayId: template.recordId,
            kind: 'template',
            origin: template.origin,
            values: template.values,
        };
    }
    const instance = instanceCandidates[0];
    if (instance !== undefined && instance.origin !== undefined) {
        result.instanceOverlay = {
            overlayId: instance.recordId,
            kind: 'instance',
            origin: instance.origin,
            values: instance.values,
        };
    }
    // The human-override slots (the ADR-04 precedence: the instance-scoped
    // slot outranks the team-scoped slot). Each slot's effective value is
    // its LATEST event; an OLDER event of the same slot is NEVER consulted
    // (the pre-reset history is audit-only — resurrecting it would undo the
    // human revocation). A slot whose latest event is a RESET TOMBSTONE (an
    // empty values set — the audit-preserving reset, PR-A / ADR-05) has NO
    // effective value for that slot: precedence falls to the team slot, and
    // to the lower (template/static) layers when that too is a tombstone.
    const humanInstanceLatest = humanInstance[0];
    const humanTeamLatest = humanTeam[0];
    const slotHasEffectiveValue = (record) => Object.keys(record.values).length > 0;
    const human = humanInstanceLatest !== undefined && slotHasEffectiveValue(humanInstanceLatest)
        ? humanInstanceLatest
        : humanTeamLatest !== undefined && slotHasEffectiveValue(humanTeamLatest)
            ? humanTeamLatest
            : undefined;
    if (human !== undefined) {
        result.humanOverride = {
            overrideId: human.recordId,
            scope: human.scope,
            values: human.values,
        };
    }
    if (humanInstanceLatest !== undefined || humanTeamLatest !== undefined) {
        result.humanSlotEvents = {
            ...(humanInstanceLatest !== undefined ? { instance: humanInstanceLatest } : {}),
            ...(humanTeamLatest !== undefined ? { team: humanTeamLatest } : {}),
        };
    }
    return result;
}
//# sourceMappingURL=select.js.map