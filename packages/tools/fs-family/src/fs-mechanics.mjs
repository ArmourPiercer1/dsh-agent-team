/**
 * fs-family/src/fs-mechanics.mjs — shared governed-filesystem mechanics of the
 * FS family lane (U6 PR2; U6-SLICE-PLAN PR2: the read row's effect mechanics
 * move OUT of the center file `plane-effect-backends.mjs` into the family).
 *
 * OWNER ROLE (family lane, center-assembly-architecture §4/§10.5): this file
 * is FAMILY-owned source. It carries NO authority: no admission, no grant,
 * no approval, no identity — those are the Kernel's (§ CI-06). What lives
 * here is the governed-root mechanics the FS families share: the anchored
 * containment resolution (one containment algebra with the controlled-fs
 * `isBeneath` law) and the pin639 read-window deployment law.
 *
 * The code below is MOVED VERBATIM from `plane-effect-backends.mjs`
 * (constants :70-85, window :87-179, anchors :180-243 @ master 2db321f63) —
 * byte-preserved on purpose: the refusal texts and window numbers are pinned
 * by the existing read suites (a5-read-slice-window, a5-m1-read-c1c2, the
 * a5b3 cancel-parity legs) and by the golden-vector law this PR ships.
 * `plane-effect-backends.mjs` now RE-EXPORTS the anchor face so the
 * search/glob/shell rows and the existing suites keep one home for it until
 * their own families move (U6 PR3/PR5).
 *
 * @module fs-family/fs-mechanics
 */
import { Buffer } from 'node:buffer'
import { existsSync, realpathSync } from 'node:fs'
import { posix as posixModule, resolve, win32 as win32Module } from 'node:path'
import { isBeneath } from '../../../runtime/controlled-fs/src/index.js'

/** Bounded single-file read (no silent truncation: over-bound refuses). */
export const MAX_READ_BYTES = 1024 * 1024

// ── Governed `read` row deployment constants (Alpha.5 READ slice, plan E1) ──
// pin639 (`@639ed01539`) mirror: the native row's deployment-default caps are
// packages/fs/tool-fs/src/read.ts:15 `READ_LIMIT = 2000` and
// packages/fs/tool-fs/src/read-render.ts:11/14
// `READ_MAX_LINE_LENGTH = 2000` / `READ_MAX_BYTES = 50 * 1024`. The governed
// row carries these SAME numbers explicitly (same-name SAME-meaning: the
// row's omitted-limit IS the native window), exported so team-tool-plane.mjs
// and the presentation face consume ONE set of numbers.
export const READ_ROW_LINE_CAP = 2000
export const READ_ROW_MAX_LINE_LENGTH = 2000
export const READ_ROW_MAX_OUTPUT_BYTES = 50 * 1024
/** Chunk bound of the byte-fetch ring — NEVER a second file cap (the only
 *  file bound is MAX_READ_BYTES, plan E4 [rev3] ②). */
export const READ_ROW_CHUNK_BYTES = 64 * 1024

/**
 * The governed row's OWN window-parameter law (plan E2 — the third source
 * does NOT enter: this is the local mirror of the pin639 `parseReadArgs`
 * positive-integer + cap checks, applied BEFORE any locator resolution).
 * An illegal window is a schema refusal (`refused-schema read-window-invalid`)
 * — the baseline silently IGNORED these values and read the whole file, so a
 * wrong window is now refused, never reinterpreted. Returns a tagged pair so
 * the refusal carries its class verbatim.
 */
export function parseGovernedReadWindow(rawOffset, rawLimit) {
  const isPosInt = (v) => typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 1
  const describeValue = (v) => {
    let s
    try { s = JSON.stringify(v) ?? String(v) } catch { s = String(v) }
    return s.slice(0, 80)
  }
  if (rawOffset !== undefined && !isPosInt(rawOffset)) {
    return { ok: false, refusal: { kind: 'refused', refusalClass: 'schema', code: 'read-window-invalid', text: `refused-schema read-window-invalid — offset must be a positive integer (got ${describeValue(rawOffset)})` } }
  }
  if (rawLimit !== undefined && !isPosInt(rawLimit)) {
    return { ok: false, refusal: { kind: 'refused', refusalClass: 'schema', code: 'read-window-invalid', text: `refused-schema read-window-invalid — limit must be a positive integer (got ${describeValue(rawLimit)})` } }
  }
  if (rawLimit !== undefined && rawLimit > READ_ROW_LINE_CAP) {
    // The pin639 detail spelling VERBATIM (read.ts:79), pinned by test D5:
    // `limit must be less than or equal to ${cap}`.
    return { ok: false, refusal: { kind: 'refused', refusalClass: 'schema', code: 'read-limit-over-cap', text: `refused-schema read-limit-over-cap — limit must be less than or equal to ${String(READ_ROW_LINE_CAP)}` } }
  }
  return { ok: true, offset: rawOffset ?? 1, limit: rawLimit ?? READ_ROW_LINE_CAP }
}

/**
 * The governed row's line-window builder — a LOCAL, dependency-free mirror of
 * the pin639 display law (read-render.ts `buildWindow`/`consumeLine`/`finish`
 * :111-144/:75-88/:95-99): strip a single trailing `\r`; a line longer than
 * READ_ROW_MAX_LINE_LENGTH truncates to that many chars + the VERBATIM ASCII
 * suffix `... (line truncated to ${n} chars)` (read-render.ts:69-71, three
 * ASCII dots, never `…`); the output byte bound (READ_ROW_MAX_OUTPUT_BYTES,
 * utf8 + 1 separator per following line, :73-76) switches the window to the
 * capped state and NEVER truncates a single line to fit; the EOF rule mirrors
 * `finish` (offset past the end is refused — EXCEPT empty-file + offset 1).
 * Returns `{ ok, lines, totalLines }` or `{ ok:false, refusal }`. Bytes arrive
 * as the ONE decoded whole (decode happens on the complete buffer, never a
 * byte-slice — plan E4); this function itself is pure string arithmetic.
 */
