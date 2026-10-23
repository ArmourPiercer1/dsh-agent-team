/**
 * A5-M2 B-WRITE family — the governed EXISTING-FILE write arm.
 *
 * The body of a governed write is NOT a native re-entry and NOT a
 * lane-shaped writer: it is THE reviewed post-consume execution closure
 * (`controlled-fs/src/post-consume-write.ts`, root ruling — verify-before-
 * truncate, `O_WRONLY|O_NOFOLLOW`, NO `O_CREAT`, single-flight, zero
 * arguments). This arm is the admission-shaped shell the plane row drives:
 * classify (pure lexical, zero FS) → the kernel's ONE final edge → execute,
 * which mints the closure ONLY from the frozen plan facts and the REAL
 * consumed proof, then calls the closure with NO arguments at all. The
 * closure is the private executor: nothing post-approval can be substituted
 * into it (P1), it runs at most once (P3), and it never creates a file —
 * the NEW-FILE path stays HELD pending the root ruling (an absent target
 * answers the lane's typed refusal, zero creation, by construction).
 *
 * Law lineage (all reviewed, none re-decided here):
 *  - classify is PURE (todo.mjs law): parse the closed `{file_path,
 *    content}` shape, anchor the target LEXICALLY against the instance root,
 *    snapshot the binding generations, freeze the review payload and derive
 *    `parametersFingerprint = sha256(canonicalJson(full values))`. Zero
 *    disk, zero network, zero realpath.
 *  - the pairing law at the edge is todo's verbatim: the consumed grant must
 *    answer THIS plan (callId / parametersFingerprint / binding generations)
 *    or nothing runs.
 *  - the closure re-owns its own boundary law internally (approved-root
 *    agreement, exec-time handle identity, truncation honesty); this arm
 *    maps its typed answers WITHOUT beautifying them — `undetermined` KEEPS
 *    `sideEffectPossible` (honesty law P4; the write-slice mapping law,
 *    item-for-item), pass-through refusals ride verbatim.
 *
 * No fallback face: there is no native body behind this arm to fall back to
 * (the native `write` definition is masked by the row), and DRAINING refuses
 * everything, entered bodies notwithstanding (never rewound, honestly).
 *
 * @module runtime/plugin/live/governed-families/write
 */

import { createHash } from 'node:crypto'
import path from 'node:path'

import { createPostConsumeWriteClosure } from '../../../../controlled-fs/src/post-consume-write.js'

export const A5_WRITE_FAMILY_ID = 'B-WRITE'
export const A5_WRITE_TOOL_NAME = 'write'
export const A5_WRITE_OPERATION = 'write-existing-file'
/** The B-IMAGE precedent: the revision number is IN the manifest (the family
 *  rule validates it; a bumped adapter must bump it and re-freeze). */
export const A5_WRITE_ADAPTER_REVISION = 1

export const A5_WRITE_TYPED_CODES = Object.freeze({
  CLASSIFY_INVALID_ARGUMENTS: 'P_WRITE_CLASSIFY_INVALID_ARGUMENTS',
  CLASSIFY_UNKNOWN_PARAMETER: 'P_WRITE_CLASSIFY_UNKNOWN_PARAMETER',
  NO_OWNING_SESSION: 'P_WRITE_NO_OWNING_SESSION',
  FOREIGN_SESSION: 'P_WRITE_FOREIGN_SESSION',
  ANCHOR_ESCAPE: 'P_WRITE_ANCHOR_ESCAPE',
  NOT_ADMITTED: 'P_WRITE_NOT_ADMITTED',
  ALREADY_CONSUMED: 'P_WRITE_ALREADY_CONSUMED',
  CANCELLED: 'P_WRITE_CANCELLED',
  DRAINING: 'P_WRITE_DRAINING',
  GRANT_MISMATCH: 'P_WRITE_GRANT_MISMATCH',
  CLOSURE_REFUSED: 'P_WRITE_CLOSURE_REFUSED',
  EXECUTION_UNCONFIRMED: 'P_WRITE_EXECUTION_UNCONFIRMED',
})
const CODES = A5_WRITE_TYPED_CODES

const refuse = (code, detail, extra) => (extra === undefined ? { ok: false, code, detail } : { ok: false, code, detail, ...extra })

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

