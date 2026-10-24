/**
 * governed-families/g1-query-wiring.mjs — A5M2-G1-WIRE (card A5M2-G1-WIRE):
 * the REAL WIRING CANDIDATE for the PURE-QUERY subset of the mature,
 * already-audited G1 surface adapter module
 * (g1-surface-adapters.mjs rev.6, the 14 captured-native-delegate rows over
 * the frozen dispatch index M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json).
 *
 * THE CARD'S LAW: the adapter module is REUSED VERBATIM — this file imports
 * exactly ONE project module (`./g1-surface-adapters.mjs`) and mounts every
 * subset row THROUGH the module's own `mountG1SurfaceAdapter`. No adapter law
 * (classify grammar, trusted-fact re-verify, the CAPTURE_ABSENT /
 * TOPOLOGY_ABSENT refusals, the delegate plan/single-flight state machine) is
 * restated, widened, or routed around here; a refusal this candidate surfaces
 * is the adapter module's OWN refusal bytes.
 *
 * THE PURE-QUERY SUBSET (DERIVED from the frozen spec table, never
 * hand-listed): a record joins iff `capture === 'tool'` AND its spec declares
 * at least one obligation AND EVERY declared obligation carries `right:
 * 'read'`. Over the 14 records that is exactly the B-INSPECT pair (53
 * cordis_inspect_list / 54 cordis_inspect_query — enumerate / read-one-method
 * over the CURRENT authorized topology) and 85 team_list_pending_control
 * (read-pending on the team-control ledger). Every other record carries a
 * write obligation, an undeclared obligation face (the write is built at
 * classify time: present's expose, plugin_manager's per-action writes, the
 * dependency F-envelope), or a surface capture — non-query rows are NEVER
 * emitted, mounted, registered, or defined by this module.
 *
 * HONEST BOUNDARIES (card ruling — no immature-arm completion claims):
 *  - NO dependency or plugin resource arm exists here: the factory ACCEPTS
 *    `controlledInstall` / `installFace` / `hostEscalation` NEVER (a mount
 *    that presents one is refused P_G1_WIRE_ARM_NOT_ACCEPTED, so an immature
 *    arm can never ride this wiring by accident); the ports bag is
 *    whitelisted to the CURRENT-facts sources the MOUNTED row set can
 *    consult (`trustedTopology` always; `pluginFacts` only when every
 *    mounted row is B-PLUGIN, CENTER order 2026-10-25) — every other
 *    port (trustedCatalog,
 *    dependencyFacts, domainPortRegistry) is the same refusal.
 *  - A row whose facts are not observable stays an honest DECLARED/INACTIVE
 *    row exactly as the adapter module spells it: when the placement
 *    assembly supplies no captured native face for a subset record, the
 *    candidate mounts it with `native: undefined` — the module's OWN
 *    native-less mount (capturePresent false, description null, every entry
 *    refusing `P_G1_NATIVE_CAPTURE_ABSENT` typed, zero native entry). No
 *    definition is emitted for a declared row (a def masking the native name
 *    with nothing behind it is the plane's own refused class), and NO family
 *    registration exists for it. A mounted row whose CURRENT-facts source is
 *    not mounted (e.g. the inspect pair with no `trustedTopology`) keeps the
 *    module's own fail-closed call-time refusal (`P_G1_TRUSTED_TOPOLOGY_ABSENT`
 *    verbatim) — the candidate adds no gate of its own.
 *  - THE PLACED DEFINITION IS THE CAPTURED DEFINITION, COMPLETE (root 8b4
 *    law): every presentation face of the captured native definition rides
 *    into the placed definition verbatim and by reference — `output:
 *    {schema, render, presentationMeta?}`, compiled `parameters`,
 *    `presentCall`/`presentResult`, project/finalize hooks, `timeoutMs`,
 *    `isConcurrencySafe`, any future face — and ONLY `execute` is replaced.
 *    This file fabricates NO definition shape: the assembly gate mirrors only
 *    the REAL registration minimum-entry SHAPE law (core/tools register() @
 *    639 — mandatory `output` face, function render/presentationMeta, positive
 *    timeoutMs) so a half-capture can never be emitted for the real host
 *    entry to reject; schema SEMANTICS stay owned by the host's own validator,
 *    and the spec verifies the emitted definitions through the REAL
 *    registration entry (真实 register 最低入口核), including that the real
 *    entry REFUSES a hand-fabricated minimal shape.
 *  - THE FAMILY KEY IS NEVER HAND-SPELLED: registration entries are built at
 *    the mount moment (AFTER publish — the agent-bindings law) from the
 *    integrator's `placementFeed(name)` — the provider-side feed whose
 *    identity is `definitionIdentityOf` minted for the PLACED definition
 *    (pb §6). A subset def that answers no placement identity is a broken
 *    mount and THROWS (never a guessed key, never an unobserved silent skip);
 *    an identity that moved between mount reads throws too.
 *  - NO UNADMITTED PATH TO NATIVE: the factory REQUIRES an `admit` seam — the
 *    seat the plane's PA walk (paAdmit open/edge/consume, the shared writer's
 *    line) occupies. Every placed definition runs classify (the module's
 *    own), then awaits admit, and only a `{ok:true}` answer reaches
 *    `row.delegate`; any refusal throws with the refusing side's OWN typed
 *    bytes and zero native entry. The candidate performs no PA walk itself —
 *    that authority stays exactly where the plane froze it.
 *
 * STATUS: wiring CANDIDATE (the shared plane/glue writer integrates the mount
 * lines; see the module's own integration contract on `familyRegistrations`).
 * This module is NOT C2 and claims nothing beyond the wiring shape: the
 * adapter spec (a5m2-g1-surface-adapters.test.ts) owns the row laws; this
 * spec (a5m2-g1-query-wiring.test.ts) owns the assembly facts — subset
 * derivation, captured-complete definition travel (only execute replaced),
 * acceptance through the REAL registration entry, feed-keyed registration
 * with placed-vs-captured identity kept visibly separate, non-query silence,
 * declared/INACTIVE verbatimity, and the import closure.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g1-query-wiring
 */
