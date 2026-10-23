/**
 * governed-families/image.mjs — A5-M2 B-IMAGE `read_image` arm: the governed
 * PRE-TAKEOVER (family contract
 * `docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md`
 * §3 B-IMAGE: targets `I + F(read exact file) + S(attachment-store,create,write)
 * + S(session,attach-vision,write)`, bound bytes/pixels caps and the target
 * session/attachment namespace; "not a simple read alias of the write family").
 * Route per contract: FS-PROC controlled read + SERVICE attachment adapter
 * that creates/references attachments AFTER approval, capacity checked AT READ
 * TIME. This arm assembles NO new I/O face and re-implements NO host law: the
 * image format/size/pixel laws stay the real attachment store's (its
 * `saveImage`/`readImage` port is DI'd through the SERVICE adapter), and the
 * containment law is the shared `resolveAnchoredPath`/`lexicalAnchor` resolver
 * of plane-effect-backends.mjs — the same anchored law the governed read row
 * uses.
 *
 * THE PRIMARY GAP THIS ARM CLOSES (matrix B-IMAGE row 7, measured at pin639):
 * the host native face reads through `ctx.fs.readBytes` (read-image.ts:263)
 * and the host fs-sandbox fences WRITES only — out-of-bounds refusal was
 * entirely delegated to whatever fs backend is mounted, and LocalFileSystem
 * carries no root. CORE PATCH BUDGET = 0, so the closure lives HERE, on the
 * governed path: a cross-root/escaping target is a TYPED refusal raised by
 * THIS arm — the lexical escape refuses at classify with ZERO fs calls, the
 * symlink-alias refuses at execute BEFORE any content read (the containment
 * metadata resolution is this governor's own act, never a delegated backend
 * decision), and the arm holds no native body to fall back to (there is
 * nothing to fall back TO — §1.2 BASE.C3 "binding DRAINING 后不得 native
 * fallback" holds by construction).
 *
 * STAGES (§1 FamilyAdapter, image arm):
 *   classify(args, trustedCtx)  — PURE parse, zero fs calls: closed argument
 *     root (exactly `file_path`; unknown top-level keys are a typed refusal —
 *     the host schema layer declares no top-level additionalProperties:false,
 *     measured at pin639: missing required IS enforced, extra keys pass and do
 *     nothing; the governed root closes what the host left implicit, same
 *     ruling as the todo arm). Declared-mediaType table from the extension:
 *     a foreign extension or NO extension refuses typed HERE (the governed
 *     path declares its mediaType — the host's sniff-to-guess path stays the
 *     host's; the P layer adds no parallel decode law). The lexical containment
 *     (shared lexicalAnchor) runs at this pure stage: escaping targets refuse
 *     before admission even sees them. Effects emitted with the frozen §1.1
 *     vocabulary ONLY, no new kind: `I` = the tool-invoke effect (the
 *     `@<definitionIdentity>` half rides the bind-time identity the Guard
 *     re-compares per call), `F` = the present `read` effect over the
 *     `absolute-path` resource arm with right `read`; the two `S(...)` legs are
 *     the §1.1 semantic notation carried in the targetManifest WITH their real
 *     native entry points named (attachment-store commit = the SERVICE port's
 *     `saveImage`, reachable only after ticket consumption; session
 *     attach-vision = the dispatch-result content blocks riding the session
 *     log — the Host leg, disclosed, asserted nowhere here). The whole effect
 *     array re-parses through the domain `parseRequestedEffectSet` per call —
 *     an arm that cannot answer its OWN closed schema fails closed.
 *   prepare(plan)               — admitted-phase only; issues the ONE-SHOT
 *     ticket. Zero business effect: the read and the store commit both live
 *     behind the ticket, so Ask-pending provably reads 0 files and writes 0
 *     attachments.
 *   execute(ticket, exec)       — identity/incarnation recheck → abort
 *     preflight → RE-ANCHOR through the shared resolver (the accepted C2 law:
 *     symlink-alias/containment is re-resolved at effect time, never trusted
 *     from the classify string) → size cap from `stat` BEFORE any content read
 *     → `readPort.readFile` with `maxBytes` at read time (the contract's
 *     "capacity check at read time": a too-large file refuses before the bytes
 *     exist anywhere, the store never sees it) → the SERVICE adapter commits
 *     the attachment (`saveImage`, whose own format/pixel laws then bind — the
 *     host's, verbatim) → the typed value `{path, image}` mirrors the host
 *     output schema (single fact source = the store receipt; no second fact
 *     face). A store reject passes through as a typed refusal with the store's
 *     own text; a commit boundary that cannot be known keeps
 *     `sideEffectPossible: true` — never downgraded (the dispatcher-call law).
 *   cancel(planOrTicket)        — the honest race report: before/after
 *     admission ⇒ zero file reads + zero attachment writes (no ticket consumed);
 *     after consumption ⇒ ALREADY-COMMITTED naming the attachmentId: the object
 *     is durable content-addressed and cancellation NEVER deletes existing
 *     attachments (§3 B-IMAGE C3: 取消清理仅本调用未提交附件 — by construction
 *     this arm owns no delete face at all).
 *
 * Conditional unavailability (§3 C1 "缺 store 只算条件不可用，不豁免"): the
 * mount glue assembles this arm ONLY with a live attachment port + read port
 * (a missing port is a config defect that throws at assembly — the jobsEnabled
 * law family — so no half-wired arm can exist), and a store that dies
 * mid-life answers every call with the typed P_IMAGE_STORE_UNAVAILABLE — a
 * refusal state, never an exemption, never a native fallback.
 *
 * What this file is NOT: the registration/placement/mask side (CENTER's
 * `agent-bindings.mjs` / takeover ledger glue), the attachment laws (the real
 * store's), the decode/normalize laws (the real store's), the session render
 * face (the Host leg), or a second permission layer (§1.1: the effects it
 * emits are the tool's own tool-invoke + the real FS read effect; the S legs
 * are manifest notation, not new PA kinds).
 *
 * @module runtime/plugin/live/governed-families/image
 */
