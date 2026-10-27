/**
 * inspect-family/src/inspect-executor.mjs — the governed
 * `team_cordis_inspect_list` / `team_cordis_inspect_query` bodies.
 *
 * Both rows drive the host's PUBLIC `cordisInspect` registry face, resolved
 * LAZILY per call through the mount's agent ctx (the `attachments`/`llm`
 * seam law of the read_image row): an absent seam is the typed
 * `inspect-service-unmounted` refusal — never a bypass, never a fake. The
 * face is READ-ONLY introspection (the host registry throws on any
 * mutation-shaped attempt of its own; this lane never declares a write,
 * connect, or domain-ref effect and never invokes a business Service).
 *
 * THE QUERY LEG (the cancel law, applied — search-family/cancel-leg,
 * referenced not copied): the settle race is `raceConfinedSettle` with the
 * tie law `exited > timedOut > aborted` decided by registration order and
 * never re-decided; the row's own bound is `INSPECT_QUERY_BUDGET_MS`. A
 * TIMEOUT or an ABORT answers with its own typed refusal, and the answer is
 * FINAL: the raced promise has already settled, so a value that resolves
 * LATER is never delivered (the no-late-result-delivery law — a cancelled
 * query produced NO answer, and an empty or late payload would be a lie
 * about work the caller already gave up on). On both losing arms the row
 * aborts its own downstream controller, which is the public seam's own stop
 * path (the host registry settles a pending Client query as cancelled when
 * its signal aborts, inspect-registry.ts @639ed01539); `signal.reason` is
 * never read or echoed and no user intent is claimed.
 */
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import { callAborted, raceConfinedSettle, CANCEL_CODE_ABORTED } from '../../search-family/src/cancel-leg.mjs'
import {
  INSPECT_DIRECTORY_LOCATOR,
  INSPECT_QUERY_BUDGET_MS,
  findMethod,
  findProvider,
  inspectMethodLocator,
  isSafeLocatorSegment,
  validateInputSubset,
} from './inspect-mechanics.mjs'

const QUERY_PARAMETER_KEYS = new Set(['platform', 'provider', 'method', 'input'])

function sharedRefusers({ observe }) {
  const refused = (refusalClass, code, detail) => ({
    kind: 'refused', refusalClass, code, text: `refused-${refusalClass} ${String(code)} — ${detail}`,
  })
  return { refused, observe }
}

/** The shared admission composition: lane → default-deny → PA edge. Returns
 *  either a refusal outcome or the settled effect-set for the body. */
async function admit({ realmId, policy, decide, pa, effects, corr, label, refused, observe, paNonce, paSeqRef }) {
  const verdict = decide({ effects })
  if (verdict.kind === 'deny') {
    observe(`governed-${label} lane-denied code=${String(verdict.code)}`)
    return { refusal: refused('admission', verdict.code, 'the template lane denies this inspect effect') }
  }
  if (policy?.default === 'deny') {
    observe(`governed-${label} default-deny`)
    return { refusal: refused('admission', 'template-default-deny', 'the policy defaults to DENY and no rule covers this inspect effect') }
  }
  if (typeof pa !== 'function') {
    return { refusal: refused('admission', 'PA_EDGE_UNAVAILABLE', `this mount carries no PA admission edge, so no inspect ${label} may run`) }
  }
  const set = parseRequestedEffectSet(effects)
  if (!set.ok) return { refusal: refused('schema', 'effect-set-rejected', JSON.stringify(set.problems).slice(0, 200)) }
  const seq = paSeqRef.value += 1
  const gate = await pa({
    realmId,
    callId: `plane-${label}-${paNonce}-${String(seq)}`,
    ...(corr.signal === undefined ? {} : { signal: corr.signal }),
    parametersFingerprint: set.value.fingerprint,
    requestedEffects: set.value,
  })
  if (gate.kind === 'deny') {
    observe(`governed-${label} pa-refused code=${String(gate.code)}`)
    return { refusal: refused('admission', String(gate.code), String(gate.detail ?? `the PA execution edge refused this inspect ${label}`)) }
  }
  if (gate.kind === 'allow' && gate.cancelled === true) {
    observe(`governed-${label} cancelled-at-pa-edge`)
    return { refusal: { kind: 'cancelled' } }
  }
  return { set }
}

/**
 * The governed LIST row: parameters {}, effect set = tool-invoke + ONE meta
 * arm over the provider directory; body = the registry's own `list()`.
 */
