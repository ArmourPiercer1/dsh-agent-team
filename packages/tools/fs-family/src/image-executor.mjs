/**
 * fs-family/src/image-executor.mjs — the governed `read_image` effect body
 * (U7-9a). Same center-assembly law as the write/edit bodies: pure family
 * argument law + effect declaration; authority arrives injected; the bytes
 * are read ONLY through the controlled-fs verified-handle boundary after the
 * Kernel's PA edge consumed the grant (CI-07).
 *
 * THE DISCLOSED DUAL EFFECT (matrix M-05, M0-B §3 B-IMAGE): `read_image` is
 * a read of a realm file PLUS a create in the session's attachment store —
 * the second effect lives on a surface the realm's FS boundary does not
 * cover, so it travels as an INJECTED PORT, never as a family-held fs face:
 *
 *   • `attachmentsProvider()` — the host attachment store (the mount
 *     resolves `agentCtx.get('attachments')`, the SAME public seam the
 *     native tool executes through). Absent = the row answers the native
 *     no-store sentence; the row NEVER invents a store and NEVER fakes a
 *     commit.
 *   • `imageRoute(input)` — the image-capability route gate mirroring the
 *     native `assertImageCapableRoute` (same position: before any fs I/O;
 *     same sentences). Unanswerable = refusal, never a bypass.
 *   • `readBytes(input)` — the bounded read port over the approved root
 *     (O_NOFOLLOW open + `verifyOpenedHandle` identity law + cap+1 metering
 *     on the SAME verified fd). The port refuses over-cap WHOLE, never
 *     truncated.
 *
 * The store commit is the one post-consume step whose identity the family
 * cannot verify (it lives in the store's namespace): a commit that THROWS
 * non-deterministically is reported `sideEffectPossible: true` — an
 * attachment may exist in the store — and is never reported as a clean
 * zero-effect refusal, and the family owns NO delete face to "undo" it.
 *
 * @module fs-family/image-executor
 */
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import { lexicalAnchor } from './fs-mechanics.mjs'
import {
  imageExtensionOf,
  imageMediaTypeForPath,
  parseGovernedImageArgs,
  sniffImageMediaType,
} from './fs-mutation-mechanics.mjs'

/**
 * Build the governed read_image executor for one mount.
 *
 * @param {object} input
 * @param {string} input.realmId
 * @param {string} input.rootDir - the controlled-fs instance root (the SAME
 *   root as read/write/edit — one fs algebra).
 * @param {object} input.policy
 * @param {(x: {effects: unknown[]}) => {kind: string, code?: string}} input.decide
 * @param {(paCall: object) => Promise<object>} input.pa
 * @param {Function} [input.subtreeContains]
 * @param {() => {imageLimits: {mediaTypes: string[], maxImageBytes: number, maxMessageImageBytes: number}, saveImage: (i: object) => Promise<object>} | undefined} input.attachmentsProvider
 *   - the mount-resolved host attachment store (absent ⇒ native no-store
 *   refusal at call time).
 * @param {(i: {filePath: string, signal?: unknown}) => Promise<{ok: boolean, refusal?: {code: string, text: string}}>} input.imageRoute
 *   - the capability route gate (host seam; unanswerable ⇒ refusal).
 * @param {(i: {canonicalLocator: string, maxBytes: number, signal?: unknown}) => Promise<{ok: true, byteLength: number, bytes: Uint8Array} | {ok: false, code: string, detail: string}>} input.readBytes
 *   - the bounded verified-handle read port (controlled-fs law inside).
 * @param {(line: string) => void} [input.observe]
 */
