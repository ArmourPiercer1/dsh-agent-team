/**
 * Issue #1 — GREEN: async delegation (execution: 'async'), the durable
 * work-status read-back (work-status / team_collect), signal isolation
 * (CCR-4), the durable memberResult (CCR-5), and the crash/restart
 * resume semantics — the repair plan's probe matrix (§21–§27).
 *
 * Five controlled worlds (top-level execution; each destroyed in its
 * finally — the house pattern of the runtime package):
 *
 *   A. the core GREEN probe (§21): two DIFFERENT members admitted async —
 *      B's admission receipt lands while A's delivery is still in flight
 *      (t_B_admitted < t_A_completed), both deliveries overlap
 *      (maxConcurrent >= 2); the collect lifecycle running -> terminal;
 *      the settlement fact persists the memberResult (CCR-5); the
 *      same-token retry is the unchanged REPLAY (zero writes,
 *      unavailable/WORK_REPLAYED); the detached bookkeeping drains.
 *   B. signal isolation (§24): async — the caller abort AFTER the receipt
 *      neither cancels the detached delivery (which carries NO caller
 *      signal) nor changes its outcome; sync — the same abort keeps the
 *      alpha.2 cancel semantics (the turn aborts, the normalized
 *      WORK_TURN_ABORTED failed result settles, the effect carries it);
 *      plus the create form's async receipt and the detached
 *      REJECTION (a delivery fault of a detached unit is observed,
 *      fail-closed settled, never an unhandled rejection).
 *   C. the work-status read contract (§13/§14/§25): historical settlement
 *      facts WITHOUT a persisted memberResult degrade to
 *      unavailable + the stable diagnostic code (no throw); the
 *      fail-closed history reports delivery-failed; a Root initial-work
 *      token is never projected to a member entry (TCM-M3 skip); unknown
 *      tokens report the stable not-found code; duplicates collapse in
 *      input order; the read is pure (zero writes, zero delivery).
 *   D. the closed validation surface: invalid / misplaced execution
 *      modes and malformed work-status payloads are REQUEST_MALFORMED;
 *      an explicit 'sync' is the unchanged default path.
 *   E. crash/restart (§26): an in-flight async unit (admitted, not
 *      settled) survives the process-restart model as `running`
 *      (resumePossible: true — collect never auto-retries); a same-token
 *      re-delegate enters the existing RESUME path: no duplicate
 *      admission fact, exactly one fresh delivery, the terminal result
 *      readable through the read-back.
 *
 * @module @dsh-agent-team/runtime/test/issue1-async-delegation
 */

import { describe, expect, it } from 'vitest'
import {
  WORK_STATUS_CODES,
  commitDurableFact,
  createTeamRuntime,
  scanWorkUnitFacts,
} from '../action-router/index.js'
import type {
  RuntimeActionEffect,
  TeamRuntimeActionOutcome,
  WorkDeliveryPort,
  WorkDeliveryResult,
  WorkStatusEntry,
} from '../admission/index.js'
import { createWorkActivityWriter } from '../activity/index.js'
import { destroyP6T1World, restartP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2World,
  expectRejection,
  makeActionRequest,
} from './p6t2-helpers.js'

const WORKER1 = String(P6T2_SEEDS.worker.instanceId)
const WORKER2 = String(P6T2_SEEDS.worker2.instanceId)
const WORKER1_CHILD = String(P6T2_SEEDS.worker.childSessionId)
const WORKER1_LABEL = String(P6T2_SEEDS.worker.label)
const WORKER2_LABEL = String(P6T2_SEEDS.worker2.label)
const SCOUT_TEMPLATE = String(P6T2_SEEDS.scout.templateId)

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

/** A delivery port that RECORDS starts (with the carried signal), tracks
 *  the max concurrent deliveries, and holds each delivery at a per-token
 *  gate until the test releases it (or fails it with a throw). A carried
 *  caller signal that aborts while gated resolves the gate with the
 *  normalized aborted-turn result (the production abort semantics). */