import {
  A5_G1_ADAPTER_REVISION,
  A5_G1_CONTROL_ADAPTER_REVISION,
  A5_G1_PLUGIN_ADAPTER_REVISION,
  A5_G1_FAMILY_GROUP,
  A5_G1_RECORD_SPECS,
  mountG1SurfaceAdapter,
} from './g1-surface-adapters.mjs'

export const A5_G1_QUERY_WIRING_GROUP = A5_G1_FAMILY_GROUP
export const A5_G1_QUERY_WIRING_REVISION = 1

/** Typed codes OWNED by this wiring layer (P_G1_WIRE_*). Row refusals keep
 *  the adapter module's own P_G1_* codes verbatim — never rewritten here. */
export const A5_G1_QUERY_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_G1_WIRE_INPUT_INVALID',
  ARM_NOT_ACCEPTED: 'P_G1_WIRE_ARM_NOT_ACCEPTED',
  NON_SUBSET_CAPTURE: 'P_G1_WIRE_NON_SUBSET_CAPTURE',
  ADMISSION_ABSENT: 'P_G1_WIRE_ADMISSION_ABSENT',
  PLACEMENT_KEY_ABSENT: 'P_G1_WIRE_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'P_G1_WIRE_PLACEMENT_KEY_MOVED',
})

/** The ONLY ports source the pure-query subset can consult (B-INSPECT's
 *  CURRENT authorized topology). Every other key is another family's fact
 *  face or a resource arm — the adapter may only ever see this whitelist. */
const ALLOWED_PORTS = Object.freeze(['trustedTopology'])

/** Dependency/plugin resource-arm inputs the factory refuses on sight — the
 *  card forbids this wiring to carry them AT ALL (they stay the mount-time
 *  CONFIG seams the adapter module itself declares for their own records). */
const FORBIDDEN_ARMS = Object.freeze(['controlledInstall', 'installFace', 'hostEscalation'])

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * DERIVED pure-query subset of the frozen G1 spec table: `capture === 'tool'`
 * AND a non-empty declared `obligations` face AND every declared obligation
 * carries `right: 'read'`. The read of the frozen table is the ONLY truth
 * source; a hand-listed name set would drift the moment the table moves.
 * Returns `[{ name, recordIndex, familyId }]` ordered by recordIndex.
 */
