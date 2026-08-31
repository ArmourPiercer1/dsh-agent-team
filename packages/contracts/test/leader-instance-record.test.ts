/**
 * P8-S2 — the LeaderInstance record (schema v2, Architecture §9.2).
 *
 * The LeaderInstance is the Root Agent + Root Session: it has NO durable
 * child Session and NO ordinary member lifecycle (invariants 14/15). The
 * v2 record shape encodes that in the record itself:
 *
 * - `schemaVersion: 2`;
 * - `childSessionId` and `lifecycle` are ABSENT (not null, not optional-
 *   undefined — the keys do not exist on the row or in its canonical
 *   serialization, the same projection rule the frozen P8-T1 member
 *   projection enforces for `inst-leader`);
 * - `instanceId` MUST be the reserved leader id;
 * - every other member row keeps the v1 shape, and every pre-existing v1
 *   row (including the legacy harness-style leader rows that carry
 *   childSessionId + lifecycle) stays readable — the freeze rule adds,
 *   it never rewrites.
 *
 * Top-level synchronous scenarios (the contract functions are pure);
 * matchers are the shim's closed set (toBe / toEqual / toBeGreaterThan /
 * toThrow + .not) plus the package's `expectCode` helper.
 *
 * @module @dsh-agent-team/contracts/test/leader-instance-record
 */

import { describe, expect, it } from 'vitest'

import {
  LEADER_INSTANCE_ID,
  LEADER_INSTANCE_RECORD_FIELDS,
  LEADER_INSTANCE_RECORD_SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  createLeaderInstanceRecord,
  createMemberInstanceRecord,
  deserializeMemberInstanceRecord,
  isSupportedSchemaVersion,
  memberIdentityOf,
  parseChildSessionId,
  parseInstanceId,
  parseMemberInstanceRecord,
  parseRootSessionId,
  parseTemplateId,
  serializeMemberInstanceRecord,
} from '../src/index.js'
import type { LeaderInstanceRecordDto, LeaderInstanceRecordInput } from '../src/index.js'
import type { MemberInstanceRecordDto, MemberInstanceRecordInput } from '../src/index.js'
import { expectCode } from './helpers.js'

const ROOT = parseRootSessionId('session-root-p8s2')
const CREATED = '2026-09-01T00:00:00.000Z'

/**
 * Documented type-lie helper: a v2 leader record is passed to the v1-typed
 * serialize/identity surface. Safe because the shared identity core
 * (`rootSessionId`, `instanceId`) is present and the absent v2 keys
 * (`childSessionId`, `lifecycle`) stay absent through the JSON round-trip
 * — which is exactly what S2/S3 pin.
 */
function asV1Surface(record: LeaderInstanceRecordDto): MemberInstanceRecordDto {
  return record as unknown as MemberInstanceRecordDto
}

/** The honest v2 leader creation input (no childSessionId, no lifecycle). */
function leaderInput(): LeaderInstanceRecordInput {
  return {
    rootSessionId: ROOT,
    instanceId: LEADER_INSTANCE_ID,
    templateId: parseTemplateId('leader'),
    label: 'leader',
    createdAt: CREATED,
    activityVersion: 1,
  }
}

/** The plain (unbranded) v2 leader row as it appears on the medium. */
const v2LeaderRow = {
  schemaVersion: 2,
  rootSessionId: String(ROOT),
  instanceId: String(LEADER_INSTANCE_ID),
  templateId: 'leader',
  label: 'leader',
  createdAt: CREATED,
  activityVersion: 1,
}

/** The legacy harness-style v1 leader row (both fields present). */
const v1LeaderRow = {
  schemaVersion: 1,
  rootSessionId: String(ROOT),
  instanceId: String(LEADER_INSTANCE_ID),
  templateId: 'leader',
  label: 'leader',
  childSessionId: 'session-child-p8s2-leader',
  lifecycle: 'RUNNING',
  createdAt: CREATED,
  activityVersion: 1,
}

