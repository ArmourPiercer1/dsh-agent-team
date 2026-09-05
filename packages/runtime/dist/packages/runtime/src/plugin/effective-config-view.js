/**
 * P8-S7-R2 (R2-2) — BQ-08: the resolved effective-config view of one
 * member (the UI §18.1 / §18.2 per-field provenance surface).
 *
 * The durable projection v1 emitted the honest EMPTY view for every member
 * (`EMPTY_EFFECTIVE_CONFIG` in `projection-source.ts`): `value: null`,
 * source `blueprint`, state `unavailable` on all four frozen lanes. This
 * module closes that gap for the production composition: it resolves the
 * four lanes (model / workspace / permissions / autonomy) from the EXISTING
 * layer data — the bound blueprint envelope, the durable PolicyState
 * transitions, the mutation-store records, the durable governance
 * `overrides`, and the static external facts — through the FROZEN P3-T4
 * resolver (reused verbatim, never re-implemented) plus this plane's
 * provenance derivations:
 *
 * - the policy input is assembled by `assembleEffectivePolicyInput`
 *   (the P7-T2 adapter, reused verbatim) over the member's durable
 *   transitions + records at the maximum step horizon (`atStep =
 *   Number.MAX_SAFE_INTEGER` — the production step clock is pinned to 0,
 *   so the resolved horizon sees every admitted future-boundary change);
 * - the durable governance `overrides` (the production write path —
 *   `override.set` / `admitGovernanceOverride` writes ONLY the storage
 *   `overrides` repository; the mutation-store records lane has no
 *   production caller) are merged in through `selectPolicyOverrides`
 *   (the P8-S4B deterministic slot selection, reused verbatim): a
 *   mutation-store slot wins when present (the test world), the
 *   governance slot fills whatever the store did not produce (the
 *   production world);
 * - each capability cell's §18.3 provenance comes from `cellProvenance`
 *   (P8-S4B) with `appliedRecordIds = []` — the boundary-application
 *   record set is PROCESS-LOCAL, so the durable projection reports
 *   record-backed winning values conservatively as PENDING (documented
 *   two-horizon ruling: NOW = 0, NEXT = the maximum step);
 * - the model lane additionally consumes `modelConsumptionView` (P5-T3),
 *   which applies the documented consumer rule: an `unspecified` cell
 *   keeps the world baseline (the harness-injected static model).
 *
 * Closed per-lane field shape (projection v2, `EffectiveConfigEntryV2`):
 * `value`, `source`, `state` (the v1 core) plus the DURATIONAL-optional
 * provenance keys `suppressed?`, `unavailable?`, `deniedBy?`,
 * `effectiveFrom?`, `locked?` — every optional key is ABSENT when the
 * fact does not hold (never an own `undefined` key; the contracts v2
 * parse enforces the closed set).
 *
 * State precedence (highest first, per lane):
 *   unavailable > denied > pending-next-boundary > overridden > inherited
 * with two documented lane rules:
 * - the MODEL lane applies the baseline consumer rule BEFORE the team
 *   denial: an `unspecified` cell (Team silent — the fail-closed default)
 *   displays the baseline selection as `inherited` / source `capability`
 *   with NO `deniedBy` key (the denial is a consumption fact, not a UI
 *   denial of an active value); an EXTERNAL hard denial still displays
 *   `denied` (display honesty at the resolved horizon);
 * - the AUTONOMY lane expresses suppression as the STATE itself (the
 *   stored-but-suppressed overlay entry, §19.4 non-destructive) instead
 *   of a flag, and reports the highest active governance slot as
 *   `pending-next-boundary` (an applied override is process-local, so
 *   every active record-backed value is conservatively pending — the
 *   `overridden` state is therefore unreachable on this lane, by
 *   construction of the two-horizon ruling).
 *
 * This module is pure: no I/O, no DSH imports, no ambient state. The
 * caller (the production read-port dependency in `projection-source.ts`)
 * supplies every durable fact and receives a plain (unfrozen) DTO — the
 * projection pipeline validates and deep-freezes it. When the resolver
 * rejects the input (a malformed stored payload — fail closed), this
 * function THROWS the typed frozen error; the caller catches and falls
 * back to the v1 empty view.
 *
 * @module @dsh-agent-team/runtime/plugin/effective-config-view
 */
