/**
 * Strong validation of a blueprint document (Architecture §5.5).
 *
 * A blueprint must pass WHOLE before it may enter an available catalog
 * (Architecture §5.5: "Blueprint 在进入可用 catalog 前必须整体通过强校验";
 * "不允许部分 Member 解析失败，剩余成员继续登记" — parsing is all-or-
 * nothing: any violation throws and no blueprint is produced).
 *
 * The checks implemented here:
 *
 * - the document is a closed, lossless-JSON record with the frozen top-
 *   level field set (unknown fields fail loudly, `MALFORMED_DTO`);
 * - no legacy-forbidden field (`memberId`) at ANY depth
 *   (`LEGACY_MEMBER_ID_REJECTED`);
 * - `schemaVersion` is stamped and supported
 *   (`SCHEMA_VERSION_UNSUPPORTED` / `SCHEMA_VERSION_MISMATCH`);
 * - identity/revision valid per contracts v1
 *   (`INVALID_BLUEPRINT_ID` / `INVALID_BLUEPRINT_REVISION`);
 * - exactly one complete LeaderTemplate (Architecture §5.3, invariant 13:
 *   the `leader` field is required and the template is "complete" only
 *   with a non-empty `persona`);
 * - MemberTemplate identity unique across the whole blueprint (leader
 *   included);
 * - template references resolvable: every `memberEnvelopes[].templateId`
 *   names a template declared in the same document;
 * - requirements well-formed with unique (domain, name) pairs;
 * - `modelPreference`, when present, is a legal v1 model token — either a
 *   qualified `provider/model` route (split at the first `/`, both sides
 *   non-empty) or a bare model-only shorthand (its provider is inherited
 *   from the deployment default at the runtime); no whitespace / control
 *   characters (`MALFORMED_DTO`, reason `invalid-model-preference`);
 * - mutation envelopes self-consistent (no operation in both allow and
 *   deny);
 * - PolicyState definitions reference only fields that exist in the
 *   document's frozen field set;
 * - quotas legal (positive integers, `maxConcurrent ≤ maxInstances`).
 *
 * The output is a normalized `TeamBlueprintCore` (absent optional fields
 * omitted, string fields trimmed, arrays/records copied). The derived
 * `contentHash` and the deep freeze happen in `parseBlueprint` (below).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/blueprint/validate
 */

import {
  assertRemoteSafeJsonValue,
  deepFreeze,
  LEGACY_FORBIDDEN_FIELDS,
  parseBlueprintId,
  parseBlueprintRevision,
  parseTemplateId,
  teamContractError,
  toRemoteSafeDetail,
} from '../../../contracts/src/index.js'
import {
  assertNoUnknownFields,
  assertPlainRecord,
} from '../../../contracts/src/dto/common.js'
import type {
  BlueprintId,
  BlueprintRevision,
  RemoteSafeRecord,
  TemplateId,
} from '../../../contracts/src/index.js'

import {
  assertRequirementType,
  isRequiredPersonaKind,
  REQUIRED_PERSONA_KIND_VALUES,
} from '../../compatibility/src/requirement.js'
import {
  BLUEPRINT_AUTHORITY_ENVELOPE_EXEC_MATCHER_FIELDS,
  BLUEPRINT_AUTHORITY_ENVELOPE_FIELDS,
  BLUEPRINT_AUTHORITY_ENVELOPE_FILE_MATCHER_FIELDS,
  BLUEPRINT_AUTHORITY_ENVELOPE_MATCHER_KINDS,
  BLUEPRINT_AUTHORITY_ENVELOPE_MAX_EFFECTS,
  BLUEPRINT_AUTHORITY_ENVELOPE_RULE_FIELDS,
  BLUEPRINT_CAPABILITIES_FIELDS,
  BLUEPRINT_ENVELOPE_FIELDS,
  BLUEPRINT_MEMBER_ENVELOPE_ENTRY_FIELDS,
  BLUEPRINT_POLICY_REFERENCEABLE_FIELDS,
  BLUEPRINT_POLICY_STATE_FIELDS,
  BLUEPRINT_QUOTA_FIELDS,
  BLUEPRINT_QUOTA_SPEC_FIELDS,
  BLUEPRINT_REQUIREMENT_FIELDS,
  BLUEPRINT_TEMPLATE_FIELDS,
  BLUEPRINT_TEMPLATE_FIELDS_V2,
  BLUEPRINT_TOP_LEVEL_FIELDS,
  BLUEPRINT_TOP_LEVEL_FIELDS_V2,
  BLUEPRINT_TOP_LEVEL_FIELDS_V3,
  BLUEPRINT_V2_REQUIREMENT_FIELDS,
  CAPABILITY_ITEM_MAX_LENGTH,
  CAPABILITY_POLICY_DECISIONS,
  CONTEXT_POLICY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  ENVELOPE_OPERATION_MAX_LENGTH,
  ENVELOPE_OPERATION_PATTERN,
  METADATA_KEY_MAX_LENGTH,
  METADATA_KEY_PATTERN,
  METADATA_VALUE_MAX_LENGTH,
  MODEL_PREFERENCE_MAX_LENGTH,
  PERSONA_MAX_LENGTH,
  PERMISSION_FINGERPRINT_MAX_LENGTH,
  PERMISSION_PATH_MAX_LENGTH,
  PERMISSION_POLICY_DEFAULTS,
  PERMISSION_POLICY_FIELDS,
  PERMISSION_RESOURCE_KINDS,
  PERMISSION_RULE_FIELDS,
  PERMISSION_TOOL_NAMES,
  POLICY_STATE_ID_MAX_LENGTH,
  POLICY_STATE_ID_PATTERN,
  REQUIREMENT_DOMAIN_MAX_LENGTH,
  REQUIREMENT_DOMAIN_PATTERN,
  REQUIREMENT_NAME_MAX_LENGTH,
  REQUIREMENT_NAME_PATTERN,
  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS,
} from './schema.js'
import { decodeYamlFrontmatter, splitFrontmatter } from './parse.js'
import { deriveContentHash } from './hash.js'
import { parseModelPreferenceToken } from './model-preference.js'
import type {
  BlueprintPermissionMutationEnvelope,
  BlueprintPermissionMutationEnvelopeMatcher,
  BlueprintPermissionMutationEnvelopeRule,
  BlueprintRequirement,
  BlueprintTemplate,
  CapabilityPolicy,
  CapabilityRequirement,
  DenyEntry,
  MemberEnvelopeEntry,
  MutationEnvelope,
  PermissionResource,
  PermissionRule,
  PolicyStateDefinition,
  Quota,
  QuotaSpec,
  TeamBlueprint,
  TeamBlueprintCore,
  TemplateCapabilities,
  TemplatePermissionPolicy,
} from './types.js'

/** Control characters forbidden in any string field (mirrors contracts). */
// eslint-disable-next-line no-control-regex -- intentional scanner: rejects control characters in blueprint strings
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

// ---------------------------------------------------------------------------
// small strict field readers (fail loudly, never default)
// ---------------------------------------------------------------------------

/**
 * Require a field on the record and return its raw value.
 * @throws `MALFORMED_DTO` with `details.path` when the field is absent.
 */
function requireField(record: RemoteSafeRecord, field: string, path: string): unknown {
  if (!Object.hasOwn(record, field) || record[field] === undefined) {
    throw teamContractError(
      'MALFORMED_DTO',
      `blueprint is missing required field '${field}' at ${path}`,
      { path: `${path}.${field}` },
    )
  }
  return record[field]
}

/**
 * Read a string field (optional or required) with length/control-char
 * rules. Optional fields, when present, must also be non-empty after
 * trimming. Returns `undefined` when the field is absent.
 */
function takeString(
  record: RemoteSafeRecord,
  field: string,
  path: string,
  opts: { required: boolean; maxLength: number },
): string | undefined {
  const fieldPath = `${path}.${field}`
  let value: unknown
  if (opts.required) {
    value = requireField(record, field, path)
  } else {
    if (!Object.hasOwn(record, field) || record[field] === undefined) return undefined
    value = record[field]
  }
  if (typeof value !== 'string') {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${fieldPath} must be a string, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`,
      { path: fieldPath },
    )
  }
  if (value.length > opts.maxLength) {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${fieldPath} exceeds max length ${opts.maxLength} (${value.length})`,
      { path: fieldPath, maxLength: opts.maxLength },
    )
  }
  if (CONTROL_CHARS.test(value)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${fieldPath} contains control characters`,
      { path: fieldPath },
    )
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${fieldPath} must not be empty`,
      { path: fieldPath },
    )
  }
  return trimmed
}

/** Read an array field (optional). Returns `undefined` when absent. */
function takeArray(record: RemoteSafeRecord, field: string, path: string): unknown[] | undefined {
  const fieldPath = `${path}.${field}`
  if (!Object.hasOwn(record, field) || record[field] === undefined) return undefined
  const value = record[field]
  if (!Array.isArray(value)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${fieldPath} must be an array, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`,
      { path: fieldPath },
    )
  }
  return value
}

/** Read a plain-record field (optional). Returns `undefined` when absent. */
function takeRecord(
  record: RemoteSafeRecord,
  field: string,
  path: string,
): RemoteSafeRecord | undefined {
  const fieldPath = `${path}.${field}`
  if (!Object.hasOwn(record, field) || record[field] === undefined) return undefined
  return assertPlainRecord(record[field], fieldPath)
}

/**
 * Read a positive-integer field (optional). Returns `undefined` when absent.
 * @throws `MALFORMED_DTO` when the value is not a positive integer.
 */
function takePositiveInt(
  record: RemoteSafeRecord,
  field: string,
  path: string,
): number | undefined {
  const fieldPath = `${path}.${field}`
  if (!Object.hasOwn(record, field) || record[field] === undefined) return undefined
  const value = record[field]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${fieldPath} must be a positive integer, got ${JSON.stringify(value)}`,
      { path: fieldPath },
    )
  }
  return value
}

