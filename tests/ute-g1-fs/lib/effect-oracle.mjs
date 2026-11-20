/**
 * effect-oracle.mjs — the observable-effect oracle the golden vectors are
 * recorded with.
 *
 * The oracle is deliberately narrow: it reads the filesystem AFTER the
 * invocation and reports (existence, byte length, sha256, mode). It does not
 * trust what a tool said happened. The corpus never claims more than this —
 * in particular it cannot witness that an unauthorized `open()`/`read()` did
 * not happen (no syscall witness exists in this lane); a refusal is recorded as
 * "the call returned a refusal and the observed effect is unchanged", and the
 * content-leak check only asserts that a secret token is absent from the
 * RESULT TEXT the model would have seen.
 *
 * @module tests/ute-g1-fs/lib/effect-oracle
 */
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { REFUSAL } from './lane.mjs'

/** A refusal code→class mapping shared by both host generations. */
const CODE_CLASS = Object.freeze([
  [/^FS_STALE_VERSION$/, REFUSAL.STALE_VERSION],
  [/^IO_WRITE_REQUIRES_READ$/, REFUSAL.WRITE_REQUIRES_READ],
  [/^FS_NOT_OBSERVED$/, REFUSAL.WRITE_REQUIRES_READ],
  // The next host's own typed refusals for the image row (measured in B2).
  [/^FS_NOT_FOUND$/, REFUSAL.MISSING_PATH],
  [/^FS_ABORTED$/, REFUSAL.CANCELLED],
  [/^IO_READ_DENIED$/, REFUSAL.LANE_READ],
  [/^IO_WRITE_DENIED$/, REFUSAL.LANE_WRITE],
  [/^IO_ASK_REQUIRES_APPROVAL$/, REFUSAL.LANE_READ],
  [/DENIED$/, REFUSAL.LANE_READ],
  [/^FS_PERMISSION_DENIED$/, REFUSAL.LANE_READ],
])

/**
 * Extract the machine-routable codes a refusal surfaced (message text for both
 * generations; typed `info.code` for the next host's settled results).
 * @param {string} text
 * @returns {string[]} unique codes in order of appearance.
 */
export function codesOf(text) {
  const found = String(text ?? '').match(/\b(?:IO|FS)_[A-Z][A-Z0-9_]+\b/g) ?? []
  return [...new Set(found)]
}

/**
 * Prose patterns for the LEGACY governed path, whose route-C refusals are
 * human messages rather than typed codes (measured: the guard's refusal text is
 * "authored locator '…' is outside every allow subtree of the lane", the
 * observation contract's is "file has not been read — read the file, then
 * retry", the edit guard's is "file changed since it was read — re-read the
 * file, then retry"). The next host answers typed codes; both are mapped onto
 * the SAME closed vocabulary here.
 */
