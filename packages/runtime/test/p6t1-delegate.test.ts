/**
 * P6-T1 S-delegate — the leader-delegate path (TaskDoc §11.7 P6-T1;
 * Architecture §11.2/§11.3, §24, invariants 18/24/25/26):
 *
 *  - D1 persistent template-level delegation with NO work-accepting instance
 *    creates a new member (activated, frozen contextPolicy 'persistent');
 *  - D2 persistent follow-up CONTINUES the unique work-accepting instance —
 *    same identity, same durable child Session (invariant 24), zero durable
 *    writes, no projection, no operationId on the closed `continued` result;
 *  - D3 fresh_per_delegation ALWAYS creates (invariant 25): two delegations
 *    yield two distinct instances with distinct child Sessions;
 *  - D4 explicit-instance addressing CONTINUES under ANY policy (M2) —
 *    identity alone, even under fresh_per_delegation;
 *  - D5/D6/D7 the loud target failures: unknown instance (MEMBER_NOT_FOUND),
 *    ambiguous template (DELEGATION_TARGET_AMBIGUOUS), disposed instance
 *    (DELEGATION_TARGET_DISPOSED) — each mapped to DELEGATION_TARGET_UNRESOLVED
 *    with the originating domain code in details, zero durable writes;
 *  - D8 a non-leader caller is refused (CALLER_AUTHORITY_DENIED) before any
 *    delegation resolution;
 *  - D9 the admit-once ruling: a same-token replay converges to the durable
 *    `activated` result with replayed:true (it NEVER becomes `continued` —
 *    the stable operation identity is derived before delegation resolution),
 *    with zero durable writes; fresh_per_delegation replays the SAME instance
 *    (a new logical delegation needs a new token).
 *
 * Mock-first (ruling R28); top-level-await snapshot pattern.
 *
 * @module @dsh-agent-team/runtime/test/p6t1-delegate
 */