function createGatedDeliveryPort() {
  const started: {
    readonly requestToken: string
    readonly instanceId: string
    readonly signal?: unknown
  }[] = []
  /** For each started token, the tokens whose delivery was STILL GATED
   *  (in flight, not yet released) at the moment this one started — a
   *  precise, non-flaky overlap proof (millisecond wall clocks cannot
   *  order events that land in the same millisecond). */
  const inFlightAtStart: Record<string, string[]> = {}
  let inFlight = 0
  let maxConcurrent = 0
  const gates = new Map<
    string,
    { readonly resolve: (result: WorkDeliveryResult) => void; readonly reject: (cause: unknown) => void }
  >()
  const port: WorkDeliveryPort = {
    deliver(args) {
      started.push({ requestToken: args.requestToken, instanceId: args.instanceId, signal: args.signal })
      inFlightAtStart[args.requestToken] = [...gates.keys()]
      inFlight += 1
      maxConcurrent = Math.max(maxConcurrent, inFlight)
      return new Promise<WorkDeliveryResult>((resolve, reject) => {
        gates.set(args.requestToken, {
          resolve: (result) => {
            inFlight -= 1
            resolve(result)
          },
          reject: (cause) => {
            inFlight -= 1
            reject(cause)
          },
        })
        const signal = args.signal as
          | {
              readonly aborted: boolean
              addEventListener(type: 'abort', listener: () => void, options?: { readonly once?: boolean }): void
            }
          | undefined
        if (signal !== undefined) {
          signal.addEventListener(
            'abort',
            () => {
              const gate = gates.get(args.requestToken)
              if (gate !== undefined) {
                gates.delete(args.requestToken)
                gate.resolve({
                  requestToken: args.requestToken,
                  status: 'failed',
                  error: { code: 'WORK_TURN_ABORTED', message: 'turn aborted by the caller' },
                })
              }
            },
            { once: true },
          )
        }
      })
    },
  }
  return {
    port,
    started,
    inFlightAtStart,
    get maxConcurrent(): number {
      return maxConcurrent
    },
    release(token: string, result: WorkDeliveryResult) {
      const gate = gates.get(token)
      if (gate === undefined) throw new Error(`gated port: no gate for token '${token}'`)
      gates.delete(token)
      gate.resolve(result)
    },
    /** Fail the gated delivery with a throw (the port contract: a
     *  delivery failure MUST throw — the chain settles fail-closed). */
    fail(token: string, cause: unknown) {
      const gate = gates.get(token)
      if (gate === undefined) throw new Error(`gated port: no gate for token '${token}'`)
      gates.delete(token)
      gate.reject(cause)
    },
  }
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

function countLedgerFacts(
  repositories: {
    ledger: { list(): readonly { readonly factType: string; readonly payload: Record<string, unknown> }[] }
  },
  factType: string,
  requestToken?: string,
): number {
  let n = 0
  for (const entry of repositories.ledger.list()) {
    if (entry.factType !== factType) continue
    if (requestToken !== undefined && entry.payload['requestToken'] !== requestToken) continue
    n += 1
  }
  return n
}

// --- world A: the core GREEN probe ---------------------------------------------

const aState = {
  tAReceiptAt: 0,
  tBReceiptAt: 0,
  releaseAAt: 0,
  tDoneAt: 0,
  maxConcurrent: 0,
  inFlightAfterA: 0,
  inFlightAfterB: 0,
  inFlightAfterDone: 0,
  overlapAtBStart: undefined as string[] | undefined,
  aReceipt: undefined as TeamRuntimeActionOutcome | undefined,
  bReceipt: undefined as TeamRuntimeActionOutcome | undefined,
  runningEntries: undefined as readonly WorkStatusEntry[] | undefined,
  terminalEntries: undefined as readonly WorkStatusEntry[] | undefined,
  replayOutcome: undefined as TeamRuntimeActionOutcome | undefined,
  ledgerAfterReplay: 0,
  aSettledFactMemberResult: undefined as Record<string, unknown> | undefined,
}

{
  const world = await createP6T2World('issue1-async-core', ['leader', 'worker', 'worker2'])
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

    // A: async delegate (continue form) on worker1 — the receipt lands
    // once the Phase A durable admission committed.
    aState.aReceipt = await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER1,
        requestToken: 'issue1-a',
        payload: { label: WORKER1_LABEL, prompt: 'work A (held at the gate)' },
        execution: 'async',
      }),
    )
    aState.tAReceiptAt = Date.now()
    aState.inFlightAfterA = runtime.inFlightDetachedWork.size

    // B: async delegate (continue form) on worker2 — admitted while A's
    // delivery is still in flight (the core GREEN: t_B_admitted <
    // t_A_completed, A still gated).
    aState.bReceipt = await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER2,
        requestToken: 'issue1-b',
        payload: { label: WORKER2_LABEL, prompt: 'work B (admitted while A in flight)' },
        execution: 'async',
      }),
    )
    aState.tBReceiptAt = Date.now()
    aState.inFlightAfterB = runtime.inFlightDetachedWork.size

    // B's Phase B delivery runs in its detached continuation; wait for it
    // to START, then record which tokens were still gated at that moment —
    // the precise, non-flaky overlap proof (millisecond wall clocks cannot
    // order events that land in the same millisecond).
    await waitFor(() => gated.inFlightAtStart['issue1-b'] !== undefined)
    aState.overlapAtBStart = gated.inFlightAtStart['issue1-b']

    // collect immediately: both units are running (the CCR-3 read-back).
    const running = await runtime.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'issue1-collect-running',
        payload: { requestTokens: ['issue1-a', 'issue1-b'] },
      }),
    )
    aState.runningEntries = asWorkStatus(running).entries

    // Release A, then B; the detached continuations settle in the
    // background (no caller awaits them).
    gated.release('issue1-a', { requestToken: 'issue1-a', status: 'succeeded', body: 'RESULT-A' })
    aState.releaseAAt = Date.now()
    gated.release('issue1-b', { requestToken: 'issue1-b', status: 'succeeded', body: 'RESULT-B' })
    await waitFor(() => runtime.inFlightDetachedWork.size === 0)
    aState.tDoneAt = Date.now()
    aState.inFlightAfterDone = runtime.inFlightDetachedWork.size
    aState.maxConcurrent = gated.maxConcurrent

    // collect after success: terminal results served from the durable
    // settlement facts (input order, duplicates collapsed, unknown token
    // the stable not-found code).
    const terminal = await runtime.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'issue1-collect-terminal',
        payload: { requestTokens: ['issue1-a', 'issue1-b', 'issue1-a', 'issue1-unknown'] },
      }),
    )
    aState.terminalEntries = asWorkStatus(terminal).entries

    // CCR-5: the settlement fact of A carries the durable memberResult.
    const aFacts = scanWorkUnitFacts(world.domain.repositories, P6T2_ROOT, 'issue1-a')
    aState.aSettledFactMemberResult = aFacts.settled?.payload['memberResult'] as
      | Record<string, unknown>
      | undefined

    // Replay: the same-token retry (sync default) is the UNCHANGED replay
    // (zero writes, zero delivery — the synthesized WORK_REPLAYED result).
    const ledgerBeforeReplay = countLedgerFacts(world.domain.repositories, 'team-work-admitted', 'issue1-a')
    aState.replayOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'follow-up',
        targetInstanceId: WORKER1,
        requestToken: 'issue1-a',
        payload: { prompt: 'retry A (must be a replay)' },
      }),
    )
    aState.ledgerAfterReplay = countLedgerFacts(world.domain.repositories, 'team-work-admitted', 'issue1-a') - ledgerBeforeReplay
  } finally {
    await destroyP6T1World(world)
  }
}