import { EFFECTIVE_CONFIG_SOURCES, EFFECTIVE_CONFIG_STATES, EFFECTIVE_CONFIG_VALUE_MAX_LENGTH, } from '../../../contracts/src/index.js';
import { CAPABILITY_NAMES, CAPABILITY_NAME_VALUES, resolveEffectivePolicy, } from '../../../domain/policy/src/index.js';
import { assembleEffectivePolicyInput } from '../../policy-adapter.js';
import { selectPolicyOverrides } from '../../activation/index.js';
import { cellProvenance } from '../../mutation/index.js';
import { modelConsumptionView } from '../../agent-setup/model/index.js';
/**
 * Resolve one member's four-lane effective-config view (projection v2).
 * @param args - the durable layer facts (see {@link EffectiveConfigViewArgs}).
 * @returns the plain (unfrozen) v2 four-lane DTO; the projection pipeline
 *   validates and deep-freezes it.
 * @throws the frozen policy resolver's typed error when the merged input
 *   is rejected (malformed stored payload — fail closed); the caller
 *   falls back to the v1 empty view.
 */
export function createEffectiveConfigView(args) {
    const { teamSessionId, instanceId, lifecycle, memberWorkspace, teamDefaultWorkspace, staticModel, transitions, records, overrides, policyReader, } = args;
    // 1. The frozen adapter's input (reused verbatim): the mini store exposes
    //    exactly the two lanes the adapter reads (`listTransitions` +
    //    `listRecords`); the cast is type-level only — the adapter calls no
    //    other store method.
    const miniStore = {
        listTransitions: () => transitions,
        listRecords: () => records,
    };
    const baseInput = assembleEffectivePolicyInput({
        teamSessionId,
        member: { rootSessionId: teamSessionId, instanceId },
        atStep: Number.MAX_SAFE_INTEGER,
        store: miniStore,
        policy: policyReader,
    });
    // 2. Merge the durable governance slots (documented merge rule, module
    //    docs): a mutation-store slot wins when present, the governance slot
    //    fills whatever the store did not produce.
    const governance = selectPolicyOverrides(overrides, teamSessionId, instanceId);
    const input = {
        ...baseInput,
        templateOverlay: baseInput.templateOverlay ?? governance.templateOverlay,
        instanceOverlay: baseInput.instanceOverlay ?? governance.instanceOverlay,
        humanOverride: baseInput.humanOverride ?? governance.humanOverride,
    };
    const policy = resolveEffectivePolicy(input);
    // 3. The backend-truth override refs, scoped to THIS member: team scope +
    //    this instance only (instance-scoped records of other members must
    //    not leak into this member's pending set). `appliedRecordIds` is
    //    empty by the two-horizon ruling (process-local application set).
    const refs = overrides
        .filter((record) => record.scope === 'team' || record.instanceId === instanceId)
        .map((record) => ({
        recordId: record.recordId,
        kind: record.kind,
        scope: record.scope,
        generation: record.generation,
        updatedAt: record.updatedAt,
        values: record.values,
    }));
    const provenanceOptions = { overrides: refs, appliedRecordIds: [] };
    return {
        model: modelLaneOf(policy, staticModel, records, provenanceOptions),
        workspace: workspaceLaneOf(memberWorkspace, teamDefaultWorkspace, lifecycle),
        permissions: permissionsLaneOf(policy, records, provenanceOptions),
        autonomy: autonomyLaneOf(input, policy, records),
    };
}
// ---------------------------------------------------------------------------
// Shared derivations
/**
 * The §18.3 source word of the winning Team layer (the frozen lane map).
 * Exported for the R2-3 model-state view (same derivation, one source).
 */
