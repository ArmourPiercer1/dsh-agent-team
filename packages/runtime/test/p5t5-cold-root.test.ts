/**
 * P5-T5 S2/S4 — the cold Team root (DevPlan §18.5 process restart; the
 * scope is fully restored BEFORE the first Team-sensitive step) and the
 * ordinary-root no-op (zero records, zero effects), plus the cold
 * path's fail-closed matrix.
 *
 * The process-restart model (ruling R32): `restartRootBindingWorld`
 * re-opens the SAME scratch dir with a NEW seam + domain handle and a
 * FRESH surface (the ephemeral Agent residency does not survive; the
 * durable TeamDomain records DO).
 *
 * Mock-first (ruling R28) for the agent-runtime boundary; the durable
 * layer is REAL. Top-level-await pattern (plain-node shim): scenarios
 * run at module top level, snapshots are captured before destruction,
 * `it` bodies assert only over captured plain data.
 *
 * @module @dsh-agent-team/runtime/test/p5t5-cold-root
 */

import { describe, expect, it } from 'vitest'
import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  TEAM_AGENT_BINDER_ERROR_CODES,
  TeamAgentBinderError,
} from '../agent-setup/binder/index.js'
import { parseRootSessionId } from '../../contracts/src/index.js'
import {
  bindFreshTeamRoot,
  rehydrateColdTeamRoot,
} from '../root-binding/index.js'
import type { RootBindingResult } from '../root-binding/index.js'
import {
  P5T5_FIXTURE,
  captureError,
  createRootBindingWorld,
  destroyWorld,
  restartRootBindingWorld,
} from './p5t5-helpers.js'
import type { P5T5World } from './p5t5-helpers.js'
import { recordingSlot } from './p5t1-helpers.js'

const ROOT = String(P5T5_FIXTURE.rootSessionId)
const ORDINARY_AS_ROOT = parseRootSessionId(String(P5T5_FIXTURE.ordinarySessionId))

interface ColdSnapshot {
  readonly result: RootBindingResult | undefined
  readonly error: unknown
  readonly repoTeamSessionGeneration: number | undefined
  readonly repoBindingKind: string | undefined
  readonly writeCalls: number
  readonly surfaceCallCount: number
  readonly restoreCount: number
  readonly installCount: number
  readonly eventNames: readonly string[]
  readonly eventDetails: readonly (string | undefined)[]
  readonly restoreScope: unknown
}

function coldSnapshot(world: P5T5World, result: RootBindingResult | undefined, error: unknown): ColdSnapshot {
  const events = world.surface.eventsFor(ROOT)
  const restoreCall = world.surface.calls.find((call) => call.method === 'restoreScope')
  return {
    result,
    error,
    repoTeamSessionGeneration: world.domain.repositories.teamSessions.get(ROOT)?.generation,
    repoBindingKind: world.domain.repositories.sessionBindings.get(ROOT)?.kind,
    writeCalls: world.writeCalls.length,
    surfaceCallCount: world.surface.calls.length,
    restoreCount: world.surface.countCalls('restoreScope'),
    installCount: world.surface.countCalls('installOverlay'),
    eventNames: events.map((event) => event.name),
    eventDetails: events.map((event) => event.detail),
    restoreScope: restoreCall?.scope,
  }
}

function freshInput() {
  return {
    rootSessionId: P5T5_FIXTURE.rootSessionId,
    blueprint: P5T5_FIXTURE.blueprint,
    defaultWorkspace: P5T5_FIXTURE.defaultWorkspace,
  }
}

