/**
 * P5-T5 S1 — the fresh Team root (TaskDoc §11.5 I-1 real binding; ruling
 * R32): durable TeamDomain create (TeamSession record + `team-root`
 * session binding, record BEFORE binding) + the binder's fresh-root path
 * (all three overlay slots installed + admission decision), plus the
 * idempotent re-run and the fail-closed conflict / write-failure /
 * input-validation matrix.
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
 * @module @dsh-agent-team/runtime/test/p5t5-fresh-root
 */

import { describe, expect, it } from 'vitest'
import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  TeamAgentBinderError,
} from '../agent-setup/binder/index.js'
import { parseRootSessionId } from '../../contracts/src/index.js'
import {
  ROOT_BINDING_ERROR_CODES,
  bindFreshTeamRoot,
  isRootBindingError,
} from '../root-binding/index.js'
import type { RootBindingResult, TeamDomainWritePort } from '../root-binding/index.js'
import {
  P5T5_FIXTURE,
  captureError,
  createRootBindingWorld,
  destroyWorld,
} from './p5t5-helpers.js'
import type { P5T5World } from './p5t5-helpers.js'
import { recordingSlot } from './p5t1-helpers.js'

const ROOT = String(P5T5_FIXTURE.rootSessionId)

/** One captured scenario observable bundle (plain data only). */
interface FreshSnapshot {
  readonly result: RootBindingResult | undefined
  readonly error: unknown
  readonly repoTeamSessionGeneration: number | undefined
  readonly repoBindingKind: string | undefined
  readonly writeCalls: readonly { readonly method: string }[]
  readonly installSlots: readonly (string | undefined)[]
  readonly surfaceCallCount: number
  readonly eventNames: readonly string[]
  readonly overlayEventDetails: readonly (string | undefined)[]
  readonly admissionEventDetail: string | undefined
}

function freshInput(blueprint?: unknown, generation?: number) {
  return {
    rootSessionId: P5T5_FIXTURE.rootSessionId,
    blueprint: (blueprint ?? P5T5_FIXTURE.blueprint) as (typeof P5T5_FIXTURE)['blueprint'],
    defaultWorkspace: P5T5_FIXTURE.defaultWorkspace,
    ...(generation !== undefined ? { generation } : {}),
  }
}

function snapshot(world: P5T5World, result: RootBindingResult | undefined, error: unknown): FreshSnapshot {
  const events = result?.bind.emittedEvents ?? []
  return {
    result,
    error,
    repoTeamSessionGeneration: world.domain.repositories.teamSessions.get(ROOT)?.generation,
    repoBindingKind: world.domain.repositories.sessionBindings.get(ROOT)?.kind,
    writeCalls: world.writeCalls.map((call) => ({ method: call.method })),
    installSlots: world.surface.calls
      .filter((call) => call.method === 'installOverlay')
      .map((call) => call.slot),
    surfaceCallCount: world.surface.calls.length,
    eventNames: events.map((event) => event.name),
    overlayEventDetails: events
      .filter((event) => event.name === AGENT_SETUP_EVENT_NAMES.overlayInstalled)
      .map((event) => event.detail),
    admissionEventDetail: events.find(
      (event) => event.name === AGENT_SETUP_EVENT_NAMES.admissionDecided,
    )?.detail,
  }
}

// ── Scenario 1: the full fresh root (S1) ─────────────────────────────
const s1World = await createRootBindingWorld('p5t5-s1-fresh')
let s1: FreshSnapshot
try {
  s1 = snapshot(s1World, await bindFreshTeamRoot(s1World.ports, freshInput()), undefined)
} catch (error) {
  s1 = snapshot(s1World, undefined, error)
}
await destroyWorld(s1World)

