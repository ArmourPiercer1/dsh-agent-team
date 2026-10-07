/**
 * a4p4-operation-single-shot.test.ts — A4-PR4 lane C (plan Task 4, spec
 * §12.1-§12.2, §13, §24.6, acceptance §21.6).
 *
 * THE LAW UNDER TEST: an approval authorizes ONE invocation, and the terminal
 * state of that invocation is recorded for what it was — without rewriting the
 * human's durable verdict.
 *
 *  C1  authority DRIFT after the allow: the documents now require a higher
 *      rung than the one that signed. The invocation does not execute, the
 *      one-shot is NOT consumed (a stale attempt that burns an allow turns a
 *      drift into a second denial nobody voted on), and the allow row is
 *      untouched — no rewritten decision, no abandonment, no second decision;
 *  C2  the execution CAPABILITY disappears between the allow and the
 *      last-mile guard: the invocation terminates with the
 *      execution-unavailable family (naming the host, not a withdrawn
 *      permission), again with zero consumption and the allow row unchanged;
 *  C3  the exact invocation consumes the allow EXACTLY once, and a replay of
 *      the same scope is refused as already-consumed rather than re-executing;
 *  C4  a tool body that fails does NOT refund the allow: the attempt spent
 *      it, so the retry needs its own approval (single-shot means one
 *      invocation per allow, successful or not), and the failed attempt is
 *      recorded as did-not-execute, never as a success;
 *  C5  every terminal state the adapter reports is a member of PR3's FROZEN
 *      terminal-operation-outcome vocabulary — read here from the projection
 *      lane, which the executing path itself may never import (ADR A1-17);
 *  C6  the recheck comparison itself: equal is NOT higher (same-level remains
 *      impossible), a rise is stale, a fall is covered, "cannot confirm" is
 *      not "confirmed", and a pre-v3 fresh answer cannot invent a drift.
 *
 * SCOPE DISCLOSURE (stated, not implied): this lane covers the EXECUTING path's
 * recheck, immediately before the last-mile guard. The companion duty at the
 * consumption write inside `guardOperation` (ADR A1-14 / spec §24.6) needs an
 * authority-facts port and a guard block reason in
 * `packages/runtime/control/types.ts` — outside Task 4's granted files — so it
 * is reported as a file-scope blocker and remains UNENFORCED there. C1/C2 pin
 * the zero-consumption property this PR does deliver.
 *
 * RUNNER CONSTRAINTS: async scenarios run at module level with top-level
 * await; `it` bodies are synchronous (this repo's plain-node shim).
 *
 * SELF-CLEANLINESS: inside the P4-T6 whole-tree scanner's scope; no legacy
 * Team SessionEvent denylist token appears.
 *
 * @module @dsh-agent-team/runtime/test/a4p4-operation-single-shot
 */
import { describe, expect, it } from 'vitest'
import {
  CONTROL_GUARD_BLOCK_REASONS,
  createControlService,
} from '../control/index.js'
import type {
  ControlAbandonmentRecord,
  ControlConsumptionRecord,
  ControlDecisionRecord,
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
import {
  PRE_EXECUTE_CAPABILITY_ERROR_CODES,
  PRE_EXECUTE_CAPABILITY_REASON_PREFIX,
  installParameterPermissionListener,
  recheckOperationApproval,
} from '../operation-permission/index.js'
import type {
  OperationApprovalFacts,
  PreExecuteExec,
  PreToolDecisionLike,
} from '../operation-permission/index.js'
// TEST-ONLY import of the projection lane. The PRODUCER may not import it
// (ADR A1-17: an executing path must not read the intervention lane), so the
// adapter spells its terminal outcomes as literals — and this leg is what
// keeps that mirror from drifting: a literal that is not a member of the
// frozen vocabulary reddens C5.
import { TERMINAL_OPERATION_OUTCOME_VALUES } from '../intervention/index.js'
import type { ExternalPolicyFacts } from '../../domain/policy/src/index.js'
import type { AuthorityEnvelope } from '../../domain/authority-envelope/src/index.js'
import type { AuthorityEnvelopeDocuments } from '../governance/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
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
const FILE_A_KEY = 'file:///fileA.txt'
const ACTION_NAME = 'team.action.execute'

const ASK_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [],
  ask: [{ tool: 'read', resource: { kind: 'any' } }],
  deny: [],
}

