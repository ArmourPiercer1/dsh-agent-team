/**
 * VNext blueprint object model (types only — no runtime code).
 *
 * Mirrors the frozen Architecture object model:
 *
 * - §5.2 identity: `blueprintId` + `revision` + `contentHash`;
 * - §5.3 a valid blueprint carries exactly one complete LeaderTemplate;
 * - §5.4 the Blueprint-owned semantic categories;
 * - §5.6 the immutable snapshot freezes Blueprint-owned semantics.
 *
 * `TeamBlueprint` is the validated, normalized, deeply-frozen object the
 * domain produces from a blueprint source document. `TeamBlueprintCore` is
 * the same object without the derived `contentHash` (the hash is derived
 * from the core's hashable projection, so the content identity never
 * depends on itself).
 *
 * @module @dsh-agent-team/domain/blueprint/types
 */
import type { BlueprintContentHash, BlueprintId, BlueprintRevision, TemplateId } from '../../../contracts/src/index.js';
import type { RequirementType } from '../../compatibility/src/requirement.js';
/**
 * The seven tools whose individual calls a static permission policy may
 * gate (alpha.2 plan §4 + A2C-1). The file tools (`read`, `read_image`,
 * `write`, `edit`, `lsp`) address their target file as the primary
 * resource. The shell class (`bash`, `pwsh` — the pinned-upstream
 * standard preset exposes `bash` on POSIX and `pwsh` on Windows, with
 * isomorphic execution arguments) supports tool-level `ask`/`deny` via
 * the `any` resource in every role, and — LEADER ONLY
 * (exec-autonomy-contract, user ruling 2026-09-18) — a whole-tool `any`
 * rule in the `allow` lane: an explicit, declared exec authorization,
 * inert at runtime unless the leader's effective mutation envelope
 * carries the matching exec token (`'bash'` / `'pwsh'`; the runtime
 * pre-execute dual gate downgrades otherwise — fail-closed). No implicit
 * default-allow: an absent rule still resolves to `policy.default`. The
 * schema ENFORCES it (the validation rejects a member-template
 * shell-class rule in the `allow` lane — diagnostics byte-identical to
 * the A2C-1 text — and an `exact` shell-class resource in every lane of
 * every role: no parameter-level allow for shell commands in alpha.2).
 * The two shell tools are DISTINCT permission tools (`bash authority !=
 * pwsh authority`): a rule or an approval for one never gates or
 * authorizes the other.
 */
export type PermissionTool = 'read' | 'read_image' | 'write' | 'edit' | 'lsp' | 'bash' | 'pwsh';
/**
 * The resource a permission rule addresses (alpha.2 plan §6.2):
 *
 * - `exact` — one exact workspace path (non-empty string; the A3 resolver
 *   compares it against the canonical operation resource);
 * - `subtree` — one workspace path that matches the path ITSELF and every
 *   canonical descendant (A2C-7, plan §9): same path constraints as
 *   `exact`; the containment judgment is the pinned public
 *   `FileSystem.contains` seam's (the A5 adapter calls it on targets of
 *   the SAME provider — never a string authority over opaque keys);
 *   the shell class (bash/pwsh) does not accept a subtree resource in
 *   any lane (the A2C-1 shell contract — the shell keeps only the
 *   whole-tool `any` resource: ask/deny in every role, plus the
 *   leader-only allow-lane exception under the mutation-envelope dual
 *   gate);
 * - `any` — the whole tool, carrying no resource identity (the minimal
 *   shell permission: `{ tool: bash, resource: { kind: 'any' } }`).
 */
export type PermissionResource = {
    readonly kind: 'exact';
    readonly path: string;
} | {
    readonly kind: 'subtree';
    readonly path: string;
} | {
    readonly kind: 'any';
};
/**
 * One static permission rule (alpha.2 plan §6.2): which tool, and on which
 * resource, the lane it sits in decides `allow` / `ask` / `deny`.
 */
