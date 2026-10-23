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
 *    whitelisted to the ONE CURRENT-facts source the subset can consult
 *    (`trustedTopology`) — every other port (trustedCatalog, pluginFacts,
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
 * derivation, description bytes, feed-keyed registration, non-query silence,
 * declared/INACTIVE verbatimity, and the import closure.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g1-query-wiring
 */
import {
  A5_G1_ADAPTER_REVISION,
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
  const knownInput = new Set(['providerId', 'captured', 'placementFeed', 'trusted', 'bindingFacts', 'ports', 'admit', 'observe'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, `unknown wiring input '${key}' — the candidate takes exactly {providerId, captured, placementFeed, trusted, bindingFacts, ports, admit, observe}`)
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
  const portsIn = input.ports ?? {}
  if (!isRecord(portsIn)) return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, 'ports must be a record (or absent)')
  for (const key of Object.keys(portsIn)) {
    if (!ALLOWED_PORTS.includes(key)) {
      return refuseAssembly(A5_G1_QUERY_WIRING_CODES.ARM_NOT_ACCEPTED, `ports.${key} is not a pure-query CURRENT-facts source — the whitelist is {${ALLOWED_PORTS.join(', ')}}; every other port is another family's face or a resource arm this candidate never carries`)
    }
  }
  const ports = Object.freeze({ ...portsIn })
  const observe = typeof input.observe === 'function' ? input.observe : () => {}

  const capturedIn = input.captured ?? {}
  if (!isRecord(capturedIn)) return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, 'captured must be a record (name -> {native, definitionIdentity}) or absent')
  const subset = g1PureQuerySubset()
  const subsetNames = new Set(subset.map((entry) => entry.name))
  // A capture presented for a NON-subset record is an attempt to wire a
  // non-query row through the pure-query candidate: a config defect, refused.
  for (const key of Object.keys(capturedIn)) {
    if (!subsetNames.has(key)) {
      return refuseAssembly(A5_G1_QUERY_WIRING_CODES.NON_SUBSET_CAPTURE, `'${key}' is not a pure-query G1 record (derived subset: ${subset.map((entry) => entry.name).join(', ')}); non-query rows are not emitted, captured-wired, or registered by this module`)
    }
  }
  // A PRESENT-but-malformed capture is a config defect too — half a capture
  // is not "no capture": it names a face the mount cannot honestly bind.
  for (const [key, capture] of Object.entries(capturedIn)) {
    if (!isRecord(capture)
      || !isRecord(capture.native) || capture.native.name !== key || typeof capture.native.description !== 'string' || typeof capture.native.execute !== 'function'
      || typeof capture.definitionIdentity !== 'string' || capture.definitionIdentity.length === 0) {
      return refuseAssembly(A5_G1_QUERY_WIRING_CODES.INPUT_INVALID, `captured.${key} must be {native: {name:'${key}', description, execute}, definitionIdentity: non-empty string} — the captured face mounts WITH its own definition identity (the adapter's mount law); a half-capture is refused, never demoted to a declared row`)
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
    const definition = deepFreeze({
      name,
      description: row.description, // the CAPTURED native description bytes (row-carried, verbatim)
      ...(isRecord(row.parameters) ? { parameters: row.parameters } : {}),
      execute,
    })
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
        adapterRevision: A5_G1_ADAPTER_REVISION,
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
    /** ToolDefinition faces for the ACTIVE subset rows — the plane places
     *  these verbatim (description + parameters are the CAPTURED native
     *  bytes; the execute runs classify -> admit (plane seat) -> delegate). */
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
