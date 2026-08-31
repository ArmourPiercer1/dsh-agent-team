/**
 * p7t2-future-boundary — TaskDoc §11.8 P7-T2 must-test: the DevPlan §20.2
 * future-boundary contract for ALL FIVE capability domains (model / tools
 * / permissions / skills / mcp), generalized from the P5-T3 model
 * sequence:
 *
 * ```text
 * step k capture = config C
 * concurrent mutation at step k (any domain) -> record effectiveFromStep k+1
 * in-flight capture C is UNCHANGED (frozen value)
 * step k+1 capture = config C' (the mutation is visible now)
 * ```
 *
 * Also covered here:
 * - the PolicyState transition is a future-boundary mutation too: an
 *   in-flight capture keeps the previous state's resolution;
 * - the capture's `contributions` (source chain) is a frozen snapshot —
 *   later ledger appends never appear in an older capture;
 * - `release()` settles the in-flight work (idempotent; the service's
 *   in-flight count returns to zero);
 * - the negative: `beginStep` on a never-registered instance is
 *   `UNKNOWN_INSTANCE` (no creation fields on record);
 * - the identity boundary at the step edge: a cross-TeamSession member
 *   identity is `IDENTITY_SCOPE_MISMATCH` (invariant 18), and a member is
 *   only bound to steps under its OWN root (invariant 9).
 *
 * @module @dsh-agent-team/runtime/test/p7t2-future-boundary
 */

import { describe, expect, it } from 'vitest'

import type { CapabilityName, PolicyEntry } from '../../domain/policy/src/index.js'
import type { EffectiveConfigCapture } from '../mutation/index.js'
import {
  allow,
  assertMutationCode,
  captureError,
  createP7T2World,
  deny,
  fixtureMember,
  foreignMember,
  makeMember,
  P7T2_ALPHA,
  P7T2_BETA,
  P7T2_GAMMA,
  P7T2_OTHER_TEAM,
  P7T2_TEAM,
  snapshotCapture,
  type P7T2World,
} from './p7t2-helpers.js'

// ---------------------------------------------------------------------------
// Fixture: the five domains fully open (blueprint values + envelope) for
// both registered members; templates carry DENY values, which sit ABOVE
// the blueprint allows (ascending layers blueprint < ... < template), so
// the step-0 baseline resolves to the template deny.
// ---------------------------------------------------------------------------

const OPEN_ITEMS: Record<CapabilityName, readonly string[]> = {
  model: ['m-a', 'm-b', 'm-c'],
  tools: ['t-a', 't-b', 't-c'],
  permissions: ['p-a', 'p-b', 'p-c'],
  skills: ['s-a', 's-b', 's-c'],
  mcp: ['c-a', 'c-b', 'c-c'],
}

function openEntries(): Partial<Record<CapabilityName, PolicyEntry>> {
  const out: Partial<Record<CapabilityName, PolicyEntry>> = {}
  for (const [capability, items] of Object.entries(OPEN_ITEMS)) {
    out[capability as CapabilityName] = allow(...(items as string[]))
  }
  return out
}

function denyEntries(): Partial<Record<CapabilityName, PolicyEntry>> {
  const out: Partial<Record<CapabilityName, PolicyEntry>> = {}
  for (const capability of Object.keys(OPEN_ITEMS)) {
    out[capability as CapabilityName] = deny()
  }
  return out
}

const alpha = () => fixtureMember(P7T2_ALPHA)
const beta = () => fixtureMember(P7T2_BETA)
const gamma = () => fixtureMember(P7T2_GAMMA)

interface CellSnapshot {
  effective: PolicyEntry
  layer: string
  origin: string
  recordId: string | null
  note: string
}

// ---------------------------------------------------------------------------
// Scenario 1: the five-domain future boundary on member overlays
// ---------------------------------------------------------------------------

interface FiveDomainSnapshot {
  readonly capture0: EffectiveConfigCapture
  readonly capture0Before: Record<string, unknown>
  readonly capture0After: Record<string, unknown>
  readonly recordIds: Record<string, string>
  readonly overlayItems: Record<string, string>
  readonly slotRecordId: string
  readonly capture1: EffectiveConfigCapture
  readonly capture1Before: Record<string, unknown>
  readonly inflightAfterRelease: number
  readonly unregisteredBegin: { thrown: boolean; code?: string; details?: Record<string, unknown> }
}

