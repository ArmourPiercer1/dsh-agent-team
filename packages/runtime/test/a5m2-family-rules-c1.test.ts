/**
 * A5M2-FAMILY-RULES C1 — the B-MCP / B-INSPECT / B-CONTROL PA_FAMILY_TARGET_RULES
 * gap: MEASURED, and the three rules REFUSED as NAMED gaps (root card: measure,
 * do not invent; never guess-close).
 *
 * THE CARD asked to add the three missing target rules using ONLY the existing
 * typed-plan field vocabulary (kind union `string | boolean | nonNegativeInt |
 * countsTriple | obligations`, control/types.ts:1178-1180), derived from the real
 * claim shapes the lanes produce. Every key set below was RUNTIME-VERIFIED under
 * vitest against the committed lane modules themselves (temporary probe, since
 * deleted):
 *
 *  - B-MCP — src/plugin/live/governed-families/g2-connector-adapters.mjs:730-762.
 *    EVERY claim carries the nested OBJECT `surface` (:733), and the key set
 *    varies per call:
 *      stdio + unobserved incarnation:
 *        [operation, server, surface, providerReSelectionLaw,
 *         connectionIncarnationReason, businessObligations]
 *      read_mcp_resource:            + [uriVerbatim, uriOpacity]  (:753-754)
 *      list with cursor:             + [cursor]                   (:760)
 *      http + injected incarnation + declared domain: drops connectionIncarnationReason,
 *                                                     adds domainAuthorityId (:739-740)
 *  - B-INSPECT — src/plugin/live/governed-families/g1-surface-adapters.mjs:613-633
 *    + the trusted envelope at :715-724. The two records DISAGREE on key sets:
 *      rec 53 cordis_inspect_list:   [topology, listLaw, trusted]
 *      rec 54 cordis_inspect_query:  [topology, queryClaim, trusted]
 *      rec 54 with platform 'client': [topology, queryClaim, clientRoundtrip, trusted]
 *  - B-CONTROL — g1-surface-adapters.mjs:426 (effectsFor builds no B-CONTROL
 *    target) + :715-724: EVERY claim (records 83/84/85/87/88) is EXACTLY
 *    `[trusted]` — one nested object.
 *
 * WHY EACH RULE IS REFUSED (the measurement, not a judgment):
 *  (1) The kind union is CLOSED and no kind accepts a plain nested object:
 *      'countsTriple' accepts ONLY {pending,inProgress,completed} non-negative
 *      integers (types.ts:1247-1253); 'obligations' accepts ONLY a NON-EMPTY
 *      ARRAY of objects (:1254-1257). `surface`, `topology`, `queryClaim` and
 *      `trusted` carry no expressible kind — pinned behaviorally below through
 *      the EXISTING rules (leg 4), never through an invented kind.
 *  (2) validatePaFamilyTarget's closed-key law (:1272-1278) rejects BOTH a
 *      missing required key AND an extra key, so any partial rule (the flat
 *      keys only) would deny EVERY real claim anyway — and would change the
 *      deny text the wire lanes pinned verbatim as this round's landing point
 *      (branch feat/a5m2-wire-merge: bc6cf5ed6 test/a5m2-g2-wire-c1.test.ts:771-772
 *      'family-target-invalid' + 'no target structure is registered for B-MCP';
 *      afc671e64 test/a5m2-g1-wire-c1.test.ts family-seam leg measures the same
 *      gate for B-INSPECT). A rule that no real claim can satisfy is durable-
 *      verifier theatre; closing it that way IS the guess the card forbids.
 *  (3) Closing the three lanes therefore needs a CENTER decision this card
 *      cannot pre-empt: EITHER a field-kind ruling (e.g. a plain-object kind)
 *      landed as its own change, OR lane-side flattened claims PAIRED with each
 *      lane's mint side. Until then all three families stay UNREGISTERED and
 *      every full-family claim fails closed at the validator — fail-closed is
 *      preserved, drift is impossible.
 *
 * PAIRING LAW (root ruling, restated because this commit changes NOTHING in
 * control/types.ts): a PA_FAMILY_TARGET_RULES entry and its
 * registerA5GovernedFamily mint side land TOGETHER, one pair per change; this
 * change registers no rule and mints nothing, and no lane may mint a
 * B-MCP/B-INSPECT/B-CONTROL registration without its paired rule (a claim on
 * an unregistered structure is exactly the durable-verifier drift the wire
 * lanes name).
 *
 * LEGS: 1-3 pin each measured real-shape claim (mirrored field by field from
 * the lane output above) landing on the exact unregistered-structure deny the
 * wire lanes pin; 4 pins the vocabulary impossibility through the existing
 * rules' behaviour; 5-7 are byte-identical regression legs of the three
 * REGISTERED rules against their lanes' real shapes (todo.mjs:234-246,
 * write.mjs:246-258, image.mjs:249-268).
 */
import { describe, expect, it } from 'vitest'
import { PA_FAMILY_TARGET_RULES, validatePaFamilyTarget } from '../control/types.js'

// ── measured real-shape claims (field-by-field mirrors of the lane output) ──

/** The validator's `absent` leg needs the key GONE, not present-and-undefined
 *  (types.ts:1273 checks `field in record`). */
const without = (target: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(target).filter(([name]) => name !== key))

const TRUSTED = Object.freeze({
  memberAgentId: 'agent-a5m2',
  sessionHeaderId: 'sess-a5m2',
  realmId: 'realm-a5m2',
  owner: 'owner-a5m2',
  profileId: 'profile-a5m2',
})

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

