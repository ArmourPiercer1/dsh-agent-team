/**
 * a5sf-web-contract-world.mjs — the layer-B world of the confined `web` face.
 *
 * NOT a second harness. It reuses the ONE BL-18 harness
 * (`lib/a5sf-web-arms.mjs`: `loadWebSeams`, the shipped `effectiveOf` lane
 * compiler call, `makeGovernedRealm`, `mountToolWeb`, `drive`, `textOf`) and
 * adds exactly the two things layer B needs and layer A never did:
 *
 *   1. {@link contractBoundary} — a fetch/search provider that records the
 *      GUARD/PROVIDER EDGE: how many guard facts existed at the instant it was
 *      entered, the exact argument list and object it received, the ambient
 *      proxy environment it inherited, and every URL a real socket would have
 *      been opened for (including a redirect hop the provider follows itself).
 *      It is still a fake transport — no socket, no DNS, no egress.
 *   2. {@link makeRowWorld} — the PRODUCT ROW topology
 *      (`mountMemberA5sfRealm` + `a5sfRealmConfigOf`) for the composition
 *      property (`a5sfWebFace` vs the compiled `web`), so the ambiguity refusal
 *      is measured at the authoring seam, not at the face.
 *
 * WHAT THIS HARNESS DOES NOT DO: it never evaluates a lane, never compiles a
 * policy, never probes a backend, and never decides a permission. `effective`
 * is produced by the ONE compiler (`effectiveOf`), the probe is the product's
 * own `probeNetworkDenial`, and the row module is the shipped one.
 *
 * @module tests/world-factory/lib/a5sf-web-contract-world
 */

import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot, testUseTree } from '../../paths.mjs'
import {
  WEB_IDENTITY,
  effectiveOf,
  loadWebSeams,
  makeBaseFsClass,
  makeGovernedRealm,
  makeHostWebTripwire,
} from './a5sf-web-arms.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const CONTRACT_REPO = resolve(HERE, '..', '..', '..')

/** The redirect target the provider follows INTERNALLY on the P3 hop arm. */
export const REDIRECT_TARGET = 'https://cdn.example.test/moved/page'

/**
 * The two pinned entries this suite imports (both build outputs of the pinned
 * checkout; `tests/paths.mjs` is the only source of that path). A partial
 * checkout is an incomplete pin, not an absence — see the two states the face
 * README declares.
 */
export function contractHostState(repoRoot = CONTRACT_REPO) {
  // `A5SF_WEB_CONTRACT_HOST_ROOT` exists ONLY to exercise the absent/incomplete
  // states of §10 without moving the pinned checkout. Product code never reads
  // it; a lane that must provision the host sets `A5SF_REQUIRE_PINNED_HOST=1`.
  const override = process.env.A5SF_WEB_CONTRACT_HOST_ROOT
  const pristine = override !== undefined && override !== ''
    ? override
    : testUseTree(findTestRepoRoot(repoRoot) ?? repoRoot)
  const entries = [
    'packages/web/web/lib/index.js',
    'packages/web/tool-web/lib/index.js',
  ]
  const missing = entries.filter((rel) => !existsSync(join(pristine, rel)))
  return {
    pristine,
    entries,
    missing,
    ok: missing.length === 0,
    reason: missing.length === 0
      ? undefined
      : `the pinned host checkout is absent or incomplete (missing ${missing.join(', ')} under ${pristine})`,
  }
}

/**
 * A boundary that records the EDGE. Every counter is the fake transport's own
 * bookkeeping — the same convention the BL-18 harness uses — so "the provider
 * was entered" is a measurement, and "the guard had already run" is
 * `factsAtEntry`.
 *
 * `redirectTo` makes the provider follow ONE redirect INSIDE itself, exactly as
 * the host fetch provider follows same-origin redirects under its own hop cap:
 * two transport hops, one provider call, one guard consultation. That is the
 * position the P3 residual names.
 */
