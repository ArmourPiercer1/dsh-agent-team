/**
 * a4p7-a1-14-consumption-revalidation.test.ts — A4-PR7 Task 7.0 (ADR A1-14,
 * spec §12.1's fresh authority recheck at the consumption point, §24.6).
 *
 * THE LAW UNDER TEST: an approval authorizes ONE invocation **under the
 * authority that existed when it was given**. PR4 shipped the pre-check side of
 * that sentence (the adapter re-derives the required rung before it reaches the
 * guard) and disclosed, in its own file header, that the duty at the
 * CONSUMPTION write was unenforced because `ControlOperationScope` carried no
 * operation class and no canonical resource — so `guardOperation()` could not
 * re-run the ceiling evaluator even in principle. This file closes that
 * disclosure. It is written RED-first: every scenario below fails against the
 * tree as it stands, and each one names the property that then holds.
 *
 *  A1  an allow obtained while the ceiling justified it, THEN an authority
 *      rise, then `guardOperation` ⇒ refusal with ZERO `control-allow-consumed`
 *      rows. The allow is not burned: a drift that spent a one-shot would turn
 *      the drift into a second denial nobody voted on. Flip the drift away and
 *      the SAME allow authorizes exactly once;
 *  A2  `undetermined` at the consumption point refuses. "Could not confirm" is
 *      not "confirmed" (ADR A1-7: an unreadable document is never an empty
 *      one), and it also consumes nothing;
 *  A3  the persisted scope is the authorized point. A persisted `exact`
 *      matcher is NOT satisfied by a different resource under the same
 *      `toolName`, and a `fingerprint` matcher is NOT satisfied by a drifted
 *      fingerprint — while every legacy scope field (tool, action,
 *      correlation, fingerprint) still matches, which is exactly the hole;
 *  A4  a v3 operation case whose durable row carries no `authorityScope` is
 *      CORRUPT, not merely unsampled: after the cutover there is no
 *      transitional shape to fall back to, so the consumption refuses;
 *  A5  the recheck is wired where the lock is: it runs INSIDE the per-team
 *      lock, before the consumption write, exactly once per consumption, on the
 *      PERSISTED scope and the leg's recorded review authority — never on
 *      whatever the caller happens to pass the second time;
 *  A6  an allow that is re-confirmed consumes the one-shot, and the replay of
 *      the same scope is still refused as already-consumed (7.0 must not turn
 *      the single-shot into a standing grant).
 *
 * WHAT THIS FILE DOES NOT DO: it does not read the authority documents itself.
 * The service consumes a CLOSED VERDICT port (the plane reads documents; the
 * control lane consumes verdicts — ADR A5-12, one reader per answer), so these
 * scenarios drive the verdict directly and the algebra behind it is pinned by
 * the plane/routing tests.
 *
 * RUNNER CONSTRAINTS: async scenarios run at module level with top-level
 * await; `it` bodies are synchronous (this repo's plain-node shim).
 *
 * SELF-CLEANLINESS: inside the P4-T6 whole-tree scanner's scope; no legacy
 * Team SessionEvent denylist token appears.
 *
 * @module @dsh-agent-team/runtime/test/a4p7-a1-14-consumption-revalidation
 */
