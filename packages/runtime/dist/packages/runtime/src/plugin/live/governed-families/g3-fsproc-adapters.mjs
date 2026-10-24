/**
 * governed-families/g3-fsproc-adapters.mjs — A5-M2 G3 (FS-PROC) governed arms
 * for the FS-PROC families whose native faces exist at the pin but whose
 * governed ROWS the CENTER has not (yet) wired. These are UNWIRED assemblies:
 * nothing here is mounted; no product-readiness or acceptance is claimed from
 * this file.
 *
 * Families (frozen dispatch index, records 12-17 / 18-20 / 21 / 64):
 *
 *  - B-TERMINAL (terminal_open / terminal_send / terminal_read /
 *    terminal_signal / terminal_close / terminal_list), mountCondition =
 *    declared_mount. Native faces at the pin (@639ed01539): the `terminals`
 *    service (@packages/terminal/terminal/src/index.ts — registerBackend:125,
 *    spawn:154, startSend:243, read:263, signal:274, kill:285, list:308)
 *    behind the six tool definitions (@packages/terminal/tool-terminal/
 *    src/index.ts:164/199/302/335/360/391). M0-B §5.1: the TARGET facts come
 *    from the SERVICE, never from model claims — the public backend's CURRENT
 *    registration identity/incarnation + process/IO envelope (open), and the
 *    PTY INCARNATION + current status/envelope (send/read/signal/close): a
 *    sessionId alone never authorizes. The integrator injects `ptyService`
 *    (backend(type) / session(ownerAgentId, sessionId)); an unresolved target
 *    refuses `*_TARGET_UNRESOLVED`, and facts that move between approval and
 *    the entry refuse `*_TARGET_DRIFT` at the entry. The model may only
 *    select DECLARED public backends; per-open private one-shot registrations
 *    (§5.1, CENTER-minted internal types) are never model-selectable.
 *  - B-LSP (`lsp`): mountCondition = always. Native faces: the `lsp` service
 *    (Lsp.query(request, signal) @packages/lsp/lsp/src/index.ts:143) behind
 *    the tool (@packages/lsp/tool-lsp/src/index.ts:110+; one-based UTF-16
 *    coordinates stay the model spelling, the zero-based conversion is the
 *    captured body's parseLspArgs law; the workspace is the REAL
 *    exec.agent.session.header.cwd the host sessionCwd reads). M0-B §5.2: the
 *    target carries the workspace identity, the DOCUMENT revision, the SERVER
 *    binary identity + generation (per member×generation), and the realm;
 *    F(read project-scope) rides as a grammar-valid `read` effect on the
 *    resolved document resource. The closed operation set is exactly the four
 *    navigation ops — no diagnostics/executeCommand/generic fallback. The
 *    per(member×generation) realm assembly stays in sandbox-provider/
 *    lsp-assembly.ts (§5.2), untouched.
 *  - B-PTC (`run_code`): the outer arm over the captured native definition
 *    the registry mints via createRunCodeTool (@deepseek-ai/dsh-tools ptc.ts:
 *    RUN_CODE_NAME:30, createRunCodeTool:333). EXEC FIDELITY is the
 *    child-tool channel: the PTC bridge reads exec.rootCallId and exec.token
 *    (sub-dispatch `parent`), calls exec.deferContext()/exec.concludeTurn(),
 *    and threads exec.agent/exec.signal/exec.callId (ptc.ts:401-414,
 *    545-653). This arm therefore forwards a FAITHFUL exec snapshot: EVERY
 *    own field of the classified exec is carried (no field loss), with
 *    function members bound to the live execution so deferContext/
 *    concludeTurn still land on the run that owns them. The target carries
 *    the INTERPRETER/provider identity, the EFFECTIVE execution envelope, and
 *    the REAL child-channel facts (capability list + digest + concurrency
 *    bound + per-run budget from the injected `ptcFacts` reader). Escalation
 *    stays DATA (pair-law, mode from the ONE pinned vocabulary, justification
 *    as digest); answers live only in the mounted adjudication bridge
 *    (ptc-escalation-row.mjs) — this arm exposes no approval face.
 *
 * B-JOB (job_output / job_list / job_kill) needs NO new face: the trio is
 * takeover-mounted (team-tool-plane.mjs behind the closed `jobsEnabled` key,
 * createGovernedJobsBridge @plane-effect-backends.mjs, host JobRegistry
 * start/list/get/read/readAt/kill/wait @packages/jobs/jobs/src/index.ts — NO
 * owner()/done() at the pin). The G3 spec pins the one leg the census found
 * uncovered: the management path across the gateway DRAINING state.
 *
 * EDGE LAWS (the todo exemplar, kept whole; ordering per the root
 * concentrated-fix card, clarified):
 *  - The ONLY path to a native body is the definition OBJECT + its `execute`
 *    function captured at bind time; identity pairing is the REAL Host face
 *    (`exec.agent.id` ↔ memberAgentId, `exec.agent.session.header.id` ↔
 *    sessionHeaderId).
 *  - THE AUTHORITATIVE RE-VERIFICATION RUNS AT THE REAL ENTRY. A pre-entry
 *    synchronous pass exists ONLY as fail-fast; the decision to enter the
 *    body is taken inside the entry microtask itself, immediately before the
 *    call, by RE-QUERYING THE LIVE SOURCES the integrator supplies: the
 *    CURRENT binding facts (bindingId AND generations — nothing is trusted
 *    from the classify closure), the CURRENT definition identity from the
 *    live dispatcher face (`liveDispatcher`, the placement-feed read;
 *    required whenever a native definition is captured — a closure-attested
 *    identity is self-attestation), the captured function value, and the
 *    family's service target facts. Body entry happens only if EVERY fact
 *    still holds at that moment; between the fail-fast pass and the entry
 *    there is therefore no window where a stale generation enters (the G3
 *    spec pins exactly this: facts moved AFTER execute() was called still
 *    refuse with zero body).
 *  - No new ledger: the consumed-grant grammar (callId +
 *    parametersFingerprint + bindingId + bindingRevision) is verified against
 *    the SAME live facts the entry re-queries; the arm mints no generations,
 *    grants, or escalations. `inFlight()` is a read-only observability
 *    mirror, never authority.
 *  - classify is PURE over arguments + the injected current-facts readers
 *    (the bindingFacts precedent); no disk/network/spawn happens here.
 *  - DRAIN IS A PROHIBITION, NOT A SETTLEMENT: drain() forbids NEW calls and
 *    answers {draining, inFlightCount, unsettledBackgroundJobIds}. A native
 *    background job (terminal_send run_in_background → host jobs.start) or a
 *    PTY process tree STAYS LIVE until its own kill/close evidence; the arm
 *    never claims a settle it cannot observe (inFlight() carries the facts).
 *
 * SCHEMAS: the registration face is DERIVED from the CAPTURED native
 * definition's own authored parameter spec (g3CanonicalRegistrationFace
 * mirrors the host's parameterSchemaSpecToJsonSchema lift at the pin:
 * property-level `required: true` → parent-level `required` array; the host's
 * private defineTool INPUT DSL never reaches a registration face), so dynamic
 * config fields (run_in_background only when the host mounts the jobs arm,
 * the PTC controls only when the runtime declares them) mirror the ACTUAL
 * captured config. The G3 spec proves every derived face against the REAL
 * pinned host validator AND the host's own conversion function.
 *
 * NOT in this file: registration/placement/mask (CENTER), the admission
 * kernel (A owns Control/PA consumption; the arm only consumes ITS
 * consumed-proof at the edge), the jobs bridge, the PTC escalation
 * adjudication bridge, the LSP realm assembly (§5.2, sandbox-provider), and
 * the §5.1 per-open backend provider itself.
 *
 * DELIVERABLE BOUNDARY for the REAL handles (root boundary ruling, @639ed01539
 * — which ACTUAL entry produces them, who executes, how the result is
 * awaited/terminated; where none exists, the checked API gap is reported,
 * never a dressed-up success):
 *  - B-TERMINAL: the public controlled entry EXISTS — the
 *    `@deepseek-ai/dsh-terminal` TerminalSessionService (`ctx.terminals`:
 *    spawn / startSend→TerminalSendOperation.done / read / signal / kill /
 *    list, owner-authorized by the EXACT live Agent; the model-facing six
 *    tools are its face, tool-terminal lib/index.js :300/:425/:510/:568/
 *    :611/:636). createHostTerminalControlPort is the integrator adapter
 *    OVER THAT ENTRY: WHO executes = the service's registered
 *    TerminalBackend.spawn process tree; HOW the real result is awaited =
 *    TerminalSendOperation.done (a TerminalSendResult); HOW it terminates =
 *    service.kill (awaits quiescent cleanup; its true/false answer is the
 *    word) and, for background sends, the `ctx.jobs` JobRegistry contract
 *    (start→id + hooks.done; kill answers requested/already-finished).
 *    No jobs registry ⇒ background sends REFUSE typed — never a fake id.
 *  - B-LSP: a public LSP entry EXISTS — the `@deepseek-ai/dsh-lsp` service
 *    (`ctx.lsp.query(request, signal)`, exported lib: Lsp/LspError; the
 *    model-facing tool is its face) — but its query answer carries NO realm,
 *    NO workspace-scope decision and NO document revision, and
 *    `workspaceRoot` is caller-answered. So a ctx.lsp adapter CAN execute
 *    queries (WHO executes: the registered per-extension provider; HOW the
 *    result is awaited: the query promise), while the §5.2 REALM + SCOPE
 *    obligations it cannot answer stay INTERFACE obligations on the
 *    integrator's assembly adapter (documentRealm/documentScope/document
 *    revision + server identity/generation), enforced HERE at classify AND
 *    at the entry. The named MISSING capability (@639ed01539): a
 *    realm-scoped document-target resolver — ctx.lsp answers no realm/scope/
 *    revision, and this tree's sandbox-provider/lsp-assembly.ts owns the
 *    per-realm confined instances + generation discipline but answers none
 *    of the per-document obligations either.
 *  - B-PTC: the real executor is the HOST's run_code transport (createRunCode
 *    Tool @core/tools/src/ptc.ts, mounted privately @core/tools/src/
 *    index.ts:25; the run driver runtime.run @ptc.ts:697 under the policy
 *    from resolveSandboxPolicy @ptc.ts:391) — NOT a public entry at the pin
 *    (createRunCodeTool is not exported from the lib; ToolRuntime's
 *    ptcTransport field is private, lib/types/index.d.ts:552), and the
 *    EFFECTIVE envelope is not observable through any public export. The
 *    outer row therefore enforces the envelope/budget as REAL ANSWERED
 *    FACTS (null/empty refuses P_PTC_ENVELOPE_UNEVIDENCED — an unevidenced
 *    envelope never runs) and never claims to own the execution.
 *  The facts readers here (ptyService/lspFacts/ptcFacts) are the CURRENT-
 *  FACTS seam the integrator wires to those services; the control port is
 *  the handle seam. Both are seams, not implementations — and where the
 *  seam has no real entry behind it, every word says so.
 *
 * @module runtime/plugin/live/governed-families/g3-fsproc-adapters
 */
import { createHash } from 'node:crypto'
import { TextEncoder } from 'node:util'
import { PTC_ESCALATION_MODES } from '../ptc-escalation-row.mjs'

/** Adapter generation for the whole G3 module (all three families move as one). */
export const A5_G3_ADAPTER_REVISION = 3

export const A5_G3_FAMILIES = Object.freeze({
  TERMINAL: 'B-TERMINAL',
  LSP: 'B-LSP',
  PTC: 'B-PTC',
})

/** The closed LSP navigation set at the pin (tool-lsp LSP_OPERATIONS). */
export const A5_G3_LSP_OPERATIONS = Object.freeze([
  'goToDefinition',
  'findReferences',
  'goToImplementation',
  'hover',
])

/** The terminal signal enum at the pin (tool-terminal terminal_signal). */
export const A5_G3_TERMINAL_SIGNALS = Object.freeze(['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGTSTP', 'SIGHUP'])

/**
 * Typed refusal codes. P-proposed: the naming belongs to the governance
 * error family (AUTH/CENTER); the STRINGS are pinned by
 * packages/runtime/test/a5m2-g3-fsproc.test.ts.
 */
function typedCodes(prefix) {
  return Object.freeze({
    UNKNOWN_PARAMETER: `${prefix}_CLASSIFY_UNKNOWN_PARAMETER`,
    INVALID_ARGUMENTS: `${prefix}_CLASSIFY_INVALID_ARGUMENTS`,
    NO_OWNING_SESSION: `${prefix}_CLASSIFY_NO_OWNING_SESSION`,
    FOREIGN_SESSION: `${prefix}_CLASSIFY_FOREIGN_SESSION`,
    TARGET_UNRESOLVED: `${prefix}_TARGET_UNRESOLVED`,
    TARGET_DRIFT: `${prefix}_TARGET_DRIFT`,
    DECLARED_ABSENT: `${prefix}_DECLARED_SERVICE_ABSENT`,
    NOT_ADMITTED: `${prefix}_NOT_ADMITTED`,
    ALREADY_CONSUMED: `${prefix}_ALREADY_CONSUMED`,
    REQUIRED_MISSING: `${prefix}_CLASSIFY_REQUIRED_MISSING`,
    CANCELLED: `${prefix}_CANCELLED`,
    DRAINING: `${prefix}_DRAINING`,
    DEFINITION_DRIFT: `${prefix}_DEFINITION_DRIFT`,
    GRANT_MISMATCH: `${prefix}_GRANT_MISMATCH`,
  })
}

export const A5_G3_TERMINAL_TYPED_CODES = Object.freeze({
  ...typedCodes('P_TERM'),
  BACKEND_NOT_DECLARED: 'P_TERM_CLASSIFY_BACKEND_NOT_DECLARED',
  // Control-port codes (the REAL handle route): the adapter over
  // ctx.terminals answers these; none of them is ever a success word.
  PORT_OWNER_UNRESOLVED: 'P_TERM_PORT_OWNER_UNRESOLVED',
  BG_PORT_UNWIRED: 'P_TERM_BG_PORT_UNWIRED',
  PORT_TOOL_UNKNOWN: 'P_TERM_PORT_TOOL_UNKNOWN',
})
export const A5_G3_LSP_TYPED_CODES = Object.freeze({
  ...typedCodes('P_LSP'),
  // §5.2 REALM/cross-file SCOPE obligations (answered by the assembly
  // adapter's target answers, enforced HERE): a document outside the bound
  // realm or a scope answer that is not 'inside' refuses — never executes.
  SCOPE_ESCAPED: 'P_LSP_REALM_SCOPE_ESCAPED',
})
export const A5_G3_PTC_TYPED_CODES = Object.freeze({
  ...typedCodes('P_PTC'),
  ESCALATION_ARGS_INVALID: 'P_PTC_CLASSIFY_ESCALATION_ARGS_INVALID',
  // The EFFECTIVE envelope / REAL budget law: null/empty answers are not
  // implementations — an unevidenced envelope refuses typed, never passes.
  ENVELOPE_UNEVIDENCED: 'P_PTC_ENVELOPE_UNEVIDENCED',
})

const refuse = (code, detail) => ({ ok: false, code, detail })
const refusePort = (code, detail) => ({ code, detail })

const canonicalJson = (value) => JSON.stringify(value, (_k, v) => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v
))

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner)
    Object.freeze(value)
  }
  return value
}

// ── registration face derivation (compiled-config mirror, root final ruling) ──

/**
 * Lift one node of the host's AUTHORED parameter DSL (property-level
 * `required: true` markers) into a JSON Schema node: the marker is stripped
 * (it is the host's private defineTool INPUT DSL) and collected into the
 * PARENT's `required` array; recurses through `properties`/`items`/
 * `oneOf`/`anyOf`/`allOf`.
 *
 * THIS FUNCTION IS NOT THE FIXED POINT. The fixed point is the REAL Host
 * compiler (see `g3CompileRegistrationFace`): the spec compiles the captured
 * authored config through the pinned host lib's OWN `defineTool` and requires
 * byte-equality with that COMPILED product. This local walk exists only to
 * produce the face when the host lib is not loaded in the process (the arm is
 * authored to run inside a host that compiled the definition elsewhere); it
 * MIRRORS the documented `parameterSchemaSpecToJsonSchema` law (core/tools
 * schema.ts @639ed01539) — every divergence found against the compiled
 * product must be fixed HERE, never accepted.
 */
function liftAuthoredNode(node) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return node
  const out = {}
  const required = []
  for (const [key, value] of Object.entries(node)) {
    if (key === 'required' && value === true) continue
    if (key === 'properties' && value !== null && typeof value === 'object') {
      const props = {}
      for (const [name, child] of Object.entries(value)) {
        props[name] = liftAuthoredNode(child)
        if (child !== null && typeof child === 'object' && child.required === true) required.push(name)
      }
      out.properties = props
      continue
    }
    if (key === 'items') {
      out.items = liftAuthoredNode(value)
      continue
    }
    if ((key === 'oneOf' || key === 'anyOf' || key === 'allOf') && Array.isArray(value)) {
      out[key] = value.map(liftAuthoredNode)
      continue
    }
    out[key] = value
  }
  if (required.length > 0) out.required = required
  return out
}

/**
 * The canonical registration face of a CAPTURED native definition.
 *
 * LAW (root final ruling, @639ed01539): the host defineTool TRANSFORMS the
 * authored parameters — property-level `required: true` markers are lifted
 * into parent `required` arrays — and the TRANSFORMED product IS the
 * registration face. This function therefore does NOT re-lift: a capture that
 * already IS the compiled product (the host lift is IDEMPOTENT on it) is
 * CARRIED VERBATIM — node structure deep-copied, nothing re-derived — with
 * the closed-surface keys projected in CANONICAL ORDER (type, properties,
 * required, additionalProperties:false) from the compiled `properties`.
 * Parameter keys come from the compiled `properties` map ONLY — never from
 * Object.keys of the whole schema.
 *
 * The COMPILED test is the authoritative one, not a marker sniff: run the
 * mirror lift one level over the candidate's own children and require a
 * FIXED POINT (the host lift, once applied, never moves again — see
 * `isCompiledParameterLift`). A capture with a smuggled marker anywhere fails
 * idempotence and takes the AUTHORED path, where the marker law is enforced:
 * property-level `required: true` is stripped and collected into the parent's
 * `required` array, never carried into a registration face. The SPEC pins the
 * whole contract against the REAL defineTool product. `additionalProperties:
 * false` states the governed row's closed-surface law (the arm's
 * UNKNOWN_PARAMETER edge enforces the same surface from the same capture).
 */
export function g3CanonicalRegistrationFace(parameters) {
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new TypeError('g3-fsproc-adapters: g3CanonicalRegistrationFace takes the captured definition parameter spec (authored or compiled) object')
  }
  if (isCompiledParameterLift(parameters)) {
    // CARRY the compiled lift: copy properties verbatim (deep), project the
    // closed keys in canonical order; `type` and `required` ride as-is.
    const carried = {}
    for (const [name, child] of Object.entries(parameters.properties)) carried[name] = JSON.parse(JSON.stringify(child))
    const face = { type: 'object', properties: carried }
    if (Array.isArray(parameters.required)) face.required = [...parameters.required]
    face.additionalProperties = false
    return deepFreeze(face)
  }
  // AUTHORED shape (or anything not a compiled fixed point): derive via the
  // mirror walk — the marker law runs here and STRIPS every property-level
  // `required: true`, so a smuggled marker never survives into a face. A
  // compiled ENVELOPE (type:'object' + properties map) that failed the
  // compiled test is tampered/forged input: its parameters are the `properties`
  // map ONLY (parameter keys come from parameter entries, never from
  // Object.keys of a schema envelope), with authored marker semantics applied
  // inside the map and the parent `required` list honored.
  const props = {}
  const required = []
  if (hasCompiledEnvelope(parameters)) {
    for (const [name, spec] of Object.entries(parameters.properties)) {
      props[name] = liftAuthoredNode(spec)
      if (spec !== null && typeof spec === 'object' && spec.required === true) required.push(name)
    }
    if (Array.isArray(parameters.required)) {
      for (const key of parameters.required) {
        if (typeof key === 'string' && Object.hasOwn(props, key) && !required.includes(key)) required.push(key)
      }
    }
    const carriedFace = { type: 'object', properties: props }
    if (required.length > 0) carriedFace.required = required
    carriedFace.additionalProperties = false
    return deepFreeze(carriedFace)
  }
  for (const [name, spec] of Object.entries(parameters)) {
    props[name] = liftAuthoredNode(spec)
    if (spec !== null && typeof spec === 'object' && spec.required === true) required.push(name)
  }
  const face = { type: 'object', properties: props }
  if (required.length > 0) face.required = required
  face.additionalProperties = false
  return deepFreeze(face)
}

/** True when the capture is shaped as a compiled JSON Schema ENVELOPE
 *  (type:'object' + properties map): parameter keys live in `properties`. */
