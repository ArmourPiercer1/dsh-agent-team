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
 * APPROVAL (ROOT 07:38 GROUP 3 + ROOT 08:4x C2): the armed row REQUIRES BOTH
 * `grantAuthority` (center-edge consume port) AND `factsSource` (center-edge
 * ledger capture: correlation ids → trusted call facts — full effects set,
 * generations, member/call identity). The presented grant/binding documents
 * never travel into the judgement path. This row owns NO approval logic; a
 * missing port is a typed decline, never a permissive default.
 *
 * LIFECYCLE (ROOT 07:38 GROUP 5 + ROOT 08:4x C3): ONE closed state covers
 * EVERY exported reference — the row exports NO raw gateway object (the
 * pre-fix counterexample c123-before C3 showed an exported raw handle
 * transacting after close); the GATEWAY ITSELF consults the lifecycle on
 * entry and after every await (web-gateway/index.ts LIFECYCLE LAW). Cancellation
 * travels per call as `callWeb(request, { signal })`; `close()` additionally
 * ABORTS the row signal, which the gateway merges into every seam call, so
 * in-flight transport is DRAINED (the provider sees abort; the call settles
 * cancelled — never a silent continue). Cancellation is checked BEFORE the
 * consume boundary ⇒ zero consume (cancel-first, measured in-spec). The
 * closed flag is one-way; a dropped Map entry in the entry's close() is NOT
 * a stop: the row itself must be dead.
 *
 * PROVIDER TRUTH: this row ships no destination constant and selects no
 * provider. Retrieval delegates to `ctxWeb` (the Host WebRuntime,
 * `ctx.web.fetch/search` @ web/src/index.ts:140/:157); provider SELECTION is
 * the seam's own call-time law (resolveProvider, web/src/index.ts:137-164)
 * and is never mirrored here. The search arm's origin comes from a TRUSTED
 * reader built by `boundSearchOriginSource` (root 07:38 group 4): every
 * source is injected by the entry — this file reads no env itself.
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
 * GROUP 4 (root 07:38): build the search-origin resolver as a binder over
 * the provider's OWN source law (host web-search-deepseek/src/index.ts:
 * 123-126 @639ed01539, verbatim order) using ONLY readers the entry injects
 * from the real plane:
 *   readConfig()      → the live Volatile config slot `baseURL` (the same
 *                       `z.string().volatile()` slot the provider consumes,
 *                       settings namespace `WEB_SEARCH_DEEPSEEK_SETTINGS_
 *                       NAMESPACE`, host index.ts:72/:89)
 *   readLaunchEnv(k)  → the launchEnvironment read the provider itself uses
 *                       (SEARCH_BASE_URL_ENV, host index.ts:83)
 *   packageDefault()  → the INSTALLED package constant
 *                       DEEPSEEK_DEFAULT_BASE_URL (exported, provider.ts:34)
 * Evaluation happens per call (live config applies immediately, matching
 * the provider's Volatile behavior). No reader may be a Team-side mirror:
 * absent required readers make the resolver throw the seam's typed
 * `WEB_PROVIDER_UNAVAILABLE` code — a fixed-URL fake stays structurally
 * impossible (this file contains no destination literal).
 *
 * @param src.readConfig (async ok) () => string | undefined
 * @param src.readLaunchEnv (async ok) (key: string) => string | undefined
 * @param src.packageDefault (async ok) () => string
 */
export function boundSearchOriginSource({ readConfig, readLaunchEnv, packageDefault } = {}) {
  return async () => {
    if (typeof readConfig !== 'function' || typeof readLaunchEnv !== 'function' || typeof packageDefault !== 'function') {
      throw Object.assign(new Error('boundSearchOriginSource requires all three real-plane readers (readConfig/readLaunchEnv/packageDefault) injected by the entry'), { code: 'WEB_PROVIDER_UNAVAILABLE' })
    }
    const fromConfig = await readConfig()
    if (typeof fromConfig === 'string' && fromConfig.length > 0) return fromConfig
    const fromEnv = await readLaunchEnv('DEEPSEEK_SEARCH_BASE_URL')
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
    const constant = await packageDefault()
    if (typeof constant !== 'string' || constant.length === 0) {
      throw Object.assign(new Error('the installed search-provider exposes no DEEPSEEK_DEFAULT_BASE_URL'), { code: 'WEB_PROVIDER_UNAVAILABLE' })
    }
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
 * @param deps.grantAuthority the center-edge approval port (GROUP 3;
 *        ONE consume per call). Missing ⇒ typed decline.
 * @param deps.factsSource the center-edge ledger capture port (C2:
 *        correlation ids → trusted facts). Missing ⇒ typed decline.
 * @param deps.resolveSearchOrigin trusted reader (see
 *        {@link boundSearchOriginSource}); may throw the seam's typed
 *        `WebError` code (mapped refusal per call).
 * @param deps.readDomainVeto optional D-arm reader (Domain Authority answer
 *        at the effect-commit point); absent ⇒ receipts say `not-applicable`.
 * @param deps.onObserve observation sink (lane ledger mirror).
 */
export function createLiveWebGatewayAssembly({ webEnabledRaw, ctxWeb, grantAuthority, factsSource, resolveSearchOrigin, readDomainVeto, onObserve } = {}) {
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
  if (grantAuthority === null || typeof grantAuthority !== 'object' || typeof grantAuthority.consume !== 'function') {
    return inactive('web-grant-authority-absent', 'the armed row requires the center-edge grant authority (M1 manifest + trusted definition provider + ONE consume); this row owns no approval and never defaults one open')
  }
  if (factsSource === null || typeof factsSource !== 'object' || typeof factsSource.capture !== 'function') {
    return inactive('web-facts-source-absent', 'the armed row requires the center-edge facts capture port (C2: trusted call facts judged INSTEAD of the presented grant documents); this row cannot mint facts and never fabricates stand-ins')
  }
  if (typeof resolveSearchOrigin !== 'function') {
    return inactive('search-origin-resolver-missing', 'the armed row requires the config-bound search-origin resolver; a fixed-URL fake is structurally impossible here')
  }
  const ledger = []
  let closed = false
  // node-globals discipline (live/ eslint env carries no node globals — the
  // lane precedent is agent-bindings.mjs reaching process off globalThis):
  // reach the ctor off globalThis.
  const rowAbort = new globalThis['AbortController']()
  // C3: THE one closed/abort state — consulted by the gateway itself (entry
  // + after every await), merged into every seam call, aborted by close().
  const lifecycle = { isClosed: () => closed, signal: rowAbort.signal }
  const emit = (o) => {
    ledger.push(o)
    if (typeof onObserve === 'function') onObserve(o)
  }
  const gateway = createWebGateway({
    ports: { fetch: (req, signal) => ctxWeb.fetch(req, signal), search: (req, signal) => ctxWeb.search(req, signal) },
    searchOrigin: resolveSearchOrigin,
    authority: grantAuthority,
    factsSource,
    lifecycle,
    ...(readDomainVeto === undefined ? {} : { readDomainVeto }),
    onObserve: emit,
  })
  const closedRefusal = async () => ({ ok: false, error: { code: 'IO_POLICY_UNSUPPORTED', message: 'web-row-closed: this row was closed by the owning entry; stale handles cannot transact (zero delegation after close)', sideEffectUnknown: false } })
  return {
    active: true,
    // C3: NO raw `gateway` reference is exported — the two faces below and
    // the gateway's own lifecycle checks are the only ways in.
    /** Lane-typed entry (operation payload rides the closed target
     *  extension — web-gateway/types.ts DISCLOSURE; `{ signal }` threads
     *  cancellation to the seam — GROUP 5; merged with the row abort). */
    callWeb: (request, options) => closed ? closedRefusal() : gateway.callWeb(request, options),
    /** The frozen ProviderGateway face: a payload-less envelope is a typed
     *  refusal, never a guess. No signal channel exists on this face. */
    call: (request) => closed ? closedRefusal() : gateway.call(request),
    /** C3: genuine de-arm. One-way; idempotent; ALSO aborts the row signal,
     *  draining in-flight seam transport (merged into every live call —
     *  those settle cancelled, never silently continue). */
    close: () => {
      if (!closed) {
        closed = true
        rowAbort.abort(new Error('web-row-closed: closed by the owning entry (in-flight transport drained)'))
        emit({ event: 'row-closed' })
      }
      return closed
    },
    closed: () => closed,
    observations: () => ledger.slice(),
  }
}

function inactive(code, detail) {
  return {
    active: false,
    code,
    detail,
    callWeb: async () => ({ ok: false, error: { code: 'IO_POLICY_UNSUPPORTED', message: `web row not mounted (${code}): ${detail}`, sideEffectUnknown: false } }),
    call: async () => ({ ok: false, error: { code: 'IO_POLICY_UNSUPPORTED', message: `web row not mounted (${code}): ${detail}`, sideEffectUnknown: false } }),
    close: () => true,
    closed: () => true,
    observations: () => [],
  }
}
