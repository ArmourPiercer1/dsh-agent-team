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
import { deepFreeze, toRemoteSafeDetail } from '../../contracts/src/index.js';
// LEAF import on purpose (the PR2 load-order lesson,
// test/a3p2-effective-policy-lane-import.test.ts): the operation-permission
// BARREL reaches the canonicalizer and back into the admission surface; its
// types module imports NOTHING. The governance lane is imported by
// src/plugin/root.ts, so only the leaf edge is safe here.
import { FILE_PERMISSION_TOOL_VALUES, SHELL_PERMISSION_TOOL_VALUES, } from '../operation-permission/types.js';
// ---------------------------------------------------------------------------
// The closed error surface (fail closed: refusals are typed, never silent)
// ---------------------------------------------------------------------------
/** The closed error-code vocabulary of the permission-mutation kernel. */
export const PERMISSION_MUTATION_ERROR_CODES = Object.freeze({
    /** The mutation input is malformed (identity, kind, rule grammar). */
    MALFORMED_MUTATION: 'PERMISSION_MUTATION_MALFORMED',
    /** The envelope document is malformed (shape, class/matcher mispair). */
    MALFORMED_ENVELOPE: 'PERMISSION_ENVELOPE_MALFORMED',
    /** The authority kind may not act on the permission lane (member/others). */
    UNAUTHORIZED_ACTOR: 'PERMISSION_MUTATION_UNAUTHORIZED_ACTOR',
    /** A Leader expansion no envelope rule covers (ADR §6) — zero write. */
    EXPANSION_OUTSIDE_ENVELOPE: 'PERMISSION_ENVELOPE_EXPANSION_DENIED',
    /** The effective before/after of a region depends on lower-layer facts the
     *  service was not given (`staticLayers` not injected) and the outcome is
     *  NOT provably independent of those facts — refuse, never let an unknown
     *  fallback masquerade as `deny` (an unknown prior must never be labeled
     *  expansion OR tightening) — zero write. */
    EFFECT_CONTEXT_UNAVAILABLE: 'PERMISSION_EFFECT_CONTEXT_UNAVAILABLE',
    /** The expectedGeneration CAS moved (plan PR3 "CAS conflict") — zero write. */
    GENERATION_CONFLICT: 'PERMISSION_OVERLAY_GENERATION_CONFLICT',
    /** The lane dependencies were not injected — the capability stays dormant. */
    NOT_CONFIGURED: 'PERMISSION_MUTATION_NOT_CONFIGURED',
});
/** Every kernel error code value, for membership checks. */
export const PERMISSION_MUTATION_ERROR_CODE_VALUES = Object.freeze(Object.values(PERMISSION_MUTATION_ERROR_CODES));
/** A typed permission-mutation refusal. Branch on `code` + `details.problem`,
 *  never on the message text. A refusal performs NO write. */
export class PermissionMutationError extends Error {
    /** The closed error code. */
    code;
    /** Lossless context (never a live caller object). */
    details;
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'PermissionMutationError';
        this.code = code;
        this.details = deepFreeze({ ...details });
    }
}
/** Is `error` a {@link PermissionMutationError}? */
export function isPermissionMutationError(error) {
    return error instanceof PermissionMutationError;
}
function refuse(code, problem, message, details = {}) {
    throw new PermissionMutationError(code, `${message} (problem: ${problem})`, {
        problem,
        ...toRemoteSafeDetail(details),
    });
}
// ---------------------------------------------------------------------------
// The §6 ladder and the direction classification (pinned in both directions)
// ---------------------------------------------------------------------------
/**
 * The expansion ladder (ADR §6): on the expansion axis `deny < ask < allow`.
 * An effect change is an EXPANSION iff the rank goes UP, a TIGHTENING iff it
 * goes DOWN, IDENTITY otherwise.
 */
export const PERMISSION_EFFECT_PRECEDENCE = Object.freeze({
    deny: 0,
    ask: 1,
    allow: 2,
});
/** Classify one effect change on the §6 ladder. */
export function permissionEffectDirection(from, to) {
    const a = PERMISSION_EFFECT_PRECEDENCE[from];
    const b = PERMISSION_EFFECT_PRECEDENCE[to];
    if (b > a)
        return 'expansion';
    if (b < a)
        return 'tightening';
    return 'identity';
}
/**
 * Classify one operation-class token against the closed A2 vocabulary
 * (`operation-permission/types.ts`: the five file tools + the shell class).
 * `unknown` tokens are REJECTED by the validators — a rule naming a tool the
 * permission plane does not know is malformed here (fail-closed), not a
 * silently inert row (contrast: the frozen A2 matcher is total over ANY
 * rule text it is handed; this grammar is the AUTHORITY's write-time gate,
 * where a typo'd operation class must be refused, not stored).
 */
