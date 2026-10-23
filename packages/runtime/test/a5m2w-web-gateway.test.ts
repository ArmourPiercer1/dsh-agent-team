/**
 * a5m2w-web-gateway.test.ts — M2-WEB-01 formal C2 (offline face): the web
 * arm of the ProviderGateway over a REAL assembly shape and a STUBBED seam.
 *
 * B-WEB 验收口径 "装配真实 + 端点桩": every leg drives the production lane
 * classes (`web-gateway/src/*`) through the production glue row
 * (`src/plugin/live/web-gateway-assembly.mjs`, dynamic-import precedent =
 * a5p7-jobs-assembly.test.ts:73). Only the HOST seam is a fixture stub —
 * zero network, zero Host. Real external egress / real provider auth /
 * real-Host reruns remain ENV_BLOCK legs owned by the integration owner.
 *
 * Pinned laws: enable closed-key default-off + non-boolean typed refusal;
 * derived-only destinations (loopback/private LITERALS vetoed at the lane
 * edge with zero seam calls — the belt, NOT a copy: the provider's post-DNS
 * law stands); N-arm `destination-outside-grant`; D veto at the commit point;
 * payload-less envelopes refuse, never guess; seam codes map typed with the
 * seam code verbatim in `error.details.seamCode`; canonical outcome
 * fingerprints record final-origin changes.
 *
 * @module test/a5m2w-web-gateway
 */
