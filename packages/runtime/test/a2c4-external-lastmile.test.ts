/**
 * a2c4-external-lastmile.test.ts — A2C-4 (alpha.2 capability-completion
 * round, plan §6) MUST-TEST: the EXTERNAL HARD LAST-MILE RECHECK.
 *
 * Frozen goal (plan §6.1): for EVERY alpha.2 managed operation — whether
 * a static permission `allow` or an ask→allow_once — the operation must
 * pass the CURRENT external hard policy as its final check before the
 * tool body runs. The pre-A2C-4 gaps this file proves (RED phase) and
 * closes (GREEN phase):
 *
 *   R1 — the static-allow path (`decision === 'allow'` → mark → next())
 *        carries ZERO external check: once the static resolver allows,
 *        a later external hard tightening cannot stop the execution.
 *   R2 — the ask path's final `guardOperation` does not re-read the
 *        external hard facts: a decision that was lawfully ALLOWED when
 *        recorded (the decision-time probe passed) still executes — and
 *        CONSUMES the one-shot allow — after the host policy tightened
 *        in between.
 *
 * Both probes use a MUTABLE `externalPolicyFacts()` provider (the same
 * port family the production wiring uses: `config.externalPolicyFacts`
 * read live on every probe — invariant 34: no Team decision, human
 * included, bypasses the external hard policy; the facts are read,
 * never cached).
 *
 * GREEN phase (this file's full scenario set, plan §6.5):
 *   G1  static allow + live external deny  -> zero execution;
 *   G2  static allow + allow-list that does not NAME the tool -> zero;
 *   G3  static allow + a THROWING facts provider -> fail closed;
 *   G4  static allow + a permissive/absent cell -> unchanged success
 *       (the check is consulted live; zero control rows either way);
 *   G5  ask allow + external tighten after the decision -> zero
 *       execution, ZERO allow consumption (the one-shot is not burned),
 *       no NEW durable control rows (the recheck is read-only);
 *   G6  the surviving one-shot: a retry under the tightened policy is
 *       still blocked without consumption; once the host relaxes, the
 *       SAME approval authorizes exactly once (exactly-once + scope/
 *       fingerprint identity preserved);
 *   G7  a HUMAN allow cannot beat the external hard at the last mile
 *       (decision stays a durable allow; the guard blocks; no new rows);
 *   G8  the shared read-only check (`checkExternalOperation`) semantics:
 *       hard cell / allow-list / capabilityExists:false / absent cell /
 *       explicit domain / thrown probe / malformed domain — all fail
 *       closed, never throw, never write a durable row;
 *   G9  hostile-prepend end-cap non-regression: an exec the external
 *       ceiling denied was NEVER marked by this install — the
 *       monotonic end-cap guard still denies it (H1 preserved).
 *
 * RED PHASE PROTOCOL (brief §5.2): the two probes below are written
 * against the PRE-FIX surface only (adapter trigger + guardOperation —
 * no A2C-4 API) and MUST fail on the base commit; their failure logs
 * are the RED evidence. The GREEN scenarios are added together with the
 * implementation and all turn green in one step.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim): every async
 * scenario runs at MODULE level (top-level await) and captures its
 * results; the `it` bodies are pure synchronous assertions. Shim
 * matchers used: toBe / toEqual (+.not) only.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does.
 *
 * @module @dsh-agent-team/runtime/test/a2c4-external-lastmile
 */
import { describe, expect, it } from 'vitest'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../control/index.js'
import type {
  ControlDecisionRecord,
  ControlGuardVerdict,
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
import {
  END_CAP_DENIAL_REASON,
  installParameterPermissionListener,
} from '../operation-permission/index.js'
import type {
  PreExecuteExec,
  PreToolDecisionLike,
} from '../operation-permission/index.js'
import type { CapabilityName, ExternalPolicyFacts } from '../../domain/policy/src/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  leaderCaller,
  makeScope,
  memberCaller,
  mutableExternalPolicyFacts,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

// ---------------------------------------------------------------------------
// The fake agent ctx (the a5a pattern, plus access to the registered
// end-cap guard fn for the G9 monotonicity assertion).
// ---------------------------------------------------------------------------

type PreExecuteListener = (
  exec: PreExecuteExec,
  next: () => Promise<PreToolDecisionLike>,
) => Promise<PreToolDecisionLike>

/** The minimal structural mirror of the guard the end-cap registers (H1). */
type GuardFn = (exec: { readonly name: string }) => string | undefined

interface FakeAgentCtx {
  readonly on: (event: string, listener: PreExecuteListener) => () => void
  readonly tools: { guard(guard: GuardFn): () => void }
  trigger: (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ) => Promise<PreToolDecisionLike>
  /** Every end-cap guard fn registered so far (for direct H1 probes). */
  guardFns: () => GuardFn[]
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
    if (listener === undefined) throw new Error('a2c4 fake ctx: no listener registered')
    return listener(exec, next)
  }
  return { on, tools: { guard }, trigger, guardFns: () => [...guards] }
}

