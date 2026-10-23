/**
 * governed-families/g3-fsproc-adapters.mjs — A5-M2 G3 (FS-PROC) thin governed
 * arms for the FS-PROC families whose native faces exist at the pin but whose
 * governed ROWS the CENTER has not (yet) mounted:
 *
 *  - B-TERMINAL (terminal_open / terminal_send / terminal_read /
 *    terminal_signal / terminal_close / terminal_list):
 *    mountCondition = DECLARED_MOUNT. The native faces at the pin
 *    (@639ed01539) are the `terminals` service
 *    (`@deepseek-ai/dsh-terminal` TerminalSessionService:
 *    registerBackend:125, spawn:154, startSend:243, read:263, signal:274,
 *    kill:285, list:308 @packages/terminal/terminal/src/index.ts) driven by
 *    the six tool definitions (@packages/terminal/tool-terminal/src/index.ts
 *    terminal_open:164 / terminal_send:199 / terminal_read:302 /
 *    terminal_signal:335 / terminal_close:360 / terminal_list:391). The row
 *    claims none of that directly: like the todo exemplar it wraps the
 *    CAPTURED native definition, and the DECLARED_MOUNT law is enforced here —
 *    a row whose declared service is absent refuses TYPED on every call (zero
 *    native reach, no fallback face), and `terminal_open` may only select a
 *    DECLARED public backend type (M0-B §5.1: an internal per-open backend
 *    type is never model-selectable).
 *  - B-LSP (`lsp`): mountCondition = always. Native face: the `lsp` service
 *    (`@deepseek-ai/dsh-lsp` Lsp.query(request, signal)
 *    @packages/lsp/lsp/src/index.ts:143) behind the tool definition
 *    (@packages/lsp/tool-lsp/src/index.ts:110+). The closed operation set is
 *    EXACTLY the four read-only navigation ops (goToDefinition /
 *    findReferences / goToImplementation / hover); line/character stay the
 *    model-facing ONE-based UTF-16 spelling (the zero-based conversion is the
 *    captured native body's own parseLspArgs law, NOT re-implemented here);
 *    the session workspace cwd rides the REAL `exec.agent.session.header.cwd`
 *    path the host sessionCwd reads. No diagnostics / executeCommand /
 *    generic fallback exists on this face.
 *  - B-PTC (`run_code`): the OUTER arm over the captured native definition
 *    the registry's own `createRunCodeTool` mints (@deepseek-ai/dsh-tools
 *    ptc.ts:RUN_CODE_NAME:30, createRunCodeTool:333, parameters
 *    code/description/timeoutMs?/sandbox_permissions?/justification?
 *    @639ed01539). The escalation vocabulary rides the ONE existing source
 *    (`PTC_ESCALATION_MODES` from ../ptc-escalation-row.mjs — the mounted
 *    adjudication bridge stays the only face that answers escalation asks;
 *    this arm never approves anything: `sandbox_permissions`/`justification`
 *    are DATA bound into the manifest (digests, not copies), and every nested
 *    tool call keeps its OWN governance (nested-tools-second-governance is a
 *    manifest fact, never a carried grant).
 *
 * B-JOB (job_output / job_list / job_kill) needs NO new face here: the trio
 * is already takeover-mounted (team-tool-plane.mjs:1902-1958 behind the
 * closed `jobsEnabled` key over `createGovernedJobsBridge`
 * @plane-effect-backends.mjs:1587, host JobRegistry public face
 * start/list/get/read/readAt/kill/wait @packages/jobs/jobs/src/index.ts —
 * there is NO owner()/done() method at the pin). What the census found
 * uncovered is a LEG, not an API: the management path (read/kill) across the
 * gateway's DRAINING state — cancel must stay reachable while new admits are
 * refused. That leg is pinned by the G3 spec against the existing modules.
 *
 * PATTERN (exemplar: governed-families/todo.mjs, root cards honored): the ONLY
 * path to a native body is the definition OBJECT + its `execute` FUNCTION
 * captured at bind time; identity pairing is the REAL Host face
 * (`exec.agent.id` ↔ memberAgentId, `exec.agent.session.header.id` ↔
 * sessionHeaderId); classify is PURE (no disk/network/service reads); the
 * grant grammar's `parametersFingerprint` is the `sha256:<hex64>` digest over
 * the FULL canonicalized values; the consumed-proof edge re-checks
 * generations + definition identity + the captured function value; the cancel/
 * drain re-check runs AT THE COMMIT EDGE; a body that was entered and threw
 * reports FAILED-UNKNOWN, never a zero/commit claim. Internal plan state is
 * bookkeeping, NEVER a permission source, and the arm mints no generations,
 * grants, or escalations of its own.
 *
 * SCHEMAS: every registration face this module exports is CANONICAL JSON
 * Schema (parent-level `required` arrays; the per-property `required: true`
 * spelling is the host's private defineTool INPUT DSL and never a
 * registration face — r9 law). The G3 spec proves each face against the REAL
 * pinned host validator (`assertSupportedJsonSchema`).
 *
 * NOT in this file: registration/placement/mask (CENTER owns
 * agent-bindings.mjs / team-tool-plane.mjs and wires these arms), the
 * admission kernel (A owns Control/PA consumption), the jobs bridge itself,
 * the PTC escalation adjudication bridge (already mounted,
 * ptc-escalation-row.mjs), and the LSP realm assembly process-envelope work
 * (§5.2 lives in sandbox-provider/lsp-assembly.ts, untouched).
 *
 * @module runtime/plugin/live/governed-families/g3-fsproc-adapters
 */
