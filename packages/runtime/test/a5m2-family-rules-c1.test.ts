/**
 * A5M2-FAMILY-RULES C1 — round 5 (root 18:42 LIMITED ruling on c80fad) adds
 * at the bottom: 'nullableString' + 'stringArray' as committed grammar under
 * the six signed constraints (empty string LEGAL in nullableString — this
 * SUPERSEDES the candidate doc's length>0 line; missing ≠ null ≠ '' pinned as
 * distinct outcomes; disclosure-contract CORRECTION leg; per-group
 * maxSearchResults law through the already-signed variant grammar; guard
 * kind-table sync; revision semantics). The two new families are NOT
 * registered here — their RULES land only after the root's ruling on this
 * commit; all synthetic driving happens in the test namespace through
 * validatePaFamilyTargetAgainstRule.
 *
 * A5M2-FAMILY-RULES C1 — round 4 (root 17:40): the minimal strict
 * DISCRIMINATED TARGET is IMPLEMENTED for B-INSPECT only — a technical
 * encoding ruling, not a security-semantics change. Delivered for the root's
 * solo review as source + these fixed-point positive/negative contract
 * checks. INSPECT is NOT enabled by this change: nothing registers
 * pa-mount-registry; the wire lane lands registration against exactly these
 * shapes later.
 *
 * THE LAWFUL SET (control/types.ts PA_FAMILY_TARGET_RULES['B-INSPECT']):
 * required = topologyRevision ('nonNegativeInt') + topologyDigest ('string')
 * + inspectVariant ('string') + the five trusted scalar leaves (root 957
 * SIGNED flatten, kept field-for-field); exactly ONE closed variant group is
 * added by the OWN-KEY-selected discriminant value:
 *   'list'        -> listLaw        (BOUND to the list-law literal)
 *   'query-host'  -> queryPlatform (BOUND 'host') + queryProvider + queryMethod
 *   'query-client'-> queryPlatform (BOUND 'client') + queryProvider +
 *                    queryMethod + clientRoundtrip (BOUND to the roundtrip-law
 *                    literal — required iff client, never an arbitrary string)
 * required ∪ selected group is the EXACT key set (own-key membership test —
 * prototype-named claim keys deny); no new field kind, no nesting, no
 * optionality, no wide object, no schema generalization. Table legality is
 * checked at module load (throw at import, never quietly at a claim).
 *
 * ONE ENCODING, FULL-VALUE BOUND (rule/mint/edge): the mint
 * (g1-surface-adapters.mjs records 53/54) mints inspectVariant from
 * spec.recordIndex + the authorized triple's platform — trusted record/tool
 * truth; the closed parameter grammar (CLASSIFY_UNKNOWN_PARAMETER) keeps
 * model text out of the target, so the discriminant can never be
 * model-supplied; the rule binds the variant↔platform pairing; the edge
 * re-verify reads plan.targetManifest — the SAME bytes the rule inspects —
 * over the SAME flat leaves. All facts stay at full value inside the target:
 * nothing moved out of the approved question/fingerprint, no effects/provider
 * scope extension, no new ledger. topology/current-facts/allowed-triple/
 * owner/PA semantics unmoved: same trustedTopology.current source, same
 * verdicts, byte-identical stale words.
 *
 * DIGEST/MIGRATION (root: reject old approvals or explicitly revision-
 * invalidate, never silently translate): A5_G1_ADAPTER_REVISION 6 -> 7 pins
 * the moved encoding digest — revision-6 approvals are explicitly stale at
 * the PA walk (family-block adapterRevision vs this revision); the edge is a
 * CLOSED switch: a stored target whose discriminant is not exactly 'list' /
 * 'query-host' / 'query-client' refuses (a pre-revision-7 shape included) —
 * retired encodings are never translated forward. classify mints only
 * revision 7. (In-process an old approval cannot be replayed at all: the
 * delegate accepts ONLY a plan its own classify produced — NOT_OWN_PLAN.)
 *
 * SIGNED UNTOUCHED: 'B-CONTROL' = the five trusted scalar leaves (record
 * 83/85 real-classify ACCEPT leg kept — trusted ACCEPT is still NOT
 * full-family closure: the request/case/permission-subject/revision/action
 * facts stay the ORIGINAL gap, listed separately in
 * dev/agent-workflow/evidence/a5m2-family-rules/a5m2-inspect-variant-grammar-candidate.md);
 * the three pre-existing rules byte-identical (regression legs 10-12); B-MCP
 * stays the unregistered named gap (its proposal remains NOT approved) and
 * the discriminated target does NOT generalize to it.
 *
 * LEGS: 1 B-CONTROL ACCEPT (unchanged); 2 B-INSPECT POSITIVE: all three
 * REAL classify outputs validate with exact required∪group key sets and
 * revision-7 reviewPayload; 3 NEGATIVE battery — missing/empty discriminant,
 * unknown + prototype-named discriminants (own-key, no fallback), wrong
 * variant↔platform pairing, arbitrary-string roundtrip law refused, partial
 * triple, cross-variant leaves, the retired nested forms (never translated);
 * 4 closed-law denies on both signed rules; 5 current-facts re-verify live
 * over the flat leaves (fresh list+host delegate run; moved topology +
 * de-authorized triple byte-identical; classify-time authorization
 * unchanged); 6 B-MCP named gap + table key pin; 7 the obligations-kind flaw
 * (root 957's measured reason) still pinned through the existing rules — the
 * reason B-INSPECT does NOT use that carrier; 8-10 B-CONTROL scalar-floor
 * negatives; 11-13 pre-existing-rule regressions.
 */
import { describe, expect, it } from 'vitest'
import {
  PA_FAMILY_TARGET_FIELD_KINDS,
  PA_FAMILY_TARGET_RULES,
  assertPaFamilyTargetRuleLegality,
  validatePaFamilyTarget,
  validatePaFamilyTargetAgainstRule,
} from '../control/types.js'
import type { PaFamilyTargetRule } from '../control/types.js'

