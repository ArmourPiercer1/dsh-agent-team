/**
 * fs-family/src/read-row.mjs — the governed `read` takeover ROW Definition
 * (U6 PR2; U6-SLICE-PLAN PR2: "read-row def `team-tool-plane.mjs`:1723-1783,
 * 1829, 1870-1884 into the contribution"). Moved VERBATIM from the center
 * file at master 2db321f63; the plane now PLACES this Family-provided
 * definition instead of composing it inline.
 *
 * OWNER ROLE (family lane, §4 Definition & Arguments boundary): the Family
 * owns the Definition — name, description, parameter schema, the execute
 * transport, and the presentation face. It does NOT own the call: `execute`
 * here is a thin transport over the INJECTED `readExecutor` (the effect body
 * with the Kernel-injected PA edge inside). The native spelling is the
 * takeover law's requirement (§ CI-04: dispatch resolves THIS placement and
 * the binding feed hands the Guard the placement identity — a row placed
 * under a different name is not the governed read).
 *
 * @module fs-family/read-row
 */
import { READ_ROW_LINE_CAP } from './fs-mechanics.mjs'
import { READ_ROW_PRESENTATION_FACE, readRowPresentResult } from './read-presentation.mjs'

/**
 * Build the governed read row Definition for one mount.
 *
 * @param {object} input
 * @param {string} input.readName - the takeover spelling (validated by the
 *   Kernel at Gate 0b BEFORE this call; the Family trusts the assembly's
 *   validation exactly as the center file did — the row is only ever placed
 *   by the trusted assembly).
 * @param {(raw: unknown, corr: object) => Promise<unknown>} input.readExecutor
 *   - the Kernel-assembled read executor (effect body + injected PA edge).
 * @returns the row Definition object (placed verbatim by the plane).
 */
export function buildReadRowDefinition({ readName, readExecutor }) {
  return Object.freeze({
    name: readName,
    description: 'Read one governed text file inside this member\'s admitted file root. Paths resolve against that root; escaping targets are refused.',
    parameters: {
      type: 'object',
      // The native spelling, on purpose: the frozen operation-permission
      // canonicalizer keys `read` to its `file_path` extractor (live run-8
      // measured 'canonicalization failed for tool "read":
      // file-path-missing' on a {path} schema — the takeover row must
      // satisfy the same canonical law the native name carries).
      // offset/limit ride the SAME canonical projection
      // (canonical-operation.ts:674-675) and are now truly CONSUMED by the
      // executor (plan T2/E2); descriptions mirror the pin639 read schema.
      properties: {
        file_path: { type: 'string', description: 'path relative to the governed root, or an absolute path inside it' },
        offset: { type: 'number', description: 'The line number to start reading from. Only provide if the file is too large to read at once.' },
        limit: { type: 'number', description: `The number of lines to read. Only provide if the file is too large to read at once. Defaults to ${String(READ_ROW_LINE_CAP)}.` },
      },
      required: ['file_path'],
    },
    // S2 transfer law: SUCCESS hands the native four-field window through
    // untouched; a refusal (the executor's tagged union object) becomes a
    // THROW of its verbatim refusal text — the same transport the host
    // read row uses, so the envelope/decline contract downstream stays
    // honest. The trio rows keep their `{ text }` face unchanged.
    execute: async (raw, exec) => {
      // fix-2b: read RECEIVES the host exec. 9e fix-1: the REAL token
      // rides (object | symbol, exactly like the shell row) — the plane
      // NEVER stringifies it (`String(symbol)` throws; stringify was the
      // A1 violation). The correlation is the a5p5 LEDGER's allocated
      // string (`exec.tokenKey`), the same identity the trio rows carry.
      const corr = {
        ...(exec?.token === undefined ? {} : { token: exec.token }),
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
      }
      const outcome = await readExecutor(raw, corr)
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') {
        return { path: outcome.path, offset: outcome.offset, lines: outcome.lines, totalLines: outcome.totalLines }
      }
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
        // PR358-A2: the cancelled read is a PRESENTED row-form fact, not
        // a refusal — zero byte read, honest word carried (mirrors the
        // shell row's own `· cancelled` law; no resolver ever ran).
        return { cancelled: true, content: [{ type: 'text', text: 'read · cancelled' }], meta: { cancelled: true } }
      }
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-io executor-unavailable — the governed read executor produced no outcome'
      throw new Error(text)
    },
    output: READ_ROW_PRESENTATION_FACE,
    presentResult: readRowPresentResult,
  })
}
