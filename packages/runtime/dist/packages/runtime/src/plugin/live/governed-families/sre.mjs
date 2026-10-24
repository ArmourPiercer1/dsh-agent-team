/**
 * A5-M2 B-SRE family — the governed `str_replace_editor` arm (root FS-EDIT
 * card 2026-10-25: "str_replace_editor: FOUR branches view/create/replace/
 * insert per the fixed-639 public schema — each branch governed (the create/
 * insert branches interact with your just-landed create law; view/replace
 * are edits - read effect required)").
 *
 * THE CLOSED EFFECT SET per branch (closed vocabulary only; M-02's verbatim
 * "edit/replace 另需 read effect；配对 read effect 走同一受治理读臂, 不得
 * 另起弱读面" rides the three read-carrying branches exactly as the B-EDIT
 * arm carries it — the approved closure performs the read on its OWN bound
 * fd, there is no second read face):
 *
 *   view        I:tool-invoke('str_replace_editor') + F(read exact path)
 *   create      I:tool-invoke('str_replace_editor') + F(write exact file)
 *   str_replace I:tool-invoke('str_replace_editor') + F(read) + F(write)
 *   insert      I:tool-invoke('str_replace_editor') + F(read) + F(write)
 *
 * — `view` asks for NO write (it cannot mutate: the closure's view branch
 * opens O_RDONLY and truncates nothing); `create` asks for NO read (it
 * reads nothing — a present target LOSES through the delegated create
 * law's O_EXCL, the native "Cannot overwrite" rule answered by the same
 * exclusive-create race, and an approval without a read never echoes).
 * creationPossible is TRUE only in the create branch — the other three
 * carry the write row's existence-honest law-fact (never creates).
 *
 * Plane-mount shape mirrors the write/edit rows exactly: classify is pure
 * (closed schema + per-command value law + lexical anchor + identity
 * pairing; zero FS), ONE PA walk carries the family block, prepare()
 * answers only to the kernel grant, execute() — called ONLY with the real
 * consumed proof — mints the private ZERO-ARGUMENT post-consume closure
 * from frozen plan facts (P1), runs it at most once (P3), reports honestly
 * (P4). The public parameter set is closed at the seven fixed-639 names; an
 * undeclared parameter refuses HERE (the host schema layer does not refuse
 * it; this arm does), which is also why the governed row carries NO
 * escalation lane.
 *
 * @module packages/runtime/src/plugin/live/governed-families/sre
 */

import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import path from 'node:path'

import { createPostConsumeSreClosure } from '../../../../controlled-fs/src/post-consume-sre.js'

export const A5_SRE_FAMILY_ID = 'B-SRE'
export const A5_SRE_TOOL_NAME = 'str_replace_editor'
/** The revision number is IN the manifest (the B-WRITE precedent). */
export const A5_SRE_ADAPTER_REVISION = 1
/** The four closed branches (the fixed-639 enum, same spelling). */
export const A5_SRE_COMMANDS = Object.freeze(['view', 'create', 'str_replace', 'insert'])
/** The fixed-639 public parameter names — the CLOSED set (null placeholders
 *  are the schema's own omitted-meeting spelling). */
const SRE_PUBLIC_PARAMS = Object.freeze(['command', 'path', 'file_text', 'insert_line', 'new_str', 'old_str', 'view_range'])

export const A5_SRE_TYPED_CODES = Object.freeze({
  CLASSIFY_INVALID_ARGUMENTS: 'P_SRE_CLASSIFY_INVALID_ARGUMENTS',
  CLASSIFY_UNKNOWN_PARAMETER: 'P_SRE_CLASSIFY_UNKNOWN_PARAMETER',
  NO_OWNING_SESSION: 'P_SRE_NO_OWNING_SESSION',
  FOREIGN_SESSION: 'P_SRE_FOREIGN_SESSION',
  ANCHOR_ESCAPE: 'P_SRE_ANCHOR_ESCAPE',
  NOT_ADMITTED: 'P_SRE_NOT_ADMITTED',
  ALREADY_CONSUMED: 'P_SRE_ALREADY_CONSUMED',
  CANCELLED: 'P_SRE_CANCELLED',
  DRAINING: 'P_SRE_DRAINING',
  GRANT_MISMATCH: 'P_SRE_GRANT_MISMATCH',
  CLOSURE_REFUSED: 'P_SRE_CLOSURE_REFUSED',
  EXECUTION_UNCONFIRMED: 'P_SRE_EXECUTION_UNCONFIRMED',
})
const CODES = A5_SRE_TYPED_CODES

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