import { describe, expect, it } from 'vitest'
import { parseRequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import type { GatewayReceipt, GovernanceResult, OperationGrant } from '../../domain/tool-governance/src/index.js'
import { binding, MEMBER } from './a5p2-fixtures.js'
import { createWebGateway } from '../web-gateway/src/index.js'
import type { WebGatewayCallRequest, WebGatewaySeamPorts } from '../web-gateway/src/index.js'

const REALM = 'realm-m2w'
const FP = `sha256:${'b'.repeat(64)}`
type Row = { ok: false; error: { code: string; message: string; sideEffectUnknown?: boolean; details?: Record<string, unknown> } }
type Res = GovernanceResult<GatewayReceipt>

function row(res: Res): Row {
  expect(res.ok, `expected a refusal, got ok`).toBe(false)
  if (res.ok) throw new Error('unreachable')
  return res as Row
}

function portsStub(behavior?: { fetchImpl?: (url: string) => { url: string; statusCode: number; truncated: boolean }; seamThrow?: Error }) {
  const fetchCalls: { url: string }[] = []
  const searchCalls: { query: string; maxResults?: number }[] = []
  const ports: WebGatewaySeamPorts = {
    fetch: async (r) => {
      fetchCalls.push(r)
      if (behavior?.seamThrow !== undefined) throw behavior.seamThrow
      return behavior?.fetchImpl !== undefined ? behavior.fetchImpl(r.url) : { url: r.url, statusCode: 200, truncated: false }
    },
    search: async (r) => {
      searchCalls.push(r)
      if (behavior?.seamThrow !== undefined) throw behavior.seamThrow
      return { sources: [{ url: 'https://result.example/a' }], truncated: false }
    },
  }
  return { ports, fetchCalls, searchCalls }
}

function grantWith(locator: string, toolName: string): OperationGrant {
  const parsed = parseRequestedEffectSet([
    { kind: 'tool-invoke', toolName, resource: null },
    { kind: 'connect', resource: { realmId: REALM, kind: 'network-destination', canonicalLocator: locator, rights: ['connect'] } },
  ])
  if (!parsed.ok) throw new Error(`fixture effects rejected: ${JSON.stringify(parsed.problems)}`)
  return {
    grantId: 'grant-m2w-1',
    member: MEMBER,
    callId: 'call-m2w-1',
    realmId: REALM,
    bindingId: 'bind-bash-1',
    bindingRevision: 1,
    authorityGeneration: 1,
    parametersFingerprint: FP,
    effects: parsed.value,
    singleUse: true,
    issuedAt: 1730000000000,
    expiresAt: null,
  }
}

function requestFor(toolName: 'web_fetch' | 'web_search', operation: Record<string, unknown>, grant?: OperationGrant): WebGatewayCallRequest {
  return {
    grant: grant ?? grantWith(operation['kind'] === 'web.fetch' ? 'https://ok.test' : 'https://api.deepseek.com', toolName),
    binding: binding({ toolName, definitionIdentity: `def:${toolName}`, providerId: toolName === 'web_search' ? 'deepseek-official' : 'web-fetch-http' }),
    target: { webOperation: operation as never },
    payloadFingerprint: FP,
  }
}

const DS_CONFIG_ENDPOINT = 'https://api.deepseek.com/anthropic/v1' // authority: provider.ts:34 (REAL config material, not a fetch target)

// Real glue row (dynamic-import precedent = a5p7-jobs-assembly.test.ts:73).
const glue = await import(new URL('../src/plugin/live/web-gateway-assembly.mjs', import.meta.url).href) as unknown as {
  createLiveWebGatewayAssembly: (deps: Record<string, unknown>) => {
    active: boolean
    code?: string
    callWeb: (r: WebGatewayCallRequest) => Promise<Res>
    observations: () => readonly unknown[]
  }
  deepSeekSearchOriginSource: (opts?: { configBaseURL?: string }) => () => string | Promise<string>
}
const okSeam = { fetch: async () => ({}), search: async () => ({}) }
const okResolver = () => DS_CONFIG_ENDPOINT

function armedGateway(opts?: {
  seamThrow?: Error
  fetchImpl?: (url: string) => { url: string; statusCode: number; truncated: boolean }
  origin?: () => string
  veto?: (t: unknown) => 'allowed' | 'denied' | 'not-applicable'
}) {
  const stub = portsStub({
    ...(opts?.fetchImpl === undefined ? {} : { fetchImpl: opts.fetchImpl }),
    ...(opts?.seamThrow === undefined ? {} : { seamThrow: opts.seamThrow }),
  })
  const observations: Record<string, string | boolean>[] = []
  const gateway = createWebGateway({
    ports: stub.ports,
    searchOrigin: opts?.origin ?? (() => DS_CONFIG_ENDPOINT),
    ...(opts?.veto === undefined ? {} : { readDomainVeto: opts.veto }),
    onObserve: (o) => { observations.push(o) },
  })
  return { gateway, ...stub, observations }
}

describe('a5m2w web gateway C2-offline — assembly closed keys', () => {
  it('G-1 default-off: absent webEnabledRaw ⇒ inactive row (web-not-enabled), calls refuse typed', async () => {
    const r = glue.createLiveWebGatewayAssembly({ ctxWeb: okSeam, resolveSearchOrigin: okResolver })
    expect(r.active).toBe(false)
    expect(r.code).toBe('web-not-enabled')
    const res = await r.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/page' }))
    expect(row(res).error.code).toBe('IO_POLICY_UNSUPPORTED')
  })

  it('G-2 explicit false stays off; "true" (string) is web-config-not-boolean, never coerced', async () => {
    expect(glue.createLiveWebGatewayAssembly({ webEnabledRaw: false, ctxWeb: okSeam, resolveSearchOrigin: okResolver }).code).toBe('web-not-enabled')
    expect(glue.createLiveWebGatewayAssembly({ webEnabledRaw: 'true', ctxWeb: okSeam, resolveSearchOrigin: okResolver }).code).toBe('web-config-not-boolean')
    expect(glue.createLiveWebGatewayAssembly({ webEnabledRaw: 1, ctxWeb: okSeam, resolveSearchOrigin: okResolver }).code).toBe('web-config-not-boolean')
  })

  it('G-3 armed requires the Host seam + the config resolver (restrict-first)', () => {
    expect(glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: null, resolveSearchOrigin: okResolver }).code).toBe('web-seam-absent')
    expect(glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: okSeam }).code).toBe('search-origin-resolver-missing')
    expect(glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: okSeam, resolveSearchOrigin: okResolver }).active).toBe(true)
  })

  it('G-4 the glue row drives the REAL gateway classes end to end (fetch positive)', async () => {
    const seen: { url: string }[] = []
    const seam = {
      fetch: async (req: { url: string }) => { seen.push(req); return { url: req.url, statusCode: 200, truncated: false } },
      search: async () => ({ sources: [], truncated: false }),
    }
    const r = glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: seam, resolveSearchOrigin: okResolver })
    const res = await r.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/page' }))
    expect(res.ok).toBe(true)
    expect(seen).toEqual([{ url: 'https://ok.test/page' }])
    expect(r.observations().length).toBe(1)
  })

  it('G-5 the origin factory mirrors the provider law (config ?? $DEEPSEEK_SEARCH_BASE_URL ?? package constant)', async () => {
    // config slot wins, no package import attempted:
    expect(await glue.deepSeekSearchOriginSource({ configBaseURL: 'https://cfg.test/v1' })()).toBe('https://cfg.test/v1')
    // env override (host index.ts:83 SEARCH_BASE_URL_ENV mirror). The live
    // env object is reached via globalThis (this compilation surface types the
    // ambient `process` stub without `.env`; the runtime object is Node's).
    const nodeEnv = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
    const saved = nodeEnv['DEEPSEEK_SEARCH_BASE_URL']
    nodeEnv['DEEPSEEK_SEARCH_BASE_URL'] = 'https://env.test/v1'
    try {
      expect(await glue.deepSeekSearchOriginSource({})()).toBe('https://env.test/v1')
    } finally {
      if (saved === undefined) delete nodeEnv['DEEPSEEK_SEARCH_BASE_URL']
      else nodeEnv['DEEPSEEK_SEARCH_BASE_URL'] = saved
    }
    // no config, no env ⇒ the INSTALLED package constant is the only source;
    // in this vitest world the bare specifier is unresolvable (no junction by
    // design) ⇒ typed WEB_PROVIDER_UNAVAILABLE, never a literal fallback.
    const resolver = glue.deepSeekSearchOriginSource({})
    await expect(async () => { await resolver() }).rejects.toThrow(/not resolvable/)
  })
})