import { createHash } from 'node:crypto'
import { TextEncoder } from 'node:util'
import { PTC_ESCALATION_MODES } from '../ptc-escalation-row.mjs'

/** Adapter generation for the whole G3 module (all three families move as one). */
export const A5_G3_ADAPTER_REVISION = 1

export const A5_G3_FAMILIES = Object.freeze({
  TERMINAL: 'B-TERMINAL',
  LSP: 'B-LSP',
  PTC: 'B-PTC',
})

/** The closed LSP navigation set at the pin (tool-lsp index.ts LSP_OPERATIONS). */
export const A5_G3_LSP_OPERATIONS = Object.freeze([
  'goToDefinition',
  'findReferences',
  'goToImplementation',
  'hover',
])

/** The terminal signal enum at the pin (tool-terminal terminal_signal:339). */
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
    DECLARED_ABSENT: `${prefix}_DECLARED_SERVICE_ABSENT`,
    NOT_ADMITTED: `${prefix}_NOT_ADMITTED`,
    ALREADY_CONSUMED: `${prefix}_ALREADY_CONSUMED`,
    CANCELLED: `${prefix}_CANCELLED`,
    DRAINING: `${prefix}_DRAINING`,
    DEFINITION_DRIFT: `${prefix}_DEFINITION_DRIFT`,
    GRANT_MISMATCH: `${prefix}_GRANT_MISMATCH`,
  })
}

export const A5_G3_TERMINAL_TYPED_CODES = Object.freeze({
  ...typedCodes('P_TERM'),
  BACKEND_NOT_DECLARED: 'P_TERM_CLASSIFY_BACKEND_NOT_DECLARED',
})
export const A5_G3_LSP_TYPED_CODES = typedCodes('P_LSP')
export const A5_G3_PTC_TYPED_CODES = Object.freeze({
  ...typedCodes('P_PTC'),
  ESCALATION_ARGS_INVALID: 'P_PTC_CLASSIFY_ESCALATION_ARGS_INVALID',
})

const refuse = (code, detail) => ({ ok: false, code, detail })

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

// ── CANONICAL registration faces (parent-level required arrays) ───────────
// Lifted from the AUTHORED host tool specs at the pin: every authored
// property-level `required: true` became its parent's `required` member —
// constraints kept, never loosened (the G3 spec r9 leg proves exactly this
// against the REAL host validator).

const str = (extra = {}) => Object.freeze({ type: 'string', ...extra })
const num = () => Object.freeze({ type: 'number' })
const bool = () => Object.freeze({ type: 'boolean' })

/** terminal_open (tool-terminal index.ts:164-171 @639ed01539). */
export const A5_G3_TERMINAL_OPEN_PARAMETERS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    type: str(),
    name: str(),
    cwd: str(),
  }),
  required: Object.freeze(['type']),
})

