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
 * THE HARNESS HAS TWO HALVES, AND BOTH ARE PROVED. A1-A6 drive a CLOSED VERDICT
 * port whose verdict the scenario dictates: that isolates the control lane (the
 * service must refuse, consume nothing, and run the check inside the lock, no
 * matter WHICH document produced the verdict). The P group then drives the real
 * production port — `createControlAuthorityRevalidation`, the function the
 * composition actually injects — over authority DOCUMENTS, so the end-to-end
 * ADR A1-14 claim ("an allow signed under a ceiling that has since risen cannot
 * be spent") is proved by the wiring, not by a stub of it. The algebra in
 * between is pinned by `a4p4-operation-approval-authority.test.ts`.
 *
 * WHAT THIS FILE DOES NOT DO: it does not re-derive the ladder walk, and it
 * never mints an authority answer of its own.
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
  CONTROL_AUTHORITY_RECHECK_KINDS,
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
  ControlAuthorityRecheckPort,
  ControlOperationScope,
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
// The production consumption-point port (the composition's wiring, not a stub).
import { createControlAuthorityRevalidation } from '../src/plugin/permission-plane.js'
import type { OperationApprovalFacts, OperationApprovalFactsReader } from '../operation-permission/index.js'
import type { AuthorityEnvelope } from '../../domain/authority-envelope/src/index.js'
import type { AuthorityEnvelopeDocuments } from '../governance/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  memberCaller,
  writeRawControlFact,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)
/** The hand-written row's id (A4): the guard echoes the ROW's id, so the
 *  assertion below can only pass if the refusal came from that row. */
const RAW_REQUEST_ID = 'ctrl-a4p7-a4-unbound-row'
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

/**
 * The operation lane's `toolName` is a lane name, not an authority identity
 * (`authorityPointOf` persists `operationClass` + the tool-level exact key), so
 * the scenarios pass it explicitly: the file class drives `read`, the shell
 * class drives `bash`, which is the class whose ceiling narrowing exists only at
 * `fingerprint` shape.
 */
function scopeOf(
  correlation: string,
  operationFingerprint: string,
  authorityScope: ControlAuthorityScopeInput,
  toolName: string = TOOL_NAME,
): ControlOperationScope {
  return {
    rootSessionId: P6T4_ROOT,
    subject: SUBJECT,
    targetInstanceId: WORKER_ID,
    actionName: ACTION_NAME,
    toolName,
    correlation,
    operationFingerprint,
    authorityScope,
  }
}

