/**
 * governed-families/image.mjs — A5-M2 B-IMAGE `read_image` governed arm,
 * REVISION 2 (the center fix card). Revision 1 was root-measured blocked at
 * six defects and NEVER mounted; the revision number moves so no consumer
 * can confuse the two (FINDINGS-BLOCKED.md owns the full accounting).
 *
 * Where each measured defect's law lives now:
 *  1/2. NO local ticket ledger, NO self-reported exec identity: execution
 *     requires the strict-manifest CHAIN receipt — the durable pa-control
 *     leg's own `approve` result (requestId + minted one-shot grant + the
 *     DURABLE-row manifest the guard consumed through). The durable guard
 *     consumption IS the correlation-level single flight (control service
 *     check-and-reserve under the team lock; the deterministic per-call
 *     grantId means a replay answers the SAME grant against an
 *     ALREADY-CONSUMED durable fact). The arm holds no ledger and adds no
 *     protocol ("edge 唯一 consume"; the center owns the chain). The
 *     five-way binding — member / callId / authorityGeneration /
 *     definition / provider — is re-checked AT THE CONSUMPTION POINT
 *     against the plane's trusted per-call facts AND against this arm's own
 *     mount identity; a receipt is not transferable across any of them.
 *  3. The read is ONE call through the CENTER-owned FS-PROC port
 *     (`readBounded`): the M1-verified read binary boundary (ANCHOR-DRIFT +
 *     O_NOFOLLOW + final-FD check + cap+1 ON THE SAME FD). Approved-target
 *     = actual-target is the port's same-handle law — never two path
 *     resolutions by the caller (the revision-1 stat→read window is gone
 *     because there is no stat step: `ControlledFs.stat` answers only
 *     exists/kind/withheld and NO size; a size preflight was fiction).
 *     Pre-approval stays PURE LEXICAL (root ruling): realpath/stat/open
 *     belong only to the post-approval execution edge. This module imports
 *     NO filesystem at all.
 *  4. Cancel BEFORE the commit is real: signal + drain are re-checked after
 *     the port returns and immediately before `commitImage`; a cancellation
 *     landing there answers CANCELLED_BEFORE_COMMIT with zero attachment
 *     writes. Once the commit has been attempted the arm reports the truth
 *     (store-law refusal / unknown boundary with sideEffectPossible kept —
 *     never downgraded) and NEVER deletes (no delete face exists).
 *  5/6. See image-attachment.mjs: entitlements are keyed
 *     (namespace, attachmentId) — never attachmentId alone (content
 *     addressing dedupes STORE OBJECTS; it must never dedupe OWNERSHIP) —
 *     and the receipt separates the source digest from the store's
 *     normalized-object identity.
 *
 * Family facts (familyId/adapterRevision/providerIdentity/targetManifest):
 * consumed at the arm, never self-assembled, never digest-recomputed here.
 * The center carries them (f696e6f2): createPaControlLeg REQUIRES the full
 * carrier once the binding's definition identity is registered in
 * `governedFamilies` (missing / incomplete / mismatched is denied BEFORE
 * the durable row: family-review-facts-missing / -incomplete /
 * family-mismatch / family-target-invalid, the target checked against the
 * family's OWN typed-plan structure PA_FAMILY_TARGET_RULES), and
 * parsePaManifestFamilyBlock keeps all four fields in the projected
 * manifest at FULL VALUE (all-or-nothing: a partial block fails the whole
 * manifest). A BOUND B-IMAGE call therefore MUST present the complete
 * carrier here, and THIS call's full typed plan must equal the approved one
 * FIELD BY FIELD (not just the four carrier values). There is no "pending"
 * release: a row without the carrier fails closed as an incomplete receipt.
 * The projected `manifest.effects` tie (the row's read effect naming THIS
 * call's lexically classified target) runs IN ADDITION, never instead.
 *
 * Effect vocabulary (family contract §1.1, ZERO new kinds):
 *   I = { kind: 'tool-invoke', toolName: 'read_image', resource: null }
 *   F = { kind: 'read', resource: { realmId, kind: 'absolute-path',
 *       canonicalLocator, rights: ['read'] } }
 * The S legs (attachment-store create/write through the injected adapter's
 * real saveImage entry; session attach-vision through the plane result
 * block) are manifest SEMANTIC notation over real native entries, not PA
 * kinds. The attach-vision session-log ride, the render face, the real
 * placement masking, and the production readBounded port itself are Host
 * legs — NOT_VERIFIED here, disclosed in the spec header.
 *
 * Conditional unavailability (§3 C1): the mount assembles this arm ONLY
 * with the port + a live attachment adapter (missing deps throw at
 * assembly — no half-wired arm can exist), and there is no native fallback
 * face to fall back to (the handle exposes none).
 *
 * @module runtime/plugin/live/governed-families/image
 */
import { basename } from 'node:path'
import { lexicalAnchor } from '../plane-effect-backends.mjs'
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'

