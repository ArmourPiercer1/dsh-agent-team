/**
 * P3-T2 test fixtures: blueprint source documents as TS string constants.
 *
 * Per the T2 ruling, fixtures are embedded as module constants (no `node:fs`
 * in tests). Valid fixtures exercise the full closed schema; negative fixtures
 * each violate exactly one rule so tests can assert the precise
 * `TeamContractError.code`.
 *
 * VERSION — the §7.4 fixture migration, done here rather than at the §7.3 flip.
 * These documents are v3. They were v1 because this file predates v2 and v3,
 * not because anything needs a retired document: every fixture here is a
 * POSITIVE control for identity, hashing, cataloguing and the refusal
 * taxonomy, and §7.3 option A (PR #161) removed the last grammar dependency
 * that made an older digit load-bearing. Two fixtures keep their digit because
 * the digit IS the claim, and both say so at their sites:
 *   - `NEG_SCHEMA_VERSION_UNSUPPORTED` — the version's TYPE is the claim, so the
 *     stamp stays a quoted string; it is re-stamped to the current digit to
 *     keep exactly ONE reason to refuse rather than two.
 *   - `NEG_SCHEMA_VERSION_MISMATCH` — a NEVER-DEFINED version is the claim, so
 *     it is neither promotable (promoted, the document is simply valid) nor
 *     invertible into a retired-version refusal; it moves to the typed code
 *     position `SCHEMA_VERSION_NEVER_DEFINED` and emits the same bytes.
 *
 * The two v3 authority documents appear in every promoted document as the
 * ZERO POSITION `rules: []`, never as a permissive filler rule. What that zero
 * actually says, per plane — both readings are pinned in production code, not
 * inferred here:
 *   - `permissionMutationEnvelope: { rules: [] }` — on the EXPANSION plane an
 *     unmatched scope is `no-authority` (`effectiveAuthorityCeiling`,
 *     domain/authority-envelope: "`rules: []` therefore means this actor may
 *     expand nothing"). So the Leader can never widen a member's permissions.
 *   - `teamHardEnvelope: { rules: [] }` — the same `no-authority` reading for a
 *     Leader-driven expansion; on the APPROVAL plane the same absence is the
 *     IDENTITY (`bindingDocs`: a missing rule imposes no narrowing), so a Human
 *     User approving a concrete operation is unimpeded.
 * That position is INERT in exactly one world: a Team that never asks to expand
 * anything — permissions come only from the static Blueprint lanes, nothing is
 * ever mutated, and no rising-authority proposal is made. Every fixture in this
 * file lives in that world; none of them exercises the mutation plane. It is
 * NOT inert in general, and a future fixture that does exercise expansion must
 * declare real rules instead of inheriting this pair.
 *
 * WHY THE PAIR IS NOT IN ALL OF THEM: three fixtures (`NEG_UNCLOSED_FRONTMATTER`,
 * `NEG_MISSING_FRONTMATTER`, `NEG_INVALID_YAML`) never become a document at all
 * — they die in `splitFrontmatter` / `decodeYaml` — so an authority document in
 * them would be bytes no reader can reach, and their digit is pure decoration.
 * Conversely, every fixture that reaches the field stage carries the pair even
 * when its own defect fires earlier: a promoted document that omits a REQUIRED
 * v3 field violates two rules, and a fixture that violates two rules while its
 * test pins one has stopped meaning what it says.
 *
 * @module @dsh-agent-team/domain/blueprint/testdata/fixtures
 */

import type { TeamContractErrorCode } from '../../../contracts/src/index.js'

// ---------------------------------------------------------------------------
// minimal valid documents
// ---------------------------------------------------------------------------

/**
 * The smallest closed document at the version this build declares: identity,
 * leader and the empty collections, plus the two REQUIRED v3 authority
 * documents at their zero position (see the file header for what `rules: []`
 * says and the one world in which it is inert). Every optional field is
 * absent; the two authority documents are not optional at v3.
 */
