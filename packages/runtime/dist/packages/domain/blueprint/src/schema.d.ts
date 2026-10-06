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
export declare const BLUEPRINT_DOCUMENT_SCHEMA_VERSION: 1;
/**
 * All blueprint document schema versions this build parses. A document
 * `schemaVersion` outside this set fails loudly.
 *
 * `1` = the frozen v1 document (the flat top-level `requirements` list in
 * the {@link BLUEPRINT_REQUIREMENT_FIELDS} shape only). `2` = plan §E.2:
 * the structured requirement levels (Team / Leader / MemberTemplate) in the
 * compatibility requirement vocabulary (the {@link BLUEPRINT_V2_REQUIREMENT_FIELDS}
 * shape). A v1 document parses by the OLD closed schema UNCHANGED — the v2
 * rules are applied ONLY to `schemaVersion: 2` documents (the v1 validator is
 * frozen and must not be tightened into v2 rules).
 *
 * `3` = Alpha.4 ADR A2-2: the v2 document plus the required `teamHardEnvelope`
 * authority document. **This set is `[1, 2, 3]` for the temporary PR1-PR6
 * implementation bridge only** (ADR A2-11 — the same clause that demands the
 * v1/v2 hashable projection stay byte-identical, which is why widening the set
 * is safe, and why the new v3 field may enter `toHashableBlueprint` only
 * KEY-OMITTED). Alpha.4's final contract is `[3]`; `blueprint-v3-only`
 * enforcement lives in `scripts/verify-blueprint-version-clean.mjs`, which is
 * empty until the PR7 cutover — that fence, not this constant, is the
 * guarantee (ADR A5-19).
 */
export declare const SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS: readonly number[];
/**
 * The exact closed field set of a blueprint document (top level).
 * Order is presentation only; validation never depends on it.
 */
export declare const BLUEPRINT_TOP_LEVEL_FIELDS: readonly string[];
/**
 * The exact closed field set of the Alpha.3 PR4 `permissionMutationEnvelope`
 * block — the ONE explicit Leader permission-expansion authority carrier
 * (ADR §6 / design §4). It is CONCEPTUALLY DISTINCT from the operation-token
 * capability envelopes `teamEnvelope` / `memberEnvelopes` (a
 * set-intersection over mutation-operation tokens feeding the exec-token
 * dual gate): this carrier is a per-rule permission ceiling
 * {operationClass, matcher, maximumEffect}. The two envelopes NEVER read
 * each other; there is no transformation between them
 * (governance/permission-mutation.ts D2 ruling). The block carries exactly
 * one field, `rules` (a possibly-empty array — an empty list is exactly
 * "no Leader expansion authority").
 */
export declare const BLUEPRINT_PERMISSION_MUTATION_ENVELOPE_FIELDS: readonly string[];
/** The exact closed field set of one `permissionMutationEnvelope.rules` entry. */
export declare const BLUEPRINT_PERMISSION_MUTATION_ENVELOPE_RULE_FIELDS: readonly string[];
/**
 * The closed matcher field sets of one `permissionMutationEnvelope.rules`
 * entry. The `operationClass` lane PICKS the matcher shape (design §5):
 * - a FILE-class operation (`read`/`read_image`/`write`/`edit`/`lsp`) pairs
 *   with `exact` / `subtree` — the resource is a workspace PATH here (the
 *   blueprint is pure data; canonicalization to an opaque key is the runtime
 *   provider's job, never this layer's);
 * - a SHELL-class operation (`bash`/`pwsh`) pairs with `fingerprint` ONLY —
 *   the resource is a canonical operation fingerprint carried VERBATIM
 *   (exact identity; no subtree, no `any`, no path — design §5, Final
 *   Acceptance 7).
 */