const TEXT_CLASS = Object.freeze([
  [/changed since it was read|has been modified since|FS_STALE_VERSION/, REFUSAL.STALE_VERSION],
  [/has not been read|not been observed|read the file, then retry|IO_WRITE_REQUIRES_READ|FS_NOT_OBSERVED/, REFUSAL.WRITE_REQUIRES_READ],
  [/outside every allow subtree of the lane|outside the declared .* lane|FS_SANDBOX_DENIED|FS_PERMISSION_DENIED|IO_READ_DENIED|IO_WRITE_DENIED|permission denied/i, REFUSAL.LANE_READ],
  // The image rows' four distinct causes must not collapse into `other`: the
  // corpus compares CLASS, so a route gap, a missing file, a modality refusal
  // and a cancellation have to be distinguishable in the machine-readable cell.
  // Each pattern is named from the text the legacy path actually emitted
  // (transcripts in dev/agent-workflow/evidence/ute-g1-fs-20261120/).
  [/cannot get property ["']?fs["']? without inject/, REFUSAL.ROUTE_UNRESOLVED],
  [/\bread target\b[^\n]*\bdoes not exist\b/, REFUSAL.MISSING_PATH],
  [/does not declare image input/, REFUSAL.IMAGE_MODALITY_DENIED],
  [/aborted before dispatch/, REFUSAL.CANCELLED],
])

/**
 * Map the observed codes AND refusal prose onto the closed comparison
 * vocabulary. Lane-axis classes are deliberately collapsed to `lane-deny`:
 * WHICH guard fires first (an existence `stat` on the read axis vs the mutation
 * on the write axis) may legitimately differ between generations, while the
 * effect — refused, nothing written — is the thing the vector pins.
 * @param {readonly string[]} codes
 * @param {string} [text] - the refusal text the caller observed.
 * @returns {{refusal: string|null, axis: string|null}}
 */
export function classifyRefusal(codes, text = '') {
  for (const code of codes) {
    for (const [pattern, cls] of CODE_CLASS) {
      if (pattern.test(code)) return { refusal: cls === REFUSAL.LANE_READ || cls === REFUSAL.LANE_WRITE ? 'lane-deny' : cls, axis: cls === REFUSAL.LANE_READ ? 'read' : cls === REFUSAL.LANE_WRITE ? 'write' : null }
    }
  }
  for (const [pattern, cls] of TEXT_CLASS) {
    if (pattern.test(String(text))) {
      return { refusal: cls === REFUSAL.LANE_READ || cls === REFUSAL.LANE_WRITE ? 'lane-deny' : cls, axis: null }
    }
  }
  return { refusal: codes.length > 0 ? REFUSAL.OTHER : null, axis: null }
}

/**
 * Snapshot one world-relative path.
 * @param {string} root - world root.
 * @param {string} rel - world-relative path (POSIX separators).
 * @returns {{path: string, exists: boolean, bytes: number|null, sha256: string|null, mode: string|null}}
 */
export function snapshotPath(root, rel) {
  const absolute = join(root, ...rel.split('/'))
  try {
    const stat = statSync(absolute)
    if (!stat.isFile()) return Object.freeze({ path: rel, exists: false, bytes: null, sha256: null, mode: null })
    const bytes = readFileSync(absolute)
    return Object.freeze({
      path: rel,
      exists: true,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      mode: `0o${(stat.mode & 0o777).toString(8).padStart(3, '0')}`,
    })
  } catch (error) {
    if (error?.code === 'ENOENT') return Object.freeze({ path: rel, exists: false, bytes: null, sha256: null, mode: null })
    throw error
  }
}

/** Snapshot several paths, sorted by path for a stable fixture. */
export function snapshotAll(root, rels) {
  return [...rels].sort().map((rel) => snapshotPath(root, rel))
}

/** Serialize effects into one TSV-safe cell. */
export function effectsCell(effects) {
  return effects
    .map((effect) => `${effect.path}|${effect.exists ? 'present' : 'absent'}|${effect.bytes ?? '-'}|${effect.sha256 ?? '-'}|${effect.mode ?? '-'}`)
    .join(';')
}

/** Parse the effects cell back into objects (for diffing). */
export function parseEffectsCell(cell) {
  if (cell === '-' || cell === '') return []
  return cell.split(';').map((part) => {
    const [path, existence, bytes, sha256, mode] = part.split('|')
    return { path, exists: existence === 'present', bytes: bytes === '-' ? null : Number(bytes), sha256: sha256 === '-' ? null : sha256, mode: mode === '-' ? null : mode }
  })
}

/**
 * `read_image` does not produce a filesystem effect: it commits an ATTACHMENT
 * and returns a model-facing text+image result. The oracle records that as one
 * synthetic effect entry so it lands in the SAME compared/effect cell as every
 * other vector:
 *
 *   `@result:<mediaType>:<w>x<h>|present|<bytes>|<sha256>|blocks=<shape>`
 *
 * The digest is over the bytes the ATTACHMENT STORE received (observed at the
 * store seam), never over the path string and never over the tool's own
 * metadata. A refusal records `@result:none|absent|-|-|-`: "no attachment was
 * materialised". `@` marks the path column as synthetic, not an FS locator.
 *
 * @param {{mediaType: string, width: number, height: number, bytes: number, sha256: string, blocks: string}} input
 * @returns {Readonly<object>}
 */
export function imageResultEffect({ mediaType, width, height, bytes, sha256, blocks }) {
  return Object.freeze({
    path: `@result:${mediaType}:${width}x${height}`,
    exists: true,
    bytes,
    sha256,
    mode: `blocks=${blocks}`,
  })
}

/** The "no attachment materialised" companion entry. */
export function noImageResultEffect() {
  return Object.freeze({ path: '@result:none', exists: false, bytes: null, sha256: null, mode: null })
}

/** sha256 of a byte buffer, hex. */
export function sha256Of(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Observe one `read_image` step at the ATTACHMENT STORE seam: what bytes the
 * store actually received (byte length + sha256), and what model-facing result
 * the registry produced (block shape, image block ↔ store ref). Trusting the
 * tool's reported metadata would make the digest a self-report, so the bytes
 * are digested where they are committed. Shared by BOTH paths so the image
 * observation cannot drift between the old and new runners.
 *
 * @param {object} settled - dispatch result: `isError`, optional `value`, `content`.
 * @param {ReadonlyArray<{bytes: number, sha256: string}>} fresh - store calls made by THIS step.
 * @returns {object[]} zero or one synthetic result effect.
 */
export function observeImageStep(settled, fresh) {
  if (settled.isError === true) {
    if (fresh.length !== 0) {
      throw new Error(`a refused read_image committed ${fresh.length} attachment(s); the oracle refuses to record that as a zero-effect refusal`)
    }
    return [noImageResultEffect()]
  }
  const image = settled.value?.image
  if (image === undefined || typeof image !== 'object') {
    throw new Error('an allowed read_image returned no image value; refusing to fabricate an attachment observation')
  }
  if (fresh.length !== 1) {
    throw new Error(`an allowed read_image must commit EXACTLY ONE attachment, observed ${fresh.length}`)
  }
  const committed = fresh[0]
  if (committed.bytes !== image.bytes) {
    throw new Error(`the store recorded ${committed.bytes} bytes but the tool value reports ${String(image.bytes)}`)
  }
  const content = Array.isArray(settled.content) ? settled.content : []
  const blockTypes = content.map((part) => part?.type)
  const imageBlocks = content.filter((part) => part?.type === 'image')
  if (imageBlocks.length !== 1 || imageBlocks[0]?.attachment?.attachmentId !== image.attachmentId) {
    throw new Error(`the model-facing result is not the committed attachment (blocks=${blockTypes.join('+') || 'none'}, attachmentId=${String(imageBlocks[0]?.attachment?.attachmentId)})`)
  }
  return [imageResultEffect({
    mediaType: String(image.mediaType),
    width: Number(image.width),
    height: Number(image.height),
    bytes: committed.bytes,
    sha256: committed.sha256,
    blocks: blockTypes.join('+'),
  })]
}

/**
 * Scan the text the MODEL would have received for secret tokens.
 * @param {string} text
 * @param {readonly string[]} tokens
 * @returns {string[]} leaked tokens (empty means the refusal/response did not
 *   carry them; it does NOT prove no read happened).
 */
export function findLeaks(text, tokens) {
  const haystack = String(text ?? '')
  return tokens.filter((token) => haystack.includes(token))
}