export function g1PureQuerySubset() {
  return Object.freeze(Object.entries(A5_G1_RECORD_SPECS)
    .filter(([, spec]) => spec.capture === 'tool'
      && Array.isArray(spec.obligations)
      && spec.obligations.length > 0
      && spec.obligations.every((obligation) => obligation.right === 'read'))
    .map(([name, spec]) => Object.freeze({ name, recordIndex: spec.recordIndex, familyId: spec.family }))
    .sort((a, b) => a.recordIndex - b.recordIndex))
}

/** THE B-CONTROL SUPPLY SET (root LIMITED BUILD ORDER 2026-10-25: the four
 *  self-governance records proceed under the authorized Alpha5 tool scope -
 *  the root 17:55 development HOLD on 83/84/87/88 is WITHDRAWN by that
 *  ruling, which is a phase-construction release, NOT a safety downgrade or
 *  a self-granted permission). DERIVED from the frozen spec table, never
 *  hand-listed: capture 'tool' AND family 'B-CONTROL', EXCLUDING the
 *  record-85 hand-over row - 85 stays armed solely by its own closed-key
 *  hand-over through the pure-query loop (root 03:05 law intact, untouched).
 *  Supply remains OPT-IN at the mount (the deployer's g1PureQuery.control
 *  key): the ruling authorizes the wiring, it does NOT auto-enable the
 *  tools or widen member visibility. */
export function g1ControlSupplySubset() {
  return Object.freeze(Object.entries(A5_G1_RECORD_SPECS)
    .filter(([, spec]) => spec.capture === 'tool'
      && spec.family === 'B-CONTROL'
      && spec.recordIndex !== A5_G1_CONTROL85_HANDOVER.recordIndex)
    .map(([name, spec]) => Object.freeze({ name, recordIndex: spec.recordIndex, familyId: spec.family }))
    .sort((a, b) => a.recordIndex - b.recordIndex))
}

/**
 * DERIVED B-PLUGIN supply subset of the frozen table: `capture === 'tool'`
 * AND `family === 'B-PLUGIN'` (record 52 plugin_manager — the CENTER
 * whole-family order names it; the old zero-code-closed reading is
 * withdrawn). Like the CONTROL subset this is a pure read of the frozen
 * table, never a hand-list; the closed subset law validates whatever a
 * mount presents against it.
 */
export function g1PluginSupplySubset() {
  return Object.freeze(Object.entries(A5_G1_RECORD_SPECS)
    .filter(([, spec]) => spec.capture === 'tool' && spec.family === 'B-PLUGIN')
    .map(([name, spec]) => Object.freeze({ name, recordIndex: spec.recordIndex, familyId: spec.family }))
    .sort((a, b) => a.recordIndex - b.recordIndex))
}

const refuseAssembly = (code, message) => Object.freeze({ ok: false, code, message })

const refusalToThrow = (refusal) => {
  const error = new Error(`refused-g1 ${String(refusal?.code ?? 'P_G1_UNKNOWN_REFUSAL')} — ${String(refusal?.detail ?? 'the adapter refused without a detail')}`)
  error.code = refusal?.code
  error.g1Refusal = deepFreeze({ ...refusal })
  return error
}

/**
 * Assembly-time wiring factory for the pure-query G1 subset.
 *
 * @param input {{
 *   providerId?: string,                                  // registration providerIdentity
 *   captured?: Record<string, { native: object, definitionIdentity: string }>,
 *       // native = the COMPLETE captured ToolDefinition (every presentation
 *       // face verbatim); the placed def spreads it and replaces ONLY execute
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *   trusted: object,                                      // the adapter's trusted TARGETS CONFIG face
 *   bindingFacts: () => object,                           // the adapter's live binding-facts source
 *   ports?: { trustedTopology?: { current: () => unknown } }, // whitelist: trustedTopology ONLY
 *   admit: (ctx: { name: string, recordIndex: number, familyId: string, classified: object, exec: unknown }) => Promise<{ ok: boolean, code?: string, detail?: string }>,
 *   observe?: (row: unknown) => void,
 * }} input
 * @returns a frozen `{ ok: true, wiring }` candidate (definitions +
 *          familyRegistrations + rows/declared reporting) or a frozen
 *          `{ ok: false, code, message }` assembly refusal.
 */
