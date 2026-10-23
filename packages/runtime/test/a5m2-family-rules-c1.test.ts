/**
 * A5M2-FAMILY-RULES C1 — round 6 (root 19:06) lands at the bottom: the REAL
 * closed rule maps for B-SCHEDULE (11 measured leaves; wire @3e88b2822,
 * adapter rev 2; subset delete(31)/list(32) - create/update stay disabled
 * lane-side, not by this table) and B-SESSION-QUERY (rev-4 mint
 * @fe63dec9e; both search rows REQUIRE maxSearchResults, the three
 * always-mount rows FORBID it; callerWorkspaceCwd null|""|string; the
 * one-element SESSION_HISTORY disclosure law stays mint-side). Claims are
 * transcribed field-for-field from read-only fixed-commit reads; grammar
 * entries are type gates - no Host, no C2 claim, real PA assembly is the
 * wire lanes' own obligation.
 *
 * A5M2-FAMILY-RULES C1 — round 5 (root 18:42 LIMITED ruling on c80fad) adds
 * at the bottom: 'nullableString' + 'stringArray' as committed grammar under
 * at the bottom: 'nullableString' + 'stringArray' as committed grammar under
 * the six signed constraints (empty string LEGAL in nullableString — this
 * SUPERSEDES the candidate doc's length>0 line; missing ≠ null ≠ '' pinned as
 * distinct outcomes; disclosure-contract CORRECTION leg; per-group
 * maxSearchResults law through the already-signed variant grammar; guard
 * kind-table sync; revision semantics). The two new families are NOT
 * registered here — their RULES land only after the root's ruling on this
 * commit; all synthetic driving happens in the test namespace through
 * validatePaFamilyTargetAgainstRule.
>>>>>>> 5a16c4aab (feat(a5m2-family-rules): B-SCHEDULE + B-SESSION-QUERY closed rule maps LANDED (root 19:06) - measured read-only at the wire fixed commits; type gates only, no Host, no C2 claim)
 *
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
      .toEqual(['B-SESSION', 'B-IMAGE', 'B-WRITE', 'B-CONTROL', 'B-INSPECT', 'B-SCHEDULE', 'B-SESSION-QUERY'])
    // The discriminated variant grammar is carried ONLY by B-INSPECT and
    // (per root 18:42/19:06) B-SESSION-QUERY - it does NOT generalize to
    // B-MCP or to any other entry:
    for (const familyId of Object.keys(PA_FAMILY_TARGET_RULES)) {
      expect(PA_FAMILY_TARGET_RULES[familyId]?.variant === undefined, familyId)
        .toBe(familyId !== 'B-INSPECT' && familyId !== 'B-SESSION-QUERY')
    }
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

/* ─────────────────────────────────────────────────────────────────────────
 * ROUND 5 (root 18:42 LIMITED ruling on c80fad): 'nullableString' +
 * 'stringArray' as committed grammar under EXACTLY the six signed
 * constraints, one leg each. At round 5 time B-SCHEDULE/B-SESSION-QUERY
 * were NOT registered (their RULES waited for the root's ruling - which
 * arrived at 19:06 and lands as the round-6 describe below); every synthetic
 * claim here runs the REAL law through validatePaFamilyTargetAgainstRule in
 * this test namespace - the real table still denies unknown families with
 * the wire-pinned string.
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
    // ROOT 5d83 RESIDUAL, fixed point: a REAL array whose `every` is
    // OVERRIDDEN (own key, or via a subclass prototype) can no longer fake
    // admission - the walk is the trusted Array.prototype.every intrinsic,
    // never a dispatch through the value's own `every`:
    const riggedOwn: unknown[] = [1]
    Object.defineProperty(riggedOwn, 'every', { value: () => true, enumerable: false })
    expect(check({ ...SEARCH_OK, disclosures: riggedOwn })).toBe('disclosures: not a stringArray')
    const subclassRigged = Object.setPrototypeOf([1], Object.defineProperty(Object.create(Array.prototype), 'every', { value: () => true }))
    expect(check({ ...SEARCH_OK, disclosures: subclassRigged })).toBe('disclosures: not a stringArray')
    // measured behavior, recorded honestly and UNCHANGED by the closure (root
    // 5d83: sparse is NOT reopened - upstream lossless refuses holes, the
    // intrinsic every skips them exactly as value.every did): every() SKIPS
    // HOLES, so a sparse dense-start array passes the KIND check; irrelevant
    // for G6 (its disclosures mint as dense literals, g6-session-query.mjs:853):
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
    // NO LEAK on the ORIGINAL five families: they keep the original five
    // kinds exactly (the two NEW kinds appear only in the two RULES root
    // 19:06 landed - their own legs are the round-6 describe below):
    const ORIGINAL = new Set<string>(['string', 'boolean', 'nonNegativeInt', 'countsTriple', 'obligations'])
    for (const familyId of ['B-SESSION', 'B-IMAGE', 'B-WRITE', 'B-CONTROL', 'B-INSPECT']) {
      const rule = PA_FAMILY_TARGET_RULES[familyId]
      if (rule === undefined) throw new Error(`signed family ${familyId} disappeared`)
      for (const kind of Object.values(rule.required)) expect(ORIGINAL.has(kind), kind).toBe(true)
      for (const group of Object.values(rule.variant?.by ?? {})) {
        for (const kind of Object.values(group.adds)) expect(ORIGINAL.has(kind), kind).toBe(true)
      }
    }
    // a still-UNREGISTERED family denies with the wire-pinned string (the
    // registry surface only grew by the two RULES the root ruled in):
    expect(validatePaFamilyTarget('B-DOMAIN', {}))
      .toBe(`familyId: no target structure is registered for 'B-DOMAIN'`)
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

/* ─────────────────────────────────────────────────────────────────────────
 * ROUND 6 (root 19:06): the REAL closed rule maps for B-SCHEDULE and
 * B-SESSION-QUERY land in PA_FAMILY_TARGET_RULES per the already-approved
 * 18:42 structure. Claims below are transcribed FIELD-FOR-FIELD from the
 * real mints measured READ-ONLY at fixed commits (root: read their actual
 * mint, never copy/write the other trees):
 *   B-SCHEDULE        schedule-wiring.mjs mintTargetManifest return object,
 *                     feat/a5m2-wire-schedule @3e88b2822c3ffde3d941b21ebe3dd9c2fc5765f2
 *                     :150-203 (adapter A5_B_SCHEDULE_ADAPTER_REVISION = 2,
 *                     schedule-adapters.mjs :265) - 11 measured leaves, one
 *                     closed key set, taskId null | validated id.
 *   B-SESSION-QUERY   targetManifest literal, feat/a5m2-wire-g6
 *                     @fe63dec9ef10addc26bcac9a96265f8fdb17be3a:1346-1355
 *                     (A5_G6_ADAPTER_REVISION = 4, :214) - 7 base leaves +
 *                     maxSearchResults ONLY on the two search rows; the
 *                     unfixed :1353 key-with-undefined form is pinned
 *                     failing CLOSED (the routed owner-side mint fix is key
 *                     OMISSION; this table never translates).
 * LEAF VALUES are representative of the lanes' real values; the KEY SETS,
 * TYPES and null-vs-omitted discipline are exactly as measured. Leaf values
 * are typed by the kinds; family laws (id trim-stability, the one-element
 * SESSION_HISTORY disclosure, C1 destination equality) stay mint-side and
 * are cited, never encoded here. Grammar entries are TYPE GATES: nothing
 * here mounts anything, enables Host, or claims C2 - the real PA assembly
 * stays the wire lanes' own obligation.
 * ───────────────────────────────────────────────────────────────────────── */
