/**
 * governed-families/g6-session-query-wiring.mjs — A5M2-G6-WIRE (root ruling
 * 17:45): the RUNNABLE THIN BRIDGE that wires the released, narrow-PASSed G6
 * session-query adapter (g6-session-query.mjs rev.4, 52/52, owner-released at
 * 8e6e7788 — imported VERBATIM, never edited here) into the production
 * mount + PA consumption faces:
 *
 *  - the adapter's REAL factory `createG6SessionQueryAdapter` builds the five
 *    governed rows (identity, typed port facets, readCaller, Team ceiling,
 *    declared-mount evidence — every adapter HARD-VISIT law stands as the
 *    adapter itself spells it; this file restates NONE of it);
 *  - the mount-moment REGISTRATION is composed exactly the way the real
 *    agent-bindings.mjs mount site (:3533-3594) already composes it for
 *    todo/write/image: `placementFeed(name)` -> RUNTIME `definitionIdentity`
 *    -> `registerA5GovernedFamily(definitionIdentity, {familyId,
 *    adapterRevision, providerIdentity})`. THIS module builds the entries and
 *    THROWS on a silent feed (PLACEMENT_KEY_ABSENT) and on a moved feed
 *    (PLACEMENT_KEY_MOVED) — no guessed key, no silent skip; the shared
 *    writer calls `registerA5GovernedFamily` with each entry (the adapter
 *    law: registration is never invoked by the family module itself);
 *  - the REAL PA consumption walk is the adapter's own typed plan products
 *    driven through the plane's published split-path seam
 *    `pa.open(walk) -> pa.edge({...walk, grant, ...}) -> body -> pa.closePlan`
 *    (team-tool-plane.mjs:1679/:1713/:1714 — `paAdmit.open`, its idempotent
 *    `closePlan` redemption handle, and `paAdmit.edge`, which closes the plan
 *    fact in its own finally). The walk carries the family block at FULL
 *    VALUE (载荷法): familyId / adapterRevision / providerIdentity /
 *    targetManifest ride from the row's OWN reviewPayload, and the execution
 *    body demands the edge's one-shot `consumedProof` witness before ANY port
 *    entry (the todo-row law at team-tool-plane.mjs:2186-2196) — a missing
 *    witness refuses with zero port entry, never a self-attested consume.
 *  - the placed definition is the CAPTURED definition, COMPLETE (root 8b4
 *    law): every presentation face of the native read through the assembly's
 *    `readNative` seam rides verbatim and by reference; ONLY `execute` is
 *    replaced (classify -> open -> edge -> row.invoke). The emission gate
 *    mirrors only the REAL registration minimum-entry shape law (mandatory
 *    `output` face with function render), so a half-capture is never emitted
 *    for the real host entry to reject; a row whose native face does not
 *    satisfy it stays an honest DECLARED-INACTIVE census entry — no fabricated
 *    definition shape, ever.
 *
 * WHAT THIS BRIDGE IS NOT:
 *  - it is NOT the Team ceiling: `teamCeiling` is a REQUIRED INJECTED port
 *    (the Team-plane owner's decision seam); the factory REFUSES to assemble
 *    without it (no-scope / absent-ceiling fails closed at the seam, never a
 *    permissive stand-in), and every runtime deny rides the adapter's own
 *    TEAM_CEILING_DENY refusal bytes;
 *  - it is NOT a PA backend: `pa` is the seat the plane's paAdmit walk
 *    occupies in production; this module only speaks its published shape;
 *  - it adds NO gate inside the row: the rev-4 output-set membership law
 *    (final-serve whole-set recheck), the caller/receiver/ceiling revocation
 *    law, and the drain semantics are the ROW's own — the bridge runs
 *    `row.invoke` and serves or throws exactly what it answers.
 *
 * NAMED GAPS (carried VERBATIM, never worded closed):
 *  1. BACKEND DEPLOYMENT — the search facet rides the assembly's declared
 *     mount evidence (`declaredMount.searchBackend`); with no deployment
 *     evidence the two search rows stay the adapter's honest INACTIVE rows
 *     and this bridge emits NO definition and NO registration for them
 *     (native untouched); the evidence stays the deployment's to present.
 *  2. PA CONSUMPTION BRIDGE COMPLETION (rules gate, MEASURED this lane):
 *     the production PA bridge validates a registered family's walk
 *     (`pa-control-bridge.ts:428-470`): registered bindings MUST carry the
 *     four P-adds, the targetManifest must pass `isLosslessJsonValue`
 *     (:459), and `validatePaFamilyTarget(familyId, targetManifest)`
 *     (:467) must find the family's registered typed-plan structure. As
 *     measured: `PA_FAMILY_TARGET_RULES` (control/types.ts:1194) carries NO
 *     'B-SESSION-QUERY' entry, and the rev-4 targetManifest is not
 *     expressible with the CURRENT closed kinds — `callerWorkspaceCwd`
 *     admits null, `maxSearchResults` is an always-present member that is
 *     undefined on non-search rows (fails the lossless walk), and
 *     `disclosures` is a string array (no kind covers it); the closed
 *     key-set law refuses BOTH including and omitting each such key. New
 *     kinds are NOT this lane's to add — the exact rule-grammar delta is
 *     ROUTED TO CENTER (and the manifest-side shape is the adapter owner's,
 *     released code). Until it lands, a real production walk on these
 *     registrations fails CLOSED at the bridge with the bridge's own bytes
 *     (`family-target-invalid: familyId: no target structure is registered
 *     for 'B-SESSION-QUERY'`, or the lossless deny ahead of it) — the
 *     spec pins those refusal strings through the REAL published checkers.
 *
 * STATUS: wiring bridge; NOT C2 — no Host, no ports, no tests/homes, no
 * network. The adapter spec (a5m2-g6-session-query-c1.test.ts) owns the row
 * laws; THIS spec (a5m2-g6-session-query-wiring.test.ts) owns the assembly
 * facts: adapter reuse verbatim, walk composition and witness law,
 * feed-keyed registration through the PRODUCTION registry, injected-ceiling
 * fail-closure, rev-4 row-law survival through the bridge, and the two
 * named gaps pinned at their measured refusal bytes.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g6-session-query-wiring
 */
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import {
  A5_G6_ADAPTER_REVISION,
  A5_G6_DRAIN_SEMANTICS,
  A5_G6_FAMILY,
  A5_G6_TOOL_NAMES,
  createG6SessionQueryAdapter,
} from './g6-session-query.mjs'

