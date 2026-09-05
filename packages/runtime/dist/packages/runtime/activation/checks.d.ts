/**
 * ActivationProvider admission checks — steps 1–11 of the DevPlan §19.2
 * order (TaskDoc §11.7 P6-T1).
 *
 * Every function in this module is READ-ONLY over the durable TeamDomain
 * state (invariant 41) and the injected inputs: no durable write may happen
 * before the journal reservation (step 12). A failure of any step in this
 * module therefore leaves ZERO durable writes (the fail-closed contract of
 * the provider; asserted by the P6-T1 tests over a recording proxy).
 *
 * The functions are individually testable pure-ish seams (they take their
 * repositories/catalog explicitly); the provider composes them in the frozen
 * order:
 *
 *   1  resolve TeamSession (team-root binding + TeamSession record)
 *   2  resolve immutable Blueprint (catalog resolve + content-hash equality)
 *   3  resolve member template
 *   4  caller authority (closed source rules)
 *   5  admission (closed source vocabulary)
 *   6  compatibility (blueprint requirements vs environment facts)
 *   7  quota (committed + in-flight reservations vs blueprint quotas)
 *   8  policy (effective policy resolution with durable overlays)
 *   9  overlay bounds (team ∩ template mutation envelopes)
 *   10 workspace/context creation fields (frozen at creation, invariant 29)
 *   11 allocate instanceId (deterministic, collision-checked; durably
 *      reserved by the journal PREPARED row in step 12)
 *
 * No `node:` builtins, no I/O, no live references.
 * @module @dsh-agent-team/runtime/activation/checks
 */
import type { MemberInstanceRecordDto, TeamSessionRecordDto } from '../../contracts/src/index.js';
import type { BlueprintCatalog, QuotaSpec, TeamBlueprint } from '../../domain/blueprint/src/index.js';
import type { CompatibilityResult, EnvironmentFact, RequirementInput, RequirementType, WarningAcknowledgement } from '../../domain/compatibility/src/index.js';
import type { ContextPolicy } from '../../domain/member/src/index.js';
import type { AutonomyOverlayRecord, EffectivePolicy, ExternalPolicyFacts, HumanOverrideRecord, PolicyEntry } from '../../domain/policy/src/index.js';
import type { GovernanceOverrideRecord, OperationRecord } from '../../storage/schema/index.js';
import type { TeamDomainRepositories } from '../../storage/repositories/index.js';
import type { ActivationSource, MemberActivationRequest } from './types.js';
/**
 * Step 1 — resolve the TeamSession: the root must carry a `team-root`
 * session binding AND a durable TeamSession record (invariant 9: the root
 * session id IS the TeamSessionId).
 *
 * @param repositories - the TeamDomain repositories (read-only use).
 * @param rootSessionId - the root DSH session id.
 * @returns the durable TeamSession record.
 * @throws {@link ActivationError} `ACTIVATION_TEAM_SESSION_NOT_FOUND`.
 */
export declare function resolveTeamSession(repositories: TeamDomainRepositories, rootSessionId: string): TeamSessionRecordDto;
/** The resolved immutable blueprint of one TeamSession (step 2 output). */
export interface ResolvedBoundBlueprint {
    /** The validated, deeply-frozen blueprint. */
    readonly blueprint: TeamBlueprint;
    /** The bound snapshot ref (blueprintId + revision + contentHash). */
    readonly blueprintId: string;
    readonly revision: string;
    readonly contentHash: string;
}
/**
 * Step 2 — resolve the IMMUTABLE blueprint bound to the TeamSession:
 * `catalog.resolve(blueprintId, revision)` plus the content-hash equality
 * against the bound snapshot ref (the snapshot is immutable: a hash
 * mismatch is a durable-state corruption, not a re-resolvable drift).
 *
 * @param catalog - the immutable blueprint catalog.
 * @param teamSession - the TeamSession record (carries the bound ref).
 * @returns the resolved blueprint and its bound snapshot identity.
 * @throws {@link ActivationError} `ACTIVATION_BLUEPRINT_UNRESOLVED` (the
 *   catalog cannot resolve the bound revision) or
 *   `ACTIVATION_BLUEPRINT_HASH_MISMATCH` (the resolved content hash differs
 *   from the bound ref).
 */