/**
 * THE parameter-entry map of a captured definition (root ruling 66a521):
 * production classify runs over the REAL defineTool PRODUCT — a compiled
 * {type:'object',properties,required} whose parameter keys live in
 * `properties` (envelope keys are NEVER parameters, and Object.keys of the
 * whole schema would answer exactly that envelope). A capture is treated as
 * compiled when it is envelope-shaped AND every property is a fixed point of
 * the host lift (the same authoritative test the face derivation uses);
 * authored captures keep their own top-level keys. ONE law, used by the
 * closed surface, the required law, and the face — they can never disagree.
 */
function g3ParameterEntries(parameters) {
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) return {}
  // THE SAME authoritative compiled test the face uses (whole-envelope fixed
  // point) — surface, required law, and face can never disagree.
  if (isCompiledParameterLift(parameters)) return parameters.properties
  // Compiled ENVELOPE that failed the fixed point (tampered/forged capture):
  // parameters still live in `properties` — envelope keys are never
  // parameters — authored markers inside get authored semantics (face law).
  if (hasCompiledEnvelope(parameters)) return parameters.properties
  return parameters
}

/** REQUIRED names per the captured definition: the compiled product's closed
 *  `required` array, else the authored map's property-level markers. */
function g3RequiredParameterNames(parameters) {
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) return []
  if (hasCompiledEnvelope(parameters)) {
    return Array.isArray(parameters.required) ? parameters.required.filter((k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(parameters.properties ?? {}, k)) : []
  }
  return Object.entries(parameters)
    .filter(([, v]) => v !== null && typeof v === 'object' && v.required === true)
    .map(([k]) => k)
}

function hasCompiledEnvelope(parameters) {
  return parameters.type === 'object'
    && parameters.properties !== null
    && typeof parameters.properties === 'object'
    && !Array.isArray(parameters.properties)
}

/**
 * Authoritative COMPILED test: `candidate` is the host's compiled parameters
 * shape exactly when the mirror lift is a FIXED POINT on its children:
 * `liftAuthoredNode(properties[k])` deep-equals `properties[k]` for every k,
 * under the closed structural law below. The host lift is idempotent on its
 * own product (the spec pins this against the REAL defineTool output), so
 * this test recognizes compiled captures without trusting a marker sniff:
 * a smuggled property-level marker breaks the fixed point and the capture
 * takes the authored path, where the marker is STRIPPED, not nested.
 */
function isCompiledParameterLift(candidate) {
  if (candidate.type !== 'object') return false
  const properties = candidate.properties
  if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) return false
  if (candidate.required !== undefined && !isClosedRequiredList(candidate.required, properties)) return false
  // The compiled envelope is CLOSED: the host lift emits exactly
  // type/properties/required and the authored DSL never carries a top-level
  // `additionalProperties`. Any foreign key (a forged closed-surface flag, an
  // annotation, a smuggled sibling) fails the test HERE — the capture then
  // takes the authored path, where the marker law and the schema-key guard
  // enforce themselves.
  for (const key of Object.keys(candidate)) {
    if (key !== 'type' && key !== 'properties' && key !== 'required') return false
  }
  for (const child of Object.values(properties)) {
    if (!isCompiledSchemaNode(child)) return false
    if (!deepJsonEqual(liftAuthoredNode(child), child)) return false
  }
  return true
}

/** True for a closed JSON Schema node under the host's supported subset:
 *  no property-level `required: true` marker anywhere, object `properties`
 *  values and `items`/branch members obey the same law, and a present
 *  `required` is a string array naming only declared properties. (A legal
 *  compiled sibling may still carry `required: true` INSIDE its own
 *  oneOf/anyOf branch members — compiled branches are themselves compiled
 *  object schemas, so the recursion applies there too.) */
function isCompiledSchemaNode(node) {
  if (node === null) return false
  if (typeof node === 'boolean') return true
  if (typeof node !== 'object' || Array.isArray(node)) return false
  if (node.required === true) return false
  if (node.required !== undefined) {
    if (!Array.isArray(node.required) || node.required.some((k) => typeof k !== 'string')) return false
    const declared = node.properties
    if (declared !== undefined && declared !== null && typeof declared === 'object' && !Array.isArray(declared)) {
      if (!node.required.every((k) => Object.hasOwn(declared, k))) return false
    }
  }
  if (node.properties !== undefined) {
    if (node.properties === null || typeof node.properties !== 'object' || Array.isArray(node.properties)) return false
    for (const child of Object.values(node.properties)) if (!isCompiledSchemaNode(child)) return false
  }
  if (node.items !== undefined) {
    if (Array.isArray(node.items)) {
      for (const child of node.items) if (!isCompiledSchemaNode(child)) return false
    } else if (!isCompiledSchemaNode(node.items)) return false
  }
  for (const branch of ['oneOf', 'anyOf', 'allOf']) {
    const list = node[branch]
    if (list !== undefined) {
      if (!Array.isArray(list)) return false
      for (const child of list) if (!isCompiledSchemaNode(child)) return false
    }
  }
  return true
}

/** A compiled parent `required` array: strings, only naming declared props. */
function isClosedRequiredList(required, properties) {
  return Array.isArray(required)
    && required.every((k) => typeof k === 'string' && Object.hasOwn(properties, k))
}

/** Structural JSON deep-equality (order-sensitive for arrays, key-set for
 *  objects) — the fixed-point comparison. */
function deepJsonEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const key of ka) {
    if (!Object.hasOwn(b, key)) return false
    if (!deepJsonEqual(a[key], b[key])) return false
  }
  return true
}

// ── the CONTROL PORT contract (root boundary ruling: real handles, not facts) ─

/**
 * THE DELIVERABLE BOUNDARY (root ruling 2026-10-23, verbatim semantics: the
 * prepare/execute/terminate INTERFACE is not an implementation — the module
 * must name WHERE the real handle comes from, WHO executes, and HOW the real
 * result is awaited/terminated; where no public controlled entry exists, the
 * precise API gap is the deliverable, never a dressed-up fake success):
 *
 *  B-TERMINAL — the REAL controlled entry EXISTS on the pinned host: the
 *  `@deepseek-ai/dsh-terminal` TerminalSessionService (`ctx.terminals`,
 *  lib/types/index.d.ts @639ed01539 — spawn/startSend/read/signal/kill/list,
 *  owner-authorized by the EXACT Agent). The model-facing six tools
 *  (`@deepseek-ai/dsh-tool-terminal` lib/index.js :300/:425/:510/:568/:611/
 *  :636) are that service's face. {@link createHostTerminalControlPort} is
 *  THE adapter over it: prepare = spawn/startSend (the real per-call handle:
 *  TerminalSpawnResult identity / TerminalSendOperation), execute = the
 *  operation's `done` promise (WHO executes: the service's registered
 *  TerminalBackend.spawn process tree; HOW the result is awaited: operation.
 *  done resolves a TerminalSendResult), terminate = service.kill (awaits
 *  quiescent cleanup; true = newly closed, false = already in flight —
 *  answered, never assumed). A background send is the host `ctx.jobs`
 *  JobRegistry's contract (start/kill) — the adapter answers it ONLY when
 *  the integrator supplies the jobs registry; otherwise a typed refusal,
 *  never a fake jobId.
 *
 *  B-LSP — NO public LSP entry EXISTS at the pin: no host LSP service (the
 *  pinned tree has none; the model-facing tool's server is the plugin's own),
 *  and this module's tree owns the assembly seam only
 *  (packages/runtime/sandbox-provider/lsp-assembly.ts: per-realm confined
 *  streaming instances, launcher sha gate, per-member generation). The REAL
 *  handle therefore can only come from an INTEGRATOR assembly adapter over
 *  that seam — and §5.1/§5.2 make that adapter's answers INTERFACE
 *  OBLIGATIONS (see the controlPort.resolveTarget contract): realmId,
 *  workspaceScope, serverIdentity/generation, documentRevision, scope
 *  'inside'|'outside'. Without such an adapter the row is control-plane only:
 *  the arm says so at every word and never claims a handle.
 *
 *  B-PTC — the real executor is the HOST's run_code transport (`createRunCode
 *  Tool` at core/tools/src/ptc.ts, mounted privately at core/tools/src/
 *  index.ts:25; the run driver ptc.ts:697 `runtime.run` under the policy from
 *  `options.resolveSandboxPolicy` ptc.ts:391). NO public entry produces that
 *  handle at 639ed01539 (createRunCodeTool is not exported from the lib; the
 *  ToolRuntime field is private, lib/types/index.d.ts:552), and the EFFECTIVE
 *  envelope is not observable at entry through any public export. The outer
 *  row's budget/envelope obligations are enforced as REAL NUMBERS (below):
 *  null/absent budget or envelope facts REFUSE at classify — an unevidenced
 *  envelope is never a success.
 *
 * The port shape below is what an arm routes; a family without a port is a
 * CONTROL PLANE over the captured body (classify/plan/grant/edge/faithful
 * exec), honest about what it does not own.
 *
 * @typedef {object} G3ControlPort
 * @property {() => Record<string, unknown>} [backend] - terminal: current
 *   backend registration facts (identity/incarnation/envelope).
 * @property {(ownerAgentId: string, sessionId: string) => Record<string, unknown> | null} [session]
 *   - terminal: current session facts (incarnation/status/envelope).
 * @property {(canonical: Record<string, unknown>, exec: Record<string, unknown>)
 *   => Promise<{ ok: true, handle: G3Handle } | { ok: false, code: string, detail: string } | { ok: false, answer: Record<string, unknown> } | null> [prepare]
 *   - THE real handle entry (open/spawn/startSend/send; lsp resolve; ptc
 *   admit). `answer` (jobs-style refusal/carry) routes verbatim, never
 *   re-executed. Absent/null = no real handle route.
 * @property {(canonical: Record<string, unknown>) => (h: G3Handle | null) => Record<string, unknown> | null} [drift]
 *   - optional same-tick target re-verify between prepare and invoke; a
 *   non-null refusal routes as an entry refusal (zero invoke).
 * @property {(handle: G3Handle, reason: string) => Promise<Record<string, unknown>> | Record<string, unknown>} [terminate]
 *   - THE real terminate/control face for an in-flight or live handle
 *   (service.kill / operation.cancel); its ANSWER is the word.
 * @property {(ownerAgentId: string) => Array<Record<string, unknown>>} [liveHandles]
 *   - optional live inventory for drain/inFlight honesty (never invented).
 *
 * @typedef {object} G3Handle
 * @property {(execSnapshot: Record<string, unknown>) => unknown|Promise<unknown>} invoke
 *   - WHO executes and HOW the real result is awaited.
 * @property {Record<string, unknown>} [identity] - handle-owned identity
 *   facts (sessionId/pid/incarnation/jobId/waitReason) recorded for
 *   inFlight/drain — from the real service answer, never from claims.
 * @property {(reason: string) => Promise<Record<string, unknown>>|Record<string, unknown>} [terminate]
 */

/**
 * THE terminal control-port adapter over the REAL host entry (root boundary
 * ruling + root 66a521 correction: a runnable NARROW port over the pinned
 * 639 types — the entry is `@deepseek-ai/dsh-terminal` TerminalSessionService
 * @639ed01539, the same service the mounted model tools drive:
 * lib/types/index.d.ts spawn :60 / startSend :76 / read :82 / signal :90 /
 * kill :98 / list :104; every operation is authorized by the EXACT live
 * owner Agent — an id string never substitutes). The integrator supplies the
 * LIVE service (`ctx.terminals`), the live owner Agent resolver, and — for
 * background sends — the `ctx.jobs` JobRegistry (`jobs/jobs` lib types:
 * JobSpec.owner is the branded session id, NEVER omitted — an unowned job is
 * open to any caller; JobHooks = {cancel(reason?):void synchronous,
 * done:Promise<JobOutcome{status:'completed'|'killed'|'failed',detail?}>};
 * JobOutputSource pulls the operation's output into the registry ring;
 * JobRegistry.kill(id, caller, reason) is owner-checked).
 *
 * §5.1 GOVERNANCE SHAPE (root 15:09 route, pinned on the REAL 639 surface):
 * the governed open target is the PER-OPEN CONTROLLED EXECUTION PLAN run by
 * a ONE-SHOT PRIVATE BACKEND registered on the live service — never the
 * public `type` (the type is only a route, never an authorization):
 *  - `deps.terminals.registerBackend(backend)` (terminal/src/index.ts
 *    :125-136) is part of the REQUIRED face: the adapter mints a unique
 *    internal type per open (`dsh-g3-po-<callId>-<n>`, NEVER model-selectable
 *    — undeclared at the classify face by construction) whose one-shot
 *    spawn closure captured the EXACT owner, canonical request, callId and
 *    the approved plan; every verification runs BEFORE the first await; the
 *    disposer deregisters in an OUTER finally regardless of outcome, and
 *    deregistration NEVER terminates (sessions survive the Map removal —
 *    close is the service's awaited-quiescence path only).
 *  - `deps.subprocess` (SubprocessRuntime-shaped) is REQUIRED for opens:
 *    the real launch pins the approved plan into the controlled PTY
 *    capability `spawnTerminal(SubprocessTerminalSpawnSpec)` — terminal
 *    allocation, foreground groups, and awaited WHOLE-SESSION QUIESCENCE
 *    (SubprocessTerminalHandle.terminate) for close. A bare process spawn
 *    is never used; a string claim is never the envelope — the digest is
 *    re-verified against the ACTUAL pinned launch spec.
 *  - `deps.approvedOpenPlan(callId)` (the integrator/CENTER approval seam,
 *    same reader the arm consults at classify/recheck) answers the plan of
 *    record for the claim-time re-read; absent = the classified manifest's
 *    approved plan is the approval of record. Without a plan the open
 *    refuses typed — no public-type fallback spawn, ever. send/read/
 *    signal/kill/list ride the service's EXISTING per-session authorization
 *    (expectOwned: exact-owner object identity; the session identity IS the
 *    per-open handle once published).
 *
 * CANCEL/CLEANUP HONESTY (root 66a521): an effect entered (`spawn` returned,
 * `startSend` started) is an EFFECT ENTRY — after any await the adapter
 * re-checks the live cancel/drain verdict, and a resource that already
 * started is CLEANED UP (service.kill / operation.cancel) and the refusal
 * carries `cleanup` + `effectsStarted:true`. Such a call NEVER claims zero
 * effects. Cancelling an ASYNC send is operation.cancel — NEVER killing the
 * persistent PTY — and its real settle is AWAITED.
 *
 * @param deps.terminals - the live TerminalSessionService face.
 * @param deps.resolveOwner - (exec) => the live Agent (required; the service
 *   authorizes by the EXACT Agent).
 * @param deps.ownerSessionId - (ownerAgentId) => the branded owner SessionId
 *   for jobs specs (required whenever background sends are mounted; the spec
 *   NEVER omits owner — unowned jobs are forbidden here).
 * @param deps.jobs - optional live ctx.jobs JobRegistry (start/kill) for
 *   run_in_background sends; absent = background sends REFUSE typed.
 * @param deps.subprocess - controlled PTY capability answering
 *   spawnTerminal(SubprocessTerminalSpawnSpec) (required for opens; the ONLY
 *   launch path — the approved plan pinned, quiescence awaited on close).
 * @param deps.approvedOpenPlan - optional live reader (callId) =>
 *   { plan, envelopeDigest? } re-read at the one-shot claim; the classified
 *   manifest's plan is the fallback approval of record.
 */
/**
 * THE ONE-SHOT PRIVATE CONTROLLED BACKEND (§5.1, root 15:09 route — pinned
 * on the REAL 639 surface, no fictional seams):
 *   TerminalSessionService.registerBackend(backend) (terminal/src/index.ts
 *   :125-136) keyed by backend.type, disposer removes exactly this object;
 *   service.spawn(owner, {type,...}, signal) (:154-224) captures the backend
 *   by type, MINTS the sessionId itself, and awaits backend.spawn(spec).
 * This provider is minted PER OPEN: a unique internal type the model can
 * never select (undeclared at the classify face by construction) and a
 * one-shot spawn closure capturing the EXACT owner, the canonical request,
 * the callId and the APPROVED controlled execution plan. Before ANY await
 * it verifies: single claim, exact Host-minted sessionId, exact owner
 * object, canonical request match, and that the plan still answers the
 * approved digest — any refusal happens with NOTHING started. The real
 * launch pins the approved plan into the controlled PTY capability
 * (SubprocessRuntime.spawnTerminal, subprocess/src/index.ts:162 — terminal
 * allocation, foreground groups, and WHOLE-SESSION QUIESCENCE behind the
 * awaited terminate()); a bare process spawn is never used. The returned
 * session's close() settles ONLY on the handle's awaited quiescence
 * (SubprocessTerminalHandle.terminate, types.ts: idempotent, every observed
 * session member, nothing in flight after settlement).
 * @returns {{ backend, state, launch, dispose }} — `launch` is the ACTUAL
 * pinned launch spec once (and only once) the effect started; `state` is
 * 'idle' | 'claimed' | 'done' | 'refused' for the claim-once audit.
 */