/**
 * Recursively reject legacy-forbidden fields at any depth. (The contracts
 * `assertNoLegacyFields` only checks one level; a blueprint may nest
 * templates and records, so the check must walk the whole document.)
 */
function assertNoLegacyFieldsDeep(value: unknown, path: string): void {
  if (value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoLegacyFieldsDeep(item, `${path}[${index}]`))
    return
  }
  const record = value as RemoteSafeRecord
  for (const key of Object.keys(record)) {
    if (LEGACY_FORBIDDEN_FIELDS.includes(key)) {
      throw teamContractError(
        'LEGACY_MEMBER_ID_REJECTED',
        `blueprint carries the legacy field '${key}' at ${path}; vNext runtime identity is the composite (rootSessionId, instanceId), never a legacy memberId`,
        { path: `${path}.${key}` },
      )
    }
    assertNoLegacyFieldsDeep(record[key], `${path}.${key}`)
  }
}

/** Remove properties whose value is `undefined` (absent optional fields). */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) delete obj[key]
  }
  return obj
}

// ---------------------------------------------------------------------------
// sub-structure validators
// ---------------------------------------------------------------------------

// The strict v1 `modelPreference` token grammar lives in the SINGLE domain
// parser (`./model-preference.js`, PR #30 review-supplement P2-2) and is
// imported above — ONE grammar shared by the validator, the runtime
// derivation, and the legacy importer (no mirror sites).

/**
 * Validate one template (leader or member). Both share one closed schema.
 *
 * `role` is the template's role in the blueprint: it threads down to the
 * permission-rule validation, where the shell-class contract carries a
 * LEADER-scoped exception (exec-autonomy-contract, user ruling 2026-09-18):
 * a `bash` / `pwsh` rule in the `allow` lane with the whole-tool `any`
 * resource is accepted ONLY on the leader template (the dual-gate
 * enforcement lives at the runtime install — the envelope must carry the
 * matching exec token; see pre-execute-adapter). Member templates keep the
 * A2C-1 contract verbatim (allow-lane shell rejected, diagnostics
 * byte-identical).
 */
function validateTemplate(
  raw: unknown,
  path: string,
  role: 'leader' | 'member',
  schemaVersion: number,
): BlueprintTemplate {
  const record = assertPlainRecord(raw, `${path} (template)`)
  // The template field set is version-gated (plan §E.2): v1 templates parse
  // against the FROZEN v1 set (a `requirements` key there is an unknown
  // field and fails loudly — the v1 validator is NOT tightened); v2
  // templates additionally accept the per-template structured requirement
  // field `requirements`.
  // A4-PR1: v3 inherits the v2 template shape UNCHANGED (the v3 delta is one
  // top-level authority document, ADR A2-2), so the arm is written as "v1 gets
  // the frozen v1 set" rather than "v2 gets v2" — a third version would
  // otherwise silently fall back to the v1 template fields.
  const templateFields =
    schemaVersion === 1 ? BLUEPRINT_TEMPLATE_FIELDS : BLUEPRINT_TEMPLATE_FIELDS_V2
  assertNoUnknownFields(record, templateFields, `${path} (template)`)

  const templateId = parseTemplateId(requireField(record, 'templateId', path))
  const displayName = takeString(record, 'displayName', path, {
    required: false,
    maxLength: DISPLAY_NAME_MAX_LENGTH,
  })
  const description = takeString(record, 'description', path, {
    required: false,
    maxLength: DESCRIPTION_MAX_LENGTH,
  })
  const persona = takeString(record, 'persona', path, {
    required: true,
    maxLength: PERSONA_MAX_LENGTH,
  })! // required:true never yields undefined: takeString throws instead
  const modelPreference = takeString(record, 'modelPreference', path, {
    required: false,
    maxLength: MODEL_PREFERENCE_MAX_LENGTH,
  })
  if (
    modelPreference !== undefined &&
    parseModelPreferenceToken(modelPreference) === undefined
  ) {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${path}.modelPreference is not a legal model token: expected a qualified 'provider/model' route (split at the first '/', both sides non-empty) or a bare model id, with no whitespace — got ${JSON.stringify(modelPreference)}`,
      { path: `${path}.modelPreference`, reason: 'invalid-model-preference' },
    )
  }
  const contextPolicy = takeString(record, 'contextPolicy', path, {
    required: false,
    maxLength: CONTEXT_POLICY_MAX_LENGTH,
  })

  // Optional capabilities block (absent = legacy mode)
  const capabilitiesRaw = takeRecord(record, 'capabilities', path)
  const capabilities = capabilitiesRaw === undefined
    ? undefined
    : validateTemplateCapabilities(capabilitiesRaw, `${path}.capabilities`, role)

  // Optional schema-v2 per-template structured requirements (absent in v1
  // documents; absent when a v2 template declares none). `stripUndefined`
  // OMITS the key when it is `undefined`, so a v1 template (and a v2
  // template that declares none) hashes byte-identically to before §E.2 —
  // the same "absent => key omitted" discipline as the A1 `permissions` key.
  const v2RequirementsRaw =
    schemaVersion >= 2 ? takeArray(record, 'requirements', path) : undefined
  const v2Requirements =
    v2RequirementsRaw === undefined
      ? undefined
      : validateV2Requirements(v2RequirementsRaw, `${path}.requirements`)

  return stripUndefined({
    templateId,
    displayName,
    description,
    persona,
    modelPreference,
    contextPolicy,
    capabilities,
    ...(v2Requirements !== undefined ? { requirements: v2Requirements } : {}),
  })
}

/** Validate one capability requirement. */
function validateRequirement(raw: unknown, path: string): CapabilityRequirement {
  const record = assertPlainRecord(raw, `${path} (requirement)`)
  assertNoUnknownFields(record, BLUEPRINT_REQUIREMENT_FIELDS, `${path} (requirement)`)

  const domain = requireField(record, 'domain', path)
  if (
    typeof domain !== 'string' ||
    domain.length > REQUIREMENT_DOMAIN_MAX_LENGTH ||
    !REQUIREMENT_DOMAIN_PATTERN.test(domain)
  ) {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${path}.domain must be a lowercase slug (max ${REQUIREMENT_DOMAIN_MAX_LENGTH}), got ${JSON.stringify(domain)}`,
      { path: `${path}.domain` },
    )
  }
  const name = requireField(record, 'name', path)
  if (
    typeof name !== 'string' ||
    name.length > REQUIREMENT_NAME_MAX_LENGTH ||
    !REQUIREMENT_NAME_PATTERN.test(name)
  ) {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${path}.name must be a lowercase slug with dots (max ${REQUIREMENT_NAME_MAX_LENGTH}), got ${JSON.stringify(name)}`,
      { path: `${path}.name` },
    )
  }
  let optional = false
  if (Object.hasOwn(record, 'optional') && record['optional'] !== undefined) {
    if (typeof record['optional'] !== 'boolean') {
      throw teamContractError(
        'MALFORMED_DTO',
        `field ${path}.optional must be a boolean, got ${typeof record['optional']}`,
        { path: `${path}.optional` },
      )
    }
    optional = record['optional']
  }

  return { domain, name, optional }
}

/**
 * Validate one schema-v2 structured requirement (plan §E.2).
 *
 * The `type` is the CLOSED §27.1 six-set (validated by the domain
 * compatibility `assertRequirementType` — the single source of truth, so the
 * blueprint can never declare a requirement domain the engine cannot probe).
 * The `requirementId` is a non-empty slug (the engine's outcome/ack binding
 * key). `subjects` is a non-empty array of non-empty slugs (the probeable
 * named capabilities). `complete` defaults to `false` (an omitted `complete`
 * is the ordinary, ack-able case; a present-but-wrong-type `complete` is
 * malformed — fail closed, never a guess).
 */
function validateV2Requirement(raw: unknown, path: string): BlueprintRequirement {
  const record = assertPlainRecord(raw, `${path} (v2 requirement)`)
  assertNoUnknownFields(record, BLUEPRINT_V2_REQUIREMENT_FIELDS, `${path} (v2 requirement)`)

  const requirementIdRaw = requireField(record, 'requirementId', path)
  if (
    typeof requirementIdRaw !== 'string' ||
    requirementIdRaw.length === 0 ||
    requirementIdRaw.length > REQUIREMENT_NAME_MAX_LENGTH ||
    !REQUIREMENT_NAME_PATTERN.test(requirementIdRaw)
  ) {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${path}.requirementId must be a lowercase slug (max ${REQUIREMENT_NAME_MAX_LENGTH}), got ${JSON.stringify(requirementIdRaw)}`,
      { path: `${path}.requirementId` },
    )
  }

  const type = assertRequirementType(record['type'], `${path}.type`)

  const subjectsRaw = takeArray(record, 'subjects', path)
  if (subjectsRaw === undefined || subjectsRaw.length === 0) {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${path}.subjects must be a non-empty array of non-empty slugs`,
      { path: `${path}.subjects` },
    )
  }
  const subjects = subjectsRaw.map((item, index) => {
    if (
      typeof item !== 'string' ||
      item.length === 0 ||
      item.length > REQUIREMENT_NAME_MAX_LENGTH ||
      !REQUIREMENT_NAME_PATTERN.test(item)
    ) {
      throw teamContractError(
        'MALFORMED_DTO',
        `field ${path}.subjects[${index}] must be a lowercase slug (max ${REQUIREMENT_NAME_MAX_LENGTH}), got ${JSON.stringify(item)}`,
        { path: `${path}.subjects[${index}]` },
      )
    }
    return item
  })
  const seen = new Set<string>()
  for (const subject of subjects) {
    if (seen.has(subject)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `duplicate subject '${subject}' at ${path}.subjects`,
        { path: `${path}.subjects`, subject },
      )
    }
    seen.add(subject)
  }

  // pre-alpha3 PR-E (plan §E.3) — the ADDITIVE v2 rule (the FROZEN v1
  // `validateRequirement` above is untouched): a persona-TYPE requirement's
  // subjects name the REQUIRED persona KIND(s) (the persona KIND convention —
  // not preset ids). The closed `RequiredPersonaKind` set (the domain
  // compatibility single source of truth) currently allows exactly `standard`;
  // any other subject is malformed (fail loud, typed — never a silent
  // false-OPEN).
  if (type === 'persona') {
    for (const subject of subjects) {
      if (!isRequiredPersonaKind(subject)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${path}.subjects must be closed required persona kinds (one of: ${REQUIRED_PERSONA_KIND_VALUES.join(', ')}) for a persona-type requirement, got ${JSON.stringify(subject)}`,
          { path: `${path}.subjects`, subject, problem: 'unknown required persona kind' },
        )
      }
    }
  }

  let complete = false
  if (Object.hasOwn(record, 'complete') && record['complete'] !== undefined) {
    if (typeof record['complete'] !== 'boolean') {
      throw teamContractError(
        'MALFORMED_DTO',
        `field ${path}.complete must be a boolean, got ${typeof record['complete']}`,
        { path: `${path}.complete` },
      )
    }
    complete = record['complete']
  }

  return { requirementId: requirementIdRaw, type, subjects, complete }
}

