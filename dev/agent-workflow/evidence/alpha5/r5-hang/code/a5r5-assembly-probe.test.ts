/**
 * a5r5-resolve-hang.test.ts — G3 R-5 PROBE (evidence-only, not a product suite).
 *
 * The red account R-5 (dev/agent-workflow/evidence/alpha5/tools-gov/TOOLS.md,
 * run 2026-10-19T09-36-46Z) records: in the REAL ask world a member write
 * parked as a durable `leader-approval` / `reviewAuthority=leader` /
 * `executionCoupling=guarded` case leg, and the kit's HUMAN remote v4
 * `team.resolveControl` call produced NO response for 240s (fetch abort),
 * NO durable decision row, zero side effects — while the same case decided
 * through the LEADER tool lane (`team_resolve_control`) worked.
 *
 * This file asks ONE question at the assembly level: does the production
 * v4 human lane — the REAL S6 dispatcher + REAL T12-B4 derivation + REAL
 * A25 control service — settle, or does it hang?
 *
 *  S1  the R-5 shape (A4 case leg, guarded coupling) WITH a parked
 *      `awaitControlDecision` waiter, resolved by the human v4 wire.
 *  S2  the same shape with NO parked waiter (isolates the waiter).
 *  S3  the same shape + parked waiter, resolved by the LEADER caller
 *      (the lane the red account says worked).
 *  S4  the pre-A4 legacy shape (plain `requestControl`, no coupling, no
 *      leg) + parked waiter, human v4 wire (the shape the shipped pr-d
 *      real-host kit C2 drives successfully).
 *
 * Every resolution attempt is raced against a 5s deadline and recorded as
 * SETTLED / HANG / REJECTED, so a hang is DATA, not a stuck runner.
 *
 * @module @dsh-agent-team/runtime/test/a5r5-resolve-hang
 */

import { describe, expect, it } from 'vitest'

import {
  CONTROL_EXECUTION_COUPLINGS,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type { ApprovalCaseIdentityInput, ControlService } from '../control/index.js'
import {
  createS6RemoteDispatcher,
  createS6RemotePorts,
} from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import { createServerPrincipalDerivation } from '../src/plugin/s6-principal.js'
import type { ActionCaller } from '../admission/index.js'
import { REMOTE_CONTRACT_VERSION_V4 } from '../../remote/src/index.js'
import type { RemoteResponse, RemoteSafeRecord } from '../../remote/src/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  constantAuthorityRecheck,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)
const SUBJECT = { kind: 'instance', instanceId: WORKER_ID } as const
const AUTHORITY_SCOPE = {
  operationClass: 'fs.write',
  matcher: { kind: 'exact', resource: 'a5r5-fixture:fileA' },
} as const
const RECHECK = constantAuthorityRecheck()

type Outcome =
  | { readonly kind: 'SETTLED'; readonly ms: number; readonly response?: RemoteResponse; readonly value?: unknown }
  | { readonly kind: 'REJECTED'; readonly ms: number; readonly error: unknown }
  | { readonly kind: 'HANG'; readonly ms: number }

/** Race a promise against a deadline; a hang is a recorded outcome. */
async function race<T>(label: string, work: () => Promise<T>, budgetMs = 5_000): Promise<Outcome> {
  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> = setTimeout(() => {}, 0)
  clearTimeout(timer)
  try {
    const p = work()
    const value = await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('__a5r5_deadline__')), budgetMs)
      p.then(resolve, reject)
    })
    return { kind: 'SETTLED', ms: Date.now() - started, value }
  } catch (error) {
    const ms = Date.now() - started
    if (error instanceof Error && error.message === '__a5r5_deadline__') {
      return { kind: 'HANG', ms }
    }
    return { kind: 'REJECTED', ms, error }
  } finally {
    clearTimeout(timer)
    void label
  }
}

/** The REAL production remote surface over one real control service. */
function buildS6OverService(world: Awaited<ReturnType<typeof createP6T4World>>, service: ControlService) {
  const opts = {
    rootSessionId: P6T4_ROOT,
    repositories: world.domain.repositories,
    now: () => new Date().toISOString(),
    resolveControl: async (args: {
      readonly rootSessionId: string
      readonly caller: ActionCaller
      readonly requestId: string
      readonly decision: 'allow' | 'deny'
      readonly note?: string
    }): Promise<RemoteSafeRecord> => {
      const record = await service.resolveControl({
        rootSessionId: args.rootSessionId,
        caller: args.caller,
        requestId: args.requestId,
        decision: args.decision,
        ...(args.note !== undefined ? { note: args.note } : {}),
      })
      return record as unknown as RemoteSafeRecord
    },
  } as unknown as S6RemoteOptions
  const ports = createS6RemotePorts(opts)
  const derivation = createServerPrincipalDerivation({
    rootSessionId: P6T4_ROOT,
    repositories: world.domain.repositories,
    leaderInstanceId: LEADER_ID,
  })
  return createS6RemoteDispatcher(ports, derivation)
}

function identity(correlation: string): ApprovalCaseIdentityInput {
  return {
    subject: SUBJECT,
    beneficiaryAuthority: 'member',
    requestedEffect: 'ask',
    operationFingerprint: `fp-a5r5-${correlation}`,
    authorityScope: AUTHORITY_SCOPE,
    correlation,
  }
}

function errorOf(response: RemoteResponse): unknown {
  return response.ok ? null : response.error
}

