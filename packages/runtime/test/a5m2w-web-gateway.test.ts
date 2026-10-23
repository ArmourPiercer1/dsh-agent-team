/**
 * a5m2w-web-gateway.test.ts — M2-WEB-01 formal spec (offline face): the web
 * arm of the ProviderGateway over a REAL assembly shape and a STUBBED seam.
 *
 * B-WEB 验收口径 "装配真实 + 端点桩": every leg drives the production lane
 * classes (`web-gateway/src/*`) through the production glue row
 * (`src/plugin/live/web-gateway-assembly.mjs`, dynamic-import precedent =
 * a5p7-jobs-assembly.test.ts:73). Only the HOST seam is a fixture stub —
 * zero network, zero Host. Real external egress / real provider auth /
 * real-Host reruns remain ENV_BLOCK legs owned by the integration owner.
 *
 * ROOT 07:38 GROUP 3 (approval law): the gateway is envelope + destination
 * validation + delegation. Approval FACTS (expiry, single-use, definition/
 * binding verification, replay) come from the injected authority — here a
 * DISCLOSED STUB standing in for the center edge (the real authority is the
 * M1 manifest + trusted definition provider + ONE consume, wired by the
 * integration owner); its refusals must pass through VERBATIM, and the lane
 * keeps exactly one deterministic check (payload↔fingerprint self-consistency,
 * BEFORE consume — a refusal never burns the single-use grant).
 *
 * Pinned laws: enable closed-key default-off + non-boolean typed refusal;
 * derived-only destinations (loopback/private LITERALS — including the
 * IPv4-MAPPED spelling after the root 07:38 index fix — vetoed at the lane
 * edge with zero seam calls AND zero consumes, the belt being a stricter-
 * than provider pre-check, never a copy); N-arm `destination-outside-grant`
 * (lane backstop over the CONSUMED manifest); D veto at the commit point;
 * payload-less envelopes refuse, never guess; seam codes map typed with the
 * seam code verbatim in `error.details.seamCode`; seam-thrown refusals say
 * sideEffectUnknown=true (GROUP 5 honesty: a blocked destination can surface
 * on a LATER redirect hop after hop 1 produced effects); cancellation
 * threads to the seam; `close()` genuinely de-arms the row.
 *
 * @module test/a5m2w-web-gateway
 */
