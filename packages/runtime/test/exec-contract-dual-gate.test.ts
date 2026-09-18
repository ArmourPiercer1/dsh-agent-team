/**
 * exec-contract-dual-gate.test.ts — exec-autonomy-contract (user ruling
 * 2026-09-18) MUST-TEST: the pre-execute DUAL GATE over the REAL A4
 * control service (durable P6-T4 world — the same integration level as
 * a5a-pre-execute.test.ts) with a FAKE agent ctx and a DETERMINISTIC
 * FAKE resolver.
 *
 * The contract under test: a LEADER exec-class ALLOW (bash / pwsh — the
 * shell class; the leader allow-lane whole-tool rule is the only
 * contract path to an exec ALLOW) stands ONLY when the leader's
 * effective mutation envelope carries the matching exec token
 * (`execEnvelopeOps` — teamEnvelope ∩ the leader template's
 * memberEnvelopes entry, fail-closed). A missing token (or an absent
 * option) DOWNGRADES the allow into the existing ask path
 * (`user-approval` for the leader install — the human-only resolver
 * closure); zero effect until the human approves. Members are untouched:
 * their exec ask already routes to `leader-approval` (the leader
 * decides; the human may stand in).
 *
 * Scenario map:
 *  G1  leader + allow-lane bash rule + envelope carries 'bash'
 *      → ALLOW: next once, ZERO control rows, no downgrade observation;
 *  G2  leader + allow-lane bash rule + envelope WITHOUT 'bash'
 *      → DOWNGRADE: the ask path settles it — a durable
 *      `user-approval` row (kind pin), next never runs before the
 *      approval, the human's allow unblocks (next once, exactly once),
 *      the downgrade observation row is emitted;
 *  G3  leader + allow-lane bash AND pwsh rules + envelope 'pwsh' only
 *      → token independence: the bash call DOWNGRADES (user-approval
 *      row), the pwsh call ALLOWS (next once, zero rows);
 *  G4  leader + ASK-lane bash rule (no allow rule) → the ask path
 *      directly (kind `user-approval`), NO downgrade observation
 *      (the gate intercepts only static ALLOW decisions);
 *  G5  leader + DENY-lane bash rule → static deny (next never, zero
 *      rows, no downgrade observation — deny > everything);
 *  G6  member + ask-lane bash rule → ask routes to `leader-approval`
 *      (the routing is UNCHANGED by this contract — the verification
 *      pin the user ruling requires);
 *  F1  leaderExecEnvelopeOps formula table (pure): absent teamEnvelope
 *      → ∅; ∩ ENVELOPE_EXEC_OPS; team deny; the leader template's
 *      memberEnvelopes entry tightens (allow-minus-deny, only when
 *      present); a MEMBER template entry never applies to the leader
 *      computation.
 *
 * RUNNER CONSTRAINTS (repo convention, see a5a-pre-execute.test.ts
 * header): every async scenario runs at MODULE level (top-level await)
 * and captures its results; the `it` bodies are pure synchronous
 * assertions. Shim matchers used: toBe / toEqual (+.not) only.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`) — no legacy Team SessionEvent denylist token
 * may appear in this source.
 *
 * @module @dsh-agent-team/runtime/test/exec-contract-dual-gate
 */
import { describe, expect, it } from 'vitest'

