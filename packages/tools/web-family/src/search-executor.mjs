/**
 * web-family/src/search-executor.mjs — the governed `web_search` effect
 * body (u7-f).
 *
 * NO PROVIDER, NO NETWORK: with no trusted provider mounted the row
 * answers `WEB_SEARCH_NO_PROVIDER` — typed, zero effects requested, zero
 * PA walk, zero wire (the matrix row stays NOT_VERIFIED until a real
 * provider is mounted; none is invented here).
 *
 * WITH A PROVIDER, the effect truth is the provider's own: the per-call
 * requested set is `tool-invoke(web_search)` plus one `connect` arm per
 * destination the mounted provider DECLARED at validation
 * (`destination()`/`extraDestinations()` — validated canonical https
 * origins). Declared == requested per call (the PR #390 law): the row
 * requests exactly the set the provider's calls actually consume, and the
 * provider holds no decision/admission face — authority stays the
 * kernel's (CI-06). A provider whose real calls drift from its declared
 * destinations is a broken mount, disclosed as a provider-enforced
 * assurance limit (three axes, DECISION-3): Team governs WHO may ask and
 * the port bounds time/bytes; the provider's upstream behaviour is the
 * provider's own boundary.
 *
 * Same authority posture as `web_fetch`: no rule in the seven-tool rule
 * grammar names a network effect, so default-deny refuses typed and
 * default-ask runs ONLY on a real per-call Control approval consumed
 * once. Same leak law: closed refusal codes, authored details, no header,
 * no query, no stack — the observe witness names the provider id and the
 * result counts only.
 *
 * @module web-family/search-executor
 */
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import { parseGovernedWebSearchArgs, webRefusal, WEB_SEARCH_MAX_RESULTS } from './web-mechanics.mjs'
import { isTransportCode } from './web-transport.mjs'
import { noProviderRefusal } from './web-search-provider.mjs'