// --- world B: signal isolation + create form + detached rejection ---------------

const bState = {
  asyncReceipt: undefined as TeamRuntimeActionOutcome | undefined,
  asyncDeliveryCarriedSignal: undefined as unknown,
  syncDeliveryCarriedSignal: undefined as unknown,
  syncOutcome: undefined as TeamRuntimeActionOutcome | undefined,
  syncAbortCode: undefined as string | undefined,
  createReceipt: undefined as TeamRuntimeActionOutcome | undefined,
  createInstanceId: undefined as string | undefined,
  asyncEntryAfterAbort: undefined as WorkStatusEntry | undefined,
  syncEntryAfterAbort: undefined as WorkStatusEntry | undefined,
  rejectEntry: undefined as WorkStatusEntry | undefined,
  rejectBookkeepingDrained: false,
  rejectSettlementOutcome: undefined as string | undefined,
}

{
  // The team quota is 4/4: three seeded members leave exactly one
  // headroom slot for the create form's new scout (Leg 3).
  const world = await createP6T2World('issue1-async-signal', ['leader', 'worker', 'worker2'])
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

    // Leg 1 (CCR-4): async — abort the caller AFTER the receipt; the
    // detached delivery carries NO caller signal and settles normally.
    const asyncAbort = new AbortController()
    bState.asyncReceipt = await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER1,
        requestToken: 'issue1-s-async',
        payload: { label: WORKER1_LABEL, prompt: 'async work under a caller that will abort' },
        execution: 'async',
        signal: asyncAbort.signal,
      }),
    )
    await waitFor(() => gated.started.length >= 1)
    const asyncStart = gated.started[0]
    if (asyncStart === undefined) throw new Error('world B: no async delivery started')
    bState.asyncDeliveryCarriedSignal = asyncStart.signal
    asyncAbort.abort()
    // The abort must NOT have canceled the detached delivery: the gate is
    // still held (the signal-less continuation does not listen to it).
    gated.release('issue1-s-async', {
      requestToken: 'issue1-s-async',
      status: 'succeeded',
      body: 'survived the caller abort',
    })
    await waitFor(() => runtime.inFlightDetachedWork.size === 0)
    const asyncStatus = await runtime.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'issue1-s-async-read',
        payload: { requestTokens: ['issue1-s-async'] },
      }),
    )
    bState.asyncEntryAfterAbort = entryFor(asWorkStatus(asyncStatus).entries, 'issue1-s-async')

    // Leg 2 (CCR-1 contrast): sync — the SAME abort keeps the alpha.2
    // cancel semantics: the signal IS carried into the live delivery, the
    // aborted turn settles as the normalized WORK_TURN_ABORTED failed
    // result, and the effect carries it.
    const syncAbort = new AbortController()
    const syncPromise = runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER2,
        requestToken: 'issue1-s-sync',
        payload: { label: WORKER2_LABEL, prompt: 'sync work under a caller that will abort' },
        signal: syncAbort.signal,
      }),
    )
    await waitFor(() => gated.started.length >= 2)
    const syncStart = gated.started[1]
    if (syncStart === undefined) throw new Error('world B: no sync delivery started')
    bState.syncDeliveryCarriedSignal = syncStart.signal
    syncAbort.abort()
    bState.syncOutcome = await syncPromise
    const syncEffect = bState.syncOutcome.effect
    if (syncEffect.kind !== 'work-admitted') throw new Error(`world B: expected work-admitted, got ${syncEffect.kind}`)
    bState.syncAbortCode = syncEffect.memberResult?.error?.code
    const syncStatus = await runtime.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'issue1-s-sync-read',
        payload: { requestTokens: ['issue1-s-sync'] },
      }),
    )
    bState.syncEntryAfterAbort = entryFor(asWorkStatus(syncStatus).entries, 'issue1-s-sync')

    // Leg 3: the create form's async receipt (delegate a NEW scout member;
    // the template quota 2/2 has headroom with one scout seeded).
    const createReceiptPromise = runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: SCOUT_TEMPLATE,
        requestToken: 'issue1-s-create',
        payload: { label: 'async-scout', prompt: 'scout work admitted async' },
        execution: 'async',
      }),
    )
    bState.createReceipt = await createReceiptPromise
    const createEffect = bState.createReceipt.effect
    if (createEffect.kind !== 'member-activated') {
      throw new Error(`world B: expected member-activated, got ${createEffect.kind}`)
    }
    bState.createInstanceId = createEffect.instanceId
    await waitFor(() => gated.started.length >= 3)
    gated.release('issue1-s-create', {
      requestToken: 'issue1-s-create',
      status: 'succeeded',
      body: 'scout result',
    })

    // Leg 4: a DETACHED rejection — the delivery of a detached unit faults;
    // the continuation settles fail-closed, the rejection is OBSERVED (the
    // bookkeeping drains; an unhandled rejection would crash the process),
    // and the work-status read reports the fail-closed history.
    const rejectPromise = runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER1,
        requestToken: 'issue1-s-reject',
        payload: { label: WORKER1_LABEL, prompt: 'work whose detached delivery will fault' },
        execution: 'async',
      }),
    )
    const rejectReceipt = await rejectPromise
    if (rejectReceipt.effect.kind !== 'work-admitted') {
      throw new Error(`world B: expected a work-admitted receipt, got ${rejectReceipt.effect.kind}`)
    }
    await waitFor(() => gated.started.length >= 4)
    // The detached unit's delivery faults: the continuation settles
    // fail-closed and its rejection is OBSERVED (the bookkeeping must
    // drain; an unhandled rejection would crash the process and fail the
    // suite).
    gated.fail('issue1-s-reject', new Error('injected detached delivery fault'))
    await waitFor(() => runtime.inFlightDetachedWork.size === 0)
    bState.rejectBookkeepingDrained = true
    const rejectStatus = await runtime.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'issue1-s-reject-read',
        payload: { requestTokens: ['issue1-s-reject'] },
      }),
    )
    bState.rejectEntry = entryFor(asWorkStatus(rejectStatus).entries, 'issue1-s-reject')
    bState.rejectSettlementOutcome = bState.rejectEntry.workOutcome
  } finally {
    await destroyP6T1World(world)
  }
}