/** THE CLOSED SUBSET LAW for an assembled supply: a caller may hand the
 *  assembly a row set OTHER than the pure-query default (the CONTROL supply
 *  per the root 2026-10-25 limited build order), but only when EVERY row
 *  answers the FROZEN dispatch table exactly — name, recordIndex and family
 *  all three. A hand-edited or guessed row set is refused at the door; the
 *  table stays the single source of the supply vocabulary. Returns undefined
 *  when the set is legal, else the violation. */
export function g1ValidateSupplySubset(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 'subset must be a non-empty array of frozen-table rows'
  const seen = new Set()
  for (const row of rows) {
    if (!isRecord(row) || typeof row.name !== 'string' || !Number.isInteger(row.recordIndex) || typeof row.familyId !== 'string') {
      return 'every subset row must be {name, recordIndex, familyId}'
    }
    if (seen.has(row.name)) return `duplicate subset row '${row.name}'`
    seen.add(row.name)
    const spec = A5_G1_RECORD_SPECS[row.name]
    if (spec === undefined) return `subset row '${row.name}' is not in the frozen dispatch table`
    if (spec.recordIndex !== row.recordIndex || spec.family !== row.familyId) {
      return `subset row '${row.name}' disagrees with the frozen table (record ${String(spec.recordIndex)}, ${String(spec.family)})`
    }
  }
  return undefined
}

