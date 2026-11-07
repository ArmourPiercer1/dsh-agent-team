/**
 * recon-web-offer-row.mjs — the BOOT-COMPOSITION half of the D-face (Web) recon.
 *
 * WHAT IT SUPPLIES: the optional `teamA5sfRealm` service the production row
 * reads lazily (`packages/runtime/src/plugin/host.ts` → `() => ctx.get('teamA5sfRealm')`).
 * Its `compiledFor(member)` answer is the COMPILED object of one admitted
 * Member: the ceiling policy plus the confined `web` face the product row
 * forwards into `mountA5sfRealm`.
 *
 * WHAT IS PRODUCT AND WHAT IS FIXTURE (stated so it cannot be read as more):
 *   - PRODUCT: the confined `web` class, its admission guard, the BL-17
 *     capability probe, the `NETWORK_UNCONFINED_REALM` / PD-15 refusals, the
 *     realm mount and the model-visible `web_fetch`/`web_search` tools are the
 *     SHIPPED modules, reached through the shipped row;
 *   - TEST COMPOSITION: the ceiling lane inputs and the per-template network
 *     choice are authored here. The product has no v3-blueprint → compiled-lane
 *     bridge at this base, and the product declaration path REFUSES a narrowing
 *     `network: deny` at assembly (measured host-free by `arms-hostfree.mjs`
 *     A11 and, live, by boot #2). A deny lane is therefore only reachable by
 *     composition, never by a product blueprint;
 *   - the ONE compiler (`compileEffectiveIo`, imported from the committed dist)
 *     performs the intersection; this file never re-implements lane algebra;
 *   - the TRANSPORT is a REAL in-process HTTP client to a CONTROLLED LOCAL
 *     ENDPOINT (`127.0.0.1:<ephemeral>`) started by the driver. It is the
 *     composition-owned transport, not the inherited host web provider. Every
 *     entry is recorded before the request is made, so "the endpoint received
 *     N requests" is measured on BOTH sides: provider counter and server log;
 *   - the inherited HOST `web` service is instrumented read-only (prototype
 *     methods wrapped, original forwarded) so a fallback to the unconfined host
 *     transport would be counted.
 *
 * NOT CLAIMED: OS-level network isolation. An admitted fetch here is ordinary
 * in-process loopback egress; the `network: deny` refusal is our own admission
 * code refusing before the provider, with the OS never asked.
 *
 * @module dev/agent-workflow/evidence/a5sf-recon-web/recon-web-offer-row
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const name = 'a5sf-recon-web-offer'
export const inject = []

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const DIST = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const policy = await import(pathToFileURL(join(DIST, 'member-io-policy', 'src', 'index.js')).href)

const HOST_WEB_MARK = Symbol.for('a5sf.recon.web.hostWebCounter')

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

function httpGet(target) {
  return new Promise((done, fail) => {
    const url = new URL(target)
    const req = httpRequest({
      host: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: { connection: 'close' },
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => done({
        status: res.statusCode ?? 0,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }))
    })
    req.setTimeout(8000, () => req.destroy(new Error('A5SF_RECON_WEB_PROVIDER_TIMEOUT')))
    req.on('error', fail)
    req.end()
  })
}

/**
 * The composition-owned transport: a real socket to the local endpoint, with
 * one counter row per entry on the channels the admission contract names.
 */
function transportFor({ endpoint, counterPath, realmTag }) {
  const record = recorder(counterPath)
  const entries = { fetch: 0, search: 0, transport: 0, dns: 0, connect: 0, proxy: 0 }
  const transport = {
    entries,
    async fetch(request) {
      entries.fetch += 1
      entries.transport += 1
      entries.dns += 1
      entries.connect += 1
      const url = request !== null && typeof request === 'object' && typeof request.url === 'string' && request.url !== ''
        ? request.url
        : `${endpoint}/page`
      record({ leg: 'provider-entry', channel: 'fetch', realm: realmTag, url })
      const response = await httpGet(url)
      return {
        url,
        statusCode: response.status,
        body: { kind: 'text', content: response.body },
        truncated: false,
      }
    },
    async search(request) {
      entries.search += 1
      entries.transport += 1
      entries.dns += 1
      entries.connect += 1
      // SHAPE ONLY: the query text is deliberately never recorded (the guard's
      // locator already refuses to leak it).
      record({
        leg: 'provider-entry',
        channel: 'search',
        realm: realmTag,
        requestKeys: request !== null && typeof request === 'object' ? Object.keys(request).sort() : [],
        hasQueryString: typeof request?.query === 'string',
        hasQueriesArray: Array.isArray(request?.queries),
      })
      const response = await httpGet(`${endpoint}/search`)
      return {
        sources: [{ url: `${endpoint}/search`, title: 'A5SF recon local endpoint', snippet: response.body }],
        truncated: false,
      }
    },
    async probe() {
      // THE HONEST HOST ANSWER. `unsupported` is what this host's real
      // providers report; the guard therefore refuses a deny lane at admission.
      record({ leg: 'capability-probe', realm: realmTag, level: 'unsupported' })
      return {
        ok: true,
        value: [{
          dimension: 'network-destination',
          level: 'unsupported',
          note: 'a5sf recon composition boundary: network-destination=unsupported (this host\'s providers report no enforced network capability)',
        }],
      }
    },
  }
  return transport
}

