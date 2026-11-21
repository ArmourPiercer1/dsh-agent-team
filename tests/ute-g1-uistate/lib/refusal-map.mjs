/**
 * refusal-map.mjs — the UI / AGENT-STATE lane's refusal vocabulary.
 *
 * The nine refusal CATEGORIES are the owner's closed vocabulary and are
 * IMPORTED, never forked: `tests/ute-g1-fs/lib/refusal-categories.mjs` is the
 * one definition site (`CATEGORY_IDS`, `REFUSAL_CATEGORIES`,
 * `RefusalVocabularyError`). What this module adds is the family-local,
 * TOTAL-OR-LOUD map from the codes THESE two families actually emit onto those
 * categories — the fs map covers the FS surface only, and reusing it here
 * would silently absorb an unclassified ui/agent-state refusal (the failure
 * mode the shared module exists to prevent).
 *
 * The map is CLOSED:
 *   - every entry names a code observed in `golden/old-path.tsv` and cites
 *     where that code is produced;
 *   - a code with NO entry raises `REFUSAL_VOCABULARY_INCOMPLETE` — there is
 *     deliberately no default bucket and no prose fallback;
 *   - `unknown` is a DECLARED value, reachable only through an explicit entry
 *     (this corpus declares none: every observed code is determined).
 *
 * Codes that the corpus does NOT observe have no entry on purpose. Inventing a
 * category for a refusal the two families never produced would be a guess
 * presented as a measurement; the first real occurrence must be a loud failure
 * that forces a deliberate mapping.
 *
 * @module tests/ute-g1-uistate/lib/refusal-map
 */
import {
  CATEGORY_IDS,
  NO_REFUSAL_VALUES,
  REFUSAL_CATEGORIES,
  RefusalVocabularyError,
} from '../../ute-g1-fs/lib/refusal-categories.mjs'

export { CATEGORY_IDS, REFUSAL_CATEGORIES, RefusalVocabularyError }

const ASK_SRC = 'packages/tools/ui-family/src/ask-executor.mjs + src/ui-mechanics.mjs'
const PRESENT_SRC = 'packages/tools/ui-family/src/present-executor.mjs'
const STATE_SRC = 'packages/tools/agent-state-family/src/executors.mjs + src/agent-state-law.mjs'
const STORE_SRC = 'packages/tools/agent-state-family/src/fs-state-store.mjs'
const PLANE_SRC = 'packages/runtime/src/plugin/live/team-tool-plane.mjs (the real lane verdict codes)'

/**
 * The family-local map. `kind: 'code'` matches the token the governed body
 * emits (UI: `refused-<class> <CODE> — …`; agent-state: `refused: <CODE> — …`).
 */