export function contractBoundary({
  probeLevel = 'unsupported',
  body = 'WEB-CONTRACT-BODY',
  redirectTo = null,
} = {}) {
  const fetches = []
  const searches = []
  /** Every URL a real connection would have been opened for, in order. */
  const transport = []
  const state = { dnsLookups: 0, connects: 0, proxyLookups: 0, probeCalls: 0 }
  let readFacts = () => []

  const boundary = {
    fetches,
    searches,
    transport,
    state,
    /** The response object handed back to the caller (identity is asserted). */
    lastResponse: null,
    get probeCalls() {
      return state.probeCalls
    },
    get dnsLookups() {
      return state.dnsLookups
    },
    get connects() {
      return state.connects
    },
    get proxyLookups() {
      return state.proxyLookups
    },
    /** Bind the live guard-fact array so the provider can time-stamp its entry. */
    bindFacts(reader) {
      readFacts = reader
      return boundary
    },
    async fetch(request, signal) {
      fetches.push({
        request,
        // The face calls `provider.fetch(request, signal)` — the argument LIST is
        // part of the position: a third argument would be a mediator.
        argCount: arguments.length,
        signalIsAbort: signal instanceof AbortSignal,
        keys: request !== null && typeof request === 'object' ? Object.keys(request) : [],
        url: typeof request?.url === 'string' ? request.url : null,
        factsAtEntry: readFacts().length,
        httpProxy: process.env.HTTP_PROXY ?? null,
        httpsProxy: process.env.HTTPS_PROXY ?? null,
        noProxy: process.env.NO_PROXY ?? null,
      })
      transport.push(request?.url)
      // The provider resolves ITS own proxy route and opens ITS own connections.
      state.proxyLookups += 1
      state.dnsLookups += 1
      state.connects += 1
      let finalUrl = request?.url
      if (redirectTo !== null) {
        // The redirect: a SECOND hop the provider takes before it answers.
        finalUrl = redirectTo
        transport.push(redirectTo)
        state.dnsLookups += 1
        state.connects += 1
      }
      boundary.lastResponse = { url: finalUrl, statusCode: 200, body: { kind: 'text', content: body }, truncated: false }
      return boundary.lastResponse
    },
    async search(request, signal) {
      searches.push({
        request,
        argCount: arguments.length,
        signalIsAbort: signal instanceof AbortSignal,
        keys: request !== null && typeof request === 'object' ? Object.keys(request) : [],
        query: typeof request?.query === 'string' ? request.query : null,
        factsAtEntry: readFacts().length,
      })
      transport.push(`search:${String(request?.query ?? '')}`)
      state.dnsLookups += 1
      state.connects += 1
      state.proxyLookups += 1
      return { content: `search:${JSON.stringify(request?.query ?? null)}`, sources: [], truncated: false }
    },
  }
  if (probeLevel !== 'absent') {
    boundary.probe = async () => {
      state.probeCalls += 1
      return {
        ok: true,
        value: [
          {
            dimension: 'network-destination',
            level: probeLevel,
            note: `contract boundary probe: network-destination=${probeLevel}`,
          },
        ],
      }
    }
  }
  return boundary
}

const SEAMS = new Map()

/** The SAME seam loader the BL-18 harness uses (one pinned import per process). */
export async function contractSeams(repoRoot = CONTRACT_REPO) {
  if (!SEAMS.has(repoRoot)) SEAMS.set(repoRoot, await loadWebSeams(repoRoot))
  return SEAMS.get(repoRoot)
}

/**
 * One governed world on the PRODUCT route (`mountA5sfRealm` + the real hosted
 * `web` base class + the real pinned `tool-web` module mounted through the
 * realm's own route-C seam), with the contract boundary.
 */
export async function makeContractWorld(seams, options = {}) {
  const boundary = options.boundary ?? contractBoundary(options)
  const world = await makeGovernedRealm(seams, { ...options, boundary })
  boundary.bindFacts(() => world.facts)
  world.boundary = boundary
  return world
}

// ---------------------------------------------------------------------------
// The PRODUCT ROW topology (composition property P5)
// ---------------------------------------------------------------------------

let ROW_MODULE
let SCOPE_MODULE