export const A5_G6_QUERY_WIRING_REVISION = 1

/** Typed codes OWNED by this wiring layer (P_G6_WIRE_*). Adapter refusals
 *  keep the row's own A5_G6_* codes verbatim — never rewritten here. */
export const A5_G6_QUERY_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_G6_WIRE_INPUT_INVALID',
  CALL_ID_ABSENT: 'P_G6_WIRE_CALL_ID_ABSENT',
  EFFECTS_UNPARSABLE: 'P_G6_WIRE_EFFECTS_UNPARSABLE',
  ADMISSION_CANCELLED: 'P_G6_WIRE_ADMISSION_CANCELLED',
  APPROVAL_NOT_LANDED: 'P_G6_WIRE_APPROVAL_NOT_LANDED',
  EDGE_CANCELLED: 'P_G6_WIRE_EDGE_CANCELLED',
  CONSUME_PROOF_MISSING: 'P_G6_WIRE_CONSUME_PROOF_MISSING',
  PLACEMENT_KEY_ABSENT: 'P_G6_WIRE_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'P_G6_WIRE_PLACEMENT_KEY_MOVED',
})

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/** Carry a typed refusal (row's own or this layer's) as a throw, keeping the
 *  code and detail VERBATIM on the error object (the plane's refusal-carry
 *  idiom — `refused-* CODE — detail`). */
const refusalToThrow = (refusal) => {
  const error = new Error(`${String(refusal?.code ?? 'REFUSED')} — ${String(refusal?.detail ?? 'refused without detail')}`)
  error.code = String(refusal?.code ?? 'REFUSED')
  return error
}

