/**
 * a4p4-capability-vs-permission.test.ts — A4-PR4 lane B (plan Task 4,
 * "runtime capability separation"; spec §12.1 execution order, §13 typed
 * capability/environment families, §12.2 single-shot).
 *
 * THE LAW UNDER TEST. An external runtime constraint (a host hard cell, an
 * allow-list that excludes the tool, a `capabilityExists: false`, a faulting
 * facts probe) is an EXECUTION CAPABILITY/ENVIRONMENT outcome, never a Team
 * permission denial and never an approval escalation. Concretely:
 *
 *  B1  capability unavailable at PREFLIGHT -> NO control request is written
 *      (pre-fix: the ask path creates a durable `leader-approval` row and
 *      waits for a human to approve an operation the HOST already forbids —
 *      the row is unapprovable-in-fact, and the caller's outcome is an
 *      approval-wait cancellation, i.e. the permission vocabulary is used
 *      for an environment fact);
 *  B2  a STATIC permission allow + an unavailable capability -> the typed
 *      capability family, NOT the permission-denied wording (the decision
 *      the Team made was ALLOW; what stopped the call was the host);
 *  B3  `capabilityExists: false` behaves the same way (zero rows, zero
 *      execution, capability family);
 *  B4  the separation must not SWALLOW permission: with the capability
 *      available and an `ask` rule, the durable approval case is still
 *      created and the outcome stays in the permission vocabulary;
 *  B5  a FAULTING facts probe fails closed through the same family with
 *      zero rows (fail-closed is preserved by the move earlier);
 *  B6  the check is NOT added to the durable permission MUTATION lane
 *      (spec §13 is about executing an operation; a mutation proposal is
 *      reviewed by authority, not by the host's tool cell) — a structural
 *      pin over the mutation lane's own sources;
 *  B7  the LAST-MILE recheck is RETAINED (spec §12.1 keeps BOTH the
 *      preflight and the recheck): one static-allow execution probes the
 *      external facts TWICE, not once — deleting the recheck to "avoid the
 *      duplicate" reddens this case.
 *
 * THE DISCLOSED LIMIT OF THE FAMILY SPLIT (reported, not hidden): the frozen
 * read-only verdict (`ControlExternalVerdict`) is `{allowed:false, reason:
 * free-text}` and folds EVERY fail-closed case (hard deny, unnamed
 * allow-list item, `capabilityExists:false`, faulting probe, malformed
 * facts) into that one shape. `CAPABILITY_UNAVAILABLE` and
 * `HOST_ENVIRONMENT_UNAVAILABLE` are therefore NOT separately reachable
 * through it, and this PR declares no code it cannot emit (declaring an
 * outcome arm no input can produce is the defect class `governance/
 * runtime-authority.ts:130-137` names). Splitting them needs a verdict-shape
 * change in `packages/runtime/control/types.ts`, which is outside Task 4's
 * `Files:`.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim — see the a5a header):
 * every async scenario runs at MODULE level with top-level await and
 * captures its results; the `it` bodies are synchronous assertions.
 *
 * SELF-CLEANLINESS: inside the P4-T6 whole-tree scanner's scope
 * (`packages/**`); no legacy Team SessionEvent denylist token appears.
 *
 * @module @dsh-agent-team/runtime/test/a4p4-capability-vs-permission
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createControlService } from '../control/index.js'
import type { ControlService } from '../control/index.js'
import {
  PRE_EXECUTE_CAPABILITY_ERROR_CODES,
  installParameterPermissionListener,
} from '../operation-permission/index.js'
import type {
  PreExecuteExec,
  PreToolDecisionLike,
} from '../operation-permission/index.js'
import type { ExternalPolicyFacts } from '../../domain/policy/src/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

// ---------------------------------------------------------------------------
// The fake agent ctx (the a5a double, minimal copy: one listener, one guard).
// ---------------------------------------------------------------------------

interface FakeAgentCtx {
  on: (event: string, listener: (exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>) => () => void
  tools: { guard: (guard: (exec: { name: string }) => string | undefined) => () => void }
  trigger: (exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>
}

function makeFakeAgentCtx(): FakeAgentCtx {
  const listeners: Array<(exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>> = []
  const on = (
    event: string,
    listener: (exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>,
  ): (() => void) => {
    listeners.push(listener)
    return () => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    }
  }
  return {
    on,
    tools: { guard: () => () => undefined },
    trigger: async (exec, next) => {
      const listener = listeners[0]
      if (listener === undefined) throw new Error('fake ctx: no listener registered')
      return listener(exec, next)
    },
  }
}

/** The deterministic fake resolver (stable `file:///` keys, no real fs). */
async function fakeResolve(path: string): Promise<{ readonly key: string; readonly display: string }> {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/')
  return { key: `file:///${normalized}`, display: path }
}

