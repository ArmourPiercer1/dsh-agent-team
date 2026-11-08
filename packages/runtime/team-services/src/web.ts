/**
 * Alpha.5 BL-18 (P2-05) — the confined `web` face: the network axis of a
 * governed Member, enforced BEFORE any provider call.
 *
 * WHY THIS FILE EXISTS. The native `web_fetch`/`web_search` face at the host pin
 * is upstream's `@deepseek-ai/dsh-tool-web`: it owns the schema, argument
 * validation and presentation, and every execution goes through `ctx.web`
 * (`packages/web/tool-web/src/index.ts`: `await ctx.web.fetch({ url }, signal)`).
 * The Member realm isolates `fs` and (BL-16/17) `subprocess`; it isolated no
 * `web`, so a governed Member's `web_fetch` resolved the INHERITED host `ctx.web`
 * — the real HTTP provider, the process-wide proxy dispatcher, ambient egress —
 * with zero guard facts and no consult of the compiled `network` axis. This
 * module is the missing service identity: a subclass of the host's OWN `web`
 * class, mounted on the Member's isolated scope, whose `fetch`/`search` consult
 * the compiled lane and then delegate to the composition-injected provider.
 *
 * NO SECOND PERMISSION COMPUTATION. The decision reads
 * `effective.network.access` — the field `compileEffectiveIo` already produced
 * as `ceiling ∩ tool restriction` (P1-02). There is no re-intersection here, no
 * second lane algebra, and no Member-supplied input: the effective policy is
 * the same object the `fs` face guards with, and the fact stream is the SAME
 * `observeGuard` transport (`a5sf-guard-consult/1`) the `fs`/`subprocess` faces
 * emit. The method names (`web:fetch`, `web:search`) are what the fact says was
 * consulted; they are not a second decision.
 *
 * THE CAPABILITY QUESTION IS BL-17'S, ANSWERED BY BL-17'S PROBE. A `network:
 * deny` lane is a claim about the OS/network boundary. This face therefore asks
 * the backend's OWN capability probe — the SAME `probeNetworkDenial` the
 * confined process face calls (imported, not copied) — and admits the call only
 * on an explicit `enforced` answer. Absence, a throw, a refusal or a missing row
 * all mean `unsupported`, and `unsupported` REFUSES: zero provider calls, zero
 * DNS lookups, zero connects, one typed fact. On this host no backend in either
 * lane reports `enforced`, so a `network: deny` web call is always refused
 * before the wire — the honest product state, not a documented limitation.
 *
 * PD-15 — THE PROOF IS BOUND TO THE FACE. An `enforced` row is evidence about
 * the face that MEASURED it. BL-42's mechanism is a per-child network namespace
 * created by the confined launcher; this transport runs IN-PROCESS and never
 * enters that namespace, so the subprocess lane's proof is not evidence about
 * this face. A deny call is therefore admitted only when the provider also
 * offers a `networkProof` whose `face` is `'web'`; a proof minted for another
 * face is refused with `NETWORK_PROOF_FACE_MISMATCH`, and an unnamed proof is
 * refused rather than defaulted. No proof shape makes this face OS-isolated —
 * a `web`-face proof can only ever be a SERVICE-LEVEL statement, and a future
 * transport that rides a confined child is the only path to an OS-level one.
 *
 * REDIRECT / PROXY — WHAT THE REFUSAL COVERS, AND WHAT IT DOES NOT. The refusal
 * is POSITIONED before the provider is entered, so a deny lane has no request
 * that could be redirected and no dispatcher that could resolve a proxy: both
 * are downstream of the call this face never makes (measured by the arms as a
 * zero counter on a fake boundary that records fetch/proxy/connect attempts).
 * On an ALLOW lane this face does NOT mediate redirects or proxy selection —
 * the host fetch provider follows same-origin redirects under its own hop cap
 * and honours the process-wide proxy dispatcher. That limit is not hidden in
 * prose: it rides the ALLOW constituent as the typed residual annotations
 * {@link WEB_NETWORK_RESIDUALS} on the same fact, so a reader of the evidence
 * sees the admitted call's unmediated dimensions. Nothing here claims coverage
 * of a dimension it does not own.
 *
 * WHAT THIS IS NOT: not a network sandbox (it cannot make a socket fail), not a
 * provider (the composition injects one, exactly like the confined process
 * provider), not a second policy compiler, and not a claim that a governed
 * Member can fetch "safely" — an admitted call is ordinary host egress, and the
 * live half of the row is unproven (see `evidence/a5sf-web/README.md`).
 *
 * @module @dsh-agent-team/runtime/team-services/web
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ProviderResult } from '../../sandbox-provider/index.js'
import {
  evaluateNetworkRequirement,
  NETWORK_PROOF_FACE_MISMATCH,
  type NetworkEnforcementProof,
} from '../../sandbox-provider/index.js'
import type { EffectiveIoPolicy } from '../../member-io-policy/src/types.js'
import type { FsGuard } from './fs.js'
import { observeGuard, type GuardConsultObserver } from './guard-observability.js'
import { probeNetworkDenial, type ConfinedCapabilityRow } from './subprocess.js'
import { TeamIoDenial } from './types.js'

/**
 * The guard METHOD the confined web face consults for one admitted fetch. It is
 * a distinct method name so the fact says which call was decided; the decision
 * itself is the compiled lane's `network` axis, not a new evaluator.
 */
