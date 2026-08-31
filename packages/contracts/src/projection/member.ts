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

import {
  GROUP_ID_MAX_LENGTH,
  LABEL_MAX_LENGTH,
  assertFieldPresent,
  assertNoUnknownFields,
  assertPlainRecord,
  parseIso8601TimestampField,
  parseLabelLikeField,
  parseWorkspaceField,
} from '../dto/common.js'
import { parseChildSessionId } from '../ids/session-id.js'
import type { ChildSessionId } from '../ids/session-id.js'
import { parseInstanceId } from '../ids/instance-id.js'
import type { InstanceId } from '../ids/instance-id.js'
import { parseTemplateId } from '../ids/template-id.js'
import type { TemplateId } from '../ids/template-id.js'
import { LEADER_INSTANCE_ID } from '../identity.js'
import { assertNoLegacyFields } from '../legacy-vocabulary.js'
import { teamContractError } from '../errors.js'
import { deepFreeze } from '../remote-safe.js'
import type { RemoteSafeRecord } from '../remote-safe.js'
import { toRecord } from './common.js'
import { parseEffectiveConfigDto } from './effective-config.js'
import type { EffectiveConfigDto } from './effective-config.js'
import {
  parseMemberActivitySummary,
  parseMemberLiveActivity,
} from './activity.js'
import type { MemberActivitySummaryDto, MemberLiveActivityDto } from './activity.js'
import { parseContextPolicyField } from './states.js'
import type { ContextPolicy } from './states.js'
import { isMemberLifecycleState, MEMBER_LIFECYCLE_STATE_VALUES } from '../dto/member-instance-record.js'
import type { MemberLifecycleState } from '../dto/member-instance-record.js'

/** The exact frozen fields of a MemberProjectionDto. */
export const MEMBER_PROJECTION_FIELDS: readonly string[] = [
  'instanceId',
  'templateId',
  'label',
  'groupId',
  'childSessionId',
  'workspace',
  'createdAt',
  'lifecycle',
  'contextPolicy',
  'effectiveConfig',
  'activity',
  'liveActivity',
]

/**
 * The projection row of one MemberInstance or the LeaderInstance (v1).
 */
export interface MemberProjectionDto {
  /** The stable instance id (runtime identity with the team id, invariant 18). */
  readonly instanceId: InstanceId
  /** The static template identity (NOT a runtime identity, invariant 19). */
  readonly templateId: TemplateId
  /** Human-facing label (NOT a runtime identity, invariant 19). */
  readonly label: string
  /** Opaque grouping metadata (invariant 20); key absent when not set. */
  readonly groupId?: string
  /**
   * The durable child session bound to this instance (invariant 23).
   * Required for every member; key ABSENT for the leader (invariant 14).
   */
  readonly childSessionId?: ChildSessionId
  /** The effective workspace (locked after first run). */
  readonly workspace: string
  /** Instance creation timestamp, ISO-8601. */
  readonly createdAt: string
  /** The frozen lifecycle state (Architecture §29). */
  readonly lifecycle: MemberLifecycleState
  /** The effective per-instance context policy (invariant 29). */
  readonly contextPolicy: ContextPolicy
  /** The four-lane effective configuration view with provenance. */
  readonly effectiveConfig: EffectiveConfigDto
  /** The durable activity summary; key absent when no durable facts exist. */
  readonly activity?: MemberActivitySummaryDto
  /** The nullable live overlay: always present, `null` when no live facts. */
  readonly liveActivity: MemberLiveActivityDto | null
}

/**
 * Producer input for {@link createMemberProjection}: all identity and view
 * fields, no schemaVersion (the enclosing record stamps it). `liveActivity`
 * is explicit and nullable: the producer decides null vs present overlay.
 */
export interface MemberProjectionInput {
  /** The member's stable instance id. */
  instanceId: InstanceId
  /** The static template identity. */
  templateId: TemplateId
  /** Human-facing label. */
  label: string
  /** Opaque grouping metadata (optional). */
  groupId?: string
  /** The durable child session (required for members, absent for the leader). */
  childSessionId?: ChildSessionId
  /** The effective workspace. */
  workspace: string
  /** Creation timestamp, ISO-8601. */
  createdAt: string
  /** The lifecycle state. */
  lifecycle: MemberLifecycleState
  /** The effective per-instance context policy. */
  contextPolicy: ContextPolicy
  /** The four-lane effective configuration view (or a plain record for it). */
  effectiveConfig: EffectiveConfigDto
  /** The durable activity summary (optional; key absent when undefined). */
  activity?: MemberActivitySummaryDto
  /** The live overlay, or `null` when the live source has no facts. */
  liveActivity: MemberLiveActivityDto | null
}

