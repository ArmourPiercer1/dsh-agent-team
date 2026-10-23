/**
 * `runtime/web-gateway` — the web arm of the PR7 {@link ProviderGateway}
 * (M2 B-WEB lane, owner=CONNECTOR).
 *
 * DELEGATION LAW (integration ruling 2026-10-23, condition 2): this gateway
 * delegates retrieval to the REAL installed Host providers through the public
 * web seam (`ctx.web.fetch` / `ctx.web.search`, host
 * `packages/web/web/src/index.ts:140/:157` @ 639ed01539). The chain's FINAL
 * DNS/IP validation, EVERY-redirect-hop revalidation and connection pinning
 * ARE the production `web-fetch-http` provider's (network.ts/policy.ts) —
 * the contract's "Gateway 最终执行" is satisfied by the whole chain; this file
 * runs no second, weaker copy, and never resolves a name itself.
 * PROVIDER DESTINATIONS COME FROM REAL CONFIG ONLY: the search arm asks an
 * injected {@link SearchOriginResolver} (host-side reader of the installed
 * provider's own config); with no provider/credential the resolver throws the
 * seam's typed code and the call refuses — a fixed-URL fake is impossible
 * structurally, because this module contains no destination constant.
 *
 * CLOSED-SET EFFECT MAPPING (root ruling; no new kinds, no new PA types):
 *   I = tool-invoke@<exact definition>   — carried by the grant/binding legs
 *   N = connect@network-destination      — the envelope destination MUST be
 *       an N arm of the grant (checked with the frozen `resourceEquals`,
 *       refusal `destination-outside-grant`); per redirect hop the provider
 *       re-validates non-publicness and the receipt DISCLOSES a final-origin
 *       change (see OPEN ITEMS).
 *   D = domain-ref                       — the Domain Authority answers at the
 *       effect-commit point via the injected reader; 'denied' refuses with
 *       ZERO transport and is never rewritten by Team approval.
 *   S = NO kind. The exact-operation permission rides I; URL/query digests
 *       and caps are manifest material — here: `payloadFingerprint` + the
 *       receipt's `outcomeFingerprint`.
 *
 * APPROVAL LAW (ROOT 07:38 GROUP 3 + ROOT 08:4x C2): this gateway is
 * ENVELOPE + DESTINATION validation + delegation ONLY. Every approval FACT is
 * produced by the injected {@link WebGrantAuthority} and passed through
 * VERBATIM — the lane runs no private validate, no second approval algebra.
 * C2 (no self-proof): the authority judges on the TRUSTED CALL FACTS captured
 * by the injected {@link WebFactsSource} ({@link WebTrustedCallFacts}: full
 * effects set, live generations, member/call identity) using ONLY the
 * correlation ids the request carries. The presented grant/binding DOCUMENTS
 * never enter the judgement path (the pre-fix counterexample
 * c123-before C2 showed an attacker-written grant approving its own
 * destination). The lane cannot mint facts; incomplete facts refuse typed
 * (`authority-facts-incomplete`) — honest, never fabricated stand-ins.
 * The lane keeps exactly ONE deterministic consistency check: the request's
 * payloadFingerprint MUST equal the canonical fingerprint of the FROZEN
 * snapshot the lane itself built (see the payload law below) — refused
 * BEFORE consume, so a refusal never burns a single-use grant.
 *
 * PAYLOAD FREEZE LAW (ROOT 08:4x C1): every payload field is read from the
 * caller's (possibly getter-backed, possibly mutated-after-approval) object
 * AT MOST ONCE into ONE canonical {@link WebOperationPayload} snapshot built
 * with value copies and `Object.freeze`. The fingerprint check, destination
 * derivation, and the provider delegate read ONLY that frozen snapshot —
 * after the snapshot is built this module never touches the caller's object
 * again, so what got fingerprinted is exactly what gets delegated (the
 * pre-fix counterexample c123-before C1 showed approved `maxResults=1`
 * drifting to provider-received `999`). Mutation between approval and
 * execution therefore cannot change what executes: the drifted snapshot
 * simply fails the fingerprint check (refused, zero consume).
 *
 * LIFECYCLE LAW (ROOT 08:4x C3): ONE closed state (the row's
 * {@link WebRowLifecycle}) is consulted by the GATEWAY ITSELF — every
 * reference, including anything reached past the wrapper, checks it on entry
 * and again after EVERY await before the provider call. Cancellation is
 * checked BEFORE consume (`cancelled-before-consume` ⇒ zero consume,
 * measured), the row's abort signal is MERGED into the seam call so close()
 * drains in-flight transport (the provider sees abort; the call settles
 * cancelled, never silently continues), and the consume input carries the
 * decision-time cancellation state.
 *
 * SEAM-CODE MAP (the closed 8-code {@link GovernanceErrorCode} set has no
 * "provider unavailable" member — the least-wrong mapping is documented,
 * the seam's own code travels VERBATIM in `error.details.seamCode`):
 *   WEB_BLOCKED_URL, WEB_INVALID_URL, url-unparseable, url-scheme-unsupported,
 *   loopback/private literal veto, destination-outside-grant, domain denied
 *     → DOMAIN_DENIED (destination refused)
 *   WEB_PROVIDER_CONFIGURED_MISSING, WEB_PROVIDER_CONFIGURED_UNAVAILABLE,
 *   WEB_PROVIDER_AMBIGUOUS, WEB_PROVIDER_UNAVAILABLE,
 *   WEB_PROVIDER_CREDENTIAL_MISSING, unmapped seam errors
 *     → IO_POLICY_UNSUPPORTED (this configuration cannot run the capability)
 *   binding/shape integrity            → TOOL_BINDING_UNVERIFIED
 *   not-armed / closed                 → IO_POLICY_UNSUPPORTED
 * `sideEffectUnknown` (ROOT 07:38 GROUP 5 honesty): false ONLY where this
 * lane PROVABLY acted before any delegation (envelope/fingerprint/belt/
 * consume/N/D refusals — zero bytes delegated by construction, and a belt
 * refusal happens BEFORE consume); ANY refusal thrown by the seam itself
 * says TRUE — `WEB_BLOCKED_URL`/`WEB_INVALID_URL` can surface on a LATER
 * redirect hop after the first hop produced effects, and no seam code
 * distinguishes hop 1 from hop N. Never a silent false.
 *
 * OPEN ITEMS (disclosed, not silently solved):
 *  - the frozen GatewayCallRequest carries no retrieval payload (§"opaque ref"
 *    channel unbuilt): the payload rides a closed lane extension of the
 *    target (types.ts DISCLOSURE) pending the integration owner's ruling.
 *  - a redirect that changes origin moves N: the provider re-validates
 *    non-publicness per hop (production law), the Team grant covers the
 *    REQUEST origin, and the receipt records `finalOriginMismatch` so the
 *    mismatch is durable fact, never a hidden widening.
 *
 * @module runtime/web-gateway
 */