import {
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import { installParameterPermissionListener } from '../operation-permission/index.js'
import type {
  GuardExecLike,
  PreExecuteExec,
  PreToolDecisionLike,
} from '../operation-permission/index.js'
import {
  ENVELOPE_EXEC_OPS,
  leaderExecEnvelopeOps,
} from '../admission/envelope.js'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import type {
  TeamBlueprint,
  TemplatePermissionPolicy,
} from '../../domain/blueprint/src/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)

// ---------------------------------------------------------------------------
// Minimal fake agent ctx (the a5a double, reduced to what the install
// needs: on + the tools.guard seam + one trigger helper).
// ---------------------------------------------------------------------------

type PreExecuteListener = (
  exec: PreExecuteExec,
  next: () => Promise<PreToolDecisionLike>,
) => Promise<PreToolDecisionLike>
/** The monotonic end-cap guard (the upstream ToolGuard shape: the denial
 * reason, or undefined to pass). */
type GuardFn = (exec: GuardExecLike) => string | undefined

interface FakeAgentCtx {
  readonly on: (event: string, listener: PreExecuteListener) => () => void
  readonly tools: { readonly guard: (guard: GuardFn) => () => void }
  /** Invoke the installed listener with a fresh exec + next spy. */
  readonly trigger: (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ) => Promise<PreToolDecisionLike>
}

function makeFakeAgentCtx(): FakeAgentCtx {
  const listeners: PreExecuteListener[] = []
  const guards: GuardFn[] = []
  const on = (event: string, listener: PreExecuteListener): (() => void) => {
    listeners.push(listener)
    return (): void => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    }
  }
  const guard = (fn: GuardFn): (() => void) => {
    guards.push(fn)
    return (): void => {
      const index = guards.indexOf(fn)
      if (index >= 0) guards.splice(index, 1)
    }
  }
  const trigger = async (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ): Promise<PreToolDecisionLike> => {
    const listener = listeners[0]
    if (listener === undefined) throw new Error('exec-gate fake ctx: no listener registered')
    return listener(exec, next)
  }
  return { on, tools: { guard }, trigger }
}

/** The deterministic fake resolver (bash is tool-level: never called
 * for the scenarios below; required by the install options). */
const FAKE_RESOLVER = async (path: string) => ({ key: `file:///${path}`, display: path })

function makeExec(name: string, arguments_: unknown, callId: string): PreExecuteExec {
  return {
    callId,
    name,
    arguments: arguments_ ?? {},
    signal: new AbortController().signal,
  }
}

function makeNext(): { readonly fn: () => Promise<PreToolDecisionLike>; calls: () => number } {
  let count = 0
  return {
    fn: async (): Promise<PreToolDecisionLike> => {
      count += 1
      return { kind: 'allow' }
    },
    calls: () => count,
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForRequest(
  service: ControlService,
  correlation: string,
): Promise<ControlRequestRecord> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const state = await service.listControlState(P6T4_ROOT)
    const found = state.requests.find((r) => r.correlation === correlation)
    if (found !== undefined) return found
    await sleep(5)
  }
  throw new Error(`exec-gate: no durable control request for '${correlation}' after 1 s`)
}

async function requestCount(service: ControlService): Promise<number> {
  return (await service.listControlState(P6T4_ROOT)).requests.length
}

// ---------------------------------------------------------------------------
// The install environment (one world + one REAL control service + one
// adapter install on a fake ctx).
// ---------------------------------------------------------------------------

interface EnvOptions {
  readonly policy: TemplatePermissionPolicy
  readonly isLeader: boolean
  /** The DUAL GATE input (leader installs only — absent = no exec
   * authorization, fail-closed). */
  readonly execEnvelopeOps?: readonly string[]
}

interface Env {
  readonly service: ControlService
  readonly ctx: FakeAgentCtx
  readonly observations: Record<string, unknown>[]
}

async function createEnv(basename: string, options: EnvOptions): Promise<{ env: Env; world: P6T1World }> {
  const world = await createP6T4World(basename, ['leader', 'worker'])
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 10,
  })
  const ctx = makeFakeAgentCtx()
  const observations: Record<string, unknown>[] = []
  const isLeader = options.isLeader
  const caller = isLeader ? leaderCaller() : memberCaller(WORKER_ID)
  const targetInstanceId = isLeader ? LEADER_ID : WORKER_ID
  installParameterPermissionListener(ctx, {
    policy: options.policy,
    resolveTarget: FAKE_RESOLVER,
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller,
    targetInstanceId,
    isLeader,
    ...(options.execEnvelopeOps !== undefined ? { execEnvelopeOps: options.execEnvelopeOps } : {}),
    onObserve: (observation) => {
      observations.push(observation)
    },
  })
  return { env: { service, ctx, observations }, world }
}