import { basename } from 'node:path'
import { createHash } from 'node:crypto'
import { lexicalAnchor, resolveAnchoredPath } from '../plane-effect-backends.mjs'
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'

/** Family/arm identity (§1 reviewPayload P-additions: familyId + adapterRevision). */
export const A5_IMAGE_FAMILY_ID = 'B-IMAGE'
export const A5_IMAGE_TOOL_NAME = 'read_image'
/** The single public operation of read_image (read exactly one declared image file). */
export const A5_IMAGE_OPERATION = 'read-exact-file'
export const A5_IMAGE_ADAPTER_REVISION = 1

/**
 * The declared-extension mediaType table (public wire facts, the same four
 * spellings the host tool declares; declaring a table is not a decode law —
 * the bytes themselves are judged ONLY by the real store).
 */
const DECLARED_MEDIA_TYPES = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
})

/**
 * Typed refusal codes for the governed path (naming belongs to the governance
 * error family; the STRINGS are pinned by the lane fixture
 * `packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts`).
 */
export const A5_IMAGE_TYPED_CODES = Object.freeze({
  UNKNOWN_PARAMETER: 'P_IMAGE_CLASSIFY_UNKNOWN_PARAMETER',
  INVALID_ARGUMENTS: 'P_IMAGE_CLASSIFY_INVALID_ARGUMENTS',
  NO_OWNING_SESSION: 'P_IMAGE_CLASSIFY_NO_OWNING_SESSION',
  FOREIGN_SESSION: 'P_IMAGE_CLASSIFY_FOREIGN_SESSION',
  TARGET_OUTSIDE_GOVERNED_ROOT: 'P_IMAGE_CLASSIFY_TARGET_OUTSIDE_GOVERNED_ROOT',
  UNDECLARED_MEDIA_TYPE: 'P_IMAGE_CLASSIFY_UNDECLARED_MEDIA_TYPE',
  NOT_ADMITTED: 'P_IMAGE_NOT_ADMITTED',
  ALREADY_CONSUMED: 'P_IMAGE_ALREADY_CONSUMED',
  CANCELLED: 'P_IMAGE_CANCELLED',
  DRAINING: 'P_IMAGE_DRAINING',
  STORE_UNAVAILABLE: 'P_IMAGE_STORE_UNAVAILABLE',
  TARGET_OUTSIDE_ROOT: 'P_IMAGE_TARGET_OUTSIDE_ROOT',
  TARGET_UNRESOLVABLE: 'P_IMAGE_TARGET_UNRESOLVABLE',
  TARGET_NOT_A_FILE: 'P_IMAGE_TARGET_NOT_A_FILE',
  READ_TOO_LARGE: 'P_IMAGE_READ_TOO_LARGE',
  EFFECTS_INVALID: 'P_IMAGE_INTERNAL_EFFECTS_INVALID',
})

