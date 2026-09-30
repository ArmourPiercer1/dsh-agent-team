/**
 * Typed requirement vocabulary for the compatibility engine.
 *
 * **Requirement != Policy** (Architecture §19.1): a requirement states that
 * the Blueprint *expects a capability to exist*; it is not a policy decision
 * (it does not say a role may use the capability), and it never means "ask
 * the Team plugin to auto-install the capability". Requirements are only
 * validated and checked against environment facts —they produce no policy.
 *
 * **Closed domain vocabulary** (Architecture §27.1): a requirement may only
 * declare a genuinely probeable domain:
 *
 * ```text
 * tools            -> 'tool'
 * skills           -> 'skill'
 * MCP servers      -> 'mcpServer'
 * model/provider routes -> 'modelRoute'
 * persona/runtime-context compatibility -> 'persona'
 * Team structural runtime capabilities  -> 'teamStructure'
 * ```
 *
 * Unknown requirement type = validation error —fail loud, typed
 * (`MALFORMED_DTO` with the offending value in `details`), per
 * Architecture §27.1 and TaskDoc §11.4 P3-T5.
 *
 * `complete:true` (Architecture §13.5 generalised by the T5 ruling): the
 * requirement is *structural* —if unmet, the outcome is a mandatory FATAL
 * that cannot be downgraded to WARNING and cannot be acknowledged away
 * (FATAL 不允许Continue Anyway, §27.2).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/requirement
 */

import { deepFreeze, teamContractError } from '../../../contracts/src/index.js'
import {
  assertNoUnknownFields,
  isPlainRecord,
  readNonEmptyString,
} from './common.js'

/** The closed requirement-type vocabulary (Architecture §27.1). */
export const REQUIREMENT_TYPES = {
  tool: 'tool',
  skill: 'skill',
  mcpServer: 'mcpServer',
  modelRoute: 'modelRoute',
  persona: 'persona',
  teamStructure: 'teamStructure',
} as const

/** A requirement type from the closed §27.1 vocabulary. */
export type RequirementType = (typeof REQUIREMENT_TYPES)[keyof typeof REQUIREMENT_TYPES]

/** Every requirement-type value, for membership checks and closed-set tests. */
export const REQUIREMENT_TYPE_VALUES: readonly string[] = Object.values(REQUIREMENT_TYPES)

/** Raw (unvalidated) requirement input. `complete` defaults to `false`. */
export interface RequirementInput {
  readonly requirementId: string
  readonly type: RequirementType
  /** Named subjects the requirement probes (tool/skill/MCP/route names, preset id, structural capability names). */
  readonly subjects: readonly string[]
  /** Structural requirement: unmet => mandatory FATAL, no downgrade (§13.5, T5 ruling). */
  readonly complete?: boolean
}

/** A validated, frozen requirement. */
export interface Requirement extends RequirementInput {
  /** Always present after validation (defaults to `false`). */
  readonly complete: boolean
}

/** The exact frozen fields of a requirement. */
const REQUIREMENT_FIELDS: readonly string[] = ['requirementId', 'type', 'subjects', 'complete']

/**
 * Assert that `value` is a closed-vocabulary requirement type.
 * @param value - the raw type value.
 * @param path - pointer used in the error details.
 * @returns the typed requirement type.
 * @throws `MALFORMED_DTO` with `problem: 'unknown requirement type'` for any
 *   value outside the §27.1 vocabulary (fail loud, typed).
 */
export function assertRequirementType(value: unknown, path: string): RequirementType {
  if (typeof value !== 'string' || !REQUIREMENT_TYPE_VALUES.includes(value)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `unknown requirement type at ${path}`,
      {
        path,
        problem: 'unknown requirement type',
        type: typeof value === 'string' ? value : typeof value,
      },
    )
  }
  return value as RequirementType
}

// ---------------------------------------------------------------------------
// Persona requirement kinds (pre-alpha3 PR-E, plan §E.3)
// ---------------------------------------------------------------------------

/**
 * The closed set of persona kinds a Team requirement may REQUIRE (plan
 * §E.3). This increment: exactly `standard` (a composable persona).
 * `absent` / `complete` as REQUIRED kinds are outside the closed set until an
 * ADR gives them product semantics (they remain valid OBSERVED kinds — the
 * runtime `ObservedPersonaKind` vocabulary).
 *
 * This is the SINGLE source of truth for the required-persona-kind
 * vocabulary, placed in the domain layer so BOTH the blueprint v2 validator
 * (which restricts persona-type requirement subjects to this set — the
 * additive v2 rule) and the runtime requirement module (which names the
 * required kind as the persona requirement's subject) consume the same
 * frozen set. The SUBJECT convention for persona requirements is the persona
 * KIND (not the preset id): the requirement's subjects name the required
 * kind(s); the world facts report the observed kind.
 */
