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
import type { MemberIdentity, TeamSessionId } from './contracts-mirror.js';
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
export declare const CAPABILITY_NAMES: {
    readonly MODEL: "model";
    readonly TOOLS: "tools";
    readonly PERMISSIONS: "permissions";
    readonly SKILLS: "skills";
    readonly MCP: "mcp";
};
/** One of the closed capability domains. */
export type CapabilityName = (typeof CAPABILITY_NAMES)[keyof typeof CAPABILITY_NAMES];
/** The capability domains in canonical iteration order (deterministic). */
export declare const CAPABILITY_NAME_VALUES: readonly CapabilityName[];
/**
 * A per-capability policy value: an explicit allow-list of items (model
 * names, tool names, permission names, skill ids, MCP server names — the
 * item vocabulary is domain-specific and opaque to the resolver) or a
 * blanket denial.
 *
 * A `deny` entry is an ordinary value in the precedence order, NOT a
 * monotonic restriction (§19.6): a higher layer may lawfully RELAX a lower
 * layer's deny — e.g. an explicit human override re-granting what the
 * blueprint denied (invariant 34, within the external hard facts).
 */
export type PolicyEntry = {
    readonly kind: 'allow';
    readonly items: readonly string[];
} | {
    readonly kind: 'deny';
};
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
export declare const TEAM_LAYERS: {
    readonly BLUEPRINT: "blueprint";
    readonly POLICY_STATE: "policyState";
    readonly TEMPLATE: "template";
    readonly TEMPLATE_OVERLAY: "templateOverlay";
    readonly INSTANCE_OVERLAY: "instanceOverlay";
    readonly HUMAN_OVERRIDE: "humanOverride";
};
/** One of the Team-owned value layers. */
export type TeamLayer = (typeof TEAM_LAYERS)[keyof typeof TEAM_LAYERS];
/** A Team value layer, or the `unspecified` fail-closed marker. */
export type TeamLayerOrUnspecified = TeamLayer | 'unspecified';
/** Ascending precedence of the Team-owned value layers (index = rank). */
export declare const TEAM_LAYER_ORDER: readonly TeamLayer[];
/** Every value that may appear in a resolved cell's `team.layer` field. */
export declare const TEAM_LAYER_OR_UNSPECIFIED_VALUES: readonly TeamLayerOrUnspecified[];
/**
 * Who supplied a winning Team value. Agent autonomy (leader/member) is kept
 * strictly separate from explicit human authority — both in the model (two
 * record types: {@link AutonomyOverlayRecord} vs
 * {@link HumanOverrideRecord}) and in provenance (TaskDoc P3-T4
 * "separate leader autonomy from human override"; Architecture §19.4/§19.5,
 * Governance category D, invariant 34).
 */
export declare const TEAM_VALUE_ORIGINS: {
    /** A static Team declaration: blueprint value, PolicyState value, or
     *  member template value (and the implicit fail-closed deny). */
    readonly STATIC: "static";
    /** An autonomy overlay produced by the leader (or authorized
     *  automation/router, §19.4). */
    readonly LEADER: "leader";
    /** An autonomy overlay produced by a member (a leader-authorized request,
     *  §25.1 "request mutation inside leader-authorized envelope"). */
    readonly MEMBER: "member";
    /** An explicit human override (§19.5). */
    readonly HUMAN: "human";
};
/** Origin of a winning Team value. */
export type TeamValueOrigin = (typeof TEAM_VALUE_ORIGINS)[keyof typeof TEAM_VALUE_ORIGINS];
/** Every value that may appear in a resolved cell's `team.origin` field. */
export declare const TEAM_VALUE_ORIGIN_VALUES: readonly TeamValueOrigin[];
/** Who may produce an autonomy overlay (agent authority only — never human). */
export declare const OVERLAY_ORIGINS: {
    readonly LEADER: "leader";
    readonly MEMBER: "member";
};
/** The origin of one autonomy overlay record. */
export type OverlayOrigin = (typeof OVERLAY_ORIGINS)[keyof typeof OVERLAY_ORIGINS];
/** The implicit PolicyState of simple blueprints (Architecture §20.3). */
export declare const DEFAULT_POLICY_STATE_ID = "default";
/**
 * The per-cell view of the TeamSession's CURRENT PolicyState (§20).
 *
 * PolicyState belongs to the TeamSession (invariant 38) — one state for the
 * whole session; per-member differences are expressed by the template
 * envelope and the instance-scoped overlays (§20.2).
 */
