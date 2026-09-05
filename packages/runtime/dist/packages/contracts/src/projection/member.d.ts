/**
 * MemberProjectionDto — the projection row of one MemberInstance (or the
 * LeaderInstance) of a TeamSession (Architecture §10, §14.3 category B +
 * the §16/§24 live view).
 *
 * Design facts (frozen 20260829 plan docs):
 *
 * - **Unified leader/member shape** (invariant 14): the LeaderInstance is
 *   the only special member, recorded through the same row with the
 *   reserved instance id `inst-leader`. Unlike the TeamDomain record DTO
 *   (where the leader's child-session absence is enforced by the producer),
 *   the PROJECTION shape encodes it: for `instanceId = inst-leader` the
 *   `childSessionId` key MUST be absent; for every other member it is
 *   REQUIRED (invariant 23: every MemberInstance binds exactly one durable
 *   child Session, and the binding is never re-pointed, invariant 24 —
 *   hence the key stays present even for ARCHIVED/DISPOSED rows).
 * - `contextPolicy` is the EFFECTIVE per-instance policy (invariant 29):
 *   the instance-creation value, or the template value when not overridden
 *   — frozen from then on.
 * - `effectiveConfig` is the four-lane effective configuration view with
 *   provenance (effective-config.ts, UI §18.2).
 * - `activity` is the durable activity summary (activity.ts): DURATIONAL-
 *   optional — the KEY is absent when the member has no durable activity
 *   facts (never an own `undefined` key).
 * - `liveActivity` is the nullable LIVE overlay: ALWAYS the present key,
 *   value `null` when the live source has no facts for the member (the
 *   nullable overlay of DevPlan §21.2 — the durable bytes of the projection
 *   do not change when the overlay appears or disappears).
 * - NO session-log facts: the row is built from TeamDomain (invariant 41)
 *   + the optional live overlay; it never scans Root+child Session logs
 *   (DevPlan §21.2).
 *
 * The member row is an embedded value: the enclosing versioned record owns
 * the schema version, so the row carries none of its own.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/member
 */
import type { ChildSessionId } from '../ids/session-id.js';
import type { InstanceId } from '../ids/instance-id.js';
import type { TemplateId } from '../ids/template-id.js';
import type { EffectiveConfigDtoV2 } from './effective-config.js';
import type { MemberModelStateDto } from './model-state.js';
import type { EffectiveConfigDto } from './effective-config.js';
import type { MemberActivitySummaryDto, MemberLiveActivityDto } from './activity.js';
import type { ContextPolicy } from './states.js';
import type { MemberLifecycleState } from '../dto/member-instance-record.js';
/** The exact frozen fields of a MemberProjectionDto. */
export declare const MEMBER_PROJECTION_FIELDS: readonly string[];
/**
 * The exact frozen fields of a MemberProjectionDto under projection v2
 * (S7-R2). v2 is ADDITIVE: the v1 set plus the optional v2 member fields
 * (repair R2-3 adds `modelState`; every addition is DURATIONAL-optional).
 * v1 rows remain valid through the v1 field set above.
 */
export declare const MEMBER_PROJECTION_FIELDS_V2: readonly string[];
/**
 * The projection row of one MemberInstance or the LeaderInstance (v1).
 */
