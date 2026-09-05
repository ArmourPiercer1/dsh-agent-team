/**
 * Capability overlay slot contract (TaskDoc §11.5 P5-T4; DevPlan §18.1).
 *
 * This module defines the P5-T4 `capability` OVERLAY SLOT (one of the three
 * T1 slots in {@link OVERLAY_SLOT_ORDER}: persona / model / capability). It
 * implements the unified-responsibility slice DevPlan §18.1 assigns to the
 * capability slot: "Team tools / resolved guard / skills-MCP adapter /
 * context policy". The T1 identity (no-op) default for the `capability`
 * slot is REPLACED by this implementation; the other two slots keep their
 * owning tasks (T2 persona / T3 model).
 *
 * The slot's business semantics (frozen):
 *
 * - **The core formula** (TaskDoc §11.5 P5-T4 acceptance): for every
 *   capability FACET, `effective capability = available ∩ teamResolved ∩
 *   externalHard` — the intersection of THREE explicit, INJECTABLE sets,
 *   each with its own explicit source:
 *   - `available` — the item-level capability-existence probe (the
 *     capability items the substrate/seam ACTUALLY provides; Architecture
 *     §19.2 "capability actual existence"). An item the seam no longer
 *     provides (capability disappear) drops out of `available` and hence
 *     of `effective` — a graceful degradation, never a crash;
 *   - `teamResolved` — the Team-domain policy resolution (`P_TeamResolved`,
 *     Architecture §19.6 stage 1; the policy resolver's stage-1 winner
 *     value). When the Team policy tightens, `teamResolved` shrinks and so
 *     does `effective`;
 *   - `externalHard` — the external hard facts (`P_externalHard`,
 *     Architecture §19.2/§19.6 stage 2: the host ceiling). An external
 *     hard denial removes the item from `effective` — NO Team layer, human
 *     override included, can bypass it (invariant 34, §25.4).
 *
 * - **G2 seam discipline** (TaskDoc §11.5 P5-T4: "严格按 G2 seam 能力";
 *   "任何未通过 G2 的 capability 不得 private workaround"): every facet is
 *   installed ONLY through its G2-PROVEN public seam (the P2-T4 capability
 *   seams: pre-step / pre-execute / tool visibility / skills / MCP — all
 *   PASS in the seam manifest). A facet whose public seam did NOT pass G2
 *   (not exposed in the substrate) FAILS CLOSED: its `effective` set is
 *   empty, nothing is installed, and the adapter NEVER fabricates a
 *   private registry or bypass path (DevPlan §15.4 G2: "any blocker stops
 *   affected feature before implementation").
 *
 * What this module does NOT do (and must never grow):
 *
 * - it NEVER writes TeamDomain (the binder owns the durable truth; the slot
 *   is a read-only consumer of the step context's record);
 * - it NEVER emits session events (the binder is the single emitter, the
 *   closed `agent-setup/*` vocabulary);
 * - it NEVER uses upstream private APIs or a private registry (zero-core);
 * - it is PURE in its resolution: `resolveCapabilityOverlay` is a
 *   deterministic function of the injected config (no I/O, no ambient
 *   state, no live Agent).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no runtime
 * environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/capability/types
 */
/** The closed facet set in canonical (deterministic) iteration order. */
export const CAPABILITY_FACETS = [
    'tools-permissions',
    'skills',
    'mcp',
    'pre-step-pre-execute',
];
//# sourceMappingURL=types.js.map