/**
 * a6-stop-fence.test.ts — A6-STOP-FENCE (owner ruling A, 2026-11-09).
 *
 * THE LAW UNDER TEST. `guardOperation` is the consumption boundary: the last
 * place where a durable `allow` becomes a spent approval and a tool body is
 * about to run. Before this round the guard had NO view of the invocation's
 * cancellation: the bridge's last checkpoint was `pa-control-bridge.ts:683`
 * and the consumption write is `service.ts:4395` — four awaits apart. A Stop
 * landing in that gap consumed the approval and only the EXECUTION edge
 * refused the body (measured: 83–110 ms, 4/6 boots consumed, 0/6 executed).
 *
 * THE FENCE. The SAME invocation signal the approval wait already consumes
 * rides the guard's OPTIONAL second argument (never a scope field, never
 * durable identity) and is read ONCE, synchronously, immediately before the
 * durable consumption write. On a trip:
 *
 *   - no `control-allow-consumed` is written (ZERO consumption);
 *   - no tool body executes;
 *   - the original `allow` decision is left exactly as the decider wrote it
 *     (a Stop is an execution-lifecycle event, not an approver's deny);
 *   - exactly ONE terminal `control-request-abandoned` is written under the
 *     same per-team lock, with the lifecycle reason
 *     `invocation-cancelled-before-consumption` (never the crash reason
 *     `invocation-abandoned`);
 *   - a later replay cannot re-consume (the abandon is terminal).
 *
 * WHAT THIS FILE DOES NOT CLAIM. It does not claim atomic Stop. A window
 * remains between the probe and the durable write; the only await that owns
 * it is the consumption `putEntry` -> `repositories.ledger.put`. The
 * `residualWindow` scenario MEASURES that window by holding exactly that
 * await and proving a cancel landing inside it still commits the
 * consumption — the fact is kept, never rewritten (contract item 5).
 *
 * DETERMINISM. Every cancel lands at a NAMED point through a deferred
 * barrier (external-policy probe, authority recheck port, PA-effects
 * verifier, ledger sequence allocation). No test sleeps 80–100 ms to
 * "reproduce" the race.
 *
 * RUNNER CONSTRAINTS: this repo's plain-node shim runs async scenarios at
 * module level (top-level await); `it` bodies are synchronous and use only
 * the audited matchers (toBe / toEqual, each with .not).
 *
 * @module @dsh-agent-team/runtime/test/a6-stop-fence
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
  ControlAuthorityRecheckPort,
  ControlGuardVerdict,
  ControlOperationScope,
  ControlRequestRecord,
  ControlService,
  ControlWaitSignal,
} from '../control/index.js'
import {
  PA_CONTROL_MANIFEST_SCHEMA,
} from '../control/types.js'
import type { PaEffectsVerifier } from '../control/types.js'
import { canonicalJsonFingerprint } from '../../domain/tool-governance/src/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  makeScope,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const ACTION_NAME = 'team.action.execute'
const TOOL_NAME = 'read'
const FILE_A = 'file:///fileA.txt'
const SCOPE_A = { operationClass: TOOL_NAME, matcher: { kind: 'exact', resource: FILE_A } } as const
const SUBJECT = { kind: 'instance', instanceId: WORKER_ID } as const
/** The one lifecycle reason a Stop-abandon is allowed to carry. */
const STOP_ABANDON_REASON = 'invocation-cancelled-before-consumption'

// ---------------------------------------------------------------------------
// Deterministic barriers (deferred promises — no sleeps)
// ---------------------------------------------------------------------------

interface Barrier {
  /** Resolves when the guarded await has been ENTERED. */
  readonly reached: Promise<void>
  /** Resolves when the test allows the await to continue. */
  readonly released: Promise<void>
  /** Signal that the await was entered (idempotent). */
  hit(): void
  /** Let the await continue (idempotent). */
  release(): void
}