function createOneShotControlledBackend({ internalType, owner, canonical, callId, approvedPlan, approvedDigest, subprocess, sessionFactory, cleanupErrorClass, onLaunched }) {
  if (subprocess === null || typeof subprocess.spawnTerminal !== 'function') {
    throw new TypeError('g3-fsproc-adapters/createOneShotControlledBackend: a controlled PTY launch capability with spawnTerminal(SubprocessTerminalSpawnSpec) is required — the §5.1 backend spawns ONLY through the restricted process plan, never a bare process')
  }
  const state = { current: 'idle', launch: null, refusal: null }
  const backend = {
    type: internalType,
    spawn: async (spec) => {
      // EVERY verification below runs BEFORE any await: the claim is
      // single-use; the Host-minted id, the owner object and the canonical
      // request must match what was approved; the plan must still answer
      // the approved digest. A refusal here started NOTHING.
      if (state.current !== 'idle') throw new Error(`P_TERM_PLAN_CLAIM_CONSUMED: the per-open one-shot backend for call ${callId} already ${state.current} — a second spawn through a per-open registration is refused before any effect`)
      state.current = 'claimed'
      if (String(spec.sessionId ?? '') !== String(canonical.expectSessionId ?? spec.sessionId ?? '') || typeof spec.sessionId !== 'string' || spec.sessionId.length === 0) {
        state.current = 'refused'
        throw new Error(`P_TERM_OPEN_ID_MISMATCH: the per-open backend answers only the exact Host-minted spawn for call ${callId}`)
      }
      if (spec.owner !== owner) {
        state.current = 'refused'
        throw new Error(`P_TERM_OPEN_OWNER_MISMATCH: the per-open backend is bound to the EXACT approved owner Agent (service law: authorizations compare object identity) — another owner object is refused before any effect`)
      }
      if (spec.type !== internalType || (spec.name ?? undefined) !== (canonical.name ?? undefined) || (spec.cwd ?? undefined) !== (canonical.cwd ?? undefined)) {
        state.current = 'refused'
        throw new Error(`P_TERM_OPEN_REQUEST_DRIFT: the spawn request differs from the canonical request approved for call ${callId} — the one-shot backend executes exactly the approved request, nothing else`)
      }
      spec.signal?.throwIfAborted()
      const now = approvedPlan()
      if (now === 'UNANSWERABLE') {
        state.current = 'refused'
        throw new Error(`P_TERM_OPEN_PLAN_ABSENT: the approval seam cannot answer the controlled open plan for call ${callId} at the claim — the governed entry refuses BEFORE any await; it never spawns behind a plan it cannot verify`)
      }
      const plan = now?.plan ?? null
      const argvSource = plan !== null && Array.isArray(plan.argv) && plan.argv.length > 0 && plan.argv.every((a) => typeof a === 'string' && a.length > 0) ? plan.argv : null
      if (plan === null || (argvSource === null && typeof plan.executable !== 'string')
        || typeof plan.cwd !== 'string' || plan.cwd.length === 0
        || !Number.isInteger(plan.rows) || plan.rows <= 0 || !Number.isInteger(plan.cols) || plan.cols <= 0
        || !Number.isInteger(plan.graceMs) || plan.graceMs < 0
        || approvedOpenPlanDigest(plan, canonical) !== approvedDigest) {
        state.current = 'refused'
        throw new Error(`P_TERM_OPEN_PLAN_MOVED: the approved controlled open plan for call ${callId} moved or is incomplete at the claim — the one-shot backend executes the APPROVED plan or nothing (zero effect, before any await)`)
      }
      // THE REAL SESSION CAPABILITY (root 16:2x problem 4): the controlled
      // handle must be carried by the REAL fixed-Host session class — the
      // pinned 639 terminal-bash session class lives at src/session.ts:237
      // (LocalPtySession; export map reaches ./src/*, production supply of
      // that path unverified by this lane; construction needs a VALIDATED
      // complete ResolvedConfig) whose initialize() gates readiness and whose
      // startSend/readOutput/cancel/read/signal/status/close ARE the send,
      // readiness and scrollback law. An adapter-side shim would FABRICATE
      // that law (done-at-exit instead of done-at-readiness, fake wait
      // reasons, invented page math), so a mount without the injected real
      // factory refuses HERE, before any effect — naming the seam.
      if (typeof sessionFactory !== 'function') {
        state.current = 'refused'
        throw new Error(`P_TERM_OPEN_SESSION_CAPABILITY_ABSENT: the per-open launch for call ${callId} refuses BEFORE any effect — the controlled handle must be wrapped by the REAL session capability (pinned 639 terminal-bash src/session.ts:237 LocalPtySession with a VALIDATED complete ResolvedConfig; initialize() gates readiness); deps.sessionFactory is absent on this mount and no adapter shim substitutes for it`)
      }
      // THE ENVELOPE OF RECORD IS THE CANONICAL PLAN: exactly the shape the
      // approved digest covers (normalize BEFORE digest/spawn — root 16:2x
      // problem 1: no post-digest cwd override, no null->'dumb' default
      // applied after approval).
      const canonicalPlanFacts = canonicalOpenPlan(plan, canonical)
      const launchSpec = Object.freeze({
        ...canonicalPlanFacts,
        argv: Object.freeze([...canonicalPlanFacts.argv]),
        // env is UNIFIED (root 4fdaf review 1): canonicalOpenPlan omits an
        // absent/nullish env, so a missing key must behave EXACTLY like
        // null here — a strict === null test let undefined materialize
        // env:{} into the launch spec and diverge from the digest again.
        ...(canonicalPlanFacts.env === undefined || canonicalPlanFacts.env === null ? {} : { env: Object.freeze({ ...canonicalPlanFacts.env }) }),
        ...(spec.signal === undefined ? {} : { signal: spec.signal }),
      })
      state.launch = launchSpec
      const handle = await subprocess.spawnTerminal(launchSpec)
      // THE EFFECT BOUNDARY, OBSERVABLE: the launch is recorded once the
      // controlled capability has ANSWERED with a live handle — cancel at
      // an un-answered launch cleans NOTHING speculatively (the provider
      // owns its pre-answer rollback); cancel after the answer follows the
      // cleanup law on the started resource.
      if (typeof onLaunched === 'function') onLaunched(launchSpec)
      // THE REAL SESSION CAPABILITY, REUSED: sessionFactory is the
      // integrator-injected REAL class — the pinned 639 session lives at
      // terminal-bash src/session.ts:237 (LocalPtySession; the package
      // export map reaches ./src/*, but the PRODUCTION supply of that
      // path is unverified here), constructed with a VALIDATED complete
      // ResolvedConfig (validateConfig law — not an empty object claiming
      // materialized defaults). Its initialize() IS the startup readiness
      // law. Failure cleanup follows the REAL rejectAfterStartupCleanup
      // law (terminal-bash index.ts:174-180/219-228): a NOT-CONSTRUCTED
      // resource cleans through provider terminate, a CONSTRUCTED one
      // through session.close (which owns quiescence); both are AWAITED,
      // and a cleanup FAILURE is propagated together with the original
      // failure (the TerminalBackendCleanupError law) — never a claimed
      // quiescence over a swallowed rejection.
      let session
      try {
        session = await sessionFactory(handle, launchSpec)
      } catch (error) {
        const original = String(error?.message ?? error)
        try {
          await handle.terminate()
        } catch (cleanupError) {
          // THE REAL CLASS CARRIES BOTH ERRORS (root 414): the service's
          // instanceof TerminalBackendCleanupError law keeps the cleanup
          // fact through release() and answers the outer caller.
          throw new cleanupErrorClass(error, cleanupError)
        }
        throw new Error(`P_TERM_OPEN_STARTUP_FAILED: the REAL session capability refused to construct for call ${callId} before publication (${original}) — the unpublished handle was TERMINATED AND AWAITED to quiescence; zero published effect, zero session`)
      }
      try {
        if (typeof session?.initialize === 'function') await session.initialize(spec.signal)
      } catch (error) {
        const original = String(error?.message ?? error)
        try {
          await session.close('PTY startup failed')
        } catch (cleanupError) {
          // THE REAL CLASS CARRIES BOTH ERRORS (root 414): the service's
          // instanceof TerminalBackendCleanupError law keeps the cleanup
          // fact through release() and answers the outer caller.
          throw new cleanupErrorClass(error, cleanupError)
        }
        throw new Error(`P_TERM_OPEN_STARTUP_FAILED: startup readiness failed for call ${callId} (${original}) — the CONSTRUCTED session was closed through its own close() and AWAITED to quiescence before this refusal; zero published effect, zero session`)
      }
      return session
    },
  }
  // state is BACKEND-LOCAL on purpose: the claim-once law runs inside
  // spawn itself (a second spawn through a per-open registration meets
  // P_TERM_PLAN_CLAIM_CONSUMED before any effect) — no external reader
  void state
  return { backend, state }
}

