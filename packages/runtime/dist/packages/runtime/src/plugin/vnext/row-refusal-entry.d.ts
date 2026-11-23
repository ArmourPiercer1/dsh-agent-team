/**
 * row-refusal-entry.ts — the durable half of a ROW-config refusal, at the host entry.
 *
 * WHY THIS MODULE EXISTS (round 68, shape A). The Alpha.6 gate is a ROW rule: `centreConfigViolation`
 * (centre-config.ts) refuses an opted-in row while `validateTeamPluginConfig` runs, which is before the
 * root exists. That refusal is correct and typed, but the product's own recorder
 * (`host-surface-refusal.mjs`'s `createHostSurfaceRefusalPoint`) used to be built only inside `root.ts`,
 * so a refusal taken at row validation wrote NO invocation-authority fact and NO settlement — the
 * recorded-fact half of the same decision was unreachable at the host entry (round-63 measurement:
 * `d3:alpha6` PROVEN as a typed refusal with "no fact file").
 *
 * WHAT CHANGES, AND WHAT DOES NOT. The row still does not boot and the gate still throws the same typed
 * `TEAM_PLUGIN_CONFIG_INVALID` carrying the closed table's `ADMISSION_ALPHA6_UNAVAILABLE` prefix (round
 * 84: followed by the PIECE code the coherence rule refused, e.g. `ADMISSION_ALPHA6_ROUTING_REQUIRED`);
 * the ONLY difference is that the entry now builds the SAME point the root builds, at the moment the
 * gate decides, and records the refusal through it before the unchanged throw. Nothing here decides
 * anything: `centreConfigViolation` is still the rule, `refuseHostSurfaceBefore` is still the product's
 * refusal helper, and the ledger/settlement writers are the product's own.
 *
 * WHY A HOOK AND NOT A MOVED GATE. Moving the throw below root construction would build a team root
 * (durable effects) merely to refuse it, and would leave the no-centre row — where no durable directory
 * exists to record into — without the unconditional refusal it has today. The hook runs exactly where the
 * rule refuses, after every earlier config field has already validated, so the record can never blame
 * Alpha.6 for a row refused for a different reason.
 *
 * ONE CONSTRUCTION SITE. `createCentreHostSurfacePoint` is what `root.ts` builds for its own gate and what
 * this entry builds for the row gate, so both name the same capability/axis/ledger/settlement identity.
 * The arms drive `createAlpha6RowRefusalHook` — the exact function `host.ts` passes to the validator — not
 * a copy of the rule.
 *
 * @module packages/runtime/src/plugin/vnext/row-refusal-entry
 */
import { type HostSurfaceRefusalPoint } from './host-surface-refusal.mjs';
/**
 * The capabilities whose point the centre builds. The closed table has a third, PTC: it is refused
 * MEMBER-side by the centre's admission (`admission.ts`), because the PTC entry point is a tool call
 * a Member makes, not a host surface a row builds. ROUND 92: PTC is NOT SUPPORTED by product ruling
 * (`ADR-ptc-unsupported.md`), and its refusal still rides the same table/point vocabulary.
 */
export type CentreHostSurfaceCapability = 'remote' | 'alpha6';
/** What a recorded row refusal leaves behind, for the caller to report (never to decide with). */
export interface RecordedRowRefusal {
    readonly code: string;
    readonly callId: string;
    readonly capability: CentreHostSurfaceCapability;
    readonly ledgerPath: string;
    readonly settlementDir: string;
}
/** The validated subset of the row this module reads. Structural, exactly like `CentreConfigFacts`. */
export interface RowRefusalFacts {
    readonly centreStatePath?: unknown;
    readonly rootSessionId?: unknown;
}
/**
 * Build the centre's host-surface refusal point for one row — the ONE construction site.
 *
 * `undefined` when the row never configured the centre: that is the same branch `root.ts` takes (no
 * point, no file touched), which is what makes a refusal meaningful rather than a permanently broken
 * fixture.
 *
 * @param input.capability - one of the closed table's host capabilities.
 * @param input.centreStatePath - the row's durable facts/settlement directory.
 * @param input.rootSessionId - the row's root session (the settlement world), when it validated.
 * @param input.onFault - every recording fault is reported, never swallowed.
 */
export declare function createCentreHostSurfacePoint(input: {
    readonly capability: CentreHostSurfaceCapability;
    readonly centreStatePath: unknown;
    readonly rootSessionId: unknown;
    readonly onFault?: (error: unknown, context: object) => void;
}): HostSurfaceRefusalPoint | undefined;
/**
 * Record the Alpha.6 row refusal the config gate has ALREADY decided.
 *
 * This function must never become the gate: it is called from the validation hook with the violation
 * the rule produced, and it records only when that violation is the Alpha.6 one. Any other violation,
 * or a row with no `centreStatePath` (no durable directory to write to), records nothing and returns
 * `undefined` — the caller then throws exactly as before. It never throws: a recording fault is reported
 * to `onFault` and the refusal stands regardless (a refusal nobody could write is still a refusal).
 *
 * @param input.violation - the string `centreConfigViolation` returned.
 * @param input.config - the raw row config the rule read.
 * @param input.onFault - fault reporter (the entry logs it loud).
 * @returns what was recorded, or `undefined` when there was nothing to record.
 */
export declare function recordAlpha6RowRefusal(input: {
    readonly violation: string;
    readonly config: unknown;
    readonly onFault?: (error: unknown, context: object) => void;
}): RecordedRowRefusal | undefined;
/** The hook shape `validateTeamPluginConfig` accepts (see `TeamPluginConfigValidationHooks`). */
export type CentreConfigRefusalHook = (violation: string, config: Readonly<Record<string, unknown>>) => void;
/**
 * The row-refusal hook the host entry passes to the validator.
 *
 * `onRecorded` is observability only (the entry logs a line naming the files); it is not a decision
 * channel and cannot un-refuse the row.
 *
 * @param input.onFault - recording faults, reported loud.
 * @param input.onRecorded - called with what was recorded (after a successful write).
 */
export declare function createAlpha6RowRefusalHook(input?: {
    readonly onFault?: (error: unknown, context: object) => void;
    readonly onRecorded?: (recorded: RecordedRowRefusal) => void;
}): CentreConfigRefusalHook;
//# sourceMappingURL=row-refusal-entry.d.ts.map