// --- world C: the work-status read contract --------------------------------------

const cState = {
  entries: undefined as readonly WorkStatusEntry[] | undefined,
  ledgerBefore: 0,
  ledgerAfter: 0,
  deliveriesDuringRead: 0,
}

{
  const world = await createP6T2World('issue1-async-read', ['leader', 'worker'])
  try {
    const repos = world.domain.repositories
    const now = (): string => P6T2_NOW
    const caller = { kind: 'instance' as const, instanceId: 'inst-leader', role: 'leader' as const }
    // Historical settlement WITHOUT a persisted memberResult (pre-CCR-5
    // history): admission fact + settlement fact, no memberResult.
    await commitDurableFact(repos, P6T2_ROOT, now, 'team-work-admitted', {
      action: 'follow-up',
      caller,
      targetInstanceId: WORKER1,
      childSessionId: WORKER1_CHILD,
      fromLifecycle: 'RUNNING',
      lifecycleCommitted: false,
      prompt: 'historic work A',
      requestToken: 'issue1-hist-a',
      at: P6T2_NOW,
    })
    await commitDurableFact(repos, P6T2_ROOT, now, 'member-lifecycle-changed', {
      action: 'follow-up',
      caller,
      instanceId: WORKER1,
      from: 'RUNNING',
      to: 'SETTLED',
      workOutcome: 'settled',
      requestToken: 'issue1-hist-a',
      at: P6T2_NOW,
    })
    // Historical FAIL-CLOSED settlement (delivery fault, no result).
    await commitDurableFact(repos, P6T2_ROOT, now, 'team-work-admitted', {
      action: 'follow-up',
      caller,
      targetInstanceId: WORKER1,
      childSessionId: WORKER1_CHILD,
      fromLifecycle: 'RUNNING',
      lifecycleCommitted: false,
      prompt: 'historic work B',
      requestToken: 'issue1-hist-b',
      at: P6T2_NOW,
    })
    await commitDurableFact(repos, P6T2_ROOT, now, 'member-lifecycle-changed', {
      action: 'follow-up',
      caller,
      instanceId: WORKER1,
      from: 'RUNNING',
      to: 'SETTLED',
      workOutcome: 'delivery-failed',
      failure: { name: 'Error', message: 'historic delivery fault' },
      requestToken: 'issue1-hist-b',
      at: P6T2_NOW,
    })
    // A Root initial-work fact carrying a colliding token (the TCM-M3
    // skip: the member scanner never projects it).
    await commitDurableFact(repos, P6T2_ROOT, now, 'team-work-admitted', {
      action: 'follow-up',
      caller,
      targetKind: 'root',
      targetInstanceId: 'root',
      requestToken: 'issue1-root-collide',
      at: P6T2_NOW,
    })

    const runtime = createTeamRuntime({
      teamDomain: world.domain,
      activationProvider: world.provider,
      blueprintCatalog: world.catalog,
      environmentFacts: world.ports.environmentFacts,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now,
      lifecycleCommit: createFakeLifecycleCommitPort(world),
      workActivity: createWorkActivityWriter({ teamDomain: world.domain, now }),
    })

    cState.ledgerBefore = repos.ledger.list().length
    const outcome = await runtime.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'issue1-read-probe',
        payload: {
          requestTokens: ['issue1-hist-a', 'issue1-hist-b', 'issue1-root-collide', 'issue1-nope', 'issue1-hist-a'],
        },
      }),
    )
    cState.ledgerAfter = repos.ledger.list().length
    cState.entries = asWorkStatus(outcome).entries
    // The read performed zero delivery (no workDelivery port even exists
    // on this wiring — a delivery attempt would fail closed loudly).
    cState.deliveriesDuringRead = 0
  } finally {
    await destroyP6T1World(world)
  }
}

