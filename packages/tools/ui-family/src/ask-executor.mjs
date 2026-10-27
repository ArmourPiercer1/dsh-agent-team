/**
 * ui-family/src/ask-executor.mjs — the governed `ask_user_question` effect
 * body (u7-f). Like every family body since U7-9a: the body is the
 * family's, and EVERY authority force arrives injected — the lane verdict,
 * the Kernel's admission walk incl. the one-shot consume edge, fresh
 * template facts, and the INJECTED interaction port (`portRef`). The body
 * mints no grant, approves nothing, consumes nothing by itself, and holds
 * no UI face: the human interaction lands ONLY through the port the trusted
 * mount supplied.
 *
 * THE TIMEOUT LAW (the reason the variant exists): a timed question whose
 * foreground wait expires answers the TYPED pending outcome —
 * `{pending: true, callId, message}` with the host's verbatim notice — and
 * the row NEVER turns a pending wait into an answer: the pending branch is
 * checked FIRST and an `answers` field riding along a dishonest port's
 * pending result is DROPPED, not merged. An invalid timeout value is a
 * typed refusal BEFORE the PA edge (zero consumption, zero port call);
 * `-1` takes the host's keyed indefinite-`wait` ask form, never a fake
 * timer.
 *
 * ORDERING LAW (identical to the fs mutation entries): pure parse → port
 * face check (absent port = typed refusal, ZERO PA consumption and ZERO
 * port calls — a call that could never run never spends a grant) → lane
 * deny fast path → template-default-deny re-check → closed effect-set
 * parse → one-per-token correlation ledger → the Kernel's PA edge (the
 * returned `allow` IS the consumed proof) → ONLY THEN the port. The
 * declared set carries the interaction effect as a `domain-ref` arm over
 * the family's declared Domain Authority — declared == requested, one
 * identity, two faces (the PR #390 lesson, made structural).
 *
 * @module ui-family/ask-executor
 */
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import {
  ASK_USER_QUESTION_NATIVE_NAME,
  DEFAULT_ASK_TIMEOUT_SECONDS,
  PENDING_NOTICE,
  TIMED_WAIT_PARAMETER,
  USER_INTERACTION_DOMAIN_AUTHORITY,
  parseAskArgs,
  toModelAnswers,
  toServiceQuestions,
} from './ui-mechanics.mjs'
import { hasUiPortFace } from './ui-interaction-port.mjs'

/**
 * Build the governed ask executor for one mount.
 *
 * @param {object} input
 * @param {string} input.realmId - the mount's realm (effect pairing key).
 * @param {object} input.policy - fresh-template permission policy facts.
 * @param {(x: {effects: unknown[]}) => {kind: string, code?: string}} input.decide
 *   - the plane lane verdict (deny fast path).
 * @param {(paCall: object) => Promise<object>} input.pa - the Kernel's
 *   admission edge (admit → ask when required → one-shot consume, all
 *   inside; the returned `allow` IS the consumed proof).
 * @param {() => unknown} input.portRef - the INJECTED interaction port,
 *   resolved per call (absent = the fail-closed typed refusal; a trusted
 *   mount may swap the port in after the plane was built — the image row's
 *   lazy host-seam law).
 * @param {boolean} [input.timed] - mount-level variant selection (the host
 *   `mode: 'timed'` mirror): true registers the timed shape (the `timeout`
 *   parameter, unique question ids, the bounded wait and its pending
 *   outcome); false/absent is the legacy shape (host default).
 * @param {(line: string) => void} [input.observe] - effect witness lines
 *   (counts and codes only — question TEXTS and answer payloads are user
 *   data and never ride an observation line).
 */