// ── Scenario 1: the full process-restart cold root (S2) ─────────────
const s1World = await createRootBindingWorld('p5t5-s2-restart')
let s1Current: P5T5World = s1World
let s1: ColdSnapshot
let s1SlotApplied = [0, 0, 0]
try {
  await bindFreshTeamRoot(s1World.ports, freshInput())
  s1Current = await restartRootBindingWorld(s1World)
  const persona = recordingSlot('persona')
  const model = recordingSlot('model')
  const capability = recordingSlot('capability')
  const coldResult = await rehydrateColdTeamRoot(
    {
      ...s1Current.ports,
      slots: { persona, model, capability },
    },
    { rootSessionId: P5T5_FIXTURE.rootSessionId },
  )
  s1SlotApplied = [persona.applied.length, model.applied.length, capability.applied.length]
  s1 = coldSnapshot(s1Current, coldResult, undefined)
} catch (error) {
  s1 = coldSnapshot(s1Current, undefined, error)
}
await destroyWorld(s1Current)

describe('P5-T5 S2: process-restart cold root (scope restored before any Team step)', () => {
  it('rehydrates from the durable records: one restoreScope (full slot scope), no slot.apply, no installOverlay, no durable writes, admitted', () => {
    expect(s1.error).toBe(undefined)
    expect(s1.result?.path).toBe('cold-root')
    expect(s1.result?.durable?.wrote).toBe(false)
    expect(String(s1.result?.durable?.teamSession?.rootSessionId)).toBe(ROOT)
    expect(s1.result?.durable?.teamSession?.generation).toBe(1)
    expect(s1.result?.durable?.teamSession?.blueprint.blueprintId).toBe(P5T5_FIXTURE.blueprint.blueprintId)
    expect(s1.result?.durable?.binding?.kind).toBe('team-root')

    // Durable truth survived the restart on the MEDIUM.
    expect(s1.repoTeamSessionGeneration).toBe(1)
    expect(s1.repoBindingKind).toBe('team-root')

    // The cold scope restore: exactly one restoreScope with the FULL scope,
    // and NO per-slot apply (restore is delegated to the surface).
    expect(s1.restoreCount).toBe(1)
    expect(s1.installCount).toBe(0)
    expect(s1SlotApplied).toEqual([0, 0, 0])
    expect(s1.restoreScope).toEqual({
      kind: 'root',
      rootSessionId: ROOT,
      slots: ['persona', 'model', 'capability'],
    })

    // No durable writes on the cold path (the records stand).
    expect(s1.writeCalls).toBe(0)

    // The agent-setup step and the admission decision.
    expect(s1.result?.bind.bound).toBe(true)
    expect(s1.result?.bind.installed).toBe(true)
    expect(s1.result?.bind.noopReason).toBe(undefined)
    expect(s1.result?.bind.identity?.kind).toBe('root')
    expect(s1.result?.bind.identity?.sessionId).toBe(ROOT)
    expect(s1.result?.bind.admitted).toBe(true)
    expect(s1.result?.bind.admissionCode).toBe(ADMISSION_OPEN_CODE)
    expect(s1.eventNames).toEqual([
      AGENT_SETUP_EVENT_NAMES.scopeRestored,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
    ])
    expect(s1.eventDetails).toEqual(['root', ADMISSION_OPEN_CODE])
  })
})

// ── Scenario 2: same-realm residency loss (restart without process death) ──
const s2World = await createRootBindingWorld('p5t5-s2-residency-loss')
let s2: ColdSnapshot
let s2Error: unknown
try {
  await bindFreshTeamRoot(s2World.ports, freshInput())
  s2World.surface.dropResidency(ROOT)
  const coldResult = await rehydrateColdTeamRoot(s2World.ports, {
    rootSessionId: P5T5_FIXTURE.rootSessionId,
  })
  s2 = coldSnapshot(s2World, coldResult, undefined)
} catch (error) {
  s2 = coldSnapshot(s2World, undefined, error)
  s2Error = error
}
await destroyWorld(s2World)