// ---------------------------------------------------------------------------
// The deterministic fake resolver (a5a pattern: stable keys, no real fs).
// ---------------------------------------------------------------------------

function makeFakeResolver(): (path: string) => Promise<{ readonly key: string; readonly display: string }> {
  const normalize = (path: string): string =>
    path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/')
  return async (path: string) => ({ key: `file:///${normalize(path)}`, display: path })
}

/** One synthetic pre-execute payload. */
function makeExec(args: { readonly name: string; readonly arguments?: unknown; readonly callId: string }): PreExecuteExec {
  return {
    callId: args.callId,
    name: args.name,
    arguments: args.arguments ?? {},
    signal: new AbortController().signal,
  }
}

/** The spy next (records its call count; resolves the chain default allow). */
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

/** A real-timer sleep (the ask-path scenarios poll the durable state). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Poll the durable control state until the request for a correlation
 * appears (or the timeout — a test failure with the captured state). */
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
  throw new Error(`a2c4: no durable control request for correlation '${correlation}' after 1 s`)
}

/**
 * A counting mutable external facts holder (the GREEN scenarios pin that
 * the live probe is actually consulted — and, for the no-cell case, NOT
 * consulted).
 */
function countingMutableExternalPolicyFacts(initial: ExternalPolicyFacts): {
  readonly set: (facts: ExternalPolicyFacts) => void
  readonly facts: () => Promise<ExternalPolicyFacts>
  readonly calls: () => number
} {
  let current = initial
  let calls = 0
  return {
    set: (facts: ExternalPolicyFacts): void => {
      current = facts
    },
    facts: async (): Promise<ExternalPolicyFacts> => {
      calls += 1
      return current
    },
    calls: (): number => calls,
  }
}

/**
 * A mutable external facts holder that can be flipped to THROW on every
 * probe (the fail-closed-on-probe-failure scenarios, G3).
 */
function throwingMutableExternalPolicyFacts(initial: ExternalPolicyFacts): {
  readonly set: (facts: ExternalPolicyFacts) => void
  readonly setThrowing: (throwing: boolean) => void
  readonly facts: () => Promise<ExternalPolicyFacts>
} {
  let current = initial
  let throwing = false
  return {
    set: (facts: ExternalPolicyFacts): void => {
      current = facts
    },
    setThrowing: (value: boolean): void => {
      throwing = value
    },
    facts: async (): Promise<ExternalPolicyFacts> => {
      if (throwing) throw new Error('a2c4-injected: external facts probe failure')
      return current
    },
  }
}

// ---------------------------------------------------------------------------
// The install environment (one world + one REAL control service + one
// adapter install on a fake ctx — the a5a pattern).
// ---------------------------------------------------------------------------

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
    readonly policy: TemplatePermissionPolicy
    readonly externalPolicyFacts: () => Promise<import('../../domain/policy/src/index.js').ExternalPolicyFacts>
  },
): Promise<Env> {
  const world = await createP6T4World(basename, ['leader', 'worker'], {
    externalPolicyFacts: options.externalPolicyFacts,
  })
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 10,
  })
  const ctx = makeFakeAgentCtx()
  const observations: Record<string, unknown>[] = []
  const disposer = installParameterPermissionListener(ctx, {
    policy: options.policy,
    resolveTarget: makeFakeResolver(),
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    targetInstanceId: WORKER_ID,
    isLeader: false,
    onObserve: (observation) => {
      observations.push(observation)
    },
  })
  return { world, service, ctx, observations, disposer }
}

/** The W policy: a single static exact-allow (read fileA.txt), default deny. */
const STATIC_ALLOW_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'exact', path: 'fileA.txt' } }],
  ask: [],
  deny: [],
}

/** The ask-lane policy (the G5/G6 ask-path scenarios): read fileA via ask. */
const ASK_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [],
  ask: [{ tool: 'read', resource: { kind: 'any' } }],
  deny: [],
}

// ===========================================================================
// RED R1 — the static-allow gap (adapter level).
//
// Phase A: the external cell is absent (no host restriction) — the static
// allow executes (the pre-existing, still-legal behavior).
// Phase B: the SAME install, the SAME static allow, but the live external
// provider now hard-denies the `tools` cell — the execution must NOT
// happen. Pre-A2C-4: the static path never probes the external facts, so
// the tool body still runs → RED.
// ===========================================================================

