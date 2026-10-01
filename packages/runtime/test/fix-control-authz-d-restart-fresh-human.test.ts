/**
 * fix-control-authz D (P1) — the REAL-chain regression for the restart
 * reusing a stale recovery approval (the "fresh Human per attempt"
 * violation — target-design §11.3 "每次 Recovery dispatch attempt 都重新
 * 审批；不做 approval replay" + ADR-19 "每一次真实执行尝试都重新审批，
 * 不复用上一次批准").
 *
 * The defect: the router derived the recovery correlation from a
 * PROCESS-LOCAL counter (`recovery:${requestToken}:${++seq}`) that RESETS
 * to 0 on restart, and the real control plane reuses an EXISTING request
 * by its scope key (root + subject + action + tool + correlation +
 * fingerprint — recovery requests carry no fingerprint) EVEN WHEN THE
 * EXISTING REQUEST IS ALREADY DECIDED. So a cold-restart retry of the
 * SAME requestToken re-derived correlation `:1` and directly re-armed the
 * stale approval — the persisted `allow` executed the NEW invocation
 * with no fresh Human (work idempotency cannot protect: no work was
 * committed before the crash).
 *
 * What this proves (REAL ControlService + REAL router; the restart is
 * the REAL durable primitive — `restartP6T1World`: domain close + reopen
 * over the same scratch dir):
 *   D1 (the finding's repro): token T is approved; the invocation dies
 *       BEFORE work admission (the re-run's first durable write faults —
 *       the durable allow is the crash residue, no work committed);
 *       COLD-RESTART retry of T obtains a NEW pending request (a NEW
 *       restart-unique correlation — no approval replay); ZERO work
 *       before the fresh approval; then the fresh approval → the work
 *       executes EXACTLY ONCE.
 *   D2 (crash mid-wait): the wait aborts (the inline cascade abandons
 *       the request durably); the COLD-RESTART retry of T obtains a NEW
 *       pending request — it must never re-arm the abandoned row (the
 *       old code re-derived the same correlation and awaited the
 *       abandoned row, which can never settle) — and the fresh approval
 *       → the work executes EXACTLY ONCE.
 *
 * @module @dsh-agent-team/runtime/test/fix-control-authz-d-restart-fresh-human
 */

import { afterEach, describe, expect, it } from 'vitest'

import type { P6T1World } from './p6t1-helpers.js'
import { restartP6T1World } from './p6t1-helpers.js'
import {
  AUTHZ_ROOT,
  authzFacts,
  authzFollowUp,
  authzHumanCaller,
  createAuthzWorld,
  destroyAuthzWorld,
  sleep,
  waitForControlRequests,
  withTimeout,
  type AuthzWorld,
} from './fix-control-authz-helpers.js'
import {
  P6T2_NOW,
  TEST_STATIC_MODEL,
  createFakeLifecycleCommitPort,
} from './p6t2-helpers.js'
import { createTeamRuntime } from '../action-router/index.js'
import { createControlService } from '../control/index.js'
import { createWorkActivityWriter } from '../activity/index.js'

const STABLE_TOKEN = 'tok-d-stable'
const STABLE_PROMPT = 'D-repro stable prompt (the reviewed work)'

let world: AuthzWorld | undefined
let world2: AuthzWorld | undefined

afterEach(async () => {
  if (world !== undefined) {
    await destroyAuthzWorld(world)
  }
  if (world2 !== undefined) {
    await destroyAuthzWorld(world2)
  }
  world = undefined
  world2 = undefined
})

function capture(promise: Promise<unknown>): Promise<
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown }
> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  )
}

/** Rebuild the REAL chain over a RESTARTED world (a fresh router instance
 *  + a fresh control service over the SAME durable store — the process
 *  restart) reusing the pre-restart recording delivery port (the
 *  cross-process delivery count). */
