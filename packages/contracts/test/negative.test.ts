import { describe, expect, it } from 'vitest'

import {
  LEGACY_TEAM_SESSION_EVENT_NAMES,
  assertChildSessionBindingUnique,
  assertInstanceIdUniqueWithinTeam,
  assertNotLegacyTeamSessionEvent,
  assertTeamSessionUnique,
  isLegacyTeamSessionEventName,
  isSupportedSchemaVersion,
  parseBlueprintSnapshotRef,
  parseChildSessionId,
  parseInstanceId,
  parseMemberInstanceRecord,
  parseRootSessionId,
  parseSessionBinding,
  parseTeamSessionRecord,
} from '../src/index.js'
import { expectCode } from './helpers.js'

/** A structurally valid TeamSessionRecord row (plain, unbranded). */
const validTeam = {
  schemaVersion: 1,
  rootSessionId: 'session-1',
  blueprint: {
    blueprintId: 'AIUED-ALGO',
    revision: '17',
    contentHash: 'sha256:abc123',
  },
  createdAt: '2026-08-29T12:00:00.000Z',
  generation: 1,
} as const

/** A structurally valid MemberInstanceRecord row (plain, unbranded). */
const validMember = {
  schemaVersion: 1,
  rootSessionId: 'session-1',
  instanceId: 'inst-a1',
  templateId: 'researcher',
  label: 'Researcher A',
  childSessionId: 'child-1',
  lifecycle: 'RUNNING',
  createdAt: '2026-08-29T12:00:00.000Z',
  activityVersion: 1,
} as const

/** A structurally valid team-member SessionBinding row (plain, unbranded). */
const validBinding = {
  schemaVersion: 1,
  kind: 'team-member',
  sessionId: 'child-1',
  rootSessionId: 'session-1',
  instanceId: 'inst-a1',
} as const

describe('contracts v1 — legacy memberId is rejected on every DTO (invariant 18/19)', () => {
  it('TeamSessionRecord carrying memberId fails with LEGACY_MEMBER_ID_REJECTED', () => {
    expectCode(
      () => parseTeamSessionRecord({ ...validTeam, memberId: 'B1' }),
      'LEGACY_MEMBER_ID_REJECTED',
    )
  })

  it('MemberInstanceRecord carrying memberId fails with LEGACY_MEMBER_ID_REJECTED', () => {
    expectCode(
      () => parseMemberInstanceRecord({ ...validMember, memberId: 'B1' }),
      'LEGACY_MEMBER_ID_REJECTED',
    )
  })

  it('SessionBinding carrying memberId fails with LEGACY_MEMBER_ID_REJECTED', () => {
    expectCode(
      () => parseSessionBinding({ ...validBinding, memberId: 'B1' }),
      'LEGACY_MEMBER_ID_REJECTED',
    )
  })

  it('BlueprintSnapshotRef carrying memberId fails with LEGACY_MEMBER_ID_REJECTED', () => {
    expectCode(
      () => parseBlueprintSnapshotRef({ ...validTeam.blueprint, memberId: 'B1' }),
      'LEGACY_MEMBER_ID_REJECTED',
    )
  })
})

describe('contracts v1 — DTO shape discipline', () => {
  it('unknown fields are rejected with MALFORMED_DTO', () => {
    expectCode(() => parseTeamSessionRecord({ ...validTeam, extra: 1 }), 'MALFORMED_DTO')
    expectCode(() => parseMemberInstanceRecord({ ...validMember, extra: 1 }), 'MALFORMED_DTO')
    expectCode(() => parseSessionBinding({ ...validBinding, extra: 1 }), 'MALFORMED_DTO')
  })

  it('missing required fields are rejected with MALFORMED_DTO', () => {
    const { childSessionId: _drop, ...memberWithoutChild } = validMember
    expectCode(() => parseMemberInstanceRecord(memberWithoutChild), 'MALFORMED_DTO')
    const { generation: _dropGen, ...teamWithoutGeneration } = validTeam
    expectCode(() => parseTeamSessionRecord(teamWithoutGeneration), 'MALFORMED_DTO')
  })

  it('non-object DTO inputs are rejected with MALFORMED_DTO', () => {
    for (const bad of [null, undefined, 'row', 42, [], true]) {
      expectCode(() => parseTeamSessionRecord(bad), 'MALFORMED_DTO')
      expectCode(() => parseMemberInstanceRecord(bad), 'MALFORMED_DTO')
      expectCode(() => parseSessionBinding(bad), 'MALFORMED_DTO')
    }
  })

  it('deserializing invalid JSON is MALFORMED_DTO', () => {
    expectCode(
      () => parseMemberInstanceRecord(JSON.parse('[]')),
      'MALFORMED_DTO',
    )
  })
})

describe('contracts v1 — legacy Team SessionEvent vocabulary is detection-only (invariant 42)', () => {
  it('lists exactly the five frozen legacy event names', () => {
    expect([...LEGACY_TEAM_SESSION_EVENT_NAMES]).toEqual([
      'team/member-bound',
      'team/progress',
      'team/control-request',
      'team/control-decision',
      'team/message',
    ])
  })

  it('detects legacy names and nothing else', () => {
    for (const name of LEGACY_TEAM_SESSION_EVENT_NAMES) {
      expect(isLegacyTeamSessionEventName(name)).toBe(true)
    }
    expect(isLegacyTeamSessionEventName('user/message')).toBe(false)
    expect(isLegacyTeamSessionEventName('team/unknown')).toBe(false)
    expect(isLegacyTeamSessionEventName(42)).toBe(false)
    expect(isLegacyTeamSessionEventName(null)).toBe(false)
  })

  it('assertNotLegacyTeamSessionEvent rejects legacy names, passes others', () => {
    for (const name of LEGACY_TEAM_SESSION_EVENT_NAMES) {
      expectCode(
        () => assertNotLegacyTeamSessionEvent(name),
        'LEGACY_TEAM_SESSION_EVENT_REJECTED',
      )
    }
    expect(() => assertNotLegacyTeamSessionEvent('user/message')).not.toThrow()
    expect(() => assertNotLegacyTeamSessionEvent('agent/turn-settled')).not.toThrow()
  })
})