// ---------------------------------------------------------------------------
// Harness (the a5a/a4p4 pattern: fake ctx + real ControlService + P6T4 world).
// ---------------------------------------------------------------------------

interface FakeAgentCtx {
  on: (event: string, listener: (exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>) => () => void
  tools: { guard: (guard: (exec: { name: string }) => string | undefined) => () => void }
  trigger: (exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>
}

function makeFakeAgentCtx(): FakeAgentCtx {
  const listeners: Array<(exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>> = []
  return {
    on: (_event, listener) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index >= 0) listeners.splice(index, 1)
      }
    },
    tools: { guard: () => () => undefined },
    trigger: async (exec, next) => {
      const listener = listeners[0]
      if (listener === undefined) throw new Error('fake ctx: no listener registered')
      return listener(exec, next)
    },
  }
}

async function fakeResolve(path: string): Promise<{ readonly key: string; readonly display: string }> {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/')
  return { key: `file:///${normalized}`, display: path }
}

function makeExec(args: {
  readonly name: string
  readonly arguments?: unknown
  readonly callId: string
}): PreExecuteExec {
  return {
    callId: args.callId,
    name: args.name,
    arguments: args.arguments ?? {},
    signal: new AbortController().signal,
  }
}

function makeNext(result: PreToolDecisionLike = { kind: 'allow' }): {
  readonly fn: () => Promise<PreToolDecisionLike>
  calls: () => number
} {
  let count = 0
  return {
    fn: async (): Promise<PreToolDecisionLike> => {
      count += 1
      return result
    },
    calls: () => count,
  }
}

interface MutableExternal {
  readonly facts: () => Promise<ExternalPolicyFacts>
  set: (next: ExternalPolicyFacts) => void
  calls: () => number
}

function mutableExternal(initial: ExternalPolicyFacts): MutableExternal {
  let current = initial
  let probeCalls = 0
  return {
    set: (next) => {
      current = next
    },
    calls: () => probeCalls,
    facts: async () => {
      probeCalls += 1
      return current
    },
  }
}

/** The authority plane as a MUTABLE port, so a scenario can move the
 *  documents between the approval and the execution (the drift C1 needs). */
interface MutableFacts {
  set: (next: OperationApprovalFacts | undefined) => void
  port: () => Promise<OperationApprovalFacts | undefined>
  calls: () => number
}

function mutableFacts(initial: OperationApprovalFacts | undefined): MutableFacts {
  let current = initial
  let readCalls = 0
  return {
    set: (next) => {
      current = next
    },
    port: async () => {
      readCalls += 1
      return current
    },
    calls: () => readCalls,
  }
}

const NO_HOST_RESTRICTION: ExternalPolicyFacts = { hard: {}, capabilityExists: {} }

/** The host hard-denies the `tools` domain (the lane-B probe's input). */
const HOST_REFUSES: ExternalPolicyFacts = {
  hard: { tools: { kind: 'deny' } },
  capabilityExists: {},
}

function docsCappedAtAsk(): AuthorityEnvelopeDocuments {
  const document: AuthorityEnvelope = {
    rules: [
      {
        operationClass: 'read',
        matcher: { kind: 'exact', resource: FILE_A_KEY },
        maximumEffect: 'ask',
      },
    ],
  }
  return {
    teamHardEnvelope: { status: 'declared', document },
    permissionMutationEnvelope: { status: 'absent' },
  }
}

