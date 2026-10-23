/**
 * A5M2 G3 B-TERMINAL — PRODUCTION WIRING BRIDGE (root 19:08, wiring lane).
 *
 * This module is the BRIDGE between the committed G3 family adapter
 * (`governed-families/g3-fsproc-adapters.mjs`, g3a+g3b law — imported as-is,
 * NEVER edited here) and the production team-tool plane's ONE PA admission.
 * It is the terminal-family instance of the audited G6 bridge law
 * (`g6-session-query-wiring.mjs`) and the B-SCHEDULE row law (root 18:11):
 *
 *  1. CLOSED input surface: a known key set, nothing else enters; a defective
 *     inject is answered `{ ok: false, code }` (the PLANE turns that into its
 *     own typed mount refusal) — never a partial mount, never a guess.
 *  2. ONE CAPTURE per native name: the member-scoped capture seam is read AT
 *     MOST once per tool name; the SAME object serves the arm's bind-time
 *     capture and the placed definition's spread (root 18:2x defect ② law).
 *     An uncaptured native is the honest DECLARED-INACTIVE census — NO def,
 *     NO registration, native untouched; a def masking a native name with
 *     nothing behind it is the plane's own refused class.
 *  3. THE REAL PA SEAT: `pa` must be the plane's published `paAdmit` face —
 *     a CALLABLE carrying `open` / `edge` / `closePlan` (production shape,
 *     team-tool-plane.mjs) or an equivalent plain methods object. NEVER a
 *     duck `{ ok: true }` stand-in, never `input.admit`: with no admission
 *     seat no governed call may enter the ports.
 *  4. THE FULL WALK per call, in the row: classify (arm, pure) → open →
 *     edge → the ONE-SHOT consumedProof DEMAND → arm.prepare(grant) →
 *     arm.execute(plan, {consumed:true, grant: proof.grant}) → the port/
 *     native answer RETURNED VERBATIM. Refusal at any leg before
 *     arm.execute is ZERO PORT ENTRY — the control port (the REAL handle
 *     route) is entered ONLY behind the kernel witness. One consumption per
 *     plan: the arm's own state machine (CLAIMED/EXECUTING/COMMITTED →
 *     ALREADY_CONSUMED) plus the plane's single-flight token ledger, both
 *     enforced upstream of this bridge and never relaxed here.
 *  5. ARMS BOUND AT THE PLACEMENT MOMENT: the arm's bind-time
 *     definitionIdentity is `identityOf(placedDef)` — the identity of the
 *     definition THIS mount places (the image/schedule placement-moment law;
 *     an unbound identity is a config defect and THROWS, never a null that
 *     drift-refuses every call silently). The entry re-verify reads the
 *     integrator's LIVE placement feed (`liveDefinitions` → placementFeed),
 *     so a definition replacement is visible at the very next entry — no
 *     closure self-attestation.
 *  6. POST-PUBLISH REGISTRATION keyed by the placement feed's RUNTIME
 *     identity: `familyRegistrations()` reads placementFeed(name) FRESH,
 *     THROWS (PLACEMENT_KEY_ABSENT) on a silent feed and THROWS
 *     (PLACEMENT_KEY_MOVED) on a moved feed — no guessed key, no unobserved
 *     skip. This module registers NOTHING itself.
 *  7. DRAIN is the adapter's own law (new-call prohibition only; settles
 *     nothing) — the plane's dispose rides it; used token identities die
 *     with the mount (the todo law), not here.
 *
 * THE REAL-SHAPE LAW (root 19:25, cross-lane): every parameter constraint,
 * every required set, every error word on these rows comes from the REAL
 * registered terminal_* definitions captured through `readNative` (the same
 * compiled defineTool products the host itself dispatches) and from the
 * adapter's pinned service-layer refusals — NOTHING is hand-mirrored here.
 * The port's answer IS the service answer and travels verbatim; the bridge
 * never re-shapes native output, and the TerminalBackendCleanupError class
 * object is supplied by the integrator (the SAME class the live service
 * imports — the adapter's instanceof law is exact, never ducked).
 *
 * FOUR-TIER: this module makes the rows production-REACHABLE; it claims no
 * Host verification. Whether a family row is delivered 接线未测 or
 * Host-已核 is the lane report's word, not this header's.
 */
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import {
  A5_G3_ADAPTER_REVISION,
  A5_G3_FAMILIES,
  createGovernedTerminalArms,
  createHostTerminalControlPort,
} from './g3-fsproc-adapters.mjs'