export const SOURCE_BY_LAYER = {
    blueprint: EFFECTIVE_CONFIG_SOURCES.blueprint,
    policyState: EFFECTIVE_CONFIG_SOURCES.policy_state,
    template: EFFECTIVE_CONFIG_SOURCES.member_template,
    templateOverlay: EFFECTIVE_CONFIG_SOURCES.autonomy_overlay,
    instanceOverlay: EFFECTIVE_CONFIG_SOURCES.autonomy_overlay,
    humanOverride: EFFECTIVE_CONFIG_SOURCES.explicit_human_override,
    unspecified: EFFECTIVE_CONFIG_SOURCES.capability,
};
/**
 * The Team layers CLOSER than the inherited base (blueprint / template).
 * Exported for the R2-3 model-state view (same derivation, one source).
 */
export const CLOSER_LAYERS = new Set([
    'policyState',
    'templateOverlay',
    'instanceOverlay',
    'humanOverride',
]);
/** Clamp a display value to the frozen 512-char entry bound (defensive). */
function clampValue(value) {
    return value.length > EFFECTIVE_CONFIG_VALUE_MAX_LENGTH
        ? value.slice(0, EFFECTIVE_CONFIG_VALUE_MAX_LENGTH)
        : value;
}
/**
 * Serialize the frozen `CellDeniedBy` derivation into the v2 `deniedBy`
 * provenance string (opaque, ≤ 128 chars, no control characters — the
 * layer / origin / reason values come from the closed frozen vocabulary).
 * Exported for the R2-3 model-state view (same derivation, one source).
 */
export function deniedByString(deniedBy) {
    if (deniedBy.by === 'external') {
        if (deniedBy.reason === 'capabilityMissing')
            return 'external:capability-missing';
        if (deniedBy.reason === 'externalHardDeny')
            return 'external:hard-deny';
        if (deniedBy.reason === 'externalHardRemovedAll')
            return 'external:hard-removed-all';
        return 'external:unspecified';
    }
    if (deniedBy.reason === 'unspecifiedFailClosed')
        return 'team:unspecified-fail-closed';
    const layer = deniedBy.layer ?? 'unspecified';
    return deniedBy.origin !== undefined ? `team:deny:${layer}:${deniedBy.origin}` : `team:deny:${layer}`;
}
/**
 * True when the external stage (not a Team layer) decided the cell.
 * Exported for the R2-3 model-state view (same derivation, one source).
 */
export function externalHardDecides(note) {
    return note === 'externalHardDeny' || note === 'externalHardRemovedAll';
}
/**
 * The v2 `effectiveFrom` of a pending value: the record's durable
 * `effectiveFromStep` when the winning source is backed by a record of the
 * MUTATION lane (safe integer ≥ 1) — otherwise the key is ABSENT (the
 * governance records carry no step; their pending changes are boundary-
 * based without a step, documented per producer).
 */
/**
 * Exported for the R2-3 model-state view (same derivation, one source).
 */
export function effectiveFromOf(recordId, records) {
    if (recordId === null)
        return undefined;
    const record = records.find((candidate) => candidate.recordId === recordId);
    if (record === undefined)
        return undefined;
    const step = record.effectiveFromStep;
    return Number.isSafeInteger(step) && step >= 1 ? step : undefined;
}
/** Build one v2 entry with the DURATIONAL-optional keys absent when unset. */
function buildEntry(fields) {
    return {
        value: fields.value,
        source: fields.source,
        state: fields.state,
        ...(fields.suppressed !== undefined ? { suppressed: fields.suppressed } : {}),
        ...(fields.unavailable !== undefined ? { unavailable: fields.unavailable } : {}),
        ...(fields.deniedBy !== undefined ? { deniedBy: fields.deniedBy } : {}),
        ...(fields.effectiveFrom !== undefined ? { effectiveFrom: fields.effectiveFrom } : {}),
        ...(fields.locked !== undefined ? { locked: fields.locked } : {}),
    };
}
// ---------------------------------------------------------------------------
// The model lane
/**
 * The model lane: the FROZEN consumption view (`modelConsumptionView`)
 * plus the lane state derivation (module precedence, with the baseline
 * consumer rule for `unspecified` cells and the external-denial honesty
 * rule — module docs).
 */
