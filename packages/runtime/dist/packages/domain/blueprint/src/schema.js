/**
 * The closed vNext blueprint document schema.
 *
 * Schema target-first (Development Plan §4.3: "parser mechanics →
 * MIGRATE/REFACTOR, old member schema → REPLACE"): this module pins the
 * TARGET shape a vNext blueprint source document must have. The legacy
 * "one markdown file = one TeamMemberDefinition" product object is replaced
 * by a single closed document that carries a complete TeamBlueprint:
 *
 * ```text
 * TeamBlueprint
 * ├─ schemaVersion / blueprintId / revision / displayName / description
 * ├─ leader            (exactly one complete LeaderTemplate)
 * ├─ members           (0..N MemberTemplates)
 * ├─ requirements      (capability requirements)
 * ├─ teamEnvelope      (Team autonomy/mutation envelope)
 * ├─ memberEnvelopes   (Member mutation envelopes, referencing templates)
 * ├─ policyStates      (PolicyState definitions, optional)
 * ├─ quotas            (instance/team quotas)
 * ├─ capabilityPolicy  (Team-owned ordinary capability policy)
 * └─ metadata          (interpretation metadata, string→string)
 * ```
 *
 * Every field set below is CLOSED: a field outside the frozen set is an
 * error (`MALFORMED_DTO`), and the document's `schemaVersion` must be in
 * `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` or the parse fails loudly
 * (`SCHEMA_VERSION_UNSUPPORTED` / `SCHEMA_VERSION_MISMATCH`). The
 * `contentHash` is NOT a source field: it is derived by the domain from the
 * validated content (machine content identity, Architecture §5.2) and a
 * source document that declares it is rejected as an unknown field.
 *
 * A blueprint source document is a YAML frontmatter block followed by an
 * (empty) markdown body — the frontmatter mechanism is borrowed algorithmically
 * from the legacy parser (Development Plan §4.3), but the vNext body must be
 * empty: all blueprint semantics, including every persona, are structured
 * fields, never freeform prose.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/blueprint/schema
 */
/** The blueprint document schema version stamped by v1 documents. */
export const BLUEPRINT_DOCUMENT_SCHEMA_VERSION = 1;
/**
 * All blueprint document schema versions this build parses. A document
 * `schemaVersion` outside this set fails loudly.
 */
export const SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [1];
/**
 * The exact closed field set of a blueprint document (top level).
 * Order is presentation only; validation never depends on it.
 */
export const BLUEPRINT_TOP_LEVEL_FIELDS = [
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
];
/**
 * The exact closed field set of a LeaderTemplate and a MemberTemplate
 * (the two share one schema; the Leader is distinguished by position,
 * Architecture §6.1).
 */
export const BLUEPRINT_TEMPLATE_FIELDS = [
    'templateId',
    'displayName',
    'description',
    'persona',
    'modelPreference',
    'contextPolicy',
];
/** The exact closed field set of a capability requirement. */
export const BLUEPRINT_REQUIREMENT_FIELDS = ['domain', 'name', 'optional'];
/** The exact closed field set of a mutation envelope. */
export const BLUEPRINT_ENVELOPE_FIELDS = ['allow', 'deny'];
/** The exact closed field set of a member envelope entry. */
export const BLUEPRINT_MEMBER_ENVELOPE_ENTRY_FIELDS = ['templateId', 'envelope'];
/** The exact closed field set of a PolicyState definition. */
export const BLUEPRINT_POLICY_STATE_FIELDS = ['id', 'description', 'fields'];
/** The exact closed field set of the quotas block. */
export const BLUEPRINT_QUOTA_SPEC_FIELDS = ['team', 'members'];
/** The exact closed field set of one quota. */
export const BLUEPRINT_QUOTA_FIELDS = ['maxInstances', 'maxConcurrent'];
/**
 * The blueprint top-level fields a PolicyState definition may reference in
 * its `fields` list (Architecture §5.5: "PolicyState 不引用不存在的字段").
 * Identity/triple fields (schemaVersion, blueprintId, revision) are not
 * policy-referenceable: policy states operate on Blueprint-owned semantics.
 */
export const BLUEPRINT_POLICY_REFERENCEABLE_FIELDS = [
    'leader',
    'members',
    'requirements',
    'teamEnvelope',
    'memberEnvelopes',
    'policyStates',
    'quotas',
    'capabilityPolicy',
    'metadata',
    'displayName',
    'description',
];
/** The only values a capability policy may map a domain to. */
export const CAPABILITY_POLICY_DECISIONS = ['allow', 'deny'];
/** Frontmatter delimiter line (borrowed from the legacy parser mechanism). */
export const FRONTMATTER_DELIMITER = '---';
/** Max length of a display name field. */
export const DISPLAY_NAME_MAX_LENGTH = 128;
/** Max length of a description field. */
export const DESCRIPTION_MAX_LENGTH = 4096;
/** Max length of a persona (prose) field. */
export const PERSONA_MAX_LENGTH = 32768;
/** Max length of a model preference token. */
export const MODEL_PREFERENCE_MAX_LENGTH = 128;
/** Max length of a context policy token. */
export const CONTEXT_POLICY_MAX_LENGTH = 64;
/** Max length of a capability requirement domain. */
export const REQUIREMENT_DOMAIN_MAX_LENGTH = 64;
/** Max length of a capability requirement name. */
export const REQUIREMENT_NAME_MAX_LENGTH = 128;
/** Max length of a PolicyState id. */
export const POLICY_STATE_ID_MAX_LENGTH = 64;
/** Max length of one envelope operation token. */
export const ENVELOPE_OPERATION_MAX_LENGTH = 128;
/** Max length of a metadata key. */
export const METADATA_KEY_MAX_LENGTH = 64;
/** Max length of a metadata value. */
export const METADATA_VALUE_MAX_LENGTH = 4096;
/** Capability requirement domain: lowercase slug (probeable domain name). */
export const REQUIREMENT_DOMAIN_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
/** Capability requirement name: lowercase slug with dots (e.g. `node.fs`). */
export const REQUIREMENT_NAME_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/;
/** PolicyState id: lowercase slug. */
export const POLICY_STATE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
/** Envelope operation token: lowercase slug with dots/underscores. */
export const ENVELOPE_OPERATION_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/;
/** Metadata key: starts alphanumeric, then alphanumerics, dot, underscore, dash. */
export const METADATA_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/;
//# sourceMappingURL=schema.js.map