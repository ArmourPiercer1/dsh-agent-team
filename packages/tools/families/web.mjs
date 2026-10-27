/**
 * FamilyAssembly descriptor — the WEB family (u7-f, the FIRST network-effect
 * family: `web_fetch` + `web_search`).
 *
 * OPT-IN BY LAW — a network family must not be on by default. The single
 * closed boolean plane-config key `webEnabled` (ABSENT = FALSE) gates the
 * whole family, and the reasoning is recorded here where a reader of the
 * mount will find it: the host sandbox claims FILE effects only (u7
 * DECISION-3-ANSWER, verbatim limit: the bwrap profile carries no
 * `--unshare-net`, and the local Landlock ABI is partial — it predates the
 * TCP rules), so a family that puts bytes on the network is NOT contained
 * by the confinement every other family leans on. Its containment is
 * purely the Team authority chain (per-call PA over `tool-invoke +
 * connect`, one-shot grant, the closed mechanics bound). A capability
 * whose worst-case blast radius is the network must therefore ENTER by an
 * explicit, reviewed deployment decision — never by an upgrade that
 * silently adds it to every mount. This is the same zero-flip law the
 * jobs lane froze (`jobsEnabled`/`backgroundJobs`: ABSENT = byte-for-byte
 * unchanged mount), applied to the family with the widest reach so far.
 *
 * `disabledOwned` is DELIBERATELY empty, and that is a disclosed law
 * choice, not an oversight: with `webEnabled` absent/false the family
 * neither registers rows nor OWNS the native spellings, so
 * `web_fetch`/`web_search` stay exactly the host-native tools they are
 * today — a non-mount must never change what an existing world can do
 * (jobs zero-flip precedent). The fs lane's stronger disabled-ownership
 * (`disabledOwned: [readName]`, CI-05/REVIEW-R1 B2) arrived through its
 * own review ruling; extending that ruling to the web pair is a center
 * decision this PR does not sneak in. If the center rules the native
 * tools must not ride ungoverned beside a disabled web family, flipping
 * this one line (and the C1 leg that pins the zero-flip) is the whole
 * change. DISCLOSED in the PR body.
 *
 * FIXED NATIVE CLAIMS: `web_fetch`/`web_search` are claimed at their fixed
 * native spellings (fs `write`/`edit`/`read_image`, jobs `job_*` trio
 * precedent). Gate 0b validates only the FOUR configurable rows and its
 * takeover ledger lives inside the plane (zero-edit law), so this pair is
 * pinned instead by the reviewed family manifest (sha256) + the arc-A
 * census — disclosed limitation, stated in the PR body.
 *
 * THE TRANSPORT IS ONE INJECTED PORT. `backends(cap)` fills the shared
 * backend set with exactly three keys the plane carries opaquely:
 * `webTransport` (the ONE socket module — kit-seam override
 * `injected.webTransport` for C1 evidence), `webSearchPort` (bounded JSON
 * POST face over the same port; override `injected.webSearchPort`), and
 * `webSearchProvider` (the VALIDATED provider mount or null — the provider
 * arrives ONLY through `injected.webSearchProvider`, the same trusted
 * `input.backends` face the jobs producer uses in production; never a
 * model argument, never invented). A present-but-invalid provider REFUSES
 * THE MOUNT (fail closed); an absent provider is legal and the search row
 * answers typed `WEB_SEARCH_NO_PROVIDER` with zero network effect.
 *
 * @module tools/families/web
 */
import * as webMechanics from '../web-family/src/web-mechanics.mjs'
import * as webTransport from '../web-family/src/web-transport.mjs'
import * as webProviderLaw from '../web-family/src/web-search-provider.mjs'
import {
  createWebTransport,
  createWebTransportSearchPort,
  validateWebSearchProvider,
  createGovernedWebFetchExecutor,
  createGovernedWebSearchExecutor,
  buildFetchRowDefinition,
  buildSearchRowDefinition,
  buildWebFamilyContribution,
} from '../web-family/src/index.mjs'