interface G1Row {
  classify: (args: Record<string, unknown> | undefined, callId?: string) => {
    ok?: boolean
    code?: string
    detail?: string
    plan?: unknown
    targetManifest?: Record<string, unknown>
    reviewPayload?: { familyId?: string; adapterRevision?: number }
  }
  delegate: (plan: unknown, ctx: Record<string, unknown>) => Promise<{
    ok?: boolean
    code?: string
    detail?: string
    settled?: string
  }>
}
interface G1Module {
  mountG1SurfaceAdapter: (recordName: string, deps: Record<string, unknown>) => G1Row
  A5_G1_ADAPTER_REVISION: number
}
const G1 = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as unknown as G1Module

/** The validator's `absent` leg needs the key GONE, not present-and-undefined
 *  (validatePaFamilyTarget checks `field in record`). */
const without = (target: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(target).filter(([name]) => name !== key))

/** key-set equality claim -> rule, byte-for-field. */
const keysOf = (record: Record<string, unknown> | undefined): string[] =>
  Object.keys(record ?? {}).slice().sort()
const requiredKeysOf = (familyId: string): string[] =>
  Object.keys(PA_FAMILY_TARGET_RULES[familyId]?.required ?? {}).slice().sort()
const groupKeysOf = (familyId: string, variant: string): string[] =>
  Object.keys(PA_FAMILY_TARGET_RULES[familyId]?.variant?.by[variant]?.adds ?? {}).slice().sort()
const sorted = (keys: string[]): string[] => keys.slice().sort()

const TRUSTED = Object.freeze({
  memberAgentId: 'agent-a5m2',
  sessionHeaderId: 'sess-a5m2',
  realmId: 'realm-a5m2',
  owner: 'owner-a5m2',
  profileId: 'profile-a5m2',
})

const TRUSTED_LEAVES = Object.freeze({
  trustedMemberAgentId: 'agent-a5m2',
  trustedSessionHeaderId: 'sess-a5m2',
  trustedRealmId: 'realm-a5m2',
  trustedOwner: 'owner-a5m2',
  trustedProfileId: 'profile-a5m2',
})

const TOPOLOGY_SCALARS = Object.freeze({ topologyRevision: 9, topologyDigest: 'sha256;topo' })

const LIST_LAW = 'the real list enumerates ALL providers; the row constrains that answer to the CURRENT authorized topology — unauthorized providers never appear'
const CLIENT_ROUNDTRIP = 'the query rides the Client page response (pending-until-response); host-side cancellation of the tool call is NOT a transport cancel'

/** Mount one G1 row over a MUTABLE CURRENT-facts topology bag — the same
 *  trustedTopology.current seam the adapter itself consults. */
function mountRow(recordName: string, current: () => unknown): G1Row {
  return G1.mountG1SurfaceAdapter(recordName, {
    native: { name: recordName, description: 'captured face for the family-rules pairing legs', execute: async () => ({ providers: [] }) },
    definitionIdentity: 'provider@sha#entry#hash',
    trusted: TRUSTED,
    ports: { trustedTopology: { current } },
    bindingFacts: () => ({ bindingId: 'b1', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 }),
  })
}

const QUERY_TOPOLOGY = () => ({
  ...TOPOLOGY_SCALARS,
  allowed: [
    { platform: 'host', provider: 'dsh_compute', method: 'compute_health' },
    { platform: 'client', provider: 'dsh_compute', method: 'compute_health' },
  ],
})

// The three lawful claim shapes, exactly as the rule defines them (the REAL
// mint output is driven through the same checks in leg 2 — these literals
// pin the rule independently of the mint).
const LIST_CLAIM = Object.freeze({
  ...TOPOLOGY_SCALARS, inspectVariant: 'list', listLaw: LIST_LAW, ...TRUSTED_LEAVES,
})
const HOST_CLAIM = Object.freeze({
  ...TOPOLOGY_SCALARS, inspectVariant: 'query-host',
  queryPlatform: 'host', queryProvider: 'dsh_compute', queryMethod: 'compute_health',
  ...TRUSTED_LEAVES,
})
const CLIENT_CLAIM = Object.freeze({
  ...TOPOLOGY_SCALARS, inspectVariant: 'query-client',
  queryPlatform: 'client', queryProvider: 'dsh_compute', queryMethod: 'compute_health', clientRoundtrip: CLIENT_ROUNDTRIP,
  ...TRUSTED_LEAVES,
})

// ── measured REAL-SHAPE claims for the family that STAYS a gap ──

/** g2-connector-adapters.mjs:730-762 — declared stdio mount, unobserved
 *  incarnation (the honest default), list_mcp_resources. */
const B_MCP_STDIO_LIST = Object.freeze({
  operation: 'resources/list',
  server: 'local-tool',
  surface: Object.freeze({
    record: 'surface:mcp_stdio',
    transport: 'stdio',
    connectionIncarnation: 'unobserved',
    spawn: Object.freeze({ argv0: '/usr/local/bin/local-tool', argCount: 1, cwd: '/srv/mcp' }),
  }),
  providerReSelectionLaw: 'the request leg re-selects the provider from the live exec.agent scope + serverName at REQUEST time (mcp-resources/src/index.ts:120-125 @639ed01539); a stale/unmounted server fails there — this manifest freezes classify-time placement facts only',
  connectionIncarnationReason: 'NAMED BLOCKER (B-MCP): … without an injected current `connectionIncarnation` the manifest states `connectionIncarnation: "unobserved"` …',
  businessObligations: Object.freeze([
    Object.freeze({ service: 'mcp-server(stdio:local-tool)', action: 'roundtrip', right: 'connect', entry: 'captured native resource-tool execute -> McpResourceRuntime.request -> provider.request' }),
  ]),
})

const B_MCP_READ = Object.freeze({
  ...B_MCP_STDIO_LIST,
  operation: 'resources/read',
  uriVerbatim: 'mcp://local-tool/blob/../../weird%20path',
  uriOpacity: 'opaque MCP URI — carried verbatim (mcp-client connection.ts verbatim pass-through @639ed01539); no path/URL interpretation at this edge',
})