export const UI_STATE_REFUSAL_MAP = Object.freeze([
  // ── UI / ask_user_question ───────────────────────────────────────────────
  { kind: 'code', match: 'ask-arguments-malformed', category: 'invalid-argument', sample: 'ask-arguments-malformed', source: `${ASK_SRC} (parseAskArgs: not an object / unknown shape)` },
  { kind: 'code', match: 'ask-unknown-parameter', category: 'invalid-argument', sample: 'ask-unknown-parameter', source: `${ASK_SRC} (closed parameter contract)` },
  { kind: 'code', match: 'ask-questions-required', category: 'invalid-argument', sample: 'ask-questions-required', source: `${ASK_SRC} (zero questions)` },
  { kind: 'code', match: 'ask-duplicate-question-id', category: 'invalid-argument', sample: 'ask-duplicate-question-id', source: `${ASK_SRC} (id uniqueness law)` },
  { kind: 'code', match: 'ask-timeout-invalid', category: 'invalid-argument', sample: 'ask-timeout-invalid', source: `${ASK_SRC} (ui-mechanics.mjs:97 — -1 or 1..2147483)` },
  { kind: 'code', match: 'UI_INTERACTION_PORT_ABSENT', category: 'unsupported-mode', sample: 'UI_INTERACTION_PORT_ABSENT', source: `${ASK_SRC} (no injected port face: the capability is not deployed on this mount)` },
  { kind: 'code', match: 'UI_INTERACTION_PORT_MALFORMED', category: 'unsupported-mode', sample: 'UI_INTERACTION_PORT_MALFORMED', source: `${ASK_SRC} (the port answered neither a batch nor the pending outcome — a deployment face that cannot serve its contract)` },
  { kind: 'code', match: 'UI_INTERACTION_PORT_FAILED', category: 'route-unresolved', sample: 'UI_INTERACTION_PORT_FAILED', source: `${ASK_SRC} (the service refused before any question reached a human: no live caller / delegated caller)` },
  { kind: 'code', match: 'PA_EDGE_UNAVAILABLE', category: 'unsupported-mode', sample: 'PA_EDGE_UNAVAILABLE', source: `${ASK_SRC} (the mount carries no admission edge)` },

  // ── UI / present ─────────────────────────────────────────────────────────
  { kind: 'code', match: 'present-arguments-malformed', category: 'invalid-argument', sample: 'present-arguments-malformed', source: `${PRESENT_SRC} (parsePresentArgs shape)` },
  { kind: 'code', match: 'present-unknown-parameter', category: 'invalid-argument', sample: 'present-unknown-parameter', source: `${PRESENT_SRC} (closed parameter contract)` },
  { kind: 'code', match: 'present-files-required', category: 'invalid-argument', sample: 'present-files-required', source: `${PRESENT_SRC} (zero files)` },
  { kind: 'code', match: 'present-files-limit', category: 'invalid-argument', sample: 'present-files-limit', source: `${PRESENT_SRC} (ui-mechanics.mjs:63 MAX_PRESENT_FILES=8)` },
  { kind: 'code', match: 'present-files-malformed', category: 'invalid-argument', sample: 'present-files-malformed', source: `${PRESENT_SRC} (a file entry with no path / unknown key)` },
  { kind: 'code', match: 'locator-rejected', category: 'denied-by-lane', sample: 'locator-rejected', source: `${PRESENT_SRC} + packages/tools/fs-family/src/fs-mechanics.mjs:175 lexicalAnchor (outside the governed root / non-lexical locator)` },
  { kind: 'code', match: 'FILE_NOT_FOUND', category: 'missing-path', sample: 'FILE_NOT_FOUND', source: `${PRESENT_SRC} (the anchored target does not exist)` },
  { kind: 'code', match: 'NOT_A_FILE', category: 'invalid-argument', sample: 'NOT_A_FILE', source: `${PRESENT_SRC} (the anchored target is not a regular file)` },
  { kind: 'code', match: 'FILE_TOO_LARGE', category: 'unsupported-mode', sample: 'FILE_TOO_LARGE', source: `${PRESENT_SRC} (MAX_READ_BYTES=1MiB presentation cap — a deployment cap refuses rather than widening)` },
  { kind: 'code', match: 'UI_PRESENT_RECEIPT_INVALID', category: 'unsupported-mode', sample: 'UI_PRESENT_RECEIPT_INVALID', source: `${PRESENT_SRC} (the presentation face reported success without the host-required integer receipt turn: tool-present/src/index.ts:61, :79)` },
  { kind: 'code', match: 'UI_PRESENT_PORT_FAILED', category: 'route-unresolved', sample: 'UI_PRESENT_PORT_FAILED', source: `${PRESENT_SRC} (the presentation face refused the publication before any receipt)` },
  { kind: 'code', match: 'UI_GOVERNED_ROOT_ABSENT', category: 'unsupported-mode', sample: 'UI_GOVERNED_ROOT_ABSENT', source: `${PRESENT_SRC} (the mount carries no governed file root)` },
  { kind: 'code', match: 'template-default-deny', category: 'denied-by-lane', sample: 'template-default-deny', source: `${ASK_SRC} + ${PRESENT_SRC} (policy.default === 'deny'; the closed rule grammar names no interaction rule)` },
  { kind: 'code', match: 'template-deny-lane', category: 'denied-by-lane', sample: 'template-deny-lane', source: `${PLANE_SRC}:497,:502 (the decide() verdict this lane consults)` },
  { kind: 'code', match: 'ADMISSION_DENIED', category: 'denied-by-lane', sample: 'ADMISSION_DENIED', source: `${PLANE_SRC}:1254 (the PA admission edge denied the call)` },
  { kind: 'code', match: 'CANCELLED', category: 'cancelled', sample: 'CANCELLED', source: `${ASK_SRC} + ${PRESENT_SRC} + ${STATE_SRC} (the caller cancelled before/at the edge)` },

  // ── agent-state ─────────────────────────────────────────────────────────
  { kind: 'code', match: 'AGENT_STATE_ARGS_INVALID', category: 'invalid-argument', sample: 'AGENT_STATE_ARGS_INVALID', source: `${STATE_SRC} (parse*Args: malformed / out-of-range / duplicate content)` },
  { kind: 'code', match: 'AGENT_STATE_ARGS_UNKNOWN', category: 'invalid-argument', sample: 'AGENT_STATE_ARGS_UNKNOWN', source: `${STATE_SRC} (closed parameter contract)` },
  { kind: 'code', match: 'TODO_WRITE_AGENT_REQUIRED', category: 'invalid-argument', sample: 'TODO_WRITE_AGENT_REQUIRED', source: `${STATE_SRC} (no calling agent: the call is under-specified, no scope exists)` },
  { kind: 'code', match: 'GOAL_TOOL_AGENT_REQUIRED', category: 'invalid-argument', sample: 'GOAL_TOOL_AGENT_REQUIRED', source: `${STATE_SRC} (no calling agent: no scope exists)` },
  { kind: 'code', match: 'EXIT_PLAN_MODE_AGENT_REQUIRED', category: 'invalid-argument', sample: 'EXIT_PLAN_MODE_AGENT_REQUIRED', source: `${STATE_SRC} (no calling agent: no session to switch)` },
  { kind: 'code', match: 'GOAL_TOOL_NOT_DIRECT_HUMAN', category: 'denied-by-lane', sample: 'GOAL_TOOL_NOT_DIRECT_HUMAN', source: `${STATE_SRC} (create/edit/pause/resume require a direct-human arm — withheld authority, decided before the store ran)` },
  { kind: 'code', match: 'GOAL_TOOL_NO_COMPLETION_AUTHORITY', category: 'denied-by-lane', sample: 'GOAL_TOOL_NO_COMPLETION_AUTHORITY', source: `${STATE_SRC} (complete/blocked require a direct-human turn or the exact current goal round)` },
  { kind: 'code', match: 'GOAL_TOOL_BLOCK_THRESHOLD', category: 'denied-by-lane', sample: 'GOAL_TOOL_BLOCK_THRESHOLD', source: `${STATE_SRC} (blocked needs 3 consecutive goal rounds)` },
  { kind: 'code', match: 'GOAL_TOOL_RESUME_PAUSED', category: 'denied-by-lane', sample: 'GOAL_TOOL_RESUME_PAUSED', source: `${STATE_SRC} (a paused goal is the user's to resume — the row withholds it under every arm)` },
  { kind: 'code', match: 'IO_POLICY_UNSUPPORTED', category: 'denied-by-lane', sample: 'IO_POLICY_UNSUPPORTED', source: `${STATE_SRC} templateDenyLeg (default-DENY template: no projected rule can cover the agent-state effect class)` },
  { kind: 'code', match: 'GOAL_ALREADY_EXISTS', category: 'unsupported-mode', sample: 'GOAL_ALREADY_EXISTS', source: `${STORE_SRC} applyGoal CAS leg + ${STATE_SRC} goalStateLeg (one goal per scope; the operation is not supported in this state)` },
  { kind: 'code', match: 'GOAL_INVALID_TRANSITION', category: 'unsupported-mode', sample: 'GOAL_INVALID_TRANSITION', source: `${STATE_SRC} goalStateLeg (the requested phase transition is not supported from the current phase)` },
  { kind: 'code', match: 'PLAN_MODE_NOT_ACTIVE', category: 'unsupported-mode', sample: 'PLAN_MODE_NOT_ACTIVE', source: `${STATE_SRC} + ${STORE_SRC} applyPlanModeExit (the mode that would make the exit meaningful is not active)` },
  { kind: 'code', match: 'PLAN_MODE_PLAN_INVALID', category: 'invalid-argument', sample: 'PLAN_MODE_PLAN_INVALID', source: `${STATE_SRC} (the plan must start with a # heading)` },
  { kind: 'code', match: 'GOAL_INVALID_OBJECTIVE', category: 'invalid-argument', sample: 'GOAL_INVALID_OBJECTIVE', source: `${STATE_SRC} (empty objective)` },
  { kind: 'code', match: 'GOAL_INVALID_MAX_ROUNDS', category: 'invalid-argument', sample: 'GOAL_INVALID_MAX_ROUNDS', source: `${STATE_SRC} (max_goal_rounds out of range)` },
  { kind: 'code', match: 'GOAL_INVALID_EDIT', category: 'invalid-argument', sample: 'GOAL_INVALID_EDIT', source: `${STATE_SRC} parseUpdateGoalArgs (an edit with no objective and no round cap asks for nothing)` },
  { kind: 'code', match: 'GOAL_TOOL_INVALID_UPDATE', category: 'invalid-argument', sample: 'GOAL_TOOL_INVALID_UPDATE', source: `${STATE_SRC} (the action's own field set is contradictory)` },
  { kind: 'code', match: 'GOAL_STALE_REVISION', category: 'stale-version', sample: 'GOAL_STALE_REVISION', source: `${STATE_SRC} goalStateLeg + ${STORE_SRC} applyGoal CAS (the goal moved past the referenced revision)` },
  { kind: 'code', match: 'STATE_APPLY_REPLAY', category: 'stale-version', sample: 'STATE_APPLY_REPLAY', source: `${STORE_SRC} applyUnder (a consumed grant never applies twice — the observation is no longer current)` },
  { kind: 'code', match: 'AGENT_STATE_STORE_FAULT', category: 'route-unresolved', sample: 'AGENT_STATE_STORE_FAULT', source: `${STATE_SRC} run() catch (the durable backend could not serve the call)` },
])