const DEFAULT_WEB_FETCH_TIMEOUT_MS = 30_000
const DEFAULT_WEB_FETCH_MAX_BYTES = 512 * 1024
const DEFAULT_WEB_SEARCH_TIMEOUT_MS = 30_000
const DEFAULT_WEB_SEARCH_MAX_BYTES = 1024 * 1024
const MAX_BOUND_MS = 300_000
const MAX_BOUND_BYTES = 8 * 1024 * 1024

/** Trusted numeric bounds: the closed-boolean config law covers the GATES;
 *  the bounds ride the planeConfig under FIXED key names with strict
 *  validation here (present-but-malformed = a config defect, refused at
 *  build, never silently defaulted). Never model-visible, never derived
 *  from arguments. */
function readBound(raw, { name, fallback, max, kind }) {
  if (raw === undefined) return { ok: true, value: fallback }
  const valid = kind === 'bytes'
    ? Number.isInteger(raw) && raw > 0 && raw <= max
    : Number.isInteger(raw) && raw > 0 && raw <= max
  if (!valid) {
    return { ok: false, detail: `planeCfg.${name} must be an integer in 1..${String(max)} (${kind}); got ${JSON.stringify(raw) ?? String(raw)} — a malformed bound is a config defect, the mount is refused rather than silently defaulting` }
  }
  return { ok: true, value: raw }
}

