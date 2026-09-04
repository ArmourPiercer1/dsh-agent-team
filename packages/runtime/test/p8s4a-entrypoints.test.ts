/**
 * P8-S4A — the entry-point half of the unified compatibility admission
 * acceptance (closure plan §17.1; DevPlan §20.1; Architecture §28.2/§41.7).
 *
 * The authority-level half (C1 stale OPEN, C2 stale ACK, C6 FATAL) lives in
 * `p8s4a-chain.test.ts`. These scenarios drive the REAL action router +
 * ActivationProvider through the four NEW WORK / activation entry points
 * (follow-up, delegate-continue, delegate-create, explicit-create) over the
 * FULL P8-S3 work chain (lifecycle commit port + delivery port + in-facade
 * activity writer), and assert the SINGLE compatibility authority is the
 * one verdict source at admission:
 *
 * - C3: one valid (fresh) compatibility state -> ALL FOUR entry points
 *   admit (PASS), and the durable compatibility row — the single source of
 *   truth — is UNCHANGED (same fingerprint + generation) across all four:
 *   one authority, one result (no entry point runs its own preflight or
 *   re-probes independently);
 * - C4: in-flight work SETTLES after the environment drifts to FATAL
 *   (drift during the delivery): the P8-S3 settlement (`settleAdmittedWork`
 *   — interacted with, not re-implemented) never consults the current
 *   compatibility state, so the work settles and the durable row is left
 *   STALE (the settlement did not re-probe);
 * - C5: after the environment drifts to FATAL, the NEXT NEW WORK is gated —
 *   the entry point re-probes (freshness) and fails closed
 *   (COMPATIBILITY_BLOCKED).
 *
 * Top-level-await pattern (plain-node shim): every scenario runs at module
 * top level, its observables are captured into a plain snapshot, the world
 * is destroyed in `finally`; the `it` bodies assert only over the captured
 * data.
 *
 * @module @dsh-agent-team/runtime/test/p8s4a-entrypoints
 */

import { describe, expect, it } from 'vitest'
import type { LedgerEntry } from '../../storage/schema/index.js'
import { createTeamRuntime } from '../action-router/index.js'
import type { TeamRuntime, TeamRuntimeActionRequest } from '../admission/index.js'
import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import { createWorkActivityWriter } from '../activity/index.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2World,
  makeActionRequest,
} from './p6t2-helpers.js'
import { destroyP6T1World, makeEnvironmentFacts } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { factsSkillBaseDown } from './p7t1-helpers.js'
import type { MutableFacts } from './p8s4a-helpers.js'

const WORKER_ID = String(P6T2_SEEDS.worker.instanceId)

// --- local fixtures ------------------------------------------------------------

/** One durable compatibility row projected to its identity fields. */
interface CompatRowView {
  readonly fingerprint: string
  readonly generation: number
  readonly status: string
}

function compatRowView(world: P6T1World): CompatRowView | undefined {
  const row = world.domain.repositories.compatibility.get(P6T2_ROOT)
  if (row === undefined) return undefined
  return { fingerprint: row.fingerprint, generation: row.generation, status: row.status }
}

/** One entry-point attempt: the effect kind, or the rejection code + details. */
interface EntryResult {
  readonly ok: boolean
  readonly kind: string
  readonly error: string | undefined
  readonly errorDetails: Record<string, unknown> | undefined
}

async function runEntry(
  runtime: TeamRuntime,
  request: TeamRuntimeActionRequest,
): Promise<EntryResult> {
  try {
    const outcome = await runtime.performAction(request)
    return { ok: true, kind: outcome.effect.kind, error: undefined, errorDetails: undefined }
  } catch (error) {
    const record = (error ?? {}) as { code?: unknown; details?: unknown }
    return {
      ok: false,
      kind: 'error',
      error: record.code !== undefined ? String(record.code) : undefined,
      errorDetails:
        record.details !== undefined ? (record.details as Record<string, unknown>) : undefined,
    }
  }
}

/**
 * A recording delivery port. When `driftTo` is given, the FIRST delivery
 * replaces the mutable facts (the environment drifts while the work is
 * in-flight — the C4 scenario), then the delivery succeeds.
 */
