/**
 * p5t2-persona-cold-bind — TaskDoc §11.5 P5-T2 must-test group 4: COLD
 * BIND (mock-first, real P4 repositories + FileStorageSeam as the durable
 * truth, all through the T1 binder).
 *
 * DevPlan §18.5 (Architecture §14.3): the Agent residency is EPHEMERAL;
 * the TeamDomain is DURABLE. A cold rehydrate after a restart (the
 * process-restart model: a new seam over the same scratch dir) restores
 * the persona scope from the durable records — ONE `restoreScope` with
 * the full slot set (including `persona`) and the stable identity — and
 * does NOT re-run fresh-time side effects: no slot `apply`, no persona
 * compatibility probe, no scoped-identity installation, no `installOverlay`.
 *
 * @module @dsh-agent-team/runtime/test/p5t2-persona-cold-bind
 */

import { describe, expect, it } from 'vitest'

import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  OVERLAY_SLOT_ORDER,
} from '../agent-setup/binder/index.js'
import type { RestoredScope } from '../agent-setup/binder/index.js'
import {
  destroyDir,
  recordingSlot,
  restartTeamWorld,
  seedTeamWorld,
} from './p5t1-helpers.js'
import type { FakeSurfaceCall } from './p5t1-helpers.js'
import { createP5T2Rig } from './p5t2-helpers.js'
import type { P5T2Rig } from './p5t2-helpers.js'

const world = await seedTeamWorld('p5t2-cold-a')
const root = world.ids.rootSessionId
const child = world.ids.childSessionId
const instance = world.ids.instanceId

/** The fresh (first-process) bind phase: both agents bound with the persona slot. */
const freshRig = createP5T2Rig(world)
const freshRoot = freshRig.binder.bindFreshRoot(root)
const freshMember = freshRig.binder.bindFreshMember(child)

const freshRootIdentity = freshRoot.identity
const freshMemberIdentity = freshMember.identity

// The process restart: the durable records survive; the residency does not.
const reopened = await restartTeamWorld(world.scratchDir)

/** Find the (single) recorded `restoreScope` call for one session. */
function restoreCall(rig: P5T2Rig, sessionId: string): FakeSurfaceCall {
  const calls = rig.surface.calls.filter(
    (call) => call.method === 'restoreScope' && call.sessionId === sessionId,
  )
  expect(calls.length).toBe(1)
  const call = calls[0]
  expect(call !== undefined).toBe(true)
  if (call === undefined) throw new Error('unreachable')
  return call
}

describe('P5-T2 group 4: cold bind — persona scope restored from durable records, no fresh-time side effects', () => {
  it('the fresh phase installed the persona scope (the pre-restart evidence)', () => {
    expect(freshRoot.installed).toBe(true)
    expect(freshMember.installed).toBe(true)
    expect(freshRig.promptSurface.installed.length).toBe(2)
    expect(freshRig.evaluator.count).toBe(2)
  })

  it('cold root rehydrate restores the full persona scope once, identity equals the fresh identity', () => {
    const model = recordingSlot('model')
    const capability = recordingSlot('capability')
    const rig = createP5T2Rig(world, {
      domain: reopened,
      modelSlot: model,
      capabilitySlot: capability,
    })

    const result = rig.binder.rehydrateColdRoot(root)

    expect(result.requested).toBe('cold-root')
    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.admitted).toBe(true)
    expect(result.admissionCode).toBe(ADMISSION_OPEN_CODE)
    // The identity comes from the DURABLE record — equals the fresh identity.
    expect(result.identity).toEqual(freshRootIdentity)
    expect(result.identity).toEqual({ kind: 'root', sessionId: root, rootSessionId: root })

    // ONE restoreScope with the FULL slot set (persona included) — the
    // persona scope is restored from the durable records.
    const call = restoreCall(rig, root)
    expect(call.scope).toEqual({
      kind: 'root',
      rootSessionId: root,
      slots: [...OVERLAY_SLOT_ORDER],
    } as RestoredScope)

    // NO fresh-time side effects (the cold path never calls slot apply).
    expect(rig.surface.countCalls('installOverlay')).toBe(0)
    expect(rig.promptSurface.installed.length).toBe(0)
    expect(rig.evaluator.count).toBe(0)
    expect(rig.personaSource.leaderQueries.length).toBe(0)
    expect(rig.personaSource.memberQueries.length).toBe(0)
    expect(rig.presetSeam.queriedRootSessionIds.length).toBe(0)
    expect(model.applied.length).toBe(0)
    expect(capability.applied.length).toBe(0)

    // The cold event sequence: scope-restored + admission-decided only.
    expect(rig.surface.eventsFor(root)).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.scopeRestored, detail: 'root' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
    ])

    // The restored residency carries the full slot set: a second cold
    // rehydrate is the already-bound no-op (no duplicate restore).
    const again = rig.binder.rehydrateColdRoot(root)
    expect(again.installed).toBe(false)
    expect(again.noopReason).toBe('already-bound')
    expect(again.emittedEvents.length).toBe(0)
    expect(rig.surface.countCalls('restoreScope', root)).toBe(1)
    expect(rig.surface.countCalls('recordSessionEvent', root)).toBe(2)
    expect(rig.evaluator.count).toBe(0)
  })

  it('cold member rehydrate restores the member persona scope once (identity + instanceId, no fresh-time side effects)', () => {
    const model = recordingSlot('model')
    const capability = recordingSlot('capability')
    const rig = createP5T2Rig(world, {
      domain: reopened,
      modelSlot: model,
      capabilitySlot: capability,
    })

    const result = rig.binder.rehydrateColdMember(child)

    expect(result.requested).toBe('cold-member')
    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.admitted).toBe(true)
    // The composite identity from the durable records — equals the fresh identity.
    expect(result.identity).toEqual(freshMemberIdentity)
    expect(result.identity).toEqual({
      kind: 'member',
      sessionId: child,
      rootSessionId: root,
      instanceId: instance,
    })

    // ONE restoreScope with the full slot set + the member's instanceId.
    const call = restoreCall(rig, child)
    expect(call.scope).toEqual({
      kind: 'member',
      rootSessionId: root,
      instanceId: instance,
      slots: [...OVERLAY_SLOT_ORDER],
    } as RestoredScope)

    // NO fresh-time side effects at all.
    expect(rig.surface.countCalls('installOverlay')).toBe(0)
    expect(rig.promptSurface.installed.length).toBe(0)
    expect(rig.evaluator.count).toBe(0)
    expect(rig.personaSource.leaderQueries.length).toBe(0)
    expect(rig.personaSource.memberQueries.length).toBe(0)
    expect(model.applied.length).toBe(0)
    expect(capability.applied.length).toBe(0)

    expect(rig.surface.eventsFor(child)).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.scopeRestored, detail: 'member' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
    ])

    // Second cold member rehydrate: already-bound no-op.
    const again = rig.binder.rehydrateColdMember(child)
    expect(again.installed).toBe(false)
    expect(again.noopReason).toBe('already-bound')
    expect(rig.surface.countCalls('restoreScope', child)).toBe(1)
    expect(rig.evaluator.count).toBe(0)
  })
})

destroyDir(world.scratchDir)