export function createG1QueryWiring(input = {}) {
  if (!isRecord(input)) return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, 'the wiring factory takes one input record')
  // The arm gate runs FIRST and over the raw key set: a dependency or plugin
  // resource arm presented to this factory is a config defect, refused —
  // never silently dropped (a silent drop would let the same mount present it
  // again at the next seam and call the row wired).
  for (const arm of FORBIDDEN_ARMS) {
    if (input[arm] !== undefined) {
      return refuseAssembly(A5_G1_QUERY_WIRING_CODES.ARM_NOT_ACCEPTED, `'${arm}' is a dependency/plugin resource arm: the pure-query wiring candidate accepts NO such arm (card ruling — no immature-arm completion claims); the adapter module keeps that seam for its own record, this module never mounts it`)
    }
  }
  const knownInput = new Set(['providerId', 'subset', 'captured', 'placementFeed', 'trusted', 'bindingFacts', 'ports', 'admit', 'observe'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, `unknown wiring input '${key}' — the candidate takes exactly {providerId, subset?, captured, placementFeed, trusted, bindingFacts, ports, admit, observe}`)
    }
  }
  if (typeof input.placementFeed !== 'function') {
    return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the family key is the runtime identity the seam minted for the PLACED definition, read through the provider-side feed (pb §6; the agent-bindings registration law), never a hand-spelled string')
  }
  if (typeof input.admit !== 'function') {
    return refuseAssembly(A5_G1_QUERY_WIRING_CODES.ADMISSION_ABSENT, 'admit is REQUIRED — the candidate ships NO unadmitted path to the captured native (the plane\'s paAdmit walk occupies this seam at integration; a mount without it refuses assembly)')
  }
  if (typeof input.bindingFacts !== 'function') {
    return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, 'bindingFacts() must be mounted — the adapter answers the binding revision the PA edge consults (its own mount law, applied verbatim per row)')
  }
  if (!isRecord(input.trusted)) {
    return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, 'the trusted TARGETS face (memberAgentId, sessionHeaderId, realmId, owner, profileId) is CONFIG that must be provided at mount — the adapter validates its shape per row; this layer refuses its absence')
  }
  const providerId = typeof input.providerId === 'string' && input.providerId.length > 0 ? input.providerId : 'plugin'
  const observe = typeof input.observe === 'function' ? input.observe : () => {}

  const capturedIn = input.captured ?? {}
  if (!isRecord(capturedIn)) return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, 'captured must be a record (name -> {native, definitionIdentity}) or absent')
  // The row set this wiring emits/captures/registers: the mounted DERIVED
  // subset, defaulting to the pure-query line. The CLOSED subset law
  // (g1ValidateSupplySubset) ran at the assembly door AND runs here — every
  // row answers the frozen dispatch table name/recordIndex/family exactly,
  // so no hand-edited row set reaches emission (root 2026-10-25 authorized
  // exactly one other derived set: the B-CONTROL supply rows).
  let subset = g1PureQuerySubset()
  if (input.subset !== undefined) {
    const subsetViolation = g1ValidateSupplySubset(input.subset)
    if (subsetViolation !== undefined) {
      return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, `mounted subset is not a frozen-table row set: ${subsetViolation}`)
    }
    subset = Object.freeze([...input.subset].map((row) => Object.freeze({ name: row.name, recordIndex: row.recordIndex, familyId: row.familyId })))
  }
  // The ports whitelist is resolved AGAINST the mounted row set: a
  // pure-query world keeps the single-source whitelist BYTE-FOR-BYTE; a
  // subset whose every row is B-PLUGIN (CENTER whole-family order
  // 2026-10-25, record 52) additionally admits the pluginFacts CURRENT-
  // facts source the family's classify law requires. A mixed row set gets
  // neither extra port; the three resource ARMS (controlledInstall,
  // installFace, hostEscalation) stay refused in EVERY world — install
  // enters only through the adapter L5 edge once a deployer mounts those
  // seams, which today it refuses with zero manager entry.
  const subsetIsPluginOnly = subset.every((entry) => entry.familyId === 'B-PLUGIN')
  const allowedPorts = subsetIsPluginOnly ? [...ALLOWED_PORTS, 'pluginFacts'] : ALLOWED_PORTS
  const portsIn = input.ports ?? {}
  if (!isRecord(portsIn)) return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, 'ports must be a record (or absent)')
  for (const key of Object.keys(portsIn)) {
    if (!allowedPorts.includes(key)) {
      return refuseAssembly(A5_G1_QUERY_WIRING_CODES.ARM_NOT_ACCEPTED, `ports.${key} is not a CURRENT-facts source for the mounted G1 subset — the whitelist is {${allowedPorts.join(', ')}}; every other port is another family's face or a resource arm this candidate never carries`)
    }
  }
  const ports = Object.freeze({ ...portsIn })
  const subsetNames = new Set(subset.map((entry) => entry.name))
  // A capture presented for a NON-subset record is an attempt to wire a
  // non-query row through the pure-query candidate: a config defect, refused.
  for (const key of Object.keys(capturedIn)) {
    if (!subsetNames.has(key)) {
      return refuseAssembly(A5_G1_QUERY_WIRING_CODES.NON_SUBSET_CAPTURE, `'${key}' is not in the mounted G1 subset (mounted: ${subset.map((entry) => entry.name).join(', ')}); rows outside the mounted subset are not emitted, captured-wired, or registered by this module`)
    }
  }
  // A PRESENT-but-malformed capture is a config defect too — half a capture
  // is not "no capture": it names a face the mount cannot honestly bind.
  // The SHAPE law here is the REAL registration minimum entry (core/tools
  // register() @ 639): a captured face that could never pass the real host
  // registration entry — no `output: {schema, render}` face, a non-function
  // render/presentationMeta, a non-positive timeoutMs — is half a definition,
  // refused at assembly, never demoted to a declared row and never emitted
  // for the real entry to reject later. Schema SEMANTICS are not duplicated
  // here: the host's own validator owns them (the spec verifies the emitted
  // definitions through the real registration entry verbatim).
  for (const [key, capture] of Object.entries(capturedIn)) {
    const native = isRecord(capture) ? capture.native : undefined
    const output = isRecord(native) ? native.output : undefined
    if (!isRecord(capture)
      || !isRecord(native) || native.name !== key || typeof native.description !== 'string' || typeof native.execute !== 'function'
      || !isRecord(output) || output.schema === undefined || typeof output.render !== 'function'
      || (output.presentationMeta !== undefined && typeof output.presentationMeta !== 'function')
      || (native.timeoutMs !== undefined && (!Number.isFinite(native.timeoutMs) || native.timeoutMs <= 0))
      || typeof capture.definitionIdentity !== 'string' || capture.definitionIdentity.length === 0) {
      return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, `captured.${key} must be a COMPLETE captured definition — {native: {name:'${key}', description, output:{schema, render, presentationMeta?}, execute, ...every presentation face verbatim}, definitionIdentity: non-empty string} (the real registration minimum-entry shape law; the captured face mounts WITH its own definition identity per the adapter's mount law; a half-capture is refused, never demoted to a declared row)`)
    }
  }

  const mountPorts = ports // whitelisted bag — the adapter sees ONLY this

  const rows = new Map()
  const declared = []
  const definitions = []
  for (const entry of subset) {
    const capture = capturedIn[entry.name]
    if (capture === undefined) {
      // The honest DECLARED/INACTIVE row: the module's OWN native-less mount,
      // refusal bytes and all (card: "stays an honest declared/INACTIVE row
      // exactly as the module already spells it"). No def, no registration.
      const row = mountG1SurfaceAdapter(entry.name, {
        native: undefined,
        providerId,
        trusted: input.trusted,
        bindingFacts: input.bindingFacts,
        ports: mountPorts,
      })
      rows.set(entry.name, Object.freeze({ status: 'DECLARED-INACTIVE', reason: 'capture-absent', row }))
      declared.push(Object.freeze({ name: entry.name, recordIndex: entry.recordIndex, familyId: entry.familyId, status: 'DECLARED-INACTIVE', reason: 'capture-absent' }))
      observe({ event: 'g1-wire:declared', name: entry.name, recordIndex: entry.recordIndex })
      continue
    }
    const row = mountG1SurfaceAdapter(entry.name, {
      native: capture.native,
      providerId,
      definitionIdentity: capture.definitionIdentity,
      trusted: input.trusted,
      bindingFacts: input.bindingFacts,
      ports: mountPorts,
    })
    const name = entry.name
    const execute = async (args, exec) => {
      const classified = row.classify(args, isRecord(exec) ? exec.callId : undefined)
      if (classified.ok !== true) {
        observe({ event: 'g1-wire:classify-REFUSED', name, code: classified.code })
        throw refusalToThrow(classified)
      }
      const admitted = await input.admit(Object.freeze({ name, recordIndex: entry.recordIndex, familyId: entry.familyId, classified, exec }))
      if (admitted?.ok !== true) {
        observe({ event: 'g1-wire:admission-REFUSED', name, code: String(admitted?.code ?? 'ADMISSION_REFUSED') })
        throw refusalToThrow(admitted ?? { code: 'ADMISSION_REFUSED', detail: 'the admission seam refused this call' })
      }
      const settled = await row.delegate(classified.plan, { exec })
      if (settled?.ok !== true) {
        observe({ event: 'g1-wire:delegate-REFUSED', name, code: String(settled?.code ?? 'P_G1_DELEGATE_REFUSED') })
        throw refusalToThrow(settled)
      }
      observe({ event: 'g1-wire:delegated', name, settled: settled.settled })
      return settled.value
    }
    // THE CAPTURED DEFINITION TRAVELS COMPLETE (root 8b4 law): EVERY face of
    // the captured native definition rides into the placed definition VERBATIM
    // and by REFERENCE — `output: {schema, render, presentationMeta?}`, the
    // compiled `parameters`, `presentCall`/`presentResult`, project/finalize
    // hooks, `timeoutMs`, `isConcurrencySafe`, and any future face. ONLY
    // `execute` is replaced (the classify -> admit -> delegate body below).
    // The top level is a NEW frozen object (the spread); nested faces are NOT
    // re-frozen here — they belong to the capture and the host registry keeps
    // the same references (a spec leg verifies acceptance through the REAL
    // registration entry, 真实 register 最低入口核, never a shape fabricated
    // in this file).
    const definition = Object.freeze({ ...capture.native, execute })
    rows.set(name, Object.freeze({ status: 'ACTIVE', row, definition, captureDefinitionIdentity: capture.definitionIdentity }))
    definitions.push(definition)
    observe({ event: 'g1-wire:mounted', name, recordIndex: entry.recordIndex })
  }

  // THE MOUNT-MOMENT REGISTRATION (agent-bindings law, post publish): the key
  // is the placement feed's RUNTIME identity — `definitionIdentityOf` of the
  // definition the seam actually placed — read fresh, never cached from
  // construction, never hand-spelled. The entry shape is the registry's own
  // frozen trio {familyId, adapterRevision, providerIdentity}; the shared
  // writer hands each entry to `registerA5GovernedFamily(key, entry)`.
  const mountedKeys = new Map()
  const familyRegistrations = () => Object.freeze(definitions.map((definition) => {
    const fed = input.placementFeed(definition.name)
    const key = isRecord(fed) && typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0
      ? fed.definitionIdentity
      : null
    if (key === null) {
      throw new Error(`${A5_G1_QUERY_WIRING_CODES.PLACEMENT_KEY_ABSENT}: the placed row '${definition.name}' answered no definition identity through the placement feed — the family registration has no trusted key; a guessed key is forbidden and an unobserved silent skip is the unanswered-registration drift the family gate measures (the agent-bindings refusal law, carried to the G1 pure-query wiring)`)
    }
    const seen = mountedKeys.get(definition.name)
    if (seen !== undefined && seen !== key) {
      throw new Error(`${A5_G1_QUERY_WIRING_CODES.PLACEMENT_KEY_MOVED}: the placement identity of '${definition.name}' moved between mount reads (${seen} -> ${key}) — a placed definition's identity does not float; the mount is broken and re-registers nothing`)
    }
    mountedKeys.set(definition.name, key)
    const rowEntry = rows.get(definition.name)
    return Object.freeze({
      name: definition.name,
      recordIndex: rowEntry.row.recordIndex,
      definitionIdentity: key,
      entry: Object.freeze({
        familyId: rowEntry.row.familyId,
        // FAMILY revision (root 2026-10-25 full pairing): B-CONTROL's wire
        // format moved to 8; every other G1 family keeps 7. The registration
        // and the claim (the reviewPayload the adapter mints) answer the SAME
        // value - the format-identity pairing obligation; old approvals are
        // explicitly stale, never translated.
        adapterRevision: rowEntry.row.familyId === 'B-CONTROL' ? A5_G1_CONTROL_ADAPTER_REVISION : rowEntry.row.familyId === 'B-PLUGIN' ? A5_G1_PLUGIN_ADAPTER_REVISION : A5_G1_ADAPTER_REVISION,
        providerIdentity: providerId,
      }),
    })
  }))

  const wiring = deepFreeze({
    ok: true,
    group: A5_G1_QUERY_WIRING_GROUP,
    revision: A5_G1_QUERY_WIRING_REVISION,
    adapterRevision: A5_G1_ADAPTER_REVISION,
    providerId,
    subset,
    /** The ACTIVE rows' placement-moment names (the def list, subset order). */
    placementNames: definitions.map((definition) => definition.name),
    /** ToolDefinition faces for the ACTIVE subset rows — the COMPLETE captured
     *  native definitions (every presentation face verbatim, by reference)
     *  with ONLY execute replaced (the body runs classify -> admit (plane
     *  seat) -> delegate). The plane places these verbatim; the real host
     *  registration entry accepts them (spec-verified, 真实 register 最低入口核). */
    definitions,
    /** Per-record wiring report: ACTIVE (mounted capture) or
     *  DECLARED-INACTIVE (the module's own native-less row, verbatim). */
    rows: Object.freeze(Object.fromEntries([...rows.entries()].map(([key, value]) => [key, value]))),
    declared: Object.freeze(declared),
    /** The adapter row for one subset record (declared or active). */
    rowOf: (name) => rows.get(name)?.row,
    /** THE family registration face — call it at the mount moment (AFTER
     *  publish), hand each `{definitionIdentity, entry}` to the registry's
     *  `registerA5GovernedFamily`. Throws PLACEMENT_KEY_ABSENT /
     *  PLACEMENT_KEY_MOVED instead of guessing or skipping. */
    familyRegistrations,
  })
  return wiring
}