/** Open the case and have the Leader allow it, under a `still-sufficient` sky. */
async function grantedAllow(
  env: { readonly service: ControlService },
  correlation: string,
  operationFingerprint: string,
  authorityScope: ControlAuthorityScopeInput,
  toolName: string = TOOL_NAME,
): Promise<ControlRequestRecord> {
  const created = await env.service.requestApprovalLeg({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    reviewAuthority: 'leader',
    requiredAuthorityAtCreation: 'leader',
    identity: identityOf(correlation, operationFingerprint, authorityScope),
    actionName: ACTION_NAME,
    toolName,
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
    // (i) THE WRITE REFUSES. Post-cutover the service will not produce an
    // operation case without an authority point at all.
    let writeProblem = 'no refusal'
    try {
      await env.service.requestApprovalLeg({
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
    } catch (error) {
      writeProblem = error instanceof Error ? error.message : String(error)
    }
    const rowsAfterRefusedWrite = env.world.domain.repositories.ledger
      .list()
      .filter((entry) => String(entry.factType).startsWith('control-')).length
    // (ii) THE DURABLE SHAPE STILL HAS TO BE READABLE-BY-READ, WRONG-BY-GUARD.
    // An old home can hold the row the old write produced; the guard is the one
    // place where being wrong means executing, so the refusal lives there. The
    // rows are written by hand because the service now refuses to write them.
    const requestSequence = await writeRawControlFact(env.world, 'control-request-recorded', {
      requestId: RAW_REQUEST_ID,
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
      subject: SUBJECT,
      targetInstanceId: WORKER_ID,
      actionName: ACTION_NAME,
      toolName: TOOL_NAME,
      correlation: 'corr-a4p7-a4-durable',
      operationFingerprint: FP_A,
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
      approvalCaseId: 'case-a4p7-a4-unbound',
      legOrdinal: 1,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      beneficiaryAuthority: 'member',
      requestedEffect: 'allow',
      // …and NO `authorityScope`: the corrupt shape under test.
    })
    await writeRawControlFact(env.world, 'control-decision-recorded', {
      requestId: RAW_REQUEST_ID,
      decision: CONTROL_DECISION_VALUES.ALLOW,
      decider: { kind: 'instance', instanceId: LEADER_ID, role: 'leader' },
      requestSequence,
      scope: {
        rootSessionId: P6T4_ROOT,
        subject: SUBJECT,
        targetInstanceId: WORKER_ID,
        actionName: ACTION_NAME,
        toolName: TOOL_NAME,
        correlation: 'corr-a4p7-a4-durable',
        operationFingerprint: FP_A,
      },
    })
    const unbound = await env.service.guardOperation({
      rootSessionId: P6T4_ROOT,
      subject: SUBJECT,
      targetInstanceId: WORKER_ID,
      actionName: ACTION_NAME,
      toolName: TOOL_NAME,
      correlation: 'corr-a4p7-a4-durable',
      operationFingerprint: FP_A,
    })
    // The case read says the same thing the guard says, in its own vocabulary.
    const caseRead = await env.service.readApprovalCaseState({
      rootSessionId: P6T4_ROOT,
      approvalCaseId: 'case-a4p7-a4-unbound',
    })
    return {
      writeProblem,
      rowsAfterRefusedWrite,
      unbound,
      caseReadKind: caseRead.kind,
      caseReadProblem: caseRead.kind === 'problem' ? caseRead.problem : 'none',
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
      decisionSequence: 2,
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

  it('A4: an operation case with no authority point is refused at the write AND un consumable from disk', () => {
    // (i) the write: a typed refusal, zero rows.
    expect(a4.writeProblem).toContain('authority-scope-required')
    expect(a4.rowsAfterRefusedWrite).toBe(0)
    // (ii) the durable shape an older home can still hold: the guard refuses it
    // by NAME (never `no-request`, which the tool layer reads as "proceed"),
    // the case read files it as corrupt, and nothing is consumed.
    expect(a4.unbound).toEqual({
      allowed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_SCOPE_UNBOUND,
      requestId: RAW_REQUEST_ID,
      decisionSequence: 2,
    })
    expect(a4.caseReadKind).toBe('problem')
    expect(a4.caseReadProblem).toBe('identity-disagreement')
    expect(a4.rows).toBe(0)
    // The recheck port is never consulted for a row with no point: there is
    // nothing to evaluate, and a port call would imply an answer was possible.
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

// ---------------------------------------------------------------------------
// The P group — the PRODUCTION port, over real authority documents.
//
// A1-A6 prove the control lane honours whatever verdict it is handed. That is
// necessary and not sufficient: the composition injects ONE specific function
// (`createControlAuthorityRevalidation` in `src/plugin/permission-plane.ts`),
// and a lane that obeys a verdict is worthless if the function handed to it
// always says "covered". So the P group wires THAT function over documents and
// proves the three things only the wiring can prove:
//
//  P1  the port says `still-sufficient` for documents that still justify the
//      sign-off, and the operation runs — the port has no permissive default,
//      but it is not a blanket refusal either;
//  P2  the same allow, with the narrowing MOVED from the Leader's own document
//      into the Human User's hard document, is a RISE: the guard refuses by name
//      and consumes nothing, and moving it back spends the ORIGINAL allow
//      exactly once. This is ADR A1-14's sentence end to end, documents to
//      durable ledger, with no verdict typed in by the test;
//  P3  no v3 documents at all (`undefined`) is `undetermined` — the reader's
//      "the plane had nothing to say" never becomes "authority is fine";
//  P4  a reader that THROWS is `undetermined` too, and the throw never escapes
//      the guard as a generic failure;
//  P5  the port's own input law: it asks the reader the question the DURABLE ROW
//      poses (`actingAsLeader` comes from the row's beneficiary, never from a
//      re-read keyboard role), it refuses a question it cannot answer BEFORE
//      reading anything, and it reports a beneficiary that disagrees with the
//      row as a wiring defect rather than an authority answer.
// ---------------------------------------------------------------------------

/** A declared document that narrows one operation class + resource to `ask`. */
function cappedAtAsk(operationClass: string, resource: string): AuthorityEnvelope {
  return {
    rules: [{ operationClass, matcher: { kind: 'exact', resource }, maximumEffect: 'ask' }],
  }
}

/**
 * The sky under which the persisted point (`read` on file A) is STILL covered by
 * a Leader signature: real v3 documents, real rules — and none of them touches
 * this point (the cap sits on file B). The operation-approval plane reads an
 * absent rule as NO narrowing, so the required rung for file A is the
 * beneficiary's own, and a Leader signature covers it with room to spare. The
 * narrowing being REMOVED is the ceiling going DOWN, which can never strand an
 * approval: an allow signed at a rung that is now strictly above what the point
 * requires spends its one-shot and runs.
 */
const UNNARROWED: AuthorityEnvelopeDocuments = {
  teamHardEnvelope: { status: 'absent' },
  permissionMutationEnvelope: { status: 'declared', document: cappedAtAsk(TOOL_NAME, FILE_B) },
}

/**
 * The drift: the Leader's OWN ceiling document now caps THIS point at `ask`. The
 * Leader cannot lift a ceiling it set — the ladder walks past it (pinned in
 * `a4p4-operation-approval-authority.test.ts` as `roseBecauseInsufficient:
 * ['leader']`) — so the rung that can now sign is the Human User: strictly above
 * the `leader` rung the leg was signed at.
 */
const CAPPED_BY_LEADER_DOC: AuthorityEnvelopeDocuments = {
  teamHardEnvelope: { status: 'absent' },
  permissionMutationEnvelope: { status: 'declared', document: cappedAtAsk(TOOL_NAME, FILE_A) },
}

const MEMBER_FACTS: OperationApprovalFacts = {
  beneficiaryAuthority: 'member',
  documents: UNNARROWED,
}

interface FactsHarness {
  readonly port: ControlAuthorityRecheckPort
  readonly reads: Parameters<OperationApprovalFactsReader>[0][]
  set(next: OperationApprovalFacts | undefined): void
  failWith(message: string): void
}

/** The production port over a facts reader the scenario controls. */
function planeRecheck(initial: OperationApprovalFacts | undefined): FactsHarness {
  let current = initial
  let failure: string | undefined
  const reads: Parameters<OperationApprovalFactsReader>[0][] = []
  const reader: OperationApprovalFactsReader = async (input) => {
    reads.push(input)
    if (failure !== undefined) throw new Error(failure)
    return current
  }
  return {
    port: createControlAuthorityRevalidation({ operationApprovalFacts: reader }),
    reads,
    set: (next) => {
      failure = undefined
      current = next
    },
    failWith: (message) => {
      failure = message
    },
  }
}

async function createPlaneEnv(name: string): Promise<{
  readonly world: P6T1World
  readonly service: ControlService
  readonly facts: FactsHarness
}> {
  const world = await createP6T4World(name, ['leader', 'worker'])
  const facts = planeRecheck(MEMBER_FACTS)
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    authorityRevalidation: facts.port,
  })
  return { world, service, facts }
}

const RECHECK_INPUT: ControlAuthorityRecheckInput = {
  rootSessionId: P6T4_ROOT,
  instanceId: WORKER_ID,
  beneficiaryAuthority: 'member',
  reviewAuthority: 'leader',
  requestedEffect: 'allow',
  authorityScope: SCOPE_A,
}

const p1 = await (async () => {
  const env = await createPlaneEnv('a4p7-p1')
  try {
    await grantedAllow(env, 'corr-a4p7-p1', FP_A, SCOPE_A)
    const readsAtGrant = env.facts.reads.length
    const verdict = await env.service.guardOperation(scopeOf('corr-a4p7-p1', FP_A, SCOPE_A))
    const rows = (await env.service.listControlState(P6T4_ROOT)).consumptions.length
    return { readsAtGrant, verdict, rows, read: env.facts.reads[0] }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

const p2 = await (async () => {
  const env = await createPlaneEnv('a4p7-p2')
  try {
    await grantedAllow(env, 'corr-a4p7-p2', FP_A, SCOPE_A)
    // The drift is a DOCUMENT change, not a verdict change.
    env.facts.set({ beneficiaryAuthority: 'member', documents: CAPPED_BY_LEADER_DOC })
    const risen = await env.service.guardOperation(scopeOf('corr-a4p7-p2', FP_A, SCOPE_A))
    const rowsAfterRise = (await env.service.listControlState(P6T4_ROOT)).consumptions.length
    // And the drift reverses: the ORIGINAL allow was never spent by the refusal.
    env.facts.set(MEMBER_FACTS)
    const restored = await env.service.guardOperation(scopeOf('corr-a4p7-p2', FP_A, SCOPE_A))
    const rowsAfterRestore = (await env.service.listControlState(P6T4_ROOT)).consumptions.length
    return { risen, rowsAfterRise, restored, rowsAfterRestore }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

const p3 = await (async () => {
  const env = await createPlaneEnv('a4p7-p3')
  try {
    await grantedAllow(env, 'corr-a4p7-p3', FP_A, SCOPE_A)
    env.facts.set(undefined)
    const verdict = await env.service.guardOperation(scopeOf('corr-a4p7-p3', FP_A, SCOPE_A))
    const rows = (await env.service.listControlState(P6T4_ROOT)).consumptions.length
    return { verdict, rows }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

const p4 = await (async () => {
  const env = await createPlaneEnv('a4p7-p4')
  try {
    await grantedAllow(env, 'corr-a4p7-p4', FP_A, SCOPE_A)
    env.facts.failWith('the authority document store is on fire')
    let thrown = 'did-not-throw'
    let verdict: unknown
    try {
      verdict = await env.service.guardOperation(scopeOf('corr-a4p7-p4', FP_A, SCOPE_A))
    } catch (error: unknown) {
      thrown = error instanceof Error ? error.message : String(error)
    }
    const rows = (await env.service.listControlState(P6T4_ROOT)).consumptions.length
    return { thrown, verdict, rows }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

const p5 = await (async () => {
  // (a) a row asking for an effect this recheck cannot answer: refused BEFORE
  // any document is read, because the refusal is about the question.
  const harness = planeRecheck(MEMBER_FACTS)
  const askVerdict = await harness.port({ ...RECHECK_INPUT, requestedEffect: 'ask' })
  const readsAfterAsk = harness.reads.length
  // (b) `actingAsLeader` comes from the ROW's beneficiary.
  await harness.port({ ...RECHECK_INPUT, beneficiaryAuthority: 'leader' })
  const leaderRead = harness.reads[harness.reads.length - 1]
  // (c) facts whose beneficiary disagrees with the row are a WIRING defect, and
  // the closed diagnosis is `undetermined` — never a coverage answer.
  const mismatched = planeRecheck({ beneficiaryAuthority: 'leader', documents: UNNARROWED })
  const mismatchVerdict = await mismatched.port(RECHECK_INPUT)
  // (d) the two coverage verdicts, with the diagnostic the plane owns.
  const covered = await planeRecheck(MEMBER_FACTS).port(RECHECK_INPUT)
  const risen = await planeRecheck({
    beneficiaryAuthority: 'member',
    documents: CAPPED_BY_LEADER_DOC,
  }).port(RECHECK_INPUT)
  // (e) a document that could not be READ is not an empty one.
  const unavailable = await planeRecheck({
    beneficiaryAuthority: 'member',
    documents: {
      teamHardEnvelope: { status: 'unavailable' },
      permissionMutationEnvelope: { status: 'absent' },
    },
  }).port(RECHECK_INPUT)
  return { askVerdict, readsAfterAsk, leaderRead, mismatchVerdict, covered, risen, unavailable }
})()

describe('A4-PR7 7.0 P group — the production revalidation port over documents', () => {
  it('P1: fresh documents that no longer narrow the point permit the consumption', () => {
    // The recheck is not consulted at the request or the decision: it is a
    // property of the CONSUMPTION write and nothing else.
    expect(p1.readsAtGrant).toBe(0)
    expect(p1.verdict).toMatchObject({ allowed: true })
    expect(p1.rows).toBe(1)
    expect(p1.read).toEqual({
      teamSessionId: P6T4_ROOT,
      memberInstanceId: WORKER_ID,
      actingAsLeader: false,
    })
  })

  it('P2: a narrowing that moved UP the ladder strands the allow, and costs nothing', () => {
    expect(p2.risen).toMatchObject({
      allowed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_RISEN,
    })
    expect(p2.rowsAfterRise).toBe(0)
    expect(p2.restored.allowed).toBe(true)
    expect(p2.rowsAfterRestore).toBe(1)
  })

  it('P3: no v3 documents is `undetermined`, never "covered"', () => {
    expect(p3.verdict).toMatchObject({
      allowed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED,
    })
    expect(p3.rows).toBe(0)
  })

  it('P4: a reader that throws refuses by name; no fault escapes as a generic failure', () => {
    expect(p4.thrown).toBe('did-not-throw')
    expect(p4.verdict).toMatchObject({
      allowed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED,
    })
    expect(p4.rows).toBe(0)
  })

  it('P5: the port asks the durable row\'s question and refuses unanswerable ones', () => {
    expect(p5.askVerdict).toMatchObject({
      kind: CONTROL_AUTHORITY_RECHECK_KINDS.UNDETERMINED,
      reason: 'requested-effect-not-answerable',
    })
    expect(p5.readsAfterAsk).toBe(0)
    expect(p5.leaderRead?.actingAsLeader).toBe(true)
    expect(p5.mismatchVerdict).toMatchObject({
      kind: CONTROL_AUTHORITY_RECHECK_KINDS.UNDETERMINED,
      reason: 'authority-facts-malformed',
    })
    expect(p5.covered).toEqual({ kind: CONTROL_AUTHORITY_RECHECK_KINDS.STILL_SUFFICIENT })
    expect(p5.risen).toMatchObject({
      kind: CONTROL_AUTHORITY_RECHECK_KINDS.AUTHORITY_RISEN,
      requiredNow: 'human-user',
    })
    const risenDetail = String((p5.risen as { detail?: unknown }).detail ?? '')
    expect(risenDetail).toContain('human-user')
    expect(risenDetail).toContain('leader')
    expect(p5.unavailable).toMatchObject({
      kind: CONTROL_AUTHORITY_RECHECK_KINDS.UNDETERMINED,
      reason: 'authority-document-unavailable',
    })
  })
})

// ---------------------------------------------------------------------------
// The S group — the SHELL class at the production seam (RULING 4, threaded).
//
// Every scenario above this line is FILE-class, and that is precisely why it
// could not see the defect this group exists to see. A file-class scope's
// persisted point (`read` on `file:///fileA.txt`) is a shape the documents can
// answer directly, so the recheck derives the same answer whether or not the
// row's command fingerprint travels with it. A SHELL-class scope is different
// in kind, not in degree:
//
//   * `authorityPointOf` persists the TOOL-level exact key
//     (`operation-permission/pre-execute-adapter.ts:821`), so a shell row's
//     point is `bash` on `bash:tool`;
//   * a shell-class narrowing can only be declared at `fingerprint` shape
//     (`packages/domain/blueprint/src/validate.ts:699`);
//   * coverage between those two shapes is a DECISIVE `{covers:false}`
//     (`packages/domain/authority-envelope/src/authority-envelope.ts:218-222`),
//     not an absorbing `undetermined`.
//
// So a shell recheck that asks only the persisted point is not "the narrower
// question" — it is a question no rule can answer, which the meet then reports
// as the ladder default. The whole class the candidate-set ruling was written
// for would have had a consumption recheck that can never answer `stale`. The
// only thing standing between that and a merged tree is one line at
// `control/service.ts` passing the row's `operationFingerprint` into the port,
// and this group is the test that line is checked against: S1/S2 drive the
// PRODUCTION port through `guardOperation` with a shell row, and S3/S4 pin the
// seam itself so a refusal here can only be attributed to the wiring.
//
// WHY `guardOperation` AND NOT JUST THE PORT: the ruling's demand was a
// PRODUCTION-SEAM test. The port alone proves the plane can compute a verdict;
// only the guard proves the verdict is obeyed where the one-shot is spent, and
// that a refusal costs nothing.
// ---------------------------------------------------------------------------

/** The shell lane's `toolName`, and the tool-level key it persists. */
const SHELL_TOOL = 'bash'
const SHELL_TOOL_KEY = 'bash:tool'

/** VERBATIM what `authorityPointOf` persists for a shell operation: the
 *  tool-level EXACT key. Not a fixture invention — the production shape. */
const SHELL_POINT = {
  operationClass: SHELL_TOOL,
  matcher: { kind: 'exact', resource: SHELL_TOOL_KEY },
} as const

/** The same class and command persisted in the other shape, for contrast. */
const SHELL_POINT_FP = {
  operationClass: SHELL_TOOL,
  matcher: { kind: 'fingerprint', resource: FP_A },
} as const

/** A Leader-declared ceiling capping ONE COMMAND (fingerprint shape, the only
 *  shape a shell-class rule may take) at `ask`. */
function commandCappedAtAsk(operationClass: string, fingerprint: string): AuthorityEnvelope {
  return {
    rules: [{ operationClass, matcher: { kind: 'fingerprint', resource: fingerprint }, maximumEffect: 'ask' }],
  }
}

/** The rise: the command this row IS gets narrowed after the allow was signed. */
const SHELL_COMMAND_CAPPED: AuthorityEnvelopeDocuments = {
  teamHardEnvelope: { status: 'absent' },
  permissionMutationEnvelope: {
    status: 'declared',
    document: commandCappedAtAsk(SHELL_TOOL, FP_A),
  },
}

/** No rise: the same document shape, capping a DIFFERENT command. The rung this
 *  row needs is the beneficiary's own, which the Leader signature covers. */
const SHELL_OTHER_COMMAND_CAPPED: AuthorityEnvelopeDocuments = {
  teamHardEnvelope: { status: 'absent' },
  permissionMutationEnvelope: {
    status: 'declared',
    document: commandCappedAtAsk(SHELL_TOOL, FP_B),
  },
}

const SHELL_FACTS: OperationApprovalFacts = {
  beneficiaryAuthority: 'member',
  documents: SHELL_OTHER_COMMAND_CAPPED,
}

interface ShellEnv {
  readonly world: P6T1World
  readonly service: ControlService
  readonly facts: FactsHarness
  /** Every input the PRODUCTION port was handed, in order. */
  readonly inputs: ControlAuthorityRecheckInput[]
}

/** The composition's own wiring: the production port, over documents the
 *  scenario owns, recorded so the seam itself is observable. */
async function createShellEnv(name: string, initial: OperationApprovalFacts): Promise<ShellEnv> {
  const world = await createP6T4World(name, ['leader', 'worker'])
  const facts = planeRecheck(initial)
  const inputs: ControlAuthorityRecheckInput[] = []
  const port: ControlAuthorityRecheckPort = async (input) => {
    inputs.push(input)
    return facts.port(input)
  }
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    authorityRevalidation: port,
  })
  return { world, service, facts, inputs }
}

const SHELL_RECHECK_INPUT: ControlAuthorityRecheckInput = {
  rootSessionId: P6T4_ROOT,
  instanceId: WORKER_ID,
  beneficiaryAuthority: 'member',
  reviewAuthority: 'leader',
  requestedEffect: 'allow',
  authorityScope: SHELL_POINT,
}

const s1 = await (async () => {
  const env = await createShellEnv('a4p7-s1', {
    beneficiaryAuthority: 'member',
    documents: SHELL_COMMAND_CAPPED,
  })
  try {
    await grantedAllow(env, 'corr-a4p7-s1', FP_A, SHELL_POINT, SHELL_TOOL)
    const callsAtGrant = env.inputs.length
    const refused = await env.service.guardOperation(
      scopeOf('corr-a4p7-s1', FP_A, SHELL_POINT, SHELL_TOOL),
    )
    const rowsAfterRefusal = consumptionRows(env.world)
    // Reverse the drift. A refusal that spent the one-shot would strand the
    // operation with no approval left and nobody to ask again.
    env.facts.set(SHELL_FACTS)
    const restored = await env.service.guardOperation(
      scopeOf('corr-a4p7-s1', FP_A, SHELL_POINT, SHELL_TOOL),
    )
    const rowsAfterRestore = consumptionRows(env.world)
    return {
      callsAtGrant,
      refused,
      rowsAfterRefusal,
      restored,
      rowsAfterRestore,
      input: env.inputs[0],
      inputKeys: env.inputs[0] === undefined ? [] : Object.keys(env.inputs[0]).sort(),
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

const s2 = await (async () => {
  const env = await createShellEnv('a4p7-s2', SHELL_FACTS)
  try {
    await grantedAllow(env, 'corr-a4p7-s2', FP_A, SHELL_POINT, SHELL_TOOL)
    const verdict = await env.service.guardOperation(
      scopeOf('corr-a4p7-s2', FP_A, SHELL_POINT, SHELL_TOOL),
    )
    const rows = consumptionRows(env.world)
    return { verdict, rows, calls: env.inputs.length, input: env.inputs[0] }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

const s3 = await (async () => {
  // Same row, same documents, one difference: whether the command identity
  // travelled with it. This isolates the mechanism from everything else in the
  // lane, and it is the measurement that makes S1's refusal unambiguous.
  const threaded = await planeRecheck({
    beneficiaryAuthority: 'member',
    documents: SHELL_COMMAND_CAPPED,
  }).port({ ...SHELL_RECHECK_INPUT, commandFingerprint: FP_A })
  const notThreaded = await planeRecheck({
    beneficiaryAuthority: 'member',
    documents: SHELL_COMMAND_CAPPED,
  }).port(SHELL_RECHECK_INPUT)
  // The point that already names its command needs no threading to answer
  // honestly — which is the control showing the gap is about the MISSING
  // candidate, not about shell rules being unreadable in principle.
  const fingerprintPoint = await planeRecheck({
    beneficiaryAuthority: 'member',
    documents: SHELL_COMMAND_CAPPED,
  }).port({ ...SHELL_RECHECK_INPUT, authorityScope: SHELL_POINT_FP })
  return { threaded, notThreaded, fingerprintPoint }
})()

describe('A4-PR7 7.0 S group — the shell class at the production seam (RULING 4, threaded)', () => {
  it('S1: a shell command narrowed AFTER the allow refuses as `authority-risen` and consumes nothing', () => {
    if (s1.refused.allowed !== false) {
      throw new Error(
        `a shell-class rise must refuse; got ${JSON.stringify(s1.refused)} — ` +
          'the row\'s command fingerprint almost certainly stopped reaching the port',
      )
    }
    expect(s1.refused.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_RISEN)
    expect(s1.rowsAfterRefusal).toBe(0)
    // The refusal is a refusal, not a burn: the same allow spends once when the
    // narrowing goes away, so nothing about the fix turns a drift into a
    // second denial nobody voted on.
    if (s1.restored.allowed !== true) {
      throw new Error(`the unspent allow must still authorize; got ${JSON.stringify(s1.restored)}`)
    }
    expect(s1.rowsAfterRestore).toBe(1)
    // A consumption-point duty: not consulted at the request or the decision.
    expect(s1.callsAtGrant).toBe(0)
  })

  it('S2: the same shell row with no narrowing on ITS command consumes once (`still-sufficient`)', () => {
    // The negative control. Without it, S1 would be satisfied by a guard that
    // refuses every shell operation, which is a different bug in the same
    // costume: the recheck has no permissive default AND no blanket refusal.
    if (s2.verdict.allowed !== true) {
      throw new Error(`documents that do not narrow this command must permit; got ${JSON.stringify(s2.verdict)}`)
    }
    expect(s2.rows).toBe(1)
    expect(s2.calls).toBe(1)
  })

  it('S3: the seam itself — THREADED answers `authority-risen`; a row that does not travel with its command is a NAMED REFUSAL, never coverage', () => {
    // The delta RULING 4 exists for, as data. Before the fix this call answered
    // `still-sufficient`: with no fingerprint the candidate set was the
    // persisted tool-level point ALONE, which no shell rule can cover
    // (`authority-envelope.ts:218-222`), so the meet reported the ladder default
    // and a rise on the command read as coverage — a false pass on the same row
    // under the same documents. Two changes close it and both are asserted here:
    // the field is threaded (S4), and a refusal is TERMINAL in the recheck, so
    // "cannot name the command" is now an `undetermined` naming the wiring fault
    // instead of an answer computed from a shape no author ever wrote.
    expect(s3.threaded).toMatchObject({
      kind: CONTROL_AUTHORITY_RECHECK_KINDS.AUTHORITY_RISEN,
      requiredNow: 'human-user',
    })
    expect(s3.notThreaded).toMatchObject({
      kind: CONTROL_AUTHORITY_RECHECK_KINDS.UNDETERMINED,
      reason: 'shell-point-missing',
    })
    // Control: a persisted point that already names the command answers
    // honestly with no threading at all, so the delta above is the missing
    // candidate and not a shell rule being unreadable.
    expect(s3.fingerprintPoint).toMatchObject({
      kind: CONTROL_AUTHORITY_RECHECK_KINDS.AUTHORITY_RISEN,
      requiredNow: 'human-user',
    })
  })

  it('S4: the guard hands the port the ROW\'s command fingerprint, not a re-derived one', () => {
    // Wiring, asserted rather than assumed. The two behavioural scenarios above
    // fail if this stops holding; this one says WHICH line broke.
    for (const [name, input] of [
      ['S1', s1.input] as const,
      ['S2', s2.input] as const,
    ]) {
      if (input === undefined) throw new Error(`${name}: the recheck never ran`)
      expect(input.commandFingerprint, `${name}: the row's operationFingerprint must be threaded`).toBe(FP_A)
      // And it is the DURABLE point that travels, kind included: the tool-level
      // exact key the ASK persisted, not the invocation now arriving.
      expect(input.authorityScope).toEqual(SHELL_POINT)
      expect(input.reviewAuthority).toBe('leader')
      expect(input.beneficiaryAuthority).toBe('member')
    }
  })
})
