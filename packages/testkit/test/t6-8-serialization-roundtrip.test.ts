/**
 * P3-T6 (serialization round-trip, required test) — every durable DTO of the
 * composed domain must survive canonical JSON in both directions: serialize
 * -> JSON.parse -> deserialize (re-validated from the untrusted boundary)
 * -> structurally identical. Plus the composition-level bundle projection
 * (key-order invariance) and the two invalidation properties (fingerprint
 * drift, cross-TeamSession identity scope).
 *
 * Authority: Architecture §5.2/§10.2/§14.3 E (durable identity, snapshot
 * binding, staleness), §27.3 (ack/result bound to fingerprints); contracts
 * v1 (the DTO quartets); Development Plan §16.4 (serialization round-trip
 * is a named P3-T6 must-test).
 */

import { describe, expect, it } from 'vitest'

import {
  assertMemberIdentityInTeam,
  blueprintSnapshotKey,
  canonicalJsonStringify,
  createMemberIdentity,
  createMemberInstanceRecord,
  createTeamSessionRecord,
  deserializeMemberInstanceRecord,
  deserializeSessionBinding,
  deserializeTeamSessionRecord,
  memberIdentityKey,
  parseBlueprintSnapshotKey,
  parseBlueprintSnapshotRef,
  parseChildSessionId,
  parseInstanceId,
  parseMemberIdentityKey,
  parseRootSessionId,
  parseSessionBinding,
  parseTeamSessionId,
  parseTeamSessionRecord,
  parseTemplateId,
  serializeMemberInstanceRecord,
  serializeSessionBinding,
  serializeTeamSessionRecord,
} from '../../contracts/src/index.js'
import type {
  BlueprintSnapshotRef,
  MemberIdentity,
  RootSessionId,
  SessionBindingDto,
} from '../../contracts/src/index.js'
import { parseBlueprint, toBlueprintSnapshotRef } from '../../domain/blueprint/src/index.js'
import {
  evaluateCompatibility,
  isCompatibilityResultValidForEnvironment,
  parseEnvironmentFacts,
  parseRequirements,
  serializeCompatibilityResult,
} from '../../domain/compatibility/src/index.js'
import type { CompatibilityResult } from '../../domain/compatibility/src/index.js'
import { FULLY_COMPATIBLE_FACTS } from '../../domain/compatibility/fixtures/environment-facts.js'
import { BLUEPRINT_REQUIREMENTS as REQUIREMENTS_FIXTURE } from '../../domain/compatibility/fixtures/requirements.js'
import { resolveEffectivePolicy } from '../../domain/policy/src/index.js'
import type { EffectivePolicyInput } from '../../domain/policy/src/index.js'
import { MINIMAL_BLUEPRINT_SOURCE } from '../../domain/blueprint/testdata/fixtures.js'
import {
  T6_CREATED_AT,
  T6_ROOT_SESSION_ID,
  buildTeamComposition,
  parseComposition,
  serializeComposition,
} from '../domain/src/index.js'
import { expectCode, isDeepFrozen } from './t6-helpers.js'

const ROOT = T6_ROOT_SESSION_ID
const TEAM = parseTeamSessionId(ROOT)

