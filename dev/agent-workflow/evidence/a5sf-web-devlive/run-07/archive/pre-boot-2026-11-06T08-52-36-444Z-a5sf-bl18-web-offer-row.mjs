/**
 * a5sf-bl18-web-offer-row.mjs — the BOOT-COMPOSITION half of the BL-18 live
 * deny-lane wiring datum (P2-04 boot #5 of 5).
 *
 * WHAT IT SUPPLIES: the optional `teamA5sfRealm` service the production row
 * reads lazily (`packages/runtime/src/plugin/host.ts` →
 * `() => ctx.get('teamA5sfRealm')`). Its `compiledFor(member)` answer is the
 * COMPILED object of one admitted Member: the ceiling policy plus the confined
 * `web` face the product row forwards into `mountA5sfRealm`.
 *
 * WHAT IS PRODUCT AND WHAT IS FIXTURE (stated so it cannot be read as more):
 *   - the CEILING lane inputs (read/write = the World workspace) and the
 *     per-template network choice (`webworker` → deny) are TEST COMPOSITION:
 *     the product has no v3-blueprint → compiled-lane bridge at this base, and
 *     the product config path REFUSES a narrowing `network: deny` at
 *     composition (assembly-proof.mjs scenario A);
 *   - the INTERSECTION and the effective policy object are the ONE compiler
 *     (`compileEffectiveIo`, imported from the committed dist), never a second
 *     algebra;
 *   - the confined `web` class, its admission guard, the BL-17 capability
 *     probe and the `NETWORK_UNCONFINED_REALM` refusal are the SHIPPED ones
 *     (`team-services/src/web.ts`), reached through the product row;
 *   - the transport is a FAKE boundary. It implements no socket, no DNS, no
 *     proxy. Its `fetch`/`search` append one entry and REFUSE with a typed
 *     error, so "zero provider entries" is a counter, not a claim. Its
 *     `probe()` answers `network-destination: unsupported` — what this host's
 *     real providers answer — which is why a deny call is refused BEFORE the
 *     provider by design;
 *   - the inherited HOST `web` service is instrumented read-only (prototype
 *     methods wrapped) so a fallback to the unconfined host transport would be
 *     counted. The wrapper forwards the original call unchanged.
 *
 * NOT CLAIMED: OS-level network isolation. Refusing to fetch is a statement
 * about our own admission code, made before the OS was asked
 * (`evidence/a5sf-subprocess-face/README.md` §7).
 *
 * @module dev/agent-workflow/evidence/a5sf-bl18-live2/a5sf-bl18-web-offer-row
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const name = 'a5sf-bl18-web-offer'
export const inject = []

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const DIST = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')

const policy = await import(pathToFileURL(join(DIST, 'member-io-policy', 'src', 'index.js')).href)

const PROVIDER_ENTRY_MARK = Symbol.for('a5sf.bl18.webProviderCounters')
const HOST_WEB_MARK = Symbol.for('a5sf.bl18.hostWebCounter')

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function recorder(path) {
  return (row) => {
    try {
      mkdirSync(dirname(path), { recursive: true })
      appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...row })}\n`)
    } catch {
      /* instrumentation never breaks the host call it observes */
    }
  }
}

/**
 * The fake network boundary. It is deliberately NOT a transport: every entry
 * is recorded and refused, so a call that reaches it is a FAILED case (the
 * admission did not hold), never a silent egress.
 */
function boundaryFor({ counterPath, realmTag, probeNote }) {
  const record = recorder(counterPath)
  const boundary = {
    entries: { fetch: 0, search: 0, transport: 0, dns: 0, connect: 0, proxy: 0 },
    probeCalls: 0,
    async fetch(request) {
      boundary.entries.fetch += 1
      boundary.entries.transport += 1
      boundary.entries.dns += 1
      boundary.entries.connect += 1
      record({ leg: 'provider-entry', channel: 'fetch', realm: realmTag, url: request?.url ?? null })
      throw new Error('BL18_WEB_BOUNDARY_ENTRY_WITHOUT_ADMISSION: the deny lane entered the provider')
    },
    async search(request) {
      boundary.entries.search += 1
      boundary.entries.transport += 1
      boundary.entries.dns += 1
      boundary.entries.connect += 1
      record({ leg: 'provider-entry', channel: 'search', realm: realmTag, queries: request?.queries ?? null })
      throw new Error('BL18_WEB_BOUNDARY_ENTRY_WITHOUT_ADMISSION: the deny lane entered the provider')
    },
    async probe() {
      boundary.probeCalls += 1
      record({ leg: 'capability-probe', realm: realmTag, level: 'unsupported' })
      return {
        ok: true,
        value: [{
          dimension: 'network-destination',
          level: 'unsupported',
          note: probeNote,
        }],
      }
    },
  }
  return boundary
}

