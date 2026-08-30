/**
 * P5-T6 evict + re-admit — the SETTLED-residency eviction (TaskDoc §11.5
 * P5-T6 card; ruling R34): evicting a SETTLED member drops ONLY the
 * ephemeral Agent residency (the durable records are NEVER deleted —
 * Architecture §16/§31: lifecycle != residency), the non-SETTLED
 * fail-closed matrix, the unknown-member no-effect, the re-admit = cold
 * path (idempotent, no durable duplication), and the unit-level negative
 * proof that a member is NOT a continuable subagent (no subagent channel
 * in any injected handle; every emitted event stays inside the
 * `agent-setup/*` vocabulary — the p4t6 scanner's negative control).
 *
 * Mock-first (ruling R28): the agent-runtime boundary is the P5-T1
 * `FakeAgentSetupSurface` + the P5-T6 `FakeResidencyPort`; the durable
 * layer is REAL (P4 repositories over the testkit `FileStorageSeam`).
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are
 * synchronous): every async scenario is executed at module top level,
 * its observables captured into a plain snapshot, the world destroyed in
 * `finally`; the `it` bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p5t6-evict-readmit
 */

import { describe, expect, it } from 'vitest'
import { AGENT_SETUP_EVENT_NAMES } from '../agent-setup/binder/index.js'
import {
  MEMBER_RESIDENCY_ERROR_CODES,
  createFreshMember,
  deriveMemberIdentity,
  evictSettledMember,
  rehydrateColdMember,
  isMemberResidencyError,
} from '../member-residency/index.js'
import type {
  EvictSettledMemberResult,
  MemberResidencyPorts,
} from '../member-residency/index.js'
import {
  P5T6_FIXTURE,
  P5T6_SPEC_A,
  createMemberResidencyWorld,
  destroyWorld,
} from './p5t6-helpers.js'
import type { P5T6World, P5T6WriteCall } from './p5t6-helpers.js'

const ROOT = String(P5T6_FIXTURE.rootSessionId)
const IDENTITY_A = deriveMemberIdentity(P5T6_SPEC_A)
const CHILD_A = IDENTITY_A.childSessionId
const INSTANCE_A = IDENTITY_A.instanceId

async function runEvict(
  world: P5T6World,
  rootSessionId: string,
  instanceId: string,
  ports?: MemberResidencyPorts,
): Promise<{ result: EvictSettledMemberResult | undefined; error: unknown }> {
  try {
    const result = await evictSettledMember(ports ?? world.ports, { rootSessionId, instanceId })
    return { result, error: undefined }
  } catch (error) {
    return { result: undefined, error }
  }
}

/** The function names exposed by one injected handle (own + prototype). */
function publicMethodNames(handle: object): string[] {
  const names = new Set<string>()
  let proto: object | null = handle
  while (proto !== null && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue
      const value = (proto as Record<string, unknown>)[name]
      if (typeof value === 'function') names.add(name)
    }
    proto = Object.getPrototypeOf(proto)
  }
  return [...names].sort()
}