const hasDowngrade = (observations: Record<string, unknown>[]): boolean =>
  observations.some((row) => row['stage'] === 'exec-envelope-downgrade')

// ===========================================================================
// G1 — leader + allow-lane bash rule + envelope carries 'bash' → ALLOW.
// ===========================================================================

const G1_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [{ tool: 'bash', resource: { kind: 'any' } }],
  ask: [],
  deny: [],
}

const G1 = await (async () => {
  const { env, world } = await createEnv('xec-g1', {
    policy: G1_POLICY,
    isLeader: true,
    execEnvelopeOps: ['bash'],
  })
  const next = makeNext()
  const result = await env.ctx.trigger(
    makeExec('bash', { command: 'echo hello' }, 'xec-g1-bash'),
    next.fn,
  )
  const rows = await requestCount(env.service)
  const downgrade = hasDowngrade(env.observations)
  await destroyP6T1World(world)
  return { result, nextCalls: next.calls(), rows, downgrade }
})()

// ===========================================================================
// G2 — leader + allow-lane bash rule + envelope WITHOUT 'bash' →
// DOWNGRADE to the user-approval ask path (zero effect until approval).
// ===========================================================================

const G2 = await (async () => {
  const { env, world } = await createEnv('xec-g2', {
    policy: G1_POLICY,
    isLeader: true,
    // The leader's effective envelope carries NO exec token (fail-closed:
    // this is what an absent option means too — G2a below pins absent).
    execEnvelopeOps: [],
  })
  const next = makeNext()
  const pending = env.ctx.trigger(makeExec('bash', { command: 'echo hello' }, 'xec-g2-bash'), next.fn)
  // The durable row exists and is the LEADER install's kind.
  const request = await waitForRequest(env.service, 'xec-g2-bash')
  const rowsAfterTrigger = await requestCount(env.service)
  const kind = request.kind
  const nextBeforeApproval = next.calls()
  // The human (the ONLY resolver of a user-approval row) approves.
  await env.service.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: humanCaller(),
    requestId: request.requestId,
    decision: 'allow',
  })
  const result = await pending
  const nextAfterApproval = next.calls()
  const downgrade = hasDowngrade(env.observations)
  await destroyP6T1World(world)
  return {
    rowsAfterTrigger,
    kind,
    nextBeforeApproval,
    result,
    nextAfterApproval,
    downgrade,
  }
})()

// G2a — the SAME scenario with the option ABSENT (signature
// compatibility must fail closed identically).
const G2A = await (async () => {
  const { env, world } = await createEnv('xec-g2a', {
    policy: G1_POLICY,
    isLeader: true,
    // no execEnvelopeOps option at all
  })
  const next = makeNext()
  const pending = env.ctx.trigger(makeExec('bash', { command: 'echo hello' }, 'xec-g2a-bash'), next.fn)
  const request = await waitForRequest(env.service, 'xec-g2a-bash')
  const kind = request.kind
  await env.service.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: humanCaller(),
    requestId: request.requestId,
    decision: 'deny',
  })
  const result = await pending
  await destroyP6T1World(world)
  return { kind, result, nextCalls: next.calls() }
})()

// ===========================================================================
// G3 — token independence: envelope 'pwsh' only → the bash call
// DOWNGRADES, the pwsh call ALLOWS.
// ===========================================================================

const G3_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [
    { tool: 'bash', resource: { kind: 'any' } },
    { tool: 'pwsh', resource: { kind: 'any' } },
  ],
  ask: [],
  deny: [],
}