/**
 * Validate a schema-v2 structured-requirement list (the Team / Leader /
 * MemberTemplate `requirements` field): well-formed entries with unique
 * `requirementId`s within the list.
 */
function validateV2Requirements(raw: unknown[], path: string): BlueprintRequirement[] {
  const requirements: BlueprintRequirement[] = []
  const seen = new Set<string>()
  raw.forEach((item, index) => {
    const requirement = validateV2Requirement(item, `${path}[${index}]`)
    if (seen.has(requirement.requirementId)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `duplicate v2 requirementId '${requirement.requirementId}' at ${path}[${index}]`,
        { path: `${path}[${index}].requirementId`, requirementId: requirement.requirementId },
      )
    }
    seen.add(requirement.requirementId)
    requirements.push(requirement)
  })
  return requirements
}

/** Validate one mutation envelope (self-consistent allow/deny). */
function validateEnvelope(raw: unknown, path: string): MutationEnvelope {
  const record = assertPlainRecord(raw, `${path} (envelope)`)
  assertNoUnknownFields(record, BLUEPRINT_ENVELOPE_FIELDS, `${path} (envelope)`)

  const parseList = (field: 'allow' | 'deny'): string[] => {
    const items = takeArray(record, field, path)
    if (items === undefined) return []
    return items.map((item, index) => {
      if (
        typeof item !== 'string' ||
        item.length > ENVELOPE_OPERATION_MAX_LENGTH ||
        !ENVELOPE_OPERATION_PATTERN.test(item)
      ) {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${path}.${field}[${index}] must be an operation token (lowercase slug, max ${ENVELOPE_OPERATION_MAX_LENGTH}), got ${JSON.stringify(item)}`,
          { path: `${path}.${field}[${index}]` },
        )
      }
      return item
    })
  }

  const allow = parseList('allow')
  const deny = parseList('deny')
  const denied = new Set(deny)
  for (const op of allow) {
    if (denied.has(op)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `envelope at ${path} is not self-consistent: operation '${op}' appears in both allow and deny`,
        { path: `${path}.allow`, operation: op },
      )
    }
  }

  return { allow, deny }
}

/**
 * Validate ONE authority document of the shared v3 grammar — the Alpha.3 PR4
 * Leader expansion ceiling (`permissionMutationEnvelope`, ADR §6 / design §4)
 * or the Alpha.4 Human User hard ceiling (`teamHardEnvelope`, ADR A2-2 /
 * spec §3.3). ONE function because it is ONE grammar (ADR A3-9): the two
 * documents differ in the runtime role their rules play, never in shape,
 * class pairing, or closedness. `carrier` is the field name, used ONLY in
 * diagnostics so a refusal inside `teamHardEnvelope` never blames
 * `permissionMutationEnvelope`.
 *
 * Neither is the operation-token {@link MutationEnvelope} above (D2: two
 * concepts, one per concept, no transformation between them).
 *
 * The grammar mirrors the runtime kernel's own write-time gate
 * (`governance/permission-mutation.ts validateMatcher`): the
 * `operationClass` picks the matcher shape —
 * - FILE-class operations (`read`/`read_image`/`write`/`edit`/`lsp`) pair
 *   with `exact`/`subtree` carrying a workspace `path` (SAME constraints as
 *   the static permission lanes: trimmed non-empty, no control chars,
 *   `PERMISSION_PATH_MAX_LENGTH`; relative paths stay honest — the runtime
 *   resolves them against the documented envelope path basis, this layer
 *   never reinterprets them);
 * - SHELL-class operations (`bash`/`pwsh`) pair with `fingerprint` ONLY —
 *   the canonical operation identity carried VERBATIM (design §5: no
 *   subtree, no `any`; Final Acceptance 7: exec stays exact).
 * A mispairing is a typed refusal here, never a silently inert rule.
 * `maximumEffect` is the closed §6 ceiling (`allow`/`ask`/`deny`).
 * Duplicates of the same (operationClass, matcher) pair are a document
 * defect (the coverage question is a ceiling lookup — two ceilings for one
 * pair is ambiguous). A declared empty `rules` list is legal and means
 * exactly one thing: NO expansion authority.
 */
function validateAuthorityEnvelope(
  raw: unknown,
  path: string,
  carrier: string,
): BlueprintPermissionMutationEnvelope {
  const record = assertPlainRecord(raw, `${path} (${carrier})`)
  assertNoUnknownFields(record, BLUEPRINT_AUTHORITY_ENVELOPE_FIELDS, `${path} (${carrier})`)

  const rulesRaw = requireField(record, 'rules', path)
  if (!Array.isArray(rulesRaw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `field ${path}.rules must be an ARRAY of { operationClass, matcher, maximumEffect } (it may be empty — empty means NO expansion authority in the ${carrier}), got ${rulesRaw === null ? 'null' : typeof rulesRaw}`,
      { path: `${path}.rules` },
    )
  }

  const rules: BlueprintPermissionMutationEnvelopeRule[] = []
  const seenPairs = new Set<string>()
  rulesRaw.forEach((item, index) => {
    const rulePath = `${path}.rules[${index}]`
    const rule = assertPlainRecord(item, `${rulePath} (envelope rule)`)
    assertNoUnknownFields(rule, BLUEPRINT_AUTHORITY_ENVELOPE_RULE_FIELDS, rulePath)

    const operationClass = requireField(rule, 'operationClass', rulePath)
    if (typeof operationClass !== 'string' || !PERMISSION_TOOL_NAMES.includes(operationClass)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `field ${rulePath}.operationClass must be one of ${PERMISSION_TOOL_NAMES.join(' | ')} (the closed permission vocabulary), got ${JSON.stringify(operationClass)}`,
        { path: `${rulePath}.operationClass` },
      )
    }
    const isShellTool = operationClass === 'bash' || operationClass === 'pwsh'

    const maximumEffect = requireField(rule, 'maximumEffect', rulePath)
    if (typeof maximumEffect !== 'string' || !BLUEPRINT_AUTHORITY_ENVELOPE_MAX_EFFECTS.includes(maximumEffect)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `field ${rulePath}.maximumEffect must be one of ${BLUEPRINT_AUTHORITY_ENVELOPE_MAX_EFFECTS.join(' | ')} (the §6 effect ceiling), got ${JSON.stringify(maximumEffect)}`,
        { path: `${rulePath}.maximumEffect` },
      )
    }

    const matcherRaw = requireField(rule, 'matcher', rulePath)
    const matcherRecord = assertPlainRecord(matcherRaw, `${rulePath}.matcher (envelope matcher)`)
    const kind = requireField(matcherRecord, 'kind', `${rulePath}.matcher`)
    if (typeof kind !== 'string' || !BLUEPRINT_AUTHORITY_ENVELOPE_MATCHER_KINDS.includes(kind)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `field ${rulePath}.matcher.kind must be one of ${BLUEPRINT_AUTHORITY_ENVELOPE_MATCHER_KINDS.join(' | ')} (no 'any' in this grammar — design §5), got ${JSON.stringify(kind)}`,
        { path: `${rulePath}.matcher.kind` },
      )
    }

    let matcher: BlueprintPermissionMutationEnvelopeMatcher
    if (isShellTool) {
      // Exec lane: fingerprint ONLY (design §5). A file matcher on a shell
      // class is refused HERE (the same mispairing the kernel refuses at
      // write time — never a silently inert authority rule).
      assertNoUnknownFields(matcherRecord, BLUEPRINT_AUTHORITY_ENVELOPE_EXEC_MATCHER_FIELDS, `${rulePath}.matcher`)
      if (kind !== 'fingerprint') {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${rulePath}.matcher.kind is rejected: the ${operationClass} operation class is shell-class — its matcher is the canonical 'fingerprint' EXACTLY (design §5: no subtree, no any, no path)`,
          { path: `${rulePath}.matcher.kind`, operationClass },
        )
      }
      const fingerprint = requireField(matcherRecord, 'fingerprint', `${rulePath}.matcher`)
      if (typeof fingerprint !== 'string' || fingerprint.trim().length === 0) {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${rulePath}.matcher.fingerprint must be a non-empty canonical fingerprint string`,
          { path: `${rulePath}.matcher.fingerprint` },
        )
      }
      if (CONTROL_CHARS.test(fingerprint)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${rulePath}.matcher.fingerprint contains control characters`,
          { path: `${rulePath}.matcher.fingerprint` },
        )
      }
      if (fingerprint.length > PERMISSION_FINGERPRINT_MAX_LENGTH) {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${rulePath}.matcher.fingerprint exceeds max length ${PERMISSION_FINGERPRINT_MAX_LENGTH} (${fingerprint.length})`,
          { path: `${rulePath}.matcher.fingerprint`, maxLength: PERMISSION_FINGERPRINT_MAX_LENGTH },
        )
      }
      matcher = { kind: 'fingerprint', fingerprint }
    } else {
      // File lane: exact | subtree with a path (same path constraints as
      // the static lanes; runtime canonicalizes against the documented
      // envelope path basis — this layer never resolves or reinterprets).
      assertNoUnknownFields(matcherRecord, BLUEPRINT_AUTHORITY_ENVELOPE_FILE_MATCHER_FIELDS, `${rulePath}.matcher`)
      if (kind === 'fingerprint') {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${rulePath}.matcher.kind is rejected: the ${operationClass} operation class is filesystem-class — its matcher is 'exact' | 'subtree' with a workspace path (design §5)`,
          { path: `${rulePath}.matcher.kind`, operationClass },
        )
      }
      const pathValue = requireField(matcherRecord, 'path', `${rulePath}.matcher`)
      if (typeof pathValue !== 'string') {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${rulePath}.matcher.path must be a non-empty string, got ${pathValue === null ? 'null' : typeof pathValue}`,
          { path: `${rulePath}.matcher.path` },
        )
      }
      if (CONTROL_CHARS.test(pathValue)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${rulePath}.matcher.path contains control characters`,
          { path: `${rulePath}.matcher.path` },
        )
      }
      const normalized = pathValue.trim()
      if (normalized.length === 0) {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${rulePath}.matcher.path must not be empty`,
          { path: `${rulePath}.matcher.path` },
        )
      }
      if (normalized.length > PERMISSION_PATH_MAX_LENGTH) {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${rulePath}.matcher.path exceeds max length ${PERMISSION_PATH_MAX_LENGTH} (${normalized.length})`,
          { path: `${rulePath}.matcher.path`, maxLength: PERMISSION_PATH_MAX_LENGTH },
        )
      }
      matcher = kind === 'subtree' ? { kind: 'subtree', path: normalized } : { kind: 'exact', path: normalized }
    }

    const pairKey = `${operationClass}\u0000${kind}\u0000${'path' in matcher ? matcher.path : matcher.fingerprint}`
    if (seenPairs.has(pairKey)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `duplicate ${carrier} rule for (${operationClass}, ${kind} ${'path' in matcher ? matcher.path : matcher.fingerprint}) — one pair carries one ceiling`,
        { path: rulePath },
      )
    }
    seenPairs.add(pairKey)
    rules.push({ operationClass, matcher, maximumEffect: maximumEffect as 'allow' | 'ask' | 'deny' })
  })

  return { rules }
}