describe('contracts v1 — schema version discipline', () => {
  it('a well-formed but different version is SCHEMA_VERSION_MISMATCH', () => {
    expectCode(() => parseTeamSessionRecord({ ...validTeam, schemaVersion: 2 }), 'SCHEMA_VERSION_MISMATCH')
  })

  it('a structurally corrupt version is SCHEMA_VERSION_UNSUPPORTED', () => {
    expectCode(() => parseTeamSessionRecord({ ...validTeam, schemaVersion: 0 }), 'SCHEMA_VERSION_UNSUPPORTED')
    expectCode(
      () => parseTeamSessionRecord({ ...validTeam, schemaVersion: '1' }),
      'SCHEMA_VERSION_UNSUPPORTED',
    )
  })

  it('supports exactly versions 1 and 2 (P8-S2: the supported set grew by an explicit, authorized v2 contract change — not a silent v1 edit)', () => {
    expect(isSupportedSchemaVersion(1)).toBe(true)
    // P8-S2 defect-encoding update: this asserted `false` before v2 existed.
    // The supported set grew [1] -> [1, 2] under the freeze rule (new schema
    // stamp + CHANGELOG v2 + explicit authority: Architecture §9.2,
    // invariants 13/14/15/23, P8-S plan §15.2, P8-S2 task packet).
    expect(isSupportedSchemaVersion(2)).toBe(true)
    expect(isSupportedSchemaVersion(0)).toBe(false)
    expect(isSupportedSchemaVersion(3)).toBe(false)
    expect(isSupportedSchemaVersion('1')).toBe(false)
    expect(isSupportedSchemaVersion('2')).toBe(false)
  })
})

describe('contracts v1 — lifecycle vocabulary negatives (§29)', () => {
  it('lowercase, unknown, and non-string lifecycle values are MALFORMED_DTO', () => {
    for (const bad of ['running', 'RUNNIN', 'PAUSED', 'PROVISIONING_FAILED', 3, null]) {
      expectCode(
        () => parseMemberInstanceRecord({ ...validMember, lifecycle: bad }),
        'MALFORMED_DTO',
      )
    }
  })
})

describe('contracts v1 — timestamp and generation negatives', () => {
  it('malformed createdAt values are MALFORMED_DTO', () => {
    for (const bad of [
      '2026-08-29',
      '2026-08-29 12:00:00',
      '2026-13-45T99:99:99Z',
      '2026-08-29T12:00:00',
      1234567890,
      null,
    ]) {
      expectCode(
        () => parseMemberInstanceRecord({ ...validMember, createdAt: bad }),
        'MALFORMED_DTO',
      )
    }
  })

  it('malformed generation values are MALFORMED_DTO', () => {
    for (const bad of [0, -1, 1.5, '2', null]) {
      expectCode(
        () => parseTeamSessionRecord({ ...validTeam, generation: bad }),
        'MALFORMED_DTO',
      )
    }
  })
})

describe('contracts v1 — uniqueness and scoping (invariants 8/18/23)', () => {
  it('the same instanceId under a DIFFERENT root session is allowed (legacy confusion fixed)', () => {
    const memberUnderRootA = parseMemberInstanceRecord(validMember)
    // A second team may legitimately reuse the same instance id under its own
    // root session: instance ids are only unique within one team.
    expect(
      () =>
        assertInstanceIdUniqueWithinTeam(
          parseRootSessionId('session-2'),
          parseInstanceId('inst-a1'),
          [memberUnderRootA],
        ),
    ).not.toThrow()
    // Same scope: the legacy single-memberId world would have called this fine;
    // the composite identity catches the true duplicate.
    expectCode(
      () =>
        assertInstanceIdUniqueWithinTeam(
          parseRootSessionId('session-1'),
          parseInstanceId('inst-a1'),
          [memberUnderRootA],
        ),
      'DUPLICATE_INSTANCE_ID',
    )
  })

  it('a second TeamSession on the same root is DUPLICATE_TEAM_SESSION (invariant 8)', () => {
    const existing = parseTeamSessionRecord(validTeam)
    expect(
      () => assertTeamSessionUnique(parseRootSessionId('session-2'), [existing]),
    ).not.toThrow()
    expectCode(
      () => assertTeamSessionUnique(parseRootSessionId('session-1'), [existing]),
      'DUPLICATE_TEAM_SESSION',
    )
  })

  it('a child session already bound to a member is SESSION_ALREADY_BOUND (invariant 23)', () => {
    const binding = parseSessionBinding(validBinding)
    expectCode(
      () => assertChildSessionBindingUnique(parseChildSessionId('child-1'), [binding]),
      'SESSION_ALREADY_BOUND',
    )
    // A different child session is fine.
    expect(
      () => assertChildSessionBindingUnique(parseChildSessionId('child-9'), [binding]),
    ).not.toThrow()
  })

  it('ordinary bindings do not occupy the member child-session namespace', () => {
    const ordinary = parseSessionBinding({
      schemaVersion: 1,
      kind: 'ordinary',
      sessionId: 'child-1',
    })
    expect(
      () => assertChildSessionBindingUnique(parseChildSessionId('child-1'), [ordinary]),
    ).not.toThrow()
  })
})
