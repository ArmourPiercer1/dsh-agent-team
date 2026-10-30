/**
 * Alpha.6 PR0 (Lane 2) — the CLOSED-WORLD parser of the trusted ReviewPlan.
 *
 * WHY A PARSER AND NOT A CAST. The ReviewPlan is the only input from which a
 * ReviewMandate may be derived (types.ts L-3), so whatever shape this accepts
 * IS the shape of delegated authority. The plan therefore goes through the
 * same law the governance-center applies to family contributions
 * (`governance-center/contribution-schema.ts`): every object is checked
 * key-by-key against a fixed key set at every nesting level, an unlisted key
 * is a REFUSAL and never a silent drop, and nothing about the accepted value
 * is defaulted in. A cast or a `Partial<>` with defaults would let a typo in
 * Host config widen a scope, which is precisely the failure this phase exists
 * to make unrepresentable.
 *
 * WHERE THE INPUT COMES FROM. Host-supplied plugin config
 * (`config.teamToolPlane.*`, the pass-through bag already carrying
 * `jobsEnabled` and `centerAssembly`), NOT the blueprint: the Blueprint v3
 * schema is frozen and Alpha.6 adds no field to it, so a Team opts in through
 * config only. That also fixes the trust level — config is written by the
 * operator at session bind time and is not reachable by a model tool call.
 * The wiring that reads it is Lane-plan PR-I2; this file only defines what a
 * legal plan is, so the two can be reviewed apart.
 *
 * WHAT A PARSED PLAN DOES NOT DO: it grants nothing on its own. Every field is
 * re-checked at call time by `mandate.ts` against the live epoch and the live
 * case fold, so a plan copy kept past its epoch or after revocation decides
 * nothing.
 *
 * @module review-mandate/plan
 */

import { createHash } from 'node:crypto'

import { canonicalJsonStringify, LEADER_INSTANCE_ID } from '../../contracts/src/index.js'

import {
  DELEGABLE_REVIEW_RUNG,
  REVIEW_MANDATE_DECISIONS,
  REVIEW_RUNGS,
  type ReviewPlan,
  type ReviewPlanActionScope,
  type ReviewPlanEffectScope,
  type ReviewMandateDecision,
  type ReviewRung,
} from './types.js'

// --- vocabulary ---------------------------------------------------------------------------

/** Closed failure codes for plan parsing. Stable strings: a parse failure is
 *  an operator-facing diagnostic and may be logged. */
export const REVIEW_PLAN_FAILURE_CODES = [
  'PLAN_NOT_OBJECT',
  'UNKNOWN_FIELD',
  'MISSING_FIELD',
  'BAD_TYPE',
  'BAD_VALUE',
  'BAD_ID',
  'BAD_DIGEST',
  'EMPTY_LIST',
  'DUPLICATE_ACTION',
  'SCOPE_FORM_UNKNOWN',
  'SCOPE_NAMES_UNLISTED_ACTION',
  'RUNG_NOT_DELEGABLE',
  'REVIEWER_IS_LEADER_INSTANCE',
  'BAD_TIMESTAMP',
] as const
export type ReviewPlanFailureCode = (typeof REVIEW_PLAN_FAILURE_CODES)[number]

/** A parse failure names the field it tripped on; `field === null` means the
 *  failure is about the whole document. */
export interface ReviewPlanFailure {
  readonly code: ReviewPlanFailureCode
  readonly field: string | null
  readonly detail: string
}

export type ReviewPlanParseResult =
  | { readonly ok: true; readonly plan: ReviewPlan }
  | { readonly ok: false; readonly failure: ReviewPlanFailure }

// --- closed key sets -----------------------------------------------------------------------

const PLAN_KEYS = [
  'rootSessionId',
  'blueprintDigest',
  'epoch',
  'reviewerInstanceId',
  'delegatedRung',
  'actions',
  'effectScopes',
  'expiresAtIso',
] as const
const ACTION_KEYS = ['actionName', 'decisions'] as const
const EFFECT_SCOPE_KEYS = ['form', 'value'] as const

/** Hygienic id: the same shape the durable lanes demand of an instance id. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
/** A canonical action name may carry the `family:action` / `family.sub.action`
 *  separators the operation grammar uses, and nothing else. */