function barrier(): Barrier {
  let hitReached: () => void = () => {}
  let doRelease: () => void = () => {}
  const reached = new Promise<void>((resolve) => {
    hitReached = resolve
  })
  const released = new Promise<void>((resolve) => {
    doRelease = resolve
  })
  let hit = false
  return {
    reached,
    released,
    hit: () => {
      if (hit) return
      hit = true
      hitReached()
    },
    release: () => {
      doRelease()
    },
  }
}

/** The invocation cancellation surface the guard reads (structurally an AbortSignal). */
function signalOf(controller: AbortController): ControlWaitSignal {
  return controller.signal as unknown as ControlWaitSignal
}

// ---------------------------------------------------------------------------
// Worlds / services with one gated await
// ---------------------------------------------------------------------------

interface GatedPorts {
  /** Gate the external-policy facts await. */
  readonly externalPolicy?: Barrier
  /** Gate the consumption-point authority recheck await. */
  readonly authorityRecheck?: Barrier
  /** Gate the PA all-Effects verifier await at the GUARD stage. */
  readonly paVerifier?: Barrier
  /** Gate the ledger sequence allocation that precedes the final probe. */
  readonly sequence?: Barrier
  /** Gate the durable consumption write itself (the residual window). */
  readonly consumptionWrite?: Barrier
}

interface Env {
  readonly world: P6T1World
  readonly service: ControlService
  /** Duration of the gated consumption `ledger.put` await (0 when not gated). */
  readonly consumptionWriteMs: () => number
  /**
   * Arm the barriers. World setup (request + allow) also consults some of
   * these ports — the setup must run ungated, so every gate is disarmed
   * until the scenario is ready to enter the guard. This is what keeps the
   * cancel deterministic: the barrier is hit by the GUARD's await, not by
   * the decision path.
   */
  readonly arm: () => void
}

/** A mutable arm switch shared by every gate of one environment. */
interface ArmSwitch {
  value: boolean
}

/**
 * Return a TeamDomain view whose named awaits are gated exactly once. The
 * rest of the domain (and the repositories service) pass through untouched.
 */