/** Pure lexical anchor — the write/edit rows' law, byte-for-byte the same
 *  rule (the root IS the namespace; absolute spellings and `..` escape). */
function lexicalAnchor(rootDir, rawPath) {
  if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.includes('\0')) return null
  if (path.isAbsolute(rawPath)) return null // relative-only spelling: the root IS the namespace
  const resolved = path.resolve(rootDir, rawPath)
  const rel = path.relative(rootDir, resolved)
  if (rel.length === 0 || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null
  return resolved
}

/** The honest lane mapping (the write row's mapClosureRefusal, verbatim). */
function mapClosureRefusal(error) {
  const cfClass = error?.details?.cfClass
  const cfReason = error?.details?.cfReason
  const sideEffectUnknown = error?.details?.sideEffectUnknown
  const base = {
    code: CODES.CLOSURE_REFUSED,
    detail: `refused-fs ${String(error?.code ?? 'unknown')} — ${String(error?.message ?? 'the str_replace_editor closure refused')}`,
    ...(typeof cfClass === 'string' ? { cfClass } : {}),
    ...(typeof cfReason === 'string' ? { cfReason } : {}),
  }
  if (cfClass === 'undetermined') {
    return { ...base, sideEffectPossible: sideEffectUnknown !== false }
  }
  return sideEffectUnknown === true ? { ...base, sideEffectPossible: true } : base
}

/** The native view_range law (index.ts:455 null-means-omitted, formatFileView
 *  two-integer law), checked PURELY at classify so a malformed range never
 *  earns an approval. */
function normalizeViewRange(value) {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isInteger)) {
    return { refuse: 'Invalid `view_range`. It should be a list of two integers.' }
  }
  const [a, b] = value
  if (a < 1) return { refuse: 'Invalid `view_range`: its first element should be within the range of lines of the file: [1, N]' }
  if (b !== -1 && b < a) return { refuse: 'Invalid `view_range`: its second element should be larger or equal than its first' }
  return [a, b]
}

const M02_READ_LAW = 'M-02 pre-booked law (verbatim): "edit/replace 另需 read effect；配对 read effect 走同一受治理读臂, 不得另起弱读面" — the read leg runs inside THIS approved closure on the bound fd'

/**
 * The one governed str_replace_editor arm for ONE member instance
 * (construction + pairing law identical to the edit arm).
 *
 * @param deps - {definitionIdentity, providerId, realmId, memberAgentId,
 *   sessionHeaderId, instanceRootDir, bindingFacts, observe, maxOutputChars}
 */