const s1: FiveDomainSnapshot = (() => {
  const world: P7T2World = createP7T2World({
    blueprint: { values: openEntries(), autonomyEnvelope: openEntries() },
    templates: {
      [P7T2_ALPHA]: { values: denyEntries(), mutationEnvelope: openEntries() },
      [P7T2_BETA]: { values: denyEntries(), mutationEnvelope: openEntries() },
    },
  })
  const { service, clock } = world

  service.registerInstance(P7T2_TEAM, alpha(), { workspace: 'ws-alpha', contextPolicy: 'ctx-alpha' })
  service.registerInstance(P7T2_TEAM, beta(), { workspace: 'ws-beta', contextPolicy: 'ctx-beta' })

  // Step 0: alpha's in-flight capture (before any overlay).
  const capture0 = service.beginStep(alpha())
  const capture0Before = snapshotCapture(capture0)

  // Concurrent member mutations at step 0 — one per capability domain
  // (each grant picks the SECOND envelope item — in-envelope by fixture).
  const recordIds: Record<string, string> = {}
  const overlayItems: Record<string, string> = {}
  let lastRecordId: string | undefined
  for (const capability of Object.keys(OPEN_ITEMS) as CapabilityName[]) {
    const item = OPEN_ITEMS[capability][1]
    if (item === undefined) throw new Error('p7t2 fixture: OPEN_ITEMS needs two items per capability')
    const record = service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability,
      value: allow(item),
      actor: { kind: 'member', member: alpha() },
    })
    recordIds[capability] = record.recordId
    overlayItems[capability] = item
    lastRecordId = record.recordId
  }
  if (lastRecordId === undefined) throw new Error('p7t2 fixture: no mutations were admitted')

  // The in-flight capture is UNCHANGED by the concurrent mutations.
  const capture0After = snapshotCapture(capture0)

  // Step 1: alpha's next capture resolves the overlays afresh.
  clock.advance()
  const capture1 = service.beginStep(alpha())
  const capture1Before = snapshotCapture(capture1)

  // Release (twice — idempotent).
  capture0.release()
  capture0.release()
  capture1.release()
  capture1.release()
  const inflightAfterRelease = service.inflightCount()

  // Negative: beginStep on a never-registered instance.
  const unregisteredErr = captureError(() => service.beginStep(gamma()))
  const unregisteredBegin = unregisteredErr.thrown
    ? (() => {
        const checked = assertMutationCode(unregisteredErr.error, 'UNKNOWN_INSTANCE')
        return { thrown: true, code: checked.code, details: checked.details }
      })()
    : { thrown: false }

  return {
    capture0,
    capture0Before,
    capture0After,
    recordIds,
    overlayItems,
    slotRecordId: lastRecordId,
    capture1,
    capture1Before,
    inflightAfterRelease,
    unregisteredBegin,
  }
})()

