/**
 * The vNext domain package's blueprint module: parsing, strong validation,
 * derived content hashing, snapshot refs, and the read-only catalog.
 *
 * Everything here is pure domain code: no I/O, no `node:` builtins, no
 * DSH imports — only contracts v1 (via relative sources) and the standard
 * `yaml` parser.
 *
 * @module @dsh-agent-team/domain/blueprint
 */
export { BLUEPRINT_DOCUMENT_SCHEMA_VERSION, BLUEPRINT_ENVELOPE_FIELDS, BLUEPRINT_MEMBER_ENVELOPE_ENTRY_FIELDS, BLUEPRINT_POLICY_REFERENCEABLE_FIELDS, BLUEPRINT_POLICY_STATE_FIELDS, BLUEPRINT_QUOTA_FIELDS, BLUEPRINT_QUOTA_SPEC_FIELDS, BLUEPRINT_REQUIREMENT_FIELDS, BLUEPRINT_TEMPLATE_FIELDS, BLUEPRINT_TOP_LEVEL_FIELDS, CAPABILITY_POLICY_DECISIONS, CONTEXT_POLICY_MAX_LENGTH, DESCRIPTION_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH, ENVELOPE_OPERATION_MAX_LENGTH, ENVELOPE_OPERATION_PATTERN, FRONTMATTER_DELIMITER, METADATA_KEY_MAX_LENGTH, METADATA_KEY_PATTERN, METADATA_VALUE_MAX_LENGTH, MODEL_PREFERENCE_MAX_LENGTH, PERSONA_MAX_LENGTH, POLICY_STATE_ID_MAX_LENGTH, POLICY_STATE_ID_PATTERN, REQUIREMENT_DOMAIN_MAX_LENGTH, REQUIREMENT_DOMAIN_PATTERN, REQUIREMENT_NAME_MAX_LENGTH, REQUIREMENT_NAME_PATTERN, SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS, } from './schema.js';
export { decodeYamlFrontmatter, splitFrontmatter } from './parse.js';
export { deriveContentHash, sha256Hex } from './hash.js';
export { parseBlueprint, toHashableBlueprint, validateBlueprintDocument } from './validate.js';
export { blueprintSnapshotKeyOf, toBlueprintSnapshotRef } from './snapshot.js';
export { createBlueprintCatalog, createBlueprintCatalogFromSource, } from './catalog.js';
//# sourceMappingURL=index.js.map