/** A plain v1 ordinary-member row (the unchanged member shape). */
const v1MemberRow = {
  schemaVersion: 1,
  rootSessionId: String(ROOT),
  instanceId: 'inst-p8s2worker',
  templateId: 'worker',
  label: 'worker',
  childSessionId: 'session-child-p8s2-w1',
  lifecycle: 'RUNNING',
  createdAt: CREATED,
  activityVersion: 1,
}

describe('P8-S2 contracts: the LeaderInstance record (schema v2)', () => {
  it('S1: createLeaderInstanceRecord stamps schemaVersion 2 and keeps no childSessionId/lifecycle key', () => {
    const record = createLeaderInstanceRecord(leaderInput())
    expect(LEADER_INSTANCE_RECORD_SCHEMA_VERSION).toBe(2)
    expect(record.schemaVersion).toBe(2)
    expect(String(record.rootSessionId)).toBe(String(ROOT))
    expect(String(record.instanceId)).toBe(String(LEADER_INSTANCE_ID))
    expect(String(record.templateId)).toBe('leader')
    expect(record.label).toBe('leader')
    expect(record.createdAt).toBe(CREATED)
    expect(record.activityVersion).toBe(1)
    expect(Object.prototype.hasOwnProperty.call(record, 'childSessionId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(record, 'lifecycle')).toBe(false)

    const identity = memberIdentityOf(asV1Surface(record))
    expect(String(identity.rootSessionId)).toBe(String(ROOT))
    expect(String(identity.instanceId)).toBe(String(LEADER_INSTANCE_ID))
  })

  it('S2: the serialized v2 row carries no childSessionId/lifecycle key (P8-T1 rule at the record layer)', () => {
    const record = createLeaderInstanceRecord(leaderInput())
    const json = serializeMemberInstanceRecord(asV1Surface(record))
    const decoded: Record<string, unknown> = JSON.parse(json)
    expect(decoded['schemaVersion']).toBe(2)
    expect(Object.prototype.hasOwnProperty.call(decoded, 'childSessionId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(decoded, 'lifecycle')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(decoded, 'rootSessionId')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(decoded, 'instanceId')).toBe(true)
  })

  it('S3: the v2 row round-trips through deserialize unchanged (still keyless)', () => {
    const record = createLeaderInstanceRecord(leaderInput())
    const round = deserializeMemberInstanceRecord(serializeMemberInstanceRecord(asV1Surface(record)))
    expect(round).toEqual(record)
    expect(round.schemaVersion).toBe(2)
    expect(Object.prototype.hasOwnProperty.call(round, 'childSessionId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(round, 'lifecycle')).toBe(false)
  })

  it('S4: the union factory mints the v2 row for the structurally-field-less leader input (C2 shape branch)', () => {
    const record = createMemberInstanceRecord(leaderInput())
    expect(record.schemaVersion).toBe(2)
    expect(String(record.instanceId)).toBe(String(LEADER_INSTANCE_ID))
    expect(Object.prototype.hasOwnProperty.call(record, 'childSessionId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(record, 'lifecycle')).toBe(false)
  })

  it('S5: v1 leader rows (the frozen legacy shape) remain parseable (freeze rule)', () => {
    const parsed = parseMemberInstanceRecord(v1LeaderRow)
    expect(parsed.schemaVersion).toBe(1)
    expect(String(parsed.instanceId)).toBe(String(LEADER_INSTANCE_ID))
    expect(String(parsed.childSessionId)).toBe('session-child-p8s2-leader')
    expect(parsed.lifecycle).toBe('RUNNING')
  })

  it('S6: v1 ordinary member rows are unchanged', () => {
    const parsed = parseMemberInstanceRecord(v1MemberRow)
    expect(parsed.schemaVersion).toBe(1)
    expect(String(parsed.childSessionId)).toBe('session-child-p8s2-w1')
    expect(parsed.lifecycle).toBe('RUNNING')
  })

  it('S7: a schemaVersion-2 record is only a leader record — a non-leader instanceId is rejected', () => {
    expectCode(
      () => parseMemberInstanceRecord({ ...v2LeaderRow, instanceId: 'inst-p8s2worker' }),
      'MALFORMED_DTO',
    )
  })

  it('S8: a schemaVersion-2 record with childSessionId or lifecycle present is rejected', () => {
    expectCode(
      () => parseMemberInstanceRecord({ ...v2LeaderRow, childSessionId: 'session-child-p8s2-leader' }),
      'MALFORMED_DTO',
    )
    expectCode(
      () => parseMemberInstanceRecord({ ...v2LeaderRow, lifecycle: 'RUNNING' }),
      'MALFORMED_DTO',
    )
  })

  it('S9: a schemaVersion-2 row missing a required field or carrying an unknown field is rejected', () => {
    const { label, ...withoutLabel } = v2LeaderRow
    expectCode(() => parseMemberInstanceRecord(withoutLabel), 'MALFORMED_DTO')
    expectCode(
      () => parseMemberInstanceRecord({ ...v2LeaderRow, extra: 'unknown' }),
      'MALFORMED_DTO',
    )
  })

  it('S10: corrupt and foreign version stamps are rejected; a v1-stamped keyless row fails v1 validation (fail-closed)', () => {
    expectCode(
      () => parseMemberInstanceRecord({ ...v2LeaderRow, schemaVersion: '2' }),
      'SCHEMA_VERSION_UNSUPPORTED',
    )
    // A well-formed v1-shaped row with a different numeric version is a
    // MISMATCH (the v1 path's expected version is 1; same discipline the
    // TeamSession record tests pin).
    expectCode(
      () => parseMemberInstanceRecord({ ...v1MemberRow, schemaVersion: 3 }),
      'SCHEMA_VERSION_MISMATCH',
    )
    // The keyless (v2-shaped) row with an unknown numeric stamp takes the
    // v1 path and fails there — fail-closed either way.
    expectCode(
      () => parseMemberInstanceRecord({ ...v2LeaderRow, schemaVersion: 3 }),
      'MALFORMED_DTO',
    )
    // v1-stamped row WITHOUT the v1-required fields: still the v1 path, still rejected.
    expectCode(
      () => parseMemberInstanceRecord({ ...v2LeaderRow, schemaVersion: 1 }),
      'MALFORMED_DTO',
    )
  })

  it('S11: the supported set now includes v2 (freeze-rule change; never a silent v1 edit)', () => {
    expect(isSupportedSchemaVersion(1)).toBe(true)
    expect(isSupportedSchemaVersion(2)).toBe(true)
    expect(isSupportedSchemaVersion(0)).toBe(false)
    expect(isSupportedSchemaVersion('2')).toBe(false)
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([1, 2])
  })

  it('S12: the leader factory fails closed on a non-leader instanceId and on a half-hack input', () => {
    expectCode(
      () =>
        createLeaderInstanceRecord({
          ...leaderInput(),
          instanceId: parseInstanceId('inst-p8s2worker'),
        }),
      'MALFORMED_DTO',
    )
    // Half-hack: the leader id WITH a childSessionId but no lifecycle — the
    // shape guard must NOT mint a v2 row; the v1 path rejects the gap.
    const halfHack = {
      ...leaderInput(),
      childSessionId: parseChildSessionId('session-child-p8s2-leader'),
    } as unknown as MemberInstanceRecordInput
    expectCode(() => createMemberInstanceRecord(halfHack), 'MALFORMED_DTO')
    // A v2-stamped input carrying lifecycle is malformed at the factory too.
    const withLifecycle = {
      ...leaderInput(),
      lifecycle: 'RUNNING',
    } as unknown as LeaderInstanceRecordInput
    expectCode(() => createLeaderInstanceRecord(withLifecycle), 'MALFORMED_DTO')
  })

  it('S13: the v2 field set is the v1 field set minus childSessionId and lifecycle', () => {
    expect(LEADER_INSTANCE_RECORD_FIELDS).toEqual([
      'schemaVersion',
      'rootSessionId',
      'instanceId',
      'templateId',
      'label',
      'groupId',
      'workspace',
      'createdAt',
      'activityVersion',
    ])
  })
})