export declare function resolveBoundBlueprint(catalog: BlueprintCatalog, teamSession: TeamSessionRecordDto): ResolvedBoundBlueprint;
/**
 * Step 3 — resolve the member template from the immutable blueprint.
 *
 * @param blueprint - the resolved blueprint.
 * @param templateId - the template to instantiate.
 * @returns the template declaration.
 * @throws {@link ActivationError} `ACTIVATION_TEMPLATE_NOT_FOUND`.
 */
export declare function resolveTemplate(blueprint: TeamBlueprint, templateId: string): import("../../domain/blueprint/src/types.js").BlueprintTemplate;
/**
 * Step 4 — caller authority (closed source rules):
 *
 * - `leader-explicit` / `leader-delegate`: the calling authority must be the
 *   LeaderInstance of the TeamSession (the only agent authority that creates
 *   members); any other/absent caller is denied;
 * - `human-ui`: humans are the team owner — no agent-authority requirement
 *   (the caller id is optional free-form principal data).
 *
 * @param source - the activation source.
 * @param callerId - the calling authority (member instance id for leader
 *   sources; optional principal id for human-ui).
 * @throws {@link ActivationError} `ACTIVATION_CALLER_AUTHORITY_DENIED`.
 */
export declare function checkCallerAuthority(source: ActivationSource, callerId: string | undefined): void;
/**
 * Step 5 — team-level admission of the activation source (v1 rule: every
 * closed-vocabulary source is admitted; the request validation has already
 * rejected unknown sources). The compatibility engine (step 6) is the
 * environment gate and the binder admission guard (post-commit) is the work
 * gate; this step owns the source-class admission only.
 *
 * @param source - the activation source.
 * @throws {@link ActivationError} `ACTIVATION_SOURCE_NOT_ADMITTED` (a
 *   source outside the closed vocabulary — unreachable after validation,
 *   kept as a loud guard).
 */
export declare function admitSource(source: ActivationSource): void;
/**
 * The closed bridge from the blueprint's free lowercase-slug requirement
 * domains to the compatibility engine's closed §27.1 requirement-type
 * vocabulary (the canonical mapping established by the P3-T6 composition
 * pipeline: `tool`→tool, `skill`→skill, `mcp`→mcpServer — extended here to
 * the full closed type set).
 */
export declare const BLUEPRINT_DOMAIN_TO_REQUIREMENT_TYPE: Readonly<Record<string, RequirementType>>;
/**
 * Map the blueprint's capability requirements to the compatibility engine's
 * typed requirements (step 6 input half).
 *
 * `optional` mapping (documented ruling): a blueprint requirement marked
 * `optional: true` maps to `complete: false` (an unmet optional capability
 * degrades to an ack-able WARNING); a required requirement maps to
 * `complete: true` (an unmet required capability is FATAL — the team must
 * not admit work it cannot structurally do). The `teamStructure` and
 * `persona` types are FATAL at the engine level regardless of `complete`.
 *
 * @param blueprint - the resolved blueprint.
 * @returns the typed requirement inputs (stable order: blueprint order).
 * @throws {@link ActivationError} `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL`
 *   when the blueprint declares a requirement domain outside the closed
 *   bridge (fail loud — an unprobeable requirement cannot be admitted).
 */
export declare function toActivationRequirements(blueprint: TeamBlueprint): readonly RequirementInput[];
/**
 * Step 6 — compatibility gate (invariant 50: the compatibility gate blocks
 * new-work admission).
 *
 * @param blueprint - the resolved blueprint.
 * @param environmentFacts - the current environment probe facts.
 * @param acknowledgements - optional WARNING acknowledgements (pass-through).
 * @returns the frozen compatibility result (status + per-requirement outcomes).
 * @throws {@link ActivationError} `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL`
 *   (BLOCKED_FATAL, or an unbridgeable requirement domain) or
 *   `ACTIVATION_COMPATIBILITY_BLOCKED_WARNING` (BLOCKED_WARNING:
 *   unacknowledged warnings).
 */
