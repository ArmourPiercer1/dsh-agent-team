/**
 * A5M2 G2-WEB — the Team-scoped FIXED web provider fork (CENTER dispatch,
 * root 00:3x card; the two root-queued routes share this artifact).
 *
 * WHAT THIS IS (status per root — stated, not implied):
 *   [done]      the fork objects: they implement the EXPORTED host
 *               contract shapes (packages/web/web/src/index.ts
 *               @639ed01539: a fetch/search provider carries an id,
 *               `available()`, and the request methods; the transport is
 *               DELEGATED to the public `HttpFetchProvider` instance the
 *               connection-owning assembly constructed with its PUBLIC
 *               Config — fixed limits + product User-Agent, no new deps,
 *               no credentials, no network widening).
 *   [done]      the disposer-shaped registration block (the host's own
 *               public API returns disposers: registerFetchProvider/
 *               registerSearchProvider → `() => void`, index.ts:103/114
 *               — this block rides that shape, disposer-first law).
 *   [NOT wired] nothing here reaches a live host web service: mounting
 *               the Team-scoped ctx and the per-row WebRuntimeConfig
 *               id-pin are the root-pending route 1/2 choice.
 *   [NOT tested E2E] the WebRuntime selection semantics
 *               (configured id always chosen; WEB_PROVIDER_CONFIGURED_
 *               MISSING / ..._UNAVAILABLE never a silent swap) are the
 *               HOST's own behavior over its own instance — the spec
 *               legs here prove the FORK and the registration block
 *               against a DISCLOSED stand-in speaking that vocabulary;
 *               the real-service E2E is the Host venue, stated.
 *
 * NO global provider/env switch, no ctx re-selection, no Core, no
 * credential scope. Team-only by construction: the block registers onto
 * the ctx the caller owns and disposes what it registered.
 */

export const A5_G2_WEB_CODES = Object.freeze({
  SERVICE_ABSENT: 'G2_WEB_SERVICE_ABSENT',
  TRANSPORT_ABSENT: 'G2_WEB_TRANSPORT_ABSENT',
})

const refuse = (code, message) => {
  throw Object.assign(new Error(`${code}: ${message}`), { code })
}

/**
 * Build the Team's fixed fetch/search provider pair over the assembly-
 * supplied transport. `transport` MUST be the public HttpFetchProvider
 * (or any object answering the exported WebFetchProvider method shape)
 * — this module NEVER reimplements transport and never swaps it later:
 * the returned objects capture it by construction (no per-call re-
 * selection point exists here at all).
 */
/* ROOT f792-review ③④: the earlier createG2TeamWebProviders/
 * registerG2TeamWebProviders shared-registration route is REMOVED — it
 * had no consumer on this unreleased branch (production rides the fixed
 * face below, never shared-WebRuntime registration), its method shapes
 * were dynamic/signal-losing, and its rollback message could claim
 * ROLLED BACK over a swallowed cleanup error. Deleting the idle route is
 * the root-sanctioned cheapest fix: ONE fixed face remains, no idle
 * framework kept, no misleading proof left standing. */

/**
 * THE fixed capture+bind gateway face (root 01:2x): the provider instance
 * is captured ONCE at construction; fetch is BOUND to that capture and
 * passes the SECOND ARGUMENT (AbortSignal) through VERBATIM — no dynamic
 * re-fetch of any provider, no per-call selection point. search is
 * captured ONLY when the captured provider carries a REAL search
 * function — fetch NEVER impersonates search; absent search is an
 * explicit null the gateway must refuse typed.
 */
export function createG2FixedWebFace (provider, { searchProvider } = {}) {
  if (provider === null || typeof provider !== 'object' || typeof provider.fetch !== 'function') {
    refuse(A5_G2_WEB_CODES.TRANSPORT_ABSENT, 'the captured provider must answer fetch(request, signal) — the formal public HttpFetchProvider')
  }
  const boundFetch = provider.fetch.bind(provider)
  const realSearch = searchProvider !== null && searchProvider !== undefined && typeof searchProvider.search === 'function'
    ? searchProvider.search.bind(searchProvider)
    : null
  return Object.freeze({
    id: typeof provider.id === 'string' ? provider.id : undefined,
    available: typeof provider.available === 'function' ? () => provider.available() === true : () => true,
    fetch: (request, signal) => boundFetch(request, signal),
    search: realSearch === null ? null : (request, signal) => realSearch(request, signal),
  })
}

/**
 * THE center-edge trio for the LIVE web gateway (root 03:0x production
 * ports; interfaces verbatim per web-gateway-assembly's header law).
 * REAL supply rule: every port reads ONLY existing public query faces
 * (the durable ControlService public reads + the caller-injected REAL
 * generation reader — the plane's own authorityGeneration/policy face);
 * NOTHING here mints a ledger or invents currentness. Where a trusted
 * input does not exist publicly today, the port answers a TYPED refusal
 * — the honest decline the header law demands, never stand-in facts.
 */
