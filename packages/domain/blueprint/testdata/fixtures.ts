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

// ---------------------------------------------------------------------------
// alpha.2 A1 — permission policy fixtures
// ---------------------------------------------------------------------------

/**
 * Build a valid blueprint source whose leader `capabilities` carries the
 * four alpha.1 sub-fields (all empty allows) plus — when given — a
 * `permissions` block. `permissionLines` are the `permissions:` mapping
 * lines already indented at the capabilities level; an empty array omits
 * the block entirely (permissions absent = legacy behavior).
 */
function permissionBlueprintSource(permissionLines: string[]): string {
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items: []',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    ...permissionLines,
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/** A full `permissions:` block (default: ask) with all three lanes.
 *
 * NOTE (H2 ruling): the former allow-lane `bash` + `any` rule was REMOVED —
 * the schema now rejects a positive whole-tool grant for bash in the allow
 * lane (bash is legal only as `any` in the `ask`/`deny` lanes, and never
 * with an `exact` resource in any lane).
 */
const PERMISSION_LINES_ASK: string[] = [
  '    permissions:',
  '      default: ask',
  '      allow:',
  '        - tool: read',
  '          resource:',
  '            kind: exact',
  '            path: "/data/notes.md"',
  '      ask:',
  '        - tool: write',
  '          resource:',
  '            kind: exact',
  '            path: "/data/notes.md"',
  '      deny:',
  '        - tool: lsp',
  '          resource:',
  '            kind: any',
]

/** Valid: a capabilities block with a `default: ask` permission policy. */
export const PERMISSION_SOURCE_ASK = permissionBlueprintSource(PERMISSION_LINES_ASK)

/** Valid: the same policy with `default: deny`. */
export const PERMISSION_SOURCE_DENY = permissionBlueprintSource([
  '    permissions:',
  '      default: deny',
  '      allow:',
  '        - tool: read',
  '          resource:',
  '            kind: exact',
  '            path: "/data/notes.md"',
  '      ask: []',
  '      deny: []',
])

/** Valid: capabilities present but `permissions` ABSENT (legacy). */
export const PERMISSION_SOURCE_NO_POLICY = permissionBlueprintSource([])

/**
 * Valid: the `default: ask` policy written with shuffled object-key order
 * (lane order `ask`/`deny`/`default`/`allow`, and `resource` before
 * `tool` inside every rule). Same semantic content and same array order
 * as `PERMISSION_SOURCE_ASK` → identical normalized policy + hash.
 * (H2 ruling: the former allow-lane `bash` + `any` rule was removed with
 * the parent fixture — the allow lane no longer carries a positive
 * whole-tool bash grant.)
 */
export const PERMISSION_SOURCE_ASK_KEY_SHUFFLED = permissionBlueprintSource([
  '    permissions:',
  '      ask:',
  '        - resource:',
  '            kind: exact',
  '            path: "/data/notes.md"',
  '          tool: write',
  '      deny:',
  '        - resource:',
  '            kind: any',
  '          tool: lsp',
  '      default: ask',
  '      allow:',
  '        - resource:',
  '            kind: exact',
  '            path: "/data/notes.md"',
  '          tool: read',
])

/**
 * Valid: duplicate rules — the SAME rule twice in the `allow` lane and
 * once more in the `ask` lane. Duplicates are legal; normalization keeps
 * declaration order (no de-dup, no reordering).
 */
export const PERMISSION_SOURCE_DUPLICATES = permissionBlueprintSource([
  '    permissions:',
  '      default: ask',
  '      allow:',
  '        - tool: read',
  '          resource:',
  '            kind: exact',
  '            path: "/a.txt"',
  '        - tool: read',
  '          resource:',
  '            kind: exact',
  '            path: "/a.txt"',
  '      ask:',
  '        - tool: read',
  '          resource:',
  '            kind: exact',
  '            path: "/a.txt"',
  '      deny: []',
])

/**
 * Valid: the minimal shell permission (plan §4) — bash at tool level via
 * the `any` resource, nothing else declared.
 */
export const PERMISSION_SOURCE_BASH_ANY = permissionBlueprintSource([
  '    permissions:',
  '      default: ask',
  '      allow: []',
  '      ask: []',
  '      deny:',
  '        - tool: bash',
  '          resource:',
  '            kind: any',
])

/** One `permissions:` block with a single violation (shared sub-fields valid). */
function permissionNegativeSource(permissionLines: string[]): string {
  return permissionBlueprintSource(permissionLines)
}

export const NEG_PERMISSION_DEFAULT_ALLOW: NegativeFixture = {
  name: 'permission policy default is "allow" (rejected: no silent privilege expansion)',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: allow',
    '      allow: []',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_DEFAULT_MISSING: NegativeFixture = {
  name: 'permission policy is missing the required default',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      allow: []',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_DEFAULT_NOT_STRING: NegativeFixture = {
  name: 'permission policy default is not a string',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: true',
    '      allow: []',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_LANE_MISSING: NegativeFixture = {
  name: 'permission policy is missing a required lane (allow)',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_LANE_NOT_ARRAY: NegativeFixture = {
  name: 'permission policy lane is not an array',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow: "read"',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_POLICY_UNKNOWN_FIELD: NegativeFixture = {
  name: 'unknown field on the permission policy',
  code: 'MALFORMED_DTO',
  unknownFields: ['allowAll'],
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow: []',
    '      ask: []',
    '      deny: []',
    '      allowAll: true',
  ]),
}

export const NEG_PERMISSION_RULE_UNKNOWN_FIELD: NegativeFixture = {
  name: 'unknown field on a permission rule',
  code: 'MALFORMED_DTO',
  unknownFields: ['note'],
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: exact',
    '            path: "/a.txt"',
    '          note: "why"',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_RULE_MISSING_TOOL: NegativeFixture = {
  name: 'permission rule is missing the required tool',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - resource:',
    '            kind: exact',
    '            path: "/a.txt"',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_RULE_MISSING_RESOURCE: NegativeFixture = {
  name: 'permission rule is missing the required resource',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_UNKNOWN_TOOL: NegativeFixture = {
  name: 'permission rule names an unsupported tool',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: grep',
    '          resource:',
    '            kind: exact',
    '            path: "/a.txt"',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_RESOURCE_UNKNOWN_KIND: NegativeFixture = {
  name: 'permission resource kind is outside the closed vocabulary (glob is not A1)',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: glob',
    '            path: "/data"',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_EXACT_MISSING_PATH: NegativeFixture = {
  name: 'exact permission resource is missing its path',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: exact',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_EXACT_EMPTY_PATH: NegativeFixture = {
  name: 'exact permission resource path is empty',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: exact',
    '            path: ""',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_EXACT_EXTRA_FIELD: NegativeFixture = {
  name: 'exact permission resource carries a field other than kind + path',
  code: 'MALFORMED_DTO',
  unknownFields: ['glob'],
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: exact',
    '            path: "/a.txt"',
    '            glob: true',
    '      ask: []',
    '      deny: []',
  ]),
}

// NOTE (H2 ruling): these two fixtures use `read` (not `bash`) so they
// keep violating EXACTLY one rule — a `bash` + `any` rule in the allow
// lane would now ALSO trip the bash-contract ruling (no positive whole-
// tool bash grant), making the fixture doubly invalid.
export const NEG_PERMISSION_ANY_WITH_PATH: NegativeFixture = {
  name: 'any permission resource carries a path (any must be bare)',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: any',
    '            path: "/bin"',
    '      ask: []',
    '      deny: []',
  ]),
}

export const NEG_PERMISSION_ANY_EXTRA_FIELD: NegativeFixture = {
  name: 'any permission resource carries another extra field (any must be bare)',
  code: 'MALFORMED_DTO',
  source: permissionNegativeSource([
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: any',
    '            scope: all',
    '      ask: []',
    '      deny: []',
  ]),
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
  NEG_PERMISSION_DEFAULT_ALLOW,
  NEG_PERMISSION_DEFAULT_MISSING,
  NEG_PERMISSION_DEFAULT_NOT_STRING,
  NEG_PERMISSION_LANE_MISSING,
  NEG_PERMISSION_LANE_NOT_ARRAY,
  NEG_PERMISSION_POLICY_UNKNOWN_FIELD,
  NEG_PERMISSION_RULE_UNKNOWN_FIELD,
  NEG_PERMISSION_RULE_MISSING_TOOL,
  NEG_PERMISSION_RULE_MISSING_RESOURCE,
  NEG_PERMISSION_UNKNOWN_TOOL,
  NEG_PERMISSION_RESOURCE_UNKNOWN_KIND,
  NEG_PERMISSION_EXACT_MISSING_PATH,
  NEG_PERMISSION_EXACT_EMPTY_PATH,
  NEG_PERMISSION_EXACT_EXTRA_FIELD,
  NEG_PERMISSION_ANY_WITH_PATH,
  NEG_PERMISSION_ANY_EXTRA_FIELD,
  NEG_NESTED_MEMBER_ID,
  NEG_NON_LOSSLESS_JSON_VALUE,
  NEG_CONTENT_HASH_IN_SOURCE,
  NEG_NON_EMPTY_BODY,
  NEG_UNCLOSED_FRONTMATTER,
  NEG_MISSING_FRONTMATTER,
  NEG_INVALID_YAML,
]
