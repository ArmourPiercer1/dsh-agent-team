/**
 * A5M2-FAMILY-RULES C1 — round 3 (root 957 LIMITED ruling):
 *
 * SIGNED (kept field-for-field, do not touch — root 957):
 *   - 'B-CONTROL' rule = the five trusted scalar leaves
 *     (trustedMemberAgentId/trustedSessionHeaderId/trustedRealmId/
 *     trustedOwner/trustedProfileId, all 'string'); the REAL classify output
 *     of records 83/84/85/87/88 validates (leg 1 ACCEPT). This trusted-leaf
 *     ACCEPT is NOT full-family closure: the full request/case/permission-
 *     subject/revision/action facts records 83/84/87/88 carry (measured faces:
 *     83 rootSessionId/requestToken/kind/targetInstanceId/actionName
 *     (+toolName,summary); 84 rootSessionId/requestToken/requestId/decision
 *     (+note); 85 rootSessionId/requestToken(+limit); 87/88 rootSessionId/
 *     requestToken/targetInstanceId/rules) ride classifiedArgs/effects, NOT
 *     the target — the ORIGINAL B-CONTROL gap, listed separately in
 *     dev/agent-workflow/evidence/a5m2-family-rules/a5m2-inspect-variant-grammar-candidate.md.
 *   - 'B-INSPECT' scalar floor: topologyRevision ('nonNegativeInt') +
 *     topologyDigest ('string') + the same five trusted scalar leaves.
 *
 * REFUSED (root 957): `inspectTarget: 'obligations'` as the variant carrier.
 * Measured flaw — pinned in leg 6 through the EXISTING rules on
 * B-IMAGE.businessObligations, the same generic kind: 'obligations' accepts
 * ANY non-empty array of plain objects — [{}] validates, arbitrary interiors,
 * multiple elements — so it cannot verify the query triple, and an edge
 * reading inspectTarget[0] with a platform-type check is mint/WeakMap
 * discipline, not the M0 §1 strict typed target grammar. The mint therefore
 * carries the variant facts in their measured BASE form INSIDE the target
 * (they ride the approved question and its fingerprint — moving them out is
 * FROZEN): rec 53 top-level `listLaw`; rec 54 nested `queryClaim{platform,
 * provider, method}` + client `clientRoundtrip`. With the scalar-floor rule
 * every REAL B-INSPECT claim FAILS CLOSED at the grammar gate (leg 2 pins the
 * exact deny strings AND that the mint still carries every variant fact). The
 * edge re-verify (leg 4) keeps the base nested-`queryClaim` triple check and
 * the flat-scalar topology check — same CURRENT-facts source, verdicts,
 * words.
 *
 * DELIVERABLE (proposal only, NOT implemented — root 957): the proof that NO
 * existing closed leaf expresses the three measured variants + cross-leaf
 * pairing, and the minimal contract delta as an exact short interface
 * candidate:
 * dev/agent-workflow/evidence/a5m2-family-rules/a5m2-inspect-variant-grammar-candidate.md
 *
 * B-MCP unchanged named gap (leg 5): encoding FROZEN, no rule registered, the
 * wire lanes' pinned deny stands; its contract-correction proposal remains
 * NOT approved for implementation (root 957).
 *
 * PAIRING LAW stands: a rule lands only paired with its claim-shape mint;
 * nothing here registers pa-mount-registry entries (those land with the wire
 * lane against exactly these shapes).
 *
 * LEGS: 1 B-CONTROL ACCEPT (real classify, field-for-field claim<->rule) +
 * pre-rule nested form denies + the not-full-family note; 2 B-INSPECT interim:
 * scalar floor validates with exact key-set, every REAL claim fails closed
 * naming its variant fact, and the mint verifiably still carries all variant
 * facts inside the target (fingerprint intact, no inspectTarget anywhere);
 * 3 the closed law bites on both signed rules (foreign/absent/wrong-kind);
 * 4 B-INSPECT current-facts re-verify live (fresh delegate runs the face;
 * moved topology / de-authorized triple refuse byte-identical; classify-time
 * authorization unchanged); 5 B-MCP named gap + table key pin; 6 the
 * refused-grammar flaw measured through the existing 'obligations' kind
 * ([{}] and junk interiors ACCEPT — root 957's stated reason) + countsTriple
 * refuses non-triple objects; 7-9 byte-identical regression legs of the three
 * pre-existing rules (todo.mjs:234-246, write.mjs:246-258, image.mjs:249-268).
 */
import { describe, expect, it } from 'vitest'
import { PA_FAMILY_TARGET_RULES, validatePaFamilyTarget } from '../control/types.js'

