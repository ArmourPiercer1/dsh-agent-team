/**
 * A5M2-G2-CONNECTOR — the G2 thin connector adapters (13 records: B-WEB×2,
 * B-MCP×3 tools + 2 surfaces, B-BROWSER×6) proven against NATIVE DOUBLES:
 *
 *  - CAPTURE (tools.get(name, scope) law, core/tools index.ts:1230
 *    @639ed01539): the row captures the double's definition + execute
 *    FUNCTION VALUE at bind time; the delegate enters EXACTLY that captured
 *    function value once, with the model's own args and the caller's exec.
 *  - CLASSIFY: pure — closed-root parameter refusals (typed), the CLOSED-set
 *    effect projection (I = tool-invoke; N = connect over the exact
 *    `network-destination` origin) fail-closed through the real
 *    `parseRequestedEffectSet`, full-VALUES parametersFingerprint, and the
 *    §1 reviewPayload block (familyId/adapterRevision/providerIdentity/
 *    definitionIdentity/targetManifest).
 *  - DELEGATE per mount condition (route-records-v3c):
 *      web rows — `always`: the row EXISTS and, native face absent, refuses
 *      the TYPED `P_G2_NATIVE_FACE_ABSENT` with zero delegation (the
 *      web_search leg is the dispatch's named example) — never a silent
 *      substitute;
 *      MCP trio + stagehand six — `declared_mount`: without the trusted
 *      declared-service proof the rows are honest INACTIVE
 *      (`P_G2_DECLARED_MOUNT_ABSENT`), zero native entry, zero substitution;
 *      with the proof, live delegation per family.
 *  - SURFACES (`surface_invariant`): stdio vs streamable-http classify apart
 *    (host Config discriminator, mcp-client index.ts:51-103 @639ed01539);
 *    unknown transport / missing surface-critical facts are typed assembly
 *    throws, never silent guesses; the surface record rides every MCP tool
 *    manifest.
 *  - the record set equals the frozen dispatch index exactly (read from the
 *    shipped M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json, family-filtered);
 *  - r9 idiom, parameters direction: ALL ELEVEN tool registration faces are
 *    proven against the REAL Host639 validator
 *    (tests/deepseek-harness-test-use …/packages/core/tools/lib/index.js
 *    `assertSupportedJsonSchema` + `validateJsonSchemaValue`): parent-level
 *    `required` arrays, NO property-level `required: true` marker ANYWHERE
 *    (deep sweep), constraints bind.
 *
 * Disclosed stand-ins: EVERY leg drives a TEST-owned native double — these
 * legs are NOT C2 and prove no real-Host dimension (the pinned host law each
 * double mirrors is quoted at the g2-connector-adapters.mjs header). The
 * module is UNWIRED and Host use is FOREVER-BANNED-FOR-THIS-LANE until the
 * exported A5_G2_NAMED_BLOCKERS seams close (WEB: no public current-provider
 * face; MCP: no connection-incarnation token on the public provider;
 * BROWSER: the pre-effect resources.run hook can launch/attach before the
 * captured body — no zero-launch claim; the §5.5 governed-native-provider is
 * the close). Windows-only dimensions: NOT_RUN_WINDOWS_UNAUTHORIZED (this
 * Linux harness never claims them).
 *
 * ROOT FIX CARD (this revision): tabs(new,url) carries its connect (the
 * previous I-only pin was a固化漏报, now corrected); provider/connection
 * CURRENT facts ride the manifest as assembly-injected classify-time
 * snapshots frozen against per-call re-resolution; the fingerprint is over
 * the COMPLETE ACTUAL arguments (summaries ride alongside only); the drain
 * boundary states exactly what the row controls (new entries refused;
 * in-flight bodies not cleared).
 *
 * Scope: NO Host process, NO network, NO mount.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g2-connector-adapters
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'
import { parseRequestedEffectSet } from '../../domain/tool-governance/src/index.js'

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-g2-connector-adapters: no repo root carrying tests/paths.mjs — failing closed')

type G2Effects = Array<Record<string, unknown>>
interface G2Plan {
  correlation: string
  effects: G2Effects
  targetManifest: Record<string, unknown>
  reviewPayload: Record<string, unknown>
  parametersFingerprint: string
  actualArgs?: unknown
}
interface G2Outcome {
  ok?: boolean
  code?: string
  detail?: string
  value?: unknown
  plan?: G2Plan
  /** A classify SUCCESS answers the plan fields at the top level (invoke
   *  wraps the same shape under `plan`). */
  effects?: G2Effects
  targetManifest?: Record<string, unknown>
  parametersFingerprint?: string
  reviewPayload?: Record<string, unknown>
  correlation?: string
}
interface G2Row {
  active: boolean
  familyId: string
  adapterRevision: number
  toolName: string
  operation: string
  mountCondition: string
  registrationSchema: Record<string, unknown> | null
  captured: () => boolean
  definitionIdentity: string | null
  classify: (args: unknown) => G2Outcome | Promise<G2Outcome>
  invoke: (args: unknown, exec?: unknown) => Promise<G2Outcome>
  drainSemantics?: string
  preEffectDisclosure?: string
  drain: () => void
  draining: () => boolean
}
type WebRows = { web_fetch: G2Row; web_search: G2Row }
type McpRows = { list_mcp_resources: G2Row; list_mcp_resource_templates: G2Row; read_mcp_resource: G2Row }
type BrowserRows = {
  stagehand_act: G2Row
  stagehand_extract: G2Row
  stagehand_navigate: G2Row
  stagehand_observe: G2Row
  stagehand_screenshot: G2Row
  stagehand_tabs: G2Row
}

