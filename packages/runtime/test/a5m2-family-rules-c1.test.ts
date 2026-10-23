/**
 * A5M2-FAMILY-RULES C1 — round 2: the B-CONTROL and B-INSPECT PA_FAMILY_TARGET_RULES
 * entries LAND paired with their mint side (root ruling: pure-equivalence leaf
 * flattening); B-MCP stays the NAMED GAP with a proposal-only correction.
 *
 * ROUND 1 (commit 2ffdd89b7, three rules refused-as-named-gaps) measured every
 * real claim shape against the committed lane modules (runtime-verified):
 *   B-CONTROL (records 83/84/85/87/88): EXACTLY { trusted: {memberAgentId,
 *     sessionHeaderId, realmId, owner, profileId} } — one nested object.
 *   B-INSPECT: rec 53 [topology{topologyRevision,topologyDigest}, listLaw
 *     <law string>, trusted]; rec 54 [topology, queryClaim{platform,provider,
 *     method}, trusted]; rec 54 client additionally [clientRoundtrip <law
 *     string>] — nested objects, and the two records DISAGREE on key sets.
 *   B-MCP: nested `surface` object on EVERY claim + per-call conditional keys
 *     cursor/uriVerbatim/uriOpacity/connectionIncarnationReason/domainAuthorityId
 *     (g2-connector-adapters.mjs:730-762).
 * The closed kind union (control/types.ts PaFamilyTargetFieldKind +
 * isPaFamilyTargetField) has no plain-object kind and the closed-key law
 * demands ONE exact key set per family — a rule over the NESTED shapes was
 * impossible (round-1 refusal, root-accepted: center's quoted field names were
 * summary wording, void as spec; pure equivalence pins to the measured source).
 *
 * ROUND 2 (root ruling, this commit): CONTROL + INSPECT proceed INDEPENDENTLY
 * with PURE-EQUIVALENCE LEAF FLATTENING, both sides PAIRED in one change:
 *   MINT  src/plugin/live/governed-families/g1-surface-adapters.mjs — classify
 *     mints flat leaves for the two landed families ONLY (every other family
 *     keeps the nested `trusted` envelope BYTE-IDENTICAL; no rule landed for
 *     them, their claims still fail closed — no drift either way). The
 *     B-INSPECT edge re-verify (reVerifyAtEdge) reads the flat leaves from the
 *     SAME CURRENT-facts source with the SAME verdicts and byte-identical
 *     stale strings; parametersFingerprint keeps its digest-of-input binding
 *     verbatim (it rides the plan outside the target, untouched); no fact
 *     added, none dropped — the encoding is a bijection of the measured
 *     nested shape (the MEASURED MAPPING TABLE, nested path -> flat field ->
 *     existing kind):
 *       trusted.memberAgentId     -> trustedMemberAgentId   ('string')
 *       trusted.sessionHeaderId   -> trustedSessionHeaderId ('string')
 *       trusted.realmId           -> trustedRealmId         ('string')
 *       trusted.owner             -> trustedOwner           ('string')
 *       trusted.profileId         -> trustedProfileId       ('string')
 *       topology.topologyRevision -> topologyRevision       ('nonNegativeInt')
 *       topology.topologyDigest   -> topologyDigest         ('string')
 *       listLaw (rec 53)          -> inspectTarget[0].listLaw
 *       queryClaim.platform       -> inspectTarget[0].platform   ('obligations'
 *       queryClaim.provider       -> inspectTarget[0].provider    kind used
 *       queryClaim.method         -> inspectTarget[0].method      STRUCTURALLY:
 *                                    non-empty array of plain objects)
 *       clientRoundtrip (client)  -> inspectTarget[0].clientRoundtrip
 *     `inspectTarget` is the ONE single-item array that keeps each record's
 *     VARIANT facts TOGETHER — the correlated query triple stays one object
 *     (the edge reads it as one triple) — so ONE closed rule serves both
 *     records although their nested key sets differed. Nothing invented:
 *     every leaf is a measured fact at the same check order.
 *   RULE  PA_FAMILY_TARGET_RULES gains 'B-CONTROL' and 'B-INSPECT' — the TABLE
 *     key MUST equal the claim's familyId string as the module spells it (the
 *     card's PA-B-* wording is prose naming; a PA- prefixed key could never be
 *     found by validatePaFamilyTarget's familyId lookup) — using ONLY the
 *     existing kinds, exactly the leaves above.
 *
 * B-MCP REMAINS THE NAMED GAP (root FROZE any MCP encoding change): the five
 * variant keys and the nested surface object may not move to layers that do
 * not participate in the full-manifest digest/current facts, and nothing is
 * deleted to please closed-key. The ONE minimal contract correction (exact
 * validator/closed-key accommodation + its M0 semantic-equivalence argument)
 * is PROPOSAL-ONLY:
 * dev/agent-workflow/evidence/a5m2-family-rules/a5m2-mcp-closed-key-proposal.md
 *
 * PAIRING LAW (root ruling): a PA_FAMILY_TARGET_RULES entry and its
 * registerA5GovernedFamily mint side land TOGETHER, one pair per change. This
 * change pairs each new RULE with its CLAIM-SHAPE mint (the classify flatten);
 * it still registers NOTHING in pa-mount-registry — the governed-family
 * registration for the G1 rows lands WITH the wire lane, against exactly these
 * shapes, and no lane may mint a registration without its paired rule.
 *
 * LEGS: 1-2 ACCEPT: the REAL adapter's classify output (mounted rows, real
 * CURRENT-facts ports) validates and the claim's key set equals the rule's
 * required set byte-for-field; 3 the closed law still bites on the new rules
 * (foreign key / absent leaf / wrong kind) and the PRE-RULE nested forms now
 * deny explicitly (migration honesty: they never landed either way);
 * 4 the B-INSPECT current-facts re-verify stays live over the flat leaves —
 * fresh delegate runs the captured face, moved topology / de-authorized triple
 * refuse with byte-identical stale words, and the classify-time authorization
 * law itself is unchanged; 5 B-MCP stays the named gap with the wire lanes'
 * pinned deny string untouched; 6 the closed kind union still refuses plain
 * nested objects (why the flatten was needed — pinned through the PRE-EXISTING
 * rules' behaviour, never an invented kind); 7-9 byte-identical regression
 * legs of the three pre-existing rules against their lanes' real shapes
 * (todo.mjs:234-246, write.mjs:246-258, image.mjs:249-268).
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

describe('A5M2-FAMILY-RULES C1 round 2: B-CONTROL/B-INSPECT paired rule+mint ACCEPT over flattened leaves; B-MCP stays the named gap', () => {
  it('B-CONTROL ACCEPT: the REAL classify output of records 85 and 83 validates, field-for-field against the paired rule', () => {
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
    // the PRE-RULE nested form never landed before (no rule) and denies
    // explicitly now — the flat leaves are the only accepted shape.
    expect(validatePaFamilyTarget('B-CONTROL', { trusted: TRUSTED }))
      .toBe('trustedMemberAgentId: required by the B-CONTROL typed plan, absent')
  })

  it('B-INSPECT ACCEPT: all THREE measured variants of the REAL classify output validate, field-for-field against the one rule', () => {
    const topology = () => ({
      topologyRevision: 9,
      topologyDigest: 'sha256;topo',
      allowed: [
        { platform: 'host', provider: 'dsh_compute', method: 'compute_health' },
        { platform: 'client', provider: 'dsh_compute', method: 'compute_health' },
      ],
    })
    const list = mountRow('cordis_inspect_list', topology)
    const c53 = list.classify({}, 'call-53')
    expect(c53.ok, `${c53.code} ${c53.detail}`).toBe(true)
    expect(c53.targetManifest).toEqual({
      topologyRevision: 9, topologyDigest: 'sha256;topo', inspectTarget: [{ listLaw: LIST_LAW }],
      ...TRUSTED_LEAVES,
    })
    expect(keysOf(c53.targetManifest)).toEqual(requiredKeysOf('B-INSPECT'))
    expect(validatePaFamilyTarget('B-INSPECT', c53.targetManifest)).toBeUndefined()

    const query = mountRow('cordis_inspect_query', topology)
    const c54 = query.classify({ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, 'call-54')
    expect(c54.ok, `${c54.code} ${c54.detail}`).toBe(true)
    expect(c54.targetManifest).toEqual({
      topologyRevision: 9, topologyDigest: 'sha256;topo',
      inspectTarget: [{ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }],
      ...TRUSTED_LEAVES,
    })
    expect(keysOf(c54.targetManifest)).toEqual(requiredKeysOf('B-INSPECT'))
    expect(validatePaFamilyTarget('B-INSPECT', c54.targetManifest)).toBeUndefined()

    const c54c = query.classify({ platform: 'client', provider: 'dsh_compute', method: 'compute_health' }, 'call-54c')
    expect(c54c.ok, `${c54c.code} ${c54c.detail}`).toBe(true)
    expect(c54c.targetManifest).toEqual({
      topologyRevision: 9, topologyDigest: 'sha256;topo',
      inspectTarget: [{ platform: 'client', provider: 'dsh_compute', method: 'compute_health', clientRoundtrip: CLIENT_ROUNDTRIP }],
      ...TRUSTED_LEAVES,
    })
    expect(validatePaFamilyTarget('B-INSPECT', c54c.targetManifest)).toBeUndefined()
    // the PRE-RULE nested form denies explicitly now (migration honesty).
    expect(validatePaFamilyTarget('B-INSPECT', {
      topology: { topologyRevision: 9, topologyDigest: 'sha256;topo' }, listLaw: LIST_LAW, trusted: TRUSTED,
    })).toBe('topologyRevision: required by the B-INSPECT typed plan, absent')
  })

  it('the new rules enforce the closed law: foreign key, absent leaf and wrong kind deny with the closed codes', () => {
    const flatControl = { ...TRUSTED_LEAVES }
    expect(validatePaFamilyTarget('B-CONTROL', { ...flatControl, surface: { transport: 'stdio' } }))
      .toBe('surface: not part of the B-CONTROL typed plan')
    expect(validatePaFamilyTarget('B-CONTROL', without(flatControl, 'trustedOwner')))
      .toBe('trustedOwner: required by the B-CONTROL typed plan, absent')
    expect(validatePaFamilyTarget('B-CONTROL', { ...flatControl, trustedProfileId: 7 }))
      .toBe('trustedProfileId: not a string')

    const flatInspect = {
      topologyRevision: 9,
      topologyDigest: 'sha256;topo',
      inspectTarget: [{ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }],
      ...TRUSTED_LEAVES,
    }
    expect(validatePaFamilyTarget('B-INSPECT', { ...flatInspect, queryClaim: { platform: 'host' } }))
      .toBe('queryClaim: not part of the B-INSPECT typed plan')
    expect(validatePaFamilyTarget('B-INSPECT', without(flatInspect, 'topologyDigest')))
      .toBe('topologyDigest: required by the B-INSPECT typed plan, absent')
    expect(validatePaFamilyTarget('B-INSPECT', { ...flatInspect, topologyRevision: 'nine' }))
      .toBe('topologyRevision: not a nonNegativeInt')
    expect(validatePaFamilyTarget('B-INSPECT', { ...flatInspect, inspectTarget: [] }))
      .toBe('inspectTarget: not a obligations')
  })

  it('current-facts re-verification stays live over the flat leaves: fresh delegate runs the captured face; moved topology / de-authorized triple refuse with byte-identical stale words; the classify-time authorization law is unchanged', async () => {
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
    // byte-identical words (the plan is classified at revision 9 and the edge
    // answers revision 10 — the same order the nested edge verified in).
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
    // the same words, over inspectTarget[0] as one correlated triple.
    state.allowed = [{ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }]
    const ok2 = query.classify({ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }, 'call-ok2')
    expect(ok2.ok).toBe(true)
    state.allowed = []
    const staleTriple = await query.delegate(ok2.plan, { exec: { callId: 'call-ok2' } })
    expect(staleTriple.ok).toBe(false)
    expect(staleTriple.code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(String(staleTriple.detail)).toContain('the query triple is no longer in the CURRENT authorized topology')
  })

  it('B-MCP: STILL no rule registered — every measured variant denies at the table gate with the wire-pinned string (named gap, encoding FROZEN, proposal-only correction)', () => {
    expect(PA_FAMILY_TARGET_RULES['B-MCP']).toBeUndefined()
    const deny = `familyId: no target structure is registered for 'B-MCP'`
    expect(validatePaFamilyTarget('B-MCP', B_MCP_STDIO_LIST)).toBe(deny)
    expect(validatePaFamilyTarget('B-MCP', B_MCP_READ)).toBe(deny)
    expect(validatePaFamilyTarget('B-MCP', B_MCP_HTTP_DOMAIN)).toBe(deny)
    // the table itself: the paired CONTROL/INSPECT entries landed, MCP did not.
    expect(Object.keys(PA_FAMILY_TARGET_RULES))
      .toEqual(['B-SESSION', 'B-IMAGE', 'B-WRITE', 'B-CONTROL', 'B-INSPECT'])
  })

  it('the closed kind union has no plain-object kind (why the flatten was needed) — pinned through the PRE-EXISTING rules: countsTriple is ONLY the todo triple, obligations ONLY non-empty object arrays', () => {
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