export declare const BLUEPRINT_PERMISSION_MUTATION_ENVELOPE_FILE_MATCHER_FIELDS: readonly string[];
export declare const BLUEPRINT_PERMISSION_MUTATION_ENVELOPE_EXEC_MATCHER_FIELDS: readonly string[];
/** The closed matcher kinds of the config carrier (design §5; no `any`). */
export declare const BLUEPRINT_PERMISSION_MUTATION_ENVELOPE_MATCHER_KINDS: readonly string[];
/** The closed `maximumEffect` ceiling vocabulary (the §6 ladder's values). */
export declare const BLUEPRINT_PERMISSION_MUTATION_ENVELOPE_MAX_EFFECTS: readonly string[];
/**
 * The TWO v3 authority documents are ONE grammar (ADR A3-9, spec §3.3): the
 * Leader expansion ceiling (`permissionMutationEnvelope`, optional through the
 * PR1-PR6 bridge) and the Human User hard ceiling (`teamHardEnvelope`,
 * required at v3) are shaped identically, class-paired identically and closed
 * identically — only their POSITION in the runtime authority order differs
 * (ADR §3.2).
 *
 * These names exist so the second carrier never grows a forked copy of the
 * closed sets: they are the SAME frozen arrays reached by a second name, so a
 * grammar change lands on both documents by construction, and the naming
 * collision is recorded here rather than improvised at a call site
 * (ADR A2-17).
 */
export declare const BLUEPRINT_AUTHORITY_ENVELOPE_FIELDS: readonly string[];
/** @see {@link BLUEPRINT_AUTHORITY_ENVELOPE_FIELDS} — one rule of either document. */
export declare const BLUEPRINT_AUTHORITY_ENVELOPE_RULE_FIELDS: readonly string[];
/** @see {@link BLUEPRINT_AUTHORITY_ENVELOPE_FIELDS} — file-class matcher. */
export declare const BLUEPRINT_AUTHORITY_ENVELOPE_FILE_MATCHER_FIELDS: readonly string[];
/** @see {@link BLUEPRINT_AUTHORITY_ENVELOPE_FIELDS} — shell-class matcher. */
export declare const BLUEPRINT_AUTHORITY_ENVELOPE_EXEC_MATCHER_FIELDS: readonly string[];
/** @see {@link BLUEPRINT_AUTHORITY_ENVELOPE_FIELDS} — closed matcher kinds (no `any`). */
export declare const BLUEPRINT_AUTHORITY_ENVELOPE_MATCHER_KINDS: readonly string[];
/** @see {@link BLUEPRINT_AUTHORITY_ENVELOPE_FIELDS} — the closed ceiling ladder. */
export declare const BLUEPRINT_AUTHORITY_ENVELOPE_MAX_EFFECTS: readonly string[];
/** Max length of one exec fingerprint in the carrier (structural bound). */
export declare const PERMISSION_FINGERPRINT_MAX_LENGTH = 256;
/**
 * The exact closed field set of a LeaderTemplate and a MemberTemplate
 * (the two share one schema; the Leader is distinguished by position,
 * Architecture §6.1).
 */
export declare const BLUEPRINT_TEMPLATE_FIELDS: readonly string[];
/** The exact closed field set of a TemplateCapabilities block. */
export declare const BLUEPRINT_CAPABILITIES_FIELDS: readonly string[];
/** The exact closed field set of a capability requirement. */
export declare const BLUEPRINT_REQUIREMENT_FIELDS: readonly string[];
/**
 * The exact closed field set of a schema-v2 structured requirement (plan
 * §E.2) — the richer compatibility-vocabulary declaration used at all three
 * levels (Team / Leader / MemberTemplate). It carries an explicit
 * `requirementId`, the closed §27.1 `type`, the probeable `subjects`, and
 * the structural `complete` ruling (defaults to `false` when omitted).
 */
export declare const BLUEPRINT_V2_REQUIREMENT_FIELDS: readonly string[];
/**
 * The exact closed TOP-LEVEL field set of a schema-v2 document (plan §E.2):
 * the frozen v1 top-level set (unchanged — v1 documents parse against
 * {@link BLUEPRINT_TOP_LEVEL_FIELDS}) plus the v2 TEAM-level structured
 * requirement field `teamRequirements`. The v1 `requirements` field is kept
 * in the set (it stays a legal, frozen team-level mechanism in v2 documents,
 * typically empty).
 */
