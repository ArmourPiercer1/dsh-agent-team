/**
 * P5-T6 fresh member — the fresh-create path (TaskDoc §11.5 P5-T6 card;
 * ruling R34): derived durable identity (spec → instanceId +
 * childSessionId) + durable TeamDomain create (MemberInstance record
 * BEFORE the `team-member` session binding) + the binder's fresh-member
 * path (all three overlay slots installed + admission decision), plus
 * the idempotent re-run, the crash-window / convergent-replay matrix,
 * the fail-closed conflict matrix, and the write-failure / input-
 * validation / guard-fault / overlay-fault channels.
 *
 * Mock-first (ruling R28): the agent-runtime boundary is the P5-T1
 * `FakeAgentSetupSurface`; the durable layer is REAL (P4 repositories
 * over the testkit `FileStorageSeam`, the real read-handle projection,
 * the real write-port adapter wrapped in a recording proxy).
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are
 * synchronous): every scenario is executed at module top level, its
 * observables are captured into a plain snapshot, the world is destroyed
 * in `finally`; the `it` bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p5t6-fresh-member
 */

import { describe, expect, it } from 'vitest'
import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  TeamAgentBinderError,
} from '../agent-setup/binder/index.js'
import {
  INSTANCE_ID_PATTERN,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto, SessionBindingDto } from '../../contracts/src/index.js'
import {
  MEMBER_RESIDENCY_ERROR_CODES,
  deriveMemberIdentity,
  createFreshMember,
  rehydrateColdMember,
  isMemberResidencyError,
} from '../member-residency/index.js'
import type { FreshMemberResult, MemberResidencyPorts } from '../member-residency/index.js'
import {
  P5T6_FIXTURE,
  P5T6_SPEC_A,
  P5T6_SPEC_B,
  captureError,
  createMemberResidencyWorld,
  destroyWorld,
  restartMemberResidencyWorld,
} from './p5t6-helpers.js'
import type { P5T6World, P5T6WriteCall } from './p5t6-helpers.js'
import { recordingSlot, rejectingGuard } from './p5t1-helpers.js'

const ROOT = String(P5T6_FIXTURE.rootSessionId)

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

function memberView(record: MemberInstanceRecordDto | undefined): MemberView | undefined {
  if (record === undefined) return undefined
  return {
    schemaVersion: record.schemaVersion,
    instanceId: String(record.instanceId),
    templateId: String(record.templateId),
    label: record.label,
    groupId: record.groupId,
    childSessionId: String(record.childSessionId),
    workspace: record.workspace,
    lifecycle: record.lifecycle,
    createdAt: record.createdAt,
    activityVersion: record.activityVersion,
  }
}

/** The plain view of a durable session binding row (snapshot data). */
interface BindingView {
  readonly kind: string
  readonly sessionId: string
  readonly rootSessionId: string | undefined
  readonly instanceId: string | undefined
}

function bindingView(binding: SessionBindingDto | undefined): BindingView | undefined {
  if (binding === undefined) return undefined
  if (binding.kind === 'team-member') {
    return {
      kind: binding.kind,
      sessionId: String(binding.sessionId),
      rootSessionId: String(binding.rootSessionId),
      instanceId: String(binding.instanceId),
    }
  }
  return {
    kind: binding.kind,
    sessionId: String(binding.sessionId),
    rootSessionId: undefined,
    instanceId: undefined,
  }
}

