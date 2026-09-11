/**
 * issue #1 GREEN (tools layer) — the model-facing surface of the async
 * delegation repair (plan §21/§22): `team_delegate` / `team_follow_up`
 * accept the closed `async` execution flag (CCR-2) and return the durable
 * ADMISSION receipt instead of blocking on the member's turn; `team_collect`
 * (CCR-3) reads the durable work-unit state back by request token.
 *
 * The runtime-level matrix (the two-member overlap, the caller-signal
 * isolation, the retry protocol, the crash/restart resume) lives in
 * `packages/runtime/test/issue1-async-delegation.test.ts`; this file pins
 * what the MODEL can do through the tools: the async receipt projection on
 * the continue form and the create form, the terminal read-back, the sync
 * default surface (no `async` argument = the settled effect with the member
 * result — CCR-1), the explicit `async: false` non-async pin, the
 * read-only-ness of the collect (zero durable writes, zero deliveries),
 * the duplicate/unknown token handling, and the tool-layer argument
 * contract (TEAM_TOOL_BAD_ARGUMENTS).
 *
 * World: the full P6-T2 durable world with the P8-S3 work chain wired
 * (fake lifecycle commit port + a GATED delivery port + the real work-
 * activity writer) — the P6-T6 default world deliberately lacks the
 * work-chain ports (it exercises the legacy admission fallback), which
 * cannot reach the async surface. Seeds leader+worker+worker2 (team 3/4;
 * worker 2/2): the create-form delegate uses the `scout` template on the
 * team's last free slot (scout 0/2 -> 1/2, team 4/4 — both exactly at
 * their limits, no further creation possible).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and captures
 * its results; the `it` bodies are pure synchronous assertions.
 */

import { describe, expect, it } from 'vitest'
import {
  WORK_STATUS_CODES,
  createTeamRuntime,
} from '../../runtime/action-router/index.js'
import type {
  WorkDeliveryPort,
  WorkDeliveryResult,
  WorkStatusEntry,
} from '../../runtime/admission/index.js'
import { createActivityLedger, createWorkActivityWriter } from '../../runtime/activity/index.js'
import { createControlService } from '../../runtime/control/index.js'
import { createMessagingCoordinator } from '../../runtime/messaging/index.js'
import { destroyP6T1World } from '../../runtime/test/p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2World,
} from '../../runtime/test/p6t2-helpers.js'
import {
  TEAM_TOOL_BAD_ARGUMENTS,
  createTeamTools,
} from '../src/index.js'
import type { TeamToolsResult } from '../src/index.js'
import {
  createP6T6CallerMap,
  createFakeSessionInput,
  execFor,
} from './p6t6-helpers.js'

const WORKER1 = String(P6T2_SEEDS.worker.instanceId)
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

/** A delivery port that records every start (token + carried signal) and
 *  holds each delivery at a per-token gate until the test releases it. */
function createGatedDeliveryPort() {
  const started: { readonly requestToken: string; readonly signal?: unknown }[] = []
  let inFlight = 0
  const gates = new Map<string, { readonly resolve: (result: WorkDeliveryResult) => void }>()
  const port: WorkDeliveryPort = {
    deliver(args) {
      started.push({ requestToken: args.requestToken, signal: args.signal })
      inFlight += 1
      return new Promise<WorkDeliveryResult>((resolve) => {
        gates.set(args.requestToken, {
          resolve: (result) => {
            inFlight -= 1
            resolve(result)
          },
        })
      })
    },
  }
  return {
    port,
    started,
    get inFlight(): number {
      return inFlight
    },
    release(token: string, result: WorkDeliveryResult) {
      const gate = gates.get(token)
      if (gate === undefined) throw new Error(`gated port: no gate for token '${token}'`)
      gates.delete(token)
      gate.resolve(result)
    },
  }
}

// --- the captured scenario state ------------------------------------------------

interface Captured {
  readonly status: string
  readonly code?: string
  readonly message?: string
}

interface TState {
  t1Receipt: TeamToolsResult | undefined
  t1Collect: TeamToolsResult | undefined
  t1DeliveredSignal: unknown
  t1InFlightAfterReceipt: number
  t2Receipt: TeamToolsResult | undefined
  t3Receipt: TeamToolsResult | undefined
  t3Collect: TeamToolsResult | undefined
  t4Collect: TeamToolsResult | undefined
  t4WritesBefore: number
  t4WritesAfter: number
  t4DeliveriesBefore: number
  t4DeliveriesAfter: number
  t5Empty: Captured | undefined
  t5NonArray: Captured | undefined
  t5TooMany: Captured | undefined
  t5EmptyEntry: Captured | undefined
  t6Receipt: TeamToolsResult | undefined
}

