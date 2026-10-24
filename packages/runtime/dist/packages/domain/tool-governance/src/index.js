/**
 * `@dsh-agent-team/domain/tool-governance` — the Alpha.5 PR0 internal lane:
 * pure contracts and the immutable authorization algebra (implementation
 * plan §3; design §2.1/§4.1/§4.2/§4.3/§5).
 *
 * WIRED, NOT DORMANT (corrected 2026-10-23: the sentence here had aged past
 * the code). PR0 froze this lane DORMANT with zero production consumers; PR1
 * and PR2 (plan §4/§5), PR3 (`controlled-fs`), PR5 (the tools lane) and A5-M1
 * (PR358) replaced that freeze with a NAMED CONSUMER SET, booked file-by-file
 * by `scripts/audit-a5-tool-governance-imports.mjs` and pinned by
 * `packages/domain/test/a5p0-layer-audit.test.ts` — a consumer that appears is a design change
 * that must be booked there, and one that disappears is a broken wire. In this
 * checkout the ledger books 26 consumers, 25 of which import this lane directly
 * (from `packages/runtime/control`, `packages/runtime/tool-dispatch`, `packages/runtime/tool-admission`,
 * `packages/runtime/operation-permission`, `packages/runtime/controlled-fs/src`,
 * `packages/runtime/src/plugin/live`, and the reviewed PR5 tools lane named in that ledger);
 * the 26th,
 * `packages/runtime/src/plugin/live/agent-bindings.mjs`, is booked for its
 * `tool-dispatch` edge, which Law 3 counts on purpose — "the assembly point
 * imports only the latter, and it is the caller that matters". Any number in
 * this comment is a snapshot: THE LEDGER IS THE AUTHORITY, not this prose.
 * This lane remains PURE: no `node:*`, no
 * DSH imports, no I/O, no clock (the clock arrives per call), no persistence
 * (consumption reaches `validateGrantForCall` as an injected view). Blueprint
 * v3 remains CLOSED: nothing here is a v3 field (design §8: PR8 owns vNext).
 *
 * REUSE, NOT SECOND FACTS (the task's hard line): the deny/ask/allow rank
 * table, the meet lattice, the matching walk and BOTH plane semantics are
 * imported from `domain/authority-envelope` — the Alpha.4 grammar (ADR
 * A3-9/A1-4) — not restated; the lane adds the Realm dimension by SCOPING,
 * pinned rule-for-rule against the shared algebra by `a5p0-planes`.
 *
 * @module @dsh-agent-team/domain/tool-governance
 */
export { canonicalJsonFingerprint, canonicalJsonStringify, } from './canonical-json.js';
export { TOOL_CONTRACT_PROBLEM_CODES, closeRecordKeys, isRecord, problemCodesOf, } from './parse-util.js';
// VNEXT-SCHEMA reversible half: the R1 PLACEMENT typed face (ADR §1 B1/B2;
// the GLUE-5 #308 mechanism's object level). Additive — the frozen parsers
// above are untouched, and mintToolBindingFromPlacement delegates every law
// to parseToolBinding (no parallel binding system).
export { PLACED_TEAM_DEFINITION_FIELDS, createPlacementComparator, mintToolBindingFromPlacement, parsePlacedTeamDefinition, } from './placement.js';
export { RESOURCE_KINDS, RESOURCE_RIGHTS, RESOURCE_RIGHT_MATRIX, parseResourceRef, resourceEquals, resourceIdentityKey, } from './resource.js';
export { EFFECT_KINDS, EFFECT_REQUIRED_RIGHT, effectIdentityKey, effectsAreSubset, parseRequestedEffectSet, } from './effects.js';
export { ASSURANCE_DIMENSIONS, ASSURANCE_LEVELS, EXECUTION_BOUNDARIES, IMPLEMENTATION_ORIGINS, assuranceSatisfies, parseAssuranceContract, } from './assurance.js';
export { BINDING_STATES, BINDING_TRANSITIONS, advanceBindingStatus, parseToolBinding, } from './binding.js';
export { GRANT_REFUSAL_REASONS, grantRefusalErrorCode, parseOperationGrant, validateGrantForCall, } from './grant.js';
export { EXECUTION_LEASE_KINDS, LEASE_STATUSES, openExecutionLease, parseExecutionLease, requestLeaseCancellation, settleLeaseTermination, } from './lease.js';
export { EFFECT_RANK, evaluateToolPolicyApprovalNarrowing, evaluateToolPolicyExpansionAuthority, parseToolPolicyDocument, } from './planes.js';
export { GOVERNANCE_ERROR_CODES } from './errors.js';
//# sourceMappingURL=index.js.map