export function createHostTerminalControlPort(deps) {
  const terminals = deps?.terminals
  const terminalMethods = ['spawn', 'startSend', 'read', 'signal', 'kill', 'list', 'registerBackend']
  if (terminals === null || typeof terminals !== 'object' || terminalMethods.some((m) => typeof terminals[m] !== 'function')) {
    throw new TypeError('g3-fsproc-adapters/createHostTerminalControlPort: deps.terminals must be the live @deepseek-ai/dsh-terminal service face (spawn/startSend/read/signal/kill/list/registerBackend — registerBackend is REQUIRED for opens: §5.1 governs through the per-open one-shot registration, and the public-type-only path is not the governed entry) — the adapter names the entry, it does not simulate it')
  }
  if (typeof deps.resolveOwner !== 'function') {
    throw new TypeError('g3-fsproc-adapters/createHostTerminalControlPort: deps.resolveOwner(exec) => live Agent is required — the service authorizes by the EXACT Agent; an id string never substitutes')
  }
  const jobs = deps.jobs ?? null
  if (jobs !== null && (typeof jobs.start !== 'function' || typeof jobs.kill !== 'function')) {
    throw new TypeError('g3-fsproc-adapters/createHostTerminalControlPort: deps.jobs must be the live ctx.jobs JobRegistry face (start/kill) when supplied')
  }
  if (jobs !== null && typeof deps.ownerSessionId !== 'function') {
    throw new TypeError('g3-fsproc-adapters/createHostTerminalControlPort: deps.ownerSessionId(ownerAgentId) is required when jobs are supplied — JobSpec.owner is never omitted (an unowned job is open to any caller)')
  }
  // THE controlled PTY launch capability (SubprocessRuntime-shaped, the
  // integrator supplies the restricted execution world): the one-shot
  // per-open backend spawns ONLY through spawnTerminal(SubprocessTerminal
  // SpawnSpec) — terminal allocation, foreground groups and awaited
  // whole-session quiescence. A bare process spawn is never used.
  const subprocess = deps.subprocess ?? null
  const sessionFactory = deps.sessionFactory ?? null
  if (sessionFactory !== null && typeof sessionFactory !== 'function') {
    throw new TypeError('g3-fsproc-adapters/createHostTerminalControlPort: deps.sessionFactory must be the REAL session factory (pinned 639 terminal-bash LocalPtySession wrapper) or absent')
  }
  // THE REAL CLEANUP-ERROR CLASS (root 414 review): startup+cleanup failures
  // must ride the PUBLIC pinned-639 TerminalBackendCleanupError
  // (terminal/src/types.ts:17-27, an AggregateError carrying spawnError +
  // cleanupError). The REAL TerminalSessionService.spawn catch (index.ts:
  // 197-199) tests `error instanceof TerminalBackendCleanupError` to keep
  // the cleanup fact through spawnReservation.release(cleanupFailure)
  // (index.ts:221) — a plain Error LOSES that fact (release(undefined)).
  // No duck class, no parallel error system: the integrator injects the
  // SAME class object the service itself imports, so instanceof is exact.
  const cleanupErrorClass = deps.TerminalBackendCleanupError ?? null
  if (cleanupErrorClass !== null && typeof cleanupErrorClass !== 'function') {
    throw new TypeError('g3-fsproc-adapters/createHostTerminalControlPort: deps.TerminalBackendCleanupError must be the REAL pinned-639 class (terminal/src/types.ts:17-27) or absent — never a duck-typed substitute')
  }
  if (subprocess !== null && typeof subprocess.spawnTerminal !== 'function') {
    throw new TypeError('g3-fsproc-adapters/createHostTerminalControlPort: deps.subprocess must answer spawnTerminal(SubprocessTerminalSpawnSpec) (the controlled PTY capability) or be absent')
  }
  // live re-read seam for the approved plan at claim time (same provider
  // the arm's classify/recheck consults; absent = the classified manifest
  // plan is the approval of record)
  const serviceApprovedPlan = typeof deps.approvedOpenPlan === 'function' ? deps.approvedOpenPlan : null
  let openSequence = 0
  /** the ACTUAL pinned launch specs, keyed by callId (envelope of record:
   *  what was handed to the controlled capability, not what was claimed) */
  const launchedByCall = new Map()
  const ownerOrRefusal = (exec) => {
    const owner = deps.resolveOwner(exec)
    if (owner === null || owner === undefined) {
      return { refusal: { ok: false, code: 'P_TERM_PORT_OWNER_UNRESOLVED', detail: 'the control-port adapter cannot answer the live owner Agent for this call: the terminals service authorizes by the EXACT Agent, and the adapter never guesses one' } }
    }
    return { owner }
  }
  /** THE real kill: awaits quiescent cleanup; the service answer (true =
   *  newly closed, false = same close already in flight) is forwarded. */
  /** the branded owner SessionId reader (JobSpec.owner / owner-checked kill) */
  const ownerSessionId = deps.ownerSessionId
  const killSession = async (owner, sessionId, reason) =>
    (await terminals.kill(owner, sessionId, ...(reason === undefined ? [] : [reason]))) === true
      ? 'closed'
      : 'already-closing'
  const nativeSessionStatus = (v) => {
    if (v !== null && typeof v === 'object' && typeof v.kind === 'string') return v
    return { kind: String(v ?? 'running') }
  }
  const asPort = {
    name: 'dsh-terminal:ctx.terminals',
    async prepare(spec) {
      const { owner, refusal } = ownerOrRefusal(spec.exec)
      if (refusal !== undefined) return refusal
      const canonical = spec.canonical ?? {}
      const cancelled = () => typeof spec.isCancelled === 'function' && spec.isCancelled() === true
      /** THE CLEANUP FACE (root 66a521): a resource that started before a
       *  governance refusal is killed through the service and the refusal
       *  reports the cleanup truth — effectsStarted is never hidden. */
      const cleanupOwned = async (owned, detail) => {
        const sid = String(owned?.sessionId ?? '')
        if (sid.length === 0) {
          return refusePort('P_TERM_CLEANUP_UNOWNED', `governance refused after the open started but the provider answered no ownedResource sessionId — the adapter cannot clean what it cannot own (${detail})`)
        }
        try {
          const outcome = await killSession(owner, sid)
          return { started: true, sessionId: sid, outcome }
        } catch (error) {
          return { started: true, sessionId: sid, outcome: 'cleanup-failed', detail: String(error?.message ?? error) }
        }
      }
      const record = (resource) => {
        if (resource !== null && resource !== undefined && typeof spec.recordStarted === 'function') {
          try { spec.recordStarted(resource) } catch { /* the register is best-effort observability */ }
        }
      }
      /** CANCEL BEFORE ANY EFFECT (root ruling 66a521 boundary): between the
       *  prepare entry and the real start there is a synchronous window —
       *  cancel/drain landing there is answered HONESTLY AS ZERO EFFECTS.
       *  The after-effect refusal belongs ONLY to a resource that actually
       *  STARTED; never invent it for a window the provider never entered. */
      const cancelledBeforeEffect = () => cancelled()
        ? { zeroEffects: true, code: 'P_TERM_CANCELLED_BEFORE_EFFECT', detail: 'cancel/drain moved BEFORE any real effect started (the provider was never entered / no operation started): zero body, zero resource — the honest zero-effect word, never dressed as an after-effect refusal' }
        : null
      const refusalAfterEffects = async (owned, code, detail) => {
        const cleanup = await cleanupOwned(owned, detail)
        return { ok: false, answer: { refused: true, effectsStarted: true, code, detail, cleanup } }
      }
      /** CURRENT-FACTS re-check after an await (root 66a521): the arm's live
       *  target recheck rides the prepare spec; a move refuses AND cleans. */
      const factsMoved = () => {
        const r = typeof spec.recheckFacts === 'function' ? spec.recheckFacts() : null
        return r !== null && r !== undefined && r.ok === false ? r : null
      }
      if (spec.toolName === 'terminal_open') {
        // §5.1 REAL ROUTE (root 15:09): the open runs through a PER-OPEN
        // ONE-SHOT PRIVATE BACKEND registered on the live service
        // (registerBackend → disposer @terminal index 125-136) under a
        // unique internal type the model can never select, whose spawn
        // closure captured the exact owner, the canonical request, the
        // callId and the APPROVED controlled execution plan. Registration
        // removal (the disposer) NEVER terminates the session — close is
        // the service's awaited quiescence path; the spawn effect itself
        // goes ONLY through the controlled SubprocessRuntime.spawnTerminal
        // capability with the plan pinned.
        const approved = spec.manifest?.perOpenBackend ?? null
        if (approved === null || typeof approved !== 'object' || approved.approvedPlan === undefined) {
          return { ok: false, code: 'P_TERM_TARGET_UNRESOLVED', detail: 'terminal_open carries no approved controlled open plan on its classified manifest: the governed entry refuses rather than spawning the public type' }
        }
        if (subprocess === null) {
          return { ok: false, code: 'P_TERM_OPEN_CAPABILITY_ABSENT', detail: 'the per-open controlled backend spawns ONLY through the restricted process plan on the controlled PTY capability (SubprocessRuntime.spawnTerminal: terminal allocation, foreground groups, awaited whole-session quiescence) — deps.subprocess is absent on this mount, and a bare process spawn is never substituted' }
        }
        if (sessionFactory === null || cleanupErrorClass === null) {
          return { ok: false, code: 'P_TERM_OPEN_SESSION_CAPABILITY_ABSENT', detail: 'the per-open controlled handle must be carried by the REAL fixed-Host session capability (pinned 639 terminal-bash src/session.ts:237 LocalPtySession, constructed with a VALIDATED complete ResolvedConfig — the export map reaches ./src/* but production supply of that path is unverified by this lane; initialize() gates startup readiness and its startSend/readOutput/cancel/read/signal/status/close ARE the send, readiness and scrollback law) — deps.sessionFactory and/or deps.TerminalBackendCleanupError is absent on this mount (the REAL service relies on the instanceof law — a plain Error would drop the cleanup fact at spawnReservation.release) and no adapter-side shim or duck class is substituted (a shim would fabricate the law: done-at-exit instead of done-at-readiness, invented wait reasons, invented page math); refused BEFORE any effect, zero spawn, zero resource' }
        }
        openSequence += 1
        const internalType = `dsh-g3-po-${String(spec.callId)}-${openSequence}`
        const approvedDigest = String(approved.envelopeDigest ?? '')
        const { backend } = createOneShotControlledBackend({
          sessionFactory,
          cleanupErrorClass,
          internalType,
          owner,
          canonical: {
            ...(typeof canonical.name === 'string' && canonical.name.length > 0 ? { name: canonical.name } : {}),
            ...(typeof canonical.cwd === 'string' && canonical.cwd.length > 0 ? { cwd: canonical.cwd } : {}),
          },
          callId: String(spec.callId),
          approvedPlan: () => (serviceApprovedPlan === null
            ? { plan: approved.approvedPlan, envelopeDigest: approvedDigest }
            : (serviceApprovedPlan(spec.callId) ?? 'UNANSWERABLE')),
          approvedDigest,
          subprocess,
          onLaunched: (launchSpec) => { launchedByCall.set(String(spec.callId), launchSpec) },
        })
        let disposer = null
        try {
          // register FIRST (type-route only — authorization lives in the
          // one-shot closure's pre-await verification and the service's
          // exact-owner law); the OUTER finally below deregisters
          // regardless of outcome — 注销不等终止, disposal never waits on
          // (or performs) termination.
          disposer = terminals.registerBackend(backend)
          {
            const preCancel = cancelledBeforeEffect()
            if (preCancel !== null) return preCancel
          }
          const spawned = await terminals.spawn(owner, {
            type: internalType,
            ...(typeof canonical.name === 'string' && canonical.name.length > 0 ? { name: canonical.name } : {}),
            ...(typeof canonical.cwd === 'string' && canonical.cwd.length > 0 ? { cwd: canonical.cwd } : {}),
          })
          if (spawned === null || typeof spawned !== 'object' || typeof spawned.sessionId !== 'string') {
            return { ok: false, code: 'P_TERM_TARGET_UNRESOLVED', detail: 'the terminals service did not answer a published session for the per-open spawn' }
          }
          // THE effect started: re-check cancel/drain AFTER the await. A move
          // refuses here and CLEANUP the started resource — never zero effects.
          record({ sessionId: spawned.sessionId, __kind: 'open-session' })
          if (cancelled()) {
            return refusalAfterEffects({ sessionId: spawned.sessionId }, 'P_TERM_CANCELLED_AFTER_EFFECT', 'cancel/drain moved after the per-open backend spawn started: the started resource was cleaned through the service (cleanup truth attached); this call NEVER claims zero effects')
          }
          const openDrift = factsMoved()
          if (openDrift !== null) {
            if (cancelled()) {
              const cleanup = await cleanupOwned({ sessionId: spawned.sessionId }, 'cancel moved after the per-open backend spawn started')
              const edge = new Error('cancelled after a started effect')
              edge.a5Edge = 'CANCELLED-AFTER-EFFECT'
              edge.a5Cleanup = cleanup
              throw edge
            }
            return refusalAfterEffects({ sessionId: spawned.sessionId }, openDrift.code ?? 'P_TERM_TARGET_DRIFT', `current target facts moved after the per-open backend spawn started (${openDrift.detail ?? 'recheck refused'}): the started resource was cleaned through the service — effects started, this call refuses with the cleanup truth, never a zero-effect word`)
          }
          // envelope-of-record check (root 15:09: the envelope is the ACTUAL
          // executed plan): the digest of the spec that reached the
          // controlled capability must equal the approved digest.
          // signal and the per-open env overlay (the caller's session world)
          // are OUTSIDE the approved envelope by law: the comparison pins
          // the ENVELOPE facts (argv, env, dims, grace), never the routing
          // extras the capability spec carries in addition.
          const launched = launchedByCall.get(String(spec.callId)) ?? null
          if (launched !== null && approvedDigest.length > 0 && approvedOpenPlanDigest(launched, canonical) !== approvedDigest) {
            return refusalAfterEffects({ sessionId: spawned.sessionId }, 'P_TERM_OPEN_ENVELOPE_DRIFT', `the ACTUAL pinned launch spec deviates from the approved envelope (${approvedDigest} -> ${approvedOpenPlanDigest(launched, canonical)}): the session was cleaned through the service — effects started, never a zero-effect word`)
          }
          // NATIVE result fields ride VERBATIM (sessionId/kind-bearing status/
          // pid/type/motd) — native-shaped pass-through, not a re-shape.
          // the published session's `type` is the INTERNAL per-open route —
          // it is a service fact (the caller asked by name/type and the
          // service answered through its own registration), not a model
          // claim: it rides verbatim. The model never learns or selects it.
          const result = { ...spawned, type: String(canonical.type ?? spawned.type) }
          return {
            ok: true,
            handle: {
              identity: {
                sessionId: String(result.sessionId ?? ''),
                pid: result.pid ?? null,
                status: nativeSessionStatus(result.status),
              },
              invoke: async () => ({
                outcome: 'opened',
                sessionId: result.sessionId,
                ...(result.name !== undefined ? { name: result.name } : {}),
                type: result.type,
                pid: result.pid,
                status: nativeSessionStatus(result.status),
                motd: typeof result.motd === 'string' ? result.motd : '',
              }),
            },
          }
        } catch (error) {
          // The one-shot backend's PRE-AWAIT refusals (claim consumed, id/
          // owner/request drift, plan moved) and the pre-launch window
          // started NOTHING: they surface as typed zero-effect refusals.
          // Anything that DID start a session went through the paths above
          // with their cleanup truth — this catch never dresses a started
          // effect as zero.
          const message = String(error?.message ?? error)
          // STARTUP FAILURE IS NOT ZERO-EFFECT: the controlled spawn STARTED
          // (an effect happened); the real startup law cleans the
          // UNPUBLISHED handle to awaited quiescence BEFORE publication, so
          // nothing was ever ownable — but the honesty law names the
          // started-and-cleaned truth, never a zero-effect word.
          // THE REAL SERVICE SHAPE: a cleanup failure arrives as the PUBLIC
          // pinned-639 TerminalBackendCleanupError (AggregateError: fixed
          // message, errors [spawnError, cleanupError]) that crossed the
          // service's own instanceof law and its release(cleanupFailure) —
          // the outer reply names BOTH errors from the aggregate itself.
          if (cleanupErrorClass !== null && error instanceof cleanupErrorClass) {
            const spawnMsg = String(error.spawnError?.message ?? error.errors?.[0]?.message ?? error)
            const cleanupMsg = String(error.cleanupError?.message ?? error.errors?.[1]?.message ?? 'unknown')
            return { ok: false, code: 'P_TERM_OPEN_STARTUP_CLEANUP_FAILED', detail: `the REAL TerminalBackendCleanupError crossed the fixed-639 service (terminal/src/types.ts:17-27; service index.ts:197-199/221 kept the cleanup fact through release): startup failure (${spawnMsg}) AND cleanup failure (${cleanupMsg}) — started-and-CLEANUP-FAILED: cleanup did NOT reach quiescence, resources may remain and need operator attention; the port claims NO quiescence, NO zero-effect word, and no retry-suppression` }
          }
          if (message.startsWith('P_TERM_OPEN_STARTUP_FAILED:')) {
            return { ok: false, code: 'P_TERM_OPEN_STARTUP_FAILED', detail: `${message} — the controlled spawn STARTED and was cleaned to awaited quiescence BEFORE publication (started-and-cleaned, not zero-effect); no session was ever published or ownable` }
          }
          const oneShotRefusal = /^P_TERM_(PLAN_CLAIM_CONSUMED|OPEN_ID_MISMATCH|OPEN_OWNER_MISMATCH|OPEN_REQUEST_DRIFT|OPEN_PLAN_MOVED|OPEN_PLAN_ABSENT|OPEN_SESSION_CAPABILITY_ABSENT):/
          if (oneShotRefusal.test(message)) {
            return { ok: false, code: message.slice(0, message.indexOf(':')), detail: `${message} — refused BEFORE any effect (every verification runs before the first await); zero spawn, zero resource` }
          }
          if (error?.a5Edge !== undefined) throw error
          return { ok: false, code: 'P_TERM_TARGET_UNRESOLVED', detail: `the per-open spawn failed before publication: ${message}` }
        } finally {
          // 注销不等终止: the disposer removes ONLY the type-route Map entry
          // (service law) — it never terminates the session and never waits
          // on termination. The outer finally deregisters regardless of
          // outcome.
          if (disposer !== null) { try { disposer() } catch { /* route already replaced — the disposer is idempotent by object identity */ } }
        }
      }
      if (spec.toolName === 'terminal_close') {
        const sessionId = String(canonical.sessionId ?? '')
        return {
          ok: true,
          handle: {
            identity: { sessionId },
            // CARD 4 (close keeps its REAL shape): the word names WHICH
            // session the service closed beside the honest two-valued
            // service answer (kill true = newly closed, false = the same
            // close already in flight — answered, never upgraded).
            invoke: async () => ({ sessionId, outcome: await killSession(owner, sessionId) }),
          },
        }
      }
      if (spec.toolName === 'terminal_read') {
        const sessionId = String(canonical.sessionId ?? '')
        return {
          ok: true,
          handle: {
            identity: { sessionId },
            invoke: async () => terminals.read(owner, sessionId, {
              ...(typeof canonical.offset === 'number' ? { offset: canonical.offset } : {}),
              ...(typeof canonical.count === 'number' ? { count: canonical.count } : {}),
            }),
          },
        }
      }
      if (spec.toolName === 'terminal_signal') {
        const sessionId = String(canonical.sessionId ?? '')
        return {
          ok: true,
          handle: {
            identity: { sessionId },
            invoke: async () => terminals.signal(owner, sessionId, String(canonical.signal ?? '')),
          },
        }
      }
      if (spec.toolName === 'terminal_list') {
        return { ok: true, handle: { identity: {}, invoke: async () => terminals.list(owner) } }
      }
      if (spec.toolName === 'terminal_send') {
        const sessionId = String(canonical.sessionId ?? '')
        if (canonical.run_in_background === true) {
          // A background send is the HOST jobs contract. Owner is NEVER
          // omitted (unowned jobs are open to any caller); hooks carry
          // cancel(reason) synchronous + eventually-settling done; the
          // operation output rides an output source into the ring;
          // registry.kill(id, caller, reason) is the owner-checked control.
          if (jobs === null) {
            return { ok: false, code: 'P_TERM_BG_PORT_UNWIRED', detail: 'run_in_background requires the integrator-supplied ctx.jobs JobRegistry on this port: the jobs face owns the background id; without it the send refuses typed (the host tool-terminal mounts the same pair)' }
          }
          const ownerSessionId = deps.ownerSessionId(owner?.id ?? '')
          if (typeof ownerSessionId !== 'string' || ownerSessionId.length === 0) {
            return { ok: false, code: 'P_TERM_BG_OWNER_UNRESOLVED', detail: 'the branded owner SessionId is unresolvable for this member: JobSpec.owner is never omitted — an unowned job is open to any caller, so the background send refuses typed' }
          }
          const sendRequest = { text: String(canonical.text ?? ''), submit: canonical.submit !== false }
          let operation = null
          // The output source ACCUMULATES the operation's consumed deltas
          // (readOutput yields what was produced since the PRIOR call); the
          // JobSourceRead contract is whole-stream offsets (types.d.ts:30).
          let outputBuffer = ''
          let settleResolve = null
          const settlePromise = new Promise((resolve) => { settleResolve = resolve })
          const specOut = {
            kind: 'pty-send',
            // NAMED GAP (refused to fake-close, @639ed01539): the published
            // JobKindMap (jobs/jobs lib types view.d.ts) is the closed merge
            // { bash, subagent } for THIS compiled program — a pty-send
            // producer kind exists only through a JobKindMap declaration
            // merge at an integrator-owned compile, which this UNWIRED
            // module does not own. The view contract carries kind as an
            // open string (a browser bundle / Remote codec sees only its own
            // merged map), so the string rides honestly and the merge point
            // stays a named integrator obligation — never a silently
            // "corrected" kind name.
            label: `g3 terminal_send ${sessionId}`,
            owner: ownerSessionId,
            output: [{
              channel: 'stdout',
              read: (fromByte) => {
                const produced = operation?.readOutput?.() ?? { delta: '', truncated: false }
                if (typeof produced?.delta === 'string' && produced.delta.length > 0) outputBuffer += produced.delta
                return {
                  text: fromByte >= outputBuffer.length ? '' : outputBuffer.slice(fromByte),
                  nextOffset: outputBuffer.length,
                  lossy: produced?.truncated === true,
                }
              },
            }],
            run: (_job) => {
              // THE effect starts inside run() — preflight refusal registers
              // nothing (host law); after run() the job id exists.
              operation = terminals.startSend(owner, sessionId, sendRequest)
              // CARD 5 (root central adjudication — the DISTINCT fact): the
              // real TerminalWaitReason @639ed01539 is exactly
              // 'stdin_read' | 'inferred_idle' | 'timeout' | 'session_exit' —
              // the host NEVER answers waitReason:'cancelled'. Deriving
              // 'killed' from that value overloaded a published field with a
              // fact the real host never answers. Whether this job was
              // cancelled is therefore carried by the DISTINCT
              // cancelRequested fact below — set exactly when JobHooks.cancel
              // ran (the owner-checked registry.kill reaches the job through
              // it) — while the host's own waitReason rides VERBATIM in the
              // detail as the why-the-wait-returned word it actually is.
              let cancelRequested = false
              return {
                // JobHooks.cancel (jobs types.d.ts:102): SYNCHRONOUS,
                // idempotent; the operation (NOT the PTY) is cancelled and
                // `done` settles.
                cancel: (reason) => {
                  cancelRequested = true
                  operation?.cancel(typeof reason === 'string' ? reason : undefined)
                },
                done: operation.done.then(
                  (settled) => {
                    const outcome = {
                      status: cancelRequested ? 'killed' : 'completed',
                      detail: `waitReason: ${String(settled?.waitReason ?? 'unknown')}${cancelRequested ? ' (cancelRequested)' : ''}`,
                      ...(typeof settled?.viewport === 'string' && settled.viewport.length > 0 ? { result: settled.viewport } : {}),
                    }
                    if (settleResolve !== null) settleResolve(outcome)
                    return outcome
                  },
                  (error) => {
                    // CARD 5: a REJECTING operation.done STILL SETTLES the
                    // row. JobHooks.done must not reject — the published
                    // runtime converts a rejection to `failed` (jobs types
                    // .d.ts, JobHooks.done) — so the rejection lands as that
                    // terminal JobOutcome, the awaited settle resolves, and
                    // no accepted job is ever left with an unsettled row.
                    const outcome = {
                      status: cancelRequested ? 'killed' : 'failed',
                      detail: `send operation settle failed: ${String(error?.message ?? error)}${cancelRequested ? ' (cancelRequested)' : ''}`,
                    }
                    if (settleResolve !== null) settleResolve(outcome)
                    return outcome
                  },
                ),
              }
            },
          }
        {
          const preCancel = cancelledBeforeEffect()
          if (preCancel !== null) return preCancel
        }
          const jobId = String(jobs.start(specOut) ?? '')
          record({ __kind: 'job', jobId })
          const stopStartedJob = async (code, detail) => {
            // The job STARTED (id minted, starter ran): cancel through the
            // OWNER-CHECKED control face (kill(id, caller)) and AWAIT the
            // real settle — never zero effects, never an orphan.
            const killAnswer = jobs.kill(jobId, ownerSessionId, code === 'P_TERM_TARGET_DRIFT' ? 'target facts moved after the background send started' : 'cancelled after the background send started')
            const settled = killAnswer === 'requested' ? await settlePromise : null
            return { ok: false, answer: { refused: true, effectsStarted: true, code, detail, cleanup: { started: true, jobId, kill: killAnswer, settled } } }
          }
          if (cancelled()) {
            return stopStartedJob('P_TERM_CANCELLED_AFTER_EFFECT', 'cancel/drain moved after jobs.start minted the job and started the operation: the job was killed through the owner-checked registry.kill(id, caller) and its real settle was awaited')
          }
          const bgDrift = factsMoved()
          if (bgDrift !== null) {
            return stopStartedJob(bgDrift.code ?? 'P_TERM_TARGET_DRIFT', `current target facts moved after jobs.start started the operation (${bgDrift.detail ?? 'recheck refused'}): the job was killed owner-checked and its settle awaited — effects started, never a zero-effect word`)
          }
          return {
            ok: true,
            handle: {
              identity: { jobId, background: true, sessionId },
              // ROOT 580f REVIEW ②: the tool-level background word is the
              // HOST's own kind-tagged shape — tool-terminal src/index.ts
              // :278 @639ed01539 answers `{ kind: 'background', jobId }`.
              // The kind is the real fact, never a generic outcome string.
              invoke: async () => ({ kind: 'background', jobId }),
              // ASYNC TERMINATION AWAITS THE REAL RESULT (root 66a521):
              // registry.kill(id, caller) answers requested | already-finished;
              // 'requested' is followed until the hooks' done outcome settles.
              terminate: async () => {
                const kill = jobs.kill(jobId, ownerSessionId)
                const settled = kill === 'requested' ? await settlePromise : null
                return { kill, settled, note: 'registry.kill(id, caller) answers requested | already-finished; a requested kill is followed to the awaited JobOutcome — the jobs record owns the settlement' }
              },
            },
          }
        }
        // THE real foreground send: startSend → TerminalSendOperation. The
        // effect STARTED at startSend: if governance moved during the async
        // admission the operation is cancelled (NOT the PTY killed — the
        // persistent session survives a cancelled send) and the REAL settle
        // is awaited before the refusal answers.
        {
          const preCancel = cancelledBeforeEffect()
          if (preCancel !== null) return preCancel
        }
        const operation = terminals.startSend(owner, sessionId, {
          text: String(canonical.text ?? ''),
          submit: canonical.submit !== false,
        })
        // THE register carries the OPERATION, not the session: the cancel
        // cleanup law for a send cancels the OPERATION — killing the
        // persistent PTY for a cancelled send is the WRONG face.
        record({ __kind: 'send-operation', operation, sessionId })
        if (cancelled()) {
          operation.cancel()
          const settled = await operation.done
          return { ok: false, answer: { refused: true, effectsStarted: true, code: 'P_TERM_CANCELLED_AFTER_EFFECT', detail: 'cancel/drain moved after startSend started the operation: the operation was cancelled (the persistent PTY is NOT killed by a cancelled send) and its real settle was awaited', cleanup: { started: true, sessionId, settled } } }
        }
        const sendDrift = factsMoved()
        if (sendDrift !== null) {
          operation.cancel()
          const settled = await operation.done
          return { ok: false, answer: { refused: true, effectsStarted: true, code: sendDrift.code ?? 'P_TERM_TARGET_DRIFT', detail: `current target facts moved after startSend started the operation (${sendDrift.detail ?? 'recheck refused'}): the operation was cancelled — NOT the PTY killed — and its real settle was awaited`, cleanup: { started: true, sessionId, settled } } }
        }
        return {
          ok: true,
          handle: {
            identity: { sessionId, exclusiveSend: true },
            // ROOT 580f REVIEW ②: the tool-level foreground word is the
            // HOST's own kind-tagged shape — tool-terminal src/index.ts:283
            // @639ed01539 answers `{ kind: 'foreground', ...TerminalSendResult }`
            // (the awaited real settle spread VERBATIM beside its kind tag).
            invoke: async () => {
              const result = await operation.done
              return { kind: 'foreground', ...(result ?? {}) }
            },
            // CANCELLING AN ASYNC SEND = operation.cancel (SIGINT request);
            // NEVER service.kill of the persistent PTY. The real settle
            // arrives through done — awaited, not narrated.
            terminate: async () => {
              const requested = operation.cancel()
              if (!requested) return { cancelled: false, note: 'operation already settled — cancel answered false' }
              const settled = await operation.done
              return { cancelled: true, settled, note: 'operation.cancel requested SIGINT; the awaited TerminalSendResult is the word (the PTY session survives)' }
            },
          },
        }
      }
      return { ok: false, code: 'P_TERM_PORT_TOOL_UNKNOWN', detail: `the dsh-terminal adapter does not route tool ${JSON.stringify(String(spec.toolName ?? ''))}` }
    },
    /** CURRENT live word for a committed handle (arm cancel ALREADY-COMMITTED
     *  rides this, root 66a521): the SESSION ROW from the service's own list
     *  answer, or an honest unknown — never a synthesized live claim. The
     *  async authoritative face is arm-side terminal_close/terminate. */
    /** THE CANCEL CLEANUP FACE (root ruling 66a521): cancel of an EXECUTING
     *  call cleans the resource STARTED BEHIND THAT CALL through the RIGHT
     *  face — an in-flight send cancels its OPERATION (operation.done
     *  awaited; NEVER terminals.kill on the persistent PTY), a background
     *  job gets an OWNER-CHECKED kill with the JobOutcome awaited, an
     *  unanswered open kills its SESSION. Returns a promise of the truth
     *  (the sync cancel word cannot carry the real settle; the execution
     *  result path reports its own after-effect refusal). */
    cancelCleanup(resource, context) {
      try {
        if (resource?.__kind === 'send-operation') {
          if (typeof resource.operation?.cancel !== 'function') {
            return Promise.resolve({ routed: false, code: 'P_TERM_CLEANUP_FACE_ABSENT', detail: 'the in-flight send operation answers no cancel() — nothing is claimed cleaned' })
          }
          const cancelledNow = resource.operation.cancel(String(context?.reason ?? 'cancelled by the caller before the operation settled')) !== false
          return Promise.resolve(resource.operation.done)
            .then((settled) => ({ routed: true, face: 'operation.cancel', cancelReturned: cancelledNow, settled }))
            .catch((error) => ({ routed: true, face: 'operation.cancel', settled: 'settle-failed', detail: String(error?.message ?? error) }))
        }
        if (resource?.__kind === 'job') {
          if (jobs === null) {
            return Promise.resolve({ routed: false, code: 'P_TERM_BG_PORT_UNWIRED', detail: 'a background job started but the host jobs control face is not wired — the adapter cannot kill what it cannot own' })
          }
          const caller = typeof ownerSessionId === 'function' ? ownerSessionId(String(context?.memberAgentId ?? '')) : undefined
          const word = jobs.kill(String(resource.jobId), caller, String(context?.reason ?? 'cancelled'))
          return Promise.resolve(word).then((answer) => ({ routed: answer === 'requested', face: 'jobs.kill(owner-checked)', word: answer }))
        }
        const sid = String(resource?.sessionId ?? '')
        // THE REAL-ROUTE UNANSWERED BOUNDARY, MEASURED: with no answered
        // session there may STILL be a controlled launch in flight (the
        // provider owns its pre-answer rollback) — the adapter kills
        // NOTHING speculatively and never claims a clean zero: the word
        // carries `launchClaimed` (the pinned spec reached the capability).
        const launchClaimed = launchedByCall.size > 0
        if (sid.length === 0 || sid.startsWith('unanswered-open:')) {
          // The provider was entered but NEVER answered: no resource the
          // adapter can own exists. The effect-visibility duty is already
          // discharged (the entry is recorded, inFlight/drain report it);
          // the cleanup word is HONEST: nothing was minted, nothing killed.
          return Promise.resolve({ routed: false, nothingToKill: true, ...(launchClaimed ? { launchClaimed: true } : {}), code: 'P_TERM_CLEANUP_NOTHING_MINTED', detail: 'the per-open provider was entered but answered no ownedResource — there is no minted session/job to clean; the started-effect remains VISIBLE in inFlight/drain, never hidden' })
        }
        const { owner: cleanupOwner, refusal: ownerRefusal } = ownerOrRefusal({ agent: context?.exec?.agent ?? null })
        if (ownerRefusal !== undefined) {
          return Promise.resolve({ routed: false, code: 'P_TERM_PORT_OWNER_UNRESOLVED', detail: 'the cancel cleanup cannot answer the live owner Agent — the service authorizes by the EXACT Agent and the adapter never guesses one; nothing is claimed cleaned' })
        }
        return Promise.resolve(killSession(cleanupOwner, sid, String(context?.reason ?? 'cancelled')))
          .then((outcome) => ({ routed: true, face: 'terminals.kill', sessionId: sid, outcome }))
      } catch (error) {
        return Promise.resolve({ routed: false, code: 'P_TERM_CLEANUP_FAILED', detail: String(error?.message ?? error) })
      }
    },
    handleStatus(handle) {
      const sessionId = String(handle?.identity?.sessionId ?? '')
      if (sessionId.length === 0) return { live: 'no session identity on this handle' }
      try {
        const rows = terminals.list(handle?.owner ?? null)
        const list = Array.isArray(rows) ? rows : null
        if (list === null) return { live: 'pending — the service list resolves asynchronously (terminal_close/terminate carry the settled word)' }
        const row = list.find((r) => String(r?.sessionId ?? '') === sessionId)
        return row === undefined
          ? { live: false, note: 'the service no longer lists this session' }
          : { live: true, session: row }
      } catch (error) {
        return { live: 'unknown', error: String(error?.message ?? error) }
      }
    },
    /** THE real terminate face for a live session (terminal_close semantics):
     *  service.kill awaits quiescent cleanup; its answer is forwarded. */
    async terminate(handle, context) {
      const sessionId = String(handle?.identity?.sessionId ?? '')
      if (sessionId.length === 0) return { terminated: false, reason: 'the handle carries no session identity — nothing to kill' }
      const { owner, refusal } = ownerOrRefusal(context?.exec ?? {})
      if (refusal !== undefined) return { terminated: false, reason: refusal.detail }
      return { sessionId, terminated: await killSession(owner, sessionId), via: 'ctx.terminals.kill' }
    },
  }
  return deepFreeze(asPort)
}

// ── the shared thin-delegate core (todo.mjs pattern, parameterized) ───────

/**
 * FAITHFUL EXEC SNAPSHOT (child-tool channel law): EVERY own field of the
 * classified exec is carried — value fields copied, function fields bound to
 * the live execution so calls (deferContext, concludeTurn, session-owned
 * writers) still land where the host expects them. No field is dropped; no
 * mutable object is re-read at entry.
 */
function faithfulExecSnapshot(exec) {
  if (exec === null || typeof exec !== 'object') return Object.freeze({})
  const out = {}
  for (const key of Object.keys(exec)) {
    const value = exec[key]
    out[key] = typeof value === 'function' ? value.bind(exec) : value
  }
  return Object.freeze(out)
}