export function createGovernedAskExecutor({ realmId, policy, decide, pa, portRef, timed = false, observe = () => {} }) {
  let paSeq = 0
  const mountNonce = String(globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.floor(Math.random() * 2 ** 31)}`)
  // ONE correlation per host execution token for the token's whole life —
  // the fs executors' ledger law, one home per entry point: a SETTLED
  // token re-used answers under an already-aborted signal (the PA edge
  // settles `cancelled`, zero port call, zero consumption); an IN-FLIGHT
  // replay is refused outright; a stringy token is not an identity.
  const askTokenLedger = new Map()
  const settledTokenSignals = new WeakMap()
  const askSignalForSettled = (token) => {
    const cached = settledTokenSignals.get(token)
    if (cached !== undefined) return cached
    const settled = { aborted: true, reason: 'exec-token-terminal', addEventListener: (_t, _l) => {}, removeEventListener: (_t, _l) => {} }
    settledTokenSignals.set(token, settled)
    return settled
  }
  const refused = (refusalClass, code, detail, sideEffectPossible) => ({
    kind: 'refused', refusalClass, code, text: `refused-${refusalClass} ${String(code)} — ${detail}`,
    ...(sideEffectPossible === true ? { sideEffectPossible: true } : {}),
  })

  return async (raw, corr) => {
    const token = corr?.token
    const tokenKey = (typeof token === 'object' && token !== null) || typeof token === 'symbol' ? token : undefined
    if (tokenKey !== undefined) {
      const prior = askTokenLedger.get(tokenKey)
      if (prior !== undefined && !prior.settled) {
        return refused('admission', 'exec-token-replay', 'this host execution already owns an in-flight governed question')
      }
    }
    let ledgerCorrelation
    let replaySettled = false
    try {
      const execCorrelation = corr && typeof corr.correlation === 'string' && corr.correlation.length > 0 ? corr.correlation : undefined
      const execSignal = corr && corr.signal ? corr.signal : undefined
      // ── PURE front: the closed parameter contract (and, for the timed
      // variant, the timeout law + id uniqueness). Zero port touch, zero
      // authority consumption below this line until the PA edge allows. ──
      const parsed = parseAskArgs(raw, { timed })
      if (parsed.ok !== true) return refused('schema', parsed.code, parsed.detail)
      // ── The port gate BEFORE any authority force: absent face = the
      // fail-closed typed refusal with ZERO PA consumption and ZERO port
      // calls (a call that could never interact never spends a grant). ────
      const port = typeof portRef === 'function' ? portRef() : null
      const timeout = timed ? (parsed.value[TIMED_WAIT_PARAMETER] ?? DEFAULT_ASK_TIMEOUT_SECONDS) : undefined
      const face = timed && timeout !== -1 ? 'askTimed' : 'ask'
      if (!hasUiPortFace(port, face)) {
        observe(`governed-ask port-refusal face=${face} timed=${String(timed)}`)
        return refused('admission', 'UI_INTERACTION_PORT_ABSENT', `this mount carries no injected interaction port (${face} face), so no question can be asked — the governed row fails closed and asks nobody`)
      }
      const effects = [
        { kind: 'tool-invoke', toolName: ASK_USER_QUESTION_NATIVE_NAME, resource: null },
        // The interaction effect over the family's declared Domain
        // Authority (the suspended human exchange is the second target the
        // call honestly names — declared == requested, never a hidden arm).
        { kind: 'domain-ref', domainAuthorityId: USER_INTERACTION_DOMAIN_AUTHORITY, resource: null },
      ]
      const verdict = decide({ effects })
      if (verdict.kind === 'deny') {
        observe(`governed-ask lane-denied refusal code=${String(verdict.code)}`)
        return refused('admission', verdict.code, 'the template lane denies this interaction effect')
      }
      if (policy?.default === 'deny') {
        // The frozen rule vocabulary (read|read_image|write|edit|lsp|bash|
        // pwsh) names NO interaction rule — under a default-DENY template
        // no rule can ever cover a question, so the lane law refuses here
        // exactly where the Kernel's coverage scan would refuse at the
        // edge: zero consumption, zero port calls, one typed code.
        observe('governed-ask default-deny refusal')
        return refused('admission', 'template-default-deny', 'the policy defaults to DENY and the closed rule grammar names no interaction rule that could cover a user question')
      }
      if (typeof pa !== 'function') {
        return refused('admission', 'PA_EDGE_UNAVAILABLE', 'this mount carries no PA admission edge, so no question may be asked')
      }
      const set = parseRequestedEffectSet(effects)
      if (!set.ok) return refused('schema', 'effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
      paSeq += 1
      if (tokenKey !== undefined) {
        const prior = askTokenLedger.get(tokenKey)
        if (prior !== undefined && prior.settled) {
          ledgerCorrelation = prior.correlation
          replaySettled = true
        } else {
          ledgerCorrelation = `plane-ask:${mountNonce}-${String(paSeq)}`
          askTokenLedger.set(tokenKey, { correlation: ledgerCorrelation, settled: false })
        }
      }
      const askSignal = replaySettled && tokenKey !== undefined ? askSignalForSettled(tokenKey) : execSignal
      const callId = ledgerCorrelation ?? execCorrelation ?? `plane-ask-${mountNonce}-${String(paSeq)}`
      const gate = await pa({
        realmId,
        callId,
        ...(askSignal === undefined ? {} : { signal: askSignal }),
        parametersFingerprint: set.value.fingerprint,
        requestedEffects: set.value,
      })
      if (gate.kind === 'deny') {
        observe(`governed-ask pa-refused code=${String(gate.code)} detail=${String(gate.detail ?? '').slice(0, 240)}`)
        return refused('admission', String(gate.code), String(gate.detail ?? 'the PA execution edge refused this question'))
      }
      if (gate.kind === 'allow' && gate.cancelled === true) {
        observe('governed-ask cancelled-at-pa-edge')
        return { kind: 'cancelled' }
      }
      // ── POST-CONSUME: the interaction lands through the injected port,
      // and ONLY through it. The service speaks the service shape. ───────
      const request = { questions: toServiceQuestions(parsed.value.questions), ...(askSignal === undefined ? {} : { signal: askSignal }) }
      let result
      try {
        if (!timed) {
          result = await port.ask(request)
        } else if (timeout === -1) {
          // Host law (timed.ts:63-72): the timed tool's indefinite form is
          // the KEYED wait — the card reopens by this call's identity.
          result = await port.ask({ ...request, wait: { callId } })
        } else {
          result = await port.askTimed(request, callId, timeout * 1000)
        }
      } catch (error) {
        if (askSignal?.aborted === true) {
          observe('governed-ask aborted-in-port')
          return { kind: 'cancelled' }
        }
        // The port's own typed refusal (CALLER_NOT_LIVE, DELEGATED_CALLER,
        // BAD_TIMEOUT…) surfaces VERBATIM as the code carrier — the
        // service's ownership law is the service's, never rewritten here.
        const message = String(error?.message ?? error).slice(0, 240)
        observe(`governed-ask port-failed detail=${message}`)
        return refused('io', 'UI_INTERACTION_PORT_FAILED', `the interaction port refused the question (${message})`, true)
      }
      // THE TIMEOUT LAW, enforced at the row: the pending branch FIRST; a
      // dishonest port riding answers alongside pending gets them DROPPED
      // (never merged, never surfaced) — an expired wait is never a
      // fabricated answer.
      if (timed && result?.pending === true) {
        observe(`governed-ask RAN pending callId=${callId}`)
        return { kind: 'ok', value: { pending: true, callId, message: PENDING_NOTICE } }
      }
      if (!Array.isArray(result?.answers)) {
        observe('governed-ask port-malformed')
        return refused('io', 'UI_INTERACTION_PORT_MALFORMED', 'the interaction port answered neither an answer batch nor the pending outcome — nothing is fabricated in its place', true)
      }
      const value = toModelAnswers(result)
      observe(`governed-ask RAN answers=${String(value.answers.length)}`)
      return { kind: 'ok', value }
    } finally {
      if (tokenKey !== undefined) {
        const prior = askTokenLedger.get(tokenKey)
        if (prior !== undefined) prior.settled = true
      }
    }
  }
}
