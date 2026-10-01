/**
 * EffectivePermissionAssembler — Alpha.3 PR2 (implementation plan
 * `PR2: Effective Permission Assembly`; ADR §3 Stage 1, design §2).
 *
 * What it does (design §2, literally): "combine static and dynamic
 * permission; produce effective policy; preserve source provenance."
 *
 * ```text
 *   Blueprint baseline ┐
 *   Template static    ├─► assembleEffectivePermissionPolicy ─► EffectivePermissionPolicy
 *   Overlay snapshot   ┘                                                │
 *                                                                       ▼
 *                                       resolveEffectiveOperationPermission(policy, operation)
 *                                            │  (one FROZEN Alpha.2 resolver call per layer)
 *                                            ▼
 *                                            decision + provenance
 * ```
 *
 * # The precedence rule (ADR §4 / design §3.1 — FROZEN)
 *
 * ```text
 *   MemberInstance overlay  >  Template static permission  >  Blueprint baseline
 *   within one layer:  deny > ask > allow
 *   "Do not implement global deny precedence."
 * ```
 *
 * Implemented as: **a layer whose rules MATCH the operation wins over every
 * lower layer; only within one layer does `deny > ask > allow` apply; the
 * ABSENCE of a match falls through.** That is why this module never flattens
 * the layers into one rule set: a merged flat set plus the Alpha.2 priority
 * produces exactly the two readings design §3.1 names as incorrect —
 *
 * - field-level overwrite (last writer wins per (tool, resource) pair), which
 *   loses the fact that a higher-layer rule NOT addressing this operation must
 *   not shadow a lower-layer rule that does;
 * - "all denies globally override all allows", which answers `deny` where the
 *   frozen rule answers the higher layer's `allow`.
 *
 * # The resolver is reused, never wrapped silently (ADR §3 Stage 2)
 *
 * {@link resolveOperationPermission} stays the pure Alpha.2 kernel: it is
 * called once per assembled layer with that layer's canonical lanes, exactly
 * as the A5 adapter calls it today. Nothing here mutates it, re-implements its
 * matcher, or changes its semantics:
 *
 * - matched-vs-unmatched is read off the resolver's OWN answer
 *   (`provenance.source === 'rule'`), never by comparing a decision to a
 *   default; a layer with no match contributes nothing and the walk continues;
 * - same-layer `deny > ask > allow > default` is the resolver's frozen
 *   priority, applied inside each layer (including the overlay layer, whose
 *   rules are grouped into the three lanes by the effect they carry);
 * - the per-layer lane audit is the same resolver called over a single
 *   populated lane, so even the "which lanes matched" answer reuses the matcher
 *   instead of duplicating it.
 *
 * The resolver's `policy.default` answers "no rule of THIS layer matched" and
 * is discarded in that case — it is not the effective fallback. The effective
 * fallback of the whole assembly is the fallback declared by the LOWEST layer
 * that declares one (blueprint, else template); with no static layer at all the
 * assembly fails closed to `deny`. An overlay snapshot carries no default (ADR
 * §2 has no such field), so a dynamic mutation can never move the fallback —
 * only a rule that matches can change the answer.
 *
 * # Provenance (design §2, ADR §2/§7)
 *
 * Every answer names the layer that decided, and for the overlay layer the
 * snapshot it came from — `snapshotId`, `generation`, `previousSnapshotId`,
 * `actor`, `mutationId`, `timestamp`, `reason` — copied VERBATIM out of the
 * PR1 record's own sections, plus which of its rules decided (the snapshot rule
 * index, the lane, and the index inside the lane). Lower layers that matched
 * and lost are reported in `overriddenLower`, and every layer's own answer is in
 * `layers`, so the decision is explainable without re-running anything.
 * Provenance is audit data: ADR §7 (no actor-based precedence) is structural
 * here — `actor` is never read by the decision path, only carried.
 *
 * # Authority selection, and what this module refuses
 *
 * The current authority is the HIGHEST-generation snapshot, read directly (ADR
 * §2): the overlay layer is built from that one snapshot only. Lower
 * generations are never folded, replayed or merged (design §3.3), so a FULL
 * snapshot at generation N replaces generation N-1 completely — a rule that
 * exists only in an older snapshot simply does not apply. Ambiguity is a typed
 * refusal, never a guess:
 *
 * - a snapshot whose identity differs from the assembly identity is REFUSED
 *   (MemberInstance isolation: two overlays must never cross, and silently
 *   filtering a foreign snapshot would answer a question about instance A with
 *   instance B's authority);
 * - two different snapshots claiming one generation are an ambiguous authority;
 *   the identical snapshot supplied twice is idempotent, but a second copy
 *   carrying a different canonical view is a conflict;
 * - a rule view that misstates the effect its snapshot rule carries, or that
 *   does not address exactly one snapshot rule, is refused;
 * - a rule view that leaves a snapshot rule uninterpreted is refused: the
 *   overlay layer is a FULL reading of the authority snapshot, so an omitted
 *   view would silently retire a durable rule (and silently retire a `deny`
 *   while still reporting that the overlay layer decided);
 * - a malformed canonical rule, static lane or snapshot section is refused.
 *
 * # Boundaries (PR2 scope — nothing more)
 *
 * Pure in-memory: zero I/O, zero `node:` builtins, zero upstream imports, no
 * StorageDomain binding, no mutation, no durable write, no notification, no UI,
 * no tool/pre-execute wiring. It CONSUMES the PR1 vocabulary (a type-only
 * import of `PermissionOverlaySnapshot`: no runtime edge to the storage
 * package) and the Alpha.2 canonical vocabulary; it owns neither.
 * Canonicalization stays the A5 adapter's (the A3 input contract, H4: fresh per
 * decision), and the overlay rule CARRIER's resource grammar (exact / subtree /
 * exec fingerprint, design §4/§5) is PR3's `GovernanceMutationService` — which
 * is why the overlay layer is supplied as a caller-owned canonical VIEW of the
 * snapshot rules and this module never interprets the carrier text. A future
 * consumer builds that view exactly the way it builds `CanonicalRules` for A3
 * today.
 *
 * @module @dsh-agent-team/runtime/effective-policy/permission-assembler
 */