export const WEB_FETCH_GUARD_METHOD = 'web:fetch'

/** The same for the sibling network row on this face (a SECOND call path). */
export const WEB_SEARCH_GUARD_METHOD = 'web:search'

/**
 * The typed residual an ALLOW-constituent carries: dimensions this face does
 * NOT mediate once a call is admitted. They are annotation VALUES on the same
 * guard fact (the transport `observeGuard` already supports), which is why the
 * fact count never changes and no new evidence channel is invented.
 *
 * `WEB_REDIRECT_UNMEDIATED_ON_ALLOW` — the host fetch provider follows
 * same-origin redirects under its own hop cap; this face does not re-check the
 * chain. On a `network: deny` lane this is unreachable by construction: the
 * refusal happens before the provider, so no request exists to redirect.
 *
 * `WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW` — the host provider resolves its
 * dispatcher through the process-wide proxy policy (`proxyRouteFor`); this face
 * does not select or veto a proxy. On a `network: deny` lane this is likewise
 * unreachable: no provider call means no proxy lookup and no DNS.
 */
export const WEB_NETWORK_RESIDUALS = Object.freeze([
  'WEB_REDIRECT_UNMEDIATED_ON_ALLOW',
  'WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW',
] as const)

/** One residual token (the closed set this face can emit). */
export type WebNetworkResidual = (typeof WEB_NETWORK_RESIDUALS)[number]

/**
 * PD-27 — the marker that says "this `web` service IS the Member's confined
 * face", set on the class `createConfinedWebClass` returns.
 *
 * WHY A MARKER IS NEEDED AT ALL. The confined face is a SUBCLASS of the host's
 * own `web` service, so it exposes exactly the same `fetch`/`search` as the
 * inherited base provider — duck typing cannot tell them apart, and getting
 * that wrong is precisely PD-18's hole (the tool runs on the base provider with
 * zero guard facts). A tool that has to answer "is this scope's `web` governed?"
 * asks this marker and nothing else.
 *
 * WHY A GLOBAL SYMBOL AND NOT AN EXPORT: the model-visible shadow
 * (`src/plugin/live/confined-web-tool.mjs`) is COPIED into the dist mirror, not
 * compiled with this file, so it cannot import this constant across the two
 * trees; both sides spell `Symbol.for('a5sf.confined.web.face')` and the
 * host-free parity test asserts the two agree.
 */
export const A5SF_CONFINED_WEB_MARK = Symbol.for('a5sf.confined.web.face')

/**
 * Whether `service` is a confined web face (PD-27). Only the marker counts;
 * `undefined`/`null` (no `web` service) and a plain provider are both `false`.
 *
 * @param service - the value of `ctx.web` on the scope being asked.
 * @returns true only for the realm-mounted confined face.
 */
export function isConfinedWebFace(service: unknown): boolean {
  if (service === null || service === undefined) return false
  if (typeof service !== 'object' && typeof service !== 'function') return false
  return (service as Record<symbol, unknown>)[A5SF_CONFINED_WEB_MARK] === true
}

