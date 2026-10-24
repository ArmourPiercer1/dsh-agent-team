/**
 * search.mjs — the A5M2 B-SEARCH governed arm (familyId 'B-SEARCH',
 * adapterRevision 1): the minting adapter behind the governed plane's
 * DURABLE-claim rows for the two team names team_grep / team_glob
 * (M0-B records 7/8, scope=alias, mountCondition=always,
 * onMountObligation=FULL_GOVERNANCE).
 *
 * WHAT THIS IS: the classify/mint half of one governed vertical slice.
 * The row placement, the ONE PA admission walk (open → edge → one-shot
 * consumedProof) and the token ledger live in the PLANE
 * (team-tool-plane.mjs, the `searchEnabled` + `backends.searchGoverned`
 * mount — the todo/write/image/g1 carrier law, cloned for this family and
 * disclosed as a clone, never smuggled into another row's bytes). This
 * module owns: the CLOSED 639-face argument law, the team-family caller
 * law, the anchored search root, the targetManifest the signed table entry
 * (`control/types.ts` 'B-SEARCH') types leaf-for-leaf, and the delegate
 * that — AFTER the grant and the real execution edge — routes to the
 * SIGNED effect bodies (search-backend.mjs / glob-backend.mjs reached
 * through the a5p5 pipeline `runToolCall`). The handle answers, the arm
 * routes: this file re-implements NO search law, NO argv, NO renderer.
 *
 * THE FACE LAW IS MEASURED, NOT INVENTED (read-only at the pinned
 * baseline 639ed015397290b3745d163aafe02ffee4aa3f84):
 *  - grep  = tool-fs-search grep.ts:285-340: parameters
 *    {pattern required string, path? string, include? string}, output
 *    {matches:[{path,lineNumber,line}]};
 *  - glob  = tool-fs-search glob.ts:296-353: parameters
 *    {pattern required string, path? string}, output {root, paths}.
 * team_grep/team_glob exist NOWHERE on that host face — they are the
 * plane's own alias names (DEFAULT_PLANE_NAMES), which is exactly why the
 * M0 rows say scope=alias and why the durable claim needs its OWN family
 * entry rather than the native rows' lane-only admission.
 * The arm's classify accepts EXACTLY the measured face: closed keys
 * (grep {pattern,path,include}, glob {pattern,path} — a team_glob call
 * carrying `include` is refused, the published glob face has no such
 * parameter), pattern a non-empty string (the shared parse-util reqString
 * law the published execute path itself runs), path/include a string when
 * present. The three-state discipline (root 18:42(1)) is mint-side: the
 * manifest carries a missing optional as `null`; `''` and absent stay
 * distinct claims, and `''` as a locator answers the anchor law's own
 * refusal, never a silent root.
 *
 * THE CALLER LAW IS THE TEAM FAMILY'S, IMPORTED IN SHAPE (write.mjs
 * readIdentity law verbatim): a real `exec.agent.id` +
 * `exec.agent.session.header.id`, PAIRED against the bind-time facts of
 * THIS governed Agent closure. A missing identity is NO_OWNING_SESSION;
 * a foreign one is FOREIGN_SESSION. The pair is re-checked at the body
 * (the write row's fresh recheck): the front door opened NOTHING for a
 * different caller.
 *
 * THE ANCHOR LAW IS IMPORTED, NOT COPIED: `lexicalAnchor` is
 * plane-effect-backends.mjs's exported pure law (the same one image.mjs
 * imports). classify reads NO disk. The search root is the governed root
 * itself when `path` is absent; a present `path` anchors strictly beneath
 * it or the call is refused with the imported law's own words.
 *
 * THE EFFECT FACE is the M0 read-subtree delta CLOSED at the signed
 * effect-kind set: I:tool-invoke + F(read, absolute-path, the anchored
 * search root, ['read']). The walk's effect set and the manifest speak
 * ONE root; the delegate re-derives NOTHING new.
 *
 * THE BODY REUSES THE SIGNED PIPELINE: delegate maps the face values to
 * the lane's OWN parser (parseGrepArgs / parseGlobArgs — the published
 * execution-path parsers) with TWO disclosed transcriptions (include->
 * glob; the mode-less face output is content matches, so the lane-required
 * output_mode rides as 'content'). and calls the a5p5 `runToolCall` with
 * the configured backend and the mount's `decide` belt.
 * `pa` is DELIBERATELY ABSENT from that call: the durable PA walk for
 * this row is the PLANE FUNNEL's single open/edge pair (consumed there,
 * witness in hand BEFORE this delegate runs); a second edge on the same
 * call would be a double consumption the kernel rightly refuses. The
 * deps comment scopes pa-absence to the pre-M1 kit rows — this row is not
 * pre-M1, it is PRE-WALKED upstream; the DELTA is disclosed to CENTER in
 * the lane receipt, not hidden in a call shape.
 *
 * TIER HONESTY: this is the author-side vertical (table entry + arm +
 * plane mount + spec). Nothing here claims a live-Host wiring round, an
 * install, or C2; the durable claim's bridge acceptance rides the
 * mount's own PA seat at the first wiring round.
 */

