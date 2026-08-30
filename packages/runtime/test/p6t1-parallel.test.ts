/**
 * P6-T1 S-parallel — same-template parallel activations (TaskDoc §11.7 P6-T1
 * MUST-TEST "same template parallel"; G6 gate preview: "same template N
 * simultaneous instances" and "quota race does not over-create"):
 *
 *  - P1 N=2 same-template parallel activations: both succeed, distinct
 *    instance ids / child Sessions, two COMMITTED operations;
 *  - P2 N=5 same-template parallel activations under a raised quota
 *    blueprint: all five succeed with five distinct instance ids /
 *    operation ids / child Sessions and five COMMITTED operations;
 *  - P3 the quota race under the fixture quotas (worker maxInstances = 2):
 *    N=5 parallel activations → EXACTLY two succeed, three fail
 *    QUOTA_MEMBER_MAX_INSTANCES, the final durable state holds EXACTLY two
 *    members (no over-create: the per-team lock serializes the durable
 *    section and every admission reads a fresh in-flight-aware view);
 *  - P4 uniqueness assertions over the P2 snapshot (pairwise distinct
 *    instance ids, operation ids, child Sessions).
 *
 * Mock-first (ruling R28); top-level-await snapshot pattern.
 *
 * @module @dsh-agent-team/runtime/test/p6t1-parallel
 */

import { describe, expect, it } from 'vitest'
import { ACTIVATION_ERROR_CODES } from '../activation/index.js'
import type { ActivationResult, MemberActivationRequest } from '../activation/index.js'
import { OPERATION_PHASES } from '../../storage/schema/index.js'
import {
  P6T1_FIXTURE,
  assertActivationCode,
  createP6T1World,
  destroyP6T1World,
  makeRequest,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

const ROOT = String(P6T1_FIXTURE.rootSessionId)

/** The fixture blueprint with the quotas raised so N=5 may all admit. */
const P6T1_BLUEPRINT_SOURCE_RAISED_QUOTAS = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P6T1-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P6T1 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P6T1 work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P6T1 team.',
  '    contextPolicy: fresh_per_delegation',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow:',
  '    - create-member',
  '    - assign-task',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - web.search',
  '      deny: []',
  '  - templateId: scout',
  '    envelope:',
  '      allow: []',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P6T1 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 6',
  '    maxConcurrent: 5',
  '  members:',
  '    maxInstances: 5',
  'metadata: {}',
  '---',
  '',
].join('\n')

async function runActivate(
  world: P6T1World,
  request: MemberActivationRequest,
): Promise<{ result: ActivationResult | undefined; error: unknown }> {
  try {
    return { result: await world.provider.activate(request), error: undefined }
  } catch (error) {
    return { result: undefined, error }
  }
}

interface ParallelOutcome {
  readonly results: Extract<ActivationResult, { kind: 'activated' }>[]
  readonly errors: unknown[]
  readonly committedOps: number
  readonly memberCount: number
  readonly distinctChildren: number
}

async function runParallel(
  world: P6T1World,
  tokens: string[],
): Promise<ParallelOutcome> {
  const runs = await Promise.all(
    tokens.map((token) => runActivate(world, makeRequest({ requestToken: token }))),
  )
  const results: Extract<ActivationResult, { kind: 'activated' }>[] = []
  const errors: unknown[] = []
  for (const run of runs) {
    if (run.error !== undefined) {
      errors.push(run.error)
    } else if (run.result?.kind === 'activated') {
      results.push(run.result)
    }
  }
  const committedOps = world.domain
    .repositories.operations.list()
    .filter((op) => op.phase === OPERATION_PHASES.COMMITTED).length
  return {
    results,
    errors,
    committedOps,
    memberCount: world.domain.repositories.memberInstances.list(ROOT).length,
    distinctChildren: world.childFactory.distinctChildren,
  }
}