/**
 * ONE governed arm over ONE captured native definition. Every family factory
 * below is a thin configuration of this core.
 *
 * @param deps.familyId / deps.toolName / deps.codes - the family block.
 * @param deps.nativeDefinition - the captured definition object (name +
 *   execute + AUTHORED parameters spec), or NULL for the declared-absent
 *   shape: the row exists (declared) but the service is absent, so EVERY
 *   call refuses TYPED — config is law, and there is no fallback face.
 * @param deps.definitionIdentity - the bind-time identity (never
 *   self-attested at entry: the re-verify reads `liveDispatcher`).
 * @param deps.liveDispatcher - () => { definitionIdentity } | null: the
 *   integrator-supplied CURRENT placement read (the placementFeed pattern
 *   the plane itself uses). REQUIRED whenever a native definition is
 *   captured; the entry re-verify consumes it — no new ledger, no closure
 *   self-attestation.
 * @param deps.providerId / memberAgentId / sessionHeaderId / realmId -
 *   trusted bind-time facts (realmId joins every resource identity).
 * @param deps.bindingFacts - the injected CURRENT binding-facts reader
 *   (bindingId/bindingRevision/policyGeneration/authorityGeneration); read
 *   at classify AND RE-QUERIED at the real entry.
 * @param deps.serviceFacts - the family's current-facts reader (ptyService,
 *   lspFacts, ptcFacts) — the ONLY source of target identity/incarnation/
 *   envelope/channel facts. Model strings never substitute.
 * @param deps.validate - (args, helpers) => {ok, canonical, operation,
 *   manifest, effects?, recheckTarget?} | {ok:false, code, detail}. PURE;
 *   `recheckTarget()` is called at the real entry to catch target drift
 *   between approval and body entry.
 * @param deps.observe - the minimal backend log.
 */
function createDelegateArm({ familyId, toolName, codes, nativeDefinition, definitionIdentity, liveDispatcher, providerId, memberAgentId, sessionHeaderId, realmId, bindingFacts, serviceFacts, controlPort = null, validate, observe = () => {} }) {
  const declaredAbsent = nativeDefinition === null || nativeDefinition === undefined
  if (!declaredAbsent && typeof nativeDefinition?.execute !== 'function') {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: nativeDefinition must be the captured definition object with an execute function, or null for the declared-absent shape`)
  }
  if (!declaredAbsent && (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0)) {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: definitionIdentity is required whenever a native definition is captured`)
  }
  if (!declaredAbsent && typeof liveDispatcher !== 'function') {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: liveDispatcher (the integrator's CURRENT placement read) is required — a definition identity only the closure can attest is self-attestation, not binding`)
  }
  if (typeof providerId !== 'string' || providerId.length === 0) {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: providerId must be a non-empty string`)
  }
  if (typeof memberAgentId !== 'string' || memberAgentId.length === 0 || typeof sessionHeaderId !== 'string' || sessionHeaderId.length === 0) {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: memberAgentId and sessionHeaderId are required (the REAL Host identity pairing has no otherwise)`)
  }
  if (typeof realmId !== 'string' || realmId.length === 0) {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: realmId is required (realm joins every resource identity and fingerprint)`)
  }
  if (typeof bindingFacts !== 'function') {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: bindingFacts must be the injected M1/Guard current-facts reader`)
  }
  if (typeof validate !== 'function') {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: validate is required`)
  }

  /** The closed top-level surface = the CAPTURED definition's OWN parameter
   *  keys (dynamic config mirrors, never a hand-written superset). ROOT
   *  RULING 66a521: production classify runs over the REAL defineTool
   *  PRODUCT, whose `parameters` is the COMPILED JSON Schema
   *  {type:'object',properties,required} — parameter keys of a compiled
   *  capture come from its `properties` entries; Object.keys of the whole
   *  schema would answer envelope keys (['type','properties','required']),
   *  which are NEVER parameters. Authored-shape captures keep their own
   *  top-level keys (same law as the face: g3ParameterEntries). */
  const declaredSurface = declaredAbsent ? [] : Object.keys(g3ParameterEntries(nativeDefinition.parameters ?? {}))
  /** REQUIRED per the captured definition's closed law (the REAL defineTool
   *  product raises ToolArgsError on a missing required argument at its own
   *  execute — the governed row refuses the same class at classify). */
  const declaredRequired = declaredAbsent ? [] : g3RequiredParameterNames(nativeDefinition.parameters ?? {})
  /** The derived canonical registration face (r9); null exactly when absent. */
  const parametersFace = declaredAbsent ? null : g3CanonicalRegistrationFace(nativeDefinition.parameters ?? {})

  /** BIND-TIME SNAPSHOT of the body (never re-read by name at execution). */
  const bindExecute = declaredAbsent ? null : nativeDefinition.execute
  const plans = new WeakMap()
  const trackedEntries = []
  let correlationSeq = 0
  let draining = false

  const generationFacts = () => {
    const facts = bindingFacts()
    return {
      bindingId: facts?.bindingId ?? null,
      bindingRevision: facts?.bindingRevision ?? null,
      policyGeneration: facts?.policyGeneration ?? null,
      authorityGeneration: facts?.authorityGeneration ?? null,
    }
  }

  /** REAL Host-shape identity read: exactly `exec.agent.id` and
   *  `exec.agent.session.header.id`. No shim, no alternate words. */
  const readIdentity = (exec) => {
    const agentId = typeof exec?.agent?.id === 'string' && exec.agent.id.length > 0 ? exec.agent.id : null
    const headerId = typeof exec?.agent?.session?.header?.id === 'string' && exec.agent.session.header.id.length > 0 ? exec.agent.session.header.id : null
    return { agentId, headerId }
  }

  /** CARD 3: the PENDING CANCELLATION registered while no resource was
   *  answered settles with the EXECUTION OUTCOME — never silently, never as
   *  a speculative kill. The evidence names which outcome settled it. */
  const settlePendingCancel = (target, evidence) => {
    if (target.cancelPending !== true) return
    target.cancelPending = false
    target.cancelPendingSettled = evidence
  }

  /**
   * THE live-source fact re-verification (no closure self-attestation, no
   * ledger): consumed-grant pairing, CURRENT binding facts (bindingId AND
   * generations), the CURRENT definition identity from the live dispatcher
   * face, the captured function value, and the family's service target
   * facts. Returns null when every fact still stands. Run FIRST as a
   * synchronous fail-fast and AGAIN AT THE REAL ENTRY (the microtask right
   * before the body): the ENTRY run is authoritative — the window between
   * the two runs is closed because entry happens only if this verdict is
   * still clean at the moment of entry.
   */
  const liveVerdict = (plan, grant, entry) => {
    const current = generationFacts()
    if (
      grant.callId !== plan.callId
      || grant.parametersFingerprint !== plan.parametersFingerprint
      || grant.bindingId !== plan.generationsAtClassify.bindingId
      || grant.bindingRevision !== plan.generationsAtClassify.bindingRevision
    ) {
      return refuse(codes.GRANT_MISMATCH, 'the consumed grant does not answer to this plan (callId / parametersFingerprint / binding pairing): a grant spent for one payload never runs another')
    }
    if (
      current.bindingId !== plan.generationsAtClassify.bindingId
      || current.bindingRevision !== plan.generationsAtClassify.bindingRevision
      || current.policyGeneration !== plan.generationsAtClassify.policyGeneration
      || current.authorityGeneration !== plan.generationsAtClassify.authorityGeneration
    ) {
      return refuse(codes.GRANT_MISMATCH, `CURRENT binding facts moved since classify (${JSON.stringify(plan.generationsAtClassify)} -> ${JSON.stringify(current)}): a stale approval never rides a new generation`)
    }
    // The current read is INVOKED explicitly into a local — the dispatcher
    // answers the CURRENT placement record; a dispatcher that answers a
    // function VALUE is a broken read, and `live` below only ever holds
    // {definitionIdentity} or null.
    let live = null
    if (typeof liveDispatcher === 'function') {
      const answered = liveDispatcher()
      live = answered === null || answered === undefined || typeof answered !== 'object' ? null : answered
    }
    // The exemplar law (todo.mjs, kept EXACT): the CURRENT function value ON
    // the captured definition object is compared to the bind-time capture —
    // a swapped execute (definition replacement) refuses at the entry.
    if (live === null || live.definitionIdentity !== plan.definitionIdentity || nativeDefinition.execute !== bindExecute) {
      return refuse(codes.DEFINITION_DRIFT, 'the CURRENT placement identity (live dispatcher) or the execute function moved since bind time: the governed call refuses here; there is no replacement-body path and no native fallback')
    }
    if (typeof entry.recheckTarget === 'function') {
      const target = entry.recheckTarget()
      if (target !== null && target !== undefined && target.ok !== true) {
        return refuse(target.code ?? codes.TARGET_DRIFT, target.detail ?? 'the service target facts moved between approval and the entry')
      }
    }
    return null
  }

  function classify(args, exec, callId) {
    if (draining) return refuse(codes.DRAINING, 'the arm is DRAINING: no NEW call reaches any body (drain prohibits; it settles nothing — see inFlight())')
    if (typeof callId !== 'string' || callId.length === 0) {
      return refuse(codes.INVALID_ARGUMENTS, 'the A invocation correlation (callId) is required at classify time')
    }
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      return refuse(codes.INVALID_ARGUMENTS, 'arguments must be an object')
    }
    const { agentId, headerId } = readIdentity(exec)
    if (agentId === null || headerId === null) {
      return refuse(codes.NO_OWNING_SESSION, 'no real exec.agent.id / exec.agent.session.header.id: this row owns its state through the exact Agent and its durable session header, and this caller carries neither')
    }
    if (agentId !== memberAgentId || headerId !== sessionHeaderId) {
      return refuse(codes.FOREIGN_SESSION, `identity pairing failed against the bind-time facts (agent ${JSON.stringify(agentId)} vs ${JSON.stringify(memberAgentId)}, session.header ${JSON.stringify(headerId)} vs ${JSON.stringify(sessionHeaderId)})`)
    }
    // DECLARED_MOUNT law: the row is mounted because the mount was DECLARED;
    // an absent declared service is a typed refusal, never a bare pass and
    // never a reach for some other native face.
    if (declaredAbsent) {
      return refuse(codes.DECLARED_ABSENT, `the declared native service for '${toolName}' is absent: the row refuses typed and never falls back (mount condition is law, not wiring)`)
    }
    const unknown = Object.keys(args).filter((k) => !declaredSurface.includes(k))
    if (unknown.length > 0) {
      return refuse(codes.UNKNOWN_PARAMETER, `parameter(s) outside the CAPTURED definition surface (${declaredSurface.join('|') || 'no parameters'}): ${unknown.join(', ')} — the governed root mirrors the actual mounted config and is closed`)
    }
    const missing = declaredRequired.filter((k) => !Object.prototype.hasOwnProperty.call(args, k))
    if (missing.length > 0) {
      return refuse(codes.REQUIRED_MISSING, `required parameter(s) missing per the CAPTURED definition's closed required law (${declaredRequired.join('|')}): ${missing.join(', ')} — the REAL defineTool product raises ToolArgsError on this at execute; the governed row refuses it at classify with zero effects`)
    }
    const generations = generationFacts()
    const v = validate(args, { refuse, canonicalJson, sha256, serviceFacts, controlPort, realmId, exec, callId, memberAgentId, generations })
    if (v.ok !== true) return refuse(v.code, v.detail)
    const effects = deepFreeze([{ kind: 'tool-invoke', toolName, resource: null }, ...(v.effects ?? [])])
    const paramFingerprint = sha256(canonicalJson(v.canonical))
    const targetManifest = deepFreeze({
      operation: v.operation,
      toolName,
      realmId,
      agentId,
      sessionHeaderId: headerId,
      ...v.manifest,
      paramFingerprint,
    })
    const reviewPayload = deepFreeze({
      familyId,
      adapterRevision: A5_G3_ADAPTER_REVISION,
      providerIdentity: providerId,
      definitionIdentity,
      targetManifest,
    })
    // TWO fingerprint layers, NEVER merged (todo exemplar, root ruling): the
    // grant's parametersFingerprint pairs against THIS full-values digest;
    // the operationFingerprint is the PA center's manifest digest — the arm
    // never computes it.
    const parametersFingerprint = `sha256:${sha256(canonicalJson({
      ...generations,
      callId,
      effects,
      reviewPayload,
    }))}`
    const plan = deepFreeze({
      familyId,
      adapterRevision: A5_G3_ADAPTER_REVISION,
      toolName,
      definitionIdentity,
      providerId,
      callId,
      effects,
      reviewPayload,
      parametersFingerprint,
      canonical: v.canonical,
      generationsAtClassify: Object.freeze(generations),
    })
    // APPROVAL-WINDOW SNAPSHOT: the body runs against THESE captured values
    // only — a FAITHFUL exec (every own field; functions bound to the live
    // execution, so the child-tool channel keeps rootCallId/token/
    // deferContext/concludeTurn intact) — never a rebuilt subset.
    const snapshot = faithfulExecSnapshot(exec)
    correlationSeq += 1
    const correlation = `${toolName}.r${A5_G3_ADAPTER_REVISION}.${correlationSeq}.${callId}`
    const entry = {
      state: 'CLASSIFIED',
      correlation,
      snapshot,
      recheckTarget: typeof v.recheckTarget === 'function' ? v.recheckTarget : null,
      handleRequest: v.handleRequest !== null && typeof v.handleRequest === 'object' ? deepFreeze(v.handleRequest) : null,
      // the port receives the CLASSIFIED manifest (service-answered targets:
      // per-open governed registration + approved envelope + backend
      // target) as its own handle request — the governed identity the port
      // spawns behind is the one classify admitted.
      handleManifest: v.manifest !== null && typeof v.manifest === 'object' ? deepFreeze(v.manifest) : null,
      handle: null,
      startedResource: null,
      startedFact: null,
      refusedWithEffects: false,
      settlementOverride: null,
      backgroundJobId: null,
      // CARD 3 bookkeeping (independent intents, independent identity): the
      // cleanup promise of a cancel whose cleanup law is RUNNING, plus the
      // PENDING CANCELLATION registered when a cancel arrives while the plan
      // is EXECUTING but NO resource has been answered yet — it is never
      // dropped, and it settles with the execution outcome (see cancel()).
      cancelCleanup: null,
      cancelPending: false,
      cancelPendingSettled: null,
    }
    plans.set(plan, entry)
    trackedEntries.push(entry)
    observe({ event: 'classify', correlation, detail: parametersFingerprint })
    return { ok: true, plan, effects, reviewPayload, parametersFingerprint, manifest: targetManifest }
  }

  function prepare(plan, grant) {
    if (draining) return refuse(codes.DRAINING, 'DRAINING: no admission is admitted, no execution will start')
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(codes.NOT_ADMITTED, 'unknown plan: prepare answers only to a plan this arm classified')
    if (entry.state !== 'CLASSIFIED') return refuse(codes.NOT_ADMITTED, `plan is ${entry.state}, not open-for-admission`)
    if (grant === null || typeof grant !== 'object' || typeof grant.grantId !== 'string') {
      return refuse(codes.NOT_ADMITTED, 'prepare takes the kernel grant object (admission answered allow/approve); a plan without a grant never proceeds')
    }
    entry.state = 'PREPARED'
    entry.grantId = grant.grantId
    observe({ event: 'admit', correlation: entry.correlation, detail: grant.grantId })
    return { ok: true }
  }

  function execute(plan, consumed) {
    const entry = plans.get(plan)
    if (entry === undefined) return Promise.resolve(refuse(codes.NOT_ADMITTED, 'unknown plan: execute answers only to a plan this arm classified'))
    if (entry.state === 'CANCELLED') return Promise.resolve(refuse(codes.CANCELLED, 'the plan was cancelled before the edge: zero body is the truth, not a race'))
    if (entry.state !== 'PREPARED') {
      const spent = entry.state === 'CLAIMED' || entry.state === 'EXECUTING' || entry.state === 'COMMITTED'
      return Promise.resolve(refuse(spent ? codes.ALREADY_CONSUMED : codes.NOT_ADMITTED, `plan is ${entry.state}`))
    }
    const grant = consumed?.grant
    if (consumed?.consumed !== true || grant === null || typeof grant !== 'object' || typeof grant.grantId !== 'string') {
      return Promise.resolve(refuse(codes.NOT_ADMITTED, 'execute takes the REAL consumed-proof of the A execution edge ({grant, consumed:true}); internal state never substitutes for it'))
    }
    // FAIL-FAST pass (cheap, synchronous): the obvious stale cases refuse
    // without scheduling. It is NOT the closing check — the AUTHORITATIVE
    // live-source re-verification runs again at the real entry below, so a
    // fact that moves AFTER this line still refuses with zero body.
    const failFast = liveVerdict(plan, grant, entry)
    if (failFast !== null) return Promise.resolve(failFast)
    entry.state = 'CLAIMED'
    const args = JSON.parse(JSON.stringify(plan.canonical))
    return Promise.resolve()
      .then(() => {
        // THE REAL ENTRY: cancel/drain first, then the authoritative
        // re-verification against the LIVE sources (current binding facts,
        // live dispatcher definition identity + function value, service
        // target facts). The body is entered only if everything still
        // stands AT THIS MOMENT — facts moved between the fail-fast pass
        // and here refuse with zero body.
        if (entry.state === 'CANCELLED') {
          const edge = new Error('cancelled at the commit edge')
          edge.a5Edge = 'CANCELLED'
          throw edge
        }
        if (draining) {
          const edge = new Error('drained at the commit edge')
          edge.a5Edge = 'DRAINING'
          throw edge
        }
        const atEntry = liveVerdict(plan, grant, entry)
        if (atEntry !== null) {
          const edge = new Error('live facts moved before entry')
          edge.a5Edge = 'REFUSED-AT-ENTRY'
          edge.a5Refusal = atEntry
          throw edge
        }
        observe({ event: 'backend-start', correlation: entry.correlation, detail: plan.definitionIdentity })
        // THE CONTROL-PORT ROUTE (root boundary ruling): when the family
        // carries a control port that answers a REAL handle for this call,
        // the HANDLE executes and its answer commits — the captured body is
        // not entered on this path (the port adapter IS the entry the
        // integrator wired, e.g. createHostTerminalControlPort over
        // ctx.terminals). Without a handle route the arm is the faithful
        // delegate of the captured body (control plane + exec fidelity).
        if (controlPort !== null && typeof controlPort.prepare === 'function') {
          // PREPARE IS AN EFFECT ENTRY (root ruling 66a521): the port's
          // prepare may START real work (spawn behind the per-open governed
          // backend, startSend, jobs.start). The plan is EXECUTING from here
          // — a refusal after a started effect carries the cleanup truth and
          // NEVER claims zero effects; the port re-checks cancel/drain and
          // the CURRENT target facts through these live seams after every
          // await.
          entry.state = 'EXECUTING'
          return Promise.resolve()
            .then(() => controlPort.prepare({
              toolName,
              canonical: plan.canonical,
              exec: entry.snapshot,
              callId: plan.callId,
              correlation: entry.correlation,
              handleRequest: entry.handleRequest,
              manifest: entry.handleManifest,
              // ROOT 580f REVIEW ①: the port's post-effect rechecks read the
              // REAL cancel INTENT, not just a state flip. A cancellation
              // registered while NO resource had been answered (cancelPending)
              // stands: the moment a real resource is ANSWERED, the port's
              // cancelled() after its await sees this intent, cleans the
              // ANSWERED resource through the service, and refuses the success
              // commit with the cleanup truth — the pending cancel is
              // HONOURED, never silently cleared by a commit. Nothing is
              // killed before any resource exists (the registration itself
              // kills nothing; only the post-answer recheck acts).
              isCancelled: () => entry.state === 'CANCELLED' || draining || entry.cancelPending === true,
              recheckFacts: () => (typeof entry.recheckTarget === 'function' ? entry.recheckTarget() : null),
              // THE CLEANUP REGISTER (root ruling 66a521): the port records
              // what STARTED behind this call here (ownedResource before the
              // answer, handle after it); the cancel face's cleanup law and
              // drain() read exactly this — no started resource is invisible.
              recordStarted: (resource) => {
                if (resource !== null && typeof resource === 'object') entry.startedResource = resource
              },
            }))
            .then((prepared) => {
              // A port ANSWER (jobs-shaped refusal/carry, {ok:false,answer})
              // routes VERBATIM — it already executed on the real face; the
              // arm commits its word and enters nothing.
              if (prepared !== null && prepared.ok === false && prepared.answer !== null && typeof prepared.answer === 'object') {
                // A port REFUSAL with cleanup truth (root ruling 66a521: an
                // effect entry that refused AFTER a real start): it commits
                // VERBATIM — the caller sees the port's own refusal shape
                // (refused/effectsStarted/code/detail/cleanup); the arm
                // never re-wraps an after-effect refusal into success. A
                // carry answer (a job accepted WITHOUT a handle) keeps the
                // word-of-record commit above.
                if (prepared.answer.refused === true) {
                  // The port's refusal is an EDGE, not a value: the outer
                  // commit handler owns the final shape; returning it as a
                  // value would re-wrap it into {ok:true,value} — success
                  // narration over a refusal. Throw with the refusal
                  // attached; the catch below commits it VERBATIM.
                  const edge = new Error('the control port refused after effects started')
                  edge.a5Edge = 'REFUSED-AFTER-EFFECTS'
                  edge.a5Refusal = prepared.answer
                  throw edge
                }
                entry.state = 'COMMITTED'
                observe({ event: 'backend-commit', correlation: entry.correlation, detail: 'port-answer' })
                observe({ event: 'backend-end', correlation: entry.correlation, detail: 'ok' })
                return { ok: true, value: prepared.answer }
              }
              if (prepared !== null && prepared.zeroEffects === true) {
                // The port MEASURED zero started effects (cancel/drain moved
                // before the provider was ever entered): its honest
                // zero-effect word rides the CANCELLED edge — code and
                // detail verbatim, never the generic after-effect claim.
                const edge = new Error('cancel moved before any real effect started')
                edge.a5Edge = 'CANCELLED-ZERO-EFFECT'
                edge.a5Refusal = { code: prepared.code ?? 'P_TERM_CANCELLED_BEFORE_EFFECT', detail: prepared.detail ?? 'zero started effects' }
                throw edge
              }
              if (prepared === null || prepared.ok !== true || typeof prepared.handle?.invoke !== 'function') {
                const edge = new Error('the control port refused the handle at the entry')
                edge.a5Edge = 'REFUSED-AT-ENTRY'
                // a zero-effect port word (cancel before any real start)
                // rides its OWN edge kind: the commit below answers the
                // port's honest zero-effect word with its code, not the
                // generic before-edge claim.
                if (prepared?.zeroEffects === true) edge.a5Edge = 'CANCELLED-ZERO-EFFECT'
                edge.a5Refusal = prepared !== null && prepared.ok === false
                  ? refuse(prepared.code ?? codes.TARGET_UNRESOLVED, prepared.detail ?? 'the control port refused the real handle: zero invoke, zero body')
                  : refuse(codes.TARGET_UNRESOLVED, 'the control port did not answer a real handle for this call: a governed row never executes behind an unanswered handle')
                throw edge
              }
              const drift = typeof controlPort.drift === 'function' ? controlPort.drift(plan.canonical)(prepared.handle) : null
              if (drift !== null && drift !== undefined && drift.ok === false) {
                // The prepared handle is abandoned UNINVOKED (the port owns
                // its cleanup); the entry refuses with zero invoke.
                const edge = new Error('the handle target moved between prepare and invoke')
                edge.a5Edge = 'REFUSED-AT-ENTRY'
                edge.a5Refusal = refuse(drift.code ?? codes.TARGET_DRIFT, drift.detail ?? 'the handle target moved between prepare and invoke')
                throw edge
              }
              entry.handle = prepared.handle
              // CARD 3 (root central adjudication — independent intents,
              // independent identity): the started resource the PORT recorded
              // during prepare carries the intent's OWN kind ({__kind:
              // 'send-operation' | 'job' | 'open-session', …}). Overwriting
              // it here with the generic handle erased that kind, so a
              // cancel of ONE in-flight send lost its operation/job cleanup
              // face and fell through to the generic session-level path.
              // The kinded registration STANDS (cancelCleanup routes it to
              // operation.cancel / owner-checked jobs.kill); the handle still
              // rides entry.handle for identity/inFlight, and SESSION-LEVEL
              // close stays its own distinct operation (terminal_close, or
              // the handle's own terminate face).
              if (entry.startedResource === null) entry.startedResource = prepared.handle
              // A REAL background job (host ctx.jobs id from the handle the
              // port answered) OUTLIVES this call and every drain word —
              // recorded as UNCLEARED from the handle's identity, never
              // settled here.
              const bgJob = prepared.handle.identity?.jobId
              if (plan.canonical?.run_in_background === true && typeof bgJob === 'string' && bgJob.length > 0) {
                entry.backgroundJobId = bgJob
              }
              // EXECUTING was entered at PREPARE (a started effect is an
              // effect entry); the invoke rides on top of it.
              return prepared.handle.invoke(entry.snapshot)
            })
        }
        entry.state = 'EXECUTING'
        return bindExecute.call(nativeDefinition, args, entry.snapshot)
      })
      .then(
        (value) => {
          entry.state = 'COMMITTED'
          // ROOT 580f REVIEW ①: with a REAL cancel intent registered, every
          // effect-entry route REFUSES after the answer (the port's recheck
          // reads isCancelled and cleans) — reaching the commit with the
          // intent still registered means the route started NO resource the
          // intent could clean (a completed read/signal/list), so settling
          // the bookkeeping here is honest, never a silent forgiveness.
          settlePendingCancel(entry, 'settled-by-execution-commit — the execution committed with NO started resource left for the intent to clean (an effect-entry route refuses after the answer through the isCancelled recheck instead of committing here)')
          // DRAIN HONESTY: a background job the native body started (host
          // jobs.start for a run_in_background send) OUTLIVES this call and
          // every drain word — record it as UNCLEARED, never as settled.
          if (plan.canonical?.run_in_background === true && typeof value?.jobId === 'string') {
            entry.backgroundJobId = value.jobId
          }
          observe({ event: 'backend-commit', correlation: entry.correlation, detail: plan.parametersFingerprint })
          observe({ event: 'backend-end', correlation: entry.correlation, detail: 'ok' })
          return { ok: true, value }
        },
        (error) => {
          if (error?.a5Edge === 'CANCELLED') {
            entry.state = 'CANCELLED'
            settlePendingCancel(entry, 'settled-before-edge — the execution stopped at the commit edge with zero effects; any pending cancellation is settled here with that zero (defensive: the before-edge cancel path never leaves one registered)')
            observe({ event: 'backend-end', correlation: entry.correlation, detail: 'cancelled-at-edge' })
            return refuse(codes.CANCELLED, 'cancelled before the body: zero effects (the commit-edge re-check stopped it)')
          }
          if (error?.a5Edge === 'REFUSED-AFTER-EFFECTS') {
            entry.state = 'EXECUTING-REFUSED'
            entry.refusedWithEffects = true
            entry.startedFact = error.a5Refusal?.cleanup ?? { started: true, note: 'the port reported effects started' }
            entry.settlementOverride = 'refused after effects — the caller never received a commitment; the resource cleanup is reported in the refusal'
            settlePendingCancel(entry, 'settled-with-cleanup-truth — the after-effect refusal carried the cleanup of the started resource; that truth owns the settle (the refusal word above carries it)')
            observe({ event: 'backend-end', correlation: entry.correlation, detail: 'refused-after-effects' })
            // VERBATIM content (refused/effectsStarted/code/detail/cleanup)
            // PLUS the protocol's `ok:false` (the refusal was committed as a
            // refusal, never a success value).
            return { ok: false, ...error.a5Refusal }
          }
          if (error?.a5Edge === 'CANCELLED-AFTER-EFFECT') {
            entry.state = 'CANCELLED'
            settlePendingCancel(entry, 'settled-with-cleanup-truth — the cancelled-after-effect word below carries the cleanup of the started resource')
            observe({ event: 'backend-end', correlation: entry.correlation, detail: 'cancelled-after-effect' })
            // CANCELLED is a decision; a resource had ALREADY STARTED behind
            // it. The started resource is cleaned (cleanup truth attached)
            // and the word states BOTH facts — never a zero-effect claim.
            return {
              ok: false,
              code: 'P_TERM_CANCELLED_AFTER_EFFECT',
              detail: 'cancel/drain moved while the per-open backend spawn was in flight: the call refuses as CANCELLED (the decision owns the outcome, not the drift code) AND effects started — the started resource was cleaned through the service (cleanup truth attached); this word NEVER claims zero effects',
              effectsStarted: true,
              cleanup: error.a5Cleanup ?? { started: true, outcome: 'unknown — the cleanup answer did not settle' },
            }
          }
          if (error?.a5Edge === 'CANCELLED-ZERO-EFFECT') {
            entry.state = 'CANCELLED'
            settlePendingCancel(entry, 'settled-zero-effect — the PORT measured that no real effect had started; the pending cancellation is settled by that honest zero-effect word')
            observe({ event: 'backend-end', correlation: entry.correlation, detail: 'cancelled-before-effect' })
            // the PORT measured that no real effect had started (the
            // provider was never entered / no operation started): its
            // honest zero-effect code and detail ride verbatim.
            return refuse(error.a5Refusal?.code ?? 'P_TERM_CANCELLED_BEFORE_EFFECT', error.a5Refusal?.detail ?? 'cancel moved before any real effect started: zero resource')
          }
          if (error?.a5Edge === 'DRAINING') {
            entry.state = 'DRAINED-AT-EDGE'
            settlePendingCancel(entry, 'settled-zero-effect — the execution drained at the edge with zero effects; the pending cancellation is settled by that word')
            observe({ event: 'backend-end', correlation: entry.correlation, detail: 'drained-at-edge' })
            return refuse(codes.DRAINING, 'drained before the body: zero effects; no native fallback exists')
          }
          if (error?.a5Edge === 'REFUSED-AT-ENTRY') {
            entry.state = 'REFUSED-AT-ENTRY'
            settlePendingCancel(entry, 'settled-at-entry-refusal — the execution refused at the entry (zero invoke, zero body); the pending cancellation is settled with that typed refusal')
            observe({ event: 'backend-end', correlation: entry.correlation, detail: String(error?.a5Refusal?.code ?? 'refused') })
            return error.a5Refusal
          }
          entry.state = 'FAILED-UNKNOWN'
          settlePendingCancel(entry, 'UNRESOLVED — the execution itself failed without an answered outcome; the pending cancellation has NO settle evidence and stays visibly unresolved (the arm never invents one)')
          observe({ event: 'backend-end', correlation: entry.correlation, detail: 'error' })
          throw error
        },
      )
  }

  function cancel(plan) {
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(codes.NOT_ADMITTED, 'cancel answers only to a plan this arm issued')
    if (entry.state === 'COMMITTED') {
      const bg = entry.backgroundJobId !== null
        ? ` A background job (${entry.backgroundJobId}) started by that body is LIVE and UNCLEARED — this word settles nothing about it; only job_kill/its own settlement or the PTY close evidence does.`
        : ''
      const word = { ok: true, settled: 'ALREADY-COMMITTED', bodyOutcome: `one — the body ran and committed; cancellation cannot retract it (for stateful faces the PTY/session resource survives the word).${bg}` }
      // The LIVE session word of a committed HANDLE comes from the PORT's
      // current facts (root ruling 66a521): whatever the service answers
      // now, never a claim of our own.
      if (entry.handle !== null && controlPort !== null && typeof controlPort.handleStatus === 'function') {
        word.sessionWord = controlPort.handleStatus(entry.handle) ?? { live: 'unknown — the port answered no current status' }
      }
      return word
    }
    if (entry.state === 'EXECUTING') {
      // CANCEL IS NOT CLOSE/KILL (root ruling 66a521): the word never
      // settles the operation and never claims zero effects. But the
      // CLEANUP LAW is this arm's own duty, not the port's: when the effect
      // has ALREADY STARTED behind this call (the port recorded its started
      // resource / handle), the cancel CLEANS that resource — through the
      // right face: an in-flight SEND cancels its OPERATION (never kills
      // the PTY), a started-but-unanswered OPEN kills its session, a
      // background job gets an owner-checked kill — and AWAWS the real
      // settle (void — the sync word cannot carry it; the execution
      // result-path reports its own after-effect refusal truth).
      const live = controlPort !== null ? (entry.startedResource ?? entry.handle ?? null) : null
      if (live === null && controlPort !== null) {
        // CARD 3 + ROOT 580f REVIEW ①: when NO resource has been answered
        // back yet, the pending cancellation is STILL REGISTERED — dropping
        // the bookkeeping here was the bug this card refuses — AND THE
        // INTENT IS REAL, not a note awaiting forgiveness: it rides the
        // isCancelled seam into the port's post-effect rechecks, so the
        // moment a REAL resource is ANSWERED the port cleans it through the
        // service and REFUSES the success commit with the cleanup truth
        // (真实资源应答后执行清理/拒绝成功commit). Nothing is killed while no
        // resource exists (不猜尚无资源 — the registration itself is not a
        // kill); the commit may settle the bookkeeping only on routes that
        // leave NO started resource for it to clean. inFlight() carries the
        // fact either way.
        entry.cancelPending = true
        return { ok: true, settled: 'UNKNOWN-IN-FLIGHT', cancelPending: true, bodyOutcome: 'unknown — this plan is EXECUTING on the control-port path but NO resource is recorded as started yet: PREPARE IS AN EFFECT ENTRY, the effect boundary is inside prepare; effectsStarted is at minimum UNKNOWN — never zero — the pending cancellation is REGISTERED and HONOURED: the port rechecks this intent after every await, so a resource that gets ANSWERED is cleaned through the service and the execution answers the refusal with its cleanup truth (await the execution result)' }
      }
      if (live !== null) {
        // IDEMPOTENT like the faces it drives: a repeated cancel of the same
        // entry follows the ONE cleanup already running, never a second kill.
        const settlePromise = entry.cancelCleanup ?? Promise.resolve(controlPort.cancelCleanup?.(live, {
          exec: entry.snapshot,
          correlation: entry.correlation,
          memberAgentId,
          reason: 'cancelled by the caller before the operation settled',
        })).catch((error) => ({ routed: false, code: 'P_TERM_CLEANUP_FAILED', detail: String(error?.message ?? error) }))
        entry.cancelCleanup = settlePromise
        entry.cancelPending = false
        entry.cancelPendingSettled = 'superseded-by-running-cleanup — the cancel reached the cleanup law through the started resource; that promise owns the settle'
        return {
          ok: true,
          settled: 'UNKNOWN-IN-FLIGHT',
          bodyOutcome: 'unknown — the effect had ALREADY STARTED behind this call: the cleanup law is RUNNING through the right face (operation.cancel for an in-flight send / service kill for an unanswered open / owner-checked jobs kill for a background job) and its real settle is AWAITED before this word reports cleanup truth; effectsStarted is TRUE — never zero; cancelling a call does NOT close the session (terminal_close owns that) nor retract a committed body',
          cleanupSettled: settlePromise,
        }
      }
      if (controlPort !== null) {
        return { ok: true, settled: 'UNKNOWN-IN-FLIGHT', bodyOutcome: 'unknown — this plan is EXECUTING on the control-port path: PREPARE IS AN EFFECT ENTRY, so the real effect may already have STARTED (per-open spawn / startSend / jobs.start) or the handle is mid-invoke; effectsStarted is at minimum UNKNOWN — never zero — await the execution result (refusal paths carry the port cleanup truth)' }
      }
      return { ok: true, settled: 'UNKNOWN-IN-FLIGHT', bodyOutcome: 'unknown — the body has been entered and its effect boundary is inside it; this arm claims neither zero nor committed (await the execution result)' }
    }
    if (entry.state === 'FAILED-UNKNOWN' || entry.state === 'COMMIT-UNKNOWN') {
      return { ok: true, settled: 'COMMIT-UNKNOWN', bodyOutcome: 'unknown — the body was entered and reported failure; the effect boundary is inside the native body' }
    }
    const edgeReached = entry.state === 'CLAIMED'
    const wasAdmitted = edgeReached || entry.state === 'PREPARED' || entry.state === 'REFUSED-AT-ENTRY'
    entry.state = 'CANCELLED'
    observe({ event: 'cancel', correlation: entry.correlation, detail: edgeReached ? 'at-edge' : wasAdmitted ? 'after-admission' : 'before-admission' })
    return {
      ok: true,
      settled: edgeReached ? 'CANCELLED-BEFORE-EXECUTION' : wasAdmitted ? 'CANCELLED-AFTER-ADMISSION' : 'CANCELLED-BEFORE-ADMISSION',
      bodyOutcome: 'zero — the body never ran (a CLAIMED plan is stopped by the commit-edge re-check; a PREPARED/CLASSIFIED plan never reaches an edge)',
    }
  }

  /** UNCLEARED FACTS, not a ledger: every plan whose body entered or may
   *  still enter, plus every background job the arm learned about and has
   *  NO settlement evidence for. Read-only observability — never authority. */
  function inFlight() {
    const live = []
    for (const entry of trackedEntries) {
      const open = entry.state === 'CLASSIFIED' || entry.state === 'PREPARED' || entry.state === 'CLAIMED' || entry.state === 'EXECUTING'
      // A refusal AFTER effects started is NOT settled business: the
      // started resource and the missing settlement evidence stay visible
      // (UNCLEARED FACTS law — refusal is not settlement).
      const refusedWithEffects = entry.refusedWithEffects === true
      if (open || refusedWithEffects || entry.backgroundJobId !== null || entry.handle !== null) {
        live.push(Object.freeze({
          correlation: entry.correlation,
          toolName,
          state: entry.state,
          ...(entry.startedFact !== null && entry.startedFact !== undefined ? { startedFact: entry.startedFact } : {}),
          backgroundJobId: entry.backgroundJobId,
          // HANDLE OWNERSHIP: the identity the REAL face answered (service
          // session/pid/jobId), recorded from the handle — never claimed.
          handleIdentity: entry.handle !== null && entry.handle.identity !== null && typeof entry.handle.identity === 'object'
            ? Object.freeze({ ...entry.handle.identity })
            : null,
          settlementEvidence: entry.settlementOverride ?? (entry.backgroundJobId !== null ? 'none observed by this arm — the host jobs record owns it' : null),
          // CARD 3 bookkeeping stays VISIBLE (observability, never authority):
          // a registered pending cancellation until it settles, and the
          // evidence of how it settled after that.
          ...(entry.cancelPending === true ? { cancelPending: true } : {}),
          ...(entry.cancelPendingSettled !== null ? { cancelPendingSettled: entry.cancelPendingSettled } : {}),
        }))
      }
    }
    return live
  }

  /**
   * DRAIN = a prohibition on NEW calls, NOT a resource settlement. A body
   * already in flight is not rewound; a REAL handle (a spawned PTY session,
   * a live send operation), a native background job (host jobs.start) or a
   * PTY process tree STAYS LIVE until its own kill/close evidence — and
   * where the family carries a control port with a live inventory, THAT
   * answer rides the drain word verbatim. The return value states exactly
   * what this word controls.
   */
  function drain() {
    draining = true
    const facts = inFlight()
    return Object.freeze({
      draining: true,
      controls: 'new-call prohibition only — no resource is settled by this word',
      inFlightCount: facts.filter((f) => f.state !== 'COMMITTED').length,
      unsettledBackgroundJobIds: Object.freeze(facts.filter((f) => f.backgroundJobId !== null).map((f) => f.backgroundJobId)),
      liveHandleIdentities: Object.freeze(facts.filter((f) => f.handleIdentity !== null).map((f) => f.handleIdentity)),
      liveHandlesAnswer: controlPort !== null && typeof controlPort.liveHandles === 'function'
        ? Object.freeze(controlPort.liveHandles(memberAgentId))
        : null,
    })
  }

  return {
    familyId,
    adapterRevision: A5_G3_ADAPTER_REVISION,
    toolName,
    definitionIdentity,
    providerId,
    declaredAbsent,
    parametersFace,
    classify,
    prepare,
    execute,
    cancel,
    inFlight,
    drain,
  }
}

