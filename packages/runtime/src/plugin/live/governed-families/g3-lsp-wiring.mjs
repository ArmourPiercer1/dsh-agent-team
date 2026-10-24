/**
 * A5M2 G3 B-LSP — PRODUCTION WIRING BRIDGE (root 2026-10-24 LSP REAL-OWNER
 * card via center, wiring lane; the family adapter is the COMMITTED
 * `createGovernedLspArm`, 681568c84 — imported as-is, the 8e62 untouchable
 * law: NOTHING in g3-fsproc-adapters.mjs is edited here).
 *
 * This module is the B-LSP instance of the audited bridge law
 * (`g6-session-query-wiring.mjs` → `g3-terminal-wiring.mjs`), and it carries
 * the same seven laws with NO family-specific relaxations:
 *
 *  1. CLOSED input surface: a known key set, nothing else enters; a defective
 *     inject is answered `{ ok: false, code }` — never a partial mount.
 *  2. ONE CAPTURE for the single `lsp` name: the member-scoped capture seam
 *     is read AT MOST once; the SAME object serves the arm bind and the
 *     placed definition. An uncaptured native is the honest DECLARED-INACTIVE
 *     census — no def, no registration, native untouched.
 *  3. THE REAL PA SEAT: `pa` must be the plane's published `paAdmit` face
 *     (a CALLABLE carrying open/edge/closePlan) or the equivalent plain
 *     methods object. Never a duck, never `input.admit`.
 *  4. THE FULL WALK per call: classify (arm, pure) → open → edge → the
 *     ONE-SHOT consumedProof DEMAND → arm.prepare(grant) → arm.execute →
 *     the port/native answer VERBATIM. Refusal before arm.execute is ZERO
 *     port entry. The arm's state machine and the plane's token ledger stay
 *     upstream, never relaxed here.
 *  5. ARM BOUND AT THE PLACEMENT MOMENT: definitionIdentity = identityOf(
 *     placedDef); the entry re-verify reads the LIVE placement feed.
 *  6. POST-PUBLISH REGISTRATION keyed by the feed's RUNTIME identity:
 *     PLACEMENT_KEY_ABSENT / PLACEMENT_KEY_MOVED throw — this module
 *     registers NOTHING itself.
 *  7. DRAIN is the adapter's own law (new-call prohibition only).
 *
 * THE FIXED SCOPE (root ruling): exactly the four navigation operations at
 * the tool-lsp pin — goToDefinition / findReferences / goToImplementation /
 * hover. NO diagnostics, NO executeCommand: the arm's closed enum bind and
 * the table's closed `by` set ARE the refusal (root-fixed scope, and the
 * adapter already enforces it — this bridge adds nothing to relax). The
 * model-facing ONE-BASED UTF-16 coordinates, the workspace handling and the
 * capability ceilings ride the CAPTURED native verbatim (zero-degradation
 * law); the §5.2 facts (`lspFacts`: server, document, documentRealm,
 * documentScope) are the INTEGRATOR's supply — the realm-scoped document
 * resolver the adapter names as the MISSING capability lives with the mount
 * card's assembly leg (spawnStreaming + realm policy reconstruction over
 * `sandbox-provider/lsp-assembly.ts`, the 77ffb187-reusable face), NOT here.
 *
 * THE EXECUTION ROUTE: `controlPort` is optional and rides the adapter's OWN
 * law — with a port the port's prepare/handle executes behind the kernel
 * witness; with NO port the arm is the faithful delegate of the captured
 * body (the arm's own comment law). This bridge neither requires nor fakes a
 * port: at the 639ed01539 root the host answers no LSP service, so an
 * unmounted execution lane fails closed INSIDE the captured body, and the
 * four-tier word stays 接线未测 (this module makes the row production-
 * REACHABLE; it claims no Host verification).
 */
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import {
  A5_G3_ADAPTER_REVISION,
  A5_G3_FAMILIES,
  A5_G3_LSP_OPERATIONS,
  createGovernedLspArm,
} from './g3-fsproc-adapters.mjs'

export const A5_G3_LSP_WIRING_REVISION = 1

/** The one B-LSP mount name — the FIXED native spelling (tool-lsp registers
 *  exactly one `lsp` tool; four operations ride its operation enum). */