export function createGovernedSreArm({
  definitionIdentity,
  providerId,
  realmId,
  memberAgentId,
  sessionHeaderId,
  instanceRootDir,
  bindingFacts,
  observe = () => {},
  maxOutputChars,
}) {
  if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) {
    throw new TypeError('governed-families/sre: definitionIdentity must be a non-empty string (an unbound arm is a config defect)')
  }
  if (typeof providerId !== 'string' || providerId.length === 0) {
    throw new TypeError('governed-families/sre: providerId must be a non-empty string (the placing assembly identifies itself)')
  }
  if (typeof realmId !== 'string' || realmId.length === 0) {
    throw new TypeError('governed-families/sre: realmId must be a non-empty string (effect resources carry it)')
  }
  if (typeof memberAgentId !== 'string' || memberAgentId.length === 0 || typeof sessionHeaderId !== 'string' || sessionHeaderId.length === 0) {
    throw new TypeError('governed-families/sre: memberAgentId and sessionHeaderId are required (the REAL Host identity pairing has no otherwise)')
  }
  if (typeof instanceRootDir !== 'string' || !path.isAbsolute(instanceRootDir)) {
    throw new TypeError('governed-families/sre: instanceRootDir must be a non-empty ABSOLUTE path (the approved editor namespace)')
  }
  if (typeof bindingFacts !== 'function') {
    throw new TypeError('governed-families/sre: bindingFacts must be the injected reader (the arm mints no generations of its own)')
  }
  const viewBudget = maxOutputChars === undefined ? 16_000 : (Number.isInteger(maxOutputChars) && maxOutputChars > 0 ? maxOutputChars : (() => { throw new TypeError('governed-families/sre: maxOutputChars must be a positive integer when given (the native config default is 16000)') })())
  let approvedRootReal
  try {
    approvedRootReal = realpathSync(instanceRootDir)
  } catch (error) {
    throw new TypeError(`governed-families/sre: instanceRootDir does not resolve to a real governed root (${instanceRootDir}): ${String(error?.message ?? error)}`)
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
    const unknownTop = Object.keys(args).filter((k) => !SRE_PUBLIC_PARAMS.includes(k))
    if (unknownTop.length > 0) {
      return refuse(CODES.CLASSIFY_UNKNOWN_PARAMETER, `undeclared top-level parameter(s): ${unknownTop.join(', ')} — the governed root is closed (the host schema layer does not refuse these; this arm does)`)
    }
    if (!A5_SRE_COMMANDS.includes(args.command)) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"command" must be one of view/create/str_replace/insert (the fixed-639 closed enum)')
    }
    if (typeof args.path !== 'string' || args.path.trim().length === 0) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"path" must be a non-blank string (the native resolveTarget law)')
    }
    const command = args.command
    // Per-command VALUE law (the native requiredForCommand law, enforced
    // PURELY here so a malformed call never earns an approval). null
    // placeholders mean OMITTED on every parameter except str_replace's
    // new_str — the native law treats `new_str: null` there as a typed
    // refusal, which this arm enforces EARLIER (only-tightened).
    const omitted = (v) => v === undefined || v === null
    if (command === 'create') {
      if (omitted(args.file_text)) return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'Parameter `file_text` is required for command: create')
      if (typeof args.file_text !== 'string') return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"file_text" must be a string for command: create (the empty string is legal)')
    }
    if (command === 'str_replace') {
      if (omitted(args.old_str)) return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'Parameter `old_str` is required for command: str_replace')
      if (typeof args.old_str !== 'string' || args.old_str.length === 0) return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'Parameter `old_str` is empty for command: str_replace')
      if (args.new_str === null) return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'str_replace refuses new_str null (the native typed refusal — omitted is legal, null is not)')
      if (args.new_str !== undefined && typeof args.new_str !== 'string') return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"new_str" must be a string or omitted for command: str_replace (omitted deletes the match)')
    }
    if (command === 'insert') {
      if (omitted(args.insert_line)) return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'Parameter `insert_line` is required for command: insert')
      if (!Number.isInteger(args.insert_line)) return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"insert_line" must be an integer for command: insert')
      if (omitted(args.new_str)) return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'Parameter `new_str` is required for command: insert')
      if (typeof args.new_str !== 'string') return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"new_str" must be a string for command: insert (the empty string is legal)')
    }
    if (command !== 'view' && args.view_range !== undefined && args.view_range !== null) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'The `view_range` parameter is not allowed for command: ' + command)
    }
    const viewRange = command === 'view' ? normalizeViewRange(args.view_range) : null
    if (viewRange !== null && !Array.isArray(viewRange)) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, viewRange.refuse)
    }
    const { agentId, headerId } = readIdentity(exec)
    if (agentId === null || headerId === null) {
      return refuse(CODES.NO_OWNING_SESSION, 'no real exec.agent.id / exec.agent.session.header.id: this governed editor call runs for one owning member session and this caller presents none')
    }
    if (agentId !== memberAgentId || headerId !== sessionHeaderId) {
      return refuse(CODES.FOREIGN_SESSION, `identity pairing failed against the bind-time facts (agent ${JSON.stringify(agentId)} vs ${JSON.stringify(memberAgentId)}, session.header ${JSON.stringify(headerId)} vs ${JSON.stringify(sessionHeaderId)})`)
    }
    const anchored = lexicalAnchor(instanceRootDir, args.path)
    if (anchored === null) {
      return refuse(CODES.ANCHOR_ESCAPE, 'path must resolve STRICTLY beneath the instance root by pure lexical law (absolute spellings and .. escapes refuse here; the closure re-derives the same law independently before any byte)')
    }

    // THE CLOSED EFFECT SETS, per branch (no new kinds; the read resource
    // is the SAME absolute-path shape the read/write/edit rows use).
    const invoke = { kind: 'tool-invoke', toolName: A5_SRE_TOOL_NAME, resource: null }
    const readEffect = { kind: 'read', resource: { realmId, kind: 'absolute-path', canonicalLocator: anchored, rights: ['read'] } }
    const writeEffect = { kind: 'write', resource: { realmId, kind: 'absolute-path', canonicalLocator: anchored, rights: ['write'] } }
    const effects = deepFreeze(
      command === 'view' ? [invoke, readEffect]
        : command === 'create' ? [invoke, writeEffect]
          : [invoke, readEffect, writeEffect],
    )

    const commonManifest = {
      familyId: A5_SRE_FAMILY_ID,
      adapterRevision: A5_SRE_ADAPTER_REVISION,
      operation: `sre-${command}`,
      realmId,
      canonicalTarget: anchored,
      sreVariant: command,
      // THE EXISTENCE-HONEST LAW-FACT: true ONLY for create (the branch
      // whose reviewed law can bring a file into being); the other three
      // state never-creates. Law, never a discovered fact.
      creationPossible: command === 'create',
    }
    const targetManifest = deepFreeze(
      command === 'view' ? {
        ...commonManifest,
        viewRange: viewRange === null ? 'none' : `[${String(viewRange[0])}, ${String(viewRange[1])}]`,
        maxOutputChars: viewBudget,
        viewLaw: 'the native @639 view law: FILE = numbered view (prompt line, 6-wide numbers, the view_range bounds words, surrogate-safe truncation at the budget with the host clipped suffix) THROUGH ONE bound O_RDONLY|O_NOFOLLOW fd verified inside the frozen anchor; DIRECTORY = the 2-level listing (hidden/node_modules/__pycache__ filtered, codepoint-sorted, view_range forbidden there); zero mutation is structural',
        readEffectLaw: M02_READ_LAW,
        echoLaw: 'the receipt view text rides ONLY under the READ effect on this exact locator; a write-only grant never carries it',
        neverCreatesLaw: 'this B-SRE branch never creates: an absent target is a typed refusal inside the closure, zero creation (the write row existence-honest law); creationPossible false',
      } : command === 'create' ? {
        ...commonManifest,
        fileTextFingerprint: `sha256:${sha256(args.file_text)}`,
        createFileLaw: 'the shipped create law, delegated verbatim: O_EXCL create THROUGH the verified final-parent fd inside the frozen anchor; a present target LOSES the race with zero bytes (the native "Cannot overwrite files using command `create`" rule answered by the same exclusive create); NO directory creation; no read effect asked, no echo',
        creationLaw: 'create is the ONLY B-SRE branch whose reviewed law can bring a file into being (O_EXCL through the verified final-parent fd); a present target loses with zero bytes; creationPossible true',
      } : command === 'str_replace' ? {
        ...commonManifest,
        oldFingerprint: `sha256:${sha256(args.old_str)}`,
        newFingerprint: `sha256:${sha256(args.new_str ?? '')}`,
        strReplaceLaw: 'read-verify-replace THROUGH ONE bound O_RDWR|O_NOFOLLOW fd inside the frozen anchor (verify-before-truncate class; 0 occurrences refuse "did not appear verbatim"; multiple refuse unique-law with the line list; the call NEVER creates)',
        readEffectLaw: M02_READ_LAW,
        echoLaw: 'the receipt before/after echo rides ONLY under the paired READ effect on this exact locator; a write-only grant never carries those bytes',
        neverCreatesLaw: 'this B-SRE branch never creates: an absent target is a typed refusal inside the closure, zero creation (the write row existence-honest law); creationPossible false',
      } : {
        ...commonManifest,
        newStrFingerprint: `sha256:${sha256(args.new_str)}`,
        insertLine: args.insert_line,
        insertLaw: 'read-verify-splice THROUGH ONE bound O_RDWR|O_NOFOLLOW fd inside the frozen anchor (insert_line an INTEGER within [0, lineCount] with the native bounds message; lines spliced at the index; verify-before-truncate + per-chunk cancel write loop; the call NEVER creates)',
        readEffectLaw: M02_READ_LAW,
        echoLaw: 'the receipt before/after echo rides ONLY under the paired READ effect on this exact locator; a write-only grant never carries those bytes',
        neverCreatesLaw: 'this B-SRE branch never creates: an absent target is a typed refusal inside the closure, zero creation (the write row existence-honest law); creationPossible false',
      },
    )
    const generations = generationFacts()
    const reviewPayload = deepFreeze({
      familyId: A5_SRE_FAMILY_ID,
      adapterRevision: A5_SRE_ADAPTER_REVISION,
      providerIdentity: providerId,
      definitionIdentity,
      targetManifest,
    })
    const parametersFingerprint = `sha256:${sha256(canonicalJson({
      ...generations,
      callId,
      effects,
      reviewPayload,
    }))}`
    const plan = deepFreeze({
      familyId: A5_SRE_FAMILY_ID,
      adapterRevision: A5_SRE_ADAPTER_REVISION,
      toolName: A5_SRE_TOOL_NAME,
      definitionIdentity,
      providerId,
      callId,
      effects,
      reviewPayload,
      parametersFingerprint,
      canonicalTarget: anchored,
      command,
      fileText: command === 'create' ? args.file_text : null,
      oldStr: command === 'str_replace' ? args.old_str : null,
      newStr: command === 'str_replace' ? (args.new_str ?? '') : command === 'insert' ? args.new_str : null,
      insertLine: command === 'insert' ? args.insert_line : null,
      viewRange: viewRange === null ? null : Object.freeze([...viewRange]),
      generationsAtClassify: Object.freeze(generations),
    })
    correlationSeq += 1
    const correlation = `sre.r${A5_SRE_ADAPTER_REVISION}.${correlationSeq}.${callId}`
    plans.set(plan, { state: 'CLASSIFIED', correlation })
    observe({ event: 'classify', correlation, detail: parametersFingerprint })
    return { ok: true, plan, effects, reviewPayload, parametersFingerprint, manifest: targetManifest }
  }

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
   * THE POST-CONSUME ENTRY — called ONLY after the REAL A edge answered with
   * a consumed grant. Mints the private zero-argument closure from the
   * frozen plan facts alone (P1) and calls it once (P3).
   */
  function execute(plan, consumed) {
    const entry = plans.get(plan)
    if (entry === undefined) return Promise.resolve(refuse(CODES.NOT_ADMITTED, 'unknown plan: execute answers only to a plan this arm classified'))
    if (entry.state === 'CANCELLED') return Promise.resolve(refuse(CODES.CANCELLED, 'the plan was cancelled before the edge: zero editor effect is the truth, not a race'))
    if (entry.state !== 'PREPARED') {
      const spent = entry.state === 'CLAIMED' || entry.state === 'EXECUTING' || entry.state === 'COMMITTED'
      return Promise.resolve(refuse(spent ? CODES.ALREADY_CONSUMED : CODES.NOT_ADMITTED, `plan is ${entry.state}`))
    }
    const grant = consumed?.grant
    if (consumed?.consumed !== true || grant === null || typeof grant !== 'object' || typeof grant.grantId !== 'string') {
      return Promise.resolve(refuse(CODES.NOT_ADMITTED, 'execute takes the REAL consumed-proof of the A execution edge ({grant, consumed:true}); internal state never substitutes for it'))
    }
    if (
      grant.callId !== plan.callId
      || grant.parametersFingerprint !== plan.parametersFingerprint
      || grant.bindingId !== plan.generationsAtClassify.bindingId
      || grant.bindingRevision !== plan.generationsAtClassify.bindingRevision
    ) {
      return Promise.resolve(refuse(CODES.GRANT_MISMATCH, 'the consumed grant does not answer to this plan (callId / parametersFingerprint / binding-generation pairing): a grant spent for one payload never edits another file'))
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
      if (entry.state === 'CANCELLED') return refuse(CODES.CANCELLED, 'cancelled before the closure: zero editor effect (the commit-edge re-check stopped it)')
      if (draining) return refuse(CODES.DRAINING, 'drained before the closure: zero editor effect; no native fallback exists')
      entry.state = 'EXECUTING'
      observe({ event: 'backend-start', correlation: entry.correlation, detail: `${plan.command} ${String(plan.canonicalTarget)}` })
      let closure
      try {
        closure = createPostConsumeSreClosure(
          {
            approvedRootLexical: instanceRootDir,
            approvedRootReal,
            approvedLocator: plan.canonicalTarget,
            command: plan.command,
            fileText: plan.fileText,
            oldStr: plan.oldStr,
            newStr: plan.newStr,
            insertLine: plan.insertLine,
            viewRange: plan.viewRange,
            planFingerprint: grant.parametersFingerprint, // THE consumed fingerprint — one plan, one spend
          },
          { parametersFingerprint: plan.parametersFingerprint, signal: consumed.signal },
          { instanceRootDir, maxOutputChars: viewBudget },
        )
      } catch (error) {
        entry.state = 'REFUSED-AT-MINT'
        observe({ event: 'backend-end', correlation: entry.correlation, detail: 'refused-at-mint' })
        return refuse(CODES.GRANT_MISMATCH, `the post-consume closure refused to mint for this plan fact (${String(error?.message ?? error).slice(0, 200)}) — the mint is pure (the root real is the frozen bind-time fact): zero FS on this path, the closure was never claimed`)
      }
      const result = await closure.write()
      if (result.ok === true) {
        entry.state = 'COMMITTED'
        observe({ event: 'backend-commit', correlation: entry.correlation, detail: plan.command })
        observe({ event: 'backend-end', correlation: entry.correlation, detail: 'ok' })
        // The receipt carries {canonicalLocator, rendered, …}; the before/
        // after echo is lawfully present ONLY on the branches whose
        // approval carried the paired read effect (M-02) — the arm adds
        // nothing, and create/view receipts carry no pair the grant missed.
        return { ok: true, value: result.value }
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

  function cancel(plan) {
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(CODES.NOT_ADMITTED, 'cancel answers only to a plan this arm issued')
    if (entry.state === 'COMMITTED') {
      return { ok: true, settled: 'ALREADY-COMMITTED', sreOutcome: 'one — the branch ran through the verified closure; cancellation cannot retract it' }
    }
    if (entry.state === 'EXECUTING') {
      return { ok: true, settled: 'IN-FLIGHT', sreOutcome: 'the closure is mid-flight (truncate may have run): side-effect possible, never claimable as zero', sideEffectPossible: true }
    }
    entry.state = 'CANCELLED'
    observe({ event: 'cancelled', correlation: entry.correlation, detail: entry.state })
    return { ok: true, settled: 'CANCELLED', sreOutcome: 'zero — the closure was never claimed' }
  }

  function drain() {
    draining = true
  }

  return {
    familyId: A5_SRE_FAMILY_ID,
    adapterRevision: A5_SRE_ADAPTER_REVISION,
    definitionIdentity,
    providerId,
    classify,
    prepare,
    execute,
    cancel,
    drain,
  }
}
