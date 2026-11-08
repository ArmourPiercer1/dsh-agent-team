/**
 * confined-web-tool.mjs — the model-visible `web_fetch`/`web_search` pair,
 * served by the Member's CONFINED `web` face (or refused, typed, when there is
 * no confined face on this scope).
 *
 * WHY THIS EXISTS (PD-27, 2026-11-14; the row PD-18 opened). PD-18 removed
 * `tool-web` from the opt-in governed preset because the preset row resolved the
 * INHERITED host `ctx.web` — the real HTTP provider and the process-wide proxy
 * dispatcher — with ZERO `a5sf-guard-consult` facts. Its removal note named the
 * reason the row could not simply be routed: "the web face needs a
 * composition-owned transport (the shipped layer has none...)". The face itself
 * was already shipped (`team-services/src/web.ts`, BL-18/PD-15): a subclass of
 * the host's own `web` class, mounted on the Member's isolated scope, whose
 * `fetch`/`search` consult the compiled `network` axis and then delegate to the
 * composition-injected transport.
 *
 * WHAT THIS MODULE CONTRIBUTES IS A CONTEXT, NOT A TOOL IMPLEMENTATION. The two
 * definitions are the pinned host package's OWN (`@deepseek-ai/dsh-tool-web`,
 * delegated through its public `apply`), so names, descriptions, parameter and
 * output schemas, render, presentation, `timeoutMs` and `isConcurrencySafe` are
 * byte-identical to what the standard preset serves — there is no second copy
 * to drift. What differs is WHICH `web` service the bodies execute against:
 *
 *   CONFINED SCOPE (the realm's route-C attach): `ctx.web` is the Member's
 *   confined face, so every call is admitted/refused by the compiled lane (one
 *   `a5sf-guard-consult/1` fact per call) BEFORE the composition's transport is
 *   entered. An admitted call is ordinary host egress through that transport; a
 *   refused call never reaches it.
 *
 *   ANY OTHER SCOPE (the preset row itself): `ctx.web` is not a confined face —
 *   it is the inherited base provider, exactly the surface PD-18 measured — so
 *   the SAME host definitions are registered over a REFUSING `web` view. The
 *   name stays on the model-visible surface (the route-C attach is
 *   surface-neutral: it may replace a definition, never add or remove a name),
 *   and an unshadowed call is a typed `NETWORK_UNCONFINED_REALM` refusal with
 *   zero provider entries rather than silent ungoverned egress.
 *
 * WHAT THE MARKER IS. `ctx.web` cannot be identified by duck typing: the base
 * provider and the confined face expose the same `fetch`/`search`. The confined
 * class therefore carries `Symbol.for('a5sf.confined.web.face') === true` on its
 * prototype (`createConfinedWebClass`), and this module trusts ONLY that marker.
 * The symbol is a registry symbol spelled identically on both sides, so the two
 * files need no import edge (the .mjs modules are copied verbatim into the dist
 * mirror, where a relative import of the TypeScript source would not resolve).
 *
 * WHAT THIS DOES NOT DO: it does not decide a permission (the ONE compiler's
 * `network` axis does), does not hold a transport (the composition injects it),
 * does not add a second policy source, and does not touch upstream code
 * (CORE PATCH BUDGET = 0).
 *
 * @module @dsh-agent-team/runtime/plugin/live/confined-web-tool
 */
import {
  apply as applyHostWebTools,
  DEFAULT_FETCH_MAX_OUTPUT_CHARS,
  DEFAULT_WEB_TOOL_TIMEOUT_MS,
  WEB_SEARCH_MAX_QUERIES,
  WEB_SEARCH_MAX_RESULTS,
} from '@deepseek-ai/dsh-tool-web'

export const name = 'a5sf-confined-web'

/**
 * The marker `createConfinedWebClass` puts on the confined `web` class. It is a
 * GLOBAL registry symbol: the TypeScript face and this module are built into
 * different trees (the .mjs file is copied, not compiled), so an import edge
 * would not survive the dist mirror. Both sides spell this string; the
 * host-free parity test asserts they agree.
 */
export const A5SF_CONFINED_WEB_MARK = Symbol.for('a5sf.confined.web.face')

/** The two model-visible names this module can place (the shipped spellings). */
export const A5SF_CONFINED_WEB_TOOLS = Object.freeze(['web_fetch', 'web_search'])

/**
 * Services used. `web` IS declared: the realm isolates the service
 * (`root.isolate('web', …)`), and Cordis refuses an UNDECLARED access to an
 * isolated service ("cannot get property web without inject"). Declaring it is
 * also what makes the preset row register at all — the base deployment always
 * provides a `web` service, so the NAME is visible on every governed Member; a
 * deployment that provides none registers nothing and is fail-closed by
 * absence.
 */
