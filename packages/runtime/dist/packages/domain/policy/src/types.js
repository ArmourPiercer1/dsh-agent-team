/**
 * Policy resolver vocabulary and input/output types (P3-T4).
 *
 * The vocabulary of the pure policy resolver that implements the frozen
 * Architecture semantics for Team policy resolution:
 *
 * - **§19.6 Effective Team Policy** — two stages:
 *   1. `P_TeamResolved = Resolve(Blueprint, MemberTemplate, PolicyState,
 *      TemplateAutonomyOverlay, InstanceAutonomyOverlay, ExplicitHumanOverride)`
 *      — all Team-owned layers resolve inside the Team domain;
 *   2. `P_effective = P_externalHard ∩ P_capabilityExists ∩ P_TeamResolved`
 *      — the external hard facts intersect AFTER Team resolution and can
 *      never be bypassed by any Team layer, human override included.
 * - **§19.6 anti-pattern** — Team layers are resolved by precedence, NOT
 *   materialized as multiple irreversible monotonic restrictions; a higher
 *   layer (notably an explicit human override) may lawfully relax a lower
 *   Team deny (invariant 34).
 * - **§19.3 Team Autonomy Boundary** — jointly defined by the Blueprint
 *   envelope, the MemberTemplate envelope, and the PolicyState envelope;
 *   it bounds what the Team's own agents may autonomously change.
 * - **§19.4 Autonomy Overlay** — leader/member runtime overrides inside the
 *   boundary; when the PolicyState tightens, a stored `allow` overlay is
 *   "stored but suppressed" (never destructive-deleted, never loosening).
 * - **§19.5 Explicit Human Override** — durable and auditable; may override
 *   Team autonomy restrictions; cannot create an unavailable capability;
 *   cannot override the External Hard Policy; is NOT suppressed by
 *   PolicyState changes.
 * - **§20 PolicyState** — belongs to the TeamSession (invariant 38), governs
 *   runtime mutation, is switched only by explicit user/authorized-leader
 *   transition (invariant 40).
 *
 * Invariants (Architecture §42): 32 (Requirement != Policy), 33 (Team-domain
 * resolution before DSH-guard materialization), 34, 35, 36, 37, 38, 40.
 *
 * Development Plan §9.2: `domain` owns "PolicyState, policy resolution,
 * override precedence".
 *
 * Pure module: no I/O, no DSH imports, no ambient state (package contract:
 * closed and deterministic).
 * @module @dsh-agent-team/domain/policy/types
 */
/**
 * The CLOSED capability domains of the policy resolver.
 *
 * Exactly the five runtime configuration domains of Architecture
 * §21.3–§21.5 (model/provider/reasoningEffort, tools, permissions, skills,
 * MCP) — the runtime configuration that PolicyState governs (§20.1: "what
 * is currently allowed to modify?").
 *
 * Deliberately excluded:
 * - `contextPolicy`: freezes at instance creation (invariant 29, §11) — it
 *   is a creation-time fact of the MemberInstance record, not a
 *   runtime-mutable policy cell;
 * - approval: control-plane admission machinery (§25), not a configuration
 *   domain;
 * - quota: instance/team quota rules are a separate domain concern (they do
 *   not change per-cell policy values).
 *
 * The set is closed for contract v1: adding a domain is a domain-version
 * change, never a silent edit.
 */
