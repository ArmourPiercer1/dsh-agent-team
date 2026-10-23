/**
 * governed-families/image-attachment.mjs — A5-M2 B-IMAGE SERVICE side,
 * REVISION 2 (center fix card; revision 1 was root-measured blocked and
 * never mounted — FINDINGS-BLOCKED.md owns the accounting).
 *
 * The attachment face the governed read_image arm commits through (family
 * contract §3 B-IMAGE: the SERVICE attachment adapter creates/references
 * attachments AFTER approval, capacity checked at read time — the capacity
 * law itself lives at the read edge / the store, not here). This module is
 * the ONLY attachment face the arm holds, and it holds NOTHING but the
 * injected real store port — no fs import, no delete face, no parallel
 * image law: the format/size/pixel/normalization laws stay the real
 * attachment store's (validated against the pristine pin639
 * `attachment-local` public class, never a mock).
 *
 * What revision 2 changed (the blocked arm's measured defects):
 *  - OWNERSHIP IS NEVER CONTENT-ADDRESSED: the store dedupes OBJECTS by
 *    content (same bytes ⇒ the same immutable object — a store FEATURE);
 *    OWNERSHIP is a separate, namespace-scoped ENTITLEMENT. Revision 1 keyed
 *    its ledger by attachmentId alone, so a second namespace committing the
 *    same bytes OVERWROTE the first owner (root's measured defect 5). The
 *    ledger here is an entitlement set keyed `(namespaceKey, attachmentId)`:
 *    two namespaces holding the same content is two INDEPENDENT
 *    entitlements — neither mint erases the other, and every reference must
 *    present its own namespace. The lane fixture carries the dedup POSITIVE
 *    control (both entitlements fetch the shared object) and the NEGATIVE
 *    control (a foreign namespace never fetches through this face, zero
 *    store calls).
 *  - The FULL store ref is retained per entitlement and re-presented on the
 *    reference leg: the store re-validates the COMPLETE reference metadata
 *    (measured first-failure fact: a partial {attachmentId} ref answers
 *    "Stored attachment metadata does not match its reference.").
 *  - SOURCE vs NORMALIZED commit hashes are SEPARATE facts (fix card 5):
 *    `sourceSha256` is the digest of the bytes as read; the store commits
 *    its OWN normalized form whose identity is the answered attachmentId.
 *    `normalizedEqualsSource` states whether they coincide (pass-through:
 *    for a fresh pass-through object the store's attachmentId IS the source
 *    digest — pinned by the lane; under real normalization they differ,
 *    which the lane records as an environment limit). No leg may treat the
 *    content-addressed id as the source identity: the reference leg
 *    compares the re-read bytes against the ORIGINAL COMMITMENT recorded on
 *    the entitlement (source digest for pass-through, normalized identity
 *    always), never against a freshly recomputed content hash.
 *
 * @module runtime/plugin/live/governed-families/image-attachment
 */
import { createHash } from 'node:crypto'

/** Typed codes (pinned by packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts). */
export const A5_IMAGE_ATTACHMENT_CODES = Object.freeze({
  NAMESPACE_MISMATCH: 'P_IMAGE_ATTACHMENT_FOREIGN_NAMESPACE',
  UNKNOWN_ATTACHMENT: 'P_IMAGE_ATTACHMENT_UNKNOWN',
  COMMIT_DRIFT: 'P_IMAGE_ATTACHMENT_COMMIT_DRIFT',
  STORE_UNAVAILABLE: 'P_IMAGE_STORE_UNAVAILABLE',
})

const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** MEASURED at pin639: the real store's attachmentId is the FORM
 *  `sha256:<hex>` (for a pass-through save the hex IS the source digest).
 *  Compare in bare-hex form; never assume a prefix on either side. */
const bareHex = (id) => String(id ?? '').replace(/^sha256:/, '')

const namespaceKey = (ns) => [
  String(ns?.realmId ?? ''),
  String(ns?.teamSessionId ?? ''),
  String(ns?.instanceId ?? ''),
].join('\u0000')

const isCompleteNamespace = (ns) =>
  typeof ns?.realmId === 'string' && ns.realmId.length > 0
  && typeof ns?.teamSessionId === 'string' && ns.teamSessionId.length > 0
  && typeof ns?.instanceId === 'string' && ns.instanceId.length > 0