export const A5_G3_LSP_TOOL_NAME = 'lsp'

export const A5_G3_LSP_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_LSP_WIRE_INPUT_INVALID',
  CALL_ID_ABSENT: 'P_LSP_WIRE_CALL_ID_ABSENT',
  EFFECTS_UNPARSABLE: 'P_LSP_WIRE_EFFECTS_UNPARSABLE',
  ADMISSION_CANCELLED: 'P_LSP_WIRE_ADMISSION_CANCELLED',
  APPROVAL_NOT_LANDED: 'P_LSP_WIRE_APPROVAL_NOT_LANDED',
  EDGE_CANCELLED: 'P_LSP_WIRE_EDGE_CANCELLED',
  CONSUME_PROOF_MISSING: 'P_LSP_WIRE_CONSUME_PROOF_MISSING',
  PREPARE_REFUSED: 'P_LSP_WIRE_PREPARE_REFUSED',
  IDENTITY_UNBOUND: 'P_LSP_WIRE_IDENTITY_UNBOUND',
  PLACEMENT_KEY_ABSENT: 'P_LSP_WIRE_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'P_LSP_WIRE_PLACEMENT_KEY_MOVED',
})

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const refusalToThrow = (refusal) => {
  const error = new Error(`refused-lsp ${String(refusal?.code ?? 'REFUSED')} — ${String(refusal?.detail ?? 'refused without detail')}`)
  if (typeof refusal?.code === 'string') error.code = refusal.code
  return error
}

const wiringRefuse = (code, detail) => deepFreeze({ ok: false, code, detail })

/** The CAPTURED registration face, measured on the REAL defineTool product
 *  (the G6/G3-terminal law, same bytes): mountable only with the complete
 *  published presentation face. */
const registrationFaceComplete = (native) => {
  const output = isRecord(native) ? native.output : undefined
  return isRecord(native)
    && typeof native.description === 'string' && native.description.length > 0
    && isRecord(native.parameters)
    && isRecord(output)
    && typeof output.render === 'function'
    && (output.presentationMeta === undefined || typeof output.presentationMeta === 'function')
    && typeof native.execute === 'function'
}

/* Root 21:07 受审编码 (reviewed encoding): canonical JSON of the original
 * leaf value (object keys sorted recursively, arrays order-preserved) or the
 * literal 'absent' — the SAME law as a5G3PaTargetFlat in
 * g3-terminal-wiring.mjs, restated here because that constant is module-
 * private and the two bridges must not import each other (family isolation:
 * one bridge never rides another family's module). */
const a5LspCanonicalJson = (value) => {
  if (value === null || value === undefined) return 'absent'
  const sortDeep = (v) => (Array.isArray(v)
    ? v.map(sortDeep)
    : (v !== null && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])]))
      : v))
  return JSON.stringify(sortDeep(value))
}

/**
 * THE B-LSP CLOSED-TABLE FLAT VIEW (root 2026-10-24; the
 * PA_FAMILY_TARGET_RULES['B-LSP'] entry in control/types.ts is its
 * counterpart). Every leaf maps ONE-FOR-ONE from the delegate arm's CLASSIFY
 * targetManifest at FULL VALUE (the root 21:07 全值契约): the §5.2 target
 * facts (server identity/generation, document kind/locator/revision, the
 * bound workspace root) as canonical-JSON string leaves, the model-facing
 * ONE-BASED UTF-16 coordinates at full value, the policy generation where
 * the arm answered one. An unknown operation or a manifest shape missing a
 * nested source object passes THROUGH unchanged: the table's own grammar
 * refusal names it — nothing is invented here.
 */