/**
 * The structural web Provider the confined face delegates to. It mirrors what
 * the host `ctx.web` seam exposes (`fetch`/`search`) and what the composition
 * owns: the ONE transport. The optional `probe` is the SAME capability probe
 * BL-17 added for the process lane; a provider without one answers
 * `unsupported`, never a default allow.
 */
export interface ConfinedWebProvider {
  fetch(request: unknown, signal?: AbortSignal): Promise<unknown>
  search?(request: unknown, signal?: AbortSignal): Promise<unknown>
  /**
   * PD-30 — the provider's OWN availability answer for search, if it has one.
   * Absent means "the provider does not say", which is NOT a refusal: the face
   * then relies on the `search` method's presence. A provider that answers
   * false (an empty API key, an unparseable endpoint) is refused with
   * `WEB_PROVIDER_UNAVAILABLE` before any provider entry.
   */
  searchAvailable?: () => boolean
  /**
   * PD-30 — the exact origins this TRANSPORT declares as local fixtures (the
   * SSRF exemption). Composition-owned: written by the transport row's config,
   * never by a Member, and matched by exact origin only.
   */
  readonly testEndpoints?: readonly string[]
  probe?: () => Promise<ProviderResult<readonly ConfinedCapabilityRow[]>>
  /**
   * PD-15 — the face-bound proof this provider stands behind, or `null`/absent.
   *
   * A capability ROW is not enough for the web face: a row produced by the
   * confined process lane is evidence about a child in a network namespace, and
   * this transport runs in-process. The provider must therefore name BOTH the
   * mechanism and the face it was measured for; the guard admits only a proof
   * whose `face` is `'web'`. Lacking one, the call is refused — never admitted
   * on the strength of another face's measurement.
   */
  networkProof?: () => NetworkEnforcementProof | null | Promise<NetworkEnforcementProof | null>
}

/** A Provider constructor Cordis can mount as the `web` service. */
export type WebProviderConstructor = new (ctx: Context, config?: Record<string, unknown>) => ConfinedWebProvider

/** The confined `web` surface a realm reports in its `faces` answer. */
export interface ConfinedWebSurface {
  fetch(request: unknown, signal?: AbortSignal): Promise<unknown>
  search(request: unknown, signal?: AbortSignal): Promise<unknown>
}

/** What {@link createConfinedWebClass} needs. */
export interface ConfinedWebOptions {
  /** The compiled `EffectiveIo` (`ceiling ∩ restriction`) this face enforces. */
  readonly effective: EffectiveIoPolicy
  /** The composition-owned web provider (the ONE transport). Never a Member input. */
  readonly provider: ConfinedWebProvider
  /** The admission guard; defaults to {@link createWebNetworkGuard}. */
  readonly guard?: FsGuard
  /** Optional fact observer — wrapped with `observeGuard` (one fact/consult). */
  readonly onGuardConsult?: GuardConsultObserver
  /** The realm this face reports its facts on (defaults to the Member ceiling). */
  readonly realm?: 'member' | 'binding'
  /** The binding identity the effective policy was compiled for, if any. */
  readonly toolBindingIdentity?: string | null
  /**
   * PD-30 — the composition's DECLARED test endpoints (exact origins such as
   * `http://127.0.0.1:3182`). Absent/empty is the production default and the
   * only shape a shipped deployment should use.
   *
   * WHY A LIST IS NEEDED AT ALL, stated so it cannot be read as a hole: the
   * destination leg refuses loopback/private/link-local/metadata targets
   * (SSRF). A local test endpoint IS a loopback target, so "refuse every
   * non-public destination" and "measure a real request over a real socket"
   * would be contradictory. The distinction is exact and declared: an origin
   * on THIS list is a fixture the composition itself stood up, matched by
   * equal origin (scheme + host + port) and nothing else — a different port, a
   * different hostname spelling, a redirect off it, or a path prefix trick all
   * fail the match and are then classified like any other target. The list is
   * composition config (never a Member input), and it is recorded in the
   * deployment evidence, so a reader can see exactly which fixture was exempt.
   */
  readonly testEndpoints?: readonly string[]
  /** The admission guard; defaults to {@link createWebNetworkGuard}. */
  readonly admission?: WebAdmission
}

/** PD-30 — the destination/provider admission a web face applies to every call. */
export interface WebAdmission {
  /** Exact origins exempt from the SSRF destination leg (see {@link ConfinedWebOptions.testEndpoints}). */
  readonly testEndpoints?: readonly string[]
}

