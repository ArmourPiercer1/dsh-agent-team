/**
 * THE LANE CONTRACT STUB — a structural mirror of the frozen PR0 vocabulary
 * (`domain/tool-governance`: the §5 error codes, the assurance levels and
 * dimensions, the `ProcessCapability` capability row). INTERFACES-v1 gives
 * each lane a LOCAL contract stub instead of a cross-lane import — this file
 * IS that boundary, and `a5p4-lane-hygiene` pins element-for-element equality
 * against the frozen sets, so the mirror cannot silently drift.
 *
 * The frozen shapes are NOT redefined here: `ProcessCapabilityRow` mirrors
 * `ProcessCapability` plus the §2.1 record fields (mechanism/realmId/
 * trustRoot/evidence), because PR4's probe rows must carry the real evidence
 * surface (COORDINATION PR2-freeze item (ii)); the integration point maps
 * them onto the frozen pair (`ProcessCapability` for the interface,
 * `AssuranceDimensionRecord` for the contract).
 *
 * Purity: no `node:*`, no I/O, no imports.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/contract-stub
 */
/** Mirror of the frozen §5 code set, verbatim (pinned by the hygiene spec). */
export declare const PROVIDER_ERROR_CODES: readonly ["TOOL_BINDING_UNVERIFIED", "TEAM_TOOL_UNGOVERNED", "APPROVAL_STALE", "IO_POLICY_UNSUPPORTED", "SANDBOX_UNAVAILABLE", "ADAPTER_DRAINING", "DOMAIN_DENIED", "EXECUTION_TERMINATION_UNCONFIRMED"];
/** One §5 error code. */
export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];
/** Mirror of the frozen typed error (never a thrown, never a stringly failure). */
export interface ProviderError {
    readonly code: ProviderErrorCode;
    readonly message: string;
    /** TRUE when side effects may exist that the platform cannot confirm stopped. */
    readonly sideEffectUnknown?: boolean;
    readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}
/** The closed Result shape (frozen law: typed refusals, no throwing authorities). */
export type ProviderResult<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: ProviderError;
};
/** Mirror of the frozen assurance levels, verbatim. */
export declare const PROVIDER_ASSURANCE_LEVELS: readonly ["enforced", "author-trusted", "partial", "unsupported", "untested"];
/** One assurance level. */
export type AssuranceLevel = (typeof PROVIDER_ASSURANCE_LEVELS)[number];
/** Mirror of the frozen assurance dimensions, verbatim. */
export declare const PROVIDER_ASSURANCE_DIMENSIONS: readonly ["content-read", "directory-metadata", "write", "alias", "network-destination", "inherit-cancel"];
/** One assurance dimension. */
export type AssuranceDimension = (typeof PROVIDER_ASSURANCE_DIMENSIONS)[number];
/**
 * One probe capability row: the frozen `ProcessCapability` triple
 * {dimension, level, note} CARRIED on the §2.1 record fields — a bare level
 * with no mechanism, realm, trust root or evidence is exactly the overclaim
 * PR0 refuses, so every row states all five fields plus the note.
 */
export interface ProcessCapabilityRow {
    readonly dimension: AssuranceDimension;
    readonly level: AssuranceLevel;
    readonly mechanism: string | null;
    readonly realmId: string;
    readonly trustRoot: string | null;
    readonly evidence: string | null;
    readonly note: string;
}
/** A typed refusal helper (single construction site for the closed shape). */
export declare function refuse(code: ProviderErrorCode, message: string, extra?: Omit<ProviderError, 'code' | 'message'>): {
    ok: false;
    error: ProviderError;
};
//# sourceMappingURL=contract-stub.d.ts.map