describe('P5-T5 S1: fresh Team root (durable create + fresh install + admission)', () => {
  it('persists the TeamSession record then the team-root binding, installs all three slots, and admits', () => {
    expect(s1.error).toBe(undefined)
    expect(s1.result?.path).toBe('fresh-root')
    expect(s1.result?.durable?.wrote).toBe(true)
    expect(String(s1.result?.durable?.teamSession?.rootSessionId)).toBe(ROOT)
    expect(s1.result?.durable?.teamSession?.generation).toBe(1)
    expect(s1.result?.durable?.teamSession?.defaultWorkspace).toBe(P5T5_FIXTURE.defaultWorkspace)
    expect(s1.result?.durable?.teamSession?.blueprint.blueprintId).toBe(P5T5_FIXTURE.blueprint.blueprintId)
    expect(s1.result?.durable?.binding?.kind).toBe('team-root')

    // Durable truth on the MEDIUM (the real P4 repositories).
    expect(s1.repoTeamSessionGeneration).toBe(1)
    expect(s1.repoBindingKind).toBe('team-root')

    // Write ordering: the record is committed BEFORE the binding.
    expect(s1.writeCalls).toEqual([
      { method: 'putTeamSession' },
      { method: 'putSessionBinding' },
    ])

    // The agent-setup step: all three slots installed in fixed order.
    expect(s1.result?.bind.bound).toBe(true)
    expect(s1.result?.bind.installed).toBe(true)
    expect(s1.result?.bind.noopReason).toBe(undefined)
    expect(s1.result?.bind.identity?.kind).toBe('root')
    expect(s1.result?.bind.identity?.sessionId).toBe(ROOT)
    expect(s1.installSlots).toEqual(['persona', 'model', 'capability'])

    // The admission decision: admitted with the open code.
    expect(s1.result?.bind.admitted).toBe(true)
    expect(s1.result?.bind.admissionCode).toBe(ADMISSION_OPEN_CODE)
    expect(s1.eventNames).toEqual([
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
    ])
    expect(s1.overlayEventDetails).toEqual(['persona', 'model', 'capability'])
    expect(s1.admissionEventDetail).toBe(ADMISSION_OPEN_CODE)
  })
})

// ── Scenario 2: idempotent re-run (residency lost, durable state stands) ──
const s2World = await createRootBindingWorld('p5t5-s1-rerun')
let s2First: RootBindingResult | undefined
let s2Second: RootBindingResult | undefined
let s2Error: unknown
let s2WritesAfterFirst = 0
let s2InstallsAfterFirst = 0
try {
  s2First = await bindFreshTeamRoot(s2World.ports, freshInput())
  s2WritesAfterFirst = s2World.writeCalls.length
  s2InstallsAfterFirst = s2World.surface.countCalls('installOverlay')
  s2World.surface.dropResidency(ROOT)
  s2Second = await bindFreshTeamRoot(s2World.ports, freshInput())
} catch (error) {
  s2Error = error
}
const s2 = snapshot(s2World, s2Second, s2Error)
await destroyWorld(s2World)

describe('P5-T5 S1 re-run: idempotent durable state, fresh install re-run', () => {
  it('re-runs idempotently: zero durable writes, the fresh install is re-run on the same records', () => {
    expect(s2Error).toBe(undefined)
    expect(s2First?.durable?.wrote).toBe(true)
    expect(s2.result?.durable?.wrote).toBe(false)
    expect(s2.result?.bind.bound).toBe(true)
    expect(s2.result?.bind.installed).toBe(true)
    expect(s2.writeCalls.length).toBe(s2WritesAfterFirst)
    expect(s2.installSlots.length).toBe(s2InstallsAfterFirst + 3)
  })
})

// ── Scenario 3: blueprint conflict (invariant 10) ────────────────────
const s3World = await createRootBindingWorld('p5t5-s1-blueprint-conflict')
let s3Error: unknown
try {
  await bindFreshTeamRoot(s3World.ports, freshInput())
  s3Error = await captureError(() =>
    bindFreshTeamRoot(s3World.ports, freshInput(P5T5_FIXTURE.blueprintOther)),
  )
} catch (error) {
  s3Error = error
}
const s3 = snapshot(s3World, undefined, s3Error)
await destroyWorld(s3World)

describe('P5-T5 S1 conflicts', () => {
  it('rejects a re-run with a different immutable blueprint (invariant 10), fail-closed, before any effect', () => {
    expect(isRootBindingError(s3Error)).toBe(true)
    if (isRootBindingError(s3Error)) {
      expect(s3Error.code).toBe(ROOT_BINDING_ERROR_CODES.ROOT_BINDING_TEAM_SESSION_CONFLICT)
    }
    // No new effect: the durable state and the residency are untouched.
    expect(s3.writeCalls.length).toBe(2)
    expect(s3.installSlots.length).toBe(3)
  })
})