describe('P5-T5 S2: same-realm residency loss (cold re-restore on the standing records)', () => {
  it('re-restores the scope once (fresh binder, empty residency), zero durable writes, on top of the fresh events', () => {
    expect(s2Error).toBe(undefined)
    expect(s2.error).toBe(undefined)
    expect(s2.result?.path).toBe('cold-root')
    expect(s2.result?.durable?.wrote).toBe(false)
    expect(s2.result?.bind.bound).toBe(true)
    expect(s2.result?.bind.installed).toBe(true)
    // The fresh bind's 4 events + the cold restore's 2 events.
    expect(s2.restoreCount).toBe(1)
    expect(s2.installCount).toBe(3)
    expect(s2.eventNames).toEqual([
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.overlayInstalled,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
      AGENT_SETUP_EVENT_NAMES.scopeRestored,
      AGENT_SETUP_EVENT_NAMES.admissionDecided,
    ])
    // The fresh bind wrote 3 rows (record, binding, P8-S2 leader mint);
    // the cold re-run adds zero. (P8-S2 defect-encoding update: 2 → 3.)
    expect(s2.writeCalls).toBe(3)
  })
})

// ── Scenario 3: S4 unbound root (zero records / effects) ────────────
const s3World = await createRootBindingWorld('p5t5-s4-unbound')
let s3: ColdSnapshot
let s3Error: unknown
try {
  const coldResult = await rehydrateColdTeamRoot(s3World.ports, {
    rootSessionId: P5T5_FIXTURE.rootSessionId,
  })
  s3 = coldSnapshot(s3World, coldResult, undefined)
} catch (error) {
  s3 = coldSnapshot(s3World, undefined, error)
  s3Error = error
}
await destroyWorld(s3World)

describe('P5-T5 S4: ordinary root (unbound) — zero records, zero effects', () => {
  it('no-ops as ordinary: no binding row is created, no surface call, no record, no event', () => {
    expect(s3Error).toBe(undefined)
    expect(s3.error).toBe(undefined)
    expect(s3.result?.bind.bound).toBe(false)
    expect(s3.result?.bind.installed).toBe(false)
    expect(s3.result?.bind.noopReason).toBe('ordinary')
    expect(s3.result?.bind.emittedEvents).toEqual([])
    expect(s3.result?.durable).toBe(undefined)
    expect(s3.writeCalls).toBe(0)
    expect(s3.surfaceCallCount).toBe(0)
    expect(s3.eventNames).toEqual([])
    // No record was ever written.
    expect(s3.repoTeamSessionGeneration).toBe(undefined)
    expect(s3.repoBindingKind).toBe(undefined)
  })
})

// ── Scenario 4: S4 seeded-ordinary root ─────────────────────────────
const s4World = await createRootBindingWorld('p5t5-s4-ordinary', { seedOrdinaryBinding: true })
let s4: ColdSnapshot
let s4Error: unknown
try {
  const coldResult = await rehydrateColdTeamRoot(s4World.ports, {
    rootSessionId: ORDINARY_AS_ROOT,
  })
  s4 = {
    ...coldSnapshot(s4World, coldResult, undefined),
    repoBindingKind: s4World.domain.repositories.sessionBindings.get(
      String(P5T5_FIXTURE.ordinarySessionId),
    )?.kind,
  }
} catch (error) {
  s4 = coldSnapshot(s4World, undefined, error)
  s4Error = error
}
await destroyWorld(s4World)

describe('P5-T5 S4: ordinary root (ordinary binding) — zero records, zero effects', () => {
  it('no-ops as ordinary on the standing ordinary binding row: no surface call, no event, no new record', () => {
    expect(s4Error).toBe(undefined)
    expect(s4.error).toBe(undefined)
    expect(s4.result?.bind.bound).toBe(false)
    expect(s4.result?.bind.installed).toBe(false)
    expect(s4.result?.bind.noopReason).toBe('ordinary')
    expect(s4.result?.durable).toBe(undefined)
    expect(s4.writeCalls).toBe(0)
    expect(s4.surfaceCallCount).toBe(0)
    expect(s4.eventNames).toEqual([])
    // The pre-existing ordinary row is untouched.
    expect(s4.repoBindingKind).toBe('ordinary')
  })
})

