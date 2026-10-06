/**
 * Alpha.3 PR3 — the PERMISSION MUTATION kernel: the unified PermissionMutation
 * model, the canonical §6 MutationEnvelope model, the resource-matcher grammar,
 * and the pure planning step that turns (current authority snapshot, one
 * mutation) into (next FULL snapshot | no-change | typed refusal).
 *
 * This module is the PURE HALF of the permission path of the ONE governance
 * mutation authority — `GovernanceMutationService.mutatePermission`
 * (`./service.ts`) runs authenticate → validate → serialize/CAS → commit →
 * provenance around these pure functions. There is NO second mutation
 * authority and NO second durable write path (ADR §1; coordinator D1: the
 * existing class is EXTENDED, never forked).
 *
 * ---------------------------------------------------------------------------
 * D2 — the two envelope concepts, kept ONE per concept (coordinator ruling)
 * ---------------------------------------------------------------------------
 *
 * The pre-existing `MutationEnvelope` in
 * `packages/domain/blueprint/src/types.ts:284-295` (interface at :270; the
 * op-token `allow, deny` sets; its runtime-recognition comment at :37-45) is
 * the OPERATION-TOKEN CAPABILITY concept: a set-intersection over
 * mutation operation tokens (`packages/runtime/admission/envelope.ts:108-111`
 * — teamEnvelope ∩ template entry, further narrowed by the instance
 * autonomy-overlay) feeding the exec-token dual gate. It is NOT the ADR §6
 * per-rule envelope and this PR does not touch it — no rename, no mass
 * migration, no read of it from this module.
 *
 * Alpha.3 gets ONE canonical permission-change envelope model — this module's
 * {@link PermissionMutationEnvelope} — shaped exactly per design §4:
 *
 *     PermissionEnvelopeRule { operationClass, matcher, maximumEffect }
 *
 * ("Avoid operation-specific nested schemas", design §4). There is at most one
 * documented boundary between the two concepts and this implementation needs
 * ZERO of them: the permission plane never consults the token-capability
 * envelope, and the capability plane never consults this envelope. One
 * concept, one source of truth, no transformation.
 *
 * ---------------------------------------------------------------------------
 * The carrier grammar (PR2 left it here explicitly)
 * ---------------------------------------------------------------------------
 *
 * PR1's overlay row carries each rule's resource as an OPAQUE string (storage
 * `schema/permission-overlay.ts` — parseState: "Exact / subtree /
 * exec-fingerprint MATCHING is PR3 (design §4/§5) — the overlay row only
 * carries the string"), and PR2's assembler documented the same: "the overlay
 * rule CARRIER's resource grammar (exact / subtree / exec fingerprint, design
 * §4/§5) is PR3's `GovernanceMutationService`"
 * (`effective-policy/permission-assembler.ts:96-101`). This module owns that
 * grammar:
 *
 *     exact:<canonicalKey>        filesystem class, one canonical identity
 *     subtree:<canonicalRootKey>  filesystem class, a rooted subtree
 *     fingerprint:<canonicalFp>   exec class, ONE canonical operation impact
 *
 * - the prefix is taken at the FIRST colon, so a key that itself contains
 *   colons (or even a leading `exact:`) round-trips losslessly;
 * - canonical identities stay OPAQUE (the A2 contract,
 *   `operation-permission/types.ts` CanonicalResource.key: "never parsed,
 *   never compared for case") — this module only compares and renders them;
 * - EXEC is EXACT-canonical-fingerprint ONLY (design §5: "Filesystem/resource:
 *   exact, subtree. Exec: exact canonical fingerprint only. No: subtree; any"
 *   — and Final Acceptance 7: "Exec permissions remain exact"). A
 *   shell-class operation (`bash` / `pwsh`, the closed shell class of
 *   `operation-permission/types.ts:82-101`) pairs ONLY with `fingerprint`;
 *   a file-class operation (`read`/`read_image`/`write`/`edit`/`lsp`,
 *   `operation-permission/types.ts:56-68`) pairs ONLY with `exact`/`subtree`.
 *   Mispairings are a typed refusal, never a silently inert rule.
 *
 * `any` does not exist in this grammar: neither class gets a wildcard matcher
 * (design §5 forbids it for exec; for the filesystem it would out-author the
 * §6 "limits: 1. resource matcher; 2. maximum effect" ceiling idea, and the
 * A2 static schema keeps its own `any` rules — a DIFFERENT concept on a
 * different plane, untouched here).
 *
 * ---------------------------------------------------------------------------
 * The §6/§7 semantics this kernel computes (design v2 — EFFECTIVE, not verbal)
 * ---------------------------------------------------------------------------
 *
 * - the ladder: `deny < ask < allow` on the expansion axis (ADR §6);
 * - EXPANSION is a property of the EFFECTIVE decision, not of the mutation
 *   verb or of a stored pair: a mutation expands iff, comparing the FULL
 *   latest-vs-planned rule sets through the merged assembler's layer semantics
 *   (overlay > template > blueprint; within one layer the MOST RESTRICTIVE
 *   matching rule answers; no match falls through to the lowest declared
 *   fallback; declared-none fails closed to `deny`) the effect RISES in any
 *   cell of the affected CLOSED REGION PARTITION. So (external P1 batch,
 *   reproduced in `test/a3p3-revoke-reveal-semantics.test.ts`): a `revoke`
 *   that reveals a remaining overlay / template / fallback ALLOW is an
 *   expansion (deny->ask/deny->allow/ask->allow VERBATIM, ladder-strict),
 *   and a NEW exact rule under a covering subtree allow that only
 *   TIGHTENS that resource is NOT an expansion;
 * - TIGHTENING / identity (rank down or equal per cell) needs NO expansion
 *   authority (ADR §6, pinned by test in both directions per coordinator D1);
 * - coverage of a rise: an envelope rule must name an EQUAL operationClass
 *   token (no wildcards), FULLY cover the mutation matcher (width-conservative
 *   — a narrower-than-rises envelope refuses, pinned), and carry
 *   `maximumEffect` at least the RISEN effective effect; ALL-OR-NOTHING over
 *   the batch. Matcher coverage: fingerprint covers only the IDENTICAL
 *   fingerprint (exact only, design §5); exact covers only the identical
 *   exact; a subtree root covers identities the INJECTED containment
 *   predicate places under it (canonical keys are opaque — the same reason
 *   the frozen Alpha.2 matcher refuses `startsWith`,
 *   `operation-permission/permission-resolver.ts:64-70`; WHOLE-MATCHER
 *   containment is the ONLY relation this algebra uses — the A2
 *   `containsOperation` is a point judgement owned by the live resolver and
 *   never appears here). With no predicate injected, subtree questions FAIL
 *   CLOSED ({@link CoverageVerdict.undeterminable});
 * - unknown lower facts NEVER masquerade as `deny`: where a region's
 *   effective verdict depends on lower layers the service was not given
 *   (outside the four snapshot-provable cases of
 *   {@link authorizeLeaderPermissionMutation}, each quantified over every
 *   fallback hypothesis), the mutation refuses
 *   EFFECT_CONTEXT_UNAVAILABLE — an unknown prior is never labeled
 *   expansion OR tightening. `{ layers: [] }` (declared-none, known deny
 *   fallback) is a DISTINCT, decidable case;
 * - Human mutation may exceed the envelope and records Human provenance
 *   (ADR §7) — the actor decides WHETHER the envelope applies, never anything
 *   else: provenance stays audit data (ADR §2; ADR §7 "does NOT create
 *   permanent resolver priority" is structural because generations, not
 *   actors, select the authority — PR2's assembler reads the highest
 *   generation and never interprets `actor`).
 *
 * Pure module: no I/O, no `node:` builtins, no storage import (the PR1
 * vocabulary is type-only, the PR2 discipline), no clock (the service stamps
 * the timestamp through its injected `now`).
 *
 * @module @dsh-agent-team/runtime/governance/permission-mutation
 */
