/**
 * ui-family/src/ask-row.mjs — the governed `ask_user_question` ROW
 * Definition + presentation face (u7-f). The Family owns the Definition
 * (§4: name, description, parameter schema, execute transport, result
 * SHAPE); it does NOT own the call — `execute` only transports the
 * Kernel-admitted executor's outcome.
 *
 * MOUNT-TIME VARIANT LAW (the host `mode` mirror): exactly ONE of the two
 * host shapes is registered per mount — legacy (index.ts:38-101 @639ed01539,
 * the host DEFAULT) or timed (timed.ts:106-206, registered ONLY under
 * `config.mode: 'timed'`; here, only under the closed boolean plane config
 * `askUserTimed`). The spelling, the description and the renders are the
 * host's; the ONE disclosed hardening is the CLOSED-world parameter schema
 * (the host items wear `additionalProperties: true`; the governed row names
 * exactly the fields its parser accepts — the closedRecordKeys law, and a
 * governed row carries no unknown-field lane for anything to ride).
 *
 * @module ui-family/ask-row
 */
import { ASK_USER_QUESTION_NATIVE_NAME, DEFAULT_ASK_TIMEOUT_SECONDS, TIMED_WAIT_PARAMETER } from './ui-mechanics.mjs'

export const ASK_ROW_DESCRIPTION
  = 'Ask the user a concise question when you need confirmation, a choice, or missing information before proceeding.'

export const ASK_ROW_TIMED_DESCRIPTION
  = 'Ask brief, direct, self-contained questions about missing information, preferences, or decisions. '
  + 'Use user-facing terms; assume no knowledge of background work or internal names. '
  + 'Use distinct stable question IDs. A submitted skipped question is an answer item with empty selected and no custom; '
  + 'pending instead means no answer batch arrived before the timeout and the user can still answer.'

const ANSWER_ITEMS = Object.freeze({
  type: 'array',
  description: 'Submitted answer batch with one item per question. A skipped question has empty selected and no custom; unlike pending, the user has completed the batch.',
  items: Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: Object.freeze({
      id: Object.freeze({ type: 'string', description: 'Stable question id echoed from the request.' }),
      selected: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }), description: 'Selected option labels. Empty with no custom means the user explicitly skipped this question.' }),
      custom: Object.freeze({ type: 'string', description: 'Optional free-form answer; omitted for a skipped question.' }),
    }),
    required: Object.freeze(['id', 'selected']),
  }),
})

const QUESTIONS_PARAMETER = Object.freeze({
  type: 'array',
  description: 'Questions to ask the user before continuing.',
  minItems: 1,
  items: Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: Object.freeze({
      id: Object.freeze({ type: 'string', description: 'Stable id for this question; echoed in the answer.' }),
      question: Object.freeze({ type: 'string', description: 'The specific question to ask the user.' }),
      header: Object.freeze({ type: 'string', description: 'Optional short heading for the question, such as "Confirm" or "Choose Mode".' }),
      options: Object.freeze({
        type: 'array',
        description: 'Optional choices to show the user. If you recommend one, put it first and append "(Recommended)" to that label.',
        items: Object.freeze({
          type: 'object',
          additionalProperties: false,
          properties: Object.freeze({
            label: Object.freeze({ type: 'string', description: 'Short user-facing option label.' }),
            description: Object.freeze({ type: 'string', description: 'One sentence explaining the tradeoff or impact.' }),
          }),
          required: Object.freeze(['label']),
        }),
      }),
      multi_select: Object.freeze({ type: 'boolean', description: 'Whether the user may select more than one option. Defaults to false.' }),
    }),
    required: Object.freeze(['id', 'question']),
  }),
})

/** Host render (index.ts:96 / timed.ts:189), verbatim: the value travels as
 *  one JSON text block. */
const askRowRender = (_args, value) => [{ type: 'text', text: JSON.stringify(value) }]