const ACTION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/
/** 64 lowercase hex, the digest law of the durable lanes. */
const DIGEST_PATTERN = /^[0-9a-f]{64}$/
/** An ISO-8601 instant with an explicit offset (the durable lanes' stamp form). */
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/

/** An effect-set fingerprint: hex of any reasonable length, no separators. */
const FINGERPRINT_PATTERN = /^[0-9a-f]{16,128}$/

/** The Leader's sentinel instance id, imported (not restated) so the veto below
 *  cannot drift from the constant the rest of the repository resolves callers
 *  against: a plan that names the Leader as its Approval Officer is refused at
 *  parse time (L-1 — the Officer is a Member instance, never a second Leader). */
const LEADER_INSTANCE_SENTINEL: string = LEADER_INSTANCE_ID

// --- the reader ---------------------------------------------------------------------------

type Failure = { readonly ok: false; readonly failure: ReviewPlanFailure }

function fail(code: ReviewPlanFailureCode, field: string | null, detail: string): Failure {
  return { ok: false, failure: { code, field, detail } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read one object against a closed key set. Returns the record, or a failure
 *  naming the offending key — never a filtered copy. */
function readClosed(value: unknown, keys: readonly string[], where: string): { ok: true; record: Record<string, unknown> } | Failure {
  if (!isRecord(value)) return fail('PLAN_NOT_OBJECT', where, `expected a plain object, got ${Array.isArray(value) ? 'array' : typeof value}`)
  const allowed = new Set(keys)
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return fail('UNKNOWN_FIELD', `${where}.${key}`, 'the plan schema is closed; an unlisted key is a refusal, not a default')
  }
  for (const key of keys) {
    if (!(key in value)) return fail('MISSING_FIELD', `${where}.${key}`, 'every plan field is required (no defaults)')
  }
  return { ok: true, record: value }
}

function readId(value: unknown, field: string): { ok: true; value: string } | Failure {
  if (typeof value !== 'string') return fail('BAD_TYPE', field, 'expected a string id')
  if (!ID_PATTERN.test(value)) return fail('BAD_ID', field, 'id must be hygienic: 1-128 chars of [A-Za-z0-9._-], starting alphanumeric')
  return { ok: true, value }
}

function readPositiveInt(value: unknown, field: string): { ok: true; value: number } | Failure {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return fail('BAD_VALUE', field, 'expected a positive safe integer')
  }
  return { ok: true, value }
}

function readDecisions(value: unknown, field: string): { ok: true; value: readonly ReviewMandateDecision[] } | Failure {
  if (!Array.isArray(value)) return fail('BAD_TYPE', field, 'expected an array of decision values')
  if (value.length === 0) return fail('EMPTY_LIST', field, 'an action with no delegated decision value delegates nothing')
  const seen = new Set<string>()
  const decisions: ReviewMandateDecision[] = []
  for (const raw of value) {
    if (typeof raw !== 'string' || !(REVIEW_MANDATE_DECISIONS as readonly string[]).includes(raw)) {
      return fail('BAD_VALUE', field, `decision must be one of ${REVIEW_MANDATE_DECISIONS.join('|')}`)
    }
    const decision = raw as ReviewMandateDecision
    if (seen.has(decision)) return fail('BAD_VALUE', field, `duplicate decision value "${decision}"`)
    seen.add(decision)
    decisions.push(decision)
  }
  return { ok: true, value: decisions }
}

function readActions(value: unknown): { ok: true; value: readonly ReviewPlanActionScope[] } | Failure {
  if (!Array.isArray(value)) return fail('BAD_TYPE', 'actions', 'expected an array of action scopes')
  if (value.length === 0) return fail('EMPTY_LIST', 'actions', 'a plan that delegates no action delegates nothing; do not ship one')
  const actions: ReviewPlanActionScope[] = []
  const names = new Set<string>()
  for (const [index, raw] of value.entries()) {
    const where = `actions[${index}]`
    const closed = readClosed(raw, ACTION_KEYS, where)
    if ('failure' in closed) return closed
    // An action name is NOT an id: the operation grammar uses `:` and `.`
    // separators (`fs:write`, `sandbox.net.fetch`), which the id grammar above
    // forbids. Its own pattern, its own refusal code.
    const rawName = closed.record['actionName']
    if (typeof rawName !== 'string') return fail('BAD_TYPE', `${where}.actionName`, 'expected a string action name')
    if (!ACTION_NAME_PATTERN.test(rawName)) {
      return fail('BAD_ID', `${where}.actionName`, 'action name must match [A-Za-z0-9._:-] and start alphanumeric')
    }
    const name = { value: rawName }
    if (names.has(name.value)) return fail('DUPLICATE_ACTION', `${where}.actionName`, `action "${name.value}" is listed twice`)
    names.add(name.value)
    const decisions = readDecisions(closed.record['decisions'], `${where}.decisions`)
    if ('failure' in decisions) return decisions
    actions.push({ actionName: name.value, decisions: decisions.value })
  }
  return { ok: true, value: actions }
}

