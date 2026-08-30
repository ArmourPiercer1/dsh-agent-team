/**
 * p5t2-persona-no-persona — TaskDoc §11.5 P5-T2 must-test group 1: NO
 * PERSONA (all green, mock-first, real P4 repositories + FileStorageSeam
 * as the durable truth, all through the T1 binder).
 *
 * A preset with NO effective persona (`personaKind: 'absent'`) has nothing
 * to compose: the persona slot's `apply` returns without installing a
 * scoped identity and WITHOUT probing the compatibility engine — the bind
 * succeeds with the preset's plain upstream assembly semantics, no error,
 * and the full T1 overlay/event sequence (the binder still installs the
 * persona slot; it just carries no scoped identity).
 *
 * @module @dsh-agent-team/runtime/test/p5t2-persona-no-persona
 */

import { describe, expect, it } from 'vitest'

import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  OVERLAY_SLOT_ORDER,
} from '../agent-setup/binder/index.js'
import { PRESET_PERSONA_KINDS } from '../agent-setup/preset/index.js'
import { destroyDir, seedTeamWorld } from './p5t1-helpers.js'
import { createP5T2Rig, presetSeamWith } from './p5t2-helpers.js'

const world = await seedTeamWorld('p5t2-np-a')
const root = world.ids.rootSessionId
const child = world.ids.childSessionId
const instance = world.ids.instanceId

describe('P5-T2 group 1: no persona — bind succeeds, no scoped identity, no error', () => {
  it('fresh root bind with an absent-preset persona: installed, admitted, no scoped identity', () => {
    const rig = createP5T2Rig(world, {
      presetSeam: presetSeamWith(PRESET_PERSONA_KINDS.absent),
    })

    const result = rig.binder.bindFreshRoot(root)

    expect(result.requested).toBe('fresh-root')
    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.identity).toEqual({ kind: 'root', sessionId: root, rootSessionId: root })
    expect(result.admitted).toBe(true)
    expect(result.admissionCode).toBe(ADMISSION_OPEN_CODE)
    // NO scoped identity — the absent preset carries no persona to scope.
    expect(rig.promptSurface.installed.length).toBe(0)
    // The compatibility engine is NEVER probed (there is nothing to probe).
    expect(rig.evaluator.count).toBe(0)
    // The blueprint persona source is never consulted.
    expect(rig.personaSource.leaderQueries.length).toBe(0)
    expect(rig.personaSource.memberQueries.length).toBe(0)
    // The substrate seam was queried (root-keyed) but found no persona.
    expect(rig.presetSeam.queriedRootSessionIds).toEqual([root])
    // The full T1 overlay sequence still lands (the slot is installed, the
    // scoped identity is what is absent).
    expect(rig.surface.countCalls('installOverlay', root)).toBe(3)
    expect(rig.surface.getInstalledSlots(root)).toEqual([...OVERLAY_SLOT_ORDER])
    expect(rig.surface.eventsFor(root)).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'persona' },
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'model' },
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'capability' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
    ])
  })

  it('fresh member bind with an absent-preset persona: installed, admitted, no scoped identity', () => {
    const rig = createP5T2Rig(world, {
      presetSeam: presetSeamWith(PRESET_PERSONA_KINDS.absent),
    })

    const result = rig.binder.bindFreshMember(child)

    expect(result.requested).toBe('fresh-member')
    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.identity).toEqual({
      kind: 'member',
      sessionId: child,
      rootSessionId: root,
      instanceId: instance,
    })
    expect(result.admitted).toBe(true)
    expect(result.admissionCode).toBe(ADMISSION_OPEN_CODE)
    expect(rig.promptSurface.installed.length).toBe(0)
    expect(rig.evaluator.count).toBe(0)
    expect(rig.personaSource.leaderQueries.length).toBe(0)
    expect(rig.personaSource.memberQueries.length).toBe(0)
    // The member substrate resolves through the ROOT (structural inheritance).
    expect(rig.presetSeam.queriedRootSessionIds).toEqual([root])
    expect(rig.surface.countCalls('installOverlay', child)).toBe(3)
  })

  it('a second bind of the same absent-persona root is the already-bound no-op', () => {
    const rig = createP5T2Rig(world, {
      presetSeam: presetSeamWith(PRESET_PERSONA_KINDS.absent),
    })
    rig.binder.bindFreshRoot(root)

    const again = rig.binder.bindFreshRoot(root)

    expect(again.bound).toBe(true)
    expect(again.installed).toBe(false)
    expect(again.noopReason).toBe('already-bound')
    expect(again.emittedEvents.length).toBe(0)
    expect(again.admitted).toBe(true)
    expect(rig.surface.countCalls('installOverlay', root)).toBe(3)
    expect(rig.promptSurface.installed.length).toBe(0)
    expect(rig.evaluator.count).toBe(0)
  })
})

destroyDir(world.scratchDir)
