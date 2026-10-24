/**
 * governed-families/g1-query-assembly.mjs — A5M2-G1-WIRE PA ASSEMBLY (center
 * 01:1x continuation; split 01:4x: THIS file plus `g1-query-wiring.mjs`/`.d.mts`
 * and its spec are the G1-WIRE lane's exclusive block; the agent-bindings
 * MOUNT-ARM block and its assembly spec belong to lane 44ece — neither side
 * reaches into the other's files).
 *
 * WHAT THIS BLOCK IS: the REAL mount-side assembly line for the pure-query G1
 * subset — the production-row sibling of the signed mount-side supply lines
 * (the B-TEAM inject, the B-SUBAGENT-CONTROL assembly, the todo/write
 * family-registration law). It turns live mount seams into a wired
 * `createG1QueryWiring` candidate and drives its production half:
 *
 *  1. CAPTURE from the LIVE host registry face (`registry.get(name, agent)` —
 *     exactly the `agentCtx.tools.get(name, runtimeAgent)` reading the signed
 *     B-SUBAGENT line performs). A name the registry does not answer stays an
 *     HONEST DECLARED/INACTIVE row (the wiring's own native-less mount); a
 *     name it answers with LESS than a registration-ready definition is a
 *     config defect refused at arm (P_G1_ASM_CAPTURE_HALF_FACE) — never
 *     silently demoted. The CAPTURE-SIDE identity is minted here from the
 *     facts the mount actually observed — full reversible canonical JSON,
 *     never a hash/digest (the signed mint law, controls module 21:18) — and
 *     it is NEVER the family key: the family key stays the placement feed's
 *     runtime identity (leg-gated in the wiring; re-verified in the spec).
 *  2. THE PA SEAT: `admit` walks the plane's REAL `paAdmit` funnel
 *     (team-tool-plane.mjs:1680 @ int tip — {realmId, callId,
 *     parametersFingerprint, requestedEffects, toolName, family, signal}).
 *     The walk carries the SAME production shape the signed todo row carries
 *     (plane :2586-2600): effects run through the domain's OWN
 *     `parseRequestedEffectSet` BEFORE the walk, the family block is the
 *     classified reviewPayload's four P-adds at FULL VALUE, and the
 *     parametersFingerprint is the classify-side mint passed through
 *     untouched. A plane that answers no `paAdmit` REJECTS the call with this
 *     block's own typed error — the shipped line carries NO stub walk (the
 *     B-SUBAGENT law, verbatim). The answer mapping is fail-closed: only
 *     `{kind:'allow'}` WITHOUT the cancelled marker admits; `allow+cancelled`,
 *     `deny`, and any unanswered shape refuse with the refusing side's bytes.
 *  3. PLACEMENT through the REAL registration entry: `place()` registers each
 *     emitted definition with the live `registry.register` face (the same
 *     ToolRuntime minimum-entry core that REFUSES a fabricated shape — the
 *     wiring spec's (f) leg measures it), records every successful disposer
 *     ITEM BY ITEM, and on a mid-list throw rolls back only this call's
 *     completed items before rethrowing the ORIGINAL error (root P2 on b656;
 *     a rollback failure is aggregated onto it, its disposer kept — no fake
 *     cleanup).
 *  4. REGISTRATION after publish: `registerAfterPublish()` reads the
 *     placement keys back through the wiring's `familyRegistrations()`
 *     (feed-read at the mount moment, throws instead of guessing) and writes
 *     each `{familyId, adapterRevision, providerIdentity}` into the ONE table
 *     through the PRODUCTION `registerA5GovernedFamily` — the todo/write
 *     single-fill-point law. Idempotent by the registry's own law (same
 *     three fields re-register fine; a second DIFFERENT claim on one identity
 *     throws — a config defect, never papered over here).
 *
 * WHAT THIS BLOCK IS NOT: not C2, not wired — until the mount-arm block
 * (lane 44ece) calls it inside the agent-bindings G1 arm, no production
 * session runs this line (无 Host => 接线未测). It owns NO policy: every
 * refusal is either the wiring's/adapter's own typed bytes passed through or
 * this file's P_G1_ASM_* assembly facts, never a rewrite. It imports ONLY
 * `./g1-query-wiring.mjs`, `../pa-mount-registry.mjs`, and the domain
 * tool-governance edge (parseRequestedEffectSet); the adapter module is NOT
 * reached directly (revision facts ride the wiring's registrations), there
 * are NO node: imports (the capture mint is full canonical JSON — a digest
 * would violate the signed mint law), and no host baseline is imported.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g1-query-assembly
 */