export function classifyPermissionOperationClass(token) {
    if (SHELL_PERMISSION_TOOL_VALUES.includes(token))
        return 'exec';
    if (FILE_PERMISSION_TOOL_VALUES.includes(token))
        return 'fs';
    return 'unknown';
}
// ---------------------------------------------------------------------------
// The resource matcher (design §4/§5) and the carrier grammar
// ---------------------------------------------------------------------------
/** The closed matcher kinds (design §5; `any` deliberately absent). */
export const PERMISSION_RESOURCE_MATCHER_KINDS = ['exact', 'subtree', 'fingerprint'];
/** The prefix that renders one matcher kind into the carrier text. */
const MATCHER_PREFIX = Object.freeze({
    exact: 'exact:',
    subtree: 'subtree:',
    fingerprint: 'fingerprint:',
});
/** The carrier identity bound: the PR1 row accepts resources up to 1024
 *  characters (storage schema parseWorkspaceField); a rendered matcher must
 *  fit BEFORE the durable gate is ever reached, so the refusal is typed. */
const MAX_CARRIER_RESOURCE_LENGTH = 1024;
/** Render one matcher into the deterministic carrier text of the overlay row
 *  (prefix at the FIRST colon; round-trips through
 *  {@link parsePermissionResourceText}). */
export function renderPermissionResourceText(matcher) {
    return `${MATCHER_PREFIX[matcher.kind]}${matcher.resource}`;
}
/** Parse carrier text back into a matcher (structure only — the class pairing
 *  is checked where the operationClass is known). `undefined` when the text
 *  carries no valid prefix (a foreign grammar string). */
export function parsePermissionResourceText(text) {
    for (const kind of PERMISSION_RESOURCE_MATCHER_KINDS) {
        const prefix = MATCHER_PREFIX[kind];
        if (text.startsWith(prefix)) {
            return { kind, resource: text.slice(prefix.length) };
        }
    }
    return undefined;
}
/** Validate + copy one matcher against the operation-class pairing rules
 *  (design §5). Throws MALFORMED_MUTATION / MALFORMED_ENVELOPE by context. */
function validateMatcher(raw, operationClass, opClass, code, where) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        refuse(code, 'matcher-not-a-record', 'a permission resource matcher must be a record { kind, resource }', where);
    }
    const record = raw;
    const kind = record['kind'];
    const resource = record['resource'];
    if (typeof resource !== 'string' || resource.length === 0) {
        refuse(code, 'matcher-resource-empty', 'a permission resource matcher must carry a non-empty canonical identity', where);
    }
    if (kind !== 'exact' && kind !== 'subtree' && kind !== 'fingerprint') {
        // This is also where `any` dies (design §5: exec "No: subtree; any" — and
        // the fs class has no wildcard either, see the module header).
        refuse(code, 'matcher-kind-outside-closed-set', `a permission resource matcher kind must be exact | subtree | fingerprint, got ${JSON.stringify(kind)}`, where);
    }
    const matcherKind = kind;
    if (opClass === 'exec' && matcherKind !== 'fingerprint') {
        refuse(code, 'exec-matcher-must-be-fingerprint', `operation class ${JSON.stringify(operationClass)} is shell-class: its matcher is EXACT canonical fingerprint ONLY (design §5: no subtree, no any)`, { ...where, operationClass, matcherKind });
    }
    if (opClass === 'fs' && matcherKind === 'fingerprint') {
        refuse(code, 'fs-matcher-must-not-be-fingerprint', `operation class ${JSON.stringify(operationClass)} is filesystem-class: its matcher is exact | subtree (design §5)`, { ...where, operationClass, matcherKind });
    }
    const matcher = { kind: matcherKind, resource };
    const rendered = renderPermissionResourceText(matcher);
    if (rendered.length > MAX_CARRIER_RESOURCE_LENGTH) {
        refuse(code, 'matcher-resource-over-bound', `the rendered overlay resource exceeds the ${String(MAX_CARRIER_RESOURCE_LENGTH)}-char carrier bound`, { ...where, length: rendered.length });
    }
    for (let i = 0; i < resource.length; i += 1) {
        const c = resource.charCodeAt(i);
        if (c < 0x20 || c === 0x7f) {
            refuse(code, 'matcher-resource-control-char', 'a canonical identity must not contain control characters', where);
        }
    }
    return deepFreeze({ ...matcher });
}
// ---------------------------------------------------------------------------
// The unified PermissionMutation model (design §3.4 / ADR §5)
// ---------------------------------------------------------------------------
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
export const PERMISSION_MUTATION_KINDS = ['grant_instance', 'update_permission', 'revoke_permission'];
/** Validate + freeze one mutation input (the structural half of the write
 *  gate; authority and envelope are decided by the service around it). */