/** Pure lexical anchor (the write-slice anchor law, owned here so the arm
 *  imports nothing across the lane line): `file_path` resolves against the
 *  instance root and must land STRICTLY beneath it. No FS, no realpath. */
function lexicalAnchor(rootDir, rawPath) {
  if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.includes('\0')) return null
  if (path.isAbsolute(rawPath)) return null // relative-only spelling: the root IS the namespace
  const resolved = path.resolve(rootDir, rawPath)
  const rel = path.relative(rootDir, resolved)
  if (rel.length === 0 || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null
  return resolved
}

/**
 * The honest lane mapping (write-slice `mapLaneError` law, item-for-item):
 * `undetermined` ALWAYS keeps side-effect honesty; a stated `false` is
 * mirrored verbatim; nothing is beautified.
 */
function mapClosureRefusal(error) {
  const cfClass = error?.details?.cfClass
  const cfReason = error?.details?.cfReason
  const sideEffectUnknown = error?.details?.sideEffectUnknown
  const base = {
    code: CODES.CLOSURE_REFUSED,
    detail: `refused-fs ${String(error?.code ?? 'unknown')} — ${String(error?.message ?? 'the write closure refused')}`,
    ...(typeof cfClass === 'string' ? { cfClass } : {}),
    ...(typeof cfReason === 'string' ? { cfReason } : {}),
  }
  if (cfClass === 'undetermined') {
    return { ...base, sideEffectPossible: sideEffectUnknown !== false }
  }
  return sideEffectUnknown === true ? { ...base, sideEffectPossible: true } : base
}

/**
 * The one governed existing-file write arm for ONE member instance.
 *
 * @param deps - bind-time inputs, validated hard (config defects refuse at
 *   assembly; nothing silently defaults — the jobsEnabled law family).
 * @param {string} deps.definitionIdentity - `definitionIdentityOf` of the
 *   masked native `write` definition captured at bind time.
 * @param {string} deps.providerId - the trusted assembly placing this arm.
 * @param {string} deps.realmId - the plane realm (effect resource identity).
 * @param {string} deps.memberAgentId - pairing target for `exec.agent.id`.
 * @param {string} deps.sessionHeaderId - pairing target for the durable
 *   `session.header.id`.
 * @param {string} deps.instanceRootDir - the member instance's LEXICAL root
 *   (the approved write namespace; absolute).
 * @param {() => {bindingId: string, bindingRevision: number, policyGeneration: number, authorityGeneration: number}} deps.bindingFacts
 *   - the injected binding-generation reader (snapshot at classify,
 *   re-checked at the edge; the arm mints no generations of its own).
 * @param {(row: {event: string, correlation: string, detail?: string}) => void} [deps.observe]
 */