export function createGovernedWebSearchExecutor({
  realmId,
  policy,
  decide,
  pa,
  provider,
  destinations = [],
  searchPort,
  maxBytes,
  timeoutMs,
  now = () => Date.now(),
  observe = () => {},
}) {
  let executed = 0
  let paSeq = 0
  const searchTokenLedger = new Map()
  const settledSignals = new Map()
  const searchSignalForSettled = (tokenKey) => {
    const prior = settledSignals.get(tokenKey)
    if (prior !== undefined) return prior
    const controller = new AbortController()
    controller.abort()
    settledSignals.set(tokenKey, controller.signal)
    return controller.signal
  }

  return async (raw, corr) => {
    // ── ZERO-EFFECT refusals BEFORE any effect machinery. ────────────────
    if (provider === null || provider === undefined) {
      observe('governed-web-search refused-no-provider')
      return noProviderRefusal()
    }
    if (searchPort === null || typeof searchPort !== 'object' || typeof searchPort.postJson !== 'function') {
      observe('governed-web-search refused-no-transport')
      return webRefusal('admission', 'WEB_SEARCH_NO_TRANSPORT', 'the mounted provider has no bounded search transport on this mount — nothing may leave')
    }
    const parsed = parseGovernedWebSearchArgs(raw)
    if (parsed.ok !== true) return parsed.refusal
    const effects = [
      { kind: 'tool-invoke', toolName: 'web_search', resource: null },
      ...destinations.map((canonicalLocator) => ({
        kind: 'connect',
        resource: { realmId, kind: 'network-destination', canonicalLocator, rights: ['connect'] },
      })),
    ]
    const verdict = decide({ effects })
    if (verdict.kind === 'deny') {
      observe(`governed-web-search lane-denied code=${String(verdict.code)} provider=${String(provider.id)}`)
      return webRefusal('admission', verdict.code, 'the template lane denies this network effect')
    }
    if (policy?.default === 'deny') {
      observe(`governed-web-search default-deny provider=${String(provider.id)}`)
      return webRefusal('admission', 'template-default-deny', 'the policy defaults to DENY and no rule can cover a network connect effect (the rule grammar names no network tool) — this call runs nothing')
    }
    if (typeof pa !== 'function') {
      return webRefusal('admission', 'PA_EDGE_UNAVAILABLE', 'this mount carries no PA admission edge, so no search may run')
    }
    const set = parseRequestedEffectSet(effects)
    if (!set.ok) return webRefusal('schema', 'effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
    paSeq += 1
    const token = corr?.token
    const tokenKey = (typeof token === 'object' && token !== null) || typeof token === 'symbol' ? token : undefined
    if (tokenKey !== undefined) {
      const prior = searchTokenLedger.get(tokenKey)
      if (prior !== undefined && !prior.settled) {
        return webRefusal('admission', 'exec-token-replay', 'this host execution already owns an in-flight governed search')
      }
    }
    const execCorrelation = corr && typeof corr.correlation === 'string' && corr.correlation.length > 0 ? corr.correlation : undefined
    const execSignal = corr && corr.signal ? corr.signal : undefined
    let ledgerCorrelation
    let replaySettled = false
    if (tokenKey !== undefined) {
      const prior = searchTokenLedger.get(tokenKey)
      if (prior !== undefined && prior.settled) {
        ledgerCorrelation = prior.correlation
        replaySettled = true
      } else {
        ledgerCorrelation = `plane-web-search:${String(realmId)}-${String(paSeq)}`
        searchTokenLedger.set(tokenKey, { correlation: ledgerCorrelation, settled: false })
      }
    }
    const searchSignal = replaySettled && tokenKey !== undefined ? searchSignalForSettled(tokenKey) : execSignal
    const gate = await pa({
      realmId,
      callId: ledgerCorrelation ?? execCorrelation ?? `plane-web-search-${String(realmId)}-${String(paSeq)}`,
      ...(searchSignal === undefined ? {} : { signal: searchSignal }),
      parametersFingerprint: set.value.fingerprint,
      requestedEffects: set.value,
    })
    if (gate.kind === 'deny') {
      observe(`governed-web-search pa-refused code=${String(gate.code)} provider=${String(provider.id)}`)
      return webRefusal('admission', String(gate.code), String(gate.detail ?? 'the PA execution edge refused this search'))
    }
    if (gate.kind === 'allow' && gate.cancelled === true) {
      observe(`governed-web-search cancelled-at-pa-edge provider=${String(provider.id)}`)
      return { kind: 'cancelled' }
    }
    // ── POST-CONSUME: the provider runs over the bounded search port,
    // inside the same wall-time bound. ──────────────────────────────────
    const startedAt = now()
    const deadlineAt = typeof timeoutMs === 'number' ? startedAt + timeoutMs : undefined
    const providerOutcome = await provider.search({
      queries: parsed.queries,
      maxResults: WEB_SEARCH_MAX_RESULTS,
      port: searchPort,
      ...(maxBytes === undefined ? {} : { maxBytes }),
      ...(deadlineAt === undefined ? {} : { deadlineAt }),
      now,
      ...(searchSignal === undefined ? {} : { signal: searchSignal }),
    })
    if (providerOutcome !== null && typeof providerOutcome === 'object' && providerOutcome.ok === true) {
      const sources = Array.isArray(providerOutcome.sources) ? providerOutcome.sources : []
      executed += 1
      if (tokenKey !== undefined) {
        const entry = searchTokenLedger.get(tokenKey)
        if (entry !== undefined) entry.settled = true
      }
      observe(`governed-web-search RAN seq=${String(executed)} sources=${String(sources.length)} provider=${String(provider.id)}`)
      return {
        kind: 'ok',
        ...(typeof providerOutcome.content === 'string' ? { content: providerOutcome.content } : {}),
        sources,
        truncated: providerOutcome.truncated === true,
      }
    }
    if (providerOutcome !== null && typeof providerOutcome === 'object' && providerOutcome.ok === false && providerOutcome.cancelled === true) {
      return { kind: 'cancelled' }
    }
    const code = providerOutcome?.code !== undefined && isTransportCode(providerOutcome.code)
      ? providerOutcome.code
      : (providerOutcome?.code === 'WEB_SEARCH_PROVIDER_STATUS' ? 'WEB_SEARCH_PROVIDER_STATUS' : 'WEB_SEARCH_FAILED')
    observe(`governed-web-search provider-failed code=${String(code)} provider=${String(provider.id)}`)
    return webRefusal('io', code, String(providerOutcome?.detail ?? 'the mounted search provider failed this call'))
  }
}