export interface PermissionRule {
    /** The tool this rule gates. */
    readonly tool: PermissionTool;
    /** The resource the rule matches (exact path or any). */
    readonly resource: PermissionResource;
}
/**
 * The optional static permission policy on a BlueprintTemplate
 * (alpha.2 plan §6.1/§6.3). It is a CAPABILITIES field: it is validated in
 * the blueprint domain only and must NOT be confused with the generic
 * `TemplatePolicy.values['permissions']` cell (plan §3).
 *
 * - `default` is required when the policy is present and is restricted to
 *   `ask` | `deny`; `default: allow` is rejected (no silent privilege
 *   expansion, plan §6.3).
 * - `allow` / `ask` / `deny` are required arrays (each may be empty).
 * - Same-layer resolution priority is FROZEN as `deny > ask > allow >
 *   default` (plan §6.4); A1 only carries the three lanes — the resolution
 *   itself is A3's resolver.
 *
 * Deterministic normalization (pinned by the A1 test suite): rules are
 * KEPT IN DECLARATION ORDER — no reordering, no de-duplication, no
 * cross-lane movement. Duplicate rules are legal and are preserved (lane
 * arrays may contain the same rule twice); the normalized object is a
 * fresh plain copy whose shape and ordering are a pure function of the
 * source document (modulo string trimming of `exact.path`, which is the
 * repo-wide string-field normalization). Consequence: the same source
 * always produces structurally identical policies and identical content
 * hashes, while reordering rules in the source changes the declaration
 * order (and therefore the hash).
 */
export interface TemplatePermissionPolicy {
    /** Fallback decision for a call no rule matches: `ask` or `deny`. */
    readonly default: 'ask' | 'deny';
    /** Rules that allow the exact operation (lane order = declaration order). */
    readonly allow: readonly PermissionRule[];
    /** Rules that require an approval (lane order = declaration order). */
    readonly ask: readonly PermissionRule[];
    /** Rules that deny the operation (lane order = declaration order). */
    readonly deny: readonly PermissionRule[];
}
/**
 * Capability policy entries on a BlueprintTemplate (T1 / 0.1.1-alpha.1).
 * Each sub-field is an allow-list ({@link AllowEntry}) or a blanket deny
 * ({@link DenyEntry}). The four domains are:
 *
 * - `teamTools` — team-tool names this template may use;
 * - `builtinToolDeny` — built-in tool names this template must NOT use;
 * - `skills` — skill ids this template may use;
 * - `mcp` — MCP server names this template may use.
 *
 * `permissions` (0.1.1-alpha.2, A1) is the optional static permission
 * policy; when absent the template carries no parameter-level permission
 * semantics at all (legacy/alpha.1 behavior, completely unchanged).
 */
export interface TemplateCapabilities {
    /** Team-tool capability policy. */
    readonly teamTools: AllowEntry | DenyEntry;
    /** Built-in tool names this template must NOT use. */
    readonly builtinToolDeny: readonly string[];
    /** Skill capability policy. */
    readonly skills: AllowEntry | DenyEntry;
    /** MCP server capability policy. */
    readonly mcp: AllowEntry | DenyEntry;
    /** Static permission policy (absent = no parameter-level permissions). */
    readonly permissions?: TemplatePermissionPolicy;
}
/** An allow-list entry in a template capability policy. */
export interface AllowEntry {
    readonly kind: 'allow';
    readonly items: readonly string[];
}
/** A blanket deny entry in a template capability policy. */
export interface DenyEntry {
    readonly kind: 'deny';
}
/**
 * The static definition of a template (shared by the Leader and the
 * Members; Architecture §6.1: the two share as many semantic fields as
 * possible). `persona` is required and non-empty: a template without a
 * persona is not "complete" and fails validation.
 */