export const inject = ['tools', 'web', 'systemPrompt']

/**
 * The row/preset config, resolved to the HOST's own exported defaults.
 *
 * Every default is imported from `@deepseek-ai/dsh-tool-web` so a composition
 * that configures nothing gets the shipped numbers rather than a second,
 * quietly different set. The host's `apply` performs the validation
 * (`assertPositiveInteger` over the same five fields), so this resolver adds no
 * rule of its own — it only fills the defaults schemastery would have filled.
 *
 * @param {unknown} raw - the module config.
 * @returns {object} a complete host `Config`.
 */
export function webToolConfigOf(raw) {
  const config = raw === undefined || raw === null ? {} : raw
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('a5sf-confined-web: config must be an object when present')
  }
  const pick = (key, fallback) => (config[key] === undefined ? fallback : config[key])
  return Object.freeze({
    search: pick('search', true),
    fetch: pick('fetch', true),
    searchMaxResults: pick('searchMaxResults', WEB_SEARCH_MAX_RESULTS),
    searchMaxQueries: pick('searchMaxQueries', WEB_SEARCH_MAX_QUERIES),
    fetchTimeoutMs: pick('fetchTimeoutMs', DEFAULT_WEB_TOOL_TIMEOUT_MS),
    searchTimeoutMs: pick('searchTimeoutMs', DEFAULT_WEB_TOOL_TIMEOUT_MS),
    fetchMaxOutputChars: pick('fetchMaxOutputChars', DEFAULT_FETCH_MAX_OUTPUT_CHARS),
  })
}

/**
 * Whether `service` is a confined web face. ONLY the marker counts: a provider
 * that merely looks like one (same method names) is not one, and `undefined`
 * (no `web` service at all) is not one either.
 *
 * @param {unknown} service - the value of `ctx.web`.
 * @returns {boolean} true only for the realm-mounted confined face.
 */
export function isConfinedWebFace(service) {
  if (service === null || typeof service !== 'object' && typeof service !== 'function') return false
  return service[A5SF_CONFINED_WEB_MARK] === true
}

/**
 * A `web` view that REFUSES every call with the typed
 * `NETWORK_UNCONFINED_REALM`. This is the preset-scope answer: the definitions
 * are the host's, the name is visible, and no byte leaves the process.
 *
 * The message names the capability (this scope has no confined face) and keeps
 * the typed code in the model-visible text, so "refused" cannot be misread as a
 * transport failure.
 *
 * @returns {{fetch: () => Promise<never>, search: () => Promise<never>}} the view.
 */
export function refusingWebOf() {
  const refuse = async () => {
    const error = new Error(
      'NETWORK_UNCONFINED_REALM: this scope\'s `web` service is not the Member\'s confined web face, so the call '
      + 'would run on the inherited base provider with no compiled-lane decision and no guard fact; refusing before '
      + 'any provider call instead. A governed Member serves this pair from the realm\'s confined `web` face (the '
      + 'route-C attach), and a composition that mounts no such face keeps this name fail-closed',
    )
    error.code = 'NETWORK_UNCONFINED_REALM'
    throw error
  }
  return Object.freeze({ fetch: refuse, search: refuse })
}

/**
 * A view of `at` whose `web` member is REPLACED by `web`, every other member
 * falling through to the real context. A Proxy (not a hand-written object) so a
 * host revision that touches another context member cannot be silently dropped:
 * unknown members still reach the real context instead of reading `undefined`.
 *
 * @param {object} at - the Cordis context the definitions register on.
 * @param {object} web - the refusing `web` view.
 * @returns {object} the view.
 */
function baseWebView(at, web) {
  return new Proxy(at, {
    get(target, prop) {
      if (prop === 'web') return web
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

/**
 * Register the pair. On a scope whose `web` is the Member's confined face the
 * host definitions are registered over the REAL context (so their bodies ride
 * the confined face); on any other scope they are registered over a refusing
 * `web` view.
 *
 * @param {object} ctx - the plugin context (preset scope, or the Member realm's
 *   isolated scope under the route-C attach).
 * @param {unknown} [config] - the module config (host `Config` shape).
 */
export function apply(ctx, config) {
  const resolved = webToolConfigOf(config)
  // MUTATION (PD-27 control only): the PD-18 regression — no marker check,
  // whatever `ctx.web` this scope was handed is used as if it were confined.
  const target = ctx
  applyHostWebTools(target, resolved)
}