export const A5_G3_TERMINAL_WIRING_REVISION = 1

/** The six B-TERMINAL mount names — FIXED native spellings (takeover ledger
 *  entry `terminal` in team-tool-plane.mjs); never a config spelling. */
export const A5_G3_TERMINAL_TOOL_NAMES = Object.freeze([
  'terminal_open',
  'terminal_send',
  'terminal_read',
  'terminal_signal',
  'terminal_close',
  'terminal_list',
])

export const A5_G3_TERMINAL_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_TERM_WIRE_INPUT_INVALID',
  CALL_ID_ABSENT: 'P_TERM_WIRE_CALL_ID_ABSENT',
  EFFECTS_UNPARSABLE: 'P_TERM_WIRE_EFFECTS_UNPARSABLE',
  ADMISSION_CANCELLED: 'P_TERM_WIRE_ADMISSION_CANCELLED',
  APPROVAL_NOT_LANDED: 'P_TERM_WIRE_APPROVAL_NOT_LANDED',
  EDGE_CANCELLED: 'P_TERM_WIRE_EDGE_CANCELLED',
  CONSUME_PROOF_MISSING: 'P_TERM_WIRE_CONSUME_PROOF_MISSING',
  PREPARE_REFUSED: 'P_TERM_WIRE_PREPARE_REFUSED',
  IDENTITY_UNBOUND: 'P_TERM_WIRE_IDENTITY_UNBOUND',
  PLACEMENT_KEY_ABSENT: 'P_TERM_WIRE_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'P_TERM_WIRE_PLACEMENT_KEY_MOVED',
})

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/** The refusal word the plane rows carry (the todo/schedule shape): the
 *  typed code and the arm's/edge's own detail, verbatim, never re-worded. */
const refusalToThrow = (refusal) => {
  const error = new Error(`refused-terminal ${String(refusal?.code ?? 'REFUSED')} — ${String(refusal?.detail ?? 'refused without detail')}`)
  if (typeof refusal?.code === 'string') error.code = refusal.code
  return error
}

const wiringRefuse = (code, detail) => deepFreeze({ ok: false, code, detail })

/** The CAPTURED registration face, measured on the REAL defineTool product
 *  (the G6 law, same bytes): a name is mountable only when the captured
 *  object carries the complete published presentation face — description,
 *  compiled `parameters`, an `output` face with a function render (and
 *  function presentationMeta when present), and a function execute. */
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

/**
 * Build the B-TERMINAL wiring for ONE mount. Returns
 * `{ ok: true, assembly }` — assembly = { familyId, adapterRevision,
 * providerId, placementNames, definitions, rows, declared, rowOf, drain,
 * familyRegistrations } — or `{ ok: false, code, detail }`. The adapter's
 * OWN hard-visit law (required seams, the session-capability requirement,
 * the REAL cleanup-error class shape) THROWS placement defects directly;
 * this bridge adds no gate of its own to that surface and the PLANE carries
 * the throw into its typed mount refusal (the G6 law).
 *
 * @param input - CLOSED key set, see the file header.
 */
