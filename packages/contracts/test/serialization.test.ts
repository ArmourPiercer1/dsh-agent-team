import { describe, expect, it } from 'vitest'

import {
  TEAM_CONTRACT_SCHEMA_VERSION,
  blueprintSnapshotKey,
  createMemberInstanceRecord,
  createTeamSessionRecord,
  deserializeMemberInstanceRecord,
  deserializeSessionBinding,
  deserializeTeamSessionRecord,
  isMemberLifecycleState,
  memberIdentityOf,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseBlueprintSnapshotKey,
  parseChildSessionId,
  parseInstanceId,
  parseMemberInstanceRecord,
  parseRootSessionId,
  parseSessionBinding,
  parseTemplateId,
  serializeMemberInstanceRecord,
  serializeSessionBinding,
  serializeTeamSessionRecord,
  canonicalJsonStringify,
} from '../src/index.js'
import { expectCode } from './helpers.js'

const CREATED_AT = '2026-08-29T12:00:00.000Z'

function teamSessionFixture() {
  return createTeamSessionRecord({
    rootSessionId: parseRootSessionId('session-1'),
    blueprint: {
      blueprintId: parseBlueprintId('AIUED-ALGO'),
      revision: parseBlueprintRevision('17'),
      contentHash: parseBlueprintContentHash('sha256:abc123'),
    },
    createdAt: CREATED_AT,
    generation: 1,
  })
}

function memberFixture() {
  return createMemberInstanceRecord({
    rootSessionId: parseRootSessionId('session-1'),
    instanceId: parseInstanceId('inst-a1'),
    templateId: parseTemplateId('researcher'),
    label: 'Researcher A',
    groupId: 'g1',
    childSessionId: parseChildSessionId('child-session-1'),
    workspace: '/ws/team-1',
    lifecycle: 'RUNNING',
    createdAt: CREATED_AT,
    activityVersion: 4,
  })
}

describe('contracts v1 — TeamSessionRecord serialization (invariant 10)', () => {
  it('create/serialize/deserialize round-trips to an equal, deeply-frozen value', () => {
    const rec = teamSessionFixture()
    const json = serializeTeamSessionRecord(rec)
    const back = deserializeTeamSessionRecord(json)
    expect(back).toEqual(rec)
    expect(back.schemaVersion).toBe(TEAM_CONTRACT_SCHEMA_VERSION)
    expect(Object.isFrozen(back)).toBe(true)
    expect(Object.isFrozen(back.blueprint)).toBe(true)
  })

  it('re-serialization is byte-stable (canonical sorted-key JSON)', () => {
    const rec = teamSessionFixture()
    const first = serializeTeamSessionRecord(rec)
    const back = deserializeTeamSessionRecord(first)
    const second = serializeTeamSessionRecord(back)
    expect(second).toBe(first)
  })

  it('insertion order does not affect the canonical encoding', () => {
    const rec = teamSessionFixture()
    const shuffled = {
      generation: rec.generation,
      createdAt: rec.createdAt,
      blueprint: rec.blueprint,
      rootSessionId: rec.rootSessionId,
      schemaVersion: rec.schemaVersion,
    }
    expect(canonicalJsonStringify(shuffled)).toBe(serializeTeamSessionRecord(rec))
  })

  it('deserializing hand-built key-shuffled JSON still validates and equals', () => {
    const json =
      '{"generation":1,"createdAt":"2026-08-29T12:00:00.000Z","blueprint":{"revision":"17","contentHash":"sha256:abc123","blueprintId":"AIUED-ALGO"},"rootSessionId":"session-1","schemaVersion":1}'
    const back = deserializeTeamSessionRecord(json)
    expect(back).toEqual(teamSessionFixture())
    expect(serializeTeamSessionRecord(back)).toBe(serializeTeamSessionRecord(teamSessionFixture()))
  })

  it('rejects syntactically invalid JSON with MALFORMED_DTO', () => {
    expectCode(() => deserializeTeamSessionRecord('{nope'), 'MALFORMED_DTO')
  })

  it('optional defaultWorkspace round-trips and stays absent when not given', () => {
    const withWs = createTeamSessionRecord({
      rootSessionId: parseRootSessionId('session-5'),
      blueprint: {
        blueprintId: parseBlueprintId('AIUED-ALGO'),
        revision: parseBlueprintRevision('17'),
        contentHash: parseBlueprintContentHash('sha256:abc123'),
      },
      defaultWorkspace: '/ws/team-5',
      createdAt: CREATED_AT,
      generation: 1,
    })
    expect(Object.hasOwn(withWs, 'defaultWorkspace')).toBe(true)
    const json = serializeTeamSessionRecord(withWs)
    const back = deserializeTeamSessionRecord(json)
    expect(back).toEqual(withWs)
    expect(serializeTeamSessionRecord(back)).toBe(json)

    const withoutWs = teamSessionFixture()
    // regression: an absent optional field must not be an own undefined key
    expect(Object.hasOwn(withoutWs, 'defaultWorkspace')).toBe(false)
    const json2 = serializeTeamSessionRecord(withoutWs)
    expect(json2.includes('defaultWorkspace')).toBe(false)
    expect(deserializeTeamSessionRecord(json2)).toEqual(withoutWs)
  })
})