import { createG1QueryWiring, g1PureQuerySubset, g1ValidateSupplySubset } from './g1-query-wiring.mjs'
import { a5GovernedFamilyFor, registerA5GovernedFamily } from '../pa-mount-registry.mjs'
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'

export const A5_G1_QUERY_ASSEMBLY_REVISION = 1

/** Typed assembly facts OWNED by this block (P_G1_ASM_*). Refusals the
 *  wiring/adapter already typed ride through with THEIR codes untouched. */
export const A5_G1_QUERY_ASSEMBLY_CODES = Object.freeze({
  EVIDENCE_ABSENT: 'P_G1_ASM_EVIDENCE_ABSENT',
  CAPTURE_HALF_FACE: 'P_G1_ASM_CAPTURE_HALF_FACE',
  PLANE_ABSENT: 'P_G1_ASM_PLANE_ABSENT',
  PA_FUNNEL_ABSENT: 'P_G1_ASM_PA_FUNNEL_ABSENT',
  EFFECTS_UNPARSABLE: 'P_G1_ASM_EFFECTS_UNPARSABLE',
  CALL_FACTS_ABSENT: 'P_G1_ASM_CALL_FACTS_ABSENT',
})

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Sorted-key canonical JSON (the lane's own mint helper — SAME algebra the
 *  adapter's :320 canonical and the signed controls mint use; full and
 *  reversible, explicitly NOT a digest). */
const canonical = (value) => JSON.stringify(value, (_key, item) => (
  isRecord(item) && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
    : item
))

const refuseAssembly = (code, message) => Object.freeze({ ok: false, code, message })

const typedRefusal = (code, message) => {
  const error = new Error(`refused-g1-assembly ${code} — ${message}`)
  error.code = code
  return error
}

/** The REAL registration minimum-entry shape law (core/tools register() @
 *  639) applied to what the live registry answered: half a face at capture
 *  time is a config defect NOW, not a surprise at the next seam. Schema
 *  SEMANTICS were validated by the host when the definition was registered —
 *  this reads SHAPE, not policy. */
const registrationReady = (face, name) => isRecord(face)
  && face.name === name
  && typeof face.description === 'string'
  && typeof face.execute === 'function'
  && isRecord(face.output)
  && face.output.schema !== undefined
  && typeof face.output.render === 'function'
  && (face.output.presentationMeta === undefined || typeof face.output.presentationMeta === 'function')
  && (face.timeoutMs === undefined || (Number.isFinite(face.timeoutMs) && face.timeoutMs > 0))

/** The capture-side identity mint: the mount-observed face facts, full and
 *  reversible. This string identifies the CAPTURE; the family key is always
 *  the placement feed's runtime identity — the two namespaces never cross. */
const mintCaptureIdentity = (providerId, entry, face) => `g1-capture@${providerId}@${entry.name}#${canonical({
  recordIndex: entry.recordIndex,
  familyId: entry.familyId,
  description: face.description,
  parameters: face.parameters ?? null,
  outputSchema: face.output.schema,
  timeoutMs: face.timeoutMs ?? null,
})}`

