/**
 * admission-port.mjs — puts the admission point on the host's tool dispatch, for one agent.
 *
 * The host runs, in this order: every `tools/pre-execute` waterfall listener, then every registered
 * guard, then the body. The two stages can do different things and BOTH are needed:
 *
 * - a **guard** returns a denial reason or nothing. It has no "allow", so nothing downstream can
 *   turn a refusal back into permission. That is where enforcement lives.
 * - a **pre-execute listener** can return `{kind: 'ask'}`, which the host turns into an approval
 *   request. A guard cannot ask, which is why the decision is split across the two stages.
 *
 * The one-shot grant connects them: raised at pre-execute when the ask is raised, spent at the
 * guard exactly once, immediately before the body. A grant that cannot be spent is a refusal
 * never an allow.
 *
 * WHAT EVERY DECISION WRITES. One record per call, including allows - after an incident the
 * question is which locator an agent tried under which policy generation, and an allow is as much
 * part of that record as a refusal. The sink is injected so the same port can write to the durable
 * ledger, to a fixture, or to both.
 *
 * @module packages/runtime/src/plugin/vnext/admission-port
 */

import { admit, invocationFactsOf } from './admission.js'

export class AdmissionPortError extends TypeError {
  constructor (code, message) {
    super(`admission-port: ${message}`)
    this.name = 'AdmissionPortError'
    this.code = code
  }
}

/**
 * Install the admission point on `ctx` (the agent's own context, so the host layers both stages by
 * `exec.agent`).
 *
 * @param {object} input
 * @param {object} input.ctx - the agent-scoped Cordis context that owns `tools`.
 * @param {(exec: object) => object|undefined} input.resolveBinding - maps one execution to the
 *   binding that governs it, or `undefined` when the centre has no authority for it.
 * @param {(facts: object) => void} input.record - the fact sink. Called for EVERY decision.
 * @param {() => string} [input.callIdOf] - optional override; defaults to the host's `exec.callId`.
 * @param {(callId: string) => boolean} [input.isReplay] - true when the durable ledger already holds
 *   an admission record for this callId. A replay is refused before `admit`, because admitting it
 *   again would mean the same identity governed twice.
 * @param {(input: {callId: string, toolName: string, reason: string}) => void} [input.recordReplay]
 *   - where the replay refusal itself is recorded; it must outlive the process that observed it.
 * @param {object} [input.settlement] - the settlement writer (`settlement-port`). Optional, because a
 *   port may be installed in a diagnostic context; when present the three transitions follow the
 *   decision, and a fault is reported rather than turning a decision into a different one.
 * @param {{binder: object, memberOf: (binding: object) => object}} [input.grants] - the product's
 *   one-shot grant binder (`member-io-policy`) and the projection from a binding to the trusted
 *   member identity. Without it an ask stays refused: an approval nobody can spend is not one.
 * @returns {() => void} the disposer.
 */
