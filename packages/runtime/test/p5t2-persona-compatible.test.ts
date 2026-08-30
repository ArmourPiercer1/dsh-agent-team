/**
 * p5t2-persona-compatible — TaskDoc §11.5 P5-T2 must-test group 2:
 * COMPATIBLE PRESET (`complete:false`, all green, mock-first, real P4
 * repositories + FileStorageSeam as the durable truth, all through the T1
 * binder).
 *
 * The compatible case (Architecture §13.4): the Team Blueprint persona
 * text (LeaderTemplate / MemberTemplate) composed with the preset's
 * assembly semantics into the scoped identity, installed onto the public
 * scoped-prompt surface (the runtime context of the Team prompt/policy
 * surface). The preset's own upstream assembly semantics are preserved by
 * construction — the closed seams expose no mutation, the scoped identity
 * is deep-frozen, and the compatibility engine classifies PASS/SATISFIED
 * through the real P3-T5 pure function.
 *
 * @module @dsh-agent-team/runtime/test/p5t2-persona-compatible
 */

import { describe, expect, it } from 'vitest'

import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
} from '../agent-setup/binder/index.js'
import {
  COMPATIBILITY_REASON_CODES,
  COMPATIBILITY_STATUS,
  REQUIREMENT_OUTCOMES,
} from '../../domain/compatibility/src/index.js'
import { destroyDir, P5T1_FIXTURE, seedTeamWorld } from './p5t1-helpers.js'
import { createP5T2Rig } from './p5t2-helpers.js'

const root = String(P5T1_FIXTURE.rootSessionId)
const child = String(P5T1_FIXTURE.childSessionId)
const instance = String(P5T1_FIXTURE.instanceId)
const templateId = String(P5T1_FIXTURE.templateId)

const worldRoot = await seedTeamWorld('p5t2-cmp-a')
const worldMember = await seedTeamWorld('p5t2-cmp-b')