export function buildGovernedReadWindow(text, displayPath, offset, limit) {
  let totalLines = 0
  let outputBytes = 0
  let truncatedByBytes = false
  const lines = []
  const flushLine = (rawLine) => {
    totalLines += 1
    if (truncatedByBytes || totalLines < offset || lines.length >= limit) return
    const stripped = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    const lineText = stripped.length > READ_ROW_MAX_LINE_LENGTH
      ? `${stripped.substring(0, READ_ROW_MAX_LINE_LENGTH)}... (line truncated to ${String(READ_ROW_MAX_LINE_LENGTH)} chars)`
      : stripped
    const bytes = Buffer.byteLength(lineText, 'utf8') + (lines.length > 0 ? 1 : 0)
    if (outputBytes + bytes > READ_ROW_MAX_OUTPUT_BYTES) {
      truncatedByBytes = true
      return
    }
    outputBytes += bytes
    lines.push({ number: totalLines, text: lineText })
  }
  let startPos = 0
  for (;;) {
    const newlinePos = text.indexOf('\n', startPos)
    if (newlinePos === -1) break
    flushLine(text.slice(startPos, newlinePos))
    startPos = newlinePos + 1
  }
  if (startPos < text.length) flushLine(text.slice(startPos))
  if (!truncatedByBytes && offset > totalLines && !(totalLines === 0 && offset === 1)) {
    return {
      ok: false,
      refusal: {
        kind: 'refused',
        refusalClass: 'window',
        code: 'offset-out-of-range',
        text: `refused-window offset-out-of-range — offset ${String(offset)} is out of range for "${displayPath}" (${String(totalLines)} lines)`,
      },
    }
  }
  return { ok: true, lines, totalLines }
}

/**
 * Anchor a parsed target (`{placement, locator}`) at the governed root and
 * prove containment TWICE: lexically before touching the fs, and again
 * through `realpathSync` (the symlink-alias class the C-FS lane refuses at
 * exec time). `isBeneath` is the controlled-fs lane's own law — one
 * containment algebra for the whole plane.
 */
export function resolveAnchored(rootDir, locatorTarget) {
  let rootReal
  try {
    rootReal = realpathSync(rootDir)
  } catch {
    return { ok: false, code: 'root-unavailable', detail: `the governed root does not resolve: ${rootDir}` }
  }
  const lex = locatorTarget.placement === 'absolute-path'
    ? resolve(locatorTarget.locator)
    : resolve(rootReal, locatorTarget.locator)
  if (!isBeneath(rootReal, lex)) {
    return { ok: false, code: 'target-outside-governed-root', detail: `target lexically escapes the governed root (${locatorTarget.placement}: ${locatorTarget.locator})` }
  }
  if (!existsSync(lex)) return { ok: false, code: 'target-unresolvable', detail: `target does not exist inside the governed root (${locatorTarget.locator})` }
  let real
  try {
    real = realpathSync(lex)
  } catch {
    return { ok: false, code: 'target-unresolvable', detail: `target realpath failed (${locatorTarget.locator})` }
  }
  if (!isBeneath(rootReal, real)) {
    return { ok: false, code: 'symlink-alias', detail: 'target resolves outside the governed root through a symlink — refused, never followed' }
  }
  return { ok: true, path: real, rootReal }
}

/** Anchor a raw relative/absolute path string (the governed read row). */
/**
 * PR358 fix-5: the PURE-LEXICAL layer of the anchored resolution — the same
 * front refusals and the same lexical join/normalize the full resolver
 * performs, with ZERO filesystem calls (no realpath, no exists, no stat).
 * Approved-effect honesty only needs the lexical target; the resolver's
 * realpath law is a POST-CONSUME step (below `lex` in the executor).
 */
export function lexicalAnchor(rootDir, rawPath) {
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    return { ok: false, code: 'locator-rejected', detail: 'the read path must be a non-empty string' }
  }
  if (rawPath.includes('://')) return { ok: false, code: 'locator-rejected', detail: 'a filesystem locator never wears a URI scheme' }
  if (rawPath.startsWith('\\')) return { ok: false, code: 'locator-rejected', detail: 'UNC/leading-` targets are refused' }
  const posix = rootDir.startsWith('/')
  const path = posix ? posixModule : win32Module
  const isAbsolute = rawPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(rawPath)
  const joined = isAbsolute ? path.normalize(rawPath) : path.resolve(path.dirname(path.join(rootDir, 'x')), rawPath)
  const rootNorm = path.normalize(rootDir)
  const targetNorm = path.normalize(joined)
  if (targetNorm !== rootNorm && !targetNorm.startsWith(rootNorm.endsWith(path.sep) ? rootNorm : rootNorm + path.sep)) {
    return { ok: false, code: 'locator-rejected', detail: `the lexical target escapes the governed root (${targetNorm})` }
  }
  return { ok: true, path: targetNorm }
}

export function resolveAnchoredPath(rootDir, rawPath) {
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    return { ok: false, code: 'locator-rejected', detail: 'the read path must be a non-empty string' }
  }
  if (rawPath.includes('://')) return { ok: false, code: 'locator-rejected', detail: 'a filesystem locator never wears a URI scheme' }
  if (rawPath.startsWith('\\')) return { ok: false, code: 'locator-rejected', detail: 'UNC/leading-` targets are refused' }
  return resolveAnchored(rootDir, rawPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(rawPath)
    ? { placement: 'absolute-path', locator: rawPath }
    : { placement: 'workspace', locator: rawPath })
}