// ---------------------------------------------------------------------------
// E1 — evict a SETTLED member with live residency
// ---------------------------------------------------------------------------
let e1: {
  readonly error: unknown
  readonly path: string | undefined
  readonly residencyDropped: boolean | undefined
  readonly memberLifecycleAfter: string | undefined
  readonly memberActivityVersionAfter: number | undefined
  readonly memberCountAfter: number
  readonly bindingKindAfter: string | undefined
  readonly residencyAfter: boolean
  readonly residencyDropCount: number
  readonly writeCalls: readonly P5T6WriteCall[]
  readonly surfaceCallCount: number
}
{
  const world = await createMemberResidencyWorld('p5t6-e1', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A, lifecycle: 'SETTLED' },
  })
  try {
    world.residency.setResidency(CHILD_A, true)
    const { result, error } = await runEvict(world, ROOT, INSTANCE_A)
    const record = world.domain.repositories.memberInstances.get(ROOT, INSTANCE_A)
    e1 = {
      error,
      path: result?.path,
      residencyDropped: result?.residencyDropped,
      memberLifecycleAfter: record?.lifecycle,
      memberActivityVersionAfter: record?.activityVersion,
      memberCountAfter: world.domain.repositories.memberInstances.list(ROOT).length,
      bindingKindAfter: world.domain.repositories.sessionBindings.get(CHILD_A)?.kind,
      residencyAfter: world.residency.hasResidency(CHILD_A),
      residencyDropCount: world.residency.calls.filter((call) => call.method === 'dropResidency').length,
      writeCalls: [...world.writeCalls],
      surfaceCallCount: world.surface.calls.length,
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// E2 — evict a SETTLED member WITHOUT live residency (handle may be absent)
// ---------------------------------------------------------------------------
let e2: {
  readonly error: unknown
  readonly path: string | undefined
  readonly residencyDropped: boolean | undefined
  readonly residencyAfter: boolean
  readonly memberCountAfter: number
  readonly writeCalls: readonly P5T6WriteCall[]
  readonly surfaceCallCount: number
}
{
  const world = await createMemberResidencyWorld('p5t6-e2', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A, lifecycle: 'SETTLED' },
  })
  try {
    const { result, error } = await runEvict(world, ROOT, INSTANCE_A)
    e2 = {
      error,
      path: result?.path,
      residencyDropped: result?.residencyDropped,
      residencyAfter: world.residency.hasResidency(CHILD_A),
      memberCountAfter: world.domain.repositories.memberInstances.list(ROOT).length,
      writeCalls: [...world.writeCalls],
      surfaceCallCount: world.surface.calls.length,
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// E3 — non-SETTLED lifecycle: fail-closed, residency untouched
// ---------------------------------------------------------------------------
const E3_LIFECYCLES = ['RUNNING', 'CREATED', 'ARCHIVED', 'DISPOSED'] as const
let e3: Array<{
  readonly lifecycle: string
  readonly error: unknown
  readonly residencyAfter: boolean
  readonly surfaceCallCount: number
  readonly writeCallsCount: number
  readonly expectResultUndefined: boolean
}> = []
for (const lifecycle of E3_LIFECYCLES) {
  const world = await createMemberResidencyWorld('p5t6-e3-' + lifecycle.toLowerCase(), {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A, lifecycle },
  })
  try {
    world.residency.setResidency(CHILD_A, true)
    const { result, error } = await runEvict(world, ROOT, INSTANCE_A)
    e3.push({
      lifecycle,
      error,
      residencyAfter: world.residency.hasResidency(CHILD_A),
      surfaceCallCount: world.surface.calls.length,
      writeCallsCount: world.writeCalls.length,
      expectResultUndefined: result === undefined,
    })
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// E4 — unknown member: MEMBER_NOT_FOUND, zero effects
// ---------------------------------------------------------------------------
let e4: {
  readonly error: unknown
  readonly residencyCallCount: number
  readonly writeCalls: readonly P5T6WriteCall[]
  readonly surfaceCallCount: number
  readonly expectResultUndefined: boolean
}
{
  const world = await createMemberResidencyWorld('p5t6-e4', { seedBoundRoot: true })
  try {
    const { result, error } = await runEvict(world, ROOT, INSTANCE_A)
    e4 = {
      error,
      residencyCallCount: world.residency.calls.length,
      writeCalls: [...world.writeCalls],
      surfaceCallCount: world.surface.calls.length,
      expectResultUndefined: result === undefined,
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// E5 — re-admit after evict = the cold path (idempotent, no duplication)
// ---------------------------------------------------------------------------
let e5: {
  readonly evictError: unknown
  readonly evictResidencyDropped: boolean | undefined
  readonly cold1: {
    readonly error: unknown
    readonly wrote: boolean | undefined
    readonly installed: boolean | undefined
    readonly admitted: boolean | undefined
    readonly noopReason: string | undefined
  }
  readonly cold2: {
    readonly error: unknown
    readonly wrote: boolean | undefined
    readonly installed: boolean | undefined
    readonly admitted: boolean | undefined
    readonly noopReason: string | undefined
  }
  readonly memberCountAfter: number
  readonly memberBindingRows: number
  readonly restoreScopeCount: number
  readonly writeCalls: readonly P5T6WriteCall[]
}
{
  const world = await createMemberResidencyWorld('p5t6-e5', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A, lifecycle: 'SETTLED' },
  })
  let evict: { result: EvictSettledMemberResult | undefined; error: unknown } = {
    result: undefined,
    error: undefined,
  }
  try {
    world.residency.setResidency(CHILD_A, true)
    evict = await runEvict(world, ROOT, INSTANCE_A)
    const cold1Result = await rehydrateColdMember(world.ports, {
      rootSessionId: ROOT,
      instanceId: INSTANCE_A,
    })
    const cold2Result = await rehydrateColdMember(world.ports, {
      rootSessionId: ROOT,
      instanceId: INSTANCE_A,
    })
    e5 = {
      evictError: evict.error,
      evictResidencyDropped: evict.result?.residencyDropped,
      cold1: {
        error: undefined,
        wrote: cold1Result.durable?.wrote,
        installed: cold1Result.bind?.installed,
        admitted: cold1Result.bind?.admitted,
        noopReason: cold1Result.noopReason,
      },
      cold2: {
        error: undefined,
        wrote: cold2Result.durable?.wrote,
        installed: cold2Result.bind?.installed,
        admitted: cold2Result.bind?.admitted,
        noopReason: cold2Result.noopReason,
      },
      memberCountAfter: world.domain.repositories.memberInstances.list(ROOT).length,
      memberBindingRows: world.domain.repositories.sessionBindings
        .listByKind('team-member')
        .filter((row) => String(row.sessionId) === CHILD_A).length,
      restoreScopeCount: world.surface.countCalls('restoreScope', CHILD_A),
      writeCalls: [...world.writeCalls],
    }
  } catch (error) {
    // A cold-path failure breaks the whole scenario: capture it in BOTH
    // cold slots so the assertions fail loudly.
    e5 = {
      evictError: evict.error,
      evictResidencyDropped: evict.result?.residencyDropped,
      cold1: { error, wrote: undefined, installed: undefined, admitted: undefined, noopReason: undefined },
      cold2: { error, wrote: undefined, installed: undefined, admitted: undefined, noopReason: undefined },
      memberCountAfter: world.domain.repositories.memberInstances.list(ROOT).length,
      memberBindingRows: 0,
      restoreScopeCount: 0,
      writeCalls: [...world.writeCalls],
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// E6 — negative: a member is NOT a continuable subagent (unit level)
// ---------------------------------------------------------------------------
let e6: {
  readonly freshError: unknown
  readonly coldError: unknown
  readonly handleMethodNames: readonly string[]
  readonly subagentChannels: readonly string[]
  readonly eventNames: readonly string[]
  readonly outsideSetupVocabulary: readonly string[]
}
{
  const world = await createMemberResidencyWorld('p5t6-e6', { seedBoundRoot: true })
  try {
    let freshError: unknown
    try {
      await createFreshMember(world.ports, P5T6_SPEC_A)
    } catch (error) {
      freshError = error
    }
    let coldError: unknown
    try {
      await rehydrateColdMember(world.ports, { rootSessionId: ROOT, instanceId: INSTANCE_A })
    } catch (error) {
      coldError = error
    }
    const handleMethodNames = [
      ...publicMethodNames(world.ports.writes),
      ...publicMethodNames(world.surface),
      ...publicMethodNames(world.residency),
    ].sort()
    const subagentChannels = handleMethodNames.filter((name) => /subagent/i.test(name))
    const eventNames = world.surface.eventsFor(CHILD_A).map((event) => event.name)
    const vocabulary = new Set<string>(Object.values(AGENT_SETUP_EVENT_NAMES))
    const outsideSetupVocabulary = eventNames.filter((name) => !vocabulary.has(name))
    e6 = {
      freshError,
      coldError,
      handleMethodNames,
      subagentChannels,
      eventNames,
      outsideSetupVocabulary,
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
describe('P5-T6 E1: evict a SETTLED member with live residency', () => {
  it('drops the residency and leaves every durable record intact (zero writes)', () => {
    expect(e1.error).toBe(undefined)
    expect(e1.path).toBe('evict-settled')
    expect(e1.residencyDropped).toBe(true)
    expect(e1.residencyAfter).toBe(false)
    expect(e1.residencyDropCount).toBe(1)

    // The durable records are NOT deleted (SETTLED keeps the record;
    // eviction is a residency operation, not a lifecycle operation).
    expect(e1.memberLifecycleAfter).toBe('SETTLED')
    expect(e1.memberActivityVersionAfter).toBe(1)
    expect(e1.memberCountAfter).toBe(1)
    expect(e1.bindingKindAfter).toBe('team-member')

    // Zero writes, and eviction is not a bind path: no surface event.
    expect(e1.writeCalls.length).toBe(0)
    expect(e1.surfaceCallCount).toBe(0)
  })
})

describe('P5-T6 E2: evict a SETTLED member without live residency', () => {
  it('succeeds with residencyDropped false (the handle may be absent)', () => {
    expect(e2.error).toBe(undefined)
    expect(e2.path).toBe('evict-settled')
    expect(e2.residencyDropped).toBe(false)
    expect(e2.residencyAfter).toBe(false)
    expect(e2.memberCountAfter).toBe(1)
    expect(e2.writeCalls.length).toBe(0)
    expect(e2.surfaceCallCount).toBe(0)
  })
})

describe('P5-T6 E3: non-SETTLED lifecycle is fail-closed', () => {
  it('throws LIFECYCLE_CONFLICT (details.lifecycle) and leaves the residency untouched', () => {
    expect(e3.length).toBe(E3_LIFECYCLES.length)
    for (const entry of e3) {
      expect(isMemberResidencyError(entry.error)).toBe(true)
      const err = entry.error as { code: string; details: Record<string, unknown> }
      expect(err.code).toBe(MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_LIFECYCLE_CONFLICT)
      expect(err.details.lifecycle).toBe(entry.lifecycle)
      expect(entry.expectResultUndefined).toBe(true)
      // The residency was seeded live and must still be live (untouched).
      expect(entry.residencyAfter).toBe(true)
      expect(entry.surfaceCallCount).toBe(0)
      expect(entry.writeCallsCount).toBe(0)
    }
  })
})

describe('P5-T6 E4: unknown member is MEMBER_NOT_FOUND with zero effects', () => {
  it('throws before touching residency, surface, or durable writes', () => {
    expect(isMemberResidencyError(e4.error)).toBe(true)
    expect((e4.error as { code: string }).code).toBe(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_MEMBER_NOT_FOUND,
    )
    expect(e4.expectResultUndefined).toBe(true)
    expect(e4.residencyCallCount).toBe(0)
    expect(e4.writeCalls.length).toBe(0)
    expect(e4.surfaceCallCount).toBe(0)
  })
})

describe('P5-T6 E5: re-admit after evict is the cold path (idempotent)', () => {
  it('re-attaches twice with zero durable writes and no row duplication', () => {
    expect(e5.evictError).toBe(undefined)
    expect(e5.evictResidencyDropped).toBe(true)

    // Both re-admits succeed through the cold path (wrote=false: the cold
    // path never writes; installed=true: the scope was restored).
    expect(e5.cold1.error).toBe(undefined)
    expect(e5.cold1.noopReason).toBe(undefined)
    expect(e5.cold1.wrote).toBe(false)
    expect(e5.cold1.installed).toBe(true)
    expect(e5.cold1.admitted).toBe(true)
    expect(e5.cold2.error).toBe(undefined)
    expect(e5.cold2.noopReason).toBe(undefined)
    expect(e5.cold2.wrote).toBe(false)
    expect(e5.cold2.installed).toBe(true)
    expect(e5.cold2.admitted).toBe(true)

    // No durable duplication: exactly one member row and one binding row.
    expect(e5.memberCountAfter).toBe(1)
    expect(e5.memberBindingRows).toBe(1)

    // Each re-admit restored the scope once; nothing was written.
    expect(e5.restoreScopeCount).toBe(2)
    expect(e5.writeCalls.length).toBe(0)
  })
})

describe('P5-T6 E6: a member is NOT a continuable subagent (unit level)', () => {
  it('exposes no subagent channel on any injected handle', () => {
    expect(e6.freshError).toBe(undefined)
    expect(e6.coldError).toBe(undefined)
    expect(e6.subagentChannels.length).toBe(0)
  })

  it('emits only the agent-setup/* vocabulary (p4t6 negative control)', () => {
    // The fresh path emits 4 events (3 overlay-installed + admission-
    // decided); the cold re-admit emits 2 (scope-restored +
    // admission-decided) — every one inside the frozen vocabulary.
    expect(e6.eventNames.length).toBe(6)
    expect(e6.outsideSetupVocabulary.length).toBe(0)
  })
})
