/**
 * Work-completion wake-up — the ROUTER completion-observer tests
 * (work-completion-wakeup plan §23, R1–R6):
 *
 *   R1. async success notification — async work admitted, delivered, and
 *       durably settled → the notifier is called EXACTLY ONCE with the
 *       exact identity (requestToken / instanceId / taskSummary /
 *       targets = [{kind:'leader'}]);
 *   R2. sync work zero notification — a sync delegate settles normally →
 *       the notifier is NEVER called (the tool result is the completion
 *       channel; the most important regression pin);
 *   R3. WORK_DELIVERY_FAILED still notifies — a detached delivery fault
 *       settles fail-closed (the durable settlement fact IS written
 *       before the throw — N3) → the terminal scan finds
 *       `settledSequence` and the notifier is called once;
 *   R4. durable settlement fault does not notify — the settlement state
 *       commit fails (injected through the lifecycleCommit port on the
 *       SETTLE transition): the settlement fact is NEVER written → the
 *       terminal scan finds no `settledSequence` → the notifier is NOT
 *       called (no false completion over an unsettled unit);
 *   R5. notification rejection isolated — the notifier rejects: the
 *       durable work status stays terminal, `inFlightDetachedWork`
 *       drains, and the rejection is OBSERVED (no unhandled rejection —
 *       the router's observer swallows it; plan §13);
 *   R6. notification not tracked as detached work — the notification
 *       promise stays LONG PENDING: `inFlightDetachedWork` drains the
 *       moment Phase B/C settles (the set stays Phase B/C only — plan
 *       §7.2 note; the issue #1 original semantics, frozen).
 *
 * Three controlled worlds (top-level execution; each destroyed in its
 * finally — the house pattern of the runtime package, the same one the
 * issue1-async-delegation suite uses):
 *
 *   W1 (R1/R2/R3/R5): the recording notifier + the fake lifecycle port;
 *   W2 (R4): the SETTLE-fault-injecting lifecycle port;
 *   W3 (R6): the long-pending notifier.
 *
 * The ABSENT-port semantics (plan §6: a runtime without
 * `workCompletionNotification` simply does not wake) are pinned by every
 * pre-existing async suite (issue1-async-delegation et al.), which wire
 * NO notifier and must keep passing byte-for-byte.
 *
 * @module @dsh-agent-team/runtime/test/work-completion-async-wakeup
 */

import { describe, expect, it } from 'vitest'
import { createTeamRuntime, scanWorkUnitFacts } from '../action-router/index.js'
import type {
  LifecycleCommitPort,
  RuntimeActionEffect,
  TeamRuntimeActionOutcome,
  WorkDeliveryResult,
  WorkStatusEntry,
} from '../admission/index.js'
import { createWorkActivityWriter } from '../activity/index.js'
import type {
  WorkCompletionNotification,
  WorkCompletionNotificationPort,
} from '../work-completion-notification/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2World,
  makeActionRequest,
} from './p6t2-helpers.js'

const WORKER1 = String(P6T2_SEEDS.worker.instanceId)
const WORKER2 = String(P6T2_SEEDS.worker2.instanceId)
const WORKER1_LABEL = String(P6T2_SEEDS.worker.label)
const WORKER2_LABEL = String(P6T2_SEEDS.worker2.label)

// --- shared doubles ---------------------------------------------------------------

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

/** The recording notifier: records every notification; can be armed to
 *  REJECT one token (R5) or to stay LONG PENDING on one token (R6). */
