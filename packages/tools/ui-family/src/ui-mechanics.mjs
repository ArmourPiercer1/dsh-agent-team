/**
 * ui-family/src/ui-mechanics.mjs — the UI family's pure argument contract
 * and the two law constants its rows carry (u7-f: governed
 * `ask_user_question` + `present` on the FamilyAssembly seam).
 *
 * OWNER ROLE (family lane, center-assembly-architecture §4 Definition &
 * Arguments boundary): this file is PURE — no authority, no I/O, no clock.
 * It owns (a) the closed parameter contract of both rows, (b) the timed
 * variant's timeout law, and (c) the ONE home of the family's identity
 * constants: the native spellings, the two Domain Authority ids the rows
 * REQUEST (and the contribution DECLARES — one name, two faces, pinned
 * equal by C1, the attachment-store precedent), and the host-mirror law
 * values (the default foreground wait, the timed parameter spelling, the
 * pending notice text) so a drift in any of them is visible in one diff.
 *
 * HOST FIDELITY (the same-name same-meaning claim law): the host registers
 * `ask_user_question` in TWO shapes selected at MOUNT time by the plugin
 * config `mode` (@deepseek-ai/dsh-tool-ask-user index.ts:32-36 @639ed01539:
 * legacy default, timed only under `mode: 'timed'`); the governed family
 * mirrors the selection with the closed boolean `askUserTimed` on the plane
 * config (absent = legacy — the host default — and a non-boolean value is
 * the seam's PLANE_CONFIG_INCOMPLETE refusal, never a silent default). The
 * timed variant is the host's timed.ts shape: the SAME question fields plus
 * the `timeout` parameter (TIMED_WAIT_PARAMETER, host projection.ts:36),
 * the question-id uniqueness law (validateQuestionIds), the
 * -1-or-positive-integer timeout law (validateTimeout), and the pending
 * result law: an expired foreground wait answers the TYPED pending outcome
 * — `{pending: true, callId, message}` with the host's pendingNotice text —
 * NEVER a fabricated answer batch. `present` mirrors the host
 * tool-present@639ed01539 shape: 1..maxFiles closed `{path, description?}`
 * items and the `Presented <path>` render.
 *
 * @module ui-family/ui-mechanics
 */

/** The two rows mount at FIXED native spellings (the fs-mutation/jobs
 *  precedent: never the renamable `names` map — the same-name same-meaning
 *  claim is recorded in the descriptor and the contribution). */
export const ASK_USER_QUESTION_NATIVE_NAME = 'ask_user_question'
export const PRESENT_NATIVE_NAME = 'present'

/** The Domain Authority ids the rows REQUEST as `domain-ref` effects and the
 *  contribution DECLARES as targets (one home, two faces — the U7-9a R1
 *  declared-effect law: no governed call may carry an effect whose identity
 *  lives somewhere other than the requested, fingerprinted set). */
export const USER_INTERACTION_DOMAIN_AUTHORITY = 'user-interaction'
export const UI_PRESENTATION_DOMAIN_AUTHORITY = 'ui-presentation'

/** The target of the `present` row's per-file read effects — the SAME realm
 *  the fs family's reads live and die inside (the governed anchor root). */
export const REALM_FILE_ROOT_TARGET = 'realm-file-root'

/** Host mirror: timed.ts default foreground wait (seconds) — Config default
 *  120 at index.ts:27; -1 waits forever (the host's keyed-`wait` form). */
export const DEFAULT_ASK_TIMEOUT_SECONDS = 120
/** Host mirror: validateTimeout's bound (timed.ts:15). */
export const MAX_ASK_TIMEOUT_SECONDS = 2_147_483
/** Host mirror: the timed parameter's spelling (TIMED_WAIT_PARAMETER,
 *  host user-questions projection.ts:36 — the projection tells a timed call
 *  from a legacy one by THIS parameter's presence, so the name is law). */
export const TIMED_WAIT_PARAMETER = 'timeout'
/** Host mirror: tool-present Config maxFiles default (index.ts:23, 8). */
export const MAX_PRESENT_FILES = 8

/**
 * Host mirror, verbatim (timed.ts:38-43): the instruction the pending result
 * carries in its `message` field. The text is a FIELD of the result (the
 * `userQuestions` projection and the Client question row both read it) —
 * the governed row reproduces it byte-identically, never a paraphrase.
 */
export const PENDING_NOTICE
  = 'No answer batch arrived before the timeout. This is pending, not a skipped answer. '
  + 'Continue useful independent work. The user can still answer; their reply will be a user message '
  + 'identified as answer_to_pending_question with this callId and the original questions. '
  + 'Do not treat this as permission.'

/** The legacy row's accepted top-level keys and the timed row's (the host's
 *  timed schema adds ONLY the timeout parameter). */