function restartedChain(
  base: AuthzWorld,
  worldAfterRestart: P6T1World,
): { readonly runtime: ReturnType<typeof createTeamRuntime>; readonly control: ReturnType<typeof createControlService> } {
  const control = createControlService({
    teamDomain: worldAfterRestart.domain,
    blueprintCatalog: worldAfterRestart.catalog,
    externalPolicyFacts: worldAfterRestart.ports.externalPolicyFacts,
    now: () => P6T2_NOW,
    waitPollIntervalMs: 5,
  })
  const runtime = createTeamRuntime({
    teamDomain: worldAfterRestart.domain,
    activationProvider: worldAfterRestart.provider,
    blueprintCatalog: worldAfterRestart.catalog,
    environmentFacts: worldAfterRestart.ports.environmentFacts,
    externalPolicyFacts: worldAfterRestart.ports.externalPolicyFacts,
    staticModel: TEST_STATIC_MODEL,
    now: () => P6T2_NOW,
    lifecycleCommit: createFakeLifecycleCommitPort(worldAfterRestart),
    workDelivery: base.deliveryPort,
    workActivity: createWorkActivityWriter({ teamDomain: worldAfterRestart.domain, now: () => P6T2_NOW }),
    controlServiceRef: { current: control },
  })
  return { runtime, control }
}