import type { CanonicalRule, CanonicalRules, PermissionLane } from '../operation-permission/permission-resolver.js';
import type { CanonicalOperation } from '../operation-permission/types.js';
import type { PermissionOverlaySnapshot } from '../permission-governance/types.js';
/** The permission layers, ASCENDING precedence (the ADR §4 order). */
/**
 * Frozen: `as const` is a type-level promise only, and this array IS the ADR §4
 * layer order — an in-place `.sort()` in any consumer would silently invert the
 * precedence for every other caller in the process.
 */
export declare const EFFECTIVE_PERMISSION_LAYERS: readonly ["blueprint", "template", "overlay"];
/** One permission layer. */
export type EffectivePermissionLayerKind = (typeof EFFECTIVE_PERMISSION_LAYERS)[number];
/** The order the layers are consulted in: HIGHEST precedence first. */
export declare const EFFECTIVE_PERMISSION_LOOKUP_ORDER: readonly EffectivePermissionLayerKind[];
/** The numeric precedence of one layer (0 = lowest). */
export declare function effectivePermissionLayerPrecedence(layer: EffectivePermissionLayerKind): number;
/** One snapshot rule's carrier pair, echoed into the provenance. */
export interface EffectivePermissionOverlayRuleCarrier {
    readonly operation: string;
    readonly resource: string;
}
/** The closed assembly error codes. */
export declare const EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES: Readonly<{
    /** The assembly input itself is malformed (identity, layer shape). */
    readonly ASSEMBLY_INPUT_MALFORMED: "EFFECTIVE_PERMISSION_ASSEMBLY_INPUT_MALFORMED";
    /** An overlay snapshot belongs to another TeamSession / MemberInstance. */
    readonly IDENTITY_MISMATCH: "EFFECTIVE_PERMISSION_IDENTITY_MISMATCH";
    /** The current overlay authority is ambiguous (two claims on one generation). */
    readonly AUTHORITY_CONFLICT: "EFFECTIVE_PERMISSION_AUTHORITY_CONFLICT";
    /** A rule view claims an effect its snapshot rule does not carry. */
    readonly OVERLAY_EFFECT_MISMATCH: "EFFECTIVE_PERMISSION_OVERLAY_EFFECT_MISMATCH";
    /** A rule view does not address exactly one snapshot rule. */
    readonly OVERLAY_RULE_REFERENCE_INVALID: "EFFECTIVE_PERMISSION_OVERLAY_RULE_REFERENCE_INVALID";
    /** A canonical rule is structurally malformed. */
    readonly RULE_MALFORMED: "EFFECTIVE_PERMISSION_RULE_MALFORMED";
    /** A static layer or an overlay snapshot is structurally malformed. */
    readonly LAYER_MALFORMED: "EFFECTIVE_PERMISSION_LAYER_MALFORMED";
}>;
/** One of the closed assembly error codes. */
export type EffectivePermissionAssemblyErrorCode = (typeof EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES)[keyof typeof EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES];
/** Every assembly error code value, for membership checks. */
export declare const EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODE_VALUES: readonly string[];
/**
 * A typed assembly refusal. Branch on `code` + `details.problem`, never on the
 * message text. A refusal produces NO decision: the assembler never answers a
 * question it cannot attribute.
 */
