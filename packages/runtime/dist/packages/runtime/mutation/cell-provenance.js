/**
 * P8-S4B — the backend-truth provenance derivation for one capability cell
 * (DevPlan P8-S §18.3: "Projection 后续必须能读到 effective value / source
 * / suppressed / unavailable / deniedBy / pending next boundary — 但本任务
 * 只负责 backend truth").
 *
 * {@link cellProvenance} is a PURE derivation over the frozen P3-T4
 * resolver's output ({@link EffectivePolicy}) plus the durable override
 * records of the TeamSession: it maps ONE capability cell of one member to
 * the six §18.3 fields, each as first-class, lossless-JSON data:
 *
 * - `effective` — the cell's effective value (the Team ∩ external result);
 * - `source` — the winning Team layer's provenance (layer / origin /
 *   record id; `layer: 'unspecified'` when no Team layer granted the cell —
 *   the Team domain then fails closed);
 * - `suppressed` — the stored-but-suppressed autonomy overlays of the cell
 *   (non-destructive preservation, §19.4);
 * - `unavailable` — `true` when the capability value cannot be applied
 *   because the substrate reports the capability absent (external
 *   `capabilityMissing`); capability-specific unavailability (e.g. a
 *   malformed model item) is computed by the consuming view;
 * - `deniedBy` — who/what denied the cell, with the layer/origin/record
 *   provenance for Team denials and the frozen external-stage reason for
 *   external denials (absent when the cell is allowed);
 * - `pendingNextBoundary` — the durable records that admit a value for
 *   this cell (the ADMIT-kind contract of {@link recordAdmitsCapability}:
 *   an ALLOW-kind entry naming at least one value — a deny-kind entry is
 *   a settled withdrawal, never a pending grant) but were NOT part of the
 *   session's last applied boundary (the mutation is admitted durably and
 *   takes effect from the NEXT request boundary only — the in-flight
 *   request keeps its resolution).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no ambient state.
 * @module @dsh-agent-team/runtime/mutation/cell-provenance
 */
/**
 * Whether one durable record admits a value for the capability — the
 * ADMIT-kind contract (pre-alpha3 PR-F F.4, the A' follow-up of the F15
 * Option A adjudication, 2026-09-30): a record admits a value for the
 * cell ONLY when its entry for the capability is an ALLOW-kind
 * `PolicyEntry` naming at least one value — for the `mcp` capability the
 * `items` name MCP server names or the `'*'` wildcard (the item
 * vocabulary is domain-specific and opaque here; the per-server reading
 * is the probe/view ladder's job, the kind reading is shared). Key
 * PRESENCE of the capability key is NOT admission (the pre-fix reading,
 * corrected here): a `deny`-kind entry is a settled withdrawal, not a
 * pending grant — F15 R4: "a policy deny is not a loss"; an unapplied
 * DENY is consumed at its own request boundary and is never a pending
 * materialization (the SAME contract the probe-side pending filter in
 * `src/plugin/host.ts` applies — the read surface and the probe now
 * share one admission reading).
 * @param record - the durable record.
 * @param capability - the capability cell name.
 * @returns `true` when the record admits a value for the cell (an
 *   ALLOW-kind entry with at least one named item).
 */
export function recordAdmitsCapability(record, capability) {
    const values = record.values;
    if (typeof values !== 'object' || values === null)
        return false;
    const entry = values[capability];
    if (entry === null || typeof entry !== 'object')
        return false;
    // ADMIT-kind contract: only an ALLOW-kind entry admits a value. A
    // deny-kind entry (a settled withdrawal) and any malformed shape
    // admit nothing (fail-closed — a record that cannot be read as an
    // allow entry is never inferred to be one).
    if (entry.kind !== 'allow')
        return false;
    const items = entry.items;
    return Array.isArray(items) && items.length > 0;
}
/**
 * Derive the §18.3 backend-truth provenance of ONE capability cell from
 * the frozen resolver's output.
 *
 * Deterministic: the same policy + options yield the same provenance. The
 * function never throws on a well-formed policy; it reads only the cell's
 * frozen fields (every value is already explainable by construction —
 * P3-T4 acceptance).
 *
 * @param policy - the frozen effective policy of the member.
 * @param capability - the capability cell to project.
 * @param options - the durable records + the session's applied record ids.
 * @returns the cell's provenance (lossless-JSON).
 */
export function cellProvenance(policy, capability, options = {}) {
    const cell = policy.cells[capability];
    const team = cell.team;
    const external = cell.external;
    const overrides = options.overrides ?? [];
    const applied = new Set(options.appliedRecordIds ?? []);
    const pending = overrides
        .filter((record) => recordAdmitsCapability(record, capability))
        .filter((record) => !applied.has(record.recordId))
        .map((record) => ({
        recordId: record.recordId,
        kind: record.kind,
        scope: record.scope,
        generation: record.generation,
        updatedAt: record.updatedAt,
        values: record.values,
    }));
    const source = {
        layer: team.layer,
        origin: team.origin,
        recordId: team.recordId,
    };
    let deniedBy;
    if (cell.effective.kind === 'deny') {
        if (external.note === 'capabilityMissing') {
            deniedBy = { by: 'external', reason: 'capabilityMissing' };
        }
        else if (external.note === 'externalHardDeny') {
            deniedBy = { by: 'external', reason: 'externalHardDeny' };
        }
        else if (external.note === 'externalHardRemovedAll') {
            deniedBy = { by: 'external', reason: 'externalHardRemovedAll' };
        }
        else if (team.layer === 'unspecified') {
            // The Team domain's fail-closed default: no layer granted the cell.
            deniedBy = { by: 'team', reason: 'unspecifiedFailClosed' };
        }
        else {
            deniedBy = {
                by: 'team',
                reason: 'teamDeny',
                layer: team.layer,
                origin: team.origin,
                recordId: team.recordId,
            };
        }
    }
    return {
        capability,
        effective: cell.effective,
        source,
        suppressed: team.suppressed,
        unavailable: external.note === 'capabilityMissing',
        deniedBy,
        pendingNextBoundary: pending,
        explanation: cell.explanation,
    };
}
//# sourceMappingURL=cell-provenance.js.map