/**
 * P3-T6 / G3 criterion 2 — "one template → N instances, covered by property
 * tests".
 *
 * Property under test: instantiating the SAME template (same templateId,
 * same label) N times in one TeamSession yields N distinct runtime
 * identities `(rootSessionId, instanceId)` (invariant 18) — labels and
 * template ids are NOT runtime identities (invariant 19). N sweeps
 * {1..8, 12}; identities, records, and session bindings are cross-checked
 * against each other at every N.
 */

import { describe, expect, it } from 'vitest'

import {
  assertMemberIdentityInTeam,
  memberIdentityKey,
  parseMemberIdentityKey,
  parseRootSessionId,
  teamSessionIdOf,
} from '../../contracts/src/index.js'
import type { MemberIdentity } from '../../contracts/src/index.js'
import {
  instancesForTemplate,
  instanceCountForTemplate,
  findMemberRecord,
} from '../../domain/member/src/index.js'
import { MINIMAL_BLUEPRINT_SOURCE } from '../../domain/blueprint/testdata/fixtures.js'
import {
  T6_ROOT_SESSION_ID,
  T6_DEFAULT_TEMPLATE_ID,
  T6_DEFAULT_LABEL,
  buildTeamComposition,
  t6InstanceIdAt,
  t6ChildSessionIdAt,
} from '../domain/src/index.js'
import { expectCode, mulberry32 } from './t6-helpers.js'

const N_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 12]

function buildAt(n: number) {
  return buildTeamComposition({ blueprintSource: MINIMAL_BLUEPRINT_SOURCE, memberCount: n })
}

describe('P3-T6 G3-2: one template → N instances (property)', () => {
  it('N members of one template yield exactly N distinct member identities, for N in {1..8,12}', () => {
    for (const n of N_VALUES) {
      const comp = buildAt(n)
      expect(comp.members.length).toBe(n)
      const keys = comp.identities.map((identity) => memberIdentityKey(identity))
      const distinct = new Set(keys)
      expect(distinct.size).toBe(n)
      for (let i = 0; i < n; i++) {
        const identity = comp.identities[i]
        expect(identity !== undefined).toBe(true)
        if (identity === undefined) continue
        expect(identity.rootSessionId).toBe(T6_ROOT_SESSION_ID)
        expect(identity.instanceId).toBe(t6InstanceIdAt(i + 1))
      }
    }
  })

  it('all N instances share templateId and label, yet identities are pairwise distinct (invariant 19)', () => {
    for (const n of N_VALUES) {
      const comp = buildAt(n)
      for (const record of comp.memberRecords) {
        expect(record.templateId).toBe(T6_DEFAULT_TEMPLATE_ID)
        expect(record.label).toBe(T6_DEFAULT_LABEL)
      }
      for (let i = 0; i < comp.identities.length; i++) {
        for (let j = i + 1; j < comp.identities.length; j++) {
          const a = comp.identities[i]
          const b = comp.identities[j]
          expect(a !== undefined && b !== undefined).toBe(true)
          if (a === undefined || b === undefined) continue
          expect(memberIdentityKey(a) === memberIdentityKey(b)).toBe(false)
        }
      }
    }
  })

  it('instancesForTemplate / instanceCountForTemplate agree with N for every N', () => {
    for (const n of N_VALUES) {
      const comp = buildAt(n)
      const records = comp.memberRecords
      expect(instanceCountForTemplate(records, T6_ROOT_SESSION_ID, T6_DEFAULT_TEMPLATE_ID)).toBe(n)
      const found = instancesForTemplate(records, T6_ROOT_SESSION_ID, T6_DEFAULT_TEMPLATE_ID)
      expect(found.length).toBe(n)
      for (const record of records) {
        const foundRecord = findMemberRecord(records, T6_ROOT_SESSION_ID, record.instanceId)
        expect(foundRecord).toEqual(record)
      }
    }
  })

  it('every member record carries its own durable child session binding (invariants 23/24)', () => {
    for (const n of [0, 1, 3, 5]) {
      const comp = buildAt(n)
      expect(comp.bindings.length).toBe(n + 1)
      const root = comp.bindings[0]
      expect(root !== undefined).toBe(true)
      if (root === undefined) continue
      expect(root.kind).toBe('team-root')
      if (root.kind === 'team-root') {
        expect(root.sessionId).toBe(comp.teamSessionId)
      }
      for (let i = 0; i < n; i++) {
        const binding = comp.bindings[i + 1]
        expect(binding !== undefined).toBe(true)
        if (binding === undefined) continue
        expect(binding.kind).toBe('team-member')
        if (binding.kind === 'team-member') {
          expect(binding.rootSessionId).toBe(T6_ROOT_SESSION_ID)
          expect(binding.instanceId).toBe(t6InstanceIdAt(i + 1))
          expect(binding.sessionId).toBe(t6ChildSessionIdAt(i + 1))
        }
      }
    }
  })

  it('the member identity key round-trips: key → parse → same identity (N=5)', () => {
    const comp = buildAt(5)
    for (const identity of comp.identities) {
      const key = memberIdentityKey(identity)
      const back = parseMemberIdentityKey(key)
      expect(back).toEqual(identity)
    }
  })

  it('an identity cannot be asserted into a different TeamSession (IDENTITY_SCOPE_MISMATCH)', () => {
    const comp = buildAt(2)
    const foreignTeamSessionId = teamSessionIdOf(parseRootSessionId('session-team-root-2'))
    for (const identity of comp.identities) {
      expectCode(
        () => assertMemberIdentityInTeam(identity, foreignTeamSessionId),
        'IDENTITY_SCOPE_MISMATCH',
        'identity into foreign team',
      )
      expect(() => assertMemberIdentityInTeam(identity, comp.teamSessionId)).not.toThrow()
    }
  })

  it('N=0 is a valid composition: empty roster, one team-root binding', () => {
    const comp = buildAt(0)
    expect(comp.members.length).toBe(0)
    expect(comp.memberRecords.length).toBe(0)
    expect(comp.identities.length).toBe(0)
    expect(comp.bindings.length).toBe(1)
    const root = comp.bindings[0]
    expect(root !== undefined).toBe(true)
    if (root !== undefined) {
      expect(root.kind).toBe('team-root')
    }
  })

  it('runtime identity = (TeamSessionId, instanceId) with TeamSessionId = RootSessionId (invariants 9/18)', () => {
    const rand = mulberry32(20260829)
    for (let round = 0; round < 5; round++) {
      const n = 1 + Math.floor(rand() * 8)
      const comp = buildAt(n)
      expect(comp.teamSessionId).toBe(comp.rootSessionId)
      for (const identity of comp.identities) {
        expect(identity.rootSessionId).toBe(comp.teamSessionId)
        const canonical = {
          instanceId: identity.instanceId,
          rootSessionId: identity.rootSessionId,
        }
        expect(parseMemberIdentityKey(memberIdentityKey(canonical as unknown as MemberIdentity))).toEqual(
          identity,
        )
      }
    }
  })
})