function createP8S4ADeliveryPort(
  facts: MutableFacts,
  driftTo?: ReturnType<typeof factsSkillBaseDown>,
) {
  const calls: { readonly instanceId: string; readonly requestToken: string; readonly prompt: string }[] = []
  const port = {
    async deliver(args: {
      readonly rootSessionId: string
      readonly instanceId: string
      readonly childSessionId: string
      readonly requestToken: string
      readonly prompt: string
      readonly attachedContext?: string
    }): Promise<void> {
      calls.push({
        instanceId: args.instanceId,
        requestToken: args.requestToken,
        prompt: args.prompt,
      })
      if (driftTo !== undefined && calls.length === 1) {
        facts.current = driftTo
      }
    },
  }
  return { port, calls }
}

/** The FULL P8-S3 production work-chain wiring over one world. */
function createP8S4AWorkChainRuntime(
  world: P6T1World,
  delivery: {
    deliver(args: {
      readonly rootSessionId: string
      readonly instanceId: string
      readonly childSessionId: string
      readonly requestToken: string
      readonly prompt: string
      readonly attachedContext?: string
    }): Promise<void>
  },
): TeamRuntime {
  return createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T2_NOW,
    lifecycleCommit: createFakeLifecycleCommitPort(world),
    workDelivery: delivery,
    workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
  })
}

/** Find one durable fact by type + exact payload-field match. */
function findFact(
  world: P6T1World,
  factType: string,
  match: Record<string, unknown>,
): LedgerEntry {
  const found = world.domain.repositories.ledger.list().find((entry) =>
    entry.factType === factType &&
    Object.entries(match).every(([key, value]) => entry.payload[key] === value),
  )
  if (found === undefined) {
    throw new Error(`findFact: no ${factType} fact matches ${JSON.stringify(match)}`)
  }
  return found
}

/** Build one mutable-facts P6-T2 world (the environment is the fixture). */
async function createMutableWorld(basename: string, seedNames: readonly (keyof typeof P6T2_SEEDS)[]): Promise<{ world: P6T1World; facts: MutableFacts }> {
  const facts: MutableFacts = { current: makeEnvironmentFacts() }
  const world = await createP6T2World(basename, seedNames, {
    environmentFacts: async () => facts.current,
  })
  return { world, facts }
}