export interface MemberProjectionDto {
    /** The stable instance id (runtime identity with the team id, invariant 18). */
    readonly instanceId: InstanceId;
    /** The static template identity (NOT a runtime identity, invariant 19). */
    readonly templateId: TemplateId;
    /** Human-facing label (NOT a runtime identity, invariant 19). */
    readonly label: string;
    /** Opaque grouping metadata (invariant 20); key absent when not set. */
    readonly groupId?: string;
    /**
     * The durable child session bound to this instance (invariant 23).
     * Required for every member; key ABSENT for the leader (invariant 14).
     */
    readonly childSessionId?: ChildSessionId;
    /** The effective workspace (locked after first run). */
    readonly workspace: string;
    /** Instance creation timestamp, ISO-8601. */
    readonly createdAt: string;
    /** The frozen lifecycle state (Architecture §29). */
    readonly lifecycle: MemberLifecycleState;
    /** The effective per-instance context policy (invariant 29). */
    readonly contextPolicy: ContextPolicy;
    /**
     * The four-lane effective configuration view with provenance. Under
     * projection v2 (S7-R2 R2-2) the entries are `EffectiveConfigEntryV2`
     * (same v1 core fields plus additive optional provenance keys); the v1
     * type here is the documented type lie — v1-typed reads of `value` /
     * `source` / `state` remain structurally sound for v2 rows.
     */
    readonly effectiveConfig: EffectiveConfigDto;
    /** The durable activity summary; key absent when no durable facts exist. */
    readonly activity?: MemberActivitySummaryDto;
    /**
     * The BQ-11 model state view (projection v2, S7-R2 repair R2-3).
     * DURATIONAL-optional: the key is ABSENT when the view cannot be derived
     * (v1 rows never carry it; the v1 field set rejects the key).
     */
    readonly modelState?: MemberModelStateDto;
    /** The nullable live overlay: always present, `null` when no live facts. */
    readonly liveActivity: MemberLiveActivityDto | null;
}
/**
 * Producer input for {@link createMemberProjection}: all identity and view
 * fields, no schemaVersion (the enclosing record stamps it). `liveActivity`
 * is explicit and nullable: the producer decides null vs present overlay.
 */
export interface MemberProjectionInput {
    /** The member's stable instance id. */
    instanceId: InstanceId;
    /** The static template identity. */
    templateId: TemplateId;
    /** Human-facing label. */
    label: string;
    /** Opaque grouping metadata (optional). */
    groupId?: string;
    /** The durable child session (required for members, absent for the leader). */
    childSessionId?: ChildSessionId;
    /** The effective workspace. */
    workspace: string;
    /** Creation timestamp, ISO-8601. */
    createdAt: string;
    /** The lifecycle state. */
    lifecycle: MemberLifecycleState;
    /** The effective per-instance context policy. */
    contextPolicy: ContextPolicy;
    /**
     * The four-lane effective configuration view (or a plain record for it).
     * v2 entries (S7-R2 R2-2) are accepted by `createTeamProjection`, which
     * stamps the enclosing version; `createMemberProjection` stays
     * v1-stamped and rejects additive v2 entry fields by design.
     */
    effectiveConfig: EffectiveConfigDto | EffectiveConfigDtoV2;
    /** The durable activity summary (optional; key absent when undefined). */
    activity?: MemberActivitySummaryDto;
    /**
     * The BQ-11 model state view (projection v2, S7-R2 repair R2-3).
     * DURATIONAL-optional: the key is ABSENT when the view cannot be derived
     * (v1 rows never carry it; the v1 field set rejects the key).
     */
    modelState?: MemberModelStateDto;
    /** The live overlay, or `null` when the live source has no facts. */
    liveActivity: MemberLiveActivityDto | null;
}
/**
 * Parse and validate a MemberProjectionDto from an untrusted value.
 * @param value - the unknown input.
 * @param schemaVersion - the enclosing projection schema version: `2`
 *   admits the additive v2 field set and parses the effective-config
 *   entries as v2; defaults to `1` (v1, byte-identical behavior).
 * @returns the frozen member row.
 * @throws `MALFORMED_DTO`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_INSTANCE_ID`, `INVALID_TEMPLATE_ID`,
 *   `INVALID_CHILD_SESSION_ID`, or the field-specific codes.
 */
export declare function parseMemberProjection(value: unknown, schemaVersion?: 1 | 2): MemberProjectionDto;
/**
 * Build a fresh MemberProjectionDto from producer input (already branded
 * ids; the input must not carry own `undefined` keys except the documented
 * optionals, which are omitted when `undefined`).
 * @param input - the member fields.
 * @returns the frozen member row, validated through the same pipeline as
 *   `parseMemberProjection`. Always v1-stamped; v2 member rows are
 *   produced through `createTeamProjection` (S7-R2).
 */
export declare function createMemberProjection(input: MemberProjectionInput): MemberProjectionDto;
//# sourceMappingURL=member.d.ts.map