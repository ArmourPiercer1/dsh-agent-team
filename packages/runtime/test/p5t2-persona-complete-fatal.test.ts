/**
 * p5t2-persona-complete-fatal — TaskDoc §11.5 P5-T2 must-test group 3:
 * `complete:true` PRESET (FATAL, mock-first, real P4 repositories +
 * FileStorageSeam as the durable truth, all through the T1 binder).
 *
 * Architecture §13.5: an AgentPreset whose effective persona is
 * `complete:true` is a STRUCTURAL FATAL (`TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`,
 * frozen contracts v1) — no Continue Anyway, no workaround. The FATAL gate
 * lives in the persona slot's `apply` (before the binder's admission
 * decision), so Team work NEVER starts: the binder wraps the thrown
 * `TeamPersonaOverlayError` as its closed `BINDER_OVERLAY_FAILED` (the
 * frozen code travels on `cause`), and the whole bind fails closed — no
 * later slot, no surface install, no recorded event, no admission
 * decision, no bound registration.
 *
 * @module @dsh-agent-team/runtime/test/p5t2-persona-complete-fatal
 */

import { describe, expect, it } from 'vitest'

import { TeamContractErrorCode } from '../../contracts/src/index.js'
import {
  COMPATIBILITY_REASON_CODES,
  COMPATIBILITY_STATUS,
} from '../../domain/compatibility/src/index.js'
import {
  TEAM_AGENT_BINDER_ERROR_CODES,
  isTeamAgentBinderError,
} from '../agent-setup/binder/index.js'
import { PERSONA_OVERLAY_ERROR_CODES, isTeamPersonaOverlayError } from '../agent-setup/persona/index.js'
import { destroyDir, recordingSlot, seedTeamWorld } from './p5t1-helpers.js'
import { createP5T2Rig, presetSeamWith, recordingGuard } from './p5t2-helpers.js'
import type { RecordingAdmissionGuard } from './p5t2-helpers.js'

const world = await seedTeamWorld('p5t2-fatal-a')
const root = world.ids.rootSessionId
const child = world.ids.childSessionId
const COMPLETE_PRESET_ID = 'preset-complete-p5t2'

function buildFatalRig(extra: { guard?: RecordingAdmissionGuard } = {}) {
  const guard = extra.guard ?? recordingGuard(true)
  const model = recordingSlot('model')
  const capability = recordingSlot('capability')
  const rig = createP5T2Rig(world, {
    presetSeam: presetSeamWith('complete', COMPLETE_PRESET_ID),
    admissionGuard: guard,
    modelSlot: model,
    capabilitySlot: capability,
  })
  return { rig, guard, model, capability }
}

/** Assert the ZERO Team-work effects after one failed complete-persona bind. */
function expectZeroWorkEffects(
  rig: ReturnType<typeof buildFatalRig>['rig'],
  guard: RecordingAdmissionGuard,
  model: ReturnType<typeof recordingSlot>,
  capability: ReturnType<typeof recordingSlot>,
): void {
  // No surface install effect of any kind.
  expect(rig.surface.countCalls('installOverlay')).toBe(0)
  expect(rig.surface.countCalls('restoreScope')).toBe(0)
  // No recorded event at all (no post-admission event, no admission-decided).
  expect(rig.surface.countCalls('recordSessionEvent')).toBe(0)
  // No scoped persona identity installed.
  expect(rig.promptSurface.installed.length).toBe(0)
  // The admission decision point was NEVER reached (FATAL is before it).
  expect(guard.contexts.length).toBe(0)
  // No later slot was applied (persona is first in the frozen order).
  expect(model.applied.length).toBe(0)
  expect(capability.applied.length).toBe(0)
}

describe('P5-T2 group 3: complete:true preset — FATAL before admission, Team work never starts', () => {
  it('fresh root bind fails closed with the frozen conflict code on the cause chain', () => {
    const { rig, guard, model, capability } = buildFatalRig()

    let thrown: unknown
    try {
      rig.binder.bindFreshRoot(root)
    } catch (error) {
      thrown = error
    }
    expect(thrown !== undefined).toBe(true)
    // The OUTER code stays in the binder's frozen closed vocabulary.
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
    expect(thrown.details.origin).toBe('persona')
    expect(thrown.details.path).toBe('fresh-root')
    expect(thrown.details.sessionId).toBe(root)

    // The INNER error carries the frozen contracts v1 conflict code.
    expect(isTeamPersonaOverlayError(thrown.cause)).toBe(true)
    const inner = thrown.cause
    if (!isTeamPersonaOverlayError(inner)) throw new Error('unreachable')
    expect(inner.code).toBe(PERSONA_OVERLAY_ERROR_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    // The frozen code is the contracts v1 constant VERBATIM.
    expect(inner.code).toBe(TeamContractErrorCode.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    expect(inner.details.rootSessionId).toBe(root)
    expect(inner.details.presetId).toBe(COMPLETE_PRESET_ID)
    expect(inner.details.path).toBe('fresh-root')
    const engineDetail = inner.details.detail
    expect(typeof engineDetail === 'string').toBe(true)
    expect((engineDetail as string).length).toBeGreaterThan(0)

    expectZeroWorkEffects(rig, guard, model, capability)

    // The REAL engine classified the canonical conflict FATAL.
    expect(rig.evaluator.count).toBe(1)
    const evaluated = rig.evaluator.results[0]
    expect(evaluated !== undefined).toBe(true)
    if (evaluated === undefined) throw new Error('unreachable')
    expect(evaluated.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(evaluated.counts.fatal).toBe(1)
    expect(evaluated.requirements[0]?.reasonCode).toBe(
      COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT,
    )
    expect(evaluated.requirements[0]?.unavailableSubjects).toEqual([COMPLETE_PRESET_ID])
  })

  it('a retry of the same complete-persona bind fails identically (the engine re-probes once per attempt)', () => {
    const { rig, guard, model, capability } = buildFatalRig()

    let firstThrown: unknown
    try {
      rig.binder.bindFreshRoot(root)
    } catch (error) {
      firstThrown = error
    }
    expect(isTeamAgentBinderError(firstThrown)).toBe(true)

    let thrown: unknown
    try {
      rig.binder.bindFreshRoot(root)
    } catch (error) {
      thrown = error
    }
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
    expect(thrown.details.origin).toBe('persona')
    expect(isTeamPersonaOverlayError(thrown.cause)).toBe(true)
    // One engine probe per attempt: exactly two after two failed binds.
    expect(rig.evaluator.count).toBe(2)
    expectZeroWorkEffects(rig, guard, model, capability)
  })

  it('fresh member bind fails closed identically (the member inherits the root substrate conflict)', () => {
    const { rig, guard, model, capability } = buildFatalRig()

    let thrown: unknown
    try {
      rig.binder.bindFreshMember(child)
    } catch (error) {
      thrown = error
    }
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
    expect(thrown.details.origin).toBe('persona')
    expect(thrown.details.path).toBe('fresh-member')
    expect(thrown.details.sessionId).toBe(child)
    const inner = thrown.cause
    expect(isTeamPersonaOverlayError(inner)).toBe(true)
    if (!isTeamPersonaOverlayError(inner)) throw new Error('unreachable')
    expect(inner.code).toBe(PERSONA_OVERLAY_ERROR_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    // The member conflicts through the ROOT's preset (inheritance).
    expect(inner.details.rootSessionId).toBe(root)
    expect(inner.details.presetId).toBe(COMPLETE_PRESET_ID)
    expectZeroWorkEffects(rig, guard, model, capability)
    expect(rig.evaluator.count).toBe(1)
  })
})

destroyDir(world.scratchDir)