// ── per-tool pure validators (targets ride SERVICE facts, never claims) ────

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0

/**
 * THE APPROVED-ENVELOPE DIGEST: a canonical hash of the controlled OPEN
 * PLAN as approved. It is a convenience correlation only — the port
 * RE-VERIFIES it against the ACTUAL pinned launch spec handed to the
 * controlled spawn seam (the plan that RAN, not the plan that was said).
 */
/**
 * NORMALIZED LAUNCH ENVELOPE (root 16:2x problem 1): digest what WILL spawn.
 * executable->argv normalization, the request cwd override, and the
 * subprocess terminal-type default ('dumb') apply BEFORE the digest is
 * computed, so the approved digest, the claim-time recheck and the pinned
 * launch spec are the SAME canonical shape: a post-digest mutation is
 * impossible by construction, and a plan that cannot reach canonical form
 * refuses BEFORE any spawn, never after.
 */
function canonicalOpenPlan(plan, canonical = {}) {
  const argv = Array.isArray(plan?.argv) && plan.argv.length > 0 && plan.argv.every((a) => typeof a === 'string' && a.length > 0)
    ? [...plan.argv]
    : (typeof plan?.executable === 'string' && plan.executable.length > 0
      ? [plan.executable, ...(plan.argv0 !== undefined ? [plan.argv0] : [])]
      : null)
  if (argv === null) return null
  const env = plan.env === null || plan.env === undefined
    ? null
    : Object.fromEntries(Object.keys(plan.env).sort().map((k) => [k, plan.env[k]]))
  return {
    argv,
    cwd: typeof canonical.cwd === 'string' && canonical.cwd.length > 0 ? canonical.cwd : plan.cwd,
    ...(env === null ? {} : { env }),
    rows: plan.rows,
    cols: plan.cols,
    terminalType: plan.terminalType ?? 'dumb',
    graceMs: plan.graceMs,
  }
}

function approvedOpenPlanDigest(plan, canonical = {}) {
  const canon = canonicalOpenPlan(plan, canonical)
  if (canon === null) return 'sha256:UNRESOLVED'
  return 'sha256:' + createHash('sha256').update(JSON.stringify(canon)).digest('hex')
}