interface G1Row {
  classify: (args: Record<string, unknown> | undefined, callId?: string) => {
    ok?: boolean
    code?: string
    detail?: string
    plan?: unknown
    targetManifest?: Record<string, unknown>
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

describe('A5M2-FAMILY-RULES C1 round 3 (root 957): scalar floors signed; B-INSPECT variant facts fail closed pending the variant-grammar delta; B-CONTROL trusted ACCEPT is not full-family closure; B-MCP named gap', () => {
  it('B-CONTROL ACCEPT (SIGNED): the REAL classify output of records 85 and 83 validates, field-for-field against the five trusted scalar leaves', () => {
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
    // trusted ACCEPT is NOT full-family closure: the record-83 request facts
    // (kind/targetInstanceId/actionName — riding classifiedArgs/effects) are
    // not part of the typed plan yet — the ORIGINAL B-CONTROL gap, listed
    // separately. This leg proves only that the claim the mint DOES produce
    // is exactly the five signed leaves.
    expect(requiredKeysOf('B-CONTROL')).toEqual(sorted([
      'trustedMemberAgentId', 'trustedSessionHeaderId', 'trustedRealmId', 'trustedOwner', 'trustedProfileId',
    ]))
    // the pre-rule nested form denies (the flat leaves are the only shape)
    expect(validatePaFamilyTarget('B-CONTROL', { trusted: TRUSTED }))
      .toBe('trustedMemberAgentId: required by the B-CONTROL typed plan, absent')
  })

  it('B-INSPECT INTERIM (root 957 refuse): the scalar floor validates exact-keyset; every REAL claim FAILS CLOSED naming its variant fact; the mint verifiably keeps all variant facts INSIDE the target (fingerprint intact)', () => {
    // scalar floor: exact key-set equality against the rule, validates.
    const scalarFloor = { ...TOPOLOGY_SCALARS, ...TRUSTED_LEAVES }
    expect(keysOf(scalarFloor)).toEqual(requiredKeysOf('B-INSPECT'))
    expect(validatePaFamilyTarget('B-INSPECT', scalarFloor)).toBeUndefined()
    // the three measured REAL claims — the mint still carries EVERY variant
    // fact inside the target (nothing moved out of the approved question):
    const topology = () => ({
      ...TOPOLOGY_SCALARS,
      allowed: [
        { platform: 'host', provider: 'dsh_compute', method: 'compute_health' },
        { platform: 'client', provider: 'dsh_compute', method: 'compute_health' },
      ],
    })
    const list = mountRow('cordis_inspect_list', topology)
    const c53 = list.classify({}, 'call-53')
    expect(c53.ok, `${c53.code} ${c53.detail}`).toBe(true)
    expect(c53.targetManifest).toEqual({ ...TOPOLOGY_SCALARS, listLaw: LIST_LAW, ...TRUSTED_LEAVES })
    expect(keysOf(c53.targetManifest)).toEqual(sorted([...requiredKeysOf('B-INSPECT'), 'listLaw']))
    expect(validatePaFamilyTarget('B-INSPECT', c53.targetManifest))
      .toBe('listLaw: not part of the B-INSPECT typed plan')
    const query = mountRow('cordis_inspect_query', topology)
    const c54 = query.classify({ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, 'call-54')
    expect(c54.ok, `${c54.code} ${c54.detail}`).toBe(true)
    expect(c54.targetManifest).toEqual({
      ...TOPOLOGY_SCALARS, queryClaim: { platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, ...TRUSTED_LEAVES,
    })
    expect(keysOf(c54.targetManifest)).toEqual(sorted([...requiredKeysOf('B-INSPECT'), 'queryClaim']))
    expect(validatePaFamilyTarget('B-INSPECT', c54.targetManifest))
      .toBe('queryClaim: not part of the B-INSPECT typed plan')
    const c54c = query.classify({ platform: 'client', provider: 'dsh_compute', method: 'compute_health' }, 'call-54c')
    expect(c54c.ok, `${c54c.code} ${c54c.detail}`).toBe(true)
    expect(c54c.targetManifest).toEqual({
      ...TOPOLOGY_SCALARS, queryClaim: { platform: 'client', provider: 'dsh_compute', method: 'compute_health' }, clientRoundtrip: CLIENT_ROUNDTRIP, ...TRUSTED_LEAVES,
    })
    expect(keysOf(c54c.targetManifest)).toEqual(sorted([...requiredKeysOf('B-INSPECT'), 'queryClaim', 'clientRoundtrip']))
    expect(validatePaFamilyTarget('B-INSPECT', c54c.targetManifest))
      .toBe('queryClaim: not part of the B-INSPECT typed plan')
    // the refused carrier shape is GONE from the mint too (957 revert):
    expect(JSON.stringify(c54c.targetManifest)).not.toContain('inspectTarget')
  })

  it('the signed rules enforce the closed law: foreign key, absent leaf and wrong kind deny with the closed codes', () => {
    const flatControl = { ...TRUSTED_LEAVES }
    expect(validatePaFamilyTarget('B-CONTROL', { ...flatControl, surface: { transport: 'stdio' } }))
      .toBe('surface: not part of the B-CONTROL typed plan')
    expect(validatePaFamilyTarget('B-CONTROL', without(flatControl, 'trustedOwner')))
      .toBe('trustedOwner: required by the B-CONTROL typed plan, absent')
    expect(validatePaFamilyTarget('B-CONTROL', { ...flatControl, trustedProfileId: 7 }))
      .toBe('trustedProfileId: not a string')

    const scalarFloor = { ...TOPOLOGY_SCALARS, ...TRUSTED_LEAVES }
    expect(validatePaFamilyTarget('B-INSPECT', { ...scalarFloor, queryClaim: { platform: 'host' } }))
      .toBe('queryClaim: not part of the B-INSPECT typed plan')
    expect(validatePaFamilyTarget('B-INSPECT', without(scalarFloor, 'topologyDigest')))
      .toBe('topologyDigest: required by the B-INSPECT typed plan, absent')
    expect(validatePaFamilyTarget('B-INSPECT', { ...scalarFloor, topologyRevision: 'nine' }))
      .toBe('topologyRevision: not a nonNegativeInt')
    expect(validatePaFamilyTarget('B-INSPECT', { ...scalarFloor, trustedOwner: '' }))
      .toBe('trustedOwner: not a string')
  })

  it('current-facts re-verification stays live (base nested queryClaim read restored; flat topology scalars): fresh delegate runs the captured face; moved topology / de-authorized triple refuse with byte-identical stale words; the classify-time authorization law is unchanged', async () => {
    const state = {
      revision: 9,
      allowed: [{ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }],
    }
    const query = mountRow('cordis_inspect_query', () => ({ topologyRevision: state.revision, topologyDigest: 'sha256;topo', allowed: state.allowed }))
    // fresh: same CURRENT facts at the edge → the captured face runs once.
    const fresh = query.classify({ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, 'call-fresh')
    expect(fresh.ok).toBe(true)
    const ran = await query.delegate(fresh.plan, { exec: { callId: 'call-fresh' } })
    expect(ran.ok, `${ran.code} ${ran.detail}`).toBe(true)
    // classify on the CURRENT facts, THEN the CURRENT fact moves → stale,
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
    // classify WHILE authorized, then de-authorize → the same stale refusal,
    // the same words, over the nested stored.queryClaim as one triple.
    state.allowed = [{ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }]
    const ok2 = query.classify({ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, 'call-ok2')
    expect(ok2.ok).toBe(true)
    state.allowed = []
    const staleTriple = await query.delegate(ok2.plan, { exec: { callId: 'call-ok2' } })
    expect(staleTriple.ok).toBe(false)
    expect(staleTriple.code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(String(staleTriple.detail)).toContain('the query triple is no longer in the CURRENT authorized topology')
  })

  it('B-MCP: STILL no rule registered — every measured variant denies at the table gate with the wire-pinned string (named gap, encoding FROZEN, proposal NOT approved)', () => {
    expect(PA_FAMILY_TARGET_RULES['B-MCP']).toBeUndefined()
    const deny = `familyId: no target structure is registered for 'B-MCP'`
    expect(validatePaFamilyTarget('B-MCP', B_MCP_STDIO_LIST)).toBe(deny)
    expect(validatePaFamilyTarget('B-MCP', B_MCP_READ)).toBe(deny)
    expect(validatePaFamilyTarget('B-MCP', B_MCP_HTTP_DOMAIN)).toBe(deny)
    // the table itself: the signed CONTROL/INSPECT scalar entries landed, MCP did not.
    expect(Object.keys(PA_FAMILY_TARGET_RULES))
      .toEqual(['B-SESSION', 'B-IMAGE', 'B-WRITE', 'B-CONTROL', 'B-INSPECT'])
  })

  it('the REFUSED grammar, MEASURED through the existing rules (root 957 reason pinned): the generic obligations kind ACCEPTS [{}], junk interiors and multiple elements — it cannot verify a triple; countsTriple is ONLY the todo triple', () => {
    // THE flaw: [{}] (one empty object) validates as 'obligations' —
    // undefined = ACCEPTED. Exactly why inspectTarget:obligations was refused.
    expect(validatePaFamilyTarget('B-IMAGE', {
      ...B_IMAGE_REAL,
      businessObligations: [{}],
    })).toBeUndefined()
    // junk interiors and multiple elements also ride through unverified:
    expect(validatePaFamilyTarget('B-IMAGE', {
      ...B_IMAGE_REAL,
      businessObligations: [{ anything: 1 }, { nope: [1, 2] }, {}],
    })).toBeUndefined()
    // while a strict plain-object carrier does not exist among the kinds:
    expect(validatePaFamilyTarget('B-SESSION', {
      ...B_SESSION_REAL,
      counts: { topologyRevision: 9, topologyDigest: 'sha256;topo' },
    })).toBe('counts: not a countsTriple')
    expect(validatePaFamilyTarget('B-SESSION', {
      ...B_SESSION_REAL,
      counts: { platform: 'host', provider: 'dsh_compute', method: 'compute_health' },
    })).toBe('counts: not a countsTriple')
    expect(validatePaFamilyTarget('B-IMAGE', {
      ...B_IMAGE_REAL,
      businessObligations: { memberAgentId: 'agent-a5m2' },
    })).toBe('businessObligations: not a obligations')
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