export interface BlueprintTemplate {
    /** Static identity of the template (lowercase slug). */
    readonly templateId: TemplateId;
    /** Human-facing display name (not an identity). */
    readonly displayName?: string;
    /** Human-facing description. */
    readonly description?: string;
    /** The persona prose for this template (required, non-empty). */
    readonly persona: string;
    /**
     * The role's model preference — a v1 model token (validated by
     * `parseModelPreferenceToken`): a qualified `provider/model` route, or a
     * bare model id whose provider is inherited from the deployment
     * default's `staticModel.provider` at the runtime. Absent = no model
     * preference (the deployment default stands). The runtime maps it to the
     * bound template's `model` policy cell (the template's static value
     * layer), where it sits below durable overrides.
     */
    readonly modelPreference?: string;
    /** Context policy token (invariant 29: frozen at instance creation). */
    readonly contextPolicy?: string;
    /** Per-template capability policy (absent = legacy mode, no restrictions). */
    readonly capabilities?: TemplateCapabilities;
    /**
     * Schema-v2 structured requirements bound to THIS template (the Leader or
     * one MemberTemplate; plan §E.2/§E.3). A v2 document may declare, e.g., a
     * `persona` requirement (the required persona kind) or `mcpServer`
     * requirements the template needs. ABSENT in v1 documents and in v2
     * documents that declare none (omitted, never present-but-empty-at-parse —
     * a declared `[]` is a legal empty list).
     */
    readonly requirements?: readonly BlueprintRequirement[];
}
/** The Blueprint's exactly-one complete Leader (Architecture §5.3). */
export type LeaderTemplate = BlueprintTemplate;
/** One of the Blueprint's 0..N MemberTemplates (Architecture §5.4). */
export type MemberTemplate = BlueprintTemplate;
/** A capability requirement the Team must be able to probe. */
export interface CapabilityRequirement {
    /** Probeable capability domain (lowercase slug). */
    readonly domain: string;
    /** Capability name within the domain. */
    readonly name: string;
    /** Whether the requirement is optional (degraded vs fatal). */
    readonly optional: boolean;
}
/**
 * A schema-v2 structured requirement (plan §E.2) — the richer requirement
 * declaration available at all three levels (Team / Leader / MemberTemplate).
 *
 * It reuses the domain compatibility requirement vocabulary (Architecture
 * §27.1) directly: the same closed six-set `type`, a `requirementId` (the
 * identity the compatibility engine binds outcomes and acknowledgements to),
 * the probeable `subjects`, and the structural `complete` ruling (unmet
 * `complete:true` => mandatory FATAL, no downgrade, §13.5). Unlike the v1
 * {@link CapabilityRequirement} flat `{domain, name, optional}` row, it
 * carries an explicit `requirementId`, may name MULTIPLE subjects, and
 * declares `complete` rather than inverting it from `optional`.
 *
 * The normalized (validated) form always carries a concrete `complete`
 * (the source's `complete` defaults to `false`).
 */
export interface BlueprintRequirement {
    /** The requirement's stable identity (the compatibility engine's binding key). */
    readonly requirementId: string;
    /** The probeable domain (the closed §27.1 six-set). */
    readonly type: RequirementType;
    /** Named subjects the requirement probes (one or more). */
    readonly subjects: readonly string[];
    /** Structural requirement: unmet => mandatory FATAL, no downgrade (§13.5). */
    readonly complete: boolean;
}
/**
 * A Team or Member autonomy/mutation envelope: which mutation operations
 * are allowed or denied. Self-consistency: an operation may not appear in
 * both `allow` and `deny` (Architecture §5.5).
 *
 * Recognized token classes (exec-autonomy-contract, user ruling
 * 2026-09-18): team-governance operations (the closed `ALL_MUTATION_OPS`
 * vocabulary) plus the exec-authorization tokens `'bash'` / `'pwsh'`
 * (the closed `ENVELOPE_EXEC_OPS` vocabulary, defined in
 * `packages/runtime/admission/envelope.ts`). The leader's effective
 * envelope (teamEnvelope ∩ the leader template's memberEnvelopes entry,
 * fail-closed) must carry the token for the leader's allow-lane
 * shell-class permission rule to authorize `bash` / `pwsh` at runtime —
 * the pre-execute dual gate (missing token = downgrade to the
 * `user-approval` ask path). The tokens are open slugs at parse time
 * (the envelope vocabulary is unchanged); this is their RUNTIME
 * recognition.
 */