const A = (await import(new URL('../src/plugin/live/governed-families/g2-connector-adapters.mjs', import.meta.url).href)) as {
  A5_G2_ADAPTER_REVISION: number
  A5_G2_FAMILY: Record<'web' | 'mcp' | 'browser', string>
  A5_G2_TYPED_CODES: Record<
    | 'UNKNOWN_PARAMETER' | 'INVALID_ARGUMENTS' | 'NATIVE_FACE_ABSENT' | 'DECLARED_MOUNT_ABSENT'
    | 'SURFACE_TRANSPORT_UNKNOWN' | 'SURFACE_FACTS_INCOMPLETE' | 'NO_DECLARED_DESTINATION'
    | 'DESTINATION_UNSUPPORTED_SCHEME' | 'DEFINITION_DRIFT' | 'DRAINING' | 'INTERNAL_EFFECTS_INVALID',
    string
  >
  A5_G2_REGISTRATION_SCHEMAS: Record<string, Record<string, unknown>>
  A5_G2_MCP_TRANSPORTS: readonly string[]
  A5_G2_NAMED_BLOCKERS: Record<'WEB' | 'MCP' | 'BROWSER', string>
  A5_G2_DRAIN_SEMANTICS: string
  classifyG2McpSurface: (config: Record<string, unknown>) => Record<string, unknown>
  createG2WebAdapters: (deps: Record<string, unknown>) => WebRows
  createG2McpResourceAdapters: (deps: Record<string, unknown>) => McpRows
  createG2BrowserAdapters: (deps: Record<string, unknown>) => BrowserRows
}
const CODES = A.A5_G2_TYPED_CODES

interface NativeDouble {
  name: string
  description: string
  execute: (args: unknown, exec: unknown) => Promise<unknown>
  calls: Array<Record<string, unknown>>
}

function nativeDouble(name: string, value: unknown = { ok: 'native' }): NativeDouble {
  const double: NativeDouble = {
    name,
    description: `native ${name} description (verbatim-mount law)`,
    calls: [],
    execute: async () => value,
  }
  double.execute = async (args: unknown, exec: unknown) => {
    double.calls.push({ args, exec })
    return value
  }
  return double
}

function readNativeFrom(defs: Record<string, NativeDouble>) {
  return (name: string): NativeDouble | undefined => defs[name]
}

/** Success unwrapper — a refusal here is a spec failure, not a pass. */
function okOutcome(out: G2Outcome): G2Plan {
  expect(out.ok, `expected ok, got refusal ${String(out.code ?? '?')}: ${String(out.detail ?? '')}`).toBe(true)
  const plan = out.plan
  if (plan === undefined) throw new Error('ok outcome carried no plan')
  return plan
}

function connectLocator(plan: G2Plan): string | undefined {
  const connect = plan.effects.find((e) => e['kind'] === 'connect')
  const resource = connect?.['resource'] as { canonicalLocator?: string } | undefined
  return resource?.canonicalLocator
}

const EXEC: Record<string, unknown> = { agent: { id: 'agent-g2' } }
const MCP_TOOL_NAMES = ['list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource'] as const
const BROWSER_TOOL_NAMES = ['stagehand_act', 'stagehand_extract', 'stagehand_navigate', 'stagehand_observe', 'stagehand_screenshot', 'stagehand_tabs'] as const