export function parsePermissionMutation(raw) {
    const where = { field: 'permissionMutation' };
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'mutation-not-a-record', 'a PermissionMutation must be a record', where);
    }
    const kind = raw.kind;
    if (!PERMISSION_MUTATION_KINDS.includes(String(kind))) {
        refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'kind-outside-closed-set', `a PermissionMutation kind must be one of ${PERMISSION_MUTATION_KINDS.join(', ')} (design §3.4), got ${JSON.stringify(kind)}`, { field: 'kind' });
    }
    if (typeof raw.mutationId !== 'string' || raw.mutationId.length === 0 || raw.mutationId.length > 128) {
        refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'mutation-id-invalid', 'mutationId must be a non-empty string of at most 128 characters (the ADR §2 provenance identity)', { field: 'mutationId' });
    }
    for (const i of raw.mutationId) {
        const c = i.charCodeAt(0);
        if (c < 0x20 || c === 0x7f) {
            refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'mutation-id-control-char', 'mutationId must not contain control characters', { field: 'mutationId' });
        }
    }
    if (typeof raw.reason !== 'string' || raw.reason.length > 512) {
        refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'reason-over-bound', 'reason must be a string of at most 512 characters (the PR1 provenance bound, PERMISSION_OVERLAY_MAX_REASON_LENGTH)', { field: 'reason' });
    }
    if (!Array.isArray(raw.rules) || raw.rules.length === 0) {
        refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'rules-non-empty-array', 'a PermissionMutation addresses at least one (operationClass, matcher) pair', { field: 'rules' });
    }
    const rules = [];
    const seen = new Set();
    for (const [index, entry] of raw.rules.entries()) {
        const ruleWhere = { field: `rules[${String(index)}]` };
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'rule-not-a-record', 'an addressed mutation rule must be a record', ruleWhere);
        }
        const operationClass = entry.operationClass;
        if (typeof operationClass !== 'string' || operationClass.length === 0 || operationClass.length > 128) {
            refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'operation-class-invalid', 'operationClass must be a non-empty token of at most 128 characters (the PR1 operation-token grammar)', ruleWhere);
        }
        const opClass = classifyPermissionOperationClass(operationClass);
        if (opClass === 'unknown') {
            refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'operation-class-unknown', `operation class ${JSON.stringify(operationClass)} is outside the closed permission vocabulary (the A2 file tools + the shell class) — a typo'd class is refused at the authority, never stored inert`, { ...ruleWhere, operationClass });
        }
        const effect = entry.effect;
        if (effect !== 'allow' && effect !== 'ask' && effect !== 'deny') {
            refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'effect-outside-closed-set', `a mutation effect must be allow | ask | deny, got ${JSON.stringify(effect)}`, { ...ruleWhere, effect });
        }
        const matcher = validateMatcher(entry.matcher, operationClass, opClass, PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, ruleWhere);
        const pairKey = `${operationClass}\u0000${renderPermissionResourceText(matcher)}`;
        if (seen.has(pairKey)) {
            refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'duplicate-addressed-pair', 'a mutation addresses each (operationClass, resource) pair at most once', { ...ruleWhere, operationClass });
        }
        seen.add(pairKey);
        rules.push(deepFreeze({ operationClass, matcher, effect }));
    }
    if (raw.expectedGeneration !== undefined) {
        const g = raw.expectedGeneration;
        if (!Number.isSafeInteger(g) || g < 0) {
            refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'expected-generation-invalid', 'expectedGeneration must be a safe integer >= 0 (0 = "no snapshot exists yet")', { field: 'expectedGeneration' });
        }
    }
    return deepFreeze({
        kind,
        mutationId: raw.mutationId,
        teamSessionId: raw.teamSessionId,
        memberInstanceId: raw.memberInstanceId,
        reason: raw.reason,
        rules,
        ...(raw.expectedGeneration !== undefined ? { expectedGeneration: raw.expectedGeneration } : {}),
    });
}
/** Validate + freeze one envelope document. An empty `rules` list is VALID
 *  and means exactly one thing: NO expansion authority (every Leader
 *  expansion refuses; tightenings are unaffected) — fail-closed default. */
export function parsePermissionMutationEnvelope(raw) {
    const code = PERMISSION_MUTATION_ERROR_CODES.MALFORMED_ENVELOPE;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        refuse(code, 'envelope-not-a-record', 'a PermissionMutationEnvelope must be a record { rules }', { field: 'envelope' });
    }
    const value = raw;
    if (!Array.isArray(value.rules)) {
        refuse(code, 'rules-not-an-array', 'a PermissionMutationEnvelope must carry a rules array (possibly empty)', { field: 'envelope.rules' });
    }
    const rules = [];
    const seen = new Set();
    for (const [index, entry] of value.rules.entries()) {
        const ruleWhere = { field: `envelope.rules[${String(index)}]` };
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            refuse(code, 'rule-not-a-record', 'an envelope rule must be a record', ruleWhere);
        }
        const operationClass = entry.operationClass;
        if (typeof operationClass !== 'string' || operationClass.length === 0 || operationClass.length > 128) {
            refuse(code, 'operation-class-invalid', 'an envelope rule must name a non-empty operationClass token', ruleWhere);
        }
        const opClass = classifyPermissionOperationClass(operationClass);
        if (opClass === 'unknown') {
            refuse(code, 'operation-class-unknown', `envelope operation class ${JSON.stringify(operationClass)} is outside the closed permission vocabulary — an envelope rule the permission plane cannot speak about is refused, never silently inert`, { ...ruleWhere, operationClass });
        }
        const maximumEffect = entry.maximumEffect;
        if (maximumEffect !== 'allow' && maximumEffect !== 'ask' && maximumEffect !== 'deny') {
            refuse(code, 'maximum-effect-outside-closed-set', 'maximumEffect must be allow | ask | deny', { ...ruleWhere, maximumEffect });
        }
        const matcher = validateMatcher(entry.matcher, operationClass, opClass, code, ruleWhere);
        const pairKey = `${operationClass}\u0000${renderPermissionResourceText(matcher)}`;
        if (seen.has(pairKey)) {
            refuse(code, 'duplicate-envelope-pair', 'an envelope carries each (operationClass, resource) pair at most once (its most permissive entry is what coverage would use — duplicates are a document defect)', ruleWhere);
        }
        seen.add(pairKey);
        rules.push(deepFreeze({ operationClass, matcher, maximumEffect }));
    }
    return deepFreeze({ rules });
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
export function matcherCovers(envelope, target, subtreeContains) {
    if (envelope.kind === 'fingerprint' || target.kind === 'fingerprint') {
        const covers = envelope.kind === 'fingerprint' && target.kind === 'fingerprint' && envelope.resource === target.resource;
        return { covers, undeterminable: false };
    }
    if (envelope.kind === 'exact') {
        return { covers: target.kind === 'exact' && envelope.resource === target.resource, undeterminable: false };
    }
    // envelope.kind === 'subtree'
    // Identity FIRST (external round 2): a subtree covers its own resource and
    // the exact point at its root — provable WITHOUT any predicate. The old
    // ordering marked even this pair unknown whenever the predicate was absent,
    // and the consumption sites then dropped the rule as a non-match.
    if (envelope.resource === target.resource)
        return { covers: true, undeterminable: false };
    if (subtreeContains === undefined) {
        return { covers: false, undeterminable: true };
    }
    return { covers: subtreeContains(envelope.resource, target.resource), undeterminable: false };
}
/** The bound on declared static rules per layer (mirrored, pinned — same
 *  discipline as {@link MAX_RULES_BOUND}): a layer larger than the durable
 *  rule-set bound could never be reflected by an overlay anyway. */