export declare const BLUEPRINT_TOP_LEVEL_FIELDS_V2: readonly string[];
/**
 * The exact closed field set of a schema-v3 blueprint document (top level).
 *
 * A4-PR1 (ADR A2-2): v3 is the v2 document plus exactly ONE key,
 * `teamHardEnvelope`. It is derived from {@link BLUEPRINT_TOP_LEVEL_FIELDS_V2}
 * rather than restated, so the two sets cannot drift apart by editing one of
 * them. Everything else about v3 is a REQUIREMENT change, not a shape change:
 * `permissionMutationEnvelope` stops being optional (ADR A1-19) and
 * `teamHardEnvelope` never was optional (spec §3.2, "No implicit default is
 * permitted"). Requiredness is checked in `validate.ts` — closedness and
 * requiredness are different questions with different diagnostics.
 */
export declare const BLUEPRINT_TOP_LEVEL_FIELDS_V3: readonly string[];
/**
 * The exact closed TEMPLATE field set of a schema-v2 document (plan
 * §E.2/§E.3): the frozen v1 template set (unchanged — v1 templates parse
 * against {@link BLUEPRINT_TEMPLATE_FIELDS}) plus the per-template
 * structured requirement field `requirements`.
 */
export declare const BLUEPRINT_TEMPLATE_FIELDS_V2: readonly string[];
/** The exact closed field set of a mutation envelope. */
export declare const BLUEPRINT_ENVELOPE_FIELDS: readonly string[];
/** The exact closed field set of a member envelope entry. */
export declare const BLUEPRINT_MEMBER_ENVELOPE_ENTRY_FIELDS: readonly string[];
/** The exact closed field set of a PolicyState definition. */
export declare const BLUEPRINT_POLICY_STATE_FIELDS: readonly string[];
/** The exact closed field set of the quotas block. */
export declare const BLUEPRINT_QUOTA_SPEC_FIELDS: readonly string[];
/** The exact closed field set of one quota. */
export declare const BLUEPRINT_QUOTA_FIELDS: readonly string[];
/**
 * The blueprint top-level fields a PolicyState definition may reference in
 * its `fields` list (Architecture §5.5: "PolicyState 不引用不存在的字段").
 * Identity/triple fields (schemaVersion, blueprintId, revision) are not
 * policy-referenceable: policy states operate on Blueprint-owned semantics.
 */
export declare const BLUEPRINT_POLICY_REFERENCEABLE_FIELDS: readonly string[];
/** The only values a capability policy may map a domain to. */
export declare const CAPABILITY_POLICY_DECISIONS: readonly string[];
/**
 * The seven tool names a permission rule may gate (alpha.2 plan §4/§6.2 +
 * A2C-1, closed vocabulary). The shell class (`bash`, `pwsh`) allows
 * tool-level ask/deny via `resource: { kind: 'any' }` only — no positive
 * parameter-level allow. Enforced in validation: a shell-class rule in
 * the `allow` lane is rejected on MEMBER templates, and an `exact`
 * shell-class resource is rejected in every lane (the shell vocabulary is
 * `any` in `ask`/`deny` in every role). LEADER exception
 * (exec-autonomy-contract, user ruling 2026-09-18): the leader template's
 * `allow` lane MAY carry a shell-class rule with the whole-tool `any`
 * resource — an explicit, declared whole-tool exec authorization (there
 * is NO implicit default-allow: an absent rule still resolves to
 * `policy.default`). That leader authorization is inert unless the
 * leader's effective mutation envelope carries the matching exec token
 * (`'bash'` / `'pwsh'` — separate tokens): the runtime pre-execute dual
 * gate downgrades the allow to the `user-approval` ask path otherwise
 * (fail-closed). `bash authority != pwsh authority`: the two share the
 * shell class rules but are distinct tools (a rule for one never gates
 * the other, the runtime fingerprints them with separate tool
 * identities, and the envelope gates them with separate tokens).
 */
export declare const PERMISSION_TOOL_NAMES: readonly string[];
/**
 * The only fallback decisions a permission policy may declare
 * (alpha.2 plan §6.3). `allow` is NOT a legal default: a default of
 * `allow` would silently expand privilege, so it is rejected.
 */