function createRecordingNotifier() {
  const calls: WorkCompletionNotification[] = []
  const rejectedTokens: string[] = []
  let rejectToken: string | undefined
  let pendingToken: string | undefined
  let pendingResolve: (() => void) | undefined
  let pendingSettled = false
  const port: WorkCompletionNotificationPort = {
    notifyWorkCompletion(notification) {
      calls.push(notification)
      if (notification.requestToken === rejectToken) {
        rejectToken = undefined
        rejectedTokens.push(notification.requestToken)
        return Promise.reject(new Error(`injected notification fault for ${notification.requestToken}`))
      }
      if (notification.requestToken === pendingToken) {
        return new Promise<void>((resolve) => {
          pendingResolve = resolve
        })
      }
      return Promise.resolve()
    },
  }
  return {
    port,
    calls,
    rejectedTokens,
    armReject(token: string) {
      rejectToken = token
    },
    armPending(token: string) {
      pendingToken = token
    },
    get pendingSettled(): boolean {
      return pendingSettled
    },
    releasePending() {
      pendingToken = undefined
      pendingSettled = true
      pendingResolve?.()
    },
  }
}

/** A delivery port that RECORDS starts and holds each delivery at a
 *  per-token gate until the test releases (or fails) it — the same
 *  double the issue1-async-delegation suite drives (local copy: the
 *  house pattern keeps suites self-contained). */