function makeExec(args: {
  readonly name: string
  readonly arguments?: unknown
  readonly callId: string
  readonly signal?: AbortSignal
}): PreExecuteExec {
  return {
    callId: args.callId,
    name: args.name,
    arguments: args.arguments ?? {},
    signal: args.signal ?? new AbortController().signal,
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

// ---------------------------------------------------------------------------
// The mutable external-policy port (the a2c4 pattern, own copy).
// ---------------------------------------------------------------------------

interface MutableExternal {
  readonly facts: () => Promise<ExternalPolicyFacts>
  set: (next: ExternalPolicyFacts) => void
  setThrowing: (throwing: boolean) => void
  calls: () => number
}

function mutableExternal(initial: ExternalPolicyFacts): MutableExternal {
  let current = initial
  let throwing = false
  let probeCalls = 0
  return {
    set: (next) => {
      current = next
    },
    setThrowing: (value) => {
      throwing = value
    },
    calls: () => probeCalls,
    facts: async () => {
      probeCalls += 1
      if (throwing) throw new Error('a4p4-injected: external facts probe failure')
      return current
    },
  }
}

// ---------------------------------------------------------------------------
// One environment: a fresh P6-T4 world + the REAL control service + ONE
// adapter install on a fake ctx.
// ---------------------------------------------------------------------------

interface Env {
  readonly world: P6T1World
  readonly service: ControlService
  readonly ctx: FakeAgentCtx
  readonly external: MutableExternal
  readonly disposer: () => void
}

async function createEnv(
  basename: string,
  options: { readonly policy: TemplatePermissionPolicy; readonly external: MutableExternal },
): Promise<Env> {
  const world = await createP6T4World(basename, ['leader', 'worker'], {
    externalPolicyFacts: options.external.facts,
  })
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: options.external.facts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 10,
  })
  const ctx = makeFakeAgentCtx()
  const disposer = installParameterPermissionListener(ctx, {
    policy: options.policy,
    resolveTarget: fakeResolve,
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    targetInstanceId: WORKER_ID,
    isLeader: false,
  })
  return { world, service, ctx, external: options.external, disposer }
}

const ALLOW_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'exact', path: 'fileA.txt' } }],
  ask: [],
  deny: [],
}

const ASK_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [],
  ask: [{ tool: 'read', resource: { kind: 'any' } }],
  deny: [],
}

/** The hard cell that forbids the whole `tools` capability. */
const HARD_DENY_TOOLS: ExternalPolicyFacts = { hard: { tools: { kind: 'deny' } }, capabilityExists: {} }
const NO_HOST_RESTRICTION: ExternalPolicyFacts = { hard: {}, capabilityExists: {} }

const CONTROL_ROW_FACT_TYPES = [
  'control-request-created',
  'control-decision-recorded',
  'control-allow-consumed',
  'control-request-abandoned',
  'control-escalation-recorded',
] as const

/** Every durable control-plane fact in the team chain (any kind, any state). */
async function controlRows(env: Env): Promise<string[]> {
  const state = await env.service.listControlState(P6T4_ROOT)
  const rows = [...state.requests.map((r) => `request:${r.kind}:${r.status}`)]
  for (const decision of state.decisions) rows.push(`decision:${decision.decision}`)
  for (const consumption of state.consumptions) rows.push(`consumption:${consumption.requestId}`)
  for (const abandonment of state.abandonments) rows.push(`abandonment:${abandonment.requestId}`)
  return rows
}

// ===========================================================================
// B1 — unavailable at preflight: NO control request, capability outcome.
// ===========================================================================

const b1 = await (async () => {
  const external = mutableExternal(HARD_DENY_TOOLS)
  const env = await createEnv('a4p4-b1', { policy: ASK_POLICY, external })
  try {
    // The wait is bounded by an abort timer: pre-fix the pipeline creates a
    // durable request and waits for a human; post-fix it never gets there.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 40)
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'b1-call', signal: controller.signal }),
      next.fn,
    )
    clearTimeout(timer)
    const rows = await controlRows(env)
    return { decision, executed: next.calls(), rows, probes: external.calls() }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// B2 — a static allow + an unavailable capability: the capability family.
// ===========================================================================

const b2 = await (async () => {
  const external = mutableExternal(HARD_DENY_TOOLS)
  const env = await createEnv('a4p4-b2', { policy: ALLOW_POLICY, external })
  try {
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'b2-call' }),
      next.fn,
    )
    return { decision, executed: next.calls(), rows: await controlRows(env) }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// B3 — `capabilityExists: false` (the capability is not on the host).
// ===========================================================================

const b3 = await (async () => {
  const external = mutableExternal({ hard: {}, capabilityExists: { tools: false } })
  const env = await createEnv('a4p4-b3', { policy: ALLOW_POLICY, external })
  try {
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'b3-call' }),
      next.fn,
    )
    return { decision, executed: next.calls(), rows: await controlRows(env) }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// B4 — the separation does not swallow permission: ask -> durable case.
// ===========================================================================

const b4 = await (async () => {
  const external = mutableExternal(NO_HOST_RESTRICTION)
  const env = await createEnv('a4p4-b4', { policy: ASK_POLICY, external })
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 40)
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'b4-call', signal: controller.signal }),
      next.fn,
    )
    clearTimeout(timer)
    const state = await env.service.listControlState(P6T4_ROOT)
    return {
      decision,
      executed: next.calls(),
      pendingKinds: state.requests.filter((r) => r.status === 'pending').map((r) => r.kind),
    }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// B5 — a faulting facts probe: fail closed through the same family.