/** One captured fresh-scenario observable bundle (plain data only). */
interface FreshSnapshot {
  readonly result: FreshMemberResult | undefined
  readonly error: unknown
  readonly member: MemberView | undefined
  readonly memberCount: number
  readonly binding: BindingView | undefined
  readonly writeCalls: readonly P5T6WriteCall[]
  readonly installedSlots: readonly (string | undefined)[]
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

function snapshot(
  world: P5T6World,
  childSessionId: string,
  instanceId: string,
  result: FreshMemberResult | undefined,
  error: unknown,
): FreshSnapshot {
  const record = world.domain.repositories.memberInstances.get(ROOT, instanceId)
  const events = world.surface.eventsFor(childSessionId)
  const installCalls = world.surface.calls.filter(
    (call) => call.method === 'installOverlay' && call.sessionId === childSessionId,
  )
  const identity = result?.bind.identity
  return {
    result,
    error,
    member: memberView(record),
    memberCount: world.domain.repositories.memberInstances.list(ROOT).length,
    binding: bindingView(world.domain.repositories.sessionBindings.get(childSessionId)),
    writeCalls: [...world.writeCalls],
    installedSlots: installCalls.map((call) => call.slot),
    surfaceCallCount: world.surface.calls.length,
    eventNames: events.map((event) => event.name),
    eventDetails: events.map((event) => event.detail),
    bound: result?.bind.bound,
    installed: result?.bind.installed,
    noopReason: result?.bind.noopReason,
    admitted: result?.bind.admitted,
    admissionCode: result?.bind.admissionCode,
    identity:
      identity === undefined
        ? undefined
        : {
            kind: identity.kind,
            sessionId: identity.sessionId,
            rootSessionId: identity.rootSessionId,
            instanceId: identity.instanceId,
          },
  }
}

async function runFresh(
  world: P5T6World,
  spec: unknown,
  ports?: MemberResidencyPorts,
): Promise<{ result: FreshMemberResult | undefined; error: unknown }> {
  try {
    const result = await createFreshMember(
      ports ?? world.ports,
      spec as (typeof P5T6_SPEC_A),
    )
    return { result, error: undefined }
  } catch (error) {
    return { result: undefined, error }
  }
}

const IDENTITY_A = deriveMemberIdentity(P5T6_SPEC_A)
const CHILD_A = IDENTITY_A.childSessionId
const INSTANCE_A = IDENTITY_A.instanceId
const IDENTITY_B = deriveMemberIdentity(P5T6_SPEC_B)
const CHILD_B = IDENTITY_B.childSessionId
const INSTANCE_B = IDENTITY_B.instanceId

// ---------------------------------------------------------------------------
// S1 — fresh create (spec A)
// ---------------------------------------------------------------------------
let s1: FreshSnapshot
{
  const world = await createMemberResidencyWorld('p5t6-s1', { seedBoundRoot: true })
  try {
    const { result, error } = await runFresh(world, P5T6_SPEC_A)
    s1 = snapshot(world, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// S2 — idempotent re-run (same world, same spec)
// ---------------------------------------------------------------------------
let s2: {
  readonly first: FreshSnapshot
  readonly second: FreshSnapshot
  readonly secondInstallSlots: readonly (string | undefined)[]
  readonly secondEventNames: readonly string[]
  readonly secondAdmitted: boolean | undefined
  readonly secondBound: boolean | undefined
  readonly secondInstalled: boolean | undefined
}
{
  const world = await createMemberResidencyWorld('p5t6-s2', { seedBoundRoot: true })
  try {
    const first = await runFresh(world, P5T6_SPEC_A)
    const firstSnapshot = snapshot(world, CHILD_A, INSTANCE_A, first.result, first.error)
    const baselineSurfaceCalls = world.surface.calls.length
    const second = await runFresh(world, P5T6_SPEC_A)
    const secondSnapshot = snapshot(world, CHILD_A, INSTANCE_A, second.result, second.error)
    const installCalls = world.surface.calls
      .slice(baselineSurfaceCalls)
      .filter((call) => call.method === 'installOverlay' && call.sessionId === CHILD_A)
    const events = world.surface
      .calls.slice(baselineSurfaceCalls)
      .filter((call) => call.method === 'recordSessionEvent' && call.sessionId === CHILD_A)
      .map((call) => (call.event as { name: string }).name)
    s2 = {
      first: firstSnapshot,
      second: secondSnapshot,
      secondInstallSlots: installCalls.map((call) => call.slot),
      secondEventNames: events,
      secondAdmitted: second.result?.bind.admitted,
      secondBound: second.result?.bind.bound,
      secondInstalled: second.result?.bind.installed,
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// S3 — crash window: the record committed, the binding LOST
// ---------------------------------------------------------------------------
let s3: FreshSnapshot
{
  const world = await createMemberResidencyWorld('p5t6-s3', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A, withBinding: false },
  })
  try {
    const { result, error } = await runFresh(world, P5T6_SPEC_A)
    s3 = snapshot(world, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// S4 — convergent replay (I1c analog): the binding committed, the record LOST
// ---------------------------------------------------------------------------
let s4: FreshSnapshot
{
  const world = await createMemberResidencyWorld('p5t6-s4', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A, withRecord: false },
  })
  try {
    const { result, error } = await runFresh(world, P5T6_SPEC_A)
    s4 = snapshot(world, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// S5 — the fail-closed root / binding conflict matrix (all zero-effect)
// ---------------------------------------------------------------------------
let s5: {
  readonly unbound: FreshSnapshot
  readonly rootOrdinary: FreshSnapshot
  readonly rootMember: FreshSnapshot
  readonly orphanRoot: FreshSnapshot
  readonly bindingWrongIdentity: FreshSnapshot
  readonly bindingMismatchWithRecord: FreshSnapshot
}
let s5_unbound: FreshSnapshot
let s5_rootOrdinary: FreshSnapshot
let s5_rootMember: FreshSnapshot
let s5_orphanRoot: FreshSnapshot
let s5_bindingWrongIdentity: FreshSnapshot
let s5_bindingMismatchWithRecord: FreshSnapshot
{
  // S5a — the root session is unbound (no Team at all).
  const wA = await createMemberResidencyWorld('p5t6-s5a')
  try {
    const { result, error } = await runFresh(wA, P5T6_SPEC_A)
    s5_unbound = snapshot(wA, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(wA)
  }

  // S5b — the root session is bound as an ORDINARY session.
  const wB = await createMemberResidencyWorld('p5t6-s5b')
  try {
    await wB.domain.repositories.sessionBindings.put({
      kind: 'ordinary',
      schemaVersion: 1,
      sessionId: ROOT,
    })
    const { result, error } = await runFresh(wB, P5T6_SPEC_A)
    s5_rootOrdinary = snapshot(wB, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(wB)
  }

  // S5c — the root session is bound as a team-member (a member child, not a root).
  const wC = await createMemberResidencyWorld('p5t6-s5c')
  try {
    await wC.domain.repositories.sessionBindings.put({
      kind: 'team-member',
      schemaVersion: 1,
      sessionId: ROOT,
      rootSessionId: ROOT,
      instanceId: 'inst-p5t6other',
    })
    const { result, error } = await runFresh(wC, P5T6_SPEC_A)
    s5_rootMember = snapshot(wC, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(wC)
  }

  // S5d — a team-root binding WITHOUT its TeamSession record (integrity violation).
  const wD = await createMemberResidencyWorld('p5t6-s5d', { seedOrphanRootBinding: true })
  try {
    const { result, error } = await runFresh(wD, P5T6_SPEC_A)
    s5_orphanRoot = snapshot(wD, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(wD)
  }

  // S5e — the record is absent and the child session carries an INCONSISTENT
  // team-member binding (a different instance id).
  const wE = await createMemberResidencyWorld('p5t6-s5e', { seedBoundRoot: true })
  try {
    await wE.domain.repositories.sessionBindings.put({
      kind: 'team-member',
      schemaVersion: 1,
      sessionId: CHILD_A,
      rootSessionId: ROOT,
      instanceId: 'inst-p5t6other',
    })
    const { result, error } = await runFresh(wE, P5T6_SPEC_A)
    s5_bindingWrongIdentity = snapshot(wE, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(wE)
  }

  // S5f — the record exists but the child binding points at a DIFFERENT identity.
  const wF = await createMemberResidencyWorld('p5t6-s5f', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A, withBinding: false },
  })
  try {
    await wF.domain.repositories.sessionBindings.put({
      kind: 'team-member',
      schemaVersion: 1,
      sessionId: CHILD_A,
      rootSessionId: ROOT,
      instanceId: 'inst-p5t6other',
    })
    const { result, error } = await runFresh(wF, P5T6_SPEC_A)
    s5_bindingMismatchWithRecord = snapshot(wF, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(wF)
  }

  s5 = {
    unbound: s5_unbound,
    rootOrdinary: s5_rootOrdinary,
    rootMember: s5_rootMember,
    orphanRoot: s5_orphanRoot,
    bindingWrongIdentity: s5_bindingWrongIdentity,
    bindingMismatchWithRecord: s5_bindingMismatchWithRecord,
  }
}

// ---------------------------------------------------------------------------
// S6 — record spec mismatch (the durable row conflicts with the spec)
// ---------------------------------------------------------------------------
let s6: FreshSnapshot
{
  const world = await createMemberResidencyWorld('p5t6-s6', { seedBoundRoot: true })
  try {
    // Pre-arrange a durable row at spec A's derived identity with a
    // DIFFERENT label (the spec is the canonical identity input: the row
    // cannot belong to this spec).
    await world.domain.repositories.memberInstances.put({
      rootSessionId: parseRootSessionId(ROOT),
      instanceId: parseInstanceId(INSTANCE_A),
      templateId: parseTemplateId('p5t6worker'),
      label: 'worker-z',
      childSessionId: parseChildSessionId(CHILD_A),
      lifecycle: 'CREATED',
      createdAt: P5T6_FIXTURE.createdAt,
      activityVersion: 1,
    })
    const { result, error } = await runFresh(world, P5T6_SPEC_A)
    s6 = snapshot(world, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// S7 — DISPOSED record (terminal lifecycle)
// ---------------------------------------------------------------------------
let s7: FreshSnapshot
{
  const world = await createMemberResidencyWorld('p5t6-s7', {
    seedBoundRoot: true,
    seedMember: { spec: P5T6_SPEC_A, lifecycle: 'DISPOSED' },
  })
  try {
    const { result, error } = await runFresh(world, P5T6_SPEC_A)
    s7 = snapshot(world, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// S8 — durable write failure (putMemberInstance rejects)
// ---------------------------------------------------------------------------
let s8: {
  readonly error: unknown
  readonly repoMemberPresent: boolean
  readonly repoBindingPresent: boolean
  readonly surfaceCallCount: number
  readonly writeCalls: readonly P5T6WriteCall[]
}
{
  const world = await createMemberResidencyWorld('p5t6-s8', { seedBoundRoot: true })
  try {
    const fault = new Error('seam fault: putMemberInstance')
    world.failNextPutMemberInstance(fault)
    const { result, error } = await runFresh(world, P5T6_SPEC_A)
    s8 = {
      error,
      repoMemberPresent:
        world.domain.repositories.memberInstances.get(ROOT, INSTANCE_A) !== undefined,
      repoBindingPresent:
        world.domain.repositories.sessionBindings.get(CHILD_A) !== undefined,
      surfaceCallCount: world.surface.calls.length,
      writeCalls: [...world.writeCalls],
    }
    expect(result).toBe(undefined)
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// S9 — invalid input matrix (fail-closed, zero effect)
// ---------------------------------------------------------------------------
let s9: {
  readonly emptyLabel: unknown
  readonly whitespaceRoot: unknown
  readonly controlCharLabel: unknown
  readonly badTemplate: unknown
  readonly missingLabel: unknown
  readonly surfaceCallCount: number
  readonly writeCalls: readonly P5T6WriteCall[]
  readonly memberCount: number
}
{
  const world = await createMemberResidencyWorld('p5t6-s9', { seedBoundRoot: true })
  try {
    const emptyLabel = await captureError(() => createFreshMember(world.ports, { ...P5T6_SPEC_A, label: '' }))
    const whitespaceRoot = await captureError(() =>
      createFreshMember(world.ports, { ...P5T6_SPEC_A, rootSessionId: 'session root p5t6' }),
    )
    const controlCharLabel = await captureError(() =>
      createFreshMember(world.ports, { ...P5T6_SPEC_A, label: 'worker\u0001a' }),
    )
    const badTemplate = await captureError(() =>
      createFreshMember(world.ports, { ...P5T6_SPEC_A, templateId: 'P5T6UPPER' }),
    )
    const missingLabel = await captureError(() =>
      createFreshMember(
        world.ports,
        { rootSessionId: ROOT, templateId: 'p5t6worker' } as unknown as (typeof P5T6_SPEC_A),
      ),
    )
    s9 = {
      emptyLabel,
      whitespaceRoot,
      controlCharLabel,
      badTemplate,
      missingLabel,
      surfaceCallCount: world.surface.calls.length,
      writeCalls: [...world.writeCalls],
      memberCount: world.domain.repositories.memberInstances.list(ROOT).length,
    }
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// S10 — the rejecting admission guard (the durable commit stands)
// ---------------------------------------------------------------------------
let s10: FreshSnapshot
{
  const world = await createMemberResidencyWorld('p5t6-s10', { seedBoundRoot: true })
  try {
    const cappedPorts: MemberResidencyPorts = {
      ...world.ports,
      admissionGuard: rejectingGuard('ADMISSION_CAPPED'),
    }
    const { result, error } = await runFresh(world, P5T6_SPEC_A, cappedPorts)
    s10 = snapshot(world, CHILD_A, INSTANCE_A, result, error)
  } finally {
    await destroyWorld(world)
  }
}

// ---------------------------------------------------------------------------
// S11 — overlay fault: the durable commit stands; the cold path recovers
// ---------------------------------------------------------------------------
let s11: {
  readonly error: unknown
  readonly repoMemberPresent: boolean
  readonly repoBindingKind: string | undefined
  readonly personaApplied: number
  readonly modelApplied: number
  readonly capabilityApplied: number
  readonly recovery: {
    readonly result: unknown
    readonly error: unknown
    readonly wrote: boolean | undefined
    readonly installed: boolean | undefined
    readonly admitted: boolean | undefined
    readonly restoreScopeCount: number
    readonly eventNames: readonly string[]
  }
}
{
  const world = await createMemberResidencyWorld('p5t6-s11', { seedBoundRoot: true })
  let worldForCleanup: P5T6World = world
  try {
    const persona = recordingSlot('persona')
    const model = recordingSlot('model', new Error('slot fault: model'))
    const capability = recordingSlot('capability')
    const faultPorts: MemberResidencyPorts = {
      ...world.ports,
      slots: { persona, model, capability },
    }
    const { result, error } = await runFresh(world, P5T6_SPEC_A, faultPorts)
    expect(result).toBe(undefined)

    // The recovery: a process restart (fresh surface + fresh residency
    // port) + the cold path re-attaches the durable member.
    const restarted = await restartMemberResidencyWorld(world)
    worldForCleanup = restarted
    let recoveryResult: unknown
    let recoveryError: unknown
    try {
      recoveryResult = await rehydrateColdMember(restarted.ports, {
        rootSessionId: ROOT,
        instanceId: INSTANCE_A,
      })
    } catch (recoveryErr) {
      recoveryError = recoveryErr
    }
    const cold = recoveryResult as
      | { durable?: { wrote: boolean }; bind?: { installed: boolean; admitted: boolean } }
      | undefined
    s11 = {
      error,
      repoMemberPresent:
        restarted.domain.repositories.memberInstances.get(ROOT, INSTANCE_A) !== undefined,
      repoBindingKind:
        restarted.domain.repositories.sessionBindings.get(CHILD_A)?.kind ?? undefined,
      personaApplied: persona.applied.length,
      modelApplied: model.applied.length,
      capabilityApplied: capability.applied.length,
      recovery: {
        result: recoveryResult,
        error: recoveryError,
        wrote: cold?.durable?.wrote,
        installed: cold?.bind?.installed,
        admitted: cold?.bind?.admitted,
        restoreScopeCount: restarted.surface.countCalls('restoreScope', CHILD_A),
        eventNames: restarted.surface.eventsFor(CHILD_A).map((event) => event.name),
      },
    }
  } finally {
    await destroyWorld(worldForCleanup)
  }
}

describe('P5-T6 S1: fresh member create (derived identity + durable create + fresh install + admission)', () => {
  it('derives the stable identity and persists the MemberInstance record before the team-member binding', () => {
    expect(s1.error).toBe(undefined)
    expect(s1.result?.path).toBe('fresh-member')
    expect(s1.result?.durable?.wrote).toBe(true)

    // The derived identity: the spec is the canonical identity input.
    expect(INSTANCE_ID_PATTERN.test(INSTANCE_A)).toBe(true)
    expect(s1.member?.instanceId).toBe(INSTANCE_A)
    expect(s1.member?.childSessionId).toBe(CHILD_A)
    expect(s1.member?.templateId).toBe('p5t6worker')
    expect(s1.member?.label).toBe('worker-a')
    expect(s1.member?.groupId).toBe(undefined)
    expect(s1.member?.workspace).toBe(undefined)
    expect(s1.member?.lifecycle).toBe('CREATED')
    expect(s1.member?.activityVersion).toBe(1)
    expect(s1.member?.schemaVersion).toBe(1)
    expect(s1.member?.createdAt).toBe('2026-08-30T07:00:01.000Z')

    // The team-member binding row.
    expect(s1.binding?.kind).toBe('team-member')
    expect(s1.binding?.sessionId).toBe(CHILD_A)
    expect(s1.binding?.rootSessionId).toBe(ROOT)
    expect(s1.binding?.instanceId).toBe(INSTANCE_A)

    // Write ordering: the record is committed BEFORE the binding.
    expect(s1.writeCalls).toEqual([{ method: 'putMemberInstance' }, { method: 'putSessionBinding' }])
  })

  it('runs the binder fresh-member path: all three slots installed in order + the admission decision', () => {
    expect(s1.bound).toBe(true)
    expect(s1.installed).toBe(true)
    expect(s1.noopReason).toBe(undefined)
    expect(s1.identity?.kind).toBe('member')
    expect(s1.identity?.sessionId).toBe(CHILD_A)
    expect(s1.identity?.rootSessionId).toBe(ROOT)
    expect(s1.identity?.instanceId).toBe(INSTANCE_A)
    expect(s1.installedSlots).toEqual(['persona', 'model', 'capability'])
    expect(s1.admitted).toBe(true)
    expect(s1.admissionCode).toBe(ADMISSION_OPEN_CODE)
    expect(s1.eventNames).toEqual([
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
    ])
    expect(s1.eventDetails).toEqual(['persona', 'model', 'capability', ADMISSION_OPEN_CODE])
  })

  it('is deterministic: the same spec derives the same identity, a different spec a different one', () => {
    expect(deriveMemberIdentity(P5T6_SPEC_A).instanceId).toBe(INSTANCE_A)
    expect(deriveMemberIdentity(P5T6_SPEC_A).childSessionId).toBe(CHILD_A)
    expect(deriveMemberIdentity(P5T6_SPEC_B).instanceId).toBe(INSTANCE_B)
    expect(INSTANCE_A).not.toBe(INSTANCE_B)
    expect(CHILD_A).not.toBe(CHILD_B)
    expect(String(INSTANCE_ID_PATTERN.test(INSTANCE_B))).toBe('true')
    // Absent optional fields are NOT a distinct identity (absence is not a value).
    expect(deriveMemberIdentity({ ...P5T6_SPEC_A, groupId: undefined }).instanceId).toBe(INSTANCE_A)
  })
})

describe('P5-T6 S2: idempotent re-run of the fresh create', () => {
  it('performs zero durable writes on the re-run and keeps exactly one record + one binding', () => {
    expect(s2.first.error).toBe(undefined)
    expect(s2.first.result?.durable?.wrote).toBe(true)
    expect(s2.second.error).toBe(undefined)
    expect(s2.second.result?.durable?.wrote).toBe(false)
    // The world-level write log: exactly the two writes of the FIRST run.
    expect(s2.second.writeCalls).toEqual([{ method: 'putMemberInstance' }, { method: 'putSessionBinding' }])
    expect(s2.second.memberCount).toBe(1)
    expect(s2.second.binding?.kind).toBe('team-member')
    expect(s2.second.member?.instanceId).toBe(INSTANCE_A)
  })

  it('re-runs the fresh install on the same durable records (idempotent slot apply / re-entrant surface)', () => {
    expect(s2.secondBound).toBe(true)
    expect(s2.secondInstalled).toBe(true)
    expect(s2.secondAdmitted).toBe(true)
    expect(s2.secondInstallSlots).toEqual(['persona', 'model', 'capability'])
    expect(s2.secondEventNames).toEqual([
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
    ])
  })
})

describe('P5-T6 S3: crash window (record committed, binding lost)', () => {
  it('re-drives the fresh create convergently: only the binding is written, no duplicate record', () => {
    expect(s3.error).toBe(undefined)
    expect(s3.result?.durable?.wrote).toBe(true)
    expect(s3.writeCalls).toEqual([{ method: 'putSessionBinding' }])
    expect(s3.memberCount).toBe(1)
    expect(s3.member?.instanceId).toBe(INSTANCE_A)
    expect(s3.binding?.kind).toBe('team-member')
    expect(s3.installed).toBe(true)
    expect(s3.admitted).toBe(true)
  })
})

describe('P5-T6 S4: convergent replay (binding committed, record lost — I1c analog)', () => {
  it('re-puts the record, keeps the pre-existing binding, and produces no duplicate rows', () => {
    expect(s4.error).toBe(undefined)
    expect(s4.result?.durable?.wrote).toBe(true)
    expect(s4.writeCalls).toEqual([{ method: 'putMemberInstance' }])
    expect(s4.memberCount).toBe(1)
    expect(s4.member?.instanceId).toBe(INSTANCE_A)
    expect(s4.member?.lifecycle).toBe('CREATED')
    expect(s4.binding?.kind).toBe('team-member')
    expect(s4.binding?.instanceId).toBe(INSTANCE_A)
    expect(s4.installed).toBe(true)
    expect(s4.admitted).toBe(true)
  })
})

describe('P5-T6 S5: the fail-closed conflict matrix (zero effects)', () => {
  it('S5a: an unbound root session is ROOT_NOT_BOUND', () => {
    expect(isMemberResidencyError(s5.unbound.error)).toBe(true)
    expect((s5.unbound.error as { code: string }).code).toBe(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_ROOT_NOT_BOUND,
    )
    assertNoEffect(s5.unbound)
  })

  it('S5b: a root session bound as ordinary is ROOT_NOT_BOUND', () => {
    expect(isMemberResidencyError(s5.rootOrdinary.error)).toBe(true)
    expect((s5.rootOrdinary.error as { code: string }).code).toBe(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_ROOT_NOT_BOUND,
    )
    assertNoEffect(s5.rootOrdinary)
  })

  it('S5c: a root session bound as team-member is ROOT_NOT_BOUND', () => {
    expect(isMemberResidencyError(s5.rootMember.error)).toBe(true)
    expect((s5.rootMember.error as { code: string }).code).toBe(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_ROOT_NOT_BOUND,
    )
    assertNoEffect(s5.rootMember)
  })

  it('S5d: a team-root binding without its TeamSession record is RECORD_CONFLICT', () => {
    expect(isMemberResidencyError(s5.orphanRoot.error)).toBe(true)
    expect((s5.orphanRoot.error as { code: string }).code).toBe(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT,
    )
    assertNoEffect(s5.orphanRoot)
  })

  it('S5e: an inconsistent binding at the derived child session (record absent) is RECORD_CONFLICT', () => {
    expect(isMemberResidencyError(s5.bindingWrongIdentity.error)).toBe(true)
    expect((s5.bindingWrongIdentity.error as { code: string }).code).toBe(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT,
    )
    assertNoEffect(s5.bindingWrongIdentity)
  })

  it('S5f: a record whose child binding points at a different identity is RECORD_CONFLICT', () => {
    expect(isMemberResidencyError(s5.bindingMismatchWithRecord.error)).toBe(true)
    expect((s5.bindingMismatchWithRecord.error as { code: string }).code).toBe(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT,
    )
    // The EXISTING record is untouched (it stays durable); nothing was
    // written; no surface effect; the inconsistent binding row stands.
    expect(s5.bindingMismatchWithRecord.writeCalls).toEqual([])
    expect(s5.bindingMismatchWithRecord.surfaceCallCount).toBe(0)
    expect(s5.bindingMismatchWithRecord.memberCount).toBe(1)
    expect(s5.bindingMismatchWithRecord.member?.label).toBe('worker-a')
    expect(s5.bindingMismatchWithRecord.binding?.kind).toBe('team-member')
    expect(s5.bindingMismatchWithRecord.binding?.instanceId).toBe('inst-p5t6other')
    expect(s5.bindingMismatchWithRecord.result).toBe(undefined)
  })

  function assertNoEffect(snap: FreshSnapshot) {
    expect(snap.writeCalls).toEqual([])
    expect(snap.surfaceCallCount).toBe(0)
    expect(snap.memberCount).toBe(0)
    expect(snap.result).toBe(undefined)
  }
})

describe('P5-T6 S6: record spec mismatch', () => {
  it('an existing record at the derived identity that conflicts with the spec is RECORD_CONFLICT', () => {
    expect(isMemberResidencyError(s6.error)).toBe(true)
    expect((s6.error as { code: string }).code).toBe(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT,
    )
    // The conflicting row is untouched; nothing is written.
    expect(s6.member?.label).toBe('worker-z')
    expect(s6.writeCalls).toEqual([])
    expect(s6.surfaceCallCount).toBe(0)
  })
})

describe('P5-T6 S7: DISPOSED record', () => {
  it('a DISPOSED record is LIFECYCLE_CONFLICT (the terminal state is never re-entered)', () => {
    expect(isMemberResidencyError(s7.error)).toBe(true)
    expect((s7.error as { code: string }).code).toBe(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_LIFECYCLE_CONFLICT,
    )
    expect((s7.error as { details: { lifecycle: string } }).details.lifecycle).toBe('DISPOSED')
    expect(s7.writeCalls).toEqual([])
    expect(s7.surfaceCallCount).toBe(0)
    expect(s7.member?.lifecycle).toBe('DISPOSED')
  })
})

describe('P5-T6 S8: durable write failure', () => {
  it('a putMemberInstance fault propagates unwrapped, the binder is not run, and nothing is durable', () => {
    expect(s8.error instanceof Error).toBe(true)
    expect((s8.error as Error).message).toBe('seam fault: putMemberInstance')
    expect(isMemberResidencyError(s8.error)).toBe(false)
    expect(s8.repoMemberPresent).toBe(false)
    expect(s8.repoBindingPresent).toBe(false)
    expect(s8.surfaceCallCount).toBe(0)
    // The proxy recorded the ATTEMPTED write (the repository never committed).
    expect(s8.writeCalls).toEqual([{ method: 'putMemberInstance' }])
  })
})

describe('P5-T6 S9: invalid input matrix', () => {
  it('every structural failure is INVALID_INPUT with the offending field, zero effect', () => {
    for (const error of [
      s9.emptyLabel,
      s9.whitespaceRoot,
      s9.controlCharLabel,
      s9.badTemplate,
      s9.missingLabel,
    ]) {
      expect(isMemberResidencyError(error)).toBe(true)
      expect((error as { code: string }).code).toBe(
        MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
      )
      expect(typeof (error as { details: { field: string } }).details.field).toBe('string')
    }
    expect((s9.emptyLabel as { details: { field: string } }).details.field).toBe('label')
    expect((s9.whitespaceRoot as { details: { field: string } }).details.field).toBe('rootSessionId')
    expect((s9.badTemplate as { details: { field: string } }).details.field).toBe('templateId')
    expect(s9.surfaceCallCount).toBe(0)
    expect(s9.writeCalls).toEqual([])
    expect(s9.memberCount).toBe(0)
  })
})

describe('P5-T6 S10: the rejecting admission guard', () => {
  it('installs the slots, rejects the admission with the guard code, and keeps the durable commit', () => {
    expect(s10.error).toBe(undefined)
    expect(s10.result?.durable?.wrote).toBe(true)
    expect(s10.bound).toBe(true)
    expect(s10.installed).toBe(true)
    expect(s10.admitted).toBe(false)
    expect(s10.admissionCode).toBe('ADMISSION_CAPPED')
    expect(s10.eventDetails).toEqual(['persona', 'model', 'capability', 'ADMISSION_CAPPED'])
    expect(s10.memberCount).toBe(1)
    expect(s10.binding?.kind).toBe('team-member')
  })
})

describe('P5-T6 S11: overlay fault (the durable commit stands; the cold path recovers)', () => {
  it('the model slot fault is BINDER_OVERLAY_FAILED; the persona applied, the model never did', () => {
    expect(s11.error instanceof TeamAgentBinderError).toBe(true)
    expect((s11.error as TeamAgentBinderError).code).toBe('BINDER_OVERLAY_FAILED')
    expect(s11.personaApplied).toBe(1)
    expect(s11.modelApplied).toBe(0)
    expect(s11.capabilityApplied).toBe(0)
  })

  it('the durable commit stands and the cold path (after a restart) restores the scope', () => {
    expect(s11.repoMemberPresent).toBe(true)
    expect(s11.repoBindingKind).toBe('team-member')
    expect(s11.recovery.error).toBe(undefined)
    expect(s11.recovery.wrote).toBe(false)
    expect(s11.recovery.installed).toBe(true)
    expect(s11.recovery.admitted).toBe(true)
    expect(s11.recovery.restoreScopeCount).toBe(1)
    expect(s11.recovery.eventNames).toEqual([
      AGENT_SETUP_EVENT_NAMES.scopeRestored,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
    ])
  })
})