function gatedDomain(world: P6T1World, ports: GatedPorts, armed: ArmSwitch): {
  readonly domain: TeamDomain
  readonly consumptionWriteMs: () => number
} {
  let sequenceSeen = false
  let writeSeen = false
  let writeMs = 0
  const ledger = new Proxy(world.domain.repositories.ledger, {
    get(target, key) {
      if (key === 'allocateSequence' && ports.sequence !== undefined) {
        const gate = ports.sequence
        return async (): Promise<number> => {
          if (armed.value && !sequenceSeen) {
            sequenceSeen = true
            gate.hit()
            await gate.released
          }
          return target.allocateSequence()
        }
      }
      if (key === 'put') {
        const gate = ports.consumptionWrite
        return async (entry: { readonly factType: string }): Promise<unknown> => {
          if (entry.factType !== 'control-allow-consumed') {
            return (target.put as (e: unknown) => Promise<unknown>)(entry)
          }
          // ALWAYS measure the consumption write await: this is the await
          // that owns the disclosed residual window. The optional gate only
          // HOLDS it open so a cancel can provably land inside it.
          const started = performance.now()
          if (armed.value && gate !== undefined && !writeSeen) {
            writeSeen = true
            gate.hit()
            await gate.released
          }
          try {
            return await (target.put as (e: unknown) => Promise<unknown>)(entry)
          } finally {
            writeMs = performance.now() - started
          }
        }
      }
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  })
  const repositories = new Proxy(world.domain.repositories, {
    get(target, key) {
      if (key === 'ledger') return ledger
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  })
  const domain = new Proxy(world.domain, {
    get(target, key) {
      if (key === 'repositories') return repositories
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  })
  return { domain: domain as unknown as TeamDomain, consumptionWriteMs: () => writeMs }
}

async function createEnv(name: string, ports: GatedPorts = {}): Promise<Env> {
  const world = await createP6T4World(name, ['leader', 'worker'])
  const armed: ArmSwitch = { value: false }
  const gated = gatedDomain(world, ports, armed)
  let externalSeen = false
  const externalPolicy = ports.externalPolicy
  const recheckSeen = { value: false }
  const recheckGate = ports.authorityRecheck
  const verifierSeen = { value: false }
  const verifierGate = ports.paVerifier
  const service = createControlService({
    teamDomain: gated.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: async () => {
      if (armed.value && externalPolicy !== undefined && !externalSeen) {
        externalSeen = true
        externalPolicy.hit()
        await externalPolicy.released
      }
      return world.ports.externalPolicyFacts()
    },
    now: () => P6T4_NOW,
    authorityRevalidation: (async (): Promise<ControlAuthorityRecheck> => {
      if (armed.value && recheckGate !== undefined && !recheckSeen.value) {
        recheckSeen.value = true
        recheckGate.hit()
        await recheckGate.released
      }
      return { kind: CONTROL_AUTHORITY_RECHECK_KINDS.STILL_SUFFICIENT }
    }) as ControlAuthorityRecheckPort,
    ...(verifierGate !== undefined
      ? {
          paEffectsVerifier: (async (input: { readonly stage: string }) => {
            if (armed.value && input.stage === 'guard' && !verifierSeen.value) {
              verifierSeen.value = true
              verifierGate.hit()
              await verifierGate.released
            }
            return { ok: true }
          }) as PaEffectsVerifier,
        }
      : {}),
  })
  return {
    world,
    service,
    consumptionWriteMs: gated.consumptionWriteMs,
    arm: () => {
      armed.value = true
    },
  }
}

// ---------------------------------------------------------------------------
// Durable assertions
// ---------------------------------------------------------------------------

interface Rows {
  readonly consumptions: number
  readonly abandonments: { readonly reason?: string }[]
  readonly decisions: { readonly value: string; readonly sequence: number }[]
}

function rowsOf(world: P6T1World, requestId: string): Rows {
  const ledger = world.domain.repositories.ledger.list()
  let consumptions = 0
  const abandonments: { reason?: string }[] = []
  const decisions: { value: string; sequence: number }[] = []
  for (const entry of ledger) {
    if (String(entry.rootSessionId) !== P6T4_ROOT) continue
    const payload = entry.payload as Record<string, unknown>
    if (payload['requestId'] !== requestId) continue
    if (entry.factType === 'control-allow-consumed') consumptions += 1
    if (entry.factType === 'control-request-abandoned') {
      const reason = payload['reason']
      abandonments.push({
        ...(typeof reason === 'string' ? { reason } : {}),
      })
    }
    if (entry.factType === 'control-decision-recorded') {
      decisions.push({ value: String(payload['decision']), sequence: entry.sequence })
    }
  }
  return { consumptions, abandonments, decisions }
}

// ---------------------------------------------------------------------------
// Allow construction (legacy guarded row / v3 operation case / PA row)
// ---------------------------------------------------------------------------

interface Granted {
  readonly scope: ControlOperationScope
  readonly request: ControlRequestRecord
  readonly decisionSequence: number
}

async function grantedLegacy(
  service: ControlService,
  correlation: string,
): Promise<Granted> {
  const scope = makeScope({ correlation, actionName: ACTION_NAME, toolName: TOOL_NAME })
  const request = await service.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    targetInstanceId: WORKER_ID,
    actionName: ACTION_NAME,
    toolName: TOOL_NAME,
    correlation,
  })
  const decision = await service.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: leaderCaller(),
    requestId: request.requestId,
    decision: CONTROL_DECISION_VALUES.ALLOW,
  })
  return { scope, request, decisionSequence: decision.decisionSequence }
}