const ASK_ROW_LEGACY_FACE = Object.freeze({
  schema: Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: Object.freeze({ answers: ANSWER_ITEMS }),
    required: Object.freeze(['answers']),
  }),
  render: askRowRender,
})

const ASK_ROW_TIMED_FACE = Object.freeze({
  schema: Object.freeze({
    oneOf: Object.freeze([
      Object.freeze({
        type: 'object',
        additionalProperties: false,
        properties: Object.freeze({
          pending: Object.freeze({
            type: 'boolean', enum: Object.freeze([true]),
            description: 'True when the foreground wait expired before the user submitted an answer batch. The questions remain answerable; this is not a skipped answer.',
          }),
          callId: Object.freeze({ type: 'string', description: 'Tool call whose unanswered questions remain pending.' }),
          message: Object.freeze({ type: 'string', description: 'How to continue while the questions stay answerable.' }),
        }),
        required: Object.freeze(['pending', 'callId', 'message']),
      }),
      Object.freeze({
        type: 'object',
        additionalProperties: false,
        properties: Object.freeze({ answers: ANSWER_ITEMS }),
        required: Object.freeze(['answers']),
      }),
    ]),
  }),
  render: askRowRender,
})

/**
 * Build the governed ask row Definition for one mount.
 *
 * @param {object} input
 * @param {(raw: unknown, corr: object) => Promise<unknown>} input.askExecutor
 *   - the Kernel-assembled ask executor (effect body + injected PA edge +
 *   injected interaction port).
 * @param {boolean} [input.timed] - the mount-time variant selection (the
 *   host mode mirror; the executor is built with the SAME flag — the row
 *   schema and the parser law never disagree).
 */
export function buildAskRowDefinition({ askExecutor, timed = false }) {
  return Object.freeze({
    name: ASK_USER_QUESTION_NATIVE_NAME,
    description: timed ? ASK_ROW_TIMED_DESCRIPTION : ASK_ROW_DESCRIPTION,
    parameters: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({
        questions: QUESTIONS_PARAMETER,
        ...(timed ? {
          [TIMED_WAIT_PARAMETER]: Object.freeze({
            type: 'integer',
            description: `Wait seconds for the entire batch (default ${String(DEFAULT_ASK_TIMEOUT_SECONDS)}); omit unless the user specifies a duration. Use -1 only when an answer is required before proceeding.`,
          }),
        } : {}),
      }),
      required: Object.freeze(['questions']),
    }),
    output: timed ? ASK_ROW_TIMED_FACE : ASK_ROW_LEGACY_FACE,
    /** The execute transport (the read row's law): ok → the host-shaped
     *  value; cancelled → the presented row-form fact; refusal → the stable
     *  typed text thrown as the host row throws (never a stack, never a
     *  silent fallback). */
    execute: async (raw, exec) => {
      const corr = {
        token: exec?.token,
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal !== undefined ? { signal: exec.signal } : {}),
        // The DISPATCH-provided caller identity (native callingAgent law, the
        // spawn-row.mjs:41-43 pattern): trusted transport data — the model
        // cannot express or restate it. A nullish carrier is NOT carried: the
        // adapter's documented no-agent arm stands (ui-interaction-port.mjs
        // :73-79) and the Host service answers its OWN typed refusal verbatim
        // — this row never turns a carrier-less call into a new unscoped
        // delivery, and the refusal stays the same typed UI_INTERACTION_PORT_
        // FAILED the row answers today.
        ...(exec?.agent === null || exec?.agent === undefined ? {} : { agent: exec.agent }),
      }
      const outcome = await askExecutor(raw, corr)
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') return outcome.value
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
        return { cancelled: true, content: [{ type: 'text', text: `${ASK_USER_QUESTION_NATIVE_NAME} · cancelled` }], meta: { cancelled: true } }
      }
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-io executor-unavailable — the governed ask executor produced no outcome'
      throw new Error(text)
    },
  })
}
