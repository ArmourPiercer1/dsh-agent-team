/**
 * A5M2-B-MCP-PAIRING-C1 — the whole-family owner's pairing leg (center card
 * M0/B-MCP): SIX REAL minted manifests (three tools × the two surfaces,
 * records 55/56/57 × 89/90) through the SAME published
 * `validatePaFamilyTarget('B-MCP', ...)` the durable consumption reads.
 *
 * Venue law: this branch already carries the center-authored B-MCP rule map
 * (root 19:28, f1e0c92ec) and the g2 lane's D1-D3 FLAT mint
 * (A5_G2_ADAPTER_REVISION = 3) plus the real mount path — NOTHING here
 * re-authors the table or the mint; what was MISSING is exactly this spec:
 * the minted object, not a transcription, entering the REAL table. The
 * mount end-to-end (real createG2TeamMount, gen-N first, team-bound dispatch,
 * rotation refusal) rides a5m2-g2-wire-c1.test.ts:954; the plane walk leg
 * rides its :791. This file adds the grammar-edge pairing and the surface
 * FACE-VALIDATION items the two surface records demand.
 *
 * Capture honesty: the three native faces are the DISCLOSED hand-built
 * doubles byte-pinned to packages/mcp/mcp-resources/src/tools.ts:32-61
 * @639ed01539 (names :34/:43/:52, descriptions :35/:44/:53, shared
 * listParameters :16-19, read parameters :55-58); the production capture is
 * tools.get(name, scope). REAL-SDK legs (C3 reconnect/incarnation) are the
 * kernel owner venue — never claimed here.
 *
 * NAMED GAPS (never silent): (1) connectionIncarnation is owner-INJECTED —
 * without an injected live generation the manifest states 'unobserved' +
 * the NAMED BLOCKER (B-MCP) verbatim (mount venue brings a real gen-N);
 * (2) the stdio spawn/FS/process envelope has NO closed effect kind — it
 * rides as MANIFEST NOTATION (spawnArgv0/spawnArgCount/spawnCwd) beside the
 * I leg with the provider-side obligation entry; (3) headerCount is NOT in
 * the rev-1 projection — the pinned extras refusal below IS the decision;
 * (4) the production g2McpEnabled flip is a preset surface, zero-flipped
 * here like every sibling.
 */
import { describe, expect, it } from 'vitest'
import { validatePaFamilyTarget } from '../control/types.js'

const G = (await import(new URL('../src/plugin/live/governed-families/g2-connector-adapters.mjs', import.meta.url).href)) as {
  A5_G2_FAMILY: Record<string, string>
  A5_G2_ADAPTER_REVISION: number
  A5_G2_NAMED_BLOCKERS: Record<string, string>
  A5_G2_REGISTRATION_SCHEMAS: Record<string, Record<string, unknown>>
  createG2McpResourceAdapters: (deps: Record<string, unknown>) => Record<string, {
    active: boolean
    toolName: string
    registrationSchema: Record<string, unknown>
    classify: (args: Record<string, unknown>) => Record<string, unknown>
  }>
}

const PROVIDER = 'a5p5-plane'
const REALM = 'a5m2-b-mcp-pairing'

// The three REAL faces, byte-pinned to tools.ts @639ed01539 (header).
const listParameters = {
  server: { type: 'string', required: true, description: 'Configured MCP server name.' },
  cursor: { type: 'string', description: 'Continuation cursor returned by this server.' },
}
const FACE = (name: string, description: string, parameters: unknown) => ({
  name,
  description,
  parameters,
  execute: async () => ({ ok: true }),
})
const FACES: Record<string, unknown> = {
  list_mcp_resources: FACE('list_mcp_resources', 'List resources available from an MCP server.', listParameters),
  list_mcp_resource_templates: FACE('list_mcp_resource_templates', 'List parameterized resource URI templates from an MCP server.', listParameters),
  read_mcp_resource: FACE('read_mcp_resource', 'Read an MCP resource by URI from the named server. Use a listed URI or an expanded resource template.', { server: listParameters.server, uri: { type: 'string', required: true, description: 'Resource URI to read.' } }),
}