export function buildG3TerminalWiring (input = {}) {
  const knownInput = new Set([
    'realmId', 'providerId', 'memberAgentId', 'sessionHeaderId', 'readNative',
    'declaredBackends', 'ptyService', 'controlPortDeps', 'bindingFacts',
    'correlationOf', 'placementFeed', 'identityOf', 'pa', 'observe',
  ])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, `unknown input key '${key}' — the wiring surface is closed; an unrecognized knob never silently widens the mount`)
    }
  }
  const {
    realmId, providerId, memberAgentId, sessionHeaderId, readNative,
    declaredBackends, ptyService, controlPortDeps, bindingFacts,
    placementFeed, identityOf, pa, observe = () => {},
  } = input
  if (typeof realmId !== 'string' || realmId.length === 0) return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'realmId is REQUIRED (the placement realm joins every resource identity)')
  if (typeof providerId !== 'string' || providerId.length === 0) return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'providerId is REQUIRED (the family registration carries the provider identity verbatim)')
  if (typeof memberAgentId !== 'string' || memberAgentId.length === 0) return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'memberAgentId is REQUIRED — the arm owns state through the EXACT member Agent (exec.agent.id), never a name lookup')
  if (typeof sessionHeaderId !== 'string' || sessionHeaderId.length === 0) return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'sessionHeaderId is REQUIRED — the durable session header (exec.agent.session.header.id) is the ownership leg')
  if (typeof readNative !== 'function') return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'readNative (name) => definition | undefined is REQUIRED — the member-scoped capture seam (the global face is NOT a fallback); `undefined` is a legal answer landing the honest DECLARED-INACTIVE census')
  if (typeof bindingFacts !== 'function') return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'bindingFacts (toolName) => {bindingId, bindingRevision, policyGeneration, authorityGeneration} is REQUIRED — the CURRENT dispatcher binding of THAT tool\'s entry, read LIVE (the todo/write arm reader law; bindingIds are per-tool `${origin}:${scope}:${name}` facts — a shared snapshot never substitutes)')
  if (typeof identityOf !== 'function') return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'identityOf (placedDef) => string | null is REQUIRED — the plane\'s definitionIdentityOf seam; the arm binds the identity of the definition THIS mount places (the image/schedule placement-moment law)')
  if (typeof placementFeed !== 'function') return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the LAZY pb §6 placement read; the entry re-verify and the registration key both ride it')
  // THE REAL SEAT (the G6 law, verbatim): production `paAdmit` is a CALLABLE
  // carrying the three methods; a plain {open, edge, closePlan} methods
  // object is the test-shape equivalent. Nothing else poses as admission.
  const paSeatOk = (typeof pa === 'function' || isRecord(pa))
    && pa !== null
    && typeof pa.open === 'function' && typeof pa.edge === 'function' && typeof pa.closePlan === 'function'
  if (!paSeatOk) {
    return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'pa is REQUIRED in its published shape — the plane\'s paAdmit face (a CALLABLE with open / edge / closePlan methods) or an equivalent plain {open, edge, closePlan} methods object; with no admission seat no governed call may enter the ports — never a duck, never input.admit{ok:true}')
  }
  // THE ISSUED CALL IDENTITY seam: the plane supplies the mount law (per-mount
  // nonce + seq + REAL exec.token single-flight). Without one the walk has no
  // single-flight key and a guessed correlation is forbidden.
  const correlationOf = input.correlationOf === undefined
    ? (exec) => (isRecord(exec) && typeof exec.callId === 'string' && exec.callId.length > 0 ? exec.callId : null)
    : typeof input.correlationOf === 'function' ? input.correlationOf : null
  if (correlationOf === null) {
    return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'correlationOf, when supplied, must be (exec, toolName) => string | null — the ISSUED call identity seam (the plane\'s mount law); a non-function never substitutes')
  }
  if (!Array.isArray(declaredBackends) || declaredBackends.length === 0
    || declaredBackends.some((t) => typeof t !== 'string' || t.length === 0)) {
    return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'declaredBackends must be a non-empty array of the DECLARED public backend types (§5.1 declared_mount law; the model\'s `type` only SELECTS among these)')
  }
  if (!isRecord(ptyService) || typeof ptyService.backend !== 'function' || typeof ptyService.session !== 'function' || typeof ptyService.approvedOpenPlan !== 'function') {
    return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'ptyService {backend, session, approvedOpenPlan} is REQUIRED — target identity/incarnation and the per-open CONTROLLED EXECUTION PLAN are SERVICE facts (the §5.1 governance interface); a seam that cannot answer the plan is not the §5.1 backend feed and refuses at assembly, never at every classify')
  }
  // THE CONTROL PORT — the REAL handle route (root boundary ruling): the
  // adapter's own hard-visit law (terminals face, resolveOwner, the REAL
  // sessionFactory + the REAL TerminalBackendCleanupError class, the
  // controlled spawnTerminal capability) is carried here UNCHANGED; the
  // wiring REQUIRES the port because the §5.1 delivery word is the real
  // handle plumbing, not a control-plane-only pose. The class object is
  // the integrator's — the SAME one the live service imports.
  if (!isRecord(controlPortDeps)) {
    return wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.INPUT_INVALID, 'controlPortDeps is REQUIRED — {terminals, resolveOwner, subprocess, sessionFactory, TerminalBackendCleanupError, jobs?, ownerSessionId?, approvedOpenPlan?}: the REAL ctx.terminals service face + the REAL pinned-639 LocalPtySession seam + the SAME TerminalBackendCleanupError class the service imports; the adapter\'s own law validates every member (this bridge adds none)')
  }

  // ONE CAPTURE (root 18:2x defect ② law): the seam is read AT MOST once per
  // tool name; the SAME object serves the arm capture and the placed def.
  const capturedOnce = new Map()
  const readNativeOnce = (name) => {
    if (capturedOnce.has(name)) return capturedOnce.get(name)
    const captured = readNative(name)
    capturedOnce.set(name, captured === null || captured === undefined ? undefined : captured)
    return capturedOnce.get(name)
  }

  // THE LATE ARM HOLDER: the def's execute closes over `armsByName`, bound
  // immediately below at the placement moment — the def object exists first
  // (its identity is what the arm binds), the arm binds second, the row
  // reads at CALL time. No def can run against an unbound arm: the row
  // refuses loudly (there is no native fallback and no degraded lane).
  const armsByName = Object.create(null)

  const rows = new Map()
  const declared = []
  const definitions = []
  const boundIdentities = new Map()

  for (const toolName of A5_G3_TERMINAL_TOOL_NAMES) {
    const native = readNativeOnce(toolName)
    if (native === undefined || !registrationFaceComplete(native)) {
      // Honest DECLARED-INACTIVE census: NO definition, NO registration.
      rows.set(toolName, Object.freeze({
        status: 'DECLARED-INACTIVE',
        reason: native === undefined ? 'capture-absent' : 'registration-face-incomplete',
      }))
      declared.push(Object.freeze({
        name: toolName,
        familyId: A5_G3_FAMILIES.TERMINAL,
        status: 'DECLARED-INACTIVE',
        reason: native === undefined ? 'capture-absent' : 'registration-face-incomplete',
      }))
      observe({ event: 'g3-wire:declared', name: toolName, reason: native === undefined ? 'capture-absent' : 'registration-face-incomplete' })
      continue
    }
    // root 8b4: the captured native definition travels COMPLETE — every
    // presentation face verbatim and by reference; ONLY execute is replaced.
    const execute = async (args, exec) => {
      const arm = armsByName[toolName]
      if (arm === undefined || arm === null) {
        throw new Error(`refused-${toolName} arm-unavailable — no governed B-TERMINAL arm is placed on this mount (or it was torn down); there is no native fallback and no degraded lane`)
      }
      const callId = correlationOf(exec, toolName)
      if (typeof callId !== 'string' || callId.length === 0) {
        throw refusalToThrow(wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.CALL_ID_ABSENT, `${toolName}: the execution answered no ISSUED call identity — the PA walk has no single-flight key; a guessed correlation is forbidden (zero port entry)`))
      }
      // ① the arm's OWN classify — the REAL captured definition's parameter
      // surface, the §5.1 service targets, the per-open approved plan: every
      // constraint is the arm's, never a restatement. A refusal here has
      // entered NOTHING (pure pre-edge).
      const classified = arm.classify(args, exec, callId)
      if (classified.ok !== true) {
        observe({ event: 'g3-wire:classify-REFUSED', name: toolName, code: classified.code })
        throw refusalToThrow(classified)
      }
      const parsedEffects = parseRequestedEffectSet(classified.effects)
      if (parsedEffects.ok !== true) {
        throw refusalToThrow(wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.EFFECTS_UNPARSABLE, `${toolName}: the arm's effect set is not the frozen closed vocabulary (${String(parsedEffects.problems?.[0]?.detail ?? 'parse refused')}) (zero port entry)`))
      }
      const signal = isRecord(exec) ? exec.signal : undefined
      const payload = classified.reviewPayload
      const walk = Object.freeze({
        realmId,
        callId,
        // The arm's OWN parametersFingerprint (the two-layer law: the grant
        // pairs against the full-values digest; the PA manifest digest is
        // the center's own computation — the row never computes it).
        parametersFingerprint: classified.parametersFingerprint,
        requestedEffects: parsedEffects.value,
        toolName,
        // 载荷法: the four P-adds at FULL VALUE, from the arm's own payload.
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
          throw refusalToThrow(wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.ADMISSION_CANCELLED, `${toolName}: cancelled at the PA open edge before admission — zero port entry`))
        }
        if (opened?.kind === 'deny') throw refusalToThrow(opened)
        if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
          throw refusalToThrow(wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.APPROVAL_NOT_LANDED, `${toolName}: the admission answered ${String(opened?.kind ?? 'unsettled')} without a landed grant — internal state never substitutes for the kernel answer (zero port entry)`))
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
          throw refusalToThrow(wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.EDGE_CANCELLED, `${toolName}: cancelled at the execution edge — the approval stays unspent and is never replayed; zero port entry`))
        }
        if (edge?.kind === 'deny') throw refusalToThrow(edge)
        const proof = edge?.consumedProof
        if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
          // The body NEVER self-attests consumption: no witness, no port entry.
          throw refusalToThrow(wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.CONSUME_PROOF_MISSING, `${toolName}: the execution edge answered allow without its one-shot consume witness — the row never substitutes a self-attested consumption; the body did not run and zero port entries were made`))
        }
        // THE NAMED race (fix-3 law): between the REAL consume and the body's
        // first microtask an abort can still land. The consumed grant is
        // ledger truth and NEVER rolls back; the arm's cancel law settles the
        // bookkeeping and the body is entered ZERO times.
        if (signal?.aborted === true) {
          const settled = arm.cancel(classified.plan)
          throw new Error(`${toolName} · cancelled — the call was aborted after the execution edge consumed the grant and before the body began (the consumption is a settled fact and is never rolled back; arm settle: ${String(settled?.settled ?? settled?.code ?? 'n/a')}; zero port entries)`)
        }
        // prepare records the kernel grant on the arm's entry (pure
        // bookkeeping — the CONTROL PORT is still untouched: the port's
        // prepare runs INSIDE arm.execute, behind this witness).
        const prepared = arm.prepare(classified.plan, proof.grant)
        if (prepared?.ok !== true) {
          observe({ event: 'g3-wire:prepare-REFUSED', name: toolName, code: prepared?.code })
          throw refusalToThrow(isRecord(prepared) && typeof prepared.code === 'string'
            ? prepared
            : wiringRefuse(A5_G3_TERMINAL_WIRING_CODES.PREPARE_REFUSED, `${toolName}: the arm refused to record the kernel grant — zero port entry`))
        }
        // ② the arm's OWN execute: the grant pairing (callId / fingerprint /
        // binding), the LIVE re-verify (placement identity through the feed,
        // CURRENT binding facts, service targets), then the REAL handle
        // route — the control port's handle answers and its answer commits.
        const ran = await arm.execute(classified.plan, { consumed: true, grant: proof.grant })
        if (ran?.ok !== true) {
          observe({ event: 'g3-wire:execute-REFUSED', name: toolName, code: ran?.code })
          throw refusalToThrow(ran)
        }
        observe({ event: 'g3-wire:served', name: toolName, callId })
        // THE ANSWER TRAVELS VERBATIM: on the port route it IS the service
        // answer (the handle's word); on the captured-body route it is the
        // native tool's word. The bridge never re-shapes, never wraps
        // native/port output as anything else (root 19:25).
        return ran.value
      } finally {
        // The redemption leg's own close handle (idempotent with the edge's
        // own plan-fact close): every path that never reached the edge still
        // ends this call's plan fact here.
        pa.closePlan(callId)
      }
    }
    const definition = Object.freeze({ ...native, execute })
    // THE PLACEMENT-MOMENT BIND (image/schedule law): the identity is read
    // off the definition THIS mount places, through the plane's own seam.
    // An identity the seam cannot answer is a config defect that THROWS —
    // an unbound arm would drift-refuse every call while LOOKING mounted.
    const identity = identityOf(definition)
    if (typeof identity !== 'string' || identity.length === 0) {
      throw new Error(`${A5_G3_TERMINAL_WIRING_CODES.IDENTITY_UNBOUND}: '${toolName}' — the definitionIdentityOf seam answered no identity for the definition this mount places; the arm cannot bind (a guessed or null identity is forbidden — the image-arm law, carried to the terminal family)`)
    }
    boundIdentities.set(toolName, identity)
    rows.set(toolName, Object.freeze({ status: 'ACTIVE', definition, definitionIdentity: identity }))
    definitions.push(definition)
    observe({ event: 'g3-wire:mounted', name: toolName })
  }

  // THE REAL CONTROL PORT (the adapter's own law; constructed once per mount):
  // every member of controlPortDeps is hard-visited there — the REAL
  // sessionFactory (pinned-639 LocalPtySession seam), the SAME
  // TerminalBackendCleanupError class the live service imports, the
  // controlled spawnTerminal capability. A defect THROWS; the plane carries
  // the throw into its typed mount refusal (the G6 placement-throw law).
  const controlPort = createHostTerminalControlPort({
    ...controlPortDeps,
    ...(ptyService.approvedOpenPlan === undefined ? {} : { approvedOpenPlan: (callId) => ptyService.approvedOpenPlan(callId) }),
  })

  // THE ARMS, bound at the placement moment over the identities read above;
  // the entry re-verify reads the LIVE placement feed per call (no closure
  // self-attestation). ONE factory call PER ACTIVE TOOL: the dispatcher
  // binding is a PER-TOOL fact (`${origin}:${scope}:${name}`,
  // tool-dispatch/install.ts:1151), so each arm binds its OWN tool's
  // CURRENT-facts reader — a shared reader would pair a grant minted under
  // one tool's binding against another tool's classify-time generations and
  // refuse (or worse, mis-pair). The factory's hard-visit law runs over the
  // SAME required seams every time; the other names of each call are absent
  // natives whose declaredAbsent arms are constructed by the adapter's own
  // law and never routed (the row reads exactly armsByName[its tool]).
  for (const active of definitions) {
    const toolName = active.name
    const armsForTool = createGovernedTerminalArms({
      nativeDefinitions: { [toolName]: readNativeOnce(toolName) },
      definitionIdentities: { [toolName]: boundIdentities.get(toolName) },
      liveDefinitions: { [toolName]: () => {
        const fed = placementFeed(toolName)
        return isRecord(fed) && typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0 ? fed : null
      } },
      declaredBackends,
      ptyService,
      controlPort,
      providerId,
      memberAgentId,
      sessionHeaderId,
      realmId,
      bindingFacts: () => bindingFacts(toolName),
      observe: (event) => { observe({ source: 'g3-adapter', ...event }) },
    })
    armsByName[toolName] = armsForTool[toolName]
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
      throw new Error(`${A5_G3_TERMINAL_WIRING_CODES.PLACEMENT_KEY_ABSENT}: the placed row '${definition.name}' answered no definition identity through the placement feed — the family registration has no trusted key; a guessed key is forbidden and an unobserved silent skip is the drift the family gate measures (the agent-bindings refusal law, carried to the G3 wiring)`)
    }
    const bound = boundIdentities.get(definition.name)
    if (bound !== undefined && bound !== key) {
      throw new Error(`${A5_G3_TERMINAL_WIRING_CODES.PLACEMENT_KEY_MOVED}: the placement identity of '${definition.name}' moved between the mount bind and the registration read (${bound} -> ${key}) — a placed definition's identity does not float; the mount is broken and re-registers nothing`)
    }
    const seen = mountedKeys.get(definition.name)
    if (seen !== undefined && seen !== key) {
      throw new Error(`${A5_G3_TERMINAL_WIRING_CODES.PLACEMENT_KEY_MOVED}: the placement identity of '${definition.name}' moved between mount reads (${seen} -> ${key}) — a placed definition's identity does not float; the mount is broken and re-registers nothing`)
    }
    mountedKeys.set(definition.name, key)
    return Object.freeze({
      name: definition.name,
      definitionIdentity: key,
      entry: Object.freeze({
        // the adapter's OWN family bytes — never re-typed here
        familyId: A5_G3_FAMILIES.TERMINAL,
        adapterRevision: A5_G3_ADAPTER_REVISION,
        providerIdentity: providerId,
      }),
    })
  }))

  const assembly = Object.freeze({
    ok: true,
    familyId: A5_G3_FAMILIES.TERMINAL,
    revision: A5_G3_TERMINAL_WIRING_REVISION,
    adapterRevision: A5_G3_ADAPTER_REVISION,
    providerId,
    /** The ACTIVE rows' placement-moment names (fixed native spellings). */
    placementNames: Object.freeze(definitions.map((definition) => definition.name)),
    /** ToolDefinition faces for the ACTIVE rows — the COMPLETE captured
     *  natives with ONLY execute replaced (classify -> open -> edge ->
     *  consumedProof -> arm). The plane places these verbatim. */
    definitions: Object.freeze(definitions),
    /** Per-tool wiring report: ACTIVE (mounted) or DECLARED-INACTIVE
     *  (no def, no registration — honest census, native untouched). */
    rows: Object.freeze(Object.fromEntries([...rows.entries()])),
    declared: Object.freeze(declared),
    rowOf: (name) => rows.get(name),
    /** L9 new-call prohibition ONLY — the adapter's own drain law per arm;
     *  settles nothing, rolls nothing back. */
    drain: () => {
      for (const arm of Object.values(armsByName)) arm.drain()
      return deepFreeze({ event: 'g3-wire:drain', semantics: 'new-call prohibition only — no resource is settled by this word' })
    },
    /** THE family registration face — call at the mount moment (AFTER
     *  publish); the PAIRED registration writer feeds each entry to
     *  registerA5GovernedFamily. Throws PLACEMENT_KEY_ABSENT /
     *  PLACEMENT_KEY_MOVED instead of guessing or skipping. */
    familyRegistrations,
  })
  return assembly
}
