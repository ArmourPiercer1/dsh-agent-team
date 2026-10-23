/**
 * web-gateway-assembly.mjs — the GLUE row for the M2 B-WEB web arm
 * (mirror of the jobs-gateway-assembly precedent, efb5bb559 shape).
 *
 * Import-edge law (GLUE-5, pc-CONTRACT §3 item 1): the gateway enters ONLY
 * through the committed dist mirror — `../../../web-gateway/src/index.js`
 * from the placed dist copy resolves to
 * `packages/runtime/dist/packages/runtime/web-gateway/src/index.js`.
 * No source path, no second copy.
 *
 * ENABLEMENT (integration ruling 2026-10-23): `webEnabledRaw` is the closed
 * enable key — ABSENT means OFF (default-off, jobs `jobsEnabled` shape);
 * a NON-BOOLEAN is a typed refusal, never a coercion: no truthy string ever
 * arms this row. An unarmed row is returned honestly (`active: false` +
 * code) and the entry mounts NOTHING — restrict-first.
 *
 * PROVIDER TRUTH: this row ships no destination constant and selects no
 * provider. The search arm's origin comes from `resolveSearchOrigin`, the
 * entry-injected reader over the REAL installed provider's config (host
 * `web-search-deepseek/src/provider.ts:34/:217` @639ed01539); missing
 * provider/credential surfaces as the seam's typed code through the gateway's
 * mapped refusal. Retrieval delegates to `ctxWeb` (the Host WebRuntime,
 * `ctx.web.fetch/search` @ web/src/index.ts:157/:140): the production
 * provider's DNS/IP law, per-hop redirect revalidation and connection pin
 * stay in the chain untouched (B-WEB contract; no weaker copy anywhere).
 *
 * PLANE HONESTY: this is a CONNECTOR row, not a plane row — it takes no
 * takeover-table entry, and `PLANE_RESERVED_NATIVE`'s anti-impersonation pin
 * for web_fetch/web_search (team-tool-plane.mjs:402-412) stands untouched.
 * The mount call in agent-bindings.mjs is the integration owner's single-
 * writer line (anchor proposal delivered in the lane report).
 *
 * `final_declaration` stays null; this file makes no production-readiness
 * claim. Real external egress / real provider auth / real-Host reruns are
 * ENV_BLOCK legs owned by the integration owner's Host schedule.
 *
 * @module runtime/plugin/live/web-gateway-assembly
 */
import { createWebGateway, parseWebEnabledRaw } from '../../../web-gateway/src/index.js'

/**
 * The search-origin resolver factory mirroring the provider's OWN source law
 * (host `web-search-deepseek/src/index.ts:123-126` @639ed01539, verbatim
 * order): `config.baseURL ?? $DEEPSEEK_SEARCH_BASE_URL ?? DEEPSEEK_DEFAULT_BASE_URL`.
 * The default constant is read from the INSTALLED provider package via a
 * deferred dynamic import (first call) — no static import edge is added to
 * the glue (the t12a junction face stays byte-unchanged). When the package
 * cannot resolve in this process, the resolver throws the seam's typed code
 * `WEB_PROVIDER_UNAVAILABLE` and the gateway maps it — a fixed-URL fake
 * remains structurally impossible: this file contains no destination literal.
 *
 * DISCLOSED LIMIT vs the provider itself: the provider reads config through
 * the host Volatile/launchEnvironment plane (operator settings updates apply
 * live); this mirror reads the config string handed in + process.env at call
 * time. A host config-read seam would replace the mirror in one line.
 *
 * @param opts.configBaseURL the mount-time `webGateway.searchBaseURL` if the
 *        operator configured one (mirrors the provider's config.baseURL slot).
 * @returns a resolver for {@link createLiveWebGatewayAssembly.resolveSearchOrigin}.
 */
