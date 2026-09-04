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
  BLUEPRINT_DOCUMENT_SCHEMA_VERSION,
  BLUEPRINT_ENVELOPE_FIELDS,
  BLUEPRINT_MEMBER_ENVELOPE_ENTRY_FIELDS,
  BLUEPRINT_POLICY_REFERENCEABLE_FIELDS,
  BLUEPRINT_POLICY_STATE_FIELDS,
  BLUEPRINT_QUOTA_FIELDS,
  BLUEPRINT_QUOTA_SPEC_FIELDS,
  BLUEPRINT_REQUIREMENT_FIELDS,
  BLUEPRINT_TEMPLATE_FIELDS,
  BLUEPRINT_TOP_LEVEL_FIELDS,
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
import type {
  BlueprintTemplate,
  CapabilityPolicy,
  CapabilityRequirement,
  MemberEnvelopeEntry,
  MutationEnvelope,
  PolicyStateDefinition,
  Quota,
  QuotaSpec,
  TeamBlueprint,
  TeamBlueprintCore,
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

/** Validate one template (leader or member). Both share one closed schema. */
function validateTemplate(raw: unknown, path: string): BlueprintTemplate {
  const record = assertPlainRecord(raw, `${path} (template)`)
  assertNoUnknownFields(record, BLUEPRINT_TEMPLATE_FIELDS, `${path} (template)`)

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
  const contextPolicy = takeString(record, 'contextPolicy', path, {
    required: false,
    maxLength: CONTEXT_POLICY_MAX_LENGTH,
  })

  return stripUndefined({
    templateId,
    displayName,
    description,
    persona,
    modelPreference,
    contextPolicy,
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
  assertNoUnknownFields(record, BLUEPRINT_TOP_LEVEL_FIELDS, 'TeamBlueprint')

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
  const leader = validateTemplate(requireField(record, 'leader', '$'), '$.leader')

  // --- 0..N MemberTemplates with unique identity ---------------------------
  const membersRaw = takeArray(record, 'members', '$') ?? []
  const members = membersRaw.map((item, index) => validateTemplate(item, `$.members[${index}]`))

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
    schemaVersion: BLUEPRINT_DOCUMENT_SCHEMA_VERSION,
    blueprintId,
    revision,
    displayName,
    description,
    leader,
    members,
    requirements,
    teamEnvelope,
    memberEnvelopes,
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
    teamEnvelope: core.teamEnvelope === undefined ? null : toHashableEnvelope(core.teamEnvelope),
    memberEnvelopes: core.memberEnvelopes.map((entry) => ({
      templateId: entry.templateId,
      envelope: toHashableEnvelope(entry.envelope),
    })),
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
  return stripUndefined({
    templateId: template.templateId,
    displayName: template.displayName ?? null,
    description: template.description ?? null,
    persona: template.persona,
    modelPreference: template.modelPreference ?? null,
    contextPolicy: template.contextPolicy ?? null,
  })
}

function toHashableEnvelope(envelope: MutationEnvelope): RemoteSafeRecord {
  return { allow: [...envelope.allow], deny: [...envelope.deny] }
}

function toHashableQuota(quota: Quota): RemoteSafeRecord {
  return stripUndefined({
    maxInstances: quota.maxInstances ?? null,
    maxConcurrent: quota.maxConcurrent ?? null,
  })
}