// ── Scenario 5: cold fail-closed — orphan root binding ──────────────
const s5World = await createRootBindingWorld('p5t5-s2-orphan', { seedOrphanRootBinding: true })
let s5Error: unknown
try {
  s5Error = await captureError(() =>
    rehydrateColdTeamRoot(s5World.ports, { rootSessionId: P5T5_FIXTURE.rootSessionId }),
  )
} catch (error) {
  s5Error = error
}
const s5 = coldSnapshot(s5World, undefined, s5Error)
await destroyWorld(s5World)

describe('P5-T5 S2 fail-closed', () => {
  it('rejects a team-root binding without its TeamSession record (BINDER_TARGET_NOT_FOUND), before any effect', () => {
    expect(s5Error instanceof TeamAgentBinderError).toBe(true)
    if (s5Error instanceof TeamAgentBinderError) {
      expect(s5Error.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_TARGET_NOT_FOUND)
    }
    expect(s5.writeCalls).toBe(0)
    expect(s5.surfaceCallCount).toBe(0)
    expect(s5.eventNames).toEqual([])
  })
})

// ── Scenario 6: cold fail-closed — kind mismatch ────────────────────
const s6World = await createRootBindingWorld('p5t5-s2-kind-mismatch', { seedMemberBinding: true })
let s6Error: unknown
try {
  const memberAsRoot = parseRootSessionId(String(P5T5_FIXTURE.memberSessionId))
  s6Error = await captureError(() =>
    rehydrateColdTeamRoot(s6World.ports, { rootSessionId: memberAsRoot }),
  )
} catch (error) {
  s6Error = error
}
const s6 = coldSnapshot(s6World, undefined, s6Error)
await destroyWorld(s6World)

describe('P5-T5 S2 fail-closed (cont.)', () => {
  it('rejects a session bound as team-member on the root path (BINDER_TARGET_KIND_MISMATCH), before any effect', () => {
    expect(s6Error instanceof TeamAgentBinderError).toBe(true)
    if (s6Error instanceof TeamAgentBinderError) {
      expect(s6Error.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_TARGET_KIND_MISMATCH)
    }
    expect(s6.writeCalls).toBe(0)
    expect(s6.surfaceCallCount).toBe(0)
    expect(s6.eventNames).toEqual([])
  })
})

// ── Scenario 7: cold fail-closed — restoreScope fault ───────────────
const s7World = await createRootBindingWorld('p5t5-s2-restore-fault')
let s7Error: unknown
let s7Events: readonly { readonly name: string }[] = []
try {
  await bindFreshTeamRoot(s7World.ports, freshInput())
  s7World.surface.dropResidency(ROOT)
  s7World.surface.failNextRestore(new Error('RESTORE_FAILURE: simulated scope restore fault'))
  s7Error = await captureError(() =>
    rehydrateColdTeamRoot(s7World.ports, { rootSessionId: P5T5_FIXTURE.rootSessionId }),
  )
  s7Events = s7World.surface.eventsFor(ROOT).map((event) => ({ name: event.name }))
} catch (error) {
  s7Error = error
}
const s7 = coldSnapshot(s7World, undefined, s7Error)
await destroyWorld(s7World)

describe('P5-T5 S2 fail-closed (cont. 2)', () => {
  it('rejects a restoreScope fault (BINDER_OVERLAY_FAILED): no scope-restored event, the fresh events stand', () => {
    expect(s7Error instanceof TeamAgentBinderError).toBe(true)
    if (s7Error instanceof TeamAgentBinderError) {
      expect(s7Error.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
    }
    // The failed restore recorded no event: ROOT keeps exactly the fresh bind's events.
    expect(s7Events).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled },
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled },
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided },
    ])
    // The durable state stands; the cold attempt wrote nothing.
    // (P8-S2 defect-encoding update: 2 → 3, the fresh phase mints the leader.)
    expect(s7.writeCalls).toBe(3)
    expect(s7.repoTeamSessionGeneration).toBe(1)
    expect(s7.repoBindingKind).toBe('team-root')
  })
})