function createGatedDeliveryPort() {
  const started: {
    readonly requestToken: string
    readonly instanceId: string
    readonly signal?: unknown
  }[] = []
  const gates = new Map<
    string,
    { readonly resolve: (result: WorkDeliveryResult) => void; readonly reject: (cause: unknown) => void }
  >()
  const port = {
    deliver(args: {
      readonly requestToken: string
      readonly instanceId: string
      readonly signal?: unknown
    }) {
      started.push({ requestToken: args.requestToken, instanceId: args.instanceId, signal: args.signal })
      return new Promise<WorkDeliveryResult>((resolve, reject) => {
        gates.set(args.requestToken, { resolve, reject })
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
      gate.resolve(result)
    },
    fail(token: string, cause: unknown) {
      const gate = gates.get(token)
      if (gate === undefined) throw new Error(`gated port: no gate for token '${token}'`)
      gates.delete(token)
      gate.reject(cause)
    },
  }
}

/** The SETTLE-fault-injecting lifecycle port (R4): every transition
 *  commits through the REAL fake port EXCEPT the SETTLE operation, which
 *  throws (the durable state commit of the settlement faults — the
 *  settlement fact is never written). */
function createSettleFaultLifecyclePort(world: P6T1World) {
  const base = createFakeLifecycleCommitPort(world)
  const port: LifecycleCommitPort = {
    async commitTransition(args) {
      if (args.operation === 'SETTLE') {
        throw new Error('injected: settlement state commit fault (durable write failure)')
      }
      return base.commitTransition(args)
    },
  }
  return { port, base }
}

function asWorkStatus(outcome: TeamRuntimeActionOutcome): Extract<RuntimeActionEffect, { readonly kind: 'work-status' }> {
  const effect = outcome.effect
  if (effect.kind !== 'work-status') {
    throw new Error(`asWorkStatus: expected work-status, got ${effect.kind}`)
  }
  return effect
}

function entryFor(entries: readonly WorkStatusEntry[], token: string): WorkStatusEntry {
  const entry = entries.find((candidate) => candidate.requestToken === token)
  if (entry === undefined) throw new Error(`entryFor: no work-status entry for token '${token}'`)
  return entry
}

// --- world W1: R1 success / R2 sync zero / R3 delivery-failed / R5 rejection -------

const w1 = {
  r1Calls: undefined as readonly WorkCompletionNotification[] | undefined,
  r2TotalCalls: 0,
  r3Entry: undefined as WorkStatusEntry | undefined,
  r3Calls: undefined as readonly WorkCompletionNotification[] | undefined,
  r5Entry: undefined as WorkStatusEntry | undefined,
  r5Rejected: false,
  r5Drained: false,
}

{
  const world = await createP6T2World('wcn-r-suite', ['leader', 'worker', 'worker2'])
  try {
    const gated = createGatedDeliveryPort()
    const notifier = createRecordingNotifier()
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
      workCompletionNotification: notifier.port,
    })

    // R1: async success → exactly one notification with the exact identity.
    await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER1,
        requestToken: 'wcn-r1',
        payload: { label: WORKER1_LABEL, prompt: 'R1 async work', taskSummary: 'R1 summary' },
        execution: 'async',
      }),
    )
    await waitFor(() => gated.started.length >= 1)
    gated.release('wcn-r1', { requestToken: 'wcn-r1', status: 'succeeded', body: 'R1 RESULT' })
    await waitFor(() => runtime.inFlightDetachedWork.size === 0)
    await waitFor(() => notifier.calls.length >= 1)
    w1.r1Calls = [...notifier.calls]

    // R2: sync delegate (no execution field → sync) → the notifier must
    // stay at the R1 count (zero notifications for the sync unit).
    const syncPromise = runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER2,
        requestToken: 'wcn-r2',
        payload: { label: WORKER2_LABEL, prompt: 'R2 sync work' },
      }),
    )
    await waitFor(() => gated.started.length >= 2)
    gated.release('wcn-r2', { requestToken: 'wcn-r2', status: 'succeeded', body: 'R2 RESULT' })
    await syncPromise
    // flush the microtask drain (the sync path has no observer at all —
    // the count is stable the moment the action resolves)
    await new Promise((resolve) => setTimeout(resolve, 10))
    w1.r2TotalCalls = notifier.calls.length

    // R3: a DETACHED delivery fault → the fail-closed settlement IS
    // durable (N3) → the terminal scan notifies.
    await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER1,
        requestToken: 'wcn-r3',
        payload: { label: WORKER1_LABEL, prompt: 'R3 work whose delivery will fault' },
        execution: 'async',
      }),
    )
    await waitFor(() => gated.started.length >= 3)
    gated.fail('wcn-r3', new Error('injected R3 delivery fault'))
    await waitFor(() => runtime.inFlightDetachedWork.size === 0)
    await waitFor(() => notifier.calls.length >= 2)
    const r3Status = await runtime.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'wcn-r3-read',
        payload: { requestTokens: ['wcn-r3'] },
      }),
    )
    w1.r3Entry = entryFor(asWorkStatus(r3Status).entries, 'wcn-r3')
    w1.r3Calls = notifier.calls.filter((call) => call.requestToken === 'wcn-r3')

    // R5: the notifier REJECTS → the durable work stays terminal, the
    // bookkeeping drains, and the rejection is observed (no unhandled
    // rejection would fail the process / this suite).
    notifier.armReject('wcn-r5')
    await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER2,
        requestToken: 'wcn-r5',
        payload: { label: WORKER2_LABEL, prompt: 'R5 work under a failing notifier' },
        execution: 'async',
      }),
    )
    await waitFor(() => gated.started.length >= 4)
    gated.release('wcn-r5', { requestToken: 'wcn-r5', status: 'succeeded', body: 'R5 RESULT' })
    await waitFor(() => runtime.inFlightDetachedWork.size === 0)
    await waitFor(() => notifier.rejectedTokens.length >= 1)
    const r5Status = await runtime.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'wcn-r5-read',
        payload: { requestTokens: ['wcn-r5'] },
      }),
    )
    w1.r5Entry = entryFor(asWorkStatus(r5Status).entries, 'wcn-r5')
    w1.r5Rejected = notifier.rejectedTokens.includes('wcn-r5')
    w1.r5Drained = runtime.inFlightDetachedWork.size === 0
  } finally {
    await destroyP6T1World(world)
  }
}

// --- world W2: R4 the durable settlement fault -------------------------------------

const w2 = {
  r4Entry: undefined as WorkStatusEntry | undefined,
  r4Calls: 0,
  r4SettledFactAbsent: false,
}