export declare class EffectivePermissionAssemblyError extends Error {
    /** The closed error code. */
    readonly code: EffectivePermissionAssemblyErrorCode;
    /** Lossless context (never a live object reference the caller can mutate). */
    readonly details: Readonly<Record<string, unknown>>;
    constructor(code: EffectivePermissionAssemblyErrorCode, message: string, details?: Record<string, unknown>);
}
/** One static permission layer: a Blueprint baseline or a Template policy. */
export interface EffectivePermissionStaticLayer {
    /**
     * A human-readable identity for the layer (template id, blueprint version) —
     * carried verbatim into the provenance and never interpreted.
     */
    readonly label?: string;
    /**
     * This layer's fallback for an operation NO rule of this layer matches (the
     * A1 `TemplatePermissionPolicy.default` vocabulary: `ask` | `deny`).
     */
    readonly default: 'ask' | 'deny';
    /**
     * The three lanes, ALREADY canonicalized: this is the A3 input contract (A5
     * replaces every `exact.path` / `subtree.path` with its canonical key and
     * computes the subtree containment verdict FRESH per decision — H4). The
     * assembler never resolves a path and never re-normalizes; lane order is
     * declaration order and is preserved.
     */
    readonly rules: CanonicalRules;
}
/**
 * The caller's canonical view of ONE overlay rule of the authority snapshot:
 * the carrier `{ operation, resource, effect }` (PR1) projected onto the
 * Alpha.2 matcher vocabulary for the decision being made.
 *
 * `ruleIndex` addresses `snapshot.state.rules[ruleIndex]`, and `lane` MUST be
 * the effect that snapshot rule carries — the assembler refuses a view that
 * misstates it, so the dynamic layer's lane membership comes from the durable
 * snapshot, never from the caller.
 */