import type { AuthorityEnvelope as AuthorityEnvelopeDocument, AuthorityEnvelopeRule as AuthorityEnvelopeRuleDocument, AuthorityResourceMatcher as AuthorityResourceMatcherDocument, CoverageVerdict as CoverageVerdictDocument, SubtreeContains as SubtreeContainsDocument } from '../../domain/authority-envelope/src/index.js';
import type { PermissionOverlayEffect } from '../permission-governance/types.js';
import type { PermissionOverlayRule, PermissionOverlaySnapshot } from '../permission-governance/types.js';
/** The closed error-code vocabulary of the permission-mutation kernel. */
export declare const PERMISSION_MUTATION_ERROR_CODES: Readonly<{
    /** The mutation input is malformed (identity, kind, rule grammar). */
    readonly MALFORMED_MUTATION: "PERMISSION_MUTATION_MALFORMED";
    /** The envelope document is malformed (shape, class/matcher mispair). */
    readonly MALFORMED_ENVELOPE: "PERMISSION_ENVELOPE_MALFORMED";
    /** The authority kind may not act on the permission lane (member/others). */
    readonly UNAUTHORIZED_ACTOR: "PERMISSION_MUTATION_UNAUTHORIZED_ACTOR";
    /** A Leader expansion no envelope rule covers (ADR §6) — zero write. */
    readonly EXPANSION_OUTSIDE_ENVELOPE: "PERMISSION_ENVELOPE_EXPANSION_DENIED";
    /** The effective before/after of a region depends on lower-layer facts the
     *  service was not given (`staticLayers` not injected) and the outcome is
     *  NOT provably independent of those facts — refuse, never let an unknown
     *  fallback masquerade as `deny` (an unknown prior must never be labeled
     *  expansion OR tightening) — zero write. */
    readonly EFFECT_CONTEXT_UNAVAILABLE: "PERMISSION_EFFECT_CONTEXT_UNAVAILABLE";
    /** The expectedGeneration CAS moved (plan PR3 "CAS conflict") — zero write. */
    readonly GENERATION_CONFLICT: "PERMISSION_OVERLAY_GENERATION_CONFLICT";
    /** The lane dependencies were not injected — the capability stays dormant. */
    readonly NOT_CONFIGURED: "PERMISSION_MUTATION_NOT_CONFIGURED";
}>;
/** One kernel error code. */
export type PermissionMutationErrorCode = (typeof PERMISSION_MUTATION_ERROR_CODES)[keyof typeof PERMISSION_MUTATION_ERROR_CODES];
/** Every kernel error code value, for membership checks. */
export declare const PERMISSION_MUTATION_ERROR_CODE_VALUES: readonly string[];
/** A typed permission-mutation refusal. Branch on `code` + `details.problem`,
 *  never on the message text. A refusal performs NO write. */