interface Env {
  readonly world: P6T1World
  readonly service: ControlService
  readonly ctx: FakeAgentCtx
  readonly observations: Record<string, unknown>[]
  readonly disposer: () => void
}

async function createEnv(
  basename: string,
  options: {
    readonly external?: MutableExternal
    readonly facts?: MutableFacts
  },
): Promise<Env> {
  const external = options.external ?? mutableExternal(NO_HOST_RESTRICTION)
  const world = await createP6T4World(basename, ['leader', 'worker'], {
    externalPolicyFacts: external.facts,
  })
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: external.facts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 10,
  })
  const ctx = makeFakeAgentCtx()
  const observations: Record<string, unknown>[] = []
  const facts = options.facts
  const disposer = installParameterPermissionListener(ctx, {
    policy: ASK_POLICY,
    resolveTarget: fakeResolve,
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    targetInstanceId: WORKER_ID,
    isLeader: false,
    ...(facts === undefined
      ? {}
      : { operationApprovalRouting: async () => facts.port() }),
    onObserve: (observation) => {
      observations.push(observation)
    },
  })
  return { world, service, ctx, observations, disposer }
}

async function waitForRequest(
  service: ControlService,
  correlation: string,
): Promise<ControlRequestRecord> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const state = await service.listControlState(P6T4_ROOT)
    const found = state.requests.find((request) => request.correlation === correlation)
    if (found !== undefined) return found
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`no control request appeared for ${correlation}`)
}

function fold(state: {
  readonly requests: readonly ControlRequestRecord[]
  readonly decisions: readonly ControlDecisionRecord[]
  readonly consumptions: readonly ControlConsumptionRecord[]
  readonly abandonments: readonly ControlAbandonmentRecord[]
}): string[] {
  return [
    ...state.requests.map((r) => `request:${r.kind}:${r.status}`),
    ...state.decisions.map((d) => `decision:${d.decision}`),
    ...state.consumptions.map((c) => `consumption:${c.requestId}`),
    ...state.abandonments.map((a) => `abandonment:${a.requestId}`),
  ]
}

// ---------------------------------------------------------------------------
// C1 — authority drift after the allow.
// ---------------------------------------------------------------------------