import { createHash } from 'node:crypto'

import { lexicalAnchor } from '../plane-effect-backends.mjs'
import { parseGlobArgs, parseGrepArgs, runToolCall } from '../../../../../tools/a5p5-tools/src/index.js'

export const A5_B_SEARCH_FAMILY_ID = 'B-SEARCH'
export const A5_B_SEARCH_ADAPTER_REVISION = 1

/** The minted variant constants — the ONLY operations this family speaks.
 *  One name, one operation, one M0 record: team_grep -> record 7,
 *  team_glob -> record 8. */
export const A5_B_SEARCH_OPERATIONS = Object.freeze({
  team_grep: 'team-grep-content-search',
  team_glob: 'team-glob-path-match',
})

/** The closed census names (M0-B records 7/8). The plane enforces one
 *  name per placement; the arm refuses anything outside this set. */
export const A5_B_SEARCH_CENSUS_NAMES = Object.freeze(['team_grep', 'team_glob'])

/** The measured face law per name (closed top-level keys; 639 anchors in
 *  the header). */
const FACE_KEYS = Object.freeze({
  team_grep: Object.freeze(['pattern', 'path', 'include']),
  team_glob: Object.freeze(['pattern', 'path']),
})

const ANCHOR_LAW
  = 'lexical-anchor (imported from plane-effect-backends.lexicalAnchor): pure path law, zero disk at classify; '
    + 'the search root is the governed root itself when path is absent; a path outside the root is refused here'
const EFFECT_LAW
  = 'read-subtree delta (M0-B records 7/8) closed as I:tool-invoke + F(read absolute-path on the anchored search root); '
    + 'the body answers through the SIGNED confined backends, this arm routes and re-implements nothing'

const CODES = Object.freeze({
  DRAINING: 'P_BSEARCH_DRAINING',
  CLASSIFY_INVALID: 'P_BSEARCH_CLASSIFY_INVALID_ARGUMENTS',
  CLASSIFY_UNKNOWN_PARAMETER: 'P_BSEARCH_CLASSIFY_UNKNOWN_PARAMETER',
  NO_OWNING_SESSION: 'P_BSEARCH_NO_OWNING_SESSION',
  FOREIGN_SESSION: 'P_BSEARCH_FOREIGN_SESSION',
  LOCATOR_REJECTED: 'P_BSEARCH_LOCATOR_REJECTED',
  NOT_OWN_PLAN: 'P_BSEARCH_NOT_OWN_PLAN',
  LANE_DENY: 'P_BSEARCH_LANE_DENY',
  SCHEMA_REFUSED: 'P_BSEARCH_SCHEMA_REFUSED',
  SPILL_REFUSED: 'P_BSEARCH_SPILL_REFUSED',
  BACKEND_FAILED: 'P_BSEARCH_BACKEND_FAILED',
})

const canonicalJson = (value) => JSON.stringify(value, (_k, v) => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v
))

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner)
    Object.freeze(value)
  }
  return value
}

/** REAL Host-shape identity read (write.mjs law verbatim): exactly
 *  `exec.agent.id` and `exec.agent.session.header.id`. */
function readIdentity(exec) {
  const agentId = typeof exec?.agent?.id === 'string' && exec.agent.id.length > 0 ? exec.agent.id : null
  const headerId = typeof exec?.agent?.session?.header?.id === 'string' && exec.agent.session.header.id.length > 0
    ? exec.agent.session.header.id
    : null
  return { agentId, headerId }
}