function modelLaneOf(policy, staticModel, records, options) {
    const view = modelConsumptionView(policy, staticModel, options);
    const note = policy.cells[CAPABILITY_NAMES.MODEL].external.note;
    const externalHard = externalHardDecides(note);
    const layer = view.source.layer;
    const recordId = view.source.recordId;
    const pending = view.pendingNextBoundary.length > 0 && recordId !== null;
    const selectionValue = view.selection !== undefined ? `${view.selection.provider}/${view.selection.model}` : null;
    let value;
    let source;
    let state;
    const extra = {};
    if (view.unavailable) {
        // The capability value cannot be applied (absent / malformed).
        value = null;
        state = EFFECTIVE_CONFIG_STATES.unavailable;
        source = externalHard ? EFFECTIVE_CONFIG_SOURCES.external_hard_policy : SOURCE_BY_LAYER[layer];
        extra.unavailable = true;
    }
    else if (externalHard) {
        // Display honesty: the external stage denied the cell (the baseline
        // consumer rule must not hide an explicit external denial).
        value = null;
        state = EFFECTIVE_CONFIG_STATES.denied;
        source = EFFECTIVE_CONFIG_SOURCES.external_hard_policy;
        if (view.deniedBy !== undefined)
            extra.deniedBy = deniedByString(view.deniedBy);
    }
    else if (layer === 'unspecified') {
        // The documented baseline consumer rule: Team is silent — the agent
        // keeps the world baseline. `deniedBy` stays ABSENT (a consumption
        // fact, not a UI denial of an active value).
        value = `${staticModel.provider}/${staticModel.model}`;
        source = EFFECTIVE_CONFIG_SOURCES.capability;
        state = EFFECTIVE_CONFIG_STATES.inherited;
    }
    else if (view.deniedBy !== undefined) {
        // A Team layer (or the external stage via the frozen derivation)
        // denied the cell.
        value = null;
        state = EFFECTIVE_CONFIG_STATES.denied;
        source = SOURCE_BY_LAYER[layer];
        extra.deniedBy = deniedByString(view.deniedBy);
    }
    else if (pending) {
        // Record-backed winning value, not yet applied in this process —
        // conservatively pending (the two-horizon ruling).
        value = selectionValue;
        source = SOURCE_BY_LAYER[layer];
        state = EFFECTIVE_CONFIG_STATES.pending_next_boundary;
        const from = effectiveFromOf(recordId, records);
        if (from !== undefined)
            extra.effectiveFrom = from;
    }
    else if (CLOSER_LAYERS.has(layer)) {
        value = selectionValue;
        source = SOURCE_BY_LAYER[layer];
        state = EFFECTIVE_CONFIG_STATES.overridden;
    }
    else {
        value = selectionValue;
        source = SOURCE_BY_LAYER[layer];
        state = EFFECTIVE_CONFIG_STATES.inherited;
    }
    if (view.suppressed.length > 0)
        extra.suppressed = true;
    return buildEntry({ value, source, state, ...extra });
}
// ---------------------------------------------------------------------------
// The workspace lane
/**
 * The workspace lane: W1 effective-workspace derivation (the member's own
 * durable workspace, else the TeamSession default) plus the W2 lock
 * (documented approximation — module docs): the workspace locks after the
 * first RUNNING, and the durable `lifecycle` is the only production signal
 * (the exact W2 flag lives in the MemberInstance wrapper, not in the v1
 * record surface). `lifecycle !== 'CREATED'` over-approximates the legal
 * CREATED -> DISPOSED edge (RESIDUAL, recorded in S7R2-result.md).
 */