/** Validate one quota. */
function validateQuota(raw: unknown, path: string): Quota {
  const record = assertPlainRecord(raw, `${path} (quota)`)
  assertNoUnknownFields(record, BLUEPRINT_QUOTA_FIELDS, `${path} (quota)`)
  const maxInstances = takePositiveInt(record, 'maxInstances', path)
  const maxConcurrent = takePositiveInt(record, 'maxConcurrent', path)
  if (
    maxInstances !== undefined &&
    maxConcurrent !== undefined &&
    maxConcurrent > maxInstances
  ) {
    throw teamContractError(
      'MALFORMED_DTO',
      `quota at ${path} is not legal: maxConcurrent (${maxConcurrent}) exceeds maxInstances (${maxInstances})`,
      { path, maxInstances, maxConcurrent },
    )
  }
  return stripUndefined({ maxInstances, maxConcurrent })
}

/**
 * Validate one allow/deny entry (used by capabilities sub-fields
 * `teamTools`, `skills`, `mcp`).
 */
function validateAllowDenyEntry(raw: unknown, path: string): DenyEntry | { kind: 'allow'; items: readonly string[] } {
  const record = assertPlainRecord(raw, `${path} (allow/deny entry)`)

  const kind = record['kind']
  if (typeof kind !== 'string' || (kind !== 'allow' && kind !== 'deny')) {
    throw teamContractError(
      'MALFORMED_DTO',
      `allow/deny entry at ${path} must have kind 'allow' or 'deny', got ${JSON.stringify(kind)}`,
      { path: `${path}.kind` },
    )
  }

  if (kind === 'deny') {
    const unknown = Object.keys(record).filter((k) => k !== 'kind')
    if (unknown.length > 0) {
      throw teamContractError(
        'MALFORMED_DTO',
        `deny entry at ${path} must not have extra fields: ${unknown.join(', ')}`,
        { path: `${path}`, extraFields: unknown },
      )
    }
    return { kind: 'deny' }
  }

  // kind === 'allow' — items is required
  const itemsRaw = requireField(record, 'items', path)
  if (!Array.isArray(itemsRaw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `allow entry at ${path} must have items array, got ${itemsRaw === null ? 'null' : typeof itemsRaw}`,
      { path: `${path}.items` },
    )
  }
  const items = itemsRaw.map((item, index) => {
    if (typeof item !== 'string' || item.length === 0 || item.length > CAPABILITY_ITEM_MAX_LENGTH) {
      throw teamContractError(
        'MALFORMED_DTO',
        `allow entry at ${path}.items[${index}] must be a non-empty string (max ${CAPABILITY_ITEM_MAX_LENGTH}), got ${JSON.stringify(item)}`,
        { path: `${path}.items[${index}]` },
      )
    }
    return item
  })
  const extra = Object.keys(record).filter((k) => k !== 'kind' && k !== 'items')
  if (extra.length > 0) {
    throw teamContractError(
      'MALFORMED_DTO',
      `allow entry at ${path} has unknown fields: ${extra.join(', ')}`,
      { path, extraFields: extra },
    )
  }
  return { kind: 'allow' as const, items }
}

/**
 * Validate the optional `capabilities` block on a BlueprintTemplate.
 * When absent → valid (legacy mode). When present → the four alpha.1
 * sub-fields are required and the optional `permissions` block (A1) is
 * validated as a closed TemplatePermissionPolicy.
 *
 * `role` threads through to the permission-rule validation (the
 * leader-scoped shell-class allow-lane exception — see validateTemplate).
 */
function validateTemplateCapabilities(
  raw: unknown,
  path: string,
  role: 'leader' | 'member',
): TemplateCapabilities {
  const record = assertPlainRecord(raw, `${path} (capabilities)`)
  assertNoUnknownFields(record, BLUEPRINT_CAPABILITIES_FIELDS, `${path} (capabilities)`)

  const teamTools = validateAllowDenyEntry(requireField(record, 'teamTools', path), `${path}.teamTools`)
  const skills = validateAllowDenyEntry(requireField(record, 'skills', path), `${path}.skills`)
  const mcp = validateAllowDenyEntry(requireField(record, 'mcp', path), `${path}.mcp`)

  // builtinToolDeny is a plain string[]
  const builtinToolDenyRaw = requireField(record, 'builtinToolDeny', path)
  if (!Array.isArray(builtinToolDenyRaw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `capabilities at ${path}.builtinToolDeny must be an array, got ${builtinToolDenyRaw === null ? 'null' : typeof builtinToolDenyRaw}`,
      { path: `${path}.builtinToolDeny` },
    )
  }
  const builtinToolDeny = builtinToolDenyRaw.map((item, index) => {
    if (typeof item !== 'string' || item.length === 0 || item.length > CAPABILITY_ITEM_MAX_LENGTH) {
      throw teamContractError(
        'MALFORMED_DTO',
        `capabilities at ${path}.builtinToolDeny[${index}] must be a non-empty string (max ${CAPABILITY_ITEM_MAX_LENGTH}), got ${JSON.stringify(item)}`,
        { path: `${path}.builtinToolDeny[${index}]` },
      )
    }
    return item
  })

  // Optional permission policy (alpha.2 A1; absent = no parameter-level
  // permissions at all — legacy/alpha.1 behavior).
  const permissionsRaw = takeRecord(record, 'permissions', path)
  const permissions =
    permissionsRaw === undefined
      ? undefined
      : validatePermissionPolicy(permissionsRaw, `${path}.permissions`, role)

  return stripUndefined({ teamTools, builtinToolDeny, skills, mcp, permissions })
}