export function a5LspPaTargetFlat(manifest) {
  if (!isRecord(manifest) || typeof manifest.operation !== 'string') return manifest
  if (!A5_G3_LSP_OPERATIONS.includes(manifest.operation)) return manifest
  const doc = manifest.documentTarget
  const server = manifest.serverTarget
  const workspace = manifest.workspaceIdentity
  if (!isRecord(doc) || !isRecord(server) || !isRecord(workspace)) return manifest
  return Object.freeze({
    operation: manifest.operation,
    toolName: manifest.toolName,
    realmId: manifest.realmId,
    agentId: manifest.agentId,
    sessionHeaderId: manifest.sessionHeaderId,
    paramFingerprint: manifest.paramFingerprint,
    docKind: doc.kind,
    canonicalLocator: doc.canonicalLocator,
    documentRevisionJson: a5LspCanonicalJson(doc.revision ?? null),
    serverBinaryIdentity: server.binaryIdentity,
    serverGeneration: server.generation,
    workspaceCwd: workspace.sessionHeaderCwd,
    oneBasedLine: manifest.oneBasedLine,
    oneBasedCharacter: manifest.oneBasedCharacter,
    policyGenerationJson: a5LspCanonicalJson(manifest.policyGeneration ?? null),
  })
}

/**
 * Build the B-LSP wiring for ONE mount. Returns `{ ok: true, assembly }` —
 * assembly = { familyId, adapterRevision, providerId, placementNames,
 * definitions, rows, declared, rowOf, drain, familyRegistrations } — or
 * `{ ok: false, code, detail }` (the PLANE turns that into its typed mount
 * refusal). The adapter's OWN hard-visit law (the lspFacts four-function
 * contract, the captured operation-enum bind) THROWS placement defects
 * directly; this bridge adds no gate of its own to that surface.
 *
 * @param input - CLOSED key set, see the file header.
 */