export declare class PermissionMutationError extends Error {
    /** The closed error code. */
    readonly code: PermissionMutationErrorCode;
    /** Lossless context (never a live caller object). */
    readonly details: Readonly<Record<string, unknown>>;
    constructor(code: PermissionMutationErrorCode, message: string, details?: Record<string, unknown>);
}
/** Is `error` a {@link PermissionMutationError}? */
export declare function isPermissionMutationError(error: unknown): error is PermissionMutationError;
/**
 * The expansion ladder (ADR §6): on the expansion axis `deny < ask < allow`.
 * An effect change is an EXPANSION iff the rank goes UP, a TIGHTENING iff it
 * goes DOWN, IDENTITY otherwise.
 */
export declare const PERMISSION_EFFECT_PRECEDENCE: Readonly<{
    readonly deny: 0;
    readonly ask: 1;
    readonly allow: 2;
}>;
/** One §6 direction. */
export type PermissionEffectDirection = 'expansion' | 'tightening' | 'identity';
/** Classify one effect change on the §6 ladder. */
export declare function permissionEffectDirection(from: PermissionOverlayEffect, to: PermissionOverlayEffect): PermissionEffectDirection;
/** The closed operation classes of this grammar (design §4 `operationClass`). */
export type PermissionOperationClass = 'fs' | 'exec';
/**
 * Classify one operation-class token against the closed A2 vocabulary
 * (`operation-permission/types.ts`: the five file tools + the shell class).
 * `unknown` tokens are REJECTED by the validators — a rule naming a tool the
 * permission plane does not know is malformed here (fail-closed), not a
 * silently inert row (contrast: the frozen A2 matcher is total over ANY
 * rule text it is handed; this grammar is the AUTHORITY's write-time gate,
 * where a typo'd operation class must be refused, not stored).
 */
