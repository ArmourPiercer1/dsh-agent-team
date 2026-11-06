/**
 * a5sf-web-arms.mjs — the host-free harness of the BL-18 (P2-05) backend round:
 * the confined `web` face's network admission, its pre-provider refusal, the
 * composition-time unconfined-realm refusal and the ordinary host fetch.
 *
 * WHAT THIS IS. NOT a second policy compiler and NOT a second guard:
 *
 *   effective lane   the ONE compiler (`compileEffectiveIo`) over a member
 *                    ceiling and a tool restriction, exactly as P1-02 ships;
 *   lane decision    the face's own `effective.network.access` read + the SAME
 *                    `TeamIoDenial` + `observeGuard` chain the `fs`/`subprocess`
 *                    faces use (facts on the one `a5sf-guard-consult/1` sink);
 *   capability       BL-17's `probeNetworkDenial`, imported by the face — this
 *                    harness only supplies a carrier, never a second probe;
 *   tool face        the REAL pinned upstream module
 *                    (`@deepseek-ai/dsh-tool-web` lib, read-only import from the
 *                    pristine host tree) mounted through the realm's OWN
 *                    `mountNativeToolModules` route-C seam;
 *   network boundary a FAKE web provider that RECORDS every fetch/search and
 *                    counts the DNS/connect steps a real transport would take.
 *                    "Refused before any provider call" is a counter, not a
 *                    claim: no socket, no DNS, no proxy lookup ever happens here.
 *
 * @module tests/world-factory/lib/a5sf-web-arms
 */

import { createRequire, register } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findTestRepoRoot, testUseTree } from '../../paths.mjs'

/** The Member identity every arm runs under (a trusted, complete identity). */
export const WEB_IDENTITY = Object.freeze({
  teamId: 'team-bl18-web',
  memberInstanceId: 'member-bl18-web',
  templateId: 'worker',
  instanceGeneration: 2,
})

/** The declared URL every fetch arm uses (the effect witness). */
export const DECLARED_URL = 'https://example.test/legal/page'

const SEAM_CACHE = new Map()

/**
 * Load the REAL seams: the repo's member-io/team-services modules (through the
 * `.ts`-under-`node` hook), the Cordis pieces, and the PINNED upstream web
 * stack (read-only import; no boot, no network).
 */
export async function loadWebSeams(repoRoot) {
  if (SEAM_CACHE.has(repoRoot)) return SEAM_CACHE.get(repoRoot)
  const promise = (async () => {
    register(pathToFileURL(join(repoRoot, 'scripts', 'run-tests-hooks.mjs')).href)
    const runtimeRequire = createRequire(join(repoRoot, 'packages/runtime/package.json'))
    const pristine = testUseTree(findTestRepoRoot(repoRoot) ?? repoRoot)
    const [policy, services, mount, cordis, tools, systemPrompt, scope, webRuntime, toolWeb] = await Promise.all([
      import(pathToFileURL(join(repoRoot, 'packages/runtime/member-io-policy/src/index.ts')).href),
      import(pathToFileURL(join(repoRoot, 'packages/runtime/team-services/src/index.ts')).href),
      import(pathToFileURL(join(repoRoot, 'packages/runtime/team-services/src/mount.ts')).href),
      import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href),
      import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href),
      import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href),
      import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href),
      // The PINNED host web stack (baseline @639ed01539 built libs, read-only).
      import(pathToFileURL(join(pristine, 'packages/web/web/lib/index.js')).href),
      import(pathToFileURL(join(pristine, 'packages/web/tool-web/lib/index.js')).href),
    ])
    const seams = Object.freeze({
      compileMemberPolicy: policy.compileMemberPolicy,
      compileEffectiveIo: policy.compileEffectiveIo,
      services,
      mountA5sfRealm: services.mountA5sfRealm,
      mountNativeToolModules: mount.mountNativeToolModules,
      A5SF_NETWORK_UNCONFINED_REALM: mount.A5SF_NETWORK_UNCONFINED_REALM,
      Context: cordis.Context,
      Service: cordis.Service,
      ToolRuntime: tools.default,
      SystemPrompt: systemPrompt.default,
      createScope: scope.createScope,
      WebRuntime: webRuntime.WebRuntime,
      toolWeb,
      pristine,
    })
    return seams
  })()
  SEAM_CACHE.set(repoRoot, promise)
  return promise
}

/** One restricted lane (the shipped v4 shape: allow/ask/deny lists). */
export function lane(allow, deny = []) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([...deny]) })
}