/** terminal_send (:199-208; run_in_background is the host's jobs-armed arm). */
export const A5_G3_TERMINAL_SEND_PARAMETERS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    sessionId: str(),
    text: str(),
    submit: bool(),
    run_in_background: bool(),
  }),
  required: Object.freeze(['sessionId', 'text']),
})

/** terminal_read (:302-308; offset/count omission stays omission). */
export const A5_G3_TERMINAL_READ_PARAMETERS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    sessionId: str(),
    offset: num(),
    count: num(),
  }),
  required: Object.freeze(['sessionId']),
})

/** terminal_signal (:335-340). */
export const A5_G3_TERMINAL_SIGNAL_PARAMETERS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    sessionId: str(),
    signal: Object.freeze({ type: 'string', enum: A5_G3_TERMINAL_SIGNALS }),
  }),
  required: Object.freeze(['sessionId', 'signal']),
})

/** terminal_close (:360-363). */
export const A5_G3_TERMINAL_CLOSE_PARAMETERS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({ sessionId: str() }),
  required: Object.freeze(['sessionId']),
})

/** terminal_list (:391-393: the host declares the empty object). */
export const A5_G3_TERMINAL_LIST_PARAMETERS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({}),
})

/** lsp (tool-lsp index.ts:110-123 — the closed four-operation surface). */
export const A5_G3_LSP_PARAMETERS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    operation: Object.freeze({ type: 'string', enum: A5_G3_LSP_OPERATIONS }),
    file_path: str(),
    line: num(),
    character: num(),
  }),
  required: Object.freeze(['operation', 'file_path', 'line', 'character']),
})

/** run_code (core/tools/src/ptc.ts:343-352 — code/description required;
 *  the escalation controls stay declared, their SEMANTICS belong to the
 *  mounted escalation bridge, not to this schema). */
export const A5_G3_PTC_PARAMETERS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    code: str(),
    description: str(),
    timeoutMs: num(),
    sandbox_permissions: Object.freeze({ type: 'string', enum: PTC_ESCALATION_MODES }),
    justification: str(),
  }),
  required: Object.freeze(['code', 'description']),
})

// ── the shared thin-delegate core (todo.mjs pattern, parameterized) ───────

/**
 * ONE governed arm over ONE captured native definition. Every family factory
 * below is a thin configuration of this core: `validate` is the family's pure
 * closed-surface parse (it returns the canonical args plus the targetManifest
 * extras), NOTHING else moves.
 *
 * @param deps.familyId - 'B-TERMINAL' | 'B-LSP' | 'B-PTC'.
 * @param deps.toolName - the exact public spelling.
 * @param deps.codes - the family's typed-code table.
 * @param deps.nativeDefinition - the captured definition object (name +
 *   execute), or NULL for the declared_mount-absent shape: the row exists
 *   (declared) but the service is absent, so EVERY call refuses typed —
 *   config is law, and there is no fallback face to fall back to.
 * @param deps.definitionIdentity - `definitionIdentityOf` at bind time, or
 *   null exactly when nativeDefinition is null.
 * @param deps.providerId - the trusted assembly placing this arm.
 * @param deps.memberAgentId / deps.sessionHeaderId - the REAL Host identity
 *   pairing halves (bind-time facts).
 * @param deps.bindingFacts - the injected M1/Guard binding-generation reader.
 * @param deps.validate - (args, helpers) => {ok:true, canonical, manifest}
 *   | {ok:false, code, detail}. PURE: no disk/network/service reads.
 * @param deps.observe - the §1.2 minimal backend log.
 */
