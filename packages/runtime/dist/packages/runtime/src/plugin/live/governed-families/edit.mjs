/**
 * A5-M2 B-EDIT family — the governed `edit` arm (root FS-EDIT card
 * 2026-10-25: "edit … must become a real governed row following the SAME
 * pattern you just shipped for write (same PA seat, closed effects — M-02's
 * pre-booked law: edit/replace REQUIRE the read effect too, cite it in the
 * arm), real edit execution through the original body after edge").
 *
 * THE CLOSED EFFECT SET for one governed edit (matrix M-02 verbatim, the
 * pre-booked line this row lands: "`edit`/`replace` 另需 read effect …
 * 配对 read effect 走同一受治理读臂, 不得另起弱读面"):
 *
 *   I:tool-invoke('edit') + F(read exact file) + F(write exact file)
 *
 * — no new effect kinds; the read effect is the SAME `read`-kind absolute-
 * path resource shape the read/write rows already use, and it is what makes
 * the receipt's before/after echo lawful (M-02: the echo rides ONLY under
 * the paired read; a write-only grant never carries those bytes). The
 * closure performs the read THROUGH ITS OWN BOUND FD under this approval —
 * the "同一受治理读臂" clause is satisfied by the approved plan's own read
 * leg, and no second weak read face exists anywhere on this path.
 *
 * Existence honesty (the write row's shipped law, carried over): the edit
 * NEVER creates. An absent target is a typed refusal inside the closure
 * (`not-a-file`), zero creation — stated in the approved law-fact
 * `creationPossible: false`, never discovered at classify (pure law).
 *
 * Plane-mount shape mirrors the write row: classify is pure (schema + value
 * law + lexical anchor + identity pairing; zero FS), ONE PA walk carries the
 * family block, the arm's prepare() answers only to the kernel grant, and
 * execute() — called ONLY with the real consumed proof — mints the private
 * ZERO-ARGUMENT post-consume closure from frozen plan facts (P1), runs it at
 * most once (P3), and reports honestly (P4).
 *
 * @module packages/runtime/src/plugin/live/governed-families/edit
 */

import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import path from 'node:path'

import { createPostConsumeEditClosure } from '../../../../controlled-fs/src/post-consume-edit.js'

export const A5_EDIT_FAMILY_ID = 'B-EDIT'
export const A5_EDIT_TOOL_NAME = 'edit'
/** The operation label: the edit law is ONE outcome (replace in place, never
 *  create), so — unlike `write` — the label is already existence-honest. */
export const A5_EDIT_OPERATION = 'edit-file'
/** The B-WRITE precedent: the revision number is IN the manifest; a bumped
 *  adapter must bump it and re-freeze. */
export const A5_EDIT_ADAPTER_REVISION = 1

export const A5_EDIT_TYPED_CODES = Object.freeze({
  CLASSIFY_INVALID_ARGUMENTS: 'P_EDIT_CLASSIFY_INVALID_ARGUMENTS',
  CLASSIFY_UNKNOWN_PARAMETER: 'P_EDIT_CLASSIFY_UNKNOWN_PARAMETER',
  NO_OWNING_SESSION: 'P_EDIT_NO_OWNING_SESSION',
  FOREIGN_SESSION: 'P_EDIT_FOREIGN_SESSION',
  ANCHOR_ESCAPE: 'P_EDIT_ANCHOR_ESCAPE',
  NOT_ADMITTED: 'P_EDIT_NOT_ADMITTED',
  ALREADY_CONSUMED: 'P_EDIT_ALREADY_CONSUMED',
  CANCELLED: 'P_EDIT_CANCELLED',
  DRAINING: 'P_EDIT_DRAINING',
  GRANT_MISMATCH: 'P_EDIT_GRANT_MISMATCH',
  CLOSURE_REFUSED: 'P_EDIT_CLOSURE_REFUSED',
  EXECUTION_UNCONFIRMED: 'P_EDIT_EXECUTION_UNCONFIRMED',
})
const CODES = A5_EDIT_TYPED_CODES

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

/** Pure lexical anchor — the write row's law, byte-for-byte the same rule
 *  (the root IS the namespace; absolute spellings and `..` escapes refuse). */
function lexicalAnchor(rootDir, rawPath) {
  if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.includes('\0')) return null
  if (path.isAbsolute(rawPath)) return null // relative-only spelling: the root IS the namespace
  const resolved = path.resolve(rootDir, rawPath)
  const rel = path.relative(rootDir, resolved)
  if (rel.length === 0 || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null
  return resolved
}