/**
 * A v3 operation case allow: the ONLY row shape whose consumption path runs
 * the awaited authority recheck (it carries both the case id and the
 * persisted authority point).
 */
async function grantedCase(
  service: ControlService,
  correlation: string,
): Promise<Granted> {
  const fingerprint = `fp-${correlation}`
  const identity: ApprovalCaseIdentityInput = {
    subject: SUBJECT,
    beneficiaryAuthority: 'member',
    requestedEffect: 'allow',
    operationFingerprint: fingerprint,
    correlation,
    authorityScope: SCOPE_A,
  }
  const created = await service.requestApprovalLeg({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    reviewAuthority: 'leader',
    requiredAuthorityAtCreation: 'leader',
    identity,
    actionName: ACTION_NAME,
    toolName: TOOL_NAME,
    executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
  })
  if (created.kind !== 'leg') throw new Error(`the scenario needs an open leg, got '${created.kind}'`)
  const decision = await service.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: leaderCaller(),
    requestId: created.leg.requestId,
    decision: CONTROL_DECISION_VALUES.ALLOW,
  })
  const state = await service.listControlState(P6T4_ROOT)
  const request = state.requests.find((r) => r.requestId === created.leg.requestId)
  if (request === undefined) throw new Error('the allowed leg vanished from the state read')
  const scope: ControlOperationScope = {
    rootSessionId: P6T4_ROOT,
    subject: SUBJECT,
    targetInstanceId: WORKER_ID,
    actionName: ACTION_NAME,
    toolName: TOOL_NAME,
    correlation,
    operationFingerprint: fingerprint,
    authorityScope: SCOPE_A,
  }
  return { scope, request, decisionSequence: decision.decisionSequence }
}

/** A strict PA operation manifest (the marker class the verifier gate runs on). */
function paManifest(callId: string): Record<string, unknown> {
  return {
    schema: PA_CONTROL_MANIFEST_SCHEMA,
    approvalCaseId: `case-${callId}`,
    authorityScope: { operationClass: 'tool-invoke', matcher: { kind: 'exact', resource: `realm|tool:${TOOL_NAME}` } },
    requiredAuthority: 'leader',
    perEffectRequired: ['leader'],
    deniedEffects: [],
    authorityGeneration: 0,
    realmId: 'realm-a6-stop-fence',
    callId,
    parametersFingerprint: `params-${callId}`,
    effectSetFingerprint: `effects-${callId}`,
    effects: [{ kind: 'tool-invoke', toolName: TOOL_NAME }],
    binding: {
      bindingId: 'binding-a6-stop-fence',
      agentScopeKey: 'agent-scope-a6-stop-fence',
      toolName: TOOL_NAME,
      definitionIdentity: 'def-a6-stop-fence',
      providerId: 'provider-a6-stop-fence',
      implementationOrigin: 'origin-a6-stop-fence',
      executionBoundary: 'boundary-a6-stop-fence',
      status: 'active',
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      assurance: {},
    },
    member: { teamSessionId: P6T4_ROOT, instanceId: WORKER_ID },
  }
}

async function grantedPa(
  service: ControlService,
  correlation: string,
): Promise<Granted> {
  const manifest = paManifest(correlation)
  const digest = canonicalJsonFingerprint(manifest)
  const request = await service.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    targetInstanceId: WORKER_ID,
    actionName: ACTION_NAME,
    toolName: TOOL_NAME,
    correlation,
    operationFingerprint: digest,
    reviewPayload: manifest as never,
    reviewPayloadDigest: digest,
  })
  const decision = await service.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: leaderCaller(),
    requestId: request.requestId,
    decision: CONTROL_DECISION_VALUES.ALLOW,
  })
  const scope = makeScope({
    correlation,
    actionName: ACTION_NAME,
    toolName: TOOL_NAME,
    operationFingerprint: digest,
  })
  return { scope, request, decisionSequence: decision.decisionSequence }
}