const ASK_KEYS_LEGACY = Object.freeze(['questions'])
const ASK_KEYS_TIMED = Object.freeze(['questions', TIMED_WAIT_PARAMETER])
const QUESTION_KEYS = Object.freeze(['id', 'question', 'header', 'options', 'multi_select'])
const OPTION_KEYS = Object.freeze(['label', 'description'])
const PRESENT_KEYS = Object.freeze(['files'])
const PRESENT_ITEM_KEYS = Object.freeze(['path', 'description'])

const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

const refusal = (code, detail) => ({ ok: false, code, detail })

/**
 * Host mirror (timed.ts:13-18): `-1` (wait forever) or a positive integer
 * seconds up to 2147483 — anything else is the typed refusal (the host
 * throws; the governed row refuses with the SAME bound and zero effect).
 */
export function validateAskTimeout(timeout) {
  if (timeout === -1) return { ok: true }
  if (typeof timeout !== 'number' || !Number.isInteger(timeout) || timeout < 1 || timeout > MAX_ASK_TIMEOUT_SECONDS) {
    return refusal('ask-timeout-invalid', `timeout must be -1 or a positive integer up to ${String(MAX_ASK_TIMEOUT_SECONDS)} seconds`)
  }
  return { ok: true }
}

function parseOptions(options, path) {
  if (!Array.isArray(options)) return refusal('ask-options-malformed', `${path}.options must be an array of choices`)
  const out = []
  for (const [i, option] of options.entries()) {
    if (!isRecord(option)) return refusal('ask-options-malformed', `${path}.options[${String(i)}] must be an object`)
    const unknown = Object.keys(option).filter((k) => !OPTION_KEYS.includes(k))
    if (unknown.length > 0) {
      return refusal('ask-unknown-parameter', `${path}.options[${String(i)}] carries unknown parameter(s) ${unknown.join(', ')} (accepted: ${OPTION_KEYS.join(', ')}) — the governed row has no escalation lane`)
    }
    if (typeof option.label !== 'string' || option.label.length === 0) {
      return refusal('ask-options-malformed', `${path}.options[${String(i)}].label must be a non-empty string`)
    }
    if (option.description !== undefined && typeof option.description !== 'string') {
      return refusal('ask-options-malformed', `${path}.options[${String(i)}].description must be a string`)
    }
    out.push(option.description === undefined ? { label: option.label } : { label: option.label, description: option.description })
  }
  return { ok: true, value: out }
}

function parseQuestion(question, i) {
  const path = `questions[${String(i)}]`
  if (!isRecord(question)) return refusal('ask-question-malformed', `${path} must be an object`)
  const unknown = Object.keys(question).filter((k) => !QUESTION_KEYS.includes(k))
  if (unknown.length > 0) {
    return refusal('ask-unknown-parameter', `${path} carries unknown parameter(s) ${unknown.join(', ')} (accepted: ${QUESTION_KEYS.join(', ')}) — the governed row has no escalation lane`)
  }
  if (typeof question.id !== 'string' || question.id.length === 0) {
    return refusal('ask-question-malformed', `${path}.id must be a non-empty string (the stable id echoed in the answer)`)
  }
  if (typeof question.question !== 'string' || question.question.length === 0) {
    return refusal('ask-question-malformed', `${path}.question must be a non-empty string`)
  }
  if (question.header !== undefined && typeof question.header !== 'string') {
    return refusal('ask-question-malformed', `${path}.header must be a string`)
  }
  if (question.multi_select !== undefined && typeof question.multi_select !== 'boolean') {
    return refusal('ask-question-malformed', `${path}.multi_select must be a boolean`)
  }
  if (question.options === undefined) return { ok: true, value: question }
  const options = parseOptions(question.options, path)
  if (options.ok !== true) return options
  return { ok: true, value: { ...question, options: options.value } }
}

/**
 * The closed `ask_user_question` argument contract.
 *
 * @param {unknown} raw - the model-supplied arguments (never trusted).
 * @param {{ timed?: boolean }} [variant] - `timed: true` parses the TIMED
 *   variant's shape: the extra `timeout` parameter, its validated bound, and
 *   the question-id uniqueness law (host timed.ts validateQuestionIds — the
 *   legacy host row does NOT enforce uniqueness and this mirror does not
 *   invent it).
 * @returns {{ok: true, value: object} | {ok: false, code: string, detail: string}}
 */
