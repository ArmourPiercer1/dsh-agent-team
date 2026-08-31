/**
 * P5-T5 S3 — admission is a DECISION, not an error (ruling R32): the
 * guard rejects → the overlays are still installed (`installed: true`),
 * the root is NOT admitted (`admitted: false` + the `admissionCode`
 * channel), the decision is observable through the admission-decided
 * event, the durable state stands, and the instance stays healthy
 * (the re-decision on a later call can OPEN the admission).
 *
 * Mock-first (ruling R28) for the agent-runtime boundary; the durable
 * layer is REAL. Top-level-await pattern (plain-node shim): scenarios
 * run at module top level, snapshots are captured before destruction,
 * `it` bodies assert only over captured plain data.
 *
 * @module @dsh-agent-team/runtime/test/p5t5-admission
 */

import { describe, expect, it } from 'vitest'
import {
  ADMISSION_GUARD_ERROR_CODE,
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
} from '../agent-setup/binder/index.js'
import {
  bindFreshTeamRoot,
  rehydrateColdTeamRoot,
} from '../root-binding/index.js'
import type { RootBindingResult } from '../root-binding/index.js'
import {
  P5T5_FIXTURE,
  createRootBindingWorld,
  destroyWorld,
  restartRootBindingWorld,
} from './p5t5-helpers.js'
import type { P5T5World } from './p5t5-helpers.js'
import { rejectingGuard, throwingGuard } from './p5t1-helpers.js'

const ROOT = String(P5T5_FIXTURE.rootSessionId)
/** The rejection code of the test policy guard (a decision channel value). */
const REJECTION_CODE = 'ADMISSION_TEAM_POLICY_CLOSED'

interface AdmissionSnapshot {
  readonly result: RootBindingResult | undefined
  readonly error: unknown
  readonly repoBindingKind: string | undefined
  readonly writeCalls: number
  readonly surfaceCallCount: number
  readonly restoreCount: number
  readonly installCount: number
  readonly eventNames: readonly string[]
  readonly eventDetails: readonly (string | undefined)[]
}

function admissionSnapshot(
  world: P5T5World,
  result: RootBindingResult | undefined,
  error: unknown,
): AdmissionSnapshot {
  const events = world.surface.eventsFor(ROOT)
  return {
    result,
    error,
    repoBindingKind: world.domain.repositories.sessionBindings.get(ROOT)?.kind,
    writeCalls: world.writeCalls.length,
    surfaceCallCount: world.surface.calls.length,
    restoreCount: world.surface.countCalls('restoreScope'),
    installCount: world.surface.countCalls('installOverlay'),
    eventNames: events.map((event) => event.name),
    eventDetails: events.map((event) => event.detail),
  }
}

function freshInput() {
  return {
    rootSessionId: P5T5_FIXTURE.rootSessionId,
    blueprint: P5T5_FIXTURE.blueprint,
    defaultWorkspace: P5T5_FIXTURE.defaultWorkspace,
  }
}

// ── Scenario 1: the policy guard rejects (S3) ───────────────────────
const s1World = await createRootBindingWorld('p5t5-s3-reject')
let s1: AdmissionSnapshot
try {
  const result = await bindFreshTeamRoot(
    { ...s1World.ports, admissionGuard: rejectingGuard(REJECTION_CODE) },
    freshInput(),
  )
  s1 = admissionSnapshot(s1World, result, undefined)
} catch (error) {
  s1 = admissionSnapshot(s1World, undefined, error)
}
await destroyWorld(s1World)

describe('P5-T5 S3: admission fail-closed (the guard rejects)', () => {
  it('installs the overlays but does NOT admit: admitted=false + admissionCode channel, the decision is observable, the durable state stands', () => {
    expect(s1.error).toBe(undefined)
    expect(s1.result?.path).toBe('fresh-root')
    expect(s1.result?.bind.bound).toBe(true)
    // The overlays were installed — the rejection is a DECISION, not a fault.
    expect(s1.result?.bind.installed).toBe(true)
    expect(s1.installCount).toBe(3)
    expect(s1.result?.bind.admitted).toBe(false)
    expect(s1.result?.bind.admissionCode).toBe(REJECTION_CODE)

    // The admission decision is observable through the event channel.
    expect(s1.eventNames).toEqual([
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
    ])
    expect(s1.eventDetails[3]).toBe(REJECTION_CODE)

    // The durable state stands (the instance stays healthy).
    // P8-S2 defect-encoding update: 2 → 3 (fresh bind now mints the leader).
    expect(s1.writeCalls).toBe(3)
    expect(s1.repoBindingKind).toBe('team-root')
  })
})

// ── Scenario 2: the guard itself throws (fail-closed, still a decision) ──
const s2World = await createRootBindingWorld('p5t5-s3-guard-throws')
let s2: AdmissionSnapshot
try {
  const result = await bindFreshTeamRoot(
    { ...s2World.ports, admissionGuard: throwingGuard(new Error('GUARD_CRASH: simulated guard fault')) },
    freshInput(),
  )
  s2 = admissionSnapshot(s2World, result, undefined)
} catch (error) {
  s2 = admissionSnapshot(s2World, undefined, error)
}
await destroyWorld(s2World)