const BY_CODE = new Map(UI_STATE_REFUSAL_MAP.map((entry) => [entry.match, entry.category]))

/** True when the value means "no refusal at all" (an allow). */
export function isNoRefusal(value) {
  return NO_REFUSAL_VALUES.includes(value)
}

/**
 * Resolve a typed refusal code onto the owner's closed category vocabulary.
 *
 * @param {unknown} code
 * @returns {{code: string, category: string, entry: object}}
 * @throws {RefusalVocabularyError} `REFUSAL_VOCABULARY_INCOMPLETE`
 */
export function categoryOfFamilyRefusal(code) {
  if (typeof code !== 'string' || code.length === 0) {
    throw new RefusalVocabularyError('REFUSAL_VOCABULARY_INCOMPLETE', `refusal code ${JSON.stringify(code)} is not a non-empty string; an unnameable refusal cannot be compared`)
  }
  if (isNoRefusal(code)) {
    throw new RefusalVocabularyError('REFUSAL_VOCABULARY_INCOMPLETE', `refusal code ${JSON.stringify(code)} means "no refusal" (an allow) and must be graded by outcome`)
  }
  const entry = UI_STATE_REFUSAL_MAP.find((candidate) => candidate.match === code)
  if (entry === undefined) {
    throw new RefusalVocabularyError(
      'REFUSAL_VOCABULARY_INCOMPLETE',
      `refusal code ${JSON.stringify(code)} is not mapped by the closed ui/agent-state vocabulary; map it deliberately (with a citation) or the compatibility claim would silently absorb a new refusal reason`,
    )
  }
  return Object.freeze({ code, category: entry.category, entry })
}

/**
 * Totalness audit over the codes a capture actually observed.
 * @param {readonly string[]} codes
 * @returns {{ok: boolean, problems: string[], observed: string[]}}
 */
export function assertVocabularyTotal(codes) {
  const observed = [...new Set(codes.filter((code) => !isNoRefusal(code)))].sort()
  const problems = []
  for (const code of observed) {
    try { categoryOfFamilyRefusal(code) } catch (error) { problems.push(`${code}: ${String(error.message)}`) }
  }
  return { ok: problems.length === 0, problems, observed }
}

/** Every category a capture reaches (for the printed exclusion set). */
export function reachedCategories(codes) {
  const reached = new Set()
  for (const code of new Set(codes.filter((code) => !isNoRefusal(code)))) reached.add(categoryOfFamilyRefusal(code).category)
  return [...reached].sort()
}