/**
 * Validate the optional `capabilities.permissions` block into a
 * `TemplatePermissionPolicy` (alpha.2 plan §6.3 — all constraints):
 *
 * - `default` is REQUIRED and must be `ask` or `deny` (`allow` rejected —
 *   no silent privilege expansion);
 * - `allow` / `ask` / `deny` are REQUIRED arrays (each may be empty);
 * - every field set is CLOSED: unknown fields on the policy, on a rule,
 *   or on a resource are rejected;
 * - unsupported tools, non-closed resource kinds, and malformed `exact`
 *   / `any` resources are rejected.
 *
 * Normalization is deterministic (see the type docs): each lane keeps
 * declaration order, duplicates are preserved, no reordering — the lanes
 * are fresh plain copies of the source arrays, so the same source always
 * yields structurally identical output.
 *
 * `role` threads through to the permission-rule validation (the
 * leader-scoped shell-class allow-lane exception — see validateTemplate).
 */
function validatePermissionPolicy(
  raw: unknown,
  path: string,
  role: 'leader' | 'member',
): TemplatePermissionPolicy {
  const record = assertPlainRecord(raw, `${path} (permission policy)`)
  assertNoUnknownFields(record, PERMISSION_POLICY_FIELDS, `${path} (permission policy)`)

  const defaultRaw = requireField(record, 'default', path)
  if (typeof defaultRaw !== 'string' || !PERMISSION_POLICY_DEFAULTS.includes(defaultRaw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `permission policy ${path}.default must be one of ${PERMISSION_POLICY_DEFAULTS.join(' | ')} (a default of 'allow' is rejected: no silent privilege expansion), got ${JSON.stringify(defaultRaw)}`,
      { path: `${path}.default` },
    )
  }

  const lane = (name: 'allow' | 'ask' | 'deny'): PermissionRule[] => {
    const items = requireField(record, name, path)
    if (!Array.isArray(items)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `permission policy ${path}.${name} must be an array (it may be empty), got ${items === null ? 'null' : typeof items}`,
        { path: `${path}.${name}` },
      )
    }
    // Declaration order is preserved; duplicate rules are legal.
    return items.map((item, index) =>
      validatePermissionRule(item, `${path}.${name}[${index}]`, name, role),
    )
  }

  return {
    default: defaultRaw as 'ask' | 'deny',
    allow: lane('allow'),
    ask: lane('ask'),
    deny: lane('deny'),
  }
}

/**
 * Validate one permission rule (closed `tool` + `resource`) in the lane it
 * sits in. After the closed-vocabulary checks, the alpha.2 shell-class
 * contract is enforced HERE (the schema is the enforcement point — H2
 * ruling; A2C-1 extends it from `bash` to the shell class `bash`/`pwsh`,
 * whose rule semantics are identical — plan §5.3):
 *
 * - a shell-class tool + `exact` is rejected in EVERY lane of EVERY
 *   role: an `exact` key is a file key and can never match the tool-level
 *   resource, and alpha.2 has no parameter-level shell matcher — such a
 *   rule would be structurally inert, so it is rejected instead of
 *   silently parsed. The trailing diagnostic is role-aware (the
 *   exec-autonomy-contract review fix): the MEMBER keeps the byte-
 *   identical pre-change text ("supports only the 'any' resource, in the
 *   ask or deny lane"); the LEADER states both legal shapes (ask/deny
 *   'any' in every role; the leader allow-lane whole-tool 'any' under
 *   the mutation-envelope dual gate) instead of the stale pre-PR text
 *   that denied the leader allow-lane exception;
 * - a shell-class tool + `any` is rejected in the ALLOW lane — with ONE
 *   role-scoped exception (exec-autonomy-contract, user ruling
 *   2026-09-18): the LEADER template's allow lane MAY carry a shell-class
 *   rule with the whole-tool `any` resource (an explicit, declared
 *   whole-tool exec authorization — there is NO implicit default-allow;
 *   an absent rule still resolves to `policy.default`). That leader
 *   authorization is INERT at runtime unless the leader's effective
 *   mutation envelope carries the matching exec token (`bash` / `pwsh` —
 *   separate tokens, `bash authority != pwsh authority`): the pre-execute
 *   dual gate downgrades the allow to the `user-approval` ask path
 *   otherwise (fail-closed). MEMBER templates keep the A2C-1 contract
 *   verbatim: a shell-class `any` in the allow lane is rejected (no
 *   positive whole-tool permission for a member shell).
 *
 * The diagnostics are STABLE text (deterministic; no randoms) and
 * parameterized by the tool name: for `bash` the messages are byte-
 * identical to the original H2 text (the H2 pins stay verbatim), and for
 * `pwsh` the same contract is stated for `pwsh` (A2C-1 pins). The
 * member allow-lane rejection (above) keeps its exact pre-change text —
 * the H2 / A2C-1 pins are byte-identical (only the role scope changed).
 * Tests pin the messages verbatim.
 */
function validatePermissionRule(
  raw: unknown,
  path: string,
  lane: 'allow' | 'ask' | 'deny',
  role: 'leader' | 'member',
): PermissionRule {
  const record = assertPlainRecord(raw, `${path} (permission rule)`)
  assertNoUnknownFields(record, PERMISSION_RULE_FIELDS, `${path} (permission rule)`)

  const tool = requireField(record, 'tool', path)
  if (typeof tool !== 'string' || !PERMISSION_TOOL_NAMES.includes(tool)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `permission rule ${path}.tool must be one of ${PERMISSION_TOOL_NAMES.join(' | ')}, got ${JSON.stringify(tool)}`,
      { path: `${path}.tool` },
    )
  }

  const resource = validatePermissionResource(requireField(record, 'resource', path), `${path}.resource`)

  // The shell class (A2C-1): identical rule contract for `bash` and
  // `pwsh` (plan §5.3 — ask/deny on `any` only; no exact in any lane, no
  // positive whole-tool allow). `bash`/`pwsh` are the only tool-level
  // permission tools, so the class check is this two-name membership.
  const isShellTool = tool === 'bash' || tool === 'pwsh'
  if (isShellTool && resource.kind === 'exact') {
    // Role-aware trailing (exec-autonomy-contract review fix): the
    // pre-change diagnostic ("supports only the 'any' resource, in the
    // ask or deny lane") is stale for the LEADER — the leader allow lane
    // now accepts the whole-tool 'any' under the mutation-envelope dual
    // gate. Member keeps its byte-identical pre-change text (pins stay
    // verbatim); the leader half states both legal shapes.
    throw teamContractError(
      'MALFORMED_DTO',
      `permission rule ${path} (lane '${lane}') is rejected: the ${tool} tool does not accept an 'exact' resource in any lane — an exact key is a file key and can never match the ${tool} tool-level resource, and alpha.2 has no parameter-level shell matcher (${role === 'leader' ? "the ask or deny lane for members; the leader allow-lane exception is the whole-tool 'any' rule under the mutation-envelope dual gate — never 'exact'" : `${tool} supports only the 'any' resource, in the ask or deny lane`})`,
      { path: `${path}.resource.kind`, lane },
    )
  }
  // A2C-7 (alpha.2 plan §9): the shell class does not accept a `subtree`
  // resource in any lane — a subtree root is a FILE target (its
  // containment is judged by the pinned `FileSystem.contains` seam over
  // file identities) and can never match the tool-level shell resource;
  // the shell keeps only the whole-tool 'any' resource (ask/deny lanes in
  // every role; the leader allow-lane exception — exec-autonomy-contract,
  // user ruling 2026-09-18 — is the whole-tool 'any' rule ONLY, gated by
  // the leader's mutation envelope; never 'subtree').
  if (isShellTool && resource.kind === 'subtree') {
    throw teamContractError(
      'MALFORMED_DTO',
      `permission rule ${path} (lane '${lane}') is rejected: the ${tool} tool does not accept a 'subtree' resource in any lane — a subtree root is a file target and can never match the ${tool} tool-level resource; the shell class keeps only the 'any' resource (${role === 'leader' ? "the ask or deny lane for members; the leader allow-lane exception is the whole-tool 'any' rule under the mutation-envelope dual gate — never 'subtree'" : `ask or deny lane; ${tool === 'bash' ? 'bash accepts no positive whole-tool allow' : 'see the allow-lane contract for bash'}`})`,
      { path: `${path}.resource.kind`, lane },
    )
  }
  // The allow-lane shell-class rule: rejected for MEMBER templates
  // (A2C-1, diagnostics byte-identical — the H2 / A2C-1 pins stay
  // verbatim); ACCEPTED for the LEADER template (exec-autonomy-contract,
  // user ruling 2026-09-18) — the explicit whole-tool exec authorization,
  // inert at runtime unless the leader's effective mutation envelope
  // carries the matching exec token (the pre-execute dual gate).
  if (isShellTool && resource.kind === 'any' && lane === 'allow' && role !== 'leader') {
    throw teamContractError(
      'MALFORMED_DTO',
      `permission rule ${path} (lane 'allow') is rejected: alpha.2 grants no positive whole-tool permission for ${tool} — the allow lane must not carry a ${tool} rule (no parameter-level allow for shell commands; use the ask or deny lane for { tool: ${tool}, resource: { kind: 'any' } })`,
      { path: `${path}.resource.kind`, lane },
    )
  }
  return { tool: tool as PermissionRule['tool'], resource }
}