/**
 * terminal_open — M0-B §5.1: the target carries the public backend's CURRENT
 * service registration identity/incarnation + the process/IO envelope, read
 * from the injected `ptyService.backend(type)`; the model's `type` string
 * only SELECTS among DECLARED public backends and never substitutes for the
 * facts. Internal per-open types (§5.1, CENTER-minted) are outside the
 * declared surface by construction.
 */
function validateTerminalOpen(args, h) {
  const { refuse, serviceFacts, callId } = h
  if (!isNonEmptyString(args.type)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'type must be a non-empty string (the declared backend type)')
  if (!h.declaredBackends.includes(args.type)) {
    return refuse('P_TERM_CLASSIFY_BACKEND_NOT_DECLARED', `backend type ${JSON.stringify(args.type)} is not a declared public backend of this mount (${h.declaredBackends.join('|')}) — an internal per-open type is never model-selectable`)
  }
  if (args.name !== undefined && typeof args.name !== 'string') return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'name must be a string')
  if (args.name !== undefined && args.name.length === 0) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'name must be non-empty when present (host law)')
  if (args.cwd !== undefined && typeof args.cwd !== 'string') return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'cwd must be a string')
  const bf = serviceFacts?.backend?.(args.type) ?? null
  if (bf === null || typeof bf.registrationId !== 'string' || typeof bf.incarnation !== 'string') {
    return refuse('P_TERM_TARGET_UNRESOLVED', `the terminals service does not currently register public backend ${JSON.stringify(args.type)} (registrationId/incarnation unreadable): an unresolved target is refused, never guessed from the model's type string`)
  }
  // §5.1 GOVERNANCE CORE (root 15:09 route, pinned on the REAL 639 surface):
  // what the admission covers is the PER-OPEN CONTROLLED EXECUTION PLAN —
  // the restricted process plan (executable source or exact argv, cwd, env,
  // terminal dims, grace) that the one-shot private backend — minted per
  // open via TerminalSessionService.registerBackend — will ACTUALLY execute
  // through the controlled SubprocessRuntime.spawnTerminal seam. The plan
  // MUST be answerable for THIS exact call (correlated by callId); the
  // digest rides as a convenience and is RE-VERIFIED against the ACTUAL
  // pinned launch spec at the entry — a claim is never the envelope. The
  // public `type` only SELECTS the declared backend family; it is never the
  // governed target, and a mount whose seam cannot answer the plan is not
  // the §5.1 backend: TARGET_UNRESOLVED, not a public-type spawn dressed
  // as governance.
  const po = serviceFacts?.approvedOpenPlan?.(callId) ?? null
  const poPlan = po?.plan ?? null
  const poExecutableOk = poPlan !== null && (
    (typeof poPlan.executable === 'string' && poPlan.executable.length > 0)
    || (Array.isArray(poPlan.argv) && poPlan.argv.length > 0 && poPlan.argv.every((a) => typeof a === 'string' && a.length > 0))
  )
  if (po === null || !poExecutableOk
    || typeof poPlan.cwd !== 'string' || poPlan.cwd.length === 0
    || !Number.isInteger(poPlan.rows) || poPlan.rows <= 0 || !Number.isInteger(poPlan.cols) || poPlan.cols <= 0
    || !Number.isInteger(poPlan.graceMs) || poPlan.graceMs < 0) {
    return refuse('P_TERM_TARGET_UNRESOLVED', `no approved controlled OPEN PLAN (executable-or-argv, cwd, rows, cols, graceMs — the plan the per-open backend will actually pin into SubprocessRuntime.spawnTerminal) is answerable for call ${JSON.stringify(callId)}: §5.1 governs the per-open controlled execution plan behind the one-shot registerBackend registration — the public type alone never spawns under governance`)
  }
  const poEnvelopeDigest = typeof po.envelopeDigest === 'string' && po.envelopeDigest.length > 0
    ? po.envelopeDigest
    : approvedOpenPlanDigest(poPlan, { ...(args.cwd !== undefined ? { cwd: args.cwd } : {}) })
  const canonical = { type: args.type, ...(args.name !== undefined ? { name: args.name } : {}), ...(args.cwd !== undefined ? { cwd: args.cwd } : {}) }
  return {
    ok: true,
    canonical,
    operation: 'pty-spawn',
    manifest: {
      backendTarget: Object.freeze({
        publicType: args.type,
        serviceRegistrationId: bf.registrationId,
        serviceIncarnation: bf.incarnation,
        processEnvelope: bf.processEnvelope ?? null,
      }),
      // THE governed target: the approved controlled execution plan + its
      // envelope digest (integrator seam; correlated to this exact call).
      // The digest is RE-VERIFIED against the ACTUAL pinned launch spec.
      perOpenBackend: Object.freeze({
        approvedPlan: Object.freeze(JSON.parse(JSON.stringify(poPlan))),
        envelopeDigest: poEnvelopeDigest,
      }),
      // §5.1 correlation: CENTER mints the per-open PRIVATE one-shot backend
      // registration for this exact call; the arm records the correlation
      // duty and never a model-visible internal type.
      perOpenCorrelationCallId: callId,
      ...(args.name !== undefined ? { sessionName: args.name } : {}),
      ...(args.cwd !== undefined ? { requestedCwd: args.cwd } : {}),
      effectDelta: Object.freeze(['os-pty-spawn-shell', 'process-io-envelope']),
    },
    recheckTarget: () => {
      const now = serviceFacts?.backend?.(args.type) ?? null
      if (now === null || now.registrationId !== bf.registrationId || now.incarnation !== bf.incarnation) {
        return { ok: false, code: 'P_TERM_TARGET_DRIFT', detail: `the backend registration/incarnation moved between approval and the entry (${bf.registrationId}@${bf.incarnation} -> ${now === null ? 'unresolvable' : `${now.registrationId}@${now.incarnation}`})` }
      }
      const nowPo = serviceFacts?.approvedOpenPlan?.(callId) ?? null
      const nowDigest = nowPo === null || nowPo?.plan === undefined || nowPo?.plan === null
        ? null
        : (typeof nowPo.envelopeDigest === 'string' && nowPo.envelopeDigest.length > 0 ? nowPo.envelopeDigest : approvedOpenPlanDigest(nowPo.plan, { ...(args.cwd !== undefined ? { cwd: args.cwd } : {}) }))
      if (nowDigest === null || nowDigest !== poEnvelopeDigest) {
        return { ok: false, code: 'P_TERM_TARGET_DRIFT', detail: `the approved controlled open plan / envelope digest moved between approval and the entry (${poEnvelopeDigest} -> ${nowDigest ?? 'unresolvable'})` }
      }
      return { ok: true }
    },
  }
}

/** send/read/signal/close: the PTY INCARNATION comes from the SERVICE,
 *  paired against the OWNING member agent; a sessionId the service cannot
 *  resolve is an unresolved target (a sessionId alone never authorizes). */
function ptySessionTarget(h, sessionId) {
  const sf = h.serviceFacts?.session?.(h.memberAgentId, sessionId) ?? null
  if (sf === null || typeof sf.incarnation !== 'string') {
    return { refusal: h.refuse('P_TERM_TARGET_UNRESOLVED', `the terminals service does not resolve session ${JSON.stringify(sessionId)} for the owning agent (unknown, foreign, or disposed): a sessionId alone never authorizes — the service facts do`) }
  }
  return { sf }
}

function ptySessionRecheck(h, sessionId, sf) {
  return () => {
    const now = h.serviceFacts?.session?.(h.memberAgentId, sessionId) ?? null
    if (now === null || now.incarnation !== sf.incarnation) {
      return { ok: false, code: 'P_TERM_TARGET_DRIFT', detail: `the PTY incarnation moved (or the session died) between approval and the entry (${sf.incarnation} -> ${now === null ? 'unresolvable' : now.incarnation})` }
    }
    return { ok: true }
  }
}

function validateTerminalSend(args, h) {
  const { refuse, sha256 } = h
  if (!isNonEmptyString(args.sessionId)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'sessionId must be a non-empty string')
  if (typeof args.text !== 'string') return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'text must be a string (empty input is lawful — Enter-only submits)')
  if (args.submit !== undefined && typeof args.submit !== 'boolean') return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'submit must be a boolean')
  if (args.run_in_background !== undefined && typeof args.run_in_background !== 'boolean') return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'run_in_background must be a boolean')
  const { refusal, sf } = ptySessionTarget(h, args.sessionId)
  if (refusal !== undefined) return refusal
  const background = args.run_in_background === true
  const canonical = { sessionId: args.sessionId, text: args.text, ...(args.submit !== undefined ? { submit: args.submit } : {}), ...(args.run_in_background !== undefined ? { run_in_background: args.run_in_background } : {}) }
  return {
    ok: true,
    canonical,
    operation: 'stdin-write',
    manifest: {
      ptyTarget: Object.freeze({
        sessionId: args.sessionId,
        serviceIncarnation: sf.incarnation,
        serviceStatus: sf.status ?? null,
        serviceEnvelope: sf.envelope ?? null,
      }),
      // The effective submit is the HOST default lifted for the manifest
      // ONLY; the canonical args keep the caller's omission so the captured
      // body still owns the default.
      effectiveSubmit: args.submit !== false,
      background,
      // A background send starts a HOST jobs record (jobs.start, owner = the
      // agent id); its lifecycle is owned by the jobs face — never cleared
      // by this call's word and never by drain.
      backgroundJobTarget: background ? 'host jobs.start at spawn; lifecycle owned by job_output/job_kill, uncleared by this arm' : null,
      inputDigest: `sha256:${sha256(args.text)}`,
      inputBytes: new TextEncoder().encode(args.text).length,
      effectDelta: Object.freeze(['shell-input-injection-stdin', ...(background ? ['bg-pty-send-jobs'] : [])]),
    },
    recheckTarget: ptySessionRecheck(h, args.sessionId, sf),
  }
}

function validateTerminalRead(args, h) {
  const { refuse } = h
  if (!isNonEmptyString(args.sessionId)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'sessionId must be a non-empty string')
  if (args.offset !== undefined && (typeof args.offset !== 'number' || !Number.isFinite(args.offset) || args.offset < 0)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'offset must be a non-negative finite number when present')
  if (args.count !== undefined && (typeof args.count !== 'number' || !Number.isFinite(args.count) || args.count <= 0)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'count must be a positive finite number when present')
  const { refusal, sf } = ptySessionTarget(h, args.sessionId)
  if (refusal !== undefined) return refusal
  const canonical = { sessionId: args.sessionId, ...(args.offset !== undefined ? { offset: args.offset } : {}), ...(args.count !== undefined ? { count: args.count } : {}) }
  return {
    ok: true,
    // Bounded output-window read; the omission stays an omission (the host
    // default belongs to the body — the null-preserving law).
    canonical,
    operation: 'output-read',
    manifest: {
      ptyTarget: Object.freeze({ sessionId: args.sessionId, serviceIncarnation: sf.incarnation, serviceStatus: sf.status ?? null }),
      offset: args.offset ?? null,
      count: args.count ?? null,
    },
    recheckTarget: ptySessionRecheck(h, args.sessionId, sf),
  }
}