function createDelegateArm({ familyId, toolName, codes, nativeDefinition, definitionIdentity, providerId, memberAgentId, sessionHeaderId, bindingFacts, validate, observe = () => {} }) {
  const declaredAbsent = nativeDefinition === null || nativeDefinition === undefined
  if (!declaredAbsent && typeof nativeDefinition?.execute !== 'function') {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: nativeDefinition must be the captured definition object with an execute function, or null for the declared-absent shape`)
  }
  if (!declaredAbsent && (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0)) {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: definitionIdentity is required whenever a native definition is captured`)
  }
  if (typeof providerId !== 'string' || providerId.length === 0) {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: providerId must be a non-empty string`)
  }
  if (typeof memberAgentId !== 'string' || memberAgentId.length === 0 || typeof sessionHeaderId !== 'string' || sessionHeaderId.length === 0) {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: memberAgentId and sessionHeaderId are required (the REAL Host identity pairing has no otherwise)`)
  }
  if (typeof bindingFacts !== 'function') {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: bindingFacts must be the injected M1/Guard reader`)
  }
  if (typeof validate !== 'function') {
    throw new TypeError(`g3-fsproc-adapters/${toolName}: validate is required`)
  }

  /** BIND-TIME SNAPSHOT of the body (never re-read by name at execution). */
  const bindExecute = declaredAbsent ? null : nativeDefinition.execute
  const plans = new WeakMap()
  let correlationSeq = 0
  let draining = false

  const generationFacts = () => {
    const facts = bindingFacts()
    return {
      definitionIdentity,
      providerId,
      bindingId: facts.bindingId,
      bindingRevision: facts.bindingRevision,
      policyGeneration: facts.policyGeneration,
      authorityGeneration: facts.authorityGeneration,
    }
  }

  /** REAL Host-shape identity read: exactly `exec.agent.id` and
   *  `exec.agent.session.header.id`. No shim, no alternate words. */
  const readIdentity = (exec) => {
    const agentId = typeof exec?.agent?.id === 'string' && exec.agent.id.length > 0 ? exec.agent.id : null
    const headerId = typeof exec?.agent?.session?.header?.id === 'string' && exec.agent.session.header.id.length > 0 ? exec.agent.session.header.id : null
    return { agentId, headerId }
  }

  function classify(args, exec, callId) {
    if (draining) return refuse(codes.DRAINING, 'the arm is DRAINING: no call reaches any body, native included (there is no native fallback to fall back to)')
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
    const closed = Object.keys(args).filter((k) => !DECLARED_SURFACES[toolName]?.includes(k))
    if (DECLARED_SURFACES[toolName] !== undefined && closed.length > 0) {
      return refuse(codes.UNKNOWN_PARAMETER, `undeclared top-level parameter(s): ${closed.join(', ')} — the governed root is closed`)
    }
    const v = validate(args, { refuse, canonicalJson, sha256 })
    if (v.ok !== true) return refuse(v.code, v.detail)
    const effects = deepFreeze([{ kind: 'tool-invoke', toolName, resource: null }])
    const paramFingerprint = sha256(canonicalJson(v.canonical))
    const targetManifest = deepFreeze({
      operation: v.operation,
      toolName,
      agentId,
      sessionHeaderId: headerId,
      ...v.manifest,
      paramFingerprint,
    })
    const generations = generationFacts()
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
    // only — the real Agent reference (the terminal/lsp bodies pair on it),
    // the call's signal, and the host callId the run_code bridge reads.
    const snapshot = Object.freeze({
      agent: exec.agent,
      ...(exec?.signal !== undefined && exec.signal !== null ? { signal: exec.signal } : {}),
      ...(exec?.callId !== undefined && exec.callId !== null ? { callId: String(exec.callId) } : {}),
    })
    correlationSeq += 1
    const correlation = `${toolName}.r${A5_G3_ADAPTER_REVISION}.${correlationSeq}.${callId}`
    plans.set(plan, { state: 'CLASSIFIED', correlation, snapshot })
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
    if (
      grant.callId !== plan.callId
      || grant.parametersFingerprint !== plan.parametersFingerprint
      || grant.bindingId !== plan.generationsAtClassify.bindingId
      || grant.bindingRevision !== plan.generationsAtClassify.bindingRevision
    ) {
      return Promise.resolve(refuse(codes.GRANT_MISMATCH, 'the consumed grant does not answer to this plan (callId / parametersFingerprint / binding-generation pairing): a grant spent for one payload never runs another'))
    }
    const current = generationFacts()
    if (current.definitionIdentity !== plan.definitionIdentity || nativeDefinition.execute !== bindExecute) {
      return Promise.resolve(refuse(codes.DEFINITION_DRIFT, 'the placed definition or its execute function moved since bind time: the governed call refuses here; there is no replacement-body path and no native fallback'))
    }
    if (
      current.bindingRevision !== plan.generationsAtClassify.bindingRevision
      || current.policyGeneration !== plan.generationsAtClassify.policyGeneration
      || current.authorityGeneration !== plan.generationsAtClassify.authorityGeneration
    ) {
      return Promise.resolve(refuse(codes.GRANT_MISMATCH, `binding generations moved between classify and the edge (${JSON.stringify(plan.generationsAtClassify)} -> ${JSON.stringify(current)}): a stale approval never rides a new generation`))
    }
    entry.state = 'CLAIMED'
    const args = JSON.parse(JSON.stringify(plan.canonical))
    return Promise.resolve()
      .then(() => {
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
        entry.state = 'EXECUTING'
        observe({ event: 'backend-start', correlation: entry.correlation, detail: plan.definitionIdentity })
        return bindExecute.call(nativeDefinition, args, entry.snapshot)
      })
      .then(
        (value) => {
          entry.state = 'COMMITTED'
          observe({ event: 'backend-commit', correlation: entry.correlation, detail: plan.parametersFingerprint })
          observe({ event: 'backend-end', correlation: entry.correlation, detail: 'ok' })
          return { ok: true, value }
        },
        (error) => {
          if (error?.a5Edge === 'CANCELLED') {
            entry.state = 'CANCELLED'
            observe({ event: 'backend-end', correlation: entry.correlation, detail: 'cancelled-at-edge' })
            return refuse(codes.CANCELLED, 'cancelled before the body: zero effects (the commit-edge re-check stopped it)')
          }
          if (error?.a5Edge === 'DRAINING') {
            entry.state = 'DRAINED-AT-EDGE'
            observe({ event: 'backend-end', correlation: entry.correlation, detail: 'drained-at-edge' })
            return refuse(codes.DRAINING, 'drained before the body: zero effects; no native fallback exists')
          }
          entry.state = 'FAILED-UNKNOWN'
          observe({ event: 'backend-end', correlation: entry.correlation, detail: 'error' })
          throw error
        },
      )
  }

  function cancel(plan) {
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(codes.NOT_ADMITTED, 'cancel answers only to a plan this arm issued')
    if (entry.state === 'COMMITTED') {
      return { ok: true, settled: 'ALREADY-COMMITTED', bodyOutcome: 'one — the body ran and committed; cancellation cannot retract it (for stateful faces the PTY/session resource survives the word)' }
    }
    if (entry.state === 'EXECUTING') {
      return { ok: true, settled: 'UNKNOWN-IN-FLIGHT', bodyOutcome: 'unknown — the native body has been entered and its effect boundary is inside it; this arm claims neither zero nor committed (await the execution result)' }
    }
    if (entry.state === 'FAILED-UNKNOWN') {
      return { ok: true, settled: 'COMMIT-UNKNOWN', bodyOutcome: 'unknown — the body was entered and reported failure; the effect boundary is inside the native body' }
    }
    const edgeReached = entry.state === 'CLAIMED'
    const wasAdmitted = edgeReached || entry.state === 'PREPARED'
    entry.state = 'CANCELLED'
    observe({ event: 'cancel', correlation: entry.correlation, detail: edgeReached ? 'at-edge' : wasAdmitted ? 'after-admission' : 'before-admission' })
    return {
      ok: true,
      settled: edgeReached ? 'CANCELLED-BEFORE-EXECUTION' : wasAdmitted ? 'CANCELLED-AFTER-ADMISSION' : 'CANCELLED-BEFORE-ADMISSION',
      bodyOutcome: 'zero — the body never ran (a CLAIMED plan is stopped by the commit-edge re-check; a PREPARED/CLASSIFIED plan never reaches an edge)',
    }
  }

  function drain() {
    draining = true
  }

  return {
    familyId,
    adapterRevision: A5_G3_ADAPTER_REVISION,
    toolName,
    definitionIdentity,
    providerId,
    declaredAbsent,
    classify,
    prepare,
    execute,
    cancel,
    drain,
  }
}

/** The closed top-level parameter surface per tool (the UNKNOWN_PARAMETER
 *  law needs the SAME spelling as the canonical schemas above). */
const DECLARED_SURFACES = Object.freeze({
  terminal_open: Object.freeze(['type', 'name', 'cwd']),
  terminal_send: Object.freeze(['sessionId', 'text', 'submit', 'run_in_background']),
  terminal_read: Object.freeze(['sessionId', 'offset', 'count']),
  terminal_signal: Object.freeze(['sessionId', 'signal']),
  terminal_close: Object.freeze(['sessionId']),
  terminal_list: Object.freeze([]),
  lsp: Object.freeze(['operation', 'file_path', 'line', 'character']),
  run_code: Object.freeze(['code', 'description', 'timeoutMs', 'sandbox_permissions', 'justification']),
})

// ── per-tool pure validators ───────────────────────────────────────────────

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0

function validateTerminalOpen(args, { refuse, sha256, canonicalJson }, declaredBackends) {
  if (!isNonEmptyString(args.type)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'type must be a non-empty string (the registered backend type)')
  // §5.1 law: the model may only select a DECLARED public backend; internal
  // per-open one-shot backend types never enter this surface.
  if (!declaredBackends.includes(args.type)) {
    return refuse('P_TERM_CLASSIFY_BACKEND_NOT_DECLARED', `backend type ${JSON.stringify(args.type)} is not a declared public backend of this mount (${declaredBackends.join('|')}) — an internal per-open type is never model-selectable`)
  }
  if (args.name !== undefined && typeof args.name !== 'string') return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'name must be a string')
  if (args.name !== undefined && args.name.length === 0) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'name must be non-empty when present (host law, index.ts:168)')
  if (args.cwd !== undefined && typeof args.cwd !== 'string') return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'cwd must be a string')
  const canonical = { type: args.type, ...(args.name !== undefined ? { name: args.name } : {}), ...(args.cwd !== undefined ? { cwd: args.cwd } : {}) }
  return {
    ok: true,
    canonical,
    operation: 'pty-spawn',
    manifest: {
      backendType: args.type,
      declaredBackends: declaredBackends.slice(),
      ...(args.name !== undefined ? { sessionName: args.name } : {}),
      ...(args.cwd !== undefined ? { requestedCwd: args.cwd } : {}),
      effectDelta: Object.freeze(['os-pty-spawn-shell']),
      envelopeDigest: `sha256:${sha256(canonicalJson(canonical))}`,
    },
  }
}

function validateTerminalSend(args, { refuse, sha256 }) {
  if (!isNonEmptyString(args.sessionId)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'sessionId must be a non-empty string')
  if (typeof args.text !== 'string') return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'text must be a string (the host schema demands a string; empty input is lawful — Enter-only submits)')
  if (args.submit !== undefined && typeof args.submit !== 'boolean') return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'submit must be a boolean')
  if (args.run_in_background !== undefined && typeof args.run_in_background !== 'boolean') return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'run_in_background must be a boolean')
  const canonical = { sessionId: args.sessionId, text: args.text, ...(args.submit !== undefined ? { submit: args.submit } : {}), ...(args.run_in_background !== undefined ? { run_in_background: args.run_in_background } : {}) }
  return {
    ok: true,
    canonical,
    operation: 'stdin-write',
    manifest: {
      sessionId: args.sessionId,
      // The effective submit is the HOST default lifted for the manifest ONLY
      // (index.ts:211 `submit ?? true`); the canonical args keep the caller's
      // omission so the captured body still owns the default.
      effectiveSubmit: args.submit !== false,
      background: args.run_in_background === true,
      inputDigest: `sha256:${sha256(args.text)}`,
      inputBytes: new TextEncoder().encode(args.text).length,
      effectDelta: Object.freeze(['shell-input-injection-stdin', ...(args.run_in_background === true ? ['bg-pty-send-jobs'] : [])]),
    },
  }
}

function validateTerminalRead(args, { refuse }) {
  if (!isNonEmptyString(args.sessionId)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'sessionId must be a non-empty string')
  if (args.offset !== undefined && (typeof args.offset !== 'number' || !Number.isFinite(args.offset) || args.offset < 0)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'offset must be a non-negative finite number when present')
  if (args.count !== undefined && (typeof args.count !== 'number' || !Number.isFinite(args.count) || args.count <= 0)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'count must be a positive finite number when present')
  const canonical = { sessionId: args.sessionId, ...(args.offset !== undefined ? { offset: args.offset } : {}), ...(args.count !== undefined ? { count: args.count } : {}) }
  // Bounded read; the omission stays an omission (the host default belongs
  // to the body — same null-preserving law as read's limit).
  return {
    ok: true,
    canonical,
    operation: 'output-read',
    manifest: {
      sessionId: args.sessionId,
      offset: args.offset ?? null,
      count: args.count ?? null,
    },
  }
}

function validateTerminalSignal(args, { refuse }) {
  if (!isNonEmptyString(args.sessionId)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'sessionId must be a non-empty string')
  if (!A5_G3_TERMINAL_SIGNALS.includes(args.signal)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', `signal must be one of ${A5_G3_TERMINAL_SIGNALS.join('|')}`)
  return {
    ok: true,
    canonical: { sessionId: args.sessionId, signal: args.signal },
    operation: 'signal',
    manifest: {
      sessionId: args.sessionId,
      signal: args.signal,
      // The shell-target SIGKILL refusal is the service's OWN law
      // (terminal/src/index.ts:339 family) — the manifest records the intent,
      // the service grades it.
      effectDelta: Object.freeze(['os-signal-to-process-group']),
    },
  }
}

function validateTerminalClose(args, { refuse }) {
  if (!isNonEmptyString(args.sessionId)) return refuse('P_TERM_CLASSIFY_INVALID_ARGUMENTS', 'sessionId must be a non-empty string')
  return {
    ok: true,
    canonical: { sessionId: args.sessionId },
    operation: 'close',
    manifest: { sessionId: args.sessionId, effectDelta: Object.freeze(['owned-process-tree-kill']) },
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

function validateLsp(args, { refuse }) {
  if (!A5_G3_LSP_OPERATIONS.includes(args.operation)) {
    return refuse('P_LSP_CLASSIFY_INVALID_ARGUMENTS', `operation must be one of ${A5_G3_LSP_OPERATIONS.join('|')} — the closed navigation set; there is no diagnostics/executeCommand/generic fallback on this face`)
  }
  if (typeof args.file_path !== 'string' || args.file_path.trim().length === 0) {
    return refuse('P_LSP_CLASSIFY_INVALID_ARGUMENTS', 'file_path must be a non-empty string')
  }
  // ONE-BASED UTF-16 law exactly as the host authored it (oneBased: integer
  // >= 1); the zero-based conversion stays the captured body's parseLspArgs.
  if (typeof args.line !== 'number' || !Number.isInteger(args.line) || args.line < 1) {
    return refuse('P_LSP_CLASSIFY_INVALID_ARGUMENTS', 'line must be an integer >= 1 (one-based)')
  }
  if (typeof args.character !== 'number' || !Number.isInteger(args.character) || args.character < 1) {
    return refuse('P_LSP_CLASSIFY_INVALID_ARGUMENTS', 'character must be an integer >= 1 (one-based UTF-16)')
  }
  return {
    ok: true,
    canonical: { operation: args.operation, file_path: args.file_path, line: args.line, character: args.character },
    operation: args.operation,
    manifest: {
      navigationOperation: args.operation,
      filePath: args.file_path,
      // Model-facing ONE-based coordinates ride the manifest UNCHANGED.
      oneBasedLine: args.line,
      oneBasedCharacter: args.character,
    },
  }
}

function validateRunCode(args, { refuse, sha256 }) {
  if (typeof args.code !== 'string' || args.code.length === 0) {
    return refuse('P_PTC_CLASSIFY_INVALID_ARGUMENTS', 'code must be a non-empty string')
  }
  if (typeof args.description !== 'string' || args.description.trim().length === 0) {
    return refuse('P_PTC_CLASSIFY_INVALID_ARGUMENTS', 'description must be a non-empty string (host law, ptc.ts:381)')
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
      codeDigest: `sha256:${sha256(args.code)}`,
      descriptionDigest: `sha256:${sha256(args.description)}`,
      timeoutMs: args.timeoutMs ?? null,
      // The escalation request is MANIFEST DATA (digest + mode); its answer
      // lives ONLY in the mounted escalation bridge (ptc-escalation-row.mjs),
      // and every nested tool call rides its OWN governance:
      requestedSandboxMode: hasMode ? args.sandbox_permissions : null,
      justificationDigest: hasJustification ? `sha256:${sha256(args.justification)}` : null,
      nestedToolsSecondGovernance: true,
      effectDelta: Object.freeze(['fs-ladder-once-grant', 'nested-tools-second-governance']),
    },
  }
}

// ── family factories (CENTER consumes these; no registration lives here) ───

/**
 * The six B-TERMINAL arms over the six captured native definitions.
 *
 * @param deps.nativeDefinitions - a map toolName → captured definition object
 *   for the tools the declared mount provides; a MISSING (or null) entry is
 *   the declared-absent shape for THAT tool (typed refusal, zero reach).
 * @param deps.definitionIdentities - a map toolName → the bind-time
 *   definition identity of that captured object (required exactly when the
 *   definition is present).
 * @param deps.declaredBackends - non-empty array of the DECLARED public
 *   backend types this mount offers (terminal_open selection law, M0-B §5.1).
 *   A per-open internal one-shot backend type (the §5.1 correlation
 *   machinery) is NEVER added here.
 * …plus the shared pairing/binding deps (see createDelegateArm).
 */
export function createGovernedTerminalArms(deps) {
  const { nativeDefinitions = {}, declaredBackends } = deps
  if (!Array.isArray(declaredBackends) || declaredBackends.length === 0
    || declaredBackends.some((t) => typeof t !== 'string' || t.length === 0)) {
    throw new TypeError('g3-fsproc-adapters/terminal: declaredBackends must be a non-empty array of non-empty public backend types (declared_mount law; never empty, never internal)')
  }
  const specs = [
    ['terminal_open', A5_G3_TERMINAL_OPEN_PARAMETERS, (a, h) => validateTerminalOpen(a, h, declaredBackends)],
    ['terminal_send', A5_G3_TERMINAL_SEND_PARAMETERS, validateTerminalSend],
    ['terminal_read', A5_G3_TERMINAL_READ_PARAMETERS, validateTerminalRead],
    ['terminal_signal', A5_G3_TERMINAL_SIGNAL_PARAMETERS, validateTerminalSignal],
    ['terminal_close', A5_G3_TERMINAL_CLOSE_PARAMETERS, validateTerminalClose],
    ['terminal_list', A5_G3_TERMINAL_LIST_PARAMETERS, validateTerminalList],
  ]
  const arms = {}
  for (const [toolName, , validate] of specs) {
    arms[toolName] = createDelegateArm({
      familyId: A5_G3_FAMILIES.TERMINAL,
      toolName,
      codes: A5_G3_TERMINAL_TYPED_CODES,
      nativeDefinition: nativeDefinitions[toolName] ?? null,
      definitionIdentity: deps.definitionIdentities?.[toolName] ?? null,
      providerId: deps.providerId,
      memberAgentId: deps.memberAgentId,
      sessionHeaderId: deps.sessionHeaderId,
      bindingFacts: deps.bindingFacts,
      validate,
      observe: deps.observe ?? (() => {}),
    })
  }
  return Object.freeze(arms)
}

/** The single B-LSP arm (see createDelegateArm for the shared deps). */
export function createGovernedLspArm(deps) {
  return createDelegateArm({
    familyId: A5_G3_FAMILIES.LSP,
    toolName: 'lsp',
    codes: A5_G3_LSP_TYPED_CODES,
    nativeDefinition: deps.nativeDefinition ?? null,
    definitionIdentity: deps.definitionIdentity ?? null,
    providerId: deps.providerId,
    memberAgentId: deps.memberAgentId,
    sessionHeaderId: deps.sessionHeaderId,
    bindingFacts: deps.bindingFacts,
    validate: validateLsp,
    observe: deps.observe ?? (() => {}),
  })
}

/** The single B-PTC outer `run_code` arm. This is the gap-closure piece for
 *  the run_code ROW (the plane today only reserves the name and mounts the
 *  escalation adjudication bridge): CENTER captures the registry-minted
 *  native definition and wires THIS arm; the arm never answers an
 *  escalation and never grants nested calls anything. */
export function createGovernedRunCodeArm(deps) {
  return createDelegateArm({
    familyId: A5_G3_FAMILIES.PTC,
    toolName: 'run_code',
    codes: A5_G3_PTC_TYPED_CODES,
    nativeDefinition: deps.nativeDefinition ?? null,
    definitionIdentity: deps.definitionIdentity ?? null,
    providerId: deps.providerId,
    memberAgentId: deps.memberAgentId,
    sessionHeaderId: deps.sessionHeaderId,
    bindingFacts: deps.bindingFacts,
    validate: validateRunCode,
    observe: deps.observe ?? (() => {}),
  })
}
