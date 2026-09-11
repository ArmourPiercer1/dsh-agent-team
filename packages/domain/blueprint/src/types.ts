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

import type {
  BlueprintContentHash,
  BlueprintId,
  BlueprintRevision,
  TemplateId,
} from '../../../contracts/src/index.js'

/**
 * The six tools whose individual calls a static permission policy may gate
 * (alpha.2 plan §4). The file tools (`read`, `read_image`, `write`, `edit`,
 * `lsp`) address their target file as the primary resource. `bash`
 * supports ONLY tool-level `ask`/`deny` via the `any` resource — and the
 * schema ENFORCES it (the validation rejects a `bash` rule in the `allow`
 * lane entirely, and an `exact` `bash` resource in every lane: no positive
 * whole-tool grant and no parameter-level allow for shell commands in
 * alpha.2).
 */
export type PermissionTool =
  | 'read'
  | 'read_image'
  | 'write'
  | 'edit'
  | 'lsp'
  | 'bash'

/**
 * The resource a permission rule addresses (alpha.2 plan §6.2):
 *
 * - `exact` — one exact workspace path (non-empty string; the A3 resolver
 *   compares it against the canonical operation resource);
 * - `any` — the whole tool, carrying no resource identity (the minimal
 *   shell permission: `{ tool: bash, resource: { kind: 'any' } }`).
 *
 * `subtree` is deliberately NOT part of the A1 vocabulary (plan §6.2: not a
 * release blocker; added only if a public filesystem seam can judge the
 * descendant relation strictly).
 */
export type PermissionResource =
  | { readonly kind: 'exact'; readonly path: string }
  | { readonly kind: 'any' }

/**
 * One static permission rule (alpha.2 plan §6.2): which tool, and on which
 * resource, the lane it sits in decides `allow` / `ask` / `deny`.
 */
export interface PermissionRule {
  /** The tool this rule gates. */
  readonly tool: PermissionTool
  /** The resource the rule matches (exact path or any). */
  readonly resource: PermissionResource
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
  readonly default: 'ask' | 'deny'
  /** Rules that allow the exact operation (lane order = declaration order). */
  readonly allow: readonly PermissionRule[]
  /** Rules that require an approval (lane order = declaration order). */
  readonly ask: readonly PermissionRule[]
  /** Rules that deny the operation (lane order = declaration order). */
  readonly deny: readonly PermissionRule[]
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
  readonly teamTools: AllowEntry | DenyEntry
  /** Built-in tool names this template must NOT use. */
  readonly builtinToolDeny: readonly string[]
  /** Skill capability policy. */
  readonly skills: AllowEntry | DenyEntry
  /** MCP server capability policy. */
  readonly mcp: AllowEntry | DenyEntry
  /** Static permission policy (absent = no parameter-level permissions). */
  readonly permissions?: TemplatePermissionPolicy
}

/** An allow-list entry in a template capability policy. */
export interface AllowEntry {
  readonly kind: 'allow'
  readonly items: readonly string[]
}

/** A blanket deny entry in a template capability policy. */
export interface DenyEntry {
  readonly kind: 'deny'
}

/**
 * The static definition of a template (shared by the Leader and the
 * Members; Architecture §6.1: the two share as many semantic fields as
 * possible). `persona` is required and non-empty: a template without a
 * persona is not "complete" and fails validation.
 */
export interface BlueprintTemplate {
  /** Static identity of the template (lowercase slug). */
  readonly templateId: TemplateId
  /** Human-facing display name (not an identity). */
  readonly displayName?: string
  /** Human-facing description. */
  readonly description?: string
  /** The persona prose for this template (required, non-empty). */
  readonly persona: string
  /** Base model preference/policy token (interpreted later by the runtime). */
  readonly modelPreference?: string
  /** Context policy token (invariant 29: frozen at instance creation). */
  readonly contextPolicy?: string
  /** Per-template capability policy (absent = legacy mode, no restrictions). */
  readonly capabilities?: TemplateCapabilities
}

/** The Blueprint's exactly-one complete Leader (Architecture §5.3). */
export type LeaderTemplate = BlueprintTemplate

/** One of the Blueprint's 0..N MemberTemplates (Architecture §5.4). */
export type MemberTemplate = BlueprintTemplate

/** A capability requirement the Team must be able to probe. */
export interface CapabilityRequirement {
  /** Probeable capability domain (lowercase slug). */
  readonly domain: string
  /** Capability name within the domain. */
  readonly name: string
  /** Whether the requirement is optional (degraded vs fatal). */
  readonly optional: boolean
}