export function installAdmissionPoint ({ ctx, resolveBinding, record, callIdOf, isReplay, recordReplay, grants, settlement, onFault }) {
  if (ctx === undefined || ctx === null) throw new AdmissionPortError('CTX_MISSING', 'no agent context to install on')
  const tools = typeof ctx.get === 'function' ? ctx.get('tools') : undefined
  if (tools === undefined || tools === null || typeof tools.guard !== 'function') {
    throw new AdmissionPortError('TOOLS_UNAVAILABLE', 'the agent context has no tools service with guard(); installing an admission point without one would enforce nothing while looking installed')
  }
  if (typeof resolveBinding !== 'function') throw new AdmissionPortError('RESOLVER_MISSING', 'resolveBinding must be a function: a static binding cannot answer for a resumed or re-bound agent')
  if (typeof record !== 'function') throw new AdmissionPortError('RECORD_MISSING', 'record must be a function: a decision without a fact is unreviewable')

  /**
   * callId -> {preExecute, guard, capability?}. MEASURED: the host consults a guard more than once
   * per execution, so the verdict is decided once and memoized - consulting twice must not append a
   * second authority record, nor change the decision between the consultations.
   */
  const decided = new Map()

  const callIdOfExec = (exec) => (typeof callIdOf === 'function' ? callIdOf(exec) : exec.callId)

  const refuseReplay = (exec, callId) => {
    const reason = `ADMISSION_REPLAY: callId ${JSON.stringify(callId)} already has an admission record; a replay is refused rather than re-judged`
    if (typeof recordReplay === 'function') recordReplay({ callId, toolName: exec.name, reason })
    const entry = { preExecute: { kind: 'deny', reason }, guard: reason, exec }
    decided.set(callId, entry)
    return entry
  }

  /**
   * A FAULT IS A REFUSAL, not an exception. Reading the durable ledger, appending to it, or opening a
   * settlement record can throw (a truncated line, a store conflict, a full disk). Letting that escape
   * from a pre-execute listener leaves it to the HOST to decide what a thrown listener means - and the
   * module's own claim is that a fault is reported rather than turning a decision into a different one.
   * So the decision becomes an explicit deny with the fault's own code, and the fault is reported.
   */
  const refuseFault = (exec, callId, code, error, phase) => {
    const detail = error instanceof Error ? error.message : String(error)
    if (typeof onFault === 'function') onFault(error, { phase, callId, toolName: exec?.name })
    const reason = `${code}: ${phase} failed for ${JSON.stringify(callId)} (${detail}); the call is refused rather than run on an unreadable or unwritable record`
    const entry = { preExecute: { kind: 'deny', reason }, guard: reason, exec }
    decided.set(callId, entry)
    return entry
  }

  /**
   * The ONE decision for one call: admit, record, and mint a grant when the answer is `ask`.
   * Whichever stage reaches the call first decides; the other reads the memo.
   */
  const evaluate = (exec) => {
    const callId = callIdOfExec(exec)
    const memo = decided.get(callId)
    // The memo serves ONE dispatch. The host consults the guard more than once for the SAME execution
    // (the same exec object), which is why the verdict is memoized; a DIFFERENT execution carrying the
    // same callId is a replay and must meet the ledger, not a stale verdict. The identity check is what
    // makes that distinction real - serving the memo on callId alone is how the same call could run
    // twice, and the alternatives (refusing every repeat) would break the double consultation.
    if (memo !== undefined && memo.exec === exec) return memo
    if (memo !== undefined) return refuseReplay(exec, callId)
    let replay = false
    try {
      replay = typeof isReplay === 'function' && isReplay(callId) === true
    } catch (error) {
      return refuseFault(exec, callId, 'ADMISSION_LEDGER_UNREADABLE', error, 'replay-check')
    }
    if (replay) return refuseReplay(exec, callId)
    const binding = resolveBinding(exec)
    const admission = admit({ binding, toolName: exec.name, arguments: exec.arguments })
    // THE FINAL DECISION, not the lane's raw answer. `admit` can answer `ask`, and an ask this port
    // cannot turn into a spendable approval is a REFUSAL - so the fact and the settlement must record
    // the refusal that was enforced, never the ask that was overruled. (Getting this backwards made a
    // refused call durably read as `allow` with decisionKind `ask`, then recover as UNKNOWN.)
    let decision = admission
    let capability
    if (admission.kind === 'ask') {
      if (grants === undefined || binding === undefined) {
        // No grant binder: there is no approval anyone could spend, so the ask is a refusal that
        // names itself rather than a prompt nobody can adjudicate, or an allow with a note on it.
        decision = { kind: 'deny', code: 'ADMISSION_ASK_UNWIRED', reason: admission.reason }
      } else {
        const minted = grants.binder.bind({
          member: grants.memberOf(binding),
          callId,
          policyRevision: binding.policyGeneration,
          toolBindingIdentity: `${binding.owner}/${exec.name}`,
          approvedOnce: true,
          lease: null,
        })
        if (minted.ok === false) {
          decision = { kind: 'deny', code: 'ADMISSION_GRANT_UNMINTABLE', reason: String(minted.code) }
        } else {
          capability = minted.value
        }
      }
    }
    try {
      record(invocationFactsOf({
        binding,
        toolName: exec.name,
        callId,
        arguments: exec.arguments,
        admission: decision,
        ...(admission.kind === decision.kind ? {} : { laneDecision: admission.kind }),
      }))
    } catch (error) {
      // The decision was made but cannot be recorded: a decision no reviewer can find is not one this
      // centre is willing to execute under.
      return refuseFault(exec, callId, 'ADMISSION_LEDGER_UNWRITABLE', error, 'record')
    }
    // The settlement record references the decision that was ENFORCED; it does not make one.
    if (settlement !== undefined) {
      try {
        settlement.admitted({ exec, callId, admission: decision })
      } catch (error) {
        return refuseFault(exec, callId, 'ADMISSION_SETTLEMENT_FAULT', error, 'settlement-open')
      }
    }
    const store = (entry) => {
      decided.set(callId, { ...entry, exec })
      return entry
    }
    if (decision.kind === 'deny') {
      // The code is part of the reason the model and the durable `tool/result` see: a refusal that
      // reads like prose cannot be grepped or counted, and cannot be told from a body failure later.
      const verdict = { kind: 'deny', reason: `${decision.code}: ${decision.reason}` }
      return store({ preExecute: verdict, guard: verdict.reason })
    }
    if (decision.kind === 'ask') {
      return store({ preExecute: { kind: 'ask', reason: decision.reason }, guard: undefined, capability })
    }
    return store({ preExecute: { kind: 'allow' }, guard: undefined })
  }

  /**
   * POST-APPROVAL RECHECK. The pre-execute decision is a moment, not a licence: between the ask and
   * the body the policy can be recompiled, the member revoked, or the lane narrowed. The guard is the
   * LAST place before the body, so it re-decides with the binding as it is NOW and refuses when the
   * answer changed - without spending the grant, because a grant that was not exercised must not be
   * burned by a stale call.
   */
  const recheck = (entry, exec) => {
    const wanted = entry.preExecute.kind === 'allow' ? 'allow' : 'ask'
    const binding = resolveBinding(exec)
    const now = admit({ binding, toolName: exec.name, arguments: exec.arguments })
    if (now.kind === wanted) return undefined
    const code = now.kind === 'deny' ? now.code : `RECHECK_${String(now.kind).toUpperCase()}`
    return `ADMISSION_RECHECK_${code}: the decision for ${JSON.stringify(callIdOfExec(exec))} was ${wanted} at pre-execute and is ${now.kind} now; the call is refused rather than executed under an authority that no longer holds`
  }

  /** Spend the grant once. Returns the guard reason (undefined = allow). */
  const spend = (entry, callId) => {
    /* c8 ignore next -- callers only invoke this with a minted capability */
    if (entry.capability === undefined) return entry.guard
    const consumed = grants.binder.consume(entry.capability, {
      memberIdentity: entry.capability.memberIdentity,
      callId: entry.capability.callId,
      policyRevision: entry.capability.policyRevision,
      toolBindingIdentity: entry.capability.toolBindingIdentity,
    })
    entry.capability = undefined
    if (consumed.ok === true) return undefined
    const verdict = `ADMISSION_GRANT_${consumed.code}: the approval for ${JSON.stringify(callId)} could not be spent`
    entry.guard = verdict
    return verdict
  }

  const disposePre = typeof ctx.on === 'function'
    ? ctx.on('tools/pre-execute', async (exec, next) => {
      const upstream = await next()
      // Another listener already refused or asked: do not override a verdict that is not ours.
      if (upstream.kind !== 'allow') return upstream
      return evaluate(exec).preExecute
    })
    : undefined

  // The memo lives for the DURATION OF ONE EXECUTION, not for the lifetime of the port: the host
  // consults the guard twice within a single dispatch, but a SECOND dispatch carrying the same
  // callId is a replay and must meet the ledger, not a stale verdict. `tools/result` is the
  // execution's end, so that is where the memo entry is dropped.
  const disposeResult = typeof ctx.on === 'function'
    ? ctx.on('tools/result', (exec) => {
      const callId = callIdOfExec(exec)
      decided.delete(callId)
      void callId
    })
    : undefined

  const disposeGuard = tools.guard((exec) => {
    const callId = callIdOfExec(exec)
    const entry = evaluate(exec)
    // A REPLAY refusal is already final; rechecking it would ask the lane for a second opinion on a
    // call that must never run.
    if (entry.capability === undefined && entry.guard === undefined) {
      const drift = recheck(entry, exec)
      if (drift !== undefined) return drift
      // THE BODY IS ABOUT TO RUN, so the settlement leaves ADMITTED exactly once. The host consults
      // the guard twice per execution; entering RUNNING twice would be a transition the store refuses,
      // which is how this was found.
      if (entry.running !== true && settlement !== undefined) {
        settlement.running({ exec })
        entry.running = true
      }
      return undefined
    }
    if (entry.capability !== undefined) {
      const drift = recheck(entry, exec)
      if (drift !== undefined) return drift
      const spent = spend(entry, callId)
      if (spent === undefined && settlement !== undefined && entry.running !== true) {
        settlement.running({ exec })
        entry.running = true
      }
      return spent
    }
    return entry.guard
  })

  if (typeof disposeGuard !== 'function') {
    throw new AdmissionPortError('DISPOSER_MISSING', 'tools.guard() returned no disposer; a guard that cannot be removed outlives the binding it was installed for')
  }
  return () => {
    disposeGuard()
    if (typeof disposePre === 'function') disposePre()
    if (typeof disposeResult === 'function') disposeResult()
  }
}