/**
 * PD-30 — the longest declared URL this face admits. A URL that no provider
 * could usefully parse is refused at admission (`WEB_REQUEST_MALFORMED`)
 * instead of being shipped over a socket.
 */
export const WEB_MAX_DECLARED_URL_LENGTH = 8192

/** The IPv4 literal ranges that are never a public destination. */
const FORBIDDEN_IPV4: readonly (readonly [string, number])[] = Object.freeze([
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
])

/** Hostnames that name a local/instance-metadata service rather than a public site. */
const FORBIDDEN_HOSTNAMES: readonly string[] = Object.freeze([
  'localhost', 'metadata', 'metadata.google.internal', 'instance-data', 'metadata.azure.com',
])

/** IPv6 prefixes that are never a public destination (textual, lower-cased). */
const FORBIDDEN_IPV6_PREFIXES: readonly string[] = Object.freeze(['::1', '::', 'fc', 'fd', 'fe80', 'fec0'])

/**
 * Build the lane admission for one web face. It answers, in a FIXED order:
 *
 *   1. REQUEST SHAPE — a request that is not an absolute `http(s)` URL with a
 *      host, or a search with no query, is `WEB_REQUEST_MALFORMED`;
 *   2. DESTINATION — a loopback/private/link-local/unroutable/metadata target
 *      that is not a declared test endpoint is `WEB_DESTINATION_FORBIDDEN`
 *      (the SSRF leg; runs on EVERY lane, allow included);
 *   3. PROVIDER — a search call whose provider exposes no usable search is
 *      `WEB_PROVIDER_UNAVAILABLE`;
 *   4. THE LANE — does this lane claim `network: deny`, and if so, can the
 *      backend's own probe prove it? (BL-17/PD-15, unchanged).
 *
 * ALL FOUR live in this ONE closure, so there is exactly one policy source and
 * exactly one fact per call whatever refuses it (`observeGuard` maps the code).
 * `allow` returns without touching the provider; a refusal NEVER reaches the
 * provider (the throw is before the delegate line in the class below).
 */
export function createWebNetworkGuard(
  effective: EffectiveIoPolicy,
  provider: ConfinedWebProvider,
  admission: WebAdmission = {},
): FsGuard {
  const testOrigins = new Set(normaliseTestEndpoints(admission.testEndpoints))
  return async function webNetworkGuard(method: string, target: string): Promise<void> {
    const fields = { memberIdentity: effective.memberIdentity, method, target }
    // ORDER (PD-30): SHAPE -> LANE -> DESTINATION -> AVAILABILITY.
    //   SHAPE       a request that cannot even be parsed is malformed whatever
    //               the lane says: it must not borrow the lane's code.
    //   LANE        the compiled ceiling is the PERMISSION. A `deny` lane refuses
    //               its own typed code for ANY target — the deny arm is about the
    //               policy, not the address — so it is decided before the
    //               destination and before the backend question (PD-18 pins this:
    //               a denied lane over a local fixture must answer
    //               NETWORK_UNCONFINED_REALM, never the SSRF code).
    //   DESTINATION the SSRF leg is a property of an ADMITTED call.
    //   AVAILABILITY the backend question is last: it is about this deployment,
    //               not about the request.
    const declared = method === WEB_SEARCH_GUARD_METHOD
      ? (assertDeclaredQuery(target, fields), undefined)
      : assertDeclaredUrl(target, fields)
    // The permission: the ONE compiled lane. A non-`deny` axis is not a
    // network refusal (the face does not invent a second class of deny).
    if (effective.network.access !== 'deny') {
      if (method === WEB_SEARCH_GUARD_METHOD) assertSearchAvailable(provider, fields)
      else assertDestinationAllowed(declared as URL, testOrigins, fields)
      return
    }
    // The capability: BL-17's probe, imported. Only an explicit `enforced`
    // answer proceeds; everything else is the closed `unsupported`.
    const capability = await probeNetworkDenial(provider)
    if (capability.level !== 'enforced') {
      throw new TeamIoDenial(
        'NETWORK_UNCONFINED_REALM',
        `the effective lane requests network=deny, but the web provider's capability probe reports `
          + `${capability.dimension}='${capability.level}' (${capability.note}); refusing before any provider call `
          + 'instead of fetching under a deny claim this host cannot enforce. A backend that proves '
          + "'enforced' is the only configuration that admits this call",
        { memberIdentity: effective.memberIdentity, method, target },
      )
    }
    // PD-15 — A LEVEL (OR A ROW) IS NOT A FACE-BOUND PROOF. The pre-fix guard
    // returned here, which is the hole #645 found: a composition that handed
    // the web face the SUBPROCESS lane's realm-bound `enforced` row admitted a
    // deny `web_fetch` into ordinary host egress, because the in-process web
    // transport cannot ride the launcher's per-child netns. Ask for a proof
    // that names its face and refuse anything minted for another one.
    const proof = await readNetworkProof(provider)
    const admission = evaluateNetworkRequirement('deny', effective.memberIdentity, proof, 'web')
    if (admission.ok) return
    const refusal = admission.error.details?.['refusal']
    if (refusal === NETWORK_PROOF_FACE_MISMATCH) {
      throw new TeamIoDenial(
        NETWORK_PROOF_FACE_MISMATCH,
        `the effective lane requests network=deny, but the web provider offered a network-enforcement proof minted for `
          + `a different face (${admission.error.message}); an in-process web transport cannot inherit the confined `
          + `launcher's network namespace, so another face's measurement is not evidence about this face — refusing `
          + 'before any provider call (PD-15)',
        { memberIdentity: effective.memberIdentity, method, target },
      )
    }
    throw new TeamIoDenial(
      'NETWORK_UNCONFINED_REALM',
      `the effective lane requests network=deny, and the web provider's probe reports 'enforced' (${capability.note}), `
        + `but it offered no face-bound proof for the 'web' face (${admission.error.message}); a capability level alone `
        + 'does not prove this face, so the call is refused before any provider call',
      { memberIdentity: effective.memberIdentity, method, target },
    )
  }
}