export declare const PERMISSION_POLICY_DEFAULTS: readonly string[];
/**
 * The closed resource kinds of a permission rule (alpha.2 plan §6.2).
 * `subtree` (A2C-7, plan §9): one workspace path that matches the path
 * ITSELF and every canonical descendant — the containment judgment is
 * the pinned public `FileSystem.contains` seam's (NEVER a string
 * authority over opaque keys); the shell class (bash/pwsh) does not
 * accept a subtree resource in any lane (the A2C-1 shell contract).
 */
export declare const PERMISSION_RESOURCE_KINDS: readonly string[];
/** The exact closed field set of a TemplatePermissionPolicy block. */
export declare const PERMISSION_POLICY_FIELDS: readonly string[];
/** The exact closed field set of one permission rule. */
export declare const PERMISSION_RULE_FIELDS: readonly string[];
/**
 * Max length of one `exact` permission path (structural bound, mirrors the
 * contracts `WORKSPACE_PATH_MAX_LENGTH`; the path stays an opaque string —
 * the A3 resolver canonicalizes it through the public filesystem seam).
 */
export declare const PERMISSION_PATH_MAX_LENGTH = 1024;
/** Frontmatter delimiter line (borrowed from the legacy parser mechanism). */
export declare const FRONTMATTER_DELIMITER = "---";
/** Max length of a display name field. */
export declare const DISPLAY_NAME_MAX_LENGTH = 128;
/** Max length of a description field. */
export declare const DESCRIPTION_MAX_LENGTH = 4096;
/** Max length of a persona (prose) field. */
export declare const PERSONA_MAX_LENGTH = 32768;
/** Max length of a model preference token. */
export declare const MODEL_PREFERENCE_MAX_LENGTH = 128;
/** Max length of a context policy token. */
export declare const CONTEXT_POLICY_MAX_LENGTH = 64;
/** Max length of a capability requirement domain. */
export declare const REQUIREMENT_DOMAIN_MAX_LENGTH = 64;
/** Max length of a capability requirement name. */
export declare const REQUIREMENT_NAME_MAX_LENGTH = 128;
/** Max length of a PolicyState id. */
export declare const POLICY_STATE_ID_MAX_LENGTH = 64;
/** Max length of one envelope operation token. */
export declare const ENVELOPE_OPERATION_MAX_LENGTH = 128;
/** Max length of a metadata key. */
export declare const METADATA_KEY_MAX_LENGTH = 64;
/** Max length of a metadata value. */
export declare const METADATA_VALUE_MAX_LENGTH = 4096;
/** Max length of one capability-item name (tool/skill/mcp). */
export declare const CAPABILITY_ITEM_MAX_LENGTH = 128;
/** Capability requirement domain: lowercase slug (probeable domain name). */
export declare const REQUIREMENT_DOMAIN_PATTERN: RegExp;
/** Capability requirement name: lowercase slug with dots (e.g. `node.fs`). */
export declare const REQUIREMENT_NAME_PATTERN: RegExp;
/** PolicyState id: lowercase slug. */
export declare const POLICY_STATE_ID_PATTERN: RegExp;
/**
 * Envelope operation token: lowercase slug with dots/underscores.
 *
 * Recognized token classes (exec-autonomy-contract, user ruling
 * 2026-09-18):
 * - team-governance operations (the closed `ALL_MUTATION_OPS`
 *   vocabulary, `packages/runtime/admission/envelope.ts`): gate the
 *   team-governance mutation actions;
 * - exec-authorization tokens `'bash'` / `'pwsh'` (the closed
 *   `ENVELOPE_EXEC_OPS` vocabulary): the leader's effective envelope
 *   must carry the token for the leader's allow-lane shell-class rule
 *   (the whole-tool `any` rule) to authorize the tool at runtime — the
 *   pre-execute dual gate (fail-closed: missing token = downgrade to
 *   the `user-approval` ask path).
 * Tokens outside both classes parse (the envelope vocabulary stays open
 * slugs) but are inert: nothing gates on them today.
 */
export declare const ENVELOPE_OPERATION_PATTERN: RegExp;
/** Metadata key: starts alphanumeric, then alphanumerics, dot, underscore, dash. */
export declare const METADATA_KEY_PATTERN: RegExp;
//# sourceMappingURL=schema.d.ts.map