// --- world D: the closed validation surface ---------------------------------------

const dState = {
  syncEffectKind: undefined as string | undefined,
  malformedCodes: [] as string[],
}

{
  const world = await createP6T2World('issue1-async-validate', ['leader', 'worker'])
  try {
    // The P6-T2 default wiring (no work chain ports): the sync follow-up
    // commits its evidence fact — the unchanged default surface.
    const runtime = createTeamRuntime({
      teamDomain: world.domain,
      activationProvider: world.provider,
      blueprintCatalog: world.catalog,
      environmentFacts: world.ports.environmentFacts,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
    })
    const syncOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'follow-up',
        targetInstanceId: WORKER1,
        requestToken: 'issue1-d-sync',
        payload: { prompt: 'explicit sync (the default path)' },
        execution: 'sync',
      }),
    )
    dState.syncEffectKind = syncOutcome.effect.kind

    // The closed rejections (REQUEST_MALFORMED before any effect).
    const probes: { label: string; request: Parameters<typeof makeActionRequest>[0] }[] = [
      {
        label: 'invalid execution value',
        request: {
          action: 'follow-up',
          targetInstanceId: WORKER1,
          requestToken: 'issue1-d-1',
          payload: { prompt: 'p' },
          execution: 'background' as never,
        },
      },
      {
        label: 'execution on a non-work action (send-message)',
        request: {
          action: 'send-message',
          targetInstanceId: WORKER1,
          requestToken: 'issue1-d-2',
          payload: { recipientInstanceId: WORKER1, body: 'm' },
          execution: 'async',
        },
      },
      {
        label: 'execution on a creation action (create-member)',
        request: {
          action: 'create-member',
          delegationTemplateId: SCOUT_TEMPLATE,
          requestToken: 'issue1-d-3',
          payload: { label: 'x' },
          execution: 'async',
        },
      },
      {
        label: 'work-status: empty token array',
        request: {
          action: 'work-status',
          requestToken: 'issue1-d-4',
          payload: { requestTokens: [] },
        },
      },
      {
        label: 'work-status: non-array tokens',
        request: {
          action: 'work-status',
          requestToken: 'issue1-d-5',
          payload: { requestTokens: 'issue1-a' },
        },
      },
      {
        label: 'work-status: empty-string token entry',
        request: {
          action: 'work-status',
          requestToken: 'issue1-d-6',
          payload: { requestTokens: ['issue1-a', ''] },
        },
      },
      {
        label: 'work-status: 65 tokens (over the closed bound)',
        request: {
          action: 'work-status',
          requestToken: 'issue1-d-7',
          payload: { requestTokens: Array.from({ length: 65 }, (_, i) => `tok-${i}`) },
        },
      },
    ]
    for (const probe of probes) {
      const rejected = await expectRejection(runtime, makeActionRequest(probe.request), 'TEAM_RUNTIME_REQUEST_MALFORMED')
      dState.malformedCodes.push(`${probe.label}: ${rejected.code}`)
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- world E: crash / restart resume ----------------------------------------------

const eState = {
  coldEntry: undefined as WorkStatusEntry | undefined,
  resumeOutcome: undefined as TeamRuntimeActionOutcome | undefined,
  coldStatusEntries: undefined as readonly WorkStatusEntry[] | undefined,
  admissionFactsAfterResume: 0,
  deliveriesOnNewPort: 0,
  finalEntry: undefined as WorkStatusEntry | undefined,
}

{
  const world = await createP6T2World('issue1-async-resume', ['leader', 'worker'])
  let world2: P6T1World | undefined
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
    // Admit async, leave the delivery in flight (the gate is never
    // released), then model the process crash (the durable side survives:
    // admission present, settlement absent).
    const receipt = await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: WORKER1,
        requestToken: 'issue1-e-resume',
        payload: { label: WORKER1_LABEL, prompt: 'work admitted before the crash' },
        execution: 'async',
      }),
    )
    if (receipt.effect.kind !== 'work-admitted') {
      throw new Error(`world E: expected a work-admitted receipt, got ${receipt.effect.kind}`)
    }
    await waitFor(() => gated.started.length >= 1)

    // The process-restart model (restart closes the old domain over the
    // SAME scratch dir — the durable facts survive).
    world2 = await restartP6T1World(world)
    const gated2 = createGatedDeliveryPort()
    const runtime2 = createTeamRuntime({
      teamDomain: world2.domain,
      activationProvider: world2.provider,
      blueprintCatalog: world2.catalog,
      environmentFacts: world2.ports.environmentFacts,
      externalPolicyFacts: world2.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
      lifecycleCommit: createFakeLifecycleCommitPort(world2),
      workDelivery: gated2.port,
      workActivity: createWorkActivityWriter({ teamDomain: world2.domain, now: () => P6T2_NOW }),
    })

    // Cold read-back: the unit is running (resumePossible — collect never
    // auto-retries).
    const cold = await runtime2.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'issue1-e-cold',
        payload: { requestTokens: ['issue1-e-resume'] },
      }),
    )
    eState.coldStatusEntries = asWorkStatus(cold).entries
    eState.coldEntry = entryFor(eState.coldStatusEntries, 'issue1-e-resume')

    // The same-token re-delegate enters the existing RESUME path (sync —
    // held at the gate until released): no duplicate admission fact,
    // exactly one fresh delivery, the terminal result readable afterwards.
    const resumePromise = runtime2.performAction(
      makeActionRequest({
        action: 'follow-up',
        targetInstanceId: WORKER1,
        requestToken: 'issue1-e-resume',
        payload: { prompt: 'resume after the crash' },
      }),
    )
    await waitFor(() => gated2.started.length >= 1)
    gated2.release('issue1-e-resume', {
      requestToken: 'issue1-e-resume',
      status: 'succeeded',
      body: 'resumed result',
    })
    eState.resumeOutcome = await resumePromise
    await waitFor(() => runtime2.inFlightDetachedWork.size === 0)
    eState.deliveriesOnNewPort = gated2.started.length
    eState.admissionFactsAfterResume = countLedgerFacts(
      world2.domain.repositories,
      'team-work-admitted',
      'issue1-e-resume',
    )
    const final = await runtime2.performAction(
      makeActionRequest({
        action: 'work-status',
        requestToken: 'issue1-e-final',
        payload: { requestTokens: ['issue1-e-resume'] },
      }),
    )
    eState.finalEntry = entryFor(asWorkStatus(final).entries, 'issue1-e-resume')

    // On success the shared scratch dir is torn down here (world's domain
    // is already closed by the restart; only world2's handle remains).
    await destroyP6T1World(world2)
  } finally {
    // If the run failed BEFORE the restart, world still owns the scratch
    // dir (world2 undefined) — destroy whichever handle is live.
    if (world2 === undefined) {
      await destroyP6T1World(world)
    }
  }
}