// ── ROOT 03:05 record-85 CLOSED-KEY HAND-OVER CLAIM (G1 family) ───────────
// The law this mirrors VERBATIM is the B-TEAM atomic hand-off
// (`claimTeamOpsFamily`, team-wiring.mjs:329-359, and its face law :176-186):
// claim only what is CAPTURED, face-COMPLETE and identity-MINTED, so the raw
// registration can LET the name and exactly ONE governed definition takes
// its place at the plane mount (one name, one placement). That site function
// is STRUCTURALLY closed to the ten B-TEAM keys (`A5_B_TEAM_TOOL_NAMES`,
// team-adapters.mjs:213-217 — measured NOT to contain 'team_list_pending_
// control'), so per the center ruling it is NEITHER force-fitted nor widened;
// the G1 family owns its OWN claim here, with EXACTLY ONE closed key and
// zero widening:
//   record 85 — `team_list_pending_control` (B-CONTROL, own-layer).
// The claim changes NO native permission: the descriptor, the caller/root
// binding (live resolveCaller single chain), the requestToken discipline and
// the PRE-READ Leader gate (tools.ts:1174, refusal TEAM_TOOL_PENDING_LIST_
// NOT_LEADER before any ledger read) all stay the NATIVE's own — the governed
// def spreads the captured native verbatim and replaces only `execute`
// (the 53/54 law), and a member caller is still refused exactly by that
// native gate, so a member gains ZERO new exposure: the name is visible
// where and only where the template already made the native legal.
export const A5_G1_CONTROL85_HANDOVER = Object.freeze({
  name: 'team_list_pending_control',
  recordIndex: 85,
})