describe('p7t2 future boundary: the five-domain DevPlan §20.2 sequence', () => {
  it('step 0 capture: the template baseline (deny) wins every domain', () => {
    expect(s1.capture0Before.step).toBe(0)
    const cells = s1.capture0Before.cells as Record<string, CellSnapshot>
    for (const capability of Object.keys(OPEN_ITEMS) as CapabilityName[]) {
      const cell = cells[capability]
      if (cell === undefined) throw new Error(`p7t2 snapshot: missing cell '${capability}'`)
      // Ascending layers: the template's deny values sit above the
      // blueprint's allows, so the step-0 baseline is the template deny.
      expect(cell.effective).toEqual({ kind: 'deny' })
      expect(cell.layer).toBe('template')
      expect(cell.origin).toBe('static')
      expect(cell.recordId).toBe(null)
    }
  })

  it('the concurrent member mutations are all admitted at step 0', () => {
    for (const capability of Object.keys(OPEN_ITEMS) as CapabilityName[]) {
      const recordId = s1.recordIds[capability]
      if (recordId === undefined) throw new Error(`p7t2 snapshot: missing recordId '${capability}'`)
      expect(typeof recordId).toBe('string')
      expect(recordId.length).toBeGreaterThan(0)
    }
  })

  it('the in-flight capture0 is UNCHANGED by the concurrent mutations (frozen value)', () => {
    expect(s1.capture0After).toEqual(s1.capture0Before)
  })

  it('capture0 contributions are a frozen snapshot (no later ledger entries appear)', () => {
    expect((s1.capture0Before.contributions as unknown[]).length).toBe(0)
    expect((s1.capture0After.contributions as unknown[]).length).toBe(0)
  })

  it('step 1 capture: every domain cell resolves to the member overlay', () => {
    const cells = s1.capture1Before.cells as Record<string, CellSnapshot>
    for (const capability of Object.keys(OPEN_ITEMS) as CapabilityName[]) {
      const cell = cells[capability]
      if (cell === undefined) throw new Error(`p7t2 snapshot: missing cell '${capability}'`)
      const overlayItem = s1.overlayItems[capability]
      if (overlayItem === undefined) throw new Error(`p7t2 snapshot: missing overlay item '${capability}'`)
      expect(cell.effective).toEqual({ kind: 'allow', items: [overlayItem] })
      expect(cell.layer).toBe('instanceOverlay')
      expect(cell.origin).toBe('member')
      // The assembled instanceOverlay slot carries a SINGLE id — the
      // latest contributing durable record overall (design decision); the
      // per-capability identity lives in the contributions ledger below.
      expect(cell.recordId).toBe(s1.slotRecordId)
    }
  })

  it('step 1 contributions chain every overlay to its ledger entry (source per item)', () => {
    const contributions = s1.capture1Before.contributions as Array<{
      recordKind: string
      origin: string
      capability?: string
      recordId?: string
      effectiveFromStep: number
    }>
    for (const capability of Object.keys(OPEN_ITEMS) as CapabilityName[]) {
      const entry = contributions.find(
        (e) => e.capability === capability && e.recordId === s1.recordIds[capability],
      )
      expect(entry !== undefined).toBe(true)
      expect(entry?.origin).toBe('member')
      expect(entry?.effectiveFromStep).toBe(1)
    }
  })

  it('release() settles the in-flight work (idempotent; count returns to zero)', () => {
    expect(s1.inflightAfterRelease).toBe(0)
  })

  it('beginStep on a never-registered instance is UNKNOWN_INSTANCE', () => {
    expect(s1.unregisteredBegin.thrown).toBe(true)
    expect(s1.unregisteredBegin.code).toBe('UNKNOWN_INSTANCE')
    expect(s1.unregisteredBegin.details?.instanceId).toBe(P7T2_GAMMA)
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: the PolicyState transition is a future-boundary mutation
// ---------------------------------------------------------------------------

interface StateTransitionSnapshot {
  readonly captureB0Before: Record<string, unknown>
  readonly captureB0After: Record<string, unknown>
  readonly captureB1: Record<string, unknown>
  readonly inflightAfterRelease: number
}

const s2: StateTransitionSnapshot = (() => {
  const world: P7T2World = createP7T2World({
    blueprint: { values: openEntries(), autonomyEnvelope: openEntries() },
    // Open template values: when the locked state suppresses the stored
    // overlay, the fallback lands on the template allow (not the blueprint).
    templates: {
      [P7T2_BETA]: { values: openEntries(), mutationEnvelope: openEntries() },
    },
  })
  const { service, clock } = world

  service.registerInstance(P7T2_TEAM, beta(), { workspace: 'ws-beta', contextPolicy: 'ctx-beta' })

  // Step 0: beta overlays model (in-envelope) — effective from step 1.
  service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'model',
    value: allow('m-b'),
    actor: { kind: 'member', member: beta() },
  })

  // Step 1: beta's in-flight capture — the overlay IS effective now.
  clock.advance()
  const captureB0 = service.beginStep(beta())
  const captureB0Before = snapshotCapture(captureB0)

  // Concurrent state transition (leader) at step 1 — locks model,
  // effective from step 2.
  service.switchPolicyState({
    teamSessionId: P7T2_TEAM,
    target: { stateId: 'locked-model', cells: { model: { locked: true } } },
    actor: { kind: 'leader' },
  })

  // The in-flight capture keeps the PRE-transition resolution.
  const captureB0After = snapshotCapture(captureB0)

  // Step 2: beta's next capture — the locked state suppresses the stored
  // allow overlay; the cell falls back to the template baseline (the
  // template values beat the blueprint values in the ascending order).
  clock.advance()
  const captureB1 = service.beginStep(beta())
  const captureB1Before = snapshotCapture(captureB1)

  captureB0.release()
  captureB1.release()
  return {
    captureB0Before,
    captureB0After,
    captureB1: captureB1Before,
    inflightAfterRelease: service.inflightCount(),
  }
})()

describe('p7t2 future boundary: the PolicyState transition is future-boundary too', () => {
  it('the in-flight capture sees the overlay under the default state', () => {
    const cells = s2.captureB0Before.cells as Record<string, CellSnapshot>
    const model = cells.model
    if (model === undefined) throw new Error('p7t2 snapshot: missing model cell')
    expect(s2.captureB0Before.policyStateId).toBe('default')
    expect(model.effective).toEqual({ kind: 'allow', items: ['m-b'] })
    expect(model.layer).toBe('instanceOverlay')
    expect(model.recordId).not.toBe(null)
  })

  it('the in-flight capture is UNCHANGED by the concurrent state transition', () => {
    expect(s2.captureB0After).toEqual(s2.captureB0Before)
  })

  it('the next capture: the locked state suppresses the stored allow overlay (non-destructive)', () => {
    const cells = s2.captureB1.cells as Record<string, CellSnapshot>
    const model = cells.model
    if (model === undefined) throw new Error('p7t2 snapshot: missing model cell')
    expect(s2.captureB1.policyStateId).toBe('locked-model')
    expect(model.effective).toEqual({ kind: 'allow', items: [...OPEN_ITEMS.model] })
    expect(model.layer).toBe('template')
    expect(model.origin).toBe('static')
    const suppressed = s2.captureB1.suppressed as Array<{
      capability: string
      layer: string
      origin: string
      value: PolicyEntry
      reason: string
      policyStateId: string
    }>
    expect(suppressed.length).toBe(1)
    const suppressed0 = suppressed[0]
    if (suppressed0 === undefined) throw new Error('p7t2 snapshot: missing suppression record')
    expect(suppressed0.capability).toBe('model')
    expect(suppressed0.layer).toBe('instanceOverlay')
    expect(suppressed0.origin).toBe('member')
    expect(suppressed0.value).toEqual({ kind: 'allow', items: ['m-b'] })
    expect(suppressed0.reason).toBe('policyStateLocked')
    expect(suppressed0.policyStateId).toBe('locked-model')
  })

  it('the in-flight work is settled', () => {
    expect(s2.inflightAfterRelease).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: the identity boundary at the step edge (invariant 18/9)
// ---------------------------------------------------------------------------

interface IdentitySnapshot {
  readonly foreignRegister: { thrown: boolean; code?: string }
  readonly foreignResolve: { thrown: boolean; code?: string }
  readonly foreignMutation: { thrown: boolean; code?: string }
  readonly foreignOwnStepOk: boolean
}

const s3: IdentitySnapshot = (() => {
  const world: P7T2World = createP7T2World({
    blueprint: { values: openEntries(), autonomyEnvelope: openEntries() },
  })
  const { service } = world
  service.registerInstance(P7T2_TEAM, alpha(), { workspace: 'ws-alpha', contextPolicy: 'ctx-alpha' })

  const foreignRegisterErr = captureError(() =>
    service.registerInstance(P7T2_TEAM, foreignMember(P7T2_GAMMA), {
      workspace: 'ws-gamma',
      contextPolicy: 'ctx-gamma',
    }),
  )
  const foreignResolveErr = captureError(() =>
    service.resolveEffective(P7T2_TEAM, foreignMember(P7T2_GAMMA)),
  )
  const foreignMutationErr = captureError(() =>
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: deny(),
      actor: { kind: 'member', member: foreignMember(P7T2_ALPHA) },
    }),
  )
  // Positive control: the same member identity is valid under its OWN root
  // (invariant 9: the team IS the root) — register + step there.
  service.registerInstance(P7T2_OTHER_TEAM, makeMember(P7T2_OTHER_TEAM, P7T2_GAMMA), {
    workspace: 'ws-gamma-own',
    contextPolicy: 'ctx-gamma-own',
  })
  const ownStepErr = captureError(() => {
    const capture = service.beginStep(makeMember(P7T2_OTHER_TEAM, P7T2_GAMMA))
    capture.release()
  })
  return {
    foreignRegister: foreignRegisterErr.thrown
      ? { thrown: true, code: assertMutationCode(foreignRegisterErr.error, 'IDENTITY_SCOPE_MISMATCH').code }
      : { thrown: false },
    foreignResolve: foreignResolveErr.thrown
      ? { thrown: true, code: assertMutationCode(foreignResolveErr.error, 'IDENTITY_SCOPE_MISMATCH').code }
      : { thrown: false },
    foreignMutation: foreignMutationErr.thrown
      ? { thrown: true, code: assertMutationCode(foreignMutationErr.error, 'IDENTITY_SCOPE_MISMATCH').code }
      : { thrown: false },
    foreignOwnStepOk: !ownStepErr.thrown,
  }
})()

describe('p7t2 future boundary: identity at the step edge', () => {
  it('a cross-team member cannot register under the fixture team', () => {
    expect(s3.foreignRegister.thrown).toBe(true)
    expect(s3.foreignRegister.code).toBe('IDENTITY_SCOPE_MISMATCH')
  })

  it('a cross-team member cannot be resolved for the fixture team', () => {
    expect(s3.foreignResolve.thrown).toBe(true)
    expect(s3.foreignResolve.code).toBe('IDENTITY_SCOPE_MISMATCH')
  })

  it('a cross-team member cannot mutate the fixture team', () => {
    expect(s3.foreignMutation.thrown).toBe(true)
    expect(s3.foreignMutation.code).toBe('IDENTITY_SCOPE_MISMATCH')
  })

  it('the same identity is valid under its own root (invariant 9)', () => {
    expect(s3.foreignOwnStepOk).toBe(true)
  })
})