const G3 = await (async () => {
  const { env, world } = await createEnv('xec-g3', {
    policy: G3_POLICY,
    isLeader: true,
    execEnvelopeOps: ['pwsh'],
  })
  // The bash call: gated → user-approval row (deny it to keep the flow
  // deterministic).
  const nextBash = makeNext()
  const bashPending = env.ctx.trigger(
    makeExec('bash', { command: 'echo b' }, 'xec-g3-bash'),
    nextBash.fn,
  )
  const bashRequest = await waitForRequest(env.service, 'xec-g3-bash')
  const bashKind = bashRequest.kind
  await env.service.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: humanCaller(),
    requestId: bashRequest.requestId,
    decision: 'deny',
  })
  const bashResult = await bashPending
  // The pwsh call: the envelope carries 'pwsh' → ALLOW, zero rows.
  const nextPwsh = makeNext()
  const pwshResult = await env.ctx.trigger(
    makeExec('pwsh', { command: 'echo p' }, 'xec-g3-pwsh'),
    nextPwsh.fn,
  )
  const rows = await requestCount(env.service)
  const downgrades = env.observations.filter((row) => row['stage'] === 'exec-envelope-downgrade').length
  await destroyP6T1World(world)
  return {
    bashKind,
    bashResult,
    bashNext: nextBash.calls(),
    pwshResult,
    pwshNext: nextPwsh.calls(),
    rows,
    downgrades,
  }
})()

// ===========================================================================
// G4 — leader + ASK-lane bash rule → the ask path directly (the gate
// intercepts only static ALLOW decisions — no downgrade observation).
// ===========================================================================

const G4_POLICY: TemplatePermissionPolicy = {
  default: 'ask',
  allow: [],
  ask: [{ tool: 'bash', resource: { kind: 'any' } }],
  deny: [],
}

const G4 = await (async () => {
  const { env, world } = await createEnv('xec-g4', {
    policy: G4_POLICY,
    isLeader: true,
    execEnvelopeOps: ['bash'],
  })
  const next = makeNext()
  const pending = env.ctx.trigger(makeExec('bash', { command: 'echo g4' }, 'xec-g4-bash'), next.fn)
  const request = await waitForRequest(env.service, 'xec-g4-bash')
  const kind = request.kind
  const downgrade = hasDowngrade(env.observations)
  await env.service.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: humanCaller(),
    requestId: request.requestId,
    decision: 'deny',
  })
  const result = await pending
  await destroyP6T1World(world)
  return { kind, downgrade, result, nextCalls: next.calls() }
})()

// ===========================================================================
// G5 — leader + DENY-lane bash rule → static deny (deny > everything).
// ===========================================================================

const G5_POLICY: TemplatePermissionPolicy = {
  default: 'ask',
  allow: [{ tool: 'bash', resource: { kind: 'any' } }],
  ask: [],
  deny: [{ tool: 'bash', resource: { kind: 'any' } }],
}

const G5 = await (async () => {
  const { env, world } = await createEnv('xec-g5', {
    policy: G5_POLICY,
    isLeader: true,
    execEnvelopeOps: ['bash'],
  })
  const next = makeNext()
  const result = await env.ctx.trigger(
    makeExec('bash', { command: 'echo g5' }, 'xec-g5-bash'),
    next.fn,
  )
  const rows = await requestCount(env.service)
  const downgrade = hasDowngrade(env.observations)
  await destroyP6T1World(world)
  return { result, nextCalls: next.calls(), rows, downgrade }
})()

// ===========================================================================
// G6 — member + ask-lane bash rule → ask routes to `leader-approval`
// (the routing is UNCHANGED — the verification pin of the ruling).
// ===========================================================================

const G6_POLICY: TemplatePermissionPolicy = {
  default: 'ask',
  allow: [],
  ask: [{ tool: 'bash', resource: { kind: 'any' } }],
  deny: [],
}