// ---------------------------------------------------------------------------
// One cancellable path, asserted end to end
// ---------------------------------------------------------------------------

interface CancelledOutcome {
  readonly label: string
  readonly verdict: ControlGuardVerdict
  readonly replay: ControlGuardVerdict
  readonly rows: Rows
  readonly executions: number
  readonly expectedDecisionSequence: number
}

async function runAndCancel(
  label: string,
  env: Env,
  granted: Granted,
  signal: ControlWaitSignal,
): Promise<CancelledOutcome> {
  let executions = 0
  // The same composition the tool plane performs: the body runs ONLY on
  // `allowed: true` (and the real plane has its own execution-edge cancel
  // check, which this scenario deliberately does not need to reach).
  const verdict = await env.service.guardOperation(granted.scope, { signal })
  if (verdict.allowed) executions += 1
  const replay = await env.service.guardOperation(granted.scope)
  return {
    label,
    verdict,
    replay,
    rows: rowsOf(env.world, granted.request.requestId),
    executions,
    expectedDecisionSequence: granted.decisionSequence,
  }
}

function assertCancelled(outcome: CancelledOutcome): void {
  if (outcome.verdict.allowed) throw new Error(`${outcome.label}: the guard allowed a cancelled invocation`)
  expect(outcome.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.INVOCATION_CANCELLED)
  // nothing consumed, nothing executed
  expect(outcome.rows.consumptions).toBe(0)
  expect(outcome.executions).toBe(0)
  // exactly ONE terminal abandonment, with the lifecycle reason
  expect(outcome.rows.abandonments.length).toBe(1)
  expect(outcome.rows.abandonments[0]?.reason).toBe(STOP_ABANDON_REASON)
  // the allow is untouched: one decision, still allow, same sequence, no deny
  expect(outcome.rows.decisions.length).toBe(1)
  expect(outcome.rows.decisions[0]?.value).toBe(CONTROL_DECISION_VALUES.ALLOW)
  expect(outcome.rows.decisions[0]?.sequence).toBe(outcome.expectedDecisionSequence)
  // replay refused by the terminal mark
  if (outcome.replay.allowed) throw new Error(`${outcome.label}: a replay re-consumed after a Stop`)
  expect(outcome.replay.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_ABANDONED)
}

// ---------------------------------------------------------------------------
// S1 — cancellation BEFORE entering the guard
// ---------------------------------------------------------------------------