const MAX_STATIC_RULES_BOUND = 256;
const MAX_STATIC_LAYERS_BOUND = 4;
/** Validate + freeze injected static-layer facts (the lane-boundary shape is
 *  untrusted input). Malformed facts are an authority-CONFIG defect and
 *  refuse with the envelope-malformed family (both are authority-side
 *  documents; the mutation itself may be perfectly shaped). */
export function parsePermissionStaticLayerFacts(raw) {
    const code = PERMISSION_MUTATION_ERROR_CODES.MALFORMED_ENVELOPE;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        refuse(code, 'static-facts-shape', 'static layer facts must be an object { layers: [...] }', {});
    }
    const layersRaw = raw.layers;
    if (!Array.isArray(layersRaw)) {
        refuse(code, 'static-facts-layers-array', 'static layer facts must carry a layers ARRAY ({ layers: [] } is the DECLARED-NONE case)', {});
    }
    if (layersRaw.length > MAX_STATIC_LAYERS_BOUND) {
        refuse(code, 'static-facts-layers-bound', `at most ${String(MAX_STATIC_LAYERS_BOUND)} static layers (blueprint, template) are comparable`, { layers: layersRaw.length });
    }
    const layers = [];
    for (const [layerIndex, layerRaw] of layersRaw.entries()) {
        const where = { layerIndex };
        if (typeof layerRaw !== 'object' || layerRaw === null || Array.isArray(layerRaw)) {
            refuse(code, 'static-layer-shape', 'each static layer must be an object { label?, default, rules }', where);
        }
        const layer = layerRaw;
        if (layer.default !== 'ask' && layer.default !== 'deny') {
            refuse(code, 'static-layer-fallback-closed-set', 'static layer default must be ask | deny', { ...where, default: layer.default });
        }
        if (!Array.isArray(layer.rules)) {
            refuse(code, 'static-layer-rules-array', 'each static layer must carry a rules ARRAY', where);
        }
        if (layer.rules.length > MAX_STATIC_RULES_BOUND) {
            refuse(code, 'static-layer-rules-bound', `a static layer carries at most ${String(MAX_STATIC_RULES_BOUND)} rules`, where);
        }
        const rules = [];
        for (const [ruleIndex, ruleRaw] of layer.rules.entries()) {
            const ruleWhere = { ...where, ruleIndex };
            if (typeof ruleRaw !== 'object' || ruleRaw === null || Array.isArray(ruleRaw)) {
                refuse(code, 'static-rule-shape', 'each static rule must be { operationClass, matcher, effect }', ruleWhere);
            }
            const rule = ruleRaw;
            if (typeof rule.operationClass !== 'string' || rule.operationClass.length === 0) {
                refuse(code, 'static-rule-class-string', 'static rule operationClass must be a non-empty string', ruleWhere);
            }
            const opClass = classifyPermissionOperationClass(rule.operationClass);
            if (opClass === 'unknown') {
                refuse(code, 'static-rule-class-unknown', `static rule class ${JSON.stringify(rule.operationClass)} is outside the closed permission vocabulary`, ruleWhere);
            }
            if (rule.effect !== 'allow' && rule.effect !== 'ask' && rule.effect !== 'deny') {
                refuse(code, 'static-rule-effect-closed-set', 'static rule effect must be allow | ask | deny', ruleWhere);
            }
            if (typeof rule.matcher !== 'object' || rule.matcher === null || Array.isArray(rule.matcher)) {
                refuse(code, 'static-rule-matcher-shape', 'static rule matcher must be { kind, resource? }', ruleWhere);
            }
            const matcher = rule.matcher;
            if (matcher.kind === 'any') {
                if (matcher.resource !== undefined) {
                    refuse(code, 'static-rule-any-resource', 'an any-matcher carries no resource', ruleWhere);
                }
                rules.push(deepFreeze({ operationClass: rule.operationClass, matcher: { kind: 'any' }, effect: rule.effect }));
                continue;
            }
            const validated = validateMatcher(matcher, rule.operationClass, opClass, code, ruleWhere);
            rules.push(deepFreeze({ operationClass: rule.operationClass, matcher: validated, effect: rule.effect }));
        }
        const label = typeof layer.label === 'string' ? layer.label : undefined;
        layers.push(deepFreeze({ ...(label === undefined ? {} : { label }), default: layer.default, rules }));
    }
    return deepFreeze({ layers });
}
function overlayEffectForRegion(rules, operationClass, region, subtreeContains) {
    let best;
    let unknown = false;
    for (const rule of rules) {
        if (rule.operation !== operationClass)
            continue;
        const matcher = parsePermissionResourceText(rule.resource);
        if (matcher === undefined) {
            refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'overlay-carrier-unparsable', `the durable overlay carrier ${JSON.stringify(rule.resource)} does not parse under the PR3 grammar — the durable record is unreadable and every mutation refuses until it is`, { resource: rule.resource });
        }
        const verdict = matcherCovers(matcher, region, subtreeContains);
        // Unknown is NEVER a silent non-match (round 2): a possibly-matching rule
        // can only make the answer MORE restrictive, so a definite `deny` already
        // answers (the lattice bottom); anything else is undecidable.
        if (verdict.undeterminable) {
            unknown = true;
            continue;
        }
        if (!verdict.covers)
            continue;
        if (best === undefined || PERMISSION_EFFECT_PRECEDENCE[rule.effect] < PERMISSION_EFFECT_PRECEDENCE[best])
            best = rule.effect;
    }
    if (best === 'deny')
        return 'deny';
    if (unknown)
        return 'unknown';
    return best;
}
function staticEffectForRegion(facts, operationClass, region, subtreeContains) {
    for (let index = facts.layers.length - 1; index >= 0; index -= 1) {
        const layer = facts.layers[index];
        if (layer === undefined)
            continue;
        let best;
        let unknown = false;
        for (const rule of layer.rules) {
            if (rule.operationClass !== operationClass)
                continue;
            const verdict = rule.matcher.kind === 'any'
                ? { covers: true, undeterminable: false }
                : matcherCovers(rule.matcher, region, subtreeContains);
            if (verdict.undeterminable) {
                unknown = true;
                continue;
            }
            if (verdict.covers) {
                if (best === undefined || PERMISSION_EFFECT_PRECEDENCE[rule.effect] < PERMISSION_EFFECT_PRECEDENCE[best])
                    best = rule.effect;
            }
        }
        // A layer that COULD answer through an unknown-coverage rule answers
        // undecidably — a lower layer may not fill the gap optimistically.
        if (best === 'deny')
            return { effect: 'deny', source: 'layer' };
        if (unknown)
            return 'unknown';
        if (best !== undefined)
            return { effect: best, source: 'layer' };
    }
    // The effective fallback: the LOWEST declared layer's default; DECLARED-NONE
    // (`layers: []`) fails closed to `deny` exactly as the merged assembler does.
    const lowest = facts.layers[0];
    return { effect: lowest === undefined ? 'deny' : lowest.default, source: 'fallback' };
}
/**
 * The effective answer of ONE closed region (pure; exported for the
 * assembler-parity spec — production classification runs it INSIDE
 * {@link authorizeLeaderPermissionMutation}, never re-reads context).
 * `context-unavailable` covers BOTH unknown lower facts AND any coverage
 * relation the injected predicates cannot decide — unknown never answers.
 */