export function apply(ctx, config) {
  const allowRoot = typeof config?.allowRoot === 'string' ? config.allowRoot.trim() : ''
  const readAllow = Array.isArray(config?.readAllow) ? config.readAllow.filter((e) => typeof e === 'string' && e.trim() !== '') : []
  const writeAllow = Array.isArray(config?.writeAllow) ? config.writeAllow.filter((e) => typeof e === 'string' && e.trim() !== '') : []
  if (allowRoot === '') throw new TypeError('a5sf-bl18-web-offer: config.allowRoot is required')
  if (readAllow.length === 0) throw new TypeError('a5sf-bl18-web-offer: config.readAllow is required')
  if (writeAllow.length === 0) throw new TypeError('a5sf-bl18-web-offer: config.writeAllow is required')
  const counterPath = typeof config?.counterPath === 'string' ? config.counterPath.trim() : ''
  const hostWebCounterPath = typeof config?.hostWebCounterPath === 'string' ? config.hostWebCounterPath.trim() : ''
  if (counterPath === '') throw new TypeError('a5sf-bl18-web-offer: config.counterPath is required')
  const bindingIdentity = typeof config?.bindingIdentity === 'string' && config.bindingIdentity.trim() !== ''
    ? config.bindingIdentity.trim()
    : 'team/web'
  const denyTemplates = Array.isArray(config?.networkDenyTemplates)
    ? config.networkDenyTemplates.filter((e) => typeof e === 'string' && e.trim() !== '')
    : ['webworker']
  const probeNote = typeof config?.probeNote === 'string' && config.probeNote.trim() !== ''
    ? config.probeNote.trim()
    : 'a5sf-bl18 composition boundary: network-destination=unsupported (this host\'s providers report no enforced network capability)'

  // The two authored factors (fixtures): ceiling + binding restriction.
  const ceilingRead = lane([allowRoot])
  const ceilingWrite = lane([allowRoot])
  const restrictionRead = lane(readAllow)
  const restrictionWrite = lane(writeAllow)

  const boundaries = new Map()
  const boundaryForMember = (instanceId) => {
    const cached = boundaries.get(instanceId)
    if (cached !== undefined) return cached
    const boundary = boundaryFor({ counterPath, realmTag: `member:${instanceId}`, probeNote })
    boundaries.set(instanceId, boundary)
    return boundary
  }

  const provider = {
    compiledFor(member) {
      const instanceId = String(member?.instanceId ?? '')
      if (instanceId === '') return undefined
      const templateId = String(member?.templateId ?? 'webworker')
      const networkAccess = denyTemplates.includes(templateId) ? 'deny' : 'allow'
      const revision = `a5sf-bl18:${instanceId}:g1`
      const identity = Object.freeze({
        teamId: 'team.a5sf.bl18',
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
        {
          bindingIdentity,
          read: restrictionRead,
          write: restrictionWrite,
          network: networkAccess,
        },
        {
          memberIdentity: instanceId,
          callId: `a5sf-bl18:${instanceId}:${bindingIdentity}`,
          policyRevision: revision,
          toolBindingIdentity: bindingIdentity,
          approvedOnce: false,
        },
      )
      if (!compiled.ok) {
        throw new Error(`a5sf-bl18-web-offer: the ONE compiler refused the web face: ${JSON.stringify(compiled)}`)
      }
      return {
        members: [{ identity, policy: { ok: true, value: memberPolicy } }],
        web: {
          effective: compiled.value,
          provider: boundaryForMember(instanceId),
          realmId: `member:${instanceId}`,
          bindingId: bindingIdentity,
        },
      }
    },
  }
  ctx.provide('teamA5sfRealm', provider)

  // ── inherited HOST web service tripwire (read-only instrumentation) ──────
  // If a model-visible web_fetch/web_search ever resolved the INHERITED host
  // `web` instead of the Member's confined face, this counter would move. The
  // wrapper forwards the original call unchanged (it decides nothing).
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