// ── Scenario 4: generation conflict ──────────────────────────────────
const s4World = await createRootBindingWorld('p5t5-s1-generation-conflict')
let s4Error: unknown
try {
  await bindFreshTeamRoot(s4World.ports, freshInput(undefined, 1))
  s4Error = await captureError(() => bindFreshTeamRoot(s4World.ports, freshInput(undefined, 2)))
} catch (error) {
  s4Error = error
}
const s4 = snapshot(s4World, undefined, s4Error)
await destroyWorld(s4World)

describe('P5-T5 S1 conflicts (cont.)', () => {
  it('rejects a re-run with a different generation (the fresh create is a generation-1 path), fail-closed', () => {
    expect(isRootBindingError(s4Error)).toBe(true)
    if (isRootBindingError(s4Error)) {
      expect(s4Error.code).toBe(ROOT_BINDING_ERROR_CODES.ROOT_BINDING_TEAM_SESSION_CONFLICT)
    }
    expect(s4.writeCalls.length).toBe(2)
  })
})

// ── Scenario 5: kind conflict (session bound as team-member) ─────────
const s5World = await createRootBindingWorld('p5t5-s1-kind-conflict', { seedMemberBinding: true })
let s5Error: unknown
try {
  const memberAsRoot = parseRootSessionId(String(P5T5_FIXTURE.memberSessionId))
  s5Error = await captureError(() =>
    bindFreshTeamRoot(s5World.ports, {
      rootSessionId: memberAsRoot,
      blueprint: P5T5_FIXTURE.blueprint,
    }),
  )
} catch (error) {
  s5Error = error
}
const s5 = snapshot(s5World, undefined, s5Error)
await destroyWorld(s5World)

describe('P5-T5 S1 conflicts (cont. 2)', () => {
  it('rejects a session already bound as team-member (kind conflict), fail-closed, before any effect', () => {
    expect(isRootBindingError(s5Error)).toBe(true)
    if (isRootBindingError(s5Error)) {
      expect(s5Error.code).toBe(ROOT_BINDING_ERROR_CODES.ROOT_BINDING_SESSION_KIND_CONFLICT)
      expect(s5Error.details.foundKind).toBe('team-member')
    }
    // No effect at all.
    expect(s5.writeCalls.length).toBe(0)
    expect(s5.surfaceCallCount).toBe(0)
  })
})

// ── Scenario 6: orphan root binding (integrity violation) ────────────
const s6World = await createRootBindingWorld('p5t5-s1-orphan-binding', { seedOrphanRootBinding: true })
let s6Error: unknown
try {
  s6Error = await captureError(() => bindFreshTeamRoot(s6World.ports, freshInput()))
} catch (error) {
  s6Error = error
}
const s6 = snapshot(s6World, undefined, s6Error)
await destroyWorld(s6World)

describe('P5-T5 S1 conflicts (cont. 3)', () => {
  it('rejects a team-root binding without its TeamSession record (integrity violation), fail-closed', () => {
    expect(isRootBindingError(s6Error)).toBe(true)
    if (isRootBindingError(s6Error)) {
      expect(s6Error.code).toBe(ROOT_BINDING_ERROR_CODES.ROOT_BINDING_TEAM_SESSION_CONFLICT)
    }
    expect(s6.writeCalls.length).toBe(0)
    expect(s6.surfaceCallCount).toBe(0)
  })
})