export function permissionEffectiveAnswer(query) {
    const overlay = overlayEffectForRegion(query.overlayRules, query.operationClass, query.region, query.subtreeContains);
    if (overlay === 'unknown')
        return { status: 'context-unavailable' };
    if (overlay !== undefined)
        return { status: 'decided', effect: overlay, source: 'overlay' };
    if (query.staticFacts === undefined)
        return { status: 'context-unavailable' };
    const lower = staticEffectForRegion(query.staticFacts, query.operationClass, query.region, query.subtreeContains);
    if (lower === 'unknown')
        return { status: 'context-unavailable' };
    return { status: 'decided', effect: lower.effect, source: lower.source };
}
/** WHOLE-MATCHER relation: is `boundary` a strict sub-region of `scope`?
 *  Subtrees are laminar on the canonical-key tree (nested-or-disjoint): a
 *  boundary is inside iff the injected predicate places it under the scope
 *  root (a root-point exact counts as strictly inside its subtree — the
 *  subtree's own identity is answered by `whole`). Without a predicate every
 *  subtree-vs-boundary question is `undeterminable` and the CALLER refuses
 *  (fail closed; pure exact/fingerprint regions need no predicate at all). */
function strictSubsetVerdict(boundary, scope, subtreeContains) {
    if (boundary.kind === 'fingerprint' || scope.kind === 'fingerprint') {
        if (boundary.kind === 'fingerprint' && scope.kind === 'fingerprint') {
            return boundary.resource === scope.resource ? 'whole' : 'out';
        }
        return 'out';
    }
    if (scope.kind === 'exact') {
        if (boundary.kind === 'exact') {
            return boundary.resource === scope.resource ? 'whole' : 'out';
        }
        // Subtree boundary vs point scope (external round 2, claim (a)): the old
        // branch answered 'out' UNCONDITIONALLY here, before any relation test —
        // the split conclusion (never split a singleton) is fine, but the
        // containment relation itself must be answered honestly: provable by
        // identity at equal resources (a root covers itself), decided by the
        // predicate otherwise, and UNDETERMINABLE without one — unknown is never
        // silently 'out'.
        if (boundary.resource === scope.resource)
            return 'whole';
        if (subtreeContains === undefined)
            return 'undeterminable';
        return subtreeContains(boundary.resource, scope.resource) ? 'whole' : 'out';
    }
    if (boundary.kind === 'subtree' && boundary.resource === scope.resource)
        return 'whole';
    if (subtreeContains === undefined)
        return 'undeterminable';
    return subtreeContains(scope.resource, boundary.resource) ? 'in' : 'out';
}
function sameMatcher(a, b) {
    return a.kind === b.kind && a.resource === b.resource;
}
/** Partition the mutation matcher `scope` into CELLS: every family matcher
 *  that strictly contains a region boundary splits it, recursively. Within a
 *  cell every family rule matches ALL resources or NONE (laminar + complete
 *  refinement), so the effective answer is CONSTANT per cell — comparing
 *  cells compares the full region, not a sample.
 *  RESIDUAL cells (scope minus children) are treated as NON-EMPTY even when
 *  emptiness would need resource enumeration to decide: that can only
 *  over-refuse, never under-refuse. Returns `undeterminable` if any split
 *  needed a containment verdict no predicate could give. */
