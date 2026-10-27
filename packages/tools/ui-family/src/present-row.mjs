/**
 * ui-family/src/present-row.mjs — the governed `present` ROW Definition +
 * presentation face (u7-f). Same-name same-meaning (host
 * tool-present@639ed01539): the description, the `files` argument and the
 * `Presented <path>` render are the host's.
 *
 * TWO DISCLOSED GOVERNED DEVIATIONS on the result face, both recorded on
 * the PR body:
 *  - `turn` is OPTIONAL: the host keys deliverables to the OPEN turn it
 *    reads from its session projections; the governed plane carries no
 *    session face, so `turn` rides ONLY when the injected presentation
 *    port reports it. A row may not invent a turn number.
 *  - paths are the GOVERNED anchored absolute paths (the host resolves
 *    against the session cwd; the governed row resolves against the
 *    member's admitted root and reports what was actually verified).
 *
 * @module ui-family/present-row
 */
import { MAX_PRESENT_FILES, PRESENT_NATIVE_NAME } from './ui-mechanics.mjs'

export const PRESENT_ROW_DESCRIPTION = 'Declare existing files as final deliverables for the user. '
  + 'Use it when the user needs a separate file, especially Office documents, spreadsheets, and slide decks; '
  + 'prefer your final response when that suffices. The user opens the current files; their contents are not copied.'

export const PRESENT_ROW_PRESENTATION_FACE = Object.freeze({
  schema: Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: Object.freeze({
      turn: Object.freeze({ type: 'integer' }),
      files: Object.freeze({
        type: 'array',
        items: Object.freeze({
          type: 'object',
          additionalProperties: false,
          properties: Object.freeze({
            path: Object.freeze({ type: 'string' }),
            description: Object.freeze({ type: 'string' }),
          }),
          required: Object.freeze(['path']),
        }),
      }),
    }),
    required: Object.freeze(['files']),
  }),
  /** Host render (tool-present index.ts:74), verbatim. */
  render: (_args, value) => [{ type: 'text', text: (Array.isArray(value?.files) ? value.files : []).map((file) => `Presented ${String(file?.path ?? '')}`).join('\n') }],
})

/**
 * Build the governed present row Definition for one mount.
 *
 * @param {object} input
 * @param {(raw: unknown, corr: object) => Promise<unknown>} input.presentExecutor
 *   - the Kernel-assembled present executor (anchor law + injected PA edge
 *   + injected presentation face).
 */
export function buildPresentRowDefinition({ presentExecutor }) {
  return Object.freeze({
    name: PRESENT_NATIVE_NAME,
    description: PRESENT_ROW_DESCRIPTION,
    parameters: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({
        files: Object.freeze({
          type: 'array',
          // The host law: 4 is the recommended per-call count; the
          // enforced ceiling (MAX_PRESENT_FILES) is above it.
          description: 'Usually the 1-2 most important deliverables; at most 4 per call.',
          minItems: 1,
          maxItems: MAX_PRESENT_FILES,
          items: Object.freeze({
            type: 'object',
            additionalProperties: false,
            properties: Object.freeze({
              path: Object.freeze({ type: 'string', description: 'Path of an existing regular file. Relative paths resolve against this member\'s admitted file root.' }),
              description: Object.freeze({ type: 'string', description: 'Brief description for the user.' }),
            }),
            required: Object.freeze(['path']),
          }),
        }),
      }),
      required: Object.freeze(['files']),
    }),
    output: PRESENT_ROW_PRESENTATION_FACE,
    execute: async (raw, exec) => {
      const corr = {
        token: exec?.token,
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal !== undefined ? { signal: exec.signal } : {}),
      }
      const outcome = await presentExecutor(raw, corr)
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') return outcome.value
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
        return { cancelled: true, content: [{ type: 'text', text: `${PRESENT_NATIVE_NAME} · cancelled` }], meta: { cancelled: true } }
      }
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-io executor-unavailable — the governed present executor produced no outcome'
      throw new Error(text)
    },
  })
}
