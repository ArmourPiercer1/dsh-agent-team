/**
 * P8-T1 projection contract: negative surface and the acceptance check.
 *
 * Acceptance (card): the DTO must leak no TeamDomain storage internals and
 * no SessionController Team mirror. Verified here two ways: (1) the union
 * of the frozen FIELDS constants is disjoint from the storage/mirror name
 * markers, and (2) the canonical serialized JSON of a full projection
 * carries none of those quoted tokens. The rest of the suite pins the
 * frozen cross-invariants (Architecture §42) and the closed vocabularies.
 */
import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_INTERVAL_FIELDS,
  COMPATIBILITY_SUMMARY_FIELDS,
  EFFECTIVE_CONFIG_ENTRY_FIELDS,
  EFFECTIVE_CONFIG_FIELDS,
  LEDGER_CATEGORY_VALUES,
  LEDGER_SUMMARY_FIELDS,
  MEMBER_ACTIVITY_SUMMARY_FIELDS,
  MEMBER_LIFECYCLE_STATE_VALUES,
  MEMBER_LIVE_ACTIVITY_FIELDS,
  MEMBER_PROJECTION_FIELDS,
  PROGRESS_VALUES,
  TEMPLATE_PROJECTION_FIELDS,
  TEAM_PROJECTION_FIELDS,
  TEAM_ROOT_PROJECTION_FIELDS,
  isMemberLifecycleState,
  parseTeamProjection,
  serializeTeamProjection,
} from '../src/index.js'
import {
  rawLeaderMember,
  rawLeaderTemplate,
  rawLedger,
  rawMember,
  rawMemberTemplate,
  rawProjection,
  rawRoot,
} from './p8t1-projection-fixtures.js'
import { expectCode } from './helpers.js'

/** The complete frozen field surface of projection contract v1. */
const PROJECTION_FIELD_SURFACE: readonly string[] = [
  ...TEAM_PROJECTION_FIELDS,
  ...TEAM_ROOT_PROJECTION_FIELDS,
  ...TEMPLATE_PROJECTION_FIELDS,
  ...MEMBER_PROJECTION_FIELDS,
  ...COMPATIBILITY_SUMMARY_FIELDS,
  ...MEMBER_ACTIVITY_SUMMARY_FIELDS,
  ...MEMBER_LIVE_ACTIVITY_FIELDS,
  ...ACTIVITY_INTERVAL_FIELDS,
  ...EFFECTIVE_CONFIG_FIELDS,
  ...EFFECTIVE_CONFIG_ENTRY_FIELDS,
  ...LEDGER_SUMMARY_FIELDS,
]

/** TeamDomain/durable-store internal names that must never appear on the DTO. */
const STORAGE_INTERNAL_FIELD_MARKERS: readonly string[] = [
  'tableName',
  'storageDomain',
  'storagePath',
  'filePath',
  'journal',
  'journalOffset',
  'cursor',
  'sql',
  'query',
  'connection',
  'offset',
]

/** SessionController Team-mirror names that must never appear on the DTO. */
const MIRROR_FIELD_MARKERS: readonly string[] = ['ctx', 'controller', 'mirror', 'roster']

describe('p8t1 projection acceptance: no leakage of storage or mirror internals', () => {
  it('the frozen field surface leaks no TeamDomain storage-internal names', () => {
    const leaks = PROJECTION_FIELD_SURFACE.filter((field) =>
      STORAGE_INTERNAL_FIELD_MARKERS.includes(field),
    )
    expect(leaks).toEqual([])
  })

  it('the frozen field surface leaks no SessionController Team-mirror names', () => {
    const leaks = PROJECTION_FIELD_SURFACE.filter((field) => MIRROR_FIELD_MARKERS.includes(field))
    expect(leaks).toEqual([])
  })

  it('the canonical serialized projection carries no storage/mirror field tokens', () => {
    const json = serializeTeamProjection(parseTeamProjection(rawProjection()))
    for (const token of [...STORAGE_INTERNAL_FIELD_MARKERS, ...MIRROR_FIELD_MARKERS]) {
      expect(json.includes(`"${token}"`)).toBe(false)
    }
  })
})