/**
 * @param deps - the injected real store port, validated hard (config defects
 *   throw at assembly; this module never defaults a missing store).
 * @param {{saveImage: Function, readImage: Function, imageLimits: object}} deps.store
 *   - the REAL attachment store public port, RECEIVER-BOUND by the injector
 *   (measured first-failure fact: bare method extraction loses the service
 *   `this` and answers "Cannot read properties of undefined (reading
 *   'run')"). `saveImage({data,mediaType,name}) -> ref`,
 *   `readImage(ref, signal) -> {ref, data}` (measured PAIR shape at pin639),
 *   frozen `imageLimits`.
 * @param {(row: object) => void} [deps.observe] - the §1.2 minimal backend log.
 */
export function createImageAttachmentAdapter({ store, observe = () => {} }) {
  if (store === null || typeof store?.saveImage !== 'function' || typeof store?.readImage !== 'function' || store.imageLimits === undefined) {
    throw new TypeError('image-attachment: the real store port {saveImage, readImage, imageLimits} is required by DI (no store = the mount does not assemble the arm; this adapter owns no fallback face)')
  }
  /** ENTITLEMENTS, never an owner-per-id map: key = namespaceKey + U+0000 +
   *  attachmentId. value = { ns, ref (FULL store ref), sourceSha256 }.
   *  In-memory lane ledger: the durable cross-restart entitlement ledger and
   *  the render face are Host legs (disclosed in the lane fixture). */
  const entitlements = new Map()
  /** attachmentIds this adapter has ever minted (for the foreign/unknown
   *  audit distinction only — never an ownership map). */
  const mintedIds = new Set()
  const counters = { commits: 0, recomputes: 0, references: 0, storeCalls: 0, refusedForeignNamespace: 0, refusedUnknown: 0, commitDrift: 0 }

  /**
   * The create/write leg, reached ONLY after the arm's consumption-point
   * checks passed (refusal paths never reach this module at all — the
   * structural half of "拒绝 ⇒ 0 文件读取 + 0 附件写"). Store refusals throw
   * through with their own `code` where one exists; the ARM splits
   * deterministic pre-write law refusals from unknown boundaries (that is
   * an execution-boundary judgment, so the law-code list lives there).
   */
  async function commitImage({ bytes, mediaType, name, namespace, correlation }) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
      throw new TypeError('image-attachment: commitImage needs the read bytes (the arm reads first; this module never reads)')
    }
    if (!isCompleteNamespace(namespace)) {
      throw new TypeError('image-attachment: commitImage binds a COMPLETE {realmId, teamSessionId, instanceId} namespace (the member identity of the durable leg; a partial identity is a config defect, never a default)')
    }
    const sourceSha256 = sha256Hex(bytes)
    counters.storeCalls += 1
    const ref = await store.saveImage({ data: bytes, mediaType, name })
    const attachmentId = typeof ref?.attachmentId === 'string' ? ref.attachmentId : null
    if (attachmentId === null) throw new Error('image-attachment: the store returned no attachmentId — the receipt would be unverifiable')
    mintedIds.add(attachmentId)
    const key = `${namespaceKey(namespace)}\u0000${attachmentId}`
    // (namespace, attachmentId) entitlement: re-committing identical content
    // from the SAME namespace is idempotent on both planes (same object in
    // the dedup store; same entitlement here — recorded as a recommit);
    // from ANOTHER namespace it is an INDEPENDENT entitlement. No existing
    // owner is ever overwritten — that overwrite was the blocked revision.
    const recommit = entitlements.has(key)
    if (!recommit) {
      entitlements.set(key, {
        ns: namespaceKey(namespace),
        ref,
        sourceSha256,
        ...(correlation === undefined ? {} : { correlation }),
      })
    } else {
      counters.recommits += 1
    }
    counters.commits += 1
    observe({ event: 'attachment-commit', correlation, detail: `${attachmentId}:${sourceSha256.slice(0, 12)}:recommit=${String(recommit)}` })
    return Object.freeze({
      attachmentId,
      // SEPARATE facts, never collapsed (fix card 5): the digest of the
      // bytes as read vs the store's normalized-object identity.
      sourceSha256,
      normalizedEqualsSource: bareHex(attachmentId) === sourceSha256,
      mediaType: ref.mediaType ?? mediaType,
      bytes: ref.bytes ?? bytes.byteLength,
      width: ref.width,
      height: ref.height,
      ...(ref.name === undefined ? {} : { name: ref.name }),
      namespace: Object.freeze({ realmId: namespace.realmId, teamSessionId: namespace.teamSessionId, instanceId: namespace.instanceId }),
    })
  }

  /**
   * The reference leg, ENTITLEMENT-bound: only a namespace holding its own
   * entitlement for the object may fetch it through this face. Foreign
   * namespaces and unknown ids refuse with ZERO store calls (the S0 danger
   * face "附件落未授权渲染路径" is answered here at lane level; the durable
   * ledger and the render face are Host legs). The re-read is compared
   * against the ORIGINAL COMMITMENT (source digest for pass-through,
   * normalized object identity always) — never against a freshly computed
   * hash of whatever came back.
   */
  async function referenceImage({ attachmentId, namespace, signal }) {
    if (!isCompleteNamespace(namespace)) {
      counters.refusedUnknown += 1
      observe({ event: 'attachment-refuse', detail: 'incomplete-namespace' })
      return { ok: false, code: A5_IMAGE_ATTACHMENT_CODES.UNKNOWN_ATTACHMENT, detail: 'a reference must present its COMPLETE {realmId, teamSessionId, instanceId} namespace — a partial identity is refused here, never resolved by guess' }
    }
    const key = `${namespaceKey(namespace)}\u0000${String(attachmentId ?? '')}`
    const entitlement = entitlements.get(key)
    if (entitlement === undefined) {
      const foreign = mintedIds.has(String(attachmentId ?? ''))
      if (foreign) counters.refusedForeignNamespace += 1
      else counters.refusedUnknown += 1
      observe({ event: 'attachment-refuse', detail: foreign ? 'foreign-namespace' : 'unknown-attachment' })
      return {
        ok: false,
        code: foreign ? A5_IMAGE_ATTACHMENT_CODES.NAMESPACE_MISMATCH : A5_IMAGE_ATTACHMENT_CODES.UNKNOWN_ATTACHMENT,
        detail: foreign
          ? 'this namespace holds no entitlement for that attachment: unauthorized fetch refused with ZERO store calls (授权身份保持; a content-addressed object may exist for another namespace — this face never crosses that boundary)'
          : 'no entitlement for this attachment in this namespace (an object this namespace never committed is not fetchable through this face)',
      }
    }
    counters.storeCalls += 1
    // MEASURED at pin639: the store's readImage answers `{ref, data}` (a
    // re-validated PAIR) and re-validates the COMPLETE ref metadata — the
    // full minted ref must be re-presented (revision-1 measured fact).
    const loaded = await store.readImage(entitlement.ref, signal)
    const bytes = loaded?.data ?? loaded
    const rereadSha256 = sha256Hex(bytes)
    const normalizedIdentity = String(entitlement.ref?.attachmentId ?? '')
    if (rereadSha256 !== entitlement.sourceSha256 && rereadSha256 !== bareHex(normalizedIdentity)) {
      // The re-read matches NEITHER recorded fact — drift against the
      // ORIGINAL commitment; refuse rather than serve an unverifiable fact.
      counters.commitDrift += 1
      observe({ event: 'attachment-refuse', detail: 'commit-drift' })
      return { ok: false, code: A5_IMAGE_ATTACHMENT_CODES.COMMIT_DRIFT, detail: `the re-read bytes (${rereadSha256.slice(0, 12)}) match neither the original source digest nor the store object identity — refused as drift, never served` }
    }
    counters.references += 1
    return {
      ok: true,
      bytes,
      attachmentId,
      sourceSha256: entitlement.sourceSha256,
      normalizedEqualsSource: bareHex(normalizedIdentity) === entitlement.sourceSha256,
    }
  }

  return {
    imageLimits: store.imageLimits,
    commitImage,
    referenceImage,
    stats: () => ({ ...counters }),
  }
}
