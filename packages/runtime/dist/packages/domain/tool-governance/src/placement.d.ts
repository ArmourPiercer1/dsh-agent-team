/**
 * The R1 PLACEMENT face of `ToolBinding` (VNEXT-SCHEMA-ADR §1 B1/B2; design
 * `post-poc-technical-design.md` §2 R1 = Scoped Binding route).
 *
 * R1 is a placement FACT, not a config lookup: the entry assembly places a
 * Team-owned Definition under a reserved name and pins THE OBJECT IT PLACED
 * (GLUE-5 #308 shipped that production mechanism — `team-tool-plane.mjs`
 * bindOwnTools placement attribution feeding the admitted-call binding).
 * This module is the TYPE-LEVEL face of that mechanism:
 *
 *  - `PlacedTeamDefinition` — the closed record of one placement fact
 *    (which owner namespace placed which name to which definition object);
 *  - `mintToolBindingFromPlacement` — the placement fact + the trusted
 *    assembly-side facts become a `ToolBinding` THROUGH `parseToolBinding`
 *    itself (pa-CONTRACT §GLUE-5: guard publishes facts, admitCall receives
 *    the binding REBUILT via `parseToolBinding`; there is deliberately no
 *    second construction path — every law the frozen parser enforces,
 *    enforces here);
 *  - `createPlacementComparator` — the per-call comparison hook: an admitted
 *    binding is checked against the CURRENT placement table of the owning
 *    assembly. A name nobody placed, or the same name now resolving to a
 *    DIFFERENT definition object (identity drift), is a typed verdict —
 *    never a throw, never a silent pass.
 *
 * owner ↔ providerId is 1:1 by construction (B2: the placement record IS
 * the provider identity; no separate mapping table may appear).
 *
 * DORMANT like the whole lane: no shipped runtime path is rewired here —
 * the production plane already pins the same facts through its own
 * (behavior-tested) code path; rewiring the live plane to this typed face
 * is a behavior change owned by the effect-queue round, not this one.
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/domain/tool-governance/placement
 */
import { type ParseResult } from './parse-util.js';
import { type BindingState, type ToolBinding } from './binding.js';
import type { ExecutionBoundary, ImplementationOrigin } from './assurance.js';
/** The closed record of one placed Team-owned Definition (R1 placement fact). */
export declare const PLACED_TEAM_DEFINITION_FIELDS: readonly ["owner", "toolName", "definitionIdentity"];
export interface PlacedTeamDefinition {
    /** The owner namespace that placed the name (the 1:1 providerId of B2). */
    readonly owner: string;
    /** The reserved placement name inside that owner namespace. */
    readonly toolName: string;
    /** The identity of the DEFINITION OBJECT that was placed (pinned, not looked up). */
    readonly definitionIdentity: string;
}
/** Strict parse of one placement fact — closed shape, collected problems. */
export declare function parsePlacedTeamDefinition(raw: unknown): ParseResult<PlacedTeamDefinition>;
/** The trusted assembly-side facts a placement needs to become a binding. */
export interface PlacementBindingFacts {
    readonly bindingId: string;
    readonly agentScopeKey: string;
    readonly implementationOrigin: ImplementationOrigin;
    readonly executionBoundary: ExecutionBoundary;
    /** RAW assurance contract shape — validated by parseToolBinding, never here. */
    readonly assurance: unknown;
    readonly policyGeneration: number;
    readonly authorityGeneration: number;
    readonly revision: number;
    readonly status: BindingState;
}
/**
 * Build the admitted-call `ToolBinding` for a placement — BY DELEGATING to
 * `parseToolBinding` (the frozen parser the production admitCall contract
 * consumes). This is the "reuse, no parallel system" pin: delete this
 * function and the same values must still parse identically.
 */
export declare function mintToolBindingFromPlacement(placed: PlacedTeamDefinition, facts: PlacementBindingFacts): ParseResult<ToolBinding>;
/** The per-call comparison verdict for an admitted binding vs live placement. */
export type PlacementVerdict = {
    readonly ok: true;
    readonly placed: PlacedTeamDefinition;
} | {
    readonly ok: false;
    readonly code: 'definition-not-placed';
    readonly providerId: string;
    readonly toolName: string;
} | {
    readonly ok: false;
    readonly code: 'placement-identity-drift';
    readonly providerId: string;
    readonly toolName: string;
    readonly expected: string;
    readonly observed: string;
};
/** The subset of an admitted `ToolBinding` the comparison reads. */
export interface AdmittedBindingFacts {
    readonly providerId: string;
    readonly toolName: string;
    readonly definitionIdentity: string;
}
export interface PlacementComparator {
    /** Compare one admitted call's binding against the live placement table. */
    readonly compare: (admitted: AdmittedBindingFacts) => PlacementVerdict;
}
/**
 * Build the per-call comparison hook over a placement table. Construction is
 * strict: every row must parse, and one (owner, toolName) may resolve to at
 * most ONE definition object — a table that places a name twice is a
 * construction error (the ambiguity is the incident, not a runtime surprise).
 */
export declare function createPlacementComparator(placementFacts: readonly unknown[]): PlacementComparator;
//# sourceMappingURL=placement.d.ts.map