/** Validate one permission resource (`exact` with a path, or bare `any`). */
function validatePermissionResource(raw: unknown, path: string): PermissionResource {
  const record = assertPlainRecord(raw, `${path} (permission resource)`)

  const kind = requireField(record, 'kind', path)
  if (typeof kind !== 'string' || !PERMISSION_RESOURCE_KINDS.includes(kind)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `permission resource ${path}.kind must be one of ${PERMISSION_RESOURCE_KINDS.join(' | ')}, got ${JSON.stringify(kind)}`,
      { path: `${path}.kind` },
    )
  }

  if (kind === 'any') {
    // `any` is the whole tool: it must carry NO other field (not even a path).
    const extra = Object.keys(record).filter((key) => key !== 'kind')
    if (extra.length > 0) {
      throw teamContractError(
        'MALFORMED_DTO',
        `permission resource ${path} (kind 'any') must not carry any field other than 'kind': ${extra.sort().join(', ')}`,
        { path, extraFields: extra },
      )
    }
    return { kind: 'any' }
  }

  // kind === 'exact' | 'subtree' (A2C-7) — exactly the fields `kind` +
  // `path`, and the SAME path constraints (string, no control characters,
  // trimmed non-empty, structurally bounded). The subtree kind matches
  // the path itself and every canonical descendant (the containment
  // judgment is the pinned public `FileSystem.contains` seam's — the
  // A5 adapter, never this layer).
  assertNoUnknownFields(record, ['kind', 'path'], `${path} (permission resource)`)
  const pathValue = requireField(record, 'path', path)
  if (typeof pathValue !== 'string') {
    throw teamContractError(
      'MALFORMED_DTO',
      `permission resource ${path}.path must be a non-empty string, got ${pathValue === null ? 'null' : Array.isArray(pathValue) ? 'array' : typeof pathValue}`,
      { path: `${path}.path` },
    )
  }
  if (CONTROL_CHARS.test(pathValue)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `permission resource ${path}.path contains control characters`,
      { path: `${path}.path` },
    )
  }
  // Repo string-field normalization: trimmed, non-empty after trimming,
  // structurally bounded. The trimmed value is the normalized path the
  // A3 resolver matches against.
  const normalized = pathValue.trim()
  if (normalized.length === 0) {
    throw teamContractError(
      'MALFORMED_DTO',
      `permission resource ${path}.path must not be empty`,
      { path: `${path}.path` },
    )
  }
  if (normalized.length > PERMISSION_PATH_MAX_LENGTH) {
    throw teamContractError(
      'MALFORMED_DTO',
      `permission resource ${path}.path exceeds max length ${PERMISSION_PATH_MAX_LENGTH} (${normalized.length})`,
      { path: `${path}.path`, maxLength: PERMISSION_PATH_MAX_LENGTH },
    )
  }
  return kind === 'subtree'
    ? { kind: 'subtree' as const, path: normalized }
    : { kind: 'exact' as const, path: normalized }
}

// ---------------------------------------------------------------------------
// the whole-document validator
// ---------------------------------------------------------------------------

/**
 * Validate a decoded blueprint frontmatter value into a normalized
 * `TeamBlueprintCore`.
 *
 * @param raw - the unknown decoded frontmatter value.
 * @returns the normalized (not yet frozen, not yet hashed) blueprint.
 * @throws `TeamContractError` for every rule violation (see module docs).
 */