/** The honest lane mapping (the write row's mapClosureRefusal, verbatim):
 *  `undetermined` ALWAYS keeps side-effect honesty. */
function mapClosureRefusal(error) {
  const cfClass = error?.details?.cfClass
  const cfReason = error?.details?.cfReason
  const sideEffectUnknown = error?.details?.sideEffectUnknown
  const base = {
    code: CODES.CLOSURE_REFUSED,
    detail: `refused-fs ${String(error?.code ?? 'unknown')} — ${String(error?.message ?? 'the edit closure refused')}`,
    ...(typeof cfClass === 'string' ? { cfClass } : {}),
    ...(typeof cfReason === 'string' ? { cfReason } : {}),
  }
  if (cfClass === 'undetermined') {
    return { ...base, sideEffectPossible: sideEffectUnknown !== false }
  }
  return sideEffectUnknown === true ? { ...base, sideEffectPossible: true } : base
}

/**
 * The one governed edit arm for ONE member instance (construction + pairing
 * law identical to the write arm — see governed-families/write.mjs).
 *
 * @param deps - {definitionIdentity, providerId, realmId, memberAgentId,
 *   sessionHeaderId, instanceRootDir, bindingFacts, observe}
 */
export function createGovernedEditArm({
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
    throw new TypeError('governed-families/edit: definitionIdentity must be a non-empty string (an unbound arm is a config defect)')
  }
  if (typeof providerId !== 'string' || providerId.length === 0) {
    throw new TypeError('governed-families/edit: providerId must be a non-empty string (the placing assembly identifies itself)')
  }
  if (typeof realmId !== 'string' || realmId.length === 0) {
    throw new TypeError('governed-families/edit: realmId must be a non-empty string (effect resources carry it)')
  }
  if (typeof memberAgentId !== 'string' || memberAgentId.length === 0 || typeof sessionHeaderId !== 'string' || sessionHeaderId.length === 0) {
    throw new TypeError('governed-families/edit: memberAgentId and sessionHeaderId are required (the REAL Host identity pairing has no otherwise)')
  }
  if (typeof instanceRootDir !== 'string' || !path.isAbsolute(instanceRootDir)) {
    throw new TypeError('governed-families/edit: instanceRootDir must be a non-empty ABSOLUTE path (the approved edit namespace)')
  }
  if (typeof bindingFacts !== 'function') {
    throw new TypeError('governed-families/edit: bindingFacts must be the injected reader (the arm mints no generations of its own)')
  }
  // THE trusted governed-root identity is established at BIND time (the
  // write arm's reviewed @1a399 law, verbatim): resolved ONCE here, frozen;
  // execution only VERIFIES the standpoint against this frozen expectation.
  let approvedRootReal
  try {
    approvedRootReal = realpathSync(instanceRootDir)
  } catch (error) {
    throw new TypeError(`governed-families/edit: instanceRootDir does not resolve to a real governed root (${instanceRootDir}): ${String(error?.message ?? error)}`)
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

  /** REAL Host-shape identity read (the write arm's law verbatim). */
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
    // The full fixed-639 public schema carries the CONDITIONAL escalation
    // fields (sandbox_permissions / justification); a governed row has NO
    // escalation lane (the human approval IS the authority), so a set value
    // is refused HERE — never silently ignored, never honoured.
    const unknownTop = Object.keys(args).filter((k) => k !== 'file_path' && k !== 'old_string' && k !== 'new_string' && k !== 'replace_all' && k !== 'sandbox_permissions' && k !== 'justification')
    if (unknownTop.length > 0) {
      return refuse(CODES.CLASSIFY_UNKNOWN_PARAMETER, `undeclared top-level parameter(s): ${unknownTop.join(', ')} — the governed root is closed (the host schema layer does not refuse these; this arm does)`)
    }
    const escalation = ['sandbox_permissions', 'justification'].filter((k) => args[k] !== undefined)
    if (escalation.length > 0) {
      return refuse(CODES.CLASSIFY_UNKNOWN_PARAMETER, `the governed edit has NO escalation lane: ${escalation.join(', ')} cannot be honoured here — the approval the human answers IS the authority (a set escalation field refuses typed, never silently)`)
    }
    if (typeof args.file_path !== 'string' || args.file_path.trim().length === 0) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"file_path" must be a non-blank string (the native parseEditArgs law)')
    }
    if (typeof args.old_string !== 'string' || args.old_string.length === 0) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"old_string" must be a non-empty string (the native parseEditArgs law)')
    }
    if (typeof args.new_string !== 'string') {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"new_string" must be a string (the empty string deletes the match)')
    }
    if (args.old_string === args.new_string) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"old_string" and "new_string" must differ — a guaranteed no-op never earns an approval')
    }
    if (args.replace_all !== undefined && typeof args.replace_all !== 'boolean') {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, '"replace_all" must be a boolean or absent (absent means false — the native default law)')
    }
    const { agentId, headerId } = readIdentity(exec)
    if (agentId === null || headerId === null) {
      return refuse(CODES.NO_OWNING_SESSION, 'no real exec.agent.id / exec.agent.session.header.id: this governed edit runs for one owning member session and this caller presents none')
    }
    if (agentId !== memberAgentId || headerId !== sessionHeaderId) {
      return refuse(CODES.FOREIGN_SESSION, `identity pairing failed against the bind-time facts (agent ${JSON.stringify(agentId)} vs ${JSON.stringify(memberAgentId)}, session.header ${JSON.stringify(headerId)} vs ${JSON.stringify(sessionHeaderId)})`)
    }
    const anchored = lexicalAnchor(instanceRootDir, args.file_path)
    if (anchored === null) {
      return refuse(CODES.ANCHOR_ESCAPE, 'file_path must resolve STRICTLY beneath the instance root by pure lexical law (absolute spellings and .. escapes refuse here; the closure re-derives the same law independently before any byte)')
    }
    // THE CLOSED EFFECT SET — M-02's pre-booked line, verbatim:
    // "`edit`/`replace` 另需 read effect；配对 read effect 走同一受治理读臂,
    // 不得另起弱读面". One exact file, read + write, no new kinds.
    const effects = deepFreeze([
      { kind: 'tool-invoke', toolName: A5_EDIT_TOOL_NAME, resource: null },
      { kind: 'read', resource: { realmId, kind: 'absolute-path', canonicalLocator: anchored, rights: ['read'] } },
      { kind: 'write', resource: { realmId, kind: 'absolute-path', canonicalLocator: anchored, rights: ['write'] } },
    ])
    const targetManifest = deepFreeze({
      familyId: A5_EDIT_FAMILY_ID,
      adapterRevision: A5_EDIT_ADAPTER_REVISION,
      operation: A5_EDIT_OPERATION,
      realmId,
      canonicalTarget: anchored,
      oldFingerprint: `sha256:${sha256(args.old_string)}`,
      newFingerprint: `sha256:${sha256(args.new_string)}`,
      replaceAll: args.replace_all === true,
      // THE EXISTENCE-HONEST LAW-FACT (the write row's shipped discipline):
      // what the human approves is the LAW, never a discovered fact.
      creationPossible: false,
      editFileLaw: 'read-verify-replace THROUGH ONE bound O_RDWR|O_NOFOLLOW fd inside the frozen anchor (verify-before-truncate class; 0 occurrences refuse "did not appear verbatim"; multiple refuse unique-law unless replace_all; the edit NEVER creates)',
      readEffectLaw: 'M-02 pre-booked law (verbatim): "edit/replace 另需 read effect；配对 read effect 走同一受治理读臂, 不得另起弱读面" — the read leg runs inside THIS approved closure on the bound fd',
      echoLaw: 'the receipt before/after echo rides ONLY under the paired READ effect on this exact locator; a write-only grant never carries those bytes',
    })
    const generations = generationFacts()
    const reviewPayload = deepFreeze({
      familyId: A5_EDIT_FAMILY_ID,
      adapterRevision: A5_EDIT_ADAPTER_REVISION,
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
      familyId: A5_EDIT_FAMILY_ID,
      adapterRevision: A5_EDIT_ADAPTER_REVISION,
      toolName: A5_EDIT_TOOL_NAME,
      definitionIdentity,
      providerId,
      callId,
      effects,
      reviewPayload,
      parametersFingerprint,
      canonicalTarget: anchored,
      oldString: args.old_string,
      newString: args.new_string,
      replaceAll: args.replace_all === true,
      generationsAtClassify: Object.freeze(generations),
    })
    correlationSeq += 1
    const correlation = `edit.r${A5_EDIT_ADAPTER_REVISION}.${correlationSeq}.${callId}`
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
   * THE POST-CONSUME ENTRY — called ONLY after the REAL A edge answered with
   * a consumed grant. Mints the private zero-argument edit closure from the
   * frozen plan facts alone (P1) and calls it once (P3).
   */
  function execute(plan, consumed) {
    const entry = plans.get(plan)
    if (entry === undefined) return Promise.resolve(refuse(CODES.NOT_ADMITTED, 'unknown plan: execute answers only to a plan this arm classified'))
    if (entry.state === 'CANCELLED') return Promise.resolve(refuse(CODES.CANCELLED, 'the plan was cancelled before the edge: zero edit is the truth, not a race'))
    if (entry.state !== 'PREPARED') {
      const spent = entry.state === 'CLAIMED' || entry.state === 'EXECUTING' || entry.state === 'COMMITTED'
      return Promise.resolve(refuse(spent ? CODES.ALREADY_CONSUMED : CODES.NOT_ADMITTED, `plan is ${entry.state}`))
    }
    const grant = consumed?.grant
    if (consumed?.consumed !== true || grant === null || typeof grant !== 'object' || typeof grant.grantId !== 'string') {
      return Promise.resolve(refuse(CODES.NOT_ADMITTED, 'execute takes the REAL consumed-proof of the A execution edge ({grant, consumed:true}); internal state never substitutes for it'))
    }
    // PAIRING (the write arm's law verbatim): the consumed grant answers THIS
    // plan only.
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
      // COMMIT-EDGE RE-CHECK (the write row's law): a cancel/drain landing
      // before the body is entered stops it HERE — zero claims.
      if (entry.state === 'CANCELLED') return refuse(CODES.CANCELLED, 'cancelled before the closure: zero edit (the commit-edge re-check stopped it)')
      if (draining) return refuse(CODES.DRAINING, 'drained before the closure: zero edit; no native fallback exists')
      entry.state = 'EXECUTING'
      observe({ event: 'backend-start', correlation: entry.correlation, detail: plan.canonicalTarget })
      let closure
      try {
        closure = createPostConsumeEditClosure(
          {
            approvedRootLexical: instanceRootDir,
            approvedRootReal,
            approvedLocator: plan.canonicalTarget,
            oldString: plan.oldString,
            newString: plan.newString,
            replaceAll: plan.replaceAll,
            planFingerprint: grant.parametersFingerprint, // THE consumed fingerprint — one plan, one spend
          },
          { parametersFingerprint: plan.parametersFingerprint, signal: consumed.signal },
          { instanceRootDir },
        )
      } catch (error) {
        entry.state = 'REFUSED-AT-MINT'
        observe({ event: 'backend-end', correlation: entry.correlation, detail: 'refused-at-mint' })
        return refuse(CODES.GRANT_MISMATCH, `the post-consume closure refused to mint for this plan fact (${String(error?.message ?? error).slice(0, 200)}) — the mint is pure (the root real is the frozen bind-time fact): zero FS on this path, the closure was never claimed`)
      }
      const result = await closure.write()
      if (result.ok === true) {
        entry.state = 'COMMITTED'
        observe({ event: 'backend-commit', correlation: entry.correlation, detail: `${String(result.value.before.length)}->${String(result.value.after.length)}` })
        observe({ event: 'backend-end', correlation: entry.correlation, detail: 'ok' })
        // The receipt carries {canonicalLocator, before, after}: the echo
        // pair is lawfully present because THIS approval carried the paired
        // read effect (M-02) — the arm adds nothing.
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

  /** The honest race report (the write arm's law, edit wording). */
  function cancel(plan) {
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(CODES.NOT_ADMITTED, 'cancel answers only to a plan this arm issued')
    if (entry.state === 'COMMITTED') {
      return { ok: true, settled: 'ALREADY-COMMITTED', editOutcome: 'one — the replacement landed through the verified closure; cancellation cannot retract an edit' }
    }
    if (entry.state === 'EXECUTING') {
      return { ok: true, settled: 'IN-FLIGHT', editOutcome: 'the closure is mid-flight (truncate may have run): side-effect possible, never claimable as zero', sideEffectPossible: true }
    }
    entry.state = 'CANCELLED'
    observe({ event: 'cancelled', correlation: entry.correlation, detail: entry.state })
    return { ok: true, settled: 'CANCELLED', editOutcome: 'zero — the closure was never claimed' }
  }

  /** Teardown half: no NEW call reaches any body; entered bodies are not
   *  rewound (honesty) and nothing falls back to native. */
  function drain() {
    draining = true
  }

  return {
    familyId: A5_EDIT_FAMILY_ID,
    adapterRevision: A5_EDIT_ADAPTER_REVISION,
    definitionIdentity,
    providerId,
    classify,
    prepare,
    execute,
    cancel,
    drain,
  }
}
