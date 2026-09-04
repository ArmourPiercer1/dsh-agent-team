/**
 * Closed state vocabularies of the projection DTO family (P8-T1).
 *
 * Each vocabulary is a FROZEN closed set: the constants are `as const`
 * objects (or fixed arrays), the values are the exact wire strings, and the
 * guards are membership checks. Producers must never invent a value outside
 * the set; consumers may branch on the full set.
 *
 * Authorities (frozen 20260829 plan docs):
 *
 * - admission states: Architecture §28 (the four frozen admission states of
 *   the TeamSession admission gate, surfaced on the projection root);
 * - residency states: UI §24 (the three frozen agent-residency states of the
 *   live overlay);
 * - template kinds: Architecture §6.1 (exactly one LeaderTemplate per
 *   blueprint, invariant 13; MemberTemplate, invariant 17);
 * - context policies: Architecture §11 / invariant 29 (frozen at instance
 *   creation: `persistent` | `fresh_per_delegation`);
 * - progress values: the closed P6-T2 admission progress set, mirrored as
 *   the durable activity status (no invented vocabulary);
 * - ledger categories: UI §27.4 (the eight frozen filter categories of the
 *   TeamLedger view; the projection carries the summary only, never the
 *   entries).
 *
 * The MemberInstance lifecycle vocabulary (CREATED | RUNNING | SETTLED |
 * ARCHIVED | DISPOSED, Architecture §29) is NOT re-declared here: it is the
 * P3-T1 frozen `MemberLifecycleState`, re-exported by the family barrel.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/states
 */

import { teamContractError } from '../errors.js'

// --- admission (Architecture §28) ------------------------------------------------

/** The four frozen admission states of a TeamSession (Architecture §28). */
export const ADMISSION_STATES = {
  /** All admission checks pass; work may be admitted (§28). */
  OPEN: 'OPEN',
  /** Warnings present; admission allowed, warnings surfaced to the human (§28). */
  BLOCKED_WARNING: 'BLOCKED_WARNING',
  /** A fatal check failed; admission blocked until resolved (§28). */
  BLOCKED_FATAL: 'BLOCKED_FATAL',
  /** Degraded operation after an explicit human acknowledgement (§28). */
  DEGRADED_ACKNOWLEDGED: 'DEGRADED_ACKNOWLEDGED',
} as const

/** The frozen admission state type. */
export type AdmissionState = (typeof ADMISSION_STATES)[keyof typeof ADMISSION_STATES]

/** Every admission state value, for membership checks. */
export const ADMISSION_STATE_VALUES: readonly string[] = Object.values(ADMISSION_STATES)

/** Is `value` one of the four frozen admission states? */
export function isAdmissionState(value: unknown): value is AdmissionState {
  return typeof value === 'string' && ADMISSION_STATE_VALUES.includes(value)
}

/**
 * Parse an admission state field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen admission state.
 */