{
  const world = await createP6T2World('wcn-r4-settle-fault', ['leader', 'worker'])
  try {
    const gated = createGatedDeliveryPort()
    const notifier = createRecordingNotifier()
    const { port: lifecyclePort } = createSettleFaultLifecyclePort(world)
    const runtime = createTeamRuntime({
      teamDomain: world.domain,
      activationProvider: world.provider,
      blueprintCatalog: world.catalog,
      environmentFacts: world.ports.environmentFacts,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
      lifecycleCommit: lifecyclePort,
      workDelivery: gated.port,
      workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
      workCompletionNotification: notifier.port,
    })

    // Admit async; the delivery SUCCEEDS, but the settlement's durable
    // state commit faults (injected on the SETTLE transition) → the
    // settlement fact is never written → the detached task rejects
    // (DURABLE_WRITE_FAILED) on an UNSETTLED unit.
    await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER1,
        requestToken: 'wcn-r4',
        payload: { label: WORKER1_LABEL, prompt: 'R4 work whose settlement commit will fault', taskSummary: 'R4 summary' },
        execution: 'async',
      }),
    )
    await waitFor(() => gated.started.length >= 1)
    gated.release('wcn-r4', { requestToken: 'wcn-r4', status: 'succeeded', body: 'R4 RESULT' })
    await waitFor(() => runtime.inFlightDetachedWork.size === 0)
    // give the observer one extra tick to (not) fire
    await new Promise((resolve) => setTimeout(resolve, 10))
    const r4Status = await runtime.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'wcn-r4-read',
        payload: { requestTokens: ['wcn-r4'] },
      }),
    )
    w2.r4Entry = entryFor(asWorkStatus(r4Status).entries, 'wcn-r4')
    w2.r4Calls = notifier.calls.length
    w2.r4SettledFactAbsent =
      scanWorkUnitFacts(world.domain.repositories, P6T2_ROOT, 'wcn-r4').settled === undefined
  } finally {
    await destroyP6T1World(world)
  }
}

// --- world W3: R6 the long-pending notification ------------------------------------

const w3 = {
  r6DrainedWhilePending: false,
  r6PendingAtDrain: false,
  r6Entry: undefined as WorkStatusEntry | undefined,
  r6Calls: 0,
}

{
  const world = await createP6T2World('wcn-r6-pending', ['leader', 'worker'])
  try {
    const gated = createGatedDeliveryPort()
    const notifier = createRecordingNotifier()
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
      workCompletionNotification: notifier.port,
    })

    // The notification promise for 'wcn-r6' stays PENDING until the
    // release at the end of the leg.
    notifier.armPending('wcn-r6')
    await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER1,
        requestToken: 'wcn-r6',
        payload: { label: WORKER1_LABEL, prompt: 'R6 work under a pending notification' },
        execution: 'async',
      }),
    )
    await waitFor(() => gated.started.length >= 1)
    gated.release('wcn-r6', { requestToken: 'wcn-r6', status: 'succeeded', body: 'R6 RESULT' })
    // THE R6 ASSERTION: the bookkeeping drains the moment Phase B/C
    // settles — even though the notification promise is still pending
    // (it is NEVER added to inFlightDetachedWork).
    await waitFor(() => runtime.inFlightDetachedWork.size === 0)
    w3.r6PendingAtDrain = notifier.pendingSettled === false
    w3.r6DrainedWhilePending = runtime.inFlightDetachedWork.size === 0
    w3.r6Calls = notifier.calls.length
    const r6Status = await runtime.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'wcn-r6-read',
        payload: { requestTokens: ['wcn-r6'] },
      }),
    )
    w3.r6Entry = entryFor(asWorkStatus(r6Status).entries, 'wcn-r6')
    // cleanup: release the pending notification
    notifier.releasePending()
    await new Promise((resolve) => setTimeout(resolve, 5))
  } finally {
    await destroyP6T1World(world)
  }
}

// --- assertions (synchronous) --------------------------------------------------------