function cellsForRegion(operationClass, scope, family, subtreeContains) {
    const cells = [];
    const seen = new Set();
    const push = (parent) => {
        const key = `${parent.kind}\u0000${parent.resource}`;
        if (seen.has(key))
            return;
        seen.add(key);
        cells.push({ operationClass, parent });
    };
    const visit = (parent) => {
        push(parent);
        const contained = [];
        for (const entry of family) {
            if (entry.operationClass !== operationClass)
                continue;
            const verdict = strictSubsetVerdict(entry.matcher, parent, subtreeContains);
            if (verdict === 'undeterminable')
                return 'undeterminable';
            if (verdict === 'in' && !contained.some((c) => sameMatcher(c, entry.matcher)))
                contained.push(entry.matcher);
        }
        for (const child of contained) {
            // DIRECT children only: a boundary nested inside another boundary is
            // handled by recursing into its parent child cell.
            if (contained.some((other) => !sameMatcher(other, child) && strictSubsetVerdict(child, other, subtreeContains) === 'in'))
                continue;
            if (child.kind === 'exact')
                push(child); // a point cell
            else {
                const nested = visit(child);
                if (nested === 'undeterminable')
                    return 'undeterminable';
            }
        }
        return 'ok';
    };
    return visit(scope) === 'ok' ? cells : 'undeterminable';
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
 * PR4 round 4 (`authorityCeiling`): when the caller injects the acting
 * leader's OWN overlay rules + static facts, EVERY risen cell additionally
 * needs the leader's EFFECTIVE answer in that cell at rank >= the risen
 * effect — the grantor cannot promote a member past what it itself holds
 * (exceptions subtracted, never folded into a union). Unknown leader facts
 * → EFFECT_CONTEXT_UNAVAILABLE; below-risen → EXPANSION_OUTSIDE_ENVELOPE
 * (problem `expansion-exceeds-authority-ceiling`). Absent input = the
 * pre-round-4 envelope-only judgement, byte-for-byte.
 */
export function authorizeLeaderPermissionMutation(input) {
    const { latestRules, plannedRules, mutationRules, envelope, staticFacts, subtreeContains, authorityCeiling } = input;
    const family = [];
    for (const rules of [latestRules, plannedRules]) {
        for (const rule of rules) {
            const matcher = parsePermissionResourceText(rule.resource);
            if (matcher === undefined) {
                refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'overlay-carrier-unparsable', `the durable overlay carrier ${JSON.stringify(rule.resource)} does not parse under the PR3 grammar`, { resource: rule.resource });
            }
            family.push({ operationClass: rule.operation, matcher });
        }
    }
    for (const layer of staticFacts?.layers ?? []) {
        for (const rule of layer.rules) {
            if (rule.matcher.kind === 'any')
                continue; // uniform over the class: never a boundary
            family.push({ operationClass: rule.operationClass, matcher: rule.matcher });
        }
    }
    // PRE-CLASSIFICATION GATE (external review round 2, parent-binding): if
    // ANY relevant family (mutation matcher ∪ latest ∪ planned ∪ static rules
    // of the mutation's operation classes) carries a subtree matcher and no
    // containment predicate is injected, the covering relations are genuinely
    // unknown — refuse typed EFFECT_CONTEXT_UNAVAILABLE BEFORE anything is
    // classified (unknown is never 'no match' and never 'out'; silent drops
    // are the fail-open P1 class this gate exists to kill). Exact- and
    // fingerprint-only families are decidable without a predicate and keep
    // flowing normally.
    if (subtreeContains === undefined) {
        const relevantClasses = new Set(mutationRules.map((rule) => rule.operationClass));
        const unknownSubtreeRelation = mutationRules.some((rule) => rule.matcher.kind === 'subtree') ||
            family.some((entry) => relevantClasses.has(entry.operationClass) && entry.matcher.kind === 'subtree');
        if (unknownSubtreeRelation) {
            refuse(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE, 'subtree-relation-unknown', 'subtree matchers exist in the affected classes but no subtree-containment predicate is injected: covering relations are unknown and are never assumed to be non-matching — inject subtreeContains (zero write)', { operationClasses: [...relevantClasses].sort() });
        }
    }
    const undeterminable = [];
    const unmet = [];
    for (const mutationRule of mutationRules) {
        const operationClass = mutationRule.operationClass;
        const cells = cellsForRegion(operationClass, mutationRule.matcher, family, subtreeContains);
        if (cells === 'undeterminable') {
            undeterminable.push({
                detail: {
                    operationClass,
                    region: renderPermissionResourceText(mutationRule.matcher),
                    missing: 'subtree-containment',
                    why: 'the region partition needs a containment verdict no injected predicate could give (constraint: unknown subtree relation fails closed)',
                },
            });
            continue;
        }
        for (const cell of cells) {
            const before = permissionEffectiveAnswer({ overlayRules: latestRules, staticFacts, operationClass, region: cell.parent, subtreeContains });
            const after = permissionEffectiveAnswer({ overlayRules: plannedRules, staticFacts, operationClass, region: cell.parent, subtreeContains });
            const cellDetail = {
                operationClass,
                region: renderPermissionResourceText(cell.parent),
                before: before.status === 'decided' ? `${before.effect}:${before.source}` : 'unknown',
                after: after.status === 'decided' ? `${after.effect}:${after.source}` : 'unknown',
            };
            if (before.status === 'decided' && after.status === 'decided') {
                if (PERMISSION_EFFECT_PRECEDENCE[after.effect] <= PERMISSION_EFFECT_PRECEDENCE[before.effect])
                    continue; // no rise (tightening or identity)
                const risen = after.effect;
                // Envelope coverage must itself be decidable: a subtree ENVELOPE
                // matcher whose coverage of the mutation matcher is unknown without
                // a predicate refuses as CONTEXT (X5) — never a mislabeled EXPANSION.
                let covered = false;
                let coverageUnknown = false;
                for (const rule of envelope.rules) {
                    if (rule.operationClass !== operationClass)
                        continue;
                    if (PERMISSION_EFFECT_PRECEDENCE[risen] > PERMISSION_EFFECT_PRECEDENCE[rule.maximumEffect])
                        continue;
                    const verdict = matcherCovers(rule.matcher, mutationRule.matcher, subtreeContains);
                    if (verdict.undeterminable) {
                        coverageUnknown = true;
                        continue;
                    }
                    if (verdict.covers) {
                        covered = true;
                        break;
                    }
                }
                if (covered) {
                    // PR4 round 4 (external review X1, both demos pinned): envelope
                    // coverage says the cell MAY rise; the ACTING LEADER's own
                    // effective answer says the grantor HAS the risen authority. A
                    // leader whose lane answers `deny`/`ask` for THIS cell (a deny
                    // exception inside an allow subtree, a narrower ask inside a
                    // broader allow) cannot promote a member past its own effective
                    // effect — exceptions SUBTRACT authority; a lane union does not.
                    // Unknown leader facts refuse as context (never a guess), below-
                    // risen refuses as the §6 ceiling breach (same typed code, honest
                    // problem label — no new error codes).
                    if (authorityCeiling !== undefined) {
                        const leaderAnswer = permissionEffectiveAnswer({
                            overlayRules: authorityCeiling.overlayRules,
                            staticFacts: authorityCeiling.staticFacts,
                            operationClass,
                            region: cell.parent,
                            subtreeContains,
                        });
                        if (leaderAnswer.status !== 'decided') {
                            undeterminable.push({
                                detail: {
                                    ...cellDetail,
                                    missing: 'leader-authority-facts',
                                    why: 'the envelope covers this rise, but the acting leader\'s OWN effective answer for the cell cannot be decided from the injected leader authority facts — an unknown grantor is never assumed to hold the risen effect (zero write)',
                                },
                            });
                            continue;
                        }
                        if (PERMISSION_EFFECT_PRECEDENCE[risen] > PERMISSION_EFFECT_PRECEDENCE[leaderAnswer.effect]) {
                            unmet.push({
                                detail: {
                                    ...cellDetail,
                                    leader: `${leaderAnswer.effect}:${leaderAnswer.source}`,
                                    why: `the effective effect RISES ${before.effect}->${risen} in this cell, but the acting leader's OWN effective answer is ${leaderAnswer.effect} — a leader cannot grant a member an effect it does not itself hold in the cell (deny/ask exceptions subtract authority; ADR §6)`,
                                },
                            });
                            continue;
                        }
                    }
                    continue;
                }
                if (coverageUnknown) {
                    undeterminable.push({
                        detail: {
                            ...cellDetail,
                            mutationMatcher: renderPermissionResourceText(mutationRule.matcher),
                            missing: 'subtree-containment',
                            why: 'a rise was found, but a subtree ENVELOPE matcher cannot be judged to cover the WHOLE mutation matcher without an injected containment predicate — typed context refusal, never a label on unknown coverage (zero write)',
                        },
                    });
                    continue;
                }
                {
                    unmet.push({
                        detail: {
                            ...cellDetail,
                            mutationMatcher: renderPermissionResourceText(mutationRule.matcher),
                            why: `the effective effect RISES ${before.effect}->${risen} in this cell; the envelope must cover the WHOLE mutation matcher (width-conservative) with maximumEffect at least ${risen} (ADR §6, ladder-strict)`,
                        },
                    });
                }
                continue;
            }
            // At least one side answers from UNKNOWN lower facts. Provable
            // independence (quantified over every fallback hypothesis — see header):
            if (before.status === 'context-unavailable' && after.status === 'context-unavailable')
                continue; // (iv) same lower function both sides: equal
            const decided = before.status === 'decided' ? before : null;
            const afterDecided = after.status === 'decided' ? after : null;
            if (decided !== null && afterDecided === null) {
                if (decided.effect === 'allow')
                    continue; // (iii) nothing ranks above allow
            }
            if (afterDecided !== null && decided === null) {
                if (afterDecided.effect === 'deny')
                    continue; // (ii) nothing ranks below deny to rise from
            }
            undeterminable.push({
                detail: {
                    ...cellDetail,
                    mutationMatcher: renderPermissionResourceText(mutationRule.matcher),
                    missing: 'static-layers',
                    why: 'the region answer depends on lower-layer facts that were not injected — a typed refusal is issued because an unknown prior is never labeled expansion OR tightening (inject staticLayers; { layers: [] } is the decidable declared-none case)',
                },
            });
        }
    }
    // Deterministic fail-closed order: an unevaluable batch refuses as
    // context-unavailable BEFORE a partial rise could be reported (the whole
    // mutation is refused either way — zero write).
    const firstUndeterminable = undeterminable[0];
    if (firstUndeterminable !== undefined) {
        refuse(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE, 'effect-context-unavailable', `the effective before/after of at least one affected region cannot be decided without the missing context (${String(undeterminable.length)} region(s)) — zero write`, firstUndeterminable.detail);
    }
    const firstUnmet = unmet[0];
    if (firstUnmet !== undefined) {
        refuse(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE, 'expansion-region-uncovered', `a LEADER mutation raises the EFFECTIVE effect in ${String(unmet.length)} region(s) the envelope does not cover (ladder-strict; reveals included; all-or-nothing) — zero write`, firstUnmet.detail);
    }
}
/** The pair key inside a rule set: the operation-class token + the rendered
 *  carrier text (the PR1 duplicate-rule-pair identity, schema parseState). */
