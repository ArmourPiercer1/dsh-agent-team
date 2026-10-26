/**
 * fs-family/src/fs-mutation-mechanics.mjs — the PURE laws of the FS family's
 * governed MUTATION rows (`write`, `edit`) and image row (`read_image`)
 * (U7-9a). Like `fs-mechanics.mjs` this file carries NO authority: no
 * admission, no grant, no approval, no identity (§ CI-06). What lives here
 * is the family-owned parameter law that runs BEFORE any effect is declared
 * — the pure-parse + closed-shape + deployment-cap front — plus the
 * pure-lexical mirror of the pin639 host's image-format law.
 *
 * OWNER ROLE (family lane, center-assembly-architecture §4): the family owns
 * the argument & parameter contract. The three parsers below are the rows'
 * closed parameter law, mirrored from the pinned host's own tool-level
 * validation (tests/deepseek-harness-test-use @639ed01539,
 * packages/fs/tool-fs/src/{write,edit,read-image}.ts) so the governed rows
 * answer the SAME malformed input the native name answers — same name,
 * same meaning at the parameter boundary. The governed law is STRICTER in
 * exactly two disclosed places (both recorded in the lane README and the
 * PR body):
 *  - unknown parameters are REFUSED (the native rows silently ignore
 *    extras; the governed rows have no escalation lane, so a
 *    `sandbox_permissions`/`justification` field is a refusal, never a
 *    ride);
 *  - the governed write carries the family's deployment cap
 *    `MAX_GOVERNED_WRITE_BYTES` (over-cap refuses with the measured fact,
 *    NEVER a truncation — the same no-silent-truncation law as MAX_READ_BYTES).
 *
 * The image sniff/extension law is the host's `read-image.ts` law mirrored
 * for the PRE-APPROVAL pure gate only (the bytes themselves are read only
 * post-consume through the controlled-fs verified-handle boundary; the
 * store's own `saveImage` stays the final format/normalization authority —
 * the family never re-decides what the store decides).
 *
 * @module fs-family/fs-mutation-mechanics
 */

/** Governed write deployment cap (refuse, never truncate; plan-symmetric to
 *  the read row's MAX_READ_BYTES). */
import { Buffer } from 'node:buffer'

export const MAX_GOVERNED_WRITE_BYTES = 1024 * 1024

/** The closed Domain-Authority id of the host attachment store — the ONE
 *  name the read_image row's SECOND declared target carries in BOTH faces:
 *  the contribution descriptor's `effects.targets` and the per-call
 *  requested-effect set (kind `domain-ref`, effects.ts: the authority
 *  decides at commit). Pin law (u7-9a R1): a declared effect without an
 *  admitted rung is refused with zero commit; the identity of the arm is
 *  asserted against this constant on both sides. */
export const ATTACHMENT_STORE_DOMAIN_AUTHORITY = 'attachment-store'

/** The closed parameter set of each mutation row (extras are refused —
 *  disclosed stricter-than-native law: the governed rows mount NO
 *  sandbox-escalation lane, so the host's conditional
 *  `sandbox_permissions`/`justification` fields are unknown parameters). */
export const WRITE_ROW_PARAMS = Object.freeze(['file_path', 'content'])
export const EDIT_ROW_PARAMS = Object.freeze(['file_path', 'old_string', 'new_string', 'replace_all'])
export const IMAGE_ROW_PARAMS = Object.freeze(['file_path'])

const refusal = (code, detail) => ({ ok: false, refusal: { kind: 'refused', refusalClass: 'schema', code, text: `refused-schema ${String(code)} — ${detail}` } })

const describeValue = (v) => {
  let s
  try { s = JSON.stringify(v) ?? String(v) } catch { s = String(v) }
  return s.slice(0, 80)
}

function asArgumentRecord(params, tool, raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    // The frozen center answers a non-object argument record with
    // `file-path-missing` (its asArgumentRecord arm) — same code here.
    return refusal('file-path-missing', 'the tool arguments must be a plain object')
  }
  const record = /** @type {Record<string, unknown>} */ (raw)
  for (const key of Object.keys(record)) {
    if (!params.includes(key)) {
      return refusal(`${tool}-unknown-parameter`, `unknown parameter '${key}' — this row's closed parameter set is [${params.join(', ')}]`)
    }
  }
  return { ok: true, record }
}

/** The center's SHARED file-path law (extractFilePath), verbatim codes:
 *  `file-path-missing` / `file-path-not-a-string` / `file-path-empty`,
 *  tool-generic on purpose — the family parser and the frozen center
 *  canonicalizer must never answer two spellings for one shape. */
function filePathRefusal(value) {
  if (value === undefined) return refusal('file-path-missing', 'file_path is required')
  if (typeof value !== 'string') return refusal('file-path-not-a-string', `file_path must be a string (got ${describeValue(value)})`)
  if (value.trim().length === 0) return refusal('file-path-empty', 'file_path must not be blank')
  return null
}

/**
 * The governed `write` closed parameter law: `{file_path, content}` ONLY,
 * `file_path` a non-blank string (native parseWriteArgs law), `content` a
 * string — the EMPTY string is legal (it writes an empty file, native law) —
 * within `MAX_GOVERNED_WRITE_BYTES` (measured in BYTES, the write lands
 * UTF-8). Pure: zero FS, zero realpath.
 */