export function buildG3LspWiring (input = {}) {
  const knownInput = new Set([
    'realmId', 'providerId', 'memberAgentId', 'sessionHeaderId', 'readNative',
    'lspFacts', 'controlPort', 'bindingFacts', 'correlationOf', 'placementFeed',
    'identityOf', 'pa', 'observe',
  ])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, `unknown input key '${key}' — the wiring surface is closed; an unrecognized knob never silently widens the mount`)
    }
  }
  const {
    realmId, providerId, memberAgentId, sessionHeaderId, readNative,
    lspFacts, controlPort, bindingFacts, placementFeed, identityOf, pa,
    observe = () => {},
  } = input
  if (typeof realmId !== 'string' || realmId.length === 0) return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'realmId is REQUIRED (the placement realm joins every resource identity and the §5.2 realm obligation)')
  if (typeof providerId !== 'string' || providerId.length === 0) return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'providerId is REQUIRED (the family registration carries the provider identity verbatim)')
  if (typeof memberAgentId !== 'string' || memberAgentId.length === 0) return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'memberAgentId is REQUIRED — the arm owns state through the EXACT member Agent (exec.agent.id), never a name lookup')
  if (typeof sessionHeaderId !== 'string' || sessionHeaderId.length === 0) return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'sessionHeaderId is REQUIRED — the durable session header (exec.agent.session.header.id) is the ownership leg')
  if (typeof readNative !== 'function') return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'readNative (name) => definition | undefined is REQUIRED — the member-scoped capture seam (the global face is NOT a fallback); `undefined` is a legal answer landing the honest DECLARED-INACTIVE census')
  if (typeof bindingFacts !== 'function') return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'bindingFacts (toolName) => {bindingId, bindingRevision, policyGeneration, authorityGeneration} is REQUIRED — the CURRENT dispatcher binding of the `lsp` entry, read LIVE (bindingIds are per-tool facts; a shared snapshot never substitutes)')
  if (typeof identityOf !== 'function') return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'identityOf (placedDef) => string | null is REQUIRED — the plane\'s definitionIdentityOf seam; the arm binds the identity of the definition THIS mount places')
  if (typeof placementFeed !== 'function') return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the LAZY pb §6 placement read; the entry re-verify and the registration key both ride it')
  const paSeatOk = (typeof pa === 'function' || isRecord(pa))
    && pa !== null
    && typeof pa.open === 'function' && typeof pa.edge === 'function' && typeof pa.closePlan === 'function'
  if (!paSeatOk) {
    return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'pa is REQUIRED in its published shape — the plane\'s paAdmit face (a CALLABLE with open / edge / closePlan methods) or an equivalent plain {open, edge, closePlan} methods object; with no admission seat no governed call may enter the ports')
  }
  const correlationOf = input.correlationOf === undefined
    ? (exec) => (isRecord(exec) && typeof exec.callId === 'string' && exec.callId.length > 0 ? exec.callId : null)
    : typeof input.correlationOf === 'function' ? input.correlationOf : null
  if (correlationOf === null) {
    return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'correlationOf, when supplied, must be (exec, toolName) => string | null — the ISSUED call identity seam; a non-function never substitutes')
  }
  // THE §5.2 FACT SURFACE: the arm's OWN contract (its constructor hard-
  // visits the same four functions); checking it HERE too keeps a defective
  // inject at the typed mount refusal instead of a raw construction throw.
  if (!isRecord(lspFacts) || typeof lspFacts.server !== 'function' || typeof lspFacts.document !== 'function'
    || typeof lspFacts.documentRealm !== 'function' || typeof lspFacts.documentScope !== 'function') {
    return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'lspFacts {server, document, documentRealm, documentScope} is REQUIRED — server identity/generation, document revision, and the REALM + cross-file SCOPE answers are the §5.2 interface obligations (the realm-scoped document resolver is the integrator supply over the assembly seam; a facts-only provider is not the §5.2 implementation)')
  }
  // THE EXECUTION ROUTE (the adapter's OWN optional-port law): undefined
  // rides null (faithful captured-body delegate); anything else must be a
  // real methods record — the port's own prepare/drift/cancel law runs
  // unchanged inside arm.execute (this bridge adds none).
  if (controlPort !== undefined && controlPort !== null && !isRecord(controlPort)) {
    return wiringRefuse(A5_G3_LSP_WIRING_CODES.INPUT_INVALID, 'controlPort, when supplied, must be the integrator\'s real port record (prepare/drift/handleStatus/cancelCleanup/liveHandles per the delegate-arm law) — never a duck, never a boolean')
  }

  // ONE CAPTURE (root 18:2x defect ② law).
  let captured
  let capturedRead = false
  const readNativeOnce = () => {
    if (!capturedRead) {
      const value = readNative(A5_G3_LSP_TOOL_NAME)
      captured = value === null || value === undefined ? undefined : value
      capturedRead = true
    }
    return captured
  }

  const rows = new Map()
  const declared = []
  const definitions = []
  const boundIdentities = new Map()
  const armHolder = { arm: null }

  const toolName = A5_G3_LSP_TOOL_NAME
  const native = readNativeOnce()
  if (native === undefined || !registrationFaceComplete(native)) {
    rows.set(toolName, Object.freeze({
      status: 'DECLARED-INACTIVE',
      reason: native === undefined ? 'capture-absent' : 'registration-face-incomplete',
    }))
    declared.push(Object.freeze({
      name: toolName,
      familyId: A5_G3_FAMILIES.LSP,
      status: 'DECLARED-INACTIVE',
      reason: native === undefined ? 'capture-absent' : 'registration-face-incomplete',
    }))
    observe({ event: 'g3-lsp-wire:declared', name: toolName, reason: native === undefined ? 'capture-absent' : 'registration-face-incomplete' })
  } else {
    // root 8b4: the captured native travels COMPLETE; ONLY execute is replaced.
    const execute = async (args, exec) => {
      const arm = armHolder.arm
      if (arm === null) {
        throw new Error(`refused-lsp arm-unavailable — no governed B-LSP arm is placed on this mount (or it was torn down); there is no native fallback and no degraded lane`)
      }
      const callId = correlationOf(exec, toolName)
      if (typeof callId !== 'string' || callId.length === 0) {
        throw refusalToThrow(wiringRefuse(A5_G3_LSP_WIRING_CODES.CALL_ID_ABSENT, `${toolName}: the execution answered no ISSUED call identity — the PA walk has no single-flight key; a guessed correlation is forbidden (zero port entry)`))
      }
      const classified = arm.classify(args, exec, callId)
      if (classified.ok !== true) {
        observe({ event: 'g3-lsp-wire:classify-REFUSED', name: toolName, code: classified.code })
        throw refusalToThrow(classified)
      }
      const parsedEffects = parseRequestedEffectSet(classified.effects)
      if (parsedEffects.ok !== true) {
        throw refusalToThrow(wiringRefuse(A5_G3_LSP_WIRING_CODES.EFFECTS_UNPARSABLE, `${toolName}: the arm's effect set is not the frozen closed vocabulary (${String(parsedEffects.problems?.[0]?.detail ?? 'parse refused')}) (zero port entry)`))
      }
      const signal = isRecord(exec) ? exec.signal : undefined
      const signalTarget = isRecord(signal)
        && typeof signal.addEventListener === 'function'
        && typeof signal.removeEventListener === 'function' ? signal : null
      const routeAbort = () => { arm.cancel(classified.plan) }
      if (signalTarget !== null) signalTarget.addEventListener('abort', routeAbort)
      const payload = classified.reviewPayload
      const walk = Object.freeze({
        realmId,
        callId,
        parametersFingerprint: classified.parametersFingerprint,
        requestedEffects: parsedEffects.value,
        toolName,
        // 载荷法: the four P-adds at FULL VALUE; the B-LSP targetManifest
        // rides the CLOSED-TABLE flat view (the B-CONTROL/B-TERMINAL one-for-
        // one FLAT LEAVES law; the durable row is CARRIED, never recomputed).
        family: Object.freeze({
          familyId: payload.familyId,
          adapterRevision: payload.adapterRevision,
          providerIdentity: payload.providerIdentity,
          targetManifest: a5LspPaTargetFlat(payload.targetManifest),
        }),
        ...(signal === undefined ? {} : { signal }),
      })
      try {
        const opened = await pa.open(walk)
        if (opened?.cancelled === true) {
          throw refusalToThrow(wiringRefuse(A5_G3_LSP_WIRING_CODES.ADMISSION_CANCELLED, `${toolName}: cancelled at the PA open edge before admission — zero port entry`))
        }
        if (opened?.kind === 'deny') throw refusalToThrow(opened)
        if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
          throw refusalToThrow(wiringRefuse(A5_G3_LSP_WIRING_CODES.APPROVAL_NOT_LANDED, `${toolName}: the admission answered ${String(opened?.kind ?? 'unsettled')} without a landed grant — internal state never substitutes for the kernel answer (zero port entry)`))
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
          throw refusalToThrow(wiringRefuse(A5_G3_LSP_WIRING_CODES.EDGE_CANCELLED, `${toolName}: cancelled at the execution edge — the approval stays unspent and is never replayed; zero port entry`))
        }
        if (edge?.kind === 'deny') throw refusalToThrow(edge)
        const proof = edge?.consumedProof
        if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
          throw refusalToThrow(wiringRefuse(A5_G3_LSP_WIRING_CODES.CONSUME_PROOF_MISSING, `${toolName}: the execution edge answered allow without its one-shot consume witness — the row never substitutes a self-attested consumption; the body did not run and zero port entries were made`))
        }
        // THE NAMED race (fix-3 law): the consumed grant is ledger truth and
        // NEVER rolls back; the body is entered ZERO times.
        if (signal?.aborted === true) {
          const settled = arm.cancel(classified.plan)
          throw new Error(`${toolName} · cancelled — the call was aborted after the execution edge consumed the grant and before the body began (the consumption is a settled fact and is never rolled back; arm settle: ${String(settled?.settled ?? settled?.code ?? 'n/a')}; zero port entries)`)
        }
        const prepared = arm.prepare(classified.plan, proof.grant)
        if (prepared?.ok !== true) {
          observe({ event: 'g3-lsp-wire:prepare-REFUSED', name: toolName, code: prepared?.code })
          throw refusalToThrow(isRecord(prepared) && typeof prepared.code === 'string'
            ? prepared
            : wiringRefuse(A5_G3_LSP_WIRING_CODES.PREPARE_REFUSED, `${toolName}: the arm refused to record the kernel grant — zero port entry`))
        }
        const ran = await arm.execute(classified.plan, { consumed: true, grant: proof.grant })
        if (ran?.ok !== true) {
          observe({ event: 'g3-lsp-wire:execute-REFUSED', name: toolName, code: ran?.code })
          throw refusalToThrow(ran)
        }
        observe({ event: 'g3-lsp-wire:served', name: toolName, callId })
        // THE ANSWER TRAVELS VERBATIM (root 19:25): port answer or captured-
        // body answer, never re-shaped by this bridge.
        return ran.value
      } finally {
        if (signalTarget !== null) signalTarget.removeEventListener('abort', routeAbort)
        pa.closePlan(callId)
      }
    }
    const definition = Object.freeze({ ...native, execute })
    const identity = identityOf(definition)
    if (typeof identity !== 'string' || identity.length === 0) {
      throw new Error(`${A5_G3_LSP_WIRING_CODES.IDENTITY_UNBOUND}: '${toolName}' — the definitionIdentityOf seam answered no identity for the definition this mount places; the arm cannot bind (the image-arm law, carried to the LSP family)`)
    }
    boundIdentities.set(toolName, identity)
    rows.set(toolName, Object.freeze({ status: 'ACTIVE', definition, definitionIdentity: identity }))
    definitions.push(definition)
    observe({ event: 'g3-lsp-wire:mounted', name: toolName })
    // THE ARM, bound at the placement moment; the entry re-verify reads the
    // LIVE placement feed (no closure self-attestation). The adapter's own
    // hard-visit law runs over lspFacts and the captured operation enum.
    armHolder.arm = createGovernedLspArm({
      nativeDefinition: readNativeOnce(),
      definitionIdentity: identity,
      liveDispatcher: () => {
        const fed = placementFeed(toolName)
        return isRecord(fed) && typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0 ? fed : null
      },
      providerId,
      memberAgentId,
      sessionHeaderId,
      realmId,
      bindingFacts: () => bindingFacts(toolName),
      lspFacts,
      controlPort: controlPort ?? null,
      observe: (event) => { observe({ source: 'g3-lsp-adapter', ...event }) },
    })
  }

  const mountedKeys = new Map()
  const familyRegistrations = () => Object.freeze(definitions.map((definition) => {
    const fed = placementFeed(definition.name)
    const key = isRecord(fed) && typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0
      ? fed.definitionIdentity
      : null
    if (key === null) {
      throw new Error(`${A5_G3_LSP_WIRING_CODES.PLACEMENT_KEY_ABSENT}: the placed row '${definition.name}' answered no definition identity through the placement feed — the family registration has no trusted key; a guessed key is forbidden and an unobserved silent skip is the drift the family gate measures`)
    }
    const bound = boundIdentities.get(definition.name)
    if (bound !== undefined && bound !== key) {
      throw new Error(`${A5_G3_LSP_WIRING_CODES.PLACEMENT_KEY_MOVED}: the placement identity of '${definition.name}' moved between the mount bind and the registration read (${bound} -> ${key}) — a placed definition's identity does not float; the mount is broken and re-registers nothing`)
    }
    const seen = mountedKeys.get(definition.name)
    if (seen !== undefined && seen !== key) {
      throw new Error(`${A5_G3_LSP_WIRING_CODES.PLACEMENT_KEY_MOVED}: the placement identity of '${definition.name}' moved between mount reads (${seen} -> ${key}) — a placed definition's identity does not float; the mount is broken and re-registers nothing`)
    }
    mountedKeys.set(definition.name, key)
    return Object.freeze({
      name: definition.name,
      definitionIdentity: key,
      entry: Object.freeze({
        // the adapter's OWN family bytes — never re-typed here
        familyId: A5_G3_FAMILIES.LSP,
        adapterRevision: A5_G3_ADAPTER_REVISION,
        providerIdentity: providerId,
      }),
    })
  }))

  const assembly = Object.freeze({
    ok: true,
    familyId: A5_G3_FAMILIES.LSP,
    revision: A5_G3_LSP_WIRING_REVISION,
    adapterRevision: A5_G3_ADAPTER_REVISION,
    providerId,
    placementNames: Object.freeze(definitions.map((definition) => definition.name)),
    definitions: Object.freeze(definitions),
    rows: Object.freeze(Object.fromEntries([...rows.entries()])),
    declared: Object.freeze(declared),
    rowOf: (name) => rows.get(name),
    /** L9 new-call prohibition ONLY — the adapter's own drain law; settles
     *  nothing, rolls nothing back. */
    drain: () => {
      if (armHolder.arm !== null) armHolder.arm.drain()
      return deepFreeze({ event: 'g3-lsp-wire:drain', semantics: 'new-call prohibition only — no resource is settled by this word' })
    },
    familyRegistrations,
  })
  return assembly
}