function validateTerminalSignal(args, h) {
  const { refuse } = h
  if (!isNonEmptyString(args.sessionId)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'sessionId must be a non-empty string')
  if (!A5_G3_TERMINAL_SIGNALS.includes(args.signal)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', `signal must be one of ${A5_G3_TERMINAL_SIGNALS.join('|')}`)
  const { refusal, sf } = ptySessionTarget(h, args.sessionId)
  if (refusal !== undefined) return refusal
  return {
    ok: true,
    canonical: { sessionId: args.sessionId, signal: args.signal },
    operation: 'signal',
    manifest: {
      ptyTarget: Object.freeze({ sessionId: args.sessionId, serviceIncarnation: sf.incarnation, serviceStatus: sf.status ?? null }),
      signal: args.signal,
      // The shell-target SIGKILL refusal is the service's OWN law — the
      // manifest records the intent against the exact incarnation; the
      // service grades it.
      effectDelta: Object.freeze(['os-signal-to-process-group']),
    },
    recheckTarget: ptySessionRecheck(h, args.sessionId, sf),
  }
}

function validateTerminalClose(args, h) {
  const { refuse } = h
  if (!isNonEmptyString(args.sessionId)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'sessionId must be a non-empty string')
  const { refusal, sf } = ptySessionTarget(h, args.sessionId)
  if (refusal !== undefined) return refusal
  return {
    ok: true,
    canonical: { sessionId: args.sessionId },
    operation: 'close',
    manifest: {
      ptyTarget: Object.freeze({ sessionId: args.sessionId, serviceIncarnation: sf.incarnation, serviceStatus: sf.status ?? null }),
      effectDelta: Object.freeze(['owned-process-tree-kill']),
      // Termination EVIDENCE is the service close result; the arm never
      // claims the process tree died before it answers.
      settlementEvidence: 'the service close outcome (closed | already-closing) is the only termination word',
    },
    // CLOSE is the one operation that stays lawful when the service already
    // lost the record (the already-closing shape): NO drift refusal — the
    // body/service grades it at the entry.
    recheckTarget: () => ({ ok: true }),
  }
}

function validateTerminalList() {
  return {
    ok: true,
    canonical: {},
    operation: 'list',
    manifest: { ownerScoped: true },
  }
}

/**
 * lsp — M0-B §5.2: the target is the language-service INSTANCE facts (server
 * binary identity + generation) and the DOCUMENT facts (canonical locator +
 * revision) from the injected `lspFacts` reader, plus the workspace identity
 * (the REAL host sessionCwd path) and the realm. F(read project-scope) is a
 * grammar-valid `read` effect on the document resource — the closed effect
 * set gets no invented kinds.
 */
function validateLsp(args, h) {
  const { refuse, serviceFacts, realmId, exec } = h
  if (!A5_G3_LSP_OPERATIONS.includes(args.operation)) {
    return refuse('P_LSP_CLASSIFY_INVALID_ARGUMENTS', `operation must be one of ${A5_G3_LSP_OPERATIONS.join('|')} — the closed navigation set; there is no diagnostics/executeCommand/generic fallback on this face`)
  }
  if (typeof args.file_path !== 'string' || args.file_path.trim().length === 0) {
    return refuse('P_LSP_CLASSIFY_INVALID_ARGUMENTS', 'file_path must be a non-empty string')
  }
  // ONE-BASED UTF-16 law exactly as the host authored it; the zero-based
  // conversion stays the captured body's parseLspArgs.
  if (typeof args.line !== 'number' || !Number.isInteger(args.line) || args.line < 1) {
    return refuse('P_LSP_CLASSIFY_INVALID_ARGUMENTS', 'line must be an integer >= 1 (one-based)')
  }
  if (typeof args.character !== 'number' || !Number.isInteger(args.character) || args.character < 1) {
    return refuse('P_LSP_CLASSIFY_INVALID_ARGUMENTS', 'character must be an integer >= 1 (one-based UTF-16)')
  }
  const server = serviceFacts?.server?.() ?? null
  if (server === null || typeof server.binaryIdentity !== 'string' || typeof server.generation !== 'string') {
    return refuse('P_LSP_TARGET_UNRESOLVED', 'the LSP assembly does not answer a current server identity/generation for this member scope: an unresolved server is refused, never substituted by a bare-process reach')
  }
  const workspaceRoot = typeof exec?.agent?.session?.header?.cwd === 'string' ? exec.agent.session.header.cwd : null
  if (workspaceRoot === null) {
    return refuse('P_LSP_TARGET_UNRESOLVED', 'no real exec.agent.session.header.cwd (the host sessionCwd face): the workspace identity is a service fact, not a guess')
  }
  const doc = serviceFacts?.document?.(args.file_path, workspaceRoot) ?? null
  if (doc === null || typeof doc.canonicalLocator !== 'string' || !['workspace', 'absolute-path'].includes(doc.kind)) {
    return refuse('P_LSP_TARGET_UNRESOLVED', `the document target for ${JSON.stringify(args.file_path)} is unresolvable (canonical locator/kind missing): an unresolvable target is refused`)
  }
  // §5.2 REALM + cross-file SCOPE as REAL interface obligations: the
  // assembly adapter OWNS the realm-scoped document answers (realmId +
  // workspaceScope + scope per document) — these obligations do NOT
  // downgrade to facts-only. The document answer must carry them, the realm
  // must be the BOUND realm, and the cross-file scope answer must be
  // 'inside'; the same pair is re-verified at the entry (a document whose
  // realm/scope moves between approval and the entry refuses with zero
  // body). NO public controlled entry produces these answers at
  // 639ed01539: the host has no LSP service (checked), and this tree's
  // sandbox-provider/lsp-assembly.ts owns per-realm confined instances +
  // generation without ever answering a document's realm/scope — the
  // MISSING capability is a realm-scoped document-target resolver over that
  // seam (integrator adapter); until then this arm is control-plane-only.
  if (serviceFacts?.documentRealm === undefined || serviceFacts?.documentScope === undefined) {
    return refuse('P_LSP_TARGET_UNRESOLVED', 'the §5.2 assembly adapter must answer documentRealm(locator, workspaceRoot) and documentScope(locator, workspaceRoot): realm and cross-file scope are INTERFACE OBLIGATIONS, not optional facts — a facts-only provider is not the §5.2 implementation')
  }
  const docRealm = serviceFacts.documentRealm(doc.canonicalLocator, workspaceRoot)
  const docScope = serviceFacts.documentScope(doc.canonicalLocator, workspaceRoot)
  if (docRealm !== realmId) {
    return refuse('P_LSP_REALM_SCOPE_ESCAPED', `the assembly adapter answers document ${JSON.stringify(doc.canonicalLocator)} under realm ${JSON.stringify(String(docRealm ?? null))}, not the bound realm ${JSON.stringify(realmId)}: cross-realm navigation is refused before any body`)
  }
  if (docScope !== 'inside') {
    return refuse('P_LSP_REALM_SCOPE_ESCAPED', `the assembly adapter answers the cross-file scope of ${JSON.stringify(doc.canonicalLocator)} as ${JSON.stringify(String(docScope ?? null))} (only 'inside' authorizes navigation): the scope obligation answers, the arm enforces`)
  }
  const resource = Object.freeze({ realmId, kind: doc.kind, canonicalLocator: doc.canonicalLocator, rights: Object.freeze(['read']) })
  const canonical = { operation: args.operation, file_path: args.file_path, line: args.line, character: args.character }
  return {
    ok: true,
    canonical,
    operation: args.operation,
    // F(read project-scope): the query reads the document through the
    // confined server — a real read effect on the resolved resource.
    effects: [Object.freeze({ kind: 'read', resource })],
    manifest: {
      navigationOperation: args.operation,
      workspaceIdentity: Object.freeze({ sessionHeaderCwd: workspaceRoot }),
      documentTarget: Object.freeze({ kind: doc.kind, canonicalLocator: doc.canonicalLocator, revision: doc.revision ?? null }),
      serverTarget: Object.freeze({ binaryIdentity: server.binaryIdentity, generation: server.generation }),
      policyGeneration: h.generations?.policyGeneration ?? null,
      // Model-facing ONE-based coordinates ride the manifest UNCHANGED.
      oneBasedLine: args.line,
      oneBasedCharacter: args.character,
    },
    recheckTarget: () => {
      const nowServer = serviceFacts?.server?.() ?? null
      if (nowServer === null || nowServer.generation !== server.generation || nowServer.binaryIdentity !== server.binaryIdentity) {
        return { ok: false, code: 'P_LSP_TARGET_DRIFT', detail: 'the server identity/generation moved between approval and the entry (a policy generation change disposes the realm)' }
      }
      const nowDoc = serviceFacts?.document?.(args.file_path, workspaceRoot) ?? null
      if (nowDoc === null || nowDoc.revision !== (doc.revision ?? null)) {
        return { ok: false, code: 'P_LSP_TARGET_DRIFT', detail: 'the document revision moved between approval and the entry: the navigation would answer a different file than the one approved' }
      }
      const nowRealm = serviceFacts.documentRealm(nowDoc.canonicalLocator, workspaceRoot)
      if (nowRealm !== realmId) {
        return { ok: false, code: 'P_LSP_REALM_SCOPE_ESCAPED', detail: `the document's realm answer moved to ${JSON.stringify(String(nowRealm ?? null))} between approval and the entry: navigation only runs inside the bound realm` }
      }
      const nowScope = serviceFacts.documentScope(nowDoc.canonicalLocator, workspaceRoot)
      if (nowScope !== 'inside') {
        return { ok: false, code: 'P_LSP_REALM_SCOPE_ESCAPED', detail: `the cross-file scope answer moved to ${JSON.stringify(String(nowScope ?? null))} between approval and the entry: the approved scope is not the live scope` }
      }
      return { ok: true }
    },
  }
}

/**
 * run_code outer arm — the target carries the interpreter/provider identity,
 * the EFFECTIVE execution envelope, and the REAL child-channel facts from
 * the injected `ptcFacts` reader (capability list + digest + concurrency
 * bound + per-run budget). Escalation args stay DATA (pair-law, mode from
 * the ONE pinned vocabulary, justification as digest only).
 */
function validateRunCode(args, h) {
  const { refuse, sha256, serviceFacts } = h
  if (typeof args.code !== 'string' || args.code.length === 0) {
    return refuse('P_PTC_CLASSIFY_INVALID_ARGUMENTS', 'code must be a non-empty string')
  }
  // THE REAL BUDGET/ENVELOPE LAW (root final ruling): a null/empty envelope
  // answer is NOT an implementation. The EFFECTIVE mode (host
  // resolveSandboxPolicy/exec-agent face), the ENFORCEMENT ANSWER (host
  // SandboxEnforcement — 'full' | 'partial' — or an explicit non-empty
  // string; null/empty never passes), and the REAL dispatch budget
  // (maxParallelSubCalls: the registry's validated concurrency cap, host
  // tools index.ts:693 default 10; runDispatchBudget: this tree's
  // child-channel bound — POSITIVE FINITE NUMBERS, never null) are
  // mandatory facts: an unevidenced envelope refuses TYPED and the run
  // never proceeds behind a bare claim.
  const budgetProblem = (channel) => {
    if (channel === null || typeof channel !== 'object') return 'the child-channel answer is absent'
    if (!Number.isFinite(channel.maxParallelSubCalls) || channel.maxParallelSubCalls <= 0) {
      return `maxParallelSubCalls is not a positive finite number (${JSON.stringify(channel.maxParallelSubCalls ?? null)})`
    }
    if (!Number.isFinite(channel.runDispatchBudget) || channel.runDispatchBudget <= 0) {
      return `runDispatchBudget is not a positive finite number (${JSON.stringify(channel.runDispatchBudget ?? null)})`
    }
    return null
  }
  const envelopeProblem = (env) => {
    if (env === null || typeof env !== 'object') return 'the EFFECTIVE envelope answer is absent'
    if (typeof env.mode !== 'string' || env.mode.length === 0) return `the EFFECTIVE mode is not a non-empty string (${JSON.stringify(env.mode ?? null)})`
    if (typeof env.enforcement === 'string' && env.enforcement.length === 0) return 'the enforcement answer is an empty string'
    if (env.enforcement !== 'full' && env.enforcement !== 'partial' && !(typeof env.enforcement === 'string' && env.enforcement.length > 0)) {
      return `the enforcement answer is neither the host SandboxEnforcement ('full'|'partial') nor an explicit non-empty string (${JSON.stringify(env.enforcement ?? null)})`
    }
    return null
  }
  // Fail-fast shape laws (unchanged pair-law surface)...
  if (typeof args.description !== 'string' || args.description.trim().length === 0) {
    return refuse('P_PTC_CLASSIFY_INVALID_ARGUMENTS', 'description must be a non-empty string (host law)')
  }
  if (args.timeoutMs !== undefined && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) {
    return refuse('P_PTC_CLASSIFY_INVALID_ARGUMENTS', 'timeoutMs must be a positive finite number when present')
  }
  const hasMode = args.sandbox_permissions !== undefined
  const hasJustification = args.justification !== undefined
  if (hasMode !== hasJustification) {
    return refuse('P_PTC_CLASSIFY_ESCALATION_ARGS_INVALID', 'sandbox_permissions and justification are ONE unit (the host validateEscalationArgs pair-law): a wider mode without its shown reason — or a reason without a mode — is refused typed here')
  }
  if (hasMode && !PTC_ESCALATION_MODES.includes(args.sandbox_permissions)) {
    return refuse('P_PTC_CLASSIFY_ESCALATION_ARGS_INVALID', `sandbox_permissions must be one of ${PTC_ESCALATION_MODES.join('|')} (the pinned SandboxMode vocabulary, one source)`)
  }
  if (hasJustification && (typeof args.justification !== 'string' || args.justification.trim().length === 0)) {
    return refuse('P_PTC_CLASSIFY_ESCALATION_ARGS_INVALID', 'justification must be a non-empty string when present')
  }
  const facts = serviceFacts?.() ?? null
  const interp = facts?.interpreter ?? null
  const channel = facts?.childChannel ?? null
  if (facts === null || interp === null || typeof interp.runtimeIdentity !== 'string' || typeof interp.language !== 'string' || channel === null || !Array.isArray(channel.capabilityList) || typeof channel.channelDigest !== 'string') {
    return refuse('P_PTC_TARGET_UNRESOLVED', 'the PTC provider does not answer current interpreter identity + child-channel facts: the run is refused, never run against an unattributed runtime or an unenumerated child channel')
  }
  const envProblem = envelopeProblem(facts.effectiveEnvelope ?? null)
  if (envProblem !== null) {
    return refuse('P_PTC_ENVELOPE_UNEVIDENCED', `${envProblem}: an unevidenced EFFECTIVE envelope is not an implementation (root ruling) — the run refuses rather than executing behind an unenforced claim`)
  }
  const budgetIssue = budgetProblem(channel)
  if (budgetIssue !== null) {
    return refuse('P_PTC_ENVELOPE_UNEVIDENCED', `the REAL dispatch budget is not evidenced (${budgetIssue}): null/absent budget does not count — the host registry answers a validated positive cap (index.ts:693)`)
  }
  const canonical = {
    code: args.code,
    description: args.description,
    ...(args.timeoutMs !== undefined ? { timeoutMs: args.timeoutMs } : {}),
    ...(hasMode ? { sandbox_permissions: args.sandbox_permissions, justification: args.justification } : {}),
  }
  return {
    ok: true,
    canonical,
    operation: 'program-run',
    manifest: {
      interpreterTarget: Object.freeze({ runtimeIdentity: interp.runtimeIdentity, language: interp.language }),
      effectiveEnvelope: Object.freeze({ mode: facts.effectiveEnvelope.mode, enforcement: facts.effectiveEnvelope.enforcement }),
      timeoutPolicy: facts.timeout ?? null,
      // REAL channel facts (a boolean stand-in was ruled NOT evidence):
      // what the program can reach through tools.* right now, and the
      // concurrency/budget the bridge enforces. Every child call still
      // rides its OWN admission through the registry — the channel list is
      // reachability, never a carried grant.
      childChannel: Object.freeze({
        capabilityList: Object.freeze(channel.capabilityList.slice().sort()),
        capabilityCount: channel.capabilityList.length,
        channelDigest: channel.channelDigest,
        maxParallelSubCalls: channel.maxParallelSubCalls,
        runDispatchBudget: channel.runDispatchBudget,
        lineageFacts: 'sub-dispatch parents ride exec.token and share exec.rootCallId (faithful exec forward)',
      }),
      codeDigest: `sha256:${sha256(args.code)}`,
      descriptionDigest: `sha256:${sha256(args.description)}`,
      timeoutMs: args.timeoutMs ?? null,
      // The escalation request is MANIFEST DATA (mode + digest); its answer
      // lives ONLY in the mounted escalation bridge.
      requestedSandboxMode: hasMode ? args.sandbox_permissions : null,
      justificationDigest: hasJustification ? `sha256:${sha256(args.justification)}` : null,
      effectDelta: Object.freeze(['fs-ladder-once-grant', 'nested-tools-second-governance']),
    },
    recheckTarget: () => {
      const now = serviceFacts?.() ?? null
      const nowInterp = now?.interpreter ?? null
      const nowChannel = now?.childChannel ?? null
      // THE ENVELOPE/BUDGET LAW IS RE-ANSWERED FIRST at the entry: an answer
      // that stopped being evidenced carries the ROOT ruling code, never the
      // generic drift code (the same law that refused it at classify).
      const nowEnvelopeProblem = envelopeProblem(now?.effectiveEnvelope ?? null)
      if (nowEnvelopeProblem !== null) {
        return { ok: false, code: 'P_PTC_ENVELOPE_UNEVIDENCED', detail: `the EFFECTIVE envelope stopped being evidenced between approval and the entry (${nowEnvelopeProblem}): the entry runs only under a live, evidenced envelope` }
      }
      const nowBudgetProblem = budgetProblem(nowChannel)
      if (nowBudgetProblem !== null) {
        return { ok: false, code: 'P_PTC_ENVELOPE_UNEVIDENCED', detail: `the REAL dispatch budget stopped being evidenced between approval and the entry (${nowBudgetProblem})` }
      }
      if (nowInterp === null || nowInterp.runtimeIdentity !== interp.runtimeIdentity) {
        return { ok: false, code: 'P_PTC_TARGET_DRIFT', detail: 'the interpreter/provider identity moved between approval and the entry' }
      }
      if (nowChannel === null || nowChannel.channelDigest !== channel.channelDigest) {
        return { ok: false, code: 'P_PTC_TARGET_DRIFT', detail: 'the child-channel capability set moved between approval and the entry: the approved reach is not the live reach' }
      }
      if ((now?.effectiveEnvelope?.mode ?? null) !== (facts.effectiveEnvelope?.mode ?? null)) {
        return { ok: false, code: 'P_PTC_TARGET_DRIFT', detail: 'the EFFECTIVE execution envelope moved between approval and the entry' }
      }
      return { ok: true }
    },
  }
}

// ── family factories (CENTER consumes these; no registration lives here) ───

/** Assembly-time drift audit: a captured face whose enum no longer matches
 *  the pin is a CONFIG DEFECT at assembly (the pin test goes red first; the
 *  arm refuses to carry a mismatched face silently). */
function assertCapturedEnum(toolName, paramName, captured, pinned) {
  if (captured === undefined) return
  if (JSON.stringify(captured) !== JSON.stringify([...pinned])) {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: the captured definition's ${paramName} enum ${JSON.stringify(captured)} no longer matches the pinned ${JSON.stringify(pinned)} — re-derive from the new host release before mounting`)
  }
}

/**
 * The six B-TERMINAL arms over the six captured native definitions.
 *
 * @param deps.nativeDefinitions - toolName → captured definition object
 *   (execute + AUTHORED parameters spec); a MISSING/null entry is the
 *   declared-absent shape for THAT tool (typed refusal, zero reach).
 * @param deps.definitionIdentities - toolName → bind-time identity.
 * @param deps.liveDefinitions - toolName → () => {definitionIdentity}|null
 *   (the integrator's CURRENT placement read; the entry re-verify consumes
 *   it). Required exactly for tools with a captured definition.
 * @param deps.declaredBackends - the DECLARED public backend types (model
 *   selection surface, §5.1). Internal per-open types never enter.
 * @param deps.ptyService - the terminals-service current-facts reader:
 *   backend(type) => {registrationId, incarnation, processEnvelope}|null and
 *   session(ownerAgentId, sessionId) => {incarnation, status, envelope}|null.
 *   Target identity/incarnation facts come from HERE, never from model
 *   claims.
 * @param deps.controlPort - optional REAL handle route (see
 *   createHostTerminalControlPort): when it answers a handle, the HANDLE
 *   executes and its answer commits; its terminate is the real control face
 *   and its liveHandles answer rides drain. Absent = control-plane-only over
 *   the captured body (honest, not fake — and not the §5.1 implementation).
 * …plus the shared pairing/binding/realm deps (see createDelegateArm).
 */
export function createGovernedTerminalArms(deps) {
  const { nativeDefinitions = {}, declaredBackends, ptyService } = deps
  if (!Array.isArray(declaredBackends) || declaredBackends.length === 0
    || declaredBackends.some((t) => typeof t !== 'string' || t.length === 0)) {
    throw new TypeError('g3-fsproc-adapters/terminal: declaredBackends must be a non-empty array of non-empty public backend types (declared_mount law; never empty, never internal)')
  }
  if (ptyService === null || typeof ptyService.backend !== 'function' || typeof ptyService.session !== 'function') {
    throw new TypeError('g3-fsproc-adapters/terminal: ptyService {backend, session} is required — target identity/incarnation must be CURRENT service facts, not model claims')
  }
  // §5.1 GOVERNANCE INTERFACE (root ruling 66a521): the seam MUST answer the
  // PER-OPEN private controlled-backend registration + approved envelope for
  // a call. A seam that cannot answer it is not the §5.1 backend feed:
  // assembly REFUSES (the row would otherwise die at every classify with a
  // fake look of life); the refusal names the missing capability.
  if (typeof ptyService.approvedOpenPlan !== 'function') {
    throw new TypeError('g3-fsproc-adapters/terminal: ptyService.approvedOpenPlan(callId) => {plan:{executable|argv, cwd, rows, cols, graceMs, env?}, envelopeDigest?} is REQUIRED — §5.1 governs the per-open CONTROLLED EXECUTION PLAN behind the one-shot registerBackend registration (root 15:09 route, pinned on terminal/src/index.ts:125-136 spawn capture + SubprocessRuntime.spawnTerminal), never the public type; the integrator wires this reader to the approval the per-open provider holds')
  }
  if (deps.controlPort !== undefined && deps.controlPort !== null
    && (typeof deps.controlPort !== 'object' || typeof deps.controlPort.prepare !== 'function')) {
    throw new TypeError('g3-fsproc-adapters/terminal: controlPort must answer prepare(canonical+exec) => a REAL handle (see createHostTerminalControlPort over ctx.terminals) — a port without a real handle route is not a control port')
  }
  // Drift audit against the CAPTURED faces (the pin law: a mismatch is
  // refused at assembly, never carried silently).
  assertCapturedEnum('terminal_signal', 'signal', nativeDefinitions.terminal_signal?.parameters?.signal?.enum, A5_G3_TERMINAL_SIGNALS)
  const specs = [
    ['terminal_open', (a, h) => validateTerminalOpen(a, { ...h, declaredBackends })],
    ['terminal_send', validateTerminalSend],
    ['terminal_read', validateTerminalRead],
    ['terminal_signal', validateTerminalSignal],
    ['terminal_close', validateTerminalClose],
    ['terminal_list', validateTerminalList],
  ]
  // The live placement read is looked up AT CALL TIME through the
  // integrator-supplied map (the placement-feed shape): the arm holds the
  // MAP, not a per-tool snapshot — swapping the current read for a tool
  // (definition replacement) must be visible at the very next entry. The
  // wrapper CALLS the current reader (its RESULT is the placement record).
  const liveReads = deps.liveDefinitions ?? {}
  const makeLiveDispatcher = (toolName, present) => {
    if (present !== true) return null
    return function g3LiveRead() {
      const read = liveReads[toolName]
      if (typeof read !== 'function') return null
      return read()
    }
  }
  const arms = {}
  for (const [toolName, validate] of specs) {
    const present = nativeDefinitions[toolName] !== null && nativeDefinitions[toolName] !== undefined
    arms[toolName] = createDelegateArm({
      familyId: A5_G3_FAMILIES.TERMINAL,
      toolName,
      codes: A5_G3_TERMINAL_TYPED_CODES,
      nativeDefinition: nativeDefinitions[toolName] ?? null,
      definitionIdentity: deps.definitionIdentities?.[toolName] ?? null,
      liveDispatcher: makeLiveDispatcher(toolName, present),
      providerId: deps.providerId,
      memberAgentId: deps.memberAgentId,
      sessionHeaderId: deps.sessionHeaderId,
      realmId: deps.realmId,
      bindingFacts: deps.bindingFacts,
      serviceFacts: Object.freeze({
        backend: (type) => ptyService.backend(type),
        approvedOpenPlan: (callId) => ptyService.approvedOpenPlan(callId),
        session: (ownerAgentId, sessionId) => ptyService.session(ownerAgentId, sessionId),
      }),
      controlPort: deps.controlPort ?? null,
      validate,
      observe: deps.observe ?? (() => {}),
    })
  }
  return Object.freeze(arms)
}

/** The single B-LSP arm. `lspFacts`: server() => {binaryIdentity,
 *  generation}|null; document(filePath, workspaceRoot) => {kind,
 *  canonicalLocator, revision}|null — the §5.2 target facts; REQUIRED
 *  INTERFACE OBLIGATIONS (not optional facts): documentRealm(locator,
 *  workspaceRoot) => the realm owning the document (must equal the bound
 *  realm) and documentScope(locator, workspaceRoot) => 'inside' | 'outside'
 *  — the REALM and cross-file SCOPE answers the §5.2 assembly adapter owes
 *  (enforced at classify AND at the entry; no public controlled entry
 *  answers them at the pin — the gap is reported, never faked). */
export function createGovernedLspArm(deps) {
  const lspFacts = deps.lspFacts
  if (lspFacts === null || typeof lspFacts.server !== 'function' || typeof lspFacts.document !== 'function'
    || typeof lspFacts.documentRealm !== 'function' || typeof lspFacts.documentScope !== 'function') {
    throw new TypeError('g3-fsproc-adapters/lsp: lspFacts {server, document, documentRealm, documentScope} is required — server identity/generation, document revision, and the REALM + cross-file SCOPE answers are the §5.2 interface obligations')
  }
  assertCapturedEnum('lsp', 'operation', deps.nativeDefinition?.parameters?.operation?.enum, A5_G3_LSP_OPERATIONS)
  return createDelegateArm({
    familyId: A5_G3_FAMILIES.LSP,
    toolName: 'lsp',
    codes: A5_G3_LSP_TYPED_CODES,
    nativeDefinition: deps.nativeDefinition ?? null,
    definitionIdentity: deps.definitionIdentity ?? null,
    liveDispatcher: deps.liveDispatcher ?? null,
    providerId: deps.providerId,
    memberAgentId: deps.memberAgentId,
    sessionHeaderId: deps.sessionHeaderId,
    realmId: deps.realmId,
    bindingFacts: deps.bindingFacts,
    serviceFacts: Object.freeze({
      server: () => lspFacts.server(),
      document: (p, w) => lspFacts.document(p, w),
      documentRealm: (l, w) => lspFacts.documentRealm(l, w),
      documentScope: (l, w) => lspFacts.documentScope(l, w),
    }),
    controlPort: deps.controlPort ?? null,
    validate: validateLsp,
    observe: deps.observe ?? (() => {}),
  })
}

/** The single B-PTC outer `run_code` arm. `ptcFacts`: () => {interpreter:
 *  {runtimeIdentity, language}, effectiveEnvelope: {mode, enforcement},
 *  timeout, childChannel: {capabilityList, channelDigest,
 *  maxParallelSubCalls, runDispatchBudget}} | null. This is the gap-closure
 *  piece for the run_code ROW (the plane only reserves the name and mounts
 *  the escalation adjudication bridge): CENTER captures the registry-minted
 *  native definition and wires THIS arm; the arm never answers an escalation
 *  and never grants nested calls anything. */
/** The MEASURED host escalation-target enum for the run_code
 *  `sandbox_permissions` CAPTURE pin (A5M2-G3 B-PTC wiring round, root
 *  04:4x card; e78 handoff [B], self-verified at both faces): the REAL
 *  registry-minted schema enum is the ESCALATION-TARGET set —
 *  tests/deepseek-harness-test-use packages/sandbox/sandbox/src/
 *  escalation.ts:41 `ESCALATION_TARGETS = ['workspace-write',
 *  'danger-full-access']`, fed into the minted definition verbatim by
 *  packages/core/tools/src/ptc.ts:110 (`RUN_CODE_CONTROLS`
 *  `enum: [...ESCALATION_TARGETS]`). Pinning the 3-member BRIDGE
 *  vocabulary here made capture THROW on the real definition (an
 *  escalation TARGET list is not the SandboxMode ask vocabulary): the
 *  bridge vocabulary `PTC_ESCALATION_MODES` (ptc-escalation-row.mjs:80,
 *  the escalation row's adjudication face and this adapter's
 *  args pair-law) stays UNTOUCHED — only the capture pin rides the
 *  measured schema face. */
export const A5_G3_PTC_RUN_CODE_ESCALATION_TARGETS = Object.freeze(['workspace-write', 'danger-full-access'])

export function createGovernedRunCodeArm(deps) {
  if (typeof deps.ptcFacts !== 'function') {
    throw new TypeError('g3-fsproc-adapters/run_code: ptcFacts is required — interpreter identity, the EFFECTIVE envelope, and the child-channel facts are the target; without them every run is an unattributed interpreter')
  }
  assertCapturedEnum('run_code', 'sandbox_permissions', deps.nativeDefinition?.parameters?.sandbox_permissions?.enum, A5_G3_PTC_RUN_CODE_ESCALATION_TARGETS)
  return createDelegateArm({
    familyId: A5_G3_FAMILIES.PTC,
    toolName: 'run_code',
    codes: A5_G3_PTC_TYPED_CODES,
    nativeDefinition: deps.nativeDefinition ?? null,
    definitionIdentity: deps.definitionIdentity ?? null,
    liveDispatcher: deps.liveDispatcher ?? null,
    providerId: deps.providerId,
    memberAgentId: deps.memberAgentId,
    sessionHeaderId: deps.sessionHeaderId,
    realmId: deps.realmId,
    bindingFacts: deps.bindingFacts,
    serviceFacts: () => deps.ptcFacts(),
    controlPort: deps.controlPort ?? null,
    validate: validateRunCode,
    observe: deps.observe ?? (() => {}),
  })
}
