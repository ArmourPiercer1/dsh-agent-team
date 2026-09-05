/**
 * The capability OVERLAY SLOT factory (TaskDoc §11.5 P5-T4; DevPlan
 * §18.1).
 *
 * `createCapabilityOverlaySlot` builds the P5-T4 `capability` overlay slot
 * — the replacement for the T1 identity (no-op) default in the binder's
 * {@link OVERLAY_SLOT_ORDER} (persona → model → capability). The slot
 * implements the slot contract FROZEN for T2/T3/T4 (binder `OverlaySlot`):
 *
 * - `name` is `'capability'` (it must equal its options key);
 * - `apply(context)` performs PUBLIC Agent setup effects ONLY — it
 *   computes the effective capability (the core formula) and installs each
 *   facet's effective items through that facet's G2-PROVEN public seam
 *   (the injected seams are the slot's only contact with the agent
 *   runtime; the real DSH public mechanisms are bound in T5/T6,
 *   mock-first here). It NEVER writes TeamDomain and NEVER emits session
 *   events (the binder is the single emitter);
 * - `apply` is IDEMPOTENT: a re-drive after a partial bind recomputes the
 *   SAME resolution (the config is immutable for the slot's life) and
 *   re-installs through the re-entrant public seams, converging to the
 *   same installed state;
 * - a malformed config is a CONSTRUCTION-time `TypeError` (fail-fast, the
 *   same discipline as the binder's constructor): a well-formed slot's
 *   `apply` never throws on a disappeared / unexposed capability — the
 *   fail-closed facets simply resolve to an empty effective set and
 *   install nothing (denial, not a fault; the binder can never crash on
 *   a capability disappear).
 *
 * G2 discipline in `apply`: a facet whose public seam did NOT pass G2 is
 * NEVER touched — no install call of any kind, no private registry, no
 * bypass path (TaskDoc §11.5 P5-T4: "任何未通过 G2 的 capability 不得
 * private workaround").
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no ambient
 * state.
 * @module @dsh-agent-team/runtime/agent-setup/capability/slot
 */
import type { OverlaySlot, TeamAgentStepContext } from '../binder/index.js';
import { type CapabilityOverlayConfig, type CapabilityOverlayResolution } from './types.js';
/** The constructor options of {@link createCapabilityOverlaySlot}. */
export interface CapabilityOverlaySlotOptions {
    /**
     * The complete capability overlay configuration (the four facets, each
     * with its G2 public seam + its three explicit source sets). Validated
     * fail-fast at construction.
     */
    readonly config: CapabilityOverlayConfig;
}
/**
 * The P5-T4 capability overlay slot (the T1 `OverlaySlot` contract with
 * the slot's observability surface for tests / T5-T6 wiring).
 */
export interface CapabilityOverlaySlot extends OverlaySlot {
    /** Always `'capability'` (the slot key it fills). */
    readonly name: 'capability';
    /** The step contexts this slot's `apply` has run, in order. */
    readonly applied: readonly TeamAgentStepContext[];
    /**
     * The resolution of the LAST `apply` (the core-formula result with the
     * three operand sets per facet), or `null` before the first `apply`.
     */
    readonly lastResolution: CapabilityOverlayResolution | null;
}
/**
 * Build the capability overlay slot.
 *
 * @param options - the injected capability overlay configuration.
 * @returns the `capability` {@link OverlaySlot} (install it in the binder
 *   via `TeamAgentBinderOptions.slots.capability`).
 * @throws {TypeError} when the config is malformed (a programming error,
 *   surfaced fail-fast — the slot is never constructed half-validated).
 */
export declare function createCapabilityOverlaySlot(options: CapabilityOverlaySlotOptions): CapabilityOverlaySlot;
//# sourceMappingURL=slot.d.ts.map