// ---------------------------------------------------------------------------
// P1 — N=2 same-template parallel
// ---------------------------------------------------------------------------
let p1: ParallelOutcome | undefined
{
  const world = await createP6T1World('p6t1x-p1')
  try {
    p1 = await runParallel(world, ['tok-p6t1-par-a', 'tok-p6t1-par-b'])
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 P1: N=2 same-template parallel activations both succeed', () => {
  it('two activated results with distinct instance ids and child Sessions', () => {
    expect(p1?.errors.length).toBe(0)
    expect(p1?.results.length).toBe(2)
    if (p1 === undefined) throw new Error('P1: missing snapshot')
    const a = p1.results[0]
    const b = p1.results[1]
    if (a === undefined || b === undefined) throw new Error('P1: expected two results')
    expect(a.instanceId).not.toBe(b.instanceId)
    expect(a.childSessionId).not.toBe(b.childSessionId)
    expect(a.templateId).toBe('worker')
    expect(b.templateId).toBe('worker')
  })

  it('two COMMITTED operations, two members, two distinct child Sessions', () => {
    expect(p1?.committedOps).toBe(2)
    expect(p1?.memberCount).toBe(2)
    expect(p1?.distinctChildren).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// P2 — N=5 same-template parallel under raised quotas (all succeed)
// ---------------------------------------------------------------------------
let p2: ParallelOutcome | undefined
{
  const world = await createP6T1World('p6t1x-p2', {
    blueprintSource: P6T1_BLUEPRINT_SOURCE_RAISED_QUOTAS,
  })
  try {
    p2 = await runParallel(
      world,
      ['tok-p6t1-p2-1', 'tok-p6t1-p2-2', 'tok-p6t1-p2-3', 'tok-p6t1-p2-4', 'tok-p6t1-p2-5'],
    )
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 P2: N=5 same-template parallel activations all succeed (raised quotas)', () => {
  it('five activated results, five COMMITTED operations, five members, five child Sessions', () => {
    expect(p2?.errors.length).toBe(0)
    expect(p2?.results.length).toBe(5)
    if (p2 === undefined) throw new Error('P2: missing snapshot')
    expect(p2.committedOps).toBe(5)
    expect(p2.memberCount).toBe(5)
    expect(p2.distinctChildren).toBe(5)
    for (const result of p2.results) {
      expect(result.replayed).toBe(false)
      expect(result.templateId).toBe('worker')
    }
  })
})

// ---------------------------------------------------------------------------
// P3 — the quota race (fixture quotas: worker maxInstances = 2)
// ---------------------------------------------------------------------------
let p3: ParallelOutcome | undefined
{
  const world = await createP6T1World('p6t1x-p3')
  try {
    p3 = await runParallel(
      world,
      ['tok-p6t1-p3-1', 'tok-p6t1-p3-2', 'tok-p6t1-p3-3', 'tok-p6t1-p3-4', 'tok-p6t1-p3-5'],
    )
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 P3: the quota race — five parallel, two may admit (no over-create)', () => {
  it('exactly two activations succeed', () => {
    expect(p3?.results.length).toBe(2)
  })

  it('exactly three fail QUOTA_MEMBER_MAX_INSTANCES (the binding fixture quota)', () => {
    expect(p3?.errors.length).toBe(3)
    if (p3 === undefined) throw new Error('P3: missing snapshot')
    for (const error of p3.errors) {
      assertActivationCode(error, ACTIVATION_ERROR_CODES.QUOTA_MEMBER_MAX_INSTANCES)
    }
  })

  it('the final durable state holds EXACTLY two members and two COMMITTED operations', () => {
    expect(p3?.memberCount).toBe(2)
    expect(p3?.committedOps).toBe(2)
    expect(p3?.distinctChildren).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// P4 — uniqueness over the P2 snapshot
// ---------------------------------------------------------------------------
describe('P6-T1 P4: every parallel instance is uniquely addressed (invariants 17/18)', () => {
  it('the five P2 instance ids are pairwise distinct', () => {
    if (p2 === undefined) throw new Error('P4: missing P2 snapshot')
    const ids = p2.results.map((r) => r.instanceId)
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        expect(ids[i]).not.toBe(ids[j])
      }
    }
  })

  it('the five P2 operation ids are pairwise distinct', () => {
    if (p2 === undefined) throw new Error('P4: missing P2 snapshot')
    const ops = p2.results.map((r) => r.operationId)
    for (let i = 0; i < ops.length; i += 1) {
      for (let j = i + 1; j < ops.length; j += 1) {
        expect(ops[i]).not.toBe(ops[j])
      }
    }
  })

  it('the five P2 child Sessions are pairwise distinct', () => {
    if (p2 === undefined) throw new Error('P4: missing P2 snapshot')
    const children = p2.results.map((r) => r.childSessionId)
    for (let i = 0; i < children.length; i += 1) {
      for (let j = i + 1; j < children.length; j += 1) {
        expect(children[i]).not.toBe(children[j])
      }
    }
  })
})