export interface PolicyStateView {
    /**
     * The current governance mode id. Blueprints define states freely
     * (examples in §20.1: `research`, `locked-validation`; the implicit state
     * of simple blueprints is {@link DEFAULT_POLICY_STATE_ID}). The state is
     * switched only by explicit user / authorized-leader transition
     * (invariant 40) — the resolver consumes the current state, it never
     * transitions it.
     */
    stateId: string;
    /** Per-cell governance. An absent cell means: open (overlays admitted)
     *  and no session-level value. */
    cells?: Partial<Record<CapabilityName, PolicyStateCellView>>;
}
/** One capability cell of a PolicyState view. */
export interface PolicyStateCellView {
    /**
     * Whether the current mode LOCKS this cell against autonomy overlays.
     *
     * A locked cell SUPPRESSES a stored `allow` overlay for this cell
     * ("stored but suppressed", §19.4 — non-destructive; it may become
     * effective again if the PolicyState later relaxes). Locking never
     * suppresses:
     * - a `deny` overlay (suppressing it would LOOSEN the effective value —
     *   a tightening state must never produce a loosening);
     * - an explicit human override (§19.5: "PolicyState changes must not
     *   auto-suppress an explicit human override").
     *
     * Default (absent): not locked.
     */
    locked?: boolean;
    /** An optional session-level value the state pins for this cell. It
     *  participates in precedence as the `policyState` value layer (between
     *  `blueprint` and `template`). The state is part of the Team autonomy
     *  boundary definition (§19.3) and is explicitly switched (invariant
     *  40), so its value is not envelope-checked like agent overlays. */
    value?: PolicyEntry;
}
/**
 * A stored AUTONOMY OVERLAY record (§19.4, Governance category D): a
 * leader/member runtime override that must live inside the Team autonomy
 * boundary.
 *
 * Two scopes exist (Architecture §14.3-D):
 * - `kind: 'template'` — the TeamSession template-scoped overlay (the
 *   templateAutonomyOverlay of §19.6);
 * - `kind: 'instance'` — the MemberInstance-scoped overlay (the
 *   instanceAutonomyOverlay of §19.6).
 *
 * Agent authority only: `origin` is `leader` or `member` — human authority
 * has its own record type ({@link HumanOverrideRecord}) and must never be
 * conflated with agent autonomy.
 */
export interface AutonomyOverlayRecord {
    /** Stable id of the durable overlay record (auditable, §19.4). */
    overlayId: string;
    /** The overlay scope slot; must match the input slot it is passed in. */
    kind: 'template' | 'instance';
    /** Who produced the overlay (agent authority). */
    origin: OverlayOrigin;
    /** The per-cell values the overlay claims. */
    values: Partial<Record<CapabilityName, PolicyEntry>>;
}
/**
 * An EXPLICIT HUMAN OVERRIDE record (§19.5): set by the user through an
 * explicit UI/API. Durable and auditable; may override Team autonomy
 * restrictions (invariant 34) but cannot create an unavailable capability
 * (invariant 35) and cannot override the External Hard Policy (§19.5,
 * §25.4).
 *
 * Scope: `team` (TeamSession-scoped — applies to every member) or
 * `instance` (MemberInstance-scoped). The resolver receives the single
 * override applicable to the member being resolved (the caller selects:
 * the instance-scoped one if present, else the team-scoped one).
 */
export interface HumanOverrideRecord {
    /** Stable id of the durable override record (auditable, §19.5). */
    overrideId: string;
    /** The override scope. */
    scope: 'team' | 'instance';
    /** The per-cell values the override claims. */
    values: Partial<Record<CapabilityName, PolicyEntry>>;
}
/**
 * The blueprint's Team-level policy contribution (the "Blueprint policy
 * envelope", card input): the Team-owned ordinary capability policy plus
 * the Team autonomy/mutation envelope (Architecture §5.4 semantic
 * categories; §5.6 freezes both in the TeamSession's Blueprint snapshot).
 */