// ── Scenario 7: durable write failure (binding put fails) ────────────
const s7World = await createRootBindingWorld('p5t5-s1-write-failure')
let s7Error: unknown
let s7RepoRecordPresent = false
let s7RepoBindingAfterFailure: string | undefined
let s7SurfaceCallsAfterFailure = 0
let s7Retry: RootBindingResult | undefined
let s7RetryError: unknown
let s7RepoBindingAfterRetry: string | undefined
try {
  const failingWrites: TeamDomainWritePort = {
    putTeamSession: (input) => s7World.writes.putTeamSession(input),
    putSessionBinding: () =>
      Promise.reject(new Error('SEAM_FAILURE: simulated durable write failure')),
  }
  s7Error = await captureError(() =>
    bindFreshTeamRoot({ ...s7World.ports, writes: failingWrites }, freshInput()),
  )
  s7RepoRecordPresent = s7World.domain.repositories.teamSessions.get(ROOT) !== undefined
  s7RepoBindingAfterFailure = s7World.domain.repositories.sessionBindings.get(ROOT)?.kind
  s7SurfaceCallsAfterFailure = s7World.surface.calls.length
  s7Retry = await bindFreshTeamRoot(s7World.ports, freshInput())
  s7RepoBindingAfterRetry = s7World.domain.repositories.sessionBindings.get(ROOT)?.kind
} catch (error) {
  s7RetryError = error
}
await destroyWorld(s7World)

describe('P5-T5 S1 failure matrix', () => {
  it('survives a durable write failure fail-closed: the record stands, the binder is NOT run, the re-run completes', () => {
    expect(s7Error instanceof Error).toBe(true)
    expect(s7RepoRecordPresent).toBe(true)
    expect(s7RepoBindingAfterFailure).toBe(undefined)
    // The binder was NOT run (fail-closed: no agent-setup step on a half-bound root).
    expect(s7SurfaceCallsAfterFailure).toBe(0)
    // The re-run completes the binding on the SAME record (DevPlan §18.5 recovery).
    expect(s7RetryError).toBe(undefined)
    expect(s7Retry?.durable?.wrote).toBe(true)
    expect(s7Retry?.bind.bound).toBe(true)
    expect(s7Retry?.bind.installed).toBe(true)
    expect(s7RepoBindingAfterRetry).toBe('team-root')
  })
})

// ── Scenario 8: invalid generation ───────────────────────────────────
const s8World = await createRootBindingWorld('p5t5-s1-invalid-generation')
let s8Error: unknown
try {
  s8Error = await captureError(() => bindFreshTeamRoot(s8World.ports, freshInput(undefined, 0)))
} catch (error) {
  s8Error = error
}
const s8 = snapshot(s8World, undefined, s8Error)
await destroyWorld(s8World)

describe('P5-T5 S1 failure matrix (cont.)', () => {
  it('rejects an invalid generation before any effect', () => {
    expect(isRootBindingError(s8Error)).toBe(true)
    if (isRootBindingError(s8Error)) {
      expect(s8Error.code).toBe(ROOT_BINDING_ERROR_CODES.ROOT_BINDING_INVALID_INPUT)
    }
    expect(s8.writeCalls.length).toBe(0)
    expect(s8.surfaceCallCount).toBe(0)
  })
})

// ── Scenario 9: overlay slot failure ─────────────────────────────────
const s9World = await createRootBindingWorld('p5t5-s1-slot-failure')
let s9Error: unknown
let s9FaultyApplied = 0
let s9RepoRecordPresent = false
let s9RepoBindingKind: string | undefined
try {
  const faulty = recordingSlot('model', new Error('MODEL_SELECTION_FAILURE: simulated slot fault'))
  s9FaultyApplied = faulty.applied.length
  s9Error = await captureError(() =>
    bindFreshTeamRoot({ ...s9World.ports, slots: { model: faulty } }, freshInput()),
  )
  s9FaultyApplied = faulty.applied.length
  s9RepoRecordPresent = s9World.domain.repositories.teamSessions.get(ROOT) !== undefined
  s9RepoBindingKind = s9World.domain.repositories.sessionBindings.get(ROOT)?.kind
} catch (error) {
  s9Error = error
}
await destroyWorld(s9World)

describe('P5-T5 S1 failure matrix (cont. 2)', () => {
  it('surfaces the binder fail-closed error when an overlay slot fails (no admission, no registration)', () => {
    expect(s9Error instanceof TeamAgentBinderError).toBe(true)
    if (s9Error instanceof TeamAgentBinderError) {
      expect(s9Error.code).toBe('BINDER_OVERLAY_FAILED')
    }
    // The durable commit stands (DevPlan §18.5: the cold path is the recovery).
    expect(s9RepoRecordPresent).toBe(true)
    expect(s9RepoBindingKind).toBe('team-root')
    // The failed slot never applied.
    expect(s9FaultyApplied).toBe(0)
  })
})