/**
 * THE center-edge trio, root 06:0x REAL-SEAM route (supersedes the
 * durable-Control read — a DECIDED allow is a DECISION, not a consume;
 * reviewPayload is not trusted effects; the all-allow path may hold no
 * Control row at all — listControlState assembly of facts is forbidden).
 * The ONE lawful read: the plane's OWN public call-level entry
 * `readPaCallFactsForCall` (pa-mount-registry :400-418: the CURRENT
 * facts of ONE live call keyed by the REAL call identity, no durable row
 * required), and the SAME plane's execution edge
 * `assembly.consumeForExecution(grant, { currentAuthorityGeneration,
 * member, callId, realmId, bindingId, bindingRevision,
 * parametersFingerprint, requestedEffects, cancelRequested })` whose
 * success witness IS the one-shot consumedProof. grant → call → binding
 * identity is the read's own law (a row-carried bindingId is COMPARED,
 * never trusted). Generations are the REAL numbers the read answers
 * (facts.authorityGeneration / facts.binding.revision) — never a
 * hand-assembled three-generation object.
 *
 * The live call context (mount, walked effects, placement name, grant)
 * is injected by the OWNING entry via `resolveCallContext(grantId)` —
 * until the web row's own plane walk feeds it, resolveCallContext answers
 * undefined and every port refuses TYPED (the kept honest refusal; no
 * effects/grantId constants, no stand-in facts).
 */
