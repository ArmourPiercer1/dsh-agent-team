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
import type { EffectiveConfigDtoV2 } from './effective-config.js'
import { parseMemberModelState } from './model-state.js'
import type { MemberModelStateDto } from './model-state.js'
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
 * The exact frozen fields of a MemberProjectionDto under projection v2
 * (S7-R2). v2 is ADDITIVE: the v1 set plus the optional v2 member fields
 * (repair R2-3 adds `modelState`; every addition is DURATIONAL-optional).
 * v1 rows remain valid through the v1 field set above.
 */
export const MEMBER_PROJECTION_FIELDS_V2: readonly string[] = [
  ...MEMBER_PROJECTION_FIELDS,
  'modelState',
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
  /**
   * The four-lane effective configuration view with provenance. Under
   * projection v2 (S7-R2 R2-2) the entries are `EffectiveConfigEntryV2`
   * (same v1 core fields plus additive optional provenance keys); the v1
   * type here is the documented type lie — v1-typed reads of `value` /
   * `source` / `state` remain structurally sound for v2 rows.
   */
  readonly effectiveConfig: EffectiveConfigDto
  /** The durable activity summary; key absent when no durable facts exist. */
  readonly activity?: MemberActivitySummaryDto
  /**
   * The BQ-11 model state view (projection v2, S7-R2 repair R2-3).
   * DURATIONAL-optional: the key is ABSENT when the view cannot be derived
   * (v1 rows never carry it; the v1 field set rejects the key).
   */
  readonly modelState?: MemberModelStateDto
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
  /**
   * The four-lane effective configuration view (or a plain record for it).
   * v2 entries (S7-R2 R2-2) are accepted by `createTeamProjection`, which
   * stamps the enclosing version; `createMemberProjection` stays
   * v1-stamped and rejects additive v2 entry fields by design.
   */
  effectiveConfig: EffectiveConfigDto | EffectiveConfigDtoV2
  /** The durable activity summary (optional; key absent when undefined). */
  activity?: MemberActivitySummaryDto
  /**
   * The BQ-11 model state view (projection v2, S7-R2 repair R2-3).
   * DURATIONAL-optional: the key is ABSENT when the view cannot be derived
   * (v1 rows never carry it; the v1 field set rejects the key).
   */
  modelState?: MemberModelStateDto
  /** The live overlay, or `null` when the live source has no facts. */
  liveActivity: MemberLiveActivityDto | null
}

function validateMemberProjection(record: RemoteSafeRecord, schemaVersion: 1 | 2 = 1): MemberProjectionDto {
  // R2-2 (S7-R2): schema version 2 admits the additive `MEMBER_PROJECTION_FIELDS_V2`
  // set and threads the version into the effective-config parse. The declared
  // return type stays `MemberProjectionDto` (v1-typed `effectiveConfig`) by the
  // documented type-lie precedent: v2 entries carry the same v1 core fields
  // plus additive optional keys, so v1-typed reads remain structurally sound.
  const fields = schemaVersion === 2 ? MEMBER_PROJECTION_FIELDS_V2 : MEMBER_PROJECTION_FIELDS
  assertNoLegacyFields(record, 'MemberProjection')
  assertNoUnknownFields(record, fields, 'MemberProjection')
  for (const field of fields) {
    if (
      field !== 'groupId' &&
      field !== 'childSessionId' &&
      field !== 'activity' &&
      field !== 'modelState'
    ) {
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
    effectiveConfig: parseEffectiveConfigDto(record['effectiveConfig'], schemaVersion),
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
  // R2-3 (S7-R2): the v2 model-state view (BQ-11). The key is DURATIONAL-
  // optional: absent when the producer could not derive the view (or the
  // row is v1 — the v1 field set rejects the key above).
  const modelState =
    record['modelState'] === undefined
      ? {}
      : { modelState: parseMemberModelState(record['modelState']) }
  return deepFreeze({ ...base, ...groupId, ...child, ...activity, ...modelState })
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
export function parseMemberProjection(value: unknown, schemaVersion: 1 | 2 = 1): MemberProjectionDto {
  return validateMemberProjection(assertPlainRecord(value, 'MemberProjection'), schemaVersion)
}

/**
 * Build a fresh MemberProjectionDto from producer input (already branded
 * ids; the input must not carry own `undefined` keys except the documented
 * optionals, which are omitted when `undefined`).
 * @param input - the member fields.
 * @returns the frozen member row, validated through the same pipeline as
 *   `parseMemberProjection`. Always v1-stamped; v2 member rows are
 *   produced through `createTeamProjection` (S7-R2).
 */
export function createMemberProjection(input: MemberProjectionInput): MemberProjectionDto {
  // R2-3 (S7-R2): the v1-stamped builder cannot produce a v2 field — fail
  // closed instead of silently dropping the view.
  if (input.modelState !== undefined) {
    throw teamContractError(
      'MALFORMED_DTO',
      "createMemberProjection is v1-stamped and must not carry the v2 'modelState' field",
      { field: 'modelState' },
    )
  }
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