/**
 * Assemble the pure-query G1 subset into production rows.
 *
 * @param mount {{
 *   providerId: string,                                   // non-empty registration provider
 *   registry: { get(name: string, agent?: unknown): unknown, register?(definition: object): (() => void) },
 *   runtimeAgent?: unknown,                               // scope the live get() reads
 *   plane: () => { placementFeed(name): {definitionIdentity?, realmId?} | undefined, paAdmit?(walk): Promise<unknown> } | null | undefined,
 *   trusted: { realmId: string, ... },                    // the adapter's TARGETS CONFIG face (realmId also feeds the PA walk)
 *   bindingFacts: () => object,                           // live binding-revision reader
 *   topology?: { current: () => unknown },                // trustedTopology supply (B-INSPECT rows; absence keeps the module's own call-time refusal)
 *   pluginFacts?: { current: () => unknown },             // pluginFacts supply (B-PLUGIN rows only; the wiring whitelist refuses it for any other row set)
 *   installFace?: { installBundle, waitForInstall, cancelInstall }, // the LIVE manager lifecycle (B-PLUGIN install only; wiring arm law)
 *   hostEscalation?: { approveEscalation, sandboxPolicy, approver }, // the REAL Host gate seams (B-PLUGIN install only)
 *   observe?: (row: object) => void,
 * }} mount
 * @returns frozen `{ ok: true, assembly }` or a frozen `{ ok: false, code, message }`
 *          arm refusal (the wiring's own refusals pass through with THEIR codes).
 */