const T: TState = {
  t1Receipt: undefined,
  t1Collect: undefined,
  t1DeliveredSignal: 'UNSET',
  t1InFlightAfterReceipt: -1,
  t2Receipt: undefined,
  t3Receipt: undefined,
  t3Collect: undefined,
  t4Collect: undefined,
  t4WritesBefore: -1,
  t4WritesAfter: -1,
  t4DeliveriesBefore: -1,
  t4DeliveriesAfter: -1,
  t5Empty: undefined,
  t5NonArray: undefined,
  t5TooMany: undefined,
  t5EmptyEntry: undefined,
  t6Receipt: undefined,
}

// --- the world (one, all probes share it — order matters) ------------------------

{
  const world = await createP6T2World('issue1-tools', ['leader', 'worker', 'worker2'])
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
    const control = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
    })
    const sessionInput = createFakeSessionInput()
    const messaging = createMessagingCoordinator({
      teamRuntime: runtime,
      teamDomain: world.domain,
      sessionInput,
      now: () => P6T2_NOW,
    })
    const activity = createActivityLedger({
      teamDomain: world.domain,
      runtime,
      now: () => P6T2_NOW,
    })
    const callerMap = createP6T6CallerMap(['leader', 'worker', 'worker2'])
    const tools = createTeamTools({
      teamRuntime: runtime,
      controlService: control,
      messaging,
      activity,
      async resolveCaller(sessionId: string) {
        const caller = callerMap.bySession.get(sessionId)
        if (caller === undefined) {
          throw new Error(`issue1-tools caller map: no caller for session ${sessionId}`)
        }
        return caller
      },
    }).tools

    const findTool = (name: string) => {
      const tool = tools.find((candidate) => candidate.name === name)
      if (tool === undefined) throw new Error(`issue1-tools: no registered tool named ${name}`)
      return tool
    }
    const run = async (name: string, args: Record<string, unknown>): Promise<TeamToolsResult> =>
      await findTool(name).execute(args, execFor(P6T2_ROOT))

    // --- T1: the async follow-up receipt + the terminal read-back ----------
    T.t1Receipt = await run('team_follow_up', base({
      requestToken: 't1-fu',
      targetInstanceId: WORKER1,
      prompt: 't1: the async follow-up prompt',
      async: true,
    }))
    // The receipt returned while the delivery was still in flight — the
    // tool layer did NOT wait for the member's turn (issue #1's core).
    T.t1InFlightAfterReceipt = runtime.inFlightDetachedWork.size
    await waitFor(() => gated.started.length === 1)
    const t1Start = gated.started[0]
    T.t1DeliveredSignal = t1Start === undefined ? 'MISSING' : t1Start.signal
    gated.release('t1-fu', { requestToken: 't1-fu', status: 'succeeded', body: 'T1-BODY' })
    await waitFor(() => runtime.inFlightDetachedWork.size === 0)
    T.t1Collect = await run('team_collect', base({
      requestToken: 't1-collect',
      requestTokens: ['t1-fu'],
    }))

    // --- T2: the default (no async argument) stays sync (CCR-1) -------------
    const t2Promise = run('team_follow_up', base({
      requestToken: 't2-fu',
      targetInstanceId: WORKER1,
      prompt: 't2: the sync follow-up prompt',
    }))
    await waitFor(() => gated.started.length === 2)
    gated.release('t2-fu', { requestToken: 't2-fu', status: 'succeeded', body: 'T2-BODY' })
    T.t2Receipt = await t2Promise

    // --- T3: the async create-form delegate (the last free slot) ------------
    T.t3Receipt = await run('team_delegate', base({
      requestToken: 't3-dl',
      delegationTemplateId: SCOUT_TEMPLATE,
      label: 'async-scout',
      prompt: 't3: the async create-form prompt',
      async: true,
    }))
    await waitFor(() => gated.started.length === 3)
    gated.release('t3-dl', { requestToken: 't3-dl', status: 'succeeded', body: 'T3-BODY' })
    await waitFor(() => runtime.inFlightDetachedWork.size === 0)
    T.t3Collect = await run('team_collect', base({
      requestToken: 't3-collect',
      requestTokens: ['t3-dl'],
    }))

    // --- T4: the collect is read-only; dups collapse; unknown is stable -----
    T.t4WritesBefore = world.seam.writeCount
    T.t4DeliveriesBefore = gated.started.length
    T.t4Collect = await run('team_collect', base({
      requestToken: 't4-collect',
      requestTokens: ['t1-fu', 't1-fu', 't2-fu', 't4-unknown'],
    }))
    T.t4WritesAfter = world.seam.writeCount
    T.t4DeliveriesAfter = gated.started.length

    // --- T5: the tool-layer argument contract --------------------------------
    T.t5Empty = rejectedOf(
      await run('team_collect', base({ requestToken: 't5-empty', requestTokens: [] })),
      't5Empty',
    )
    T.t5NonArray = rejectedOf(
      await run('team_collect', base({ requestToken: 't5-nonarray', requestTokens: 't1-fu' })),
      't5NonArray',
    )
    T.t5TooMany = rejectedOf(
      await run('team_collect', base({
        requestToken: 't5-toolong',
        requestTokens: Array.from({ length: 65 }, (_, i) => `tok-${i}`),
      })),
      't5TooMany',
    )
    T.t5EmptyEntry = rejectedOf(
      await run('team_collect', base({ requestToken: 't5-emptyentry', requestTokens: [''] })),
      't5EmptyEntry',
    )

    // --- T6: an explicit async:false is NOT the async mode -------------------
    const t6Promise = run('team_follow_up', base({
      requestToken: 't6-fu',
      targetInstanceId: WORKER1,
      prompt: 't6: the explicit-sync prompt',
      async: false,
    }))
    await waitFor(() => gated.started.length === 4)
    gated.release('t6-fu', { requestToken: 't6-fu', status: 'succeeded', body: 'T6-BODY' })
    T.t6Receipt = await t6Promise
  } finally {
    destroyP6T1World(world)
  }
}