describe('contracts v1 — MemberInstanceRecord serialization (invariant 23)', () => {
  it('full record round-trips byte-stably', () => {
    const rec = memberFixture()
    const json = serializeMemberInstanceRecord(rec)
    const back = deserializeMemberInstanceRecord(json)
    expect(back).toEqual(rec)
    expect(serializeMemberInstanceRecord(back)).toBe(json)
    expect(Object.isFrozen(back)).toBe(true)
  })

  it('the identity view of a record is exactly (rootSessionId, instanceId)', () => {
    const rec = memberFixture()
    const id = memberIdentityOf(rec)
    expect(id).toEqual({
      instanceId: rec.instanceId,
      rootSessionId: rec.rootSessionId,
    })
  })

  it('record-bound childSessionId keeps the member identity stable across serialization', () => {
    const rec = memberFixture()
    const back = deserializeMemberInstanceRecord(serializeMemberInstanceRecord(rec))
    expect(memberIdentityOf(back)).toEqual(memberIdentityOf(rec))
  })

  it('absent optional fields stay absent (no own undefined keys in the frozen record)', () => {
    const rec = parseMemberInstanceRecord({
      schemaVersion: 1,
      rootSessionId: 'session-1',
      instanceId: 'inst-a1',
      templateId: 'researcher',
      label: 'Researcher A',
      childSessionId: 'child-1',
      lifecycle: 'RUNNING',
      createdAt: '2026-08-29T12:00:00.000Z',
      activityVersion: 1,
    })
    // regression: parsing without groupId/workspace must not create own keys
    expect(Object.hasOwn(rec, 'groupId')).toBe(false)
    expect(Object.hasOwn(rec, 'workspace')).toBe(false)
    const json = serializeMemberInstanceRecord(rec)
    expect(serializeMemberInstanceRecord(deserializeMemberInstanceRecord(json))).toBe(json)
  })
})

describe('contracts v1 — SessionBinding serialization (invariant 23, no team session events)', () => {
  it('every binding kind round-trips byte-stably', () => {
    const fixtures = [
      parseSessionBinding({ schemaVersion: 1, kind: 'ordinary', sessionId: 's-ordinary' }),
      parseSessionBinding({ schemaVersion: 1, kind: 'team-root', sessionId: 's-team-root' }),
      parseSessionBinding({
        schemaVersion: 1,
        kind: 'team-member',
        sessionId: 's-member-child',
        rootSessionId: 'session-1',
        instanceId: 'inst-b2',
      }),
    ]
    for (const f of fixtures) {
      const json = serializeSessionBinding(f)
      const back = deserializeSessionBinding(json)
      expect(back).toEqual(f)
      expect(serializeSessionBinding(back)).toBe(json)
      expect(Object.isFrozen(back)).toBe(true)
    }
  })

  it('team-member binding canonical form sorts the three scope fields', () => {
    const binding = parseSessionBinding({
      schemaVersion: 1,
      kind: 'team-member',
      sessionId: 's-member-child',
      rootSessionId: 'session-1',
      instanceId: 'inst-b2',
    })
    const json = serializeSessionBinding(binding)
    expect(json).toBe(
      '{"instanceId":"inst-b2","kind":"team-member","rootSessionId":"session-1","schemaVersion":1,"sessionId":"s-member-child"}',
    )
  })
})

describe('contracts v1 — BlueprintSnapshotRef (invariant 10: one snapshot per team)', () => {
  it('blueprintSnapshotKey and parse are inverse', () => {
    const ref = teamSessionFixture().blueprint
    const key = blueprintSnapshotKey(ref)
    expect(key).toBe('AIUED-ALGO@17')
  })

  it('parseBlueprintSnapshotKey inverts the key form', () => {
    const back = parseBlueprintSnapshotKey('AIUED-ALGO@17')
    expect(back).toEqual({
      blueprintId: 'AIUED-ALGO',
      revision: '17',
    })
  })

  it('rejects malformed snapshot keys', () => {
    expectCode(() => parseBlueprintSnapshotKey('no-separator'), 'MALFORMED_DTO')
    expectCode(() => parseBlueprintSnapshotKey('a@b@c'), 'MALFORMED_DTO')
  })
})

describe('contracts v1 — lifecycle vocabulary (§29)', () => {
  it('exactly the five lifecycle states are recognized', () => {
    for (const s of ['CREATED', 'RUNNING', 'SETTLED', 'ARCHIVED', 'DISPOSED']) {
      expect(isMemberLifecycleState(s)).toBe(true)
    }
    // PROVISIONING_FAILED is a failure condition, NOT a lifecycle state
    expect(isMemberLifecycleState('PROVISIONING_FAILED')).toBe(false)
    expect(isMemberLifecycleState('running')).toBe(false)
    expect(isMemberLifecycleState(3)).toBe(false)
  })
})