function minimalBlueprintLines(
  blueprintId: string,
  revision: string,
  persona: string,
): string[] {
  return [
    '---',
    'schemaVersion: 3',
    `blueprintId: ${blueprintId}`,
    `revision: "${revision}"`,
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(persona)}`,
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
  schemaVersion: ['schemaVersion: 3'],
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
  permissionMutationEnvelope: ['permissionMutationEnvelope:', '  rules: []'],
  teamHardEnvelope: ['teamHardEnvelope:', '  rules: []'],
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
  'permissionMutationEnvelope',
  'teamHardEnvelope',
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
  'permissionMutationEnvelope',
  'teamHardEnvelope',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: "3"',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n'),
}

/**
 * A version number OUTSIDE every defined set, for the "well-formed integer the
 * build does not know" negative. The digit IS this fixture's claim: `4` is not
 * v1, not v2, not v3 — it was never a defined document version — so the refusal
 * is `SCHEMA_VERSION_MISMATCH` both under the PR1-PR6 bridge `[1, 2, 3]` and
 * after §7.3's collapse to `[3]`, and it never becomes the MIGRATION_REQUIRED
 * refusal that a RETIRED (once-defined) version gets at the runtime boundary.
 * That is why this one cannot be promoted to v3: promoted, the document would
 * simply be VALID and the test would assert nothing.
 *
 * It lives at a code position rather than in the YAML string for one reason: the
 * §7.3 version fence keys any `schemaVersion: <digit>` literal in a file that
 * also keys `blueprintId`, so a never-defined witness reads as an un-migrated
 * document. Moving it here changes the CARRIER and not the BYTES — the emitted
 * frontmatter line is byte-for-byte the one it always emitted. Same treatment as
 * `NEVER_DEFINED_VERSION` in `packages/domain/test/bp1-blueprint-inspector.test.ts`.
 * If the defined set ever widens to include this number, the witness moves; the
 * intent does not.
 */
const SCHEMA_VERSION_NEVER_DEFINED = 4

export const NEG_SCHEMA_VERSION_MISMATCH: NegativeFixture = {
  // Pre-§E.2 this pinned `schemaVersion: 2` (then unsupported). §E.2 makes
  // v2 SUPPORTED, so the "integer but unsupported" negative moves to v3 —
  // the intent (a well-formed integer outside the supported set fails
  // loudly with SCHEMA_VERSION_MISMATCH) is preserved, and the supported
  // set stays exactly [1, 2].
  //
  // A4-PR1 applies the SAME recorded move: ADR A2-11 widens the TEMPORARY
  // PR1-PR6 bridge set to [1, 2, 3], so v3 stops being a witness of "outside
  // the supported set" and the negative moves to v4. Only the witness value
  // moves; the intent is untouched. What is NOT pinned here is the `supported`
  // detail the error carries: it is DERIVED from
  // `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS`, so it is pinned AT THE CONSTANT —
  // V1 of a4p1-blueprint-v3-governance.test.ts asserts `error.details.supported`
  // equals the constant for this very fixture, which is what stops a widening
  // (or PR7's collapse to `[3]`) from stranding an old list inside a message an
  // operator reads. This fixture pins the witness value and the code.
  name: 'schemaVersion 4 is an integer but unsupported',
  code: 'SCHEMA_VERSION_MISMATCH',
  source: [
    '---',
    `schemaVersion: ${SCHEMA_VERSION_NEVER_DEFINED}`,
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
    'schemaVersion: 3',
    'blueprintId: team.min',
    'revision: "1"',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: ""',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
    'blueprintId: team.min',
    'revision: 1',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
    'blueprintId: "team@alpha"',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
    'blueprintId: team.min',
    'revision: "rev@1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: Leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
    'blueprintId: team.min',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
    'schemaVersion: 3',
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
    'schemaVersion: 3',
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
    'schemaVersion: 3',
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
