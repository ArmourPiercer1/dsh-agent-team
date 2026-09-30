/**
 * control-guard-coupling.test.ts — pre-alpha3 PR-D review B2 / D.4
 * coupling boundary: the two execution lanes (GUARDED and INLINE) are
 * DISJOINT in the last-mile guard.
 *
 * D.4: the GUARDED flow is request → wait → decision → guard → consume →
 * execute (the allow is consumed EXACTLY ONCE by the guard); the INLINE
 * flow is request → wait → decision, on `allow` the current frozen
 * invocation CONTINUES — NO `control-allow-consumed` fact is written, the
 * allow is not consumed by a guard. An inline allow is therefore NOT a
 * one-shot guard token.
 *
 * The defect (review B2): the guard did not distinguish an INLINE allow
 * from a GUARDED allow — it could CONSUME an inline decision and authorize
 * another (guarded) execution after the frozen inline invocation had
 * already continued, contrary to the D.4 coupling boundary.
 *
 * Under test:
 * - S1 (KEY): an inline allow for scope S is INVISIBLE to the guard — a
 *   GUARDED execution against scope S is BLOCKED (no-request) with ZERO
 *   authorization and ZERO consumption (no `control-allow-consumed` fact).
 * - S2 (mirror): an INLINE execution (the frozen continuation after its
 *   own inline allow) never CONSUMES a guarded allow — the guarded allow
 *   is left intact and remains consumable by a subsequent guarded
 *   execution. An EXPLICIT `guarded` coupling is still guardable (the
 *   exclusion is on `inline` only, never on absent/explicit guarded).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_EXECUTION_COUPLINGS,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type { ControlDecisionRecord } from '../control/index.js'
import {
  P6T4_ROOT,
  controlFacts,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
} from './p6t4-helpers.js'

const TEMPLATE_SUBJECT = { kind: 'template' as const, templateId: 'worker' }

// --- scenario 1 (KEY): an inline allow is invisible to the guarded guard ----------------
let s1: {
  readonly allowed: boolean
  readonly reason: string | undefined
  readonly consumedFacts: number
}
{
  const world = await createP6T4World('ctl-b2-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    // An INLINE request for scope S, durably allowed (the frozen invocation
    // would continue on this decision — it is NOT a guard token).
    const inlineRequest = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: TEMPLATE_SUBJECT,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-b2-inline',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: inlineRequest.requestId,
      decision: 'allow',
    })
    // A GUARDED execution is attempted against the SAME scope S.
    const verdict = await service.guardOperation({
      rootSessionId: P6T4_ROOT,
      subject: TEMPLATE_SUBJECT,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-b2-inline',
    })
    s1 = {
      allowed: verdict.allowed,
      reason: verdict.allowed === false ? verdict.reason : undefined,
      consumedFacts: controlFacts(world, 'control-allow-consumed').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2 (mirror): an inline execution never consumes a guarded allow ------------
let s2: {
  readonly inlineWaitDecision: string | undefined
  readonly consumedAfterInline: number
  readonly guardAllowed: boolean
  readonly guardReason: string | undefined
  readonly consumedAfterGuard: number
}
{
  const world = await createP6T4World('ctl-b2-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    // A GUARDED (explicit coupling) request for scope G, durably allowed —
    // an unconsumed one-shot guarded allow.
    const guardedRequest = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: TEMPLATE_SUBJECT,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-b2-guarded',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: guardedRequest.requestId,
      decision: 'allow',
    })
    // An INLINE request for a DISTINCT scope I (its own correlation),
    // durably allowed.
    const inlineRequest = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: TEMPLATE_SUBJECT,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-b2-inline2',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: inlineRequest.requestId,
      decision: 'allow',
    })
    // The INLINE execution: the frozen invocation continues on its OWN
    // inline decision (the wait bridge resolves with the durable decision —
    // no guard consult, NO consumption fact written).
    let inlineDecision: ControlDecisionRecord | undefined
    try {
      inlineDecision = await service.awaitControlDecision({
        rootSessionId: P6T4_ROOT,
        requestId: inlineRequest.requestId,
      })
    } catch {
      inlineDecision = undefined
    }
    const consumedAfterInline = controlFacts(world, 'control-allow-consumed').length
    // Now a GUARDED execution against scope G: the guarded allow must STILL
    // be available (the inline execution did not consume it) and is
    // consumed exactly once here.
    const guardVerdict = await service.guardOperation({
      rootSessionId: P6T4_ROOT,
      subject: TEMPLATE_SUBJECT,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-b2-guarded',
    })
    s2 = {
      inlineWaitDecision: inlineDecision?.decision,
      consumedAfterInline,
      guardAllowed: guardVerdict.allowed,
      guardReason: guardVerdict.allowed === false ? guardVerdict.reason : undefined,
      consumedAfterGuard: controlFacts(world, 'control-allow-consumed').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('control: guard lane disjointness (pre-alpha3 PR-D review B2 / D.4)', () => {
  it('S1 (KEY): a guarded execution against an inline-allowed scope is BLOCKED with zero authorization and zero consumption', () => {
    expect(s1.allowed).toBe(false)
    // The guard is blind to the inline request (a different lane) — from
    // the guarded lane's view there is NO request for that scope.
    expect(s1.reason).toBe('no-request')
    // Zero consumption: the inline allow was NOT burned by the guard.
    expect(s1.consumedFacts).toBe(0)
  })

  it('S2 (mirror): an inline execution continues on its own allow and never consumes the guarded allow (which stays available for a guarded execution)', () => {
    // The inline execution proceeded on its OWN inline decision.
    expect(s2.inlineWaitDecision).toBe('allow')
    // The inline execution wrote NO consumption fact (D.4: the inline
    // lane never consumes — neither its own allow nor the guarded one).
    expect(s2.consumedAfterInline).toBe(0)
    // The guarded allow is still available: an explicit `guarded` coupling
    // is guardable (the exclusion is on `inline` only).
    expect(s2.guardAllowed).toBe(true)
    expect(s2.guardReason).toBeUndefined()
    // Exactly ONE consumption exists after the guarded execution — the
    // guarded allow (the inline allow was never consumed by anything).
    expect(s2.consumedAfterGuard).toBe(1)
  })
})