export function createGovernedInspectListExecutor({ realmId, policy, decide, pa, inspectFace, observe = () => {} }) {
  const { refused } = sharedRefusers({ observe })
  let paSeq = { value: 0 }
  const nonce = String(globalThis.crypto?.randomUUID?.() ?? `l-${Date.now()}`)
  return async (_raw, corr = {}) => {
    const svc = typeof inspectFace === 'function' ? inspectFace() : inspectFace
    if (svc === undefined || svc === null || typeof svc.list !== 'function') {
      return refused('admission', 'inspect-service-unmounted', 'the host cordisInspect registry service is not mounted on this ctx; the governed inspect row holds no fallback and loads nothing')
    }
    const effects = [
      { kind: 'tool-invoke', toolName: 'cordis_inspect_list', resource: null },
      { kind: 'meta', resource: { realmId, kind: 'metadata', canonicalLocator: INSPECT_DIRECTORY_LOCATOR, rights: ['meta'] } },
    ]
    const admitted = await admit({ realmId, policy, decide, pa, effects, corr, label: 'inspect-list', refused, observe, paNonce: nonce, paSeqRef: paSeq })
    if (admitted.refusal !== undefined) return admitted.refusal
    try {
      const providers = svc.list()
      observe(`governed-inspect-list RAN count=${String(Array.isArray(providers) ? providers.length : 0)}`)
      return { kind: 'ok', value: { providers: Array.isArray(providers) ? providers : [] } }
    } catch (error) {
      return refused('io', 'inspect-list-failed', `the inspect registry could not answer (no listing was produced): ${String(error?.message ?? error).slice(0, 240)}`)
    }
  }
}

/**
 * The governed QUERY row: closed parameters, directory + schema pre-checks
 * (unknown provider/method and invalid input are refused BEFORE any
 * dispatch, with the available choices listed), PA over tool-invoke + two
 * meta arms, then the bounded settle-race body with the cancel law above.
 */
