/**
 * a4a-control-exact-scope.test.ts — A4 (alpha.2): EXACT-fingerprint
 * scope + the SYNCHRONOUS awaitControlDecision wait bridge over the
 * EXISTING durable control plane (plan §9 — extend, do not rebuild).
 *
 * Acceptance mapping (plan §9.7 DoD items):
 *  - C1 (exact scope): the optional `operationFingerprint` participates
 *    in the scope's IDENTITY — two scopes identical except for the
 *    fingerprint are different scopes (different idempotency keys; a
 *    fingerprint-bearing attempt under a fingerprint-less decision —
 *    and vice versa — is a durable scope-mismatch, never a silent
 *    allow);
 *  - C2 (old-shape compatibility): a scope WITHOUT the fingerprint is
 *    exactly the old behavior — the full old-shape cycle is green
 *    (request → allow → consume → allow-consumed), an old durable row
 *    (no fingerprint field) stays idempotent under the extended key and
 *    surfaces as `operationFingerprint: undefined`, and a CORRUPTED
 *    durable fingerprint (present-but-empty / non-string) is fail-closed
 *    ABSENT (the row can never grant an allow);
 *  - C3 (no idempotency reuse across fingerprints): the SAME correlation
 *    under a DIFFERENT fingerprint is a NEW independent request (a
 *    different idempotency key — the fingerprint is NOT a correlation
 *    substitute, and absence is not presence);
 *  - C4 (exactly-once WITH fingerprint): an allow for a
 *    fingerprint-bound scope is consumed exactly once by the guard —
 *    the first guard passes, the second identical guard is blocked
 *    allow-consumed, and the durable consumption record carries the
 *    fingerprint;
 *  - C5 (durable round-trip): pending, decided and consumed control
 *    state — including the fingerprint on the request, the decision
 *    scope and the consumption scope — survives a FRESH ControlService
 *    instance over the re-opened TeamDomain (restart = re-instantiate +
 *    re-open; no in-memory state is authority, invariant 45);
 *  - routing (§9.5, design-level verification only): a MEMBER's
 *    leader-approval request is resolvable by the LEADER (the
 *    leader|human closure) and a member's user-approval request by the
 *    HUMAN only (the leader is rejected) — both kinds carry the
 *    fingerprint scope correctly into the durable decision;
 *  - malformed battery: a present-but-empty / non-string fingerprint is
 *    typed at every input boundary (CONTROL_REQUEST_MALFORMED stage
 *    'request', CONTROL_GUARD_MALFORMED stage 'guard',
 *    CONTROL_REQUEST_MALFORMED stage 'wait' for the waiter's ids/signal);
 *  - wait bridge (§9.4): resolves when the durable decision appears
 *    (injected poll interval; the authority is the durable rows — the
 *    wait runs on a DIFFERENT service instance than the resolver),
 *    rejects typed CONTROL_WAIT_ABORTED on signal abort (zero side
 *    effects — the request stays resolvable), rejects typed
 *    CONTROL_WAIT_CLOSED when the durable plane closes while waiting,
 *    and LEAKS nothing (a counting ledger read shows exactly one poll
 *    on the fast path and NO polling after the promise settles).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous
 * assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/a4a-control-exact-scope
 */

import { describe, expect, it } from 'vitest'

import {
  CONTROL_ERROR_CODES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../control/index.js'
import type { ControlGuardVerdict, ControlWaitSignal } from '../control/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  expectControlRejection,
  expectFirst,
  humanCaller,
  leaderCaller,
  makeScope,
  memberCaller,
  restartP6T1World,
  writeRawControlFact,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)

/** A real-timer sleep (the wait-bridge scenarios poll at a few ms). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** The block reason of a denied guard verdict (union narrowing — the
 *  allow branch has no `reason` member). */
function blockReason(verdict: ControlGuardVerdict): string {
  if (verdict.allowed) throw new Error('expected a block verdict, got an allow verdict')
  return verdict.reason
}

/** The durable requester ref of the default worker (a member). */
const WORKER_REQUESTER = { kind: 'instance', instanceId: WORKER_ID, role: 'member' }
/** The durable requester ref of the leader (a leader). */
const LEADER_DECIDER = { kind: 'instance', instanceId: LEADER_ID, role: 'leader' }

/** One raw `control-request-recorded` payload (bypasses the service). */
function rawRequestPayload(
  requestId: string,
  correlation: string,
  fingerprint: unknown,
): Record<string, unknown> {
  return {
    requestId,
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    requester: WORKER_REQUESTER,
    targetInstanceId: WORKER_ID,
    actionName: 'write-file',
    toolName: 'fs.write',
    correlation,
    ...(fingerprint === undefined ? {} : { operationFingerprint: fingerprint }),
  }
}

/** One raw `control-decision-recorded` payload (bypasses the service). */
function rawDecisionPayload(
  requestId: string,
  requestSequence: number,
  correlation: string,
  fingerprint: unknown,
): Record<string, unknown> {
  return {
    requestId,
    decision: 'allow',
    decider: LEADER_DECIDER,
    scope: {
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation,
      ...(fingerprint === undefined ? {} : { operationFingerprint: fingerprint }),
    },
    requestSequence,
  }
}

