/**
 * effect-oracle.mjs — the AGENT-CONTROL lane's witnesses and its CLOSED refusal
 * vocabulary.
 *
 * THE VOCABULARY IS IMPORTED, NOT FORKED. `tests/ute-g1-fs/lib/refusal-categories.mjs`
 * owns the closed category set the UTE G1 owner ruling adopted as the
 * old/new compatibility interface (`REFUSAL_CATEGORIES`, `CATEGORY_IDS`) and the
 * `RefusalVocabularyError` whose code is `REFUSAL_VOCABULARY_INCOMPLETE`. This
 * lane imports those and adds only what is necessarily lane-local:
 *
 *   - `AGENT_CONTROL_REFUSAL_CATEGORY`: a TOTAL map from the refusal CODE this
 *     family's rows actually emit to one imported category. There is no default
 *     bucket: an unlisted code raises the imported `REFUSAL_VOCABULARY_INCOMPLETE`,
 *     exactly as an unmapped FsError does on the FS lane. `unknown` is
 *     unreachable because no entry maps to it and no fall-through exists.
 *   - the observed value is a CODE, never prose: the rows throw
 *     `refused-agent-control <code> — <detail>` (or a `<row> was cancelled`
 *     sentence for the cancelling arm), so the classification keys on the code
 *     and never on a message a host generation could reword.
 *
 * The three overlapping class tokens (`lane-deny`, `route-unresolved`,
 * `cancelled`) are ALSO derived through the imported `categoryOfLegacyRefusal`
 * and asserted equal to this lane's category, so the shared vocabulary and this
 * lane's total map cannot diverge silently.
 *
 * @module tests/ute-g1-agentctl/lib/effect-oracle
 */
import {
  CATEGORY_IDS,
  REFUSAL_CATEGORIES,
  RefusalVocabularyError,
  categoryOfLegacyRefusal,
  isNoRefusal,
} from '../../ute-g1-fs/lib/refusal-categories.mjs'
import { stableJson } from './world.mjs'

export { CATEGORY_IDS, REFUSAL_CATEGORIES, RefusalVocabularyError }

/** The category every declared refusal code maps to. NO fall-through exists. */
export const AGENT_CONTROL_REFUSAL_CATEGORY = Object.freeze({
  // the closed argument grammar
  'agent-control-schema-refused': 'invalid-argument',
  'agent-control-effect-set-rejected': 'invalid-argument',
  // the resolved lane / policy / authority fence
  'agent-control-lane-denied': 'denied-by-lane',
  'template-default-deny': 'denied-by-lane',
  'agent-control-amplification-refused': 'denied-by-lane',
  'agent-control-context-authority-refused': 'denied-by-lane',
  'agent-control-child-ptc-refused': 'denied-by-lane',
  'agent-control-scope-foreign': 'denied-by-lane',
  'agent-control-scope-unresolved': 'denied-by-lane',
  'agent-control-pa-approval-request-unavailable': 'denied-by-lane',
  // the one-shot exec-token law: a malformed call identity, not a lane decision
  'agent-control-replay-refused': 'invalid-argument',
  // the assembly has no backend that can serve the call
  'agent-control-pa-edge-unavailable': 'route-unresolved',
  'agent-runtime-leg-unwired': 'route-unresolved',
  'unknown-tool': 'route-unresolved',
  // caller cancellation
  cancelled: 'cancelled',
})

/** The class token each category is spelled as in the fixture's `refusal`
 *  column. These are the imported vocabulary's OWN class tokens for the three
 *  it declares; the others are category ids, which is what the column records. */
export const CATEGORY_TOKEN = Object.freeze({
  'denied-by-lane': 'lane-deny',
  'invalid-argument': 'invalid-argument',
  'route-unresolved': 'route-unresolved',
  cancelled: 'cancelled',
})

/** Codes the rows can emit through the runtime leg (task-shaped refusals the
 *  port's own answer is turned into by `run()`: `agent-control-runtime-<code>`).
 *  Declared ONE BY ONE; a new code is a deliberate map edit. */
export const RUNTIME_REFUSAL_CATEGORY = Object.freeze({
  'agent-control-runtime-agent-runtime-authority-refused': 'denied-by-lane',
  'agent-control-runtime-agent-control-amplification-refused': 'denied-by-lane',
  'agent-control-runtime-agent-control-workflow-step-refused': 'denied-by-lane',
})

/**
 * Extract the refusal CODE from a thrown row error.
 *
 * @param {unknown} error
 * @returns {string} the code (never prose)
 * @throws {RefusalVocabularyError} when no declared code can be found
 */
