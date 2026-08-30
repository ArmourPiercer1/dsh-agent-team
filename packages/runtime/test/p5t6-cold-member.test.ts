/**
 * P5-T6 cold member — the cold-resume path (TaskDoc §11.5 P5-T6 card;
 * ruling R34): rehydrate from durable records (TeamDomain read handle +
 * the binder's cold-member path: `restoreScope` once with the full member
 * scope, admission re-decided) with ZERO fresh-time side effects, ZERO
 * durable writes, the absent-record no-op, the fail-closed binding
 * pre-check (orphan record / mismatched binding identity), the DISPOSED
 * propagation, the rejecting-guard cold admission, and the local token
 * mirror's byte-equivalence with the storage `deterministicToken`.
 *
 * Mock-first (ruling R28): the agent-runtime boundary is the P5-T1
 * `FakeAgentSetupSurface`; the durable layer is REAL (P4 repositories
 * over the testkit `FileStorageSeam`, the real read-handle projection,
 * the real write-port adapter wrapped in a recording proxy — the cold
 * path must never touch it).
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are
 * synchronous): every async scenario is executed at module top level,
 * its observables captured into a plain snapshot, the world destroyed in
 * `finally`; the `it` bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p5t6-cold-member
 */

import { describe, expect, it } from 'vitest'
import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  TEAM_AGENT_BINDER_ERROR_CODES,
  isTeamAgentBinderError,
} from '../agent-setup/binder/index.js'
import type { RestoredScope } from '../agent-setup/binder/index.js'
import {
  MEMBER_RESIDENCY_ERROR_CODES,
  deriveMemberIdentity,
  memberResidencyToken,
  rehydrateColdMember,
  isMemberResidencyError,
} from '../member-residency/index.js'
import type { ColdMemberResult, MemberResidencyPorts } from '../member-residency/index.js'
import { deterministicToken } from '../../storage/provisioning/identity.js'
import {
  P5T6_FIXTURE,
  P5T6_SPEC_A,
  P5T6_SPEC_B,
  createMemberResidencyWorld,
  destroyWorld,
  restartMemberResidencyWorld,
} from './p5t6-helpers.js'
import type { P5T6World, P5T6WriteCall } from './p5t6-helpers.js'
import { recordingSlot, rejectingGuard } from './p5t1-helpers.js'

const ROOT = String(P5T6_FIXTURE.rootSessionId)
const IDENTITY_A = deriveMemberIdentity(P5T6_SPEC_A)
const CHILD_A = IDENTITY_A.childSessionId
const INSTANCE_A = IDENTITY_A.instanceId
const IDENTITY_B = deriveMemberIdentity(P5T6_SPEC_B)
const INSTANCE_B = IDENTITY_B.instanceId

/** The plain view of a durable MemberInstance record (snapshot data). */
interface MemberView {
  readonly schemaVersion: number | undefined
  readonly instanceId: string | undefined
  readonly templateId: string | undefined
  readonly label: string | undefined
  readonly groupId: string | undefined
  readonly childSessionId: string | undefined
  readonly workspace: string | undefined
  readonly lifecycle: string | undefined
  readonly createdAt: string | undefined
  readonly activityVersion: number | undefined
}

function memberView(record: unknown): MemberView | undefined {
  if (record === undefined) return undefined
  const r = record as {
    schemaVersion?: number
    instanceId?: string
    templateId?: string
    label?: string
    groupId?: string
    childSessionId?: string
    workspace?: string
    lifecycle?: string
    createdAt?: string
    activityVersion?: number
  }
  return {
    schemaVersion: r.schemaVersion,
    instanceId: r.instanceId === undefined ? undefined : String(r.instanceId),
    templateId: r.templateId === undefined ? undefined : String(r.templateId),
    label: r.label,
    groupId: r.groupId,
    childSessionId: r.childSessionId === undefined ? undefined : String(r.childSessionId),
    workspace: r.workspace,
    lifecycle: r.lifecycle,
    createdAt: r.createdAt,
    activityVersion: r.activityVersion,
  }
}