let r1: {
  readonly phaseAExecuted: number
  readonly phaseADecision: PreToolDecisionLike
  readonly phaseBExecuted: number
  readonly phaseBDecision: PreToolDecisionLike
  readonly controlRowsAfterB: number
}
{
  const policy = mutableExternalPolicyFacts({ hard: {}, capabilityExists: {} })
  const env = await createEnv('a2c4-r1', {
    policy: STATIC_ALLOW_POLICY,
    externalPolicyFacts: policy.facts,
  })
  try {
    const nextA = makeNext()
    const decisionA = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a2c4-r1-a' }),
      nextA.fn,
    )
    // Tighten the live host policy AFTER the install (and after phase A).
    policy.set({ hard: { tools: { kind: 'deny' } }, capabilityExists: {} })
    const nextB = makeNext()
    const decisionB = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a2c4-r1-b' }),
      nextB.fn,
    )
    const state = await env.service.listControlState(P6T4_ROOT)
    r1 = {
      phaseAExecuted: nextA.calls(),
      phaseADecision: decisionA,
      phaseBExecuted: nextB.calls(),
      phaseBDecision: decisionB,
      controlRowsAfterB: state.requests.length + state.decisions.length + state.consumptions.length,
    }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
}

// ===========================================================================
// RED R2 — the ask-path guard gap (service level, fully deterministic).
//
// The decision-time probe passes (the allow-list NAMES the tool), a LEADER
// allow is recorded, then the live provider tightens to a hard deny BEFORE
// the last-mile guard runs. The guard must block — and must NOT consume
// the one-shot allow (a host policy that already prevents the execution
// must not burn the approval; plan §6.3 "prefer zero allow consumption").
// Pre-A2C-4: the guard re-reads no external facts at all → allowed:true +
// a consumption row → RED.
// ===========================================================================

