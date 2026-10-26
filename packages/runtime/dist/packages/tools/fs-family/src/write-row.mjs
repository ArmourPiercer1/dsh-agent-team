/**
 * fs-family/src/write-row.mjs — the governed `write` takeover ROW Definition
 * + presentation face (U7-9a). The Family owns the Definition (§4: name,
 * description, parameter schema, execute transport, presentation); the
 * native spelling is the takeover law's requirement (§ CI-04) and the
 * center validated Gate 0b before placing it.
 *
 * Same name, same meaning — and ONE disclosed deviation on the result face:
 * the governed receipt carries {path, operation, byteLength,
 * writtenFingerprint}, NOT the native {path, operation, before, after}.
 * The old bytes never travel back (D-C2-1 no-echo law: a write-class grant
 * covers the WRITE effect; echoing the previous content would disclose a
 * READ the call never declared or paid for). The render keeps the native
 * sentence form so the model-facing contract stays familiar.
 *
 * @module fs-family/write-row
 */

/** The row's presentation face: schema + the native-shape render. No
 *  presentResult card: without the before-bytes there is no honest diff
 *  card to render, and a lying card is worse than the generic one. */
export const WRITE_ROW_PRESENTATION_FACE = Object.freeze({
  schema: Object.freeze({
    type: 'object',
    properties: Object.freeze({
      path: Object.freeze({ type: 'string' }),
      operation: Object.freeze({ type: 'string', enum: Object.freeze(['create', 'update']) }),
      byteLength: Object.freeze({ type: 'integer' }),
      writtenFingerprint: Object.freeze({ type: 'string' }),
    }),
    required: Object.freeze(['path', 'operation', 'byteLength', 'writtenFingerprint']),
    additionalProperties: false,
  }),
  /** Mirror of the pin639 write render envelope (tool-fs/src/write.ts):
   *  `<path>…</path>\n<type>file</type>\n<content>\n{Created|Updated}
   *  file\n</content>` — the governed row adds the measured byte fact
   *  inside the content block (never invented: the executor counted it). */
  render: (_args, value) => {
    const verb = value?.operation === 'create' ? 'Created' : 'Updated'
    const path = typeof value?.path === 'string' ? value.path : ''
    const bytes = typeof value?.byteLength === 'number' ? value.byteLength : 0
    return [{
      type: 'text',
      text: `<path>${path}</path>\n<type>file</type>\n<content>\n${verb} file (${String(bytes)} bytes)\n</content>`,
    }]
  },
  presentationMeta: (_args, value) => ({
    path: value.path,
    operation: value.operation,
    byteLength: value.byteLength,
    writtenFingerprint: value.writtenFingerprint,
  }),
})

/**
 * Build the governed write row Definition for one mount.
 *
 * @param {object} input
 * @param {string} input.writeName - the takeover spelling (the center
 *   validated Gate 0b BEFORE this call; the row is only ever placed by the
 *   trusted assembly).
 * @param {(raw: unknown, corr: object) => Promise<unknown>} input.writeExecutor
 *   - the Kernel-assembled write executor (effect body + injected PA edge).
 */
export function buildWriteRowDefinition({ writeName, writeExecutor }) {
  return Object.freeze({
    name: writeName,
    description: 'Create or fully replace one governed UTF-8 text file inside this member\'s admitted file root. Paths resolve against that root; escaping targets are refused. Overwrites an existing file only when the target is a regular file.',
    parameters: {
      type: 'object',
      // The native spelling law: the frozen operation-permission
      // canonicalizer keys `write` to {file_path, content} (contentHash
      // projection) — the takeover row must satisfy the SAME canonical law
      // the native name carries (canonical-operation.ts `case 'write'`).
      properties: {
        file_path: { type: 'string', description: 'path relative to the governed root, or an absolute path inside it' },
        content: { type: 'string', description: 'the full UTF-8 content to write (empty string clears the file)' },
      },
      required: ['file_path', 'content'],
    },
    // S2 transfer law (same as the read row): SUCCESS returns the receipt
    // object; a CANCELLED invocation is a presented row-form fact; a
    // refusal becomes a THROW of its verbatim refusal text — the same
    // transport contract downstream stays honest on.
    execute: async (raw, exec) => {
      const corr = {
        ...(exec?.token === undefined ? {} : { token: exec.token }),
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
      }
      const outcome = await writeExecutor(raw, corr)
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') {
        return {
          path: outcome.path,
          operation: outcome.operation,
          byteLength: outcome.byteLength,
          writtenFingerprint: outcome.writtenFingerprint,
        }
      }
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
        return { cancelled: true, content: [{ type: 'text', text: 'write · cancelled' }], meta: { cancelled: true } }
      }
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-io executor-unavailable — the governed write executor produced no outcome'
      throw new Error(text)
    },
    output: WRITE_ROW_PRESENTATION_FACE,
  })
}