export function validateBlueprintDocument(raw: unknown): TeamBlueprintCore {
  // The whole decoded document must be a lossless-JSON value: this rejects
  // YAML tags that decode to non-JSON types (e.g. `!!timestamp` → Date).
  assertRemoteSafeJsonValue(raw)
  const record = assertPlainRecord(raw, 'TeamBlueprint')
  assertNoLegacyFieldsDeep(record, '$')

  // --- schema version -----------------------------------------------------
  const schemaVersion = requireField(record, 'schemaVersion', '$')
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion < 1
  ) {
    throw teamContractError(
      'SCHEMA_VERSION_UNSUPPORTED',
      `blueprint schemaVersion must be a positive integer, got ${JSON.stringify(schemaVersion)}`,
      { schemaVersion: toRemoteSafeDetail(schemaVersion) },
    )
  }
  if (!SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(schemaVersion)) {
    throw teamContractError(
      'SCHEMA_VERSION_MISMATCH',
      `unsupported blueprint schema version ${schemaVersion}; this build supports [${SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.join(', ')}]`,
      {
        schemaVersion,
        supported: [...SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS],
      },
    )
  }

  // The TOP-LEVEL closed field set is version-gated (plan §E.2): a v1
  // document parses against the FROZEN v1 set (the v2 `teamRequirements`
  // field is an unknown field there — the v1 validator is NOT tightened); a
  // v2 document additionally accepts `teamRequirements`.
  const topLevelFields =
    schemaVersion === 3
      ? BLUEPRINT_TOP_LEVEL_FIELDS_V3
      : schemaVersion === 2
        ? BLUEPRINT_TOP_LEVEL_FIELDS_V2
        : BLUEPRINT_TOP_LEVEL_FIELDS
  assertNoUnknownFields(record, topLevelFields, 'TeamBlueprint')

  // --- identity ------------------------------------------------------------
  const blueprintId: BlueprintId = parseBlueprintId(requireField(record, 'blueprintId', '$'))
  const revision: BlueprintRevision = parseBlueprintRevision(requireField(record, 'revision', '$'))

  const displayName = takeString(record, 'displayName', '$', {
    required: false,
    maxLength: DISPLAY_NAME_MAX_LENGTH,
  })
  const description = takeString(record, 'description', '$', {
    required: false,
    maxLength: DESCRIPTION_MAX_LENGTH,
  })

  // --- exactly one complete LeaderTemplate (Architecture §5.3) -------------
  const leader = validateTemplate(
    requireField(record, 'leader', '$'),
    '$.leader',
    'leader',
    schemaVersion,
  )

  // --- 0..N MemberTemplates with unique identity ---------------------------
  const membersRaw = takeArray(record, 'members', '$') ?? []
  const members = membersRaw.map((item, index) =>
    validateTemplate(item, `$.members[${index}]`, 'member', schemaVersion),
  )

  const seenTemplateIds = new Set<string>([leader.templateId])
  for (const member of members) {
    if (seenTemplateIds.has(member.templateId)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `duplicate templateId '${member.templateId}': template identity must be unique across the blueprint (leader included)`,
        { path: '$.members', templateId: member.templateId },
      )
    }
    seenTemplateIds.add(member.templateId)
  }

  // --- capability requirements ---------------------------------------------
  const requirementsRaw = takeArray(record, 'requirements', '$') ?? []
  const requirements: CapabilityRequirement[] = []
  const seenRequirements = new Set<string>()
  requirementsRaw.forEach((item, index) => {
    const req = validateRequirement(item, `$.requirements[${index}]`)
    const key = `${req.domain}\u0000${req.name}`
    if (seenRequirements.has(key)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `duplicate capability requirement '${req.domain}/${req.name}'`,
        { path: `$.requirements[${index}]`, domain: req.domain, name: req.name },
      )
    }
    seenRequirements.add(key)
    requirements.push(req)
  })

  // --- schema-v2 TEAM-level structured requirements (plan §E.2) -------------
  // ABSENT in v1 documents (the field is not in the v1 closed set — an
  // unknown field there fails loudly). In a v2 document it is optional:
  // `undefined` when not declared, a (possibly empty) list when declared.
  const teamRequirementsRaw =
    schemaVersion >= 2 ? takeArray(record, 'teamRequirements', '$') : undefined
  const teamRequirements =
    teamRequirementsRaw === undefined
      ? undefined
      : validateV2Requirements(teamRequirementsRaw, '$.teamRequirements')

  // --- Team autonomy/mutation envelope --------------------------------------
  const teamEnvelopeRaw = takeRecord(record, 'teamEnvelope', '$')
  const teamEnvelope = teamEnvelopeRaw === undefined ? undefined : validateEnvelope(teamEnvelopeRaw, '$.teamEnvelope')

  // --- Member mutation envelopes (template refs must resolve) ---------------
  const memberEnvelopesRaw = takeArray(record, 'memberEnvelopes', '$') ?? []
  const memberEnvelopes: MemberEnvelopeEntry[] = []
  const seenEnvelopeTemplateIds = new Set<string>()
  memberEnvelopesRaw.forEach((item, index) => {
    const entryPath = `$.memberEnvelopes[${index}]`
    const entry = assertPlainRecord(item, `${entryPath} (member envelope entry)`)
    assertNoUnknownFields(entry, BLUEPRINT_MEMBER_ENVELOPE_ENTRY_FIELDS, entryPath)
    const templateId: TemplateId = parseTemplateId(requireField(entry, 'templateId', entryPath))
    if (!seenTemplateIds.has(templateId)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `memberEnvelopes[${index}].templateId '${templateId}' does not resolve to any template in this blueprint`,
        { path: `${entryPath}.templateId`, templateId },
      )
    }
    if (seenEnvelopeTemplateIds.has(templateId)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `duplicate memberEnvelopes entry for templateId '${templateId}'`,
        { path: `${entryPath}.templateId`, templateId },
      )
    }
    seenEnvelopeTemplateIds.add(templateId)
    const envelope = validateEnvelope(requireField(entry, 'envelope', entryPath), `${entryPath}.envelope`)
    memberEnvelopes.push({ templateId, envelope })
  })

  // --- the two authority documents of the shared v3 grammar -------------------
  // ADR A3-9: ONE validator, TWO documents. Both are ABSENT-BY-DEFAULT below
  // v3 — an absent field is a legal typed absence (no declared ceiling), never
  // a read failure — and the key is OMITTED from the core (and therefore the
  // content hash) when absent, the teamRequirements/permissions discipline, so
  // every existing v1/v2 document hashes byte-identically (ADR A2-11).
  //
  // At v3 both become REQUIRED, and each requirement is a distinct fact:
  //  - `permissionMutationEnvelope` was optional at every earlier version and
  //    stops being optional here — "a new hard requirement, not a retention"
  //    (ADR A1-19, spec §3.2);
  //  - `teamHardEnvelope` only exists at v3 and was never optional: "No
  //    implicit default is permitted" (spec §3.2), because a defaulted hard
  //    ceiling would be exactly the implicit wide grant ADR §5.1 forbids.
  // Neither is defaulted when missing: the refusal is typed, before any
  // canonicalization or authority reading exists.
  if (schemaVersion === 3) {
    requireField(record, 'permissionMutationEnvelope', '$')
    requireField(record, 'teamHardEnvelope', '$')
  }
  const permissionMutationEnvelopeRaw = takeRecord(record, 'permissionMutationEnvelope', '$')
  const permissionMutationEnvelope =
    permissionMutationEnvelopeRaw === undefined
      ? undefined
      : validateAuthorityEnvelope(permissionMutationEnvelopeRaw, '$.permissionMutationEnvelope', 'permissionMutationEnvelope')
  const teamHardEnvelopeRaw = takeRecord(record, 'teamHardEnvelope', '$')
  const teamHardEnvelope =
    teamHardEnvelopeRaw === undefined
      ? undefined
      : validateAuthorityEnvelope(teamHardEnvelopeRaw, '$.teamHardEnvelope', 'teamHardEnvelope')

  // --- PolicyState definitions (field refs must resolve) ---------------------
  const policyStatesRaw = takeArray(record, 'policyStates', '$') ?? []
  const policyStates: PolicyStateDefinition[] = []
  const seenPolicyStateIds = new Set<string>()
  policyStatesRaw.forEach((item, index) => {
    const statePath = `$.policyStates[${index}]`
    const state = assertPlainRecord(item, `${statePath} (policy state)`)
    assertNoUnknownFields(state, BLUEPRINT_POLICY_STATE_FIELDS, statePath)
    const id = requireField(state, 'id', statePath)
    if (
      typeof id !== 'string' ||
      id.length > POLICY_STATE_ID_MAX_LENGTH ||
      !POLICY_STATE_ID_PATTERN.test(id)
    ) {
      throw teamContractError(
        'MALFORMED_DTO',
        `field ${statePath}.id must be a lowercase slug (max ${POLICY_STATE_ID_MAX_LENGTH}), got ${JSON.stringify(id)}`,
        { path: `${statePath}.id` },
      )
    }
    if (seenPolicyStateIds.has(id)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `duplicate PolicyState id '${id}'`,
        { path: `${statePath}.id`, id },
      )
    }
    seenPolicyStateIds.add(id)

    const stateDescription = takeString(state, 'description', statePath, {
      required: false,
      maxLength: DESCRIPTION_MAX_LENGTH,
    })

    const fieldsRaw = takeArray(state, 'fields', statePath) ?? []
    const fields = fieldsRaw.map((field, fieldIndex) => {
      if (typeof field !== 'string') {
        throw teamContractError(
          'MALFORMED_DTO',
          `field ${statePath}.fields[${fieldIndex}] must be a string, got ${typeof field}`,
          { path: `${statePath}.fields[${fieldIndex}]` },
        )
      }
      if (!BLUEPRINT_POLICY_REFERENCEABLE_FIELDS.includes(field)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `policy state '${id}' references unknown field '${field}' at ${statePath}.fields[${fieldIndex}]`,
          { path: `${statePath}.fields[${fieldIndex}]`, field },
        )
      }
      return field
    })
    for (let i = 0; i < fields.length; i++) {
      for (let j = i + 1; j < fields.length; j++) {
        if (fields[i] === fields[j]) {
          throw teamContractError(
            'MALFORMED_DTO',
            `policy state '${id}' references field '${fields[i]}' more than once`,
            { path: `${statePath}.fields[${j}]`, field: toRemoteSafeDetail(fields[i]) },
          )
        }
      }
    }

    policyStates.push(stripUndefined({ id, description: stateDescription, fields }))
  })

  // --- quotas ----------------------------------------------------------------
  const quotasRaw = takeRecord(record, 'quotas', '$')
  let quotas: QuotaSpec | undefined
  if (quotasRaw !== undefined) {
    assertNoUnknownFields(quotasRaw, BLUEPRINT_QUOTA_SPEC_FIELDS, '$.quotas')
    const teamRaw = takeRecord(quotasRaw, 'team', '$.quotas')
    const membersRawQuota = takeRecord(quotasRaw, 'members', '$.quotas')
    quotas = stripUndefined({
      team: teamRaw === undefined ? undefined : validateQuota(teamRaw, '$.quotas.team'),
      members: membersRawQuota === undefined ? undefined : validateQuota(membersRawQuota, '$.quotas.members'),
    })
  }

  // --- Team-owned ordinary capability policy ---------------------------------
  const capabilityPolicyRaw = takeRecord(record, 'capabilityPolicy', '$')
  let capabilityPolicy: CapabilityPolicy | undefined
  if (capabilityPolicyRaw !== undefined) {
    const policy: Record<string, 'allow' | 'deny'> = {}
    for (const [domain, decision] of Object.entries(capabilityPolicyRaw)) {
      if (
        domain.length > REQUIREMENT_DOMAIN_MAX_LENGTH ||
        !REQUIREMENT_DOMAIN_PATTERN.test(domain)
      ) {
        throw teamContractError(
          'MALFORMED_DTO',
          `capabilityPolicy domain '${domain}' must be a lowercase slug (max ${REQUIREMENT_DOMAIN_MAX_LENGTH})`,
          { path: `$.capabilityPolicy.${domain}` },
        )
      }
      if (typeof decision !== 'string' || !CAPABILITY_POLICY_DECISIONS.includes(decision)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `capabilityPolicy['${domain}'] must be one of ${CAPABILITY_POLICY_DECISIONS.join(' | ')}, got ${JSON.stringify(decision)}`,
          { path: `$.capabilityPolicy.${domain}` },
      )
      }
      policy[domain] = decision as 'allow' | 'deny'
    }
    capabilityPolicy = policy
  }

  // --- interpretation metadata ------------------------------------------------
  const metadataRaw = takeRecord(record, 'metadata', '$')
  const metadata: Record<string, string> = {}
  if (metadataRaw !== undefined) {
    for (const [key, value] of Object.entries(metadataRaw)) {
      if (key.length > METADATA_KEY_MAX_LENGTH || !METADATA_KEY_PATTERN.test(key)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `metadata key '${key}' is not valid (max ${METADATA_KEY_MAX_LENGTH})`,
          { path: `$.metadata.${key}` },
        )
      }
      if (typeof value !== 'string') {
        throw teamContractError(
          'MALFORMED_DTO',
          `metadata['${key}'] must be a string, got ${typeof value}`,
          { path: `$.metadata.${key}` },
        )
      }
      if (value.length > METADATA_VALUE_MAX_LENGTH) {
        throw teamContractError(
          'MALFORMED_DTO',
          `metadata['${key}'] exceeds max length ${METADATA_VALUE_MAX_LENGTH}`,
          { path: `$.metadata.${key}`, maxLength: METADATA_VALUE_MAX_LENGTH },
        )
      }
      metadata[key] = value.trim()
    }
  }

  const core: Record<string, unknown> = {
    // Stamp the document's OWN version (v1 documents => 1, byte-identical to
    // the pre-§E.2 constant stamp; v2 documents => 2). `stripUndefined` below
    // OMITS the `teamRequirements` key when it is `undefined`, so a v1
    // document's core (and hash) is byte-identical to before §E.2.
    schemaVersion: schemaVersion as 1 | 2 | 3,
    blueprintId,
    revision,
    displayName,
    description,
    leader,
    members,
    requirements,
    ...(teamRequirements !== undefined ? { teamRequirements } : {}),
    teamEnvelope,
    memberEnvelopes,
    // PR4 expansion authority carrier — PRESENT ONLY when declared (the
    // teamRequirements discipline: `stripUndefined` omits the key, so every
    // non-declaring document hashes byte-identically).
    permissionMutationEnvelope,
    // Alpha.4 v3 Human User hard ceiling (ADR A2-2). PRESENT-ONLY, exactly like
    // the carrier above: `stripUndefined` omits the key for every v1/v2
    // document, so the hashable projection of a v1/v2 blueprint is BYTE-
    // IDENTICAL to what it was before v3 existed (ADR A2-11). Writing
    // `teamHardEnvelope: null` for absent documents — the shape the
    // absent-optional-single-field rule might suggest — would instead move
    // every v1/v2 content hash and is exactly what that clause forbids.
    teamHardEnvelope,
    policyStates,
    quotas,
    capabilityPolicy,
    metadata,
  }
  return stripUndefined(core) as unknown as TeamBlueprintCore
}

