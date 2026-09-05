/**
 * MemberInstanceRecordDto — the TeamDomain record of a MemberInstance
 * (Architecture §14.3 category B).
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **Member runtime identity = `(rootSessionId, instanceId)`**
 *   (invariant 18): both components are stored; addressing a member by
 *   label/templateId is the forbidden legacy pattern (invariant 19).
 * - **Every MemberInstance binds exactly one durable child Session**
 *   (invariant 23): `childSessionId` is a required field; the binding is
 *   never re-pointed (invariant 24).
 * - **Lifecycle is `CREATED | RUNNING | SETTLED | ARCHIVED | DISPOSED`**
 *   (Architecture §29; §8.6 confirms these five are the MemberInstance
 *   lifecycle states, and `PROVISIONING_FAILED` is explicitly NOT a
 *   user-visible lifecycle).
 * - **groupId is opaque grouping metadata with no state/permission/
 *   lifecycle/activation semantics** (invariant 20, §12); optional.
 * - **LeaderInstance** (Architecture §9.1/§9.2, invariants 13/14/15): the
 *   Leader is the Root Agent + the Root Session itself. It has NO durable
 *   child Session and NO ordinary member lifecycle, and it cannot be
 *   independently archived or disposed. The v2 record shape (P8-S2,
 *   `LEADER_INSTANCE_RECORD_SCHEMA_VERSION = 2`) encodes that in the
 *   record: `childSessionId` and `lifecycle` are ABSENT keys (rejected on
 *   presence, never defaulted) and `instanceId` must be the reserved
 *   `inst-leader` id. Every v1 record — including legacy harness-style
 *   leader rows that carry both fields — stays parseable (the freeze
 *   rule adds a version, it never rewrites v1).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/dto/member-instance-record
 */
import type { LeaderInstanceRecordSchemaVersion, TeamContractSchemaVersion } from '../schema-version.js';
import type { RootSessionId } from '../ids/session-id.js';
import type { ChildSessionId } from '../ids/session-id.js';
import type { InstanceId } from '../ids/instance-id.js';
import type { TemplateId } from '../ids/template-id.js';
import type { MemberIdentity } from '../identity.js';
/** The five frozen MemberInstance lifecycle states (Architecture §29). */
export declare const MEMBER_LIFECYCLE_STATES: {
    /** Identity, binding, and creation config are durably committed; no work turn yet (§29.1). */
    readonly CREATED: "CREATED";
    /** An active admitted execution/turn exists (§29.2). */
    readonly RUNNING: "RUNNING";
    /** Current admitted work finished; identity/child Session/conversation preserved (§29.3). */
    readonly SETTLED: "SETTLED";
    /** Left the main active work set, durably retained (§29.4). */
    readonly ARCHIVED: "ARCHIVED";
    /** Terminal: durably removed (§29.5). */
    readonly DISPOSED: "DISPOSED";
};
/** The frozen MemberInstance lifecycle state type. */
export type MemberLifecycleState = (typeof MEMBER_LIFECYCLE_STATES)[keyof typeof MEMBER_LIFECYCLE_STATES];
/** Every lifecycle state value, for membership checks. */
export declare const MEMBER_LIFECYCLE_STATE_VALUES: readonly string[];
/**
 * Is `value` one of the five frozen lifecycle states?
 * @param value - the raw value found in a `lifecycle` field.
 * @returns `true` iff it is a frozen lifecycle state.
 */
export declare function isMemberLifecycleState(value: unknown): value is MemberLifecycleState;
/** The exact frozen fields of a MemberInstanceRecordDto (v1). */
export declare const MEMBER_INSTANCE_RECORD_FIELDS: readonly string[];
/**
 * The exact frozen fields of a LeaderInstanceRecordDto (v2): the v1 field
 * set minus `childSessionId` and `lifecycle` (Architecture §9.2 — the
 * Leader is the Root Session; those keys are absent, never optional).
 */
export declare const LEADER_INSTANCE_RECORD_FIELDS: readonly string[];
/**
 * The exact accepted fields of a LeaderInstanceRecordInput (the v2
 * creation input; no schemaVersion — stamped by the factory). Any other
 * key on the input (schemaVersion / childSessionId / lifecycle) is a
 * half-hack and fails closed.
 */