const g1NonEmptyString = (value) => typeof value === 'string' && value.length > 0

// The B-TEAM face law (team-wiring.mjs:176-186) mirrored verbatim into the
// G1 family's own module — one qualification, one shape, no drift.
const g1RegistrationFaceComplete = (native) => {
  const output = isRecord(native) ? native.output : undefined
  return isRecord(native)
    && native.name !== undefined && typeof native.name === 'string' && native.name.length > 0
    && typeof native.description === 'string'
    && typeof native.execute === 'function'
    && isRecord(output) && output.schema !== undefined
    && typeof output.render === 'function'
    && (output.presentationMeta === undefined || typeof output.presentationMeta === 'function')
    && (native.timeoutMs === undefined || (Number.isFinite(native.timeoutMs) && native.timeoutMs > 0))
}

/**
 * Qualify the ONE record-85 hand-over against THIS agent's already-legal
 * team-tool selection (the selection IS the legal-visibility boundary: the
 * blueprint allowlist was applied upstream). Never claims a name that is not
 * captured here — an un-captured name keeps its raw registration byte-for-
 * byte (or stays absent for this agent), so the claim can never EXPOSE
 * anything.
 * @param input {{
 *   catalog: unknown,                      // THIS agent's selected team-tool defs
 *   allowedNames?: unknown,                // optional further closed restriction (null/absent = the catalog is the restriction)
 *   definitionIdentityOf?: unknown,        // the ONE real minter (definitionIdentityOf)
 * }} input
 * @returns a frozen `{ names, census }` in the claimTeamOpsFamily shape.
 */
