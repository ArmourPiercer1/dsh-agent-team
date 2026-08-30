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