export declare function classifyPermissionOperationClass(token: string): PermissionOperationClass | 'unknown';
/** The closed matcher kinds (design §5; `any` deliberately absent). */
export declare const PERMISSION_RESOURCE_MATCHER_KINDS: readonly ["exact", "subtree", "fingerprint"];
/**
 * One canonical resource matcher over OPAQUE canonical identities — the
 * RUNTIME shape, and now an ALIAS of the domain's `AuthorityResourceMatcher`
 * rather than a second declaration of it (ADR A3-9; the alias survives until
 * PR7 deletes it, A1-18, so no caller in PR2-PR6 has to be renamed).
 *
 * It is NOT the document shape. `{ kind, path }` / `{ kind, fingerprint }` is
 * the DECLARED AST (`AuthorityEnvelopeAstMatcher`), and the collapse into
 * `resource` happens exactly once, in `src/plugin/permission-plane.ts`
 * (`buildAuthorityEnvelope`) — never here, never in `domain` (ADR A2-3).
 */
export type PermissionResourceMatcher = AuthorityResourceMatcherDocument;
/** Render one matcher into the deterministic carrier text of the overlay row
 *  (prefix at the FIRST colon; round-trips through
 *  {@link parsePermissionResourceText}). */
export declare function renderPermissionResourceText(matcher: PermissionResourceMatcher): string;
/** Parse carrier text back into a matcher (structure only — the class pairing
 *  is checked where the operationClass is known). `undefined` when the text
 *  carries no valid prefix (a foreign grammar string). */
export declare function parsePermissionResourceText(text: string): PermissionResourceMatcher | undefined;
/**
 * The unified mutation kinds (design §3.4: "Do not create separate systems:
 * grant_instance / update_permission / revoke_permission — they should ALL
 * become PermissionMutation → new PermissionOverlaySnapshot"). ONE shape
 * ({@link PermissionMutationRule} for every kind); the kind is the only
 * difference, and what the kind means is fixed:
 *
 * - `grant_instance` / `update_permission` UPSERT the addressed pairs to the
 *   carried effect (a pair that does not exist yet is created — the unified
 *   pair-set semantics; PR4 layers lifecycle semantics such as no-inheritance
 *   on top of this plumbing, it does not fork it);
 * - `revoke_permission` REMOVES the addressed pairs (the carried effect is
 *   the effect being taken back; removal of a standing rule can only reduce
 *   permissiveness, so it never needs expansion authority).
 */
export declare const PERMISSION_MUTATION_KINDS: readonly ["grant_instance", "update_permission", "revoke_permission"];
/** One unified mutation kind. */
export type PermissionMutationKind = (typeof PERMISSION_MUTATION_KINDS)[number];
/** One addressed rule of a mutation (ONE shape for all three kinds). */
export interface PermissionMutationRule {
    /** The closed operation-class token (design §4 operationClass). */
    readonly operationClass: string;
    /** The canonical resource matcher (design §4 matcher, design §5 class split). */
    readonly matcher: PermissionResourceMatcher;
    /** The effect this mutation carries for the pair (grant/update: the new
     *  effect; revoke: the effect standing at the pair being taken back — a
     *  revoke whose carried effect does not match the durable one is a stale
     *  view and refuses, exactly like the CAS). */
    readonly effect: PermissionOverlayEffect;
}
/** The caller-supplied (structural, unvalidated) mutation input. */
export interface PermissionMutationInput {
    readonly kind: PermissionMutationKind;
    readonly mutationId: string;
    readonly teamSessionId: string;
    readonly memberInstanceId: string;
    readonly reason: string;
    readonly rules: readonly PermissionMutationRule[];
    readonly expectedGeneration?: number;
}
/** The validated, frozen mutation. */
export type PermissionMutation = Readonly<PermissionMutationInput>;
/** Validate + freeze one mutation input (the structural half of the write
 *  gate; authority and envelope are decided by the service around it). */