export const familyAssembly = Object.freeze({
  schema: 'u7-family-assembly/1',
  familyId: 'dsh.web-family',
  order: 40,
  placement: 40,
  config: Object.freeze({ webEnabled: 'boolean' }),
  // OPT-IN: ABSENT = FALSE = the family does not exist on this mount
  // (zero-flip law — see the header). A non-boolean value is refused at
  // the seam's config check (PLANE_CONFIG_INCOMPLETE), never coerced.
  enabled: (cap) => cap.planeConfig.webEnabled === true,
  // Fixed native spellings (takeover law § CI-04; header for the manifest
  // law that pins them). Both rows mount together or the family refuses.
  claims: () => ['web_fetch', 'web_search'],
  disabledOwned: () => [],
  backends(cap) {
    // The mount's scheme opt, read with the SAME strict truthiness the
    // build-time validation enforces (a non-boolean is refused at build
    // before any row exists; here it simply means "not opted in").
    const httpLoopbackAllowed = cap.planeConfig.webAllowHttpLoopback === true
    const transport = cap.injected.webTransport ?? createWebTransport({ allowHttpLoopback: httpLoopbackAllowed })
    const searchPort = cap.injected.webSearchPort ?? createWebTransportSearchPort(transport, { allowHttpLoopback: httpLoopbackAllowed })
    const providerMount = cap.injected.webSearchProvider === undefined || cap.injected.webSearchProvider === null
      ? { ok: true, provider: null, destinations: [] }
      : validateWebSearchProvider(cap.injected.webSearchProvider, { allowHttpLoopback: httpLoopbackAllowed })
    return {
      webTransport: transport,
      webSearchPort: searchPort,
      webSearchProviderMount: providerMount,
    }
  },
  build(cap) {
    const mount = cap.backends.webSearchProviderMount
    if (mount?.ok !== true) {
      return {
        refused: {
          code: 'PLANE_WEB_PROVIDER_REFUSED',
          message: `the mounted web_search provider was refused: ${String(mount?.detail ?? 'invalid')} (fail closed — a present-but-broken provider never half-mounts)`,
        },
      }
    }
    const planeCfg = cap.planeConfig
    const bounds = [
      readBound(planeCfg.webFetchTimeoutMs, { name: 'webFetchTimeoutMs', fallback: DEFAULT_WEB_FETCH_TIMEOUT_MS, max: MAX_BOUND_MS, kind: 'ms' }),
      readBound(planeCfg.webFetchMaxBytes, { name: 'webFetchMaxBytes', fallback: DEFAULT_WEB_FETCH_MAX_BYTES, max: MAX_BOUND_BYTES, kind: 'bytes' }),
      readBound(planeCfg.webSearchTimeoutMs, { name: 'webSearchTimeoutMs', fallback: DEFAULT_WEB_SEARCH_TIMEOUT_MS, max: MAX_BOUND_MS, kind: 'ms' }),
      readBound(planeCfg.webSearchMaxBytes, { name: 'webSearchMaxBytes', fallback: DEFAULT_WEB_SEARCH_MAX_BYTES, max: MAX_BOUND_BYTES, kind: 'bytes' }),
    ]
    const bad = bounds.find((b) => b.ok !== true)
    if (bad !== undefined) return { refused: { code: 'PLANE_WEB_BOUND_REFUSED', message: bad.detail } }
    const [fetchTimeout, fetchMaxBytes, searchTimeout, searchMaxBytes] = bounds.map((b) => b.value)
    // The trusted scheme policy of the mount. The http-loopback opt rides
    // a FIXED planeCfg key with strict boolean validation (config law:
    // gates are booleans; anything else is a defect — refused).
    const httpLoopbackRaw = planeCfg.webAllowHttpLoopback
    if (httpLoopbackRaw !== undefined && typeof httpLoopbackRaw !== 'boolean') {
      return {
        refused: {
          code: 'PLANE_WEB_BOUND_REFUSED',
          message: `planeCfg.webAllowHttpLoopback must be a boolean when present — got ${JSON.stringify(httpLoopbackRaw) ?? String(httpLoopbackRaw)} (a non-boolean gate is a config defect: the mount is refused rather than silently defaulting)`,
        },
      }
    }
    const httpLoopbackAllowed = httpLoopbackRaw === true
    const allowedSchemes = httpLoopbackAllowed
      ? Object.freeze([...webMechanics.DEFAULT_ALLOWED_SCHEMES, 'http'])
      : webMechanics.DEFAULT_ALLOWED_SCHEMES
    const provider = mount.provider
    const destinations = mount.destinations ?? []

    const fetchExecutor = createGovernedWebFetchExecutor({
      realmId: cap.realmId,
      policy: cap.permissionPolicy,
      decide: cap.decide,
      pa: cap.pa,
      transport: cap.backends.webTransport,
      allowedSchemes,
      httpLoopbackAllowed,
      maxBytes: fetchMaxBytes,
      timeoutMs: fetchTimeout,
      observe: cap.logBackend('web-fetch'),
    })
    const searchExecutor = createGovernedWebSearchExecutor({
      realmId: cap.realmId,
      policy: cap.permissionPolicy,
      decide: cap.decide,
      pa: cap.pa,
      ...(provider === null ? {} : { provider }),
      destinations,
      searchPort: cap.backends.webSearchPort,
      maxBytes: searchMaxBytes,
      timeoutMs: searchTimeout,
      observe: cap.logBackend('web-search'),
    })
    const fetchRowDef = buildFetchRowDefinition({ name: 'web_fetch', fetchExecutor })
    const searchRowDef = buildSearchRowDefinition({ name: 'web_search', searchExecutor })
    const contribution = buildWebFamilyContribution({
      fetch: { definition: fetchRowDef, executorFactory: createGovernedWebFetchExecutor },
      search: { definition: searchRowDef, executorFactory: createGovernedWebSearchExecutor },
      mechanics: webMechanics,
      transport: webTransport,
      providerLaw: webProviderLaw,
      destinations,
      bound: { allowedSchemes, httpLoopbackAllowed, maxBytes: fetchMaxBytes, timeoutMs: fetchTimeout },
      cancelBoundary: 'the governed web bodies never outlive the host abort signal: the transport socket is destroyed on abort at every hop, a cancel landing at the PA edge consumes nothing, and a settled execution token replaying into the row drives the PA edge with a pre-aborted signal (cancelled fact, grant never re-spent, wire never moves again for that token) — fetch-executor.mjs / search-executor.mjs token ledgers, u7-f',
    })
    return {
      definitions: [fetchRowDef, searchRowDef],
      contribution,
      diagnostics: { web_fetch: fetchExecutor, web_search: searchExecutor },
    }
  },
  refusalCode: 'PLANE_WEB_REGISTRATION_REFUSED',
})