/**
 * Wrap the world's TeamDomain with a COUNTING ledger `list` (the
 * no-leak evidence channel for the wait bridge — every durable read by
 * the waiter is a ledger scan).
 */
function countingDomain(world: P6T1World): {
  readonly domain: TeamDomain
  readonly reads: { count: number }
} {
  const reads = { count: 0 }
  const ledger = world.domain.repositories.ledger
  // A Proxy delegate (the store is a class — a spread would drop its
  // prototype methods): every operation forwards to the real store,
  // only `list` is counted (the wait-bridge's durable read channel).
  const countingLedger: typeof ledger = new Proxy(ledger, {
    get(target, prop) {
      if (prop === 'list') {
        return (): ReturnType<typeof target.list> => {
          reads.count += 1
          return target.list()
        }
      }
      const value = (target as unknown as Record<PropertyKey, unknown>)[prop]
      return typeof value === 'function' ? (value as () => unknown).bind(target) : value
    },
  })
  const domain: TeamDomain = {
    ...world.domain,
    repositories: {
      ...world.domain.repositories,
      ledger: countingLedger,
    },
  }
  return { domain, reads }
}

// ---------------------------------------------------------------------------
// C1 — the fingerprint participates in the EXACT scope identity.
// ---------------------------------------------------------------------------
const C1 = await (async () => {
  const world = await createP6T4World('a4a-c1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const scopeA = makeScope({ correlation: 'corr-a4-c1', operationFingerprint: 'fp-a4-c1-a' })

    // (1) A fingerprint-bound request → leader allow → the guard with
    // the EXACT scope (same fingerprint) passes and consumes.
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scopeA.actionName,
      toolName: scopeA.toolName,
      correlation: scopeA.correlation,
      operationFingerprint: scopeA.operationFingerprint,
    })
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const guardExact = await service.guardOperation(scopeA)
    // (2) The IDENTICAL scope except for the fingerprint → the scope key
    // differs → no durable request matches → no-request.
    const guardDifferentFp = await service.guardOperation(
      makeScope({ correlation: 'corr-a4-c1', operationFingerprint: 'fp-a4-c1-b' }),
    )

    // (3) Durable scope-mismatch construction A: the durable REQUEST
    // carries the fingerprint, the durable DECISION scope does not
    // (a fingerprint-less approval snapshot under a fingerprint-bearing
    // attempt). The request matches by key; the snapshot must not.
    const rawRequestSeqA = await writeRawControlFact(
      world,
      'control-request-recorded',
      rawRequestPayload('ctrl-raw-a4-c1-a', 'corr-a4-c1-rawa', 'fp-a4-c1-rawa'),
    )
    await writeRawControlFact(
      world,
      'control-decision-recorded',
      rawDecisionPayload('ctrl-raw-a4-c1-a', rawRequestSeqA, 'corr-a4-c1-rawa', undefined),
    )
    const guardRawMismatchA = await service.guardOperation(
      makeScope({ correlation: 'corr-a4-c1-rawa', operationFingerprint: 'fp-a4-c1-rawa' }),
    )
    // (4) Durable scope-mismatch construction B: the durable REQUEST is
    // fingerprint-less, the durable DECISION scope carries the
    // fingerprint. The fingerprint-bearing attempt matches no request
    // by key at all (the request key is fingerprint-less) → no-request;
    // the fingerprint-LESS attempt matches the request but the snapshot
    // mismatch blocks it.
    const rawRequestSeqB = await writeRawControlFact(
      world,
      'control-request-recorded',
      rawRequestPayload('ctrl-raw-a4-c1-b', 'corr-a4-c1-rawb', undefined),
    )
    await writeRawControlFact(
      world,
      'control-decision-recorded',
      rawDecisionPayload('ctrl-raw-a4-c1-b', rawRequestSeqB, 'corr-a4-c1-rawb', 'fp-a4-c1-rawb'),
    )
    const guardRawMismatchBFp = await service.guardOperation(
      makeScope({ correlation: 'corr-a4-c1-rawb', operationFingerprint: 'fp-a4-c1-rawb' }),
    )
    const guardRawMismatchBNoFp = await service.guardOperation(
      makeScope({ correlation: 'corr-a4-c1-rawb' }),
    )

    return {
      request,
      decision,
      guardExact,
      guardDifferentFp,
      guardRawMismatchA,
      guardRawMismatchBFp,
      guardRawMismatchBNoFp,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// C2 — a scope WITHOUT the fingerprint is exactly the OLD behavior.
// ---------------------------------------------------------------------------
const C2 = await (async () => {
  const world = await createP6T4World('a4a-c2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)

    // (a) The full old-shape cycle (no fingerprint anywhere):
    // request → allow → consume → second attempt allow-consumed.
    const oldScope = makeScope({ correlation: 'corr-a4-c2-old' })
    const oldRequest = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: oldScope.actionName,
      toolName: oldScope.toolName,
      correlation: oldScope.correlation,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: oldRequest.requestId,
      decision: 'allow',
    })
    const oldGuard1 = await service.guardOperation(oldScope)
    const oldGuard2 = await service.guardOperation(oldScope)

    // (b) An explicit OLD-SHAPE durable row (the payload never carries
    // the operationFingerprint field) stays idempotent under the
    // extended key: a retried request with the same no-fingerprint
    // fields returns the EXISTING row (not a new one).
    await writeRawControlFact(
      world,
      'control-request-recorded',
      rawRequestPayload('ctrl-raw-a4-c2', 'corr-a4-c2-raw', undefined),
    )
    const rawRetry = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-a4-c2-raw',
    })
    const stateAfterRetry = await service.listControlState(P6T4_ROOT)

    // (c) CORRUPTED durable fingerprints are fail-closed ABSENT: a
    // present-but-empty and a non-string fingerprint make the row
    // unparseable, so it can never match (guard → no-request) — and a
    // retried request under that correlation starts fresh.
    await writeRawControlFact(
      world,
      'control-request-recorded',
      rawRequestPayload('ctrl-raw-a4-c2-empty', 'corr-a4-c2-empty', ''),
    )
    await writeRawControlFact(
      world,
      'control-request-recorded',
      rawRequestPayload('ctrl-raw-a4-c2-nonstr', 'corr-a4-c2-nonstr', 42),
    )
    const guardEmptyFpRow = await service.guardOperation(
      makeScope({ correlation: 'corr-a4-c2-empty' }),
    )
    const guardNonStringFpRow = await service.guardOperation(
      makeScope({ correlation: 'corr-a4-c2-nonstr' }),
    )

    return {
      oldRequest,
      oldGuard1,
      oldGuard2,
      rawRetry,
      stateAfterRetry,
      guardEmptyFpRow,
      guardNonStringFpRow,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// C3 — the SAME correlation + a DIFFERENT fingerprint is NOT reused.
// ---------------------------------------------------------------------------
const C3 = await (async () => {
  const world = await createP6T4World('a4a-c3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const corr = 'corr-a4-c3'

    // R1: the correlation + fingerprint A → allow → consumed.
    const r1 = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: corr,
      operationFingerprint: 'fp-c3-a',
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: r1.requestId,
      decision: 'allow',
    })
    const r1Guard = await service.guardOperation(makeScope({ correlation: corr, operationFingerprint: 'fp-c3-a' }))

    // R2: the SAME correlation + a DIFFERENT fingerprint → a NEW
    // independent request (the idempotency key distinguishes).
    const r2 = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: corr,
      operationFingerprint: 'fp-c3-b',
    })
    // R2 retry (identical args incl. the fingerprint) → the SAME row
    // (idempotency holds WITHIN one fingerprint).
    const r2Retry = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: corr,
      operationFingerprint: 'fp-c3-b',
    })

    // R3: the SAME correlation + NO fingerprint → a THIRD distinct
    // request (absence is not presence).
    const r3 = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: corr,
    })

    // The fingerprint-B approval is independent: allow it → the guard
    // under fingerprint B passes (a new independent approval); the
    // guard under fingerprint A still sees the CONSUMED R1 allow.
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: r2.requestId,
      decision: 'allow',
    })
    const r2Guard = await service.guardOperation(makeScope({ correlation: corr, operationFingerprint: 'fp-c3-b' }))
    const r1GuardAgain = await service.guardOperation(makeScope({ correlation: corr, operationFingerprint: 'fp-c3-a' }))

    return { r1, r2, r2Retry, r3, r1Guard, r2Guard, r1GuardAgain }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// C4 — allow → first guard consumes → second guard allow-consumed