// ── S1: the R-5 shape (A4 leader-rung case leg, guarded) + parked waiter, human v4 wire ──
const S1 = await (async () => {
  const world = await createP6T4World('a5r5-s1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world, { authorityRevalidation: RECHECK.port })
    const dispatch = buildS6OverService(world, service)
    const leg = await service.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: identity('a5r5-s1'),
      actionName: 'write-file',
      toolName: 'write',
      summary: 'a5r5 S1 guarded ask leg',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
    })
    const requestId = leg.kind === 'leg' ? leg.leg.requestId : '<no-leg>'
    // The parked member (the exact ask-lane waiter shape).
    const waiter = service.awaitControlDecision({ rootSessionId: P6T4_ROOT, requestId })
    void waiter.catch(() => undefined)
    const resolve = await race('S1 human v4 wire', () =>
      dispatch('team.resolveControl', {
        version: REMOTE_CONTRACT_VERSION_V4,
        params: { teamSessionId: P6T4_ROOT, requestId, decision: 'allow', note: 'a5r5 S1 human allow' },
      }),
    )
    const decisions = controlFacts(world, 'control-decision-recorded').length
    return { requestId, legKind: leg.kind, resolve, decisions }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ── S2: same shape, NO parked waiter ──
const S2 = await (async () => {
  const world = await createP6T4World('a5r5-s2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world, { authorityRevalidation: RECHECK.port })
    const dispatch = buildS6OverService(world, service)
    const leg = await service.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: identity('a5r5-s2'),
      actionName: 'write-file',
      toolName: 'write',
      summary: 'a5r5 S2 guarded ask leg (no waiter)',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
    })
    const requestId = leg.kind === 'leg' ? leg.leg.requestId : '<no-leg>'
    const resolve = await race('S2 human v4 wire (no waiter)', () =>
      dispatch('team.resolveControl', {
        version: REMOTE_CONTRACT_VERSION_V4,
        params: { teamSessionId: P6T4_ROOT, requestId, decision: 'allow', note: 'a5r5 S2 human allow' },
      }),
    )
    return { requestId, resolve, decisions: controlFacts(world, 'control-decision-recorded').length }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ── S3: the R-5 shape + parked waiter, LEADER caller (the lane reported to work) ──
const S3 = await (async () => {
  const world = await createP6T4World('a5r5-s3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world, { authorityRevalidation: RECHECK.port })
    const leg = await service.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: identity('a5r5-s3'),
      actionName: 'write-file',
      toolName: 'write',
      summary: 'a5r5 S3 guarded ask leg (leader lane)',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
    })
    const requestId = leg.kind === 'leg' ? leg.leg.requestId : '<no-leg>'
    const waiter = service.awaitControlDecision({ rootSessionId: P6T4_ROOT, requestId })
    void waiter.catch(() => undefined)
    const resolve = await race('S3 leader caller', () =>
      service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId,
        decision: 'allow',
        note: 'a5r5 S3 leader allow',
      }),
    )
    return { requestId, resolve, decisions: controlFacts(world, 'control-decision-recorded').length }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ── S4: the legacy (pre-A4) shape + parked waiter, human v4 wire (pr-d C2 mirror) ──
const S4 = await (async () => {
  const world = await createP6T4World('a5r5-s4', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world, { authorityRevalidation: RECHECK.port })
    const dispatch = buildS6OverService(world, service)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'write',
      correlation: 'a5r5-s4',
      summary: 'a5r5 S4 legacy ask request',
    })
    const waiter = service.awaitControlDecision({ rootSessionId: P6T4_ROOT, requestId: request.requestId })
    void waiter.catch(() => undefined)
    const resolve = await race('S4 human v4 wire (legacy shape)', () =>
      dispatch('team.resolveControl', {
        version: REMOTE_CONTRACT_VERSION_V4,
        params: {
          teamSessionId: P6T4_ROOT,
          requestId: request.requestId,
          decision: 'allow',
          note: 'a5r5 S4 human allow',
        },
      }),
    )
    return {
      requestId: request.requestId,
      resolve,
      decisions: controlFacts(world, 'control-decision-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

/** Compact one-line rendering of an outcome for the evidence record. */
function show(o: Outcome): string {
  if (o.kind === 'HANG') return `HANG>${o.ms}ms`
  if (o.kind === 'REJECTED') return `REJECTED ${o.ms}ms ${String((o.error as Error)?.message ?? o.error)}`
  const err = o.response === undefined ? null : errorOf(o.response)
  return `SETTLED ${o.ms}ms${err === null ? '' : ` err=${JSON.stringify(err).slice(0, 220)}`}`
}

// eslint-disable-next-line no-console
console.log(
  [
    `A5R5 S1 (R-5 shape + parked waiter, human v4 wire): ${show(S1.resolve)} decisions=${S1.decisions}`,
    `A5R5 S2 (R-5 shape, NO waiter, human v4 wire):       ${show(S2.resolve)} decisions=${S2.decisions}`,
    `A5R5 S3 (R-5 shape + parked waiter, leader caller):  ${show(S3.resolve)} decisions=${S3.decisions}`,
    `A5R5 S4 (legacy shape + parked waiter, human v4):    ${show(S4.resolve)} decisions=${S4.decisions}`,
  ].join('\n'),
)

describe('a5r5 R-5 assembly-level resolveControl probe', () => {
  it('S1: the R-5 case shape settles over the human v4 wire (no hang)', () => {
    expect(S1.resolve.kind).toBe('SETTLED')
    expect(S1.decisions).toBe(1)
  })
  it('S2: with no parked waiter the human v4 wire settles', () => {
    expect(S2.resolve.kind).toBe('SETTLED')
    expect(S2.decisions).toBe(1)
  })
  it('S3: the leader caller settles on the same shape', () => {
    expect(S3.resolve.kind).toBe('SETTLED')
    expect(S3.decisions).toBe(1)
  })
  it('S4: the legacy shape with a parked waiter settles over the human v4 wire', () => {
    expect(S4.resolve.kind).toBe('SETTLED')
    expect(S4.decisions).toBe(1)
  })
})