describe('A5M2-FAMILY-RULES C1 round 6 (root 19:06): the real B-SCHEDULE + B-SESSION-QUERY closed maps - claims transcribed from the wire mints at fixed commits', () => {
  const G6_DISCLOSURE = 'SESSION_HISTORY_RESOURCE_KIND law sentence (rev-4 mints disclosures === [this blocker] on EVERY row, wire-g6 @fe63dec9e:1354, never droppable - mint-side law, not the kind)'
  const SCHEDULE_DELETE_CLAIM: Record<string, unknown> = {
    // @3e88b2822:191-203 projection, schedule_delete (record 31), admitted id:
    contract: 'M0-B-FAMILY-TARGET-CONTRACTS §B-SCHEDULE — target I+S(owner session+taskId+revision,action)+S(timer namespace,arm/reschedule/disarm)+S(destination session,wake)',
    ownerKind: 'bound-live-agent-reference',
    ownerSessionId: 'sess-owner-1',
    action: 'schedule-delete',
    taskId: 'sched-0007x9',
    revision: 'r3',
    timerNamespace: 'ns-team-a5m2',
    timerEffect: 'disarm',
    destinationSessionId: 'sess-owner-1',
    destinationPath: 'inbox/timers',
    destinationWake: 'followup',
  }
  const SCHEDULE_LIST_CLAIM: Record<string, unknown> = {
    // same projection, schedule_list (record 32): taskId rides NULL as measured
    ...SCHEDULE_DELETE_CLAIM,
    action: 'schedule-list',
    taskId: null,
    timerEffect: 'arm',
  }
  const G6_SEARCH_CLAIM: Record<string, unknown> = {
    // wire-g6 @fe63dec9e:1346-1355, session_search (search family): the
    // variant leaf + REQUIRED maxSearchResults:
    toolName: 'session_search',
    operation: 'search-across-sessions',
    portFamily: 'search',
    portMethod: 'searchSessions',
    effectiveTargetSessionId: 'sess-caller-1',
    callerWorkspaceCwd: '/srv/work',
    maxSearchResults: 50,
    disclosures: [G6_DISCLOSURE],
  }
  const G6_TRACE_CLAIM: Record<string, unknown> = {
    // same mint, session_trace (always-mount row): NO maxSearchResults key
    // (post routed-mint-fix omission; the CURRENT key-with-undefined form is
    // its own CLOSED leg below):
    toolName: 'session_trace',
    operation: 'trace-session-lineage',
    portFamily: 'trace',
    portMethod: 'traceSession',
    effectiveTargetSessionId: 'sess-target-1',
    callerWorkspaceCwd: null,
    disclosures: [G6_DISCLOSURE],
  }

  it('B-SCHEDULE ACCEPT: both signable rows (delete 31, list 32) validate field-for-field; taskId keeps null|non-empty as measured; ""-admission is the GRAMMAR law (18:42(1)) while non-empty+trim-stable stays the wire lane\'s BUSINESS edge (@3e88b2822:511-517)', () => {
    expect(PA_FAMILY_TARGET_RULES['B-SCHEDULE']).toBeDefined()
    expect(validatePaFamilyTarget('B-SCHEDULE', SCHEDULE_DELETE_CLAIM)).toBeUndefined()
    expect(validatePaFamilyTarget('B-SCHEDULE', SCHEDULE_LIST_CLAIM)).toBeUndefined()
    expect(keysOf(SCHEDULE_DELETE_CLAIM)).toEqual(requiredKeysOf('B-SCHEDULE'))
    expect(requiredKeysOf('B-SCHEDULE')).toHaveLength(11)
    expect(PA_FAMILY_TARGET_RULES['B-SCHEDULE']?.required.taskId).toBe('nullableString')
    expect(PA_FAMILY_TARGET_RULES['B-SCHEDULE']?.variant).toBeUndefined() // ONE measured shared key set - no groups needed
    // grammar-vs-business-edge honesty, pinned so nobody reads the kind as
    // the id law: '' PASSES the grammar (18:42(1)); the delete id law
    // (non-empty, no surrounding whitespace) refuses it at the lane's edge.
    expect(validatePaFamilyTarget('B-SCHEDULE', { ...SCHEDULE_DELETE_CLAIM, taskId: '' })).toBeUndefined()
    // negatives: the three distinct taskId states + closed key set:
    expect(validatePaFamilyTarget('B-SCHEDULE', without(SCHEDULE_DELETE_CLAIM, 'taskId')))
      .toBe('taskId: required by the B-SCHEDULE typed plan, absent')
    expect(validatePaFamilyTarget('B-SCHEDULE', { ...SCHEDULE_DELETE_CLAIM, taskId: undefined }))
      .toBe('taskId: not a nullableString')
    expect(validatePaFamilyTarget('B-SCHEDULE', { ...SCHEDULE_DELETE_CLAIM, taskId: 7 }))
      .toBe('taskId: not a nullableString')
    expect(validatePaFamilyTarget('B-SCHEDULE', { ...SCHEDULE_DELETE_CLAIM, action: '' }))
      .toBe('action: not a string')
    expect(validatePaFamilyTarget('B-SCHEDULE', { ...SCHEDULE_DELETE_CLAIM, triggerLicense: 'future wakes authorized' }))
      .toBe('triggerLicense: not part of the B-SCHEDULE typed plan')
    // ENABLEMENT IS NOT THIS TABLE: create(30)/update(33) stay disabled by
    // the wire lane's A5_B_SCHEDULE_WIRING_SUBSET + registration - no claim
    // for them ever reaches this gate; nothing here enables Host.
  })

  it('B-SESSION-QUERY ACCEPT: all FIVE rev-4 rows validate on the closed maps - both search rows REQUIRE maxSearchResults, the three always-mount rows FORBID it; callerWorkspaceCwd keeps null|""|string; disclosures stays a mint-enforced law sentence list', () => {
    expect(PA_FAMILY_TARGET_RULES['B-SESSION-QUERY']).toBeDefined()
    expect(validatePaFamilyTarget('B-SESSION-QUERY', G6_SEARCH_CLAIM)).toBeUndefined()
    expect(validatePaFamilyTarget('B-SESSION-QUERY', { ...G6_SEARCH_CLAIM, toolName: 'session_event_search', operation: 'search-within-session', portMethod: 'searchEvents' })).toBeUndefined()
    expect(keysOf(G6_SEARCH_CLAIM)).toEqual([...requiredKeysOf('B-SESSION-QUERY'), 'maxSearchResults'].sort())
    for (const [toolName, operation, portMethod] of [
      ['session_trace', 'trace-session-lineage', 'traceSession'],
      ['session_event_trace', 'trace-event-relationships', 'traceEvent'],
      ['session_event_read', 'read-event-window', 'readEvent'],
    ] as const) {
      const claim = { ...G6_TRACE_CLAIM, toolName, operation, portMethod }
      expect(validatePaFamilyTarget('B-SESSION-QUERY', claim), toolName).toBeUndefined()
      expect(keysOf(claim)).toEqual(requiredKeysOf('B-SESSION-QUERY'))
    }
    // callerWorkspaceCwd - the 18:42(1) three-value law on the REAL rule:
    expect(validatePaFamilyTarget('B-SESSION-QUERY', { ...G6_TRACE_CLAIM, callerWorkspaceCwd: '' })).toBeUndefined()
    expect(validatePaFamilyTarget('B-SESSION-QUERY', without(G6_TRACE_CLAIM, 'callerWorkspaceCwd')))
      .toBe('callerWorkspaceCwd: required by the B-SESSION-QUERY typed plan, absent')
    expect(validatePaFamilyTarget('B-SESSION-QUERY', { ...G6_TRACE_CLAIM, callerWorkspaceCwd: 5 }))
      .toBe('callerWorkspaceCwd: not a nullableString')
    // effectiveTargetSessionId stays strict 'string': the mint ternary's
    // ': null' arm (@fe63dec9e:1351) is MEASURED-DEAD - validateCapturedArgs
    // enforces the captured schema's string type (:1312-1316, "nothing is
    // coerced") and requireCaller pins a non-empty caller.id:
    expect(validatePaFamilyTarget('B-SESSION-QUERY', { ...G6_TRACE_CLAIM, effectiveTargetSessionId: null }))
      .toBe('effectiveTargetSessionId: not a string')
    // per-group maxSearchResults law (18:42(4)):
    for (const bad of [50, 0, null, '50', undefined]) {
      expect(validatePaFamilyTarget('B-SESSION-QUERY', { ...G6_TRACE_CLAIM, maxSearchResults: bad }), String(bad))
        .toBe('maxSearchResults: not part of the B-SESSION-QUERY typed plan')
    }
    expect(validatePaFamilyTarget('B-SESSION-QUERY', without(G6_SEARCH_CLAIM, 'maxSearchResults')))
      .toBe('maxSearchResults: required by the B-SESSION-QUERY typed plan, absent')
    expect(validatePaFamilyTarget('B-SESSION-QUERY', { ...G6_SEARCH_CLAIM, maxSearchResults: null }))
      .toBe('maxSearchResults: not a nonNegativeInt')
    // PAIRING (fail-closed until the routed owner fix): wire-g6 :1353 CURRENTLY
    // still writes maxSearchResults: undefined on non-search rows - that
    // key-with-undefined form denies HERE exactly as it dies at the lossless
    // walk; the fix is key OMISSION on the mint side (routed 18:42), and this
    // table translates NOTHING. The row above (undefined → 'not part') is
    // this pairing's pin.
    // disclosures: the KIND admits [] and any all-string array; the FAMILY
    // law (rev-4 mints EXACTLY [SESSION_HISTORY_RESOURCE_KIND], never
    // droppable, @fe63dec9e:1354) is mint-side - never weakened, never
    // moved into the grammar (18:42(3), pinned again against misreading):
    expect(validatePaFamilyTarget('B-SESSION-QUERY', { ...G6_TRACE_CLAIM, disclosures: [] })).toBeUndefined()
    expect(validatePaFamilyTarget('B-SESSION-QUERY', { ...G6_TRACE_CLAIM, disclosures: ['a', 1] }))
      .toBe('disclosures: not a stringArray')
    // own-key variant closure + strict-string discriminant:
    expect(validatePaFamilyTarget('B-SESSION-QUERY', { ...G6_TRACE_CLAIM, toolName: 'session_bogus' }))
      .toBe(`toolName: 'session_bogus' selects no B-SESSION-QUERY variant group`)
    expect(validatePaFamilyTarget('B-SESSION-QUERY', { ...G6_TRACE_CLAIM, toolName: 'toString' }))
      .toBe(`toolName: 'toString' selects no B-SESSION-QUERY variant group`)
  })
})
