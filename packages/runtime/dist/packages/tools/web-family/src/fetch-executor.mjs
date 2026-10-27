/**
 * web-family/src/fetch-executor.mjs — the governed `web_fetch` effect body
 * (u7-f, the first network-effect family).
 *
 * OWNER ROLE (family lane): this is the effect BODY. Every authority force
 * arrives INJECTED — `decide` (the lane verdict), `pa` (the Kernel's
 * admission walk incl. the one-shot consume edge), `policy` (template
 * facts) — and, as in the fs bodies, the PA edge answers BEFORE any wire
 * byte: nothing below it runs unless the edge allowed, and the body mints
 * nothing, approves nothing, consumes nothing by itself.
 *
 * THE EFFECT SET (the PR #390 law: declared == requested, per call):
 *   tool-invoke(web_fetch)
 *   connect  on the network-destination `<scheme://host[:port]>`
 * The frozen vocabulary binds `connect` to a network destination whose
 * canonical locator is the ORIGIN (`resource.ts`: a destination never
 * looks like a path) — so the approved question is per-origin. Disclosed
 * consequence, stated where it belongs: every path on an approved origin
 * is inside the grant, and a redirect that stays on the approved origin
 * is the SAME approved effect, while a redirect OFF it would be a NEW
 * effect no grant covers — hence `WEB_REDIRECT_DENIED` with zero contact
 * to the disallowed host. There is no rule-grammar tool that names a
 * network effect (the rule grammar is seven file/shell tools), so a
 * template rule can never blanket-ALLOW this row: under `default: 'deny'`
 * it refuses typed, under `default: 'ask'` it walks the Control rung and
 * runs ONLY on a real per-call approval consumed exactly once. That is
 * the whole authority story of a network family, and it is deliberately
 * the strictest one available on the current kernel.
 *
 * THE BOUNDS: wall time (`WEB_TIMEOUT`, typed), response bytes
 * (`WEB_RESPONSE_TOO_LARGE`, refused WHOLE — the socket dies mid-stream
 * and nothing partial is delivered), redirect hops (`WEB_REDIRECT_LIMIT`
 * — a loop is just a long chain), scheme + userinfo (`web-mechanics`,
 * BEFORE the PA walk, so those refusals never consume an approval).
 *
 * THE LEAK LAW: refusals carry the closed code + authored detail only. No
 * request header, no response header, no URL userinfo, no query string and
 * no stack ever enters a result, an observe line or a refusal — the
 * observe witness names the destination ORIGIN and the byte count, never
 * the path or query.
 *
 * CONFINEMENT HONESTY (u7 DECISION-3-ANSWER, verbatim limit): the host
 * sandbox claims FILE effects only — the bwrap profile carries no
 * `--unshare-net` and the local Landlock ABI is partial (no TCP rules).
 * This body therefore claims NO local containment of the network effect.
 * What bounds the effect is the Team authority chain (per-call PA over
 * exactly this effect set, the one-shot grant, these bounds, the trusted
 * scheme policy) — assurance Team-enforced at admission, boundary trusted
 * Host, never confinement-enforced. The PR body repeats this verbatim.
 *
 * @module web-family/fetch-executor
 */
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import {
  DEFAULT_ALLOWED_SCHEMES,
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_MAX_FETCH_BYTES,
  MAX_REDIRECT_HOPS,
  gateWebUrl,
  redirectStaysInDestination,
  parseGovernedWebFetchArgs,
  webRefusal,
} from './web-mechanics.mjs'
import { isTransportCode } from './web-transport.mjs'

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export function createGovernedWebFetchExecutor({
  realmId,
  policy,
  decide,
  pa,
  transport,
  allowedSchemes = DEFAULT_ALLOWED_SCHEMES,
  httpLoopbackAllowed = false,
  maxBytes = DEFAULT_MAX_FETCH_BYTES,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  now = () => Date.now(),
  observe = () => {},
}) {
  if (transport === null || typeof transport !== 'object' || typeof transport.fetchBounded !== 'function') {
    throw new TypeError('WEB_TRANSPORT_REQUIRED: the governed web_fetch row is built over the ONE transport port')
  }
  let executed = 0
  let paSeq = 0
  const fetchTokenLedger = new Map()

  /** The settled-token replay leg (fs write law): a host execution whose
   *  governed fetch already settled gets a PRE-ABORTED signal into the PA
   *  edge — the edge answers cancelled, the grant is never re-spent and
   *  the wire never moves again for this token. */
  const settledSignals = new Map()
  const fetchSignalForSettled = (tokenKey) => {
    const prior = settledSignals.get(tokenKey)
    if (prior !== undefined) return prior
    const controller = new AbortController()
    controller.abort()
    settledSignals.set(tokenKey, controller.signal)
    return controller.signal
  }

  return async (raw, corr) => {
    const token = corr?.token
    const tokenKey = (typeof token === 'object' && token !== null) || typeof token === 'symbol' ? token : undefined
    if (tokenKey !== undefined) {
      const prior = fetchTokenLedger.get(tokenKey)
      if (prior !== undefined && !prior.settled) {
        return webRefusal('admission', 'exec-token-replay', 'this host execution already owns an in-flight governed fetch')
      }
    }
    // ── PURE front: closed parameters + closed URL gating. Zero wire, zero
    // PA, zero consumption behind any refusal here. ─────────────────────
    const parsed = parseGovernedWebFetchArgs(raw)
    if (parsed.ok !== true) return parsed.refusal
    const gated = gateWebUrl(parsed.url, { allowedSchemes, httpLoopbackAllowed })
    if (gated.ok !== true) {
      observe(`governed-web-fetch gate-refused code=${gated.refusal.code} dest=none`)
      return gated.refusal
    }
    const effects = [
      { kind: 'tool-invoke', toolName: 'web_fetch', resource: null },
      {
        kind: 'connect',
        resource: { realmId, kind: 'network-destination', canonicalLocator: gated.destination, rights: ['connect'] },
      },
    ]
    const verdict = decide({ effects })
    if (verdict.kind === 'deny') {
      observe(`governed-web-fetch lane-denied code=${String(verdict.code)} dest=${gated.destination}`)
      return webRefusal('admission', verdict.code, 'the template lane denies this network effect')
    }
    // The row-level mirror of the kernel's default-deny gate, stated here
    // because it is TOTAL for this family: no rule in the closed seven-tool
    // rule grammar can name a `connect` effect, so on a default-deny mount
    // no rule covers this set and the honest answer is the typed refusal
    // BEFORE the walk (zero consumption; the kernel gate would answer the
    // same — this leg just keeps the refusal shape stable and wire-free).
    if (policy?.default === 'deny') {
      observe(`governed-web-fetch default-deny dest=${gated.destination}`)
      return webRefusal('admission', 'template-default-deny', 'the policy defaults to DENY and no rule can cover a network connect effect (the rule grammar names no network tool) — this call runs nothing')
    }
    if (typeof pa !== 'function') {
      return webRefusal('admission', 'PA_EDGE_UNAVAILABLE', 'this mount carries no PA admission edge, so no fetch may run')
    }
    const set = parseRequestedEffectSet(effects)
    if (!set.ok) return webRefusal('schema', 'effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
    paSeq += 1
    const execCorrelation = corr && typeof corr.correlation === 'string' && corr.correlation.length > 0 ? corr.correlation : undefined
    const execSignal = corr && corr.signal ? corr.signal : undefined
    let ledgerCorrelation
    let replaySettled = false
    if (tokenKey !== undefined) {
      const prior = fetchTokenLedger.get(tokenKey)
      if (prior !== undefined && prior.settled) {
        ledgerCorrelation = prior.correlation
        replaySettled = true
      } else {
        ledgerCorrelation = `plane-web-fetch:${String(realmId)}-${String(paSeq)}`
        fetchTokenLedger.set(tokenKey, { correlation: ledgerCorrelation, settled: false })
      }
    }
    const fetchSignal = replaySettled && tokenKey !== undefined ? fetchSignalForSettled(tokenKey) : execSignal
    const gate = await pa({
      realmId,
      callId: ledgerCorrelation ?? execCorrelation ?? `plane-web-fetch-${String(realmId)}-${String(paSeq)}`,
      ...(fetchSignal === undefined ? {} : { signal: fetchSignal }),
      parametersFingerprint: set.value.fingerprint,
      requestedEffects: set.value,
    })
    if (gate.kind === 'deny') {
      observe(`governed-web-fetch pa-refused code=${String(gate.code)} dest=${gated.destination}`)
      return webRefusal('admission', String(gate.code), String(gate.detail ?? 'the PA execution edge refused this fetch'))
    }
    if (gate.kind === 'allow' && gate.cancelled === true) {
      observe(`governed-web-fetch cancelled-at-pa-edge dest=${gated.destination}`)
      return { kind: 'cancelled' }
    }
    // ── POST-CONSUME: the approved connect effect runs against the ONE
    // bounded transport port, hop by hop. The approved destination is the
    // ONLY origin this loop may ever touch. ──────────────────────────────
    const startedAt = now()
    const deadlineAt = startedAt + timeoutMs
    let hopUrl = gated.url
    let hops = 0
    for (;;) {
      const outcome = await transport.fetchBounded({
        url: hopUrl.toString(),
        maxBytes,
        timeoutMs,
        deadlineAt,
        now,
        ...(fetchSignal === undefined ? {} : { signal: fetchSignal }),
      })
      if (outcome.ok === true && outcome.cancelled === true) {
        observe(`governed-web-fetch cancelled-in-transport dest=${gated.destination}`)
        return { kind: 'cancelled' }
      }
      if (outcome.ok !== true) {
        const code = isTransportCode(outcome.code) ? outcome.code : 'WEB_TRANSPORT_FAILED'
        observe(`governed-web-fetch transport-failed code=${code} dest=${gated.destination}`)
        return webRefusal('io', code, String(outcome.detail ?? 'the bounded transport refused this response'))
      }
      if (REDIRECT_STATUSES.has(outcome.statusCode) && typeof outcome.location === 'string') {
        hops += 1
        if (hops > MAX_REDIRECT_HOPS) {
          // A loop IS a long chain: the bound is the honest loop refusal.
          observe(`governed-web-fetch redirect-limit dest=${gated.destination}`)
          return webRefusal('admission', 'WEB_REDIRECT_LIMIT', `the redirect chain exceeded ${String(MAX_REDIRECT_HOPS)} hops (a loop is refused by the hop bound); nothing was delivered`)
        }
        const rd = redirectStaysInDestination(hopUrl.toString(), outcome.location, gated.destination)
        if (rd.ok !== true) {
          // A redirect OFF the approved origin is a NEW connect effect the
          // per-call set never requested and no grant covers: typed
          // refusal, and the disallowed host is NEVER contacted.
          observe(`governed-web-fetch redirect-denied reason=${String(rd.reason)} dest=${gated.destination}`)
          return webRefusal('admission', 'WEB_REDIRECT_DENIED', `the redirect target is not inside the approved destination (${String(rd.reason)}); the off-destination host is never contacted`)
        }
        hopUrl = rd.url
        continue
      }
      // The response lands. 4xx/5xx DELIVER like the native row (the
      // envelope carries the honest status); size/time bounds were already
      // enforced by the transport as refusals above.
      executed += 1
      if (tokenKey !== undefined) {
        const entry = fetchTokenLedger.get(tokenKey)
        if (entry !== undefined) entry.settled = true
      }
      const text = Buffer.from(outcome.bodyBytes).toString('utf8')
      const kind = typeof outcome.contentType === 'string' && outcome.contentType.toLowerCase().includes('text/html') ? 'html' : 'text'
      // THE effect witness: RAN means a request went out and bytes came
      // back — origin + count only (path/query never ride an observe line).
      observe(`governed-web-fetch RAN seq=${String(executed)} status=${String(outcome.statusCode)} bytes=${String(outcome.receivedBytes)} hops=${String(hops)} dest=${gated.destination}`)
      return {
        kind: 'ok',
        url: gated.url.toString(),
        statusCode: outcome.statusCode,
        body: { kind, content: text },
        truncated: false,
      }
    }
  }
}