function pairKey(operation, resource) {
    return `${operation}\u0000${resource}`;
}
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
export function planPermissionMutation(latest, mutation) {
    const base = new Map();
    if (latest !== undefined) {
        for (const rule of latest.state.rules)
            base.set(pairKey(rule.operation, rule.resource), rule);
    }
    let changed = false;
    if (mutation.kind === 'revoke_permission') {
        for (const rule of mutation.rules) {
            const resource = renderPermissionResourceText(rule.matcher);
            const key = pairKey(rule.operationClass, resource);
            const standing = base.get(key);
            if (standing === undefined)
                continue; // revoking what never existed: contributes nothing
            if (standing.effect !== rule.effect) {
                refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'revoke-effect-mismatch', `the revoke carries effect ${JSON.stringify(rule.effect)} but the durable pair stands at ${JSON.stringify(standing.effect)} — read the current generation and address what actually stands (zero write)`, { operationClass: rule.operationClass, resource, carried: rule.effect, durable: standing.effect });
            }
            base.delete(key);
            changed = true;
        }
    }
    else {
        for (const rule of mutation.rules) {
            const resource = renderPermissionResourceText(rule.matcher);
            const key = pairKey(rule.operationClass, resource);
            const standing = base.get(key);
            if (standing !== undefined && standing.effect === rule.effect)
                continue; // identity at the pair
            base.set(key, deepFreeze({ operation: rule.operationClass, resource, effect: rule.effect }));
            changed = true;
        }
    }
    if (!changed)
        return { changed: false, reason: 'no-change' };
    if (base.size > MAX_RULES_BOUND) {
        refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'resulting-rule-set-over-bound', `the resulting snapshot would carry ${String(base.size)} rules; the structural bound is ${String(MAX_RULES_BOUND)}`, { bound: MAX_RULES_BOUND, resulting: base.size });
    }
    // Deterministic order (declaration order of the prior snapshot, then the
    // upserted new pairs): the full-snapshot bytes are a pure function of the
    // chain, so a byte-identical replay stays idempotent at the PR1 store.
    const rules = [...base.values()];
    return { changed: true, rules };
}
/** The PR1 structural rule-set bound (storage
 *  schema/permission-overlay.ts PERMISSION_OVERLAY_MAX_RULES). Imported as a
 *  VALUE it would join the storage runtime graph (a TYPE-only lane is the PR2
 *  discipline), so the bound is mirrored here and PINNED equal by the PR3
 *  spec — drift makes the pin red, which is the point. */
const MAX_RULES_BOUND = 256;
//# sourceMappingURL=permission-mutation.js.map