const wiringRefuse = (code, detail) => deepFreeze({ ok: false, code, detail })

/** The REAL registration minimum-entry gate (mirrored SHAPE check only —
 *  schema SEMANTICS stay owned by the host's own validator): a definition
 *  is emittable only if its captured native face carries the mandatory
 *  `output` face with a function render (and function presentationMeta
 *  when present) and a positive finite timeoutMs when present. */
const registrationFaceComplete = (native) => {
  const output = isRecord(native) ? native.output : undefined
  return isRecord(native)
    && typeof native.name === 'string' && native.name.length > 0
    && typeof native.description === 'string'
    && isRecord(native.parameters)
    && typeof native.execute === 'function'
    && isRecord(output) && output.schema !== undefined
    && typeof output.render === 'function'
    && (output.presentationMeta === undefined || typeof output.presentationMeta === 'function')
    && (native.timeoutMs === undefined || (Number.isFinite(native.timeoutMs) && native.timeoutMs > 0))
}

/**
 * Assemble the G6 session-query wiring over the REAL adapter factory.
 *
 * @param input {{
 *   realmId: string, providerId: string,
 *   readNative: (name: string) => object | undefined | null,   // production: name => ctx.tools.get(name, scope)
 *   queryPorts: object,          // the five typed facets — the adapter's own law decides requiredness
 *   readCaller: () => object | undefined,
 *   teamCeiling: (targetSessionId: string, caller: object) => boolean,  // INJECTED Team-plane decision port
 *   declaredMount: { searchBackend: { present: true } | { present: false, evidence: string } },
 *   maxSearchResults?: number,
 *   definitionIdentityOf?: (definition: object) => string,     // capture-side mint seam (pb §6)
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *   pa: { open: (walk: object) => Promise<object>, edge: (state: object) => Promise<object>, closePlan: (callId: string) => void },
 *   observe?: (event: object) => void,
 * }}
 * @returns wiring assembly `{ ok: true, ... }` or a frozen `{ ok: false, code, detail }` refusal.
 */