describe('a5m2w web gateway C2-offline — gateway laws', () => {
  it('W-1 fetch positive: derived N, delegation with the exact URL, canonical receipt', async () => {
    const w = armedGateway()
    const res = await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/page?a=1' }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    if (!res.ok) return
    expect(res.value.outcomeFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(res.value.domainVeto).toBe('not-applicable')
    expect(Object.isFrozen(res.value)).toBe(true)
    expect(w.fetchCalls).toEqual([{ url: 'https://ok.test/page?a=1' }])
    // canonical: same facts ⇒ same fingerprint
    const res2 = await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/page?a=2' }))
    expect(res2.ok).toBe(true)
    if (res2.ok) expect(res2.value.outcomeFingerprint).toBe(res.value.outcomeFingerprint)
  })

  it('W-2 literal-address belt: loopback/private literals refuse with ZERO seam calls', async () => {
    for (const url of [
      'http://127.0.0.1:3187/page', 'http://localhost:3187/page', 'http://10.1.2.3/x',
      'http://169.254.169.254/latest/meta-data', 'http://192.168.0.1/', 'http://172.16.5.5/',
      'http://[::1]/', 'http://[fe80::1]/', 'http://0.0.0.0/', 'http://100.64.0.1/',
    ]) {
      const w = armedGateway()
      const res = await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url }))
      const err = row(res).error
      expect(err.code, url).toBe('DOMAIN_DENIED')
      expect(err.message, url).toContain('belt')
      expect(err.sideEffectUnknown, url).not.toBe(true)
      expect(w.fetchCalls.length, url).toBe(0)
    }
  })

  it('W-3 malformed/scheme-off destinations refuse at the envelope (zero seam calls)', async () => {
    const w = armedGateway()
    const unparseable = row(await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'not-a-url' })))
    expect(unparseable.error.code).toBe('DOMAIN_DENIED')
    expect(unparseable.error.message).toContain('url-unparseable')
    const ftp = row(await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'ftp://ok.test/x' })))
    expect(ftp.error.message).toContain('url-scheme-unsupported')
    expect(w.fetchCalls.length).toBe(0)
  })

  it('W-4 payload-less contract face refuses, never guesses (DISCLOSURE pinned)', async () => {
    const w = armedGateway()
    const base = requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' })
    const bare = { grant: base.grant, binding: base.binding, target: {}, payloadFingerprint: base.payloadFingerprint } as never
    const res = await w.gateway.call(bare)
    const err = row(res).error
    expect(err.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(err.message).toContain('operation-payload-absent')
    expect(w.fetchCalls.length).toBe(0)
  })

  it('W-5 closed worlds: envelope/target/payload extras all refuse TOOL_BINDING/IO typed', async () => {
    const w = armedGateway()
    const extraEnv = { ...requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' }), sneaky: true } as never
    expect(row(await w.gateway.callWeb(extraEnv)).error.code).toBe('TOOL_BINDING_UNVERIFIED')
    const extraTarget = requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' })
    ;(extraTarget.target as Record<string, unknown>)['sneaky'] = true
    expect(row(await w.gateway.callWeb(extraTarget)).error.message).toContain('target is closed')
    const extraPayload = requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p', sneaky: 1 } as never)
    expect(row(await w.gateway.callWeb(extraPayload)).error.message).toContain('payload is closed')
  })

  it('W-6 I leg: binding must BE the definition of the operation', async () => {
    const w = armedGateway()
    const res = await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.search', query: 'x' }))
    const err = row(res).error
    expect(err.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(err.message).toContain('def')
  })

  it('W-7 N arm: a grant without connect@derived-destination refuses (zero seam calls)', async () => {
    const w = armedGateway()
    const grant = grantWith('https://elsewhere.test', 'web_fetch')
    const res = await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' }, grant))
    const err = row(res).error
    expect(err.code).toBe('DOMAIN_DENIED')
    expect(err.message).toContain('destination-outside-grant')
    expect(w.fetchCalls.length).toBe(0)
  })

  it('W-8 destinations are derived, never supplied: a mismatching claim refuses', async () => {
    const w = armedGateway()
    const req = requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' })
    ;(req.target as Record<string, unknown>)['destination'] = { realmId: REALM, kind: 'network-destination', canonicalLocator: 'https://claimed.test', rights: ['connect'] }
    const err = row(await w.gateway.callWeb(req)).error
    expect(err.code).toBe('DOMAIN_DENIED')
    expect(err.message).toContain('destination-claim-mismatch')
  })

  it('W-9 search: destination = REAL config origin (path dropped), stub seam hit once', async () => {
    const w = armedGateway()
    const res = await w.gateway.callWeb(requestFor('web_search', { kind: 'web.search', query: 'm2w', maxResults: 3 }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    expect(w.searchCalls).toEqual([{ query: 'm2w', maxResults: 3 }])
  })

  it('W-10 no provider/credential ⇒ mapped refusal, seam code travels verbatim', async () => {
    const err = Object.assign(new Error('no credential'), { code: 'WEB_PROVIDER_CREDENTIAL_MISSING' })
    const w = armedGateway({ origin: () => { throw err } })
    const res = row(await w.gateway.callWeb(requestFor('web_search', { kind: 'web.search', query: 'x' })))
    expect(res.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(res.error.details?.['seamCode']).toBe('WEB_PROVIDER_CREDENTIAL_MISSING')
    expect(w.searchCalls.length).toBe(0)
  })

  it('W-11 provider WEB_BLOCKED_URL maps to DOMAIN_DENIED with honest sideEffectUnknown=false', async () => {
    const err = Object.assign(new Error('URL hostname "internal.test" resolves to a non-public IP address'), { code: 'WEB_BLOCKED_URL' })
    const w = armedGateway({ seamThrow: err })
    const req = requestFor('web_fetch', { kind: 'web.fetch', url: 'https://internal.test/p' }, grantWith('https://internal.test', 'web_fetch'))
    const res = row(await w.gateway.callWeb(req))
    expect(res.error.code).toBe('DOMAIN_DENIED')
    expect(res.error.details?.['seamCode']).toBe('WEB_BLOCKED_URL')
    expect(res.error.sideEffectUnknown).toBe(false)
  })

  it('W-12 unmapped seam failure says sideEffectUnknown=true (never a silent false)', async () => {
    const err = Object.assign(new Error('socket reset mid-flight'), { code: 'UND_ERR_SOCKET' })
    const w = armedGateway({ seamThrow: err })
    const res = row(await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' })))
    expect(res.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(res.error.details?.['seamCode']).toBe('UND_ERR_SOCKET')
    expect(res.error.sideEffectUnknown).toBe(true)
  })

  it('W-13 D arm: Domain denial refuses at the commit point with ZERO seam calls; answers land in receipts', async () => {
    const denied = armedGateway({ veto: () => 'denied' })
    const res = row(await denied.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' })))
    expect(res.error.code).toBe('DOMAIN_DENIED')
    expect(res.error.message).toContain('Domain Authority')
    expect(denied.fetchCalls.length).toBe(0)
    const allowed = armedGateway({ veto: () => 'allowed' })
    const okRes = await allowed.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' }))
    expect(okRes.ok).toBe(true)
    if (okRes.ok) expect(okRes.value.domainVeto).toBe('allowed')
  })

  it('W-14 redirect origin change is durable receipt fact (finalOriginMismatch fingerprinted, not hidden)', async () => {
    const moved = armedGateway({ fetchImpl: () => ({ url: 'https://redirected.test/final', statusCode: 200, truncated: false }) })
    const stay = armedGateway()
    const a = await moved.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' }))
    const b = await stay.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' }))
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) expect(a.value.outcomeFingerprint).not.toBe(b.value.outcomeFingerprint)
  })
})