describe('P5-T5 S3: admission fail-closed (the guard throws)', () => {
  it('a throwing guard fails CLOSED as a rejection (ADMISSION_GUARD_ERROR code), not as an error', () => {
    expect(s2.error).toBe(undefined)
    expect(s2.result?.bind.bound).toBe(true)
    expect(s2.result?.bind.installed).toBe(true)
    expect(s2.result?.bind.admitted).toBe(false)
    expect(s2.result?.bind.admissionCode).toBe(ADMISSION_GUARD_ERROR_CODE)
    expect(s2.eventDetails[3]).toBe(ADMISSION_GUARD_ERROR_CODE)
  })
})

// ── Scenario 3: the admission is re-decided later (reopen) ──────────
const s3World = await createRootBindingWorld('p5t5-s3-reopen')
let s3First: RootBindingResult | undefined
let s3Second: RootBindingResult | undefined
let s3Error: unknown
try {
  s3First = await bindFreshTeamRoot(
    { ...s3World.ports, admissionGuard: rejectingGuard(REJECTION_CODE) },
    freshInput(),
  )
  // The policy opens later: the SAME durable root is re-decided (a fresh
  // binder on the standing records).
  s3Second = await bindFreshTeamRoot(s3World.ports, freshInput())
} catch (error) {
  s3Error = error
}
const s3 = admissionSnapshot(s3World, s3Second, s3Error)
await destroyWorld(s3World)

describe('P5-T5 S3: admission re-decision (the policy opens later)', () => {
  it('re-decides the standing root as OPEN with zero durable writes (only the original two)', () => {
    expect(s3Error).toBe(undefined)
    expect(s3First?.bind.admitted).toBe(false)
    expect(s3First?.bind.admissionCode).toBe(REJECTION_CODE)
    expect(s3.result?.bind.bound).toBe(true)
    expect(s3.result?.bind.installed).toBe(true)
    expect(s3.result?.bind.admitted).toBe(true)
    expect(s3.result?.bind.admissionCode).toBe(ADMISSION_OPEN_CODE)
    // The durable rows are written exactly once (the original fresh create,
    // including the P8-S2 leader mint: 2 → 3).
    expect(s3.writeCalls).toBe(3)
    // The fresh install re-ran (a fresh binder): 3 + 3 installs, both decisions recorded.
    expect(s3.installCount).toBe(6)
    expect(s3.eventNames).toEqual([
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
    ])
  })
})

// ── Scenario 4: cold re-decision after a restart (policy rejects again) ──
const s4World = await createRootBindingWorld('p5t5-s3-cold-reject')
let s4Current: P5T5World = s4World
let s4: AdmissionSnapshot
try {
  await bindFreshTeamRoot(s4World.ports, freshInput())
  s4Current = await restartRootBindingWorld(s4World)
  const coldResult = await rehydrateColdTeamRoot(
    { ...s4Current.ports, admissionGuard: rejectingGuard(REJECTION_CODE) },
    { rootSessionId: P5T5_FIXTURE.rootSessionId },
  )
  s4 = admissionSnapshot(s4Current, coldResult, undefined)
} catch (error) {
  s4 = admissionSnapshot(s4Current, undefined, error)
}
await destroyWorld(s4Current)

describe('P5-T5 S3: cold re-decision (the policy rejects across a restart)', () => {
  it('restores the scope but does NOT admit: admitted=false + the rejection code, zero durable writes', () => {
    expect(s4.error).toBe(undefined)
    expect(s4.result?.path).toBe('cold-root')
    expect(s4.result?.bind.bound).toBe(true)
    expect(s4.result?.bind.installed).toBe(true)
    expect(s4.restoreCount).toBe(1)
    expect(s4.result?.bind.admitted).toBe(false)
    expect(s4.result?.bind.admissionCode).toBe(REJECTION_CODE)
    expect(s4.eventNames).toEqual([
      AGENT_SETUP_EVENT_NAMES.scopeRestored,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
    ])
    expect(s4.eventDetails).toEqual(['root', REJECTION_CODE])
    expect(s4.writeCalls).toBe(0)
  })
})

// ── Scenario 5: the ordinary no-op is independent of the guard ──────
const s5World = await createRootBindingWorld('p5t5-s3-ordinary')
let s5: AdmissionSnapshot
try {
  const coldResult = await rehydrateColdTeamRoot(
    { ...s5World.ports, admissionGuard: rejectingGuard(REJECTION_CODE) },
    { rootSessionId: P5T5_FIXTURE.rootSessionId },
  )
  s5 = admissionSnapshot(s5World, coldResult, undefined)
} catch (error) {
  s5 = admissionSnapshot(s5World, undefined, error)
}
await destroyWorld(s5World)

describe('P5-T5 S3: ordinary no-op is independent of the guard', () => {
  it('an unbound root no-ops as ordinary regardless of the guard: no decision, no surface call, no record', () => {
    expect(s5.error).toBe(undefined)
    expect(s5.result?.bind.bound).toBe(false)
    expect(s5.result?.bind.installed).toBe(false)
    expect(s5.result?.bind.noopReason).toBe('ordinary')
    expect(s5.result?.bind.admitted).toBe(undefined)
    expect(s5.result?.bind.admissionCode).toBe(undefined)
    expect(s5.result?.durable).toBe(undefined)
    expect(s5.writeCalls).toBe(0)
    expect(s5.surfaceCallCount).toBe(0)
    expect(s5.eventNames).toEqual([])
  })
})