// ── B-WEB (records 22/23) — mountCondition always ──────────────────────────
describe('a5m2-g2 B-WEB', () => {
  it('web_fetch: capture → classify → DELEGATE enters the captured execute exactly once with the model args and the caller exec; effects carry the exact-origin connect', async () => {
    const fetchDef = nativeDouble('web_fetch', { url: 'https://example.com/a', statusCode: 200 })
    const rows = A.createG2WebAdapters({
      realmId: 'realm-g2',
      providerId: 'test-assembly',
      readNative: readNativeFrom({ web_fetch: fetchDef }),
    })
    const row = rows.web_fetch
    expect(row.captured()).toBe(true)
    expect(row.mountCondition).toBe('always')
    const exec = { agent: { id: 'agent-g2' } }
    const plan = okOutcome(await row.invoke({ url: 'https://example.com/a?x=1' }, exec))
    expect(fetchDef.calls.length).toBe(1)
    expect(fetchDef.calls[0]).toEqual({ args: { url: 'https://example.com/a?x=1' }, exec })
    expect(plan.targetManifest['destinationOrigin']).toBe('https://example.com')
    expect(plan.targetManifest['url']).toBe('https://example.com/a?x=1')
    expect(plan.effects).toEqual([
      { kind: 'tool-invoke', toolName: 'web_fetch', resource: null },
      { kind: 'connect', resource: { realmId: 'realm-g2', kind: 'network-destination', canonicalLocator: 'https://example.com', rights: ['connect'] } },
    ])
    // the arm's own output walks the Guard's closed-world parser:
    expect(parseRequestedEffectSet(plan.effects).ok).toBe(true)
    expect(plan.parametersFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(plan.reviewPayload).toMatchObject({ familyId: 'B-WEB', adapterRevision: A.A5_G2_ADAPTER_REVISION, providerIdentity: 'test-assembly' })
  })

  it('web_fetch: closed root and argument law — unknown parameter, blank url and a non-http scheme all refuse typed with ZERO delegation', async () => {
    const fetchDef = nativeDouble('web_fetch')
    const rows = A.createG2WebAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom({ web_fetch: fetchDef }) })
    const row = rows.web_fetch
    expect((await row.classify({ url: 'https://a.example', extra: 1 })).code).toBe(CODES.UNKNOWN_PARAMETER)
    expect((await row.classify({ url: '' })).code).toBe(CODES.INVALID_ARGUMENTS)
    expect((await row.classify({ url: 'file:///etc/passwd' })).code).toBe(CODES.DESTINATION_UNSUPPORTED_SCHEME)
    expect((await row.invoke({ url: 'ftp://x.example/y' })).code).toBe(CODES.DESTINATION_UNSUPPORTED_SCHEME)
    expect(fetchDef.calls.length).toBe(0)
  })

  it('web_search: live-delegate leg over the DECLARED search origin — queries trim into the manifest, connect answers the provider origin, native enters once', async () => {
    const searchDef = nativeDouble('web_search', { sources: [] })
    const rows = A.createG2WebAdapters({
      realmId: 'realm-g2',
      providerId: 'test-assembly',
      readNative: readNativeFrom({ web_search: searchDef }),
      searchOrigin: 'https://search.deepseek.example/v1',
    })
    const plan = okOutcome(await rows.web_search.invoke({ queries: ['  dsh governance ', 'm0 b-family'] }))
    expect(searchDef.calls.length).toBe(1)
    expect(plan.targetManifest['queriesSummary']).toEqual(['dsh governance', 'm0 b-family'])
    expect(connectLocator(plan)).toBe('https://search.deepseek.example')
    expect(parseRequestedEffectSet(plan.effects).ok).toBe(true)
  })

  it('web_search WITHOUT a declared search origin (the dispatch example): mountCondition always keeps the row present, every call refuses P_G2_NO_DECLARED_DESTINATION — the egress is never hidden, never a fixed-URL fake, zero native entry', async () => {
    const searchDef = nativeDouble('web_search')
    const rows = A.createG2WebAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom({ web_search: searchDef }) })
    expect(rows.web_search.active).toBe(true)
    expect((await rows.web_search.classify({ queries: ['anything'] })).code).toBe(CODES.NO_DECLARED_DESTINATION)
    expect((await rows.web_search.invoke({ queries: ['anything'] })).code).toBe(CODES.NO_DECLARED_DESTINATION)
    expect(searchDef.calls.length).toBe(0)
  })

  it('web_search argument law: empty list, blank query and over-cap refuse typed (non-empty lives in classify — the host keyword subset carries no minItems)', async () => {
    const searchDef = nativeDouble('web_search')
    const rows = A.createG2WebAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom({ web_search: searchDef }), searchOrigin: 'https://s.example', maxQueries: 2 })
    expect((await rows.web_search.classify({ queries: [] })).code).toBe(CODES.INVALID_ARGUMENTS)
    expect((await rows.web_search.classify({ queries: ['  '] })).code).toBe(CODES.INVALID_ARGUMENTS)
    expect((await rows.web_search.classify({ queries: ['a', 'b', 'c'] })).code).toBe(CODES.INVALID_ARGUMENTS)
    expect(searchDef.calls.length).toBe(0)
  })

  it('FULL-VALUES fingerprint (fix card 3): the fingerprint covers the COMPLETE ACTUAL arguments the native receives verbatim — a whitespace-only summary difference still moves the fingerprint; the trimmed summary rides alongside, never replaces', async () => {
    const padded = nativeDouble('web_search')
    const rows = A.createG2WebAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom({ web_search: padded }), searchOrigin: 'https://s.example' })
    const withPad = await rows.web_search.classify({ queries: [' dsh ', 'x'] })
    const trimmed = await rows.web_search.classify({ queries: ['dsh', 'x'] })
    expect(withPad.parametersFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(withPad.parametersFingerprint).not.toBe(trimmed.parametersFingerprint) // summary trim NEVER hides a value difference
    const odd = okOutcome(await rows.web_search.invoke({ queries: ['ünïcode 🚀  spaced', 'dsh', 'dsh'] }))
    expect(odd.actualArgs).toEqual({ queries: ['ünïcode 🚀  spaced', 'dsh', 'dsh'] }) // the FULL values, order and duplicates kept
    expect(padded.calls.at(-1)?.args).toEqual({ queries: ['ünïcode 🚀  spaced', 'dsh', 'dsh'] }) // native receives exactly these
    expect(odd.targetManifest['queriesSummary']).toEqual(['ünïcode 🚀  spaced', 'dsh', 'dsh'])
  })

  it('provider-identity CURRENT facts (fix card 2): the plan freezes the CLASSIFY-TIME provider identity while the captured native RE-RESOLVES its provider at execute (the resolveProvider-varies double proves the seam re-selects per call); with no trusted reader the manifest answers the named blocker, never an invented identity', async () => {
    let providerNow = 'deepseek-v1'
    let releaseGate: (() => void) | undefined
    const gate = new Promise<void>((res) => { releaseGate = res })
    const searchDef: NativeDouble = {
      name: 'web_search',
      description: 'resolveProvider-at-execute double',
      calls: [],
      execute: async (args: unknown, exec: unknown) => {
        await gate // the body reaches the provider seam only later…
        searchDef.calls.push({ args, exec, servedBy: providerNow })
        return { sources: [] }
      },
    }
    let reads = 0
    const rows = A.createG2WebAdapters({
      realmId: 'realm-g2',
      providerId: 'test-assembly',
      readNative: readNativeFrom({ web_search: searchDef }),
      readProviderFacts: () => { reads += 1; return { searchProviderId: providerNow, searchOrigin: 'https://search.deepseek.example/v1' } },
    })
    const running = rows.web_search.invoke({ queries: ['q'] })
    providerNow = 'exa-v2' // …the mounted generation moves while the call is in flight
    releaseGate?.()
    const plan = okOutcome(await running)
    expect(reads).toBe(1) // ONE read per classify
    expect((JSON.parse(String(plan.targetManifest['providerIdentityAtClassify'])) as Record<string, unknown>)['searchProviderId']).toBe('deepseek-v1') // plan froze CLASSIFY-TIME identity (ROOT 02:17: canonical-JSON-string leaf, parsed back losslessly)
    expect(plan.targetManifest['destinationOrigin']).toBe('https://search.deepseek.example') // destination from the CURRENT reader fact, never invented
    expect(String(plan.targetManifest['providerOriginSource'])).toMatch(/readProviderFacts/)
    expect(searchDef.calls[0]).toMatchObject({ servedBy: 'exa-v2' }) // the body rode the EXECUTE-TIME provider — the row never claims otherwise
    // no trusted reader ⇒ honest `observed:false` + the named blocker verbatim:
    const bare = A.createG2WebAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom({ web_search: nativeDouble('web_search') }), searchOrigin: 'https://s.example' })
    const res = await bare.web_search.classify({ queries: ['q'] })
    const facts = JSON.parse(String(res.targetManifest?.['providerIdentityAtClassify'])) as Record<string, unknown>
    expect(facts['observed']).toBe(false)
    expect(facts['reason']).toBe(A.A5_G2_NAMED_BLOCKERS.WEB)
  })

  it('native face ABSENT on the capture seam (mountCondition always): the row refuses P_G2_NATIVE_FACE_ABSENT typed at classify AND invoke — never a substitute body, zero entries', async () => {
    const rows = A.createG2WebAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: () => undefined })
    for (const name of ['web_fetch', 'web_search'] as const) {
      expect(rows[name].active).toBe(true)
      expect(rows[name].captured()).toBe(false)
      const args = name === 'web_fetch' ? { url: 'https://a.example' } : { queries: ['q'] }
      expect((await rows[name].classify(args)).code).toBe(CODES.NATIVE_FACE_ABSENT)
      expect((await rows[name].invoke(args)).code).toBe(CODES.NATIVE_FACE_ABSENT)
    }
  })

  it('definition drift after bind: the delegate refuses P_G2_DEFINITION_DRIFT and the swapped body never runs', async () => {
    const fetchDef = nativeDouble('web_fetch')
    const rows = A.createG2WebAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom({ web_fetch: fetchDef }) })
    fetchDef.execute = async () => 'hijacked'
    const out = await rows.web_fetch.invoke({ url: 'https://a.example' })
    expect(out.code).toBe(CODES.DEFINITION_DRIFT)
    expect(fetchDef.calls.length).toBe(0)
  })

  it('drain: after teardown begins every NEW call refuses P_G2_DRAINING (and no native fallback exists to fall back to)', async () => {
    const fetchDef = nativeDouble('web_fetch')
    const rows = A.createG2WebAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom({ web_fetch: fetchDef }) })
    rows.web_fetch.drain()
    expect((await rows.web_fetch.invoke({ url: 'https://a.example' })).code).toBe(CODES.DRAINING)
    expect(fetchDef.calls.length).toBe(0)
    expect(rows.web_fetch.drainSemantics).toBe(A.A5_G2_DRAIN_SEMANTICS)
  })

  it('drain boundary HONESTY (fix card 4): drain forbids NEW invokes and does NOT clear IN-FLIGHT ones — an entered body settles honestly and the row-face text states exactly this', async () => {
    let releaseBody: ((v: unknown) => void) | undefined
    const slow: NativeDouble = {
      name: 'web_fetch',
      description: 'slow native',
      calls: [],
      execute: async (args: unknown, exec: unknown) => {
        slow.calls.push({ args, exec })
        return await new Promise<unknown>((res) => { releaseBody = res })
      },
    }
    const rows = A.createG2WebAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom({ web_fetch: slow }) })
    const inFlight = rows.web_fetch.invoke({ url: 'https://a.example' }) // the body is entered synchronously
    rows.web_fetch.drain() // teardown begins WHILE the body is inside the native
    expect(rows.web_fetch.drainSemantics).toMatch(/not rewound, NOT cleared|NOT rewound/)
    releaseBody?.('served-while-draining')
    const out = await inFlight
    expect(out.ok).toBe(true) // the in-flight call is NOT cleared — it settles truthfully
    expect((await rows.web_fetch.invoke({ url: 'https://b.example' })).code).toBe(CODES.DRAINING) // NEW entries are refused from drain on
    expect(slow.calls.length).toBe(1)
  })
})