const CODES = A5_IMAGE_TYPED_CODES

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
 * @param deps - bind-time inputs, validated hard (a config defect refuses at
 *   assembly, never silently defaults — the jobsEnabled law family).
 * @param {string} deps.definitionIdentity - bind-time identity of the owned
 *   definition the placement masks at the native spelling (the `@` half of I).
 * @param {string} deps.providerId - the trusted assembly placing this arm.
 * @param {string} deps.realmId - the realm the F effect is answered in.
 * @param {string} deps.namespaceRoot - the governed root the target must stay
 *   beneath (the canonicalized namespace the read is bound to).
 * @param {(rawPath: string) => {ok:true,path:string}|{ok:false,code:string,detail:string}} [deps.resolveNamespaceRoot]
 *   - OPTIONAL resolver mapping the request to a namespace root (single-root
 *     assemblies omit it; multi-root assemblies MUST supply it or a
 *     cross-namespace target is refused against the single root).
 * @param {object} deps.readPort - the FS-PROC controlled read port:
 *   `stat(path, {signal}) -> {size, isFile}` and
 *   `readFile(path, {maxBytes, signal}) -> bytes`; the arm holds NO other
 *   content-read face (this is the gap closure: content never rides an
 *   un-anchored host ctx.fs path on the governed route).
 * @param {object} deps.attachments - the SERVICE adapter handle
 *   (governed-families/image-attachment.mjs): `commitImage`, `imageLimits`.
 * @param {readonly string[]} deps.trustedIdentities - identities counting as
 *   THIS agent (the Guard scope family).
 * @param {(row: object) => void} [deps.observe] - the §1.2 minimal backend log.
 */
