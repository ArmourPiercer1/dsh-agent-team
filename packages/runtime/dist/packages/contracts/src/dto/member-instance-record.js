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
import { LEADER_INSTANCE_RECORD_SCHEMA_VERSION, TEAM_CONTRACT_SCHEMA_VERSION, assertSchemaVersion, } from '../schema-version.js';
import { parseRootSessionId } from '../ids/session-id.js';
import { parseChildSessionId } from '../ids/session-id.js';
import { parseInstanceId } from '../ids/instance-id.js';
import { parseTemplateId } from '../ids/template-id.js';
import { createMemberIdentity, LEADER_INSTANCE_ID } from '../identity.js';
import { GROUP_ID_MAX_LENGTH, LABEL_MAX_LENGTH, assertFieldPresent, assertNoUnknownFields, assertPlainRecord, parseIso8601TimestampField, parseLabelLikeField, parseWorkspaceField, } from './common.js';
import { assertNoLegacyFields } from '../legacy-vocabulary.js';
import { assertPositiveInteger } from '../ids/common.js';
import { teamContractError } from '../errors.js';
import { canonicalJsonStringify, deepFreeze } from '../remote-safe.js';
/** The five frozen MemberInstance lifecycle states (Architecture §29). */
export const MEMBER_LIFECYCLE_STATES = {
    /** Identity, binding, and creation config are durably committed; no work turn yet (§29.1). */
    CREATED: 'CREATED',
    /** An active admitted execution/turn exists (§29.2). */
    RUNNING: 'RUNNING',
    /** Current admitted work finished; identity/child Session/conversation preserved (§29.3). */
    SETTLED: 'SETTLED',
    /** Left the main active work set, durably retained (§29.4). */
    ARCHIVED: 'ARCHIVED',
    /** Terminal: durably removed (§29.5). */
    DISPOSED: 'DISPOSED',
};
/** Every lifecycle state value, for membership checks. */
export const MEMBER_LIFECYCLE_STATE_VALUES = Object.values(MEMBER_LIFECYCLE_STATES);
/**
 * Is `value` one of the five frozen lifecycle states?
 * @param value - the raw value found in a `lifecycle` field.
 * @returns `true` iff it is a frozen lifecycle state.
 */
export function isMemberLifecycleState(value) {
    return typeof value === 'string' && MEMBER_LIFECYCLE_STATE_VALUES.includes(value);
}
/** The exact frozen fields of a MemberInstanceRecordDto (v1). */
export const MEMBER_INSTANCE_RECORD_FIELDS = [
    'schemaVersion',
    'rootSessionId',
    'instanceId',
    'templateId',
    'label',
    'groupId',
    'childSessionId',
    'workspace',
    'lifecycle',
    'createdAt',
    'activityVersion',
];
/**
 * The exact frozen fields of a LeaderInstanceRecordDto (v2): the v1 field
 * set minus `childSessionId` and `lifecycle` (Architecture §9.2 — the
 * Leader is the Root Session; those keys are absent, never optional).
 */
export const LEADER_INSTANCE_RECORD_FIELDS = [
    'schemaVersion',
    'rootSessionId',
    'instanceId',
    'templateId',
    'label',
    'groupId',
    'workspace',
    'createdAt',
    'activityVersion',
];
/**
 * The exact accepted fields of a LeaderInstanceRecordInput (the v2
 * creation input; no schemaVersion — stamped by the factory). Any other
 * key on the input (schemaVersion / childSessionId / lifecycle) is a
 * half-hack and fails closed.
 */