export const CAPABILITY_NAMES = {
    MODEL: 'model',
    TOOLS: 'tools',
    PERMISSIONS: 'permissions',
    SKILLS: 'skills',
    MCP: 'mcp',
};
/** The capability domains in canonical iteration order (deterministic). */
export const CAPABILITY_NAME_VALUES = [
    CAPABILITY_NAMES.MODEL,
    CAPABILITY_NAMES.TOOLS,
    CAPABILITY_NAMES.PERMISSIONS,
    CAPABILITY_NAMES.SKILLS,
    CAPABILITY_NAMES.MCP,
];
/**
 * The Team-owned value layers, in ASCENDING precedence (earlier = lower).
 *
 * Precedence rule (card pipeline "Blueprint envelope → PolicyState →
 * template/instance/human override"; Development Plan §9.2 "override
 * precedence"): the narrower the scope and the more explicit the authority,
 * the higher the layer:
 *
 * 1. `blueprint` — the blueprint's Team-level values (the static baseline,
 *    §5.4 "Team-owned ordinary capability policy").
 * 2. `policyState` — the current TeamSession PolicyState's per-cell value
 *    (a session-level pin; §20).
 * 3. `template` — the member template's values (§6.2 per-template policies;
 *    narrower than the whole team).
 * 4. `templateOverlay` — the TeamSession template-scoped AUTONOMY overlay
 *    (agent runtime override, §19.4 / Governance category D).
 * 5. `instanceOverlay` — the MemberInstance-scoped AUTONOMY overlay (§19.4 /
 *    Governance category D).
 * 6. `humanOverride` — the EXPLICIT HUMAN override (§19.5): the highest
 *    Team-owned layer; not bounded by the Team autonomy envelope, never
 *    suppressed by the PolicyState, and still intersected with the external
 *    hard facts at stage 2.
 *
 * `unspecified` is the marker for a cell that no Team-owned layer grants:
 * the Team domain fails closed (deny) and an explicit human override is the
 * only layer that can grant such a cell (invariant 34: the human may exceed
 * the Team autonomy boundary).
 */
export const TEAM_LAYERS = {
    BLUEPRINT: 'blueprint',
    POLICY_STATE: 'policyState',
    TEMPLATE: 'template',
    TEMPLATE_OVERLAY: 'templateOverlay',
    INSTANCE_OVERLAY: 'instanceOverlay',
    HUMAN_OVERRIDE: 'humanOverride',
};
/** Ascending precedence of the Team-owned value layers (index = rank). */
export const TEAM_LAYER_ORDER = [
    TEAM_LAYERS.BLUEPRINT,
    TEAM_LAYERS.POLICY_STATE,
    TEAM_LAYERS.TEMPLATE,
    TEAM_LAYERS.TEMPLATE_OVERLAY,
    TEAM_LAYERS.INSTANCE_OVERLAY,
    TEAM_LAYERS.HUMAN_OVERRIDE,
];
/** Every value that may appear in a resolved cell's `team.layer` field. */
export const TEAM_LAYER_OR_UNSPECIFIED_VALUES = [
    ...TEAM_LAYER_ORDER,
    'unspecified',
];
/**
 * Who supplied a winning Team value. Agent autonomy (leader/member) is kept
 * strictly separate from explicit human authority — both in the model (two
 * record types: {@link AutonomyOverlayRecord} vs
 * {@link HumanOverrideRecord}) and in provenance (TaskDoc P3-T4
 * "separate leader autonomy from human override"; Architecture §19.4/§19.5,
 * Governance category D, invariant 34).
 */
export const TEAM_VALUE_ORIGINS = {
    /** A static Team declaration: blueprint value, PolicyState value, or
     *  member template value (and the implicit fail-closed deny). */
    STATIC: 'static',
    /** An autonomy overlay produced by the leader (or authorized
     *  automation/router, §19.4). */
    LEADER: 'leader',
    /** An autonomy overlay produced by a member (a leader-authorized request,
     *  §25.1 "request mutation inside leader-authorized envelope"). */
    MEMBER: 'member',
    /** An explicit human override (§19.5). */
    HUMAN: 'human',
};
/** Every value that may appear in a resolved cell's `team.origin` field. */
export const TEAM_VALUE_ORIGIN_VALUES = [
    TEAM_VALUE_ORIGINS.STATIC,
    TEAM_VALUE_ORIGINS.LEADER,
    TEAM_VALUE_ORIGINS.MEMBER,
    TEAM_VALUE_ORIGINS.HUMAN,
];
/** Who may produce an autonomy overlay (agent authority only — never human). */
export const OVERLAY_ORIGINS = {
    LEADER: 'leader',
    MEMBER: 'member',
};
/** The implicit PolicyState of simple blueprints (Architecture §20.3). */
export const DEFAULT_POLICY_STATE_ID = 'default';
//# sourceMappingURL=types.js.map