describe('fix-control-authz D — every restart-unique attempt requires a fresh Human', () => {
  it('D1: an approved-then-crashed token re-arms NO stale approval on the cold-restart retry (NEW pending request; zero work before the fresh approval; then exactly-once work)', async () => {
    world = await createAuthzWorld('authz-d-1')
    const promise = capture(
      withTimeout(
        world.runtime.performAction(
          authzFollowUp({
            requestToken: STABLE_TOKEN,
            payload: { prompt: STABLE_PROMPT },
          }),
        ),
        30_000,
        'the recovery follow-up (the approved-then-crashed repro)',
      ),
    )
    const { requests } = await withTimeout(waitForControlRequests(world.control, 1), 15_000, 'the durable request row')
    const row1 = requests.find((r) => String(r.correlation).startsWith(`recovery:${STABLE_TOKEN}:`))
    expect(row1).toBeDefined()
    expect(row1?.status).toBe('pending')
    const correlation1 = String(row1?.correlation)

    // The HUMAN approves the review (a durable allow decision).
    await world.control.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row1?.requestId),
      decision: 'allow',
    })
    // CRASH before work admission: the re-run's first durable write
    // faults (the established S7 fault-injection pattern — the same
    // repositories object the re-run's gate/effect write through). The
    // durable state left behind = request + allow decision, NO work
    // fact (the crash residue the finding describes).
    const ledger = world.world.domain.repositories.ledger
    const originalAllocate = ledger.allocateSequence.bind(ledger)
    let rejected = false
    try {
      ledger.allocateSequence = async () => {
        throw new Error('injected: the process crashed before work admission')
      }
      const outcome = await promise
      rejected = outcome.ok === false
      if (outcome.ok === true) {
        throw new Error('D1: the faulted re-run must NOT commit the work (no durable write may succeed)')
      }
    } finally {
      ledger.allocateSequence = originalAllocate
    }
    expect(rejected).toBe(true)
    // The crash residue: the durable allow, ZERO work.
    const stateCrashed = await world.control.listControlState(AUTHZ_ROOT)
    const record1 = stateCrashed.requests.find((r) => r.requestId === row1?.requestId)
    expect(stateCrashed.decisions.some((d) => d.requestId === row1?.requestId && d.decision === 'allow')).toBe(true)
    expect(record1?.status).toBe('decided')
    expect(authzFacts(world.world, 'team-work-admitted').length).toBe(0)
    expect(world.deliveryCalls.length).toBe(0)

    // --- THE COLD RESTART (the real durable primitive) ------------------
    const worldAfterRestart = await restartP6T1World(world.world)
    const chain2 = restartedChain(world, worldAfterRestart)
    world2 = { world: worldAfterRestart, runtime: chain2.runtime, control: chain2.control, deliveryPort: world.deliveryPort, deliveryCalls: world.deliveryCalls }

    // The retry of the SAME token (a NEW invocation — a fresh request
    // object; the work idempotency has nothing to dedupe on).
    const retry = capture(
      withTimeout(
        chain2.runtime.performAction(
          authzFollowUp({
            requestToken: STABLE_TOKEN,
            payload: { prompt: STABLE_PROMPT },
          }),
        ),
        30_000,
        'the cold-restart retry of the stable token',
      ),
    )
    // The retry obtains a NEW pending request (the restart-unique attempt
    // identity — the old code re-derived correlation ':1' and re-armed
    // the stale allow directly, executing the work without any fresh
    // Human).
    const state2 = await withTimeout(waitForControlRequests(chain2.control, 2), 15_000, 'the NEW durable request row')
    const row2 = state2.requests.find((r) => String(r.correlation).startsWith(`recovery:${STABLE_TOKEN}:`) && r.requestId !== row1?.requestId)
    expect(row2).toBeDefined()
    expect(String(row2?.correlation)).not.toBe(correlation1)
    expect(row2?.status).toBe('pending')
    expect(row2?.executionCoupling).toBe('inline')

    // ZERO work before the fresh approval.
    expect(authzFacts(worldAfterRestart, 'team-work-admitted').length).toBe(0)
    expect(world.deliveryCalls.length).toBe(0)

    // The FRESH Human approval → the work executes EXACTLY ONCE.
    await chain2.control.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row2?.requestId),
      decision: 'allow',
    })
    const retryOutcome = await retry
    expect(retryOutcome.ok).toBe(true)
    expect(authzFacts(worldAfterRestart, 'team-work-admitted').length).toBe(1)
    expect(world.deliveryCalls.length).toBe(1)
    expect(world.deliveryCalls[0]?.prompt).toBe(STABLE_PROMPT)
    // The stale approval was NOT consumed/re-armed (the inline allow
    // writes no consumption — but the point is the NEW request carried
    // the new authorization).
    const stateFinal = await chain2.control.listControlState(AUTHZ_ROOT)
    expect(stateFinal.decisions.filter((d) => d.decision === 'allow').length).toBe(2)
  })

  it('D2: a crashed-mid-wait (abandoned) token re-arms NO stale review on the cold-restart retry (NEW pending request; exactly-once work after the fresh approval)', async () => {
    world = await createAuthzWorld('authz-d-2')
    const ac = new AbortController()
    const promise = capture(
      withTimeout(
        world.runtime.performAction(
          authzFollowUp({
            requestToken: STABLE_TOKEN,
            payload: { prompt: STABLE_PROMPT },
            signal: ac.signal,
          }),
        ),
        30_000,
        'the recovery follow-up (the crash-mid-wait repro)',
      ),
    )
    const { requests } = await withTimeout(waitForControlRequests(world.control, 1), 15_000, 'the durable request row')
    const row1 = requests.find((r) => String(r.correlation).startsWith(`recovery:${STABLE_TOKEN}:`))
    expect(row1).toBeDefined()
    await sleep(20) // let the waiter park
    // CRASH mid-wait: the caller's signal aborts (the inline cascade
    // durably abandons the request — the crash residue: an ABANDONED row,
    // no decision, no work).
    ac.abort()
    const aborted = await promise
    expect(aborted.ok).toBe(false)
    const stateCrashed = await world.control.listControlState(AUTHZ_ROOT)
    expect(stateCrashed.abandonments.some((a) => a.requestId === row1?.requestId)).toBe(true)
    expect(authzFacts(world.world, 'team-work-admitted').length).toBe(0)
    expect(world.deliveryCalls.length).toBe(0)

    // --- THE COLD RESTART ------------------------------------------------
    const worldAfterRestart = await restartP6T1World(world.world)
    const chain2 = restartedChain(world, worldAfterRestart)
    world2 = { world: worldAfterRestart, runtime: chain2.runtime, control: chain2.control, deliveryPort: world.deliveryPort, deliveryCalls: world.deliveryCalls }

    // The retry of the SAME token: a NEW pending request (the old code
    // re-derived the same correlation, found the ABANDONED row, and
    // awaited it — a row that can never settle).
    const retry = capture(
      withTimeout(
        chain2.runtime.performAction(
          authzFollowUp({
            requestToken: STABLE_TOKEN,
            payload: { prompt: STABLE_PROMPT },
          }),
        ),
        30_000,
        'the cold-restart retry of the abandoned token',
      ),
    )
    const state2 = await withTimeout(waitForControlRequests(chain2.control, 2), 15_000, 'the NEW durable request row')
    const row2 = state2.requests.find((r) => String(r.correlation).startsWith(`recovery:${STABLE_TOKEN}:`) && r.requestId !== row1?.requestId)
    expect(row2).toBeDefined()
    expect(row2?.status).toBe('pending')
    expect(authzFacts(worldAfterRestart, 'team-work-admitted').length).toBe(0)
    expect(world.deliveryCalls.length).toBe(0)

    // The FRESH Human approval → the work executes EXACTLY ONCE.
    await chain2.control.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row2?.requestId),
      decision: 'allow',
    })
    const retryOutcome = await retry
    expect(retryOutcome.ok).toBe(true)
    expect(authzFacts(worldAfterRestart, 'team-work-admitted').length).toBe(1)
    expect(world.deliveryCalls.length).toBe(1)
  })
})