function readEffectScopes(value: unknown, actions: readonly ReviewPlanActionScope[]): { ok: true; value: readonly ReviewPlanEffectScope[] } | Failure {
  if (!Array.isArray(value)) return fail('BAD_TYPE', 'effectScopes', 'expected an array of effect scopes')
  if (value.length === 0) return fail('EMPTY_LIST', 'effectScopes', 'a plan with no effect scope delegates nothing')
  const listed = new Set(actions.map((action) => action.actionName))
  const scopes: ReviewPlanEffectScope[] = []
  const seen = new Set<string>()
  for (const [index, raw] of value.entries()) {
    const where = `effectScopes[${index}]`
    const closed = readClosed(raw, EFFECT_SCOPE_KEYS, where)
    if ('failure' in closed) return closed
    const form = closed.record['form']
    if (form !== 'exact-fingerprint' && form !== 'by-action-name') {
      return fail('SCOPE_FORM_UNKNOWN', `${where}.form`, "form must be 'exact-fingerprint' or 'by-action-name'; there is no wildcard")
    }
    const rawValue = closed.record['value']
    if (typeof rawValue !== 'string') return fail('BAD_TYPE', `${where}.value`, 'expected a string')
    if (form === 'exact-fingerprint') {
      if (!FINGERPRINT_PATTERN.test(rawValue)) {
        return fail('BAD_VALUE', `${where}.value`, 'an exact fingerprint is 16-128 lowercase hex, never a prefix or a glob')
      }
    } else if (!listed.has(rawValue)) {
      return fail('SCOPE_NAMES_UNLISTED_ACTION', `${where}.value`, 'a by-action-name scope must name an action this plan lists')
    }
    const token = `${form}:${rawValue}`
    if (seen.has(token)) return fail('BAD_VALUE', where, 'duplicate effect scope')
    seen.add(token)
    scopes.push({ form, value: rawValue })
  }
  return { ok: true, value: scopes }
}

// --- the PARSED brand ----------------------------------------------------------------------

/**
 * The set of plans that came out of {@link parseReviewPlan}.
 *
 * WHY A BRAND AND NOT A TYPE. `ReviewPlan` is a structural type, so any caller
 * can hand `evaluateReviewAdmission` an object that TYPES as a plan and was
 * never parsed — and then every fail-closed rule that lives in the parser is
 * decoration. Two concrete opens a reviewer executed against the unbranded
 * version: a handcrafted `expiresAtIso: 'expired-yesterday-probably'` makes
 * `now > Date.parse(garbage)` equal `now > NaN` = false, so expiry silently
 * never fires; a handcrafted `{form:'exact-fingerprint', value:'*'}` walks a
 * wildcard through the admission door that the parser itself refuses. A WeakSet
 * membership test is the only check that survives both, because it is not
 * derivable from the object's own contents and cannot be forged by a caller who
 * never went through the parser.
 */
const PARSED_PLANS = new WeakSet<object>()

/** Was this exact plan object produced by {@link parseReviewPlan}? */
export function isParsedReviewPlan(plan: ReviewPlan): boolean {
  return PARSED_PLANS.has(plan)
}

// --- the public parse ----------------------------------------------------------------------

/**
 * Parse one candidate ReviewPlan fail-closed. `raw` is whatever the Host put in
 * config: nothing is trusted, nothing is defaulted.
 */