export declare function parsePermissionMutation(raw: PermissionMutationInput): PermissionMutation;
/**
 * One envelope rule (design §4 recommended conceptual form, verbatim shape) —
 * an ALIAS of the domain rule since A4-PR1 (ADR A3-9/A1-18). The shape is
 * unchanged to the last field; only the declaration moved, so the PR0 callers
 * keep compiling and PR7 deletes the alias instead of migrating them.
 */
export type PermissionEnvelopeRule = AuthorityEnvelopeRuleDocument;
/**
 * The envelope document: the Leader's expansion authority for one team. An
 * ALIAS of the domain document since A4-PR1 (ADR A3-9/A1-18) — the SAME
 * structure the v3 `teamHardEnvelope` carries, because A3-9 made it one
 * grammar: two documents, two roles, one shape.
 */
export type PermissionMutationEnvelope = AuthorityEnvelopeDocument;
/** Validate + freeze one envelope document. An empty `rules` list is VALID
 *  and means exactly one thing: NO expansion authority (every Leader
 *  expansion refuses; tightenings are unaffected) — fail-closed default. */
export declare function parsePermissionMutationEnvelope(raw: unknown): PermissionMutationEnvelope;
/** The containment predicate over two canonical identities of the SAME
 *  backend namespace. Production injects the pinned public containment seam
 *  (the A2C-7 precedent: the frozen matcher itself never `startsWith` —
 *  `operation-permission/permission-resolver.ts` A2C-7 paragraph); tests
 *  inject a deterministic algebra. Absent → subtree coverage fails closed.
 *  ALIAS of the domain declaration (A3-9) — one concept, one name per plane. */
export type SubtreeContains = SubtreeContainsDocument;
/** The outcome of one coverage question (the refusal detail stays explainable).
 *  ALIAS of the domain declaration (A3-9). */
export type CoverageVerdict = CoverageVerdictDocument;
/**
 * Does an envelope matcher cover a mutation matcher?
 *
 * - `fingerprint` covers ONLY the identical fingerprint — exec is exact-only
 *   in BOTH documents (design §5), so a fingerprint envelope rule can never
 *   widen (no subtree, no `any`, no prefix reading of an opaque `sha256:`);
 * - `exact` covers ONLY the identical exact (one canonical identity, one
 *   authority identity — the A2C-1 lesson: a bash authority never gates a
 *   pwsh operation; here: file A never stands in for file B);
 * - `subtree` covers exact/subtree identities the injected containment
 *   predicate places under its root (identity counts as contained: a root
 *   covers itself); cross-class coverage never holds.
 */
/**
 * Does an envelope matcher cover a mutation matcher? ONE implementation for
 * both algebras: this is the domain function itself, re-exported under the name
 * Alpha.3 froze (`a4p1-authority-envelope.test.ts` pins them by `toBe`). A
 * delegated copy would be a second algebra that could drift, and the fail-closed
 * ORDER below is precisely the part that must not: identity is answered BEFORE
 * the containment seam is consulted, so a missing predicate can never turn a
 * provable identity into a non-match (the external round-2 correction that the
 * consumption sites still depend on — `EXPANSION_OUTSIDE_ENVELOPE` and
 * `EFFECT_CONTEXT_UNAVAILABLE` are different answers and the fold that
 * separates them reads this verdict).
 *
 * The doc-comment that used to live on this declaration travels with the
 * implementation to `authority-envelope.ts:matcherCovers`, where the rules are
 * now stated once for both planes.
 */