export function createGovernedReadImageArm({
  definitionIdentity,
  providerId,
  realmId,
  namespaceRoot,
  resolveNamespaceRoot,
  readPort,
  attachments,
  trustedIdentities,
  observe = () => {},
}) {
  if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) {
    throw new TypeError('governed-families/image: definitionIdentity must be a non-empty string (the I arm binds through it; an unbound arm is a config defect)')
  }
  if (typeof providerId !== 'string' || providerId.length === 0 || typeof realmId !== 'string' || realmId.length === 0) {
    throw new TypeError('governed-families/image: providerId and realmId are required (the placing assembly and the answered realm identify themselves)')
  }
  if (typeof namespaceRoot !== 'string' || namespaceRoot.length === 0) {
    throw new TypeError('governed-families/image: namespaceRoot must be a non-empty string (the arm exists to STOP delegating the containment decision; an arm without a root delegates again)')
  }
  if (!Array.isArray(trustedIdentities) || trustedIdentities.length === 0) {
    throw new TypeError('governed-families/image: non-empty trustedIdentities are required')
  }
  if (readPort === null || typeof readPort?.stat !== 'function' || typeof readPort?.readFile !== 'function') {
    throw new TypeError('governed-families/image: readPort {stat, readFile} is required (conditional availability: no controlled read face, no arm — never a silent fall back to an un-anchored backend)')
  }
  if (attachments === null || typeof attachments?.commitImage !== 'function' || attachments.imageLimits === undefined) {
    throw new TypeError('governed-families/image: attachments adapter {commitImage, imageLimits} is required (缺 store 只算条件不可用: the mount does not assemble this arm without a store, and this arm owns no fallback face)')
  }
  const trusted = new Set(trustedIdentities)
  const limits = attachments.imageLimits
  const byteCap = Math.min(limits.maxImageBytes, limits.maxMessageImageBytes)
  const deployedMediaTypes = new Set(Array.isArray(limits.mediaTypes) ? limits.mediaTypes : Object.values(DECLARED_MEDIA_TYPES))

  /** plan/ticket state lives HERE and only here: CLASSIFIED → PREPARED → CONSUMED | CANCELLED. */
  const plans = new WeakMap()
  const tickets = new WeakMap()
  let correlationSeq = 0
  let draining = false

  const nextCorrelation = (paramFingerprint) => {
    correlationSeq += 1
    return `image.r${A5_IMAGE_ADAPTER_REVISION}.${correlationSeq}.${paramFingerprint.slice(0, 12)}`
  }

  /** PURE parse. ZERO fs calls: the lexical containment runs on strings. */
  function classify(args, ctx) {
    if (draining) return refuse(CODES.DRAINING, 'the arm is DRAINING: no call reaches any backend (and no native fallback exists to fall back to)')
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      return refuse(CODES.INVALID_ARGUMENTS, 'arguments must be an object')
    }
    const unknownTop = Object.keys(args).filter((k) => k !== 'file_path')
    if (unknownTop.length > 0) {
      return refuse(CODES.UNKNOWN_PARAMETER, `undeclared top-level parameter(s): ${unknownTop.join(', ')} — the governed root is closed (the host schema layer declares no top-level additionalProperties:false; this arm does)`)
    }
    if (typeof args.file_path !== 'string' || args.file_path.trim().length === 0) {
      return refuse(CODES.INVALID_ARGUMENTS, '"file_path" must be a non-empty string')
    }
    const agentIdentity = typeof ctx?.agentIdentity === 'string' && ctx.agentIdentity.length > 0 ? ctx.agentIdentity : null
    if (agentIdentity === null) return refuse(CODES.NO_OWNING_SESSION, 'no agent identity: the attachment namespace is per-agent-session state and this caller owns no session')
    if (!trusted.has(agentIdentity)) return refuse(CODES.FOREIGN_SESSION, `caller identity is not this scope (${JSON.stringify(agentIdentity)})`)
    const incarnation = typeof ctx.sessionIncarnation === 'string' && ctx.sessionIncarnation.length > 0 ? ctx.sessionIncarnation : null
    if (incarnation === null || incarnation !== agentIdentity) {
      return refuse(CODES.FOREIGN_SESSION, 'the current session incarnation does not match the calling agent (CURRENT vs target confusion is a refusal, not a fallback)')
    }
    // THE PRIMARY GAP, closed at the PURE stage: a lexically escaping target
    // refuses with ZERO fs calls — never a delegation to the mounted backend.
    const root = resolveNamespaceRoot === undefined
      ? namespaceRoot
      : (() => {
        const decided = resolveNamespaceRoot(args.file_path)
        if (decided === null || typeof decided !== 'string' || decided.length === 0) {
          return null
        }
        return decided
      })()
    if (root === null) {
      return refuse(CODES.TARGET_OUTSIDE_GOVERNED_ROOT, 'the target resolves to no governed namespace this arm serves (a cross-namespace target is refused, never routed to)')
    }
    const lex = lexicalAnchor(root, args.file_path)
    if (!lex.ok) {
      return refuse(CODES.TARGET_OUTSIDE_GOVERNED_ROOT, `${lex.detail} — refused by this arm BEFORE any filesystem call (the host native face delegates this decision to the mounted backend; this arm does not)`)
    }
    const ext = extensionOf(lex.path)
    if (ext === '') {
      return refuse(CODES.UNDECLARED_MEDIA_TYPE, 'the governed path declares its mediaType from the extension; the extension-less sniff-to-guess path stays the host native face (this arm adds no parallel decode law)')
    }
    const declaredMediaType = DECLARED_MEDIA_TYPES[ext]
    if (declaredMediaType === undefined || !deployedMediaTypes.has(declaredMediaType)) {
      return refuse(CODES.UNDECLARED_MEDIA_TYPE, `"${ext}" declares no supported image mediaType${declaredMediaType === undefined ? '' : ` (deployed store does not accept ${declaredMediaType})`}`)
    }
    const paramFingerprint = createHash('sha256').update(JSON.stringify({ file_path: args.file_path, root })).digest('hex')
    const effects = Object.freeze([
      Object.freeze({ kind: 'tool-invoke', toolName: A5_IMAGE_TOOL_NAME, resource: null }),
      Object.freeze({ kind: 'read', resource: Object.freeze({ realmId, kind: 'absolute-path', canonicalLocator: lex.path, rights: Object.freeze(['read']) }) }),
    ])
    // Fail closed against the ARM'S OWN output: the effects must pass the very
    // closed-world parser the Guard uses. An arm that cannot answer its own
    // schema is a bug and refuses — never a partial effect set admitted.
    const parsed = parseRequestedEffectSet(effects)
    if (!parsed.ok) {
      return refuse(CODES.EFFECTS_INVALID, `the arm built effects its own closed schema rejects: ${parsed.problems.map((p) => `${p.path}:${p.code}`).join('; ')}`)
    }
    const plan = Object.freeze({
      familyId: A5_IMAGE_FAMILY_ID,
      adapterRevision: A5_IMAGE_ADAPTER_REVISION,
      toolName: A5_IMAGE_TOOL_NAME,
      definitionIdentity,
      providerIdentity: providerId,
      effects,
      manifest: Object.freeze({
        operation: A5_IMAGE_OPERATION,
        sessionIncarnation: incarnation,
        realmId,
        namespaceRoot: root,
        canonicalTarget: lex.path,
        declaredMediaType,
        // capacity bound carried into the manifest, ENFORCED at read time
        // below (the contract clause: capacity check lands at read, not on paper).
        byteCap,
        limitsDigest: createHash('sha256').update(JSON.stringify(limits)).digest('hex').slice(0, 16),
        paramFingerprint,
        // §1.1 S legs: semantic notation WITH the real native entry points —
        // not new PA kinds, not a second permission layer.
        businessObligations: Object.freeze([
          Object.freeze({ service: 'attachment-store', action: 'create', right: 'write', entry: 'SERVICE adapter commitImage -> the real store saveImage (ticket-consumed only; the store owns every image law)' }),
          Object.freeze({ service: 'session', action: 'attach-vision', right: 'write', entry: 'dispatch-result content blocks ride the session log (Host dispatch leg — disclosed, not asserted by this lane)' }),
        ]),
      }),
    })
    plans.set(plan, { state: 'CLASSIFIED', correlation: nextCorrelation(paramFingerprint) })
    observe({ event: 'classify', correlation: plans.get(plan).correlation, detail: paramFingerprint })
    return { ok: true, plan, effects: plan.effects, manifest: plan.manifest }
  }

  /** Admitted-phase entry. Issues the ONE-SHOT ticket; reads and writes NOTHING. */
  function prepare(plan) {
    if (draining) return refuse(CODES.DRAINING, 'DRAINING: no admission is admitted, no ticket is issued')
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(CODES.NOT_ADMITTED, 'unknown plan: prepare answers only to a plan this arm classified')
    if (entry.state !== 'CLASSIFIED') return refuse(CODES.NOT_ADMITTED, `plan is ${entry.state}, not classifiable-for-admission`)
    entry.state = 'PREPARED'
    const ticket = Object.freeze({ plan })
    tickets.set(ticket, entry)
    observe({ event: 'admit', correlation: entry.correlation, detail: plan.manifest.paramFingerprint })
    return { ok: true, ticket }
  }

  /**
   * Consumed-phase entry: identity recheck → abort preflight → RE-ANCHOR →
   * read-time caps → controlled read → SERVICE commit. Every refusal below is
   * raised BEFORE the next effect lands, and the counters the lane fixture
   * pins (readPort spy + store spy) prove the zero-effect faces.
   */
  async function execute(ticket, exec) {
    if (draining) return refuse(CODES.DRAINING, 'DRAINING: no backend is reachable (no native fallback exists by construction)')
    const entry = tickets.get(ticket)
    if (entry === undefined) return refuse(CODES.NOT_ADMITTED, 'unknown ticket: execute answers only to a prepare-issued ticket (Ask-pending/denied calls never hold one)')
    if (entry.state === 'CANCELLED') return refuse(CODES.CANCELLED, 'the plan was cancelled before consumption: zero reads and zero attachment writes are the truth, not a race')
    if (entry.state !== 'PREPARED') return refuse(entry.state === 'CONSUMED' ? CODES.ALREADY_CONSUMED : CODES.NOT_ADMITTED, `ticket is ${entry.state}`)
    const plan = ticket.plan
    const agentIdentity = typeof exec?.agent?.identity === 'string' && exec.agent.identity.length > 0
      ? exec.agent.identity
      : typeof exec?.agentIdentity === 'string' ? exec.agentIdentity : null
    if (agentIdentity === null) return refuse(CODES.NO_OWNING_SESSION, 'no exec agent identity at consumption: refused here, the namespace has no owner to bind')
    if (!trusted.has(agentIdentity) || agentIdentity !== plan.manifest.sessionIncarnation) {
      return refuse(CODES.FOREIGN_SESSION, 'the consuming caller is not the incarnation this plan was classified for (no CURRENT/target laundering into the attachment namespace)')
    }
    const signal = exec?.signal
    if (signal?.aborted === true) {
      return refuse(CODES.CANCELLED, 'aborted before the effect: zero file reads + zero attachment writes (cleanup needs nothing — this call committed nothing)')
    }
    entry.state = 'CONSUMED' // single-claim BEFORE the first effect: a re-fire can never double-commit
    const correlation = entry.correlation
    // RE-ANCHOR at effect time (accepted C2 law): the containment decision is
    // this governor's own act, re-resolved now, never trusted from the
    // classify-time string and NEVER delegated to the mounted backend.
    const anchored = resolveAnchoredPath(plan.manifest.namespaceRoot, plan.manifest.canonicalTarget)
    if (!anchored.ok) {
      observe({ event: 'backend-end', correlation, detail: `refused:${anchored.code}` })
      if (anchored.code === 'target-outside-governed-root' || anchored.code === 'symlink-alias') {
        return refuse(CODES.TARGET_OUTSIDE_ROOT, `${anchored.detail} — refused before any content read (matrix row 7 closure: the host native face reaches ctx.fs.readBytes with no root fence; this arm resolves and refuses itself)`)
      }
      return refuse(CODES.TARGET_UNRESOLVABLE, anchored.detail)
    }
    try {
      const st = await readPort.stat(anchored.path, { signal })
      if (st?.isFile !== true) return refuse(CODES.TARGET_NOT_A_FILE, 'the target is not a regular file')
      // capacity check AT READ TIME, before the bytes exist anywhere:
      if (st.size > plan.manifest.byteCap) {
        return refuse(CODES.READ_TOO_LARGE, `the file carries ${st.size} bytes, above this deployment's read cap of ${plan.manifest.byteCap} (min(store maxImageBytes, maxMessageImageBytes)) — refused before the content read`)
      }
      observe({ event: 'backend-start', correlation, detail: plan.definitionIdentity })
      const data = await readPort.readFile(anchored.path, { maxBytes: plan.manifest.byteCap, signal })
      let receipt
      try {
        receipt = await attachments.commitImage({
          bytes: data,
          mediaType: plan.manifest.declaredMediaType,
          name: basename(anchored.path),
          namespace: { realmId, sessionIncarnation: plan.manifest.sessionIncarnation },
          correlation,
        })
      } catch (error) {
        // The store owns every image law; its refusals pass through typed. If
        // the store is gone, the state is a refusal state — conditional
        // unavailability, never an exemption, never a fallback.
        const text = String(error?.message ?? error)
        entry.settled = 'COMMIT-UNKNOWN'
        observe({ event: 'backend-end', correlation, detail: 'error' })
        return refuse(CODES.STORE_UNAVAILABLE, `the attachment store refused the commit: ${text}`, {
          sideEffectPossible: true,
          note: 'the commit boundary is not knowable from this side; the lane reports the boundary as UNRESOLVED and keeps sideEffectPossible (never downgraded)',
        })
      }
      entry.settled = 'COMMITTED'
      entry.receipt = receipt
      observe({ event: 'backend-commit', correlation, detail: `${receipt.attachmentId}:${receipt.fingerprint.slice(0, 12)}` })
      observe({ event: 'backend-end', correlation, detail: 'ok' })
      // The typed value mirrors the host output schema (single fact source =
      // the store receipt; the render/presentation face stays CENTER's).
      return {
        ok: true,
        value: Object.freeze({
          path: plan.manifest.canonicalTarget,
          image: Object.freeze({
            attachmentId: receipt.attachmentId,
            mediaType: receipt.mediaType,
            bytes: receipt.bytes,
            width: receipt.width,
            height: receipt.height,
            ...(receipt.name === undefined ? {} : { name: receipt.name }),
          }),
        }),
      }
    } catch (error) {
      if (signal?.aborted === true || error?.name === 'AbortError') {
        // The read died mid-flight: nothing was committed (the commit is the
        // step AFTER the read), so cleanup needs nothing — and this arm owns
        // no delete face, so it could never remove a pre-existing attachment.
        entry.settled = 'READ-ABORTED'
        observe({ event: 'cancel', correlation, detail: 'mid-read-abort' })
        return refuse(CODES.CANCELLED, 'aborted during the content read: the commit never started, zero attachment writes (this call had the only uncommitted work)')
      }
      entry.settled = 'COMMIT-UNKNOWN'
      observe({ event: 'backend-end', correlation, detail: 'error' })
      throw error
    }
  }

  /** The honest race report. §1.2 C3: it states WHICH happened first. */
  function cancel(planOrTicket) {
    const entry = plans.get(planOrTicket) ?? tickets.get(planOrTicket)
    if (entry === undefined) return refuse(CODES.NOT_ADMITTED, 'cancel answers only to a plan/ticket this arm issued')
    if (entry.state === 'CONSUMED') {
      if (entry.settled === 'COMMITTED') {
        return { ok: true, settled: 'ALREADY-COMMITTED', attachmentOutcome: `the attachment ${String(entry.receipt?.attachmentId ?? '=?')} is durable and content-addressed; cancellation never deletes existing attachments (this arm owns no delete face) — only THIS call had committed work, and it is kept because it completed first` }
      }
      return { ok: true, settled: entry.settled ?? 'COMMIT-UNKNOWN', attachmentOutcome: 'unknown — the store reported no commit boundary; the lane reports the call UNRESOLVED and keeps sideEffectPossible' }
    }
    const wasAdmitted = entry.state === 'PREPARED'
    entry.state = 'CANCELLED'
    observe({ event: 'cancel', correlation: entry.correlation, detail: wasAdmitted ? 'after-admission' : 'before-admission' })
    return { ok: true, settled: wasAdmitted ? 'CANCELLED-AFTER-ADMISSION' : 'CANCELLED-BEFORE-ADMISSION', attachmentOutcome: 'zero — no ticket was consumed: zero file reads AND zero attachment writes (the read and the commit both live behind the ticket)' }
  }

  /** C3 DRAINING: after this, every stage refuses typed; nothing reaches any backend. */
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
    prepare,
    execute,
    cancel,
    drain,
  }
}