import {
  canonicalJsonFingerprint,
  resourceEquals,
} from '../../../domain/tool-governance/src/index.js'
import type {
  DomainVeto,
  GatewayCallRequest,
  GatewayReceipt,
  GovernanceResult,
  ProviderGateway,
  ResourceRef,
} from '../../../domain/tool-governance/src/index.js'
import { deriveDestination, originOf } from './destination-envelope.js'
import {
  webGatewayRefusal,
} from './types.js'
import type {
  DomainVetoReader,
  SearchOriginResolver,
  WebDestinationEnvelope,
  WebFactsSource,
  WebGatewayCallRequest,
  WebGatewaySeamPorts,
  WebGrantAuthority,
  WebOperationPayload,
  WebRowLifecycle,
  WebTrustedCallFacts,
} from './types.js'

/** Constructor dependencies (all host-injected; none optional by default). */
export interface CreateWebGatewayOptions {
  readonly ports: WebGatewaySeamPorts
  readonly searchOrigin: SearchOriginResolver
  /** GROUP 3: the center-edge approval authority (ONE consume per call). */
  readonly authority: WebGrantAuthority
  /** C2: the center-edge ledger capture port (correlation ids → facts). */
  readonly factsSource: WebFactsSource
  /** C3: the ONE row closed/abort state this gateway itself consults. */
  readonly lifecycle: WebRowLifecycle
  readonly readDomainVeto?: DomainVetoReader
  readonly onObserve?: (observation: Readonly<Record<string, string | boolean>>) => void
}

