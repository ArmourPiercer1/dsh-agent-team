/**
 * P3-T2 test fixtures: blueprint source documents as TS string constants.
 *
 * Per the T2 ruling, fixtures are embedded as module constants (no `node:fs`
 * in tests). Valid fixtures exercise the full closed v1 schema; negative
 * fixtures each violate exactly one rule so tests can assert the precise
 * `TeamContractError.code`.
 *
 * @module @dsh-agent-team/domain/blueprint/testdata/fixtures
 */

import type { TeamContractErrorCode } from '../../../contracts/src/index.js'

// ---------------------------------------------------------------------------
// minimal valid documents
// ---------------------------------------------------------------------------

/** The smallest closed v1 blueprint (no optional fields present). */
function minimalBlueprintLines(
  blueprintId: string,
  revision: string,
  persona: string,
): string[] {
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${blueprintId}`,
    `revision: "${revision}"`,
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(persona)}`,
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ]
}

/**
 * Build a minimal valid source for one (blueprintId, revision) pair.
 * The persona varies per revision so distinct revisions also carry
 * distinct content hashes.
 */
export function revisionSource(
  blueprintId: string,
  revision: string,
  persona = 'Lead.',
): string {
  return minimalBlueprintLines(blueprintId, revision, persona).join('\n')
}

/** A minimal valid source. */
export const MINIMAL_BLUEPRINT_SOURCE = revisionSource('team.min', '1')

/**
 * The minimal document written with a BOM and CRLF line endings —
 * must normalize to the same blueprint (and content hash) as
 * `MINIMAL_BLUEPRINT_SOURCE`.
 */
export const CRLF_BOM_SOURCE: string =
  '\uFEFF' + minimalBlueprintLines('team.min', '1', 'Lead.').join('\r\n')

// ---------------------------------------------------------------------------
// full valid document (every semantic field populated)
// ---------------------------------------------------------------------------

/** Top-level blocks of the full document, keyed by field name. */
const FULL_BLOCKS: Record<string, string[]> = {
  schemaVersion: ['schemaVersion: 1'],
  blueprintId: ['blueprintId: team.alpha'],
  revision: ['revision: "2"'],
  displayName: ['displayName: Alpha Team'],
  description: ['description: A fully specified example team.'],
  leader: [
    'leader:',
    '  templateId: leader',
    '  displayName: Team Lead',
    '  description: Coordinates the members.',
    '  persona: PERSONA_PLACEHOLDER',
    '  modelPreference: deepseek-v4-pro',
    '  contextPolicy: full-history',
  ],
  members: [
    'members:',
    '  - templateId: researcher',
    '    displayName: Researcher',
    '    description: Gathers sources.',
    '    persona: You research and cite sources.',
    '  - templateId: writer',
    '    persona: You write and edit.',
  ],
  requirements: [
    'requirements:',
    '  - domain: web',
    '    name: search',
    '  - domain: fs',
    '    name: read',
    '    optional: true',
  ],
  teamEnvelope: [
    'teamEnvelope:',
    '  allow:',
    '    - create-member',
    '    - assign-task',
    '  deny:',
    '    - delete-team',
  ],
  memberEnvelopes: [
    'memberEnvelopes:',
    '  - templateId: researcher',
    '    envelope:',
    '      allow:',
    '        - web.search',
    '      deny: []',
    '  - templateId: writer',
    '    envelope:',
    '      allow: []',
    '      deny:',
    '        - fs.write',
  ],
  policyStates: [
    'policyStates:',
    '  - id: active',
    '    description: The team is working.',
    '    fields:',
    '      - leader',
    '      - members',
  ],
  quotas: [
    'quotas:',
    '  team:',
    '    maxInstances: 8',
    '    maxConcurrent: 3',
    '  members:',
    '    maxInstances: 2',
  ],
  capabilityPolicy: ['capabilityPolicy:', '  web: allow', '  fs: deny'],
  metadata: ['metadata:', '  owner: platform', '  locale: en'],
}

