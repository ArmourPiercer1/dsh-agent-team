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
 * THE ASK PATH (B stage). An `ask` is only a decision if somebody RECORDS it. The pre-execute stage
 * therefore turns the lane's ask into a durable Control request (the team's ONE approval authority),
 * waits for the durable decision through the EXISTING `ControlService.awaitControlDecision` bridge,
 * and only then mints the one-shot grant the guard spends immediately before the body. Every way that
 * can fail — no binder, no approval authority, a denied decision, a stale (expired) decision, an
 * abandoned wait, a fault — is a REFUSAL with its own code, recorded as the decision that was
 * ENFORCED. The port never turns "nobody answered" into "allowed".
 *
 * The one-shot grant connects the two stages: minted at pre-execute after the approval, spent at the
 * guard exactly once, immediately before the body. A grant that cannot be spent is a refusal never
 * an allow, and the grant is bound to the policy generation the approval named — so a recompiled
 * policy between the approval and the body refuses at the spend (the post-approval recheck).
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

/** Every Control correlation this port raises starts here: one call, one approval, no reuse. */
export const ADMISSION_CONTROL_CORRELATION_PREFIX = 'admission'

/**
 * The PRODUCT's approval authority, over the durable Control plane.
 *
 * WHAT IT IS: the adapter that turns ONE lane `ask` into a durable Control request, waits for the
 * durable decision through the EXISTING bridge (`ControlService.awaitControlDecision`), and reports
 * that decision to the admission point. It decides NOTHING and owns no state: the request row, the
 * decision row and the abandonment fact are the ControlService's append-only TeamDomain facts.
 *
 * WHAT IT IS NOT: not a second wait bridge (there is exactly one, `awaitControlDecision`), not a
 * grant ledger (the `member-io-policy` invocation binder is), and not a fallback. A Control service
 * that is absent, a request that cannot be written, or a service fault is a REFUSAL with its own
 * code — never "no opinion", and never an allow.
 *
 * THE REQUEST is `executionCoupling: 'inline'`: the request and its wait ARE the invocation's own
 * continuation (the coupling the Control plane already defines for request → wait → decision), so
 * the durable allow is not a reusable guard token and the exactly-once law is the one-shot grant.
 * The correlation is derived from the callId, which the centre has already refused to replay.
 *
 * @param {object} input
 * @param {() => object|undefined} input.controlOf - the LAZY ControlService accessor (the product's
 *   shared `controlServiceRef`); read per request, never captured at install time.
 * @param {(binding: object) => string} [input.rootSessionIdOf] - the owning TeamSession root for one
 *   binding; defaults to the binding's `owner` (the team root the centre was installed for).
 * @param {'leader-approval'|'user-approval'} [input.kind] - the Control request kind. The centre is
 *   installed on MEMBERS only, so the default is the Leader's approval.
 * @param {string} [input.actionName] - the Control action the approval covers.
 * @param {(record: object) => (void|Promise<void>)} [input.onRequested] - observation hook invoked
 *   with the durable request row BEFORE the wait begins (the row exists at this point). A throw is a
 *   refusal, not a warning: an approval nobody could observe is not one this port will spend.
 * @returns {{request: (input: object) => Promise<object>}} the approval port.
 */