const c1 = await (async () => {
  const facts = mutableFacts({
    beneficiaryAuthority: 'member',
    documents: {
      teamHardEnvelope: { status: 'absent' },
      permissionMutationEnvelope: { status: 'absent' },
    },
  })
  const env = await createEnv('a4p4-c1', { facts })
  try {
    const next = makeNext()
    const pending = env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a4p4-c1' }),
      next.fn,
    )
    const request = await waitForRequest(env.service, 'a4p4-c1')
    const createdRows = fold(await env.service.listControlState(P6T4_ROOT))
    // The drift: the Team narrows the scope WHILE the approval is pending.
    // The leader's allow is still a true record of what the human decided.
    facts.set({
      beneficiaryAuthority: 'member',
      documents: docsCappedAtAsk(),
    })
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const decision = await pending
    const state = await env.service.listControlState(P6T4_ROOT)
    return {
      createdRows,
      requestId: request.requestId,
      reviewAuthority: request.reviewAuthority,
      decision,
      reason: decision.kind === 'deny' ? decision.reason : '',
      executed: next.calls(),
      rows: fold(state),
      decisions: state.decisions,
      consumptions: state.consumptions.length,
      terminal: env.observations.filter((o) => o['stage'] === 'terminal-outcome'),
    }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// C2 — the capability disappears between the allow and the guard.
// ---------------------------------------------------------------------------

const c2 = await (async () => {
  const external = mutableExternal(NO_HOST_RESTRICTION)
  const env = await createEnv('a4p4-c2', { external })
  try {
    const next = makeNext()
    const pending = env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a4p4-c2' }),
      next.fn,
    )
    const request = await waitForRequest(env.service, 'a4p4-c2')
    // The allow IS recordable: at decision time the host still allows. (The
    // service refuses to record an allow once the host hard-denies — that is
    // a different arm, `CONTROL_EXTERNAL_POLICY_DENIED` at resolution.) The
    // window this case is about is the one AFTER the human's verdict was
    // written, before the guard: the flip is synchronous here and the wait
    // wakes on a timer poll, so the ordering is deterministic (the a2c4 G5
    // mechanism).
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    external.set(HOST_REFUSES)
    const decision = await pending
    const state = await env.service.listControlState(P6T4_ROOT)
    return {
      reason: decision.kind === 'deny' ? decision.reason : '',
      executed: next.calls(),
      rows: fold(state),
      decisions: state.decisions,
      consumptions: state.consumptions.length,
      terminal: env.observations.filter((o) => o['stage'] === 'terminal-outcome'),
    }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// C3 — the exact invocation consumes exactly once; a replay is refused.
// ---------------------------------------------------------------------------

const c3 = await (async () => {
  const env = await createEnv('a4p4-c3', {})
  try {
    const next = makeNext()
    const pending = env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a4p4-c3' }),
      next.fn,
    )
    const request = await waitForRequest(env.service, 'a4p4-c3')
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const decision = await pending
    const afterFirst = await env.service.listControlState(P6T4_ROOT)
    // A replay of the SAME scope (same correlation, same fingerprint): the
    // guard must refuse it as already-consumed, not re-authorize it.
    const replay = await env.service.guardOperation({
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: ACTION_NAME,
      toolName: 'read',
      correlation: 'a4p4-c3',
      operationFingerprint: request.operationFingerprint ?? '',
    })
    const afterReplay = await env.service.listControlState(P6T4_ROOT)
    return {
      kind: decision.kind,
      executed: next.calls(),
      firstConsumptions: afterFirst.consumptions.length,
      firstRows: fold(afterFirst),
      replayAllowed: replay.allowed,
      replayReason: replay.allowed === false ? replay.reason : '',
      replayConsumptions: afterReplay.consumptions.length,
      terminal: env.observations.filter((o) => o['stage'] === 'terminal-outcome'),
    }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// C4 — a failed tool body does not refund the allow.
// ---------------------------------------------------------------------------

const c4 = await (async () => {
  const env = await createEnv('a4p4-c4', {})
  try {
    const failingNext = makeNext({ kind: 'deny', reason: 'the tool body failed' })
    const pending = env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a4p4-c4' }),
      failingNext.fn,
    )
    const request = await waitForRequest(env.service, 'a4p4-c4')
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const first = await pending
    const afterFailure = await env.service.listControlState(P6T4_ROOT)
    // The retry: a NEW invocation, so a NEW approval is required — the spent
    // allow cannot be reused by a call that never happened.
    const retryNext = makeNext()
    const retry = env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a4p4-c4b' }),
      retryNext.fn,
    )
    const retryRequest = await waitForRequest(env.service, 'a4p4-c4b')
    const retryState = await env.service.listControlState(P6T4_ROOT)
    // Abandon the retry so the wait does not outlive the scenario.
    await env.service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: retryRequest.requestId,
    })
    await retry
    return {
      firstKind: first.kind,
      firstRequestId: request.requestId,
      retryRequestId: retryRequest.requestId,
      failureConsumptions: afterFailure.consumptions.length,
      failureRows: fold(afterFailure),
      retryExecuted: retryNext.calls(),
      retryRows: fold(retryState),
      terminal: env.observations.filter((o) => o['stage'] === 'terminal-outcome'),
    }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// C6 — the recheck comparison itself (pure).
// ---------------------------------------------------------------------------

const c6 = {
  equal: recheckOperationApproval({
    reviewAuthority: 'leader',
    fresh: {
      kind: 'approval-required',
      requiredAuthority: 'leader',
      beneficiaryAuthority: 'member',
      carrierKind: 'leader-approval',
      evidence: { consideredRoles: ['leader'], boundDocumentsByRole: {}, roseBecauseInsufficient: [] },
    },
  }),
  risen: recheckOperationApproval({
    reviewAuthority: 'leader',
    fresh: {
      kind: 'approval-required',
      requiredAuthority: 'human-user',
      beneficiaryAuthority: 'member',
      carrierKind: 'user-approval',
      evidence: { consideredRoles: ['human-user'], boundDocumentsByRole: {}, roseBecauseInsufficient: [] },
    },
  }),
  fallen: recheckOperationApproval({
    reviewAuthority: 'human-user',
    fresh: {
      kind: 'approval-required',
      requiredAuthority: 'leader',
      beneficiaryAuthority: 'member',
      carrierKind: 'leader-approval',
      evidence: { consideredRoles: ['leader'], boundDocumentsByRole: {}, roseBecauseInsufficient: [] },
    },
  }),
  undetermined: recheckOperationApproval({
    reviewAuthority: 'leader',
    fresh: { kind: 'authority-undetermined', reason: 'ceiling-undetermined', detail: 'no predicate' },
  }),
  legacy: recheckOperationApproval({
    reviewAuthority: 'leader',
    fresh: { kind: 'legacy', reason: 'not-authority-v3' },
  }),
  direct: recheckOperationApproval({
    reviewAuthority: 'human-user',
    fresh: {
      kind: 'direct',
      requiredAuthority: 'leader',
      beneficiaryAuthority: 'member',
      evidence: { consideredRoles: ['leader'], boundDocumentsByRole: {}, roseBecauseInsufficient: [] },
    },
  }),
} as const

// ---------------------------------------------------------------------------

describe('a4p4 lane C — one approval, one invocation, and an honest terminal state', () => {
  it('C1: authority drift after the allow — no execution, no consumption, no rewritten verdict', () => {
    // The leg opened at Leader (the documents said Leader at creation).
    expect(c1.createdRows).toEqual(['request:leader-approval:pending'])
    expect(c1.reviewAuthority).toBe('leader')
    // And it did not execute.
    expect(c1.decision.kind).toBe('deny')
    expect(c1.executed).toBe(0)
    expect(c1.reason.includes('rose to')).toBe(true)
    expect(c1.reason.includes('not consumed')).toBe(true)
    // THE durable claim: the human's allow is still exactly what it was, and
    // nothing was consumed or abandoned. The terminal state is an
    // observation, not a second verdict.
    expect(c1.consumptions).toBe(0)
    expect(c1.decisions).toHaveLength(1)
    expect(c1.decisions[0]?.decision).toBe('allow')
    // The whole footprint, stated exactly: one leg (closed as `decided`), the
    // human's allow, NO consumption row and no abandonment. The drift is
    // recorded as a derived terminal observation, never as a rewritten or
    // additional durable verdict.
    expect(c1.rows).toEqual([
      'request:leader-approval:decided',
      'decision:allow',
    ])
  })

  it('C2: the capability vanishing after the allow is execution-unavailable, not a permission loss', () => {
    expect(c2.reason.length).toBeGreaterThan(0)
    expect(c2.executed).toBe(0)
    expect(c2.reason.startsWith(PRE_EXECUTE_CAPABILITY_REASON_PREFIX)).toBe(true)
    expect(c2.reason.includes(PRE_EXECUTE_CAPABILITY_ERROR_CODES.EXTERNAL_RUNTIME_RESTRICTION)).toBe(true)
    expect(c2.reason.includes(CONTROL_GUARD_BLOCK_REASONS.EXTERNAL_POLICY)).toBe(true)
    expect(c2.reason.includes('permission denied')).toBe(false)
    expect(c2.consumptions).toBe(0)
    expect(c2.decisions).toHaveLength(1)
    expect(c2.decisions[0]?.decision).toBe('allow')
    // Same footprint discipline as C1: the allow is untouched, and the lost
    // capability spent nothing.
    expect(c2.rows).toEqual(['request:leader-approval:decided', 'decision:allow'])
  })

  it('C3: the exact invocation consumes the allow exactly once, and a replay is refused', () => {
    expect(c3.kind).toBe('allow')
    expect(c3.executed).toBe(1)
    expect(c3.firstConsumptions).toBe(1)
    expect(c3.replayAllowed).toBe(false)
    // The OBSERVED law: once the allow is consumed the row is closed, so a
    // replay finds no open request to consume (`no-request`) rather than an
    // `allow-consumed` hit on an open row. Either way the replay is refused,
    // and the point this case guards is the count below: the refusal spent
    // nothing further.
    expect(c3.replayReason).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
    // The refusal did not spend anything further.
    expect(c3.replayConsumptions).toBe(1)
  })

  it('C4: a failed tool body does not refund the allow — the retry needs its own approval', () => {
    expect(c4.firstKind).toBe('deny')
    // The attempt spent the one-shot even though the body failed.
    expect(c4.failureConsumptions).toBe(1)
    expect(c4.failureRows).toEqual([
      'request:leader-approval:decided',
      'decision:allow',
      `consumption:${c4.firstRequestId}`,
    ])
    // The retry could not reuse it: it opened its OWN request...
    expect(c4.retryExecuted).toBe(0)
    expect(c4.retryRows).toEqual([
      'request:leader-approval:decided',
      'request:leader-approval:pending',
      'decision:allow',
      `consumption:${c4.firstRequestId}`,
    ])
  })

  it('C5: every terminal state the adapter reports is a member of the frozen vocabulary', () => {
    const reported = [...c1.terminal, ...c2.terminal, ...c3.terminal, ...c4.terminal]
    expect(reported.length).toBeGreaterThan(0)
    const outcomes = reported.map((o) => o['outcome'])
    for (const outcome of outcomes) {
      expect(TERMINAL_OPERATION_OUTCOME_VALUES).toContain(outcome)
    }
    // And the four arms this lane distinguishes are actually present, so the
    // membership loop above is not vacuous.
    expect(outcomes).toContain('stale')
    expect(outcomes).toContain('execution-unavailable')
    expect(outcomes).toContain('execution-succeeded')
    // C1 names the rung that rose; C2 names where the capability was lost.
    const stale = c1.terminal.find((o) => o['outcome'] === 'stale')
    expect(stale?.['requiredNow']).toBe('human-admin')
    expect(stale?.['reviewAuthority']).toBe('leader')
    const unavailable = c2.terminal.find((o) => o['outcome'] === 'execution-unavailable')
    expect(unavailable?.['via']).toBe('guard-external-policy')
    const failed = c4.terminal.find((o) => o['outcome'] === 'execution-unavailable')
    expect(failed?.['via']).toBe('tool-body-denied')
  })

  it('C6: the recheck comparison — equal is covered, a rise is stale, unknown is not confirmed', () => {
    // EQUAL IS NOT HIGHER: the same rung that signed still covers. (This is
    // the ladder's own rule, and the reason a same-level approval cannot
    // appear anywhere it is derived.)
    expect(c6.equal.kind).toBe('still-covered')
    expect(c6.risen.kind).toBe('stale')
    if (c6.risen.kind !== 'stale') return
    expect(c6.risen.requiredNow).toBe('human-user')
    // A LOWER requirement does not invalidate a higher approval.
    expect(c6.fallen.kind).toBe('still-covered')
    // "Could not confirm" is not "confirmed".
    expect(c6.undetermined.kind).toBe('undetermined')
    // A pre-v3 fresh answer cannot invent a drift.
    expect(c6.legacy.kind).toBe('still-covered')
    // A requirement that fell to what the actor already holds is covered.
    expect(c6.direct.kind).toBe('still-covered')
  })
})