export declare const matcherCovers: (envelope: PermissionResourceMatcher, target: PermissionResourceMatcher, subtreeContains?: SubtreeContains) => CoverageVerdict;
/**
 * One rule of a declared static permission layer (the Template policy or the
 * Blueprint baseline), already canonicalized to THIS module's matcher grammar.
 * `any` exists here because the A2 static lanes carry whole-tool rules; the
 * OVERLAY grammar deliberately has no `any` (there is no unbounded overlay
 * matcher to remove or shadow).
 */
export interface PermissionStaticLayerRule {
    readonly operationClass: string;
    readonly matcher: {
        readonly kind: 'exact' | 'subtree' | 'fingerprint' | 'any';
        readonly resource?: string;
    };
    readonly effect: PermissionOverlayEffect;
}
/** One declared static layer: its fallback for an unmatched operation (the A1
 *  `TemplatePermissionPolicy.default` vocabulary) and its canonical rules. */
export interface PermissionStaticLayer {
    readonly label?: string;
    readonly default: 'ask' | 'deny';
    readonly rules: readonly PermissionStaticLayerRule[];
}
/**
 * The LOWER-LAYER FACTS the Leader authorization compares against, ASCENDING
 * by precedence (`[blueprint?, template?]` — the last entry wins).
 *
 * The three states are DISTINCT and stay distinct (parent ruling, req 3):
 * - `undefined` (no `staticLayers` reader, or a reader that returns
 *   `undefined`) — the lower answer is UNKNOWN: regions whose effective
 *   verdict depends on it refuse with EFFECT_CONTEXT_UNAVAILABLE;
 * - `{ layers: [] }` — DECLARED-NONE: there is provably no lower layer, the
 *   answer is the assembler's fail-closed `deny` fallback, and evaluation is
 *   DECIDABLE;
 * - `{ layers: [...] }` — the declared rules/fallbacks, decidable.
 * An unknown prior must never masquerade as `deny` (either direction).
 */
export interface PermissionStaticLayerFacts {
    readonly layers: readonly PermissionStaticLayer[];
}
/** Validate + freeze injected static-layer facts (the lane-boundary shape is
 *  untrusted input). Malformed facts are an authority-CONFIG defect and
 *  refuse with the envelope-malformed family (both are authority-side
 *  documents; the mutation itself may be perfectly shaped). */
export declare function parsePermissionStaticLayerFacts(raw: unknown): PermissionStaticLayerFacts;
/** The three states of one region's effective answer. */
export type PermissionEffectiveAnswer = {
    readonly status: 'decided';
    readonly effect: PermissionOverlayEffect;
    readonly source: 'overlay' | 'layer' | 'fallback';
} | {
    readonly status: 'context-unavailable';
};
export interface PermissionEffectiveAnswerQuery {
    readonly overlayRules: readonly PermissionOverlayRule[];
    readonly staticFacts: PermissionStaticLayerFacts | undefined;
    readonly operationClass: string;
    /** The closed region being answered (a point probe is an `exact` matcher). */
    readonly region: PermissionResourceMatcher;
    readonly subtreeContains?: SubtreeContains;
}
/**
 * The effective answer of ONE closed region (pure; exported for the
 * assembler-parity spec — production classification runs it INSIDE
 * {@link authorizeLeaderPermissionMutation}, never re-reads context).
 * `context-unavailable` covers BOTH unknown lower facts AND any coverage
 * relation the injected predicates cannot decide — unknown never answers.
 */