export const A5_IMAGE_FAMILY_ID = 'B-IMAGE'
export const A5_IMAGE_TOOL_NAME = 'read_image'
/** The single public operation of read_image (read exactly one declared image file). */
export const A5_IMAGE_OPERATION = 'read-exact-file'
/** Revision 2 — revision 1 was measured blocked and never mounted. */
export const A5_IMAGE_ADAPTER_REVISION = 2
/** The durable manifest class the consumption receipt must carry
 *  (control/types.ts PA_CONTROL_MANIFEST_SCHEMA, pinned as a literal:
 *  a runtime .mjs never imports the host .ts; a drifted class FAILS the
 *  shape check, it never passes on trust). */
export const A5_IMAGE_MANIFEST_SCHEMA = 'a5m1.pa-control-manifest.v2'

/** Typed refusal codes (the STRINGS are pinned by the lane fixture
 *  packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts). */
export const A5_IMAGE_TYPED_CODES = Object.freeze({
  UNKNOWN_PARAMETER: 'P_IMAGE_CLASSIFY_UNKNOWN_PARAMETER',
  INVALID_ARGUMENTS: 'P_IMAGE_CLASSIFY_INVALID_ARGUMENTS',
  TARGET_OUTSIDE_GOVERNED_ROOT: 'P_IMAGE_CLASSIFY_TARGET_OUTSIDE_GOVERNED_ROOT',
  UNDECLARED_MEDIA_TYPE: 'P_IMAGE_CLASSIFY_UNDECLARED_MEDIA_TYPE',
  RECEIPT_INCOMPLETE: 'P_IMAGE_RECEIPT_INCOMPLETE',
  CONSUMPTION_BINDING_MISMATCH: 'P_IMAGE_CONSUMPTION_BINDING_MISMATCH',
  TARGET_TIE_MISMATCH: 'P_IMAGE_TARGET_TIE_MISMATCH',
  FAMILY_FACTS_MISMATCH: 'P_IMAGE_FAMILY_FACTS_MISMATCH',
  CANCELLED: 'P_IMAGE_CANCELLED',
  CANCELLED_BEFORE_COMMIT: 'P_IMAGE_CANCELLED_BEFORE_COMMIT',
  DRAINING: 'P_IMAGE_DRAINING',
  TARGET_NOT_A_FILE: 'P_IMAGE_TARGET_NOT_A_FILE',
  READ_TOO_LARGE: 'P_IMAGE_READ_TOO_LARGE',
  PORT_REFUSAL: 'P_IMAGE_PORT_REFUSAL',
  PORT_CONTRACT_BREACH: 'P_IMAGE_PORT_CONTRACT_BREACH',
  PORT_UNAVAILABLE: 'P_IMAGE_PORT_UNAVAILABLE',
  STORE_LAW_REFUSED: 'P_IMAGE_STORE_LAW_REFUSED',
  STORE_UNAVAILABLE: 'P_IMAGE_STORE_UNAVAILABLE',
  EFFECTS_INVALID: 'P_IMAGE_INTERNAL_EFFECTS_INVALID',
  CONSUMPTION_CONTEXT_UNKNOWN: 'P_IMAGE_CONSUMPTION_CONTEXT_UNKNOWN',
})

const CODES = A5_IMAGE_TYPED_CODES

/** Value equality for lossless-JSON facts (the family plan comparison).
 *  Deliberately NOT a digest: the root-split digests (parametersFingerprint
 *  vs operationFingerprint) are the center's; the arm compares BY VALUE,
 *  field by field, and never re-computes a hash. */
function deepValueEqual(a, b) {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, i) => deepValueEqual(item, b[i]))
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  const ka = Object.keys(a); const kb = Object.keys(b)
  if (ka.length !== kb.length || ka.some((k) => !kb.includes(k))) return false
  return ka.every((k) => deepValueEqual(a[k], b[k]))
}

/** The declared-extension mediaType table (wire declaration only — the
 *  bytes are judged ONLY by the real store; declaring a table is not a
 *  decode law). */
const DECLARED_MEDIA_TYPES = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
})

/** AttachmentError codes the REAL store answers BEFORE any durable object
 *  exists (measured at pin639: probe / limits / declared-type arms all
 *  refuse pre-write). These are deterministic zero-write refusals — NOT
 *  unknown boundaries. Anything else the commit throws keeps
 *  sideEffectPossible (never downgraded). */
const STORE_PRE_COMMIT_LAW_CODES = Object.freeze(new Set([
  'INVALID_IMAGE',
  'IMAGE_TYPE_MISMATCH',
  'IMAGE_DIMENSION_TOO_LARGE',
  'IMAGE_TOO_MANY_PIXELS',
]))

const refuse = (code, detail, extra) => ({ ok: false, code, detail, ...(extra ?? {}) })

/** The extension of a canonical path, lowercased ('' when none). */
function extensionOf(path) {
  const base = basename(path)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot).toLowerCase()
}

