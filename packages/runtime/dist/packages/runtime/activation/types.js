/**
 * ActivationProvider contracts (TaskDoc §11.7 P6-T1; DevPlan §19.1–§19.2).
 *
 * The ActivationProvider is the SOLE entry point for every new
 * MemberInstance creation (Architecture §42 invariant 26): human-initiated
 * creation, leader-explicit creation, and leader delegation all flow through
 * the SAME admission/provisioning order. No other path may create a
 * MemberInstance record or its durable child Session binding — the G6 gate
 * "tool layer cannot bypass ActivationProvider/TeamRuntime" is verified
 * against exactly this surface.
 *
 * This module defines the frozen CONTRACT of the provider:
 *
 * - the closed activation SOURCE vocabulary (who initiated the activation);
 * - the activation REQUEST (one logical operation, identified by a stable
 *   `requestToken` — the stable operation identity of Architecture §18.2);
 * - the PORTS the provider is built with (mock-first per ruling R28; the
 *   TeamDomain repositories facade is the ONLY durable state boundary,
 *   invariant 41);
 * - the ACTIVATION RESULT (the committed MemberInstance record plus the
 *   activation provenance; or a read-only `continued` result when a
 *   delegation resolves to an existing instance).
 *
 * The provider OWNS no durable state of its own: every durable write goes
 * through the injected TeamDomain (invariant 41) via the P4-T4
 * provisioning coordinator, and every external effect goes through the
 * injected child-session factory (the single external effect of the
 * provisioning protocol).
 *
 * Pure contracts module: no I/O, no `node:` builtins, no live references.
 * @module @dsh-agent-team/runtime/activation/types
 */
// --- sources -------------------------------------------------------------------
/**
 * The closed activation SOURCE vocabulary (v1).
 *
 * Every new MemberInstance is created through the ActivationProvider by one
 * of these sources (invariant 26). The vocabulary is closed for contract v1:
 * a future phase (router/workflow) EXTENDS it through a domain-version
 * change, never a silent edit — and it still flows through this SAME entry
 * point.
 */
export const ACTIVATION_SOURCES = {
    /** The LeaderInstance explicitly creates a new member. */
    LEADER_EXPLICIT: 'leader-explicit',
    /** A leader delegation resolves to a NEW instance (contextPolicy
     *  `fresh_per_delegation` or no active instance for the template). */
    LEADER_DELEGATE: 'leader-delegate',
    /** A human adds a member through the team UI/API. */
    HUMAN_UI: 'human-ui',
};
/** Every activation source value, for membership checks and closed-set tests. */
export const ACTIVATION_SOURCE_VALUES = Object.values(ACTIVATION_SOURCES);
//# sourceMappingURL=types.js.map