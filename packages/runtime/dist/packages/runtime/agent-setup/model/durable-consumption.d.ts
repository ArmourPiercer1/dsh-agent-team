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
 * - the bound template's static `model` value (its `modelPreference`,
 *   fed through `templateValues` — the model-preference routing fix)
 *   resolves at the resolver's `template` layer (provenance
 *   template/static, no record id): it WINS over the `unspecified`
 *   fail-closed default (so a declared preference never degrades to the
 *   deployment default) but stays BELOW the record-backed overlays /
 *   human override and the external hard facts;
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
import type { EffectivePolicy, ExternalPolicyFacts, SuppressedOverlayRecord, TemplatePolicy } from '../../../domain/policy/src/index.js';
import type { GovernanceOverrideRecord } from '../../../storage/schema/index.js';
import { type CellDeniedBy, type CellProvenanceOptions, type CellSource, type PendingBoundaryRecord } from '../../mutation/cell-provenance.js';
import { parseModelItem } from './route.js';
import type { ModelSelection } from './types.js';
export { parseModelItem };
/** The model-side consumption view of one member's durable policy. */
export interface ModelConsumptionView {
    /**
     * The selection the next request boundary must install (or `undefined`
     * when no model may be selected — explicit deny / external / malformed).
     * For `unspecified` cells this is the `baseline` (world provider
     * default), per the documented consumer rule.
     */
    readonly selection: ModelSelection | undefined;
    /** The winning Team layer's provenance (the §18.3 `source` field). */
    readonly source: CellSource;
    /** The stored-but-suppressed autonomy overlays of the cell. */
    readonly suppressed: readonly SuppressedOverlayRecord[];
    /** True when the capability value cannot be applied (absent/malformed). */
    readonly unavailable: boolean;
    /** Who/what denied the cell (absent when the cell is effectively granted). */
    readonly deniedBy: CellDeniedBy | undefined;
    /** Durable records that admit a model value but were not yet applied. */
    readonly pendingNextBoundary: readonly PendingBoundaryRecord[];
    /** The frozen resolver's per-cell explanation. */
    readonly explanation: string;
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
export declare function modelConsumptionView(policy: EffectivePolicy, baseline: ModelSelection, options?: CellProvenanceOptions): ModelConsumptionView;
/** The durable model resolution inputs (re-read at every boundary). */
export interface DurableModelSelectionArgs {
    /** The owning TeamSession. */
    readonly rootSessionId: string;
    /** The addressed MemberInstance (required by the frozen resolver). */
    readonly instanceId: string;
    /** Every durable governance override of the TeamSession (backend truth). */
    readonly overrides: readonly GovernanceOverrideRecord[];
    /** The external hard facts (host ceiling / capability presence). */
    readonly external: ExternalPolicyFacts;
    /** The world provider default (the `unspecified` fallback). */
    readonly baseline: ModelSelection;
    /** The record ids this session has already applied at its last boundary. */
    readonly appliedRecordIds?: readonly string[];
    /**
     * The bound template's static policy values (the model-preference
     * routing fix, generic like `resolveActivationPolicy`'s input): the
     * `model` cell carries the template's `modelPreference` as its
     * `template/static` value (derivation: `initialTemplateModelGrantOf`),
     * so a declared preference resolves at the TEMPLATE layer instead of
     * falling to the `unspecified` -> baseline consumer rule. The
     * record-backed layers and the external hard facts keep their
     * precedence over it. Absent = no template static values (the
     * pre-fix behavior: baseline for `unspecified` cells).
     */
    readonly templateValues?: TemplatePolicy['values'];
}
/** The resolved durable model selection + its provenance. */
export interface DurableModelSelection {
    /** The frozen effective policy (the backend truth every view derives from). */
    readonly policy: EffectivePolicy;
    /** The model-side consumption view (selection + §18.3 provenance). */
    readonly view: ModelConsumptionView;
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
export declare function resolveDurableModelSelection(args: DurableModelSelectionArgs): DurableModelSelection;
//# sourceMappingURL=durable-consumption.d.ts.map