export declare function permissionEffectiveAnswer(query: PermissionEffectiveAnswerQuery): PermissionEffectiveAnswer;
export interface LeaderMutationAuthorizationInput {
    /** The durable rule set BEFORE (latest snapshot, `[]` when none). */
    readonly latestRules: readonly PermissionOverlayRule[];
    /** The FULL final-batch rule set AFTER (the planned snapshot). The
     *  comparison is COMPLETE-STATE vs COMPLETE-STATE — never a per-verb
     *  sequential classification (parent req 4). */
    readonly plannedRules: readonly PermissionOverlayRule[];
    /** The mutation's parsed rules — their matchers are the affected closed
     *  regions (the mutation's claimed scope doubles as the coverage width). */
    readonly mutationRules: readonly PermissionMutationRule[];
    readonly envelope: PermissionMutationEnvelope;
    /** `undefined` = UNKNOWN lower facts (typed refusal wherever observable);
     *  `{ layers: [] }` = declared-none (decidable deny fallback). Never
     *  conflated. */
    readonly staticFacts: PermissionStaticLayerFacts | undefined;
    readonly subtreeContains?: SubtreeContains;
}
/**
 * Authorize (or refuse, typed, zero write) one LEADER mutation by comparing
 * the FULL effective before/after over every affected closed region
 * (ADR §6 ladder-strict: deny->ask is expansion VERBATIM, so it needs
 * ceiling-ask coverage; reveal of an equal-or-stricter answer is no rise).
 *
 * A rise in ANY cell demands that the envelope cover the WHOLE mutation
 * matcher (width-conservative: a narrower-than-rises envelope refuses — the
 * conservative edge is pinned) with `maximumEffect` at least the risen
 * effect, for EVERY rising cell of the batch (all-or-nothing).
 *
 * Context-free provable cases (each holds for ALL fallback hypotheses —
 * declared `ask`, declared `deny`, and declared-none `deny`):
 *   (i)   a cell where the OVERLAY answers BOTH sides — the lower layer can
 *         never win, so the comparison is snapshot-only (B1 class);
 *   (ii)  the AFTER overlay answer of a cell is `deny` — nothing ranks below
 *         deny to rise FROM, whatever the unknown prior is;
 *   (iii) the BEFORE overlay answer of a cell is `allow` — nothing ranks
 *         above allow to reveal, whatever the unknown fallback reveals;
 *   (iv)  a cell the overlay answers on NEITHER side — the lower answer is
 *         the same function of the same unchanged facts both sides: equal.
 * Anything else with `staticFacts === undefined` refuses
 * EFFECT_CONTEXT_UNAVAILABLE — an unknown prior is never labeled expansion
 * OR tightening.
 *
 * ROUND 5 (parent final review): the round-4 `authorityCeiling` parameter is
 * REMOVED — comparing risen cells against the grantor's own effective answer
 * was a SECOND policy condition ADR §6 does not carry. The envelope-only
 * algebra below is the UNCONDITIONAL whole decision (coverage + target
 * effective before/after), byte-equal to the pre-round-4 envelope judgement.
 */
export declare function authorizeLeaderPermissionMutation(input: LeaderMutationAuthorizationInput): void;
/** The plan of one mutation against the current authority snapshot.
 *  DIRECTION IS NOT PLANNED HERE (design v2): an exact-key pair diff cannot
 *  see same-layer specificity (a new exact rule over a covering subtree rule)
 *  or reveal (a removal letting a remaining overlay/static rule ANSWER) —
 *  expansion/tightening is decided SEMANTICALLY over the closed region
 *  partition by {@link authorizeLeaderPermissionMutation}, comparing the
 *  complete latest-vs-planned rule sets. */
export type PermissionMutationPlan = {
    readonly changed: true;
    /** The FULL next rule set (a snapshot, never a delta — ADR §2). */
    readonly rules: readonly PermissionOverlayRule[];
} | {
    readonly changed: false;
    readonly reason: 'no-change';
};
/**
 * Plan one mutation against the current authority snapshot (pure): produce
 * the FULL next rule set or the typed no-change. The rule-set mechanics are
 * pair upserts/removals (the durable record shape); ALL semantic direction
 * classification lives in {@link authorizeLeaderPermissionMutation}.
 *
 * A revoke carrying an effect that does NOT match the durable effect at the
 * addressed pair is a STALE VIEW and refuses as MALFORMED_MUTATION/problem
 * `revoke-effect-mismatch`, still ZERO write (the expectedGeneration CAS
 * remains the honest staleness signal for everything else).
 */
export declare function planPermissionMutation(latest: PermissionOverlaySnapshot | undefined, mutation: PermissionMutation): PermissionMutationPlan;
//# sourceMappingURL=permission-mutation.d.ts.map