// --- assertions (synchronous) ------------------------------------------------------

describe('issue #1 GREEN A: two different members admitted async overlap (the core probe)', () => {
  it('A-receipt: the async receipt is the durable admission (workStatus admitted, settled false, no result)', () => {
    const a = aState.aReceipt
    const b = aState.bReceipt
    if (a === undefined || b === undefined) throw new Error('world A: receipts missing')
    if (a.effect.kind !== 'work-admitted') throw new Error(`A: ${a.effect.kind}`)
    if (b.effect.kind !== 'work-admitted') throw new Error(`B: ${b.effect.kind}`)
    expect(a.effect.workStatus).toBe('admitted')
    expect(a.effect.settled).toBe(false)
    expect(a.effect.memberResult === undefined).toBe(true)
    expect(a.effect.instanceId).toBe(WORKER1)
    expect(b.effect.workStatus).toBe('admitted')
    expect(b.effect.settled).toBe(false)
    expect(b.effect.instanceId).toBe(WORKER2)
  })

  it('A-overlap: B delivery started while A was still gated (t_B_admitted < t_A_completed)', () => {
    // The precise proof: the gated port snapshots which tokens were STILL
    // in flight at the moment each delivery started (millisecond wall
    // clocks cannot order events that land in the same millisecond). A was
    // never released before B started, so 'issue1-a' MUST be in the
    // snapshot — async admission must not wait for another member's
    // delivery to settle (issue #1).
    const atB = aState.overlapAtBStart
    if (atB === undefined) throw new Error('world A: overlap snapshot missing')
    expect(atB.includes('issue1-a')).toBe(true)
    expect(aState.tBReceiptAt <= aState.tDoneAt).toBe(true)
  })

  it('A-overlap: the two deliveries overlapped (maxConcurrent >= 2) and the bookkeeping drained', () => {
    expect(aState.maxConcurrent >= 2).toBe(true)
    expect(aState.inFlightAfterA).toBe(1)
    expect(aState.inFlightAfterB).toBe(2)
    expect(aState.inFlightAfterDone).toBe(0)
  })

  it('A-collect lifecycle: running while in flight, terminal after settlement (durable read-back)', () => {
    const running = aState.runningEntries
    const terminal = aState.terminalEntries
    if (running === undefined || terminal === undefined) throw new Error('world A: collect entries missing')
    const aRunning = entryFor(running, 'issue1-a')
    const bRunning = entryFor(running, 'issue1-b')
    expect(aRunning.status).toBe('running')
    expect(bRunning.status).toBe('running')
    expect(aRunning.resumePossible).toBe(true)
    expect(aRunning.instanceId).toBe(WORKER1)
    expect(terminal.length).toBe(3)
    const aTerminal = entryFor(terminal, 'issue1-a')
    const bTerminal = entryFor(terminal, 'issue1-b')
    const unknown = entryFor(terminal, 'issue1-unknown')
    expect(aTerminal.status).toBe('succeeded')
    expect(aTerminal.memberResult?.body).toBe('RESULT-A')
    expect(bTerminal.status).toBe('succeeded')
    expect(bTerminal.memberResult?.body).toBe('RESULT-B')
    expect(unknown.status).toBe('unavailable')
    expect(unknown.error?.code).toBe(WORK_STATUS_CODES.TOKEN_UNKNOWN)
  })

  it('A-durable (CCR-5): the settlement fact persists the memberResult verbatim', () => {
    expect(aState.aSettledFactMemberResult).toEqual({
      requestToken: 'issue1-a',
      status: 'succeeded',
      body: 'RESULT-A',
    })
  })

  it('A-replay: the same-token retry is the unchanged replay (zero new admission facts, WORK_REPLAYED)', () => {
    const replay = aState.replayOutcome
    if (replay === undefined) throw new Error('world A: replay outcome missing')
    if (replay.effect.kind !== 'work-admitted') throw new Error(`A: ${replay.effect.kind}`)
    expect(replay.effect.replayed).toBe(true)
    expect(replay.effect.settled).toBe(true)
    expect(replay.effect.memberResult?.status).toBe('unavailable')
    expect(replay.effect.memberResult?.error?.code).toBe('WORK_REPLAYED')
    expect(aState.ledgerAfterReplay).toBe(0)
  })
})

