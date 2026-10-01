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
 * `packages/domain/blueprint/src/types.ts:270` (`{ allow, deny }` op-token
 * sets) is the OPERATION-TOKEN CAPABILITY concept: a set-intersection over
 * mutation operation tokens (`packages/runtime/admission/envelope.ts:100-131`
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
 * The §6/§7 semantics this kernel computes
 * ---------------------------------------------------------------------------
 *
 * - the ladder: `deny < ask < allow` on the expansion axis (ADR §6);
 * - EXPANSION = a pair's effect rank goes UP. The PRIOR effect is the pair's
 *   rule in the current authority snapshot; ABSENCE counts as `deny`
 *   (fail-closed: a fresh grant is the widest expansion, which is what makes
 *   the ADR §6 envelope actually bound grants — and it needs no live
 *   lower-layer read, which is impossible here because the static layers match
 *   OPERATIONS through the live canonicalization seam, not rule text);
 * - TIGHTENING = rank goes DOWN → needs NO expansion authority (ADR §6,
 *   pinned by test in both directions per coordinator D1);
 * - coverage: an envelope rule covers a mutation rule iff the operationClass
 *   token is EQUAL (no wildcards) AND `matcherCovers` holds AND the new effect
 *   is at or below `maximumEffect`. Matcher coverage: fingerprint covers only
 *   the IDENTICAL fingerprint (exact only, design §5); exact covers only the
 *   identical exact; a subtree root covers an exact/subtree identity strictly
 *   below it — and "below" is the INJECTED containment predicate (the
 *   canonical keys are opaque: the same reason the frozen Alpha.2 matcher
 *   refuses `startsWith`, `operation-permission/permission-resolver.ts:64-70`).
 *   With no predicate injected, subtree coverage FAILS CLOSED
 *   ({@link CoverageVerdict.undeterminable});
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
/** One canonical resource matcher over OPAQUE canonical identities. */
export type PermissionResourceMatcher = {
    readonly kind: 'exact';
    readonly resource: string;
} | {
    readonly kind: 'subtree';
    readonly resource: string;
} | {
    readonly kind: 'fingerprint';
    readonly resource: string;
};
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
/** One envelope rule (design §4 recommended conceptual form, verbatim shape). */
export interface PermissionEnvelopeRule {
    readonly operationClass: string;
    readonly matcher: PermissionResourceMatcher;
    readonly maximumEffect: PermissionOverlayEffect;
}
/** The envelope document: the Leader's expansion authority for one team. */
export interface PermissionMutationEnvelope {
    readonly rules: readonly PermissionEnvelopeRule[];
}
/** Validate + freeze one envelope document. An empty `rules` list is VALID
 *  and means exactly one thing: NO expansion authority (every Leader
 *  expansion refuses; tightenings are unaffected) — fail-closed default. */
export declare function parsePermissionMutationEnvelope(raw: unknown): PermissionMutationEnvelope;
/** The containment predicate over two canonical identities of the SAME
 *  backend namespace. Production injects the pinned public containment seam
 *  (the A2C-7 precedent: the frozen matcher itself never `startsWith` —
 *  `operation-permission/permission-resolver.ts` A2C-7 paragraph); tests
 *  inject a deterministic algebra. Absent → subtree coverage fails closed. */
export type SubtreeContains = (root: string, child: string) => boolean;
/** The outcome of one coverage question (the refusal detail stays explainable). */
export interface CoverageVerdict {
    readonly covers: boolean;
    /** True when a subtree envelope matcher needed a containment verdict that
     *  no injected predicate could give (fail-closed refusal, never a guess). */
    readonly undeterminable: boolean;
}
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
export declare function matcherCovers(envelope: PermissionResourceMatcher, target: PermissionResourceMatcher, subtreeContains?: SubtreeContains): CoverageVerdict;
/** The envelope answer to one expansion step (ADR §6: the covering rule
 *  names BOTH the matcher and the maximum-effect ceiling). */
export declare function envelopeAuthorizesExpansion(envelope: PermissionMutationEnvelope, operationClass: string, matcher: PermissionResourceMatcher, toEffect: PermissionOverlayEffect, subtreeContains?: SubtreeContains): {
    readonly authorized: boolean;
    readonly undeterminable: boolean;
};
/** One expansion a Leader mutation attempts (the service checks each against
 *  the envelope; Human mutations skip the check by ADR §7). */
export interface RequiredExpansion {
    readonly operationClass: string;
    readonly resource: string;
    readonly from: PermissionOverlayEffect;
    readonly to: PermissionOverlayEffect;
    readonly matcher: PermissionResourceMatcher;
}
/** The plan of one mutation against the current authority snapshot. */
export type PermissionMutationPlan = {
    readonly changed: true;
    /** The FULL next rule set (a snapshot, never a delta — ADR §2). */
    readonly rules: readonly PermissionOverlayRule[];
    readonly expansions: readonly RequiredExpansion[];
} | {
    readonly changed: false;
    readonly reason: 'no-change';
};
/**
 * Plan one mutation against the current authority snapshot (pure): produce
 * the FULL next rule set and the expansions it performs, or the typed
 * no-change. The absence baseline is `deny` (fail-closed, module header).
 *
 * A revoke carrying an effect that does NOT match the durable effect at the
 * addressed pair is a STALE VIEW and refuses with MALFORMED_MUTATION's
 * sibling — no: it refuses GENERATION_CONFLICT-shaped staleness through the
 * CAS by design (the expectedGeneration guard is the honest staleness
 * signal); the carried-effect mismatch itself refuses as
 * MALFORMED_MUTATION/problem `revoke-effect-mismatch`, still ZERO write.
 */
export declare function planPermissionMutation(latest: PermissionOverlaySnapshot | undefined, mutation: PermissionMutation): PermissionMutationPlan;
//# sourceMappingURL=permission-mutation.d.ts.map