const STDIO = {
  present: true,
  serverName: 'demo-mcp',
  transport: 'stdio',
  command: ['node', 'servers/demo.js', '--profile', 'strict'],
  cwd: '/srv/mcp/demo',
}
const HTTP = {
  present: true,
  serverName: 'demo-mcp',
  transport: 'streamable-http',
  endpointUrl: 'https://mcp.example.com/v1/mcp',
}

const rowsFor = (declared: Record<string, unknown>) => G.createG2McpResourceAdapters({
  realmId: REALM,
  providerId: PROVIDER,
  readNative: (name: string) => FACES[name],
  definitionIdentityOf: (d: unknown) => `def:${(d as { name: string }).name}`,
  declaredService: declared,
})

type Plan = { ok: true; targetManifest: Record<string, unknown>; effects: Record<string, unknown>[]; parametersFingerprint: string }
const planOf = (declared: Record<string, unknown>, toolName: string, args: Record<string, unknown>): Plan => {
  const res = rowsFor(declared)[toolName]?.classify(args) as Record<string, unknown>
  if (res?.ok !== true) throw new Error(`classify refused: ${String(res?.code ?? 'none')} ${String(res?.detail ?? '')}`)
  return res as unknown as Plan
}

const SHARED_KEYS = ['businessObligations', 'connectionIncarnation', 'connectionIncarnationReason', 'domainAuthorityId', 'mcpVariant', 'providerReSelectionLaw', 'server']
const STDIO_LIST_KEYS = [...SHARED_KEYS, 'cursor', 'operation', 'record', 'spawnArgCount', 'spawnArgv0', 'spawnCwd', 'transport'].sort()
const HTTP_LIST_KEYS = [...SHARED_KEYS, 'cursor', 'operation', 'record', 'transport', 'endpointOrigin'].sort()
const STDIO_READ_KEYS = [...SHARED_KEYS, 'operation', 'record', 'spawnArgCount', 'spawnArgv0', 'spawnCwd', 'transport', 'uriOpacity', 'uriVerbatim'].sort()
const HTTP_READ_KEYS = [...SHARED_KEYS, 'operation', 'record', 'transport', 'endpointOrigin', 'uriOpacity', 'uriVerbatim'].sort()

const URI = 'mcp://demo/res/42?mode=raw#frag'