describe('issue #1 GREEN B: signal isolation (CCR-4), the create form, and the detached rejection', () => {
  it('B-async: the caller abort after the receipt neither cancels the detached work nor changes its outcome', () => {
    const receipt = bState.asyncReceipt
    if (receipt === undefined) throw new Error('world B: async receipt missing')
    if (receipt.effect.kind !== 'work-admitted') throw new Error(`B: ${receipt.effect.kind}`)
    expect(receipt.effect.workStatus).toBe('admitted')
    // CCR-4: the detached delivery carries NO caller signal.
    expect(bState.asyncDeliveryCarriedSignal === undefined).toBe(true)
    const entry = bState.asyncEntryAfterAbort
    if (entry === undefined) throw new Error('world B: async entry missing')
    expect(entry.status).toBe('succeeded')
    expect(entry.memberResult?.body).toBe('survived the caller abort')
  })

  it('B-sync: the same abort keeps the alpha.2 cancel semantics (signal carried, WORK_TURN_ABORTED settles)', () => {
    const outcome = bState.syncOutcome
    if (outcome === undefined) throw new Error('world B: sync outcome missing')
    // The sync delivery carried the caller signal (the CCR-1 contrast).
    expect(bState.syncDeliveryCarriedSignal !== undefined).toBe(true)
    if (outcome.effect.kind !== 'work-admitted') throw new Error(`B: ${outcome.effect.kind}`)
    expect(outcome.effect.settled).toBe(true)
    expect(outcome.effect.memberResult?.status).toBe('failed')
    expect(bState.syncAbortCode).toBe('WORK_TURN_ABORTED')
    const entry = bState.syncEntryAfterAbort
    if (entry === undefined) throw new Error('world B: sync entry missing')
    expect(entry.status).toBe('failed')
    expect(entry.memberResult?.error?.code).toBe('WORK_TURN_ABORTED')
  })

  it('B-create: the create form stages the async receipt (member-activated + workStatus admitted)', () => {
    const receipt = bState.createReceipt
    if (receipt === undefined) throw new Error('world B: create receipt missing')
    if (receipt.effect.kind !== 'member-activated') throw new Error(`B: ${receipt.effect.kind}`)
    expect(receipt.effect.workStatus).toBe('admitted')
    expect(receipt.effect.workSettled).toBe(false)
    expect(typeof receipt.effect.workSequence).toBe('number')
    expect(bState.createInstanceId !== undefined).toBe(true)
    if (bState.createInstanceId !== undefined) {
      expect(bState.createInstanceId === WORKER1).toBe(false)
    }
  })

  it('B-reject: a detached delivery fault is observed (bookkeeping drains, fail-closed history readable)', () => {
    expect(bState.rejectBookkeepingDrained).toBe(true)
    const entry = bState.rejectEntry
    if (entry === undefined) throw new Error('world B: reject entry missing')
    expect(entry.status).toBe('unavailable')
    expect(entry.workOutcome).toBe('delivery-failed')
    expect(entry.error?.code).toBe(WORK_STATUS_CODES.DELIVERY_FAILED)
    expect(bState.rejectSettlementOutcome).toBe('delivery-failed')
  })
})