// ===========================================================================

const b5 = await (async () => {
  const external = mutableExternal(NO_HOST_RESTRICTION)
  external.setThrowing(true)
  const env = await createEnv('a4p4-b5', { policy: ASK_POLICY, external })
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 40)
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'b5-call', signal: controller.signal }),
      next.fn,
    )
    clearTimeout(timer)
    return { decision, executed: next.calls(), rows: await controlRows(env) }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// B7 — the last-mile recheck survives the preflight (two probes, one call).
// ===========================================================================

const b7 = await (async () => {
  const external = mutableExternal(NO_HOST_RESTRICTION)
  const env = await createEnv('a4p4-b7', { policy: ALLOW_POLICY, external })
  try {
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'b7-call' }),
      next.fn,
    )
    return { decision, executed: next.calls(), probes: external.calls(), rows: await controlRows(env) }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// B6 — the durable permission MUTATION lane gains no capability check.
// ===========================================================================

const MUTATION_LANE_SOURCES = [
  '../governance/service.ts',
  '../governance/permission-mutation.ts',
  '../permission-lifecycle/mutation-lane.ts',
  '../src/plugin/permission-plane.ts',
] as const

const HERE = dirname(fileURLToPath(import.meta.url))

const b6 = MUTATION_LANE_SOURCES.map((relativePath) => {
  const source = readFileSync(join(HERE, relativePath), 'utf8')
  return {
    file: relativePath,
    mentionsPreflight: /preflightRuntimeCapability|PRE_EXECUTE_CAPABILITY_ERROR_CODES/.test(source),
    mentionsExternalCheck: /checkExternalOperation/.test(source),
  }
})

const reasonOf = (decision: PreToolDecisionLike): string =>
  (decision as { reason?: string }).reason ?? ''

describe('a4p4 lane B — capability/environment outcomes are not permission outcomes', () => {
  it('B1: a capability unavailable at preflight writes NO control request and answers in the capability family', () => {
    expect(b1.executed).toBe(0)
    expect(b1.decision.kind).toBe('deny')
    // The durable footprint is EMPTY: no request, no decision, no abandon.
    expect(b1.rows).toEqual([])
    for (const factType of CONTROL_ROW_FACT_TYPES) {
      expect(b1.rows.join(',')).not.toContain(factType)
    }
    // And the outcome names the capability family, not the permission one.
    expect(reasonOf(b1.decision)).toContain(PRE_EXECUTE_CAPABILITY_ERROR_CODES.EXTERNAL_RUNTIME_RESTRICTION)
    expect(reasonOf(b1.decision)).not.toContain('permission denied')
    expect(reasonOf(b1.decision)).not.toContain('approval wait')
  })

  it('B2: a static Team allow + an unavailable capability is a capability outcome, not a permission denial', () => {
    expect(b2.executed).toBe(0)
    expect(b2.rows).toEqual([])
    expect(reasonOf(b2.decision)).toContain(PRE_EXECUTE_CAPABILITY_ERROR_CODES.EXTERNAL_RUNTIME_RESTRICTION)
    // The Team decided ALLOW; the reason must not read as a permission denial.
    expect(reasonOf(b2.decision)).not.toContain('permission denied')
  })

  it('B3: a host without the capability behaves the same way (zero rows, zero execution)', () => {
    expect(b3.executed).toBe(0)
    expect(b3.rows).toEqual([])
    expect(reasonOf(b3.decision)).toContain(PRE_EXECUTE_CAPABILITY_ERROR_CODES.EXTERNAL_RUNTIME_RESTRICTION)
  })

  it('B4: with the capability available an `ask` still opens the durable approval case (permission is not swallowed)', () => {
    expect(b4.executed).toBe(0)
    expect(b4.pendingKinds).toEqual(['leader-approval'])
    expect(reasonOf(b4.decision)).not.toContain(PRE_EXECUTE_CAPABILITY_ERROR_CODES.EXTERNAL_RUNTIME_RESTRICTION)
  })

  it('B5: a faulting external facts probe fails closed through the capability family with zero rows', () => {
    expect(b5.executed).toBe(0)
    expect(b5.rows).toEqual([])
    expect(reasonOf(b5.decision)).toContain(PRE_EXECUTE_CAPABILITY_ERROR_CODES.EXTERNAL_RUNTIME_RESTRICTION)
  })

  it('B6: the durable permission mutation lane carries no capability preflight (spec 13 is an execution concern)', () => {
    for (const entry of b6) {
      expect(entry.mentionsPreflight, `${entry.file} must not call the operation capability preflight`).toBe(false)
    }
  })

  it('B7: the preflight is ADDITIVE — the last-mile external recheck is retained (two probes per allowed call)', () => {
    expect(b7.executed).toBe(1)
    expect(b7.rows).toEqual([])
    // One preflight + one last-mile recheck. A "deduplicated" single probe
    // would mean the last-mile check was deleted (spec 12.1 keeps both).
    expect(b7.probes).toBe(2)
  })
})