import { describe, expect, it } from 'vitest'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_EXECUTION_COUPLINGS,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../control/index.js'
import type {
  ApprovalCaseIdentityInput,
  ControlAuthorityRecheck,
  ControlAuthorityRecheckInput,
  ControlOperationScope,
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const SUBJECT = { kind: 'instance', instanceId: WORKER_ID } as const
const ACTION_NAME = 'team.action.execute'
const TOOL_NAME = 'read'
const FILE_A = 'file:///fileA.txt'
const FILE_B = 'file:///fileB.txt'
const FP_A = 'fp-a4p7-a'
const FP_B = 'fp-a4p7-b'

/** The persisted operation point of the scenarios: class `read` on file A. */
const SCOPE_A = { operationClass: TOOL_NAME, matcher: { kind: 'exact', resource: FILE_A } } as const
/** The same class on a DIFFERENT resource (A3's discriminator). */
const SCOPE_B = { operationClass: TOOL_NAME, matcher: { kind: 'exact', resource: FILE_B } } as const
/** The exec-plane shape: the operation point IS the command fingerprint. */
const SCOPE_FP_A = { operationClass: 'bash', matcher: { kind: 'fingerprint', resource: FP_A } } as const
const SCOPE_FP_B = { operationClass: 'bash', matcher: { kind: 'fingerprint', resource: FP_B } } as const

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface MutableRecheck {
  readonly port: (input: ControlAuthorityRecheckInput) => Promise<ControlAuthorityRecheck>
  readonly calls: ControlAuthorityRecheckInput[]
  set(next: ControlAuthorityRecheck): void
}

/** A verdict port with a memory: `calls` is what pins WHERE the recheck ran. */
function mutableRecheck(initial: ControlAuthorityRecheck): MutableRecheck {
  let current = initial
  const calls: ControlAuthorityRecheckInput[] = []
  return {
    port: async (input) => {
      calls.push(input)
      return current
    },
    calls,
    set: (next) => {
      current = next
    },
  }
}

interface Env {
  readonly world: P6T1World
  readonly service: ControlService
  readonly recheck: MutableRecheck
}

async function createEnv(name: string, recheck: MutableRecheck): Promise<Env> {
  const world = await createP6T4World(name, ['leader', 'worker'])
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    authorityRevalidation: recheck.port,
  })
  return { world, service, recheck }
}

function identityOf(
  correlation: string,
  operationFingerprint: string,
  authorityScope: ControlAuthorityScopeInput,
): ApprovalCaseIdentityInput {
  return {
    subject: SUBJECT,
    beneficiaryAuthority: 'member',
    requestedEffect: 'allow',
    operationFingerprint,
    correlation,
    authorityScope,
  }
}

type ControlAuthorityScopeInput = NonNullable<ApprovalCaseIdentityInput['authorityScope']>

function scopeOf(
  correlation: string,
  operationFingerprint: string,
  authorityScope: ControlAuthorityScopeInput,
): ControlOperationScope {
  return {
    rootSessionId: P6T4_ROOT,
    subject: SUBJECT,
    targetInstanceId: WORKER_ID,
    actionName: ACTION_NAME,
    toolName: TOOL_NAME,
    correlation,
    operationFingerprint,
    authorityScope,
  }
}

/** Open the case and have the Leader allow it, under a `still-sufficient` sky. */
async function grantedAllow(
  env: Env,
  correlation: string,
  operationFingerprint: string,
  authorityScope: ControlAuthorityScopeInput,
): Promise<ControlRequestRecord> {
  const created = await env.service.requestApprovalLeg({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    reviewAuthority: 'leader',
    requiredAuthorityAtCreation: 'leader',
    identity: identityOf(correlation, operationFingerprint, authorityScope),
    actionName: ACTION_NAME,
    toolName: TOOL_NAME,
    executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
  })
  if (created.kind !== 'leg') {
    throw new Error(`the scenario needs an open leg, got '${created.kind}'`)
  }
  await env.service.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: leaderCaller(),
    requestId: created.leg.requestId,
    decision: CONTROL_DECISION_VALUES.ALLOW,
  })
  const state = await env.service.listControlState(P6T4_ROOT)
  const request = state.requests.find((r) => r.requestId === created.leg.requestId)
  if (request === undefined) throw new Error('the allowed leg vanished from the state read')
  return request
}

function consumptionRows(world: P6T1World): number {
  return world.domain.repositories.ledger
    .list()
    .filter(
      (entry) =>
        String(entry.rootSessionId) === P6T4_ROOT && entry.factType === 'control-allow-consumed',
    ).length
}

const COVERED: ControlAuthorityRecheck = { kind: 'still-sufficient' }
const RISEN: ControlAuthorityRecheck = {
  kind: 'authority-risen',
  requiredNow: 'human-user',
  detail: 'the Team Hard envelope now caps this scope below the rung that signed',
}
const UNDETERMINED: ControlAuthorityRecheck = {
  kind: 'undetermined',
  reason: 'ceiling-undetermined',
  detail: 'the bound authority document could not be read',
}

// ---------------------------------------------------------------------------
// A1 — the authority rise between the allow and the consumption.
// ---------------------------------------------------------------------------

