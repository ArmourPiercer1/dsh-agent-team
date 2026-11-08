/**
 * tests/world-factory/drivers/a5sf-pd27-web-egress/pd27-web-offer-row.mjs — the
 * BOOT-COMPOSITION half of the PD-27 live pair.
 *
 * WHAT IT SUPPLIES: the optional `teamA5sfRealm` service the production row
 * reads lazily (`packages/runtime/src/plugin/host.ts` → `() => ctx.get('teamA5sfRealm')`).
 * Its `compiledFor(member)` answer is the COMPILED object of one admitted
 * Member: the ceiling policy plus the confined `web` face the product row
 * forwards into `mountA5sfRealm`. The face is what makes `web_fetch`/`web_search`
 * reachable at all: the shipped governed realm answers `subprocess` + `terminal`
 * only, and the product assembly REFUSES a narrowed network lane with
 * `NETWORK_UNCONFINED_REALM` before any realm exists (`product-assembly.ts`).
 *
 * WHY THE COMPOSITION HAS TO SUPPLY IT (the disclosure this row embodies): a
 * `network: deny` Member is NOT constructible through the blueprint path. The
 * deny arm below therefore demonstrates the MECHANISM (the face's admission
 * refusal, measured with a transport that would connect), not a path a user can
 * take today.
 *
 * WHAT IS PRODUCT AND WHAT IS FIXTURE (stated so it cannot be read as more):
 *   - the CEILING lane inputs (read/write = the World workspace) and the
 *     per-template network choice (`webworker-deny` → deny) are TEST
 *     COMPOSITION;
 *   - the INTERSECTION and the effective policy object are the ONE compiler
 *     (`compileEffectiveIo`, imported from the committed dist), never a second
 *     algebra;
 *   - the confined `web` class, its admission guard, the BL-17 capability probe
 *     and the `NETWORK_UNCONFINED_REALM` refusal are the SHIPPED ones
 *     (`team-services/src/web.ts`), reached through the product row;
 *   - the transport is the PINNED HOST PROVIDER, not a fake: `HttpFetchProvider`
 *     from the pristine baseline tree, real `node:http` sockets, real response
 *     parsing, its own same-origin redirect policy. TWO documented test seams
 *     are used: the provider's own `resolveAddresses` argument (it refuses
 *     non-public destinations, and this pair's servers are local) and a counter
 *     wrapper that appends one entry per provider call. The wrapper forwards the
 *     call unchanged — it decides nothing;
 *   - the inherited HOST `web` service is instrumented read-only (prototype
 *     methods wrapped) so a fallback to the unconfined host transport would be
 *     COUNTED. The wrapper forwards the original call unchanged.
 *
 * @module tests/world-factory/drivers/a5sf-pd27-web-egress/pd27-web-offer-row
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const name = 'a5sf-pd27-web-offer'
export const inject = []

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const DIST = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')

const policy = await import(pathToFileURL(join(DIST, 'member-io-policy', 'src', 'index.js')).href)

const HOST_WEB_MARK = Symbol.for('a5sf.pd27.hostWebCounter')

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function recorder(path) {
  return (row) => {
    try {
      mkdirSync(dirname(path), { recursive: true })
      appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...row })}\n`)
    } catch { /* the counters are evidence; a failed write must not change behaviour */ }
  }
}

/** The pinned host transport, with the provider's OWN loopback seam. */
async function realTransport() {
  const providerModule = await import(
    pathToFileURL(join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'web', 'web-fetch-http', 'lib', 'index.js')).href
  )
  return new providerModule.HttpFetchProvider({
    maxResponseBytes: 5_000_000,
    maxBodyChars: 100_000,
    timeoutMs: 15_000,
    maxRedirects: 5,
    userAgent: 'dsh-agent-team/pd27-live',
  }, async (hostname) => {
    if (String(hostname) !== '127.0.0.1') throw new Error(`PD27_OFFER_ROW: refusing to resolve ${String(hostname)} (the pair is local-only)`)
    return [{ address: '127.0.0.1', family: 4 }]
  })
}

function boundaryFor({ counterPath, realmTag, transport }) {
  const record = recorder(counterPath)
  const boundary = {
    entries: { transport: 0, connect: 0 },
    async fetch(request) {
      boundary.entries.transport += 1
      boundary.entries.connect += 1
      record({ leg: 'provider-entry', channel: 'fetch', realm: realmTag, url: String(request?.url ?? '') })
      const result = await transport.fetch(request)
      record({ leg: 'provider-answer', channel: 'fetch', realm: realmTag, url: String(request?.url ?? ''), statusCode: result?.statusCode ?? null })
      return result
    },
    async search(request) {
      boundary.entries.transport += 1
      boundary.entries.connect += 1
      record({ leg: 'provider-entry', channel: 'search', realm: realmTag, query: String(request?.query ?? '') })
      return await transport.search(request)
    },
    // NO capability probe on purpose: the pinned transport exposes none, which is
    // exactly what the face's BL-17 leg reports as `network-destination='unsupported'`
    // — the reason a deny call is refused BEFORE the provider.
  }
  return boundary
}