/** The plain view of a durable session binding row (snapshot data). */
interface BindingView {
  readonly kind: string | undefined
  readonly sessionId: string | undefined
  readonly rootSessionId: string | undefined
  readonly instanceId: string | undefined
}

function bindingView(binding: unknown): BindingView {
  if (binding === undefined) {
    return { kind: undefined, sessionId: undefined, rootSessionId: undefined, instanceId: undefined }
  }
  const b = binding as {
    kind: string
    sessionId: string
    rootSessionId?: string
    instanceId?: string
  }
  if (b.kind === 'team-member') {
    return {
      kind: b.kind,
      sessionId: String(b.sessionId),
      rootSessionId: b.rootSessionId === undefined ? undefined : String(b.rootSessionId),
      instanceId: b.instanceId === undefined ? undefined : String(b.instanceId),
    }
  }
  return { kind: b.kind, sessionId: String(b.sessionId), rootSessionId: undefined, instanceId: undefined }
}

/** One captured cold-scenario observable bundle (plain data only). */
interface ColdSnapshot {
  readonly result: ColdMemberResult | undefined
  readonly error: unknown
  readonly member: MemberView | undefined
  readonly memberCount: number
  readonly binding: BindingView
  readonly writeCalls: readonly P5T6WriteCall[]
  readonly restoreScopeCount: number
  readonly restoreScope: RestoredScope | undefined
  readonly installOverlayCount: number
  readonly surfaceCallCount: number
  readonly eventNames: readonly string[]
  readonly eventDetails: readonly (string | undefined)[]
  readonly bound: boolean | undefined
  readonly installed: boolean | undefined
  readonly noopReason: string | undefined
  readonly admitted: boolean | undefined
  readonly admissionCode: string | undefined
  readonly identity: {
    readonly kind: string | undefined
    readonly sessionId: string | undefined
    readonly rootSessionId: string | undefined
    readonly instanceId: string | undefined
  } | undefined
}

function coldSnapshot(
  world: P5T6World,
  childSessionId: string,
  result: ColdMemberResult | undefined,
  error: unknown,
): ColdSnapshot {
  const record = world.domain.repositories.memberInstances.list(ROOT).find(
    (row) => String(row.childSessionId) === childSessionId,
  )
  const restoreCall = world.surface.calls.find((call) => call.method === 'restoreScope')
  const identity =
    result !== undefined && result.bind !== undefined && result.bind.identity !== undefined
      ? result.bind.identity
      : undefined
  return {
    result,
    error,
    member: memberView(record),
    memberCount: world.domain.repositories.memberInstances.list(ROOT).length,
    binding: bindingView(world.domain.repositories.sessionBindings.get(childSessionId)),
    writeCalls: [...world.writeCalls],
    restoreScopeCount: world.surface.countCalls('restoreScope', childSessionId),
    restoreScope: restoreCall?.scope,
    installOverlayCount: world.surface.countCalls('installOverlay', childSessionId),
    surfaceCallCount: world.surface.calls.length,
    eventNames: world.surface.eventsFor(childSessionId).map((event) => event.name),
    eventDetails: world.surface.eventsFor(childSessionId).map((event) => event.detail),
    bound: result?.bind?.bound,
    installed: result?.bind?.installed,
    noopReason: result?.noopReason,
    admitted: result?.bind?.admitted,
    admissionCode: result?.bind?.admissionCode,
    identity:
      identity === undefined
        ? undefined
        : {
            kind: identity.kind,
            sessionId: identity.sessionId,
            rootSessionId: identity.rootSessionId,
            instanceId: identity.instanceId === undefined ? undefined : String(identity.instanceId),
          },
  }
}