// --- shared assertion helpers ----------------------------------------------------

function base(args: Record<string, unknown>): Record<string, unknown> {
  return { rootSessionId: P6T2_ROOT, ...args }
}

function rejectedOf(result: TeamToolsResult, what: string): Captured {
  if (result.status !== 'rejected') {
    throw new Error(`${what}: expected a rejected result, got '${result.status}'`)
  }
  return { status: 'rejected', code: result.code, message: result.message }
}

function asWorkStatus(result: TeamToolsResult): WorkStatusEntry[] {
  if (result.status !== 'executed') {
    throw new Error(`expected an executed result, got '${result.status}'`)
  }
  const effect = result.effect
  if (effect.kind !== 'work-status') {
    throw new Error(`expected a work-status effect, got '${effect.kind}'`)
  }
  return [...effect.entries]
}

function entryFor(entries: readonly WorkStatusEntry[], token: string): WorkStatusEntry {
  const entry = entries.find((candidate) => candidate.requestToken === token)
  if (entry === undefined) {
    throw new Error(`no work-status entry for token '${token}'`)
  }
  return entry
}

// --- assertions -------------------------------------------------------------------

describe('issue #1 GREEN T1: the async follow-up receipt + the team_collect read-back', () => {
  it('T1-receipt: the tool returns the durable admission (workStatus admitted, settled false, no result)', () => {
    const r = T.t1Receipt
    if (r === undefined) throw new Error('T1: receipt missing')
    if (r.status !== 'executed') throw new Error(`T1: expected executed, got '${r.status}'`)
    expect(r.action).toBe('follow-up')
    expect(r.requestToken).toBe('t1-fu')
    const effect = r.effect
    if (effect.kind !== 'work-admitted') throw new Error(`T1: effect ${effect.kind}`)
    expect(effect.workStatus).toBe('admitted')
    expect(effect.settled).toBe(false)
    expect(effect.memberResult === undefined).toBe(true)
    expect(effect.instanceId).toBe(WORKER1)
  })

  it('T1-detached: the receipt returned while the delivery was in flight, without a caller signal', () => {
    expect(T.t1InFlightAfterReceipt).toBe(1)
    expect(T.t1DeliveredSignal).toBe(undefined)
  })

  it('T1-collect: the terminal result is read back from the durable settlement fact', () => {
    const c = T.t1Collect
    if (c === undefined) throw new Error('T1: collect missing')
    const entry = entryFor(asWorkStatus(c), 't1-fu')
    expect(entry.status).toBe('succeeded')
    expect(entry.instanceId).toBe(WORKER1)
    expect(typeof entry.settledSequence).toBe('number')
    expect(entry.memberResult).toEqual({ requestToken: 't1-fu', status: 'succeeded', body: 'T1-BODY' })
  })
})