export function createGovernedWriteArm({
  definitionIdentity,
  providerId,
  realmId,
  memberAgentId,
  sessionHeaderId,
  instanceRootDir,
  bindingFacts,
  observe = () => {},
}) {
  if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) {
    throw new TypeError('governed-families/write: definitionIdentity must be a non-empty string (the I arm binds through it; an unbound arm is a config defect)')
  }
  if (typeof providerId !== 'string' || providerId.length === 0) {
    throw new TypeError('governed-families/write: providerId must be a non-empty string (the placing assembly identifies itself)')
  }
  if (typeof realmId !== 'string' || realmId.length === 0) {
    throw new TypeError('governed-families/write: realmId must be a non-empty string (effect resources carry it)')
  }
  if (typeof memberAgentId !== 'string' || memberAgentId.length === 0 || typeof sessionHeaderId !== 'string' || sessionHeaderId.length === 0) {
    throw new TypeError('governed-families/write: memberAgentId and sessionHeaderId are required (the REAL Host identity pairing has no otherwise)')
  }
  if (typeof instanceRootDir !== 'string' || !path.isAbsolute(instanceRootDir)) {
    throw new TypeError('governed-families/write: instanceRootDir must be a non-empty ABSOLUTE path (the approved write namespace)')
  }
  if (typeof bindingFacts !== 'function') {
    throw new TypeError('governed-families/write: bindingFacts must be the injected reader (the arm mints no generations of its own)')
  }

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

  /** REAL Host-shape identity read (todo law verbatim): exactly
   *  `exec.agent.id` and `exec.agent.session.header.id`. */
  const readIdentity = (exec) => {
    const agentId = typeof exec?.agent?.id === 'string' && exec.agent.id.length > 0 ? exec.agent.id : null
    const headerId = typeof exec?.agent?.session?.header?.id === 'string' && exec.agent.session.header.id.length > 0 ? exec.agent.session.header.id : null
    return { agentId, headerId }
  }

  /** PURE parse + snapshot. Reads NO disk (the anchor is lexical by law). */
  function classify(args, exec, callId) {
    if (draining) return refuse(CODES.DRAINING, 'the arm is DRAINING: no call reaches any body (there is no native fallback to fall back to)')
    if (typeof callId !== 'string' || callId.length === 0) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'the A invocation correlation (callId) is required at classify time')
    }
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'arguments must be an object')
    }
    const unknownTop = Object.keys(args).filter((k) => k !== 'file_path' && k !== 'content')
    if (unknownTop.length > 0) {
      return refuse(CODES.CLASSIFY_UNKNOWN_PARAMETER, `undeclared top-level parameter(s): ${unknownTop.join(', ')} — the governed root is closed (the host schema layer does not refuse these; this arm does)`)
    }
    if (typeof args.file_path !== 'string' || args.file_path.length === 0) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"file_path" must be a non-empty string')
    }
    if (typeof args.content !== 'string') {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"content" must be a string (the empty string is legal — it truncates an existing file to zero)')
    }
    const { agentId, headerId } = readIdentity(exec)
    if (agentId === null || headerId === null) {
      return refuse(CODES.NO_OWNING_SESSION, 'no real exec.agent.id / exec.agent.session.header.id: this governed write runs for one owning member session and this caller presents none')
    }
    if (agentId !== memberAgentId || headerId !== sessionHeaderId) {
      return refuse(CODES.FOREIGN_SESSION, `identity pairing failed against the bind-time facts (agent ${JSON.stringify(agentId)} vs ${JSON.stringify(memberAgentId)}, session.header ${JSON.stringify(headerId)} vs ${JSON.stringify(sessionHeaderId)})`)
    }
    const anchored = lexicalAnchor(instanceRootDir, args.file_path)
    if (anchored === null) {
      return refuse(CODES.ANCHOR_ESCAPE, 'file_path must resolve STRICTLY beneath the instance root by pure lexical law (absolute spellings and .. escapes refuse here; the closure re-derives the same law independently before any byte)')
    }
    const contentFingerprint = `sha256:${sha256(args.content)}`
    const effects = deepFreeze([
      { kind: 'tool-invoke', toolName: A5_WRITE_TOOL_NAME, resource: null },
      { kind: 'write', resource: { realmId, kind: 'absolute-path', canonicalLocator: anchored, rights: ['write'] } },
    ])
    const targetManifest = deepFreeze({
      familyId: A5_WRITE_FAMILY_ID,
      adapterRevision: A5_WRITE_ADAPTER_REVISION,
      operation: A5_WRITE_OPERATION,
      realmId,
      canonicalTarget: anchored,
      contentFingerprint,
      // THE HELD PATH, STATED IN THE APPROVED FACT: this family writes
      // EXISTING files only. A not-yet-existing target refuses at the
      // closure (no O_CREAT — zero creation) and stays HELD for the root
      // ruling; the approval the human reads says exactly this.
      existingFileOnly: true,
    })
    const generations = generationFacts()
    const reviewPayload = deepFreeze({
      familyId: A5_WRITE_FAMILY_ID,
      adapterRevision: A5_WRITE_ADAPTER_REVISION,
      providerIdentity: providerId,
      definitionIdentity,
      targetManifest,
    })
    // Two fingerprint layers, NEVER merged (todo ruling): the FULL-VALUE
    // parameters digest the grant must answer with, and the manifest digest
    // the PA center computes — this arm never computes or self-defines the
    // latter.
    const parametersFingerprint = `sha256:${sha256(canonicalJson({
      ...generations,
      callId,
      effects,
      reviewPayload,
    }))}`
    const plan = deepFreeze({
      familyId: A5_WRITE_FAMILY_ID,
      adapterRevision: A5_WRITE_ADAPTER_REVISION,
      toolName: A5_WRITE_TOOL_NAME,
      definitionIdentity,
      providerId,
      callId,
      effects,
      reviewPayload,
      parametersFingerprint,
      canonicalTarget: anchored,
      content: args.content,
      generationsAtClassify: Object.freeze(generations),
    })
    correlationSeq += 1
    const correlation = `write.r${A5_WRITE_ADAPTER_REVISION}.${correlationSeq}.${callId}`
    plans.set(plan, { state: 'CLASSIFIED', correlation })
    observe({ event: 'classify', correlation, detail: parametersFingerprint })
    return { ok: true, plan, effects, reviewPayload, parametersFingerprint, manifest: targetManifest }
  }

  /** The grant-issued hook: internal state only; authority lives in the
   *  kernel's grant, never here. */
  function prepare(plan, grant) {
    if (draining) return refuse(CODES.DRAINING, 'DRAINING: no admission is admitted, no execution will start')
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(CODES.NOT_ADMITTED, 'unknown plan: prepare answers only to a plan this arm classified')
    if (entry.state !== 'CLASSIFIED') return refuse(CODES.NOT_ADMITTED, `plan is ${entry.state}, not open-for-admission`)
    if (grant === null || typeof grant !== 'object' || typeof grant.grantId !== 'string') {
      return refuse(CODES.NOT_ADMITTED, 'prepare takes the kernel grant object (admission answered allow/approve); a plan without a grant never proceeds')
    }
    entry.state = 'PREPARED'
    entry.grantId = grant.grantId
    observe({ event: 'admit', correlation: entry.correlation, detail: grant.grantId })
    return { ok: true }
  }

  /**
   * THE POST-CONSUME ENTRY. The glue calls this ONLY after the REAL A edge
   * (`assembly.consumeForExecution`) answered with a consumed grant. After
   * the pairing law holds, this mints THE private zero-argument closure
   * from the frozen plan facts alone and calls it — no argument crosses the
   * approval line (P1), the closure runs at most once (P3), and the bytes
   * land through the reviewed verify-before-truncate boundary.
   */
  function execute(plan, consumed) {
    const entry = plans.get(plan)
    if (entry === undefined) return Promise.resolve(refuse(CODES.NOT_ADMITTED, 'unknown plan: execute answers only to a plan this arm classified'))
    if (entry.state === 'CANCELLED') return Promise.resolve(refuse(CODES.CANCELLED, 'the plan was cancelled before the edge: zero write is the truth, not a race'))
    if (entry.state !== 'PREPARED') {
      const spent = entry.state === 'CLAIMED' || entry.state === 'EXECUTING' || entry.state === 'COMMITTED'
      return Promise.resolve(refuse(spent ? CODES.ALREADY_CONSUMED : CODES.NOT_ADMITTED, `plan is ${entry.state}`))
    }
    const grant = consumed?.grant
    if (consumed?.consumed !== true || grant === null || typeof grant !== 'object' || typeof grant.grantId !== 'string') {
      return Promise.resolve(refuse(CODES.NOT_ADMITTED, 'execute takes the REAL consumed-proof of the A execution edge ({grant, consumed:true}); internal state never substitutes for it'))
    }
    // PAIRING (todo law verbatim): the consumed grant answers THIS plan only.
    if (
      grant.callId !== plan.callId
      || grant.parametersFingerprint !== plan.parametersFingerprint
      || grant.bindingId !== plan.generationsAtClassify.bindingId
      || grant.bindingRevision !== plan.generationsAtClassify.bindingRevision
    ) {
      return Promise.resolve(refuse(CODES.GRANT_MISMATCH, 'the consumed grant does not answer to this plan (callId / parametersFingerprint / binding-generation pairing): a grant spent for one payload never writes another file'))
    }
    const current = generationFacts()
    if (
      current.bindingRevision !== plan.generationsAtClassify.bindingRevision
      || current.policyGeneration !== plan.generationsAtClassify.policyGeneration
      || current.authorityGeneration !== plan.generationsAtClassify.authorityGeneration
    ) {
      return Promise.resolve(refuse(CODES.GRANT_MISMATCH, `binding generations moved between classify and the edge (${JSON.stringify(plan.generationsAtClassify)} -> ${JSON.stringify(current)}): a stale approval never rides a new generation`))
    }
    entry.state = 'CLAIMED'
    return Promise.resolve().then(async () => {
      // COMMIT-EDGE RE-CHECK: a cancel/drain landing any time before the body
      // is entered stops it HERE — the write count and the report agree by
      // construction (zero closure claims).
      if (entry.state === 'CANCELLED') return refuse(CODES.CANCELLED, 'cancelled before the closure: zero write (the commit-edge re-check stopped it)')
      if (draining) return refuse(CODES.DRAINING, 'drained before the closure: zero write; no native fallback exists')
      entry.state = 'EXECUTING'
      observe({ event: 'backend-start', correlation: entry.correlation, detail: plan.canonicalTarget })
      let closure
      try {
        // The approved-root REAL identity is a POST-APPROVAL fact: read it
        // now (never a pre-approval FS read by classify); the closure then
        // demands the root still STANDS there before any truncation.
        const { realpath } = await import('node:fs/promises')
        const approvedRootReal = await realpath(instanceRootDir)
        closure = createPostConsumeWriteClosure(
          {
            approvedRootLexical: instanceRootDir,
            approvedRootReal,
            approvedLocator: plan.canonicalTarget,
            content: plan.content,
            planFingerprint: grant.parametersFingerprint, // THE consumed fingerprint — one plan, one spend
          },
          { parametersFingerprint: plan.parametersFingerprint, signal: consumed.signal },
          { instanceRootDir },
        )
      } catch (error) {
        // A construction violation is a broken FACT pairing, not a policy
        // answer: it refuses typed and the closure was never claimed.
        entry.state = 'REFUSED-AT-MINT'
        observe({ event: 'backend-end', correlation: entry.correlation, detail: 'refused-at-mint' })
        return refuse(CODES.GRANT_MISMATCH, `the post-consume closure refused to mint for this plan fact (${String(error?.message ?? error).slice(0, 200)}) — zero FS`)
      }
      const result = await closure.write()
      if (result.ok === true) {
        entry.state = 'COMMITTED'
        observe({ event: 'backend-commit', correlation: entry.correlation, detail: result.value.writtenFingerprint })
        observe({ event: 'backend-end', correlation: entry.correlation, detail: 'ok' })
        return { ok: true, value: Object.freeze({ ...result.value, existingFileOnly: true }) }
      }
      const mapped = mapClosureRefusal(result.error)
      if (mapped.cfClass === 'undetermined') {
        entry.state = 'FAILED-UNCONFIRMED'
        mapped.code = CODES.EXECUTION_UNCONFIRMED
      } else {
        entry.state = 'REFUSED'
      }
      observe({ event: 'backend-end', correlation: entry.correlation, detail: mapped.cfReason ?? mapped.code })
      return mapped
    })
  }

  /** The honest race report (todo law, write wording): the words agree with
   *  the observable closure state AT THIS INSTANT. */
  function cancel(plan) {
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(CODES.NOT_ADMITTED, 'cancel answers only to a plan this arm issued')
    if (entry.state === 'COMMITTED') {
      return { ok: true, settled: 'ALREADY-COMMITTED', writeOutcome: 'one — the bytes landed through the verified closure; cancellation cannot retract a write' }
    }
    if (entry.state === 'EXECUTING') {
      return { ok: true, settled: 'IN-FLIGHT', writeOutcome: 'the closure is mid-flight (truncate may have run): side-effect possible, never claimable as zero', sideEffectPossible: true }
    }
    entry.state = 'CANCELLED'
    observe({ event: 'cancelled', correlation: entry.correlation, detail: entry.state })
    return { ok: true, settled: 'CANCELLED', writeOutcome: 'zero — the closure was never claimed' }
  }

  /** Teardown half: no NEW call reaches any body; entered bodies are not
   *  rewound (honesty) and nothing falls back to native. */
  function drain() {
    draining = true
  }

  return {
    familyId: A5_WRITE_FAMILY_ID,
    adapterRevision: A5_WRITE_ADAPTER_REVISION,
    definitionIdentity,
    providerId,
    classify,
    prepare,
    execute,
    cancel,
    drain,
  }
}