export function createControlApprovalPort ({
  controlOf,
  rootSessionIdOf,
  kind = 'leader-approval',
  actionName = 'admission-ask',
  onRequested,
} = {}) {
  if (typeof controlOf !== 'function') {
    throw new AdmissionPortError('CONTROL_ACCESSOR_MISSING', 'the approval port needs a lazy control accessor; capturing the service at install time would freeze a reference the product fills later')
  }
  const rootOf = typeof rootSessionIdOf === 'function' ? rootSessionIdOf : (binding) => binding?.owner

  return Object.freeze({
    /**
     * Ask the Control plane for one call and wait for its durable decision.
     *
     * @param {object} input
     * @param {object} input.binding - the binding that raised the ask.
     * @param {string} input.callId - the host call id (the correlation's basis).
     * @param {string} input.toolName - the tool the ask covers.
     * @param {string} [input.laneReason] - the lane's own reason, carried as the request summary.
     * @returns {Promise<{ok: true, approval: {approvalId: string, policyRevision: string}} |
     *   {ok: false, code: string, reason: string}>}
     */
    async request ({ binding, callId, toolName, laneReason } = {}) {
      const service = controlOf()
      if (
        service === undefined || service === null ||
        typeof service.requestControl !== 'function' ||
        typeof service.awaitControlDecision !== 'function'
      ) {
        return {
          ok: false,
          code: 'ADMISSION_APPROVAL_UNAVAILABLE',
          reason: 'no durable ControlService is available on this row; an approval nobody can record is not one this centre will spend',
        }
      }
      const rootSessionId = rootOf(binding)
      const instanceId = binding?.agentId
      if (typeof rootSessionId !== 'string' || rootSessionId === '') {
        return {
          ok: false,
          code: 'ADMISSION_APPROVAL_UNBOUND',
          reason: 'the binding names no owning TeamSession root; a request nobody could address is not an approval',
        }
      }
      if (typeof instanceId !== 'string' || instanceId === '') {
        return {
          ok: false,
          code: 'ADMISSION_APPROVAL_UNBOUND',
          reason: 'the binding names no member instance; a request no reviewer could attribute is not an approval',
        }
      }
      const correlation = `${ADMISSION_CONTROL_CORRELATION_PREFIX}:${String(callId)}`
      let record
      try {
        record = await service.requestControl({
          rootSessionId,
          caller: { kind: 'instance', instanceId },
          kind,
          targetInstanceId: instanceId,
          actionName,
          ...(typeof toolName === 'string' && toolName !== '' ? { toolName } : {}),
          correlation,
          executionCoupling: 'inline',
          summary: `admission ask: ${String(toolName)}${typeof laneReason === 'string' && laneReason !== '' ? ` (${laneReason})` : ''}`,
        })
      } catch (error) {
        return {
          ok: false,
          code: 'ADMISSION_APPROVAL_REQUEST_FAULT',
          reason: `the durable control request could not be written (${String(error?.message ?? error)}); a call whose approval cannot be recorded is refused`,
        }
      }
      if (typeof onRequested === 'function') {
        try {
          await onRequested(record)
        } catch (error) {
          return {
            ok: false,
            code: 'ADMISSION_APPROVAL_REQUEST_FAULT',
            reason: `the durable control request could not be observed (${String(error?.message ?? error)}); the call is refused rather than approved unseen`,
          }
        }
      }
      let decision
      try {
        decision = await service.awaitControlDecision({ rootSessionId, requestId: record.requestId })
      } catch (error) {
        const code = typeof error?.code === 'string' ? error.code : ''
        if (code === 'CONTROL_WAIT_ABORTED') {
          return { ok: false, code: 'ADMISSION_APPROVAL_WAIT_ABORTED', reason: `the approval wait was aborted (${String(error?.message ?? error)}); the inline request is durably closed and this call cannot execute` }
        }
        if (code === 'CONTROL_REQUEST_ABANDONED') {
          return { ok: false, code: 'ADMISSION_APPROVAL_ABANDONED', reason: `the approval request was durably abandoned (${String(error?.message ?? error)}); an abandoned request can never become an allow` }
        }
        return { ok: false, code: 'ADMISSION_APPROVAL_WAIT_FAULT', reason: `the durable decision could not be awaited (${String(error?.message ?? error)}); a fault is a refusal` }
      }
      const value = decision?.decision
      if (value === 'allow') {
        return {
          ok: true,
          approval: {
            approvalId: String(record.requestId),
            // The generation the REVIEWER approved. The grant is bound to it, so a policy recompiled
            // between this line and the body refuses at the spend instead of running under an
            // authority that no longer holds.
            policyRevision: String(binding?.policyGeneration ?? ''),
          },
        }
      }
      if (value === 'deny') {
        return { ok: false, code: 'ADMISSION_APPROVAL_DENIED', reason: `the durable control decision for ${JSON.stringify(String(record.requestId))} is deny; the call is refused` }
      }
      if (value === 'stale-denied') {
        return { ok: false, code: 'ADMISSION_APPROVAL_EXPIRED', reason: `the durable control decision for ${JSON.stringify(String(record.requestId))} is stale-denied; an expired approval authorizes nothing` }
      }
      return { ok: false, code: 'ADMISSION_APPROVAL_UNRECOGNIZED', reason: `the durable control decision ${JSON.stringify(value)} is outside the closed decision vocabulary; an unreadable answer is a refusal` }
    },
  })
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
 * @param {(facts: object) => 'allow' | 'deny' | undefined} [input.overlayDecision] - the durable
 *   permission-plane restriction, consulted per call beside the lane verdict (E3, round 38). Absent means
 *   "no overlay wired", which is recorded as such rather than presented as an allow.
 * @param {{binder: object, memberOf: (binding: object) => object}} [input.grants] - the product's
 *   one-shot grant binder (`member-io-policy`) and the projection from a binding to the trusted
 *   member identity. Without it an ask stays refused: an approval nobody can spend is not one.
 * @param {{request: (input: object) => Promise<object>}} [input.approvals] - the durable approval
 *   authority (`createControlApprovalPort`). REQUIRED for an ask whenever `grants` is wired: a grant
 *   minted without a recorded approval would be an approval nobody gave.
 * @returns {() => void} the disposer.
 */
export function installAdmissionPoint ({ ctx, resolveBinding, record, callIdOf, isReplay, recordReplay, grants, approvals, settlement, overlayDecision, onFault }) {
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
  /** callId -> the in-flight ask (pre-execute is async; the memo is not written until it settles). */
  const pending = new Map()

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
   * Record the ENFORCED decision, open/close the settlement record, and memoize the verdict.
   *
   * The settlement record references the decision that was enforced; it does not make one. A deny is
   * terminal at birth: the store's own admission writer closes a refusal as REFUSED, so a denied or
   * expired approval leaves no open record to recover as UNKNOWN.
   */
  const commit = (exec, { binding, admission, decision, capability, wanted }) => {
    const callId = callIdOfExec(exec)
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
    // An APPROVED ask is an allow at pre-execute (the approval was the prompt) whose entry still
    // remembers that the LANE asked: the post-approval recheck must re-ask the lane the same question.
    return store({
      preExecute: { kind: 'allow' },
      guard: undefined,
      capability,
      ...(wanted === undefined ? {} : { wanted }),
    })
  }

  /**
   * The ONE decision for one call. `evaluate` is the SYNCHRONOUS half: replay, memo, lane, overlay,
   * and every decision that does not need a human. An ask that is wired to an approval authority is
   * handed back as `{ ask }` for the pre-execute stage to complete; the guard can never do that (it
   * cannot await), so an ask reaching the guard undecided is refused.
   */
  const evaluate = (exec) => {
    const callId = callIdOfExec(exec)
    const memo = decided.get(callId)
    // The memo serves ONE dispatch. The host consults the guard more than once for the SAME execution
    // (the same exec object), which is why the verdict is memoized; a DIFFERENT execution carrying the
    // same callId is a replay and must meet the ledger, not a stale verdict. The identity check is what
    // makes that distinction real - serving the memo on callId alone is how the same call could run
    // twice, and the alternatives (refusing every repeat) would break the double consultation.
    if (memo !== undefined && memo.exec === exec) return { entry: memo }
    if (memo !== undefined) return { entry: refuseReplay(exec, callId) }
    let replay = false
    try {
      replay = typeof isReplay === 'function' && isReplay(callId) === true
    } catch (error) {
      return { entry: refuseFault(exec, callId, 'ADMISSION_LEDGER_UNREADABLE', error, 'replay-check') }
    }
    if (replay) return { entry: refuseReplay(exec, callId) }
    const binding = resolveBinding(exec)
    const admission = admit({ binding, toolName: exec.name, arguments: exec.arguments })
    // THE FINAL DECISION, not the lane's raw answer. `admit` can answer `ask`, and an ask this port
    // cannot turn into a spendable approval is a REFUSAL - so the fact and the settlement must record
    // the refusal that was enforced, never the ask that was overruled. (Getting this backwards made a
    // refused call durably read as `allow` with decisionKind `ask`, then recover as UNKNOWN.)
    let decision = admission
    /** The one-shot grant, minted only when an approval authorizes this exact call. */
    let capability
    // THE DURABLE OVERLAY, consulted per call (round 38 — E3). The retired entry enforced the durable
    // Alpha.4 permission plane through a pre-execute adapter; the A1 cut retired that adapter with the
    // execution route, so a `grantInstance` deny persisted AFTER the member was bound had no decision-side
    // effect at all. The centre stays the ONE decision point: the overlay is a RESTRICTION consulted next
    // to the lane verdict, never a second authority, and it can only ever REMOVE authority.
    //
    // Ordering is deliberate: the overlay is asked only about calls the lane would otherwise ALLOW, so it
    // can never upgrade an `ask` into an `allow`, and a throw is treated as a REFUSAL (fail closed) rather
    // than as "no opinion".
    let overlay
    if (admission.kind === 'allow' && typeof overlayDecision === 'function') {
      try {
        overlay = overlayDecision({
          binding,
          callId,
          toolName: exec.name,
          arguments: exec.arguments,
          policyGeneration: binding === undefined ? undefined : binding.policyGeneration,
        })
      } catch (error) {
        decision = {
          kind: 'deny',
          code: 'ADMISSION_OVERLAY_FAULT',
          reason: `the durable overlay could not be consulted (${String(error?.message ?? error)}); a fault is a refusal, never an absence of opinion`,
        }
      }
      if (overlay === 'deny' && decision === admission) {
        decision = {
          kind: 'deny',
          code: 'ADMISSION_OVERLAY_DENY',
          reason: 'a durable permission-plane restriction denies this call; the compiled binding allowed it, so the overlay wins (it can remove authority, never grant it)',
        }
      }
    }
    if (admission.kind === 'ask') {
      if (grants === undefined || binding === undefined) {
        // No grant binder: there is no approval anyone could spend, so the ask is a refusal that
        // names itself rather than a prompt nobody can adjudicate, or an allow with a note on it.
        decision = { kind: 'deny', code: 'ADMISSION_ASK_UNWIRED', reason: admission.reason }
      } else if (approvals !== undefined && typeof approvals.request === 'function') {
        // A DURABLE approval authority is wired: the pre-execute stage records the ask as a Control
        // request and waits for the decision, then mints the grant. The guard cannot do that (no
        // await, no human), so the ask is handed back for completion.
        return { ask: { binding, admission } }
      } else {
        // THE HOST-NATIVE ASK. The pre-execute verdict IS the host's approval request, and the grant
        // is minted for exactly this execution to be spent at the guard once the host's approval
        // lands. This is the shape a world WITHOUT a durable Control plane runs (and the product
        // supplies `approvals` on every row that has one, so this path never stands in for it).
        const member = grants.memberOf(binding)
        if (member === undefined || member === null) {
          decision = {
            kind: 'deny',
            code: 'ADMISSION_MEMBER_UNIDENTIFIED',
            reason: 'the binding cannot be projected onto a complete trusted member identity; a grant bound to nobody is not one',
          }
        } else {
          const minted = grants.binder.bind({
            member,
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
    }
    return { entry: commit(exec, { binding, admission, decision }) }
  }

  /** Complete a wired ask: record the CONTROL decision, then mint the one-shot grant it authorizes. */
  const completeAsk = async (exec, { binding, admission }) => {
    const callId = callIdOfExec(exec)
    // THE TRUSTED IDENTITY COMES FIRST. A grant binds a complete member identity, so an incomplete one
    // is refused BEFORE a reviewer is asked: an approval nobody can bind is not one that could spend.
    const member = grants.memberOf(binding)
    if (member === undefined || member === null) {
      return commit(exec, {
        binding,
        admission,
        decision: {
          kind: 'deny',
          code: 'ADMISSION_MEMBER_UNIDENTIFIED',
          reason: 'the binding cannot be projected onto a complete trusted member identity; a grant bound to nobody is not one',
        },
      })
    }
    let approval
    try {
      approval = await approvals.request({
        binding,
        callId,
        toolName: exec.name,
        arguments: exec.arguments,
        laneReason: admission.reason,
      })
    } catch (error) {
      return commit(exec, {
        binding,
        admission,
        decision: {
          kind: 'deny',
          code: 'ADMISSION_APPROVAL_FAULT',
          reason: `the durable approval authority failed for ${JSON.stringify(callId)} (${String(error?.message ?? error)}); a fault is a refusal`,
        },
      })
    }
    if (approval === undefined || approval === null || approval.ok !== true) {
      const code = typeof approval?.code === 'string' && approval.code !== '' ? approval.code : 'ADMISSION_APPROVAL_FAULT'
      return commit(exec, {
        binding,
        admission,
        decision: {
          kind: 'deny',
          code,
          reason: typeof approval?.reason === 'string' && approval.reason !== ''
            ? approval.reason
            : 'the durable approval authority answered without a decision; an unreadable answer is a refusal',
        },
      })
    }
    const revision = typeof approval.approval?.policyRevision === 'string' && approval.approval.policyRevision !== ''
      ? approval.approval.policyRevision
      : binding.policyGeneration
    const minted = grants.binder.bind({
      member,
      callId,
      policyRevision: revision,
      toolBindingIdentity: `${binding.owner}/${exec.name}`,
      approvedOnce: true,
      lease: null,
    })
    if (minted.ok === false) {
      return commit(exec, {
        binding,
        admission,
        decision: { kind: 'deny', code: 'ADMISSION_GRANT_UNMINTABLE', reason: String(minted.code) },
      })
    }
    return commit(exec, {
      binding,
      admission,
      // The call RUNS under an approval the Control plane recorded: the enforced decision is an
      // allow whose fact keeps `laneDecision: ask` (the lane's own answer is never erased).
      decision: {
        kind: 'allow',
        reason: `approved by durable control request ${JSON.stringify(String(approval.approval?.approvalId ?? ''))}`,
      },
      capability: minted.value,
      wanted: 'ask',
    })
  }

  /**
   * POST-APPROVAL RECHECK. The pre-execute decision is a moment, not a licence: between the ask and
   * the body the policy can be recompiled, the member revoked, or the lane narrowed. The guard is the
   * LAST place before the body, so it re-decides with the binding as it is NOW and refuses when the
   * answer changed - without spending the grant, because a grant that was not exercised must not be
   * burned by a stale call.
   */
  const recheck = (entry, exec) => {
    const wanted = entry.wanted ?? (entry.preExecute.kind === 'allow' ? 'allow' : 'ask')
    const binding = resolveBinding(exec)
    const now = admit({ binding, toolName: exec.name, arguments: exec.arguments })
    if (now.kind === wanted) return undefined
    const code = now.kind === 'deny' ? now.code : `RECHECK_${String(now.kind).toUpperCase()}`
    return `ADMISSION_RECHECK_${code}: the decision for ${JSON.stringify(callIdOfExec(exec))} was ${wanted} at pre-execute and is ${now.kind} now; the call is refused rather than executed under an authority that no longer holds`
  }

  /**
   * Spend the grant once. Returns the guard reason (undefined = allow).
   *
   * The consume request carries the binding's policy generation AS IT IS NOW, so a policy recompiled
   * between the approval and the body is refused by the binder itself (`CAPABILITY_REVISION_MISMATCH`)
   * instead of executing an approval that named a generation nobody is running any more.
   */
  const spend = (entry, callId, exec) => {
    /* c8 ignore next -- callers only invoke this with a minted capability */
    if (entry.capability === undefined) return entry.guard
    const current = resolveBinding(exec)
    const consumed = grants.binder.consume(entry.capability, {
      memberIdentity: entry.capability.memberIdentity,
      callId: entry.capability.callId,
      policyRevision: current === undefined ? '' : String(current.policyGeneration ?? ''),
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
      const callId = callIdOfExec(exec)
      // ONE PRE-EXECUTE DECISION PER EXECUTION. The host runs the waterfall once, but an in-flight ask
      // must never be turned into a second durable request by a repeated consultation of the same exec.
      const inFlight = pending.get(callId)
      if (inFlight !== undefined && inFlight.exec === exec) return inFlight.promise
      const first = evaluate(exec)
      if (first.ask === undefined) return first.entry.preExecute
      const work = (async () => {
        try {
          return (await completeAsk(exec, first.ask)).preExecute
        } finally {
          pending.delete(callId)
        }
      })()
      pending.set(callId, { exec, promise: work })
      return work
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
    })
    : undefined

  const disposeGuard = tools.guard((exec) => {
    const callId = callIdOfExec(exec)
    const evaluated = evaluate(exec)
    if (evaluated.ask !== undefined) {
      // An ask that reached the guard was never completed: the approval can only be awaited at
      // pre-execute. Refusing here is the fail-closed reading of "no decision was made".
      const reason = `ADMISSION_APPROVAL_PENDING: the ask for ${JSON.stringify(callId)} reached the guard with no recorded approval; a call the centre could not adjudicate is refused rather than run`
      decided.set(callId, { preExecute: { kind: 'deny', reason }, guard: reason, exec })
      return reason
    }
    const entry = evaluated.entry
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
      const spent = spend(entry, callId, exec)
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