export function parseReviewPlan(raw: unknown): ReviewPlanParseResult {
  const closed = readClosed(raw, PLAN_KEYS, 'reviewPlan')
  if ('failure' in closed) return closed
  const record = closed.record

  const root = readId(record['rootSessionId'], 'rootSessionId')
  if ('failure' in root) return root
  if (typeof record['blueprintDigest'] !== 'string' || !DIGEST_PATTERN.test(record['blueprintDigest'])) {
    return fail('BAD_DIGEST', 'blueprintDigest', 'expected 64 lowercase hex; a plan binds one exact blueprint content hash')
  }
  const epoch = readPositiveInt(record['epoch'], 'epoch')
  if ('failure' in epoch) return epoch
  const reviewer = readId(record['reviewerInstanceId'], 'reviewerInstanceId')
  if ('failure' in reviewer) return reviewer
  if (reviewer.value === LEADER_INSTANCE_SENTINEL) {
    return fail('REVIEWER_IS_LEADER_INSTANCE', 'reviewerInstanceId', 'the Approval Officer is a Member instance, never the Leader (types.ts L-1)')
  }
  if (typeof record['delegatedRung'] !== 'string' || !(REVIEW_RUNGS as readonly string[]).includes(record['delegatedRung'])) {
    return fail('BAD_VALUE', 'delegatedRung', `delegatedRung must be one of ${REVIEW_RUNGS.join('|')}`)
  }
  const rung = record['delegatedRung'] as ReviewRung
  if (rung !== DELEGABLE_REVIEW_RUNG) {
    return fail('RUNG_NOT_DELEGABLE', 'delegatedRung', `only '${DELEGABLE_REVIEW_RUNG}' review is delegable; a human rung never is`)
  }
  const actions = readActions(record['actions'])
  if ('failure' in actions) return actions
  const effectScopes = readEffectScopes(record['effectScopes'], actions.value)
  if ('failure' in effectScopes) return effectScopes

  let expiresAtIso: string | null = null
  if (record['expiresAtIso'] !== null) {
    if (typeof record['expiresAtIso'] !== 'string' || !ISO_INSTANT_PATTERN.test(record['expiresAtIso']) || Number.isNaN(Date.parse(record['expiresAtIso']))) {
      return fail('BAD_TIMESTAMP', 'expiresAtIso', 'expiry must be null or an ISO-8601 instant with an explicit offset')
    }
    expiresAtIso = record['expiresAtIso']
  }

  const plan: ReviewPlan = Object.freeze({
      rootSessionId: root.value,
      blueprintDigest: record['blueprintDigest'],
      epoch: epoch.value,
      reviewerInstanceId: reviewer.value,
      delegatedRung: rung,
      actions: Object.freeze([...actions.value].map((action) => Object.freeze({ actionName: action.actionName, decisions: Object.freeze([...action.decisions]) }))),
      effectScopes: Object.freeze([...effectScopes.value].map((scope) => Object.freeze({ ...scope }))),
      expiresAtIso,
    })
  PARSED_PLANS.add(plan)
  return { ok: true, plan }
}

// --- the derived helpers -------------------------------------------------------------------

/**
 * The plan's own content digest: canonical JSON, sha256, 64 lowercase hex.
 * Logged and bound into grant facts so a reviewer decision can later be shown
 * to have been taken under THIS plan and no other. Content-addressed, so two
 * operators writing the same plan agree without coordinating an id.
 */
export function reviewPlanDigest(plan: ReviewPlan): string {
  return createHash('sha256').update(canonicalJsonStringify(plan)).digest('hex')
}

/** The plan's entry for one action, or undefined when the action is not delegated. */
export function planActionScope(plan: ReviewPlan, actionName: string): ReviewPlanActionScope | undefined {
  return plan.actions.find((action) => action.actionName === actionName)
}

/**
 * Does the plan delegate THIS fingerprint for THIS action? Exact-fingerprint
 * scopes match byte-for-byte; by-action-name scopes cover every fingerprint of
 * a listed action. There is no prefix and no wildcard form to fall back to
 * (`SCOPE_FORM_UNKNOWN` above refuses one at parse time).
 */
export function planCoversEffectScope(plan: ReviewPlan, actionName: string, effectScopeFingerprint: string): boolean {
  // Both forms are scoped to a LISTED action. An exact fingerprint identifies
  // an effect set, not a permission to review any action that happens to
  // produce it, so a plan listing only `fs:write` must answer false for
  // `net:fetch` even when the fingerprints coincide.
  if (!plan.actions.some((action) => action.actionName === actionName)) return false
  return plan.effectScopes.some(
    (scope) =>
      (scope.form === 'exact-fingerprint' && scope.value === effectScopeFingerprint) ||
      (scope.form === 'by-action-name' && scope.value === actionName),
  )
}