export interface MutationEnvelope {
    /** Mutation operations (and exec-authorization tokens) this envelope allows. */
    readonly allow: readonly string[];
    /** Mutation operations (and exec-authorization tokens) this envelope denies. */
    readonly deny: readonly string[];
}
/**
 * A Member mutation envelope entry, bound to one template by id
 * (Architecture §5.4 "Member mutation envelopes"). The `templateId` must
 * resolve to a template declared in the same blueprint.
 */
export interface MemberEnvelopeEntry {
    /** The template this member envelope applies to. */
    readonly templateId: TemplateId;
    /** The envelope itself. */
    readonly envelope: MutationEnvelope;
}
/**
 * The Alpha.3 PR4 Leader permission-EXPANSION authority carrier
 * (ADR §6 / design §4) — conceptually DISTINCT from {@link MutationEnvelope}
 * (the operation-token capability set above). Where a {@link MutationEnvelope}
 * answers "which MUTATION OPERATIONS / exec tokens may this actor use at
 * all", this answers "for one resource matcher, up to which EFFECT may a
 * Leader EXPAND a member's overlay". The two never read each other and there
 * is NO transformation between them (D2: one concept, one source of truth).
 *
 * The shape mirrors the runtime kernel's canonical
 * `PermissionMutationEnvelope` (governance/permission-mutation.ts) — the
 * runtime envelope rules use the same {operationClass, matcher, maximumEffect}
 * concept — with one difference forced by the blueprint being pure data:
 * a FILE matcher carries a workspace PATH here, which the runtime fs provider
 * (A2) canonicalizes to the opaque key at build time; the kernel envelope's
 * file matcher carries the already-canonical `resource`. An EXEC matcher
 * carries the canonical fingerprint VERBATIM (exact identity, never
 * canonicalized — it already IS the canonical operation identity).
 */
export interface BlueprintPermissionMutationEnvelope {
    /** The expansion-authority rules (possibly empty = NO expansion authority). */
    readonly rules: readonly BlueprintPermissionMutationEnvelopeRule[];
}
/** One {@link BlueprintPermissionMutationEnvelope} rule. */
export interface BlueprintPermissionMutationEnvelopeRule {
    /** The closed operation-class token (one of {@link PERMISSION_TOOL_NAMES}). */
    readonly operationClass: string;
    /** The resource matcher; its shape is picked by the operation class (§5). */
    readonly matcher: BlueprintPermissionMutationEnvelopeMatcher;
    /** The closed effect ceiling this rule admits an expansion up to (§6). */
    readonly maximumEffect: 'allow' | 'ask' | 'deny';
}
/**
 * The matcher of one {@link BlueprintPermissionMutationEnvelopeRule}. The
 * `operationClass` picks the legal variant: a FILE-class operation pairs with
 * `exact`/`subtree` (a workspace `path`); a SHELL-class operation (`bash` /
 * `pwsh`) pairs with `fingerprint` ONLY (the canonical operation identity,
 * carried verbatim — no subtree, no `any`, no path; design §5).
 */
export type BlueprintPermissionMutationEnvelopeMatcher = {
    readonly kind: 'exact';
    readonly path: string;
} | {
    readonly kind: 'subtree';
    readonly path: string;
} | {
    readonly kind: 'fingerprint';
    readonly fingerprint: string;
};
/**
 * The v3 name for one AUTHORITY document (ADR A3-9: the grammar is shared, and
 * the shared shape is the one below — `{ kind, path | fingerprint }`, the
 * DECLARED identity a hash-bound document must carry).
 *
 * Both v3 authority documents are this one type:
 * `permissionMutationEnvelope` (the Leader expansion ceiling) and
 * `teamHardEnvelope` (the Human User hard ceiling, new at v3). They differ in
 * their position in the runtime authority order, never in their shape. The
 * names are aliases rather than restatements on purpose: a structural change
 * to one document's grammar is a change to both, and a call site cannot
 * accidentally treat the two as unrelated types.
 */
