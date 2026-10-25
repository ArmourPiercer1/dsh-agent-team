/**
 * fs-family/src/read-presentation.mjs — the governed `read` row's OWN
 * presentation face (U6 PR2; moved VERBATIM out of the center file
 * `team-tool-plane.mjs` :144-283 @ master 2db321f63 — the B2 sites the
 * U6-SLICE-PLAN PR2 names). Byte-preserved law: the pin639 read envelope
 * mirror, the render/presentationMeta contract and the decline-on-anything-
 * dishonest presentResult are pinned by the shipped read suites and by C2.
 *
 * OWNER ROLE (family lane): presentation is Family-owned (§4 Definition &
 * Arguments / Result boundaries — the Family owns the Definition and the
 * result SHAPE; the Kernel owns WHETHER the call runs). No authority lives
 * in this file: every function here is a pure re-derivation of display
 * state; nothing decides, admits, or grants.
 *
 * Mirror, not import: the host modules sit behind their own public tools
 * (read.ts:86-105/107-120/173-192/230-245, read-render.ts:152-170 at the
 * pin); the governed row's face stays a plugin-local artifact.
 *
 * @module fs-family/read-presentation
 */
import { READ_ROW_LINE_CAP } from './fs-mechanics.mjs'

const READ_ROW_ENVELOPE = /^<path>[^\n]*<\/path>\n<type>file<\/type>\n<content>\n([\s\S]*)\n<\/content>$/u

/** Mirror of formatReadOutput (read-render.ts:152-170), byte-verbatim
 *  footers: the capped state carries NO "of Z"; partial shows "of T"; EOF
 *  says "End of file - total T lines". */
function formatReadRowOutput(displayPath, outcome) {
  const endLine = outcome.lines.at(-1)?.number ?? Math.max(0, outcome.offset - 1)
  let footer
  if (outcome.truncatedByBytes === true) {
    footer = `(Output capped. Showing lines ${String(outcome.offset)}-${String(endLine)}. Use offset=${String(endLine + 1)} to continue.)`
  } else if (endLine < outcome.totalLines) {
    footer = `(Showing lines ${String(outcome.offset)}-${String(endLine)} of ${String(outcome.totalLines)}. Use offset=${String(endLine + 1)} to continue.)`
  } else {
    footer = `(End of file - total ${String(outcome.totalLines)} lines)`
  }
  const body = outcome.lines.length > 0
    ? `${outcome.lines.map((line) => `${String(line.number)}: ${line.text}`).join('\n')}\n\n${footer}`
    : footer
  return `<path>${displayPath}</path>\n<type>file</type>\n<content>\n${body}\n</content>`
}

/** The render-side effective limit (replay-tolerant mirror of the executor's
 *  E2 law clamped to the cap; NEVER throws on a hostile replay — the refusal
 *  law was the executor's at call time; the face only re-derives display
 *  state). */
function readRowEffectiveLimit(args) {
  const raw = args?.limit
  if (typeof raw === 'number' && Number.isFinite(raw) && Number.isInteger(raw) && raw >= 1 && raw <= READ_ROW_LINE_CAP) return raw
  return READ_ROW_LINE_CAP
}

/** Mirror of readMetaFromMeta (read.ts:230-245): every malformed shape —
 *  non-object, bad scalars, non-increasing or out-of-range line numbers, a
 *  non-string lang — DECLINES to undefined. Never throws. */
function readRowMetaFromMeta(meta) {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined
  const { path, offset, lines, totalLines, lang } = meta
  if (typeof path !== 'string' || typeof offset !== 'number' || typeof totalLines !== 'number') return undefined
  if (!Number.isInteger(offset) || offset < 1) return undefined
  if (!Number.isInteger(totalLines) || totalLines < 0) return undefined
  if (!Array.isArray(lines) || !lines.every((line) => typeof line === 'object' && line !== null && !Array.isArray(line)
    && typeof line.number === 'number' && Number.isInteger(line.number) && line.number >= 1
    && typeof line.text === 'string')) return undefined
  if (lang !== undefined && typeof lang !== 'string') return undefined
  let previous = offset - 1
  for (const { number } of lines) {
    if (number <= previous || number > totalLines) return undefined
    previous = number
  }
  return { path, offset, lines, totalLines, ...(lang === undefined ? {} : { lang }) }
}