describe('P3-T6 serialization round-trip (cross-module)', () => {
  it('TeamSessionRecord: create -> serialize -> deserialize -> identical', () => {
    const blueprint = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    const record = createTeamSessionRecord({
      rootSessionId: ROOT,
      blueprint: toBlueprintSnapshotRef(blueprint),
      createdAt: T6_CREATED_AT,
      generation: 1,
    })
    const json = serializeTeamSessionRecord(record)
    const back = deserializeTeamSessionRecord(json)
    expect(back).toEqual(record)
    // The unknown-value parser agrees with the typed deserializer.
    const reparsed = parseTeamSessionRecord(JSON.parse(json))
    expect(reparsed).toEqual(record)
    expect(reparsed.blueprint).toEqual(toBlueprintSnapshotRef(blueprint))
    expect(reparsed.generation).toBe(1)
  })

  it('MemberInstanceRecord: create -> serialize -> deserialize -> identical (stamped CREATED / activityVersion 1)', () => {
    const record = createMemberInstanceRecord({
      rootSessionId: ROOT,
      instanceId: parseInstanceId('inst-m01'),
      templateId: parseTemplateId('researcher'),
      label: 'Fourier',
      childSessionId: parseChildSessionId('session-child-1-01'),
      lifecycle: 'CREATED',
      createdAt: T6_CREATED_AT,
      activityVersion: 1,
    })
    const json = serializeMemberInstanceRecord(record)
    const back = deserializeMemberInstanceRecord(json)
    expect(back).toEqual(record)
    expect(back.lifecycle).toBe('CREATED')
    expect(back.activityVersion).toBe(1)
  })

  it('SessionBinding: all three kinds round-trip', () => {
    const ordinary: SessionBindingDto = parseSessionBinding({
      schemaVersion: 1,
      kind: 'ordinary',
      sessionId: 'session-ordinary-1',
    })
    const teamRoot: SessionBindingDto = parseSessionBinding({
      schemaVersion: 1,
      kind: 'team-root',
      sessionId: ROOT,
    })
    const teamMember: SessionBindingDto = parseSessionBinding({
      schemaVersion: 1,
      kind: 'team-member',
      sessionId: 'session-child-1-01',
      rootSessionId: ROOT,
      instanceId: 'inst-m01',
    })
    for (const binding of [ordinary, teamRoot, teamMember]) {
      const json = serializeSessionBinding(binding)
      expect(deserializeSessionBinding(json)).toEqual(binding)
    }
    expect(ordinary.kind).toBe('ordinary')
    expect(teamRoot.kind).toBe('team-root')
    expect(teamMember.kind).toBe('team-member')
  })

  it('BlueprintSnapshotRef: canonical JSON round-trip and blueprintId@revision key round-trip', () => {
    const ref: BlueprintSnapshotRef = toBlueprintSnapshotRef(parseBlueprint(MINIMAL_BLUEPRINT_SOURCE))
    const json = canonicalJsonStringify(ref)
    const parsed = JSON.parse(json) as unknown
    expect(parsed).toEqual(ref)
    expect(parseBlueprintSnapshotRef(parsed)).toEqual(ref)
    const key = blueprintSnapshotKey(ref)
    expect(key).toBe('team.min@1')
    const keyBack = parseBlueprintSnapshotKey(key)
    expect(keyBack).toEqual({ blueprintId: 'team.min', revision: '1' })
  })

  it('MemberIdentity: the canonical key round-trips strictly (non-canonical encodings rejected)', () => {
    const identity: MemberIdentity = createMemberIdentity(ROOT, parseInstanceId('inst-m01'))
    const key = memberIdentityKey(identity)
    expect(parseMemberIdentityKey(key)).toEqual(identity)
    // The canonical encoding places instanceId first; that exact literal
    // parses back to the same identity.
    expect(
      parseMemberIdentityKey('{"instanceId":"inst-m01","rootSessionId":' + JSON.stringify(ROOT) + '}'),
    ).toEqual(identity)
    // A reordered (rootSessionId-first) encoding of the same components is
    // NOT a key, nor is a field-missing one.
    expectCode(
      () => parseMemberIdentityKey('{"rootSessionId":' + JSON.stringify(ROOT) + ',"instanceId":"inst-m01"}'),
      'MALFORMED_DTO',
      'reordered member identity key (rootSessionId first)',
    )
    expectCode(
      () => parseMemberIdentityKey('{"instanceId":"inst-m01"}'),
      'MALFORMED_DTO',
      'member identity key missing rootSessionId',
    )
    // A foreign root changes the key entirely.
    const foreign: MemberIdentity = createMemberIdentity(
      parseRootSessionId('session-team-root-2'),
      parseInstanceId('inst-m01'),
    )
    expect(memberIdentityKey(foreign)).not.toBe(key)
  })

  it('CompatibilityResult: canonical JSON round-trips and stays valid for its environment', () => {
    const result: CompatibilityResult = evaluateCompatibility({
      requirements: REQUIREMENTS_FIXTURE,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    const json = serializeCompatibilityResult(result)
    const parsed = JSON.parse(json) as unknown
    expect(parsed).toEqual(result)
    expect(
      isCompatibilityResultValidForEnvironment(
        result,
        parseRequirements(REQUIREMENTS_FIXTURE),
        parseEnvironmentFacts(FULLY_COMPATIBLE_FACTS),
      ),
    ).toBe(true)
  })

  it('EffectivePolicy: canonical JSON round-trips and is deep-frozen', () => {
    const input: EffectivePolicyInput = {
      teamSessionId: TEAM,
      member: createMemberIdentity(ROOT, parseInstanceId('inst-m01')),
      blueprint: {},
      template: {},
      policyState: { stateId: 'default' },
      external: { hard: {}, capabilityExists: {} },
    }
    const policy = resolveEffectivePolicy(input)
    expect(isDeepFrozen(policy)).toBe(true)
    const json = canonicalJsonStringify(policy)
    expect(JSON.parse(json)).toEqual(policy)
  })

  it('composition bundle: serializeComposition -> parseComposition round-trips every part; key order is irrelevant', () => {
    const comp = buildTeamComposition({ blueprintSource: MINIMAL_BLUEPRINT_SOURCE, memberCount: 3 })
    const json = serializeComposition(comp)
    const back = parseComposition(json)
    expect(back.rootSessionId).toBe(comp.rootSessionId)
    expect(back.teamSessionId).toBe(comp.teamSessionId)
    expect(back.teamSession).toEqual(comp.teamSession)
    expect(back.memberRecords).toEqual(comp.memberRecords)
    expect(back.bindings).toEqual(comp.bindings)
    expect(back.snapshotRef).toEqual(comp.snapshotRef)
    expect(back.snapshotKey).toBe(comp.snapshotKey)
    // The same values inserted in a different order serialize byte-identically.
    const reordered = {
      bindings: comp.bindings,
      members: comp.memberRecords,
      rootSessionId: comp.rootSessionId,
      teamSession: comp.teamSession,
    }
    expect(canonicalJsonStringify(reordered)).toBe(json)
  })

  it('drift invalidates a compatibility result; a tampered rootSessionId breaks the identity scope', () => {
    const result = evaluateCompatibility({
      requirements: REQUIREMENTS_FIXTURE,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    // A pure generation bump (availability unchanged) changes the fingerprint.
    const bumped = FULLY_COMPATIBLE_FACTS.map((fact) =>
      fact.domain === 'mcpServer' && fact.subject === 'abtem'
        ? { ...fact, generation: 9 }
        : fact,
    )
    expect(
      isCompatibilityResultValidForEnvironment(
        result,
        parseRequirements(REQUIREMENTS_FIXTURE),
        parseEnvironmentFacts(bumped),
      ),
    ).toBe(false)
    // Cross-TeamSession identity confusion is rejected at the contract boundary.
    const identity = createMemberIdentity(ROOT, parseInstanceId('inst-m01'))
    const foreignTeam = parseTeamSessionId(parseRootSessionId('session-team-root-2'))
    expectCode(
      () => assertMemberIdentityInTeam(identity, foreignTeam),
      'IDENTITY_SCOPE_MISMATCH',
      'tampered rootSessionId identity scope',
    )
  })
})
