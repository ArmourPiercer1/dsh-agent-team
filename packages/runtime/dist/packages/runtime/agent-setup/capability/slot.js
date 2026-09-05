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
import { resolveCapabilityOverlay } from './resolve.js';
import { CAPABILITY_FACETS, } from './types.js';
/**
 * Build the capability overlay slot.
 *
 * @param options - the injected capability overlay configuration.
 * @returns the `capability` {@link OverlaySlot} (install it in the binder
 *   via `TeamAgentBinderOptions.slots.capability`).
 * @throws {TypeError} when the config is malformed (a programming error,
 *   surfaced fail-fast — the slot is never constructed half-validated).
 */
export function createCapabilityOverlaySlot(options) {
    if (options === null || typeof options !== 'object') {
        throw new TypeError('CapabilityOverlaySlotOptions must be an object');
    }
    const config = options.config;
    if (config === null || typeof config !== 'object' || config.facets === null || typeof config.facets !== 'object') {
        throw new TypeError('CapabilityOverlaySlotOptions.config must provide a facets record');
    }
    // Fail-fast config validation: a malformed facet surfaces NOW (at
    // construction), never mid-bind.
    resolveCapabilityOverlay(config);
    let lastResolution = null;
    const applied = [];
    return {
        name: 'capability',
        applied,
        get lastResolution() {
            return lastResolution;
        },
        apply(context) {
            // The core formula (pure, idempotent): effective =
            // available ∩ teamResolved ∩ externalHard per facet, with the G2
            // fail-closed gate. A disappear / unexposed capability resolves to
            // an empty effective set — it never throws here.
            const resolution = resolveCapabilityOverlay(config);
            lastResolution = resolution;
            // Install each facet's effective items through its G2-PROVEN public
            // seam (the public Agent setup effect; the seams are re-entrant, so
            // a re-drive converges to the same installed state).
            for (const facet of CAPABILITY_FACETS) {
                const facetResolution = resolution[facet];
                // G2 discipline: a facet whose public seam did NOT pass G2 is
                // never touched — no install of any kind, no private workaround.
                if (!facetResolution.seamPassedG2) {
                    continue;
                }
                if (facetResolution.effective.length === 0) {
                    continue;
                }
                config.facets[facet].seam.install(facetResolution.effective);
            }
            applied.push(context);
        },
    };
}
//# sourceMappingURL=slot.js.map