/**
 * Normalise the declared test endpoints to exact origins. A value that is not
 * an absolute `http(s)` URL with an origin is DROPPED rather than widened: a
 * malformed exemption can only ever be a fixture mistake, and dropping it
 * means the target is classified like any other (fail closed).
 */
function normaliseTestEndpoints(endpoints: readonly string[] | undefined): string[] {
  if (!Array.isArray(endpoints)) return []
  const origins: string[] = []
  for (const raw of endpoints) {
    if (typeof raw !== 'string' || raw.trim() === '') continue
    try {
      const url = new URL(raw.trim())
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
      if (url.hostname === '') continue
      origins.push(url.origin)
    } catch {
      continue
    }
  }
  return origins
}

/**
 * The request-shape leg (PD-30). A declared value that is not an absolute
 * `http(s)` URL with a non-empty host, or that is longer than
 * {@link WEB_MAX_DECLARED_URL_LENGTH}, is `WEB_REQUEST_MALFORMED` — the
 * transport never sees it. The returned `URL` is the PARSED request, so the
 * destination leg classifies exactly the string the provider will receive.
 */
function assertDeclaredUrl(target: string, fields: WebDenialFields): URL {
  if (typeof target !== 'string' || target === '') {
    throw new TeamIoDenial('WEB_REQUEST_MALFORMED', 'the web request carries no declared URL; refusing before any provider call', fields)
  }
  if (target.length > WEB_MAX_DECLARED_URL_LENGTH) {
    throw new TeamIoDenial(
      'WEB_REQUEST_MALFORMED',
      `the declared URL is ${String(target.length)} characters, beyond the ${String(WEB_MAX_DECLARED_URL_LENGTH)}-character `
        + 'admission bound; refusing instead of handing an unparseable request to a provider',
      fields,
    )
  }
  let url: URL
  try {
    url = new URL(target)
  } catch {
    throw new TeamIoDenial('WEB_REQUEST_MALFORMED', `the declared URL ${JSON.stringify(target.slice(0, 200))} is not an absolute URL`, fields)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TeamIoDenial(
      'WEB_REQUEST_MALFORMED',
      `the declared URL uses scheme ${JSON.stringify(url.protocol)}; this face admits http/https only`,
      fields,
    )
  }
  if (url.hostname === '') {
    throw new TeamIoDenial('WEB_REQUEST_MALFORMED', 'the declared URL has no host', fields)
  }
  return url
}