const a1 = await (async () => {
  const recheck = mutableRecheck(COVERED)
  const env = await createEnv('a4p7-a1', recheck)
  try {
    const request = await grantedAllow(env, 'corr-a4p7-a1', FP_A, SCOPE_A)
    const callsAfterAllow = recheck.calls.length
    // The drift: the Team narrows the scope AFTER the human's allow was
    // written. The allow remains a true record of what was decided.
    recheck.set(RISEN)
    const refused = await env.service.guardOperation(scopeOf('corr-a4p7-a1', FP_A, SCOPE_A))
    const afterRefusal = consumptionRows(env.world)
    // The drift goes away: the SAME unspent allow must now authorize.
    recheck.set(COVERED)
    const allowed = await env.service.guardOperation(scopeOf('corr-a4p7-a1', FP_A, SCOPE_A))
    const afterAllow = consumptionRows(env.world)
    const replay = await env.service.guardOperation(scopeOf('corr-a4p7-a1', FP_A, SCOPE_A))
    return {
      requestId: request.requestId,
      callsAfterAllow,
      refused,
      afterRefusal,
      allowed,
      afterAllow,
      replay,
      finalRows: consumptionRows(env.world),
      calls: recheck.calls.map((c) => ({
        reviewAuthority: c.reviewAuthority,
        beneficiaryAuthority: c.beneficiaryAuthority,
        requestedEffect: c.requestedEffect,
        operationClass: c.authorityScope.operationClass,
        matcherKind: c.authorityScope.matcher.kind,
        resource: c.authorityScope.matcher.resource,
        instanceId: c.instanceId,
      })),
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// A2 — `undetermined` at the consumption point.
// ---------------------------------------------------------------------------

const a2 = await (async () => {
  const recheck = mutableRecheck(COVERED)
  const env = await createEnv('a4p7-a2', recheck)
  try {
    await grantedAllow(env, 'corr-a4p7-a2', FP_A, SCOPE_A)
    recheck.set(UNDETERMINED)
    const refused = await env.service.guardOperation(scopeOf('corr-a4p7-a2', FP_A, SCOPE_A))
    return { refused, rows: consumptionRows(env.world) }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// A3 — the persisted point is the authorized point.
// ---------------------------------------------------------------------------

const a3 = await (async () => {
  const recheck = mutableRecheck(COVERED)
  const env = await createEnv('a4p7-a3', recheck)
  try {
    await grantedAllow(env, 'corr-a4p7-a3-exact', FP_A, SCOPE_A)
    await grantedAllow(env, 'corr-a4p7-a3-fp', FP_A, SCOPE_FP_A)
    // Same toolName, same action, same correlation, same operationFingerprint:
    // only the AUTHORITY point moved.
    const otherResource = await env.service.guardOperation(scopeOf('corr-a4p7-a3-exact', FP_A, SCOPE_B))
    // A fingerprint-shaped point with a drifted fingerprint.
    const driftedFingerprint = await env.service.guardOperation(
      scopeOf('corr-a4p7-a3-fp', FP_A, SCOPE_FP_B),
    )
    // The matcher KIND is part of the point too: an exact-only grant is not a
    // fingerprint grant even when the resource string is the same value.
    const driftedKind = await env.service.guardOperation({
      ...scopeOf('corr-a4p7-a3-exact', FP_A, SCOPE_A),
      authorityScope: { operationClass: TOOL_NAME, matcher: { kind: 'fingerprint', resource: FILE_A } },
    })
    return {
      otherResource,
      driftedFingerprint,
      driftedKind,
      rows: consumptionRows(env.world),
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// A4 — a v3 operation case row with no persisted authorityScope.
// ---------------------------------------------------------------------------

const a4 = await (async () => {
  const recheck = mutableRecheck(COVERED)
  const env = await createEnv('a4p7-a4', recheck)
  try {
    // The DURABLE shape, written by hand: a leg row that names a case and
    // carries an operation fingerprint but no `authorityScope`. Post-cutover
    // the service will not WRITE such a row — which is exactly why the read
    // side has to be constructed here rather than asked for.
    const created = await env.service.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: {
        subject: SUBJECT,
        beneficiaryAuthority: 'member',
        requestedEffect: 'allow',
        operationFingerprint: FP_A,
        correlation: 'corr-a4p7-a4',
      },
      actionName: ACTION_NAME,
      toolName: TOOL_NAME,
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
    })
    const written = created.kind === 'leg'
    if (!written || created.kind !== 'leg') {
      return { written, refused: null, rows: 0, recheckCalls: recheck.calls.length }
    }
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: created.leg.requestId,
      decision: CONTROL_DECISION_VALUES.ALLOW,
    })
    const scope = scopeOf('corr-a4p7-a4', FP_A, SCOPE_A)
    const refused = await env.service.guardOperation(scope)
    return {
      written,
      refused,
      rows: consumptionRows(env.world),
      recheckCalls: recheck.calls.length,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// A5/A6 — a re-confirmed allow consumes exactly once.
// ---------------------------------------------------------------------------

const a5 = await (async () => {
  const recheck = mutableRecheck(COVERED)
  const env = await createEnv('a4p7-a5', recheck)
  try {
    await grantedAllow(env, 'corr-a4p7-a5', FP_A, SCOPE_A)
    const callsAfterAllow = recheck.calls.length
    const first = await env.service.guardOperation(scopeOf('corr-a4p7-a5', FP_A, SCOPE_A))
    const callsAfterFirst = recheck.calls.length
    const second = await env.service.guardOperation(scopeOf('corr-a4p7-a5', FP_A, SCOPE_A))
    return {
      callsAfterAllow,
      first,
      callsAfterFirst,
      second,
      rows: consumptionRows(env.world),
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('A1-14 — the consumption point re-runs the ceiling for the persisted scope', () => {
  it('A1: an authority rise after the allow refuses with ZERO consumption, and the unspent allow still authorizes once', () => {
    expect(a1.refused).toEqual({
      allowed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_RISEN,
      requestId: a1.requestId,
    })
    expect(a1.afterRefusal).toBe(0)
    expect(a1.allowed.allowed).toBe(true)
    expect(a1.afterAllow).toBe(1)
    expect(a1.replay).toMatchObject({ allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED })
    expect(a1.finalRows).toBe(1)
    // The recheck is a CONSUMPTION-point duty: it runs at the guard, not at
    // the decision, and it is handed the PERSISTED point and the leg's rung.
    expect(a1.callsAfterAllow).toBe(0)
    expect(a1.calls).toEqual([
      {
        reviewAuthority: 'leader',
        beneficiaryAuthority: 'member',
        requestedEffect: 'allow',
        operationClass: TOOL_NAME,
        matcherKind: 'exact',
        resource: FILE_A,
        instanceId: WORKER_ID,
      },
      {
        reviewAuthority: 'leader',
        beneficiaryAuthority: 'member',
        requestedEffect: 'allow',
        operationClass: TOOL_NAME,
        matcherKind: 'exact',
        resource: FILE_A,
        instanceId: WORKER_ID,
      },
    ])
  })

  it('A2: an undetermined fresh ceiling refuses and consumes nothing', () => {
    expect(a2.refused).toMatchObject({
      allowed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED,
    })
    expect(a2.rows).toBe(0)
  })

  it('A3: the persisted authority point is the authorized point', () => {
    expect(a3.otherResource).toMatchObject({
      allowed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH,
    })
    expect(a3.driftedFingerprint).toMatchObject({
      allowed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH,
    })
    expect(a3.driftedKind).toMatchObject({
      allowed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH,
    })
    expect(a3.rows).toBe(0)
  })

  it('A4: a v3 operation case with no persisted authorityScope is corrupt, not unsampled', () => {
    expect(a4.written).toBe(false)
    expect(a4.refused).toBeNull()
    expect(a4.rows).toBe(0)
    expect(a4.recheckCalls).toBe(0)
  })

  it('A5/A6: a re-confirmed allow runs the recheck once and consumes exactly once', () => {
    expect(a5.callsAfterAllow).toBe(0)
    expect(a5.first.allowed).toBe(true)
    expect(a5.callsAfterFirst).toBe(1)
    expect(a5.second).toMatchObject({ allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED })
    expect(a5.rows).toBe(1)
  })
})