export declare function evaluateActivationCompatibility(blueprint: TeamBlueprint, environmentFacts: readonly EnvironmentFact[], acknowledgements: readonly WarningAcknowledgement[] | undefined): CompatibilityResult;
/** The durable counting view of one team (step 7 input). */
export interface QuotaCountingView {
    /** Every committed member record of the team (any lifecycle). */
    readonly members: readonly MemberInstanceRecordDto[];
    /** Every durable operation row (all teams; filtered here). */
    readonly operations: readonly OperationRecord[];
}
/**
 * The quota counts of one team: committed members plus in-flight (PREPARED,
 * not yet committed) provisioning reservations. In-flight reservations
 * count toward BOTH the instance totals and the concurrent-active quotas:
 * they will commit as CREATED (active) instances, so counting only
 * committed records would let parallel activations over-create (the G6
 * quota-race gate).
 *
 * @param view - the durable counting view.
 * @param rootSessionId - the team (root) session id.
 * @param templateId - the template being instantiated (per-template counts).
 * @returns the counts (team-wide and template-scoped; total and active).
 */
export declare function countTeamQuota(view: QuotaCountingView, rootSessionId: string, templateId: string): {
    readonly teamTotal: number;
    readonly teamActive: number;
    readonly templateTotal: number;
    readonly templateActive: number;
};
/**
 * Step 7 — quota check against the blueprint's quota spec. An absent quota
 * (or absent bound) is UNLIMITED. The counts include in-flight reservations
 * (see {@link countTeamQuota}).
 *
 * Quota semantics (documented ruling): `quotas.team.maxInstances` = team-
 * wide total committed + in-flight instances; `quotas.team.maxConcurrent` =
 * team-wide ACTIVE (CREATED|RUNNING) instances; `quotas.members.*` = the
 * same two bounds scoped to the template being instantiated (one Quota
 * object shared by all member templates).
 *
 * @param quota - the blueprint's quota spec (may be undefined).
 * @param counts - the counted view.
 * @param templateId - the template being instantiated.
 * @throws {@link ActivationError} `ACTIVATION_QUOTA_*` (one of the four
 *   closed quota codes).
 */
export declare function checkQuota(quota: QuotaSpec | undefined, counts: {
    readonly teamTotal: number;
    readonly teamActive: number;
    readonly templateTotal: number;
    readonly templateActive: number;
}, templateId: string): void;
/**
 * The deterministic overlay/override selection from the durable `overrides`
 * store into the policy resolver's overlay slots (step 8 input half).
 *
 * Mapping (closed, documented ruling):
 *
 * - `scope: 'team'` + `kind: 'autonomy-overlay'` → the `templateOverlay`
 *   slot (kind `'template'`);
 * - `scope: 'instance'` matching the NEW instance id + `kind:
 *   'autonomy-overlay'` → the `instanceOverlay` slot (kind `'instance'`) —
 *   never present for a genuinely fresh instance, supported for re-drive
 *   correctness;
 * - `kind: 'human-override'` → the `humanOverride` slot (the instance-
 *   scoped record wins over the team-scoped one, per the policy contract);
 * - multiple candidates for one slot: the HIGHEST `generation` wins, ties
 *   broken by the LEXICOGRAPHICALLY SMALLEST `recordId` (deterministic;
 *   multi-overlay composition is owned by the later governance work).
 *
 * The stored `values` payload passes through UNTOUCHED: the policy resolver
 * re-validates it (a malformed stored payload fails closed in step 8).
 *
 * @param overrides - the durable governance override records (all teams).
 * @param rootSessionId - the team (root) session id.
 * @param instanceId - the instance being activated.
 * @returns the selected overlay slots (absent when no candidate exists).
 */
export declare function selectPolicyOverrides(overrides: readonly GovernanceOverrideRecord[], rootSessionId: string, instanceId: string): {
    readonly templateOverlay?: AutonomyOverlayRecord;
    readonly instanceOverlay?: AutonomyOverlayRecord;
    readonly humanOverride?: HumanOverrideRecord;
};
/**
 * Step 8 — effective policy resolution for the member being activated.
 *
 * v1 input assembly (documented ruling): the v1 blueprint carries no
 * per-capability value layers (its envelopes are mutation-operation
 * envelopes, not policy cells — the canonical P3-T6 pipeline resolves with
 * empty blueprint/template value layers), so the policy input uses empty
 * value layers; the differentiation comes from the stored
 * overlay/override records (durable, team-scoped) and the external hard
 * facts (injected; no Team layer can bypass them, invariant 34). The
 * PolicyState is the implicit `default` state of v1 (the TeamSession has no
 * durable transition store yet; invariant 40 owns transitions).
 *
 * @param args - the resolution inputs.
 * @returns the frozen effective policy (explainable per-cell, provenance
 *   included).
 * @throws {@link ActivationError} `ACTIVATION_POLICY_RESOLUTION_FAILED` when
 *   the resolver rejects the input (e.g. a malformed stored overlay payload
 *   — fail closed).
 */