/** A search needs a query; a query-less search is a malformed request, not an empty result. */
function assertDeclaredQuery(target: string, fields: WebDenialFields): void {
  if (typeof target !== 'string' || !target.startsWith('query:') || target.slice('query:'.length).trim() === '') {
    throw new TeamIoDenial('WEB_REQUEST_MALFORMED', 'the web search carries no declared query; refusing instead of returning an empty result', fields)
  }
}

/**
 * The provider leg (PD-30): a search call whose provider exposes no `search`,
 * or whose own `searchAvailable()` answers false, is `WEB_PROVIDER_UNAVAILABLE`.
 * That is the honest shape of "the composition has no search backend": typed,
 * zero provider entries, never a fabricated or empty result.
 */
function assertSearchAvailable(provider: ConfinedWebProvider, fields: WebDenialFields): void {
  if (typeof provider.search !== 'function') {
    throw new TeamIoDenial(
      'WEB_PROVIDER_UNAVAILABLE',
      'this web face was installed with a provider that exposes no search; refusing instead of returning a fabricated result',
      fields,
    )
  }
  const available = provider.searchAvailable
  if (typeof available !== 'function') return
  let ok: boolean
  try {
    ok = available.call(provider) === true
  } catch {
    ok = false
  }
  if (!ok) {
    throw new TeamIoDenial(
      'WEB_PROVIDER_UNAVAILABLE',
      'the composition installed a search provider that reports itself unavailable (its own available() answers false); '
        + 'refusing before any provider entry instead of returning an empty or fabricated result',
      fields,
    )
  }
}

/**
 * The SSRF leg (PD-30). Refuses a destination that is loopback, a private /
 * carrier-grade-NAT / link-local / unroutable literal, or a well-known instance
 * metadata host — UNLESS the target's origin is one of the composition's
 * declared test endpoints (exact origin equality).
 *
 * WHAT THIS IS AND IS NOT, stated because it is easy to overclaim: this is a
 * DECLARED-STRING admission check that runs before the transport, in the same
 * guard as the lane decision. It does not pin DNS: a permitted hostname that
 * RESOLVES to a private address is refused by the host provider's own resolver
 * (the pinned `HttpFetchProvider` resolves through `publicHttpNetwork.resolve`,
 * which refuses non-public destinations) — and a resolver that was replaced
 * with a permissive one is a different composition, disclosed on the deployment
 * record. IPv4 literals in decimal/octal/hex spelling are normalised by `URL`
 * before this runs, so an alternate spelling cannot slip past the ranges.
 */
function assertDestinationAllowed(url: URL, testOrigins: ReadonlySet<string>, fields: WebDenialFields): void {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (testOrigins.has(url.origin)) return
  if (FORBIDDEN_HOSTNAMES.includes(hostname) || hostname.endsWith('.localhost')) {
    throw new TeamIoDenial(
      'WEB_DESTINATION_FORBIDDEN',
      `the declared destination host ${JSON.stringify(hostname)} is a local/instance-metadata name; refusing before the transport `
        + '(declare it as a composition test endpoint if it is a fixture, never from a Member)',
      fields,
    )
  }
  if (isForbiddenIpv4(hostname) || isForbiddenIpv6(hostname)) {
    throw new TeamIoDenial(
      'WEB_DESTINATION_FORBIDDEN',
      `the declared destination ${JSON.stringify(hostname)} is a loopback/private/link-local/unroutable literal; refusing before `
        + 'the transport (SSRF leg). A public destination is required, or an exact declared test endpoint',
      fields,
    )
  }
}

/** True for an IPv4 literal inside one of the {@link FORBIDDEN_IPV4} ranges. */
function isForbiddenIpv4(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN))
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false
  const value = ((octets[0]! << 24) >>> 0) + (octets[1]! << 16) + (octets[2]! << 8) + octets[3]!
  return FORBIDDEN_IPV4.some(([base, bits]) => {
    const baseValue = base.split('.').reduce((acc, part) => ((acc << 8) >>> 0) + Number(part), 0) >>> 0
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (value & mask) >>> 0 === (baseValue & mask) >>> 0
  })
}