/**
 * A Team or Member autonomy/mutation envelope: which mutation operations
 * are allowed or denied. Self-consistency: an operation may not appear in
 * both `allow` and `deny` (Architecture §5.5).
 */
export interface MutationEnvelope {
  /** Mutation operations this envelope allows. */
  readonly allow: readonly string[]
  /** Mutation operations this envelope denies. */
  readonly deny: readonly string[]
}

/**
 * A Member mutation envelope entry, bound to one template by id
 * (Architecture §5.4 "Member mutation envelopes"). The `templateId` must
 * resolve to a template declared in the same blueprint.
 */
export interface MemberEnvelopeEntry {
  /** The template this member envelope applies to. */
  readonly templateId: TemplateId
  /** The envelope itself. */
  readonly envelope: MutationEnvelope
}

/**
 * A PolicyState definition (Architecture §5.4, optional). Its `fields`
 * reference top-level blueprint fields that exist in this document
 * (Architecture §5.5: "PolicyState 不引用不存在的字段").
 */
export interface PolicyStateDefinition {
  /** Static identity of the policy state (lowercase slug). */
  readonly id: string
  /** Human-facing description. */
  readonly description?: string
  /** Top-level blueprint fields this policy state references. */
  readonly fields: readonly string[]
}

/** One quota (instance/team). */
export interface Quota {
  /** Maximum number of instances (positive integer). */
  readonly maxInstances?: number
  /** Maximum number of concurrently active instances (positive integer, ≤ maxInstances). */
  readonly maxConcurrent?: number
}

/** The blueprint's quota block: team-level and per-member quotas. */
export interface QuotaSpec {
  /** Team-wide quota. */
  readonly team?: Quota
  /** Per-member quota. */
  readonly members?: Quota
}

/**
 * Team-owned ordinary capability policy: a closed mapping of capability
 * domain → allow/deny decision (never raw Cordis composition —
 * Architecture §5.4).
 */
export type CapabilityPolicy = Readonly<Record<string, 'allow' | 'deny'>>

/**
 * Interpretation metadata carried by the blueprint (string→string).
 * Not an identity; frozen into the snapshot (Architecture §5.6
 * "metadata needed to interpret runtime state").
 */
export type BlueprintMetadata = Readonly<Record<string, string>>

/**
 * A validated, normalized, deeply-frozen TeamBlueprint.
 *
 * This is the object a TeamSession freezes as its immutable Blueprint
 * snapshot (Architecture §5.6/§8.4); the snapshot ref is
 * `{ blueprintId, revision, contentHash }`.
 */
export interface TeamBlueprint {
  /** The blueprint document schema version (v1: exactly 1). */
  readonly schemaVersion: 1
  /** Stable logical identity (not a path, not a display name). */
  readonly blueprintId: BlueprintId
  /** Human-readable revision. */
  readonly revision: BlueprintRevision
  /** Machine content identity, derived from the validated content. */
  readonly contentHash: BlueprintContentHash
  /** Display name (not an identity; renaming it changes content, not id). */
  readonly displayName?: string
  /** Description. */
  readonly description?: string
  /** The exactly-one complete LeaderTemplate. */
  readonly leader: LeaderTemplate
  /** The 0..N MemberTemplates (unique templateIds). */
  readonly members: readonly MemberTemplate[]
  /** Capability requirements (unique (domain, name) pairs). */
  readonly requirements: readonly CapabilityRequirement[]
  /** Team autonomy/mutation envelope (absent = none declared). */
  readonly teamEnvelope?: MutationEnvelope
  /** Member mutation envelopes (unique templateIds, resolvable). */
  readonly memberEnvelopes: readonly MemberEnvelopeEntry[]
  /** PolicyState definitions (unique ids, resolvable field refs). */
  readonly policyStates: readonly PolicyStateDefinition[]
  /** Instance/team quotas (absent = none declared). */
  readonly quotas?: QuotaSpec
  /** Team-owned ordinary capability policy (absent = none declared). */
  readonly capabilityPolicy?: CapabilityPolicy
  /** Interpretation metadata (absent = empty). */
  readonly metadata: BlueprintMetadata
}

/**
 * The validated blueprint before its content hash is derived: the full
 * semantic content minus the derived `contentHash` field.
 */
export type TeamBlueprintCore = Omit<TeamBlueprint, 'contentHash'>

/** A parsed-but-not-yet-validated blueprint source (frontmatter split). */
export interface ParsedBlueprintDocument {
  /** The raw frontmatter text (between the `---` delimiters). */
  readonly frontmatterText: string
  /** The markdown body after the closing delimiter (must be empty). */
  readonly body: string
}