import { describe, expect, it } from 'vitest'
import { canonicalJsonFingerprint, parseRequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import type { GatewayReceipt, GovernanceError, GovernanceResult, OperationGrant } from '../../domain/tool-governance/src/index.js'
import { binding, MEMBER } from './a5p2-fixtures.js'
import { createWebGateway } from '../web-gateway/src/index.js'
import type { WebGatewayCallRequest, WebGatewaySeamPorts, WebGrantAuthority } from '../web-gateway/src/index.js'

const REALM = 'realm-m2w'
const FP = `sha256:${'b'.repeat(64)}`
type Row = { ok: false; error: { code: string; message: string; sideEffectUnknown?: boolean; details?: Record<string, unknown> } }
type Res = GovernanceResult<GatewayReceipt>

function row(res: Res): Row {
  expect(res.ok, `expected a refusal, got ok`).toBe(false)
  if (res.ok) throw new Error('unreachable')
  return res as Row
}

/** The fingerprint the gateway recomputes and demands (lane law: fingerprint
 *  = canonical fingerprint of the closed operation presented). */
const fpOf = (operation: Record<string, unknown>): string => canonicalJsonFingerprint(operation)

function portsStub(behavior?: { fetchImpl?: (url: string) => { url: string; statusCode: number; truncated: boolean }; seamThrow?: Error }) {
  const fetchCalls: { url: string; signal?: AbortSignal }[] = []
  const searchCalls: { query: string; maxResults?: number; signal?: AbortSignal }[] = []
  const ports: WebGatewaySeamPorts = {
    fetch: async (r, signal) => {
      fetchCalls.push({ ...r, ...(signal === undefined ? {} : { signal }) })
      if (behavior?.seamThrow !== undefined) throw behavior.seamThrow
      return behavior?.fetchImpl !== undefined ? behavior.fetchImpl(r.url) : { url: r.url, statusCode: 200, truncated: false }
    },
    search: async (r, signal) => {
      searchCalls.push({ ...r, ...(signal === undefined ? {} : { signal }) })
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
    payloadFingerprint: fpOf(operation),
  }
}

const DS_CONFIG_ENDPOINT = 'https://api.deepseek.com/anthropic/v1' // authority: provider.ts:34 (REAL config material, not a fetch target)

/** DISCLOSED center-edge STUB (GROUP 3): passes every consume and hands the
 *  presented manifest back. The REAL authority (M1 manifest + trusted
 *  definition provider + ONE consume) is the integration owner's wiring;
 *  these legs pin the WIRE, not the decision logic. */
function passThroughAuthority(): WebGrantAuthority & { consumes: unknown[] } {
  const consumes: unknown[] = []
  return {
    consumes,
    consume: async (input) => {
      consumes.push(input)
      const grant = input.grant as unknown as OperationGrant
      return { ok: true, value: { grantId: grant.grantId, effects: grant.effects as unknown as { effects: readonly unknown[] } } }
    },
  }
}

/** Stub authority that always refuses with a fixed error (recorder stand-in
 *  for expired / forged-binding / replay decisions). */
function refusalAuthority(error: GovernanceError): WebGrantAuthority & { consumes: unknown[] } {
  const consumes: unknown[] = []
  return { consumes, consume: async (input) => { consumes.push(input); return { ok: false, error } } }
}

/** Stub enforcing ONE consume per grantId (the replay-refusal WIRE). */
function singleUseAuthority(): WebGrantAuthority & { consumes: unknown[] } {
  const consumes: unknown[] = []
  const used = new Set<string>()
  return {
    consumes,
    consume: async (input) => {
      consumes.push(input)
      const grant = input.grant as unknown as OperationGrant
      if (used.has(grant.grantId)) {
        return { ok: false, error: Object.freeze({ code: 'TOOL_BINDING_UNVERIFIED', message: 'grant-already-consumed: single-use grant presented a second time', sideEffectUnknown: false }) as unknown as GovernanceError }
      }
      used.add(grant.grantId)
      return { ok: true, value: { grantId: grant.grantId, effects: grant.effects as unknown as { effects: readonly unknown[] } } }
    },
  }
}

// Real glue row (dynamic-import precedent = a5p7-jobs-assembly.test.ts:73).
const glue = await import(new URL('../src/plugin/live/web-gateway-assembly.mjs', import.meta.url).href) as unknown as {
  createLiveWebGatewayAssembly: (deps: Record<string, unknown>) => {
    active: boolean
    code?: string
    callWeb: (r: WebGatewayCallRequest, o?: { signal?: AbortSignal }) => Promise<Res>
    close: () => boolean
    closed: () => boolean
    observations: () => readonly Record<string, string>[]
  }
  boundSearchOriginSource: (src: Record<string, unknown>) => () => Promise<string>
}
const okSeam = { fetch: async () => ({}), search: async () => ({}) }
const okResolver = () => DS_CONFIG_ENDPOINT
const okAuthority = { consume: async () => ({ ok: true as const, value: { grantId: 'g', effects: { effects: [] } } }) }

function armedGateway(opts?: {
  seamThrow?: Error
  fetchImpl?: (url: string) => { url: string; statusCode: number; truncated: boolean }
  origin?: () => string
  veto?: (t: unknown) => 'allowed' | 'denied' | 'not-applicable'
  authority?: WebGrantAuthority
}) {
  const stub = portsStub({
    ...(opts?.fetchImpl === undefined ? {} : { fetchImpl: opts.fetchImpl }),
    ...(opts?.seamThrow === undefined ? {} : { seamThrow: opts.seamThrow }),
  })
  const observations: Record<string, string | boolean>[] = []
  const authority = opts?.authority ?? passThroughAuthority()
  const gateway = createWebGateway({
    ports: stub.ports,
    searchOrigin: opts?.origin ?? (() => DS_CONFIG_ENDPOINT),
    authority,
    ...(opts?.veto === undefined ? {} : { readDomainVeto: opts.veto }),
    onObserve: (o) => { observations.push(o) },
  })
  // single-point cast: the consume stubs carry a `consumes` ledger the frozen
  // WebGrantAuthority port deliberately does NOT expose (observation is
  // test-side only); read structurally, the a5b3-cancel-leg.test.ts:295 style.
  return { gateway, authority, consumes: (authority as unknown as { consumes?: readonly unknown[] }).consumes ?? [], ...stub, observations }
}

describe('a5m2w web gateway — assembly closed keys + de-arm lifecycle', () => {
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

  it('G-3 armed requires Host seam + center authority + config resolver (restrict-first, GROUP 3)', () => {
    expect(glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: null, resolveSearchOrigin: okResolver, grantAuthority: okAuthority }).code).toBe('web-seam-absent')
    expect(glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: okSeam, resolveSearchOrigin: okResolver }).code).toBe('web-grant-authority-absent')
    expect(glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: okSeam, grantAuthority: okAuthority }).code).toBe('search-origin-resolver-missing')
    expect(glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: okSeam, grantAuthority: okAuthority, resolveSearchOrigin: okResolver }).active).toBe(true)
  })

  it('G-4 the glue row drives the REAL gateway classes end to end (fetch positive through the authority wire)', async () => {
    const seen: { url: string }[] = []
    const seam = {
      fetch: async (req: { url: string }) => { seen.push(req); return { url: req.url, statusCode: 200, truncated: false } },
      search: async () => ({ sources: [], truncated: false }),
    }
    const r = glue.createLiveWebGatewayAssembly({
      webEnabledRaw: true,
      ctxWeb: seam,
      grantAuthority: { consume: async (i: { grant: { effects: unknown } }) => ({ ok: true, value: { grantId: 'g', effects: i.grant.effects as { effects: readonly unknown[] } } }) },
      resolveSearchOrigin: okResolver,
    })
    const res = await r.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/page' }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    expect(seen).toEqual([{ url: 'https://ok.test/page' }])
    expect(r.observations().length).toBe(1)
  })

  it('G-5 the bound origin factory follows the provider law over INJECTED real-plane readers only', async () => {
    // config slot wins (live Volatile read, evaluated per call):
    const calls: string[] = []
    const resolver = glue.boundSearchOriginSource({
      readConfig: async () => { calls.push('config'); return 'https://cfg.test/v1' },
      readLaunchEnv: () => { calls.push('env'); return undefined },
      packageDefault: () => { calls.push('default'); return 'https://pkg.test/v1' },
    })
    expect(await resolver()).toBe('https://cfg.test/v1')
    expect(calls).toEqual(['config'])
    // config empty ⇒ launchEnvironment (host index.ts:83 key):
    const seenKeys: string[] = []
    const resolver2 = glue.boundSearchOriginSource({
      readConfig: () => undefined,
      readLaunchEnv: (k: string) => { seenKeys.push(k); return k === 'DEEPSEEK_SEARCH_BASE_URL' ? 'https://env.test/v1' : undefined },
      packageDefault: () => 'https://pkg.test/v1',
    })
    expect(await resolver2()).toBe('https://env.test/v1')
    expect(seenKeys).toEqual(['DEEPSEEK_SEARCH_BASE_URL'])
    // nothing configured ⇒ the INSTALLED package constant; the factory reads
    // NO env/global itself — absent readers refuse typed, never a literal:
    expect(await glue.boundSearchOriginSource({ readConfig: () => undefined, readLaunchEnv: () => undefined, packageDefault: () => 'https://pkg.test/v1' })()).toBe('https://pkg.test/v1')
    await expect(async () => { await glue.boundSearchOriginSource({})() }).rejects.toThrow(/readers/)
  })

  it('G-6 close() genuinely de-arms: stale handles cannot transact; one-way + idempotent (GROUP 5)', async () => {
    const r = glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: okSeam, grantAuthority: okAuthority, resolveSearchOrigin: okResolver })
    expect(r.active).toBe(true)
    expect(r.close()).toBe(true)
    expect(r.closed()).toBe(true)
    expect(r.close()).toBe(true) // idempotent
    const res = await r.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/page' }))
    const err = row(res).error
    expect(err.message).toContain('web-row-closed')
    expect(err.sideEffectUnknown).toBe(false)
    expect(r.observations().some((o) => o['event'] === 'row-closed')).toBe(true)
  })
})