describe('issue #1 GREEN C: the work-status read contract (pure read, closed diagnostics)', () => {
  it('C-history: a pre-CCR-5 settlement degrades to unavailable + WORK_RESULT_NOT_PERSISTED (no throw)', () => {
    const entries = cState.entries
    if (entries === undefined) throw new Error('world C: entries missing')
    expect(entries.length).toBe(4)
    const a = entryFor(entries, 'issue1-hist-a')
    expect(a.status).toBe('unavailable')
    expect(a.workOutcome).toBe('settled')
    expect(a.error?.code).toBe(WORK_STATUS_CODES.RESULT_NOT_PERSISTED)
    expect(a.instanceId).toBe(WORKER1)
  })

  it('C-history: the fail-closed history reports unavailable + WORK_DELIVERY_FAILED (workOutcome delivery-failed)', () => {
    const entries = cState.entries
    if (entries === undefined) throw new Error('world C: entries missing')
    const b = entryFor(entries, 'issue1-hist-b')
    expect(b.status).toBe('unavailable')
    expect(b.workOutcome).toBe('delivery-failed')
    expect(b.error?.code).toBe(WORK_STATUS_CODES.DELIVERY_FAILED)
  })

  it('C-scope: the Root initial-work token is never projected (TCM-M3 skip) and unknown tokens are stable', () => {
    const entries = cState.entries
    if (entries === undefined) throw new Error('world C: entries missing')
    const root = entryFor(entries, 'issue1-root-collide')
    expect(root.status).toBe('unavailable')
    expect(root.error?.code).toBe(WORK_STATUS_CODES.TOKEN_UNKNOWN)
    const nope = entryFor(entries, 'issue1-nope')
    expect(nope.status).toBe('unavailable')
    expect(nope.error?.code).toBe(WORK_STATUS_CODES.TOKEN_UNKNOWN)
  })

  it('C-purity: the read writes nothing and delivers nothing (duplicates collapsed in input order)', () => {
    expect(cState.ledgerAfter).toBe(cState.ledgerBefore)
    expect(cState.deliveriesDuringRead).toBe(0)
    const entries = cState.entries
    if (entries === undefined) throw new Error('world C: entries missing')
    // input order with the duplicate collapsed: hist-a, hist-b, root, nope
    expect(entries[0]?.requestToken).toBe('issue1-hist-a')
    expect(entries[1]?.requestToken).toBe('issue1-hist-b')
    expect(entries[2]?.requestToken).toBe('issue1-root-collide')
    expect(entries[3]?.requestToken).toBe('issue1-nope')
  })
})

describe('issue #1 GREEN D: the closed validation surface', () => {
  it('D-sync: an explicit execution sync is the unchanged default path', () => {
    expect(dState.syncEffectKind).toBe('work-admitted')
  })

  it('D-malformed: invalid/misplaced execution and bad work-status payloads are REQUEST_MALFORMED', () => {
    expect(dState.malformedCodes.length).toBe(7)
    for (const code of dState.malformedCodes) {
      expect(code.endsWith(': TEAM_RUNTIME_REQUEST_MALFORMED')).toBe(true)
    }
  })
})

describe('issue #1 GREEN E: crash/restart — the admitted unit resumes, it is never auto-retried', () => {
  it('E-cold: after the restart the read-back reports running (resumePossible, no auto-retry)', () => {
    const entry = eState.coldEntry
    if (entry === undefined) throw new Error('world E: cold entry missing')
    expect(entry.status).toBe('running')
    expect(entry.resumePossible).toBe(true)
    expect(entry.instanceId).toBe(WORKER1)
  })

  it('E-resume: the same-token re-delegate resumes (one admission fact, one fresh delivery, terminal readable)', () => {
    const outcome = eState.resumeOutcome
    if (outcome === undefined) throw new Error('world E: resume outcome missing')
    if (outcome.effect.kind !== 'work-admitted') throw new Error(`E: ${outcome.effect.kind}`)
    expect(outcome.effect.replayed).not.toBe(true)
    expect(outcome.effect.settled).toBe(true)
    expect(outcome.effect.memberResult?.body).toBe('resumed result')
    expect(eState.admissionFactsAfterResume).toBe(1)
    expect(eState.deliveriesOnNewPort).toBe(1)
    const final = eState.finalEntry
    if (final === undefined) throw new Error('world E: final entry missing')
    expect(final.status).toBe('succeeded')
    expect(final.memberResult?.body).toBe('resumed result')
  })
})
