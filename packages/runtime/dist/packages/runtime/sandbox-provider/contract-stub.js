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
export const PROVIDER_ERROR_CODES = Object.freeze([
    'TOOL_BINDING_UNVERIFIED',
    'TEAM_TOOL_UNGOVERNED',
    'APPROVAL_STALE',
    'IO_POLICY_UNSUPPORTED',
    'SANDBOX_UNAVAILABLE',
    'ADAPTER_DRAINING',
    'DOMAIN_DENIED',
    'EXECUTION_TERMINATION_UNCONFIRMED',
]);
/** Mirror of the frozen assurance levels, verbatim. */
export const PROVIDER_ASSURANCE_LEVELS = ['enforced', 'author-trusted', 'partial', 'unsupported', 'untested'];
/** Mirror of the frozen assurance dimensions, verbatim. */
export const PROVIDER_ASSURANCE_DIMENSIONS = [
    'content-read',
    'directory-metadata',
    'write',
    'alias',
    'network-destination',
    'inherit-cancel',
];
/** A typed refusal helper (single construction site for the closed shape). */
export function refuse(code, message, extra) {
    return { ok: false, error: Object.freeze({ code, message, ...extra }) };
}
//# sourceMappingURL=contract-stub.js.map