export declare function resolveActivationPolicy(args: {
    readonly rootSessionId: string;
    readonly instanceId: string;
    readonly overrides: readonly GovernanceOverrideRecord[];
    readonly external: ExternalPolicyFacts;
}): EffectivePolicy;
/** The per-capability effective values of one resolution (lossless-JSON view). */
export declare function effectivePolicyValues(policy: EffectivePolicy): Record<string, PolicyEntry>;
/**
 * The mutation-operation overlay bounds of a new member (step 9): the
 * INTERSECTION of the Team envelope and the template's member envelope
 * (Architecture §5.4/§19.3: a mutation operation is in-bounds only when
 * BOTH envelopes allow it; an absent envelope or an absent operation =
 * out-of-bounds — the boundary fails closed).
 *
 * @param blueprint - the resolved blueprint.
 * @param templateId - the template being instantiated.
 * @returns the in-bounds mutation operations (deterministic order).
 */
export declare function computeOverlayBounds(blueprint: TeamBlueprint, templateId: string): readonly string[];
/** The frozen creation-time fields of one activation (step 10 output). */
export interface ResolvedCreationFields {
    /** The validated label. */
    readonly label: string;
    /** The validated group id (absent when the request carried none). */
    readonly groupId?: string;
    /** The effective workspace (explicit > TeamSession default > absent). */
    readonly workspace?: string;
    /** The contextPolicy frozen at creation (invariant 29). */
    readonly contextPolicy: ContextPolicy;
}
/**
 * Step 10 — workspace/context creation fields (frozen at creation):
 *
 * - the label / groupId are structurally validated (contracts v1 field
 *   rules);
 * - the effective workspace = the explicit request workspace, else the
 *   TeamSession default (Architecture §21.2 W1);
 * - the contextPolicy = the TEMPLATE's contextPolicy, else the default
 *   (`persistent`) — invariant 29: it is frozen from the template at
 *   creation and never caller-chosen; an unknown template token fails
 *   closed (the blueprint validation only bounds the token format, not the
 *   domain vocabulary).
 *
 * @param teamSession - the TeamSession record (default workspace).
 * @param request - the activation request (label/groupId/workspace).
 * @param template - the resolved template (contextPolicy).
 * @returns the frozen creation fields.
 * @throws {@link ActivationError} `ACTIVATION_INVALID_WORKSPACE_FIELD`,
 *   `ACTIVATION_INVALID_LABEL_FIELD`, `ACTIVATION_INVALID_GROUP_ID_FIELD`,
 *   or `ACTIVATION_TEMPLATE_CONTEXT_POLICY_UNKNOWN`.
 */
export declare function resolveCreationFields(teamSession: TeamSessionRecordDto, request: MemberActivationRequest, template: {
    readonly contextPolicy?: string;
}): ResolvedCreationFields;
/**
 * Step 11 — allocate the member instance id for the logical operation and
 * collision-check it against durable state (read-only): committed members
 * of the team AND in-flight provisioning reservations (PREPARED operation
 * rows). The allocation is deterministic in `(rootSessionId, source,
 * requestToken)` (see `identity.ts`), so the check runs under the team
 * lock in the provider together with the quota count and the reservation.
 *
 * A collision is a LOUD failure (the logical token is stable: a retry of
 * the same operation re-derives the same id and converges; a DIFFERENT
 * operation colliding is a true conflict that must surface, never be
 * silently rotated).
 *
 * @param request - the activation request.
 * @param view - the durable counting view (members + operations).
 * @returns the allocated (collision-checked) instance id.
 * @throws {@link ActivationError} `ACTIVATION_INSTANCE_ID_CONFLICT` (or
 *   `ACTIVATION_LEADER_INSTANCE_ID_RESERVED`).
 */
export declare function allocateCheckedInstanceId(request: MemberActivationRequest, view: QuotaCountingView): string;
//# sourceMappingURL=checks.d.ts.map