function workspaceLaneOf(memberWorkspace, teamDefaultWorkspace, lifecycle) {
    const raw = memberWorkspace ?? teamDefaultWorkspace;
    const value = raw === undefined ? null : clampValue(raw);
    const source = memberWorkspace !== undefined
        ? EFFECTIVE_CONFIG_SOURCES.instance_creation
        : EFFECTIVE_CONFIG_SOURCES.blueprint;
    const locked = lifecycle !== 'CREATED';
    const state = locked ? EFFECTIVE_CONFIG_STATES.locked : EFFECTIVE_CONFIG_STATES.inherited;
    return buildEntry({
        value,
        source,
        state,
        ...(locked ? { locked: true } : {}),
    });
}
// ---------------------------------------------------------------------------
// The permissions lane (tools + permissions merge)
/**
 * The permissions lane: the `tools` + `permissions` capability cells
 * merged into one item-keyed map (UI §18.2 "Bash Allowed" / "Web Denied").
 * Collision rule: the `permissions` cell wins (it is the stricter of the
 * two — a tool that is both a tool and a permission is governed by the
 * permission decision).
 *
 * Per item, the display value is the expected item (the winning Team
 * layer's allow list) and the state follows the module precedence:
 * unavailable (capability missing — the expected item is shown as
 * `unavailable`, e.g. "MCP: abtem Unavailable Expected by Blueprint"),
 * denied (the effective cell is deny, or the external hard stage removed
 * the item), pending-next-boundary (record-backed winning allow),
 * overridden / inherited (the winning layer's closeness).
 *
 * Capability-level denials with NO expected items (e.g. an `unspecified`
 * fail-closed cell) produce NO entries — the item-keyed lane cannot
 * express an item-less denial (RESIDUAL, recorded in S7R2-result.md).
 */
function permissionsLaneOf(policy, records, options) {
    const out = {};
    // The `tools` cell first, the `permissions` cell second (collision:
    // `permissions` wins by overwriting).
    for (const capability of [
        CAPABILITY_NAMES.TOOLS,
        CAPABILITY_NAMES.PERMISSIONS,
    ]) {
        const cell = policy.cells[capability];
        const prov = cellProvenance(policy, capability, options);
        const note = cell.external.note;
        const unavailable = note === 'capabilityMissing';
        const externalDeny = externalHardDecides(note);
        const denied = cell.effective.kind === 'deny';
        const expectedItems = cell.team.value.kind === 'allow' ? cell.team.value.items : [];
        if (expectedItems.length === 0)
            continue;
        const removedItems = new Set(cell.external.removedItems);
        const pending = !denied && prov.pendingNextBoundary.length > 0 && prov.source.recordId !== null;
        for (const item of expectedItems) {
            const value = item;
            let source;
            let state;
            const extra = {};
            if (unavailable) {
                // The capability is absent: the expected item is shown, unusable.
                state = EFFECTIVE_CONFIG_STATES.unavailable;
                source = SOURCE_BY_LAYER[cell.team.layer];
                extra.unavailable = true;
            }
            else if (denied) {
                // The cell is effectively denied: every expected item is denied.
                state = EFFECTIVE_CONFIG_STATES.denied;
                source = externalDeny
                    ? EFFECTIVE_CONFIG_SOURCES.external_hard_policy
                    : SOURCE_BY_LAYER[cell.team.layer];
                if (prov.deniedBy !== undefined)
                    extra.deniedBy = deniedByString(prov.deniedBy);
            }
            else if (removedItems.has(item)) {
                // The external hard stage removed this item (partial removal —
                // the cell stays allow for the survivors).
                state = EFFECTIVE_CONFIG_STATES.denied;
                source = EFFECTIVE_CONFIG_SOURCES.external_hard_policy;
                extra.deniedBy = 'external:hard-removed';
            }
            else if (pending) {
                state = EFFECTIVE_CONFIG_STATES.pending_next_boundary;
                source = SOURCE_BY_LAYER[cell.team.layer];
                const from = effectiveFromOf(prov.source.recordId, records);
                if (from !== undefined)
                    extra.effectiveFrom = from;
            }
            else if (CLOSER_LAYERS.has(cell.team.layer)) {
                state = EFFECTIVE_CONFIG_STATES.overridden;
                source = SOURCE_BY_LAYER[cell.team.layer];
            }
            else {
                state = EFFECTIVE_CONFIG_STATES.inherited;
                source = SOURCE_BY_LAYER[cell.team.layer];
            }
            if (prov.suppressed.length > 0)
                extra.suppressed = true;
            out[item] = buildEntry({ value, source, state, ...extra });
        }
    }
    return out;
}
// ---------------------------------------------------------------------------
// The autonomy lane
/** Format one capability's stored entry (the deterministic display form). */
function capabilityEntryText(capability, entry) {
    if (entry.kind === 'deny')
        return `${capability}: deny`;
    return entry.items.length === 0
        ? `${capability}: allow`
        : `${capability}: allow ${entry.items.join(', ')}`;
}
/** The deterministic overlay summary (capability order, `; `-joined). */
function overlaySummary(values) {
    const parts = [];
    for (const capability of CAPABILITY_NAME_VALUES) {
        const entry = values[capability];
        if (entry !== undefined)
            parts.push(capabilityEntryText(capability, entry));
    }
    return clampValue(parts.join('; '));
}
/**
 * The autonomy lane (three branches, module docs):
 * 1. a stored autonomy overlay is currently SUPPRESSED by the PolicyState
 *    (§19.4 non-destructive) — the suppressed entry itself is displayed
 *    (state `suppressed`, flag `suppressed`);
 * 2. the highest ACTIVE governance slot of the merged resolver input
 *    (human override > instance overlay > template overlay — the §19.6
 *    closeness order) is displayed as `pending-next-boundary` (application
 *    is process-local — the `overridden` state is unreachable on this
 *    lane, documented);
 * 3. no overlay at all — the neutral entry (`inherited`, `value: null`).
 */