describe('issue #1 GREEN T2: the sync default is unchanged (CCR-1)', () => {
  it('T2-sync-default: no async argument = the settled effect with the member result', () => {
    const r = T.t2Receipt
    if (r === undefined) throw new Error('T2: receipt missing')
    if (r.status !== 'executed') throw new Error(`T2: expected executed, got '${r.status}'`)
    const effect = r.effect
    if (effect.kind !== 'work-admitted') throw new Error(`T2: effect ${effect.kind}`)
    expect(effect.settled).toBe(true)
    expect(effect.replayed).toBe(false)
    expect(typeof effect.settledSequence).toBe('number')
    expect(effect.memberResult).toEqual({ requestToken: 't2-fu', status: 'succeeded', body: 'T2-BODY' })
    expect(effect.workStatus === undefined).toBe(true)
  })
})

describe('issue #1 GREEN T3: the async create-form delegate', () => {
  it('T3-create-receipt: activation + the durable admission on the new instance', () => {
    const r = T.t3Receipt
    if (r === undefined) throw new Error('T3: receipt missing')
    if (r.status !== 'executed') throw new Error(`T3: expected executed, got '${r.status}'`)
    expect(r.action).toBe('delegate')
    const effect = r.effect
    if (effect.kind !== 'member-activated') throw new Error(`T3: effect ${effect.kind}`)
    expect(effect.templateId).toBe(SCOUT_TEMPLATE)
    expect(typeof effect.instanceId).toBe('string')
    expect(effect.instanceId.length).toBeGreaterThan(0)
    expect(effect.workStatus).toBe('admitted')
    expect(effect.workSettled).toBe(false)
    expect(typeof effect.workSequence).toBe('number')
    expect(effect.memberResult === undefined).toBe(true)
  })

  it('T3-collect: the terminal result of the created member comes back under the same token', () => {
    const receipt = T.t3Receipt
    const c = T.t3Collect
    if (receipt === undefined || c === undefined) throw new Error('T3: state missing')
    if (receipt.status !== 'executed') throw new Error(`T3: receipt not executed, got '${receipt.status}'`)
    const rEffect = receipt.effect
    if (rEffect.kind !== 'member-activated') throw new Error('T3: receipt effect changed')
    const entry = entryFor(asWorkStatus(c), 't3-dl')
    expect(entry.status).toBe('succeeded')
    expect(entry.instanceId).toBe(rEffect.instanceId)
    expect(entry.memberResult).toEqual({ requestToken: 't3-dl', status: 'succeeded', body: 'T3-BODY' })
  })
})

describe('issue #1 GREEN T4: team_collect is read-only and stable', () => {
  it('T4-readonly: the collect writes nothing and delivers nothing', () => {
    expect(T.t4WritesAfter).toBe(T.t4WritesBefore)
    expect(T.t4DeliveriesAfter).toBe(T.t4DeliveriesBefore)
  })

  it('T4-entries: duplicates collapse, input order is kept, the unknown token is the stable not-found code', () => {
    const c = T.t4Collect
    if (c === undefined) throw new Error('T4: collect missing')
    const entries = asWorkStatus(c)
    expect(entries.length).toBe(3)
    expect(entries.map((entry) => entry.requestToken)).toEqual(['t1-fu', 't2-fu', 't4-unknown'])
    const t1Entry = entryFor(entries, 't1-fu')
    expect(t1Entry.status).toBe('succeeded')
    const unknown = entryFor(entries, 't4-unknown')
    expect(unknown.status).toBe('unavailable')
    expect(unknown.error?.code).toBe(WORK_STATUS_CODES.TOKEN_UNKNOWN)
  })
})

describe('issue #1 GREEN T5: the collect argument contract (tool layer)', () => {
  it('T5-args: empty / non-array / 65 tokens / empty entry all reject TEAM_TOOL_BAD_ARGUMENTS', () => {
    const cases: readonly [string, Captured | undefined][] = [
      ['empty array', T.t5Empty],
      ['non-array', T.t5NonArray],
      ['65 tokens', T.t5TooMany],
      ['empty-string entry', T.t5EmptyEntry],
    ]
    for (const [name, cap] of cases) {
      if (cap === undefined) throw new Error(`T5 ${name}: captured rejection missing`)
      expect(cap.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
    }
  })
})

describe('issue #1 GREEN T6: the explicit async:false pin', () => {
  it('T6-explicit-sync: async:false does NOT engage the async mode (still the settled effect)', () => {
    const r = T.t6Receipt
    if (r === undefined) throw new Error('T6: receipt missing')
    if (r.status !== 'executed') throw new Error(`T6: expected executed, got '${r.status}'`)
    const effect = r.effect
    if (effect.kind !== 'work-admitted') throw new Error(`T6: effect ${effect.kind}`)
    expect(effect.settled).toBe(true)
    expect(effect.memberResult).toEqual({ requestToken: 't6-fu', status: 'succeeded', body: 'T6-BODY' })
  })
})
