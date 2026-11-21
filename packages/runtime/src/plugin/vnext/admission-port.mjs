/**
 * admission-port.mjs — puts the admission point on the agent's tool scope.
 *
 * The host already runs, in this order: every `tools/pre-execute` listener, then every registered
 * guard, then the body. A guard returns a denial reason or nothing — it has no "allow", so nothing
 * downstream can turn a refusal back into permission. That is exactly the monotonic shape this
 * centre needs, and it is why the port installs a GUARD rather than wrapping definitions.
 *
 * WHAT IS DELIBERATELY NOT HERE YET: `ask`. A guard cannot ask; an ask is a `tools/pre-execute`
 * verdict that enters the host approval flow. Until Control is wired to that verdict (B), an ask
 * becomes an explicit refusal carrying `ADMISSION_ASK_UNWIRED` — the plan's rule that a controlled
 * call the centre has not been wired for is refused, never silently downgraded to allow and never
 * turned into an approval prompt the centre cannot adjudicate.
 *
 * WHAT EVERY DECISION WRITES. One record per call, including allows: after an incident the
 * question is "which locator did this agent try, under which policy generation", and an allow is as
 * much part of that record as a refusal. The sink is injected so the same port can write to the
 * session, to a JSONL fixture, or to both.
 *
 * @module packages/runtime/src/plugin/vnext/admission-port
 */

import { admit, invocationFactsOf } from './admission.ts'

export class AdmissionPortError extends TypeError {
  constructor (code, message) {
    super(`admission-port: ${message}`)
    this.name = 'AdmissionPortError'
    this.code = code
  }
}

/**
 * Install the guard on `ctx` (the agent's own context, so the host layers it by `exec.agent`).
 *
 * @param {object} input
 * @param {object} input.ctx - the agent-scoped Cordis context that owns `tools`.
 * @param {(exec: object) => object|undefined} input.resolveBinding - maps one execution to the
 *   binding that governs it, or `undefined` when the centre has no authority for it.
 * @param {(facts: object) => void} input.record - the fact sink. Called for EVERY decision.
 * @param {() => string} [input.callIdOf] - optional override; defaults to the host's `exec.callId`.
 * @param {(callId: string) => boolean} [input.isReplay] - true when the durable ledger already holds
 *   an admission record for this callId. A replay is refused BEFORE `admit`, because admitting it
 *   again would mean the same identity governed twice.
 * @param {(input: {callId: string, toolName: string, reason: string}) => void} [input.recordReplay]
 *   - where the replay refusal itself is recorded; it must outlive the process that observed it.
 * @returns {() => void} the disposer.
 */
export function installAdmissionPoint ({ ctx, resolveBinding, record, callIdOf, isReplay, recordReplay }) {
  if (ctx === undefined || ctx === null) throw new AdmissionPortError('CTX_MISSING', 'no agent context to install on')
  const tools = typeof ctx.get === 'function' ? ctx.get('tools') : undefined
  if (tools === undefined || tools === null || typeof tools.guard !== 'function') {
    throw new AdmissionPortError('TOOLS_UNAVAILABLE', 'the agent context has no tools service with guard(); installing an admission point without one would enforce nothing while looking installed')
  }
  if (typeof resolveBinding !== 'function') throw new AdmissionPortError('RESOLVER_MISSING', 'resolveBinding must be a function: a static binding cannot answer for a resumed or re-bound agent')
  if (typeof record !== 'function') throw new AdmissionPortError('RECORD_MISSING', 'record must be a function: a decision without a fact is unreviewable')

  // MEASURED: the host consults a guard more than once for one execution (prepare and commit both
  // ask). The DECISION for a callId is therefore made once and memoized, and the durable record is
  // written once: consulting the same guard twice must not append a second authority record, and
  // must not be able to change its mind between the two consultations.
  const decided = new Map()

  const dispose = tools.guard((exec) => {
    const callId = typeof callIdOf === 'function' ? callIdOf(exec) : exec.callId
    if (decided.has(callId)) return decided.get(callId)
    // REPLAY FIRST. A callId the ledger has already admitted is not re-judged: re-judging it would
    // either duplicate its authority record or silently replace the first decision, and both make
    // the durable record unable to answer "what exactly was decided for this call".
    if (typeof isReplay === 'function' && isReplay(callId)) {
      const reason = `ADMISSION_REPLAY: callId ${JSON.stringify(callId)} already has an admission record; a replay is refused rather than re-judged`
      if (typeof recordReplay === 'function') recordReplay({ callId, toolName: exec.name, reason })
      decided.set(callId, reason)
      return reason
    }
    const binding = resolveBinding(exec)
    const admission = admit({ binding, toolName: exec.name, arguments: exec.arguments })
    record(invocationFactsOf({ binding, toolName: exec.name, callId, arguments: exec.arguments, admission }))
    // The code is part of the reason the model and the durable `tool/result` see: a refusal that
    // reads like prose cannot be grepped, counted, or told apart from a body failure hours later.
    if (admission.kind === 'deny') return `${admission.code}: ${admission.reason}`
    if (admission.kind === 'ask') {
      // FAIL CLOSED, LOUDLY. The host honours an ask only through the approval flow that Control
      // owns; until that wiring exists, an ask is a refusal that names itself rather than a prompt
      // no one can answer, or - worse - an allow with a note attached.
      const verdict = `ADMISSION_ASK_UNWIRED: ${admission.reason}`
      decided.set(callId, verdict)
      return verdict
    }
    decided.set(callId, undefined)
    return undefined
  })
  if (typeof dispose !== 'function') {
    throw new AdmissionPortError('DISPOSER_MISSING', 'tools.guard() returned no disposer; a guard that cannot be removed outlives the binding it was installed for')
  }
  return dispose
}