export function parseGovernedWriteArgs(raw) {
  const shape = asArgumentRecord(WRITE_ROW_PARAMS, 'write', raw)
  if (shape.ok !== true) return shape
  const filePath = shape.record['file_path']
  const pathRefusal = filePathRefusal(filePath)
  if (pathRefusal !== null) return pathRefusal
  const content = shape.record['content']
  if (content === undefined) {
    // The SAME closed code the frozen center canonicalizer throws for an
    // absent content (`write-content-missing`) — one refusal vocabulary,
    // no drift (the row's JSON schema also marks content required; this is
    // defense-in-depth for direct-executor callers).
    return refusal('write-content-missing', 'content is required (an EMPTY string is legal — it clears the file)')
  }
  if (typeof content !== 'string') {
    return refusal('write-content-not-a-string', `content must be a string (got ${describeValue(content)})`)
  }
  const byteLength = Buffer.byteLength(content, 'utf8')
  if (byteLength > MAX_GOVERNED_WRITE_BYTES) {
    return refusal('write-content-too-large', `the governed write cap is ${String(MAX_GOVERNED_WRITE_BYTES)} bytes; this content measures ${String(byteLength)} bytes — refused whole, NEVER truncated`)
  }
  return { ok: true, filePath, content, byteLength }
}

/**
 * The governed `edit` closed parameter law: `{file_path, old_string,
 * new_string, replace_all?}`, `old_string` non-empty and `old_string !==
 * new_string` (native parseEditArgs + the frozen canonicalizer's
 * `edit-old-string-empty`/`edit-old-equals-new` law), `new_string` a string
 * (the empty string is a legal DELETE), `replace_all` boolean or absent
 * (default false — defaulting happens HERE, at the row's own parameter law,
 * never hidden inside the provider closure). Pure: zero FS.
 */
export function parseGovernedEditArgs(raw) {
  const shape = asArgumentRecord(EDIT_ROW_PARAMS, 'edit', raw)
  if (shape.ok !== true) return shape
  const filePath = shape.record['file_path']
  const editPathRefusal = filePathRefusal(filePath)
  if (editPathRefusal !== null) return editPathRefusal
  const oldString = shape.record['old_string']
  const newString = shape.record['new_string']
  // The MISSING vs NOT-A-STRING split mirrors the frozen center canonicalizer
  // field for field (`edit-old-string-missing`/`edit-new-string-missing`
  // precede `edit-string-not-a-string`) — one refusal vocabulary, no drift.
  if (oldString === undefined) {
    return refusal('edit-old-string-missing', 'old_string is required')
  }
  if (newString === undefined) {
    return refusal('edit-new-string-missing', 'new_string is required (the EMPTY string is a legal delete)')
  }
  if (typeof oldString !== 'string' || typeof newString !== 'string') {
    return refusal('edit-string-not-a-string', 'old_string and new_string must both be strings')
  }
  if (oldString.length === 0) {
    return refusal('edit-old-string-empty', 'old_string must be a non-empty string')
  }
  if (oldString === newString) {
    return refusal('edit-old-equals-new', 'old_string and new_string must differ (an equal pair is a guaranteed no-op edit)')
  }
  const rawReplaceAll = shape.record['replace_all']
  if (rawReplaceAll !== undefined && typeof rawReplaceAll !== 'boolean') {
    return refusal('edit-replace-all-not-boolean', `replace_all must be a boolean (got ${describeValue(rawReplaceAll)})`)
  }
  return { ok: true, filePath, oldString, newString, replaceAll: rawReplaceAll === true }
}

/**
 * The governed `read_image` closed parameter law: `{file_path}` ONLY. The
 * extension law mirrors the host's: an extension that CLAIMS a format is
 * mapped by the pin639 extension table; an extension-less path declares no
 * format and its bytes are sniffed POST-CONSUME only (the pure pre-gate
 * never guesses from bytes it has not — and must not — read).
 */
export function parseGovernedImageArgs(raw) {
  const shape = asArgumentRecord(IMAGE_ROW_PARAMS, 'read_image', raw)
  if (shape.ok !== true) return shape
  const filePath = shape.record['file_path']
  const imagePathRefusal = filePathRefusal(filePath)
  if (imagePathRefusal !== null) return imagePathRefusal
  return { ok: true, filePath }
}

// ── pin639 image-format law (mirrored from the pristine host's
//    packages/fs/tool-fs/src/read-image.ts:25-60 @639ed01539 — the SAME
//    extension map and magic-byte sniff, verbatim logic) ──────────────────
export const IMAGE_EXTENSIONS = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
})

/** Last-dot extension of a path string, lowercased ('' when none). */
export function imageExtensionOf(filePath) {
  const base = String(filePath).split(/[\\/]/u).pop() ?? ''
  const at = base.lastIndexOf('.')
  if (at <= 0) return ''
  return base.slice(at).toLowerCase()
}

/** The media type an extension DECLARES (undefined = no declared format). */
export function imageMediaTypeForPath(filePath) {
  const ext = imageExtensionOf(filePath)
  return ext === '' ? undefined : IMAGE_EXTENSIONS[ext]
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

const matchesBytes = (data, offset, expected) => data.byteLength >= offset + expected.length
  && expected.every((byte, index) => data[offset + index] === byte)
const matchesAscii = (data, offset, value) => matchesBytes(data, offset, [...value].map((c) => c.charCodeAt(0)))

/** Magic-byte sniff of ALREADY-READ bytes (post-consume use only — the
 *  pre-approval law never touches bytes). */
export function sniffImageMediaType(data) {
  if (matchesBytes(data, 0, PNG_SIGNATURE)) return 'image/png'
  if (matchesBytes(data, 0, JPEG_SIGNATURE)) return 'image/jpeg'
  if (matchesAscii(data, 0, 'GIF87a') || matchesAscii(data, 0, 'GIF89a')) return 'image/gif'
  if (matchesAscii(data, 0, 'RIFF') && matchesAscii(data, 8, 'WEBP')) return 'image/webp'
  return undefined
}