/** g1-surface-adapters.mjs:613-633 + :715-724 — record 53 (list). */
const B_INSPECT_LIST = Object.freeze({
  topology: Object.freeze({ topologyRevision: 9, topologyDigest: 'sha256;topo' }),
  listLaw: 'the real list enumerates ALL providers; the row constrains that answer to the CURRENT authorized topology — unauthorized providers never appear',
  trusted: TRUSTED,
})

/** record 54 host query; the client variant carries clientRoundtrip ON TOP
 *  (g1-surface-adapters.mjs:627-629) — the third key set of one family. */
const B_INSPECT_QUERY = Object.freeze({
  topology: Object.freeze({ topologyRevision: 9, topologyDigest: 'sha256;topo' }),
  queryClaim: Object.freeze({ platform: 'host', provider: 'dsh_compute', method: 'compute_health' }),
  trusted: TRUSTED,
})

const B_INSPECT_QUERY_CLIENT = Object.freeze({
  ...B_INSPECT_QUERY,
  queryClaim: Object.freeze({ platform: 'client', provider: 'dsh_compute', method: 'compute_health' }),
  clientRoundtrip: 'the query rides the Client page response (pending-until-response); host-side cancellation of the tool call is NOT a transport cancel',
})

/** g1-surface-adapters.mjs:426 + :715-724 — every B-CONTROL record, e.g. 85
 *  team_list_pending_control: the trusted envelope is the WHOLE target. */
const B_CONTROL_TRUSTED_ONLY = Object.freeze({ trusted: TRUSTED })

describe('A5M2-FAMILY-RULES C1: the B-MCP / B-INSPECT / B-CONTROL target rules stay absent as NAMED gaps; real-shape claims keep landing on the pinned unregistered-structure gate', () => {
  it('B-MCP: no rule is registered, and every measured variant (stdio / read / http+cursor+domain) denies at the table gate with the wire-pinned string', () => {
    expect(PA_FAMILY_TARGET_RULES['B-MCP']).toBeUndefined()
    const deny = `familyId: no target structure is registered for 'B-MCP'`
    // The g2 wire lane pins this exact deny at its landing point
    // (bc6cf5ed6 test/a5m2-g2-wire-c1.test.ts:771-772).
    expect(validatePaFamilyTarget('B-MCP', B_MCP_STDIO_LIST)).toBe(deny)
    expect(validatePaFamilyTarget('B-MCP', B_MCP_READ)).toBe(deny)
    expect(validatePaFamilyTarget('B-MCP', B_MCP_HTTP_DOMAIN)).toBe(deny)
    // The named gap, at the table itself: a minted B-MCP claim today has NO
    // durable target structure — rule and mint side must land paired.
    expect(Object.keys(PA_FAMILY_TARGET_RULES)).toEqual(['B-SESSION', 'B-IMAGE', 'B-WRITE'])
  })

  it('B-INSPECT: no rule is registered, and BOTH record shapes (list / host query / client query) deny at the table gate — the records do not even share a key set', () => {
    expect(PA_FAMILY_TARGET_RULES['B-INSPECT']).toBeUndefined()
    const deny = `familyId: no target structure is registered for 'B-INSPECT'`
    expect(validatePaFamilyTarget('B-INSPECT', B_INSPECT_LIST)).toBe(deny)
    expect(validatePaFamilyTarget('B-INSPECT', B_INSPECT_QUERY)).toBe(deny)
    expect(validatePaFamilyTarget('B-INSPECT', B_INSPECT_QUERY_CLIENT)).toBe(deny)
  })

  it('B-CONTROL: no rule is registered, and the measured single-key trusted claim denies at the table gate', () => {
    expect(PA_FAMILY_TARGET_RULES['B-CONTROL']).toBeUndefined()
    expect(validatePaFamilyTarget('B-CONTROL', B_CONTROL_TRUSTED_ONLY))
      .toBe(`familyId: no target structure is registered for 'B-CONTROL'`)
  })

  it('the refusal is the VOCABULARY, measured through the existing rules: no kind of the closed union accepts the plain nested objects the lanes carry', () => {
    // `trusted` / `surface` style objects: 'countsTriple' is ONLY the exact
    // {pending,inProgress,completed} triple (types.ts:1247-1253) — a topology
    // pair or a query triple does not ride it.
    expect(validatePaFamilyTarget('B-SESSION', {
      ...B_SESSION_REAL,
      counts: B_INSPECT_LIST.topology,
    })).toBe('counts: not a countsTriple')
    expect(validatePaFamilyTarget('B-SESSION', {
      ...B_SESSION_REAL,
      counts: B_INSPECT_QUERY.queryClaim,
    })).toBe('counts: not a countsTriple')
    // 'obligations' is ONLY a non-empty ARRAY of objects (:1254-1257) — the
    // trusted object itself has no kind.
    expect(validatePaFamilyTarget('B-IMAGE', {
      ...B_IMAGE_REAL,
      businessObligations: TRUSTED,
    })).toBe('businessObligations: not a obligations')
    expect(validatePaFamilyTarget('B-IMAGE', {
      ...B_IMAGE_REAL,
      businessObligations: [],
    })).toBe('businessObligations: not a obligations')
    // The closed-key law itself (:1276-1278): an unregistered extra key denies.
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

// ── the three REGISTERED lanes' real shapes (mirrors of the committed plans) ──

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
