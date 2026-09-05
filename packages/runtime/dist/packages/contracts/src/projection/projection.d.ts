/**
 * TeamProjectionDto — the frozen v1 projection contract (P8-T1): the whole
 * read-only view of one TeamSession that the P8-T2 read service produces
 * from TeamDomain (+ an optional live overlay) and the client renders
 * (Development Plan §21).
 *
 * Frozen facts (frozen 20260829 plan docs; invariant numbers refer to
 * Architecture §42):
 *
 * - **Source**: TeamDomain (invariant 41) + an optional live overlay
 *   (DevPlan §21.2). The projection NEVER scans Root+child Session logs
 *   and never carries session-log facts.
 * - **Identity**: `teamSessionId` IS the root DSH session id (invariant
 *   9); the projection binds exactly one immutable blueprint snapshot
 *   (invariant 10, embedded ref).
 * - **Generation**: `generation` is the WHOLE-projection monotonic
 *   generation (DevPlan §21.4): it starts at 1 and only increases; a
 *   client applying an incoming projection MUST reject a stale overwrite
 *   (`isStaleTeamProjection` below is the frozen guard).
 * - **Root**: the identity + admission view (root.ts) — NO lifecycle field
 *   (Architecture §8.6).
 * - **Templates**: exactly ONE leader template (invariant 13) and the
 *   member templates (invariant 17) of the bound snapshot.
 * - **Members**: every MemberInstance plus the LeaderInstance as one
 *   unified row (invariant 14, member.ts); `instanceId` is unique within
 *   the team (invariant 18); each non-leader row references an existing
 *   member template; the leader row references the leader template.
 * - **Ledger**: the summary only (ledger.ts, UI §27).
 *
 * The v1 freeze covers every field of every embedded record; adding a
 * field is a new projection schema version (schema.ts track), never a
 * silent edit of this v1.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/projection
 */
import type { BlueprintSnapshotRef } from '../dto/blueprint-snapshot.js';
import type { TeamSessionId } from '../ids/session-id.js';
import type { ProjectionSchemaVersion, ProjectionSchemaVersionV2 } from './schema.js';
import type { TeamRootProjectionDto, TeamRootProjectionInput } from './root.js';
import type { TemplateProjectionDto, TemplateProjectionInput } from './template.js';
import type { MemberProjectionDto, MemberProjectionInput } from './member.js';
import type { LedgerSummaryDto, LedgerSummaryInput } from './ledger.js';
import type { DisposedMemberHistoryDto, DisposedMemberHistoryInput } from './disposed-history.js';
/** The exact frozen fields of a TeamProjectionDto (v1). */
export declare const TEAM_PROJECTION_FIELDS: readonly string[];
/**
 * The top-level projection fields of schema version 2 (S7-R2, repairs
 * R2-2..R2-6): the v1 set plus the DURATIONAL-optional additive key
 * `disposedHistory` (R2-6, D14 — the retained-history bundle of every
 * DISPOSED member; see disposed-history.ts). A v2 record may carry exactly
 * the v1 key set — every additive key is optional (absent, never
 * own-undefined; the key is ABSENT when the team has no DISPOSED member, so
 * the default projection is byte-identical to the pre-repair shape). The
 * member-level v2 additions live in `MEMBER_PROJECTION_FIELDS_V2`.
 */
export declare const TEAM_PROJECTION_FIELDS_V2: readonly string[];
/**
 * The whole read-only view of one TeamSession (projection contract v1).
 */
export interface TeamProjectionDto {
    /**
     * The projection schema version: v1 carries `1`; the additive S7-R2
     * repairs stamp `2` (R2-2..R2-6; v1 semantics immutable — see schema.ts).
     */
    readonly schemaVersion: ProjectionSchemaVersion | ProjectionSchemaVersionV2;
    /** The TeamSession id — which IS the root DSH session id (invariant 9). */
    readonly teamSessionId: TeamSessionId;
    /** The immutable blueprint snapshot the TeamSession binds (invariant 10). */
    readonly blueprint: BlueprintSnapshotRef;
    /** The whole-projection monotonic generation (>= 1, DevPlan §21.4). */
    readonly generation: number;
    /** When this projection was produced, ISO-8601. */
    readonly generatedAt: string;
    /** The TeamSession identity + admission view (no lifecycle, §8.6). */
    readonly root: TeamRootProjectionDto;
    /** The templates of the bound snapshot: exactly one leader (invariant 13). */
    readonly templates: readonly TemplateProjectionDto[];
    /** Every member plus the LeaderInstance (invariant 14). */
    readonly members: readonly MemberProjectionDto[];
    /** The TeamLedger summary (UI §27). */
    readonly ledger: LedgerSummaryDto;
    /**
     * S7-R2 (R2-6, D14): the retained-history bundle of EVERY DISPOSED member
     * (schema version 2 only — the v1 field set rejects the key). DURATIONAL-
     * optional: ABSENT when the team has no DISPOSED member (the live view
     * (BQ-04) semantics are unchanged); PRESENT (non-empty) exactly when one
     * exists. The bundle's instance ids are exactly the DISPOSED member rows
     * (validated cross-field at parse).
     */
    readonly disposedHistory?: readonly DisposedMemberHistoryDto[];
}
/**
 * Producer input for {@link createTeamProjection}: all fields except
 * `schemaVersion` (stamped by the factory from the optional
 * `input.schemaVersion`, defaulting to v1). Input records must not carry
 * own `undefined` keys (lossless-JSON discipline).
 */