describe('work-completion wake-up R: the router completion observer (plan §23)', () => {
  it('R1: an async success notifies exactly once with the exact identity (token / instance / summary / leader target)', () => {
    const calls = w1.r1Calls
    if (calls === undefined) throw new Error('W1: R1 calls missing')
    expect(calls).toHaveLength(1)
    const call = calls[0]!
    expect(call.rootSessionId).toBe(P6T2_ROOT)
    expect(call.requestToken).toBe('wcn-r1')
    expect(call.instanceId).toBe(WORKER1)
    expect(call.taskSummary).toBe('R1 summary')
    expect(call.targets).toEqual([{ kind: 'leader' }])
    // the notification carries NO member body (minimal metadata only)
    expect('memberResult' in call).toBe(false)
    expect('body' in call).toBe(false)
  })

  it('R2: sync work produces ZERO notifications (the tool result is the completion channel)', () => {
    // after the R2 sync leg, the notifier count is still exactly the R1
    // notification (the sync unit added none)
    expect(w1.r2TotalCalls).toBe(1)
  })

  it('R3: WORK_DELIVERY_FAILED settles fail-closed durably and STILL notifies', () => {
    const entry = w1.r3Entry
    if (entry === undefined) throw new Error('W1: R3 entry missing')
    // the fail-closed settlement fact is durable (N3 throw-after-settle)
    expect(typeof entry.settledSequence).toBe('number')
    expect(entry.workOutcome).toBe('delivery-failed')
    expect(entry.error?.code).toBe('WORK_DELIVERY_FAILED')
    // and the terminal scan notified exactly once
    const calls = w1.r3Calls
    if (calls === undefined) throw new Error('W1: R3 calls missing')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.requestToken).toBe('wcn-r3')
    expect(calls[0]!.instanceId).toBe(WORKER1)
    expect(calls[0]!.targets).toEqual([{ kind: 'leader' }])
  })

  it('R4: a durable settlement fault does NOT notify (no false completion over an unsettled unit)', () => {
    const entry = w2.r4Entry
    if (entry === undefined) throw new Error('W2: R4 entry missing')
    // the settlement fact was never written (the state commit faulted
    // BEFORE the evidence fact): the unit still reads as running
    expect(w2.r4SettledFactAbsent).toBe(true)
    expect(entry.settledSequence).toBeUndefined()
    expect(entry.status).toBe('running')
    expect(entry.resumePossible).toBe(true)
    // and the notifier was NEVER called
    expect(w2.r4Calls).toBe(0)
  })

  it('R5: a notification rejection is isolated (durable terminal + drained bookkeeping + observed rejection)', () => {
    const entry = w1.r5Entry
    if (entry === undefined) throw new Error('W1: R5 entry missing')
    // the durable work status is UNAFFECTED by the delivery failure:
    // terminal, succeeded, the member result readable
    expect(entry.status).toBe('succeeded')
    expect(entry.memberResult?.body).toBe('R5 RESULT')
    expect(typeof entry.settledSequence).toBe('number')
    // the rejection was observed (the router's catch swallowed it — an
    // unhandled rejection would have crashed the process)
    expect(w1.r5Rejected).toBe(true)
    // the bookkeeping drained (Phase B/C only — the failed notification
    // never re-entered the set)
    expect(w1.r5Drained).toBe(true)
  })

  it('R6: a long-pending notification does not hold the bookkeeping (inFlightDetachedWork drains at Phase B/C settlement)', () => {
    // the drain was observed WHILE the notification promise was still
    // pending (the R6 pin: the issue #1 original semantics — the set
    // stays Phase B/C only)
    expect(w3.r6PendingAtDrain).toBe(true)
    expect(w3.r6DrainedWhilePending).toBe(true)
    // the notification was attempted exactly once
    expect(w3.r6Calls).toBe(1)
    // and the work itself settled durably
    const entry = w3.r6Entry
    if (entry === undefined) throw new Error('W3: R6 entry missing')
    expect(entry.status).toBe('succeeded')
    expect(entry.memberResult?.body).toBe('R6 RESULT')
  })
})
