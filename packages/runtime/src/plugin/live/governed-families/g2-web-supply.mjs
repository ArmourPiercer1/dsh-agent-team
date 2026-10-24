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
export function createG2WebCenterPorts ({ resolveCallContext, readCallFacts, consumeEdge, searchOriginFacts } = {}) {
  const decline = (code, message) => ({ ok: false, error: { code, message, sideEffectUnknown: false } })
  // CALL-SCOPED in-flight relay (root 06:0x follow-through): the row's
  // execution entry announces the REAL current call while it runs and
  // clears it in `finally` — a transient slot, not a ledger (nothing
  // persists, nothing is judged here). resolveCallContext still wins if
  // the entry prefers a resolver of its own.
  const inFlight = new Map()
  const beginCall = (context) => {
    const callId = String(context?.callId ?? '')
    if (callId.length === 0) throw new TypeError('beginCall: the REAL current call identity is required; nothing announces an absent call')
    if (inFlight.has(callId)) throw new Error(`G2_WEB_CALL_INFLIGHT: call ${JSON.stringify(callId)} is already announced; one live context per call, never overwritten`)
    inFlight.set(callId, Object.freeze({ ...context }))
    let closed = false
    return () => { if (!closed) { closed = true; inFlight.delete(callId) } }
  }
  const resolve = (grantId) => {
    // grant -> call identity: the presented grantId IS the call identity
    // on this plane (the read's own law); a context whose callId ever
    // disagrees is refused, never trusted.
    const ctx = typeof resolveCallContext === 'function' ? (() => { try { return resolveCallContext(String(grantId)) } catch { return undefined } })() : inFlight.get(String(grantId))
    if (ctx !== undefined && ctx !== null && typeof ctx.callId === 'string' && ctx.callId !== String(grantId)) return undefined
    return ctx
  }
  const resolveSearchOrigin = () => {
    const origin = searchOriginFacts === null || typeof searchOriginFacts !== 'object' ? undefined : searchOriginFacts.origin
    if (typeof origin !== 'string' || origin.length === 0) {
      throw Object.assign(new Error('G2_WEB_SEARCH_ORIGIN_ABSENT: no real search origin rides this mount config: search is refused, fetch never stands in'), { code: 'G2_WEB_SEARCH_ORIGIN_ABSENT' })
    }
    return origin
  }
  const factsSource = Object.freeze({
    capture: async ({ realmId, grantId, bindingId } = {}) => {
      if (typeof readCallFacts !== 'function') return decline('G2_WEB_FACTS_UNAVAILABLE', 'no readPaCallFactsForCall-shaped reader injected; declining, never assembling facts from anywhere else')
      const ctx = resolve(grantId)
      if (ctx === undefined || ctx === null) return decline('G2_WEB_CALL_CONTEXT_ABSENT', `no live call context resolves grant ${JSON.stringify(String(grantId))} on this entry: the row's own plane walk must feed it; kept typed refusal, zero stand-in`)
      const read = await readCallFacts({
        rootSessionId: String(ctx.rootSessionId), instanceId: String(ctx.instanceId),
        realmId: String(realmId ?? ctx.realmId ?? ''), callId: String(grantId),
        requestedEffects: ctx.requestedEffects, placementName: ctx.placementName,
      })
      if (read === undefined) return decline('G2_WEB_FACTS_INCOMPLETE', 'readPaCallFactsForCall answered undefined (the facts law: any missing/unhealthy/contradicting source fails closed; no defaulted shape)')
      const facts = read.facts
      if (read.kind !== 'call-facts') return decline('G2_WEB_FACTS_INCOMPLETE', `the read answered ${JSON.stringify(read.kind)}: planSnapshot source does not exist on this call; the gateway law demands the complete 12-field contract, never a synthesized 12th field`)
      const presented = String(bindingId ?? '')
      if (presented.length > 0 && typeof facts?.binding?.bindingId === 'string' && facts.binding.bindingId !== presented) {
        return decline('G2_WEB_BINDING_IDENTITY_MISMATCH', 'the row-carried bindingId contradicts the call\'s own binding identity — compared, never trusted')
      }
      return {
        ok: true,
        value: Object.freeze({
          member: facts.member,
          callId: String(grantId),
          bindingRevision: facts.binding.revision,
          authorityGeneration: facts.authorityGeneration,
          policyGeneration: facts.policyGeneration,
          effects: facts.effects,
          bindingId: presented,
        }),
      }
    },
  })
  const grantAuthority = Object.freeze({
    consume: async ({ facts, correlation, isCancelled } = {}) => {
      if (typeof consumeEdge !== 'function') return decline('G2_WEB_CONSUME_EDGE_ABSENT', 'no plane consumeForExecution edge injected; ONE consume is never simulated')
      if (typeof isCancelled === 'function' && isCancelled() === true) return decline('G2_WEB_CANCELLED', 'cancelled at the consume boundary — zero consume performed (C3 law)')
      const ctx = resolve(correlation?.grantId)
      if (ctx === undefined || ctx === null || ctx.grant === undefined) return decline('G2_WEB_CALL_CONTEXT_ABSENT', 'the consume edge needs the call\'s REAL grant from the live context; absent, no consume happens')
      const edge = await consumeEdge(ctx.grant, {
        ...(typeof isCancelled === 'function' ? { cancelRequested: isCancelled() === true } : {}),
        currentAuthorityGeneration: facts?.authorityGeneration,
        member: facts?.member,
        callId: String(correlation?.grantId),
        realmId: String(ctx.realmId ?? ''),
        bindingId: String(correlation?.bindingId ?? facts?.bindingId ?? ''),
        bindingRevision: facts?.bindingRevision,
        parametersFingerprint: correlation?.payloadFingerprint,
        requestedEffects: ctx.requestedEffects,
      })
      if (edge === undefined || edge === null || edge.kind !== 'allow') return decline('G2_WEB_GRANT_NOT_ALLOWED', 'the execution edge did not answer allow; refusals pass through verbatim, never re-judged open')
      if (edge.cancelled === true) return decline('G2_WEB_CANCELLED', 'the edge answered allow WITH cancellation at the decision point — treated as cancelled, not consumed')
      const proof = edge.consumedProof
      if (proof === undefined || proof === null || typeof proof.grant !== 'object' || proof.grant === null || typeof proof.grant.grantId !== 'string') {
        return decline('G2_WEB_CONSUME_PROOF_MISSING', 'the edge answered allow WITHOUT its one-shot consume witness — the row never self-attests; body does not run')
      }
      return { ok: true, value: Object.freeze({ effects: Object.freeze({ effects: [...(facts?.effects?.effects ?? [])] }), consumedProof: proof }) }
    },
  })
  return Object.freeze({ grantAuthority, factsSource, resolveSearchOrigin, beginCall })
}