// ---------------------------------------------------------------------------
// C3 — one valid state -> ALL FOUR entry points admit (one authority, same
//      result: the durable row is unchanged across all four)
// ---------------------------------------------------------------------------
interface C3 {
  readonly followUp: EntryResult
  readonly delegateContinue: EntryResult
  readonly delegateCreate: EntryResult
  readonly explicitCreate: EntryResult
  readonly rows: readonly (CompatRowView | undefined)[]
  readonly allAdmitted: boolean
  readonly fingerprints: readonly string[]
  readonly generations: readonly number[]
}
let c3: C3
{
  const { world, facts } = await createMutableWorld('p8s4a-c3', ['leader', 'worker'])
  try {
    // The environment is OPEN (both probeable requirements available).
    facts.current = makeEnvironmentFacts()
    const delivery = createP8S4ADeliveryPort(facts)
    const runtime = createP8S4AWorkChainRuntime(world, delivery.port)

    const followUp = await runEntry(
      runtime,
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-p8s4a-c3-fu',
        payload: { prompt: 'p8s4a C3 follow-up prompt' },
      }),
    )
    const row1 = compatRowView(world)

    // delegate-continue: the `worker` template is NOT fresh_per_delegation
    // and has an active (RUNNING) instance -> the delegation CONTINUES it.
    const delegateContinue = await runEntry(
      runtime,
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'worker',
        requestToken: 'tok-p8s4a-c3-delegate-continue',
        payload: { label: 'p8s4a-c3-continuee', prompt: 'p8s4a C3 delegate-continue prompt' },
      }),
    )
    const row2 = compatRowView(world)

    // delegate-create: the `scout` template IS fresh_per_delegation -> the
    // delegation CREATES a new instance.
    const delegateCreate = await runEntry(
      runtime,
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'scout',
        requestToken: 'tok-p8s4a-c3-delegate-create',
        payload: { label: 'p8s4a-c3-scout', prompt: 'p8s4a C3 delegate-create prompt' },
      }),
    )
    const row3 = compatRowView(world)

    // explicit-create: `create-member` (leader source).
    const explicitCreate = await runEntry(
      runtime,
      makeActionRequest({
        action: 'create-member',
        delegationTemplateId: 'worker',
        requestToken: 'tok-p8s4a-c3-create',
        payload: { label: 'p8s4a-c3-explicit-worker' },
      }),
    )
    const row4 = compatRowView(world)

    c3 = {
      followUp,
      delegateContinue,
      delegateCreate,
      explicitCreate,
      rows: [row1, row2, row3, row4],
      allAdmitted:
        followUp.ok &&
        delegateContinue.ok &&
        delegateCreate.ok &&
        explicitCreate.ok,
      fingerprints: [row1, row2, row3, row4].map((row) => row?.fingerprint ?? ''),
      generations: [row1, row2, row3, row4].map((row) => row?.generation ?? -1),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P8-S4A C3: one valid state -> all four entry points admit', () => {
  it('all four entry points PASS (are admitted, none blocked)', () => {
    expect(c3.allAdmitted).toBe(true)
    expect(c3.followUp.kind).toBe('work-admitted')
    expect(c3.delegateContinue.kind).toBe('work-admitted')
    expect(c3.delegateCreate.kind).toBe('member-activated')
    expect(c3.explicitCreate.kind).toBe('member-activated')
  })
  it('the durable compatibility row is the SAME after all four (one authority, same result)', () => {
    const first = c3.fingerprints[0] ?? ''
    expect(first.length).toBeGreaterThan(0)
    expect(c3.fingerprints[1] === first).toBe(true)
    expect(c3.fingerprints[2] === first).toBe(true)
    expect(c3.fingerprints[3] === first).toBe(true)
  })
  it('no entry point re-probed independently (the generation never moved)', () => {
    expect(c3.generations).toEqual([1, 1, 1, 1])
  })
})