const G6 = await (async () => {
  const { env, world } = await createEnv('xec-g6', {
    policy: G6_POLICY,
    isLeader: false,
    // Member installs: the option is not passed (the adapter ignores it).
  })
  const next = makeNext()
  const pending = env.ctx.trigger(makeExec('bash', { command: 'echo g6' }, 'xec-g6-bash'), next.fn)
  const request = await waitForRequest(env.service, 'xec-g6-bash')
  const kind = request.kind
  // The LEADER resolves (the leader decides; the human may stand in).
  await env.service.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: leaderCaller(),
    requestId: request.requestId,
    decision: 'allow',
  })
  const result = await pending
  await destroyP6T1World(world)
  return { kind, result, nextCalls: next.calls() }
})()

// ===========================================================================
// F1 — the leaderExecEnvelopeOps formula table (pure).
// ===========================================================================

function formulaSource(teamAllow: string[], teamDeny: string[], entries: string): string {
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: exec.formula',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    ...(teamAllow.length > 0 || teamDeny.length > 0
      ? [
          'teamEnvelope:',
          `  allow: [${teamAllow.join(', ')}]`,
          `  deny: [${teamDeny.join(', ')}]`,
        ]
      : []),
    ...(entries === '' ? [] : ['memberEnvelopes:', ...entries.split('\n')]),
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

function execOpsOf(source: string): readonly string[] {
  const blueprint = parseBlueprint(source) as TeamBlueprint
  return leaderExecEnvelopeOps(blueprint)
}

const LEADER_ENTRY = (allow: string[], deny: string[]): string =>
  `  - templateId: leader\n    envelope:\n      allow: [${allow.join(', ')}]\n      deny: [${deny.join(', ')}]`

// ===========================================================================
// Assertions (pure — the scenarios above captured their results).
// ===========================================================================

describe('exec-autonomy-contract: the pre-execute DUAL GATE (leader)', () => {
  it('G1: allow-lane bash rule + envelope carries bash → ALLOW (next once, zero rows, no downgrade)', () => {
    expect(G1.result.kind).toBe('allow')
    expect(G1.nextCalls).toBe(1)
    expect(G1.rows).toBe(0)
    expect(G1.downgrade).toBe(false)
  })

  it('G2: allow-lane bash rule + envelope WITHOUT bash → DOWNGRADE (user-approval row; zero effect until the human approves)', () => {
    // The durable row exists and is the LEADER install's kind.
    expect(G2.rowsAfterTrigger).toBe(1)
    expect(G2.kind).toBe(CONTROL_REQUEST_KINDS.USER_APPROVAL)
    // Zero effect before the approval: next never ran.
    expect(G2.nextBeforeApproval).toBe(0)
    // The human's allow unblocks: next exactly once, the result allows.
    expect(G2.result.kind).toBe('allow')
    expect(G2.nextAfterApproval).toBe(1)
    // The downgrade observation row is emitted (diagnostics, not authority).
    expect(G2.downgrade).toBe(true)
  })

  it('G2a: an ABSENT execEnvelopeOps option fails closed identically (the allow downgrades to user-approval; the human may deny)', () => {
    expect(G2A.kind).toBe(CONTROL_REQUEST_KINDS.USER_APPROVAL)
    expect(G2A.result.kind).toBe('deny')
    expect(G2A.nextCalls).toBe(0)
  })

  it('G3: token independence — envelope pwsh-only: bash DOWNGRADES (user-approval, denied), pwsh ALLOWS (zero rows)', () => {
    expect(G3.bashKind).toBe(CONTROL_REQUEST_KINDS.USER_APPROVAL)
    expect(G3.bashResult.kind).toBe('deny')
    expect(G3.bashNext).toBe(0)
    expect(G3.pwshResult.kind).toBe('allow')
    expect(G3.pwshNext).toBe(1)
    // Exactly ONE durable row (the gated bash call) — the pwsh allow
    // wrote none.
    expect(G3.rows).toBe(1)
    // Exactly ONE downgrade observation (the bash call only).
    expect(G3.downgrades).toBe(1)
  })

  it('G4: ask-lane bash rule → the ask path directly (kind user-approval, NO downgrade observation — the gate sees only static ALLOW)', () => {
    expect(G4.kind).toBe(CONTROL_REQUEST_KINDS.USER_APPROVAL)
    expect(G4.downgrade).toBe(false)
    expect(G4.result.kind).toBe('deny')
    expect(G4.nextCalls).toBe(0)
  })

  it('G5: deny-lane bash rule → STATIC DENY even with the envelope token (deny > allow > the gate)', () => {
    expect(G5.result.kind).toBe('deny')
    expect(G5.nextCalls).toBe(0)
    expect(G5.rows).toBe(0)
    expect(G5.downgrade).toBe(false)
  })
})