/** One Member ceiling under the fixed identity (the network axis configurable). */
export function memberPolicy({ network = 'allow' } = {}) {
  return Object.freeze({
    memberIdentity: WEB_IDENTITY.memberInstanceId,
    templateId: WEB_IDENTITY.templateId,
    instanceGeneration: WEB_IDENTITY.instanceGeneration,
    revision: 'rev-bl18-web',
    read: lane(['/tmp']),
    write: lane(['/tmp']),
    network: Object.freeze({ access: network }),
  })
}

/**
 * The effective lane = ceiling ∩ tool restriction, produced by the ONE
 * compiler. The network decision the face reads is this object's
 * `network.access` — no arm recomputes it.
 */
export function effectiveOf(seams, { network = 'allow' } = {}) {
  const compiled = seams.compileEffectiveIo(
    memberPolicy({ network }),
    { bindingIdentity: 'team/web', read: lane(['/tmp']), write: lane(['/tmp']), network },
    {
      memberIdentity: WEB_IDENTITY.memberInstanceId,
      callId: 'call-bl18-web',
      policyRevision: 'rev-bl18-web',
      toolBindingIdentity: 'team/web',
      approvedOnce: false,
    },
  )
  if (!compiled.ok) throw new Error(`compileEffectiveIo refused: ${JSON.stringify(compiled)}`)
  return compiled.value
}

/**
 * The FAKE network boundary — the ONLY place a real transport would be
 * entered. It records the exact request per call and counts the two steps a
 * real fetch performs before bytes move (`dnsLookups`, `connects`), so a
 * pre-provider refusal is measured as `0` on both, not asserted in prose.
 *
 * `probeLevel` controls what the backend's OWN capability probe reports:
 *   'unsupported' (the default — what this host's real providers report)
 *   'enforced'    (a hypothetical backend; only the probe-load-bearing arm uses it)
 *   'absent'      (a provider with no probe at all)
 */
export function fakeWebBoundary({ probeLevel = 'unsupported', body = 'BL18-MOCK-BODY' } = {}) {
  const fetches = []
  const searches = []
  const boundary = {
    fetches,
    searches,
    dnsLookups: 0,
    connects: 0,
    proxyLookups: 0,
    probeCalls: 0,
    /** A proxy resolver a real hop would consult (never reached on a refusal). */
    proxyRouteFor(_url) {
      boundary.proxyLookups += 1
      return null
    },
    async fetch(request) {
      fetches.push(request)
      boundary.proxyLookups += 0 // the proxy route is resolved inside the provider below
      boundary.dnsLookups += 1
      boundary.connects += 1
      const url = typeof request?.url === 'string' ? request.url : '<no-url>'
      return { url, statusCode: 200, body: { kind: 'text', content: body }, truncated: false }
    },
    async search(request) {
      searches.push(request)
      boundary.dnsLookups += 1
      boundary.connects += 1
      return { content: `search:${JSON.stringify(request?.queries ?? null)}`, sources: [], truncated: false }
    },
  }
  if (probeLevel !== 'absent') {
    boundary.probe = async () => {
      boundary.probeCalls += 1
      return {
        ok: true,
        value: [{
          dimension: 'network-destination',
          level: probeLevel,
          note: `fake web boundary probe: network-destination=${probeLevel}`,
          // BL-42: a bare `enforced` level is not evidence any more.
          ...(probeLevel === 'enforced' ? { mechanism: 'fake-netns (fixture)', evidence: 'evidence://fake/bl42-web' } : {}),
        }],
      }
    }
  }
  return boundary
}

/** A plain base (not a Cordis Service) so a face can be built without a Context. */
class BareWeb {
  constructor(ctx) {
    this.ctx = ctx
  }

  async fetch() {
    throw new Error('BL18_TRIPWIRE: the bare base fetch must never run')
  }
}

/** Build ONE confined web face over the REAL module, with the fake boundary. */
export function makeFace(seams, { effective, boundary }) {
  const facts = []
  const Confined = seams.services.createConfinedWebClass(BareWeb, {
    effective,
    provider: boundary,
    onGuardConsult: (fact) => facts.push(fact),
    realmId: 'realm-bl18-web',
  })
  const face = new Confined({})
  return { face, facts }
}

/** The base `fs` Provider a realm shadows (the install capability gate). */
export function makeBaseFsClass(Service) {
  return class BaseFs extends Service {
    constructor(ctx, config = {}) {
      super(ctx, 'fs')
      this.config = config
    }

    processPath(target) {
      return target.hostPath
    }

    contains(parent, child) {
      return String(this.processPath(child)).startsWith(String(this.processPath(parent)))
    }

    async resolve(path) {
      return { hostPath: path, displayPath: path }
    }

    async readText() {
      return ''
    }

    async streamText() {
      return (async function* stream() {
        yield ''
      })()
    }

    async readBytes() {
      return new Uint8Array()
    }

    async readByteRange() {
      return new Uint8Array()
    }

    async listDir() {
      return []
    }

    async stat() {
      return { type: 'file', size: 0, mtimeMs: 0, mode: 0o644 }
    }

    async lstat() {
      return this.stat()
    }

    async watch() {
      return async () => undefined
    }

    async writeText(target) {
      return { path: this.processPath(target), displayPath: this.processPath(target), version: 'v1' }
    }

    async editText(target) {
      return { path: this.processPath(target), displayPath: this.processPath(target), version: 'v2' }
    }
  }
}