/**
 * The one governed read_image arm over ONE realm namespace.
 *
 * @param deps - bind-time inputs, validated HARD (a config defect throws at
 *   assembly — the jobsEnabled law family; no half-wired arm can exist).
 * @param {string} deps.definitionIdentity - bind-time identity of the owned
 *   definition (the consumption tie checks the durable row against it).
 * @param {string} deps.providerId - the trusted assembly placing this arm.
 * @param {string} deps.realmId - the realm the F effect is answered in.
 * @param {string} deps.namespaceRoot - the governed namespace root for the
 *   PURE-LEXICAL stage (the containment decision is this arm's own act).
 * @param {Function} deps.readBounded - the CENTER-owned FS-PROC port
 *   (root ruling): built on the M1-verified read binary boundary — same FD
 *   re-anchor + O_NOFOLLOW + final-FD check + cap+1 stop; cancellation is
 *   honored inside the port; refusals carry the port's OWN codes, passed
 *   through verbatim. The arm owns no filesystem face and fabricates none.
 * @param {object} deps.attachments - the SERVICE adapter handle
 *   (image-attachment.mjs): {commitImage, referenceImage, imageLimits}.
 * @param {(row: object) => void} [deps.observe] - the §1.2 minimal backend log.
 */
export function createGovernedReadImageArm({
  definitionIdentity,
  providerId,
  realmId,
  namespaceRoot,
  readBounded,
  attachments,
  observe = () => {},
}) {
  if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) {
    throw new TypeError('governed-families/image: definitionIdentity must be a non-empty string (the consumption tie binds through it; an unbound arm is a config defect)')
  }
  if (typeof providerId !== 'string' || providerId.length === 0 || typeof realmId !== 'string' || realmId.length === 0) {
    throw new TypeError('governed-families/image: providerId and realmId are required (the placing assembly and the answered realm identify themselves)')
  }
  if (typeof namespaceRoot !== 'string' || namespaceRoot.length === 0) {
    throw new TypeError('governed-families/image: namespaceRoot must be a non-empty string (the arm exists to STOP delegating the containment decision; an arm without a root delegates again)')
  }
  if (typeof readBounded !== 'function') {
    throw new TypeError('governed-families/image: readBounded is required — the CENTER-owned FS-PROC port (M1-verified read boundary: same FD, cap+1, O_NOFOLLOW, ANCHOR-DRIFT). No port, no arm; the arm fabricates no read face of its own.')
  }
  if (attachments === null || typeof attachments?.commitImage !== 'function' || attachments.imageLimits === undefined) {
    throw new TypeError('governed-families/image: attachments adapter {commitImage, imageLimits} is required (缺 store 只算条件不可用: the mount does not assemble this arm without a store, and this arm owns no fallback face)')
  }
  const limits = attachments.imageLimits
  const byteCap = Math.min(limits.maxImageBytes, limits.maxMessageImageBytes)
  const deployedMediaTypes = new Set(Array.isArray(limits.mediaTypes) ? limits.mediaTypes : Object.values(DECLARED_MEDIA_TYPES))

  let draining = false
  const counters = { classifyRefused: 0, consumptionRefused: 0, consumed: 0, portCalls: 0, commits: 0, lawRefused: 0, boundaryUnknown: 0 }

  const refuseClassify = (code, detail, extra) => {
    counters.classifyRefused += 1
    observe({ event: 'classify-refuse', code, detail })
    return refuse(code, detail, extra)
  }
  const refuseExecution = (code, detail, extra) => {
    counters.consumptionRefused += 1
    observe({ event: 'execution-refuse', code, detail })
    return refuse(code, detail, extra)
  }

  /** The arm's OWN target manifest (pure lexical facts). It is consumed
   *  back at the consumption point by VALUE equality — no digest math
   *  here (the root-split digests, parametersFingerprint vs
   *  operationFingerprint, are the center's; the arm never re-computes). */
  function targetManifestFor(canonicalTarget, declaredMediaType) {
    return Object.freeze({
      familyId: A5_IMAGE_FAMILY_ID,
      adapterRevision: A5_IMAGE_ADAPTER_REVISION,
      operation: A5_IMAGE_OPERATION,
      realmId,
      canonicalTarget,
      declaredMediaType,
      // The declared cap the CENTER port enforces AT READ TIME (the port
      // answers the byteLength ≤ cap+1 fact; no size fact exists before).
      byteCap,
      byteCapSource: 'attachment-store-limits:min(maxImageBytes,maxMessageImageBytes)',
      // §1.1 S legs: semantic notation WITH the real native entry points —
      // not new PA kinds, not a second permission layer.
      businessObligations: Object.freeze([
        Object.freeze({ service: 'attachment-store', action: 'create', right: 'write', entry: 'SERVICE adapter commitImage -> the real store saveImage (post-consumption only; the store owns every image law)' }),
        Object.freeze({ service: 'session', action: 'attach-vision', right: 'write', entry: 'dispatch-result content blocks ride the session log (Host dispatch leg — disclosed, asserted nowhere here)' }),
      ]),
    })
  }

  /**
   * PURE-LEXICAL classify (root ruling 07:38: 审批前一律纯 lexical — zero
   * realpath/stat/open; no pending FS side effects). The lexical containment
   * runs on strings: an escaping target refuses HERE, before the chain even
   * sees an effect set.
   */
  function classify(args) {
    if (draining) return refuseClassify(CODES.DRAINING, 'the arm is DRAINING: no call reaches any backend (and no native fallback exists to fall back to)')
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      return refuseClassify(CODES.INVALID_ARGUMENTS, 'arguments must be an object')
    }
    const unknownTop = Object.keys(args).filter((k) => k !== 'file_path')
    if (unknownTop.length > 0) {
      return refuseClassify(CODES.UNKNOWN_PARAMETER, `undeclared top-level parameter(s): ${unknownTop.join(', ')} — the governed root is closed (the host schema layer declares no top-level additionalProperties:false, measured at pin639; this arm does)`)
    }
    if (typeof args.file_path !== 'string' || args.file_path.trim().length === 0) {
      return refuseClassify(CODES.INVALID_ARGUMENTS, '"file_path" must be a non-empty string')
    }
    // THE PRIMARY GAP (matrix row 7), closed at the PURE stage: a lexically
    // escaping target refuses with ZERO fs calls — never delegated to the
    // mounted backend (the native face delegates to ctx.fs.readBytes).
    const lex = lexicalAnchor(namespaceRoot, args.file_path)
    if (!lex.ok) {
      return refuseClassify(CODES.TARGET_OUTSIDE_GOVERNED_ROOT, `${lex.detail} — refused by this arm BEFORE any filesystem call (审批前一律纯 lexical; no realpath/stat/open happened or will happen in this stage)`)
    }
    const ext = extensionOf(lex.path)
    if (ext === '') {
      return refuseClassify(CODES.UNDECLARED_MEDIA_TYPE, 'the governed path declares its mediaType from the extension; the extension-less sniff-to-guess path stays the host native face (this arm adds no parallel decode law)')
    }
    const declaredMediaType = DECLARED_MEDIA_TYPES[ext]
    if (declaredMediaType === undefined || !deployedMediaTypes.has(declaredMediaType)) {
      return refuseClassify(CODES.UNDECLARED_MEDIA_TYPE, `"${ext}" declares no supported image mediaType${declaredMediaType === undefined ? '' : ` (deployed store does not accept ${declaredMediaType})`}`)
    }
    const effects = Object.freeze([
      Object.freeze({ kind: 'tool-invoke', toolName: A5_IMAGE_TOOL_NAME, resource: null }),
      Object.freeze({ kind: 'read', resource: Object.freeze({ realmId, kind: 'absolute-path', canonicalLocator: lex.path, rights: Object.freeze(['read']) }) }),
    ])
    // Fail closed against the ARM'S OWN output: the effects must pass the
    // very closed-world parser the Guard uses.
    const parsed = parseRequestedEffectSet(effects)
    if (!parsed.ok) {
      return refuseClassify(CODES.EFFECTS_INVALID, `the arm built effects its own closed schema rejects: ${parsed.problems.map((p) => `${p.path}:${p.code}`).join('; ')}`)
    }
    const targetManifest = targetManifestFor(lex.path, declaredMediaType)
    observe({ event: 'classify', canonicalTarget: lex.path, declaredMediaType })
    return { ok: true, effects, targetManifest }
  }

  /** The durable row's effect tie: the row's read effect MUST name THIS
   *  call's lexical target. This works on TODAY's projected manifest
   *  (effects are projected) — it is the tie that does not wait for the
   *  family-field closure, and it closes "approved target ≠ executed
   *  target" at the arm boundary (inside the same call: swap args after
   *  approval and this refuses). */
  function effectsTieProblem(manifest, targetManifest) {
    const items = manifest?.effects?.effects
    if (!Array.isArray(items)) return 'manifest.effects missing'
    const readEffect = items.find((e) => e?.kind === 'read')
    if (readEffect === undefined) return 'no read effect on the row'
    const ref = readEffect.resource
    if (ref?.kind !== 'absolute-path' || ref?.canonicalLocator !== targetManifest.canonicalTarget) {
      return `row read-effect locator ${JSON.stringify(ref?.canonicalLocator ?? null)} != this call's target ${JSON.stringify(targetManifest.canonicalTarget)}`
    }
    if (ref.realmId !== realmId) return `row read-effect realm ${JSON.stringify(ref.realmId ?? null)} != arm realm`
    if (!Array.isArray(ref.rights) || ref.rights.length !== 1 || ref.rights[0] !== 'read') return 'row read-effect rights must be exactly [read]'
    const invoke = items.find((e) => e?.kind === 'tool-invoke')
    if (invoke?.toolName !== A5_IMAGE_TOOL_NAME) return `row tool-invoke names ${JSON.stringify(invoke?.toolName ?? null)}`
    return null
  }

  /**
   * The consumption-point five-way binding, pair by pair: durable manifest
   * vs the plane's trusted this-call facts vs THIS ARM'S OWN mount. The
   * plane supplies `callFacts` from the same trusted source that built the
   * leg input — the arm never accepts a self-reported identity it cannot
   * tie to both sides.
   * @param manifest - the durable-row manifest (leg `approve` carriage).
   * @param callFacts - { member: { teamSessionId, instanceId }, callId,
   *   authorityGeneration, definitionIdentity, providerIdentity }.
   */
  function bindingMismatch(manifest, callFacts) {
    const durableMember = `${String(manifest?.member?.teamSessionId ?? '')} ${String(manifest?.member?.instanceId ?? '')}`
    const liveMember = `${String(callFacts?.member?.teamSessionId ?? '')} ${String(callFacts?.member?.instanceId ?? '')}`
    if (durableMember !== liveMember || typeof callFacts?.member?.instanceId !== 'string' || callFacts.member.instanceId.length === 0) return `member (${durableMember} vs ${liveMember})`
    if (manifest?.callId !== callFacts?.callId) return `callId (${String(manifest?.callId)} vs ${String(callFacts?.callId)})`
    if (manifest?.authorityGeneration !== callFacts?.authorityGeneration) return `authorityGeneration (${String(manifest?.authorityGeneration)} vs ${String(callFacts?.authorityGeneration)})`
    if (manifest?.binding?.definitionIdentity !== callFacts?.definitionIdentity || callFacts?.definitionIdentity !== definitionIdentity) {
      return `definition (row ${String(manifest?.binding?.definitionIdentity)} vs call ${String(callFacts?.definitionIdentity)} vs arm ${definitionIdentity})`
    }
    if (manifest?.binding?.providerId !== callFacts?.providerIdentity || callFacts?.providerIdentity !== providerId) {
      return `provider (row ${String(manifest?.binding?.providerId)} vs call ${String(callFacts?.providerIdentity)} vs arm ${providerId})`
    }
    if (manifest?.binding?.toolName !== A5_IMAGE_TOOL_NAME) return `bound toolName (${String(manifest?.binding?.toolName)})`
    if (manifest?.realmId !== realmId) return `realm (${String(manifest?.realmId)} vs ${realmId})`
    return null
  }

  /**
   * The consumption point. `receipt` is the strict-manifest chain's OWN
   * approve result — decision/requestId/grant/manifest exactly as the
   * durable leg answered (PaControlLegResult). NO ticket, NO ledger: the
   * durable guard consumption is the single flight OUTSIDE this arm (a
   * replayed correlation never yields a second approve; a replayed receipt
   * object hits the center port's one-shot consumed view and the refusal
   * comes back verbatim). `callFacts` = trusted this-call identity facts;
   * `signal` = the parameter-level cancellation signal of THIS invocation.
   */
  async function execute(args, receipt, callFacts, signal) {
    if (draining) return refuseExecution(CODES.DRAINING, 'DRAINING: no backend is reachable (no native fallback exists by construction)')
    const plan = classify(args)
    if (plan.ok !== true) return { ...plan, classifyRefused: true }
    // THE CONSUMPTION EXECUTION CONTEXT (root ruling on f3864b24, item 1):
    // two LEGAL worlds, told apart by the plane's trusted callFacts — never
    // guessed by the arm:
    //  (a) 'all-allow': policy admitted every effect, so NO Control row and
    //      NO requestId ever existed — there is no approval to present, and
    //      demanding one (or accepting a fabricated one) is a defect;
    //  (b) 'ask': the durable strict-chain approve receipt is the ONLY
    //      execution authority (approve + durable requestId + strict
    //      manifest + minted grant), exactly as the leg answered it.
    // The unified PA final edge is CENTER's; this arm never builds an edge
    // of its own and never accepts a pseudo requestId / placeholder id /
    // self-assembled approval in EITHER world.
    const approval = callFacts?.approval
    if (approval !== 'all-allow' && approval !== 'ask') {
      return refuseExecution(CODES.CONSUMPTION_CONTEXT_UNKNOWN, `callFacts.approval must be the consumption execution context ('ask' or 'all-allow'), got ${JSON.stringify(approval ?? null)} — the arm never guesses which world a call belongs to, and an unclassified call reaches no backend`)
    }
    let manifest = undefined
    if (approval === 'all-allow') {
      if (receipt !== undefined && receipt !== null) {
        return refuseExecution(CODES.RECEIPT_INCOMPLETE, 'the all-allow world has no approval to present (no Control row exists by construction): a receipt presented HERE is a synthesized approval — refused; 伪 requestId/占位 id/自造 approval are refused in both worlds')
      }
      // The all-allow consumption point still re-ties the trusted this-call
      // facts to THIS ARM'S OWN mount (there is no durable row to tie
      // against — that absence IS world (a), per the root ruling).
      const team = String(callFacts?.member?.teamSessionId ?? '')
      const inst = String(callFacts?.member?.instanceId ?? '')
      if (team.length === 0 || inst.length === 0) return refuseExecution(CODES.CONSUMPTION_BINDING_MISMATCH, 'all-allow consumption still requires the COMPLETE trusted member identity (teamSessionId + instanceId)')
      if (typeof callFacts.callId !== 'string' || callFacts.callId.length === 0) return refuseExecution(CODES.CONSUMPTION_BINDING_MISMATCH, 'all-allow consumption still requires the trusted this-call callId')
      if (callFacts.definitionIdentity !== definitionIdentity) return refuseExecution(CODES.CONSUMPTION_BINDING_MISMATCH, `definition (call ${String(callFacts.definitionIdentity)} vs arm ${definitionIdentity})`)
      if (callFacts.providerIdentity !== providerId) return refuseExecution(CODES.CONSUMPTION_BINDING_MISMATCH, `provider (call ${String(callFacts.providerIdentity)} vs arm ${providerId})`)
      if (typeof callFacts.authorityGeneration !== 'number' || !Number.isInteger(callFacts.authorityGeneration)) return refuseExecution(CODES.CONSUMPTION_BINDING_MISMATCH, 'all-allow consumption still carries the trusted authorityGeneration')
    } else {
    if (receipt?.decision !== 'approve' || typeof receipt?.requestId !== 'string' || receipt.requestId.length === 0) {
      return refuseExecution(CODES.RECEIPT_INCOMPLETE, 'the ask world requires the strict-chain approve receipt (decision=approve + durable requestId): a deny/unsettled/no-receipt call never executes and never reaches the port')
    }
    manifest = receipt.manifest
    if (manifest === undefined || manifest === null || manifest.schema !== A5_IMAGE_MANIFEST_SCHEMA) {
      return refuseExecution(CODES.RECEIPT_INCOMPLETE, 'the leg carried NO strict-classified durable manifest (or a drifted class): the row no longer strict-classifies ⇒ fail closed, never a synthesized manifest')
    }
    if (typeof receipt?.grant?.grantId !== 'string' || receipt.grant.grantId.length === 0) {
      return refuseExecution(CODES.RECEIPT_INCOMPLETE, 'the approve receipt carries no minted grantId (the mint/landing edge never completed) — nothing executes on an unbuilt grant')
    }
    const mismatch = bindingMismatch(manifest, callFacts)
    if (mismatch !== null) {
      return refuseExecution(CODES.CONSUMPTION_BINDING_MISMATCH, `the consumption-point five-way binding refused (${mismatch}): the durable row, THIS call, and this arm's mount must be the same invocation — a receipt is not transferable across member/call/token-generation/definition/provider`)
    }
    const tieProblem = effectsTieProblem(manifest, plan.targetManifest)
    if (tieProblem !== null) {
      return refuseExecution(CODES.TARGET_TIE_MISMATCH, `the durable row's effect set does not carry THIS call's approved target (${tieProblem}) — approved target ≠ executed target, nothing runs`)
    }
    // THE FAMILY CARRIER IS REQUIRED FOR A BOUND CALL (root ruling on
    // f3864b24, item 2; the "pending release" is DELETED). The center
    // carries the block: createPaControlLeg refuses a registered family's
    // missing/incomplete/mismatched carrier BEFORE the durable row
    // (family-review-facts-missing / -incomplete / family-mismatch …),
    // parsePaManifestFamilyBlock keeps all four fields at FULL VALUE, and
    // PA_FAMILY_TARGET_RULES['B-IMAGE'] pins this family's typed-plan
    // structure. A row without the complete carrier therefore cannot come
    // from the ask chain — it fails closed HERE as well.
    if (manifest.familyId === undefined || manifest.adapterRevision === undefined
      || manifest.providerIdentity === undefined || manifest.targetManifest === undefined) {
      return refuseExecution(CODES.RECEIPT_INCOMPLETE, 'a bound B-IMAGE call carries NO complete family carrier (familyId/adapterRevision/providerIdentity/targetManifest are required-together; the center parser fails a partial block as the whole manifest): no facts, no grant use — never a pending release')
    }
    if (manifest.familyId !== A5_IMAGE_FAMILY_ID) return refuseExecution(CODES.FAMILY_FACTS_MISMATCH, `the row carries familyId ${JSON.stringify(manifest.familyId)} for a ${A5_IMAGE_FAMILY_ID} arm`)
    if (manifest.adapterRevision !== A5_IMAGE_ADAPTER_REVISION) return refuseExecution(CODES.FAMILY_FACTS_MISMATCH, `the row carries adapterRevision ${String(manifest.adapterRevision)}; this arm is ${String(A5_IMAGE_ADAPTER_REVISION)} — never execute across adapter revisions`)
    if (manifest.providerIdentity !== providerId) return refuseExecution(CODES.FAMILY_FACTS_MISMATCH, `the row carries providerIdentity ${JSON.stringify(manifest.providerIdentity ?? null)}; this mount is ${JSON.stringify(providerId)}`)
    // FULL typed-plan equality, field by field — not just the four carrier
    // values: every member of THIS call's classified plan must equal the
    // approved one BY VALUE (the arm never re-digests, never re-derives).
    if (!deepValueEqual(manifest.targetManifest, plan.targetManifest)) {
      return refuseExecution(CODES.FAMILY_FACTS_MISMATCH, `the row targetManifest does not equal THIS call's typed plan field by field (operation/realmId/canonicalTarget/declaredMediaType/byteCap/byteCapSource/businessObligations/familyId/adapterRevision) — row: ${JSON.stringify(manifest.targetManifest)} vs plan: ${JSON.stringify(plan.targetManifest)} — a stale or swapped target never executes`)
    }
    }
    if (signal?.aborted === true) {
      return refuseExecution(CODES.CANCELLED, 'cancelled before the execution edge began: zero port calls, zero attachment writes')
    }
    counters.consumed += 1
    observe({ event: 'consume', world: approval, ...(receipt?.requestId === undefined ? {} : { requestId: receipt.requestId }), ...(manifest === undefined ? { callId: callFacts.callId } : { callId: manifest.callId }) })
    // THE FS-PROC READ: one call, same FD inside the port (re-anchor AND
    // the cap+1 stop happen there — no stat step exists here at all).
    let read
    try {
      counters.portCalls += 1
      // The port's reference input: the minted grant when one exists (ask
      // world); in the all-allow world there is NO grant (nothing was ever
      // minted) — the reference carries the trusted callId instead. An
      // empty grant object is stated openly; a fabricated grantId never is.
      read = await readBounded(
        {
          grant: receipt?.grant ?? Object.freeze({}),
          realmId,
          canonicalLocator: plan.targetManifest.canonicalTarget,
          ...(manifest === undefined ? { callId: callFacts.callId } : {}),
        },
        { maxBytes: plan.targetManifest.byteCap, ...(signal === undefined ? {} : { signal }) },
      )
    } catch (error) {
      if (error?.name === 'AbortError') {
        return refuseExecution(CODES.CANCELLED, 'the port answered cancellation inside the read: the commit never started, zero attachment writes')
      }
      return refuseExecution(CODES.PORT_UNAVAILABLE, `the FS-PROC port threw (${String(error?.message ?? error)}): the read never returned; the attachment commit was never reached — the write boundary was NEVER crossed (sideEffectPossible=false states the read edge, not the write edge)`, { sideEffectPossible: false })
    }
    if (read?.ok !== true) {
      // The port's own words come back VERBATIM (no second protocol).
      return refuseExecution(CODES.PORT_REFUSAL, `the FS-PROC port refused verbatim (${String(read?.code ?? 'unknown')}): ${String(read?.detail ?? '')} — zero attachment writes`, { portCode: read?.code })
    }
    const observed = read.value ?? {}
    if (observed.observedKind !== 'file') {
      return refuseExecution(CODES.TARGET_NOT_A_FILE, `the read answered kind '${String(observed.observedKind)}' — only a regular file commits`)
    }
    const reported = Number(observed.byteLength)
    if (!Number.isSafeInteger(reported) || reported < 0) {
      return refuseExecution(CODES.PORT_CONTRACT_BREACH, `the port answered ok with byteLength=${String(observed.byteLength)} — the cap+1 contract was not honoured; nothing commits on an unverifiable fact`)
    }
    if (reported > plan.targetManifest.byteCap) {
      // The cap+1 FACT, measured at read time (the port stops at cap+1 ON
      // THE SAME FD): capacity lands at read, not on paper.
      return refuseExecution(CODES.READ_TOO_LARGE, `the read answered ${String(reported)} bytes against the ${String(plan.targetManifest.byteCap)}-byte cap (min(store maxImageBytes, maxMessageImageBytes)): refused after the capped read, BEFORE any commit — zero attachment writes`)
    }
    if (!(observed.bytes instanceof Uint8Array) || observed.bytes.byteLength === 0) {
      return refuseExecution(CODES.PORT_CONTRACT_BREACH, 'the port answered ok (in-cap byteLength) without bytes — nothing commits on an empty answer')
    }
    // THE COMMIT-BOUNDARY RE-CHECK (fix card 3): the read returned; a
    // cancel or drain landing HERE still refuses — with zero writes.
    if (signal?.aborted === true) {
      return refuseExecution(CODES.CANCELLED_BEFORE_COMMIT, 'cancelled AFTER the read returned and BEFORE the commit: the bytes were dropped, nothing was saved — zero attachment writes')
    }
    if (draining) {
      return refuseExecution(CODES.DRAINING, 'the mount began draining between the read and the commit: the bytes were dropped, nothing was saved')
    }
    // The durable namespace: in the ask world it is the ROW's member
    // identity; in the all-allow world (no row exists) it is the trusted
    // this-call member identity plus this arm's bound realm — never a
    // caller-invented scope either way.
    const namespace = Object.freeze({
      realmId,
      teamSessionId: manifest?.member?.teamSessionId ?? callFacts.member.teamSessionId,
      instanceId: manifest?.member?.instanceId ?? callFacts.member.instanceId,
    })
    try {
      const committed = await attachments.commitImage({
        bytes: observed.bytes,
        mediaType: plan.targetManifest.declaredMediaType,
        name: basename(plan.targetManifest.canonicalTarget),
        namespace,
        correlation: manifest === undefined ? `all-allow:${callFacts.callId}` : `${receipt.requestId}:${manifest.callId}`,
      })
      counters.commits += 1
      observe({ event: 'commit', ...(receipt?.requestId === undefined ? {} : { requestId: receipt.requestId }), detail: `${committed.attachmentId}:${committed.sourceSha256.slice(0, 12)}:normalizedEqualsSource=${String(committed.normalizedEqualsSource)}` })
      return {
        ok: true,
        value: Object.freeze({
          path: plan.targetManifest.canonicalTarget,
          image: Object.freeze({
            // The store's normalized-object identity (attachmentId) and the
            // SOURCE digest are SEPARATE facts (fix card 5); the flag
            // states whether normalization changed the bytes (pass-through).
            attachmentId: committed.attachmentId,
            sourceSha256: committed.sourceSha256,
            normalizedEqualsSource: committed.normalizedEqualsSource,
            mediaType: committed.mediaType,
            bytes: committed.bytes,
            ...(committed.width === undefined ? {} : { width: committed.width }),
            ...(committed.height === undefined ? {} : { height: committed.height }),
            ...(committed.name === undefined ? {} : { name: committed.name }),
          }),
        }),
      }
    } catch (error) {
      const storeCode = typeof error?.code === 'string' ? error.code : undefined
      if (storeCode !== undefined && STORE_PRE_COMMIT_LAW_CODES.has(storeCode)) {
        counters.lawRefused += 1
        return refuseExecution(CODES.STORE_LAW_REFUSED, `the attachment store refused by law BEFORE any durable object (${storeCode}): ${String(error.message)} — zero objects, zero writes beyond the store's own law (no sideEffectPossible: this is a deterministic pre-write refusal, measured at pin639)`)
      }
      counters.boundaryUnknown += 1
      // The commit was ATTEMPTED and its boundary is unknowable from this
      // side: sideEffectPossible stays — never downgraded (install.ts law).
      // Nothing is deleted, ever: this arm owns no delete face.
      return refuseExecution(CODES.STORE_UNAVAILABLE, `the attachment commit threw (${String(error?.message ?? error)}): the durable boundary is UNRESOLVED — sideEffectPossible stays true (never downgraded); nothing is deleted (no delete face exists)`, { sideEffectPossible: true })
    }
  }

  /** Reference an attachment THIS namespace minted (the reference leg lives
   *  on the adapter; exposed here so the mount has ONE handle). Namespace =
   *  the durable (realm, teamSession, instance) identity — the same shape
   *  the leg carries, never a self-report the caller invents. */
  async function reference(attachmentId, namespace, signal) {
    // Same cancellation discipline as the main path (root ruling on
    // f3864b24, item 3): the reference leg is a backend call too.
    if (draining) return { ok: false, code: CODES.DRAINING, detail: 'DRAINING: the reference leg reaches no backend either' }
    if (signal?.aborted === true) return { ok: false, code: CODES.CANCELLED, detail: 'cancelled before the reference leg began: zero store calls' }
    const out = await attachments.referenceImage({ attachmentId, namespace, ...(signal === undefined ? {} : { signal }) })
    // A cancel/drain landing WHILE the fetch was in flight refuses to SERVE
    // the result (the fetch itself cannot be recalled — stated honestly;
    // nothing is written either way on this leg).
    if (signal?.aborted === true) return { ok: false, code: CODES.CANCELLED, detail: 'cancelled while the reference fetch was in flight: the bytes were fetched but are NOT served' }
    if (draining) return { ok: false, code: CODES.DRAINING, detail: 'the mount began draining during the reference fetch: not served' }
    return out
  }

  /** DRAINING: after this, every stage refuses typed; nothing reaches any
   *  backend; already-committed objects are never rewritten (no delete). */
  function drain() {
    draining = true
  }

  return {
    familyId: A5_IMAGE_FAMILY_ID,
    adapterRevision: A5_IMAGE_ADAPTER_REVISION,
    definitionIdentity,
    providerId,
    byteCap,
    classify,
    execute,
    reference,
    drain,
    stats: () => ({ ...counters }),
  }
}