let r2: {
  readonly decision: ControlDecisionRecord
  readonly verdictAllowed: boolean
  readonly verdictReason: string | undefined
  readonly consumptions: number
  readonly requests: number
  readonly decisions: number
}
{
  const policy = mutableExternalPolicyFacts({
    hard: { tools: { kind: 'allow', items: ['fs.write'] } },
    capabilityExists: {},
  })
  const world = await createP6T4World('a2c4-r2', ['leader', 'worker'], {
    externalPolicyFacts: policy.facts,
  })
  try {
    const service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
    })
    const scope = makeScope({ correlation: 'corr-a2c4-r2' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: scope.targetInstanceId,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    // Decision time: the external hard cell still NAMES the tool → the
    // leader allow is lawfully recorded.
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    // The host tightens AFTER the decision, BEFORE the last-mile guard.
    policy.set({ hard: { tools: { kind: 'deny' } }, capabilityExists: {} })
    const verdict = await service.guardOperation(scope)
    const state = await service.listControlState(P6T4_ROOT)
    r2 = {
      decision,
      verdictAllowed: verdict.allowed,
      verdictReason: verdict.allowed === false ? verdict.reason : undefined,
      consumptions: state.consumptions.length,
      requests: state.requests.length,
      decisions: state.decisions.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ===========================================================================
// GREEN G2 + G9 — static allow + an allow-list that does NOT name the tool
// -> zero execution; the denied exec was NEVER marked, so the monotonic
// end-cap guard (H1) still denies it (hostile-prepend non-regression: the
// external ceiling denies before any mark, exactly like the hostile
// waterfall case — the end-cap is the last line either way).
// ===========================================================================

let g2: {
  readonly phaseA: { readonly decision: PreToolDecisionLike; readonly executed: number }
  readonly phaseB: { readonly decision: PreToolDecisionLike; readonly executed: number; readonly reason: string }
  readonly controlRows: number
  readonly recheckObservations: number
  readonly endcapOnAllowedExec: string | undefined
  readonly endcapOnDeniedExec: string | undefined
}
{
  const policy = mutableExternalPolicyFacts({ hard: {}, capabilityExists: {} })
  const env = await createEnv('a2c4-g2', {
    policy: STATIC_ALLOW_POLICY,
    externalPolicyFacts: policy.facts,
  })
  try {
    const execA = makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a2c4-g2-a' })
    const nextA = makeNext()
    const decisionA = await env.ctx.trigger(execA, nextA.fn)
    // The host allow-list now exists but does NOT name 'read'.
    policy.set({ hard: { tools: { kind: 'allow', items: ['write'] } }, capabilityExists: {} })
    const execB = makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a2c4-g2-b' })
    const nextB = makeNext()
    const decisionB = await env.ctx.trigger(execB, nextB.fn)
    const state = await env.service.listControlState(P6T4_ROOT)
    const guards = env.ctx.guardFns()
    const endcap = guards[0]
    g2 = {
      phaseA: { decision: decisionA, executed: nextA.calls() },
      phaseB: {
        decision: decisionB,
        executed: nextB.calls(),
        reason: decisionB.kind === 'deny' ? decisionB.reason : '',
      },
      controlRows: state.requests.length + state.decisions.length + state.consumptions.length,
      recheckObservations: env.observations.filter(
        (o) => o['stage'] === 'external-recheck-denied',
      ).length,
      // H1 monotonicity over the SAME exec objects: the externally
      // allowed exec was marked (the end-cap abstains); the externally
      // denied exec was never marked (the end-cap still denies it).
      endcapOnAllowedExec: endcap !== undefined ? endcap(execA) : 'NO-GUARD',
      endcapOnDeniedExec: endcap !== undefined ? endcap(execB) : 'NO-GUARD',
    }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
}

// ===========================================================================
// GREEN G3 — static allow + a THROWING facts provider -> fail closed
// (deny, zero execution; the check never lets a probe fault escape as an
// allow — plan §6.5 "fail/throw reading external facts → fail closed").
// ===========================================================================

let g3: {
  readonly phaseAExecuted: number
  readonly phaseBDecision: PreToolDecisionLike
  readonly phaseBExecuted: number
  readonly phaseBReason: string
  readonly controlRows: number
}
{
  const policy = throwingMutableExternalPolicyFacts({ hard: {}, capabilityExists: {} })
  const env = await createEnv('a2c4-g3', {
    policy: STATIC_ALLOW_POLICY,
    externalPolicyFacts: policy.facts,
  })
  try {
    const nextA = makeNext()
    await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a2c4-g3-a' }),
      nextA.fn,
    )
    policy.setThrowing(true)
    const nextB = makeNext()
    const decisionB = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a2c4-g3-b' }),
      nextB.fn,
    )
    const state = await env.service.listControlState(P6T4_ROOT)
    g3 = {
      phaseAExecuted: nextA.calls(),
      phaseBDecision: decisionB,
      phaseBExecuted: nextB.calls(),
      phaseBReason: decisionB.kind === 'deny' ? decisionB.reason : '',
      controlRows: state.requests.length + state.decisions.length + state.consumptions.length,
    }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
}

// ===========================================================================
// GREEN G4 — static allow + a permissive (absent-cell) host: the existing
// success path is UNCHANGED (one execution, zero control rows), the live
// probe is consulted, and an UNSUPPORTED tool pass-through never probes
// (the external check sits after classification, exactly where the frozen
// pipeline places it).
// ===========================================================================

let g4: {
  readonly allowedExecuted: number
  readonly allowedDecisionKind: string
  readonly probesAfterAllow: number
  readonly unsupportedExecuted: number
  readonly probesAfterUnsupported: number
  readonly controlRows: number
}
{
  const policy = countingMutableExternalPolicyFacts({ hard: {}, capabilityExists: {} })
  const env = await createEnv('a2c4-g4', {
    policy: STATIC_ALLOW_POLICY,
    externalPolicyFacts: policy.facts,
  })
  try {
    const nextA = makeNext()
    const decisionA = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a2c4-g4-a' }),
      nextA.fn,
    )
    const probesAfterAllow = policy.calls()
    const nextU = makeNext()
    await env.ctx.trigger(
      makeExec({ name: 'web_fetch', arguments: { url: 'https://example.invalid' }, callId: 'a2c4-g4-u' }),
      nextU.fn,
    )
    const state = await env.service.listControlState(P6T4_ROOT)
    g4 = {
      allowedExecuted: nextA.calls(),
      allowedDecisionKind: decisionA.kind,
      probesAfterAllow,
      unsupportedExecuted: nextU.calls(),
      probesAfterUnsupported: policy.calls(),
      controlRows: state.requests.length + state.decisions.length + state.consumptions.length,
    }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
}

// ===========================================================================
// GREEN G5 + G6 — the ask path (adapter level): ask → durable leader allow
// (the decision-time probe passes) → the live host TIGHTENS before the
// last-mile guard.
//
//   G5: the adapter denies (zero execution), the guard verdict is
//       external-policy, the one-shot allow is NOT consumed (zero
//       consumption — "prefer zero allow consumption"), and NO NEW
//       durable control rows appear (the recheck is read-only: the
//       decision stays a durable allow; no deny row is minted).
//   G6: the surviving one-shot: the SAME logical operation (same callId =
//       same correlation = the documented idempotent-request retry) is
//       re-presented under the tightened policy → blocked AGAIN without
//       consumption; the host RELAXES → the SAME approval authorizes
//       exactly once (consumption written); a further re-presentation →
//       allow-consumed (exactly-once + scope/fingerprint identity
//       preserved end to end).
//
// Determinism: the tighten `set` runs in the microtask right after
// `resolveControl` settles (the decision row is durable before the
// promise resolves); the wait bridge observes the decision only on its
// next poll TIMER (a macrotask) — microtasks always drain first, so the
// provider is already tightened by the time the guard runs.
// ===========================================================================

const G56_CALL_ID = 'a2c4-g56-c1'

let g56: {
  readonly tightened: {
    readonly decision: PreToolDecisionLike
    readonly executed: number
    readonly reason: string
    readonly requests: number
    readonly decisions: number
    readonly consumptions: number
    readonly decisionValue: string
  }
  readonly relaxed: {
    readonly decision: PreToolDecisionLike
    readonly executed: number
    readonly requests: number
    readonly decisions: number
    readonly consumptions: number
  }
  readonly afterConsumption: {
    readonly decision: PreToolDecisionLike
    readonly executed: number
    readonly reason: string
    readonly requests: number
    readonly decisions: number
    readonly consumptions: number
  }
}
{
  const policy = mutableExternalPolicyFacts({
    hard: { tools: { kind: 'allow', items: ['read'] } },
    capabilityExists: {},
  })
  const env = await createEnv('a2c4-g56', {
    policy: ASK_POLICY,
    externalPolicyFacts: policy.facts,
  })
  try {
    // --- G5: the tighten window -------------------------------------------------
    const next1 = makeNext()
    const triggerP = env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: G56_CALL_ID }),
      next1.fn,
    )
    const request = await waitForRequest(env.service, G56_CALL_ID)
    // The decision-time probe still passes (the allow-list names 'read').
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    // Tighten BEFORE the last-mile guard (deterministic — see above).
    policy.set({ hard: { tools: { kind: 'deny' } }, capabilityExists: {} })
    const d1 = await triggerP
    const state1 = await env.service.listControlState(P6T4_ROOT)
    const decision1 = expectFirstDecision(state1.decisions)

    // --- G6: the surviving one-shot ---------------------------------------------
    policy.set({ hard: { tools: { kind: 'allow', items: ['read'] } }, capabilityExists: {} })
    const next2 = makeNext()
    const d2 = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: G56_CALL_ID }),
      next2.fn,
    )
    const state2 = await env.service.listControlState(P6T4_ROOT)

    // Same logical operation once more: the allow is now consumed.
    const next3 = makeNext()
    const d3 = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: G56_CALL_ID }),
      next3.fn,
    )
    const state3 = await env.service.listControlState(P6T4_ROOT)

    g56 = {
      tightened: {
        decision: d1,
        executed: next1.calls(),
        reason: d1.kind === 'deny' ? d1.reason : '',
        requests: state1.requests.length,
        decisions: state1.decisions.length,
        consumptions: state1.consumptions.length,
        decisionValue: decision1.decision,
      },
      relaxed: {
        decision: d2,
        executed: next2.calls(),
        requests: state2.requests.length,
        decisions: state2.decisions.length,
        consumptions: state2.consumptions.length,
      },
      afterConsumption: {
        decision: d3,
        executed: next3.calls(),
        reason: d3.kind === 'deny' ? d3.reason : '',
        requests: state3.requests.length,
        decisions: state3.decisions.length,
        consumptions: state3.consumptions.length,
      },
    }
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
}

