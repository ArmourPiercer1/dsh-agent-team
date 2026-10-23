/**
 * `runtime/web-gateway` shared types — M2 B-WEB lane (web arm of the PR7
 * ProviderGateway).
 *
 * Contract authority: `docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/
 * M0-B-FAMILY-TARGET-CONTRACTS.md` §B-WEB (owner=CONNECTOR): the P layer wires
 * the DORMANT PR7 shape to the REAL installed Host providers; the Gateway
 * delegates DNS/IP validation, per-redirect-hop revalidation and connection
 * pinning to the production `web-fetch-http` provider and NEVER runs a second,
 * weaker copy of those checks. Effects are the closed set (root ruling
 * 2026-10-23): I = `tool-invoke@<exact definition>`, N =
 * `connect@network-destination(scheme://host[:port])` PER REAL destination
 * (search = the config-resolved provider origin, host `web-search-deepseek/
 * src/provider.ts:34` `DEEPSEEK_DEFAULT_BASE_URL` + `:217` endpoint build);
 * D = `domain-ref` when an independent Domain Authority answers; S carries NO
 * new effect kind — the exact-operation permission rides I, and URL/query
 * digests plus caps are manifest material (`payloadFingerprint`), never PA
 * vocabulary.
 *
 * PAYLOAD-PATH DISCLOSURE (pending the contract's "fingerprint + opaque ref"
 * channel — `tool-governance/src/interfaces.ts:170-178` carries only the
 * fingerprint): the retrieval payload itself travels on a LANE EXTENSION of
 * `GatewayTarget` (`WebGatewayTarget.webOperation`). The frozen
 * {@link GatewayCallRequest} signature is honored exactly — a plain envelope
 * WITHOUT the extension is a typed refusal, never a guess — and every key the
 * lane adds is closed-world. Flagged to the integration owner for ratification
 * or replacement by the frozen ref channel.
 *
 * @module runtime/web-gateway/types
 */
import type {
  DomainVeto,
  GatewayCallRequest,
  GatewayReceipt,
  GatewayTarget,
  GovernanceError,
  GovernanceErrorCode,
  OperationGrant,
  ToolBinding,
} from '../../../domain/tool-governance/src/index.js'

// ---------------------------------------------------------------------------
// The Host web seam, seen structurally (no host imports — CORE PATCH BUDGET=0
// and the lane stays import-clean of live glue). Authority for the shapes:
// host `packages/web/web/src/index.ts` (WebRuntime.search :140 / fetch :157)
// and `packages/web/web/src/types.ts` (WebSearchRequest :16 / WebFetchRequest
// :64 / results :35/:74) @ 639ed01539. The seam's provider-selection and
// capability refusals throw `WebError` codes (WEB_PROVIDER_CONFIGURED_MISSING
// / WEB_PROVIDER_CONFIGURED_UNAVAILABLE / WEB_PROVIDER_AMBIGUOUS /
// WEB_PROVIDER_UNAVAILABLE / WEB_PROVIDER_CREDENTIAL_MISSING /
// WEB_BLOCKED_URL / WEB_INVALID_URL …); the gateway maps them typed
// (see `SEAM_CODE_MAP` in ./index.js) and never re-implements selection.
// ---------------------------------------------------------------------------

/** The fetch request the seam accepts (host WebFetchRequest: url only — by
 *  design, timeout/format/prompt are NOT retrieval controls at this seam). */
export interface WebFetchSeamRequest {
  readonly url: string
}

/** The fetch outcome fields the receipt fingerprints (host WebFetchResult). */
export interface WebFetchSeamResult {
  readonly url: string
  readonly statusCode: number
  readonly truncated: boolean
}

/** The search request the seam accepts (host WebSearchRequest). */
export interface WebSearchSeamRequest {
  readonly query: string
  readonly maxResults?: number
}

/** The search outcome fields the receipt fingerprints (host WebSearchResult). */
export interface WebSearchSeamResult {
  readonly sources: readonly { readonly url: string }[]
  readonly truncated: boolean
}

/** One object carrying BOTH seam capabilities — structurally the Host
 *  `ctx.web` service (`ctx.web.search` / `ctx.web.fetch`). */
export interface WebGatewaySeamPorts {
  readonly fetch: (request: WebFetchSeamRequest, signal?: AbortSignal) => Promise<WebFetchSeamResult>
  readonly search: (request: WebSearchSeamRequest, signal?: AbortSignal) => Promise<WebSearchSeamResult>
}

// ---------------------------------------------------------------------------
// The web operation payload (lane extension — see header DISCLOSURE).
// ---------------------------------------------------------------------------