export function parseAdmissionStateField(raw: unknown, field: string): AdmissionState {
  if (!isAdmissionState(raw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be one of ${ADMISSION_STATE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`,
      { field },
    )
  }
  return raw
}

// --- residency (UI §24) -----------------------------------------------------------

/** The three frozen agent-residency states of the live overlay (UI §24). */
export const RESIDENCY_STATES = {
  /** The agent runtime is resident in memory. */
  resident: 'resident',
  /** The agent runtime is not resident; state is durable and restorable. */
  cold: 'cold',
  /** A cold agent is being resumed. */
  resuming: 'resuming',
} as const

/** The frozen residency state type. */
export type ResidencyState = (typeof RESIDENCY_STATES)[keyof typeof RESIDENCY_STATES]

/** Every residency state value, for membership checks. */
export const RESIDENCY_STATE_VALUES: readonly string[] = Object.values(RESIDENCY_STATES)

/** Is `value` one of the three frozen residency states? */
export function isResidencyState(value: unknown): value is ResidencyState {
  return typeof value === 'string' && RESIDENCY_STATE_VALUES.includes(value)
}

/**
 * Parse a residency state field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen residency state.
 */
export function parseResidencyStateField(raw: unknown, field: string): ResidencyState {
  if (!isResidencyState(raw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be one of ${RESIDENCY_STATE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`,
      { field },
    )
  }
  return raw
}

// --- template kind (Architecture §6.1) ----------------------------------------------

/** The two frozen template kinds of a TeamBlueprint (Architecture §6.1). */
export const TEMPLATE_KINDS = {
  /** The single LeaderTemplate of the blueprint (invariant 13). */
  leader: 'leader',
  /** A MemberTemplate producing 0..N MemberInstances (invariant 17). */
  member: 'member',
} as const

/** The frozen template kind type. */
export type TemplateKind = (typeof TEMPLATE_KINDS)[keyof typeof TEMPLATE_KINDS]

/** Every template kind value, for membership checks. */
export const TEMPLATE_KIND_VALUES: readonly string[] = Object.values(TEMPLATE_KINDS)

/** Is `value` one of the two frozen template kinds? */
export function isTemplateKind(value: unknown): value is TemplateKind {
  return typeof value === 'string' && TEMPLATE_KIND_VALUES.includes(value)
}

/**
 * Parse a template kind field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen template kind.
 */
export function parseTemplateKindField(raw: unknown, field: string): TemplateKind {
  if (!isTemplateKind(raw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be one of ${TEMPLATE_KIND_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`,
      { field },
    )
  }
  return raw
}

// --- context policy (Architecture §11; invariant 29) --------------------------------

/** The two frozen context policies, frozen at instance creation (invariant 29). */
export const CONTEXT_POLICIES = {
  /** The member context persists across delegations. */
  persistent: 'persistent',
  /** Each delegation starts a fresh context. */
  fresh_per_delegation: 'fresh_per_delegation',
} as const

/** The frozen context policy type. */
export type ContextPolicy = (typeof CONTEXT_POLICIES)[keyof typeof CONTEXT_POLICIES]

/** Every context policy value, for membership checks. */
export const CONTEXT_POLICY_VALUES: readonly string[] = Object.values(CONTEXT_POLICIES)

/** Is `value` one of the two frozen context policies? */
export function isContextPolicy(value: unknown): value is ContextPolicy {
  return typeof value === 'string' && CONTEXT_POLICY_VALUES.includes(value)
}

/**
 * Parse a context policy field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen context policy.
 */
export function parseContextPolicyField(raw: unknown, field: string): ContextPolicy {
  if (!isContextPolicy(raw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be one of ${CONTEXT_POLICY_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`,
      { field },
    )
  }
  return raw
}

// --- progress (closed P6-T2 set) ------------------------------------------------------

/**
 * The three frozen progress values of a member's current admitted work.
 * Mirrors the closed P6-T2 admission progress set exactly (no invented
 * vocabulary); used as the durable activity status.
 */
export const PROGRESS_VALUES = ['in-progress', 'completed', 'blocked'] as const

/** The frozen progress value type. */
export type ProgressValue = (typeof PROGRESS_VALUES)[number]

/** Is `value` one of the three frozen progress values? */
export function isProgressValue(value: unknown): value is ProgressValue {
  return typeof value === 'string' && (PROGRESS_VALUES as readonly string[]).includes(value)
}

/**
 * Parse a progress value field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen progress value.
 */
export function parseProgressValueField(raw: unknown, field: string): ProgressValue {
  if (!isProgressValue(raw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be one of ${PROGRESS_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`,
      { field },
    )
  }
  return raw
}

// --- ledger category (UI §27.4) -------------------------------------------------------

/**
 * The eight frozen TeamLedger filter categories (UI §27.4). The projection
 * carries the per-category summary only (ledger.ts); the ledger entries
 * themselves are TeamDomain facts (invariant 41) and never projection fields.
 */
export const LEDGER_CATEGORIES = {
  /** Team-level lifecycle facts (creation, admission, handoff, archive). */
  team: 'team',
  /** Member lifecycle facts (creation, settle, archive, dispose). */
  member: 'member',
  /** Lifecycle transition entries. */
  lifecycle: 'lifecycle',
  /** Message routing entries. */
  message: 'message',
  /** Control request / decision entries. */
  control: 'control',
  /** Policy state and override entries (UI "Policy / Overrides" filter). */
  policy: 'policy',
  /** Compatibility probe / drift / acknowledgement entries. */
  compatibility: 'compatibility',
  /** Progress entries. */
  progress: 'progress',
} as const

/** The frozen ledger category type. */
export type LedgerCategory = (typeof LEDGER_CATEGORIES)[keyof typeof LEDGER_CATEGORIES]

/** Every ledger category value, for membership checks. */
export const LEDGER_CATEGORY_VALUES: readonly string[] = Object.values(LEDGER_CATEGORIES)

/** Is `value` one of the eight frozen ledger categories? */
export function isLedgerCategory(value: unknown): value is LedgerCategory {
  return typeof value === 'string' && LEDGER_CATEGORY_VALUES.includes(value)
}

/**
 * Parse a ledger category field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen ledger category.
 */
export function parseLedgerCategoryField(raw: unknown, field: string): LedgerCategory {
  if (!isLedgerCategory(raw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be one of ${LEDGER_CATEGORY_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`,
      { field },
    )
  }
  return raw
}
