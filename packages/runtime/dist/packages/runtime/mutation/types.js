/**
 * P7-T2 — runtime mutation/provenance vocabulary and port surface
 * (TaskDoc §11.8 P7-T2; Development Plan §20.2; Architecture §19.4/§19.5/
 * §20/§21).
 *
 * The frozen DevPlan §20.2 "Runtime mutation" contract:
 *
 * ```text
 * model future step
 * permission/tool future operation
 * skills/MCP future operation
 * human override
 * Autonomy Overlay
 * PolicyState suppression/provenance
 *
 * 所有 effective config 都必须可解释 provenance.
 * ```
 *
 * This module implements the RUNTIME half of that contract as a PURE
 * service over four injected ports (no I/O, no DSH imports, no ambient
 * state — the established wave-1 runtime pattern):
 *
 * - {@link StepClock} — the step-boundary clock: the mutation plane reads
 *   `currentStep()`; every admitted mutation takes effect at the NEXT step
 *   boundary (`effectiveFromStep = requestedAtStep + 1`), and already
 *   captured (in-flight) work keeps its step's resolution unchanged
 *   (Architecture §21.3–§21.5: the in-flight request is never re-pointed
 *   at a concurrent override; the change affects FUTURE operations);
 * - {@link MutationStore} — the durable config store of the TeamSession's
 *   mutation records (PolicyState transitions, autonomy overlay records,
 *   human override records, per-instance creation fields, the append-only
 *   provenance ledger and the append-only suppression records). Tests run
 *   an in-memory implementation; the durable binding is a later
 *   integration concern (allowed dependencies: policy + binder adapters);
 * - {@link PolicyReader} — the static reads of the bound Blueprint
 *   snapshot: the Team policy envelope, the member template policy, and
 *   the external hard facts (host ceiling + capability existence).
 *
 * What this module does NOT do:
 *
 * - it never re-implements policy resolution. Stage 1 (Team-domain
 *   precedence) and stage 2 (external intersection) are computed by the
 *   FROZEN P3-T4 resolver (`resolveEffectivePolicy`,
 *   `packages/domain/policy`); {@link ../policy-adapter.js} assembles its
 *   input from the store + reader;
 * - it never invents a parallel origin/provenance taxonomy: every origin,
 *   layer, record, and suppression type reuses the frozen domain
 *   vocabulary (`TeamValueOrigin`, `OverlayOrigin`, `TeamLayer`,
 *   `SuppressedOverlayRecord`, `SuppressionReason`, the two record types
 *   `AutonomyOverlayRecord` / `HumanOverrideRecord`).
 *
 * The closed five capability domains are the frozen policy domains
 * (`model` / `tools` / `permissions` / `skills` / `mcp`) — this module
 * adds no sixth.
 *
 * @module @dsh-agent-team/runtime/mutation/types
 */
// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------
/**
 * The closed mutation-actor kinds. Agent autonomy (leader / member) is
 * kept strictly separate from explicit human authority — the same split as
 * the frozen domain's two record types (Architecture §19.4/§19.5).
 */
export const MUTATION_ACTOR_KINDS = {
    /** Explicit human authority (UI/API) — produces a HumanOverrideRecord. */
    HUMAN: 'human',
    /** The TeamSession's authorized leader — produces a template-scoped
     *  AutonomyOverlayRecord (leader origin). */
    LEADER: 'leader',
    /** A member (leader-authorized request, §25.1) — produces an
     *  instance-scoped AutonomyOverlayRecord (member origin). */
    MEMBER: 'member',
};
/** The closed creation-field names (Architecture §21.2/§21.6). */
export const CREATION_FIELDS = {
    /** §21.2: creation-mutable, immutable after first RUNNING. */
    WORKSPACE: 'workspace',
    /** §21.6: immutable after MemberInstance creation. */
    CONTEXT_POLICY: 'contextPolicy',
};
// ---------------------------------------------------------------------------
// Durable records (the store's row model)
// ---------------------------------------------------------------------------
/**
 * The closed durable record kinds. Agent autonomy is ONE record family
 * ({@link StoredMutationRecord} with the two overlay kinds — the frozen
 * `AutonomyOverlayRecord` shape); human authority is the separate
 * family (the frozen `HumanOverrideRecord` shape).
 */
export const MUTATION_RECORD_KINDS = {
    /** Leader-origin, template-scoped (TeamSession-wide) overlay. */
    TEMPLATE_OVERLAY: 'templateOverlay',
    /** Member-origin, instance-scoped overlay. */
    INSTANCE_OVERLAY: 'instanceOverlay',
    /** Human-origin override (team- or instance-scoped). */
    HUMAN_OVERRIDE: 'humanOverride',
};
//# sourceMappingURL=types.js.map