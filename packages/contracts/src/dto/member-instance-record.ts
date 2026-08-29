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
 * - **LeaderInstance** is recorded through the same unified model with the
 *   reserved instance id `inst-leader` and no childSessionId (§9.2); the
 *   leader's row is owned by the runtime that knows it, and this DTO shape
 *   is the member shape (the leader's absence of a child session is
 *   enforced by the producer, not by the record shape).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/dto/member-instance-record
 */

import { TEAM_CONTRACT_SCHEMA_VERSION, assertSchemaVersion } from '../schema-version.js'
import type { TeamContractSchemaVersion } from '../schema-version.js'
import { parseRootSessionId } from '../ids/session-id.js'
import type { RootSessionId } from '../ids/session-id.js'
import { parseChildSessionId } from '../ids/session-id.js'
import type { ChildSessionId } from '../ids/session-id.js'
import { parseInstanceId } from '../ids/instance-id.js'
import type { InstanceId } from '../ids/instance-id.js'
import { parseTemplateId } from '../ids/template-id.js'
import type { TemplateId } from '../ids/template-id.js'
import { createMemberIdentity } from '../identity.js'
import type { MemberIdentity } from '../identity.js'
import {
  GROUP_ID_MAX_LENGTH,
  LABEL_MAX_LENGTH,
  assertFieldPresent,
  assertNoUnknownFields,
  assertPlainRecord,
  parseIso8601TimestampField,
  parseLabelLikeField,
  parseWorkspaceField,
} from './common.js'
import { assertNoLegacyFields } from '../legacy-vocabulary.js'
import { assertPositiveInteger } from '../ids/common.js'
import { teamContractError } from '../errors.js'
import { canonicalJsonStringify, deepFreeze } from '../remote-safe.js'
import type { RemoteSafeRecord } from '../remote-safe.js'

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
} as const

/** The frozen MemberInstance lifecycle state type. */
export type MemberLifecycleState =
  (typeof MEMBER_LIFECYCLE_STATES)[keyof typeof MEMBER_LIFECYCLE_STATES]

/** Every lifecycle state value, for membership checks. */
export const MEMBER_LIFECYCLE_STATE_VALUES: readonly string[] = Object.values(
  MEMBER_LIFECYCLE_STATES,
)

/**
 * Is `value` one of the five frozen lifecycle states?
 * @param value - the raw value found in a `lifecycle` field.
 * @returns `true` iff it is a frozen lifecycle state.
 */
export function isMemberLifecycleState(value: unknown): value is MemberLifecycleState {
  return typeof value === 'string' && MEMBER_LIFECYCLE_STATE_VALUES.includes(value)
}

/** The exact frozen fields of a MemberInstanceRecordDto (v1). */
export const MEMBER_INSTANCE_RECORD_FIELDS: readonly string[] = [
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
]

/**
 * The TeamDomain record of one MemberInstance (v1 identity core of
 * Architecture §14.3 B).
 */
export interface MemberInstanceRecordDto {
  /** Schema version stamp; v1 records carry `1`. */
  readonly schemaVersion: TeamContractSchemaVersion
  /** The TeamSession (root session id) the member belongs to. */
  readonly rootSessionId: RootSessionId
  /** The member's stable instance id, unique within that TeamSession. */
  readonly instanceId: InstanceId
  /** Static identity of the template that produced this instance (NOT a runtime identity, invariant 19). */
  readonly templateId: TemplateId
  /** Human-facing label (NOT a runtime identity, invariant 19). */
  readonly label: string
  /** Opaque grouping metadata; no state/permission/lifecycle semantics (invariant 20). */
  readonly groupId?: string
  /** The durable child DSH Session bound to this instance (invariant 23). */
  readonly childSessionId: ChildSessionId
  /** Effective workspace (optional; absent means inherited, §21.2). */
  readonly workspace?: string
  /** Frozen lifecycle state (Architecture §29). */
  readonly lifecycle: MemberLifecycleState
  /** Creation timestamp, ISO-8601. */
  readonly createdAt: string
  /** Activity/record version counter (starts at 1, monotonically increases). */
  readonly activityVersion: number
}

/**
 * Producer input for {@link createMemberInstanceRecord}: all identity
 * fields, no schemaVersion (stamped by the factory).
 */
export interface MemberInstanceRecordInput {
  /** The TeamSession (root session id) the member belongs to. */
  rootSessionId: RootSessionId
  /** The member's stable instance id. */
  instanceId: InstanceId
  /** The static template identity. */
  templateId: TemplateId
  /** Human-facing label. */
  label: string
  /** Opaque grouping metadata (optional). */
  groupId?: string
  /** The durable child session bound to this instance. */
  childSessionId: ChildSessionId
  /** Effective workspace (optional). */
  workspace?: string
  /** Lifecycle state at creation (normally `CREATED`). */
  lifecycle: MemberLifecycleState
  /** Creation timestamp, ISO-8601. */
  createdAt: string
  /** Activity version; must be >= 1. */
  activityVersion: number
}