export interface BlueprintPolicyEnvelope {
    /** Team-level policy values (lowest precedence value layer). */
    values?: Partial<Record<CapabilityName, PolicyEntry>>;
    /**
     * The Team autonomy/mutation envelope (§5.4): per-cell item limits of
     * what the Team's own agents may autonomously reach, JOINTLY with the
     * member template envelope (§19.3). A cell that is absent or `deny` here
     * has an EMPTY boundary: no agent overlay may grant anything in that
     * cell (leader grant → `LEADER_OUT_OF_ENVELOPE`, member grant →
     * `MEMBER_SELF_ESCALATION`; invariants 36/37).
     */
    autonomyEnvelope?: Partial<Record<CapabilityName, PolicyEntry>>;
}
/**
 * The member template's policy contribution (Architecture §6.2: tools /
 * permissions / skills / MCP policies + base model declaration + member
 * mutation envelope).
 */
export interface TemplatePolicy {
    /** The template's policy values (value layer above the PolicyState). */
    values?: Partial<Record<CapabilityName, PolicyEntry>>;
    /**
     * The member mutation envelope (§6.2/§5.4): this template's share of the
     * Team autonomy boundary (§19.3). The effective boundary for agent
     * overlays is the INTERSECTION of the blueprint autonomyEnvelope and
     * this mutationEnvelope, per cell.
     */
    mutationEnvelope?: Partial<Record<CapabilityName, PolicyEntry>>;
}
/**
 * The EXTERNAL facts intersected at stage 2 (Architecture §19.2, §19.6):
 * the host ceiling and the capability-existence probe. These are NOT Team
 * layers — no Team actor, human override included, can bypass them
 * (invariant 34; §25.4 "no Team control decision may bypass the external
 * hard guard").
 */
export interface ExternalPolicyFacts {
    /**
     * The external hard policy per cell: a host allow-list limit or a blanket
     * deny (system/managed/project hard policy, §19.2). An ABSENT cell means
     * "no host restriction" (identity intersection) — the resolver consumes
     * the facts it is given; probing them is the compatibility engine's job
     * (P3-T5), re-probed on cold resume (invariant 36.3 / §36.3).
     */
    hard: Partial<Record<CapabilityName, PolicyEntry>>;
    /**
     * Capability-existence probe facts (§19.2 "capability actual
     * existence"): whether the capability actually exists in the current
     * substrate. An ABSENT cell is assumed present (the resolver fails
     * closed only on an explicit `false`); an explicit `false` denies the
     * cell for EVERY layer — a stored override cannot create a removed
     * capability back, it enters compatibility drift instead (§21.5,
     * invariant 35).
     */
    capabilityExists: Partial<Record<CapabilityName, boolean>>;
}
/**
 * The complete pure-resolver input: everything needed to compute the
 * effective policy for ONE member of ONE TeamSession.
 *
 * The resolver is stateless and deterministic: no I/O, no ambient state,
 * no live Agent (package contract: closed and deterministic).
 *
 * Input vs output mutability: the INPUT is plain caller-constructed data
 * (mutable; the resolver never mutates it). The OUTPUT
 * ({@link EffectivePolicy}) is deep-frozen provenance.
 */
export interface EffectivePolicyInput {
    /** The TeamSession being resolved (its root session id, invariant 9). */
    teamSessionId: TeamSessionId;
    /** The member being resolved (composite identity, invariant 18). */
    member: MemberIdentity;
    /** The Team-level policy envelope of the bound Blueprint snapshot. */
    blueprint: BlueprintPolicyEnvelope;
    /** The resolved member's template policy. */
    template: TemplatePolicy;
    /** The TeamSession's current PolicyState (§20). */
    policyState: PolicyStateView;
    /** The template-scoped autonomy overlay, if one is stored for this
     *  TeamSession template (kind must be `'template'`). */
    templateOverlay?: AutonomyOverlayRecord;
    /** The instance-scoped autonomy overlay of the resolved member, if one
     *  is stored for this instance (kind must be `'instance'`). */
    instanceOverlay?: AutonomyOverlayRecord;
    /** The explicit human override applicable to the resolved member, if any
     *  (team-scoped or instance-scoped). */
    humanOverride?: HumanOverrideRecord;
    /** The external hard facts intersected at stage 2. */
    external: ExternalPolicyFacts;
}
/** Why a stored overlay is suppressed (open set, v1: exactly one reason). */
export type SuppressionReason = 'policyStateLocked';
/**
 * A stored-but-suppressed autonomy overlay entry (§19.4): the overlay
 * record is preserved (non-destructive) but does not contribute to the
 * current effective value.
 */