describe('P5-T2 group 2: compatible preset (complete:false) — scoped identity installed', () => {
  it('fresh root bind installs the exact scoped identity and probes the real engine PASS', () => {
    const rig = createP5T2Rig(worldRoot)

    const result = rig.binder.bindFreshRoot(root)

    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.admitted).toBe(true)
    expect(result.admissionCode).toBe(ADMISSION_OPEN_CODE)

    // EXACT scoped identity: blueprint text + inherited preset substrate.
    expect(rig.promptSurface.installed.length).toBe(1)
    expect(rig.promptSurface.installed[0]?.sessionId).toBe(root)
    expect(rig.promptSurface.installed[0]?.identity).toEqual({
      kind: 'root',
      rootSessionId: root,
      presetId: 'preset-p5t2',
      personaOrigin: 'blueprint',
      personaText: 'P5T2 leader persona prose',
    })

    // The preset seam was queried ROOT-keyed; the blueprint source was
    // queried for the LEADER text only.
    expect(rig.presetSeam.queriedRootSessionIds).toEqual([root])
    expect(rig.personaSource.leaderQueries).toEqual([root])
    expect(rig.personaSource.memberQueries.length).toBe(0)

    // The REAL compatibility engine probed exactly once with the canonical
    // persona-composition requirement + composable fact.
    expect(rig.evaluator.count).toBe(1)
    expect(rig.evaluator.inputs[0]).toEqual({
      requirements: [
        {
          requirementId: 'team-persona-composition',
          type: 'persona',
          subjects: ['preset-p5t2'],
          complete: true,
        },
      ],
      environmentFacts: [
        {
          domain: 'persona',
          subject: 'preset-p5t2',
          available: true,
          generation: 1,
          detail: 'effective persona section is composable (non-complete)',
        },
      ],
    })
    const evaluated = rig.evaluator.results[0]
    expect(evaluated !== undefined).toBe(true)
    if (evaluated === undefined) throw new Error('unreachable')
    expect(evaluated.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(evaluated.counts).toEqual({
      pass: 1,
      warning: 0,
      fatal: 0,
      unackedWarning: 0,
      staleAcknowledgement: 0,
    })
    expect(evaluated.requirements[0]?.outcome).toBe(REQUIREMENT_OUTCOMES.PASS)
    expect(evaluated.requirements[0]?.reasonCode).toBe(COMPATIBILITY_REASON_CODES.SATISFIED)
    expect(evaluated.requirements[0]?.unavailableSubjects).toEqual([])

    // Upstream assembly semantics preserved: the scoped identity is a
    // deep-frozen closed lossless-JSON value (never a mutable overlay onto
    // the preset).
    const identity = rig.promptSurface.installed[0]?.identity
    expect(identity !== undefined).toBe(true)
    if (identity === undefined) throw new Error('unreachable')
    expect(Object.isFrozen(identity)).toBe(true)
    expect(Object.keys(identity).sort()).toEqual([
      'kind',
      'personaOrigin',
      'personaText',
      'presetId',
      'rootSessionId',
    ])

    // The T1 overlay/event sequence, with the persona slot FIRST.
    expect(rig.surface.countCalls('installOverlay', root)).toBe(3)
    expect(rig.surface.eventsFor(root)).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'persona' },
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'model' },
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'capability' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
    ])
  })

  it('fresh member bind: member persona text, inherited ROOT substrate, exact scoped identity', () => {
    const rig = createP5T2Rig(worldMember)

    const result = rig.binder.bindFreshMember(child)

    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.admitted).toBe(true)
    expect(result.admissionCode).toBe(ADMISSION_OPEN_CODE)
    expect(result.identity).toEqual({
      kind: 'member',
      sessionId: child,
      rootSessionId: root,
      instanceId: instance,
    })

    // EXACT member scoped identity: MemberTemplate text + the ROOT's
    // preset substrate (Architecture §13.1: members inherit the root
    // AgentPreset by default — no per-member selector).
    expect(rig.promptSurface.installed.length).toBe(1)
    expect(rig.promptSurface.installed[0]?.sessionId).toBe(child)
    expect(rig.promptSurface.installed[0]?.identity).toEqual({
      kind: 'member',
      rootSessionId: root,
      instanceId: instance,
      presetId: 'preset-p5t2',
      personaOrigin: 'blueprint',
      personaText: 'P5T2 member persona prose',
    })

    // The substrate seam was queried with the ROOT session id — NOT the
    // child session (the inheritance evidence).
    expect(rig.presetSeam.queriedRootSessionIds).toEqual([root])
    expect(rig.personaSource.memberQueries).toEqual([
      { rootSessionId: root, templateId },
    ])
    expect(rig.personaSource.leaderQueries.length).toBe(0)

    // The engine probed once for the member with the same canonical input
    // (the substrate is the root's — the member adds no new fact).
    expect(rig.evaluator.count).toBe(1)
    const evaluated = rig.evaluator.results[0]
    expect(evaluated !== undefined).toBe(true)
    if (evaluated === undefined) throw new Error('unreachable')
    expect(evaluated.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(evaluated.requirements[0]?.outcome).toBe(REQUIREMENT_OUTCOMES.PASS)
  })

  it('a re-bind does not duplicate the scoped identity (binder idempotency)', () => {
    const rig = createP5T2Rig(worldRoot)
    rig.binder.bindFreshRoot(root)

    const again = rig.binder.bindFreshRoot(root)

    expect(again.installed).toBe(false)
    expect(again.noopReason).toBe('already-bound')
    expect(rig.promptSurface.installed.length).toBe(1)
    expect(rig.evaluator.count).toBe(1)
    expect(rig.surface.countCalls('installOverlay', root)).toBe(3)
  })
})

destroyDir(worldRoot.scratchDir)
destroyDir(worldMember.scratchDir)