/** Per-call runtime options (the frozen envelope carries NO runtime signal —
 *  cancellation is a transport concern, not manifest material). */
export interface WebCallOptions {
  readonly signal?: AbortSignal
}

/** One lane observation: the result plus the fact row (never payload). */
interface CallOutcome {
  readonly result: GovernanceResult<GatewayReceipt>
  readonly obs: Record<string, string | boolean>
}

export interface WebGateway extends ProviderGateway {
  /** The lane-typed entry carrying the operation payload (see DISCLOSURE). */
  readonly callWeb: (request: WebGatewayCallRequest, options?: WebCallOptions) => Promise<GovernanceResult<GatewayReceipt>>
}

const REQUEST_KEYS = ['grant', 'binding', 'target', 'payloadFingerprint'] as const
const TARGET_KEYS = ['destination', 'domainAuthorityId', 'webOperation'] as const
const FETCH_PAYLOAD_KEYS = ['kind', 'url'] as const
const SEARCH_PAYLOAD_KEYS = ['kind', 'query', 'maxResults'] as const

/** Seam `WebError` codes that mean "the destination itself was refused". */
const DESTINATION_SEAM_CODES: ReadonlySet<string> = new Set(['WEB_BLOCKED_URL', 'WEB_INVALID_URL'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extraKeys(obj: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(obj).filter((k) => !allowed.includes(k))
}

/**
 * Build the web arm. The gateway never arms itself: enablement is the
 * assembly's closed-key decision (`webEnabledRaw`, types.ts), and this class
 * is only constructed when that decision armed the row.
 */
export function createWebGateway(options: CreateWebGatewayOptions): WebGateway {
  const { ports, searchOrigin, authority, factsSource, lifecycle, readDomainVeto, onObserve } = options

  const callWeb = async (request: WebGatewayCallRequest, callOptions?: WebCallOptions): Promise<GovernanceResult<GatewayReceipt>> => {
    const outcome = await runCall(request, callOptions?.signal)
    onObserve?.(Object.freeze({ ...outcome.obs }))
    return outcome.result
  }

  async function runCall(request: WebGatewayCallRequest, signal?: AbortSignal): Promise<CallOutcome> {
    // — C3: the ONE closed state is enforced HERE, not only in the wrapper:
    //   every reference — wrapper or anything reached past it — enters
    //   through this check, and every await below re-checks. —
    if (lifecycle.isClosed()) {
      return done(rowClosedRefusal(), { operation: 'row-closed', refusal: 'web-row-closed' })
    }
    // — envelope integrity (never re-admitting; that is admission's law) —
    if (!isRecord(request)) {
      return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', 'a gateway call request is a record'), { operation: 'malformed-request' })
    }
    const requestExtras = extraKeys(request, REQUEST_KEYS)
    if (requestExtras.length > 0) {
      return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', `the call envelope is closed; undeclared keys: ${requestExtras.join(', ')}`), { operation: 'malformed-request' })
    }
    const { grant, binding, target, payloadFingerprint } = request
    if (typeof payloadFingerprint !== 'string' || payloadFingerprint.length === 0) {
      return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', 'the S leg requires a non-empty payloadFingerprint (manifest material)'), { operation: 'malformed-request' })
    }
    if (!isRecord(grant) || typeof grant['grantId'] !== 'string' || grant['grantId'].length === 0 || typeof grant['realmId'] !== 'string' || !isRecord(grant['effects'])) {
      return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', 'the gateway consumes a well-SHAPED grant envelope (grantId/realmId/effects present); validity, expiry and consumption belong to the authority, decided at consume below'), { operation: 'malformed-request' })
    }
    if (!isRecord(binding) || typeof binding['bindingId'] !== 'string' || typeof binding['toolName'] !== 'string') {
      return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', 'the binding envelope needs bindingId + toolName (shape only; definition verification belongs to the authority)'), { operation: 'malformed-request' })
    }

    // — operation payload (closed lane extension of the frozen target) —
    if (!isRecord(target)) {
      return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', 'the gateway target is a record'), { operation: 'malformed-request' })
    }
    const targetExtras = extraKeys(target, TARGET_KEYS)
    if (targetExtras.length > 0) {
      return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', `the gateway target is closed; undeclared keys: ${targetExtras.join(', ')}`), { operation: 'malformed-request' })
    }
    const rawOperation = target['webOperation']
    if (!isRecord(rawOperation) || typeof rawOperation['kind'] !== 'string') {
      return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', 'operation-payload-absent: the frozen GatewayCallRequest carries only a fingerprint; the lane refuses to GUESS the retrieval payload (types.ts DISCLOSURE)'), { operation: 'payload-absent' })
    }
    const kind = rawOperation['kind'] // read exactly once (C1)
    if (kind !== 'web.fetch' && kind !== 'web.search') {
      return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', `unknown web operation kind ${JSON.stringify(kind)}`), { operation: String(kind) })
    }
    const payloadKeys = kind === 'web.fetch' ? FETCH_PAYLOAD_KEYS : SEARCH_PAYLOAD_KEYS
    const payloadExtras = extraKeys(rawOperation, payloadKeys)
    if (payloadExtras.length > 0) {
      return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', `the ${kind} payload is closed; undeclared keys: ${payloadExtras.join(', ')}`), { operation: kind })
    }
    // — C1 FREEZE: each field is read from the caller's (getter-backed,
    //   mutable-after-approval) object AT MOST ONCE into one frozen value
    //   snapshot. From here on the caller's object is NEVER touched again:
    //   the fingerprint check, the destination derivation and the provider
    //   delegate all read ONLY `payload`. What gets fingerprinted is
    //   therefore exactly what gets delegated. —
    let payload: WebOperationPayload
    if (kind === 'web.fetch') {
      const url = rawOperation['url']
      if (typeof url !== 'string' || url.length === 0) {
        return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', 'web.fetch requires a non-empty url'), { operation: kind })
      }
      payload = Object.freeze({ kind: 'web.fetch' as const, url })
    } else {
      const query = rawOperation['query']
      const maxResults = rawOperation['maxResults']
      if (typeof query !== 'string' || query.length === 0) {
        return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', 'web.search requires a non-empty query'), { operation: kind })
      }
      if (maxResults !== undefined && (typeof maxResults !== 'number' || !Number.isInteger(maxResults) || maxResults < 1)) {
        return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', 'maxResults, when present, is a positive integer'), { operation: kind })
      }
      payload = Object.freeze(maxResults === undefined
        ? { kind: 'web.search' as const, query }
        : { kind: 'web.search' as const, query, maxResults })
    }
    // — payload↔fingerprint self-consistency (GROUP 3, the ONE deterministic
    //   lane-side integrity check) against the FROZEN SNAPSHOT: a payload
    //   mutated or drifted between approval and this call fails HERE, before
    //   consume — so a refusal never burns a single-use grant, and execution
    //   can never run on a value other than the fingerprinted one. —
    if (payloadFingerprint !== canonicalJsonFingerprint(payload)) {
      return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', 'payload-fingerprint-mismatch: the presented payloadFingerprint is not the canonical fingerprint of the frozen operation snapshot (swapped or mutated payload; refused before consume)'), { operation: kind, refusal: 'payload-fingerprint-mismatch' })
    }
    // (definition/binding verification — "is this binding the exact
    //  definition of this operation" — is an approval FACT: it belongs to
    //  the authority's consume below, not to this lane. ROOT 07:38 GROUP 3.)

    // — destination: derived, never supplied (a caller-claimed destination is
    //   only a cross-check: a target.destination that disagrees is refused) —
    let envelope: WebDestinationEnvelope
    let delegate: () => Promise<string>
    if (payload.kind === 'web.fetch') {
      const derived = deriveDestination(payload.url)
      if ('code' in derived) {
        return done(webGatewayRefusal('DOMAIN_DENIED', `${derived.code}: ${derived.detail}`), { operation: kind, refusal: derived.code })
      }
      envelope = derived
      delegate = async () => {
        const res = await ports.fetch({ url: payload.url }, mergedSignal(signal))
        return fingerprintForFetch(envelope, res)
      }
    } else {
      let origin: string
      try {
        origin = await searchOrigin() // REAL config only — see SearchOriginResolver
      } catch (err) {
        return done(seamFailure(err), { operation: kind, refusal: seamCodeOf(err) ?? 'search-origin-resolver-threw' })
      }
      if (cancelledNow(signal)) {
        return cancelledOutcome(kind, 'before-consume') // C3 post-await re-check (zero consume)
      }
      const derived = deriveDestination(origin)
      if ('code' in derived) {
        return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', `search provider destination is not a usable origin (${derived.code}): ${derived.detail}`), { operation: kind, refusal: derived.code })
      }
      envelope = derived
      delegate = async () => {
        const res = await ports.search({ query: payload.query, ...(payload.maxResults === undefined ? {} : { maxResults: payload.maxResults }) }, mergedSignal(signal))
        return fingerprintForSearch(envelope, res)
      }
    }
    const operationLabel = `${kind}@${envelope.canonicalLocator}`
    if (envelope.literalVeto !== null) {
      return done(webGatewayRefusal('DOMAIN_DENIED', `literal-address belt: ${envelope.literalVeto.code} — ${envelope.literalVeto.detail} (zero transport; the provider's post-DNS law stands regardless)`), { operation: operationLabel, refusal: envelope.literalVeto.code })
    }
    // the frozen locator law is the FROZEN parser's, not a copy:
    const destinationResource: ResourceRef = Object.freeze({
      realmId: String(grant['realmId']),
      kind: 'network-destination',
      canonicalLocator: envelope.canonicalLocator,
      rights: Object.freeze(['connect'] as const),
    })
    if (target['destination'] !== undefined && target['destination'] !== null) {
      const claimed = target['destination']
      if (!isRecord(claimed) || claimed['canonicalLocator'] !== envelope.canonicalLocator || claimed['kind'] !== 'network-destination') {
        return done(webGatewayRefusal('DOMAIN_DENIED', `destination-claim-mismatch: a claimed target.destination must equal the derived destination (destinations are derived, never supplied)`), { operation: operationLabel, refusal: 'destination-claim-mismatch' })
      }
    }
    // — C2: capture the TRUSTED CALL FACTS from the center-edge ledger using
    //   ONLY the correlation ids the request carries. The presented grant/
    //   binding DOCUMENTS never travel into the authority's judgement path
    //   (pre-fix counterexample C2: an attacker-written effects set approved
    //   its own destination — self-proof is now structurally impossible). —
    const correlation = Object.freeze({
      grantId: String(grant['grantId']),
      bindingId: String(binding['bindingId']),
    })
    const captured = await factsSource.capture({ realmId: String(grant['realmId']), ...correlation })
    if (!captured.ok) {
      return done({ ok: false, error: captured.error }, { operation: operationLabel, refusal: 'facts-source-refused' })
    }
    const incomplete = factsIncompleteMessage(captured.value)
    if (incomplete !== null) {
      return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', `authority-facts-incomplete: the captured trusted facts are missing/invalid (${incomplete}); the center wiring produces these facts — the lane never fabricates stand-ins`), { operation: operationLabel, refusal: 'authority-facts-incomplete' })
    }
    // — C3 cancel-first: cancellation checked BEFORE the consume boundary ⇒
    //   zero consume (measured). Post-await re-check, per the lifecycle law. —
    if (cancelledNow(signal)) {
      return cancelledOutcome(operationLabel, 'before-consume')
    }
    // — GROUP 3: ONE consume at the center edge, judged on the trusted facts.
    //   A refusal passes through VERBATIM. Belt, snapshot-fingerprint and
    //   facts checks intentionally precede consume: a lane-side refusal must
    //   never burn the single-use grant. —
    const consumed = await authority.consume({
      facts: captured.value,
      correlation: Object.freeze({ ...correlation, payloadFingerprint }),
      operationKind: payload.kind,
      canonicalLocator: envelope.canonicalLocator,
      cancelledAtDecision: false, // the cancel-first gate above guarantees this
    })
    if (!consumed.ok) {
      return done({ ok: false, error: consumed.error }, { operation: operationLabel, refusal: 'authority-refused' })
    }
    if (cancelledNow(signal)) {
      return cancelledOutcome(operationLabel, 'after-consume') // disclosure: grant consumed, zero bytes delegated
    }
    // — N arm: the CONSUMED manifest must carry connect@this exact
    //   destination (frozen parser's law via `resourceEquals`) —
    const effectList = Array.isArray(consumed.value.effects.effects) ? consumed.value.effects.effects : []
    const hasN = effectList.some((e) =>
      isRecord(e) && e['kind'] === 'connect' && isRecord(e['resource'])
      && resourceEquals(e['resource'] as unknown as ResourceRef, destinationResource),
    )
    if (!hasN) {
      return done(webGatewayRefusal('DOMAIN_DENIED', `destination-outside-grant: no connect@${envelope.canonicalLocator} arm exists in the admitted effect set`), { operation: operationLabel, refusal: 'destination-outside-grant' })
    }

    // — D arm: the Domain Authority answers at the effect-commit point, last
    //   before transport; Team approval can never rewrite it —
    let domainVeto: DomainVeto = 'not-applicable'
    if (readDomainVeto !== undefined) {
      domainVeto = await readDomainVeto(target)
      if (domainVeto === 'denied') {
        return done(webGatewayRefusal('DOMAIN_DENIED', 'the Domain Authority denied this effect commit (Team approval cannot rewrite it)'), { operation: operationLabel, refusal: 'domain-denied' })
      }
      if (cancelledNow(signal)) {
        return cancelledOutcome(operationLabel, 'before-transport')
      }
    }

    // — delegate to the REAL provider (the seam resolves the configured
    //   provider at call time; we never select or imitate one) —
    try {
      const outcomeFingerprint = await delegate()
      return done(
        { ok: true, value: Object.freeze({ outcomeFingerprint, domainVeto }) },
        { operation: operationLabel, outcome: 'ok' },
      )
    } catch (err) {
      return done(seamFailure(err), { operation: operationLabel, refusal: seamCodeOf(err) ?? 'seam-error' })
    }
  }

  function fingerprintForFetch(envelope: WebDestinationEnvelope, res: Awaited<ReturnType<WebGatewaySeamPorts['fetch']>>): string {
    const finalOrigin = originOf(res.url)
    const finalOriginMismatch = finalOrigin !== envelope.canonicalLocator
    return canonicalJsonFingerprint({
      operation: 'web.fetch',
      destination: envelope.canonicalLocator,
      statusCode: res.statusCode,
      truncated: res.truncated,
      finalOrigin,
      finalOriginMismatch,
    })
  }

  function fingerprintForSearch(envelope: WebDestinationEnvelope, res: Awaited<ReturnType<WebGatewaySeamPorts['search']>>): string {
    const sourceOrigins = [...new Set(res.sources.map((s) => originOf(s.url) ?? 'unparseable'))].sort()
    return canonicalJsonFingerprint({
      operation: 'web.search',
      destination: envelope.canonicalLocator,
      sourceOrigins,
      truncated: res.truncated,
    })
  }

  function seamFailure(err: unknown): ReturnType<typeof webGatewayRefusal> {
    const code = seamCodeOf(err)
    const message = err instanceof Error ? err.message : String(err)
    if (code !== undefined && DESTINATION_SEAM_CODES.has(code)) {
      // GROUP 5 honesty: the SAME code can surface on a LATER redirect hop
      // (root 07:38 clarification: production refuses cross-origin redirects,
      // but a same-origin chain can still be blocked after hop 1 already
      // produced effects), and no seam code distinguishes the hop. TRUE.
      return webGatewayRefusal('DOMAIN_DENIED', `provider refused the destination (${code})`, { details: Object.freeze({ seamCode: code }), sideEffectUnknown: true })
    }
    return webGatewayRefusal('IO_POLICY_UNSUPPORTED', `the web capability cannot run in this configuration (${code ?? 'unmapped seam error'}): ${message}`, {
      ...(code === undefined ? {} : { details: Object.freeze({ seamCode: code }) }),
      sideEffectUnknown: true,
    })
  }

  function seamCodeOf(err: unknown): string | undefined {
    if (isRecord(err) && typeof err['code'] === 'string') return err['code']
    return undefined
  }

  // — C3 helpers: ONE closed/abort state, consulted at entry and after every
  //   await; the row signal is merged into the seam call so close() drains
  //   in-flight transport (the provider sees abort — never silence). —
  function cancelledNow(caller?: AbortSignal): boolean {
    return lifecycle.isClosed() || caller?.aborted === true
  }

  function mergedSignal(caller?: AbortSignal): AbortSignal | undefined {
    const row = lifecycle.signal
    if (row === undefined) return caller
    if (caller === undefined) return row
    const combined = new AbortController()
    if (caller.aborted) combined.abort(caller.reason)
    else if (row.aborted) combined.abort(row.reason)
    caller.addEventListener('abort', () => { combined.abort(caller.reason) }, { once: true })
    row.addEventListener('abort', () => { combined.abort(row.reason) }, { once: true })
    return combined.signal
  }

  function rowClosedRefusal(): ReturnType<typeof webGatewayRefusal> {
    return webGatewayRefusal('IO_POLICY_UNSUPPORTED', 'web-row-closed: this row was closed by the owning entry; every reference (wrapper or raw) refuses; zero delegation after close', { sideEffectUnknown: false })
  }

  function cancelledOutcome(operation: string, stage: 'before-consume' | 'after-consume' | 'before-transport'): CallOutcome {
    const detail = stage === 'before-consume'
      ? 'cancellation observed before the consume boundary: ZERO consume (cancel-first law)'
      : 'transport never delegated by this lane (zero bytes); DISCLOSURE: the grant WAS consumed at the center edge (single-use is spent)'
    return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', `call-cancelled-${stage}: ${detail}`, { sideEffectUnknown: false }), { operation, refusal: `cancelled-${stage}` })
  }

  /** C2 runtime completeness of the captured facts (stubs/wiring may lie;
   *  the lane refuses incomplete facts rather than run on half-material). */
  function factsIncompleteMessage(facts: WebTrustedCallFacts): string | null {
    if (!isRecord(facts)) return 'facts-not-a-record'
    const missing: string[] = []
    const member = facts['member']
    if (!isRecord(member) || typeof member['teamSessionId'] !== 'string' || member['teamSessionId'].length === 0 || typeof member['instanceId'] !== 'string' || member['instanceId'].length === 0) {
      missing.push('member{teamSessionId,instanceId}')
    }
    if (typeof facts['callId'] !== 'string' || facts['callId'].length === 0) missing.push('callId')
    for (const generation of ['bindingRevision', 'authorityGeneration', 'policyGeneration'] as const) {
      if (typeof facts[generation] !== 'number' || !Number.isFinite(facts[generation])) missing.push(generation)
    }
    const effects = facts['effects']
    if (!isRecord(effects) || !Array.isArray(effects['effects'])) missing.push('effects{effects[]}')
    return missing.length > 0 ? missing.join(', ') : null
  }

  function done(result: GovernanceResult<GatewayReceipt>, obs: Record<string, string | boolean>): CallOutcome {
    return { result, obs }
  }

  const call: ProviderGateway['call'] = async (request: GatewayCallRequest) => callWeb(request as WebGatewayCallRequest)

  return Object.freeze({ call, callWeb })
}

/** Re-exported lane surface. */
export type {
  DomainVetoReader,
  SearchOriginResolver,
  WebAuthorityInput,
  WebConsumedGrant,
  WebDestinationEnvelope,
  WebFactsSource,
  WebGatewayCallRequest,
  WebGatewaySeamPorts,
  WebGrantAuthority,
  WebOperationPayload,
  WebRowLifecycle,
  WebTrustedCallFacts,
} from './types.js'
export { parseWebEnabledRaw, webGatewayRefusal } from './types.js'
export type { WebAddressVeto, WebEnabledParse, WebFetchSeamRequest, WebFetchSeamResult, WebSearchSeamRequest, WebSearchSeamResult } from './types.js'
export { deriveDestination, literalAddressVeto, originOf } from './destination-envelope.js'
export type { EnvelopeFailure } from './destination-envelope.js'
