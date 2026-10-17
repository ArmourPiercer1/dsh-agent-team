/**
 * The vNext domain package's blueprint module: parsing, strong validation,
 * derived content hashing, snapshot refs, and the read-only catalog.
 *
 * Everything here is pure domain code: no I/O, no `node:` builtins, no
 * DSH imports — only contracts v1 (via relative sources), the standard
 * `yaml` parser, and the sibling domain compatibility requirement-type
 * vocabulary (plan §E.2 reuses the frozen §27.1 six-set for v2 requirement
 * `type`, so the closed set never forks).
 *
 * @module @dsh-agent-team/domain/blueprint
 */
export { BLUEPRINT_AUTHORITY_ENVELOPE_EXEC_MATCHER_FIELDS, BLUEPRINT_AUTHORITY_ENVELOPE_FIELDS, BLUEPRINT_AUTHORITY_ENVELOPE_FILE_MATCHER_FIELDS, BLUEPRINT_AUTHORITY_ENVELOPE_MATCHER_KINDS, BLUEPRINT_AUTHORITY_ENVELOPE_MAX_EFFECTS, BLUEPRINT_AUTHORITY_ENVELOPE_RULE_FIELDS, BLUEPRINT_DOCUMENT_SCHEMA_VERSION, BLUEPRINT_ENVELOPE_FIELDS, BLUEPRINT_MEMBER_ENVELOPE_ENTRY_FIELDS, BLUEPRINT_POLICY_REFERENCEABLE_FIELDS, BLUEPRINT_POLICY_STATE_FIELDS, BLUEPRINT_QUOTA_FIELDS, BLUEPRINT_QUOTA_SPEC_FIELDS, BLUEPRINT_REQUIREMENT_FIELDS, BLUEPRINT_TEMPLATE_FIELDS, BLUEPRINT_TEMPLATE_FIELDS_V2, BLUEPRINT_TOP_LEVEL_FIELDS, BLUEPRINT_TOP_LEVEL_FIELDS_V2, BLUEPRINT_TOP_LEVEL_FIELDS_V3, BLUEPRINT_V2_REQUIREMENT_FIELDS, CAPABILITY_POLICY_DECISIONS, CONTEXT_POLICY_MAX_LENGTH, DESCRIPTION_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH, ENVELOPE_OPERATION_MAX_LENGTH, ENVELOPE_OPERATION_PATTERN, FRONTMATTER_DELIMITER, METADATA_KEY_MAX_LENGTH, METADATA_KEY_PATTERN, METADATA_VALUE_MAX_LENGTH, MODEL_PREFERENCE_MAX_LENGTH, PERSONA_MAX_LENGTH, PERMISSION_PATH_MAX_LENGTH, PERMISSION_FINGERPRINT_MAX_LENGTH, PERMISSION_POLICY_DEFAULTS, PERMISSION_POLICY_FIELDS, PERMISSION_RESOURCE_KINDS, PERMISSION_RULE_FIELDS, PERMISSION_TOOL_NAMES, POLICY_STATE_ID_MAX_LENGTH, POLICY_STATE_ID_PATTERN, REQUIREMENT_DOMAIN_MAX_LENGTH, REQUIREMENT_DOMAIN_PATTERN, REQUIREMENT_NAME_MAX_LENGTH, REQUIREMENT_NAME_PATTERN, SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS, 
// A4-PR7 Task 7.1: the version HISTORY (what this product ever defined) and
// the DERIVED retired set. Both are exported because the discovery surface
// (the plugin's Blueprint authority, and behind it the remote v8 catalog) must
// classify a document as "needs migration" without re-deriving the rule — a
// second copy of that rule is a second answer, and the copy is what goes stale.
DEFINED_BLUEPRINT_DOCUMENT_VERSIONS, RETIRED_BLUEPRINT_DOCUMENT_VERSIONS, 
// …and the two typed refusal names (ADR A1-21). A runtime lane that refuses a
// document by version throws one of THESE; a literal spelling of the same name
// in a second file is the fork A1-21 exists to prevent.
BLUEPRINT_VERSION_REFUSAL_CODES, BLUEPRINT_VERSION_REFUSAL_CODE_VALUES, } from './schema.js';
export { decodeYamlFrontmatter, splitFrontmatter } from './parse.js';
export { declaredBlueprintSchemaVersion, inspectBlueprintSource } from './inspect.js';
export { deriveContentHash, sha256Hex } from './hash.js';
export { parseBlueprint, toHashableBlueprint, validateBlueprintDocument, } from './validate.js';
// VNEXT-SCHEMA reversible half (ADR M-1/M-2/M-4): the DORMANT v4 authoring
// grammar (SUPPORTED stays [3] — nothing shipped dispatches here) and the
// read-only migration report. Additive; the frozen v3 surface above is
// untouched.
export { BLUEPRINT_V4_AUTHORIZATIONS, BLUEPRINT_V4_EXECUTION_BOUNDARIES, BLUEPRINT_V4_EXECUTION_FIELDS, BLUEPRINT_V4_IMPLEMENTATION_ORIGINS, BLUEPRINT_V4_IO_FIELDS, BLUEPRINT_V4_IO_RW_FIELDS_BY_MODE, BLUEPRINT_V4_IO_RW_MODES, BLUEPRINT_V4_NETWORK_DEFAULTS, BLUEPRINT_V4_NETWORK_FIELDS_BY_MODE, BLUEPRINT_V4_NETWORK_MODES, BLUEPRINT_V4_REMOVED_FIELDS, BLUEPRINT_V4_SCHEMA_VERSION, BLUEPRINT_V4_TOOL_BINDING_FAMILY, BLUEPRINT_V4_TOOL_BINDING_FIELDS, BLUEPRINT_V4_TOP_LEVEL_FIELDS, V4_PROBLEM_CODES, parseBlueprintV4, toHashableBlueprintV4, validateBlueprintV4Document, } from './blueprint-v4.js';
export { MIGRATION_PERMISSION_WIDENING, planBlueprintV3toV4Migration, } from './migration-report.js';
export { parseModelPreferenceToken, } from './model-preference.js';
export { blueprintSnapshotKeyOf, toBlueprintSnapshotRef } from './snapshot.js';
export { blueprintNotFound, compareBlueprintRevisions, createBlueprintCatalog, createBlueprintCatalogFromSource, } from './catalog.js';
//# sourceMappingURL=index.js.map