function validateMemberInstanceRecord(record: RemoteSafeRecord): MemberInstanceRecordDto {
  assertNoLegacyFields(record, 'MemberInstanceRecord')
  assertNoUnknownFields(record, MEMBER_INSTANCE_RECORD_FIELDS, 'MemberInstanceRecord')
  for (const field of MEMBER_INSTANCE_RECORD_FIELDS) {
    if (field !== 'groupId' && field !== 'workspace') {
      assertFieldPresent(record, field, 'MemberInstanceRecord')
    }
  }
  assertSchemaVersion(record['schemaVersion'])
  const base = {
    schemaVersion: record['schemaVersion'] as TeamContractSchemaVersion,
    rootSessionId: parseRootSessionId(record['rootSessionId']),
    instanceId: parseInstanceId(record['instanceId']),
    templateId: parseTemplateId(record['templateId']),
    label: parseLabelLikeField(record['label'], 'label', LABEL_MAX_LENGTH),
    childSessionId: parseChildSessionId(record['childSessionId']),
    lifecycle: (() => {
      const raw = record['lifecycle']
      if (!isMemberLifecycleState(raw)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `lifecycle must be one of ${MEMBER_LIFECYCLE_STATE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`,
          { field: 'lifecycle' },
        )
      }
      return raw
    })(),
    createdAt: parseIso8601TimestampField(record['createdAt']),
    activityVersion: assertPositiveInteger(record['activityVersion'], 'activityVersion'),
  }
  // Absent optional fields must not become own `undefined` keys: the frozen
  // record is a lossless-JSON value (remote-safe.ts rejects undefined).
  const group =
    record['groupId'] === undefined
      ? {}
      : { groupId: parseLabelLikeField(record['groupId'], 'groupId', GROUP_ID_MAX_LENGTH) }
  const workspace =
    record['workspace'] === undefined
      ? {}
      : { workspace: parseWorkspaceField(record['workspace'], 'workspace') }
  return deepFreeze({ ...base, ...group, ...workspace })
}

/**
 * Parse and validate a MemberInstanceRecordDto from an untrusted value.
 * @param value - the unknown input (e.g. a decoded TeamDomain row).
 * @returns the frozen record.
 * @throws `MALFORMED_DTO`, `SCHEMA_VERSION_MISMATCH`,
 *   `SCHEMA_VERSION_UNSUPPORTED`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_ROOT_SESSION_ID`, `INVALID_INSTANCE_ID`,
 *   `INVALID_TEMPLATE_ID`, or `INVALID_CHILD_SESSION_ID`.
 */
export function parseMemberInstanceRecord(value: unknown): MemberInstanceRecordDto {
  return validateMemberInstanceRecord(assertPlainRecord(value, 'MemberInstanceRecord'))
}

/**
 * Build a fresh MemberInstanceRecordDto (creation path).
 * @param input - the identity fields; ids must already be branded.
 * @returns the frozen record with `schemaVersion` stamped to the v1 version.
 */
export function createMemberInstanceRecord(input: MemberInstanceRecordInput): MemberInstanceRecordDto {
  const record: RemoteSafeRecord = {
    schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
    rootSessionId: input.rootSessionId,
    instanceId: input.instanceId,
    templateId: input.templateId,
    label: input.label,
    childSessionId: input.childSessionId,
    lifecycle: input.lifecycle,
    createdAt: input.createdAt,
    activityVersion: input.activityVersion,
  }
  if (input.groupId !== undefined) record['groupId'] = input.groupId
  if (input.workspace !== undefined) record['workspace'] = input.workspace
  return validateMemberInstanceRecord(record)
}

/**
 * The composite runtime identity carried by a record (invariant 18).
 * @param record - the member record.
 * @returns the frozen `(rootSessionId, instanceId)` identity.
 */
export function memberIdentityOf(record: MemberInstanceRecordDto): MemberIdentity {
  return createMemberIdentity(record.rootSessionId, record.instanceId)
}

/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export function serializeMemberInstanceRecord(record: MemberInstanceRecordDto): string {
  return canonicalJsonStringify(record)
}

/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
 *   validation codes a malformed record triggers.
 */
export function deserializeMemberInstanceRecord(json: string): MemberInstanceRecordDto {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch (error) {
    throw teamContractError(
      'MALFORMED_DTO',
      `MemberInstanceRecord JSON is not valid: ${error instanceof Error ? error.message : String(error)}`,
      {},
    )
  }
  return parseMemberInstanceRecord(value)
}