// ── B-MCP (records 55/56/57 + surfaces 89/90) — declared_mount ─────────────
describe('a5m2-g2 B-MCP', () => {
  it('declared STDIO mount: trio live-delegates; effects stay I-only (the local spawn envelope is MANIFEST NOTATION, not a fake connect); the surface:mcp_stdio record rides every manifest with the spawn facts; read carries the OPAQUE uri verbatim', async () => {
    const defs = {
      list_mcp_resources: nativeDouble('list_mcp_resources', { resources: [] }),
      list_mcp_resource_templates: nativeDouble('list_mcp_resource_templates', { resourceTemplates: [] }),
      read_mcp_resource: nativeDouble('read_mcp_resource', { contents: [] }),
    }
    const rows = A.createG2McpResourceAdapters({
      realmId: 'realm-g2',
      providerId: 'test-assembly',
      readNative: readNativeFrom(defs),
      declaredService: { present: true, serverName: 'local-tool', transport: 'stdio', command: ['/usr/local/bin/local-tool', '--stdio'], cwd: '/srv/mcp' },
    })
    for (const name of MCP_TOOL_NAMES) expect(rows[name].active).toBe(true)
    const listed = okOutcome(await rows.list_mcp_resources.invoke({ server: 'local-tool' }))
    expect(defs.list_mcp_resources.calls.length).toBe(1)
    expect(listed.effects).toEqual([{ kind: 'tool-invoke', toolName: 'list_mcp_resources', resource: null }])
    // FLAT mint (D1-D3, signed migration): the surface projects LOSSLESSLY
    // at top level; the nested object is GONE (asserted absent).
    expect(listed.targetManifest['surface']).toBeUndefined()
    expect(listed.targetManifest['mcpVariant']).toBe('stdio:list')
    expect({
      record: listed.targetManifest['record'],
      transport: listed.targetManifest['transport'],
      connectionIncarnation: listed.targetManifest['connectionIncarnation'],
      spawnArgv0: listed.targetManifest['spawnArgv0'],
      spawnArgCount: listed.targetManifest['spawnArgCount'],
      spawnCwd: listed.targetManifest['spawnCwd'],
    }).toEqual({
      record: 'surface:mcp_stdio',
      transport: 'stdio',
      connectionIncarnation: 'unobserved',
      spawnArgv0: '/usr/local/bin/local-tool',
      spawnArgCount: 1,
      spawnCwd: '/srv/mcp',
    })
    expect(listed.targetManifest['operation']).toBe('resources/list')
    const read = okOutcome(await rows.read_mcp_resource.invoke({ server: 'local-tool', uri: 'mcp://local-tool/blob/../../weird%20path' }))
    // opaque URI law (record 57): verbatim pass-through, no path/URL reading.
    expect(read.targetManifest['uriVerbatim']).toBe('mcp://local-tool/blob/../../weird%20path')
    expect(defs.read_mcp_resource.calls[0]?.args).toEqual({ server: 'local-tool', uri: 'mcp://local-tool/blob/../../weird%20path' })
    for (const name of MCP_TOOL_NAMES) {
      const args = name === 'read_mcp_resource' ? { server: 'local-tool', uri: 'x:1' } : { server: 'local-tool' }
      const res = await rows[name].classify(args)
      expect(res.ok, name).toBe(true)
      expect(parseRequestedEffectSet(res.effects ?? []).ok).toBe(true)
    }
  })

  it('declared HTTP-DYNAMIC mount: connect(endpointOrigin) joins the effects, the surface:mcp_http_dynamic record rides, cursor passes through; a server argument that is NOT the declared server refuses (name prefixes are non-authoritative)', async () => {
    const defs = {
      list_mcp_resources: nativeDouble('list_mcp_resources'),
      list_mcp_resource_templates: nativeDouble('list_mcp_resource_templates'),
      read_mcp_resource: nativeDouble('read_mcp_resource'),
    }
    const rows = A.createG2McpResourceAdapters({
      realmId: 'realm-g2',
      providerId: 'test-assembly',
      readNative: readNativeFrom(defs),
      declaredService: { present: true, serverName: 'remote-api', transport: 'streamable-http', endpointUrl: 'https://mcp.example:8443/mcp', headersPresent: true, headerCount: 2, domainAuthorityId: 'da-remote' },
    })
    const plan = okOutcome(await rows.list_mcp_resource_templates.invoke({ server: 'remote-api', cursor: 'cur-2' }))
    expect(plan.effects).toEqual([
      { kind: 'tool-invoke', toolName: 'list_mcp_resource_templates', resource: null },
      { kind: 'connect', resource: { realmId: 'realm-g2', kind: 'network-destination', canonicalLocator: 'https://mcp.example:8443', rights: ['connect'] } },
      { kind: 'domain-ref', domainAuthorityId: 'da-remote', resource: null },
    ])
    expect(parseRequestedEffectSet(plan.effects).ok).toBe(true)
    expect(plan.targetManifest['record']).toBe('surface:mcp_http_dynamic') // FLAT (D1)
    expect(plan.targetManifest['endpointOrigin']).toBe('https://mcp.example:8443')
    expect(plan.targetManifest['cursor']).toBe('cur-2')
    // header VALUES never ride the manifest (presence is a provider-side fact)
    expect(JSON.stringify(plan.targetManifest)).not.toContain('secret-value')
    const swap = await rows.list_mcp_resources.classify({ server: 'other-server' })
    expect(swap.code).toBe(CODES.INVALID_ARGUMENTS)
    expect(defs.list_mcp_resources.calls.length).toBe(0)
    // read_mcp_resource declares no cursor (closed root):
    expect((await rows.read_mcp_resource.classify({ server: 'remote-api', uri: 'u', cursor: 'nope' })).code).toBe(CODES.UNKNOWN_PARAMETER)
  })

  it('declared_mount ABSENT: the trio returns honest INACTIVE rows — classify and invoke refuse P_G2_DECLARED_MOUNT_ABSENT with zero native entry; nothing mounts, nothing substitutes', async () => {
    const defs = {
      list_mcp_resources: nativeDouble('list_mcp_resources'),
      list_mcp_resource_templates: nativeDouble('list_mcp_resource_templates'),
      read_mcp_resource: nativeDouble('read_mcp_resource'),
    }
    for (const proof of [undefined, { present: false }, { serverName: 'x', transport: 'stdio' }]) {
      const rows = A.createG2McpResourceAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom(defs), declaredService: proof })
      for (const name of MCP_TOOL_NAMES) {
        expect(rows[name].active).toBe(false)
        expect(rows[name].mountCondition).toBe('declared_mount')
        expect((await rows[name].classify({ server: 'x' })).code).toBe(CODES.DECLARED_MOUNT_ABSENT)
        expect((await rows[name].invoke({ server: 'x' })).code).toBe(CODES.DECLARED_MOUNT_ABSENT)
      }
    }
    for (const def of Object.values(defs)) expect(def.calls.length).toBe(0)
  })

  it('CURRENT-facts law (fix card 2): the injected connectionIncarnation is the frozen CLASSIFY-TIME transport fact; without it the manifest states the NAMED BLOCKER (the request leg re-selects at REQUEST time — wrapper identity is not the incarnation)', async () => {
    const defs = {
      list_mcp_resources: nativeDouble('list_mcp_resources'),
      list_mcp_resource_templates: nativeDouble('list_mcp_resource_templates'),
      read_mcp_resource: nativeDouble('read_mcp_resource'),
    }
    const withInc = A.createG2McpResourceAdapters({
      realmId: 'realm-g2',
      providerId: 'test-assembly',
      readNative: readNativeFrom(defs),
      declaredService: { present: true, serverName: 'remote-api', transport: 'streamable-http', endpointUrl: 'https://mcp.example/mcp', connectionIncarnation: 'conn-gen-7' },
    })
    const plan = okOutcome(await withInc.list_mcp_resources.invoke({ server: 'remote-api' }))
    expect(plan.targetManifest['surface']).toBeUndefined() // FLAT (D1)
    expect(plan.targetManifest['connectionIncarnation']).toBe('conn-gen-7') // the owner-injected CURRENT fact, frozen at classify
    expect(plan.targetManifest['mcpVariant']).toBe('http:list')
    expect(plan.targetManifest['connectionIncarnationReason']).toBeNull() // D2 always-emit: MEASURED ABSENCE is null, not a missing key
    expect(plan.targetManifest['providerReSelectionLaw']).toMatch(/REQUEST time/)
    const bare = A.createG2McpResourceAdapters({
      realmId: 'realm-g2',
      providerId: 'test-assembly',
      readNative: readNativeFrom(defs),
      declaredService: { present: true, serverName: 'remote-api', transport: 'streamable-http', endpointUrl: 'https://mcp.example/mcp' },
    })
    const res = await bare.list_mcp_resources.classify({ server: 'remote-api' })
    expect(res.targetManifest?.['connectionIncarnation']).toBe('unobserved') // FLAT (D1): the NAMED-BLOCKER pairing rides the flat leaf
    expect(res.targetManifest?.['connectionIncarnationReason']).toBe(A.A5_G2_NAMED_BLOCKERS.MCP)
  })

  it('SURFACES (surface_invariant, records 89/90): stdio vs streamable-http classify apart with their distinct envelopes; an unknown transport and missing transport-critical facts are typed assembly throws', () => {
    const stdio = A.classifyG2McpSurface({ serverName: 's1', transport: 'stdio', command: ['node', 'server.js'] })
    expect(stdio).toMatchObject({ record: 'surface:mcp_stdio', transport: 'stdio', spawn: { argv0: 'node', argCount: 1 } })
    const http = A.classifyG2McpSurface({ serverName: 's2', transport: 'streamable-http', endpointUrl: 'https://h.example/mcp' })
    expect(http).toMatchObject({ record: 'surface:mcp_http_dynamic', transport: 'streamable-http', endpointOrigin: 'https://h.example' })
    expect(() => A.classifyG2McpSurface({ serverName: 's3', transport: 'grpc' })).toThrow(new RegExp(CODES.SURFACE_TRANSPORT_UNKNOWN))
    expect(() => A.classifyG2McpSurface({ serverName: 's4', transport: 'stdio' })).toThrow(new RegExp(CODES.SURFACE_FACTS_INCOMPLETE))
    expect(() => A.classifyG2McpSurface({ serverName: 's5', transport: 'streamable-http' })).toThrow(new RegExp(CODES.SURFACE_FACTS_INCOMPLETE))
    expect(() => A.classifyG2McpSurface({ serverName: 's6', transport: 'streamable-http', endpointUrl: 'file:///nope' })).toThrow(/P_G2_SURFACE_FACTS_INCOMPLETE.*http\(s\) destinations only/)
  })
})