// ---------------------------------------------------------------------------
// C4 — in-flight work SETTLES after the environment drifts to FATAL (drift
//      during the delivery); the settlement never consults compatibility
// ---------------------------------------------------------------------------
interface C4 {
  readonly admitted: boolean
  readonly settled: boolean | undefined
  readonly workOutcome: unknown
  readonly memberLifecycle: string | undefined
  readonly factsNowFatal: boolean
  readonly rowStatus: string | undefined
  readonly rowGeneration: number | undefined
  readonly rowStaleAfterSettle: boolean
}
let c4: C4
{
  const { world, facts } = await createMutableWorld('p8s4a-c4', ['leader', 'worker'])
  try {
    // The environment starts OPEN; the delivery port drifts it to FATAL on
    // the FIRST delivery (the work is in-flight when the env degrades).
    facts.current = makeEnvironmentFacts()
    const delivery = createP8S4ADeliveryPort(facts, factsSkillBaseDown())
    const runtime = createP8S4AWorkChainRuntime(world, delivery.port)
    const token = 'tok-p8s4a-c4-w1'
    const outcome = await runEntry(
      runtime,
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: token,
        payload: { prompt: 'p8s4a C4 in-flight prompt' },
      }),
    )
    const settledFact = outcome.ok
      ? findFact(world, 'member-lifecycle-changed', { to: 'SETTLED', requestToken: token })
      : undefined
    const member = world.domain.repositories.memberInstances.get(P6T2_ROOT, WORKER_ID)
    const row = compatRowView(world)
    c4 = {
      admitted: outcome.ok,
      settled: settledFact !== undefined ? settledFact.payload['to'] === 'SETTLED' : undefined,
      workOutcome: settledFact !== undefined ? settledFact.payload['workOutcome'] : undefined,
      memberLifecycle: member !== undefined ? member.lifecycle : undefined,
      factsNowFatal: facts.current.some(
        (fact) => fact.domain === 'skill' && fact.subject === 'base' && fact.available === false,
      ),
      rowStatus: row?.status,
      rowGeneration: row?.generation,
      // The row is the ORIGINAL pre-drift OPEN generation: the settlement
      // (and delivery) never re-probed / consulted the compatibility state.
      rowStaleAfterSettle: row !== undefined && row.status === 'OPEN' && row.generation === 1,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P8-S4A C4: in-flight work settles after drift', () => {
  it('the in-flight work is admitted and settles (workOutcome settled)', () => {
    expect(c4.admitted).toBe(true)
    expect(c4.settled).toBe(true)
    expect(c4.workOutcome).toBe('settled')
  })
  it('the member converges to SETTLED', () => {
    expect(c4.memberLifecycle).toBe('SETTLED')
  })
  it('the environment had drifted to FATAL while the work was in-flight', () => {
    expect(c4.factsNowFatal).toBe(true)
  })
  it('the settlement did NOT consult compatibility: the row is the stale pre-drift OPEN', () => {
    expect(c4.rowStaleAfterSettle).toBe(true)
    expect(c4.rowStatus).toBe('OPEN')
    expect(c4.rowGeneration).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// C5 — after the environment drifts to FATAL, the NEXT NEW WORK is gated
// ---------------------------------------------------------------------------
interface C5 {
  readonly firstAdmitted: boolean
  readonly firstRowGeneration: number | undefined
  readonly second: EntryResult
  readonly secondCode: string | undefined
  readonly secondStatus: string | undefined
  readonly secondSource: string | undefined
  readonly secondReprobed: boolean | undefined
  readonly secondRowStatus: string | undefined
  readonly secondRowGeneration: number | undefined
}
let c5: C5
{
  const { world, facts } = await createMutableWorld('p8s4a-c5', ['leader', 'worker'])
  try {
    // The environment starts OPEN; the first NEW WORK establishes the
    // durable state (gen 1 OPEN) and settles.
    facts.current = makeEnvironmentFacts()
    const delivery = createP8S4ADeliveryPort(facts)
    const runtime = createP8S4AWorkChainRuntime(world, delivery.port)
    const first = await runEntry(
      runtime,
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-p8s4a-c5-w1',
        payload: { prompt: 'p8s4a C5 first work prompt' },
      }),
    )
    const firstRow = compatRowView(world)
    // The environment drifts to FATAL (the required skill is gone).
    facts.current = factsSkillBaseDown()
    // The NEXT NEW WORK is gated at the current (drifted) state.
    const second = await runEntry(
      runtime,
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-p8s4a-c5-w2',
        payload: { prompt: 'p8s4a C5 second work prompt' },
      }),
    )
    const secondRow = compatRowView(world)
    c5 = {
      firstAdmitted: first.ok,
      firstRowGeneration: firstRow?.generation,
      second,
      secondCode: second.error,
      secondStatus: second.errorDetails !== undefined ? (second.errorDetails['status'] as string | undefined) : undefined,
      secondSource: second.errorDetails !== undefined ? (second.errorDetails['source'] as string | undefined) : undefined,
      secondReprobed: second.errorDetails !== undefined ? (second.errorDetails['reprobed'] as boolean | undefined) : undefined,
      secondRowStatus: secondRow?.status,
      secondRowGeneration: secondRow?.generation,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P8-S4A C5: next new work is gated after drift', () => {
  it('the first new work is admitted under the OPEN state (gen 1)', () => {
    expect(c5.firstAdmitted).toBe(true)
    expect(c5.firstRowGeneration).toBe(1)
  })
  it('the next new work is rejected COMPATIBILITY_BLOCKED (fails closed)', () => {
    expect(c5.second.ok).toBe(false)
    expect(c5.secondCode).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
  })
  it('the gate re-probed (freshness) and reports the durable FATAL state', () => {
    expect(c5.secondReprobed).toBe(true)
    expect(c5.secondStatus).toBe('BLOCKED_FATAL')
    expect(c5.secondSource).toBe('durable-state')
  })
  it('the re-probe replaced the stale row (gen 2 BLOCKED_FATAL)', () => {
    expect(c5.secondRowStatus).toBe('BLOCKED_FATAL')
    expect(c5.secondRowGeneration).toBe(2)
  })
})