/**
 * Parse a blueprint source document into a validated, normalized,
 * deeply-frozen `TeamBlueprint` with its derived content hash.
 *
 * Pipeline: frontmatter split → YAML decode → whole-document strong
 * validation → content hash derivation → deep freeze. All-or-nothing:
 * any violation throws `TeamContractError` and no blueprint is returned.
 *
 * @param source - the raw UTF-8 blueprint document text.
 * @returns the immutable `TeamBlueprint`.
 * @throws `TeamContractError` with a closed-code for every violation.
 */
export function parseBlueprint(source: string): TeamBlueprint {
  const doc = splitFrontmatter(source)
  const raw = decodeYamlFrontmatter(doc.frontmatterText)
  const core = validateBlueprintDocument(raw)
  const contentHash = deriveContentHash(toHashableBlueprint(core))
  return deepFreeze({ ...core, contentHash })
}

/**
 * The lossless-JSON hashable projection of a validated blueprint core:
 * every semantic field present, absent optional single fields as explicit
 * `null`, normalized to plain values. This projection — canonicalized by
 * contracts `canonicalJsonStringify` (key-sorted) — is what the content
 * hash binds to, so the content identity is independent of formatting,
 * field order, and the derived hash itself.
 */
export function toHashableBlueprint(core: TeamBlueprintCore): RemoteSafeRecord {
  return {
    schemaVersion: core.schemaVersion,
    blueprintId: core.blueprintId,
    revision: core.revision,
    displayName: core.displayName ?? null,
    description: core.description ?? null,
    leader: toHashableTemplate(core.leader),
    members: core.members.map((member) => toHashableTemplate(member)),
    requirements: core.requirements.map((req) => ({
      domain: req.domain,
      name: req.name,
      optional: req.optional,
    })),
    // Schema-v2 TEAM-level structured requirements. PRESENT ONLY when
    // declared (a v2 document that declares `teamRequirements`); ABSENT in
    // v1 documents and in v2 documents that declare none. The key is omitted
    // (never `null`) so a v1 blueprint hashes byte-identically to before
    // §E.2 — the same "absent => key omitted" discipline as the A1
    // `permissions` key.
    ...(core.teamRequirements !== undefined
      ? {
          teamRequirements: core.teamRequirements.map(toHashableV2Requirement),
        }
      : {}),
    teamEnvelope: core.teamEnvelope === undefined ? null : toHashableEnvelope(core.teamEnvelope),
    memberEnvelopes: core.memberEnvelopes.map((entry) => ({
      templateId: entry.templateId,
      envelope: toHashableEnvelope(entry.envelope),
    })),
    // PR4 expansion authority carrier. PRESENT ONLY when declared (the
    // teamRequirements / permissions "absent ⇒ key omitted" discipline): a
    // document that does not declare it hashes byte-identically to before
    // this field existed. Canonical JSON is key-sorted, so the projection
    // shape (not insertion order) is what the hash binds to.
    ...(core.permissionMutationEnvelope !== undefined
      ? { permissionMutationEnvelope: toHashableAuthorityEnvelope(core.permissionMutationEnvelope) }
      : {}),
    // Alpha.4 v3 Human User hard ceiling. KEY-OMITTED and v3-ONLY — the two
    // facts that keep ADR A2-11's byte-identity promise true: a v1/v2 core
    // never carries the field (the validator only populates it at v3), so the
    // spread contributes NOTHING to its projection and its hash is the hash it
    // had before v3 existed. Projecting it as `null` for absent documents
    // would move every v1/v2 content hash.
    ...(core.teamHardEnvelope !== undefined
      ? { teamHardEnvelope: toHashableAuthorityEnvelope(core.teamHardEnvelope) }
      : {}),
    policyStates: core.policyStates.map((state) => ({
      id: state.id,
      description: state.description ?? null,
      fields: [...state.fields],
    })),
    quotas:
      core.quotas === undefined
        ? null
        : {
            team: core.quotas.team === undefined ? null : toHashableQuota(core.quotas.team),
            members: core.quotas.members === undefined ? null : toHashableQuota(core.quotas.members),
          },
    capabilityPolicy:
      core.capabilityPolicy === undefined ? null : { ...core.capabilityPolicy },
    metadata: { ...core.metadata },
  }
}

function toHashableTemplate(template: BlueprintTemplate): RemoteSafeRecord {
  const record: Record<string, unknown> = {
    templateId: template.templateId,
    displayName: template.displayName ?? null,
    description: template.description ?? null,
    persona: template.persona,
    modelPreference: template.modelPreference ?? null,
    contextPolicy: template.contextPolicy ?? null,
    capabilities:
      template.capabilities === undefined ? null : toHashableCapabilities(template.capabilities),
  }
  // Schema-v2 per-template structured requirements (plan §E.2/§E.3). The key
  // is PRESENT ONLY when the template declares `requirements`; ABSENT for v1
  // templates and for v2 templates that declare none — so a v1 template
  // hashes byte-identically to before §E.2 (the same "absent => key omitted"
  // discipline as the A1 `permissions` key). A declared `requirements`
  // (including an explicit `[]`) projects in declaration order.
  if (template.requirements !== undefined) {
    record['requirements'] = template.requirements.map(toHashableV2Requirement)
  }
  return record as RemoteSafeRecord
}

/**
 * The hashable projection of one schema-v2 structured requirement (all four
 * fields are always concrete after validation: `complete` defaults to
 * `false`, so no `undefined` is ever projected).
 */
function toHashableV2Requirement(requirement: BlueprintRequirement): RemoteSafeRecord {
  return {
    requirementId: requirement.requirementId,
    type: requirement.type,
    subjects: [...requirement.subjects],
    complete: requirement.complete,
  }
}

/**
 * The hashable projection of one capabilities block. The `permissions`
 * key is present ONLY when the policy is present (absent → key omitted,
 * so legacy/alpha.1 blueprints hash byte-identically to before A1), and
 * the lane arrays project in declaration order (hash = content + rule
 * order).
 */
function toHashableCapabilities(caps: TemplateCapabilities): RemoteSafeRecord {
  const projection: RemoteSafeRecord = {
    teamTools: toHashableAllowDeny(caps.teamTools),
    builtinToolDeny: [...caps.builtinToolDeny],
    skills: toHashableAllowDeny(caps.skills),
    mcp: toHashableAllowDeny(caps.mcp),
  }
  // Added only when present: absent → the key is omitted, so legacy
  // alpha.1 blueprints hash byte-identically to before A1. (The canonical
  // JSON sort makes the insertion order of the other keys irrelevant.)
  if (caps.permissions !== undefined) {
    projection.permissions = toHashablePermissionPolicy(caps.permissions)
  }
  return projection
}

function toHashablePermissionPolicy(policy: TemplatePermissionPolicy): RemoteSafeRecord {
  return {
    default: policy.default,
    allow: policy.allow.map(toHashablePermissionRule),
    ask: policy.ask.map(toHashablePermissionRule),
    deny: policy.deny.map(toHashablePermissionRule),
  }
}

function toHashablePermissionRule(rule: PermissionRule): RemoteSafeRecord {
  return {
    tool: rule.tool,
    resource:
      rule.resource.kind === 'any'
        ? { kind: 'any' }
        : { kind: rule.resource.kind, path: rule.resource.path },
  }
}

function toHashableAllowDeny(
  entry: { kind: 'allow'; items: readonly string[] } | { kind: 'deny' },
): RemoteSafeRecord {
  if (entry.kind === 'deny') {
    return { kind: 'deny' }
  }
  return { kind: 'allow', items: [...entry.items] }
}

function toHashableEnvelope(envelope: MutationEnvelope): RemoteSafeRecord {
  return { allow: [...envelope.allow], deny: [...envelope.deny] }
}

/**
 * The hashable projection of ONE authority document. Both v3 authority
 * documents project through this ONE function (ADR A3-9: one grammar, so one
 * projection): rules in DECLARATION order (the hash binds content *and* rule
 * order), each rule `{operationClass, matcher, maximumEffect}`.
 *
 * The projection is byte-identical to the inline projection this field had
 * before v3 existed — extracting the helper changes the code path's NAME, not
 * its output, which is what makes the shared builder safe under ADR A2-11.
 */
function toHashableAuthorityEnvelope(
  envelope: BlueprintPermissionMutationEnvelope,
): RemoteSafeRecord {
  return {
    rules: envelope.rules.map((rule) => ({
      operationClass: rule.operationClass,
      matcher: toHashableEnvelopeMatcher(rule.matcher),
      maximumEffect: rule.maximumEffect,
    })),
  }
}

/**
 * The hashable projection of one PR4 expansion-carrier matcher. Each branch
 * is a SINGLE object literal (no shared-union `path?: undefined` members —
 * the hashable record forbids `undefined` values, and the hash must bind to
 * the DECLARED identity: file matchers carry `path`, exec matchers carry the
 * verbatim `fingerprint`).
 */
function toHashableEnvelopeMatcher(
  matcher: BlueprintPermissionMutationEnvelopeMatcher,
): RemoteSafeRecord {
  if (matcher.kind === 'fingerprint') {
    return { kind: matcher.kind, fingerprint: matcher.fingerprint }
  }
  return { kind: matcher.kind, path: matcher.path }
}

function toHashableQuota(quota: Quota): RemoteSafeRecord {
  return stripUndefined({
    maxInstances: quota.maxInstances ?? null,
    maxConcurrent: quota.maxConcurrent ?? null,
  })
}