// (exactly-once WITH the fingerprint).
// ---------------------------------------------------------------------------
const C4 = await (async () => {
  const world = await createP6T4World('a4a-c4', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-a4-c4', operationFingerprint: 'fp-a4-c4' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
      operationFingerprint: scope.operationFingerprint,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const guard1 = await service.guardOperation(scope)
    const guard2 = await service.guardOperation(scope)
    const state = await service.listControlState(P6T4_ROOT)
    const rawConsumptionFacts = controlFacts(world, 'control-allow-consumed').length

    return { request, guard1, guard2, state, rawConsumptionFacts }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// C5 — pending / decided / consumed state (incl. the fingerprint)
// survives a FRESH ControlService over the re-opened TeamDomain.
// ---------------------------------------------------------------------------
const C5 = await (async () => {
  const world = await createP6T4World('a4a-c5', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pendingScope = makeScope({ correlation: 'corr-a4-c5-pending', operationFingerprint: 'fp-c5-a' })
    const allowedScope = makeScope({ correlation: 'corr-a4-c5-allowed', operationFingerprint: 'fp-c5-b' })

    // A: a request that stays PENDING (no decision).
    const pendingRequest = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: pendingScope.actionName,
      toolName: pendingScope.toolName,
      correlation: pendingScope.correlation,
      operationFingerprint: pendingScope.operationFingerprint,
    })
    // B: a request that is DECIDED + CONSUMED before the restart.
    const allowedRequest = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: allowedScope.actionName,
      toolName: allowedScope.toolName,
      correlation: allowedScope.correlation,
      operationFingerprint: allowedScope.operationFingerprint,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: allowedRequest.requestId,
      decision: 'allow',
    })
    const preRestartGuard = await service.guardOperation(allowedScope)

    // The unit RESTART: re-instantiate + re-open over the SAME durable
    // store (invariant 45) — and a FRESH control service instance.
    const world2 = await restartP6T1World(world)
    try {
      const service2 = createP6T4Service(world2)
      const stateAfterRestart = await service2.listControlState(P6T4_ROOT)
      const guardPendingAfter = await service2.guardOperation(pendingScope)
      const guardAllowedAfter = await service2.guardOperation(allowedScope)

      return {
        pendingRequest,
        allowedRequest,
        preRestartGuard,
        stateAfterRestart,
        guardPendingAfter,
        guardAllowedAfter,
      }
    } finally {
      await destroyP6T1World(world2)
    }
  } finally {
    // world2 owns the scratch dir after the restart.
  }
})()