export type BlueprintAuthorityEnvelope = BlueprintPermissionMutationEnvelope;
/** One rule of either v3 authority document. */
export type BlueprintAuthorityEnvelopeRule = BlueprintPermissionMutationEnvelopeRule;
/** The matcher of either v3 authority document (config/AST shape). */
export type BlueprintAuthorityEnvelopeMatcher = BlueprintPermissionMutationEnvelopeMatcher;
/**
 * A PolicyState definition (Architecture §5.4, optional). Its `fields`
 * reference top-level blueprint fields that exist in this document
 * (Architecture §5.5: "PolicyState 不引用不存在的字段").
 */
export interface PolicyStateDefinition {
    /** Static identity of the policy state (lowercase slug). */
    readonly id: string;
    /** Human-facing description. */
    readonly description?: string;
    /** Top-level blueprint fields this policy state references. */
    readonly fields: readonly string[];
}
/** One quota (instance/team). */
export interface Quota {
    /** Maximum number of instances (positive integer). */
    readonly maxInstances?: number;
    /** Maximum number of concurrently active instances (positive integer, ≤ maxInstances). */
    readonly maxConcurrent?: number;
}
/** The blueprint's quota block: team-level and per-member quotas. */
export interface QuotaSpec {
    /** Team-wide quota. */
    readonly team?: Quota;
    /** Per-member quota. */
    readonly members?: Quota;
}
/**
 * Team-owned ordinary capability policy: a closed mapping of capability
 * domain → allow/deny decision (never raw Cordis composition —
 * Architecture §5.4).
 */
export type CapabilityPolicy = Readonly<Record<string, 'allow' | 'deny'>>;
/**
 * Interpretation metadata carried by the blueprint (string→string).
 * Not an identity; frozen into the snapshot (Architecture §5.6
 * "metadata needed to interpret runtime state").
 */
export type BlueprintMetadata = Readonly<Record<string, string>>;
/**
 * A validated, normalized, deeply-frozen TeamBlueprint.
 *
 * This is the object a TeamSession freezes as its immutable Blueprint
 * snapshot (Architecture §5.6/§8.4); the snapshot ref is
 * `{ blueprintId, revision, contentHash }`.
 */