/** The INHERITED host web service: consulting it is a FAILURE (a tripwire). */
export function makeHostWebTripwire(Service) {
  return class HostWeb extends Service {
    static calls = 0

    constructor(ctx, config = {}) {
      super(ctx, 'web')
      this.config = config
    }

    async fetch() {
      HostWeb.calls += 1
      throw new Error('BL18_TRIPWIRE: the INHERITED host ctx.web was consulted')
    }

    async search() {
      HostWeb.calls += 1
      throw new Error('BL18_TRIPWIRE: the INHERITED host ctx.web was consulted')
    }
  }
}

/**
 * Build ONE governed realm on a real in-process Cordis root: the real
 * `mountA5sfRealm` + real confined `fs` shadow, optionally with the confined
 * `web` face on the same isolated scope. The real host `web` service is a
 * TRIPWIRE, so an accidental inherited-resolution is a measured failure.
 */
export async function makeGovernedRealm(seams, {
  network = 'allow',
  withWebFace = true,
  probeLevel = 'unsupported',
  body,
  // LAYER B (web contract): the boundary is replacable so a contract arm can
  // record the ORDER of the guard/provider edge and the exact arguments the
  // provider received. Omitted = the shipped `fakeWebBoundary`, byte-identical
  // to the pre-contract harness.
  boundary: injectedBoundary,
} = {}) {
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
  const boundary = injectedBoundary ?? fakeWebBoundary({ probeLevel, ...(body === undefined ? {} : { body }) })
  const facts = []
  const realm = await seams.mountA5sfRealm({
    root: agent.ctx,
    members: [{ identity: WEB_IDENTITY, policy: { ok: true, value: memberPolicy({ network }) } }],
    providerClass: BaseFs,
    ...(withWebFace
      ? { web: { effective: effectiveOf(seams, { network }), provider: boundary, realmId: 'realm-bl18-web' } }
      : {}),
    onGuardConsult: (fact) => facts.push(fact),
  })
  return { root, agentKey, realm, boundary, facts, HostWeb, seams }
}

/** Mount the REAL pinned `tool-web` module through the realm's route-C seam. */
export async function mountToolWeb(world, config = {}) {
  return world.realm.mountNativeToolModules([{ module: world.seams.toolWeb, config }], { scope: world.agentKey })
}

/** Execute one model-facing tool call through the REAL ToolRuntime. */
export async function drive(world, name, args, callId = `bl18-${name}`) {
  const result = await world.root.tools.execute({
    signal: new AbortController().signal,
    callId,
    name,
    arguments: args,
    agent: world.agentKey,
  })
  return result
}

/** The concatenated model-facing text of one tool result. */
export function textOf(result) {
  const content = Array.isArray(result?.content) ? result.content : []
  return content.map((part) => (typeof part?.text === 'string' ? part.text : JSON.stringify(part))).join('\n')
}

/**
 * The ORDINARY host composition: NO Alpha.5 realm, no isolate, no guard. A real
 * `WebRuntime` service, the real pinned `tool-web` module mounted as the host
 * mounts it, and a mock fetch provider registered on `ctx.web` — the
 * "非受管 Member 照旧 fetch" control.
 */
export async function makeOrdinaryHost(seams, { body = 'BL18-ORDINARY-BODY' } = {}) {
  const root = new seams.Context()
  await root.plugin(seams.SystemPrompt)
  await root.plugin(seams.ToolRuntime)
  await root.plugin(seams.WebRuntime, {})
  const boundary = fakeWebBoundary({ body })
  const disposeProvider = root.get('web').registerFetchProvider({
    id: 'bl18-mock-fetch',
    available: () => true,
    fetch: (request, signal) => boundary.fetch(request, signal),
  })
  await root.plugin(seams.toolWeb, {})
  return { root, boundary, disposeProvider }
}

/** Execute one tool call on the ordinary (scope-free) host composition. */
export async function driveOrdinary(world, name, args, callId = `bl18-ordinary-${name}`) {
  return world.root.tools.execute({
    signal: new AbortController().signal,
    callId,
    name,
    arguments: args,
  })
}

/** The typed refusal code of an error (never string-parsed from a message). */
export function refusalCode(error) {
  const code = error?.code
  return typeof code === 'string' ? code : null
}