export declare const LEADER_INSTANCE_RECORD_INPUT_FIELDS: readonly string[];
/**
 * The TeamDomain record of one MemberInstance (v1 identity core of
 * Architecture §14.3 B).
 */
export interface MemberInstanceRecordDto {
    /** Schema version stamp; v1 records carry `1`. */
    readonly schemaVersion: TeamContractSchemaVersion;
    /** The TeamSession (root session id) the member belongs to. */
    readonly rootSessionId: RootSessionId;
    /** The member's stable instance id, unique within that TeamSession. */
    readonly instanceId: InstanceId;
    /** Static identity of the template that produced this instance (NOT a runtime identity, invariant 19). */
    readonly templateId: TemplateId;
    /** Human-facing label (NOT a runtime identity, invariant 19). */
    readonly label: string;
    /** Opaque grouping metadata; no state/permission/lifecycle semantics (invariant 20). */
    readonly groupId?: string;
    /** The durable child DSH Session bound to this instance (invariant 23). */
    readonly childSessionId: ChildSessionId;
    /** Effective workspace (optional; absent means inherited, §21.2). */
    readonly workspace?: string;
    /** Frozen lifecycle state (Architecture §29). */
    readonly lifecycle: MemberLifecycleState;
    /** Creation timestamp, ISO-8601. */
    readonly createdAt: string;
    /** Activity/record version counter (starts at 1, monotonically increases). */
    readonly activityVersion: number;
}
/**
 * Producer input for {@link createMemberInstanceRecord}: all identity
 * fields, no schemaVersion (stamped by the factory).
 */
export interface MemberInstanceRecordInput {
    /** The TeamSession (root session id) the member belongs to. */
    rootSessionId: RootSessionId;
    /** The member's stable instance id. */
    instanceId: InstanceId;
    /** The static template identity. */
    templateId: TemplateId;
    /** Human-facing label. */
    label: string;
    /** Opaque grouping metadata (optional). */
    groupId?: string;
    /** The durable child session bound to this instance. */
    childSessionId: ChildSessionId;
    /** Effective workspace (optional). */
    workspace?: string;
    /** Lifecycle state at creation (normally `CREATED`). */
    lifecycle: MemberLifecycleState;
    /** Creation timestamp, ISO-8601. */
    createdAt: string;
    /** Activity version; must be >= 1. */
    activityVersion: number;
}
/**
 * The TeamDomain record of the LeaderInstance (v2; Architecture
 * §9.1/§9.2, invariants 14/15). Same identity core as the member record
 * with `childSessionId` and `lifecycle` ABSENT: the Leader is the Root
 * Agent + the Root Session itself — it binds no child Session and has no
 * ordinary member lifecycle. The absence is enforced by the record shape
 * (validation rejects the presence of those keys; the producer is
 * additionally fail-closed, it never defaults them).
 */
export interface LeaderInstanceRecordDto {
    /** Schema version stamp; v2 leader records carry `2`. */
    readonly schemaVersion: LeaderInstanceRecordSchemaVersion;
    /** The TeamSession (root session id) the leader belongs to. */
    readonly rootSessionId: RootSessionId;
    /** Always the reserved leader instance id `inst-leader` (invariant 13). */
    readonly instanceId: InstanceId;
    /** Static identity of the LeaderTemplate that produced this instance (NOT a runtime identity, invariant 19). */
    readonly templateId: TemplateId;
    /** Human-facing label (NOT a runtime identity, invariant 19). */
    readonly label: string;
    /** Opaque grouping metadata; no state/permission/lifecycle semantics (invariant 20). */
    readonly groupId?: string;
    /** Effective workspace (optional; absent means inherited, §21.2). */
    readonly workspace?: string;
    /** Creation timestamp, ISO-8601. */
    readonly createdAt: string;
    /** Activity/record version counter (starts at 1, monotonically increases). */
    readonly activityVersion: number;
}
/**
 * Producer input for {@link createLeaderInstanceRecord}: all identity
 * fields, no schemaVersion (stamped to 2 by the factory), and NO
 * childSessionId/lifecycle (they do not exist for the Leader, §9.2).
 */
