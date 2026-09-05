/**
 * TeamRootProjectionDto — the TeamSession identity + admission view carried
 * by the projection root (Architecture §14.3 category A + §28 + §34.1).
 *
 * Design facts (frozen 20260829 plan docs):
 *
 * - `teamSessionId` IS the root DSH session id (invariant 9); it must equal
 *   the top-level projection `teamSessionId` (validated by the top-level
 *   parser).
 * - **NO lifecycle field** (Architecture §8.6): a TeamSession has no
 *   Member-style lifecycle; its identity and admission are the frozen root
 *   facts. The negative surface is asserted by the P8-T1 tests.
 * - `policyState` is the current PolicyState name: opaque to the contract
 *   (policy states are blueprint-defined), label-validated only.
 * - `compatibility` is the frozen CompatibilitySummaryDto (states.ts
 *   vocabulary for `status`).
 * - `creationBudgetConsumed` is the count of root creations consumed by
 *   handoff into this session (>= 0; the handoff rule of Architecture
 *   §34.1 — a handoff may continue the session only while the budget is not
 *   exhausted).
 * - `handoffSourceSessionId` is the generic DSH session id of the session a
 *   handoff continued from (Architecture §34.1); key absent for a session
 *   that was created fresh (DURATIONAL-optional discipline: absent key,
 *   never an own `undefined` key).
 *
 * The root is an embedded value: the enclosing versioned record owns the
 * schema version, so the root carries none of its own.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/root
 */
import type { SessionId, TeamSessionId } from '../ids/session-id.js';
import type { CompatibilitySummaryDto } from './compatibility.js';
import type { AdmissionState } from './states.js';
/** The exact frozen fields of a TeamRootProjectionDto. */
export declare const TEAM_ROOT_PROJECTION_FIELDS: readonly string[];
/**
 * The TeamSession identity + admission view (v1). NO lifecycle field
 * (Architecture §8.6).
 */
export interface TeamRootProjectionDto {
    /** The TeamSession id — which IS the root DSH session id (invariant 9). */
    readonly teamSessionId: TeamSessionId;
    /** The team default workspace; key absent when not carried. */
    readonly defaultWorkspace?: string;
    /** TeamSession creation timestamp, ISO-8601. */
    readonly createdAt: string;
    /** The current PolicyState name (blueprint-defined; label-validated). */
    readonly policyState: string;
    /** The frozen admission state (Architecture §28). */
    readonly admission: AdmissionState;
    /** The compatibility/admission summary. */
    readonly compatibility: CompatibilitySummaryDto;
    /** Root creations consumed by handoff into this session (>= 0). */
    readonly creationBudgetConsumed: number;
    /** The session a handoff continued from; key absent when created fresh. */
    readonly handoffSourceSessionId?: SessionId;
}
/**
 * Producer input for {@link createTeamRootProjection}: all identity fields,
 * no schemaVersion (the enclosing record stamps it).
 */
export interface TeamRootProjectionInput {
    /** The TeamSession id (root DSH session id). */
    teamSessionId: TeamSessionId;
    /** The team default workspace (optional). */
    defaultWorkspace?: string;
    /** TeamSession creation timestamp, ISO-8601. */
    createdAt: string;
    /** The current PolicyState name. */
    policyState: string;
    /** The frozen admission state. */
    admission: AdmissionState;
    /** The compatibility/admission summary (or a plain record for it). */
    compatibility: CompatibilitySummaryDto;
    /** Root creations consumed by handoff into this session (>= 0). */
    creationBudgetConsumed: number;
    /** The session a handoff continued from (optional). */
    handoffSourceSessionId?: SessionId;
}
/**
 * Parse and validate a TeamRootProjectionDto from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen root view.
 * @throws `MALFORMED_DTO`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_ROOT_SESSION_ID`, `INVALID_SESSION_ID`, or the field-specific
 *   codes of the embedded summary.
 */
export declare function parseTeamRootProjection(value: unknown): TeamRootProjectionDto;
/**
 * Build a fresh TeamRootProjectionDto from producer input (already branded
 * ids; the input must not carry own `undefined` keys).
 * @param input - the root fields.
 * @returns the frozen root view, validated through the same pipeline as
 *   `parseTeamRootProjection`.
 */
export declare function createTeamRootProjection(input: TeamRootProjectionInput): TeamRootProjectionDto;
//# sourceMappingURL=root.d.ts.map