describe('p8t1 projection closed shapes (v1)', () => {
  it('every frozen FIELDS constant is exactly the expected closed set', () => {
    expect([...TEAM_PROJECTION_FIELDS]).toEqual([
      'schemaVersion',
      'teamSessionId',
      'blueprint',
      'generation',
      'generatedAt',
      'root',
      'templates',
      'members',
      'ledger',
    ])
    expect([...TEAM_ROOT_PROJECTION_FIELDS]).toEqual([
      'teamSessionId',
      'defaultWorkspace',
      'createdAt',
      'policyState',
      'admission',
      'compatibility',
      'creationBudgetConsumed',
      'handoffSourceSessionId',
    ])
    expect([...TEMPLATE_PROJECTION_FIELDS]).toEqual([
      'kind',
      'templateId',
      'displayName',
      'description',
      'contextPolicy',
      'instanceQuota',
    ])
    expect([...MEMBER_PROJECTION_FIELDS]).toEqual([
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
    ])
    expect([...COMPATIBILITY_SUMMARY_FIELDS]).toEqual([
      'status',
      'probeGeneration',
      'requirementFingerprint',
      'environmentFingerprint',
      'warningCount',
      'fatalCount',
      'acknowledgedWarningCount',
      'lastProbedAt',
    ])
    expect([...MEMBER_ACTIVITY_SUMMARY_FIELDS]).toEqual([
      'status',
      'subject',
      'summary',
      'lastAction',
      'correlation',
      'lastProgressAt',
      'openIntervals',
    ])
    expect([...MEMBER_LIVE_ACTIVITY_FIELDS]).toEqual([
      'residency',
      'currentAction',
      'lastActivityAt',
      'runningSince',
      'admittedWorkCorrelation',
    ])
    expect([...ACTIVITY_INTERVAL_FIELDS]).toEqual(['correlation', 'openedAt'])
    expect([...EFFECTIVE_CONFIG_FIELDS]).toEqual(['model', 'workspace', 'permissions', 'autonomy'])
    expect([...EFFECTIVE_CONFIG_ENTRY_FIELDS]).toEqual(['value', 'source', 'state'])
    expect([...LEDGER_SUMMARY_FIELDS]).toEqual([
      'latestSequence',
      'totalEntries',
      'byCategory',
      'pendingControlCount',
    ])
  })

  it('the root carries NO lifecycle field (Architecture §8.6)', () => {
    expect(TEAM_ROOT_PROJECTION_FIELDS.includes('lifecycle')).toBe(false)
    expectCode(
      () => parseTeamProjection(rawProjection({ root: rawRoot({ lifecycle: 'RUNNING' }) })),
      'MALFORMED_DTO',
    )
  })

  it('admission is the closed four-state set (Architecture §28)', () => {
    expectCode(
      () => parseTeamProjection(rawProjection({ root: rawRoot({ admission: 'MAYBE' }) })),
      'MALFORMED_DTO',
    )
  })

  it('the lifecycle vocabulary is the P3-T1 five-state set (no re-declaration)', () => {
    expect([...MEMBER_LIFECYCLE_STATE_VALUES].sort()).toEqual([
      'ARCHIVED',
      'CREATED',
      'DISPOSED',
      'RUNNING',
      'SETTLED',
    ])
    expect(isMemberLifecycleState('PROVISIONING_FAILED')).toBe(false)
  })

  it('the ledger categories are the eight frozen UI §27.4 filters', () => {
    expect([...LEDGER_CATEGORY_VALUES].sort()).toEqual([
      'compatibility',
      'control',
      'lifecycle',
      'member',
      'message',
      'policy',
      'progress',
      'team',
    ])
  })

  it('the progress vocabulary is the closed P6-T2 set', () => {
    expect([...PROGRESS_VALUES].sort()).toEqual(['blocked', 'completed', 'in-progress'])
  })

  it('an unknown top-level projection field is rejected (closed shape)', () => {
    expectCode(() => parseTeamProjection(rawProjection({ extra: 1 })), 'MALFORMED_DTO')
  })

  it('an unknown member field is rejected (closed shape)', () => {
    expectCode(
      () =>
        parseTeamProjection(
          rawProjection({ members: [rawLeaderMember({ extra: 1 }), rawMember()] }),
        ),
      'MALFORMED_DTO',
    )
  })
})