async function runCold(
  world: P5T6World,
  rootSessionId: string,
  instanceId: string,
  ports?: MemberResidencyPorts,
): Promise<{ result: ColdMemberResult | undefined; error: unknown }> {
  try {
    const result = await rehydrateColdMember(ports ?? world.ports, { rootSessionId, instanceId })
    return { result, error: undefined }
  } catch (error) {
    return { result: undefined, error }
  }
}

// ---------------------------------------------------------------------------
// C1 — cold resume after a process restart (the canonical flow)
// ---------------------------------------------------------------------------
let c1: ColdSnapshot
{
  const world = await createMemberResidencyWorld('p5t6-c1', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A },
  })
  let worldForCleanup: P5T6World = world
  try {
    // The process restart: fresh surface + fresh residency port, the SAME
    // durable TeamDomain (the real seam re-opened over the same dir).
    const restarted = await restartMemberResidencyWorld(world)
    worldForCleanup = restarted
    const { result, error } = await runCold(restarted, ROOT, INSTANCE_A)
    c1 = coldSnapshot(restarted, CHILD_A, result, error)
  } finally {
    await destroyWorld(worldForCleanup)
  }
}

// ---------------------------------------------------------------------------
// C2 — zero fresh-time side effects (no slot apply, no overlay install)
// ---------------------------------------------------------------------------
let c2: {
  readonly error: unknown
  readonly personaApplied: number
  readonly modelApplied: number
  readonly capabilityApplied: number
  readonly installOverlayCount: number
  readonly restoreScopeCount: number
  readonly admitted: boolean | undefined
  readonly writeCalls: readonly P5T6WriteCall[]
}
{
  const world = await createMemberResidencyWorld('p5t6-c2', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A },
  })
  try {
    const persona = recordingSlot('persona')
    const model = recordingSlot('model')
    const capability = recordingSlot('capability')
    const coldPorts: MemberResidencyPorts = {
      ...world.ports,
      slots: { persona, model, capability },
    }
    const { result, error } = await runCold(world, ROOT, INSTANCE_A, coldPorts)
    c2 = {
      error,
      personaApplied: persona.applied.length,
      modelApplied: model.applied.length,
      capabilityApplied: capability.applied.length,
      installOverlayCount: world.surface.countCalls('installOverlay', CHILD_A),
      restoreScopeCount: world.surface.countCalls('restoreScope', CHILD_A),
      admitted: result?.bind?.admitted,
      writeCalls: [...world.writeCalls],
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// C3 — absent member: the zero-record, zero-effect no-op
// ---------------------------------------------------------------------------
let c3: {
  readonly error: unknown
  readonly path: string | undefined
  readonly noopReason: string | undefined
  readonly durablePresent: boolean
  readonly bindPresent: boolean
  readonly surfaceCallCount: number
  readonly writeCalls: readonly P5T6WriteCall[]
  readonly bindingPresent: boolean
  readonly memberCount: number
}
{
  const world = await createMemberResidencyWorld('p5t6-c3', { seedBoundRoot: true })
  try {
    const { result, error } = await runCold(world, ROOT, INSTANCE_A)
    c3 = {
      error,
      path: result?.path,
      noopReason: result?.noopReason,
      durablePresent: result !== undefined && result.durable !== undefined,
      bindPresent: result !== undefined && result.bind !== undefined,
      surfaceCallCount: world.surface.calls.length,
      writeCalls: [...world.writeCalls],
      bindingPresent: world.domain.repositories.sessionBindings.get(CHILD_A) !== undefined,
      memberCount: world.domain.repositories.memberInstances.list(ROOT).length,
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// C4 — orphan record (record without its binding): fail-closed conflict
// ---------------------------------------------------------------------------
let c4: {
  readonly error: unknown
  readonly surfaceCallCount: number
  readonly writeCalls: readonly P5T6WriteCall[]
  readonly restoreScopeCount: number
  readonly expectResultUndefined: boolean
}
{
  const world = await createMemberResidencyWorld('p5t6-c4', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A, withBinding: false },
  })
  try {
    const { result, error } = await runCold(world, ROOT, INSTANCE_A)
    c4 = {
      error,
      surfaceCallCount: world.surface.calls.length,
      writeCalls: [...world.writeCalls],
      restoreScopeCount: world.surface.countCalls('restoreScope', CHILD_A),
      // result must be undefined: the pre-check throws before the binder
      expectResultUndefined: result === undefined,
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// C5 — DISPOSED member: the binder's terminal-lifecycle error propagates
// ---------------------------------------------------------------------------
let c5: {
  readonly error: unknown
  readonly surfaceCallCount: number
  readonly writeCalls: readonly P5T6WriteCall[]
  readonly restoreScopeCount: number
  readonly eventCount: number
  readonly expectResultUndefined: boolean
}
{
  const world = await createMemberResidencyWorld('p5t6-c5', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A, lifecycle: 'DISPOSED' },
  })
  try {
    const { result, error } = await runCold(world, ROOT, INSTANCE_A)
    c5 = {
      error,
      surfaceCallCount: world.surface.calls.length,
      writeCalls: [...world.writeCalls],
      restoreScopeCount: world.surface.countCalls('restoreScope', CHILD_A),
      eventCount: world.surface.eventsFor(CHILD_A).length,
      // result must be undefined: BINDER_MEMBER_DISPOSED throws before any
      // surface call
      expectResultUndefined: result === undefined,
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// C6 — mismatched binding identity: fail-closed conflict
// ---------------------------------------------------------------------------
let c6: {
  readonly error: unknown
  readonly surfaceCallCount: number
  readonly writeCalls: readonly P5T6WriteCall[]
  readonly restoreScopeCount: number
  readonly expectResultUndefined: boolean
}
{
  const world = await createMemberResidencyWorld('p5t6-c6', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A, withBinding: false },
  })
  try {
    // Pre-arrange a 'team-member' binding at CHILD_A that belongs to a
    // DIFFERENT instance of the same root (the explicit (root, instance)
    // addressing makes this corruption, not ordinariness).
    await world.domain.repositories.sessionBindings.put({
      kind: 'team-member',
      schemaVersion: 1,
      sessionId: CHILD_A,
      rootSessionId: ROOT,
      instanceId: INSTANCE_B,
    })
    const { result, error } = await runCold(world, ROOT, INSTANCE_A)
    c6 = {
      error,
      surfaceCallCount: world.surface.calls.length,
      writeCalls: [...world.writeCalls],
      restoreScopeCount: world.surface.countCalls('restoreScope', CHILD_A),
      // result must be undefined: the pre-check throws before the binder
      expectResultUndefined: result === undefined,
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// C7 — rejecting admission guard on the cold path
// ---------------------------------------------------------------------------
let c7: {
  readonly error: unknown
  readonly admitted: boolean | undefined
  readonly admissionCode: string | undefined
  readonly restoreScopeCount: number
  readonly eventNames: readonly string[]
  readonly eventDetails: readonly (string | undefined)[]
  readonly writeCalls: readonly P5T6WriteCall[]
  readonly wrote: boolean | undefined
  readonly installed: boolean | undefined
}
{
  const world = await createMemberResidencyWorld('p5t6-c7', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A },
  })
  try {
    const cappedPorts: MemberResidencyPorts = {
      ...world.ports,
      admissionGuard: rejectingGuard('ADMISSION_CAPPED'),
    }
    const { result, error } = await runCold(world, ROOT, INSTANCE_A, cappedPorts)
    c7 = {
      error,
      admitted: result?.bind?.admitted,
      admissionCode: result?.bind?.admissionCode,
      restoreScopeCount: world.surface.countCalls('restoreScope', CHILD_A),
      eventNames: world.surface.eventsFor(CHILD_A).map((event) => event.name),
      eventDetails: world.surface.eventsFor(CHILD_A).map((event) => event.detail),
      writeCalls: [...world.writeCalls],
      wrote: result?.durable?.wrote,
      installed: result?.bind?.installed,
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// C8 — the local token mirror is byte-identical to storage's
// deterministicToken over a corpus
// ---------------------------------------------------------------------------
const TOKEN_CORPUS = [
  '',
  'a',
  'p5t6',
  'session-root-p5t6\u0000p5t6worker\u0000worker-a\u0000\u0000',
  'ü-ñ-中文-🚀',
  'x'.repeat(200),
]
const TOKEN_LENGTHS = [1, 3, 7, 12, 16, 25, 56]
let c8: { readonly mismatches: number; readonly compared: number }
{
  let mismatches = 0
  let compared = 0
  for (const s of TOKEN_CORPUS) {
    for (const n of TOKEN_LENGTHS) {
      compared += 1
      if (memberResidencyToken(s, n) !== deterministicToken(s, n)) {
        mismatches += 1
      }
    }
  }
  c8 = { mismatches, compared }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
describe('P5-T6 C1: cold resume after a process restart (the canonical flow)', () => {
  it('restores the member scope exactly once and re-decides admission with zero durable writes', () => {
    expect(c1.error).toBe(undefined)
    expect(c1.result?.path).toBe('cold-member')
    expect(c1.result?.noopReason).toBe(undefined)
    expect(c1.result?.durable?.wrote).toBe(false)

    // The durable state is re-read, never rewritten.
    expect(c1.member?.instanceId).toBe(INSTANCE_A)
    expect(c1.member?.childSessionId).toBe(CHILD_A)
    expect(c1.member?.lifecycle).toBe('CREATED')
    expect(c1.member?.templateId).toBe('p5t6worker')
    expect(c1.member?.label).toBe('worker-a')
    expect(c1.member?.activityVersion).toBe(1)
    expect(c1.memberCount).toBe(1)
    expect(c1.binding.kind).toBe('team-member')
    expect(c1.binding.sessionId).toBe(CHILD_A)
    expect(c1.binding.rootSessionId).toBe(ROOT)
    expect(c1.binding.instanceId).toBe(INSTANCE_A)

    // The binder's cold path: restoreScope once with the FULL member scope
    // (kind + composite identity + the fixed slot order), NO overlay
    // install, NO getInstalledSlots (a fresh binder is never already-bound).
    expect(c1.restoreScopeCount).toBe(1)
    expect(c1.restoreScope).toEqual({
      kind: 'member',
      rootSessionId: ROOT,
      instanceId: INSTANCE_A,
      slots: ['persona', 'model', 'capability'],
    })
    expect(c1.installOverlayCount).toBe(0)
    expect(c1.surfaceCallCount).toBe(3) // restoreScope + 2 recordSessionEvent

    // The emitted events: scope-restored (detail = kind) then
    // admission-decided (detail = the open code).
    expect(c1.eventNames).toEqual([
      AGENT_SETUP_EVENT_NAMES.scopeRestored,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
    ])
    expect(c1.eventDetails).toEqual(['member', ADMISSION_OPEN_CODE])

    // The bind result identity: the composite member identity (invariant 18).
    expect(c1.bound).toBe(true)
    expect(c1.installed).toBe(true)
    expect(c1.admitted).toBe(true)
    expect(c1.admissionCode).toBe(ADMISSION_OPEN_CODE)
    expect(c1.identity).toEqual({
      kind: 'member',
      sessionId: CHILD_A,
      rootSessionId: ROOT,
      instanceId: INSTANCE_A,
    })

    // The zero-write proof: the cold path never consults the write port.
    expect(c1.writeCalls.length).toBe(0)
  })
})

describe('P5-T6 C2: cold resume has zero fresh-time side effects', () => {
  it('applies no slot and installs no overlay (restoreScope only)', () => {
    expect(c2.error).toBe(undefined)
    expect(c2.personaApplied).toBe(0)
    expect(c2.modelApplied).toBe(0)
    expect(c2.capabilityApplied).toBe(0)
    expect(c2.installOverlayCount).toBe(0)
    expect(c2.restoreScopeCount).toBe(1)
    expect(c2.admitted).toBe(true)
    expect(c2.writeCalls.length).toBe(0)
  })
})

describe('P5-T6 C3: absent member (zero-record, zero-effect no-op)', () => {
  it('returns noopReason absent with no surface calls and no writes', () => {
    expect(c3.error).toBe(undefined)
    expect(c3.path).toBe('cold-member')
    expect(c3.noopReason).toBe('absent')
    expect(c3.durablePresent).toBe(false)
    expect(c3.bindPresent).toBe(false)
    expect(c3.surfaceCallCount).toBe(0)
    expect(c3.writeCalls.length).toBe(0)
    expect(c3.bindingPresent).toBe(false)
    expect(c3.memberCount).toBe(0)
  })
})

describe('P5-T6 C4: orphan record (record without its binding) is a fail-closed conflict', () => {
  it('throws RECORD_CONFLICT before any surface call and before any write', () => {
    expect(isMemberResidencyError(c4.error)).toBe(true)
    expect((c4.error as { code: string }).code).toBe(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT,
    )
    expect(c4.expectResultUndefined).toBe(true)
    expect(c4.surfaceCallCount).toBe(0)
    expect(c4.restoreScopeCount).toBe(0)
    expect(c4.writeCalls.length).toBe(0)
  })
})

describe('P5-T6 C5: DISPOSED member propagates the binder terminal-lifecycle error', () => {
  it('throws BINDER_MEMBER_DISPOSED before any surface call and before any write', () => {
    expect(isTeamAgentBinderError(c5.error)).toBe(true)
    expect((c5.error as { code: string }).code).toBe(
      TEAM_AGENT_BINDER_ERROR_CODES.BINDER_MEMBER_DISPOSED,
    )
    expect(c5.expectResultUndefined).toBe(true)
    expect(c5.surfaceCallCount).toBe(0)
    expect(c5.restoreScopeCount).toBe(0)
    expect(c5.eventCount).toBe(0)
    expect(c5.writeCalls.length).toBe(0)
  })
})

describe('P5-T6 C6: mismatched binding identity is a fail-closed conflict', () => {
  it('throws RECORD_CONFLICT before any surface call and before any write', () => {
    expect(isMemberResidencyError(c6.error)).toBe(true)
    expect((c6.error as { code: string }).code).toBe(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT,
    )
    expect(c6.expectResultUndefined).toBe(true)
    expect(c6.surfaceCallCount).toBe(0)
    expect(c6.restoreScopeCount).toBe(0)
    expect(c6.writeCalls.length).toBe(0)
  })
})

describe('P5-T6 C7: rejecting admission guard on the cold path', () => {
  it('restores the scope, records the rejection, and writes nothing', () => {
    expect(c7.error).toBe(undefined)
    expect(c7.admitted).toBe(false)
    expect(c7.admissionCode).toBe('ADMISSION_CAPPED')
    expect(c7.installed).toBe(true)
    expect(c7.restoreScopeCount).toBe(1)
    expect(c7.eventNames).toEqual([
      AGENT_SETUP_EVENT_NAMES.scopeRestored,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
    ])
    expect(c7.eventDetails).toEqual(['member', 'ADMISSION_CAPPED'])
    expect(c7.wrote).toBe(false)
    expect(c7.writeCalls.length).toBe(0)
  })
})

describe('P5-T6 C8: the local token mirror matches the storage deterministicToken', () => {
  it('is byte-identical over the corpus (mirror provenance, DevPlan §18.5)', () => {
    expect(c8.compared).toBe(TOKEN_CORPUS.length * TOKEN_LENGTHS.length)
    expect(c8.mismatches).toBe(0)
  })
})