/**
 * Build the B-SEARCH arm rows over the SIGNED backends.
 *
 * @param config {{
 *   realmId: string, memberAgentId: string, sessionHeaderId: string,
 *   providerId: string, rootDir: string,
 *   mounted: readonly string[],                     // subset of the census names
 *   backends: Record<string, { backendId: string, run: Function }>,  // one per mounted name
 *   face: Record<string, { description: string, parameters: object }>, // CAPTURED native bytes per mounted name
 *   decide: (effectSet: unknown) => { kind: 'allow' } | { kind: 'deny', code: string },
 *   spill?: { store: unknown } | null,
 *   observe?: (row: unknown) => void,
 * }}
 */
export function createBSearchArm(config) {
  const realmId = typeof config?.realmId === 'string' && config.realmId.length > 0 ? config.realmId : null
  const memberAgentId = typeof config?.memberAgentId === 'string' && config.memberAgentId.length > 0 ? config.memberAgentId : null
  const sessionHeaderId = typeof config?.sessionHeaderId === 'string' && config.sessionHeaderId.length > 0 ? config.sessionHeaderId : null
  const providerId = typeof config?.providerId === 'string' && config.providerId.length > 0 ? config.providerId : null
  const rootDir = typeof config?.rootDir === 'string' && (config.rootDir.startsWith('/') || /^[A-Za-z]:[\\/]/.test(config.rootDir))
    ? config.rootDir
    : null
  const decide = typeof config?.decide === 'function' ? config.decide : null
  const observe = typeof config?.observe === 'function' ? config.observe : () => {}
  const spill = config?.spill === null ? null : config?.spill ?? null
  const built = realmId === null || memberAgentId === null || sessionHeaderId === null || providerId === null
    || rootDir === null || decide === null
    ? 'the arm needs the closed mount facts {realmId, memberAgentId, sessionHeaderId, providerId, rootDir, decide} '
      + 'at construction (the team-family caller law and the anchored root are MOUNT facts, never classify-time guesses)'
    : undefined
  if (built !== undefined) throw new TypeError(`governed-families/search: ${built}`)
  const mounted = Array.isArray(config.mounted) ? [...new Set(config.mounted)] : []
  if (mounted.length === 0 || mounted.some((n) => !A5_B_SEARCH_CENSUS_NAMES.includes(n))) {
    throw new TypeError(`governed-families/search: mounted must be a non-empty subset of {${A5_B_SEARCH_CENSUS_NAMES.join(', ')}} — the census is closed (M0-B records 7/8), an invented name has no row to answer`)
  }
  for (const name of mounted) {
    const backend = config.backends?.[name]
    if (backend === null || typeof backend !== 'object' || typeof backend.run !== 'function' || typeof backend.backendId !== 'string') {
      throw new TypeError(`governed-families/search: backends.${name} is missing — the arm holds NO effect body of its own (the SIGNED confined backend for '${name}' is required; inventing one here would fork the fs line's reviewed bytes)`)
    }
    const face = config.face?.[name]
    if (face === null || typeof face !== 'object' || typeof face.description !== 'string' || face.description.length === 0
      || face.parameters === null || typeof face.parameters !== 'object') {
      throw new TypeError(`governed-families/search: face.${name} is missing the CAPTURED native description/parameters bytes (the row mounts the HOST face bytes — the todo/g1 captured-face law; the arm invents no model-facing wording)`)
    }
  }

  const plans = new WeakSet()
  let draining = false

  const refuse = (code, detail) => ({ ok: false, code, detail })

  function classifyFor(name, callId, raw, exec) {
    if (draining) return refuse(CODES.DRAINING, 'the arm is DRAINING: no call reaches any body (the plane settles the flight, nothing new opens)')
    if (typeof callId !== 'string' || callId.length === 0) {
      return refuse(CODES.CLASSIFY_INVALID, 'the invocation correlation (callId) is required — the plan, the walk and the durable row speak ONE identity')
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return refuse(CODES.CLASSIFY_INVALID, 'arguments must be an object')
    }
    const faceKeys = FACE_KEYS[name]
    const unknown = Object.keys(raw).filter((k) => !faceKeys.includes(k))
    if (unknown.length > 0) {
      // Measured-face law: the published 639 face is CLOSED (defineTool
      // parameters); an off-face key is a contract violation refused here,
      // not silently dropped (the glob face has no `include`, and a caller
      // that believes otherwise must hear it).
      return refuse(CODES.CLASSIFY_UNKNOWN_PARAMETER, `undeclared top-level parameter(s) for '${name}': ${unknown.join(', ')} — the published face is closed to {${faceKeys.join(', ')}}`)
    }
    if (typeof raw.pattern !== 'string' || raw.pattern.length === 0) {
      // reqString law (parse-util), the same one the published execute path
      // runs: required, string, non-empty.
      return refuse(CODES.CLASSIFY_INVALID, '"pattern" must be a non-empty string (the published face is required)')
    }
    for (const key of ['path', 'include']) {
      if (raw[key] !== undefined && typeof raw[key] !== 'string') {
        return refuse(CODES.CLASSIFY_INVALID, `"${key}" must be a string when present (the published face; absent stays absent — it mints as null, never as '')`)
      }
    }
    const { agentId, headerId } = readIdentity(exec)
    if (agentId === null || headerId === null) {
      return refuse(CODES.NO_OWNING_SESSION, 'no real exec.agent.id / exec.agent.session.header.id: the team-family caller law governs a named member, never an anonymous call')
    }
    if (agentId !== memberAgentId || headerId !== sessionHeaderId) {
      return refuse(CODES.FOREIGN_SESSION, `identity pairing failed against the bind-time facts (agent ${String(agentId)} / header ${String(headerId)} vs this mount's governed Agent)`)
    }
    const anchored = lexicalAnchor(rootDir, raw.path ?? '.')
    if (anchored.ok !== true) {
      return refuse(CODES.LOCATOR_REJECTED, `the search root refused by the imported anchor law: ${anchored.detail}`)
    }
    const effects = deepFreeze([
      { kind: 'tool-invoke', toolName: name, resource: null },
      { kind: 'read', resource: { realmId, kind: 'absolute-path', canonicalLocator: anchored.path, rights: Object.freeze(['read']) } },
    ])
    const targetManifest = deepFreeze({
      familyId: A5_B_SEARCH_FAMILY_ID,
      adapterRevision: A5_B_SEARCH_ADAPTER_REVISION,
      operation: A5_B_SEARCH_OPERATIONS[name],
      realmId,
      pattern: raw.pattern,
      path: raw.path ?? null,
      ...(name === 'team_grep' ? { include: raw.include ?? null } : {}),
      canonicalTarget: anchored.path,
      anchorLaw: ANCHOR_LAW,
      effectLaw: EFFECT_LAW,
      callerMemberAgentId: memberAgentId,
      callerSessionHeaderId: sessionHeaderId,
    })
    const reviewPayload = deepFreeze({
      familyId: A5_B_SEARCH_FAMILY_ID,
      adapterRevision: A5_B_SEARCH_ADAPTER_REVISION,
      providerIdentity: providerId,
      targetManifest,
    })
    // The FULL-VALUE digest the grant must answer with (image row SEAM #1
    // law): the raw parameters ride complete, so two spellings of one root
    // are two fingerprints and the redemption answers THIS question.
    const parametersFingerprint = `sha256:${sha256(canonicalJson({
      realmId,
      toolName: name,
      parameters: raw,
      effects,
      targetManifest,
    }))}`
    const plan = deepFreeze({
      familyId: A5_B_SEARCH_FAMILY_ID,
      adapterRevision: A5_B_SEARCH_ADAPTER_REVISION,
      toolName: name,
      callId,
      effects,
      reviewPayload,
      parametersFingerprint,
      raw: deepFreeze({ ...raw }),
      caller: Object.freeze({ agentId, headerId }),
    })
    plans.add(plan)
    observe({ event: 'classify', correlation: callId, detail: parametersFingerprint })
    return { ok: true, plan, effects, reviewPayload, parametersFingerprint, targetManifest }
  }

  async function delegateFor(name, plan, ctx) {
    if (plans.has(plan) !== true) return refuse(CODES.NOT_OWN_PLAN, `the plan was not minted by this arm '${name}' — the delegate answers its OWN classify only`)
    if (draining) return refuse(CODES.DRAINING, 'the arm is DRAINING before the body: the grant stays unspent by this refusal path (the edge settles it), zero backend')
    const exec = ctx?.exec
    const { agentId, headerId } = readIdentity(exec)
    // BODY FRESH RECHECK (the write row's law): the redemption must answer
    // the SAME question Part A asked. Drift is a refusal, never a re-open.
    if (agentId !== plan.caller.agentId || headerId !== plan.caller.headerId) {
      return refuse(CODES.FOREIGN_SESSION, 'the body execution is not the caller this plan classified for — refusal, zero backend')
    }
    // Face values -> the lane's OWN parser (the published execution-path
    // parse). TWO disclosed mappings, both pure transcriptions of the
    // 639 face's observable output: (1) `include` is the face name of the
    // lane's `glob` filter; (2) the face has NO output-mode dial — its
    // published output is content matches ({path,lineNumber,line}), so the
    // transcription carries the lane-required explicit `output_mode:'content'`
    // (the lane parser MEASURES it required; the host face's default lives
    // in the host parser, which this row does not enter). Nothing else is
    // translated.
    const laneRaw = name === 'team_grep'
      ? { pattern: plan.raw.pattern, output_mode: 'content', ...(plan.raw.path === undefined ? {} : { path: plan.raw.path }), ...(plan.raw.include === undefined ? {} : { glob: plan.raw.include }) }
      : { pattern: plan.raw.pattern, ...(plan.raw.path === undefined ? {} : { path: plan.raw.path }) }
    const parsed = name === 'team_grep' ? parseGrepArgs(laneRaw) : parseGlobArgs(laneRaw)
    if (parsed.ok !== true) {
      return refuse(CODES.SCHEMA_REFUSED, `the lane's own published parser refused the mapped call: ${String(parsed.problems?.[0]?.code ?? 'unknown')}`)
    }
    const signal = exec?.signal
    const result = await runToolCall({
      request: {
        realmId,
        callId: plan.callId,
        parsedArgs: parsed.value,
        parametersFingerprint: plan.parametersFingerprint,
        ...(signal === undefined ? {} : { signal }),
      },
      // The mount's lane belt (tool class + resource matcher, never
      // widening — the plane's decide law).
      decide,
      // `pa` is DELIBERATELY absent: the ONE durable walk is the plane
      // funnel's open/edge pair, already spent with the consumedProof in
      // hand before this delegate runs (see the header — disclosed).
      backend: config.backends[name],
      ...(spill === null ? {} : { spill }),
    })
    if (result.kind === 'presented') {
      observe({ event: 'settled', correlation: plan.callId, detail: result.settlement.kind })
      return { ok: true, settled: true, value: Object.freeze({ text: result.rendered.text }), settlement: result.settlement }
    }
    if (result.kind === 'refused-admission') {
      return refuse(CODES.LANE_DENY, `${String(result.denyCode ?? 'denied')} (lane belt effectFingerprint ${result.effectFingerprint})`)
    }
    if (result.kind === 'refused-schema') {
      return refuse(CODES.SCHEMA_REFUSED, String(result.problems?.[0]?.code ?? 'unknown'))
    }
    if (result.kind === 'refused-spill') {
      return refuse(CODES.SPILL_REFUSED, `${result.refusal.code}: ${result.refusal.detail}`)
    }
    return refuse(CODES.BACKEND_FAILED, `${String(result.failure?.code ?? 'unknown')}: ${String(result.failure?.detail ?? '').slice(0, 200)}`)
  }

  const rows = Object.freeze(mounted.map((name) => Object.freeze({
    name,
    familyId: A5_B_SEARCH_FAMILY_ID,
    adapterRevision: A5_B_SEARCH_ADAPTER_REVISION,
    operation: A5_B_SEARCH_OPERATIONS[name],
    description: config.face[name].description,
    parameters: deepFreeze({ ...config.face[name].parameters }),
    classify: (raw, callId, exec) => classifyFor(name, callId, raw, exec),
    delegate: (plan, ctx) => delegateFor(name, plan, ctx),
  })))

  return Object.freeze({
    familyId: A5_B_SEARCH_FAMILY_ID,
    adapterRevision: A5_B_SEARCH_ADAPTER_REVISION,
    providerId,
    rows,
    /** The census law the PLANE mount compares its placement against:
     *  recordIndex per name, from the M0-B index (read-only). */
    recordIndex: Object.freeze({ team_grep: 7, team_glob: 8 }),
    dispose: () => {
      draining = true
      observe({ event: 'dispose', detail: 'arm DRAINING: no classify, no delegate reaches a body' })
    },
  })
}
