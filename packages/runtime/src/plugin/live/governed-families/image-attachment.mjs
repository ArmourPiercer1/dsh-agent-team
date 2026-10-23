/**
 * governed-families/image-attachment.mjs — A5-M2 B-IMAGE SERVICE side: the
 * attachment adapter the governed `read_image` arm commits through (family
 * contract §3 B-IMAGE route: "the SERVICE attachment adapter creates/references
 * attachments AFTER approval, capacity checked at read time"). This module is
 * the ONLY attachment face the arm holds, and it holds NOTHING but the injected
 * real store port — no fs import, no delete face, no parallel image law:
 * the format/size/pixel/normalization laws stay the real attachment store's
 * (validated in the lane fixture against the pristine pin639
 * `attachment-local` public class, not a mock).
 *
 * Duties (§1.1 S(attachment-store, create, write) with its REAL native entry):
 *  - `commitImage(...)` — the create/write leg, reached ONLY from a consumed
 *    ticket (the arm calls it after admission; refusal paths never reach this
 *    module at all, which is the structural half of "拒绝 ⇒ 0 文件读取 +
 *    0 附件写"). The receipt carries the attachment identity AND a fingerprint
 *    (the lane's sha256 over the committed bytes — content-addressed store:
 *    for a fresh object the store's own attachmentId equals this digest, and
 *    the fixture pins the equality), plus the store-answered media facts.
 *  - `referenceImage(...)` — the reference leg bound to the target
 *    session/attachment NAMESPACE: an attachment this adapter minted is
 *    fetchable only inside the (realm, session incarnation) namespace that
 *    minted it; a foreign namespace gets a typed refusal and ZERO store calls
 *    (the S0 danger face "附件落未授权渲染路径" is answered here at lane level;
 *    the durable cross-restart ledger and the render face are Host legs,
 *    disclosed in the lane fixture).
 *  - observation counters (`stats()`): commit/reference/store-call totals the
 *    zero-effect faces assert against.
 *
 * @module runtime/plugin/live/governed-families/image-attachment
 */
import { createHash } from 'node:crypto'

/** Typed codes (pinned by packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts). */
export const A5_IMAGE_ATTACHMENT_CODES = Object.freeze({
  NAMESPACE_MISMATCH: 'P_IMAGE_ATTACHMENT_FOREIGN_NAMESPACE',
  UNKNOWN_ATTACHMENT: 'P_IMAGE_ATTACHMENT_UNKNOWN',
  STORE_UNAVAILABLE: 'P_IMAGE_STORE_UNAVAILABLE',
})

const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex')

/**
 * @param deps - the injected real store port, validated hard (config defects
 *   throw at assembly; this module never defaults a missing store).
 * @param {{saveImage: Function, readImage: Function, imageLimits: object}} deps.store
 *   - the REAL attachment store public port: `saveImage({data, mediaType,
 *   name}) -> ref`, `readImage(ref, signal) -> bytes`, frozen `imageLimits`.
 * @param {(row: object) => void} [deps.observe] - the §1.2 minimal backend log.
 */
export function createImageAttachmentAdapter({ store, observe = () => {} }) {
  if (store === null || typeof store?.saveImage !== 'function' || typeof store?.readImage !== 'function' || store.imageLimits === undefined) {
    throw new TypeError('image-attachment: the real store port {saveImage, readImage, imageLimits} is required by DI (no store = the mount does not assemble the arm; this adapter owns no fallback face)')
  }
  /** in-memory mint ledger: attachmentId -> {ns, ref} (Host legs own the durable ledger + render face). */
  const minted = new Map()
  const counters = { commits: 0, references: 0, storeCalls: 0, refusedForeignNamespace: 0 }

  const namespaceKey = (ns) => `${ns.realmId} ${ns.sessionIncarnation}`

  /**
   * The create/write leg. Throws carry the STORE's own refusals (typed or
   * verbatim — the store owns the image law; the arm maps unknowable commit
   * boundaries to STORE_UNAVAILABLE keeping sideEffectPossible, never
   * downgraded).
   */
  async function commitImage({ bytes, mediaType, name, namespace, correlation }) {
    if (bytes === undefined || bytes === null) throw new TypeError('image-attachment: commitImage needs the read bytes (the arm reads first; this module never reads)')
    if (typeof namespace?.realmId !== 'string' || typeof namespace?.sessionIncarnation !== 'string') {
      throw new TypeError('image-attachment: commitImage binds a {realmId, sessionIncarnation} namespace (an unbound commit is a config defect)')
    }
    const fingerprint = sha256Hex(bytes)
    counters.storeCalls += 1
    const ref = await store.saveImage({ data: bytes, mediaType, name })
    const attachmentId = typeof ref?.attachmentId === 'string' ? ref.attachmentId : null
    if (attachmentId === null) throw new Error('image-attachment: the store returned no attachmentId — the receipt would be unverifiable')
    // the ledger keeps the FULL store ref: the store's readImage re-validates
    // the complete reference metadata (measured first-failure fact: a partial
    // {attachmentId} ref fails with "Stored attachment metadata does not match
    // its reference." — the reference leg must present the minted ref).
    minted.set(attachmentId, { ns: namespaceKey(namespace), ref })
    counters.commits += 1
    observe({ event: 'attachment-commit', correlation, detail: `${attachmentId}:${fingerprint.slice(0, 12)}` })
    return Object.freeze({
      attachmentId,
      fingerprint,
      mediaType: ref.mediaType ?? mediaType,
      bytes: ref.bytes ?? bytes.byteLength,
      width: ref.width,
      height: ref.height,
      ...(ref.name === undefined ? {} : { name: ref.name }),
      namespace: Object.freeze({ realmId: namespace.realmId, sessionIncarnation: namespace.sessionIncarnation }),
    })
  }

  /**
   * The reference leg, namespace-bound: only the minting (realm, incarnation)
   * namespace may fetch; foreign namespaces refuse with ZERO store calls. The
   * re-read bytes are fingerprint-verified (byte-identity witness).
   */
  async function referenceImage({ attachmentId, namespace, signal }) {
    const entry = minted.get(attachmentId)
    if (entry === undefined) {
      observe({ event: 'attachment-refuse', detail: 'unknown-attachment' })
      return { ok: false, code: A5_IMAGE_ATTACHMENT_CODES.UNKNOWN_ATTACHMENT, detail: 'this adapter mints no such attachment (a store object this namespace never minted is not fetchable through this face)' }
    }
    if (entry.ns !== namespaceKey(namespace ?? {})) {
      counters.refusedForeignNamespace += 1
      observe({ event: 'attachment-refuse', detail: 'foreign-namespace' })
      return { ok: false, code: A5_IMAGE_ATTACHMENT_CODES.NAMESPACE_MISMATCH, detail: 'the attachment belongs to a different (realm, session) namespace: unauthorized fetch refused with ZERO store calls (授权身份保持)' }
    }
    counters.storeCalls += 1
    // MEASURED at pin639: the store's readImage answers `{ref, data}` (a
    // re-validated pair), not a bare byte string.
    const loaded = await store.readImage(entry.ref, signal)
    const bytes = loaded?.data ?? loaded
    const fingerprint = sha256Hex(bytes)
    counters.references += 1
    return { ok: true, bytes, fingerprint, attachmentId }
  }

  return {
    imageLimits: store.imageLimits,
    commitImage,
    referenceImage,
    stats: () => ({ ...counters }),
  }
}
