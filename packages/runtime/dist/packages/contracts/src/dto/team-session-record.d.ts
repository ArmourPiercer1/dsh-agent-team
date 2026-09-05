/**
 * TeamSessionRecordDto — the TeamDomain record of a TeamSession
 * (Architecture §14.3 category A).
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **TeamSessionId = RootSessionId** (invariant 9): the record's
 *   `rootSessionId` field IS the TeamSession id; no separate TeamSession
 *   UUID is minted (§8.2).
 * - **One Root Session -> 0 or 1 TeamSession** (invariant 8) — enforced by
 *   {@link import('../uniqueness.js').assertTeamSessionUnique}.
 * - **One TeamSession binds exactly one immutable Blueprint snapshot**
 *   (invariant 10); the snapshot ref is embedded, not replaced in place.
 * - The record is the durable sidecar authority's (TeamDomain's, invariant
 *   41) row for the session; TeamSession has no Member-style lifecycle
 *   (§8.6) — hence no lifecycle field here.
 *
 * The v1 record freezes the identity core of category A
 * (rootSessionId, blueprint snapshot, default workspace, creation
 * timestamp, version/generation). Category A's remaining fields
 * (PolicyState, overrides, admission state, ledger refs, handoff provenance)
 * are added by later versions with their owning tasks — the freeze rule in
 * CHANGELOG.md governs how. P8-S7-R4 adds the first of them: the
 * one-shot handoff provenance field `handoffSourceSessionId` (optional;
 * present exactly for teams created through a Start-Team-from-Here
 * handoff — Architecture §34, BQ-16).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/dto/team-session-record
 */
import type { TeamContractSchemaVersion } from '../schema-version.js';
import type { RootSessionId, SessionId } from '../ids/session-id.js';
import type { BlueprintSnapshotRef } from './blueprint-snapshot.js';
/** The exact frozen fields of a TeamSessionRecordDto (v1). */
export declare const TEAM_SESSION_RECORD_FIELDS: readonly string[];
/**
 * The TeamDomain record of one TeamSession (v1 identity core of
 * Architecture §14.3 A).
 */
export interface TeamSessionRecordDto {
    /** Schema version stamp; v1 records carry `1`. */
    readonly schemaVersion: TeamContractSchemaVersion;
    /** The root DSH session id — which is the TeamSessionId (invariant 9). */
    readonly rootSessionId: RootSessionId;
    /** The immutable Blueprint snapshot binding (invariant 10). */
    readonly blueprint: BlueprintSnapshotRef;
    /** Team default workspace (optional; inherited by members, §21.2). */
    readonly defaultWorkspace?: string;
    /** Creation timestamp, ISO-8601. */
    readonly createdAt: string;
    /** Record version/generation counter (starts at 1, monotonically increases). */
    readonly generation: number;
    /**
     * One-shot handoff provenance (Architecture §34, BQ-16): the source
     * SessionId of the "Start-Team-from-Here" handoff that created this
     * TeamSession. Present exactly for teams created through a handoff;
     * absent for every other team. This is provenance/navigation metadata
     * ONLY — it grants NO read access to the source session (§34.3: the
     * sourceSessionId is a provenance fact, not a read grant).
     */
    readonly handoffSourceSessionId?: SessionId;
}
/**
 * Producer input for {@link createTeamSessionRecord}: all identity fields,
 * no schemaVersion (stamped by the factory).
 */
export interface TeamSessionRecordInput {
    /** The root DSH session id of the TeamSession to record. */
    rootSessionId: RootSessionId;
    /** The immutable Blueprint snapshot binding. */
    blueprint: BlueprintSnapshotRef;
    /** Team default workspace (optional). */
    defaultWorkspace?: string;
    /** Creation timestamp, ISO-8601. */
    createdAt: string;
    /** Record generation; must be >= 1. */
    generation: number;
    /** One-shot handoff provenance (optional; see {@link TeamSessionRecordDto.handoffSourceSessionId}). */
    handoffSourceSessionId?: SessionId;
}
/**
 * Parse and validate a TeamSessionRecordDto from an untrusted value.
 * @param value - the unknown input (e.g. a decoded TeamDomain row).
 * @returns the frozen record.
 * @throws `MALFORMED_DTO`, `SCHEMA_VERSION_MISMATCH`,
 *   `SCHEMA_VERSION_UNSUPPORTED`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_ROOT_SESSION_ID`, or the blueprint id-specific codes.
 */
export declare function parseTeamSessionRecord(value: unknown): TeamSessionRecordDto;
/**
 * Build a fresh TeamSessionRecordDto (generation 1 creation path).
 * @param input - the identity fields; ids must already be branded.
 * @returns the frozen record with `schemaVersion` stamped to the v1 version.
 */
export declare function createTeamSessionRecord(input: TeamSessionRecordInput): TeamSessionRecordDto;
/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export declare function serializeTeamSessionRecord(record: TeamSessionRecordDto): string;
/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
 *   validation codes a malformed record triggers.
 */
export declare function deserializeTeamSessionRecord(json: string): TeamSessionRecordDto;
//# sourceMappingURL=team-session-record.d.ts.map