const FULL_ORDER: readonly string[] = [
  'schemaVersion',
  'blueprintId',
  'revision',
  'displayName',
  'description',
  'leader',
  'members',
  'requirements',
  'teamEnvelope',
  'memberEnvelopes',
  'policyStates',
  'quotas',
  'capabilityPolicy',
  'metadata',
]

/** A deliberately different top-level key order (hash canonicalization). */
const FULL_ORDER_SHUFFLED: readonly string[] = [
  'revision',
  'metadata',
  'leader',
  'teamEnvelope',
  'quotas',
  'displayName',
  'members',
  'capabilityPolicy',
  'schemaVersion',
  'requirements',
  'description',
  'blueprintId',
  'policyStates',
  'memberEnvelopes',
]

/** Build the full document with a given leader persona and key order. */
function fullBlueprintSource(
  persona: string,
  order: readonly string[] = FULL_ORDER,
): string {
  const quoted = JSON.stringify(persona)
  const lines = order.flatMap((key) =>
    (FULL_BLOCKS[key] ?? []).map((line) =>
      line === '  persona: PERSONA_PLACEHOLDER'
        ? `  persona: ${quoted}`
        : line,
    ),
  )
  return ['---', ...lines, '---', ''].join('\n')
}

/** The full valid document (every semantic field populated). */
export const FULL_BLUEPRINT_SOURCE = fullBlueprintSource(
  'You are the team lead. Delegate, synthesize, and report.',
)

/** The same document with shuffled top-level key order (same hash). */
export const FULL_BLUEPRINT_SOURCE_SHUFFLED = fullBlueprintSource(
  'You are the team lead. Delegate, synthesize, and report.',
  FULL_ORDER_SHUFFLED,
)

/** The same document with a different leader persona (different hash). */
export const FULL_BLUEPRINT_SOURCE_OTHER_PERSONA = fullBlueprintSource(
  'You coordinate a different team.',
)

/** Minimal valid sources for one blueprint id across many revisions. */
export function revisionSeriesSources(
  blueprintId: string,
  revisions: readonly string[],
): string[] {
  return revisions.map((revision) =>
    revisionSource(blueprintId, revision, `Lead of revision ${revision}.`),
  )
}

// ---------------------------------------------------------------------------
// negative fixtures (each violates exactly one rule)
// ---------------------------------------------------------------------------

/** One negative fixture: source + the expected contract error code. */
export interface NegativeFixture {
  readonly name: string
  readonly source: string
  readonly code: TeamContractErrorCode
  /** When set, `error.details?.reason` must equal this. */
  readonly reason?: string
  /** When set, `error.details?.unknownFields` must toEqual this. */
  readonly unknownFields?: readonly string[]
}