export function apply(ctx, config) {
  const allowRoot = typeof config?.allowRoot === 'string' ? config.allowRoot.trim() : ''
  const readAllow = Array.isArray(config?.readAllow) ? config.readAllow.filter((e) => typeof e === 'string' && e.trim() !== '') : []
  const writeAllow = Array.isArray(config?.writeAllow) ? config.writeAllow.filter((e) => typeof e === 'string' && e.trim() !== '') : []
  const counterPath = typeof config?.counterPath === 'string' ? config.counterPath.trim() : ''
  const hostWebCounterPath = typeof config?.hostWebCounterPath === 'string' ? config.hostWebCounterPath.trim() : ''
  const endpoint = typeof config?.endpoint === 'string' ? config.endpoint.trim() : ''
  if (allowRoot === '') throw new TypeError('a5sf-recon-web-offer: config.allowRoot is required')
  if (readAllow.length === 0) throw new TypeError('a5sf-recon-web-offer: config.readAllow is required')
  if (writeAllow.length === 0) throw new TypeError('a5sf-recon-web-offer: config.writeAllow is required')
  if (counterPath === '') throw new TypeError('a5sf-recon-web-offer: config.counterPath is required')
  if (endpoint === '') throw new TypeError('a5sf-recon-web-offer: config.endpoint is required')
  const bindingIdentity = typeof config?.bindingIdentity === 'string' && config.bindingIdentity.trim() !== ''
    ? config.bindingIdentity.trim()
    : 'team/web'
  const allowTemplates = Array.isArray(config?.networkAllowTemplates)
    ? config.networkAllowTemplates.filter((e) => typeof e === 'string' && e.trim() !== '')
    : ['weballow']
  const denyTemplates = Array.isArray(config?.networkDenyTemplates)
    ? config.networkDenyTemplates.filter((e) => typeof e === 'string' && e.trim() !== '')
    : ['webdeny']
  const record = recorder(counterPath)

  const ceilingRead = lane([allowRoot])
  const ceilingWrite = lane([allowRoot])
  const restrictionRead = lane(readAllow)
  const restrictionWrite = lane(writeAllow)

  const transports = new Map()
  const transportForMember = (instanceId) => {
    const cached = transports.get(instanceId)
    if (cached !== undefined) return cached
    const transport = transportFor({ endpoint, counterPath, realmTag: `member:${instanceId}` })
    transports.set(instanceId, transport)
    return transport
  }

  const provider = {
    compiledFor(member) {
      const instanceId = String(member?.instanceId ?? '')
      if (instanceId === '') return undefined
      const templateId = String(member?.templateId ?? 'weballow')
      const networkAccess = denyTemplates.includes(templateId)
        ? 'deny'
        : (allowTemplates.includes(templateId) ? 'allow' : null)
      if (networkAccess === null) return undefined
      const revision = `a5sf-recon-web:${instanceId}:g1`
      const identity = Object.freeze({
        teamId: 'team.a5sf.recon.web',
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
        { bindingIdentity, read: restrictionRead, write: restrictionWrite, network: networkAccess },
        {
          memberIdentity: instanceId,
          callId: `a5sf-recon-web:${instanceId}:${bindingIdentity}`,
          policyRevision: revision,
          toolBindingIdentity: bindingIdentity,
          approvedOnce: false,
        },
      )
      if (!compiled.ok) {
        throw new Error(`a5sf-recon-web-offer: the ONE compiler refused the web face: ${JSON.stringify(compiled)}`)
      }
      record({ leg: 'compiled-lane', realm: `member:${instanceId}`, templateId, networkAccess, policyRevision: revision })
      return {
        members: [{ identity, policy: { ok: true, value: memberPolicy } }],
        web: {
          effective: compiled.value,
          provider: transportForMember(instanceId),
          realmId: `member:${instanceId}`,
          bindingId: bindingIdentity,
        },
      }
    },
  }
  ctx.provide('teamA5sfRealm', provider)

  // ── inherited HOST web service tripwire (read-only instrumentation) ──────
  if (hostWebCounterPath !== '') {
    ctx.inject(['web'], (webCtx) => {
      const base = webCtx.web
      if (base === undefined || base === null) return
      const ctor = Object.getPrototypeOf(base)?.constructor
      const proto = ctor?.prototype
      if (typeof proto !== 'object' || proto === null) return
      if (proto[HOST_WEB_MARK] === true) return
      const recordHost = recorder(hostWebCounterPath)
      const patch = (method) => {
        const original = proto[method]
        if (typeof original !== 'function') return
        Object.defineProperty(proto, method, {
          configurable: true,
          writable: true,
          value: function countedHostWeb(...args) {
            recordHost({ leg: 'host-web-call', method, note: 'the INHERITED host web service was consulted' })
            return original.apply(this, args)
          },
        })
      }
      patch('fetch')
      patch('search')
      Object.defineProperty(proto, HOST_WEB_MARK, { configurable: true, writable: true, value: true })
      recordHost({ leg: 'host-web-counter-installed', baseCtor: String(ctor?.name ?? '?') })
    })
  }
}