export function claimG1Control85Handover (input = {}) {
  const { name, recordIndex } = A5_G1_CONTROL85_HANDOVER
  const catalog = isRecord(input) && Array.isArray(input.catalog) ? input.catalog : []
  const allowed = isRecord(input) && Array.isArray(input.allowedNames) ? new Set(input.allowedNames) : null
  const identityOf = isRecord(input) && typeof input.definitionIdentityOf === 'function' ? input.definitionIdentityOf : () => null
  if (allowed !== null && !allowed.has(name)) {
    return Object.freeze({ names: Object.freeze([]), census: Object.freeze([Object.freeze({ name, recordIndex, reason: 'not-allowed-for-this-member' })]) })
  }
  const native = catalog.find((def) => isRecord(def) && def.name === name)
  if (native === undefined) {
    return Object.freeze({ names: Object.freeze([]), census: Object.freeze([Object.freeze({ name, recordIndex, reason: 'capture-absent' })]) })
  }
  if (!g1RegistrationFaceComplete(native) || native.name !== name) {
    return Object.freeze({ names: Object.freeze([]), census: Object.freeze([Object.freeze({ name, recordIndex, reason: 'registration-face-incomplete' })]) })
  }
  if (!g1NonEmptyString(identityOf(native))) {
    return Object.freeze({ names: Object.freeze([]), census: Object.freeze([Object.freeze({ name, recordIndex, reason: 'capture-identity-unminted' })]) })
  }
  return Object.freeze({ names: Object.freeze([name]), census: Object.freeze([]) })
}