const s1 = await (async (): Promise<CancelledOutcome> => {
  const env = await createEnv('a6-stop-s1')
  try {
    const granted = await grantedLegacy(env.service, 'corr-a6-stop-s1')
    const controller = new AbortController()
    controller.abort()
    return await runAndCancel('S1 before the guard', env, granted, signalOf(controller))
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// S2 — cancellation DURING the external-policy await
// ---------------------------------------------------------------------------

const s2 = await (async (): Promise<CancelledOutcome> => {
  const gate = barrier()
  const env = await createEnv('a6-stop-s2', { externalPolicy: gate })
  try {
    const granted = await grantedLegacy(env.service, 'corr-a6-stop-s2')
    env.arm()
    const controller = new AbortController()
    const pending = runAndCancel('S2 external-policy', env, granted, signalOf(controller))
    await gate.reached
    controller.abort()
    gate.release()
    return await pending
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// S3 — cancellation DURING the authority recheck await
// ---------------------------------------------------------------------------

const s3 = await (async (): Promise<CancelledOutcome> => {
  const gate = barrier()
  const env = await createEnv('a6-stop-s3', { authorityRecheck: gate })
  try {
    const granted = await grantedCase(env.service, 'corr-a6-stop-s3')
    env.arm()
    const controller = new AbortController()
    const pending = runAndCancel('S3 authority-recheck', env, granted, signalOf(controller))
    await gate.reached
    controller.abort()
    gate.release()
    return await pending
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// S4 — cancellation DURING the PA-effects verifier await
// ---------------------------------------------------------------------------

const s4 = await (async (): Promise<CancelledOutcome> => {
  const gate = barrier()
  const env = await createEnv('a6-stop-s4', { paVerifier: gate })
  try {
    const granted = await grantedPa(env.service, 'corr-a6-stop-s4')
    env.arm()
    const controller = new AbortController()
    const pending = runAndCancel('S4 PA-effects-verifier', env, granted, signalOf(controller))
    await gate.reached
    controller.abort()
    gate.release()
    return await pending
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// S5 — cancellation AFTER the sequence is prepared, BEFORE the final probe
// ---------------------------------------------------------------------------

const s5 = await (async (): Promise<CancelledOutcome> => {
  const gate = barrier()
  const env = await createEnv('a6-stop-s5', { sequence: gate })
  try {
    const granted = await grantedLegacy(env.service, 'corr-a6-stop-s5')
    env.arm()
    const controller = new AbortController()
    const pending = runAndCancel('S5 before-the-final-probe', env, granted, signalOf(controller))
    await gate.reached
    controller.abort()
    gate.release()
    return await pending
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// S6 — the control: the probe passes, exactly-once consumption + execution
// ---------------------------------------------------------------------------

const s6 = await (async () => {
  const env = await createEnv('a6-stop-s6')
  try {
    const granted = await grantedLegacy(env.service, 'corr-a6-stop-s6')
    const controller = new AbortController()
    let executions = 0
    const first = await env.service.guardOperation(granted.scope, { signal: signalOf(controller) })
    if (first.allowed) executions += 1
    const second = await env.service.guardOperation(granted.scope, { signal: signalOf(controller) })
    if (second.allowed) executions += 1
    return {
      first,
      second,
      executions,
      rows: rowsOf(env.world, granted.request.requestId),
      decisionSequence: granted.decisionSequence,
      consumptionPutMs: env.consumptionWriteMs(),
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

console.info(
  `A6-STOP-FENCE naturalConsumptionPutMs (un-cancelled control): ${String(s6.consumptionPutMs)}`,
)

// ---------------------------------------------------------------------------
// S7 — the DISCLOSED residual window: a cancel inside the consumption
//      `putEntry` await still commits (the consumption fact is kept)
// ---------------------------------------------------------------------------

const s7 = await (async () => {
  const gate = barrier()
  const env = await createEnv('a6-stop-s7', { consumptionWrite: gate })
  try {
    const granted = await grantedLegacy(env.service, 'corr-a6-stop-s7')
    env.arm()
    const controller = new AbortController()
    let executions = 0
    const pending = env.service.guardOperation(granted.scope, { signal: signalOf(controller) })
    // The gate is inside `putEntry` -> `ledger.put`, i.e. AFTER the probe
    // already read the signal as not-aborted. Hold it, cancel, release.
    await gate.reached
    controller.abort()
    await new Promise<void>((resolve) => { setTimeout(resolve, 0) })
    gate.release()
    const verdict = await pending
    if (verdict.allowed) executions += 1
    const replay = await env.service.guardOperation(granted.scope)
    const windowMs = env.consumptionWriteMs()
    // The measurement the release note and the PR must carry: the residual
    // window is the duration of the consumption write await, held open here
    // on purpose so the cancel provably lands INSIDE it.
    console.info(`A6-STOP-FENCE residualWindowMs (await putEntry -> ledger.put): ${String(windowMs)}`)
    return {
      verdict,
      replay,
      executions,
      rows: rowsOf(env.world, granted.request.requestId),
      windowMs,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// S8 — regression: callers that pass NO options keep today's behaviour
// ---------------------------------------------------------------------------

const s8 = await (async () => {
  const world = await createP6T4World('a6-stop-s8', ['leader', 'worker'])
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
  })
  try {
    // plain allow
    const allowed = await grantedLegacy(service, 'corr-a6-stop-s8-allow')
    let executions = 0
    const first = await service.guardOperation(allowed.scope)
    if (first.allowed) executions += 1
    const replay = await service.guardOperation(allowed.scope)
    const allowRows = rowsOf(world, allowed.request.requestId)
    // plain deny
    const denyScope = makeScope({
      correlation: 'corr-a6-stop-s8-deny',
      actionName: ACTION_NAME,
      toolName: TOOL_NAME,
    })
    const denied = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: ACTION_NAME,
      toolName: TOOL_NAME,
      correlation: 'corr-a6-stop-s8-deny',
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: denied.requestId,
      decision: CONTROL_DECISION_VALUES.DENY,
    })
    const denyVerdict = await service.guardOperation(denyScope)
    const denyRows = rowsOf(world, denied.requestId)
    return { first, replay, executions, allowRows, denyVerdict, denyRows }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('A6-STOP-FENCE — cancellation observed at the consumption boundary', () => {
  it('S1 cancel before entering the guard: zero consumption, one terminal abandonment', () => {
    assertCancelled(s1)
  })

  it('S2 cancel during the external-policy await: fenced', () => {
    assertCancelled(s2)
  })

  it('S3 cancel during the authority recheck await: fenced', () => {
    assertCancelled(s3)
  })

  it('S4 cancel during the PA-effects verifier await: fenced', () => {
    assertCancelled(s4)
  })

  it('S5 cancel after the sequence is prepared and before the final probe: fenced', () => {
    assertCancelled(s5)
  })

  it('S6 un-cancelled control: exactly one consumption and exactly one execution', () => {
    expect(s6.first.allowed).toBe(true)
    expect(s6.executions).toBe(1)
    expect(s6.rows.consumptions).toBe(1)
    expect(s6.rows.abandonments.length).toBe(0)
    expect(s6.rows.decisions.length).toBe(1)
    expect(s6.rows.decisions[0]?.value).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(s6.rows.decisions[0]?.sequence).toBe(s6.decisionSequence)
    if (s6.second.allowed) throw new Error('S6 replay executed twice')
    expect(s6.second.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(s6.executions).toBe(1)
  })

  it('S7 residual window: a cancel inside `putEntry` still commits — the fact is kept, not rewritten', () => {
    // Ordering, not atomicity: the probe had already passed when the gate was
    // entered; the cancel lands while `putEntry` -> `ledger.put` is in flight.
    expect(s7.verdict.allowed).toBe(true)
    expect(s7.executions).toBe(1)
    expect(s7.rows.consumptions).toBe(1)
    expect(s7.rows.abandonments.length).toBe(0)
    // The owning await is named in the test: `await putEntry(...)` ->
    // `repositories.ledger.put`. Its measured duration is the residual
    // window; it is disclosed, never claimed away.
    expect(Number.isFinite(s7.windowMs)).toBe(true)
    // The committed consumption is durable: the replay is refused as
    // already-consumed (never reported as un-consumed).
    if (s7.replay.allowed) throw new Error('S7 replay re-consumed')
    expect(s7.replay.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
  })

  it('S8 regression: callers that pass no options keep today\'s allow+deny behaviour', () => {
    expect(s8.first.allowed).toBe(true)
    expect(s8.executions).toBe(1)
    expect(s8.allowRows.consumptions).toBe(1)
    expect(s8.allowRows.abandonments.length).toBe(0)
    if (s8.replay.allowed) throw new Error('S8 replay executed twice')
    expect(s8.replay.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    if (s8.denyVerdict.allowed) throw new Error('S8 deny executed')
    expect(s8.denyVerdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY)
    expect(s8.denyRows.consumptions).toBe(0)
    expect(s8.denyRows.abandonments.length).toBe(0)
    expect(s8.denyRows.decisions[0]?.value).toBe(CONTROL_DECISION_VALUES.DENY)
  })
})
