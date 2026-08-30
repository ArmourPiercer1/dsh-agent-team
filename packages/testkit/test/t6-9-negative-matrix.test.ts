/**
 * P3-T6 (negative matrix, required test) — one table-driven negative
 * matrix across all five composed modules, plus the error-family
 * disjointness property: every negative case fails with exactly ONE domain
 * error class (judged by class identity, because `IDENTITY_SCOPE_MISMATCH`
 * is deliberately shared between the contracts and policy vocabularies).
 *
 * The table covers: the closed 20-code contracts vocabulary; id validation;
 * schema versions; legacy-field and legacy-event quarantine; uniqueness
 * guards; the remote-safe JSON boundary; all 31 blueprint negative
 * fixtures; member creation/addressing; the 16 illegal lifecycle pairs;
 * policy fail-closed envelope violations; and malformed compatibility
 * inputs.
 *
 * Authority: contracts v1 (closed code set, CHANGELOG freeze), Architecture
 * §10.2/§14.3/§21/§27/§29/§42 (identity, schema, legacy quarantine,
 * envelope, lifecycle), Development Plan §16.4 (negative matrix is a named
 * P3-T6 must-test).
 */

import { describe, expect, it } from 'vitest'

import {
  LEGACY_TEAM_SESSION_EVENT_NAMES,
  MEMBER_LIFECYCLE_STATES,
  TEAM_CONTRACT_ERROR_CODE_VALUES,
  assertChildSessionBindingUnique,
  assertInstanceIdUniqueWithinTeam,
  assertNotLegacyTeamSessionEvent,
  assertRemoteSafeJsonValue,
  assertTeamSessionUnique,
  canonicalJsonStringify,
  createMemberIdentity,
  createMemberInstanceRecord,
  createTeamSessionRecord,
  deepFreeze,
  isLegacyTeamSessionEventName,
  isRemoteSafeJsonValue,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseMemberInstanceRecord,
  parseRootSessionId,
  parseSessionBinding,
  parseTemplateId,
  parseTeamSessionId,
  parseTeamSessionRecord,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import { parseBlueprint, toBlueprintSnapshotRef } from '../../domain/blueprint/src/index.js'
import { MINIMAL_BLUEPRINT_SOURCE, NEGATIVE_FIXTURES } from '../../domain/blueprint/testdata/fixtures.js'
import {
  assertTransitionLegal,
  canTransition,
  LIFECYCLE_OPERATIONS,
  applyLifecycleOperation,
} from '../../domain/lifecycle/src/index.js'
import {
  createMemberInstance,
  resolveDelegationTarget,
  setWorkspace,
  transitionInstance,
} from '../../domain/member/src/index.js'
import { resolveEffectivePolicy } from '../../domain/policy/src/index.js'
import type { EffectivePolicyInput } from '../../domain/policy/src/index.js'
import {
  evaluateCompatibility,
  parseWarningAcknowledgement,
} from '../../domain/compatibility/src/index.js'
import type { RequirementInput } from '../../domain/compatibility/src/index.js'
import { BLUEPRINT_REQUIREMENTS } from '../../domain/compatibility/fixtures/requirements.js'
import { MCP_UNAVAILABLE_FACTS } from '../../domain/compatibility/fixtures/environment-facts.js'
import {
  T6_CREATED_AT,
  T6_ROOT_SESSION_ID,
} from '../domain/src/index.js'
import {
  capture,
  errorFamilies,
  expectCode,
  expectNoThrow,
  hasCode,
} from './t6-helpers.js'
import type { T6ErrorFamily } from './t6-helpers.js'

const ROOT = T6_ROOT_SESSION_ID
const FOREIGN_ROOT = parseRootSessionId('session-team-root-2')
const CHILD = parseChildSessionId('session-child-1-01')

const SNAPSHOT_REF = toBlueprintSnapshotRef(parseBlueprint(MINIMAL_BLUEPRINT_SOURCE))
const TEAM_SESSION_RECORD = createTeamSessionRecord({
  rootSessionId: ROOT,
  blueprint: SNAPSHOT_REF,
  createdAt: T6_CREATED_AT,
  generation: 1,
})
const MEMBER_RECORD: MemberInstanceRecordDto = createMemberInstanceRecord({
  rootSessionId: ROOT,
  instanceId: parseInstanceId('inst-m01'),
  templateId: parseTemplateId('researcher'),
  label: 'Fourier',
  childSessionId: CHILD,
  lifecycle: 'CREATED',
  createdAt: T6_CREATED_AT,
  activityVersion: 1,
})
const FOREIGN_MEMBER_RECORD: MemberInstanceRecordDto = createMemberInstanceRecord({
  rootSessionId: FOREIGN_ROOT,
  instanceId: parseInstanceId('inst-m01'),
  templateId: parseTemplateId('researcher'),
  label: 'Other',
  childSessionId: parseChildSessionId('session-child-2-01'),
  lifecycle: 'CREATED',
  createdAt: T6_CREATED_AT,
  activityVersion: 1,
})
const TEAM_MEMBER_BINDING = parseSessionBinding({
  schemaVersion: 1,
  kind: 'team-member',
  sessionId: 'session-child-1-01',
  rootSessionId: ROOT,
  instanceId: 'inst-m01',
})
const ORDINARY_BINDING = parseSessionBinding({
  schemaVersion: 1,
  kind: 'ordinary',
  sessionId: 'session-child-1-01',
})
const DISPOSED_RECORD: MemberInstanceRecordDto = applyLifecycleOperation(
  applyLifecycleOperation(
    applyLifecycleOperation(MEMBER_RECORD, LIFECYCLE_OPERATIONS.ADMIT_WORK),
    LIFECYCLE_OPERATIONS.SETTLE,
  ),
  LIFECYCLE_OPERATIONS.DISPOSE,
)
const WS_INSTANCE = createMemberInstance(
  {
    rootSessionId: ROOT,
    instanceId: parseInstanceId('inst-m07'),
    templateId: parseTemplateId('researcher'),
    label: 'Fourier',
    childSessionId: parseChildSessionId('session-child-1-07'),
    createdAt: T6_CREATED_AT,
  },
  [],
)
const WS_RUNNING = transitionInstance(WS_INSTANCE, LIFECYCLE_OPERATIONS.ADMIT_WORK)

const POLICY_BASE: EffectivePolicyInput = {
  teamSessionId: parseTeamSessionId(ROOT),
  member: createMemberIdentity(ROOT, parseInstanceId('inst-m01')),
  blueprint: {},
  template: {},
  policyState: { stateId: 'default' },
  external: { hard: {}, capabilityExists: {} },
}
const UNKNOWN_CAP_INPUT = {
  ...POLICY_BASE,
  blueprint: { values: { 'bogus-cap': { kind: 'allow' as const, items: ['x'] } } },
} as unknown as EffectivePolicyInput
const MEMBER_ESCALATION_INPUT: EffectivePolicyInput = {
  ...POLICY_BASE,
  blueprint: { autonomyEnvelope: { model: { kind: 'allow', items: ['spare-item'] } } },
  template: { mutationEnvelope: { model: { kind: 'allow', items: ['spare-item'] } } },
  instanceOverlay: {
    overlayId: 'ov-ins-1',
    kind: 'instance',
    origin: 'member',
    values: { model: { kind: 'allow', items: ['evil-item'] } },
  },
}
const LEADER_OUT_OF_ENVELOPE_INPUT: EffectivePolicyInput = {
  ...POLICY_BASE,
  blueprint: { autonomyEnvelope: { model: { kind: 'allow', items: ['spare-item'] } } },
  template: { mutationEnvelope: { model: { kind: 'allow', items: ['spare-item'] } } },
  templateOverlay: {
    overlayId: 'ov-tpl-1',
    kind: 'template',
    origin: 'leader',
    values: { model: { kind: 'allow', items: ['evil-item'] } },
  },
}
const FOREIGN_IDENTITY_POLICY_INPUT: EffectivePolicyInput = {
  ...POLICY_BASE,
  member: createMemberIdentity(FOREIGN_ROOT, parseInstanceId('inst-m01')),
}

const WARNING_RESULT = evaluateCompatibility({
  requirements: BLUEPRINT_REQUIREMENTS,
  environmentFacts: MCP_UNAVAILABLE_FACTS,
})
const MCP_ENTRY = WARNING_RESULT.requirements.find((entry) => entry.requirementId === 'req-mcp-abtem')
if (MCP_ENTRY === undefined || MCP_ENTRY.mismatchFingerprint === null) {
  throw new Error('fixture expectation broken: req-mcp-abtem WARNING mismatch fingerprint missing')
}
const BAD_ISO_ACK_INPUT = {
  requirementId: 'req-mcp-abtem',
  mismatchFingerprint: MCP_ENTRY.mismatchFingerprint,
  environmentFingerprint: WARNING_RESULT.environmentFingerprint,
  acknowledgedBy: 't6-operator',
  acknowledgedAt: 'not-an-iso-date',
}

// --- the negative table -------------------------------------------------------

interface NegCase {
  readonly name: string
  readonly family: T6ErrorFamily
  readonly code: string
  readonly fn: () => void
}

const NEGATIVE_TABLE: NegCase[] = []
function neg(name: string, family: T6ErrorFamily, code: string, fn: () => void): void {
  NEGATIVE_TABLE.push({ name, family, code, fn })
}

// contracts: id vocabulary
neg('parseRootSessionId("")', 'contracts', 'INVALID_ROOT_SESSION_ID', () => parseRootSessionId(''))
neg('parseInstanceId("")', 'contracts', 'INVALID_INSTANCE_ID', () => parseInstanceId(''))
neg('parseInstanceId("INST-1")', 'contracts', 'INVALID_INSTANCE_ID', () => parseInstanceId('INST-1'))
neg('parseTemplateId("")', 'contracts', 'INVALID_TEMPLATE_ID', () => parseTemplateId(''))
neg('parseChildSessionId("")', 'contracts', 'INVALID_CHILD_SESSION_ID', () => parseChildSessionId(''))
neg('parseBlueprintId("")', 'contracts', 'INVALID_BLUEPRINT_ID', () => parseBlueprintId(''))
neg('parseBlueprintRevision("")', 'contracts', 'INVALID_BLUEPRINT_REVISION', () => parseBlueprintRevision(''))
neg('parseBlueprintContentHash("")', 'contracts', 'INVALID_BLUEPRINT_CONTENT_HASH', () => parseBlueprintContentHash(''))

// contracts: schema versions, malformed DTOs, legacy fields
neg('TeamSessionRecord schemaVersion 2', 'contracts', 'SCHEMA_VERSION_MISMATCH', () =>
  parseTeamSessionRecord({ ...TEAM_SESSION_RECORD, schemaVersion: 2 }),
)
neg('TeamSessionRecord schemaVersion 0', 'contracts', 'SCHEMA_VERSION_UNSUPPORTED', () =>
  parseTeamSessionRecord({ ...TEAM_SESSION_RECORD, schemaVersion: 0 }),
)
neg('MemberInstanceRecord schemaVersion 9', 'contracts', 'SCHEMA_VERSION_MISMATCH', () =>
  parseMemberInstanceRecord({ ...MEMBER_RECORD, schemaVersion: 9 }),
)
neg('team-member binding missing instanceId', 'contracts', 'INVALID_INSTANCE_ID', () =>
  parseSessionBinding({
    schemaVersion: 1,
    kind: 'team-member',
    sessionId: 'session-child-1-01',
    rootSessionId: ROOT,
  }),
)
neg('MemberInstanceRecord legacy memberId', 'contracts', 'LEGACY_MEMBER_ID_REJECTED', () =>
  parseMemberInstanceRecord({ ...MEMBER_RECORD, memberId: 'legacy-1' }),
)
neg('TeamSessionRecord legacy memberId', 'contracts', 'LEGACY_MEMBER_ID_REJECTED', () =>
  parseTeamSessionRecord({ ...TEAM_SESSION_RECORD, memberId: 'legacy-1' }),
)
neg('SessionBinding legacy memberId', 'contracts', 'LEGACY_MEMBER_ID_REJECTED', () =>
  parseSessionBinding({ ...TEAM_MEMBER_BINDING, memberId: 'legacy-1' }),
)

// contracts: legacy Team SessionEvent vocabulary (detection-only quarantine)
for (const eventName of LEGACY_TEAM_SESSION_EVENT_NAMES) {
  neg(`legacy event ${eventName}`, 'contracts', 'LEGACY_TEAM_SESSION_EVENT_REJECTED', () =>
    assertNotLegacyTeamSessionEvent(eventName),
  )
}

// contracts: uniqueness guards
neg('second TeamSession on the same root', 'contracts', 'DUPLICATE_TEAM_SESSION', () =>
  assertTeamSessionUnique(ROOT, [TEAM_SESSION_RECORD]),
)
neg('duplicate instance id in one team', 'contracts', 'DUPLICATE_INSTANCE_ID', () =>
  assertInstanceIdUniqueWithinTeam(ROOT, parseInstanceId('inst-m01'), [MEMBER_RECORD]),
)
neg('child session bound twice', 'contracts', 'SESSION_ALREADY_BOUND', () =>
  assertChildSessionBindingUnique(CHILD, [TEAM_MEMBER_BINDING]),
)

// contracts: remote-safe JSON boundary
neg('deepFreeze(BigInt)', 'contracts', 'REMOTE_VALUE_NOT_JSON', () => deepFreeze(BigInt(1)))
neg('assertRemoteSafeJsonValue({a: Date})', 'contracts', 'REMOTE_VALUE_NOT_JSON', () =>
  assertRemoteSafeJsonValue({ a: new Date() }),
)
neg('canonicalJsonStringify({a: BigInt})', 'contracts', 'REMOTE_VALUE_NOT_JSON', () =>
  canonicalJsonStringify({ a: BigInt(2) }),
)

// blueprint: every negative fixture fails with its typed code
for (const fixture of NEGATIVE_FIXTURES) {
  neg(`blueprint fixture ${fixture.name}`, 'contracts', fixture.code, () =>
    parseBlueprint(fixture.source),
  )
}

// member: creation & addressing
neg('createMemberInstance(inst-leader)', 'member', 'INSTANCE_ID_RESERVED', () =>
  createMemberInstance(
    {
      rootSessionId: ROOT,
      instanceId: parseInstanceId('inst-leader'),
      templateId: parseTemplateId('researcher'),
      label: 'Lead',
      childSessionId: parseChildSessionId('session-child-1-08'),
      createdAt: T6_CREATED_AT,
    },
    [],
  ),
)
neg('createMemberInstance(contextPolicy "bogus")', 'member', 'CONTEXT_POLICY_UNKNOWN', () =>
  createMemberInstance(
    {
      rootSessionId: ROOT,
      instanceId: parseInstanceId('inst-m01'),
      templateId: parseTemplateId('researcher'),
      label: 'Fourier',
      childSessionId: parseChildSessionId('session-child-1-01'),
      contextPolicy: 'bogus',
      createdAt: T6_CREATED_AT,
    },
    [],
  ),
)
neg('delegation to a DISPOSED instance', 'member', 'DELEGATION_TARGET_DISPOSED', () =>
  resolveDelegationTarget(ROOT, 'persistent', { explicitInstanceId: parseInstanceId('inst-m01') }, [DISPOSED_RECORD]),
)
neg('delegation with explicit AND template', 'member', 'DELEGATION_TARGET_INVALID', () =>
  resolveDelegationTarget(
    ROOT,
    'persistent',
    { explicitInstanceId: parseInstanceId('inst-m01'), templateId: parseTemplateId('researcher') },
    [MEMBER_RECORD],
  ),
)
neg('delegation with neither address', 'member', 'DELEGATION_TARGET_INVALID', () =>
  resolveDelegationTarget(ROOT, 'persistent', {}, [MEMBER_RECORD]),
)
neg('setWorkspace after RUNNING', 'member', 'WORKSPACE_MUTATION_FORBIDDEN', () =>
  setWorkspace(WS_RUNNING, 'workspace-x'),
)

// contracts: roster lookup miss (thrown by the member module as a contracts error)
neg('delegation to a missing instance', 'contracts', 'MEMBER_NOT_FOUND', () =>
  resolveDelegationTarget(ROOT, 'persistent', { explicitInstanceId: parseInstanceId('inst-ghost') }, [MEMBER_RECORD]),
)

// lifecycle: every illegal state pair
const STATES = Object.values(MEMBER_LIFECYCLE_STATES)
for (const from of STATES) {
  for (const to of STATES) {
    if (canTransition(from, to)) continue
    neg(
      `lifecycle ${from} -> ${to}`,
      'lifecycle',
      from === 'DISPOSED' ? 'LIFECYCLE_TERMINAL_STATE' : 'LIFECYCLE_ILLEGAL_TRANSITION',
      () => assertTransitionLegal(from, to),
    )
  }
}

// policy: fail-closed violations
neg('policy unknown capability key', 'policy', 'MALFORMED_POLICY_INPUT', () =>
  resolveEffectivePolicy(UNKNOWN_CAP_INPUT),
)
neg('member overlay outside the envelope', 'policy', 'MEMBER_SELF_ESCALATION', () =>
  resolveEffectivePolicy(MEMBER_ESCALATION_INPUT),
)
neg('leader overlay outside the envelope', 'policy', 'LEADER_OUT_OF_ENVELOPE', () =>
  resolveEffectivePolicy(LEADER_OUT_OF_ENVELOPE_INPUT),
)
neg('policy member identity from a foreign team', 'policy', 'IDENTITY_SCOPE_MISMATCH', () =>
  resolveEffectivePolicy(FOREIGN_IDENTITY_POLICY_INPUT),
)

// compatibility: malformed inputs
neg('requirement unknown type', 'contracts', 'MALFORMED_DTO', () =>
  evaluateCompatibility({
    requirements: [{ requirementId: 'req-x', type: 'bogus', subjects: ['s'] }] as unknown as RequirementInput[],
    environmentFacts: [],
  }),
)
neg('requirement duplicate subject', 'contracts', 'MALFORMED_DTO', () =>
  evaluateCompatibility({
    requirements: [{ requirementId: 'req-x', type: 'tool', subjects: ['s', 's'] }],
    environmentFacts: [],
  }),
)
neg('requirement empty subjects', 'contracts', 'MALFORMED_DTO', () =>
  evaluateCompatibility({
    requirements: [{ requirementId: 'req-x', type: 'tool', subjects: [] }],
    environmentFacts: [],
  }),
)
neg('ack with non-ISO acknowledgedAt', 'contracts', 'MALFORMED_DTO', () =>
  parseWarningAcknowledgement(BAD_ISO_ACK_INPUT),
)

describe('P3-T6 G3 negative matrix (cross-module)', () => {
  it('the contracts v1 code vocabulary is closed: exactly 20 distinct codes', () => {
    expect(TEAM_CONTRACT_ERROR_CODE_VALUES.length).toBe(20)
    expect(new Set(TEAM_CONTRACT_ERROR_CODE_VALUES).size).toBe(20)
    expect(TEAM_CONTRACT_ERROR_CODE_VALUES.indexOf('TEAM_PERSONA_COMPLETE_PRESET_CONFLICT')).toBeGreaterThan(-1)
    expect(TEAM_CONTRACT_ERROR_CODE_VALUES.indexOf('IDENTITY_SCOPE_MISMATCH')).toBeGreaterThan(-1)
    expect(TEAM_CONTRACT_ERROR_CODE_VALUES.indexOf('LEGACY_MEMBER_ID_REJECTED')).toBeGreaterThan(-1)
  })

  it('every id parser rejects malformed ids with its typed contract code', () => {
    for (const entry of NEGATIVE_TABLE) {
      if (!entry.name.startsWith('parse')) continue
      const error = expectCode(entry.fn, entry.code, entry.name)
      expect(errorFamilies(error)).toEqual(['contracts'])
    }
  })

  it('schema versions, malformed DTOs, and legacy fields are rejected by their typed codes', () => {
    for (const entry of NEGATIVE_TABLE) {
      if (
        entry.family !== 'contracts' ||
        !['SCHEMA_VERSION_MISMATCH', 'SCHEMA_VERSION_UNSUPPORTED', 'MALFORMED_DTO', 'LEGACY_MEMBER_ID_REJECTED'].includes(entry.code)
      ) {
        continue
      }
      if (entry.name.startsWith('blueprint fixture')) continue
      const error = expectCode(entry.fn, entry.code, entry.name)
      expect(errorFamilies(error)).toEqual(['contracts'])
    }
  })

  it('the legacy Team SessionEvent vocabulary is detection-only and rejected (5 names)', () => {
    expect(LEGACY_TEAM_SESSION_EVENT_NAMES.length).toBe(5)
    for (const name of LEGACY_TEAM_SESSION_EVENT_NAMES) {
      expect(isLegacyTeamSessionEventName(name)).toBe(true)
      const error = expectCode(() => assertNotLegacyTeamSessionEvent(name), 'LEGACY_TEAM_SESSION_EVENT_REJECTED', name)
      expect(errorFamilies(error)).toEqual(['contracts'])
    }
    // A vNext-looking name is NOT legacy and passes the guard.
    expect(isLegacyTeamSessionEventName('team-work-admitted')).toBe(false)
    expectNoThrow(() => assertNotLegacyTeamSessionEvent('team-work-admitted'), 'vNext-looking event name passes')
  })

  it('uniqueness guards: one TeamSession per root, unique instance id per team, child session bound at most once', () => {
    expectCode(() => assertTeamSessionUnique(ROOT, [TEAM_SESSION_RECORD]), 'DUPLICATE_TEAM_SESSION', 'same-root team session')
    expectNoThrow(
      () => assertTeamSessionUnique(FOREIGN_ROOT, [TEAM_SESSION_RECORD]),
      'foreign-root team session passes',
    )
    expectCode(
      () => assertInstanceIdUniqueWithinTeam(ROOT, parseInstanceId('inst-m01'), [MEMBER_RECORD]),
      'DUPLICATE_INSTANCE_ID',
      'same-team duplicate instance',
    )
    expectNoThrow(
      () => assertInstanceIdUniqueWithinTeam(ROOT, parseInstanceId('inst-m01'), [FOREIGN_MEMBER_RECORD]),
      'foreign-team same instance id passes (invariant 18 scoping)',
    )
    expectCode(() => assertChildSessionBindingUnique(CHILD, [TEAM_MEMBER_BINDING]), 'SESSION_ALREADY_BOUND', 'double-bound child session')
    expectNoThrow(
      () => assertChildSessionBindingUnique(CHILD, [ORDINARY_BINDING]),
      'ordinary binding does not claim the child session',
    )
  })

  it('the remote-safe JSON boundary rejects non-lossless values', () => {
    for (const entry of NEGATIVE_TABLE) {
      if (entry.code !== 'REMOTE_VALUE_NOT_JSON') continue
      const error = expectCode(entry.fn, entry.code, entry.name)
      expect(errorFamilies(error)).toEqual(['contracts'])
    }
    expect(isRemoteSafeJsonValue({ a: 1, b: [true, 'x'] })).toBe(true)
    expect(isRemoteSafeJsonValue({ a: BigInt(1) })).toBe(false)
    expect(isRemoteSafeJsonValue(new Date())).toBe(false)
  })

  it('every blueprint negative fixture (31) fails with its typed code', () => {
    expect(NEGATIVE_FIXTURES.length).toBe(31)
    const seenCodes = new Set<string>()
    for (const fixture of NEGATIVE_FIXTURES) {
      const error = expectCode(() => parseBlueprint(fixture.source), fixture.code, fixture.name)
      expect(errorFamilies(error)).toEqual(['contracts'])
      seenCodes.add(fixture.code)
      if (fixture.unknownFields !== undefined) {
        const details = (error as { details?: Record<string, unknown> }).details
        if (details === undefined) throw new Error(`fixture ${fixture.name}: missing details`)
        expect(details['unknownFields']).toEqual(fixture.unknownFields)
      }
    }
    // The fixture set exercises more than one contract rule.
    expect(seenCodes.size).toBeGreaterThan(1)
  })

  it('member creation & addressing negatives fail with their typed codes; unknown lifecycle op on an instance is a TypeError', () => {
    for (const entry of NEGATIVE_TABLE) {
      if (entry.family !== 'member' && !(entry.name === 'delegation to a missing instance')) continue
      if (entry.name === 'delegation to a missing instance') {
        const error = expectCode(entry.fn, entry.code, entry.name)
        expect(errorFamilies(error)).toEqual(['contracts'])
        continue
      }
      const error = expectCode(entry.fn, entry.code, entry.name)
      expect(errorFamilies(error)).toEqual(['member'])
    }
    // transitionInstance with a non-vocabulary operation: a plain TypeError (total-API guard), not a domain error.
    const bogus = capture(() => transitionInstance(WS_INSTANCE, 'BOGUS_OPERATION' as never))
    if (bogus.error === undefined) throw new Error('expected a TypeError for an unknown lifecycle operation')
    expect(bogus.error instanceof TypeError).toBe(true)
  })

  it('all 16 illegal lifecycle pairs are typed-rejected (9 legal edges remain)', () => {
    let legal = 0
    let illegal = 0
    for (const from of STATES) {
      for (const to of STATES) {
        if (canTransition(from, to)) {
          legal += 1
          continue
        }
        illegal += 1
        const entry = NEGATIVE_TABLE.find((candidate) => candidate.name === `lifecycle ${from} -> ${to}`)
        if (entry === undefined) throw new Error(`missing lifecycle negative case ${from} -> ${to}`)
        const error = expectCode(entry.fn, entry.code, entry.name)
        expect(errorFamilies(error)).toEqual(['lifecycle'])
      }
    }
    expect(legal).toBe(9)
    expect(illegal).toBe(16)
  })

  it('policy violations fail closed with their typed codes', () => {
    for (const entry of NEGATIVE_TABLE) {
      if (entry.family !== 'policy') continue
      const error = expectCode(entry.fn, entry.code, entry.name)
      expect(errorFamilies(error)).toEqual(['policy'])
    }
  })

  it('malformed compatibility inputs fail with MALFORMED_DTO and typed details', () => {
    const unknownType = NEGATIVE_TABLE.find((entry) => entry.name === 'requirement unknown type')
    if (unknownType === undefined) throw new Error('missing unknown-type case')
    const unknownTypeError = expectCode(unknownType.fn, 'MALFORMED_DTO', 'requirement unknown type')
    const details = (unknownTypeError as { details?: Record<string, unknown> }).details
    if (details === undefined) throw new Error('missing error details')
    expect(details['problem']).toBe('unknown requirement type')

    for (const entry of NEGATIVE_TABLE) {
      if (!entry.name.startsWith('requirement') && entry.name !== 'ack with non-ISO acknowledgedAt') continue
      if (entry.name === 'requirement unknown type') continue
      const error = expectCode(entry.fn, entry.code, entry.name)
      expect(errorFamilies(error)).toEqual(['contracts'])
    }
  })

  it('PROPERTY: every negative case fails with exactly one error family (class-based disjointness)', () => {
    expect(NEGATIVE_TABLE.length).toBeGreaterThan(50)
    for (const entry of NEGATIVE_TABLE) {
      const { error } = capture(entry.fn)
      if (error === undefined) {
        throw new Error(`negative case '${entry.name}' did not throw`)
      }
      if (!hasCode(error, entry.code)) {
        throw new Error(
          `negative case '${entry.name}': expected code ${entry.code}, got ${
            error instanceof Error ? String((error as { code?: unknown }).code) : String(error)
          }`,
        )
      }
      const families = errorFamilies(error)
      if (families.length !== 1 || families[0] !== entry.family) {
        throw new Error(
          `negative case '${entry.name}': expected exactly one family '${entry.family}', got [${families.join(', ')}]`,
        )
      }
    }
  })
})
