/**
 * scenario.mjs — one execution of one corpus vector against the governed
 * agent-control old path.
 *
 * The harness materializes the world the vector declares, dispatches its steps
 * through the row's own `execute`, and serializes the witnesses. It decides no
 * lane, no policy and no refusal.
 *
 * @module tests/ute-g1-agentctl/lib/scenario
 */
import {
  CALLER_AUTHORITY,
  AGENT_SCOPE,
  ASK_POLICY,
  createAgentControlWorld,
  makeAgentRuntime,
  stableJson,
} from './world.mjs'
import { classifyRefusal, factsOf, payloadOf } from './effect-oracle.mjs'

/** An already-aborted signal (the corpus's cancellation arm). */
export function abortedSignal() {
  const controller = new AbortController()
  controller.abort()
  return controller.signal
}

/** Apply a negative control's argument patch AFTER materialization. */
function patched(args, patch) {
  return patch === undefined ? args : { ...args, ...patch }
}

/**
 * Run one vector.
 *
 * @param {object} vector - corpus vector
 * @param {object} [override] - negative-control only: `args`, `policy`,
 *   `runtime`, `callerAuthority`, `agentScope`, `forkContextProvider`,
 *   `control`, `dropStep`, `tokenKey`.
 * @returns {Promise<object>} the normalized record
 */
export async function runVector(vector, override = {}) {
  const runtimeOptions = override.runtime ?? vector.runtime ?? {}
  const runtime = makeAgentRuntime(runtimeOptions)
  const world = await createAgentControlWorld({
    label: vector.id,
    policy: override.policy ?? vector.policy ?? ASK_POLICY,
    runtime,
    agentScope: override.agentScope !== undefined ? override.agentScope : (vector.agentScope !== undefined ? vector.agentScope : AGENT_SCOPE),
    callerAuthority: override.callerAuthority !== undefined ? override.callerAuthority : (vector.callerAuthority !== undefined ? vector.callerAuthority : CALLER_AUTHORITY),
    forkContextProvider: override.forkContextProvider ?? vector.forkContextProvider,
    control: override.control ?? vector.control ?? 'approve',
    noPort: override.noPort ?? vector.noPort ?? false,
  })
  const steps = []
  const tokens = []
  const declaredSteps = override.dropStep === undefined ? vector.steps : vector.steps.filter((_, index) => index !== override.dropStep)
  for (const [index, step] of declaredSteps.entries()) {
    const patch = index === 0 ? override.args : undefined
    const tokenKey = step.tokenKey ?? (index === 0 ? override.tokenKey : undefined)
    if (tokenKey !== undefined) tokens.push(`used:${tokenKey}`)
    const exec = {
      ...(step.signal === 'aborted' ? { signal: abortedSignal() } : {}),
      ...(tokenKey === undefined ? {} : { tokenKey }),
      ...(step.agent === undefined ? {} : { agent: step.agent }),
    }
    try {
      const value = await world.dispatch(vector.entry, patched(step.args ?? {}, patch), exec)
      steps.push({ outcome: 'allow', value })
    } catch (error) {
      const classified = classifyRefusal(error)
      steps.push({ outcome: 'deny', refusal: classified, text: String(error?.message ?? error) })
    }
  }
  const denied = steps.filter((step) => step.outcome === 'deny')
  const refusal = denied.length === 0 ? null : denied.map((step) => step.refusal.token).sort().join(',')
  const category = denied.length === 0 ? null : denied.map((step) => step.refusal.category).sort().join(',')
  const codes = denied.length === 0 ? '-' : denied.map((step) => step.refusal.code).sort().join(',')
  const outcome = denied.length === 0 ? 'allow' : 'deny'
  const payload = outcome === 'allow' ? payloadOf(steps.length === 1 ? steps[0].value : steps.map((step) => step.value)) : '-'
  return Object.freeze({
    id: vector.id,
    entry: vector.entry,
    outcome,
    refusal: refusal ?? '-',
    category: category ?? '-',
    codes,
    payload,
    state: world.stateCell(),
    facts: factsOf({ steps, calls: runtime.calls, audit: world.audit, tokens }),
    /** Observation-only detail for a negative control's diagnostic line. */
    detail: Object.freeze({
      steps: steps.map((step) => ({ outcome: step.outcome, ...(step.refusal === undefined ? {} : { code: step.refusal.code }), text: step.text ?? null })),
      calls: runtime.calls.map((call) => ({ ...call })),
      state: world.stateView(),
      payload: outcome === 'allow' ? stableJson(steps.map((step) => step.value)) : null,
      audit: [...world.audit],
    }),
  })
}

/** The record's graded shape (a plain object; the TSV adds the columns). */
export const RECORD_FIELDS = Object.freeze(['id', 'entry', 'outcome', 'refusal', 'category', 'codes', 'payload', 'state', 'facts'])