// ---------------------------------------------------------------------------
// §9.5 — routing design-level verification (member ask → leader-approval
// resolvable by leader|human; leader ask → user-approval resolvable by
// human only). No new decision vocabulary; both kinds carry the
// fingerprint scope into the durable decision.
// ---------------------------------------------------------------------------
const ROUTE = await (async () => {
  const world = await createP6T4World('a4a-route', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)

    // (1) A MEMBER's leader-approval request: the LEADER may resolve it
    // (the leader|human closure).
    const leaderApproval = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-a4-route-la',
      operationFingerprint: 'fp-route-a',
    })
    const leaderResolves = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: leaderApproval.requestId,
      decision: 'allow',
    })

    // (2) A MEMBER's user-approval request: the LEADER cannot stand in
    // for the user (human-only closure); the HUMAN may.
    const userApproval = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-a4-route-ua',
      operationFingerprint: 'fp-route-b',
    })
    const leaderDenied = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: userApproval.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
    )
    const humanResolves = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(P6T4_ROOT),
      requestId: userApproval.requestId,
      decision: 'allow',
    })

    return {
      leaderApproval,
      leaderResolves,
      userApproval,
      leaderDenied,
      humanResolves,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// Malformed battery — a present-but-empty / non-string fingerprint is
// TYPED at every input boundary (zero side effects).
// ---------------------------------------------------------------------------
const MALFORMED = await (async () => {
  const world = await createP6T4World('a4a-malformed', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const baseArgs = {
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-a4-malformed',
    }

    const requestEmptyFp = await expectControlRejection(
      () => service.requestControl({ ...baseArgs, operationFingerprint: '' }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    const requestNonStringFp = await expectControlRejection(
      () =>
        service.requestControl({
          ...baseArgs,
          operationFingerprint: 42 as unknown as string,
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    const guardEmptyFp = await expectControlRejection(
      () =>
        service.guardOperation(
          makeScope({ correlation: 'corr-a4-malformed-guard', operationFingerprint: '' }),
        ),
      CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED,
    )
    const guardNonStringFp = await expectControlRejection(
      () =>
        service.guardOperation(
          makeScope({
            correlation: 'corr-a4-malformed-guard',
            operationFingerprint: 42 as unknown as string,
          }),
        ),
      CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED,
    )
    const waitBadRoot = await expectControlRejection(
      () =>
        service.awaitControlDecision({
          rootSessionId: 'has space',
          requestId: 'ctrl-a4-malformed-wait',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    const waitEmptyRequestId = await expectControlRejection(
      () =>
        service.awaitControlDecision({
          rootSessionId: P6T4_ROOT,
          requestId: '',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    const preAborted = new AbortController()
    preAborted.abort()
    const waitAlreadyAborted = await expectControlRejection(
      () =>
        service.awaitControlDecision({
          rootSessionId: P6T4_ROOT,
          requestId: 'ctrl-a4-malformed-wait',
          signal: preAborted.signal,
        }),
      CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED,
    )
    const waitBadSignal = await expectControlRejection(
      () =>
        service.awaitControlDecision({
          rootSessionId: P6T4_ROOT,
          requestId: 'ctrl-a4-malformed-wait',
          signal: {} as unknown as ControlWaitSignal,
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )

    // Zero side effects: no request row was written by the rejects.
    const requestFacts = controlFacts(world, 'control-request-recorded').length

    return {
      requestEmptyFp,
      requestNonStringFp,
      guardEmptyFp,
      guardNonStringFp,
      waitBadRoot,
      waitEmptyRequestId,
      waitAlreadyAborted,
      waitBadSignal,
      requestFacts,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// W1 — the wait bridge RESOLVES when the durable decision appears (the
// fast path via the injected poll interval; the wait runs on a DIFFERENT
// service instance than the resolver — the authority is the durable
// rows, not the waiter's process state).
// ---------------------------------------------------------------------------
const W1 = await (async () => {
  const world = await createP6T4World('a4a-w1', ['leader', 'worker'])
  try {
    const resolver = createP6T4Service(world)
    const waiter = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
      waitPollIntervalMs: 5,
    })
    const request = await resolver.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-a4-w1',
      operationFingerprint: 'fp-w1',
    })

    const waitPromise = waiter.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: request.requestId,
    })
    // A few poll cycles pass with the request still pending.
    await sleep(15)
    // The RESOLVER (a different instance) records the durable decision.
    const decision = await resolver.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const waited = await waitPromise

    return { request, decision, waited }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// W2 — the wait bridge REJECTS typed on signal abort (zero side effects:
// the request stays durable and the later resolve is unaffected).
// ---------------------------------------------------------------------------
const W2 = await (async () => {
  const world = await createP6T4World('a4a-w2', ['leader', 'worker'])
  try {
    const service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
      waitPollIntervalMs: 5,
    })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-a4-w2',
      operationFingerprint: 'fp-w2',
    })

    const controller = new AbortController()
    const waitPromise = service.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: request.requestId,
      signal: controller.signal,
    })
    // A few poll cycles pass, then the caller cancels.
    await sleep(12)
    controller.abort()
    const aborted = await waitPromise.then(
      (value) => {
        throw new Error(`A4a-W2: expected the wait to reject, it resolved: ${JSON.stringify(value)}`)
      },
      (error: unknown) => error,
    )

    // Zero side effects: the request is still pending and the LATER
    // resolve is unaffected (cancellation never decides).
    const laterResolve = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const stateAfter = await service.listControlState(P6T4_ROOT)

    return { request, aborted, laterResolve, stateAfter }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// W3 — the wait bridge REJECTS typed when the durable control plane
// closes while waiting (the storage layer's NOT_OPEN closure signal on
// the durable read → CONTROL_WAIT_CLOSED).
// ---------------------------------------------------------------------------
const W3 = await (async () => {
  const world = await createP6T4World('a4a-w3', ['leader', 'worker'])
  try {
    const service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
      waitPollIntervalMs: 5,
    })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-a4-w3',
      operationFingerprint: 'fp-w3',
    })

    const waitPromise = service.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: request.requestId,
    })
    // A few poll cycles pass on the OPEN plane, then the agent closes
    // the durable domain under the waiter.
    await sleep(12)
    await world.domain.close()
    const closed = await waitPromise.then(
      (value) => {
        throw new Error(`A4a-W3: expected the wait to reject, it resolved: ${JSON.stringify(value)}`)
      },
      (error: unknown) => error,
    )

    return { request, closed }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// W4 — the wait bridge LEAKS nothing: the counting ledger read shows
// EXACTLY ONE durable read on the fast path (no timer was ever
// scheduled) and NO polling after the promise settles (the timer and
// the abort listener are cleared).
// ---------------------------------------------------------------------------
const W4 = await (async () => {
  const world = await createP6T4World('a4a-w4', ['leader', 'worker'])
  try {
    const { domain, reads } = countingDomain(world)
    const service = createControlService({
      teamDomain: domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
      waitPollIntervalMs: 5,
    })

    // (a) Fast path: the decision is ALREADY durable when the wait
    // starts — the first (synchronous) poll resolves it; exactly one
    // ledger read, and no timer is ever scheduled.
    const requestA = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-a4-w4-a',
      operationFingerprint: 'fp-w4-a',
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: requestA.requestId,
      decision: 'allow',
    })
    const readsBeforeA = reads.count
    const fastResolved = await service.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: requestA.requestId,
    })
    const readsAfterA = reads.count

    // (b) Abort path: the wait polls a few times, the signal aborts,
    // the promise settles — and the polling STOPS (no leaked timer).
    const requestB = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-a4-w4-b',
      operationFingerprint: 'fp-w4-b',
    })
    const controller = new AbortController()
    const waitB = service.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: requestB.requestId,
      signal: controller.signal,
    })
    await sleep(12) // >= 2 poll cycles
    controller.abort()
    await waitB.then(
      (value) => {
        throw new Error(`A4a-W4: expected the wait to reject, it resolved: ${JSON.stringify(value)}`)
      },
      () => undefined,
    )
    const readsAtAbort = reads.count
    await sleep(25) // 5+ poll cycles — a leaked timer would poll
    const readsAfterSettle = reads.count

    return {
      fastResolved,
      readsBeforeA,
      readsAfterA,
      readsAtAbort,
      readsAfterSettle,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous `it` bodies over the captured results)
// ---------------------------------------------------------------------------

describe('A4a (C1): the fingerprint participates in the exact scope identity', () => {
  it('a fingerprint-bound request is allowed for its EXACT scope (fingerprint included) — decision + consumption carry it', () => {
    expect(C1.request.operationFingerprint).toBe('fp-a4-c1-a')
    expect(C1.guardExact.allowed).toBe(true)
    expect(C1.guardExact.requestId).toBe(C1.request.requestId)
    expect(C1.decision.scope.operationFingerprint).toBe('fp-a4-c1-a')
  })

  it('the identical scope with a DIFFERENT fingerprint matches no durable request (different scope key → no-request)', () => {
    expect(C1.guardDifferentFp.allowed).toBe(false)
    expect(blockReason(C1.guardDifferentFp)).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
  })

  it('a fingerprint-bearing attempt under a fingerprint-less durable decision → scope-mismatch (present-on-one-side is a mismatch)', () => {
    expect(C1.guardRawMismatchA.allowed).toBe(false)
    expect(blockReason(C1.guardRawMismatchA)).toBe(CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH)
    expect(C1.guardRawMismatchA.requestId).toBe('ctrl-raw-a4-c1-a')
  })

  it('a fingerprint-bearing attempt under a fingerprint-less durable REQUEST → no-request (the request key is fingerprint-less)', () => {
    expect(C1.guardRawMismatchBFp.allowed).toBe(false)
    expect(blockReason(C1.guardRawMismatchBFp)).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
  })

  it('a fingerprint-less attempt under a fingerprint-bearing durable decision → scope-mismatch (the mirror case)', () => {
    expect(C1.guardRawMismatchBNoFp.allowed).toBe(false)
    expect(blockReason(C1.guardRawMismatchBNoFp)).toBe(CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH)
    expect(C1.guardRawMismatchBNoFp.requestId).toBe('ctrl-raw-a4-c1-b')
  })
})

describe('A4a (C2): a scope without the fingerprint is exactly the old behavior', () => {
  it('the full old-shape cycle is green: request → allow → consume → allow-consumed (no fingerprint anywhere)', () => {
    expect('operationFingerprint' in C2.oldRequest).toBe(false)
    expect(C2.oldGuard1.allowed).toBe(true)
    expect(C2.oldGuard1.requestId).toBe(C2.oldRequest.requestId)
    expect(C2.oldGuard2.allowed).toBe(false)
    expect(blockReason(C2.oldGuard2)).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(C2.oldGuard2.requestId).toBe(C2.oldRequest.requestId)
  })

  it('an old-shape durable row (no fingerprint field) stays idempotent under the extended key and surfaces as ABSENT, not empty', () => {
    // the retried request returned the EXISTING durable row
    expect(C2.rawRetry.requestId).toBe('ctrl-raw-a4-c2')
    expect(C2.rawRetry.status).toBe('pending')
    // the service record carries the field as undefined (old behavior)
    const rawRecord = expectFirst(
      C2.stateAfterRetry.requests.filter((r) => r.requestId === 'ctrl-raw-a4-c2'),
      'the old-shape raw request record',
    )
    expect('operationFingerprint' in rawRecord).toBe(false)
  })

  it('a CORRUPTED durable fingerprint (present-but-empty / non-string) is fail-closed ABSENT: the row can never grant an allow (no-request)', () => {
    expect(C2.guardEmptyFpRow.allowed).toBe(false)
    expect(blockReason(C2.guardEmptyFpRow)).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
    expect(C2.guardNonStringFpRow.allowed).toBe(false)
    expect(blockReason(C2.guardNonStringFpRow)).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
  })
})

describe('A4a (C3): the same correlation + a different fingerprint is NOT reused', () => {
  it('the SAME correlation under a DIFFERENT fingerprint is a NEW independent request (distinct idempotency keys)', () => {
    expect(C3.r1.requestId).not.toBe(C3.r2.requestId)
    expect(C3.r2.requestId).not.toBe(C3.r3.requestId)
    expect(C3.r1.requestId).not.toBe(C3.r3.requestId)
    expect(C3.r1.operationFingerprint).toBe('fp-c3-a')
    expect(C3.r2.operationFingerprint).toBe('fp-c3-b')
    expect('operationFingerprint' in C3.r3).toBe(false)
  })

  it('idempotency still holds WITHIN one fingerprint (an identical retry returns the same row)', () => {
    expect(C3.r2Retry.requestId).toBe(C3.r2.requestId)
  })

  it('the fingerprint-B approval is independent: the guard under B passes (a new approval) while the guard under A still sees the consumed R1 allow', () => {
    expect(C3.r1Guard.allowed).toBe(true)
    expect(C3.r2Guard.allowed).toBe(true)
    expect(C3.r2Guard.requestId).toBe(C3.r2.requestId)
    expect(C3.r1GuardAgain.allowed).toBe(false)
    expect(blockReason(C3.r1GuardAgain)).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(C3.r1GuardAgain.requestId).toBe(C3.r1.requestId)
  })
})

describe('A4a (C4): exactly-once WITH the fingerprint', () => {
  it('the first guard consumes the fingerprint-bound allow; the second identical guard is blocked allow-consumed', () => {
    expect(C4.guard1.allowed).toBe(true)
    expect(C4.guard1.requestId).toBe(C4.request.requestId)
    expect(C4.guard2.allowed).toBe(false)
    expect(blockReason(C4.guard2)).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(C4.guard2.requestId).toBe(C4.request.requestId)
  })

  it('exactly one durable consumption fact — and the durable records carry the fingerprint on the decision scope AND the consumption scope', () => {
    expect(C4.rawConsumptionFacts).toBe(1)
    expect(C4.state.consumptions.length).toBe(1)
    const consumption = expectFirst(C4.state.consumptions, 'consumption')
    expect(consumption.scope.operationFingerprint).toBe('fp-a4-c4')
    expect(consumption.requestId).toBe(C4.request.requestId)
    expect(C4.state.decisions.length).toBe(1)
    const decision = expectFirst(C4.state.decisions, 'decision')
    expect(decision.scope.operationFingerprint).toBe('fp-a4-c4')
  })
})

describe('A4a (C5): pending / decided / consumed state survives a fresh ControlService instance', () => {
  it('the pre-restart state: the allow was consumed exactly once (fingerprint bound)', () => {
    expect(C5.preRestartGuard.allowed).toBe(true)
    expect(C5.preRestartGuard.requestId).toBe(C5.allowedRequest.requestId)
    expect(C5.pendingRequest.operationFingerprint).toBe('fp-c5-a')
    expect(C5.allowedRequest.operationFingerprint).toBe('fp-c5-b')
  })

  it('after the restart (fresh service over the re-opened TeamDomain): the pending request is still pending with its fingerprint; the allow is still decided+consumed with its fingerprint', () => {
    expect(C5.stateAfterRestart.requests.length).toBe(2)
    const pending = expectFirst(
      C5.stateAfterRestart.requests.filter((r) => r.requestId === C5.pendingRequest.requestId),
      'pending request',
    )
    expect(pending.status).toBe('pending')
    expect(pending.operationFingerprint).toBe('fp-c5-a')
    const decided = expectFirst(
      C5.stateAfterRestart.requests.filter((r) => r.requestId === C5.allowedRequest.requestId),
      'decided request',
    )
    expect(decided.status).toBe('decided')
    expect(decided.operationFingerprint).toBe('fp-c5-b')

    expect(C5.stateAfterRestart.decisions.length).toBe(1)
    const decision = expectFirst(C5.stateAfterRestart.decisions, 'decision')
    expect(decision.scope.operationFingerprint).toBe('fp-c5-b')
    expect(C5.stateAfterRestart.consumptions.length).toBe(1)
    const consumption = expectFirst(C5.stateAfterRestart.consumptions, 'consumption')
    expect(consumption.scope.operationFingerprint).toBe('fp-c5-b')
  })

  it('the fresh service enforces the durable state: the pending request blocks request-pending; the consumed allow blocks allow-consumed', () => {
    expect(C5.guardPendingAfter.allowed).toBe(false)
    expect(blockReason(C5.guardPendingAfter)).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING)
    expect(C5.guardAllowedAfter.allowed).toBe(false)
    expect(blockReason(C5.guardAllowedAfter)).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(C5.guardAllowedAfter.requestId).toBe(C5.allowedRequest.requestId)
  })
})

describe('A4a (§9.5 routing): both approval kinds carry the fingerprint scope (design-level verification)', () => {
  it('a MEMBER leader-approval request is resolvable by the LEADER (leader|human closure) — the durable decision carries the fingerprint', () => {
    expect(ROUTE.leaderApproval.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(ROUTE.leaderResolves.decision).toBe('allow')
    expect(ROUTE.leaderResolves.decider).toEqual(LEADER_DECIDER)
    expect(ROUTE.leaderResolves.scope.operationFingerprint).toBe('fp-route-a')
    expect(ROUTE.leaderResolves.requestId).toBe(ROUTE.leaderApproval.requestId)
  })

  it('a MEMBER user-approval request: the LEADER is rejected (human-only closure) with zero side effects; the HUMAN resolves it — the durable decision carries the fingerprint', () => {
    expect(ROUTE.leaderDenied.code).toBe(CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
    expect(ROUTE.leaderDenied.details?.['role']).toBe('leader')
    expect(ROUTE.leaderDenied.details?.['allowedRoles']).toEqual(['human'])
    expect(ROUTE.humanResolves.decision).toBe('allow')
    expect(ROUTE.humanResolves.decider).toEqual({ kind: 'human', humanId: P6T4_ROOT })
    expect(ROUTE.humanResolves.scope.operationFingerprint).toBe('fp-route-b')
    expect(ROUTE.humanResolves.requestId).toBe(ROUTE.userApproval.requestId)
  })
})

describe('A4a (malformed battery): a present-but-malformed fingerprint is typed at every input boundary', () => {
  it('requestControl rejects an empty / non-string fingerprint with CONTROL_REQUEST_MALFORMED (stage request, field operationFingerprint)', () => {
    expect(MALFORMED.requestEmptyFp.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(MALFORMED.requestEmptyFp.details?.['stage']).toBe('request')
    expect(MALFORMED.requestEmptyFp.details?.['field']).toBe('operationFingerprint')
    expect(MALFORMED.requestNonStringFp.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(MALFORMED.requestNonStringFp.details?.['field']).toBe('operationFingerprint')
  })

  it('guardOperation rejects an empty / non-string fingerprint with CONTROL_GUARD_MALFORMED (stage guard, field operationFingerprint)', () => {
    expect(MALFORMED.guardEmptyFp.code).toBe(CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED)
    expect(MALFORMED.guardEmptyFp.details?.['stage']).toBe('guard')
    expect(MALFORMED.guardEmptyFp.details?.['field']).toBe('operationFingerprint')
    expect(MALFORMED.guardNonStringFp.code).toBe(CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED)
    expect(MALFORMED.guardNonStringFp.details?.['field']).toBe('operationFingerprint')
  })

  it('awaitControlDecision rejects malformed rootSessionId / requestId / signal with CONTROL_REQUEST_MALFORMED (stage wait)', () => {
    expect(MALFORMED.waitBadRoot.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(MALFORMED.waitBadRoot.details?.['stage']).toBe('wait')
    expect(MALFORMED.waitBadRoot.details?.['field']).toBe('rootSessionId')
    expect(MALFORMED.waitEmptyRequestId.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(MALFORMED.waitEmptyRequestId.details?.['field']).toBe('requestId')
    expect(MALFORMED.waitBadSignal.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(MALFORMED.waitBadSignal.details?.['field']).toBe('signal')
  })

  it('awaitControlDecision rejects an ALREADY-aborted signal immediately with typed CONTROL_WAIT_ABORTED (zero side effects)', () => {
    expect(MALFORMED.waitAlreadyAborted.code).toBe(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED)
    expect(MALFORMED.waitAlreadyAborted.details?.['requestId']).toBe('ctrl-a4-malformed-wait')
  })

  it('every rejection wrote ZERO durable request rows (the malformed battery is side-effect free)', () => {
    expect(MALFORMED.requestFacts).toBe(0)
  })
})

describe('A4a (W1): the wait bridge resolves when the durable decision appears', () => {
  it('the wait (injected 5 ms poll interval) resolves with the durable decision record — the fingerprint rides the scope', () => {
    expect(W1.waited.requestId).toBe(W1.request.requestId)
    expect(W1.waited.decision).toBe('allow')
    expect(W1.waited.scope.operationFingerprint).toBe('fp-w1')
    expect(W1.waited.decider).toEqual(LEADER_DECIDER)
    // the waited record is the SAME durable row the resolver recorded
    expect(W1.waited.decisionSequence).toBe(W1.decision.decisionSequence)
  })
})

describe('A4a (W2): the wait bridge rejects typed on signal abort (cancellation never decides)', () => {
  it('the abort rejects CONTROL_WAIT_ABORTED with the request identity; the request stays pending and the LATER resolve is unaffected', () => {
    expect((W2.aborted as { code?: string })?.code).toBe(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED)
    expect((W2.aborted as { details?: Record<string, unknown> })?.details?.['requestId']).toBe(W2.request.requestId)
    expect(W2.laterResolve.decision).toBe('allow')
    expect(W2.laterResolve.requestId).toBe(W2.request.requestId)
    expect(W2.stateAfter.decisions.length).toBe(1)
    const request = expectFirst(W2.stateAfter.requests, 'request')
    expect(request.status).toBe('decided')
    expect(request.operationFingerprint).toBe('fp-w2')
  })
})

describe('A4a (W3): the wait bridge rejects typed when the durable plane closes while waiting', () => {
  it('closing the TeamDomain under the waiter rejects CONTROL_WAIT_CLOSED (the storage NOT_OPEN closure signal, mapped)', () => {
    const error = W3.closed as { code?: string; details?: Record<string, unknown> }
    expect(error.code).toBe(CONTROL_ERROR_CODES.CONTROL_WAIT_CLOSED)
    expect(error.details?.['requestId']).toBe(W3.request.requestId)
    expect(error.details?.['rootSessionId']).toBe(P6T4_ROOT)
  })
})

describe('A4a (W4): the wait bridge leaks nothing (no timers / listeners after settle)', () => {
  it('fast path: an already-durable decision resolves with EXACTLY ONE durable read (no timer was ever scheduled)', () => {
    expect(W4.fastResolved.decision).toBe('allow')
    expect(W4.readsAfterA).toBe(W4.readsBeforeA + 1)
  })

  it('abort path: the wait polled while pending (reads grew) and the polling STOPS after settle (no leaked timer)', () => {
    // polling actually happened before the abort
    expect(W4.readsAtAbort).toBeGreaterThan(W4.readsBeforeA)
    // and NOTHING polled in the 5+ poll cycles after settle
    expect(W4.readsAfterSettle).toBe(W4.readsAtAbort)
  })
})