async function rowModules(repoRoot = CONTRACT_REPO) {
  if (ROW_MODULE === undefined) {
    const require = (await import('node:module')).createRequire(join(repoRoot, 'packages/runtime/package.json'))
    ROW_MODULE = await import(
      pathToFileURL(join(repoRoot, 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs')).href
    )
    SCOPE_MODULE = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-scope')).href)
  }
  return { row: ROW_MODULE, scope: SCOPE_MODULE }
}

/** The compiled Member ceiling under the fixed contract identity. */
function rowMemberPolicy(network) {
  const lane = { mode: 'restricted', allow: ['/tmp'], ask: [], deny: [] }
  return Object.freeze({
    memberIdentity: WEB_IDENTITY.memberInstanceId,
    templateId: WEB_IDENTITY.templateId,
    instanceGeneration: WEB_IDENTITY.instanceGeneration,
    revision: 'rev-web-contract',
    read: Object.freeze({ ...lane, allow: Object.freeze([...lane.allow]) }),
    write: Object.freeze({ ...lane, allow: Object.freeze([...lane.allow]) }),
    network: Object.freeze({ access: network }),
  })
}

/**
 * A composition module the row's `a5sfWebFace` key can name. It is the SHAPE
 * the row validates (`{ effective, provider }`); the lane comes from the
 * compiled effective the test passes through `config`, so this module never
 * compiles or decides anything.
 */
export function writeContractFaceFactory(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-web-contract-${label}-`))
  const file = join(dir, 'web-face.mjs')
  writeFileSync(file, `
export function createConfinedWebFace({ config }) {
  return { effective: config.effective, provider: config.provider, realmId: 'realm-web-contract' }
}
`)
  return { file, url: pathToFileURL(file).href, dir }
}

/**
 * The PRODUCT ROW world: a standing root with the base `fs` and an INHERITED
 * host `web` TRIPWIRE, then the row's own `mountMemberA5sfRealm`. No tool
 * module is attached: P5 is about the authoring seam, and the mounted face is
 * exercised directly through the surface the product reports (`faces.web`).
 *
 * `compiledWeb` and `configWebFace` are the TWO web-face sources. Supplying
 * both is the ambiguity the property pins.
 */
export async function makeRowWorld(seams, {
  network = 'allow',
  compiledWeb,
  configWebFace,
  evidencePath,
  boundary = contractBoundary({ probeLevel: 'unsupported' }),
} = {}) {
  const { row } = await rowModules()
  const BaseFs = makeBaseFsClass(seams.Service)
  const HostWeb = makeHostWebTripwire(seams.Service)
  HostWeb.calls = 0
  const root = new seams.Context()
  await root.plugin(seams.SystemPrompt)
  await root.plugin(seams.ToolRuntime)
  await root.plugin(HostWeb, {})
  await root.plugin(BaseFs, {})
  const agentKey = { session: { header: {} } }
  const agent = seams.createScope(root, agentKey)

  const config = {
    ...(evidencePath === undefined ? {} : { a5sfEvidencePath: evidencePath }),
    ...(configWebFace === undefined ? {} : { a5sfWebFace: configWebFace }),
  }
  const face = compiledWeb === undefined
    ? undefined
    : { effective: effectiveOf(seams, { network }), provider: boundary, realmId: 'realm-web-contract', ...compiledWeb }

  let realm
  let error
  try {
    realm = await row.mountMemberA5sfRealm({
      root: agent.ctx,
      a5sfConfig: row.a5sfRealmConfigOf(config),
      provider: () => ({
        compiledFor: () => ({
          members: [{ identity: WEB_IDENTITY, policy: { ok: true, value: rowMemberPolicy(network) } }],
          providerClass: BaseFs,
          ...(face === undefined ? {} : { web: face }),
        }),
      }),
      member: {
        sessionId: 'session-web-contract',
        instanceId: WEB_IDENTITY.memberInstanceId,
        teamRootSessionId: 'team-root-web-contract',
        templateId: WEB_IDENTITY.templateId,
      },
    })
  } catch (caught) {
    error = caught
  }
  return { root, agentKey, agentCtx: agent.ctx, realm, error, boundary, HostWeb, seams, row }
}