export interface TeamBlueprint {
    /**
     * The blueprint document schema version. `1` = the frozen v1 document
     * (the flat top-level {@link CapabilityRequirement} list only); `2` = the
     * structured requirement levels (plan §E.2: Team / Leader /
     * MemberTemplate requirements in the compatibility vocabulary); `3` =
     * Alpha.4 (ADR A2-2): the v2 shape plus the required `teamHardEnvelope`
     * authority document, with `permissionMutationEnvelope` no longer optional
     * (ADR A1-19). `3` is admitted for the PR1-PR6 bridge only (ADR A2-11); the
     * Alpha.4 contract is v3-only and the PR7 cutover narrows the accepted set.
     */
    readonly schemaVersion: 1 | 2 | 3;
    /** Stable logical identity (not a path, not a display name). */
    readonly blueprintId: BlueprintId;
    /** Human-readable revision. */
    readonly revision: BlueprintRevision;
    /** Machine content identity, derived from the validated content. */
    readonly contentHash: BlueprintContentHash;
    /** Display name (not an identity; renaming it changes content, not id). */
    readonly displayName?: string;
    /** Description. */
    readonly description?: string;
    /** The exactly-one complete LeaderTemplate. */
    readonly leader: LeaderTemplate;
    /** The 0..N MemberTemplates (unique templateIds). */
    readonly members: readonly MemberTemplate[];
    /**
     * The v1 flat capability-requirement list (frozen v1 shape; unique
     * (domain, name) pairs). Present at every schema version — in v2 documents
     * it is the LEGACY team-level mechanism and is typically empty; the v2
     * team-level structured requirements live in {@link teamRequirements}.
     */
    readonly requirements: readonly CapabilityRequirement[];
    /**
     * Schema-v2 TEAM-level structured requirements (plan §E.2). ABSENT in v1
     * documents and in v2 documents that declare none (omitted, never
     * present-but-undefined). A declared `[]` is a legal empty list.
     */
    readonly teamRequirements?: readonly BlueprintRequirement[];
    /** Team autonomy/mutation envelope (absent = none declared). */
    readonly teamEnvelope?: MutationEnvelope;
    /** Member mutation envelopes (unique templateIds, resolvable). */
    readonly memberEnvelopes: readonly MemberEnvelopeEntry[];
    /**
     * The Alpha.3 PR4 Leader permission-EXPANSION authority carrier (absent =
     * NO declared expansion authority — a LEGAL typed absence, never a read
     * failure: expansions simply find no ceiling rule and refuse, while every
     * unaffected decision keeps answering). Conceptually distinct from the
     * operation-token {@link teamEnvelope} / {@link memberEnvelopes} capability
     * sets: this is the per-rule permission ceiling the mutation kernel
     * consults for Leader EXPANSION (ADR §6). Present-only in the content
     * hash (the teamRequirements/permissions "absent ⇒ key omitted"
     * discipline): documents that do not declare it hash byte-identically.
     */
    readonly permissionMutationEnvelope?: BlueprintPermissionMutationEnvelope;
    /**
     * The Alpha.4 `teamHardEnvelope` — the HUMAN USER hard expansion ceiling
     * (ADR §3.2 runtime order: `Human Admin > Team Hard Envelope > Human User >
     * Leader Permission Mutation Envelope > Leader > Member`; spec §3.2).
     *
     * v3-ONLY and REQUIRED at v3: `schemaVersion: 1 | 2` documents reject the
     * key as an unknown field (the version-gated closed set), so its presence
     * here is exactly the v3 population. `rules: []` is a legal declaration and
     * means one thing — Human User has NO runtime expansion authority
     * (spec §3.4); absence is never an implicit wide grant, which is why the
     * field is required rather than defaulted.
     *
     * Like its sibling, it is PRESENT-ONLY in the content hash: the key is
     * omitted from the hashable projection when the document does not carry it,
     * so every v1/v2 blueprint keeps hashing byte-identically (ADR A2-11).
     *
     * PR1 carries and freezes it and NOTHING in production authorization reads
     * it (plan Task 1 lane C).
     */
    readonly teamHardEnvelope?: BlueprintAuthorityEnvelope;
    /** PolicyState definitions (unique ids, resolvable field refs). */
    readonly policyStates: readonly PolicyStateDefinition[];
    /** Instance/team quotas (absent = none declared). */
    readonly quotas?: QuotaSpec;
    /** Team-owned ordinary capability policy (absent = none declared). */
    readonly capabilityPolicy?: CapabilityPolicy;
    /** Interpretation metadata (absent = empty). */
    readonly metadata: BlueprintMetadata;
}
/**
 * The validated blueprint before its content hash is derived: the full
 * semantic content minus the derived `contentHash` field.
 */
export type TeamBlueprintCore = Omit<TeamBlueprint, 'contentHash'>;
/** A parsed-but-not-yet-validated blueprint source (frontmatter split). */
export interface ParsedBlueprintDocument {
    /** The raw frontmatter text (between the `---` delimiters). */
    readonly frontmatterText: string;
    /** The markdown body after the closing delimiter (must be empty). */
    readonly body: string;
}
//# sourceMappingURL=types.d.ts.map