export async function apply(ctx, config) {
  const allowRoot = typeof config?.allowRoot === 'string' ? config.allowRoot.trim() : ''
  if (allowRoot === '') throw new TypeError('a5sf-pd27-web-offer: config.allowRoot is required')
  const counterPath = typeof config?.counterPath === 'string' ? config.counterPath.trim() : ''
  if (counterPath === '') throw new TypeError('a5sf-pd27-web-offer: config.counterPath is required')
  const hostWebCounterPath = typeof config?.hostWebCounterPath === 'string' ? config.hostWebCounterPath.trim() : ''
  const bindingIdentity = typeof config?.bindingIdentity === 'string' && config.bindingIdentity.trim() !== ''
    ? config.bindingIdentity.trim()
    : 'team/web'
  const denyTemplates = Array.isArray(config?.networkDenyTemplates)
    ? config.networkDenyTemplates.filter((e) => typeof e === 'string' && e.trim() !== '')
    : []

  const ceilingRead = lane([allowRoot])
  const ceilingWrite = lane([allowRoot])

  // Resolved once at mount: `compiledFor` is synchronous, so the provider must
  // be in hand before the first Member asks for its answer.
  const transport = await realTransport()
  const boundaries = new Map()
  const boundaryForMember = (instanceId) => {
    const cached = boundaries.get(instanceId)
    if (cached !== undefined) return cached
    const boundary = { marker: instanceId }
    boundaries.set(instanceId, boundary)
    return boundary
  }

  const provider = {
    compiledFor(member) {
      const instanceId = String(member?.instanceId ?? '')
      if (instanceId === '') return undefined
      const templateId = String(member?.templateId ?? 'worker')
      const networkAccess = denyTemplates.includes(templateId) ? 'deny' : 'allow'
      const revision = `a5sf-pd27:${instanceId}:g1`
      const identity = Object.freeze({
        teamId: 'team.a5sf.pd27',
        memberInstanceId: instanceId,
        templateId,
        instanceGeneration: 1,
      })
      const memberPolicy = Object.freeze({
        memberIdentity: instanceId,
        templateId,
        instanceGeneration: 1,
        revision,
        read: ceilingRead,
        write: ceilingWrite,
        network: Object.freeze({ access: networkAccess }),
      })
      const compiled = policy.compileEffectiveIo(
        memberPolicy,
        { bindingIdentity, read: ceilingRead, write: ceilingWrite, network: networkAccess },
        {
          memberIdentity: instanceId,
          callId: `a5sf-pd27:${instanceId}:${bindingIdentity}`,
          policyRevision: revision,
          toolBindingIdentity: bindingIdentity,
          approvedOnce: false,
        },
      )
      if (!compiled.ok) {
        throw new Error(`a5sf-pd27-web-offer: the ONE compiler refused the web face: ${JSON.stringify(compiled)}`)
      }
      boundaryForMember(instanceId)
      return {
        members: [{ identity, policy: { ok: true, value: memberPolicy } }],
        web: {
          effective: compiled.value,
          provider: boundaryFor({ counterPath, realmTag: `member:${instanceId}`, transport }),
          realmId: `member:${instanceId}`,
          bindingId: bindingIdentity,
        },
      }
    },
  }
  // `provider` must be resolved lazily: `compiledFor` is synchronous but the
  // pinned transport is imported on first use (the host row is mounted during
  // boot, so the import cost stays out of the mount path).
  ctx.provide('teamA5sfRealm', {
    compiledFor(member) {
      const answer = provider.compiledFor(member)
      if (answer === undefined) return undefined
      return answer
    },
  })

  // ── inherited HOST web service tripwire (read-only instrumentation) ──────
  if (hostWebCounterPath !== '') {
    ctx.inject(['web'], (webCtx) => {
      const base = webCtx.web
      if (base === undefined || base === null) return
      const ctor = Object.getPrototypeOf(base)?.constructor
      const proto = ctor?.prototype
      if (typeof proto !== 'object' || proto === null) return
      if (proto[HOST_WEB_MARK] === true) return
      const record = recorder(hostWebCounterPath)
      const patch = (method) => {
        const original = proto[method]
        if (typeof original !== 'function') return
        Object.defineProperty(proto, method, {
          configurable: true,
          writable: true,
          value: function countedHostWeb(...args) {
            record({ leg: 'host-web-call', method, note: 'the INHERITED host web service was consulted' })
            return original.apply(this, args)
          },
        })
      }
      patch('fetch')
      patch('search')
      Object.defineProperty(proto, HOST_WEB_MARK, { configurable: true, writable: true, value: true })
      record({ leg: 'host-web-counter-installed', baseCtor: String(ctor?.name ?? '?') })
    })
  }
}