export function createGovernedInspectQueryExecutor({ realmId, policy, decide, pa, inspectFace, queryBudgetMs = INSPECT_QUERY_BUDGET_MS, observe = () => {} }) {
  const { refused } = sharedRefusers({ observe })
  let paSeq = { value: 0 }
  const nonce = String(globalThis.crypto?.randomUUID?.() ?? `q-${Date.now()}`)
  return async (raw, corr = {}) => {
    const unknownKey = Object.keys(raw ?? {}).find((key) => !QUERY_PARAMETER_KEYS.has(key))
    if (unknownKey !== undefined) {
      return refused('schema', 'unexpected-parameter', `parameter "${unknownKey}" is outside the closed contract {platform, provider, method, input?} — mutation-shaped or oversized requests are not part of this row`)
    }
    const platform = raw?.platform
    const providerId = raw?.provider
    const method = raw?.method
    if (platform !== 'host' && platform !== 'client') {
      return refused('schema', 'inspect-platform-invalid', 'platform must be exactly "host" or "client"')
    }
    if (!isSafeLocatorSegment(providerId ?? '') || !isSafeLocatorSegment(method ?? '')) {
      return refused('schema', 'inspect-id-invalid', 'provider and method must be plain identifier segments (no separators, no parent segments, no URI schemes)')
    }
    const svc = typeof inspectFace === 'function' ? inspectFace() : inspectFace
    if (svc === undefined || svc === null || typeof svc.query !== 'function' || typeof svc.list !== 'function') {
      return refused('admission', 'inspect-service-unmounted', 'the host cordisInspect registry service is not mounted on this ctx; the governed inspect row holds no fallback and dispatches nothing')
    }
    // Directory + contract pre-checks (declared by the meta arms below;
    // read-only introspection, zero mutation): unknown provider/method and
    // invalid input are refused BEFORE any dispatch, listing what IS
    // available — the row never guesses.
    let listed
    try {
      listed = svc.list()
    } catch (error) {
      return refused('io', 'inspect-list-failed', `the inspect registry could not answer (no listing was produced): ${String(error?.message ?? error).slice(0, 240)}`)
    }
    const located = findProvider(listed, platform, providerId)
    if (located.ok !== true) return refused('admission', located.code, located.detail)
    const methodHit = findMethod(located.provider, method)
    if (methodHit.ok !== true) return refused('admission', methodHit.code, methodHit.detail)
    if (raw?.input !== undefined) {
      const problems = validateInputSubset(methodHit.method?.inputSchema, raw.input)
      if (problems.length > 0) {
        return refused('schema', 'inspect-input-invalid', `the input does not satisfy the method's declared schema: ${problems.slice(0, 4).join('; ').slice(0, 240)}`)
      }
    }
    const effects = [
      { kind: 'tool-invoke', toolName: 'cordis_inspect_query', resource: null },
      { kind: 'meta', resource: { realmId, kind: 'metadata', canonicalLocator: INSPECT_DIRECTORY_LOCATOR, rights: ['meta'] } },
      { kind: 'meta', resource: { realmId, kind: 'metadata', canonicalLocator: inspectMethodLocator(platform, providerId, method), rights: ['meta'] } },
    ]
    const admitted = await admit({ realmId, policy, decide, pa, effects, corr, label: 'inspect-query', refused, observe, paNonce: nonce, paSeqRef: paSeq })
    if (admitted.refusal !== undefined) return admitted.refusal
    // ── POST-CONSUME body: the bounded settle race (cancel law above). ───
    const agent = corr.agent
    if (agent === undefined || agent === null) {
      return refused('admission', 'inspect-agent-unresolved', 'Cordis inspection requires an Agent-backed session (the host registry scopes every query to the requesting Agent)')
    }
    const controller = new AbortController()
    const downstreamSignal = corr.signal
    const forwardAbort = () => controller.abort()
    let forwarded = false
    if (downstreamSignal !== undefined && downstreamSignal !== null) {
      if (downstreamSignal.aborted === true) controller.abort()
      else {
        downstreamSignal.addEventListener('abort', forwardAbort, { once: true })
        forwarded = true
      }
    }
    const queryPromise = Promise.resolve()
      .then(() => svc.query(platform, providerId, method, raw?.input, agent, controller.signal))
      .then((value) => ({ settled: true, ok: true, value }), (error) => ({ settled: true, ok: false, error }))
    let winner
    try {
      winner = await raceConfinedSettle({
        exited: queryPromise,
        timeoutMs: queryBudgetMs,
        ...(downstreamSignal === undefined || downstreamSignal === null ? {} : { signal: downstreamSignal }),
      })
    } catch (error) {
      // raceConfinedSettle propagates a rejecting `exited` untouched; the
      // mapped query promise never rejects, so this is a leg-level defect.
      winner = { settled: true, ok: false, error }
    } finally {
      if (forwarded && downstreamSignal !== undefined && downstreamSignal !== null) {
        downstreamSignal.removeEventListener('abort', forwardAbort)
      }
    }
    if (winner !== null && typeof winner === 'object' && winner.settled === true) {
      if (winner.ok === true) {
        observe(`governed-inspect-query RAN platform=${platform} provider=${providerId} method=${method}`)
        return { kind: 'ok', value: { platform, provider: providerId, method, data: winner.value } }
      }
      if (callAborted(downstreamSignal)) {
        observe(`governed-inspect-query ${CANCEL_CODE_ABORTED} provider=${providerId} method=${method}`)
        return refused('admission', CANCEL_CODE_ABORTED, 'the call was aborted; the registry settles its pending query as cancelled on the abort signal, and this row will NEVER publish a late result')
      }
      return refused('io', 'inspect-provider-refused', `the inspect provider refused the query (no result was produced): ${String(winner.error?.message ?? winner.error).slice(0, 240)}`)
    }
    // The losing arms: BOTH answer typed refusals and BOTH are final — the
    // raced promise already settled, so any value that resolves later is
    // never delivered. Aborting the downstream controller is the public
    // seam's own stop path for the pending work.
    controller.abort()
    if (winner !== null && typeof winner === 'object' && winner.timedOut === true) {
      observe(`governed-inspect-query timed-out provider=${providerId} method=${method} budgetMs=${String(queryBudgetMs)}`)
      return refused('io', 'inspect-query-timeout', `the inspect query did not settle within its ${String(queryBudgetMs)}ms bound; the pending work is being cancelled through the registry's own signal and its result, whenever it lands, is NOT delivered to this call`)
    }
    observe(`governed-inspect-query ${CANCEL_CODE_ABORTED} provider=${providerId} method=${method}`)
    return refused('admission', CANCEL_CODE_ABORTED, 'the call was aborted before any answer settled; the pending work is cancelled through the registry\'s own signal and this row will NEVER publish a late result')
  }
}