export function refusalCodeOf(error) {
  const text = String(error?.message ?? error ?? '')
  const governed = /refused-agent-control\s+([a-z0-9-]+)\s+—/u.exec(text)
  if (governed !== null) return governed[1]
  const cancelled = /^[a-z_ ]+ was cancelled$/u.exec(text)
  if (cancelled !== null) return 'cancelled'
  const unknown = /^Error: unknown tool "([a-z0-9_]+)"$/u.exec(text)
  if (unknown !== null) return 'unknown-tool'
  throw new RefusalVocabularyError(
    'REFUSAL_VOCABULARY_INCOMPLETE',
    `the refusal ${JSON.stringify(text.slice(0, 200))} carries no declared code; map it deliberately rather than letting it fall into a default bucket`,
  )
}

/**
 * Classify one thrown refusal into the closed vocabulary.
 *
 * @param {unknown} error
 * @returns {{code: string, category: import('../../ute-g1-fs/lib/refusal-categories.mjs').RefusalCategory, token: string}}
 */
export function classifyRefusal(error) {
  const code = refusalCodeOf(error)
  const category = AGENT_CONTROL_REFUSAL_CATEGORY[code] ?? RUNTIME_REFUSAL_CATEGORY[code]
  if (category === undefined) {
    throw new RefusalVocabularyError(
      'REFUSAL_VOCABULARY_INCOMPLETE',
      `refusal code ${JSON.stringify(code)} is not mapped by this lane's total map (or by the imported category set); map it deliberately with a citation`,
    )
  }
  if (!CATEGORY_IDS.includes(category)) {
    throw new RefusalVocabularyError('REFUSAL_VOCABULARY_INVALID', `category ${JSON.stringify(category)} is not in the imported CATEGORY_IDS`)
  }
  if (category === 'unknown') {
    throw new RefusalVocabularyError('REFUSAL_VOCABULARY_INVALID', `refusal code ${JSON.stringify(code)} mapped to the residual category; this lane has no residual bucket`)
  }
  const token = CATEGORY_TOKEN[category]
  if (token === undefined) {
    throw new RefusalVocabularyError('REFUSAL_VOCABULARY_INVALID', `category ${JSON.stringify(category)} has no fixture token`)
  }
  return Object.freeze({ code, category, token })
}

/** The shared class tokens must agree with the imported derivation, and the
 *  residual category must stay unreachable from this lane's map. */
export function selfCheckRefusalVocabulary() {
  const findings = []
  const shared = { 'lane-deny': 'denied-by-lane', 'route-unresolved': 'route-unresolved', cancelled: 'cancelled' }
  for (const [token, expected] of Object.entries(shared)) {
    try {
      const imported = categoryOfLegacyRefusal(token).category
      if (imported !== expected) findings.push({ token, imported, expected })
      if (!Object.values(AGENT_CONTROL_REFUSAL_CATEGORY).includes(expected)) {
        findings.push({ token, imported, expected, local: 'NO-CODE-MAPS-TO-IT' })
      }
    } catch (error) {
      findings.push({ token, imported: `THREW:${String(error?.code ?? error)}`, expected })
    }
  }
  for (const [code, category] of Object.entries(AGENT_CONTROL_REFUSAL_CATEGORY)) {
    if (category === 'unknown') findings.push({ code, imported: 'unknown', local: 'REACHABLE(!!)' })
  }
  return Object.freeze({ ok: findings.length === 0, findings: Object.freeze(findings) })
}

/** Stable JSON of the model-facing payload of one step. */
export function payloadOf(value) {
  return isNoRefusal(value) ? '-' : stableJson(value)
}

/** The fixture's `facts` column: deterministic counts, never a nonce. */
export function factsOf({ steps, calls, audit, tokens }) {
  const legs = calls.map((call) => call.leg).sort()
  const counts = {}
  for (const leg of legs) counts[leg] = (counts[leg] ?? 0) + 1
  const legText = Object.keys(counts).sort().map((leg) => `${leg}=${counts[leg]}`).join(',')
  const scopes = [...new Set(calls.filter((call) => call.leg === 'listAgents').map((call) => String(call.scope ?? '-')))].sort()
  return [
    `steps=${steps.length}`,
    `allow=${steps.filter((step) => step.outcome === 'allow').length}`,
    `deny=${steps.filter((step) => step.outcome === 'deny').length}`,
    `calls=${calls.length}`,
    `legs=${legText.length === 0 ? '-' : legText}`,
    `scopes=${scopes.length === 0 ? '-' : scopes.join('|')}`,
    `control=${audit.length}`,
    `decisions=${audit.length === 0 ? '-' : audit.join('|')}`,
    `tokens=${tokens.length === 0 ? '-' : tokens.join(',')}`,
  ].join(';')
}