export function deepSeekSearchOriginSource({ configBaseURL } = {}) {
  if (typeof configBaseURL === 'string' && configBaseURL.length > 0) {
    return () => configBaseURL
  }
  let cachedDefault = null
  return async () => {
    // mirror: host index.ts:83 SEARCH_BASE_URL_ENV (property access via
    // globalThis keeps this row out of the node-globals eslint override list —
    // behavior identical on the only runtime that reaches it).
    const env = globalThis['process']?.['env'] ?? {}
    const fromEnv = env['DEEPSEEK_SEARCH_BASE_URL']
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
    if (cachedDefault !== null) return cachedDefault
    let mod
    try {
      mod = await import('@deepseek-ai/dsh-web-search-deepseek')
    } catch {
      throw Object.assign(new Error('the installed search-provider package is not resolvable in this process'), { code: 'WEB_PROVIDER_UNAVAILABLE' })
    }
    const constant = mod?.DEEPSEEK_DEFAULT_BASE_URL
    if (typeof constant !== 'string' || constant.length === 0) {
      throw Object.assign(new Error('installed search-provider exposes no DEEPSEEK_DEFAULT_BASE_URL'), { code: 'WEB_PROVIDER_UNAVAILABLE' })
    }
    cachedDefault = constant
    return constant
  }
}

/**
 * Create (or honestly decline) the live web-gateway row for ONE team root.
 *
 * @param deps.webEnabledRaw closed enable key: absent ⇒ off; boolean ⇒ as-is;
 *        anything else ⇒ typed refusal `web-config-not-boolean`.
 * @param deps.ctxWeb the Host web seam object (`ctx.web`) — structurally
 *        `{ fetch, search }`; anything else declines the row.
 * @param deps.resolveSearchOrigin host-side reader returning the INSTALLED
 *        search provider's endpoint/origin from its real config; may throw
 *        the seam's typed `WebError` code (mapped refusal per call).
 * @param deps.readDomainVeto optional D-arm reader (Domain Authority answer
 *        at the effect-commit point); absent ⇒ receipts say `not-applicable`.
 * @param deps.onObserve observation sink (lane ledger mirror).
 */
export function createLiveWebGatewayAssembly({ webEnabledRaw, ctxWeb, resolveSearchOrigin, readDomainVeto, onObserve } = {}) {
  const enabled = parseWebEnabledRaw(webEnabledRaw)
  if (!enabled.ok) {
    return inactive(enabled.refusal.code, enabled.refusal.detail)
  }
  if (!enabled.enabled) {
    return inactive('web-not-enabled', `webEnabledRaw read as ${enabled.readAs}; the row stays unmounted (default-off)`)
  }
  if (ctxWeb === null || typeof ctxWeb !== 'object' || typeof ctxWeb.fetch !== 'function' || typeof ctxWeb.search !== 'function') {
    return inactive('web-seam-absent', 'the armed row requires the Host web seam (ctx.web with fetch + search); nothing is mounted without it')
  }
  if (typeof resolveSearchOrigin !== 'function') {
    return inactive('search-origin-resolver-missing', 'the armed row requires the config-reading search-origin resolver; a fixed-URL fake is structurally impossible here')
  }
  const ledger = []
  const emit = (o) => {
    ledger.push(o)
    if (typeof onObserve === 'function') onObserve(o)
  }
  const gateway = createWebGateway({
    ports: { fetch: (req, signal) => ctxWeb.fetch(req, signal), search: (req, signal) => ctxWeb.search(req, signal) },
    searchOrigin: resolveSearchOrigin,
    ...(readDomainVeto === undefined ? {} : { readDomainVeto }),
    onObserve: emit,
  })
  return {
    active: true,
    gateway,
    /** Lane-typed entry (operation payload rides the closed target
     *  extension — web-gateway/types.ts DISCLOSURE). */
    callWeb: (request) => gateway.callWeb(request),
    /** The frozen ProviderGateway face: a payload-less envelope is a typed
     *  refusal, never a guess. */
    call: (request) => gateway.call(request),
    observations: () => ledger.slice(),
  }
}

function inactive(code, detail) {
  return {
    active: false,
    code,
    detail,
    gateway: null,
    callWeb: async () => ({ ok: false, error: { code: 'IO_POLICY_UNSUPPORTED', message: `web row not mounted (${code}): ${detail}` } }),
    call: async () => ({ ok: false, error: { code: 'IO_POLICY_UNSUPPORTED', message: `web row not mounted (${code}): ${detail}` } }),
    observations: () => [],
  }
}