export const LEADER_INSTANCE_RECORD_INPUT_FIELDS = [
    'rootSessionId',
    'instanceId',
    'templateId',
    'label',
    'groupId',
    'workspace',
    'createdAt',
    'activityVersion',
];
function validateMemberInstanceRecord(record) {
    assertNoLegacyFields(record, 'MemberInstanceRecord');
    assertNoUnknownFields(record, MEMBER_INSTANCE_RECORD_FIELDS, 'MemberInstanceRecord');
    for (const field of MEMBER_INSTANCE_RECORD_FIELDS) {
        if (field !== 'groupId' && field !== 'workspace') {
            assertFieldPresent(record, field, 'MemberInstanceRecord');
        }
    }
    assertSchemaVersion(record['schemaVersion']);
    const base = {
        schemaVersion: record['schemaVersion'],
        rootSessionId: parseRootSessionId(record['rootSessionId']),
        instanceId: parseInstanceId(record['instanceId']),
        templateId: parseTemplateId(record['templateId']),
        label: parseLabelLikeField(record['label'], 'label', LABEL_MAX_LENGTH),
        childSessionId: parseChildSessionId(record['childSessionId']),
        lifecycle: (() => {
            const raw = record['lifecycle'];
            if (!isMemberLifecycleState(raw)) {
                throw teamContractError('MALFORMED_DTO', `lifecycle must be one of ${MEMBER_LIFECYCLE_STATE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`, { field: 'lifecycle' });
            }
            return raw;
        })(),
        createdAt: parseIso8601TimestampField(record['createdAt']),
        activityVersion: assertPositiveInteger(record['activityVersion'], 'activityVersion'),
    };
    // Absent optional fields must not become own `undefined` keys: the frozen
    // record is a lossless-JSON value (remote-safe.ts rejects undefined).
    const group = record['groupId'] === undefined
        ? {}
        : { groupId: parseLabelLikeField(record['groupId'], 'groupId', GROUP_ID_MAX_LENGTH) };
    const workspace = record['workspace'] === undefined
        ? {}
        : { workspace: parseWorkspaceField(record['workspace'], 'workspace') };
    return deepFreeze({ ...base, ...group, ...workspace });
}
function validateLeaderInstanceRecord(record) {
    // The v2 forbidden keys are checked BEFORE the unknown-field gate so
    // the rejection carries the specific §9.2 reason (mirroring the frozen
    // P8-T1 projection rule LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION).
    if (record['childSessionId'] !== undefined) {
        throw teamContractError('MALFORMED_DTO', 'the LeaderInstance record must not carry a childSessionId (Architecture §9.2: the Leader is the Root Session itself)', { field: 'childSessionId', reason: 'LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION' });
    }
    if (record['lifecycle'] !== undefined) {
        throw teamContractError('MALFORMED_DTO', 'the LeaderInstance record must not carry a member lifecycle (Architecture §9.2 / invariant 15: the Leader has no ordinary member lifecycle)', { field: 'lifecycle', reason: 'LEADER_INSTANCE_MUST_NOT_CARRY_LIFECYCLE' });
    }
    assertNoLegacyFields(record, 'LeaderInstanceRecord');
    assertNoUnknownFields(record, LEADER_INSTANCE_RECORD_FIELDS, 'LeaderInstanceRecord');
    for (const field of LEADER_INSTANCE_RECORD_FIELDS) {
        if (field !== 'groupId' && field !== 'workspace') {
            assertFieldPresent(record, field, 'LeaderInstanceRecord');
        }
    }
    assertSchemaVersion(record['schemaVersion'], LEADER_INSTANCE_RECORD_SCHEMA_VERSION);
    const instanceId = parseInstanceId(record['instanceId']);
    if (instanceId !== LEADER_INSTANCE_ID) {
        throw teamContractError('MALFORMED_DTO', `a schemaVersion-2 member record is the LeaderInstance record and must carry the reserved leader id (got ${String(instanceId)})`, { field: 'instanceId' });
    }
    const base = {
        schemaVersion: record['schemaVersion'],
        rootSessionId: parseRootSessionId(record['rootSessionId']),
        instanceId,
        templateId: parseTemplateId(record['templateId']),
        label: parseLabelLikeField(record['label'], 'label', LABEL_MAX_LENGTH),
        createdAt: parseIso8601TimestampField(record['createdAt']),
        activityVersion: assertPositiveInteger(record['activityVersion'], 'activityVersion'),
    };
    const group = record['groupId'] === undefined
        ? {}
        : { groupId: parseLabelLikeField(record['groupId'], 'groupId', GROUP_ID_MAX_LENGTH) };
    const workspace = record['workspace'] === undefined
        ? {}
        : { workspace: parseWorkspaceField(record['workspace'], 'workspace') };
    return deepFreeze({ ...base, ...group, ...workspace });
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
export function parseMemberInstanceRecord(value) {
    const record = assertPlainRecord(value, 'MemberInstanceRecord');
    // Version routing: a numeric (or numeric-string) stamp of 2 targets the
    // v2 leader validator, so a corrupt stamp such as the string '2' surfaces
    // as SCHEMA_VERSION_UNSUPPORTED from the v2 validator — exactly the way a
    // string-form '1' stamp does on the v1 path. Every other value (1, 3,
    // anything else) takes the v1 path, whose expected version is 1.
    const stamp = record['schemaVersion'];
    const targetsV2 = (typeof stamp === 'number' || typeof stamp === 'string') &&
        Number(stamp) === LEADER_INSTANCE_RECORD_SCHEMA_VERSION;
    if (targetsV2) {
        // Documented type lie (see the function JSDoc): the v2 row is a
        // LeaderInstanceRecordDto; the declared v1 return keeps the unowned
        // storage/domain assignment surface compiling.
        return validateLeaderInstanceRecord(record);
    }
    return validateMemberInstanceRecord(record);
}
/**
 * Shape guard for the union factory input (C2): the honest leader input
 * is the one that (a) carries the reserved leader id and (b) carries NEITHER
 * `childSessionId` NOR `lifecycle` as own defined values. A half-hack
 * (the leader id with exactly one of the two fields, as in the legacy
 * harness seeding pattern) fails this guard and falls to the v1 path,
 * where the missing/extra field is rejected fail-closed — the factory
 * never defaults a value.
 */
function isLeaderInstanceRecordInput(input) {
    const candidate = input;
    return (candidate['instanceId'] === LEADER_INSTANCE_ID &&
        candidate['childSessionId'] === undefined &&
        candidate['lifecycle'] === undefined);
}
/**
 * Build a fresh LeaderInstanceRecordDto (creation path, v2).
 * @param input - the identity fields; ids must already be branded. The
 *   input must carry exactly the v2 identity fields — any
 *   schemaVersion/childSessionId/lifecycle key fails closed.
 * @returns the frozen record with `schemaVersion` stamped to `2`.
 */
export function createLeaderInstanceRecord(input) {
    assertNoUnknownFields(input, LEADER_INSTANCE_RECORD_INPUT_FIELDS, 'LeaderInstanceRecordInput');
    const record = {
        schemaVersion: LEADER_INSTANCE_RECORD_SCHEMA_VERSION,
        rootSessionId: input.rootSessionId,
        instanceId: input.instanceId,
        templateId: input.templateId,
        label: input.label,
        createdAt: input.createdAt,
        activityVersion: input.activityVersion,
    };
    if (input.groupId !== undefined)
        record['groupId'] = input.groupId;
    if (input.workspace !== undefined)
        record['workspace'] = input.workspace;
    return validateLeaderInstanceRecord(record);
}
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
export function createMemberInstanceRecord(input) {
    if (isLeaderInstanceRecordInput(input)) {
        // Documented type lie (see the function JSDoc): the honest v2 mint is
        // a LeaderInstanceRecordDto; the declared v1 return keeps the unowned
        // storage/domain assignment surface compiling.
        return createLeaderInstanceRecord(input);
    }
    const memberInput = input;
    const record = {
        schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
        rootSessionId: memberInput.rootSessionId,
        instanceId: memberInput.instanceId,
        templateId: memberInput.templateId,
        label: memberInput.label,
        childSessionId: memberInput.childSessionId,
        lifecycle: memberInput.lifecycle,
        createdAt: memberInput.createdAt,
        activityVersion: memberInput.activityVersion,
    };
    if (memberInput.groupId !== undefined)
        record['groupId'] = memberInput.groupId;
    if (memberInput.workspace !== undefined)
        record['workspace'] = memberInput.workspace;
    return validateMemberInstanceRecord(record);
}
/**
 * The composite runtime identity carried by a record (invariant 18).
 * @param record - the member record.
 * @returns the frozen `(rootSessionId, instanceId)` identity.
 */
export function memberIdentityOf(record) {
    return createMemberIdentity(record.rootSessionId, record.instanceId);
}
/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export function serializeMemberInstanceRecord(record) {
    return canonicalJsonStringify(record);
}
/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
 *   validation codes a malformed record triggers.
 */
export function deserializeMemberInstanceRecord(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch (error) {
        throw teamContractError('MALFORMED_DTO', `MemberInstanceRecord JSON is not valid: ${error instanceof Error ? error.message : String(error)}`, {});
    }
    return parseMemberInstanceRecord(value);
}
//# sourceMappingURL=member-instance-record.js.map