export interface SuppressedOverlayRecord {
    /** The capability cell the suppression applies to. */
    readonly capability: CapabilityName;
    /** The overlay record id (the durable record is preserved). */
    readonly overlayId: string;
    /** The overlay's value layer. */
    readonly layer: TeamLayer;
    /** Who produced the overlay. */
    readonly origin: OverlayOrigin;
    /** The value the (suppressed) overlay claims. */
    readonly value: PolicyEntry;
    /** Why it is suppressed. */
    readonly reason: SuppressionReason;
    /** The PolicyState that locks the cell. */
    readonly policyStateId: string;
}
/** A lower-precedence Team layer that lost for one cell (explanation). */
export interface OverriddenTeamLayer {
    /** The losing layer. */
    readonly layer: TeamLayer;
    /** Who supplied it. */
    readonly origin: TeamValueOrigin;
    /** The overlay/override record id, or null for static layers. */
    readonly recordId: string | null;
    /** The value it claimed. */
    readonly value: PolicyEntry;
}
/**
 * Stage 1 result for one cell: the Team-domain resolution (invariant 33 —
 * resolved in the Team domain BEFORE materialization to the DSH guard).
 * Every field is first-class explainable data.
 */
export interface TeamResolvedCell {
    /** The winning Team-owned layer, or `'unspecified'` when no Team layer
     *  granted the cell (the Team domain fails closed: deny). */
    readonly layer: TeamLayerOrUnspecified;
    /** Who supplied the winning value. */
    readonly origin: TeamValueOrigin;
    /** The overlay/override record id of the winner, or null for static
     *  layers / the unspecified default. */
    readonly recordId: string | null;
    /** The winner's raw value (before the external stage). */
    readonly value: PolicyEntry;
    /** Every lower-precedence layer that also had a value for this cell and
     *  lost (in ascending precedence order). */
    readonly overriddenLower: readonly OverriddenTeamLayer[];
    /** The stored-but-suppressed autonomy overlays for this cell (§19.4). */
    readonly suppressed: readonly SuppressedOverlayRecord[];
}
/** Stage 2 facts for one cell: what the external intersection consumed. */
export interface ExternalCellFacts {
    /** The existence fact as consumed (absent probe → assumed true). */
    readonly capabilityExists: boolean;
    /** The hard fact as consumed. */
    readonly hard: 'unspecified' | 'deny' | {
        readonly allowedItems: readonly string[];
    };
    /** The Team-allowed items removed by the external stage (empty when the
     *  stage removed nothing). */
    readonly removedItems: readonly string[];
    /** Why the external stage changed the Team value — or `'none'`.
     *  Precedence when several facts apply: `capabilityMissing` >
     *  `externalHardDeny` > `externalHardRemovedAll` > `none`. */
    readonly note: 'none' | 'capabilityMissing' | 'externalHardDeny' | 'externalHardRemovedAll';
}
/** The full resolution of one capability cell. */
export interface CellResolution {
    /** The capability cell. */
    readonly capability: CapabilityName;
    /** The FINAL effective value: `P_effective = P_externalHard ∩
     *  P_capabilityExists ∩ P_TeamResolved` (§19.6). No Team layer —
     *  human override included — can bypass the external facts. */
    readonly effective: PolicyEntry;
    /** Stage 1: the Team-domain resolution with full provenance. */
    readonly team: TeamResolvedCell;
    /** Stage 2: the external facts and their exact effect. */
    readonly external: ExternalCellFacts;
    /** A deterministic, human-readable one-line explanation of every stage
     *  (stable string; safe for audit UI, §37.1 "overrides/effective config
     *  provenance"). */
    readonly explanation: string;
}
/**
 * The resolver output: the effective policy of one member, with the
 * provenance of EVERY value as first-class data (TaskDoc P3-T4 acceptance:
 * "every effective value is explainable").
 */
export interface EffectivePolicy {
    /** The TeamSession this resolution belongs to. */
    readonly teamSessionId: TeamSessionId;
    /** The member this resolution was computed for. */
    readonly member: MemberIdentity;
    /** The PolicyState id that was in effect. */
    readonly policyStateId: string;
    /** The resolved cells, one per capability domain (all five, always). */
    readonly cells: Record<CapabilityName, CellResolution>;
    /** Every stored-but-suppressed overlay across all cells (non-destructive
     *  preservation, §19.4). */
    readonly suppressed: readonly SuppressedOverlayRecord[];
    /** The full deterministic report: one explanation line per capability
     *  cell, in canonical capability order. */
    readonly explanation: string;
}
//# sourceMappingURL=types.d.ts.map