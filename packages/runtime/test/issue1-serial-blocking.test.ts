/**
 * Issue #1 — RED origin / characterization: the sync facade serializes
 * leader work (the alpha.2 behavior this repair PRESERVES as the default).
 *
 * The controlled probe (plan §20 RED-1): a fake WorkDeliveryPort whose
 * delivery is held at a gate per requestToken. With the alpha.2 (sync,
 * default) facade:
 *
 *   1. the FIRST delegate's promise stays UNRESOLVED while its member's
 *      delivery is in flight — the leader's model context is blocked, so
 *      the second delegate cannot even be issued;
 *   2. therefore B's delivery starts only AFTER A's delivery completed —
 *      total ≈ T_A + T_B (serial), not max(T_A, T_B) (overlap).
 *
 * This file is the RED evidence of the old design problem (captured on
 * the unmodified tree — see dev/agent-workflow/evidence/issue1-async-
 * delegation/red/). After the fix it is a CHARACTERIZATION/regression
 * pin: the default sync path must keep exactly this behavior (CCR-1).
 *
 * House pattern of the runtime package: async world construction and
 * action execution at the TOP LEVEL (one bare block, destroyed in its
 * finally); every `it` below asserts the captured constants synchronously
 * (the plain-node shim supports no async `it`).
 *
 * @module @dsh-agent-team/runtime/test/issue1-serial-blocking
 */

import { describe, expect, it } from 'vitest'
import { createTeamRuntime } from '../action-router/index.js'
import type {
  RuntimeActionEffect,
  TeamRuntimeActionOutcome,
  WorkDeliveryPort,
  WorkDeliveryResult,
} from '../admission/index.js'
import { createWorkActivityWriter } from '../activity/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2World,
  makeActionRequest,
} from './p6t2-helpers.js'

const WORKER1 = String(P6T2_SEEDS.worker.instanceId)
const WORKER2 = String(P6T2_SEEDS.worker2.instanceId)
const TOKEN_A = 'issue1-red-a'
const TOKEN_B = 'issue1-red-b'

// --- probes -------------------------------------------------------------------

/** Poll until `predicate` holds (bounded; test failure on timeout). */
async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor: predicate not true within ${timeoutMs}ms`)
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** A delivery port that RECORDS delivery starts and holds each delivery
 *  at a per-token gate until the test releases it. */
function createGatedDeliveryPort() {
  const started: { readonly requestToken: string; readonly instanceId: string; readonly at: number }[] = []
  const gates = new Map<string, (result: WorkDeliveryResult) => void>()
  const port: WorkDeliveryPort = {
    async deliver(args) {
      started.push({ requestToken: args.requestToken, instanceId: args.instanceId, at: Date.now() })
      return new Promise<WorkDeliveryResult>((resolve) => {
        gates.set(args.requestToken, resolve)
      })
    },
  }
  return {
    port,
    started,
    release(token: string, result: WorkDeliveryResult) {
      const gate = gates.get(token)
      if (gate === undefined) throw new Error(`gated port: no gate for token '${token}'`)
      gates.delete(token)
      gate(result)
    },
  }
}

function asWorkAdmitted(outcome: TeamRuntimeActionOutcome): Extract<RuntimeActionEffect, { readonly kind: 'work-admitted' }> {
  const effect = outcome.effect
  if (effect.kind !== 'work-admitted') {
    throw new Error(`asWorkAdmitted: expected work-admitted, got ${effect.kind}`)
  }
  return effect
}

// --- captured case (top-level execution, sync assertions) ----------------------

const timeline: {
  aDeliveryStart?: number
  aCompleted?: number
  bDeliveryStart?: number
  bCompleted?: number
} = {}
let leaderBlockedWhileAdeliveryInFlight = false
let aOutcome: TeamRuntimeActionOutcome | undefined
let bOutcome: TeamRuntimeActionOutcome | undefined

{
  const world = await createP6T2World('issue1-red-serial', ['leader', 'worker', 'worker2'])
  try {
    const gated = createGatedDeliveryPort()
    const runtime = createTeamRuntime({
      teamDomain: world.domain,
      activationProvider: world.provider,
      blueprintCatalog: world.catalog,
      environmentFacts: world.ports.environmentFacts,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
      lifecycleCommit: createFakeLifecycleCommitPort(world),
      workDelivery: gated.port,
      workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
    })

    // The leader issues A (sync — the default; the execution field does
    // not exist on the old surface at all).
    const aPromise = runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER1,
        requestToken: TOKEN_A,
        payload: { label: 'w1', prompt: 'work A (held at the gate)' },
      }),
    )
    await waitFor(() => gated.started.length === 1)
    const aStart = gated.started[0]
    if (aStart === undefined) throw new Error('gated port: no delivery started')
    timeline.aDeliveryStart = aStart.at

    // The RED property 1: while A's delivery is in flight the leader's
    // FIRST performAction promise is still unresolved.
    let aSettled = false
    void aPromise.then(
      () => {
        aSettled = true
      },
      () => {
        aSettled = true
      },
    )
    await sleep(75)
    leaderBlockedWhileAdeliveryInFlight = !aSettled

    // Release A; the leader can only issue B AFTER aPromise resolves
    // (that IS the leader's real constraint — one tool call at a time).
    gated.release(TOKEN_A, { requestToken: TOKEN_A, status: 'succeeded', body: 'A business body' })
    aOutcome = await aPromise
    timeline.aCompleted = Date.now()

    const bPromise = runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER2,
        requestToken: TOKEN_B,
        payload: { label: 'w2', prompt: 'work B (issued only after A returned)' },
      }),
    )
    await waitFor(() => gated.started.length === 2)
    const bStart = gated.started[1]
    if (bStart === undefined) throw new Error('gated port: no second delivery started')
    timeline.bDeliveryStart = bStart.at
    gated.release(TOKEN_B, { requestToken: TOKEN_B, status: 'succeeded', body: 'B business body' })
    bOutcome = await bPromise
    timeline.bCompleted = Date.now()

    // RED evidence (the captured run is archived under evidence/issue1-
    // async-delegation/red/): the serialized timeline.
  } finally {
    await destroyP6T1World(world)
  }
}

// --- assertions (synchronous) ---------------------------------------------------

describe('issue #1 RED/characterization: the sync facade serializes leader work', () => {
  it('R1: the first delegate stays unresolved while its member delivery is in flight (the leader is blocked)', () => {
    expect(leaderBlockedWhileAdeliveryInFlight).toBe(true)
  })

  it('R2: B delivery starts only after A completed (serial: total ≈ T_A + T_B)', () => {
    expect(timeline.aDeliveryStart !== undefined).toBe(true)
    expect(timeline.aCompleted !== undefined).toBe(true)
    expect(timeline.bDeliveryStart !== undefined).toBe(true)
    expect((timeline.bDeliveryStart as number) >= (timeline.aCompleted as number)).toBe(true)
  })

  it('CCR-1 pin: the sync default result still carries the member business body (v2 D2)', () => {
    if (aOutcome === undefined || bOutcome === undefined) throw new Error('outcome missing')
    const aEffect = asWorkAdmitted(aOutcome)
    expect(aEffect.settled).toBe(true)
    expect(aEffect.memberResult !== undefined).toBe(true)
    expect(aEffect.memberResult?.status).toBe('succeeded')
    expect(aEffect.memberResult?.body).toBe('A business body')
    const bEffect = asWorkAdmitted(bOutcome)
    expect(bEffect.settled).toBe(true)
    expect(bEffect.memberResult?.status).toBe('succeeded')
  })
})