export const READ_ROW_PRESENTATION_FACE = Object.freeze({
  schema: Object.freeze({
    type: 'object',
    properties: Object.freeze({
      path: Object.freeze({ type: 'string' }),
      offset: Object.freeze({ type: 'integer' }),
      lines: Object.freeze({
        type: 'array',
        items: Object.freeze({
          type: 'object',
          properties: Object.freeze({
            number: Object.freeze({ type: 'integer' }),
            text: Object.freeze({ type: 'string' }),
          }),
          required: Object.freeze(['number', 'text']),
          additionalProperties: false,
        }),
      }),
      totalLines: Object.freeze({ type: 'integer' }),
    }),
    required: Object.freeze(['path', 'offset', 'lines', 'totalLines']),
    additionalProperties: false,
  }),
  /** Render the four-field window into the pin639 read envelope. The
   *  capped/partial/EOF state is RECOMPUTED here exactly as the host render
   *  does (read.ts:107-120): `truncatedByBytes = lines.length <
   *  effectiveLimit && endLine < totalLines` — the executor's result never
   *  carries the flag (S6), so a stale flag can never lie. */
  render: (args, value) => {
    const lines = Array.isArray(value?.lines) ? value.lines : []
    const offset = typeof value?.offset === 'number' ? value.offset : 1
    const totalLines = typeof value?.totalLines === 'number' ? value.totalLines : 0
    const path = typeof value?.path === 'string' ? value.path : ''
    const effectiveLimit = readRowEffectiveLimit(args)
    const endLine = lines.length > 0 ? Number(lines[lines.length - 1]?.number ?? offset) : Math.max(0, offset - 1)
    const truncatedByBytes = lines.length < effectiveLimit && endLine < totalLines
    return [{
      type: 'text',
      text: formatReadRowOutput(path, {
        offset, lines, totalLines, ...(truncatedByBytes ? { truncatedByBytes: true } : {}),
      }),
    }]
  },
  /** The card meta (read.ts presentationMeta): exactly the four fields —
   *  NO lang (the governed row never sniffs a language; honest elision,
   *  plan S7). */
  presentationMeta: (_args, value) => ({
    path: value.path,
    offset: value.offset,
    lines: value.lines.map(({ number, text }) => ({ number, text })),
    totalLines: value.totalLines,
  }),
})

/** The read row's presentResult (mirror of read.ts:173-192): declines
 *  (undefined) on an error result, a malformed meta, anything but ONE text
 *  content block, or text outside the read envelope — so legacy `{text}`
 *  refusals and foreign replays fall back to the generic card instead of a
 *  lying read card. Never throws. */
export function readRowPresentResult(_args, result) {
  if (result?.isError === true) return undefined
  // PR358-A2: the cancelled read carries NO path/line card — it is not a
  // read result; the generic card renders its honest cancelled line instead
  // of a lying zero-lines read card.
  if (result?.cancelled === true) return undefined
  const meta = readRowMetaFromMeta(result?.meta)
  if (meta === undefined) return undefined
  const only = Array.isArray(result.content) && result.content.length === 1 ? result.content[0] : undefined
  const text = only?.type === 'text' && typeof only.text === 'string' ? only.text : undefined
  if (text === undefined) return undefined
  const body = READ_ROW_ENVELOPE.exec(text)?.[1]
  if (body === undefined) return undefined
  return {
    card: 'read',
    path: meta.path,
    offset: meta.offset,
    lines: meta.lines,
    totalLines: meta.totalLines,
    ...(meta.lang === undefined ? {} : { lang: meta.lang }),
    content: [{ type: 'text', text: body }],
  }
}
