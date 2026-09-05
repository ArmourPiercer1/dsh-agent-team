/**
 * P8-S4B — the Team-durable CONSUMPTION of the model cell: the bridge from
 * the durable governance overrides (backend truth) to the actual future
 * Agent model selection (DevPlan P8-S §18.1: "Team durable mutation ->
 * actual future Agent behavior").
 *
 * The frozen activation layer already re-reads the durable overrides at
 * every member activation (`resolveActivationPolicy`). This module adds
 * the model-side CONSUMER of that resolution: it maps the frozen
 * `EffectivePolicy` `model` cell (plus the §18.3 cell provenance) onto a
 * concrete {@link ModelSelection} the row binds to the public DSH
 * `installModelSelection` seam, with one documented consumer rule:
 *
 * - `allow` (well-formed)   -> the first `provider/model` item WINS (the
 *   durable value drives the next request's model call);
 * - `unspecified` (the Team
 *   domain's fail-closed default — no Team layer granted the cell) -> the
 *   WORLD PROVIDER DEFAULT (the `baseline`) applies: the Team domain did
 *   not speak to the model cell, so the agent keeps its default model;
 *   the provenance still records `deniedBy: team/unspecifiedFailClosed`;
 * - explicit `deny` (any
 *   Team layer)              -> NO model (the agent's turn fails contained
 *   at the model-call boundary — a deny is never silently allowed);
 * - external hard facts      -> win over everything: capability absence,
 *   external hard deny, or an external allow-list that removes every
 *   item -> NO model (`unavailable` / `deniedBy: external`);
 * - a MALFORMED allow item (not `provider/model`) -> NO model +
 *   `unavailable: true` (fail closed, never guessed).
 *
 * Pure module: no I/O, no live Agent, no ambient state. The durable
 * records + external facts are injected per call (re-read at the
 * boundary), so a host restart re-derives the same selection from the
 * same durable truth.
 *
 * @module @dsh-agent-team/runtime/agent-setup/model/durable-consumption
 */
import { resolveActivationPolicy } from '../../activation/index.js';
import { cellProvenance, } from '../../mutation/cell-provenance.js';
/**
 * Parse one durable model allow item (`provider/model`, split at the first
 * `/`). Fail-closed: anything that does not parse yields `undefined`
 * (the consumer then refuses to select a model — never guessed).
 * @param item - the durable item string.
 * @returns the parsed selection, or undefined when malformed.
 */
export function parseModelItem(item) {
    const sep = item.indexOf('/');
    if (sep <= 0 || sep === item.length - 1)
        return undefined;
    const provider = item.slice(0, sep);
    const model = item.slice(sep + 1);
    if (provider.length === 0 || model.length === 0)
        return undefined;
    return { provider, model };
}
/**
 * Map the frozen effective policy's `model` cell onto a concrete selection
 * plus the full §18.3 provenance. Pure and deterministic.
 * @param policy - the frozen effective policy of the member.
 * @param baseline - the world provider default (applies only to the
 *   `unspecified` fail-closed case — Team did not speak to the cell).
 * @param options - the durable records + the session's applied record ids.
 * @returns the consumption view (lossless-JSON).
 */
export function modelConsumptionView(policy, baseline, options = {}) {
    const provenance = cellProvenance(policy, 'model', options);
    let selection;
    let unavailable = provenance.unavailable;
    if (provenance.effective.kind === 'allow' && !unavailable) {
        const first = provenance.effective.items[0];
        selection = first === undefined ? undefined : parseModelItem(first);
        if (selection === undefined) {
            // A malformed durable allow item is unusable, never guessed.
            unavailable = true;
        }
    }
    else if (provenance.effective.kind === 'deny' && provenance.source.layer === 'unspecified') {
        // The Team domain's fail-closed default: no Team layer granted the
        // model cell -> the agent keeps the world provider default.
        selection = baseline;
    }
    // deny from an explicit Team layer / external stage 2: selection stays
    // undefined — a deny is never silently allowed.
    return {
        selection,
        source: provenance.source,
        suppressed: provenance.suppressed,
        unavailable,
        deniedBy: provenance.deniedBy,
        pendingNextBoundary: provenance.pendingNextBoundary,
        explanation: provenance.explanation,
    };
}
/**
 * Re-read the durable overrides and resolve the member's effective model
 * selection at one request boundary. This is the durable-mutation ->
 * actual-Agent-behavior edge: whatever the team durably admitted, the NEXT
 * request's model selection reflects it (and a host restart re-derives
 * the same result from the same durable truth).
 *
 * @param args - the boundary inputs.
 * @returns the frozen policy + the model consumption view.
 * @throws {@link import('../../activation/index.js').ActivationError}
 *   `ACTIVATION_POLICY_RESOLUTION_FAILED` when the stored payload is
 *   malformed (fail closed).
 */
export function resolveDurableModelSelection(args) {
    const { rootSessionId, instanceId, overrides, external, baseline, appliedRecordIds } = args;
    const policy = resolveActivationPolicy({ rootSessionId, instanceId, overrides, external });
    const refs = overrides.map((record) => ({
        recordId: record.recordId,
        kind: record.kind,
        scope: record.scope,
        generation: record.generation,
        updatedAt: record.updatedAt,
        values: record.values,
    }));
    const view = modelConsumptionView(policy, baseline, {
        overrides: refs,
        ...(appliedRecordIds !== undefined ? { appliedRecordIds } : {}),
    });
    return { policy, view };
}
//# sourceMappingURL=durable-consumption.js.map