import { describe, expect, it } from 'vitest'
import { ACTIVATION_ERROR_CODES } from '../activation/index.js'
import type { ActivationResult, MemberActivationRequest } from '../activation/index.js'
import { parseChildSessionId, parseInstanceId, parseTemplateId } from '../../contracts/src/index.js'
import {
  P6T1_FIXTURE,
  assertActivationCode,
  createP6T1World,
  destroyP6T1World,
  makeDelegateRequest,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

const SEED_WORKER = 'inst-p6t1seed0301'
const SEED_WORKER_CHILD = 'session-child-p6t1-deleg2'

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

function isContinued(result: ActivationResult | undefined): result is Extract<ActivationResult, { kind: 'continued' }> {
  return result !== undefined && result.kind === 'continued'
}

// ---------------------------------------------------------------------------
// D1 — persistent, no work-accepting instance → CREATE
// ---------------------------------------------------------------------------
let d1: { result: ActivationResult | undefined; error: unknown }
{
  const world = await createP6T1World('p6t1x-d1')
  try {
    d1 = await runActivate(world, makeDelegateRequest())
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 D1: persistent template-level delegation with no instance creates', () => {
  it('activates a new persistent member (never a continued)', () => {
    expect(d1.error).toBe(undefined)
    const result = d1.result
    if (result?.kind !== 'activated') {
      throw new Error(`D1: expected activated, got ${String(result)}`)
    }
    expect(result.source).toBe('leader-delegate')
    expect(result.templateId).toBe('worker')
    expect(result.contextPolicy).toBe('persistent')
    expect(result.replayed).toBe(false)
    expect(/^inst-[a-z0-9]{12}$/.test(result.instanceId)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// D2 — persistent follow-up → CONTINUE the unique work-accepting instance
// ---------------------------------------------------------------------------
let d2: {
  readonly result: ActivationResult | undefined
  readonly error: unknown
  readonly newWrites: number
  readonly projections: number
  readonly distinctChildren: number
}
{
  const world = await createP6T1World('p6t1x-d2', {
    seedMembers: [
      {
        instanceId: parseInstanceId(SEED_WORKER),
        templateId: parseTemplateId('worker'),
        label: 'existing-worker',
        childSessionId: parseChildSessionId(SEED_WORKER_CHILD),
      },
    ],
  })
  try {
    const before = world.seam.writeCount
    const run = await runActivate(world, makeDelegateRequest({ requestToken: 'tok-p6t1-continue' }))
    d2 = {
      result: run.result,
      error: run.error,
      newWrites: world.seam.writeCount - before,
      projections: world.projections.length,
      distinctChildren: world.childFactory.distinctChildren,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 D2: persistent follow-up CONTINUES the same instance and child Session (invariant 24)', () => {
  it('returns the closed continued result: same identity, same child Session', () => {
    expect(d2.error).toBe(undefined)
    const result = d2.result
    if (!isContinued(result)) {
      throw new Error(`D2: expected continued, got ${String(result)}`)
    }
    expect(result.instanceId).toBe(SEED_WORKER)
    expect(result.templateId).toBe('worker')
    expect(result.childSessionId).toBe(SEED_WORKER_CHILD)
    expect(result.contextPolicy).toBe('persistent')
    expect(result.workspace).toBe(P6T1_FIXTURE.defaultWorkspace)
    expect(result.source).toBe('leader-delegate')
  })

  it('performs ZERO durable writes and publishes NO projection (follow-up is read-only)', () => {
    expect(d2.newWrites).toBe(0)
    expect(d2.projections).toBe(0)
    expect(d2.distinctChildren).toBe(0)
  })

  it('carries NO operationId / projection / replayed on the continued result', () => {
    const result = d2.result
    if (!isContinued(result)) throw new Error('D2: missing continued result')
    expect('operationId' in result).toBe(false)
    expect('projection' in result).toBe(false)
    expect('replayed' in result).toBe(false)
    expect('admission' in result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// D3 — fresh_per_delegation ALWAYS creates (invariant 25)
// ---------------------------------------------------------------------------
let d3: {
  readonly first: ActivationResult | undefined
  readonly second: ActivationResult | undefined
  readonly error: unknown
  readonly distinctChildren: number
}
{
  const world = await createP6T1World('p6t1x-d3')
  try {
    const first = await runActivate(
      world,
      makeDelegateRequest({
        delegation: { templateId: String(P6T1_FIXTURE.scoutTemplateId) },
        requestToken: 'tok-p6t1-fresh-a',
      }),
    )
    const second = await runActivate(
      world,
      makeDelegateRequest({
        delegation: { templateId: String(P6T1_FIXTURE.scoutTemplateId) },
        requestToken: 'tok-p6t1-fresh-b',
      }),
    )
    d3 = {
      first: first.result,
      second: second.result,
      error: first.error ?? second.error,
      distinctChildren: world.childFactory.distinctChildren,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 D3: fresh_per_delegation creates a NEW instance per delegation (invariant 25)', () => {
  it('two delegations yield two distinct activated instances with distinct child Sessions', () => {
    expect(d3.error).toBe(undefined)
    const first = d3.first
    const second = d3.second
    if (first?.kind !== 'activated' || second?.kind !== 'activated') {
      throw new Error(`D3: expected two activated: ${String(first)} / ${String(second)}`)
    }
    expect(first.contextPolicy).toBe('fresh_per_delegation')
    expect(second.contextPolicy).toBe('fresh_per_delegation')
    expect(first.instanceId).not.toBe(second.instanceId)
    expect(first.childSessionId).not.toBe(second.childSessionId)
    expect(d3.distinctChildren).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// D4 — explicit-instance addressing CONTINUES under ANY policy (M2)
// ---------------------------------------------------------------------------
let d4: {
  readonly persistentContinue: { result: ActivationResult | undefined; error: unknown }
  readonly freshContinue: { result: ActivationResult | undefined; error: unknown }
  readonly newWrites: number
  readonly projections: number
}
{
  const world = await createP6T1World('p6t1x-d4', {
    seedMembers: [
      {
        instanceId: parseInstanceId(SEED_WORKER),
        templateId: parseTemplateId('worker'),
        label: 'existing-worker',
        childSessionId: parseChildSessionId(SEED_WORKER_CHILD),
      },
    ],
  })
  try {
    const before1 = world.seam.writeCount
    const persistentContinue = await runActivate(
      world,
      makeDelegateRequest({
        delegation: { explicitInstanceId: SEED_WORKER },
        requestToken: 'tok-p6t1-exp-p',
      }),
    )
    const writesPersistent = world.seam.writeCount - before1
    // M2: an explicit address continues even under a fresh_per_delegation
    // template — identity alone decides (§11.3, invariant 24).
    const freshSeed = 'inst-p6t1seed0402'
    await world.domain.repositories.memberInstances.put({
      rootSessionId: P6T1_FIXTURE.rootSessionId,
      instanceId: parseInstanceId(freshSeed),
      templateId: parseTemplateId(String(P6T1_FIXTURE.scoutTemplateId)),
      label: 'existing-scout',
      childSessionId: parseChildSessionId(`session-child-p6t1-${freshSeed.slice(5)}`),
      lifecycle: 'CREATED',
      createdAt: P6T1_FIXTURE.createdAt,
      activityVersion: 1,
    })
    const before2 = world.seam.writeCount
    const freshContinue = await runActivate(
      world,
      makeDelegateRequest({
        delegation: { explicitInstanceId: freshSeed },
        requestToken: 'tok-p6t1-exp-f',
      }),
    )
    const writesFresh = world.seam.writeCount - before2
    d4 = {
      persistentContinue,
      freshContinue,
      newWrites: writesPersistent + writesFresh,
      projections: world.projections.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 D4: explicit-instance addressing continues under ANY policy (M2)', () => {
  it('the persistent explicit address continues the addressed instance', () => {
    const run = d4.persistentContinue
    expect(run.error).toBe(undefined)
    const result = run.result
    if (!isContinued(result)) throw new Error(`D4p: expected continued, got ${String(result)}`)
    expect(result.instanceId).toBe(SEED_WORKER)
    expect(result.childSessionId).toBe(SEED_WORKER_CHILD)
  })

  it('a fresh_per_delegation explicit address ALSO continues (identity alone, invariant 24)', () => {
    const run = d4.freshContinue
    expect(run.error).toBe(undefined)
    const result = run.result
    if (!isContinued(result)) throw new Error(`D4f: expected continued, got ${String(result)}`)
    expect(result.templateId).toBe('scout')
    expect(result.contextPolicy).toBe('fresh_per_delegation')
    expect(result.instanceId).toBe('inst-p6t1seed0402')
  })

  it('both continuations are read-only (zero durable writes, no projections)', () => {
    expect(d4.newWrites).toBe(0)
    expect(d4.projections).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// D5 / D6 / D7 — the loud delegation-target failures
// ---------------------------------------------------------------------------
let d5: {
  readonly unknown: unknown
  readonly ambiguous: unknown
  readonly disposed: unknown
  readonly newWrites: number
  readonly projections: number
}
{
  const world = await createP6T1World('p6t1x-d5', {
    seedMembers: [
      {
        instanceId: parseInstanceId('inst-p6t1seed0501'),
        templateId: parseTemplateId('worker'),
        label: 'w1',
      },
      {
        instanceId: parseInstanceId('inst-p6t1seed0502'),
        templateId: parseTemplateId('worker'),
        label: 'w2',
      },
      {
        instanceId: parseInstanceId('inst-p6t1seed0503'),
        templateId: parseTemplateId('worker'),
        label: 'w-disposed',
        lifecycle: 'DISPOSED',
      },
    ],
  })
  try {
    const before = world.seam.writeCount
    const unknown = await runActivate(
      world,
      makeDelegateRequest({
        delegation: { explicitInstanceId: 'inst-p6t1nope9999' },
        requestToken: 'tok-p6t1-d5a',
      }),
    )
    const ambiguous = await runActivate(
      world,
      makeDelegateRequest({
        delegation: { templateId: 'worker' },
        requestToken: 'tok-p6t1-d5b',
      }),
    )
    const disposed = await runActivate(
      world,
      makeDelegateRequest({
        delegation: { explicitInstanceId: 'inst-p6t1seed0503' },
        requestToken: 'tok-p6t1-d5c',
      }),
    )
    d5 = {
      unknown: unknown.error,
      ambiguous: ambiguous.error,
      disposed: disposed.error,
      newWrites: world.seam.writeCount - before,
      projections: world.projections.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 D5-D7: loud delegation-target failures (zero durable writes)', () => {
  it('an unknown explicit instance is DELEGATION_TARGET_UNRESOLVED (MEMBER_NOT_FOUND)', () => {
    const code = assertActivationCode(d5.unknown, ACTIVATION_ERROR_CODES.DELEGATION_TARGET_UNRESOLVED)
    expect(code.details?.['code']).toBe('MEMBER_NOT_FOUND')
  })
  it('an ambiguous template (2 work-accepting instances) is DELEGATION_TARGET_UNRESOLVED (AMBIGUOUS)', () => {
    const code = assertActivationCode(d5.ambiguous, ACTIVATION_ERROR_CODES.DELEGATION_TARGET_UNRESOLVED)
    expect(code.details?.['code']).toBe('DELEGATION_TARGET_AMBIGUOUS')
  })
  it('an explicitly addressed DISPOSED instance is DELEGATION_TARGET_UNRESOLVED (DISPOSED)', () => {
    const code = assertActivationCode(d5.disposed, ACTIVATION_ERROR_CODES.DELEGATION_TARGET_UNRESOLVED)
    expect(code.details?.['code']).toBe('DELEGATION_TARGET_DISPOSED')
  })
  it('all three failures performed ZERO durable writes and no projections', () => {
    expect(d5.newWrites).toBe(0)
    expect(d5.projections).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// D8 — non-leader caller is refused before any delegation resolution
// ---------------------------------------------------------------------------
let d8: { error: unknown; newWrites: number }
{
  const world = await createP6T1World('p6t1x-d8')
  try {
    const before = world.seam.writeCount
    const run = await runActivate(
      world,
      makeDelegateRequest({ callerId: 'member-not-leader', requestToken: 'tok-p6t1-d8' }),
    )
    d8 = { error: run.error, newWrites: world.seam.writeCount - before }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 D8: delegation is a leader authority', () => {
  it('a non-leader caller gets CALLER_AUTHORITY_DENIED with zero durable writes', () => {
    assertActivationCode(d8.error, ACTIVATION_ERROR_CODES.CALLER_AUTHORITY_DENIED)
    expect(d8.newWrites).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// D9 — admit-once: same-token replay NEVER becomes `continued`
// ---------------------------------------------------------------------------
let d9: {
  readonly persistent: {
    first: ActivationResult | undefined
    second: ActivationResult | undefined
    error: unknown
    newWritesOnReplay: number
    projections: number
  }
  readonly fresh: {
    first: ActivationResult | undefined
    second: ActivationResult | undefined
    error: unknown
    newWritesOnReplay: number
  }
} = {
  persistent: {
    first: undefined,
    second: undefined,
    error: undefined,
    newWritesOnReplay: -1,
    projections: -1,
  },
  fresh: {
    first: undefined,
    second: undefined,
    error: undefined,
    newWritesOnReplay: -1,
  },
}
{
  const persistentWorld = await createP6T1World('p6t1x-d9p')
  try {
    const request = makeDelegateRequest()
    const first = await runActivate(persistentWorld, request)
    const beforeReplay = persistentWorld.seam.writeCount
    const second = await runActivate(persistentWorld, request)
    d9 = {
      persistent: {
        first: first.result,
        second: second.result,
        error: first.error ?? second.error,
        newWritesOnReplay: persistentWorld.seam.writeCount - beforeReplay,
        projections: persistentWorld.projections.length,
      },
      fresh: { first: undefined, second: undefined, error: undefined, newWritesOnReplay: -1 },
    }
  } finally {
    await destroyP6T1World(persistentWorld)
  }
  const freshWorld = await createP6T1World('p6t1x-d9f')
  try {
    const request = makeDelegateRequest({
      delegation: { templateId: String(P6T1_FIXTURE.scoutTemplateId) },
      requestToken: 'tok-p6t1-d9f',
    })
    const first = await runActivate(freshWorld, request)
    const beforeReplay = freshWorld.seam.writeCount
    const second = await runActivate(freshWorld, request)
    d9 = {
      ...d9,
      fresh: {
        first: first.result,
        second: second.result,
        error: first.error ?? second.error,
        newWritesOnReplay: freshWorld.seam.writeCount - beforeReplay,
      },
    }
  } finally {
    await destroyP6T1World(freshWorld)
  }
}

describe('P6-T1 D9: admit-once — a same-token replay converges to the durable activated fact', () => {
  it('persistent: replay is activated+replayed (NOT continued), same instance, zero writes', () => {
    expect(d9.persistent.error).toBe(undefined)
    const first = d9.persistent.first
    const second = d9.persistent.second
    if (first?.kind !== 'activated' || second?.kind !== 'activated') {
      throw new Error(
        `D9p: expected two activated results: ${String(first)} / ${String(second)}`,
      )
    }
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.instanceId).toBe(first.instanceId)
    expect(second.childSessionId).toBe(first.childSessionId)
    expect(d9.persistent.newWritesOnReplay).toBe(0)
    expect(d9.persistent.projections).toBe(2)
  })

  it('fresh_per_delegation: the same token replays the SAME instance (new logical op needs a new token)', () => {
    expect(d9.fresh.error).toBe(undefined)
    const first = d9.fresh.first
    const second = d9.fresh.second
    if (first?.kind !== 'activated' || second?.kind !== 'activated') {
      throw new Error(`D9f: expected two activated results: ${String(first)} / ${String(second)}`)
    }
    expect(second.replayed).toBe(true)
    expect(second.instanceId).toBe(first.instanceId)
    expect(second.contextPolicy).toBe('fresh_per_delegation')
    expect(d9.fresh.newWritesOnReplay).toBe(0)
  })
})