export const NEG_UNKNOWN_TOP_LEVEL: NegativeFixture = {
  name: 'unknown top-level field',
  code: 'MALFORMED_DTO',
  unknownFields: ['extraField'],
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'extraField: 1',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_UNKNOWN_NESTED_FIELD: NegativeFixture = {
  name: 'unknown field inside leader template',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    '  model: deepseek-v4',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_SCHEMA_VERSION_UNSUPPORTED: NegativeFixture = {
  name: 'schemaVersion is a string, not a positive integer',
  code: 'SCHEMA_VERSION_UNSUPPORTED',
  source: [
    '---',
    'schemaVersion: "1"',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_SCHEMA_VERSION_MISMATCH: NegativeFixture = {
  name: 'schemaVersion 2 is an integer but unsupported',
  code: 'SCHEMA_VERSION_MISMATCH',
  source: [
    '---',
    'schemaVersion: 2',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_MISSING_LEADER: NegativeFixture = {
  name: 'the exactly-one leader is missing',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_EMPTY_PERSONA: NegativeFixture = {
  name: 'required persona is empty',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: ""',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_TEMPLATE_MISSING_PERSONA: NegativeFixture = {
  name: 'leader template has no persona at all',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_NUMERIC_REVISION: NegativeFixture = {
  name: 'revision decoded as a YAML number',
  code: 'INVALID_BLUEPRINT_REVISION',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: 1',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_BAD_BLUEPRINT_ID: NegativeFixture = {
  name: 'blueprintId contains a reserved @',
  code: 'INVALID_BLUEPRINT_ID',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: "team@alpha"',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_BAD_REVISION: NegativeFixture = {
  name: 'revision contains a reserved @',
  code: 'INVALID_BLUEPRINT_REVISION',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "rev@1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_BAD_TEMPLATE_ID: NegativeFixture = {
  name: 'templateId violates the lowercase slug pattern',
  code: 'INVALID_TEMPLATE_ID',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: Leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_DUPLICATE_MEMBER_TEMPLATE_ID: NegativeFixture = {
  name: 'two member templates share a templateId',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members:',
    '  - templateId: helper',
    '    persona: "Helps."',
    '  - templateId: helper',
    '    persona: "Also helps."',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_MEMBER_TEMPLATE_CLASHES_WITH_LEADER: NegativeFixture = {
  name: 'a member template reuses the leader templateId',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members:',
    '  - templateId: leader',
    '    persona: "Impostor."',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_UNRESOLVED_MEMBER_ENVELOPE: NegativeFixture = {
  name: 'memberEnvelopes references an undeclared template',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes:',
    '  - templateId: ghost',
    '    envelope:',
    '      allow: []',
    '      deny: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_ENVELOPE_ALLOW_DENY_OVERLAP: NegativeFixture = {
  name: 'an operation appears in both allow and deny',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - op.a',
    '  deny:',
    '    - op.a',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_REQUIREMENT_DUPLICATE: NegativeFixture = {
  name: 'duplicate capability requirement (domain, name)',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements:',
    '  - domain: web',
    '    name: search',
    '  - domain: web',
    '    name: search',
    '    optional: true',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_REQUIREMENT_BAD_DOMAIN: NegativeFixture = {
  name: 'requirement domain violates the slug pattern',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements:',
    '  - domain: Web',
    '    name: search',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_POLICY_STATE_BAD_FIELD_REF: NegativeFixture = {
  name: 'policy state references a field that does not exist',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates:',
    '  - id: active',
    '    fields:',
    '      - nonexistent',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_POLICY_STATE_BAD_ID: NegativeFixture = {
  name: 'policy state id violates the slug pattern',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates:',
    '  - id: "Active One"',
    '    fields: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_POLICY_STATE_DUPLICATE_FIELD_REF: NegativeFixture = {
  name: 'policy state references the same field twice',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates:',
    '  - id: active',
    '    fields:',
    '      - leader',
    '      - leader',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_QUOTA_CONCURRENT_GT_INSTANCES: NegativeFixture = {
  name: 'quota maxConcurrent exceeds maxInstances',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'quotas:',
    '  team:',
    '    maxInstances: 2',
    '    maxConcurrent: 3',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_QUOTA_NOT_POSITIVE: NegativeFixture = {
  name: 'quota maxInstances is zero, not positive',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'quotas:',
    '  team:',
    '    maxInstances: 0',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_CAPABILITY_POLICY_BAD_DECISION: NegativeFixture = {
  name: 'capability policy decision outside the closed set',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'capabilityPolicy:',
    '  web: maybe',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_METADATA_NON_STRING_VALUE: NegativeFixture = {
  name: 'metadata value is not a string',
  code: 'MALFORMED_DTO',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata:',
    '  count: 42',
    '---',
    '',
  ].join('\n'),
}

export const NEG_NESTED_MEMBER_ID: NegativeFixture = {
  name: 'legacy memberId smuggled into the leader template',
  code: 'LEGACY_MEMBER_ID_REJECTED',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    '  memberId: legacy-1',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_NON_LOSSLESS_JSON_VALUE: NegativeFixture = {
  name: 'YAML timestamp decodes to a Date (not lossless JSON)',
  code: 'REMOTE_VALUE_NOT_JSON',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata:',
    '  when: !!timestamp 2024-01-01',
    '---',
    '',
  ].join('\n'),
}

export const NEG_CONTENT_HASH_IN_SOURCE: NegativeFixture = {
  name: 'contentHash is derived, never a source field (unknown field)',
  code: 'MALFORMED_DTO',
  unknownFields: ['contentHash'],
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'contentHash: "sha256:0000"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

export const NEG_NON_EMPTY_BODY: NegativeFixture = {
  name: 'a markdown body after the closing delimiter is not allowed',
  code: 'MALFORMED_DTO',
  reason: 'markdown-body-not-allowed',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '# A markdown body must be empty',
    '',
  ].join('\n'),
}

export const NEG_UNCLOSED_FRONTMATTER: NegativeFixture = {
  name: 'the frontmatter is never closed',
  code: 'MALFORMED_DTO',
  reason: 'frontmatter-unclosed',
  source: [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    '',
  ].join('\n'),
}

export const NEG_MISSING_FRONTMATTER: NegativeFixture = {
  name: 'the source does not start with the frontmatter delimiter',
  code: 'MALFORMED_DTO',
  reason: 'frontmatter-missing',
  source: [
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    '---',
    '',
  ].join('\n'),
}

export const NEG_INVALID_YAML: NegativeFixture = {
  name: 'the frontmatter is not valid YAML',
  code: 'MALFORMED_DTO',
  reason: 'yaml-invalid',
  source: [
    '---',
    'schemaVersion: 1',
    'leader: [unclosed',
    '---',
    '',
  ].join('\n'),
}

/** Every negative fixture, for table-driven tests. */
export const NEGATIVE_FIXTURES: readonly NegativeFixture[] = [
  NEG_UNKNOWN_TOP_LEVEL,
  NEG_UNKNOWN_NESTED_FIELD,
  NEG_SCHEMA_VERSION_UNSUPPORTED,
  NEG_SCHEMA_VERSION_MISMATCH,
  NEG_MISSING_LEADER,
  NEG_EMPTY_PERSONA,
  NEG_TEMPLATE_MISSING_PERSONA,
  NEG_NUMERIC_REVISION,
  NEG_BAD_BLUEPRINT_ID,
  NEG_BAD_REVISION,
  NEG_BAD_TEMPLATE_ID,
  NEG_DUPLICATE_MEMBER_TEMPLATE_ID,
  NEG_MEMBER_TEMPLATE_CLASHES_WITH_LEADER,
  NEG_UNRESOLVED_MEMBER_ENVELOPE,
  NEG_ENVELOPE_ALLOW_DENY_OVERLAP,
  NEG_REQUIREMENT_DUPLICATE,
  NEG_REQUIREMENT_BAD_DOMAIN,
  NEG_POLICY_STATE_BAD_FIELD_REF,
  NEG_POLICY_STATE_BAD_ID,
  NEG_POLICY_STATE_DUPLICATE_FIELD_REF,
  NEG_QUOTA_CONCURRENT_GT_INSTANCES,
  NEG_QUOTA_NOT_POSITIVE,
  NEG_CAPABILITY_POLICY_BAD_DECISION,
  NEG_METADATA_NON_STRING_VALUE,
  NEG_NESTED_MEMBER_ID,
  NEG_NON_LOSSLESS_JSON_VALUE,
  NEG_CONTENT_HASH_IN_SOURCE,
  NEG_NON_EMPTY_BODY,
  NEG_UNCLOSED_FRONTMATTER,
  NEG_MISSING_FRONTMATTER,
  NEG_INVALID_YAML,
]