export interface EffectivePermissionOverlayRuleView {
    /** The snapshot rule this view interprets (0-based, unique per layer). */
    readonly ruleIndex: number;
    /** The effect the snapshot rule carries (grouped into the resolver lanes). */
    readonly lane: PermissionLane;
    /** The canonical matcher for THIS decision (the A3 input contract). */
    readonly rule: CanonicalRule;
}
/** The dynamic layer: one MemberInstance's authority snapshot + its views. */
export interface EffectivePermissionOverlayLayer {
    /** The PR1 PermissionOverlaySnapshot (the ADR §2 record). */
    readonly snapshot: PermissionOverlaySnapshot;
    /**
     * The canonical view of the snapshot rules to feed the matcher: EXACTLY one
     * view per snapshot rule, in any order. A short list is a truncated reading of
     * a FULL snapshot and is refused (`overlay-rule-view-incomplete`); an empty
     * list is legal only for a snapshot that carries no rules at all.
     */
    readonly rules: readonly EffectivePermissionOverlayRuleView[];
}
/** The assembler input (ADR §3 Stage 1: load, load, merge, preserve). */
export interface EffectivePermissionAssemblyInput {
    /** The TeamSession the effective policy is assembled for. */
    readonly teamSessionId: string;
    /** The MemberInstance the effective policy is assembled for. */
    readonly memberInstanceId: string;
    /** The Blueprint baseline layer (lowest precedence). */
    readonly blueprint?: EffectivePermissionStaticLayer;
    /** The Template static permission layer. */
    readonly template?: EffectivePermissionStaticLayer;
    /**
     * The MemberInstance's overlay snapshot(s): the port's `latest` output (one
     * snapshot) or its full `history` (audit rows included — only the
     * HIGHEST-generation one becomes the authority, ADR §2). Every snapshot must
     * carry this exact identity.
     */
    readonly overlays?: readonly EffectivePermissionOverlayLayer[];
}
/** The overlay authority fields the provenance carries verbatim (ADR §2). */
export interface EffectivePermissionOverlayAuthority {
    /** The derived snapshot id (`<teamSessionId>#<memberInstanceId>#<generation>`). */
    readonly snapshotId: string;
    /** The snapshot generation (current authority = highest). */
    readonly generation: number;
    /** The snapshot this one replaces (`null` at generation 1). */
    readonly previousSnapshotId: string | null;
    /** Who the mutation is attributed to (audit only, ADR §7). */
    readonly actor: string;
    /** The mutation that produced the snapshot (audit only). */
    readonly mutationId: string;
    /** When the mutation committed, ISO-8601 (audit only). */
    readonly timestamp: string;
    /** The audit reason (may be the empty string; never replaced). */
    readonly reason: string;
}
/** One rule of an assembled layer, with its address in its source layer. */
export interface EffectivePermissionRule {
    /** The lane the rule sits in (= the effect it carries). */
    readonly lane: PermissionLane;
    /** Static: the index inside the lane. Overlay: the snapshot rule index. */
    readonly sourceIndex: number;
    /** The canonical matcher (a fresh copy — the output never aliases input). */
    readonly rule: CanonicalRule;
    /** Overlay rules only: the carrier pair this view interpreted. */
    readonly overlayRule?: EffectivePermissionOverlayRuleCarrier;
}
/** The three lanes of one assembled layer. */
export interface EffectivePermissionLayerRules {
    readonly allow: readonly EffectivePermissionRule[];
    readonly ask: readonly EffectivePermissionRule[];
    readonly deny: readonly EffectivePermissionRule[];
}
/** One assembled layer, in precedence order. */
export interface EffectivePermissionPolicyLayer {
    readonly layer: EffectivePermissionLayerKind;
    /** 0 = lowest precedence (blueprint); ascending. */
    readonly precedence: number;
    /** `'static'` = a declared policy layer, `'overlay'` = the dynamic layer. */
    readonly origin: 'static' | 'overlay';
    /** The static layer's caller label, when given (never interpreted). */
    readonly label?: string;
    /** This layer's fallback; `null` for the overlay (it carries none). */
    readonly fallback: 'ask' | 'deny' | null;
    /** The layer's lanes, in declaration order (never reordered). */
    readonly rules: EffectivePermissionLayerRules;
    /** Total rule count of the layer (audit convenience). */
    readonly ruleCount: number;
    /** Overlay layers only: the authority the rules came from. */
    readonly authority?: EffectivePermissionOverlayAuthority;
}
/** The Stage-1 output: the layered effective policy (ADR §3). */
export interface EffectivePermissionPolicy {
    readonly teamSessionId: string;
    readonly memberInstanceId: string;
    /** The layers present, ASCENDING by precedence (absent layers omitted). */
    readonly layers: readonly EffectivePermissionPolicyLayer[];
    /** Whose fallback answers when no layer matches (lowest declaration wins). */
    readonly fallback: {
        readonly layer: EffectivePermissionLayerKind | null;
        readonly effect: PermissionLane;
    };
}
/** The provenance of one deciding rule (plan §PR2 "provenance"). */
export interface EffectivePermissionRuleProvenance {
    /** Which layer decided. */
    readonly layer: EffectivePermissionLayerKind;
    /** The layer's precedence index (2 = the overlay). */
    readonly precedence: number;
    /** The static layer's label, when given. */
    readonly layerLabel?: string;
    /** The lane of the deciding rule (= the effect it carries). */
    readonly lane: PermissionLane;
    /** Index of the deciding rule inside its lane (the resolver's own index). */
    readonly ruleIndexInLane: number;
    /** Its address in the source layer (snapshot rule index / lane index). */
    readonly sourceIndex: number;
    /** The deciding rule itself (a copy). */
    readonly rule: CanonicalRule;
    /** Overlay wins only: the snapshot the rule came from. */
    readonly overlayAuthority?: EffectivePermissionOverlayAuthority;
    /** Overlay wins only: the carrier pair the winning view interpreted. */
    readonly overlayRule?: EffectivePermissionOverlayRuleCarrier;
}
/** What the frozen resolver answered for ONE layer (the audit trail). */
export interface EffectivePermissionLayerOutcome {
    readonly layer: EffectivePermissionLayerKind;
    readonly precedence: number;
    /** Whether this layer had a MATCHING rule (the resolver's own answer). */
    readonly matched: boolean;
    /** The lanes of this layer that matched, in `deny > ask > allow` order. */
    readonly matchedLanes: readonly PermissionLane[];
    /** This layer's own deciding rule, when it matched. */
    readonly winningProvenance: EffectivePermissionRuleProvenance | null;
}
/** The Stage-2 output: the decision + its full provenance. */
export interface EffectivePermissionDecision {
    readonly teamSessionId: string;
    readonly memberInstanceId: string;
    /** The tool the operation addressed (echoed for the explanation). */
    readonly tool: string;
    /** The operation fingerprint (echoed for the explanation; never authority). */
    readonly fingerprint: string;
    /** The effective effect. */
    readonly decision: PermissionLane;
    /** `'rule'` = a layer's rule decided; `'default'` = nothing matched. */
    readonly source: 'rule' | 'default';
    /** The layer that decided; `null` when the fallback decided. */
    readonly winningLayer: EffectivePermissionLayerKind | null;
    /** The deciding rule's provenance; `null` for a fallback decision. */
    readonly provenance: EffectivePermissionRuleProvenance | null;
    /** Whose fallback answered (authoritative only when `source === 'default'`). */
    readonly fallbackSource: {
        readonly layer: EffectivePermissionLayerKind | null;
        readonly effect: PermissionLane;
    };
    /** Every present layer, HIGHEST precedence first, with its own answer. */
    readonly layers: readonly EffectivePermissionLayerOutcome[];
    /** The lower layers that matched and lost (their deciding rule each). */
    readonly overriddenLower: readonly EffectivePermissionRuleProvenance[];
    /** A deterministic one-line explanation (mirrors the Alpha.2 resolver). */
    readonly explanation: string;
}
/**
 * Assemble the effective permission policy of one MemberInstance (ADR §3
 * Stage 1). Pure and synchronous: the input is never mutated and the output
 * never aliases it.
 *
 * @param input - the baseline + static + overlay inputs for ONE identity.
 * @returns the layered effective policy (deeply frozen).
 * @throws {@link EffectivePermissionAssemblyError} for a malformed input, a
 *   cross-instance snapshot, or an ambiguous overlay authority.
 */
export declare function assembleEffectivePermissionPolicy(input: EffectivePermissionAssemblyInput): EffectivePermissionPolicy;
/**
 * Resolve one canonical operation against an assembled policy (ADR §3 Stage 2
 * composition). The Alpha.2 resolver answers for every layer; the layer
 * precedence then picks the winner.
 *
 * @param policy - {@link assembleEffectivePermissionPolicy}'s output.
 * @param operation - the A2 canonical operation of this decision.
 * @returns the decision + provenance (deeply frozen).
 */
export declare function resolveEffectiveOperationPermission(policy: EffectivePermissionPolicy, operation: CanonicalOperation): EffectivePermissionDecision;
/**
 * Assemble and resolve in one call — the shape a per-decision consumer wants
 * (the policy stays a first-class value, so it can be inspected on its own).
 */
export declare function assembleEffectivePermission(input: EffectivePermissionAssemblyInput, operation: CanonicalOperation): {
    readonly policy: EffectivePermissionPolicy;
    readonly decision: EffectivePermissionDecision;
};
//# sourceMappingURL=permission-assembler.d.ts.map