describe('a5m2w web gateway — gateway laws (GROUP 3: approval facts come from the authority)', () => {
  it('W-1 fetch positive: derived N, delegation with the exact URL, canonical receipt', async () => {
    const w = armedGateway()
    const res = await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/page?a=1' }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    if (!res.ok) return
    expect(res.value.outcomeFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(res.value.domainVeto).toBe('not-applicable')
    expect(Object.isFrozen(res.value)).toBe(true)
    expect(w.fetchCalls.length).toBe(1)
    expect(w.fetchCalls[0]?.url).toBe('https://ok.test/page?a=1')
    // canonical: same facts ⇒ same fingerprint
    const res2 = await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/page?a=2' }))
    expect(res2.ok).toBe(true)
    if (res2.ok) expect(res2.value.outcomeFingerprint).toBe(res.value.outcomeFingerprint)
  })

  it('W-2 literal-address belt (incl. IPv4-MAPPED after the index fix): zero seam calls AND zero consumes', async () => {
    for (const url of [
      'http://127.0.0.1:3187/page', 'http://localhost:3187/page', 'http://10.1.2.3/x',
      'http://169.254.169.254/latest/meta-data', 'http://192.168.0.1/', 'http://172.16.5.5/',
      'http://[::1]/', 'http://[fe80::1]/', 'http://0.0.0.0/', 'http://100.64.0.1/',
      'http://[::ffff:127.0.0.1]/', 'http://[::ffff:10.9.9.9]/',
    ]) {
      const w = armedGateway()
      const res = await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url }))
      const err = row(res).error
      expect(err.code, url).toBe('DOMAIN_DENIED')
      expect(err.message, url).toContain('belt')
      expect(err.sideEffectUnknown, url).not.toBe(true)
      expect(w.fetchCalls.length, url).toBe(0)
      // belt + fingerprint intentionally PRECEDE consume: a lane refusal
      // never burns the single-use grant at the recorder.
      expect(w.consumes.length, url).toBe(0)
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

  it('W-6 swapped payload refuses BEFORE consume (the ONE deterministic lane check; grant survives)', async () => {
    const w = armedGateway()
    const req = requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' })
    const swapped = { ...req, payloadFingerprint: `sha256:${'f'.repeat(64)}` } as WebGatewayCallRequest
    const err = row(await w.gateway.callWeb(swapped)).error
    expect(err.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(err.message).toContain('payload-fingerprint-mismatch')
    expect(w.consumes.length).toBe(0) // refused before consume
    expect(w.fetchCalls.length).toBe(0)
  })

  it('W-7 N arm backstop: a consumed manifest without connect@derived-destination refuses (zero seam calls)', async () => {
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
    expect(w.searchCalls.length).toBe(1)
    expect(w.searchCalls[0]?.query).toBe('m2w')
    expect(w.searchCalls[0]?.maxResults).toBe(3)
  })

  it('W-10 no provider/credential ⇒ mapped refusal, seam code travels verbatim', async () => {
    const err = Object.assign(new Error('no credential'), { code: 'WEB_PROVIDER_CREDENTIAL_MISSING' })
    const w = armedGateway({ origin: () => { throw err } })
    const res = row(await w.gateway.callWeb(requestFor('web_search', { kind: 'web.search', query: 'x' })))
    expect(res.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(res.error.details?.['seamCode']).toBe('WEB_PROVIDER_CREDENTIAL_MISSING')
    expect(w.searchCalls.length).toBe(0)
  })

  it('W-11 provider WEB_BLOCKED_URL maps to DOMAIN_DENIED with HONEST sideEffectUnknown=true (GROUP 5: later-hop refusal can follow first-hop effects)', async () => {
    const err = Object.assign(new Error('URL hostname "internal.test" resolves to a non-public IP address'), { code: 'WEB_BLOCKED_URL' })
    const w = armedGateway({ seamThrow: err })
    const req = requestFor('web_fetch', { kind: 'web.fetch', url: 'https://internal.test/p' }, grantWith('https://internal.test', 'web_fetch'))
    const res = row(await w.gateway.callWeb(req))
    expect(res.error.code).toBe('DOMAIN_DENIED')
    expect(res.error.details?.['seamCode']).toBe('WEB_BLOCKED_URL')
    expect(res.error.sideEffectUnknown).toBe(true)
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

  it('A-1 authority refusal passes through VERBATIM (expired-grant stand-in): code/message/sideEffectUnknown/details identity, zero seam calls', async () => {
    const refusal = Object.freeze({
      code: 'TOOL_BINDING_UNVERIFIED',
      message: 'grant-expired: expiresAt 1730000000000 is past (recorder decision)',
      sideEffectUnknown: false,
      details: Object.freeze({ recorder: 'a5m2w-stub', reason: 'expired' }),
    }) as unknown as GovernanceError
    const w = armedGateway({ authority: refusalAuthority(refusal) })
    const res = row(await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' })))
    expect(res.error).toBe(refusal) // identity: passed through, never rebuilt
    expect(w.fetchCalls.length).toBe(0)
  })

  it('A-2 forged binding pair is refused at the authority (definition verification is NOT lane arithmetic anymore)', async () => {
    const refusal = Object.freeze({
      code: 'TOOL_BINDING_UNVERIFIED',
      message: 'definition-unknown: binding pairs bind-bash-1/web_fetch are not a registered definition of operation web.search (recorder decision)',
      sideEffectUnknown: false,
    }) as unknown as GovernanceError
    const auth = refusalAuthority(refusal)
    const w = armedGateway({ authority: auth })
    const res = row(await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.search', query: 'x' })))
    expect(res.error).toBe(refusal)
    expect(auth.consumes.length).toBe(1) // the decision was ASKED at the center edge…
    expect(w.searchCalls.length).toBe(0) // …and nothing ran without it
  })

  it('A-3 single-use replay: second presentation of the same grant refuses at the recorder; the first ride stands', async () => {
    const w = armedGateway({ authority: singleUseAuthority() })
    const req = requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' })
    const first = await w.gateway.callWeb(req)
    expect(first.ok).toBe(true)
    const second = row(await w.gateway.callWeb(req))
    expect(second.error.message).toContain('grant-already-consumed')
    expect(w.fetchCalls.length).toBe(1) // the replay never reached transport
  })

  it('A-4 cancellation threads callWeb → seam (same signal identity; abort maps with sideEffectUnknown=true)', async () => {
    const ac = new AbortController()
    const abortErr = Object.assign(new Error('This operation was aborted'), { code: 'ABORT_ERR' })
    const w = armedGateway({ seamThrow: abortErr })
    const res = row(await w.gateway.callWeb(requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/p' }), { signal: ac.signal }))
    expect(w.fetchCalls.length).toBe(1)
    expect(w.fetchCalls[0]?.signal).toBe(ac.signal) // identity: same object to the seam
    expect(res.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(res.error.sideEffectUnknown).toBe(true)
  })

  it('A-5 the authority sees the EXACT decision material (grant, binding, fingerprint, kind, derived locator)', async () => {
    const auth = passThroughAuthority()
    const w = armedGateway({ authority: auth })
    const req = requestFor('web_fetch', { kind: 'web.fetch', url: 'https://ok.test/deep/path?x=1#frag' })
    const res = await w.gateway.callWeb(req)
    expect(res.ok).toBe(true)
    const seen = auth.consumes[0] as Record<string, unknown>
    expect(seen['grant']).toBe(req.grant)
    expect(seen['binding']).toBe(req.binding)
    expect(seen['payloadFingerprint']).toBe(req.payloadFingerprint)
    expect(seen['operationKind']).toBe('web.fetch')
    expect(seen['canonicalLocator']).toBe('https://ok.test') // derived, path-free
  })
})