export function parseAskArgs(raw, { timed = false } = {}) {
  if (!isRecord(raw)) return refusal('ask-arguments-malformed', 'ask_user_question arguments must be an object')
  const allowed = timed ? ASK_KEYS_TIMED : ASK_KEYS_LEGACY
  const unknown = Object.keys(raw).filter((k) => !allowed.includes(k))
  if (unknown.length > 0) {
    return refusal('ask-unknown-parameter', `arguments carry unknown parameter(s) ${unknown.join(', ')} (accepted: ${allowed.join(', ')}) — the governed row has no escalation lane${timed ? '' : `; '${TIMED_WAIT_PARAMETER}' is a timed-variant parameter and this mount registered the legacy variant`}`)
  }
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    return refusal('ask-questions-required', 'ask_user_question requires a non-empty questions array')
  }
  const questions = []
  for (const [i, question] of raw.questions.entries()) {
    const parsed = parseQuestion(question, i)
    if (parsed.ok !== true) return parsed
    questions.push(parsed.value)
  }
  const value = { questions }
  if (timed) {
    if (raw[TIMED_WAIT_PARAMETER] !== undefined) {
      const timeout = validateAskTimeout(raw[TIMED_WAIT_PARAMETER])
      if (timeout.ok !== true) return timeout
      value.timeout = raw[TIMED_WAIT_PARAMETER]
    }
    // Host law (timed.ts validateQuestionIds): ids unique WITHIN the call.
    const ids = new Set()
    for (const question of questions) {
      if (ids.has(question.id)) {
        return refusal('ask-duplicate-question-id', `question id ${JSON.stringify(question.id)} must be unique within this call`)
      }
      ids.add(question.id)
    }
  }
  return { ok: true, value }
}

/**
 * The closed `present` argument contract (host tool-present@639ed01539):
 * 1..maxFiles items, each a closed `{path, description?}` record with a
 * non-empty path.
 */
export function parsePresentArgs(raw, { maxFiles = MAX_PRESENT_FILES } = {}) {
  if (!isRecord(raw)) return refusal('present-arguments-malformed', 'present arguments must be an object')
  const unknown = Object.keys(raw).filter((k) => !PRESENT_KEYS.includes(k))
  if (unknown.length > 0) {
    return refusal('present-unknown-parameter', `arguments carry unknown parameter(s) ${unknown.join(', ')} (accepted: ${PRESENT_KEYS.join(', ')}) — the governed row has no escalation lane`)
  }
  if (!Array.isArray(raw.files) || raw.files.length === 0) {
    return refusal('present-files-required', 'present requires a non-empty files array')
  }
  if (raw.files.length > maxFiles) {
    return refusal('present-files-limit', `present accepts 1 to ${String(maxFiles)} files`)
  }
  const files = []
  for (const [i, file] of raw.files.entries()) {
    const path = `files[${String(i)}]`
    if (!isRecord(file)) return refusal('present-files-malformed', `${path} must be an object`)
    const unknownItem = Object.keys(file).filter((k) => !PRESENT_ITEM_KEYS.includes(k))
    if (unknownItem.length > 0) {
      return refusal('present-unknown-parameter', `${path} carries unknown parameter(s) ${unknownItem.join(', ')} (accepted: ${PRESENT_ITEM_KEYS.join(', ')})`)
    }
    if (typeof file.path !== 'string' || file.path.trim().length === 0) {
      return refusal('present-files-malformed', `${path}.path must be a non-empty file path`)
    }
    if (file.description !== undefined && typeof file.description !== 'string') {
      return refusal('present-files-malformed', `${path}.description must be a string`)
    }
    files.push(file.description === undefined ? { path: file.path } : { path: file.path, description: file.description })
  }
  return { ok: true, value: { files } }
}

/**
 * The model→service question translation the host performs at its own seam
 * (index.ts/timed.ts questionRequest): `multi_select` rides as `multiSelect`,
 * the optional fields are only present when supplied. The family speaks the
 * SERVICE shape on the port; the model shape never crosses it.
 */
export function toServiceQuestions(questions) {
  return questions.map((question) => ({
    id: question.id,
    question: question.question,
    ...(question.header !== undefined ? { header: question.header } : {}),
    ...(question.options !== undefined ? { options: question.options.map((option) => ({ ...option })) } : {}),
    ...(question.multi_select !== undefined ? { multiSelect: question.multi_select } : {}),
  }))
}

/**
 * The service→model answer copy (host timed.ts answerResult): the service
 * owns its arrays; the model-facing payload is a detached copy that only
 * ever carries what the service actually answered (`custom` absent when the
 * service answered none — a skipped answer keeps empty selected and NO
 * custom, never an invented one).
 */
export function toModelAnswers(result) {
  const answers = Array.isArray(result?.answers) ? result.answers : []
  return {
    answers: answers.map((answer) => ({
      id: String(answer?.id ?? ''),
      selected: Array.isArray(answer?.selected) ? [...answer.selected] : [],
      ...(answer?.custom !== undefined ? { custom: String(answer.custom) } : {}),
    })),
  }
}