// ── B-BROWSER (records 58–63) — declared_mount ─────────────────────────────
describe('a5m2-g2 B-BROWSER', () => {
  const launchProof: Record<string, unknown> = { present: true, mode: 'launch', modelOrigin: 'https://stagehand-model.example/v1' }

  function sixDoubles(): Record<string, NativeDouble> {
    return Object.fromEntries(BROWSER_TOOL_NAMES.map((n) => [n, nativeDouble(n, { content: [] })]))
  }

  it('declared launch mount: all six live-delegate to the captured execute; navigate emits the destination connect; act keeps the SINGLE-instruction API and carries the model-origin connect + instruction digest; tabs enforces the native branch law; screenshot writes nothing here', async () => {
    const defs = sixDoubles()
    const rows = A.createG2BrowserAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom(defs), declaredService: launchProof })
    for (const name of BROWSER_TOOL_NAMES) expect(rows[name].active).toBe(true)

    const nav = okOutcome(await rows.stagehand_navigate.invoke({ url: 'https://target.example/page' }, EXEC))
    expect(nav.effects).toEqual([
      { kind: 'tool-invoke', toolName: 'stagehand_navigate', resource: null },
      { kind: 'connect', resource: { realmId: 'realm-g2', kind: 'network-destination', canonicalLocator: 'https://target.example', rights: ['connect'] } },
    ])
    expect(defs['stagehand_navigate']?.calls.length).toBe(1)

    const act = okOutcome(await rows.stagehand_act.invoke({ instruction: 'submit the form', pageId: 'tab-1' }))
    expect(connectLocator(act)).toBe('https://stagehand-model.example')
    expect(act.targetManifest['instructionDigest']).toMatch(/^[0-9a-f]{64}$/)
    expect(act.targetManifest['operation']).toBe('browser-act')
    expect(defs['stagehand_act']?.calls[0]?.args).toEqual({ instruction: 'submit the form', pageId: 'tab-1' })

    for (const name of ['stagehand_observe', 'stagehand_extract'] as const) {
      const out = okOutcome(await rows[name].invoke({ instruction: 'look' }))
      expect(defs[name]?.calls.length).toBe(1)
      expect(parseRequestedEffectSet(out.effects).ok).toBe(true)
    }

    expect((await rows.stagehand_tabs.classify({ action: 'select' })).code).toBe(CODES.INVALID_ARGUMENTS) // native law: select needs pageId
    // FIX CARD RULING 1 (the corrected pin): native tabs(new,url) does
    // `context.newPage(url)` — net connect + page creation — so the connect
    // to the tab URL MUST be carried. The previous I-only expectation was a
    // 固化漏报 and is retired here.
    const tabsNew = okOutcome(await rows.stagehand_tabs.invoke({ action: 'new', url: 'https://new.example' }))
    expect(tabsNew.targetManifest['branch']).toBe('new')
    expect(tabsNew.effects).toEqual([
      { kind: 'tool-invoke', toolName: 'stagehand_tabs', resource: null },
      { kind: 'connect', resource: { realmId: 'realm-g2', kind: 'network-destination', canonicalLocator: 'https://new.example', rights: ['connect'] } },
    ])
    expect(parseRequestedEffectSet(tabsNew.effects).ok).toBe(true)
    const tabsList = okOutcome(await rows.stagehand_tabs.invoke({ action: 'list' }))
    expect(tabsList.effects).toEqual([{ kind: 'tool-invoke', toolName: 'stagehand_tabs', resource: null }]) // no URL branch ⇒ no connect
    const shot = okOutcome(await rows.stagehand_screenshot.invoke({ fullPage: true }))
    expect(shot.effects).toEqual([{ kind: 'tool-invoke', toolName: 'stagehand_screenshot', resource: null }]) // launch mode: no attach leg
    // the pre-effect boundary is stated ON THE ROW FACE (fix card 4):
    for (const name of BROWSER_TOOL_NAMES) expect(rows[name].preEffectDisclosure).toBe(A.A5_G2_NAMED_BLOCKERS.BROWSER)
  })

  it('ATTACH mount (fix card 4): the CDP endpoint is ITSELF a connect carried on every row; the row face carries the NAMED BLOCKER verbatim and makes NO zero-launch claim (resources.run can launch/attach BEFORE the captured body)', async () => {
    expect(A.A5_G2_NAMED_BLOCKERS.BROWSER).toMatch(/CANNOT guarantee Ask-pending zero-launch/)
    expect(A.A5_G2_NAMED_BLOCKERS.BROWSER).toMatch(/pre-effect resource hook/)
    const defs = sixDoubles()
    const rows = A.createG2BrowserAdapters({
      realmId: 'realm-g2',
      providerId: 'test-assembly',
      readNative: readNativeFrom(defs),
      declaredService: { present: true, mode: 'attach', cdpEndpointOrigin: 'http://127.0.0.1:9222', modelOrigin: 'https://model.example' },
    })
    const shot = okOutcome(await rows.stagehand_screenshot.invoke({}))
    expect(shot.effects).toEqual([
      { kind: 'tool-invoke', toolName: 'stagehand_screenshot', resource: null },
      { kind: 'connect', resource: { realmId: 'realm-g2', kind: 'network-destination', canonicalLocator: 'http://127.0.0.1:9222', rights: ['connect'] } },
    ])
    expect(parseRequestedEffectSet(shot.effects).ok).toBe(true)
    const nav = okOutcome(await rows.stagehand_navigate.invoke({ url: 'https://t.example/p' }))
    const locators = nav.effects.filter((e) => e['kind'] === 'connect').map((e) => (e['resource'] as Record<string, unknown>)['canonicalLocator'])
    expect(locators).toEqual(['https://t.example', 'http://127.0.0.1:9222']) // target AND cdp
    expect(nav.targetManifest['attachEndpointOrigin']).toBe('http://127.0.0.1:9222')
    const act = okOutcome(await rows.stagehand_act.invoke({ instruction: 'click' }))
    expect(act.effects.filter((e) => e['kind'] === 'connect').length).toBe(2) // model AND cdp
  })

  it('act/observe/extract WITHOUT a declared model origin refuse P_G2_NO_DECLARED_DESTINATION — page-content-to-model is never hidden — zero native entry', async () => {
    const defs = sixDoubles()
    const rows = A.createG2BrowserAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom(defs), declaredService: { present: true, mode: 'launch' } })
    for (const name of ['stagehand_act', 'stagehand_observe', 'stagehand_extract'] as const) {
      expect((await rows[name].classify({ instruction: 'x' })).code).toBe(CODES.NO_DECLARED_DESTINATION)
    }
    // navigate/tabs/screenshot carry no model leg — they still delegate:
    expect(okOutcome(await rows.stagehand_navigate.invoke({ url: 'https://ok.example' })).correlation).toContain('stagehand_navigate')
    for (const name of ['stagehand_act', 'stagehand_observe', 'stagehand_extract'] as const) expect(defs[name]?.calls.length).toBe(0)
  })

  it('declared_mount ABSENT (host-experimental-bundle-off default): all six rows are INACTIVE, every call refuses P_G2_DECLARED_MOUNT_ABSENT, zero native entry, zero substitution', async () => {
    const defs = sixDoubles()
    const rows = A.createG2BrowserAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom(defs), declaredService: undefined })
    for (const name of BROWSER_TOOL_NAMES) {
      expect(rows[name].active).toBe(false)
      expect(rows[name].mountCondition).toBe('declared_mount')
      expect((await rows[name].classify({ instruction: 'x', url: 'https://a.example' })).code).toBe(CODES.DECLARED_MOUNT_ABSENT)
      expect((await rows[name].invoke({ instruction: 'x' })).code).toBe(CODES.DECLARED_MOUNT_ABSENT)
    }
    for (const def of Object.values(defs)) expect(def.calls.length).toBe(0)
  })

  it('assembly defects throw typed: unknown mode, attach without cdpEndpointOrigin, an unparsable declared model origin — a half-declared browser service never mounts; navigate refuses non-http(s) (stricter than native z.url())', async () => {
    const base = { realmId: 'realm-g2', providerId: 'test-assembly', readNative: readNativeFrom(sixDoubles()) }
    expect(() => A.createG2BrowserAdapters({ ...base, declaredService: { present: true, mode: 'proxy' } })).toThrow(new RegExp(CODES.SURFACE_FACTS_INCOMPLETE))
    expect(() => A.createG2BrowserAdapters({ ...base, declaredService: { present: true, mode: 'attach' } })).toThrow(new RegExp(CODES.SURFACE_FACTS_INCOMPLETE))
    expect(() => A.createG2BrowserAdapters({ ...base, declaredService: { ...launchProof, modelOrigin: 'gopher://x' } })).toThrow(/P_G2_SURFACE_FACTS_INCOMPLETE.*http\(s\) destinations only/)
    const rows = A.createG2BrowserAdapters({ ...base, declaredService: launchProof })
    expect((await rows.stagehand_navigate.classify({ url: 'javascript:alert(1)' })).code).toBe(CODES.DESTINATION_UNSUPPORTED_SCHEME)
  })
})