describe('exec-autonomy-contract: the member routing is UNCHANGED (verification pin)', () => {
  it('G6: member ask-lane bash rule → ask routes to leader-approval; the LEADER resolves (allow) and the exec runs', () => {
    expect(G6.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(G6.result.kind).toBe('allow')
    expect(G6.nextCalls).toBe(1)
  })
})

describe('exec-autonomy-contract: the leaderExecEnvelopeOps formula (pure)', () => {
  it('F1a: absent teamEnvelope → the empty set (fail closed)', () => {
    expect(execOpsOf(formulaSource([], [], ''))).toEqual([])
  })

  it('F1b: team allow intersected with the closed exec vocabulary (governance ops never leak in)', () => {
    expect(execOpsOf(formulaSource(['assign-task', 'bash', 'create-member'], [], ''))).toEqual(['bash'])
  })

  // NOTE (self-consistency, Architecture §5.5): an operation may not sit
  // in BOTH allow and deny of the SAME envelope, so the team/template
  // deny sets are defense-in-depth for valid blueprints — the reachable
  // tightening is the template entry's ALLOW intersection (below). The
  // formula still applies the denies (as callerEnvelope does) so a
  // malformed-but-parsed record can never grant beyond the allow-sets.
  it('F1c: the leader template entry tightens via its allow set (∩)', () => {
    expect(
      execOpsOf(formulaSource(['bash', 'pwsh'], [], LEADER_ENTRY(['bash'], []))),
    ).toEqual(['bash'])
    expect(
      execOpsOf(formulaSource(['bash', 'pwsh'], [], LEADER_ENTRY(['pwsh'], []))),
    ).toEqual(['pwsh'])
  })

  it('F1d: the leader template entry with an EMPTY allow set cuts the leader off entirely (∩ ∅)', () => {
    expect(
      execOpsOf(formulaSource(['bash', 'pwsh'], [], LEADER_ENTRY([], []))),
    ).toEqual([])
  })

  it('F1e: the leader template entry ABSENT → the team bounds stand (no further tightening)', () => {
    expect(execOpsOf(formulaSource(['bash', 'pwsh'], [], ''))).toEqual(['bash', 'pwsh'])
  })

  it('F1f: a MEMBER template entry never applies to the leader computation', () => {
    const source = [
      '---',
      'schemaVersion: 1',
      'blueprintId: exec.formula',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      'members:',
      '  - templateId: worker',
      '    persona: "Worker."',
      'teamEnvelope:',
      '  allow: [bash, pwsh]',
      '  deny: []',
      'memberEnvelopes:',
      '  - templateId: worker',
      '    envelope:',
      '      allow: [bash]',
      '      deny: []',
      'requirements: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    expect(execOpsOf(source)).toEqual(['bash', 'pwsh'])
  })

  it('F1g: the closed vocabulary is exactly the two separate shell tokens (bash authority != pwsh authority)', () => {
    expect([...ENVELOPE_EXEC_OPS]).toEqual(['bash', 'pwsh'])
  })
})