export function createG2WebCenterPorts ({ resolveCallContext, readCallFacts, consumeEdge, searchOriginFacts, assemblyId } = {}) {
  const decline = (code, message) => ({ ok: false, error: { code, message, sideEffectUnknown: false } })
  // ROOT 23bc-CARD ②: a REAL grantId is NOT a callId. The plane context
  // carries grant / call / placement / member / effects / assembly
  // SEPARATELY; facts and consume ride the REAL call. Lookup keys the
  // presented GRANT; the call is the context's own truth.
  const inFlight = new Map()
  const beginCall = (context) => {
    const grantId = String(context?.grant?.grantId ?? '')
    if (grantId.length === 0 || typeof context?.call?.callId !== 'string' || context.call.callId.length === 0) {
      throw new TypeError('beginCall: the REAL grant AND the REAL current call must be announced separately (grant.grantId + call.callId); never conflated')
    }
    if (typeof assemblyId === 'string' && assemblyId.length > 0 && String(context?.assemblyId ?? '') !== assemblyId) {
      throw new Error('G2_WEB_ASSEMBLY_MISMATCH: the announced context belongs to a different gateway assembly than the one owning these ports; pairing is exact or it is refused')
    }
    if (inFlight.has(grantId)) throw new Error(`G2_WEB_GRANT_INFLIGHT: grant ${JSON.stringify(grantId)} is already announced; one live context per grant, never overwritten`)
    inFlight.set(grantId, Object.freeze({ ...context }))
    let closed = false
    return () => { if (!closed) { closed = true; inFlight.delete(grantId) } }
  }
  const resolve = (grantId) => {
    if (typeof resolveCallContext === 'function') { try { return resolveCallContext(String(grantId)) } catch { return undefined } }
    return inFlight.get(String(grantId))
  }
  const resolveSearchOrigin = () => {
    const origin = searchOriginFacts === null || typeof searchOriginFacts !== 'object' ? undefined : searchOriginFacts.origin
    if (typeof origin !== 'string' || origin.length === 0) {
      throw Object.assign(new Error('G2_WEB_SEARCH_ORIGIN_ABSENT: no real search origin rides this mount config: search is refused, fetch never stands in'), { code: 'G2_WEB_SEARCH_ORIGIN_ABSENT' })
    }
    return origin
  }
  const factsSource = Object.freeze({
    capture: async ({ realmId, grantId } = {}) => {
      if (typeof readCallFacts !== 'function') return decline('G2_WEB_FACTS_UNAVAILABLE', 'no readPaCallFactsForCall-shaped reader injected; declining, never assembling facts from anywhere else')
      const ctx = resolve(grantId)
      if (ctx === undefined || ctx === null) return decline('G2_WEB_CALL_CONTEXT_ABSENT', `no live context announces grant ${JSON.stringify(String(grantId))}: kept typed refusal, zero stand-in`)
      const read = await readCallFacts({
        rootSessionId: String(ctx.member?.teamSessionId ?? ''),
        instanceId: String(ctx.member?.instanceId ?? ''),
        realmId: String(realmId ?? ctx.call?.realmId ?? ''),
        callId: String(ctx.call?.callId ?? ''),
        requestedEffects: ctx.effects,
        placementName: ctx.placement?.name,
      })
      if (read === undefined) return decline('G2_WEB_FACTS_INCOMPLETE', 'readPaCallFactsForCall answered undefined (the facts law: any missing/unhealthy/contradicting source fails closed; no defaulted shape)')
      // ROOT 23bc-CARD ③: BOTH legal answers ride — `call-facts` AND
      // `no-approval-question`; the all-allow call has no planSnapshot
      // SOURCE and is never forced to synthesize one.
      if (read.kind !== 'call-facts' && read.kind !== 'no-approval-question') return decline('G2_WEB_FACTS_INCOMPLETE', `the read answered ${JSON.stringify(String(read.kind))}; only the two lawful answers are accepted`)
      const facts = read.facts
      // ROOT 23bc-CARD ④: the REAL field names — policy generation is the
      // durable overlay's OWN overlayGeneration (:281-289/:368), NOT a
      // nonexistent facts.policyGeneration.
      const value = {
        member: facts.member,
        callId: String(facts.callId ?? ctx.call?.callId ?? ''),
        bindingRevision: facts.binding?.revision,
        authorityGeneration: facts.authorityGeneration,
        policyGeneration: facts.overlayGeneration,
        effects: facts.effects ?? ctx.effects,
        bindingId: String(ctx.binding?.bindingId ?? facts.binding?.bindingId ?? ''),
      }
      if (read.kind === 'call-facts') value.planSnapshot = facts.planSnapshot
      return { ok: true, value: Object.freeze(value) }
    },
  })
  const grantAuthority = Object.freeze({
    consume: async ({ facts, correlation, isCancelled } = {}) => {
      // ROOT 23bc-CARD ⑤: THE ONE consumption layer — the injected edge
      // IS the production plane wrapper around assembly.consumeForExecution
      // answering the wrapper's REAL shape ({ kind: allow, consumedProof,
      // cancelled? }). The raw { ok, value } assembly layer is NEVER
      // called here as a SECOND consumption; one call, one consume.
      if (typeof consumeEdge !== 'function') return decline('G2_WEB_CONSUME_EDGE_ABSENT', 'no production consume wrapper injected; ONE consume is never simulated')
      if (typeof isCancelled === 'function' && isCancelled() === true) return decline('G2_WEB_CANCELLED', 'cancelled at the consume boundary — zero consume performed (C3 law)')
      const ctx = resolve(correlation?.grantId)
      if (ctx === undefined || ctx === null || ctx.grant === undefined) return decline('G2_WEB_CALL_CONTEXT_ABSENT', 'the consume wrapper needs the announced REAL grant; absent, no consume happens')
      const edge = await consumeEdge(ctx.grant, {
        ...(typeof isCancelled === 'function' ? { cancelRequested: isCancelled() === true } : {}),
        currentAuthorityGeneration: facts?.authorityGeneration,
        member: facts?.member ?? ctx.member,
        callId: String(ctx.call?.callId ?? ''),
        realmId: String(ctx.call?.realmId ?? correlation?.realmId ?? ''),
        bindingId: String(correlation?.bindingId ?? ctx.binding?.bindingId ?? ''),
        bindingRevision: facts?.bindingRevision,
        parametersFingerprint: correlation?.payloadFingerprint,
        requestedEffects: ctx.effects,
      })
      if (edge === undefined || edge === null || edge.kind !== 'allow') return decline('G2_WEB_GRANT_NOT_ALLOWED', 'the production wrapper did not answer allow; refusals pass through verbatim, never re-judged open')
      if (edge.cancelled === true) return decline('G2_WEB_CANCELLED', 'the wrapper answered allow WITH cancellation at the decision point — treated as cancelled, not consumed')
      const proof = edge.consumedProof
      if (proof === undefined || proof === null || typeof proof.grant !== 'object' || proof.grant === null || typeof proof.grant.grantId !== 'string') {
        return decline('G2_WEB_CONSUME_PROOF_MISSING', 'the wrapper answered allow WITHOUT its one-shot consume witness — the row never self-attests; body does not run')
      }
      // ROOT 23bc-CARD ⑥: success IS a WebConsumedGrant — the REAL
      // grantId (from the announced grant, not the callId) with its
      // corresponding proof + effects.
      return { ok: true, value: Object.freeze({
        grantId: String(ctx.grant.grantId),
        effects: Object.freeze({ effects: [...(facts?.effects?.effects ?? ctx.effects?.effects ?? [])] }),
        consumedProof: proof,
      }) }
    },
  })
  return Object.freeze({ grantAuthority, factsSource, resolveSearchOrigin, beginCall })
}