export const REQUIRED_PERSONA_KINDS = {
  standard: 'standard',
} as const

/** A closed persona kind a Team requirement may demand (this increment: `standard`). */
export type RequiredPersonaKind = (typeof REQUIRED_PERSONA_KINDS)[keyof typeof REQUIRED_PERSONA_KINDS]

/** Every `RequiredPersonaKind` value, for closed-set membership tests. */
export const REQUIRED_PERSONA_KIND_VALUES: readonly string[] = Object.values(REQUIRED_PERSONA_KINDS)

/** Guard: is `value` a closed required persona kind? */
export function isRequiredPersonaKind(value: unknown): value is RequiredPersonaKind {
  return typeof value === 'string' && (REQUIRED_PERSONA_KIND_VALUES as readonly string[]).includes(value)
}

/**
 * Read and validate the `subjects` field: a non-empty array of unique
 * non-empty strings.
 * @param value - the raw field value.
 * @param path - pointer used in the error details.
 * @returns the frozen subject list (input order preserved).
 * @throws `MALFORMED_DTO` when missing, empty, or malformed.
 */
function parseSubjects(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw teamContractError(
      'MALFORMED_DTO',
      `subjects must be a non-empty array of non-empty strings at ${path}`,
      { path, field: 'subjects', problem: 'missing or empty subjects' },
    )
  }
  const seen = new Set<string>()
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i]
    if (typeof item !== 'string' || item.length === 0) {
      throw teamContractError(
        'MALFORMED_DTO',
        `subjects[${i}] must be a non-empty string at ${path}`,
        { path: `${path}[${i}]`, problem: 'subject must be a non-empty string' },
      )
    }
    if (seen.has(item)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `duplicate subject '${item}' at ${path}`,
        { path, subject: item, problem: 'duplicate subject' },
      )
    }
    seen.add(item)
  }
  return deepFreeze([...value] as string[])
}

/**
 * Parse and validate one requirement from an untrusted value.
 * @param value - the raw requirement.
 * @param path - pointer used in the error details (defaults to `$`).
 * @returns the frozen, validated requirement.
 * @throws `MALFORMED_DTO` for any structural violation, including an unknown
 *   requirement type.
 */
export function parseRequirement(value: unknown, path = '$'): Requirement {
  if (!isPlainRecord(value)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `requirement must be a plain record at ${path}`,
      { path, problem: 'not a plain record' },
    )
  }
  assertNoUnknownFields(value, REQUIREMENT_FIELDS, 'requirement', path)
  const requirementId = readNonEmptyString(value, 'requirementId', path)
  const type = assertRequirementType(value['type'], `${path}.type`)
  const subjects = parseSubjects(value['subjects'], `${path}.subjects`)
  const completeRaw = value['complete']
  if (completeRaw !== undefined && typeof completeRaw !== 'boolean') {
    throw teamContractError(
      'MALFORMED_DTO',
      `complete must be a boolean at ${path}.complete`,
      { path: `${path}.complete`, problem: 'complete must be a boolean' },
    )
  }
  return deepFreeze({ requirementId, type, subjects, complete: completeRaw === true })
}

/**
 * Parse and validate a requirement list.
 * @param values - the raw array (an empty list is valid: a blueprint without
 *   requirements is trivially compatible).
 * @returns the frozen list; `requirementId`s are unique within the list.
 * @throws `MALFORMED_DTO` when not an array, for any malformed member, or on
 *   duplicate `requirementId`s.
 */
export function parseRequirements(values: unknown): readonly Requirement[] {
  if (!Array.isArray(values)) {
    throw teamContractError(
      'MALFORMED_DTO',
      'requirements must be an array at $.requirements',
      { path: '$.requirements', problem: 'not an array' },
    )
  }
  const seen = new Set<string>()
  return deepFreeze(
    values.map((item, index) => {
      const requirement = parseRequirement(item, `requirements[${index}]`)
      if (seen.has(requirement.requirementId)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `duplicate requirementId '${requirement.requirementId}' at requirements[${index}]`,
          {
            path: `requirements[${index}].requirementId`,
            requirementId: requirement.requirementId,
            problem: 'duplicate requirementId',
          },
        )
      }
      seen.add(requirement.requirementId)
      return requirement
    }),
  )
}