describe('p8t1 projection cross-invariants (Architecture §42)', () => {
  it('root.teamSessionId must equal the projection teamSessionId (invariant 9)', () => {
    expectCode(
      () => parseTeamProjection(rawProjection({ root: rawRoot({ teamSessionId: 'session-2' }) })),
      'MALFORMED_DTO',
    )
  })

  it('a leader row carrying childSessionId is rejected (invariant 14)', () => {
    expectCode(
      () =>
        parseTeamProjection(
          rawProjection({
            members: [rawLeaderMember({ childSessionId: 'session-9' }), rawMember()],
          }),
        ),
      'MALFORMED_DTO',
    )
  })

  it('a non-leader row without childSessionId is rejected (invariant 23)', () => {
    expectCode(
      () =>
        parseTeamProjection(
          rawProjection({
            members: [rawLeaderMember(), rawMember({ childSessionId: undefined })],
          }),
        ),
      'MALFORMED_DTO',
    )
  })

  it('two leader templates are rejected (invariant 13: exactly one)', () => {
    expectCode(
      () =>
        parseTeamProjection(
          rawProjection({ templates: [rawLeaderTemplate(), rawLeaderTemplate()] }),
        ),
      'MALFORMED_DTO',
    )
  })

  it('zero leader templates are rejected (invariant 13: exactly one)', () => {
    expectCode(
      () => parseTeamProjection(rawProjection({ templates: [rawMemberTemplate()] })),
      'MALFORMED_DTO',
    )
  })

  it('a member row referencing an unknown template is rejected (invariant 17)', () => {
    expectCode(
      () =>
        parseTeamProjection(
          rawProjection({ members: [rawLeaderMember(), rawMember({ templateId: 'ghost' })] }),
        ),
      'MALFORMED_DTO',
    )
  })

  it('the leader row must reference the leader template', () => {
    expectCode(
      () =>
        parseTeamProjection(
          rawProjection({
            members: [rawLeaderMember({ templateId: 'researcher' }), rawMember()],
          }),
        ),
      'MALFORMED_DTO',
    )
  })

  it('duplicate instanceId is rejected (invariant 18: unique within the team)', () => {
    expectCode(
      () => parseTeamProjection(rawProjection({ members: [rawLeaderMember(), rawMember(), rawMember()] })),
      'MALFORMED_DTO',
    )
  })

  it('byCategory must carry all eight categories (closed key set)', () => {
    const partial = {
      ...rawLedger(),
      byCategory: {
        team: 2,
        member: 1,
        lifecycle: 1,
        message: 2,
        control: 0,
        policy: 0,
        compatibility: 1,
      },
    }
    expectCode(() => parseTeamProjection(rawProjection({ ledger: partial })), 'MALFORMED_DTO')
  })

  it('byCategory with a foreign category is rejected', () => {
    const foreign = {
      ...rawLedger(),
      byCategory: { ...(rawLedger().byCategory as Record<string, number>), ghost: 1 },
    }
    expectCode(() => parseTeamProjection(rawProjection({ ledger: foreign })), 'MALFORMED_DTO')
  })

  it('totalEntries must equal the sum of byCategory', () => {
    expectCode(
      () => parseTeamProjection(rawProjection({ ledger: { ...rawLedger(), totalEntries: 99 } })),
      'MALFORMED_DTO',
    )
  })

  it('a foreign schemaVersion is a mismatch; a corrupt one is unsupported', () => {
    // P8-S7-R2 premise update: `2` is now the additive v2 projection schema
    // (the R2-2..R2-6 effective-config / history lanes); a genuinely
    // foreign version is 3.
    expectCode(
      () => parseTeamProjection(rawProjection({ schemaVersion: 3 })),
      'SCHEMA_VERSION_MISMATCH',
    )
    expectCode(
      () => parseTeamProjection(rawProjection({ schemaVersion: 0 })),
      'SCHEMA_VERSION_UNSUPPORTED',
    )
    expectCode(
      () => parseTeamProjection(rawProjection({ schemaVersion: 0.5 })),
      'SCHEMA_VERSION_UNSUPPORTED',
    )
  })
})
