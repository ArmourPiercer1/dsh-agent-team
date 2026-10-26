/**
 * fs-family/src/edit-row.mjs — the governed `edit` takeover ROW Definition
 * + presentation face (U7-9a). Same law as the write row (the Family owns
 * the Definition; the native spelling is the takeover law § CI-04).
 *
 * Same name, same meaning: the governed receipt carries the native result
 * fields {path, before, after} — the edit's PAIRED read effect (M-02) is
 * what makes the echo lawful — and the render keeps the pin639 sentence
 * verbatim, including the replace_all variant.
 *
 * @module fs-family/edit-row
 */

/** The row's presentation face: schema + the pin639 sentence mirror. */
export const EDIT_ROW_PRESENTATION_FACE = Object.freeze({
  schema: Object.freeze({
    type: 'object',
    properties: Object.freeze({
      path: Object.freeze({ type: 'string' }),
      before: Object.freeze({ type: 'string' }),
      after: Object.freeze({ type: 'string' }),
      replaceAll: Object.freeze({ type: 'boolean' }),
    }),
    required: Object.freeze(['path', 'before', 'after', 'replaceAll']),
    additionalProperties: false,
  }),
  /** Mirror of formatEditOutput (tool-fs/src/edit.ts @639ed01539), sentence
   *  verbatim: "The file {path} has been updated successfully." /
   *  "The file {path} has been updated. All occurrences were successfully
   *  replaced." */
  render: (_args, value) => {
    const path = typeof value?.path === 'string' ? value.path : ''
    const text = value?.replaceAll === true
      ? `The file ${path} has been updated. All occurrences were successfully replaced.`
      : `The file ${path} has been updated successfully.`
    return [{ type: 'text', text }]
  },
  presentationMeta: (_args, value) => ({
    path: value.path,
    oldText: value.before,
    newText: value.after,
    replaceAll: value.replaceAll,
  }),
})

/**
 * Build the governed edit row Definition for one mount.
 *
 * @param {object} input
 * @param {string} input.editName - the takeover spelling (Gate 0b-validated
 *   by the center BEFORE this call).
 * @param {(raw: unknown, corr: object) => Promise<unknown>} input.editExecutor
 *   - the Kernel-assembled edit executor (effect body + injected PA edge).
 */
export function buildEditRowDefinition({ editName, editExecutor }) {
  return Object.freeze({
    name: editName,
    description: 'Perform exact string replacements in one governed file inside this member\'s admitted file root. Paths resolve against that root; escaping targets are refused. old_string must appear verbatim (and uniquely unless replace_all is true); the edit never creates a file.',
    parameters: {
      type: 'object',
      // The native spelling law: the frozen canonicalizer keys `edit` to
      // {file_path, old_string, new_string, replace_all} (old/new hash
      // projection, canonical-operation.ts `case 'edit'`) — the takeover
      // row carries the SAME parameter contract.
      properties: {
        file_path: { type: 'string', description: 'path relative to the governed root, or an absolute path inside it' },
        old_string: { type: 'string', description: 'the exact text to replace (non-empty, must appear verbatim)' },
        new_string: { type: 'string', description: 'the replacement text (empty string deletes)' },
        replace_all: { type: 'boolean', description: 'replace every occurrence instead of requiring a unique match (default false)' },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
    // S2 transfer law (same as the read/write rows): SUCCESS returns the
    // receipt; CANCELLED is a presented row-form fact; a refusal throws its
    // verbatim text (including the honest `sideEffectPossible` refusals —
    // the message itself carries the "bytes may have landed" truth).
    execute: async (raw, exec) => {
      const corr = {
        ...(exec?.token === undefined ? {} : { token: exec.token }),
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
      }
      const outcome = await editExecutor(raw, corr)
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') {
        return { path: outcome.path, before: outcome.before, after: outcome.after, replaceAll: outcome.replaceAll }
      }
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
        return { cancelled: true, content: [{ type: 'text', text: 'edit · cancelled' }], meta: { cancelled: true } }
      }
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-io executor-unavailable — the governed edit executor produced no outcome'
      throw new Error(text)
    },
    output: EDIT_ROW_PRESENTATION_FACE,
  })
}