export interface TeamProjectionInput {
    /** The TeamSession id (root DSH session id). */
    teamSessionId: TeamSessionId;
    /** The immutable blueprint snapshot. */
    blueprint: BlueprintSnapshotRef;
    /** The whole-projection generation (>= 1). */
    generation: number;
    /** When this projection is produced, ISO-8601. */
    generatedAt: string;
    /** The root view (or a plain record for it). */
    root: TeamRootProjectionInput;
    /** The template rows (or plain records for them). */
    templates: readonly TemplateProjectionInput[];
    /** The member rows (or plain records for them). */
    members: readonly MemberProjectionInput[];
    /** The ledger summary (or a plain record for it). */
    ledger: LedgerSummaryInput;
    /**
     * S7-R2 (R2-6, D14): the retained-history bundle of every DISPOSED member
     * (stamped only for schema version 2 — a v1 projection never carries the
     * key; ABSENT when there is no DISPOSED member).
     */
    disposedHistory?: readonly DisposedMemberHistoryInput[];
    /**
     * The projection schema version to stamp (S7-R2): `2` for the additive
     * repair fields (R2-2..R2-6); defaults to `1` (v1).
     */
    schemaVersion?: 1 | 2;
}
/**
 * Parse and validate a TeamProjectionDto from an untrusted value. The
 * schema version is read from the record itself: v1 records parse through
 * the v1 field sets, v2 records (S7-R2, R2-2..R2-6) through the additive
 * v2 field sets.
 * @param value - the unknown input (e.g. a value decoded from the wire).
 * @returns the frozen projection.
 * @throws `MALFORMED_DTO`, `SCHEMA_VERSION_MISMATCH`,
 *   `SCHEMA_VERSION_UNSUPPORTED`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_ROOT_SESSION_ID`, or the field/cross-field codes of the
 *   embedded records.
 */
export declare function parseTeamProjection(value: unknown): TeamProjectionDto;
/**
 * Build a fresh TeamProjectionDto from producer input (already branded
 * ids; input records must not carry own `undefined` keys). The result is
 * validated through the same pipeline as `parseTeamProjection`.
 * @param input - the projection fields.
 * @returns the frozen projection stamped with the requested projection
 *   schema version (v1 by default; v2 for the additive S7-R2 repair
 *   fields).
 */
export declare function createTeamProjection(input: TeamProjectionInput): TeamProjectionDto;
/**
 * Serialize a projection to canonical JSON (keys in ascending order;
 * deterministic for deeply-equal values).
 * @param projection - the projection to serialize.
 * @returns the canonical JSON text.
 */
export declare function serializeTeamProjection(projection: TeamProjectionDto): string;
/**
 * Deserialize a canonical JSON projection back into a validated, frozen
 * projection.
 * @param json - the canonical JSON text.
 * @returns the parsed projection.
 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
 *   validation codes a malformed projection triggers.
 */
export declare function deserializeTeamProjection(json: string): TeamProjectionDto;
/**
 * Stale-overwrite guard (DevPlan §21.4): the whole-projection generation is
 * monotonic per team. A client applying an incoming projection must reject
 * it when it would not advance the generation it already holds.
 *
 * @param current - the projection the client already holds.
 * @param incoming - the incoming projection.
 * @returns `true` when `incoming` is stale: same TeamSession AND
 *   `incoming.generation <= current.generation`. A projection of a
 *   different teamSessionId is never comparable and is NOT stale (the
 *   guard is per-team; the client keys projections by teamSessionId).
 */
export declare function isStaleTeamProjection(current: TeamProjectionDto, incoming: TeamProjectionDto): boolean;
//# sourceMappingURL=projection.d.ts.map