export function buildG6SessionQueryWiring (input = {}) {
  if (!isRecord(input)) return wiringRefuse(A5_G6_QUERY_WIRING_CODES.INPUT_INVALID, 'wiring input must be one object')
  const knownInput = new Set(['realmId', 'providerId', 'readNative', 'queryPorts', 'readCaller', 'teamCeiling', 'declaredMount', 'maxSearchResults', 'definitionIdentityOf', 'placementFeed', 'pa', 'observe'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return wiringRefuse(A5_G6_QUERY_WIRING_CODES.INPUT_INVALID, `unknown wiring input '${key}' — the bridge takes exactly {realmId, providerId, readNative, queryPorts, readCaller, teamCeiling, declaredMount, maxSearchResults, definitionIdentityOf, placementFeed, pa, observe}`)
    }
  }
  const { realmId, providerId, readNative, queryPorts, readCaller, teamCeiling, declaredMount, placementFeed, pa, observe = () => {} } = input
  if (typeof realmId !== 'string' || realmId.length === 0) return wiringRefuse(A5_G6_QUERY_WIRING_CODES.INPUT_INVALID, 'realmId is required (non-empty string)')
  if (typeof providerId !== 'string' || providerId.length === 0) return wiringRefuse(A5_G6_QUERY_WIRING_CODES.INPUT_INVALID, 'providerId is required (non-empty string)')
  if (typeof readNative !== 'function') return wiringRefuse(A5_G6_QUERY_WIRING_CODES.INPUT_INVALID, 'readNative (name) => definition | undefined is REQUIRED — the same bind-time capture seam the adapter itself reads')
  if (typeof readCaller !== 'function') return wiringRefuse(A5_G6_QUERY_WIRING_CODES.INPUT_INVALID, 'readCaller is REQUIRED — the row never invents a caller (workspace-access.callerOf mirror)')
  if (typeof teamCeiling !== 'function') {
    // no-scope / absent-ceiling FAILS CLOSED: the decision port is the
    // Team-plane owner's injection; there is no permissive stand-in here.
    return wiringRefuse(A5_G6_QUERY_WIRING_CODES.INPUT_INVALID, 'teamCeiling (targetSessionId, caller) => boolean is REQUIRED and INJECTED — the Team-plane decision port; wiring without a ceiling authority refuses to assemble (fail closed, never a permissive stand-in)')
  }
  if (!isRecord(declaredMount) || !isRecord(declaredMount.searchBackend)) {
    return wiringRefuse(A5_G6_QUERY_WIRING_CODES.INPUT_INVALID, 'declaredMount.searchBackend {present:true} | {present:false, evidence} is REQUIRED — the search rows ride the assembly\'s real deployment evidence either way')
  }
  if (typeof placementFeed !== 'function') {
    return wiringRefuse(A5_G6_QUERY_WIRING_CODES.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the family key is the runtime identity the seam minted for the PLACED definition (pb §6; the agent-bindings registration law), never a hand-spelled string')
  }
  if (!isRecord(pa) || typeof pa.open !== 'function' || typeof pa.edge !== 'function' || typeof pa.closePlan !== 'function') {
    return wiringRefuse(A5_G6_QUERY_WIRING_CODES.INPUT_INVALID, 'pa {open, edge, closePlan} is REQUIRED — the plane\'s published split-path seat (paAdmit.open / paAdmit.edge / paAdmit.closePlan, team-tool-plane.mjs:1679/:1713/:1714); with no admission seat no governed call may enter the ports')
  }

  // The adapter factory's OWN hard-visit law (identity, required facets,
  // ceiling, evidence) throws placement defects directly — carried here
  // verbatim; this bridge adds no gate of its own to that surface.
  const adapter = createG6SessionQueryAdapter({
    realmId,
    providerId,
    readNative,
    queryPorts,
    readCaller,
    teamCeiling,
    declaredMount,
    ...(input.maxSearchResults === undefined ? {} : { maxSearchResults: input.maxSearchResults }),
    ...(input.definitionIdentityOf === undefined ? {} : { definitionIdentityOf: input.definitionIdentityOf }),
    observe: (event) => { observe({ source: 'g6-adapter', ...event }) },
  })

  const rows = new Map()
  const declared = []
  const definitions = []
  for (const toolName of A5_G6_TOOL_NAMES) {
    const row = adapter.rows[toolName]
    const native = readNative(toolName)
    if (row.active !== true) {
      // Honest DECLARED/INACTIVE census (the adapter's own row, evidence
      // bytes verbatim): NO definition, NO registration — a def masking the
      // native name with nothing behind it is the plane's own refused class.
      rows.set(toolName, Object.freeze({ status: 'DECLARED-INACTIVE', reason: 'declared-mount-absent', row }))
      declared.push(Object.freeze({ name: toolName, familyId: A5_G6_FAMILY, status: 'DECLARED-INACTIVE', reason: 'declared-mount-absent' }))
      observe({ event: 'g6-wire:declared', name: toolName, reason: 'declared-mount-absent' })
      continue
    }
    if (row.captured() !== true || !registrationFaceComplete(native)) {
      rows.set(toolName, Object.freeze({ status: 'DECLARED-INACTIVE', reason: row.captured() !== true ? 'capture-absent' : 'registration-face-incomplete', row }))
      declared.push(Object.freeze({ name: toolName, familyId: A5_G6_FAMILY, status: 'DECLARED-INACTIVE', reason: row.captured() !== true ? 'capture-absent' : 'registration-face-incomplete' }))
      observe({ event: 'g6-wire:declared', name: toolName, reason: row.captured() !== true ? 'capture-absent' : 'registration-face-incomplete' })
      continue
    }

    const execute = async (args, exec) => {
      // ① the row's OWN classify — typed plan products, rev-4 semantics
      // verbatim (effects grammar, caller capture, target manifest,
      // parametersFingerprint, reviewPayload at FULL VALUE).
      const classified = row.classify(args)
      if (classified.ok !== true) {
        observe({ event: 'g6-wire:classify-REFUSED', name: toolName, code: classified.code })
        throw refusalToThrow(classified)
      }
      const callId = isRecord(exec) && typeof exec.callId === 'string' && exec.callId.length > 0 ? exec.callId : null
      if (callId === null) {
        throw refusalToThrow(wiringRefuse(A5_G6_QUERY_WIRING_CODES.CALL_ID_ABSENT, `${toolName}: the execution token answered no call identity — the PA walk has no single-flight key; a guessed correlation is forbidden`))
      }
      const parsedEffects = parseRequestedEffectSet(classified.effects)
      if (parsedEffects.ok !== true) {
        throw refusalToThrow(wiringRefuse(A5_G6_QUERY_WIRING_CODES.EFFECTS_UNPARSABLE, `${toolName}: the row's effect set is not the frozen closed vocabulary (${String(parsedEffects.problems?.[0]?.detail ?? 'parse refused')})`))
      }
      const signal = isRecord(exec) ? exec.signal : undefined
      const payload = classified.reviewPayload
      const walk = Object.freeze({
        realmId,
        callId,
        parametersFingerprint: classified.parametersFingerprint,
        requestedEffects: parsedEffects.value,
        toolName,
        // 载荷法: the four P-adds at FULL VALUE, from the row's own payload.
        family: Object.freeze({
          familyId: payload.familyId,
          adapterRevision: payload.adapterRevision,
          providerIdentity: payload.providerIdentity,
          targetManifest: payload.targetManifest,
        }),
        ...(signal === undefined ? {} : { signal }),
      })
      try {
        const opened = await pa.open(walk)
        if (opened?.cancelled === true) {
          throw refusalToThrow(wiringRefuse(A5_G6_QUERY_WIRING_CODES.ADMISSION_CANCELLED, `${toolName}: cancelled at the PA open edge before admission — zero port entry`))
        }
        if (opened?.kind === 'deny') throw refusalToThrow(opened)
        if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
          throw refusalToThrow(wiringRefuse(A5_G6_QUERY_WIRING_CODES.APPROVAL_NOT_LANDED, `${toolName}: the admission answered ${String(opened?.kind ?? 'unsettled')} without a landed grant — internal state never substitutes for the kernel answer`))
        }
        const edge = await pa.edge(Object.freeze({
          ...walk,
          grant: opened.grant,
          ...(opened.paDurableMint === undefined ? {} : { paDurableMint: opened.paDurableMint }),
          ...(opened.request === undefined ? {} : { request: opened.request }),
          ...(opened.placementName === undefined ? {} : { placementName: opened.placementName }),
          ...(opened.paConstructionBinding === undefined ? {} : { paConstructionBinding: opened.paConstructionBinding }),
        }))
        if (edge?.cancelled === true) {
          throw refusalToThrow(wiringRefuse(A5_G6_QUERY_WIRING_CODES.EDGE_CANCELLED, `${toolName}: cancelled at the execution edge — the approval stays unspent and is never replayed; zero port entry`))
        }
        if (edge?.kind === 'deny') throw refusalToThrow(edge)
        const proof = edge?.consumedProof
        if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
          // The body NEVER self-attests consumption: no witness, no port entry.
          throw refusalToThrow(wiringRefuse(A5_G6_QUERY_WIRING_CODES.CONSUME_PROOF_MISSING, `${toolName}: the execution edge answered allow without its one-shot consume witness — the row never substitutes a self-attested consumption; the body did not run and zero port entries were made`))
        }
        // ② the row's OWN governed body: receiver/method pins, caller
        // re-verify, Team ceiling, the rev-4 final-serve whole-set membership
        // recheck — all the row's law, through this bridge unchanged.
        const ran = await row.invoke(args, { ...(signal === undefined ? {} : { signal }) })
        if (ran?.ok !== true) {
          observe({ event: 'g6-wire:invoke-REFUSED', name: toolName, code: ran?.code })
          throw refusalToThrow(ran)
        }
        observe({ event: 'g6-wire:served', name: toolName, callId })
        return ran.value
      } finally {
        // The redemption leg's own close handle (idempotent with the edge's
        // own plan-fact close — team-tool-plane.mjs:1711-1726): every path
        // that never reached the edge still ends this call's plan fact here.
        pa.closePlan(callId)
      }
    }
    // root 8b4: the captured native definition travels COMPLETE — every
    // presentation face verbatim and by reference; ONLY execute is replaced.
    const definition = Object.freeze({ ...native, execute })
    rows.set(toolName, Object.freeze({ status: 'ACTIVE', row, definition, captureDefinitionIdentity: row.definitionIdentity }))
    definitions.push(definition)
    observe({ event: 'g6-wire:mounted', name: toolName })
  }

  // THE MOUNT-MOMENT REGISTRATION (agent-bindings law, post publish): the key
  // is the placement feed's RUNTIME identity of the PLACED definition, read
  // fresh, never cached from construction, never hand-spelled. The shared
  // writer hands each entry to registerA5GovernedFamily — this module
  // registers nothing itself.
  const mountedKeys = new Map()
  const familyRegistrations = () => Object.freeze(definitions.map((definition) => {
    const fed = placementFeed(definition.name)
    const key = isRecord(fed) && typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0
      ? fed.definitionIdentity
      : null
    if (key === null) {
      throw new Error(`${A5_G6_QUERY_WIRING_CODES.PLACEMENT_KEY_ABSENT}: the placed row '${definition.name}' answered no definition identity through the placement feed — the family registration has no trusted key; a guessed key is forbidden and an unobserved silent skip is the drift the family gate measures (the agent-bindings refusal law, carried to the G6 wiring)`)
    }
    const seen = mountedKeys.get(definition.name)
    if (seen !== undefined && seen !== key) {
      throw new Error(`${A5_G6_QUERY_WIRING_CODES.PLACEMENT_KEY_MOVED}: the placement identity of '${definition.name}' moved between mount reads (${seen} -> ${key}) — a placed definition's identity does not float; the mount is broken and re-registers nothing`)
    }
    mountedKeys.set(definition.name, key)
    const rowEntry = rows.get(definition.name)
    return Object.freeze({
      name: definition.name,
      definitionIdentity: key,
      entry: Object.freeze({
        // the adapter row's OWN bytes — never re-typed here
        familyId: rowEntry.row.familyId,
        adapterRevision: rowEntry.row.adapterRevision,
        providerIdentity: providerId,
      }),
    })
  }))

  const assembly = Object.freeze({
    ok: true,
    familyId: A5_G6_FAMILY,
    revision: A5_G6_QUERY_WIRING_REVISION,
    adapterRevision: A5_G6_ADAPTER_REVISION,
    providerId,
    /** The ACTIVE rows' placement-moment names (definition order). */
    placementNames: Object.freeze(definitions.map((definition) => definition.name)),
    /** ToolDefinition faces for the ACTIVE rows — the COMPLETE captured
     *  natives with ONLY execute replaced (classify -> open -> edge ->
     *  row.invoke). The plane places these verbatim. */
    definitions: Object.freeze(definitions),
    /** Per-tool wiring report: ACTIVE (mounted) or DECLARED-INACTIVE
     *  (no def, no registration — honest census, native untouched). */
    rows: Object.freeze(Object.fromEntries([...rows.entries()])),
    declared: Object.freeze(declared),
    rowOf: (name) => rows.get(name)?.row,
    /** L9 new-call prohibition ONLY — the adapter's own drain law per row;
     *  settles nothing, rolls nothing back. */
    drain: () => {
      for (const entry of rows.values()) entry.row.drain()
      return deepFreeze({ event: 'g6-wire:drain', semantics: A5_G6_DRAIN_SEMANTICS })
    },
    /** THE family registration face — call at the mount moment (AFTER
     *  publish); the PAIRED registration writer feeds each entry to
     *  registerA5GovernedFamily. Throws PLACEMENT_KEY_ABSENT /
     *  PLACEMENT_KEY_MOVED instead of guessing or skipping. */
    familyRegistrations,
  })
  return assembly
}