// ── census against the frozen dispatch index ───────────────────────────────
describe('a5m2-g2 census (frozen dispatch index)', () => {
  const index = JSON.parse(readFileSync(join(REPO, 'docs', 'plans', 'active', 'alpha5-tool-io-governance', 'm0-closure-v3', 'M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json'), 'utf8')) as {
    records: Array<{ name: string; family: string; mountCondition: string }>
  }
  const mine = index.records.filter((r) => ['B-WEB', 'B-MCP', 'B-BROWSER'].includes(r.family))

  it('the eleven tool rows + two surface records equal the index exactly, with the frozen mount conditions', () => {
    const toolRecords = mine.filter((r) => !r.name.startsWith('surface:'))
    const surfaceRecords = mine.filter((r) => r.name.startsWith('surface:'))
    expect(toolRecords.map((r) => r.name).sort()).toEqual([...BROWSER_TOOL_NAMES, ...MCP_TOOL_NAMES, 'web_fetch', 'web_search'].sort())
    expect(surfaceRecords.map((r) => r.name).sort()).toEqual(['surface:mcp_http_dynamic', 'surface:mcp_stdio'])
    const web = A.createG2WebAdapters({ realmId: 'r', providerId: 'p', readNative: () => undefined, searchOrigin: 'https://s.example' })
    expect(Object.keys(web).sort()).toEqual(['web_fetch', 'web_search'])
    const mcp = A.createG2McpResourceAdapters({ realmId: 'r', providerId: 'p', readNative: () => undefined })
    expect(Object.keys(mcp).sort()).toEqual([...MCP_TOOL_NAMES].sort())
    const browser = A.createG2BrowserAdapters({ realmId: 'r', providerId: 'p', readNative: () => undefined })
    expect(Object.keys(browser).sort()).toEqual([...BROWSER_TOOL_NAMES].sort())
    const allRows: Record<string, G2Row> = { ...web, ...mcp, ...browser }
    for (const record of mine) {
      if (record.name.startsWith('surface:')) {
        expect(record.mountCondition).toBe('surface_invariant') // surfaces classify through classifyG2McpSurface
        continue
      }
      const row = allRows[record.name]
      expect(row, record.name).toBeDefined()
      expect(row?.mountCondition, record.name).toBe(record.mountCondition)
    }
  })
})