/** True for an IPv6 literal whose textual form is loopback/unspecified/ULA/link-local. */
function isForbiddenIpv6(hostname: string): boolean {
  if (!hostname.includes(':')) return false
  const lower = hostname.toLowerCase()
  return FORBIDDEN_IPV6_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}:`) || lower.startsWith(prefix))
}

/**
 * The seam's result-shape contract on the SECOND call path (PD-30).
 *
 * `WebRuntime.search` documents and enforces `request.maxResults`: a provider
 * that over-returns is truncated and the result marked `truncated`. This face
 * REPLACES that method (it is the service identity on the realm scope), so
 * skipping the cap would let a governed Member receive more results than it
 * asked for — a widened answer, not a refused one. The rule is restated here
 * because the seam exports no helper for it; it decides nothing about
 * PERMISSION (the guard already did) and it never widens a result.
 */
function capSearchSources(result: unknown, request: unknown): unknown {
  if (result === null || typeof result !== 'object') return result
  const payload = result as { sources?: unknown; truncated?: unknown }
  if (!Array.isArray(payload.sources)) return result
  const raw = request !== null && typeof request === 'object' ? (request as { maxResults?: unknown }).maxResults : undefined
  const cap = typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : undefined
  if (cap === undefined || payload.sources.length <= cap) return result
  return Object.freeze({
    ...payload,
    sources: Object.freeze(payload.sources.slice(0, cap)),
    truncated: true,
  })
}

/**
 * Make a guard refusal TYPED IN THE TEXT THE MODEL SEES (PD-30).
 *
 * The guard throws `TeamIoDenial`, whose `code` is the typed decision and whose
 * `message` is the detail (the fact already records `decidedBy`). The tool
 * framework renders an error to the model as `Error: <message>`, so without
 * this the code would only exist on an object the Member never inspects — a
 * refusal the model cannot tell apart from a transport fault. The shadow's own
 * `NETWORK_UNCONFINED_REALM` refusal already spells `<code>: <detail>`; this
 * makes the face's refusals agree with it. The error OBJECT is reused (same
 * code, same fields), so nothing about the decision changes.
 */
function modelVisibleDenial(error: unknown): unknown {
  if (error instanceof TeamIoDenial && typeof error.message === 'string' && !error.message.startsWith(`${error.code}:`)) {
    error.message = `${error.code}: ${error.message}`
  }
  return error
}

/** The identity fields every PD-30 refusal carries (the same shape as the lane refusal). */
interface WebDenialFields {
  readonly memberIdentity: string
  readonly method: string
  readonly target: string
}

/**
 * Read the provider's optional face-bound proof. Absence, a throw or a
 * non-object answer are all the SAME closed answer (`null`): the guard then
 * refuses with `NETWORK_UNCONFINED_REALM` instead of inventing a proof. The
 * proof's own shape is validated by {@link evaluateNetworkRequirement}; nothing
 * here "fixes up" a malformed proof into an admissible one.
 */
async function readNetworkProof(provider: ConfinedWebProvider): Promise<NetworkEnforcementProof | null> {
  const read = provider.networkProof
  if (typeof read !== 'function') return null
  try {
    const proof = await read.call(provider)
    return proof !== null && typeof proof === 'object' ? proof : null
  } catch {
    return null
  }
}

/**
 * Create the confined `web` Provider class for one Member: the host's OWN class
 * is the service identity, and `fetch`/`search` are REPLACED by the confined
 * path (there is no unguarded fallback to inherit).
 *
 * The injected provider is the only thing this face ever calls for a fetch; it
 * is never `super.fetch`, so a provider registered on the confined instance's
 * inherited registry cannot silently take the call. That is stated in the
 * header: the composition declares its provider on the install spec, next to
 * the launcher/transport pin.
 */
export function createConfinedWebClass(
  Base: new (ctx: never, config?: never) => object,
  options: ConfinedWebOptions,
): WebProviderConstructor {
  const { effective, provider } = options
  if (effective === undefined || effective === null) {
    throw new TypeError('createConfinedWebClass needs the compiled EffectiveIo policy')
  }
  if (provider === undefined || provider === null || typeof provider.fetch !== 'function') {
    throw new TypeError('createConfinedWebClass needs the composition-owned web provider')
  }
  // PD-30: the fixture exemption is the TRANSPORT's declaration when the mount
  // does not restate it (`provider.testEndpoints`, written by the composition
  // row's own config — see `a5sf-web-transport.mjs`). It is composition-owned
  // either way: a Member can never widen it, and `assertDestinationAllowed`
  // matches the EXACT origin only.
  const declaredTestEndpoints = options.testEndpoints
    ?? (provider as ConfinedWebProvider).testEndpoints
  const laneGuard = options.guard ?? createWebNetworkGuard(effective, provider, {
    ...(declaredTestEndpoints === undefined ? {} : { testEndpoints: declaredTestEndpoints }),
  })
  const guard: FsGuard = options.onGuardConsult === undefined
    ? laneGuard
    : observeGuard(laneGuard, options.onGuardConsult, {
      realm: options.realm ?? 'member',
      memberIdentity: effective.memberIdentity,
      toolBindingIdentity: options.toolBindingIdentity ?? null,
      policyRevision: effective.policyRevision,
    })

  class ConfinedWeb extends (Base as new (ctx: never, config?: never) => object) {
    /**
     * One fetch: consult the lane (one fact), then the ONE provider call.
     * A refusal throws a typed `TeamIoDenial` BEFORE the provider line — the
     * position is the guarantee, not the message.
     */
    async fetch(request: unknown, signal?: AbortSignal): Promise<unknown> {
      const url = declaredUrlOf(request, 'fetch')
      try {
        await guard(WEB_FETCH_GUARD_METHOD, url, WEB_NETWORK_RESIDUALS)
      } catch (error) {
        throw modelVisibleDenial(error)
      }
      return provider.fetch(request, signal)
    }

    /** The sibling network row — the SECOND call path on this face. */
    async search(request: unknown, signal?: AbortSignal): Promise<unknown> {
      // PD-30: the missing/unavailable-provider refusal moved INSIDE the guard
      // so it produces the SAME one-fact-per-consult record as every other
      // refusal (a pre-guard throw would be a typed error with no fact, i.e.
      // exactly the silent gap "no backend" must never be).
      const target = declaredUrlOf(request, 'search')
      try {
        await guard(WEB_SEARCH_GUARD_METHOD, target, WEB_NETWORK_RESIDUALS)
      } catch (error) {
        throw modelVisibleDenial(error)
      }
      // The guard admitted this call, so the provider HAS a usable search.
      const result = await (provider.search as NonNullable<ConfinedWebProvider['search']>)
        .call(provider, request, signal)
      return capSearchSources(result, request)
    }
  }
  // PD-27: the marker the model-visible shadow (`confined-web-tool.mjs`) asks to
  // decide whether THIS scope's `web` is governed. It is set on the prototype so
  // every mounted instance answers it without carrying per-instance state.
  Object.defineProperty(ConfinedWeb.prototype, A5SF_CONFINED_WEB_MARK, {
    configurable: true,
    value: true,
  })
  return ConfinedWeb as unknown as WebProviderConstructor
}

/**
 * The `locator` a web consultation is recorded under: the DECLARED URL (or the
 * declared query), never a header, a body or a resolved address. A malformed
 * request records a stable marker instead of throwing before the decision — the
 * provider is the one that rejects a bad request, and the fact must still say
 * what was consulted.
 *
 * PD-27: the SINGULAR `query` is read as well. The pinned host `web_search` tool
 * calls `ctx.web.search({ query, maxResults })` — one query per seam call — while
 * the tool's PUBLIC schema is the plural `queries`. PD-15 recorded the resulting
 * `<search:malformed-request>` locator as a product-side gap; reading both
 * spellings makes the fact name the query that was actually decided without
 * changing the seam's shape.
 */
function declaredUrlOf(request: unknown, kind: 'fetch' | 'search'): string {
  if (request !== null && typeof request === 'object') {
    const url = (request as { url?: unknown }).url
    if (typeof url === 'string' && url !== '') return url
    const query = (request as { query?: unknown }).query
    if (typeof query === 'string' && query !== '') return `query:${query}`
    const queries = (request as { queries?: unknown }).queries
    if (Array.isArray(queries) && queries.length > 0 && typeof queries[0] === 'string') {
      return `queries:${String(queries.length)}`
    }
  }
  return `<${kind}:malformed-request>`
}
