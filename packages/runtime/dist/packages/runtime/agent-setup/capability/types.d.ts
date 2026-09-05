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
/**
 * The closed FACET vocabulary of the capability overlay (TaskDoc §11.5
 * P5-T4: "tools/permissions、skills、MCP、pre-step/pre-execute 四面").
 *
 * Each facet maps to the G2-PROVEN public seams (P2-T4 capability seam
 * matrix, all PASS):
 *
 * - `tools-permissions` → the **tool visibility** seam (the tools /
 *   permission allow-list gating of what the agent may see and call);
 * - `skills` → the **skills** seam (Agent-scope skill registration);
 * - `mcp` → the **MCP** seam (Agent-scope MCP server registration);
 * - `pre-step-pre-execute` → the **pre-step** + **pre-execute** seams
 *   (the Agent-scope admission guard BEFORE a step / BEFORE execution).
 *
 * The facets are DISTINCT (P2-T4: "skills/MCP 分开判定；不要由 tool seam
 * 推断"): the skills and MCP facets are judged separately and never inferred
 * from the tool seam.
 */
export type CapabilityFacet = 'tools-permissions' | 'skills' | 'mcp' | 'pre-step-pre-execute';
/** The closed facet set in canonical (deterministic) iteration order. */
export declare const CAPABILITY_FACETS: readonly CapabilityFacet[];
/**
 * The G2-PROVEN public seam of ONE facet (injected at slot construction —
 * the "public seams only" allowed dependency; the real DSH public
 * mechanism is bound in T5/T6, mock-first here).
 *
 * - `available` — whether the facet's G2 public seam is EXPOSED in the
 *   current substrate (it passed G2 and is reachable through the public
 *   API). `false` means the capability did NOT pass G2 → the adapter
 *   FAILS CLOSED for the whole facet (denies everything, no private
 *   workaround);
 * - `install(items)` — the public Agent setup EFFECT: install/enable the
 *   facet's effective capability items through the public seam. It is
 *   IDEMPOTENT / re-entrant (the real DSH public setup seams are
 *   re-entrant, per the T1 surface contract), so a re-drive of the slot's
 *   `apply` converges to the same installed state.
 */
export interface CapabilityFacetSeam {
    /** The facet's G2 public seam is exposed (passed G2) in the substrate. */
    readonly available: boolean;
    /**
     * Install the facet's effective capability items through the public seam.
     * @param items - the effective items (already intersected; empty when
     *   the facet failed closed or resolved to nothing).
     */
    install(items: readonly string[]): void;
}
/**
 * The THREE explicit, INJECTABLE source sets of ONE facet (the core
 * formula's operands; each has its own explicit source):
 *
 * - `available` — the capability-existence probe (the items the substrate
 *   provides; the seam's live capability inventory);
 * - `teamResolved` — the Team-domain policy resolution (`P_TeamResolved`);
 * - `externalHard` — the external hard facts (`P_externalHard`, the host
 *   ceiling; an absent host restriction is the identity and removes
 *   nothing).
 *
 * All three are plain `readonly string[]` (the item vocabulary is
 * domain-specific and opaque to the slot: tool names, skill ids, MCP
 * server names, guard names). They are INJECTABLE so the intersection
 * semantics are testable in isolation AND through the binder (ruling:
 * "每集合显式来源、可注入").
 */
export interface CapabilityFacetSources {
    /** The capability-existence probe (the items the substrate provides). */
    readonly available: readonly string[];
    /** The Team-domain policy resolution (`P_TeamResolved`). */
    readonly teamResolved: readonly string[];
    /** The external hard facts (`P_externalHard`, the host ceiling). */
    readonly externalHard: readonly string[];
}
/**
 * The WHY a facet failed closed (the closed fail-closed vocabulary).
 *
 * - `seam-not-g2` — the facet's public seam did NOT pass G2 (not exposed
 *   in the substrate): the adapter denies the whole facet and fabricates
 *   NO private workaround;
 * - `null` — the facet did not fail closed (its `effective` is the plain
 *   three-set intersection; an empty intersection is a normal resolution,
 *   NOT a fail-closed event).
 */
export type CapabilityFailClosedReason = 'seam-not-g2' | null;
/**
 * The resolved effective capability of ONE facet (the core formula's
 * result, with the full provenance of the three operand sets as
 * first-class data).
 */
export interface CapabilityFacetResolution {
    /** The facet this resolution belongs to. */
    readonly facet: CapabilityFacet;
    /** Whether the facet's G2 public seam is exposed (passed G2). */
    readonly seamPassedG2: boolean;
    /** The operand: the capability-existence probe (as injected). */
    readonly available: readonly string[];
    /** The operand: the Team-domain policy resolution (as injected). */
    readonly teamResolved: readonly string[];
    /** The operand: the external hard facts (as injected). */
    readonly externalHard: readonly string[];
    /**
     * The FINAL effective capability: `available ∩ teamResolved ∩
     * externalHard` (canonical `available` order, deduplicated). Empty when
     * the facet failed closed OR the intersection is empty.
     */
    readonly effective: readonly string[];
    /** The fail-closed reason (or `null` when the facet did not fail closed). */
    readonly failClosed: CapabilityFailClosedReason;
}
/**
 * The facet configuration: its G2 public seam + its three source sets
 * (all injectable at slot construction).
 */
export interface CapabilityFacetConfig {
    /** The facet's G2 public seam. */
    readonly seam: CapabilityFacetSeam;
    /** The facet's three explicit source sets. */
    readonly sources: CapabilityFacetSources;
}
/**
 * The complete capability overlay configuration: the four facets, each
 * with its seam + source sets (the full injectable surface of the slot).
 */
export interface CapabilityOverlayConfig {
    /** The four facet configurations (keyed by facet). */
    readonly facets: Record<CapabilityFacet, CapabilityFacetConfig>;
}
/**
 * The resolved capability overlay: one {@link CapabilityFacetResolution}
 * per facet (all four, always).
 */
export type CapabilityOverlayResolution = Record<CapabilityFacet, CapabilityFacetResolution>;
//# sourceMappingURL=types.d.ts.map