describe('A5M2-B-MCP-PAIRING-C1 (whole-family owner pairing leg, center card M0/B-MCP)', () => {
  it('SIX REAL minted manifests ACCEPT at the REAL table, exact closed key sets, full values, zero digests', () => {
    const stdioList = planOf(STDIO, 'list_mcp_resources', { server: 'demo-mcp' })
    const stdioTemplates = planOf(STDIO, 'list_mcp_resource_templates', { server: 'demo-mcp', cursor: 'cur-7' })
    const stdioRead = planOf(STDIO, 'read_mcp_resource', { server: 'demo-mcp', uri: URI })
    const httpList = planOf(HTTP, 'list_mcp_resources', { server: 'demo-mcp', cursor: 'cur-7' })
    const httpTemplates = planOf(HTTP, 'list_mcp_resource_templates', { server: 'demo-mcp' })
    const httpRead = planOf(HTTP, 'read_mcp_resource', { server: 'demo-mcp', uri: URI })
    const all: Array<[string, Plan, string[]]> = [
      ['stdio:list', stdioList, STDIO_LIST_KEYS],
      ['stdio:templates', stdioTemplates, STDIO_LIST_KEYS],
      ['stdio:read', stdioRead, STDIO_READ_KEYS],
      ['http:list', httpList, HTTP_LIST_KEYS],
      ['http:templates', httpTemplates, HTTP_LIST_KEYS],
      ['http:read', httpRead, HTTP_READ_KEYS],
    ]
    for (const [label, plan, keys] of all) {
      // THE pairing leg: the minted object enters the REAL published law.
      expect(validatePaFamilyTarget('B-MCP', plan.targetManifest), label).toBeUndefined()
      expect(Object.keys(plan.targetManifest).sort(), label).toStrictEqual(keys)
      // FULL VALUES, never digests: nothing hashed rides the manifest.
      expect(JSON.stringify(plan.targetManifest), label).not.toContain('sha256:')
    }
    expect(stdioList.targetManifest.mcpVariant).toBe('stdio:list')
    expect(stdioTemplates.targetManifest.mcpVariant).toBe('stdio:templates')
    expect(stdioRead.targetManifest.mcpVariant).toBe('stdio:read')
    expect(httpList.targetManifest.mcpVariant).toBe('http:list')
    expect(httpList.targetManifest.transport).toBe('streamable-http') // the MEASURED spelling, never rewritten to the axis label
    expect(httpList.targetManifest.cursor).toBe('cur-7')
    expect(stdioList.targetManifest.cursor).toBeNull() // D2: cursor ALWAYS rides on list groups — null = none passed
    expect(stdioRead.targetManifest.uriVerbatim).toBe(URI) // opaque URI verbatim, query+frag intact
    expect(httpRead.targetManifest.uriOpacity).toContain('opaque MCP URI')
  })

  it('currentFields [mcpVariant,operation,record,transport] restate: fresh classifies restate the four dispatch-time constants byte-identical', () => {
    const a = planOf(STDIO, 'list_mcp_resources', { server: 'demo-mcp' }).targetManifest
    const b = planOf(STDIO, 'list_mcp_resources', { server: 'demo-mcp' }).targetManifest
    for (const field of ['mcpVariant', 'operation', 'record', 'transport']) {
      expect(String(b[field]), field).toBe(String(a[field]))
    }
    // they are dispatch-time constants of the ROW, never model text: the
    // cursor argument changes nothing among them.
    const c = planOf(STDIO, 'list_mcp_resources', { server: 'demo-mcp', cursor: 'cur-9' }).targetManifest
    expect([c.mcpVariant, c.operation, c.record, c.transport]).toStrictEqual([a.mcpVariant, a.operation, a.record, a.transport])
    // ...while the FULL-VALUES fingerprint moved with the argument (never a
    // summary stand-in):
    const p1 = planOf(STDIO, 'list_mcp_resources', { server: 'demo-mcp' })
    const p2 = planOf(STDIO, 'list_mcp_resources', { server: 'demo-mcp', cursor: 'cur-9' })
    expect(p2.parametersFingerprint).not.toBe(p1.parametersFingerprint)
    expect(p1.parametersFingerprint).toBe(planOf(STDIO, 'list_mcp_resources', { server: 'demo-mcp' }).parametersFingerprint)
  })

  it('the grammar edge denies with the REAL table\u2019s measured bytes: the no-silent pin, a crossed discriminant, structural no-cursor, the rev-1 headerCount decision, and the signed kind/nullable leaves', () => {
    const list = planOf(STDIO, 'list_mcp_resources', { server: 'demo-mcp' }).targetManifest
    const read = planOf(STDIO, 'read_mcp_resource', { server: 'demo-mcp', uri: URI }).targetManifest
    // NO SILENT TRANSLATION (the byte the landed table itself pinned):
    const { mcpVariant: _drop, ...noVariant } = list
    expect(String(validatePaFamilyTarget('B-MCP', noVariant))).toBe('mcpVariant: required by the B-MCP typed plan, absent')
    // crossed discriminant: stdio facts wearing the http group answer on the
    // MEASURED first adds violation — absence outranks the bind check (the
    // http group demands endpointOrigin the stdio mint never carries):
    expect(String(validatePaFamilyTarget('B-MCP', { ...list, mcpVariant: 'http:list' }))).toBe('endpointOrigin: required by the B-MCP typed plan, absent')
    // supplying that leaf moves the verdict to the record BIND constant —
    // the crossing can never silently re-key:
    // (the validator's bind-loop byte quotes the DISCRIMINANT value — its
    // own measured wording at control/types.ts:2200 @this tree):
    expect(String(validatePaFamilyTarget('B-MCP', { ...list, mcpVariant: 'http:list', endpointOrigin: 'https://mcp.example.com' }))).toBe("record: not the 'http:list' variant constant of the B-MCP typed plan")
    // 'read declares no cursor' is STRUCTURAL at the grammar edge too:
    expect(String(validatePaFamilyTarget('B-MCP', { ...read, cursor: 'x' }))).toBe('cursor: not part of the B-MCP typed plan')
    // rev-1 decision, pinned (types.ts B-MCP comment): headerCount is NOT in
    // the projection; a claim carrying it fails closed:
    expect(String(validatePaFamilyTarget('B-MCP', { ...list, headerCount: 2 }))).toBe('headerCount: not part of the B-MCP typed plan')
    // kinds: nonNegativeInt and the signed nullableString (missing != null != ''):
    expect(String(validatePaFamilyTarget('B-MCP', { ...list, spawnArgCount: '3' }))).toBe('spawnArgCount: not a nonNegativeInt')
    expect(String(validatePaFamilyTarget('B-MCP', { ...list, connectionIncarnationReason: 42 }))).toBe('connectionIncarnationReason: not a nullableString')
    expect(String(validatePaFamilyTarget('B-MCP', (() => { const { connectionIncarnationReason: _d2, ...rest } = list; return rest })()))).toBe('connectionIncarnationReason: required by the B-MCP typed plan, absent')
    // the uriOpacity bind rides its measured law literal verbatim (a claim
    // REWRITING the law to 'trusted URL' dies at the bind loop):
    expect(String(validatePaFamilyTarget('B-MCP', { ...read, uriOpacity: 'trusted URL' }))).toBe("uriOpacity: not the 'stdio:read' variant constant of the B-MCP typed plan")
  })

  it('refusal-class legs at the MINT, before any table or walk: the server-identity law, the structural read-cursor law, and the closed parameter set each refuse typed', () => {
    const rows = rowsFor(STDIO)
    const listRow = rows.list_mcp_resources
    const readRow = rows.read_mcp_resource
    if (listRow === undefined || readRow === undefined) throw new Error('trio incomplete')
    const swapped = listRow.classify({ server: 'a-different-server' }) as Record<string, unknown>
    expect(swapped.ok).toBe(false)
    expect(String(swapped.detail)).toContain('is not the declared server of this mount')
    const readCursor = readRow.classify({ server: 'demo-mcp', uri: URI, cursor: 'x' }) as Record<string, unknown>
    expect(readCursor.ok).toBe(false)
    expect(String(readCursor.code)).toContain('UNKNOWN_PARAMETER')
    // MEASURED: the closed-parameter check answers FIRST ('read declares no
    // cursor' is enforced through the closed set — the row's dedicated
    // message leg behind it is shadowed defensive code, disclosed not
    // rewritten: this lane does not edit the shared adapter's bytes):
    expect(String(readCursor.detail)).toContain('undeclared top-level parameter(s): cursor')
    const extra = listRow.classify({ server: 'demo-mcp', extra: 'x' }) as Record<string, unknown>
    expect(extra.ok).toBe(false)
    // none of the three produced a manifest, so none can reach the table,
    // the walk or a native entry:
    for (const r of [swapped, readCursor, extra]) expect(r.targetManifest).toBeUndefined()
  })

  it('the two SURFACE records answer as measured faces: stdio carries the LOCAL spawn envelope, http the endpoint origin + connect leg; incarnation and domain facts stay honest', () => {
    const s = planOf(STDIO, 'list_mcp_resources', { server: 'demo-mcp' })
    expect(s.targetManifest.record).toBe('surface:mcp_stdio')
    expect(s.targetManifest.spawnArgv0).toBe('node')
    expect(s.targetManifest.spawnArgCount).toBe(3) // command.length - 1, MEASURED
    expect(s.targetManifest.spawnCwd).toBe('/srv/mcp/demo')
    // (2) named gap: no local-process kind exists — the spawn envelope is
    // MANIFEST NOTATION beside the single I leg, provider-side obligation:
    expect(s.effects.map((e) => e.kind)).toStrictEqual(['tool-invoke'])
    expect(JSON.stringify(s.targetManifest.businessObligations)).toContain('child-process spawn/FS/process envelope')

    const h = planOf(HTTP, 'list_mcp_resources', { server: 'demo-mcp' })
    expect(h.targetManifest.record).toBe('surface:mcp_http_dynamic')
    expect(h.targetManifest.endpointOrigin).toBe('https://mcp.example.com') // origin only, path never rides
    expect(h.effects.map((e) => e.kind)).toStrictEqual(['tool-invoke', 'connect'])
    expect(JSON.stringify(h.effects[1])).toContain('https://mcp.example.com')

    // (1) named gap, honest default: un-injected incarnation = 'unobserved'
    // + the NAMED BLOCKER verbatim on the D2 reason leaf:
    expect(s.targetManifest.connectionIncarnation).toBe('unobserved')
    expect(String(s.targetManifest.connectionIncarnationReason)).toBe(G.A5_G2_NAMED_BLOCKERS.MCP)
    // an owner-injected live generation flips the reason to the measured
    // null (the mount venue brings the real gen-N, a5m2-g2-wire-c1:954):
    const gen = planOf({ ...STDIO, connectionIncarnation: 'gen-1' }, 'list_mcp_resources', { server: 'demo-mcp' })
    expect(gen.targetManifest.connectionIncarnation).toBe('gen-1')
    expect(gen.targetManifest.connectionIncarnationReason).toBeNull()
    expect(validatePaFamilyTarget('B-MCP', gen.targetManifest)).toBeUndefined()
    // domain authority: absent = null leaf + no domain-ref effect; declared
    // = the leaf rides + the D leg answers:
    const dom = planOf({ ...HTTP, domainAuthorityId: 'dom-remote-policy' }, 'read_mcp_resource', { server: 'demo-mcp', uri: URI })
    expect(dom.targetManifest.domainAuthorityId).toBe('dom-remote-policy')
    expect(dom.effects.map((e) => e.kind)).toStrictEqual(['tool-invoke', 'connect', 'domain-ref'])
    expect(validatePaFamilyTarget('B-MCP', dom.targetManifest)).toBeUndefined()
    expect(s.targetManifest.domainAuthorityId).toBeNull()
  })

  it('one name, one slot, one closed schema: the three registration schemas are the 639 faces 1:1 and the rows ride the one family + the current adapter revision', () => {
    const rows = rowsFor(STDIO)
    expect(Object.keys(rows).sort()).toStrictEqual(['list_mcp_resource_templates', 'list_mcp_resources', 'read_mcp_resource'])
    for (const name of Object.keys(rows)) {
      const row = rows[name]
      if (row === undefined) throw new Error(`no row ${name}`)
      expect(row.active).toBe(true)
      expect((row as unknown as Record<string, unknown>).familyId).toBe('B-MCP')
    }
    expect(G.A5_G2_FAMILY.mcp).toBe('B-MCP')
    expect(G.A5_G2_ADAPTER_REVISION).toBe(3)
    // the schemas ARE the 639 parameter faces under the keyword-subset →
    // JSON-schema conversion (639's in-property `required: true` markers
    // become the `required` list; descriptions ride verbatim — tools.ts
    // :16-19 @639ed01539):
    expect(G.A5_G2_REGISTRATION_SCHEMAS.list_mcp_resources).toStrictEqual({
      type: 'object', additionalProperties: false,
      properties: {
        server: { type: 'string', description: 'Configured MCP server name.' },
        cursor: { type: 'string', description: 'Continuation cursor returned by this server.' },
      },
      required: ['server'],
    })
    expect(G.A5_G2_REGISTRATION_SCHEMAS.list_mcp_resource_templates).toStrictEqual(G.A5_G2_REGISTRATION_SCHEMAS.list_mcp_resources)
    expect(G.A5_G2_REGISTRATION_SCHEMAS.read_mcp_resource).toMatchObject({
      type: 'object', additionalProperties: false, required: ['server', 'uri'],
    })
  })
})