/** One retrieval operation, exact and closed. One search call = one query
 *  (the seam's own unit); multi-query tools fan out ABOVE this lane. */
export type WebOperationPayload =
  | { readonly kind: 'web.fetch'; readonly url: string }
  | { readonly kind: 'web.search'; readonly query: string; readonly maxResults?: number }

/** Lane extension of the frozen {@link GatewayTarget}: adds the operation
 *  payload, changes nothing else. Closed key set: destination,
 *  domainAuthorityId, webOperation. */
export interface WebGatewayTarget extends GatewayTarget {
  readonly webOperation?: WebOperationPayload
}

/** The lane call request: the frozen envelope with the extended target. */
export interface WebGatewayCallRequest extends Omit<GatewayCallRequest, 'target'> {
  readonly target: WebGatewayTarget
}

/** Resolves the search provider's origin FROM REAL CONFIG (never a fixed
 *  URL): the assembly injects a reader over the installed provider's own
 *  configuration (sync or async). Missing provider/credential ⇒ throw the
 *  seam's typed `WebError` code; the gateway maps it (no invented fallback
 *  destination). */
export type SearchOriginResolver = () => string | Promise<string>

/** The Domain Authority's answer at the effect-commit point (D arm). Absent
 *  reader ⇒ `not-applicable`, honestly reported in the receipt. */
export type DomainVetoReader = (target: WebGatewayTarget) => DomainVeto | Promise<DomainVeto>

// ---------------------------------------------------------------------------
// Destination envelope (./destination-envelope.js).
// ---------------------------------------------------------------------------

/** One literal-address veto (the belt the Team lane adds BEFORE transport;
 *  the authoritative DNS/IP law stays the provider's — no copy, no weakening). */
export interface WebAddressVeto {
  readonly code: 'loopback-hostname' | 'literal-non-public-ipv4' | 'literal-non-public-ipv6'
  readonly detail: string
}

/** The derived network destination for one retrieval operation. */
export interface WebDestinationEnvelope {
  /** `scheme://host[:port]` — the frozen locator law (`resource.ts:91-99`). */
  readonly canonicalLocator: string
  readonly scheme: 'http' | 'https'
  readonly host: string
  readonly port: number | null
  readonly literalVeto: WebAddressVeto | null
}

// ---------------------------------------------------------------------------
// Lane config (closed key: webEnabledRaw) + typed refusals.
// ---------------------------------------------------------------------------

export type WebEnabledParse =
  | { readonly ok: true; readonly enabled: boolean; readonly readAs: string }
  | { readonly ok: false; readonly refusal: { readonly code: 'web-config-not-boolean'; readonly detail: string } }

/**
 * The closed-key enable switch (jobs `jobsEnabled` precedent shape):
 * ABSENT ⇒ disabled (default-off), BOOLEAN ⇒ as-is, ANYTHING ELSE ⇒ typed
 * refusal — a truthy string never arms the row.
 */
export function parseWebEnabledRaw(raw: unknown): WebEnabledParse {
  if (raw === undefined) return { ok: true, enabled: false, readAs: 'absent-default-off' }
  if (typeof raw === 'boolean') return { ok: true, enabled: raw, readAs: `boolean:${String(raw)}` }
  return {
    ok: false,
    refusal: {
      code: 'web-config-not-boolean',
      detail: `webEnabledRaw must be absent (default off) or a boolean; received ${raw === null ? 'null' : typeof raw}`,
    },
  }
}

/** A frozen {@link GovernanceError} with optional details (never thrown —
 *  the closed Result shape, `errors.ts:53`). `sideEffectUnknown` is the
 *  honest top-level field (`errors.ts:48`): set TRUE only when bytes may
 *  have left the lane; refusals that provably precede transport say false. */
export function webGatewayRefusal(
  code: GovernanceErrorCode,
  message: string,
  options?: { readonly details?: Readonly<Record<string, string | number | boolean | null>>; readonly sideEffectUnknown?: boolean },
): { readonly ok: false; readonly error: GovernanceError } {
  const error: Record<string, unknown> = { code, message }
  if (options?.sideEffectUnknown !== undefined) error['sideEffectUnknown'] = options.sideEffectUnknown
  if (options?.details !== undefined) error['details'] = options.details
  return { ok: false, error: Object.freeze(error) as unknown as GovernanceError }
}

/** Re-exported so consumers type receipts without a governance re-import. */
export type { DomainVeto, GatewayCallRequest, GatewayReceipt, GatewayTarget, OperationGrant, ToolBinding, WebGatewayCallRequest as WebCallRequest }