function validateMemberProjection(record: RemoteSafeRecord): MemberProjectionDto {
  assertNoLegacyFields(record, 'MemberProjection')
  assertNoUnknownFields(record, MEMBER_PROJECTION_FIELDS, 'MemberProjection')
  for (const field of MEMBER_PROJECTION_FIELDS) {
    if (field !== 'groupId' && field !== 'childSessionId' && field !== 'activity') {
      assertFieldPresent(record, field, 'MemberProjection')
    }
  }
  const instanceId = parseInstanceId(record['instanceId'])
  const isLeader = instanceId === LEADER_INSTANCE_ID
  // The projection shape encodes invariant 14 directly: the leader row has
  // NO childSessionId key; every other member row requires it (invariant
  // 23) — for all lifecycle states, including ARCHIVED and DISPOSED.
  const childSessionId = (() => {
    if (isLeader) {
      if (record['childSessionId'] !== undefined) {
        throw teamContractError(
          'MALFORMED_DTO',
          'the LeaderInstance (inst-leader) must not carry a childSessionId (invariant 14)',
          { reason: 'LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION' },
        )
      }
      return undefined
    }
    assertFieldPresent(record, 'childSessionId', 'MemberProjection')
    return parseChildSessionId(record['childSessionId'])
  })()
  const workspace = (() => {
    const parsed = parseWorkspaceField(record['workspace'], 'workspace')
    if (parsed === undefined) {
      throw teamContractError(
        'MALFORMED_DTO',
        "MemberProjection is missing required field 'workspace'",
        { field: 'workspace' },
      )
    }
    return parsed
  })()
  const base = {
    instanceId,
    templateId: parseTemplateId(record['templateId']),
    label: parseLabelLikeField(record['label'], 'label', LABEL_MAX_LENGTH),
    workspace,
    createdAt: parseIso8601TimestampField(record['createdAt']),
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
    contextPolicy: parseContextPolicyField(record['contextPolicy'], 'contextPolicy'),
    effectiveConfig: parseEffectiveConfigDto(record['effectiveConfig']),
    liveActivity:
      record['liveActivity'] === null
        ? null
        : parseMemberLiveActivity(record['liveActivity']),
  }
  const groupId =
    record['groupId'] === undefined
      ? {}
      : { groupId: parseLabelLikeField(record['groupId'], 'groupId', GROUP_ID_MAX_LENGTH) }
  const child =
    childSessionId === undefined ? {} : { childSessionId }
  const activity =
    record['activity'] === undefined
      ? {}
      : { activity: parseMemberActivitySummary(record['activity']) }
  return deepFreeze({ ...base, ...groupId, ...child, ...activity })
}

/**
 * Parse and validate a MemberProjectionDto from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen member row.
 * @throws `MALFORMED_DTO`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_INSTANCE_ID`, `INVALID_TEMPLATE_ID`,
 *   `INVALID_CHILD_SESSION_ID`, or the field-specific codes.
 */
export function parseMemberProjection(value: unknown): MemberProjectionDto {
  return validateMemberProjection(assertPlainRecord(value, 'MemberProjection'))
}

/**
 * Build a fresh MemberProjectionDto from producer input (already branded
 * ids; the input must not carry own `undefined` keys except the documented
 * optionals, which are omitted when `undefined`).
 * @param input - the member fields.
 * @returns the frozen member row, validated through the same pipeline as
 *   `parseMemberProjection`.
 */
export function createMemberProjection(input: MemberProjectionInput): MemberProjectionDto {
  const record: RemoteSafeRecord = {
    instanceId: input.instanceId,
    templateId: input.templateId,
    label: input.label,
    workspace: input.workspace,
    createdAt: input.createdAt,
    lifecycle: input.lifecycle,
    contextPolicy: input.contextPolicy,
    effectiveConfig: toRecord(input.effectiveConfig),
    liveActivity: input.liveActivity === null ? null : toRecord(input.liveActivity),
  }
  if (input.groupId !== undefined) record['groupId'] = input.groupId
  if (input.childSessionId !== undefined) record['childSessionId'] = input.childSessionId
  if (input.activity !== undefined) record['activity'] = toRecord(input.activity)
  return validateMemberProjection(record)
}