export interface LeaderInstanceRecordInput {
    /** The TeamSession (root session id) the leader belongs to. */
    rootSessionId: RootSessionId;
    /** The reserved leader instance id. */
    instanceId: InstanceId;
    /** The static LeaderTemplate identity. */
    templateId: TemplateId;
    /** Human-facing label. */
    label: string;
    /** Opaque grouping metadata (optional). */
    groupId?: string;
    /** Effective workspace (optional). */
    workspace?: string;
    /** Creation timestamp, ISO-8601. */
    createdAt: string;
    /** Activity version; must be >= 1. */
    activityVersion: number;
}
/**
 * Parse and validate a MemberInstanceRecordDto from an untrusted value.
 *
 * The v2 branch (P8-S2): a row stamped `schemaVersion: 2` is the
 * LeaderInstance record and is validated as a {@link LeaderInstanceRecordDto}.
 * Documented type lie at the return type: the v1 `MemberInstanceRecordDto`
 * stays the declared parse contract because the unowned storage repository
 * and domain consumers assign the result to that type; a v2 row is a
 * `LeaderInstanceRecordDto` whose identity core (`rootSessionId`,
 * `instanceId`) is shared, and whose absent `childSessionId`/`lifecycle`
 * keys stay absent at runtime (no value is ever defaulted).
 *
 * @param value - the unknown input (e.g. a decoded TeamDomain row).
 * @returns the frozen record.
 * @throws `MALFORMED_DTO`, `SCHEMA_VERSION_MISMATCH`,
 *   `SCHEMA_VERSION_UNSUPPORTED`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_ROOT_SESSION_ID`, `INVALID_INSTANCE_ID`,
 *   `INVALID_TEMPLATE_ID`, or `INVALID_CHILD_SESSION_ID`.
 */
export declare function parseMemberInstanceRecord(value: unknown): MemberInstanceRecordDto;
/**
 * Build a fresh LeaderInstanceRecordDto (creation path, v2).
 * @param input - the identity fields; ids must already be branded. The
 *   input must carry exactly the v2 identity fields — any
 *   schemaVersion/childSessionId/lifecycle key fails closed.
 * @returns the frozen record with `schemaVersion` stamped to `2`.
 */
export declare function createLeaderInstanceRecord(input: LeaderInstanceRecordInput): LeaderInstanceRecordDto;
/**
 * Build a fresh MemberInstanceRecordDto (creation path).
 *
 * C2 (P8-S2): the input is the union of the v1 member input and the v2
 * leader input. The shape branch mints the honest v2 leader record when
 * the input is structurally the leader input (see
 * {@link isLeaderInstanceRecordInput}); every other input takes the v1
 * path byte-identical to the frozen v1 factory.
 *
 * Documented type lie at the return type: a v2 mint is a
 * `LeaderInstanceRecordDto`; the v1 `MemberInstanceRecordDto` stays the
 * declared return contract because the unowned storage repository and
 * domain consumers assign the result to that type (the shared identity
 * core makes those assignments safe; the absent v2 keys stay absent).
 *
 * @param input - the identity fields; ids must already be branded.
 * @returns the frozen record (`schemaVersion` stamped `1` for members,
 *   `2` for the leader shape).
 */
export declare function createMemberInstanceRecord(input: MemberInstanceRecordInput | LeaderInstanceRecordInput): MemberInstanceRecordDto;
/**
 * The composite runtime identity carried by a record (invariant 18).
 * @param record - the member record.
 * @returns the frozen `(rootSessionId, instanceId)` identity.
 */
export declare function memberIdentityOf(record: MemberInstanceRecordDto): MemberIdentity;
/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export declare function serializeMemberInstanceRecord(record: MemberInstanceRecordDto): string;
/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
 *   validation codes a malformed record triggers.
 */
export declare function deserializeMemberInstanceRecord(json: string): MemberInstanceRecordDto;
//# sourceMappingURL=member-instance-record.d.ts.map