export function createGovernedReadImageExecutor({
  realmId, rootDir, policy, decide, pa, subtreeContains,
  attachmentsProvider, imageRoute, readBytes, observe = () => {},
}) {
  let paSeq = 0
  const mountNonce = String(globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.floor(Math.random() * 2 ** 31)}`)
  const imageTokenLedger = new Map()
  const settledTokenSignals = new WeakMap()
  const imageSignalForSettled = (token) => {
    const cached = settledTokenSignals.get(token)
    if (cached !== undefined) return cached
    const settled = { aborted: true, reason: 'exec-token-terminal', addEventListener: (_t, _l) => {}, removeEventListener: (_t, _l) => {} }
    settledTokenSignals.set(token, settled)
    return settled
  }
  const refused = (refusalClass, code, detail, sideEffectPossible) => ({
    kind: 'refused', refusalClass, code, text: `refused-${refusalClass} ${String(code)} — ${detail}`,
    ...(sideEffectPossible === true ? { sideEffectPossible: true } : {}),
  })
  const ruleCovers = (rules, locator) => rules.some((rule) => {
    // `read_image` answers to its OWN permission class (the native law: a
    // plain `read` rule never widens into image/attachment access).
    if (rule?.tool !== 'read_image') return false
    const kind = rule?.resource?.kind
    if (kind === 'any') return true
    if (kind === 'exact') return typeof rule.resource.path === 'string' && rule.resource.path === locator
    if (kind === 'subtree') {
      if (typeof rule?.resource?.path !== 'string') return false
      if (typeof subtreeContains === 'function') {
        return subtreeContains({ realmId, parent: rule.resource.path, child: locator }) === true
      }
      return false // without the containment seam, a subtree rule proves nothing: refuse
    }
    return false
  })

  return async (raw, corr) => {
    const token = corr?.token
    const tokenKey = (typeof token === 'object' && token !== null) || typeof token === 'symbol' ? token : undefined
    if (tokenKey !== undefined) {
      const prior = imageTokenLedger.get(tokenKey)
      if (prior !== undefined && !prior.settled) {
        return refused('admission', 'exec-token-replay', 'this host execution already owns an in-flight governed image read')
      }
    }
    try {
      const execCorrelation = corr && typeof corr.correlation === 'string' && corr.correlation.length > 0 ? corr.correlation : undefined
      const execSignal = corr && corr.signal ? corr.signal : undefined
      const parsed = parseGovernedImageArgs(raw)
      if (parsed.ok !== true) return parsed.refusal
      const lex = lexicalAnchor(rootDir, parsed.filePath)
      if (!lex.ok) return refused('schema', lex.code, lex.detail)
      // ── PURE pre-read gates, native order and native sentences (every
      // refusal here happens BEFORE any fs I/O, so it leaks no partial read
      // and no attachment write): extension law → store presence → route
      // capability → declared-media deployment acceptance. ────────────────
      const extension = imageExtensionOf(parsed.filePath)
      const declared = imageMediaTypeForPath(parsed.filePath)
      if (declared === undefined && extension !== '') {
        return refused('schema', 'unsupported-image-extension', `cannot read "${parsed.filePath}": the ${extension} extension does not declare a supported image format; read_image accepts PNG/JPEG/WebP/GIF files, including extension-less files in those formats`)
      }
      const attachments = typeof attachmentsProvider === 'function' ? attachmentsProvider() : undefined
      if (attachments === undefined || typeof attachments.saveImage !== 'function'
        || attachments.imageLimits === undefined || attachments.imageLimits === null) {
        return refused('admission', 'attachment-service-unmounted', `cannot read "${parsed.filePath}" as an image: no attachment service is mounted`)
      }
      // The route gate arrives PER CALL on the correlation (the row owns
      // the host-exec facts; the constructor-level seam is the fallback
      // for direct/unit callers). No gate at all = the native
      // unresolvable-route refusal, never a bypass.
      const routeGate = typeof corr?.route === 'function' ? corr.route : imageRoute
      if (typeof routeGate !== 'function') {
        return refused('admission', 'IMAGE_ROUTE_UNRESOLVED', `cannot read "${parsed.filePath}" as an image: the current model route could not be resolved`)
      }
      const route = await routeGate({ filePath: parsed.filePath, ...(execSignal === undefined ? {} : { signal: execSignal }) })
      if (route.ok !== true) {
        return refused('admission', String(route.refusal?.code ?? 'IMAGE_ROUTE_UNRESOLVED'), String(route.refusal?.text ?? `cannot read "${parsed.filePath}" as an image: the current model route could not be resolved`))
      }
      const acceptsMedia = (mediaType) => Array.isArray(attachments.imageLimits.mediaTypes)
        && attachments.imageLimits.mediaTypes.includes(mediaType)
      if (declared !== undefined && !acceptsMedia(declared)) {
        return refused('admission', 'image-media-not-accepted', `cannot read "${parsed.filePath}": ${declared} images are not accepted by this deployment`)
      }
      const byteCap = Math.min(Number(attachments.imageLimits.maxImageBytes) || 0, Number(attachments.imageLimits.maxMessageImageBytes) || 0)
      if (!Number.isSafeInteger(byteCap) || byteCap <= 0) {
        return refused('admission', 'image-limits-unavailable', 'the attachment store answers no usable byte limits; the read is refused, never attempted unbounded')
      }
      const effects = [
        { kind: 'tool-invoke', toolName: 'read_image', resource: null },
        { kind: 'read', resource: { realmId, kind: 'absolute-path', canonicalLocator: lex.path, rights: ['read'] } },
      ]
      const verdict = decide({ effects })
      if (verdict.kind === 'deny') {
        observe(`governed-image lane-denied refusal code=${String(verdict.code)} path=${lex.path}`)
        return refused('admission', verdict.code, 'the template lane denies this image-read effect')
      }
      if (policy?.default === 'deny' && !ruleCovers([...(policy?.allow ?? []), ...(policy?.ask ?? [])], lex.path)) {
        observe(`governed-image default-deny refusal path=${lex.path}`)
        return refused('admission', 'template-default-deny', 'the policy defaults to DENY and no rule covers this image-read effect')
      }
      if (typeof pa !== 'function') {
        return refused('admission', 'PA_EDGE_UNAVAILABLE', 'this mount carries no PA admission edge, so no image read may run')
      }
      const set = parseRequestedEffectSet(effects)
      if (!set.ok) return refused('schema', 'effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
      paSeq += 1
      let ledgerCorrelation
      let replaySettled = false
      if (tokenKey !== undefined) {
        const prior = imageTokenLedger.get(tokenKey)
        if (prior !== undefined && prior.settled) {
          ledgerCorrelation = prior.correlation
          replaySettled = true
        } else {
          ledgerCorrelation = `plane-image:${mountNonce}-${String(paSeq)}`
          imageTokenLedger.set(tokenKey, { correlation: ledgerCorrelation, settled: false })
        }
      }
      const imageSignal = replaySettled && tokenKey !== undefined ? imageSignalForSettled(tokenKey) : execSignal
      const paCall = {
        realmId,
        callId: ledgerCorrelation ?? execCorrelation ?? `plane-image-${mountNonce}-${String(paSeq)}`,
        ...(imageSignal === undefined ? {} : { signal: imageSignal }),
        parametersFingerprint: set.value.fingerprint,
        requestedEffects: set.value,
      }
      const gate = await pa(paCall)
      if (gate.kind === 'deny') {
        observe(`governed-image pa-refused code=${String(gate.code)} detail=${String(gate.detail ?? '').slice(0, 240)}`)
        return refused('admission', String(gate.code), String(gate.detail ?? 'the PA execution edge refused this image read'))
      }
      if (gate.kind === 'allow' && gate.cancelled === true) {
        observe('governed-image cancelled-at-pa-edge')
        return { kind: 'cancelled' }
      }
      // ── POST-CONSUME: the bounded verified-handle read. The port owns
      // the resolver/anchor-drift/O_NOFOLLOW/identity/cap+1 law (it runs
      // AFTER the consumed grant exactly like the closures do); the byteCap
      // is the store's own deployment bound, measured not truncated. ──────
      const read = await readBytes({ canonicalLocator: lex.path, maxBytes: byteCap, ...(imageSignal === undefined ? {} : { signal: imageSignal }) })
      if (read.ok !== true) {
        observe(`governed-image port-refused code=${String(read.code)}`)
        return refused('io', String(read.code), String(read.detail))
      }
      if (read.byteLength > byteCap) {
        // Cap+1 measured AT the read (the port returns the overshoot it
        // counted): the WHOLE call refuses with the measured fact; the
        // partial bytes are dropped, never stored.
        return refused('io', 'image-too-large', `the image measures at least ${String(read.byteLength)} bytes and exceeds the ${String(byteCap)}-byte deployment bound — refused whole, never truncated or stored`)
      }
      const mediaType = declared ?? sniffImageMediaType(read.bytes)
      if (mediaType === undefined) {
        return refused('io', 'not-an-image', `cannot read "${parsed.filePath}": the file content is not a supported image format; read_image accepts PNG/JPEG/WebP/GIF`)
      }
      if (declared === undefined && !acceptsMedia(mediaType)) {
        return refused('admission', 'image-media-not-accepted', `cannot read "${parsed.filePath}": ${mediaType} images are not accepted by this deployment`)
      }
      if (imageSignal?.aborted === true) {
        // Cancel BEFORE the commit: the store was never touched — this is
        // the one post-read state that may honestly claim zero side effect.
        observe('governed-image cancelled-before-commit')
        return { kind: 'cancelled' }
      }
      let ref
      try {
        const name = String(lex.path).split(/[\\/]/u).pop() ?? undefined
        ref = await attachments.saveImage({ data: read.bytes, mediaType, name })
      } catch (error) {
        const storeCode = String(error?.code ?? '')
        const lawCodes = ['INVALID_IMAGE', 'IMAGE_TYPE_MISMATCH', 'IMAGE_DIMENSION_TOO_LARGE', 'IMAGE_TOO_MANY_PIXELS', 'IMAGE_TOO_LARGE']
        if (lawCodes.includes(storeCode)) {
          // Deterministic pre-write law refusal: the store measured the
          // bytes and said no — nothing was committed.
          observe(`governed-image store-law-refused code=${storeCode} path=${lex.path}`)
          return refused('io', storeCode.toLowerCase(), String(error?.message ?? error))
        }
        // Non-deterministic failure: the attachment MAY exist in the store.
        // Honest class: undetermined with the flag ON; never "zero side
        // effect", and there is no delete face to unwind it.
        observe(`governed-image store-unavailable path=${lex.path}`)
        return refused('io', 'attachment-commit-unconfirmed', `the attachment commit failed unconfirmed (${storeCode || String(error?.message ?? error).slice(0, 120)}) — an attachment may or may not exist in the store; nothing was deleted`, true)
      }
      observe(`governed-image RAN bytes=${String(read.byteLength)} mediaType=${mediaType} path=${lex.path}`)
      return {
        kind: 'ok',
        path: lex.path,
        image: {
          attachmentId: String(ref?.attachmentId ?? ''),
          mediaType: String(ref?.mediaType ?? mediaType),
          bytes: Number(ref?.bytes ?? read.byteLength),
          width: Number(ref?.width ?? 0),
          height: Number(ref?.height ?? 0),
          ...(typeof ref?.name === 'string' ? { name: ref.name } : {}),
          ...(ref?.originalDimensions !== undefined && ref?.originalDimensions !== null
            ? { originalDimensions: { width: Number(ref.originalDimensions.width), height: Number(ref.originalDimensions.height) } }
            : {}),
        },
      }
    } finally {
      if (tokenKey !== undefined) {
        const prior = imageTokenLedger.get(tokenKey)
        if (prior !== undefined && !prior.settled) imageTokenLedger.set(tokenKey, { correlation: prior.correlation, settled: true })
      }
    }
  }
}