function autonomyLaneOf(input, policy, records) {
    const suppressed = policy.suppressed;
    if (suppressed.length > 0) {
        // Deterministic pick: capability order, then overlay id.
        const capabilityOrder = new Map(CAPABILITY_NAME_VALUES.map((capability, index) => [capability, index]));
        const sorted = suppressed
            .slice()
            .sort((a, b) => {
            const orderA = capabilityOrder.get(a.capability) ?? Number.MAX_SAFE_INTEGER;
            const orderB = capabilityOrder.get(b.capability) ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB)
                return orderA - orderB;
            return a.overlayId < b.overlayId ? -1 : a.overlayId > b.overlayId ? 1 : 0;
        });
        const first = sorted[0];
        if (first === undefined) {
            // Unreachable (suppressed.length > 0 above); degrade to neutral.
            return buildEntry({
                value: null,
                source: EFFECTIVE_CONFIG_SOURCES.autonomy_overlay,
                state: EFFECTIVE_CONFIG_STATES.inherited,
            });
        }
        const text = capabilityEntryText(first.capability, first.value);
        return buildEntry({
            value: text === '' ? null : text,
            source: EFFECTIVE_CONFIG_SOURCES.autonomy_overlay,
            state: EFFECTIVE_CONFIG_STATES.suppressed,
            suppressed: true,
        });
    }
    const humanOverride = input.humanOverride;
    if (humanOverride !== undefined) {
        const text = overlaySummary(humanOverride.values);
        const from = effectiveFromOf(humanOverride.overrideId, records);
        return buildEntry({
            value: text === '' ? null : text,
            source: EFFECTIVE_CONFIG_SOURCES.explicit_human_override,
            state: EFFECTIVE_CONFIG_STATES.pending_next_boundary,
            ...(from !== undefined ? { effectiveFrom: from } : {}),
        });
    }
    const instanceOverlay = input.instanceOverlay;
    if (instanceOverlay !== undefined) {
        const text = overlaySummary(instanceOverlay.values);
        const from = effectiveFromOf(instanceOverlay.overlayId, records);
        return buildEntry({
            value: text === '' ? null : text,
            source: EFFECTIVE_CONFIG_SOURCES.autonomy_overlay,
            state: EFFECTIVE_CONFIG_STATES.pending_next_boundary,
            ...(from !== undefined ? { effectiveFrom: from } : {}),
        });
    }
    const templateOverlay = input.templateOverlay;
    if (templateOverlay !== undefined) {
        const text = overlaySummary(templateOverlay.values);
        const from = effectiveFromOf(templateOverlay.overlayId, records);
        return buildEntry({
            value: text === '' ? null : text,
            source: EFFECTIVE_CONFIG_SOURCES.autonomy_overlay,
            state: EFFECTIVE_CONFIG_STATES.pending_next_boundary,
            ...(from !== undefined ? { effectiveFrom: from } : {}),
        });
    }
    // No governance slot at all: the neutral entry.
    return buildEntry({
        value: null,
        source: EFFECTIVE_CONFIG_SOURCES.autonomy_overlay,
        state: EFFECTIVE_CONFIG_STATES.inherited,
    });
}
//# sourceMappingURL=effective-config-view.js.map