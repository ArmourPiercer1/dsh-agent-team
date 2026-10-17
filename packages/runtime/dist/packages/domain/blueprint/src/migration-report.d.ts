/**
 * The v3→v4 migration REPORT module (VNEXT-SCHEMA-ADR M-4; exit form (a):
 * a READ-ONLY report, no edit loop, no auto-rewrite — those ship only with
 * the release round).
 *
 * Laws encoded here:
 *  - E2 (ADR §2): a migration may NEVER widen permissions. Bound envelope
 *    content (the Alpha.4 authority documents and mutation envelopes) is
 *    byte-invariant across a migration (D-07⑤): any difference is a
 *    `MIGRATION_PERMISSION_WIDENING` REJECTION, not a decision to offer.
 *  - v3 carries NO tool-governance fact, so every produced `toolBindings`
 *    entry is a NEW declaration: at best `requires-decision`, never silent
 *    acceptance — and never silent allowance.
 *  - compat-default rules may not produce wide values: when the caller
 *    reports `appliedRules` containing `compat-default` AND the proposed
 *    document carries wide values with no source fact, the report REJECTS
 *    (the mapping "default → allow/all" must not exist).
 *  - silently dropping a carried field is a loud `requires-decision`
 *    finding — narrowing is legal only as an explicit human decision.
 *
 * The report consumes REAL documents (a v3 source, an optional proposed v4
 * document) so the NEG suite drives the shipped decision surface.
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/domain/blueprint-migration-report
 */
export declare const MIGRATION_PERMISSION_WIDENING: "MIGRATION_PERMISSION_WIDENING";
export type MigrationFieldVerdict = 'carried' | 'rejected' | 'requires-decision';
export interface MigrationFieldFinding {
    readonly path: string;
    readonly verdict: MigrationFieldVerdict;
    readonly code?: string;
    readonly detail?: string;
}
export interface MigrationReport {
    readonly verdict: 'accept' | 'report-requires-decision' | 'reject';
    readonly ok: boolean;
    readonly requiresDecision: boolean;
    readonly permissionWidening: boolean;
    readonly code?: string;
    readonly fields: readonly MigrationFieldFinding[];
    readonly notes: readonly string[];
}
export interface MigrationReportOptions {
    /** Rule names the caller APPLIED while producing the proposed document. */
    readonly appliedRules?: readonly string[];
}
/**
 * Plan the migration of one v3 document to v4. Read-only: the proposed
 * document is VALIDATED and DIFFED, never mutated or rewritten.
 */
export declare function planBlueprintV3toV4Migration(source: unknown, proposed?: unknown, opts?: MigrationReportOptions): MigrationReport;
//# sourceMappingURL=migration-report.d.ts.map