/** The first decision of a control state (test failure when none). */
function expectFirstDecision(decisions: readonly ControlDecisionRecord[]): ControlDecisionRecord {
  const value = decisions[0]
  if (value === undefined) {
    throw new Error('a2c4: no durable decision in the control state')
  }
  return value
}

// ===========================================================================
// GREEN G7 — a HUMAN allow cannot beat the external hard at the last mile
// (service level, invariant 34): the user-approval allow is recorded while
// the decision-time probe passes; the host tightens; the guard blocks with
// external-policy WITHOUT consuming — the durable decision stays an allow
// (decided by the human; no reason, no new deny row: the last-mile block
// is a VERDICT, not a new mutation).
// ===========================================================================

let g7: {
  readonly decision: ControlDecisionRecord
  readonly verdict: ControlGuardVerdict
  readonly requests: number
  readonly decisions: number
  readonly consumptions: number
}
{
  const policy = mutableExternalPolicyFacts({
    hard: { tools: { kind: 'allow', items: ['fs.write'] } },
    capabilityExists: {},
  })
  const world = await createP6T4World('a2c4-g7', ['leader', 'worker'], {
    externalPolicyFacts: policy.facts,
  })
  try {
    const service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
    })
    const scope = makeScope({ correlation: 'corr-a2c4-g7' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: scope.targetInstanceId,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    policy.set({ hard: { tools: { kind: 'deny' } }, capabilityExists: {} })
    const verdict = await service.guardOperation(scope)
    const state = await service.listControlState(P6T4_ROOT)
    g7 = {
      decision,
      verdict,
      requests: state.requests.length,
      decisions: state.decisions.length,
      consumptions: state.consumptions.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ===========================================================================
// GREEN G8 — the shared read-only check (`checkExternalOperation`)
// semantics, one service over one world: hard cell / allow-list /
// capabilityExists:false / absent cell / explicit domain / derivation /
// thrown probe / malformed domain — all fail closed, never throw, never
// write a durable row; the NO-CELL case never even consults the port.
// ===========================================================================

let g8: {
  /** (a) a hard deny cell refuses (as required). */
  readonly hardDenyRefused: boolean
  /** (b) an allow-list that NAMES the tool allows (as required). */
  readonly listedAllowed: boolean
  /** (c) an allow-list that does NOT name the tool refuses (as required). */
  readonly unlistedRefused: boolean
  /** (d) capabilityExists:false refuses even a matching list (as required). */
  readonly capabilityAbsentRefused: boolean
  /** (e) an ABSENT cell is "no host restriction" — allowed (as required). */
  readonly absentCellAllowed: boolean
  /** (f) an explicit capabilityDomain uses THAT cell (refused as required). */
  readonly explicitSkillsRefused: boolean
  /** (g) no domain at all is not probed and passes (as required). */
  readonly noCellAllowed: boolean
  readonly noCellProbeDelta: number
  /** (h) a thrown facts probe fails closed to a deny verdict (as required). */
  readonly thrownProbeRefused: boolean
  /** (i) a malformed domain fails closed (as required). */
  readonly malformedDomainRefused: boolean
  /** (j) a named tool with no explicit domain probes `tools` (refused as required). */
  readonly derivedToolsRefused: boolean
  readonly rowsBefore: number
  readonly rowsAfter: number
}
{
  const policy = countingMutableExternalPolicyFacts({ hard: {}, capabilityExists: {} })
  const world = await createP6T4World('a2c4-g8', ['leader', 'worker'], {
    externalPolicyFacts: policy.facts,
  })
  try {
    const service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
    })
    const stateBefore = await service.listControlState(P6T4_ROOT)
    const rowsBefore =
      stateBefore.requests.length + stateBefore.decisions.length + stateBefore.consumptions.length

    // (a) a hard deny cell refuses.
    policy.set({ hard: { tools: { kind: 'deny' } }, capabilityExists: {} })
    const vDeny = await service.checkExternalOperation({ toolName: 'fs.write' })

    // (b) an allow-list that NAMES the tool allows.
    policy.set({ hard: { tools: { kind: 'allow', items: ['fs.write'] } }, capabilityExists: {} })
    const vListed = await service.checkExternalOperation({ toolName: 'fs.write' })

    // (c) an allow-list that does NOT name the tool refuses.
    const vUnlisted = await service.checkExternalOperation({ toolName: 'read' })

    // (d) capabilityExists:false refuses even a matching list.
    policy.set({
      hard: { tools: { kind: 'allow', items: ['fs.write'] } },
      capabilityExists: { tools: false },
    })
    const vCapAbsent = await service.checkExternalOperation({ toolName: 'fs.write' })

    // (e) an ABSENT cell is "no host restriction" — allowed.
    policy.set({ hard: {}, capabilityExists: {} })
    const vAbsent = await service.checkExternalOperation({ toolName: 'fs.write' })

    // (f) an explicit capabilityDomain uses THAT cell.
    policy.set({ hard: { skills: { kind: 'deny' } }, capabilityExists: {} })
    const vSkills = await service.checkExternalOperation({
      capabilityDomain: 'skills',
      toolName: 'fs.write',
    })

    // (g) NO domain (no toolName, no capabilityDomain) is not probed at
    // all — the port is never even consulted (probe count unchanged).
    policy.set({ hard: { tools: { kind: 'deny' } }, capabilityExists: {} })
    const probesBeforeNoCell = policy.calls()
    const vNoCell = await service.checkExternalOperation({})
    const probesAfterNoCell = policy.calls()

    // (h) a THROWN facts probe fails closed (deny verdict, no throw).
    const throwing = throwingMutableExternalPolicyFacts({ hard: {}, capabilityExists: {} })
    const throwWorld = await createP6T4World('a2c4-g8-t', ['leader', 'worker'], {
      externalPolicyFacts: throwing.facts,
    })
    const throwService = createControlService({
      teamDomain: throwWorld.domain,
      blueprintCatalog: throwWorld.catalog,
      externalPolicyFacts: throwWorld.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
    })
    throwing.setThrowing(true)
    let thrownProbe: boolean
    try {
      const vThrown = await throwService.checkExternalOperation({ toolName: 'fs.write' })
      thrownProbe = vThrown.allowed === false
    } finally {
      await destroyP6T1World(throwWorld)
    }

    // (i) a malformed (non-closed-set) domain fails closed.
    policy.set({ hard: {}, capabilityExists: {} })
    const vMalformed = await service.checkExternalOperation({
      capabilityDomain: 'bogus-domain' as unknown as CapabilityName,
      toolName: 'fs.write',
    })

    // (j) derivation: a named tool with NO explicit domain probes `tools`.
    policy.set({ hard: { tools: { kind: 'deny' } }, capabilityExists: {} })
    const vDerived = await service.checkExternalOperation({ toolName: 'anything' })

    const stateAfter = await service.listControlState(P6T4_ROOT)
    g8 = {
      hardDenyRefused: vDeny.allowed === false,
      listedAllowed: vListed.allowed === true,
      unlistedRefused: vUnlisted.allowed === false,
      capabilityAbsentRefused: vCapAbsent.allowed === false,
      absentCellAllowed: vAbsent.allowed === true,
      explicitSkillsRefused: vSkills.allowed === false,
      noCellAllowed: vNoCell.allowed === true,
      noCellProbeDelta: probesAfterNoCell - probesBeforeNoCell,
      thrownProbeRefused: thrownProbe,
      malformedDomainRefused: vMalformed.allowed === false,
      derivedToolsRefused: vDerived.allowed === false,
      rowsBefore,
      rowsAfter:
        stateAfter.requests.length + stateAfter.decisions.length + stateAfter.consumptions.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('A2C-4 RED probes — the pre-fix external hard last-mile gaps (plan §6.4)', () => {
  it('R1: a static allow still EXECUTES after the live external provider hard-denies the tools cell (gap: the static path carries no external check)', () => {
    // Phase A sanity: an absent cell is "no host restriction" — the
    // pre-existing success path is unchanged.
    expect(r1.phaseADecision.kind).toBe('allow')
    expect(r1.phaseAExecuted).toBe(1)
    // Phase B (RED): the external hard deny must stop the execution —
    // zero next() calls, a deny decision, zero durable control rows
    // (the static path has no control request at all).
    expect(r1.phaseBDecision.kind).toBe('deny')
    expect(r1.phaseBExecuted).toBe(0)
    expect(r1.controlRowsAfterB).toBe(0)
  })

  it('R2: a durable allow whose external cell tightened before the guard still EXECUTES and CONSUMES the one-shot (gap: guardOperation re-reads no external facts)', () => {
    // The decision itself is a durable allow (the decision-time probe
    // lawfully passed) — the tightening happened afterwards.
    expect(r2.decision.decision).toBe('allow')
    expect(r2.requests).toBe(1)
    expect(r2.decisions).toBe(1)
    // RED: the guard must block with the external reason and must NOT
    // have written a consumption row (the one-shot survives the
    // tightened window; zero effect).
    expect(r2.verdictAllowed).toBe(false)
    expect(r2.verdictReason).toBe(CONTROL_GUARD_BLOCK_REASONS.EXTERNAL_POLICY)
    expect(r2.consumptions).toBe(0)
  })
})

describe('A2C-4 GREEN acceptance — the external hard last-mile recheck (plan §6.5)', () => {
  it('G1 (=R1): static allow + live external hard deny -> zero execution, a deny decision, zero durable control rows (the static path has no request)', () => {
    expect(r1.phaseADecision.kind).toBe('allow')
    expect(r1.phaseAExecuted).toBe(1)
    expect(r1.phaseBDecision.kind).toBe('deny')
    expect(r1.phaseBExecuted).toBe(0)
    expect(r1.controlRowsAfterB).toBe(0)
  })

  it('G2: static allow + an allow-list that does NOT name the tool -> zero execution; the static path never mints a control row', () => {
    expect(g2.phaseA.decision.kind).toBe('allow')
    expect(g2.phaseA.executed).toBe(1)
    expect(g2.phaseB.decision.kind).toBe('deny')
    expect(g2.phaseB.executed).toBe(0)
    expect(g2.controlRows).toBe(0)
    // The diagnostics surface records the recheck denial (small rows
    // only — no argument payloads).
    expect(g2.recheckObservations).toBe(1)
  })

  it('G9: hostile-prepend end-cap non-regression (H1): the externally-allowed exec was marked (end-cap abstains); the externally-denied exec was NEVER marked (end-cap still denies it with the stable reason)', () => {
    expect(g2.endcapOnAllowedExec).toBe(undefined)
    expect(g2.endcapOnDeniedExec).toBe(END_CAP_DENIAL_REASON)
  })

  it('G3: static allow + a THROWING facts provider -> fail closed (deny, zero execution, the fault reason is surfaced; zero control rows)', () => {
    expect(g3.phaseAExecuted).toBe(1)
    expect(g3.phaseBDecision.kind).toBe('deny')
    expect(g3.phaseBExecuted).toBe(0)
    // The static-path external recheck deny surfaces the fail-closed
    // verdict reason (shim-compatible: includes + toBe, not toContain).
    expect(g3.phaseBReason.startsWith('permission denied: the external hard policy no longer allows read')).toBe(true)
    expect(g3.phaseBReason.includes('fail closed')).toBe(true)
    expect(g3.controlRows).toBe(0)
  })

  it('G4: static allow + a permissive host -> the existing success path is unchanged (one execution, zero control rows); the live probe IS consulted on the allow path; an unsupported tool pass-through never probes', () => {
    expect(g4.allowedDecisionKind).toBe('allow')
    expect(g4.allowedExecuted).toBe(1)
    expect(g4.controlRows).toBe(0)
    expect(g4.probesAfterAllow).toBe(1)
    expect(g4.unsupportedExecuted).toBe(1)
    // The unsupported pass-through returns BEFORE the external check —
    // the probe count is unchanged.
    expect(g4.probesAfterUnsupported).toBe(1)
  })

  it('G5: ask allow + external tighten after the decision -> zero execution, the guard verdict is external-policy, ZERO allow consumption, and NO new durable control rows (the recheck is read-only)', () => {
    const t = g56.tightened
    expect(t.decision.kind).toBe('deny')
    expect(t.executed).toBe(0)
    // The adapter's stable guard-block mapping (shim-compatible exact
    // string — no toContain).
    expect(t.reason).toBe(
      `permission denied: the last-mile guard blocked the operation (${CONTROL_GUARD_BLOCK_REASONS.EXTERNAL_POLICY})`,
    )
    // Exactly the original request + the durable allow — nothing new:
    // no consumption (the one-shot survives), no deny decision row
    // (the last-mile block is a verdict, not a mutation).
    expect(t.requests).toBe(1)
    expect(t.decisions).toBe(1)
    expect(t.consumptions).toBe(0)
    // The decision row itself stays a plain durable allow.
    expect(t.decisionValue).toBe(CONTROL_DECISION_VALUES.ALLOW)
  })

  it('G6: the surviving one-shot (zero consumption pays off): re-presentation under the tightened policy blocks AGAIN without consumption; after the host relaxes the SAME approval executes EXACTLY ONCE (the consumption row appears exactly then); the next re-presentation is allow-consumed (scope/fingerprint identity + exactly-once preserved)', () => {
    const t = g56.tightened
    const r = g56.relaxed
    const c = g56.afterConsumption
    // The tightened re-presentation (first half — see G5): blocked,
    // unconsumed, still exactly one request/decision.
    expect(t.executed).toBe(0)
    expect(t.consumptions).toBe(0)
    // The host relaxes: the SAME logical operation (same correlation)
    // reuses the SAME request — no second request row — and the
    // surviving allow now authorizes exactly one execution.
    expect(r.decision.kind).toBe('allow')
    expect(r.executed).toBe(1)
    expect(r.requests).toBe(1)
    expect(r.decisions).toBe(1)
    expect(r.consumptions).toBe(1)
    // The third re-presentation: the allow is consumed — exactly once.
    expect(c.decision.kind).toBe('deny')
    expect(c.executed).toBe(0)
    expect(c.reason).toBe(
      `permission denied: the last-mile guard blocked the operation (${CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED})`,
    )
    expect(c.requests).toBe(1)
    expect(c.decisions).toBe(1)
    expect(c.consumptions).toBe(1)
  })

  it('G7: a HUMAN allow cannot beat the external hard at the last mile: the guard blocks with external-policy, the one-shot is NOT consumed, and the durable decision stays a plain human allow (no new decision row, no reason minted)', () => {
    expect(g7.decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(g7.decision.reason).toBe(undefined)
    expect(g7.verdict.allowed).toBe(false)
    if (g7.verdict.allowed === false) {
      expect(g7.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.EXTERNAL_POLICY)
    }
    expect(g7.requests).toBe(1)
    expect(g7.decisions).toBe(1)
    expect(g7.consumptions).toBe(0)
  })

  it('G8: the shared read-only check semantics: hard deny / allow-list (named vs unlisted) / capabilityExists:false / absent cell / explicit domain / no-cell-not-probed / thrown probe / malformed domain / tools derivation — all fail closed, never throw, and the check writes ZERO durable rows', () => {
    expect(g8.hardDenyRefused).toBe(true)
    expect(g8.listedAllowed).toBe(true)
    expect(g8.unlistedRefused).toBe(true)
    expect(g8.capabilityAbsentRefused).toBe(true)
    expect(g8.absentCellAllowed).toBe(true)
    expect(g8.explicitSkillsRefused).toBe(true)
    expect(g8.noCellAllowed).toBe(true)
    // The no-cell case never consults the facts port at all.
    expect(g8.noCellProbeDelta).toBe(0)
    expect(g8.thrownProbeRefused).toBe(true)
    expect(g8.malformedDomainRefused).toBe(true)
    expect(g8.derivedToolsRefused).toBe(true)
    // READ-ONLY over the whole battery: zero durable rows added.
    expect(g8.rowsAfter).toBe(g8.rowsBefore)
  })
})