// ── r9 placement-face law: REAL Host639 validator fixed point ──────────────
describe('a5m2-g2 r9 registration fixed point (REAL Host639 validator)', () => {
  const hostTools = join(REPO, 'tests', 'deepseek-harness-test-use', 'packages', 'core', 'tools', 'lib', 'index.js')
  type HostTools = {
    assertSupportedJsonSchema: (schema: unknown) => void
    validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
  }

  async function loadHost(): Promise<HostTools> {
    if (!existsSync(hostTools)) throw new Error(`pristine host lib absent (${hostTools}); failing closed`)
    return (await import(pathToFileURL(hostTools).href)) as unknown as HostTools
  }

  it('every one of the eleven registration faces IS a canonical host registration face: the REAL assertSupportedJsonSchema accepts it, NO property-level required marker survives anywhere (deep sweep), parent required arrays are exact', async () => {
    const host = await loadHost()
    const marker = (node: unknown): boolean => {
      if (node === null || typeof node !== 'object') return false
      const rec = node as Record<string, unknown>
      if (Object.hasOwn(rec, 'required') && rec.required === true) return true
      const props = rec.properties
      if (props !== null && typeof props === 'object') {
        for (const child of Object.values(props as Record<string, unknown>)) if (marker(child)) return true
      }
      if (rec.items !== undefined && marker(rec.items)) return true
      return false
    }
    const expectedRequired: Record<string, string[]> = {
      web_fetch: ['url'],
      web_search: ['queries'],
      list_mcp_resources: ['server'],
      list_mcp_resource_templates: ['server'],
      read_mcp_resource: ['server', 'uri'],
      stagehand_navigate: ['url'],
      stagehand_tabs: ['action'],
      stagehand_screenshot: [],
      stagehand_act: ['instruction'],
      stagehand_observe: ['instruction'],
      stagehand_extract: ['instruction'],
    }
    expect(Object.keys(A.A5_G2_REGISTRATION_SCHEMAS).sort()).toEqual(Object.keys(expectedRequired).sort())
    for (const [name, schema] of Object.entries(A.A5_G2_REGISTRATION_SCHEMAS)) {
      expect(() => host.assertSupportedJsonSchema(schema), name).not.toThrow()
      expect(marker(schema), `${name} property-level required marker`).toBe(false)
      expect(schema.required, `${name} parent required array`).toEqual(expectedRequired[name])
    }
  })

  it('the SAME host validator REJECTS the missing-member shapes (constraints bind) and walks complete values clean', async () => {
    const host = await loadHost()
    const S = A.A5_G2_REGISTRATION_SCHEMAS
    expect(host.validateJsonSchemaValue(S['web_fetch'], {}, '').join(';')).toMatch(/url/)
    expect(host.validateJsonSchemaValue(S['web_fetch'], { url: 'https://a.example' }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(S['web_fetch'], { url: 'https://a.example', extra: 1 }, '').join(';')).not.toBe('')
    expect(host.validateJsonSchemaValue(S['web_search'], {}, '').join(';')).toMatch(/queries/)
    expect(host.validateJsonSchemaValue(S['web_search'], { queries: ['a', 'b'] }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(S['list_mcp_resources'], { cursor: 'c' }, '').join(';')).toMatch(/server/)
    expect(host.validateJsonSchemaValue(S['list_mcp_resource_templates'], { server: 's' }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(S['read_mcp_resource'], { server: 's' }, '').join(';')).toMatch(/uri/)
    expect(host.validateJsonSchemaValue(S['read_mcp_resource'], { server: 's', uri: 'u' }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(S['stagehand_navigate'], { pageId: 'p' }, '').join(';')).toMatch(/url/)
    expect(host.validateJsonSchemaValue(S['stagehand_tabs'], {}, '').join(';')).toMatch(/action/)
    expect(host.validateJsonSchemaValue(S['stagehand_tabs'], { action: 'nope' }, '').join(';')).not.toBe('')
    expect(host.validateJsonSchemaValue(S['stagehand_tabs'], { action: 'select', pageId: 'p' }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(S['stagehand_screenshot'], {}, '')).toEqual([])
    expect(host.validateJsonSchemaValue(S['stagehand_screenshot'], { fullPage: true }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(S['stagehand_act'], {}, '').join(';')).toMatch(/instruction/)
    expect(host.validateJsonSchemaValue(S['stagehand_act'], { instruction: 'go' }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(S['stagehand_observe'], { instruction: 'go' }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(S['stagehand_extract'], { instruction: 'go', schema: { type: 'object' } }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(S['stagehand_extract'], {}, '').join(';')).toMatch(/instruction/)
  })
})