const B_MCP_HTTP_DOMAIN = Object.freeze({
  operation: 'resources/templates/list',
  server: 'remote-api',
  surface: Object.freeze({
    record: 'surface:mcp_http_dynamic',
    transport: 'streamable-http',
    connectionIncarnation: 'conn-gen-7',
    endpointOrigin: 'https://mcp.example:8443',
    headerCount: 0,
  }),
  providerReSelectionLaw: '… re-selects at REQUEST time …',
  domainAuthorityId: 'da-remote',
  cursor: 'cur-2',
  businessObligations: B_MCP_STDIO_LIST.businessObligations,
})

describe('A5M2-FAMILY-RULES C1 round 4 (root 17:40): B-INSPECT discriminated target IMPLEMENTED (required ∪ selected variant exactly closed, own-key discriminant, bound pairings); signed floors untouched; B-MCP stays the named gap', () => {
  it('B-CONTROL ACCEPT (SIGNED, unchanged): the REAL classify output of records 85 and 83 validates, field-for-field against the five trusted scalar leaves', () => {
    expect(PA_FAMILY_TARGET_RULES['B-CONTROL']).toBeDefined()
    const list = mountRow('team_list_pending_control', () => undefined)
    const c85 = list.classify({ rootSessionId: 'root-1', requestToken: 'tok-1' }, 'call-85')
    expect(c85.ok, `${c85.code} ${c85.detail}`).toBe(true)
    expect(c85.targetManifest).toEqual({ ...TRUSTED_LEAVES })
    expect(keysOf(c85.targetManifest)).toEqual(requiredKeysOf('B-CONTROL'))
    expect(validatePaFamilyTarget('B-CONTROL', c85.targetManifest)).toBeUndefined()
    const req = mountRow('team_request_control', () => undefined)
    const c83 = req.classify({ rootSessionId: 'root-1', requestToken: 'tok-1', kind: 'approval', targetInstanceId: 'inst-1', actionName: 'a' }, 'call-83')
    expect(c83.ok, `${c83.code} ${c83.detail}`).toBe(true)
    expect(c83.targetManifest).toEqual({ ...TRUSTED_LEAVES })
    expect(validatePaFamilyTarget('B-CONTROL', c83.targetManifest)).toBeUndefined()
    // trusted ACCEPT is NOT full-family closure (request/case/subject/
    // revision/action facts stay the original gap — evidence doc §5).
    expect(requiredKeysOf('B-CONTROL')).toEqual(sorted([
      'trustedMemberAgentId', 'trustedSessionHeaderId', 'trustedRealmId', 'trustedOwner', 'trustedProfileId',
    ]))
    expect(PA_FAMILY_TARGET_RULES['B-CONTROL']?.variant).toBeUndefined()
  })

  it('B-INSPECT POSITIVE: all THREE REAL classify outputs (records 53 / 54-host / 54-client) validate; key set = required ∪ selected group exactly; reviewPayload carries the revision-7 encoding stamp', () => {
    expect(G1.A5_G1_ADAPTER_REVISION, 'encoding digest moved -> explicit revision invalidation of revision-6 approvals').toBe(7)
    expect(PA_FAMILY_TARGET_RULES['B-INSPECT']?.variant?.leaf).toBe('inspectVariant')
    const list = mountRow('cordis_inspect_list', QUERY_TOPOLOGY)
    const c53 = list.classify({}, 'call-53')
    expect(c53.ok, `${c53.code} ${c53.detail}`).toBe(true)
    expect(c53.targetManifest).toEqual({ ...LIST_CLAIM })
    expect(c53.reviewPayload?.adapterRevision).toBe(7)
    expect(keysOf(c53.targetManifest)).toEqual(sorted([...requiredKeysOf('B-INSPECT'), ...groupKeysOf('B-INSPECT', 'list')]))
    expect(validatePaFamilyTarget('B-INSPECT', c53.targetManifest)).toBeUndefined()
    const query = mountRow('cordis_inspect_query', QUERY_TOPOLOGY)
    const c54 = query.classify({ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, 'call-54')
    expect(c54.ok, `${c54.code} ${c54.detail}`).toBe(true)
    expect(c54.targetManifest).toEqual({ ...HOST_CLAIM })
    expect(c54.reviewPayload?.adapterRevision).toBe(7)
    expect(keysOf(c54.targetManifest)).toEqual(sorted([...requiredKeysOf('B-INSPECT'), ...groupKeysOf('B-INSPECT', 'query-host')]))
    expect(validatePaFamilyTarget('B-INSPECT', c54.targetManifest)).toBeUndefined()
    const c54c = query.classify({ platform: 'client', provider: 'dsh_compute', method: 'compute_health' }, 'call-54c')
    expect(c54c.ok, `${c54c.code} ${c54c.detail}`).toBe(true)
    expect(c54c.targetManifest).toEqual({ ...CLIENT_CLAIM })
    expect(keysOf(c54c.targetManifest)).toEqual(sorted([...requiredKeysOf('B-INSPECT'), ...groupKeysOf('B-INSPECT', 'query-client')]))
    expect(validatePaFamilyTarget('B-INSPECT', c54c.targetManifest)).toBeUndefined()
    // the rule literals stand on their own too (mint-independent pins):
    expect(validatePaFamilyTarget('B-INSPECT', LIST_CLAIM)).toBeUndefined()
    expect(validatePaFamilyTarget('B-INSPECT', HOST_CLAIM)).toBeUndefined()
    expect(validatePaFamilyTarget('B-INSPECT', CLIENT_CLAIM)).toBeUndefined()
  })

  it('B-INSPECT NEGATIVE battery (fixed-point contract checks): discriminant law, pairing law, closed-group law, retired forms never translated', () => {
    // (a) discriminant absent / empty / non-string -> the required 'string' law
    expect(validatePaFamilyTarget('B-INSPECT', without(HOST_CLAIM, 'inspectVariant')))
      .toBe('inspectVariant: required by the B-INSPECT typed plan, absent')
    expect(validatePaFamilyTarget('B-INSPECT', { ...HOST_CLAIM, inspectVariant: '' }))
      .toBe('inspectVariant: not a string')
    expect(validatePaFamilyTarget('B-INSPECT', { ...HOST_CLAIM, inspectVariant: 5 }))
      .toBe('inspectVariant: not a string')
    // (b) OWN-KEY lookup: unknown AND prototype-named discriminants select
    //     nothing - no toString/constructor fallback, no coercion
    for (const junk of ['nope', 'LIST', 'toString', 'constructor', '__proto__', 'valueOf']) {
      expect(validatePaFamilyTarget('B-INSPECT', { ...HOST_CLAIM, inspectVariant: junk }))
        .toBe(`inspectVariant: '${junk}' selects no B-INSPECT variant group`)
    }
    // (c) PAIRING law: the variant must match queryPlatform exactly
    expect(validatePaFamilyTarget('B-INSPECT', { ...HOST_CLAIM, queryPlatform: 'client' }))
      .toBe(`queryPlatform: not the 'query-host' variant constant of the B-INSPECT typed plan`)
    expect(validatePaFamilyTarget('B-INSPECT', { ...CLIENT_CLAIM, queryPlatform: 'host' }))
      .toBe(`queryPlatform: not the 'query-client' variant constant of the B-INSPECT typed plan`)
    // (d) clientRoundtrip: bound literal, never an arbitrary string, and it
    //     exists iff the client group (closed set excludes it elsewhere)
    expect(validatePaFamilyTarget('B-INSPECT', { ...CLIENT_CLAIM, clientRoundtrip: 'whatever I say' }))
      .toBe(`clientRoundtrip: not the 'query-client' variant constant of the B-INSPECT typed plan`)
    expect(validatePaFamilyTarget('B-INSPECT', without(CLIENT_CLAIM, 'clientRoundtrip')))
      .toBe('clientRoundtrip: required by the B-INSPECT typed plan, absent')
    expect(validatePaFamilyTarget('B-INSPECT', { ...HOST_CLAIM, clientRoundtrip: CLIENT_ROUNDTRIP }))
      .toBe('clientRoundtrip: not part of the B-INSPECT typed plan')
    // (e) the list-law leaf is likewise bound (never an arbitrary string)
    expect(validatePaFamilyTarget('B-INSPECT', { ...LIST_CLAIM, listLaw: 'anything' }))
      .toBe(`listLaw: not the 'list' variant constant of the B-INSPECT typed plan`)
    // (f) the triple never rides PARTIAL (closed group = all leaves together)
    expect(validatePaFamilyTarget('B-INSPECT', without(HOST_CLAIM, 'queryMethod')))
      .toBe('queryMethod: required by the B-INSPECT typed plan, absent')
    // (g) cross-variant leaves deny
    expect(validatePaFamilyTarget('B-INSPECT', { ...LIST_CLAIM, queryPlatform: 'host' }))
      .toBe('queryPlatform: not part of the B-INSPECT typed plan')
    // (h) RETIRED encodings deny - never silently translated: the 957-era
    //     nested/base forms lack the closed discriminant and die at the
    //     required law; the 957a-era obligations carrier is an extra key.
    expect(validatePaFamilyTarget('B-INSPECT', { ...TOPOLOGY_SCALARS, listLaw: LIST_LAW, ...TRUSTED_LEAVES }))
      .toBe('inspectVariant: required by the B-INSPECT typed plan, absent')
    expect(validatePaFamilyTarget('B-INSPECT', { ...TOPOLOGY_SCALARS, queryClaim: { platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, ...TRUSTED_LEAVES }))
      .toBe('inspectVariant: required by the B-INSPECT typed plan, absent')
    expect(validatePaFamilyTarget('B-INSPECT', { ...TOPOLOGY_SCALARS, inspectVariant: 'list', inspectTarget: [{ listLaw: LIST_LAW }], listLaw: LIST_LAW, ...TRUSTED_LEAVES }))
      .toBe('inspectTarget: not part of the B-INSPECT typed plan')
    // (i) a prototype-named CLAIM key denies like any extra key (own-key law)
    expect(validatePaFamilyTarget('B-INSPECT', Object.assign(Object.create(null as object | null), HOST_CLAIM, { toString: 'x' })))
      .toBe('toString: not part of the B-INSPECT typed plan')
  })

  it('the signed rules enforce the plain closed law too: foreign key, absent leaf and wrong kind deny with the closed codes', () => {
    const flatControl = { ...TRUSTED_LEAVES }
    expect(validatePaFamilyTarget('B-CONTROL', { ...flatControl, surface: { transport: 'stdio' } }))
      .toBe('surface: not part of the B-CONTROL typed plan')
    expect(validatePaFamilyTarget('B-CONTROL', without(flatControl, 'trustedOwner')))
      .toBe('trustedOwner: required by the B-CONTROL typed plan, absent')
    expect(validatePaFamilyTarget('B-CONTROL', { ...flatControl, trustedProfileId: 7 }))
      .toBe('trustedProfileId: not a string')
    expect(validatePaFamilyTarget('B-INSPECT', { ...HOST_CLAIM, topologyRevision: 'nine' }))
      .toBe('topologyRevision: not a nonNegativeInt')
    expect(validatePaFamilyTarget('B-INSPECT', { ...HOST_CLAIM, queryProvider: '' }))
      .toBe('queryProvider: not a string')
  })

  it('current-facts re-verification is live over the SAME flat encoding: list + host-query delegates run the captured face; moved topology and de-authorized triples refuse with byte-identical words; the classify-time authorization law is unchanged', async () => {
    const state = {
      revision: 9,
      allowed: [{ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }],
    }
    const query = mountRow('cordis_inspect_query', () => ({ topologyRevision: state.revision, topologyDigest: 'sha256;topo', allowed: state.allowed }))
    // fresh: same CURRENT facts at the edge -> the captured face runs once.
    const fresh = query.classify({ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, 'call-fresh')
    expect(fresh.ok).toBe(true)
    const ran = await query.delegate(fresh.plan, { exec: { callId: 'call-fresh' } })
    expect(ran.ok, `${ran.code} ${ran.detail}`).toBe(true)
    // classify on the CURRENT facts, THEN the CURRENT fact moves -> stale,
    // byte-identical words.
    const moved = query.classify({ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, 'call-moved')
    expect(moved.ok).toBe(true)
    state.revision = 10
    const staleTopo = await query.delegate(moved.plan, { exec: { callId: 'call-moved' } })
    expect(staleTopo.ok).toBe(false)
    expect(staleTopo.code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(String(staleTopo.detail)).toContain('topology now answers revision 10 (sha256;topo)')
    // the authorization law itself is unchanged: de-authorized at CLASSIFY
    // still refuses at classify, before any plan exists.
    state.revision = 9
    state.allowed = []
    const unauthorized = query.classify({ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, 'call-unauth')
    expect(unauthorized.ok).not.toBe(true)
    expect(unauthorized.code).toBe('P_G1_INSPECT_TARGET_NOT_AUTHORIZED')
    // classify WHILE authorized, then de-authorize -> the same stale refusal,
    // the same words, over the flat triple leaves as ONE correlated triple.
    state.allowed = [{ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }]
    const ok2 = query.classify({ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, 'call-ok2')
    expect(ok2.ok).toBe(true)
    state.allowed = []
    const staleTriple = await query.delegate(ok2.plan, { exec: { callId: 'call-ok2' } })
    expect(staleTriple.ok).toBe(false)
    expect(staleTriple.code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(String(staleTriple.detail)).toContain('the query triple is no longer in the CURRENT authorized topology')
    // the list variant re-verifies only the topology facts (no triple to
    // lose): its delegate runs while the query triple is GONE.
    const listRow = mountRow('cordis_inspect_list', () => ({ topologyRevision: 9, topologyDigest: 'sha256;topo', allowed: [] }))
    const listed = listRow.classify({}, 'call-list')
    expect(listed.ok).toBe(true)
    const listRan = await listRow.delegate(listed.plan, { exec: { callId: 'call-list' } })
    expect(listRan.ok, `${listRan.code} ${listRan.detail}`).toBe(true)
  })

  it('B-MCP: STILL no rule registered — every measured variant denies at the table gate with the wire-pinned string (named gap, encoding FROZEN, proposal NOT approved; the discriminated target does NOT generalize to it)', () => {
    expect(PA_FAMILY_TARGET_RULES['B-MCP']).toBeUndefined()
    const deny = `familyId: no target structure is registered for 'B-MCP'`
    expect(validatePaFamilyTarget('B-MCP', B_MCP_STDIO_LIST)).toBe(deny)
    expect(validatePaFamilyTarget('B-MCP', B_MCP_READ)).toBe(deny)
    expect(validatePaFamilyTarget('B-MCP', B_MCP_HTTP_DOMAIN)).toBe(deny)
    expect(Object.keys(PA_FAMILY_TARGET_RULES))
      .toEqual(['B-SESSION', 'B-IMAGE', 'B-WRITE', 'B-CONTROL', 'B-INSPECT'])
    // ONLY B-INSPECT carries a variant grammar (no schema generalization):
    for (const familyId of Object.keys(PA_FAMILY_TARGET_RULES)) {
      expect(PA_FAMILY_TARGET_RULES[familyId]?.variant === undefined, familyId).toBe(familyId !== 'B-INSPECT')
    }
  })

  it('the obligations-kind flaw (root 957 reason, still MEASURED through the existing rules) — the reason B-INSPECT uses the closed discriminated group, not that carrier', () => {
    expect(validatePaFamilyTarget('B-IMAGE', {
      ...B_IMAGE_REAL,
      businessObligations: [{}],
    })).toBeUndefined()
    expect(validatePaFamilyTarget('B-IMAGE', {
      ...B_IMAGE_REAL,
      businessObligations: [{ anything: 1 }, { nope: [1, 2] }, {}],
    })).toBeUndefined()
    expect(validatePaFamilyTarget('B-SESSION', {
      ...B_SESSION_REAL,
      counts: { platform: 'host', provider: 'dsh_compute', method: 'compute_health' },
    })).toBe('counts: not a countsTriple')
    expect(validatePaFamilyTarget('B-IMAGE', {
      ...B_IMAGE_REAL,
      businessObligations: [],
    })).toBe('businessObligations: not a obligations')
    expect(validatePaFamilyTarget('B-SESSION', { ...B_SESSION_REAL, surface: B_MCP_STDIO_LIST.surface }))
      .toBe('surface: not part of the B-SESSION typed plan')
  })

  it('REGRESSION B-SESSION (todo.mjs:234-246 real shape): validates; a foreign key, a missing key and a wrong type deny with the closed codes', () => {
    expect(validatePaFamilyTarget('B-SESSION', B_SESSION_REAL)).toBeUndefined()
    expect(validatePaFamilyTarget('B-SESSION', { ...B_SESSION_REAL, lane: 'extra' }))
      .toBe('lane: not part of the B-SESSION typed plan')
    expect(validatePaFamilyTarget('B-SESSION', without(B_SESSION_REAL, 'paramFingerprint')))
      .toBe('paramFingerprint: required by the B-SESSION typed plan, absent')
    expect(validatePaFamilyTarget('B-SESSION', { ...B_SESSION_REAL, allowParallelPolicy: 'true' }))
      .toBe('allowParallelPolicy: not a boolean')
  })

  it('REGRESSION B-WRITE (write.mjs:246-258 real shape): validates; missing/foreign/wrong-type deny with the closed codes', () => {
    expect(validatePaFamilyTarget('B-WRITE', B_WRITE_REAL)).toBeUndefined()
    expect(validatePaFamilyTarget('B-WRITE', without(B_WRITE_REAL, 'contentFingerprint')))
      .toBe('contentFingerprint: required by the B-WRITE typed plan, absent')
    expect(validatePaFamilyTarget('B-WRITE', { ...B_WRITE_REAL, trusted: TRUSTED }))
      .toBe('trusted: not part of the B-WRITE typed plan')
    expect(validatePaFamilyTarget('B-WRITE', { ...B_WRITE_REAL, existingFileOnly: 'true' }))
      .toBe('existingFileOnly: not a boolean')
  })

  it('REGRESSION B-IMAGE (image.mjs:249-268 real shape): validates; missing/foreign/wrong-type deny with the closed codes', () => {
    expect(validatePaFamilyTarget('B-IMAGE', B_IMAGE_REAL)).toBeUndefined()
    expect(validatePaFamilyTarget('B-IMAGE', without(B_IMAGE_REAL, 'byteCapSource')))
      .toBe('byteCapSource: required by the B-IMAGE typed plan, absent')
    expect(validatePaFamilyTarget('B-IMAGE', { ...B_IMAGE_REAL, surface: B_MCP_STDIO_LIST.surface }))
      .toBe('surface: not part of the B-IMAGE typed plan')
    expect(validatePaFamilyTarget('B-IMAGE', { ...B_IMAGE_REAL, byteCap: -1 }))
      .toBe('byteCap: not a nonNegativeInt')
  })
})

// ── the three PRE-EXISTING lanes' real shapes (mirrors of the committed plans) ──

/** todo.mjs:234-246 (A5_TODO_FAMILY_ID 'B-SESSION', operation 'replace-list'). */
const B_SESSION_REAL = {
  operation: 'replace-list',
  agentId: 'agent-a5m2',
  sessionHeaderId: 'sess-a5m2',
  todosDigest: '0'.repeat(64),
  counts: { pending: 2, inProgress: 1, completed: 0 },
  allowParallelPolicy: false,
  paramFingerprint: '0'.repeat(64),
}

/** write.mjs:246-258 (A5_WRITE_FAMILY_ID 'B-WRITE', operation 'write-existing-file'). */
const B_WRITE_REAL = {
  familyId: 'B-WRITE',
  adapterRevision: 1,
  operation: 'write-existing-file',
  realmId: 'realm-a5m2',
  canonicalTarget: '/srv/mcp/state.json',
  contentFingerprint: `sha256:${'1'.repeat(64)}`,
  existingFileOnly: true,
}

/** image.mjs:249-268 (A5_IMAGE_ADAPTER_REVISION 2, operation 'read-exact-file'). */
const B_IMAGE_REAL = {
  familyId: 'B-IMAGE',
  adapterRevision: 2,
  operation: 'read-exact-file',
  realmId: 'realm-a5m2',
  canonicalTarget: '/srv/attachments/frame.png',
  declaredMediaType: 'image/png',
  byteCap: 8388608,
  byteCapSource: 'attachment-store-limits:min(maxImageBytes,maxMessageImageBytes)',
  businessObligations: [
    { service: 'attachment-store', action: 'create', right: 'write', entry: 'SERVICE adapter commitImage -> the real store saveImage (post-consumption only)' },
    { service: 'session', action: 'attach-vision', right: 'write', entry: 'dispatch-result content blocks ride the session log' },
  ],
}

/* ─────────────────────────────────────────────────────────────────────────
 * ROUND 5 (root 18:42 LIMITED ruling on c80fad): 'nullableString' +
 * 'stringArray' as committed grammar under EXACTLY the six signed
 * constraints, one leg each. B-SCHEDULE and B-SESSION-QUERY are NOT
 * registered (their RULES land only after the root's ruling on this
 * commit); every synthetic claim below runs the REAL law through
 * validatePaFamilyTargetAgainstRule in this test namespace - the real table
 * still denies unknown families with the wire-pinned string.
 * ───────────────────────────────────────────────────────────────────────── */
describe('A5M2-FAMILY-RULES C1 round 5 (root 18:42): nullableString + stringArray - the two kinds under exactly the signed semantics; the closed variant grammar carries the per-row difference', () => {
  // SYNTHETIC family shaped like the measured G6 claim (test namespace only,
  // NOT a B-SESSION-QUERY registration): toolName is the variant LEAF (always
  // a 'string' - the guard forbids a nullable discriminant), the shared
  // floor carries the two new kinds, and the per-row-group difference rides
  // the ALREADY-SIGNED closed variants (root 18:42: NO new optional member).
  const G6_SHAPE = {
    required: {
      toolName: 'string',
      callerWorkspaceCwd: 'nullableString',
      disclosures: 'stringArray',
    },
    currentFields: ['toolName'],
    variant: {
      leaf: 'toolName',
      by: {
        team_history_search: { adds: { maxSearchResults: 'nonNegativeInt' }, binds: {} },
        team_recent_context_search: { adds: { maxSearchResults: 'nonNegativeInt' }, binds: {} },
        team_session_history: { adds: {}, binds: {} },
        team_sessions_list: { adds: {}, binds: {} },
        team_recent_context: { adds: {}, binds: {} },
      },
    },
  } as const satisfies PaFamilyTargetRule
  const V = 'A5M2-SYNTH-G6'
  const check = (target: Record<string, unknown>): string | undefined =>
    validatePaFamilyTargetAgainstRule(V, G6_SHAPE, target)
  const SEARCH_OK: Record<string, unknown> = {
    toolName: 'team_history_search',
    callerWorkspaceCwd: null,
    disclosures: ['law sentence A', 'law sentence B', 'SESSION_HISTORY_RESOURCE_KIND disclosure', 'PARENT_FILTER disclosure'],
    maxSearchResults: 20,
  }
  const HISTORY_OK: Record<string, unknown> = {
    toolName: 'team_session_history',
    callerWorkspaceCwd: '',
    disclosures: ['law sentence A', 'law sentence B', 'SESSION_HISTORY_RESOURCE_KIND disclosure'],
  }

  it('constraint (1) nullableString: a required key carrying null | string; EMPTY STRING LEGAL; missing ≠ null ≠ "" - three distinct outcomes, NO silent conversion either way', () => {
    // both legal values pass; '' is legal per root 18:42 (G6 requireCaller
    // g6-session-query.mjs:521-532 never demands a non-empty cwd - it only
    // demands the caller RECORD; the mint writes typeof-string cwd verbatim,
    // including ''):
    expect(check({ ...SEARCH_OK, callerWorkspaceCwd: null })).toBeUndefined()
    expect(check({ ...SEARCH_OK, callerWorkspaceCwd: '' })).toBeUndefined()
    expect(check({ ...SEARCH_OK, callerWorkspaceCwd: 'x' })).toBeUndefined()
    expect(check({ ...SEARCH_OK, callerWorkspaceCwd: '   ' })).toBeUndefined() // whitespace-only follows the 'string' law (typeof string)
    // everything else denies with the closed kind string:
    for (const bad of [0, 1, true, false, {}, ['x'], [[]], () => 'x']) {
      expect(check({ ...SEARCH_OK, callerWorkspaceCwd: bad })).toBe('callerWorkspaceCwd: not a nullableString')
    }
    // a MISSING key is NOT null: the required law denies it (missing never
    // converts to null, null never converts to absent):
    expect(check(without(SEARCH_OK, 'callerWorkspaceCwd')))
      .toBe('callerWorkspaceCwd: required by the A5M2-SYNTH-G6 typed plan, absent')
    // a key-present-with-undefined is the THIRD distinct state - undefined is
    // impossible by law (lossless walk; the mint must OMIT the key instead):
    expect(check({ ...SEARCH_OK, callerWorkspaceCwd: undefined }))
      .toBe('callerWorkspaceCwd: not a nullableString')
    // the check never mutates: the target bytes the fingerprint rides pass
    // through untouched (pure function - null-vs-missing stays distinguishable
    // end-to-end, constraint (5)).
    expect(check({ ...SEARCH_OK, toolName: '' })).toBe('toolName: not a string') // 'string' law stays strict: '' still denies there
  })

  it('constraint (2) Schedule taskId: the grammar admits ONLY null | string; non-empty + trim-stable stays the business edge, never encoded into the kind', () => {
    expect(check({ ...SEARCH_OK, callerWorkspaceCwd: 'task-1' })).toBeUndefined()
    expect(check({ ...SEARCH_OK, callerWorkspaceCwd: '   padded   ' })).toBeUndefined() // trim-stability is NOT the grammar's business
    expect(check({ ...SEARCH_OK, callerWorkspaceCwd: null })).toBeUndefined()
    expect(check({ ...SEARCH_OK, callerWorkspaceCwd: false })).toBe('callerWorkspaceCwd: not a nullableString')
  })

  it('constraint (3a) stringArray: every item typeof string, [] legal; ONLY Array.isArray + element typeof - array SUBCLASS instances admit, prototype fakes and symbol-trusting paths deny', () => {
    expect(check({ ...SEARCH_OK, disclosures: ['a', 'b'] })).toBeUndefined()
    expect(check({ ...SEARCH_OK, disclosures: [] })).toBeUndefined()
    for (const bad of [['a', 1], ['a', null], ['a', undefined], ['a', true], [{}], [['x']]]) {
      expect(check({ ...SEARCH_OK, disclosures: bad })).toBe('disclosures: not a stringArray')
    }
    for (const bad of ['ab', {}, null, 0, true]) {
      expect(check({ ...SEARCH_OK, disclosures: bad })).toBe('disclosures: not a stringArray')
    }
    // prototype-only fakes deny (Array.isArray is the ONLY array gate - no
    // instanceof, no Symbol.iterator trust, no length/duck typing):
    expect(check({ ...SEARCH_OK, disclosures: Object.create(Array.prototype, { length: { value: 1 }, 0: { value: 'a' } }) }))
      .toBe('disclosures: not a stringArray')
    expect(check({ ...SEARCH_OK, disclosures: { length: 2, 0: 'a', 1: 'b', [Symbol.iterator]: Array.prototype[Symbol.iterator] } }))
      .toBe('disclosures: not a stringArray')
    // a genuine array-subclass instance admits through Array.isArray (the
    // signed expression never mentions instanceof):
    class Row extends Array {}
    expect(check({ ...SEARCH_OK, disclosures: Row.from(['a', 'b']) })).toBeUndefined()
    // measured signed-expression behavior, recorded honestly: every() SKIPS
    // HOLES, so a sparse dense-start array passes; irrelevant for G6 (its
    // disclosures mint as dense literals, g6-session-query.mjs:853):
    const sparse = ['a']
    sparse.length = 3
    expect(check({ ...SEARCH_OK, disclosures: sparse })).toBeUndefined()
  })

  it('constraint (3b) disclosure-contract CORRECTION: the grammar admits [] AND admits arrays without the disclosure - the G6 LAW (disclosures always carry SESSION_HISTORY_RESOURCE_KIND, never droppable) is enforced MINT-side; the earlier "measured empty disclosures legal" claim was FALSE and the grammar neither weakens nor enforces the family law', () => {
    // fact A - grammar admits [] (pure value admission only):
    expect(check({ ...SEARCH_OK, disclosures: [] })).toBeUndefined()
    expect(check({ ...HISTORY_OK, disclosures: [] })).toBeUndefined()
    // fact B - the family contract lives at the mint: EVERY G6 row mints its
    // disclosures WITH A5_G6_NAMED_BLOCKERS.SESSION_HISTORY_RESOURCE_KIND
    // (g6-session-query.mjs:799-800 blocker lists, :853 target disclosures -
    // all five rows, both port families). The grammar cannot stand in for
    // that law - an array WITHOUT the disclosure sentence still passes the
    // KIND check below - so the disclosure law must stay (and does stay)
    // mint/edge-side, and this kind never read as weakening it:
    expect(check({ ...SEARCH_OK, disclosures: ['only something else'] })).toBeUndefined()
  })

  it('constraint (4) maxSearchResults: BOTH search variants REQUIRE it (strict nonNegativeInt, null refuses); the other three groups EXPLICITLY FORBID the key (null refuses there too); a key-present-with-undefined never passes - the mint must OMIT (already routed to the adapter owner, not this diff)', () => {
    for (const toolName of ['team_history_search', 'team_recent_context_search']) {
      expect(check({ ...SEARCH_OK, toolName })).toBeUndefined()
      expect(check(without({ ...SEARCH_OK, toolName }, 'maxSearchResults')))
        .toBe('maxSearchResults: required by the A5M2-SYNTH-G6 typed plan, absent')
      expect(check({ ...SEARCH_OK, toolName, maxSearchResults: null }))
        .toBe('maxSearchResults: not a nonNegativeInt')
      expect(check({ ...SEARCH_OK, toolName, maxSearchResults: -1 }))
        .toBe('maxSearchResults: not a nonNegativeInt')
      expect(check({ ...SEARCH_OK, toolName, maxSearchResults: '20' }))
        .toBe('maxSearchResults: not a nonNegativeInt')
      // key-with-undefined denies even in its OWN group - omission, never
      // undefined-valued presence (lossless walk):
      expect(check({ ...SEARCH_OK, toolName, maxSearchResults: undefined }))
        .toBe('maxSearchResults: not a nonNegativeInt')
    }
    for (const toolName of ['team_session_history', 'team_sessions_list', 'team_recent_context']) {
      expect(check({ ...HISTORY_OK, toolName })).toBeUndefined()
      expect(check({ ...HISTORY_OK, toolName, maxSearchResults: 5 }))
        .toBe('maxSearchResults: not part of the A5M2-SYNTH-G6 typed plan')
      expect(check({ ...HISTORY_OK, toolName, maxSearchResults: null }))
        .toBe('maxSearchResults: not part of the A5M2-SYNTH-G6 typed plan')
      expect(check({ ...HISTORY_OK, toolName, maxSearchResults: undefined }))
        .toBe('maxSearchResults: not part of the A5M2-SYNTH-G6 typed plan')
    }
    // unknown variant: own-key closed law, no fallback:
    expect(check({ ...HISTORY_OK, toolName: 'team_bogus' }))
      .toBe(`toolName: 'team_bogus' selects no ${V} variant group`)
    // the discriminant leaf stays a strict 'string' (constraint (1) law):
    expect(check({ ...HISTORY_OK, toolName: null })).toBe('toolName: not a string')
  })

  it('constraint (6, guard) module-load legality: kind table SYNCED to the closed seven; the new kinds are legal ONLY inside closed required/adds maps; unknown kinds and a nullable discriminant THROW; the real table is leak-free', () => {
    expect([...PA_FAMILY_TARGET_FIELD_KINDS])
      .toEqual(['string', 'boolean', 'nonNegativeInt', 'countsTriple', 'obligations', 'nullableString', 'stringArray'])
    // a legal synthetic (new kinds inside the closed maps) passes the very law
    // the module runs at import:
    expect(() => assertPaFamilyTargetRuleLegality(V, G6_SHAPE)).not.toThrow()
    // an unknown kind in required throws (the throw the import performs):
    expect(() => assertPaFamilyTargetRuleLegality('BAD-REQ',
      { required: { x: 'anyString' }, currentFields: [] } as unknown as PaFamilyTargetRule))
      .toThrow(/unknown kind/)
    // an unknown kind in variant adds throws (no widening through groups):
    expect(() => assertPaFamilyTargetRuleLegality('BAD-ADD', {
      required: { v: 'string' }, currentFields: [],
      variant: { leaf: 'v', by: { a: { adds: { w: 'fuzzyString' }, binds: {} } } },
    } as unknown as PaFamilyTargetRule)).toThrow(/unknown kind/)
    // 'nullableString' can NEVER be a discriminant leaf:
    expect(() => assertPaFamilyTargetRuleLegality('BAD-LEAF', {
      required: { v: 'nullableString' }, currentFields: [],
      variant: { leaf: 'v', by: { a: { adds: {}, binds: {} } } },
    } as unknown as PaFamilyTargetRule)).toThrow(/must be a required 'string' leaf/)
    // EVERY real entry passes (the import-time proof, re-run):
    for (const [familyId, rule] of Object.entries(PA_FAMILY_TARGET_RULES)) {
      expect(() => assertPaFamilyTargetRuleLegality(familyId, rule)).not.toThrow()
    }
    // NO LEAK: the signed families keep the original five kinds; the table is
    // still exactly the five registered families - the two new families'
    // RULES land only after the root's ruling on this commit:
    const ORIGINAL = new Set<string>(['string', 'boolean', 'nonNegativeInt', 'countsTriple', 'obligations'])
    expect(Object.keys(PA_FAMILY_TARGET_RULES)).toEqual(['B-SESSION', 'B-IMAGE', 'B-WRITE', 'B-CONTROL', 'B-INSPECT'])
    for (const rule of Object.values(PA_FAMILY_TARGET_RULES)) {
      for (const kind of Object.values(rule.required)) expect(ORIGINAL.has(kind), kind).toBe(true)
      for (const group of Object.values(rule.variant?.by ?? {})) {
        for (const kind of Object.values(group.adds)) expect(ORIGINAL.has(kind), kind).toBe(true)
      }
    }
    // unregistered families deny with the wire-pinned string (nothing widened
    // the REGISTRY surface):
    expect(validatePaFamilyTarget('B-SESSION-QUERY', {}))
      .toBe(`familyId: no target structure is registered for 'B-SESSION-QUERY'`)
    expect(validatePaFamilyTarget('B-SCHEDULE', {}))
      .toBe(`familyId: no target structure is registered for 'B-SCHEDULE'`)
  })

  it('constraints (5)+(6, revision): value-admission only - every signed encoding byte-identical; this grammar admits exactly adapterRevision 7 (round-4 law intact: revision-6 approvals stay explicitly stale, nothing translates; lossless walk + full fingerprint untouched)', () => {
    // the signed claims validate byte-identically under the widened kinds:
    expect(validatePaFamilyTarget('B-INSPECT', LIST_CLAIM)).toBeUndefined()
    expect(validatePaFamilyTarget('B-INSPECT', HOST_CLAIM)).toBeUndefined()
    expect(validatePaFamilyTarget('B-INSPECT', CLIENT_CLAIM)).toBeUndefined()
    expect(validatePaFamilyTarget('B-CONTROL', { ...TRUSTED_LEAVES })).toBeUndefined()
    // no rule's leaf set moved (no encoding digest change): the revision this
    // grammar admits is the one the lane already carries; older approvals keep
    // their explicit-stale status; validation is a pure check with no
    // translation path (constraint (5): null vs missing stay distinguishable
    // end-to-end - pinned as three distinct outcomes in the constraint-(1) leg):
    expect(G1.A5_G1_ADAPTER_REVISION, 'widening moved no encoding digest: revision 7 stays; revision 6 stays explicitly stale, never translated').toBe(7)
  })
})