export function createG1QueryAssembly(mount = {}) {
  if (!isRecord(mount)) return refuseAssembly(A5_G1_QUERY_ASSEMBLY_CODES.EVIDENCE_ABSENT, 'the assembly takes one mount record')
  const CODES = A5_G1_QUERY_ASSEMBLY_CODES
  if (typeof mount.providerId !== 'string' || mount.providerId.length === 0) {
    return refuseAssembly(CODES.EVIDENCE_ABSENT, 'providerId must be a non-empty string (the provider identity the durable family gate compares against)')
  }
  if (!isRecord(mount.registry) || typeof mount.registry.get !== 'function') {
    return refuseAssembly(CODES.EVIDENCE_ABSENT, 'registry { get(name, agent) } is REQUIRED — captures are LIVE readings of the host tool registry, never bind-time copies')
  }
  const planeNow = mount.plane
  if (typeof planeNow !== 'function') {
    return refuseAssembly(CODES.EVIDENCE_ABSENT, 'plane() (=> {placementFeed, paAdmit} | null) must be a live reader — the placement feed and the PA edge are read at their moments, never captured dead')
  }
  const planeHandle = planeNow()
  if (!isRecord(planeHandle) || typeof planeHandle.placementFeed !== 'function') {
    return refuseAssembly(CODES.EVIDENCE_ABSENT, 'the placed plane answers no placementFeed — family registrations would have no trusted key source (this block ships no guessed keys)')
  }
  if (!isRecord(mount.trusted) || typeof mount.trusted.realmId !== 'string' || mount.trusted.realmId.length === 0) {
    return refuseAssembly(CODES.EVIDENCE_ABSENT, 'trusted must be the TARGETS CONFIG face with a non-empty realmId (the same realm the PA walk carries)')
  }
  if (typeof mount.bindingFacts !== 'function') {
    return refuseAssembly(CODES.EVIDENCE_ABSENT, 'bindingFacts() must be mounted — the adapter answers the binding revision the PA edge consults')
  }
  if (mount.installFace !== undefined && !isRecord(mount.installFace)) {
    return refuseAssembly(CODES.EVIDENCE_ABSENT, 'mount.installFace must be a record (the LIVE manager lifecycle face {installBundle, waitForInstall, cancelInstall} — the wiring validates its shape; an arm-less mount simply omits it and install_bundle stays fail-closed at the adapter edge)')
  }
  if (mount.hostEscalation !== undefined && !isRecord(mount.hostEscalation)) {
    return refuseAssembly(CODES.EVIDENCE_ABSENT, 'mount.hostEscalation must be a record (the REAL gate ingredients {approveEscalation, sandboxPolicy, approver} of tools.ts:38-44 — the Team PA never stands in for the Host adjudicator)')
  }
  if (mount.pluginFacts !== undefined && (!isRecord(mount.pluginFacts) || typeof mount.pluginFacts.current !== 'function')) {
    return refuseAssembly(CODES.EVIDENCE_ABSENT, 'mount.pluginFacts must be { current: () => the CURRENT profile facts } — a live CURRENT-facts source or nothing (the B-PLUGIN rows\' classify law reads it per call; a frozen snapshot is not a CURRENT-facts source)')
  }
  if (mount.topology !== undefined && (!isRecord(mount.topology) || typeof mount.topology.current !== 'function')) {
    return refuseAssembly(CODES.EVIDENCE_ABSENT, 'topology, when supplied, must be { current: () => unknown } — a CURRENT-facts reader, never a frozen snapshot')
  }
  const observe = typeof mount.observe === 'function' ? mount.observe : () => {}

  // ── 1. CAPTURES: live reads, honest declared rows, minted capture identities
  // The DEFAULT row set is the pure-query subset (the signed supply line).
  // A caller may mount ANOTHER derived set — today exactly one exists:
  // g1ControlSupplySubset() for the B-CONTROL write rows (root LIMITED BUILD
  // ORDER 2026-10-25). The CLOSED subset law runs at the door
  // (g1ValidateSupplySubset): every row must answer the FROZEN dispatch
  // table name/recordIndex/family exactly; a guessed or hand-edited row set
  // refuses the assembly, it never narrows or widens silently.
  let subset = g1PureQuerySubset()
  if (mount.subset !== undefined) {
    const subsetViolation = g1ValidateSupplySubset(mount.subset)
    if (subsetViolation !== undefined) {
      return refuseAssembly(CODES.EVIDENCE_ABSENT, `mounted subset is not a frozen-table row set: ${subsetViolation}`)
    }
    subset = Object.freeze([...mount.subset].map((row) => Object.freeze({ name: row.name, recordIndex: row.recordIndex, familyId: row.familyId })))
  }
  const captured = {}
  const captures = {}
  for (const entry of subset) {
    const live = mount.registry.get(entry.name, mount.runtimeAgent)
    if (live === undefined || live === null) {
      observe({ event: 'g1-asm:declared', name: entry.name, recordIndex: entry.recordIndex })
      continue
    }
    if (!registrationReady(live, entry.name)) {
      return refuseAssembly(CODES.CAPTURE_HALF_FACE, `'${entry.name}': the live registry answered a registration-INCOMPLETE definition — half a face names a mount this block cannot honestly bind (refused at arm, never demoted to a declared row)`)
    }
    const definitionIdentity = mintCaptureIdentity(mount.providerId, entry, live)
    captured[entry.name] = Object.freeze({ native: live, definitionIdentity })
    captures[entry.name] = Object.freeze({ status: 'CAPTURED', definitionIdentity, recordIndex: entry.recordIndex, familyId: entry.familyId })
    observe({ event: 'g1-asm:captured', name: entry.name, recordIndex: entry.recordIndex })
  }

  // ── 2. THE PLANE SEAMS: sanitized placement feed + the REAL paAdmit walk
  const placementFeed = (name) => {
    const fed = planeNow()?.placementFeed?.(name)
    if (!isRecord(fed)) return undefined
    return {
      ...(typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0 ? { definitionIdentity: fed.definitionIdentity } : {}),
      ...(typeof fed.realmId === 'string' && fed.realmId.length > 0 ? { realmId: fed.realmId } : {}),
    }
  }
  const admit = async (ctx) => {
    const handle = planeNow()
    if (!isRecord(handle)) throw typedRefusal(CODES.PLANE_ABSENT, 'the placed plane vanished before the walk — admission has no edge and this line ships no stub walk (B-SUBAGENT law)')
    if (typeof handle.paAdmit !== 'function') {
      throw typedRefusal(CODES.PA_FUNNEL_ABSENT, 'the placed plane answers no paAdmit funnel — the control trio has no admission edge (this wiring ships no stub walk)')
    }
    const classified = isRecord(ctx.classified) ? ctx.classified : null
    const exec = isRecord(ctx.exec) ? ctx.exec : {}
    if (classified === null || typeof exec.callId !== 'string' || exec.callId.length === 0) {
      throw typedRefusal(CODES.CALL_FACTS_ABSENT, 'the walk needs the classified facts and exec.callId — a call with no correlation cannot carry a PA fact')
    }
    const payload = isRecord(classified.reviewPayload) ? classified.reviewPayload : null
    if (payload === null || typeof payload.familyId !== 'string' || !Number.isInteger(payload.adapterRevision)
      || typeof payload.providerIdentity !== 'string' || !isRecord(payload.targetManifest)) {
      throw typedRefusal(CODES.CALL_FACTS_ABSENT, 'the classify answered no reviewPayload {familyId, adapterRevision, providerIdentity, targetManifest} — the family block would be a fabrication')
    }
    const parsedEffects = parseRequestedEffectSet(classified.effects)
    if (parsedEffects.ok !== true) {
      throw typedRefusal(CODES.EFFECTS_UNPARSABLE, `the arm's effect set is not the frozen closed vocabulary (${JSON.stringify(parsedEffects.problems ?? null).slice(0, 200)})`)
    }
    const walk = Object.freeze({
      realmId: mount.trusted.realmId,
      callId: exec.callId,
      parametersFingerprint: classified.parametersFingerprint,
      requestedEffects: parsedEffects.value,
      toolName: ctx.name,
      family: Object.freeze({
        familyId: payload.familyId,
        adapterRevision: payload.adapterRevision,
        providerIdentity: payload.providerIdentity,
        targetManifest: payload.targetManifest,
      }),
      signal: exec.signal,
    })
    const answer = await handle.paAdmit(walk)
    if (answer?.kind === 'allow' && answer.cancelled !== true) return { ok: true }
    if (answer?.kind === 'allow' && answer.cancelled === true) {
      return { ok: false, code: 'PA_WALK_CANCELLED', detail: 'the caller signal cancelled the walk before admission — the native is not entered' }
    }
    if (answer?.kind === 'deny') return { ok: false, code: String(answer.code ?? 'PA_DENY'), detail: String(answer.detail ?? 'the plane refused this walk') }
    return { ok: false, code: 'PA_WALK_UNANSWERED', detail: `the paAdmit edge answered no allow/deny shape (${JSON.stringify(answer?.kind ?? null)})` }
  }

  // ── the wiring candidate over the live supplies (its refusals pass through)
  const wiring = createG1QueryWiring({
    providerId: mount.providerId,
    subset,
    captured,
    placementFeed,
    trusted: mount.trusted,
    bindingFacts: mount.bindingFacts,
    ...((mount.topology === undefined && mount.pluginFacts === undefined) ? {} : {
      ports: Object.freeze({
        ...(mount.topology === undefined ? {} : { trustedTopology: mount.topology }),
        // CURRENT-facts source for the B-PLUGIN rows (CENTER order
        // 2026-10-25). The WIRING whitelist is the authority: a pure-query
        // row set presenting pluginFacts is refused ARM_NOT_ACCEPTED —
        // this layer only threads what the mount supplied.
        ...(mount.pluginFacts === undefined ? {} : { pluginFacts: mount.pluginFacts }),
      }),
    }),
    // the INSTALL ARMS (user ruling 2026-10-25 09:03:32): threaded to the
    // wiring untouched — the wiring's arm law is the authority (only an
    // exactly-B-PLUGIN row set is accepted; shape validated there at
    // assembly; the adapter re-verifies identity at every edge).
    ...(mount.installFace === undefined && mount.hostEscalation === undefined ? {} : {
      arms: Object.freeze({
        ...(mount.installFace === undefined ? {} : { installFace: mount.installFace }),
        ...(mount.hostEscalation === undefined ? {} : { hostEscalation: mount.hostEscalation }),
      }),
    }),
    admit,
    observe,
  })
  if (wiring.ok !== true) {
    observe({ event: 'g1-asm:wiring-REFUSED', code: wiring.code })
    return Object.freeze({ ok: false, code: wiring.code, message: wiring.message })
  }

  // ── 3. PLACEMENT through the live registration entry (disposers owned here).
  //    ROOT NARROW-REVIEW P2 ON b656: every successful register is recorded
  //    ITEM BY ITEM the moment it succeeds — a mid-list throw loses nothing.
  //    The failure path rolls back ONLY the items THIS call completed (reverse
  //    order), rethrows the ORIGINAL exception untouched, and a rollback
  //    disposer that itself throws is aggregated onto that error and its
  //    disposer STAYS owned here for a later unplace() — never a fake cleanup.
  let disposers = null
  const place = () => {
    if (disposers !== null) return disposers
    if (typeof mount.registry.register !== 'function') {
      throw typedRefusal(CODES.EVIDENCE_ABSENT, 'place() needs the live registry.register face — placement happens through the REAL registration entry or not at all')
    }
    const placedThisCall = []
    try {
      for (const definition of wiring.definitions) {
        placedThisCall.push({ name: definition.name, dispose: mount.registry.register(definition) })
      }
    } catch (error) {
      const rollbackErrors = []
      const survivors = []
      for (let index = placedThisCall.length - 1; index >= 0; index -= 1) {
        const item = placedThisCall[index]
        try {
          item.dispose()
        } catch (rollbackError) {
          rollbackErrors.push({ name: item.name, error: rollbackError })
          survivors.push(item.dispose)
        }
      }
      // No fake cleanup: an item whose rollback threw stays owned here so a
      // later unplace() can still reach it; the assembly never claims it gone.
      if (survivors.length > 0) disposers = Object.freeze(survivors)
      if (rollbackErrors.length > 0) {
        observe({ event: 'g1-asm:place-rollback-ERRORS', count: rollbackErrors.length, names: rollbackErrors.map((entry) => entry.name) })
        try {
          Object.defineProperty(error, 'g1AsmPlaceRollbackErrors', { value: Object.freeze(rollbackErrors), configurable: true, enumerable: false })
        } catch {
          observe({ event: 'g1-asm:place-rollback-errors-UNATTACHABLE', count: rollbackErrors.length })
        }
      }
      throw error
    }
    disposers = Object.freeze(placedThisCall.map((item) => item.dispose))
    observe({ event: 'g1-asm:placed', count: disposers.length })
    return disposers
  }
  const unplace = () => {
    if (disposers === null) return
    for (const dispose of disposers) dispose()
    disposers = null
  }

  // ── 4. REGISTRATION after publish: keys read back through the feed, one
  //    fill point, the production registry's own law. Rethrows the wiring's
  //    PLACEMENT_KEY_ABSENT / PLACEMENT_KEY_MOVED untouched (no guessed key,
  //    no silent skip — the mount-arm block answers with its mount-refused).
  const registerAfterPublish = () => {
    const registrations = wiring.familyRegistrations()
    for (const registration of registrations) {
      registerA5GovernedFamily(registration.definitionIdentity, registration.entry)
      const readBack = a5GovernedFamilyFor(registration.definitionIdentity)
      if (readBack === undefined || readBack.familyId !== registration.entry.familyId
        || readBack.adapterRevision !== registration.entry.adapterRevision
        || readBack.providerIdentity !== registration.entry.providerIdentity) {
        throw typedRefusal(CODES.EVIDENCE_ABSENT, `the family table did not read back '${registration.name}'s registration verbatim — the single fill point is broken`)
      }
      observe({ event: 'g1-asm:family-registered', name: registration.name, familyId: registration.entry.familyId })
    }
    return Object.freeze(registrations.map((registration) => Object.freeze({ ...registration })))
  }

  const assembly = Object.freeze({
    ok: true,
    revision: A5_G1_QUERY_ASSEMBLY_REVISION,
    providerId: mount.providerId,
    /** The wiring candidate this block assembled (rows/definitions/declared). */
    wiring,
    definitions: wiring.definitions,
    placementNames: wiring.placementNames,
    declared: wiring.declared,
    rowOf: wiring.rowOf,
    /** CAPTURE-SIDE identities, visible and namespaced apart from the
     *  placement keys ('g1-capture@...'; the family key never reads like it). */
    captures: Object.freeze({ ...captures }),
    topologyMounted: mount.topology !== undefined,
    place,
    unplace,
    registerAfterPublish,
  })
  observe({ event: 'g1-asm:assembled', mounted: wiring.placementNames.length, declared: wiring.declared.length })
  return assembly
}
