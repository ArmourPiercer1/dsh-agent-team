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
import { deepFreeze, toRemoteSafeDetail } from '../../contracts/src/index.js';
// The FROZEN resolver, imported from its OWN module rather than the lane
// barrel. This is load-order, not style: `admission/types.ts` imports this
// lane's barrel, and the barrel of `operation-permission` reaches the
// canonicalizer, which reaches back toward the admission surface — so taking
// the barrel here closes an initialization cycle and leaves `CALLER_ROLES`
// undefined at module-init time. The resolver module is a leaf (type-only
// imports), so this edge cannot cycle, and the reused kernel is literally the
// same function object the barrel re-exports.
import { resolveOperationPermission } from '../operation-permission/permission-resolver.js';
// ---------------------------------------------------------------------------
// The frozen layer vocabulary (ADR §4)
// ---------------------------------------------------------------------------
/** The permission layers, ASCENDING precedence (the ADR §4 order). */
/**
 * Frozen: `as const` is a type-level promise only, and this array IS the ADR §4
 * layer order — an in-place `.sort()` in any consumer would silently invert the
 * precedence for every other caller in the process.
 */
export const EFFECTIVE_PERMISSION_LAYERS = Object.freeze(['blueprint', 'template', 'overlay']);
/** The order the layers are consulted in: HIGHEST precedence first. */
export const EFFECTIVE_PERMISSION_LOOKUP_ORDER = Object.freeze([
    'overlay',
    'template',
    'blueprint',
]);
/** The numeric precedence of one layer (0 = lowest). */
export function effectivePermissionLayerPrecedence(layer) {
    return EFFECTIVE_PERMISSION_LAYERS.indexOf(layer);
}
/** The three lanes in the frozen same-layer priority order (ADR §4). */
const LANE_PRIORITY = Object.freeze(['deny', 'ask', 'allow']);
// ---------------------------------------------------------------------------
// The closed error surface (fail closed: ambiguity is refused, not decided)
// ---------------------------------------------------------------------------
/** The closed assembly error codes. */
export const EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES = Object.freeze({
    /** The assembly input itself is malformed (identity, layer shape). */
    ASSEMBLY_INPUT_MALFORMED: 'EFFECTIVE_PERMISSION_ASSEMBLY_INPUT_MALFORMED',
    /** An overlay snapshot belongs to another TeamSession / MemberInstance. */
    IDENTITY_MISMATCH: 'EFFECTIVE_PERMISSION_IDENTITY_MISMATCH',
    /** The current overlay authority is ambiguous (two claims on one generation). */
    AUTHORITY_CONFLICT: 'EFFECTIVE_PERMISSION_AUTHORITY_CONFLICT',
    /** A rule view claims an effect its snapshot rule does not carry. */
    OVERLAY_EFFECT_MISMATCH: 'EFFECTIVE_PERMISSION_OVERLAY_EFFECT_MISMATCH',
    /** A rule view does not address exactly one snapshot rule. */
    OVERLAY_RULE_REFERENCE_INVALID: 'EFFECTIVE_PERMISSION_OVERLAY_RULE_REFERENCE_INVALID',
    /** A canonical rule is structurally malformed. */
    RULE_MALFORMED: 'EFFECTIVE_PERMISSION_RULE_MALFORMED',
    /** A static layer or an overlay snapshot is structurally malformed. */
    LAYER_MALFORMED: 'EFFECTIVE_PERMISSION_LAYER_MALFORMED',
});
/** Every assembly error code value, for membership checks. */
export const EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODE_VALUES = Object.freeze(Object.values(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES));
/**
 * A typed assembly refusal. Branch on `code` + `details.problem`, never on the
 * message text. A refusal produces NO decision: the assembler never answers a
 * question it cannot attribute.
 */
export class EffectivePermissionAssemblyError extends Error {
    /** The closed error code. */
    code;
    /** Lossless context (never a live object reference the caller can mutate). */
    details;
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'EffectivePermissionAssemblyError';
        this.code = code;
        this.details = deepFreeze({ ...details });
    }
}
function refuse(code, problem, message, details = {}) {
    // `toRemoteSafeDetail` keeps the record lossless-JSON (the freeze inside the
    // error asserts it) and never leaks a live caller object into the error.
    throw new EffectivePermissionAssemblyError(code, `${message} (problem: ${problem})`, {
        problem,
        ...toRemoteSafeDetail(details),
    });
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
export function assembleEffectivePermissionPolicy(input) {
    const teamSessionId = requireIdentityField(input?.teamSessionId, 'teamSessionId');
    const memberInstanceId = requireIdentityField(input?.memberInstanceId, 'memberInstanceId');
    const layers = [];
    const blueprint = buildStaticLayer('blueprint', input.blueprint);
    if (blueprint !== undefined)
        layers.push(blueprint);
    const template = buildStaticLayer('template', input.template);
    if (template !== undefined)
        layers.push(template);
    const overlay = buildOverlayLayer(input.overlays ?? [], teamSessionId, memberInstanceId);
    if (overlay !== undefined)
        layers.push(overlay);
    // The effective fallback: the LOWEST layer that declares one. An overlay has
    // no fallback term, so a dynamic mutation can never move it.
    const declared = layers.find((layer) => layer.fallback !== null);
    const fallback = declared === undefined
        ? { layer: null, effect: 'deny' }
        : { layer: declared.kind, effect: declared.fallback };
    return deepFreeze({
        teamSessionId,
        memberInstanceId,
        layers: layers.map(toPolicyLayer),
        fallback,
    });
}
function toPolicyLayer(layer) {
    const labelPart = layer.label === undefined ? {} : { label: layer.label };
    const authorityPart = layer.authority === undefined ? {} : { authority: layer.authority };
    return {
        layer: layer.kind,
        precedence: layer.precedence,
        origin: layer.origin,
        ...labelPart,
        fallback: layer.fallback,
        rules: { allow: layer.lanes.allow, ask: layer.lanes.ask, deny: layer.lanes.deny },
        ruleCount: layer.lanes.allow.length + layer.lanes.ask.length + layer.lanes.deny.length,
        ...authorityPart,
    };
}
// ---------------------------------------------------------------------------
// Stage 2: the per-layer composition of the frozen resolver
// ---------------------------------------------------------------------------
/**
 * Resolve one canonical operation against an assembled policy (ADR §3 Stage 2
 * composition). The Alpha.2 resolver answers for every layer; the layer
 * precedence then picks the winner.
 *
 * @param policy - {@link assembleEffectivePermissionPolicy}'s output.
 * @param operation - the A2 canonical operation of this decision.
 * @returns the decision + provenance (deeply frozen).
 */
export function resolveEffectiveOperationPermission(policy, operation) {
    if (typeof operation?.resource?.key !== 'string' || operation.resource.key.length === 0) {
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.RULE_MALFORMED, 'operation-resource-key-missing', 'the canonical operation carries no resource key');
    }
    // Highest precedence first, by the FROZEN lookup order (the policy stores the
    // layers ascending).
    const ordered = [...policy.layers].sort((left, right) => EFFECTIVE_PERMISSION_LOOKUP_ORDER.indexOf(left.layer) -
        EFFECTIVE_PERMISSION_LOOKUP_ORDER.indexOf(right.layer));
    const outcomes = [];
    for (const layer of ordered) {
        outcomes.push(consultLayer(layer, operation));
    }
    const winnerIndex = outcomes.findIndex((outcome) => outcome.matched);
    const winner = winnerIndex === -1 ? undefined : outcomes[winnerIndex];
    const fallbackSource = { layer: policy.fallback.layer, effect: policy.fallback.effect };
    const identity = { teamSessionId: policy.teamSessionId, memberInstanceId: policy.memberInstanceId };
    const echo = { tool: String(operation.tool), fingerprint: String(operation.fingerprint) };
    if (winner === undefined || winner.winningProvenance === null) {
        // No layer matched: the lowest declared fallback answers, and no layer's
        // own `policy.default` is allowed to masquerade as the effective answer.
        return deepFreeze({
            ...identity,
            ...echo,
            decision: fallbackSource.effect,
            source: 'default',
            winningLayer: null,
            provenance: null,
            fallbackSource,
            layers: outcomes,
            overriddenLower: [],
            explanation: explainDefault(operation, fallbackSource, outcomes),
        });
    }
    const provenance = winner.winningProvenance;
    const overriddenLower = outcomes
        .slice(winnerIndex + 1)
        .filter((outcome) => outcome.winningProvenance !== null)
        .map((outcome) => outcome.winningProvenance);
    return deepFreeze({
        ...identity,
        ...echo,
        decision: provenance.lane,
        source: 'rule',
        winningLayer: winner.layer,
        provenance,
        fallbackSource,
        layers: outcomes,
        overriddenLower,
        explanation: explainRule(operation, provenance, outcomes, overriddenLower),
    });
}
/**
 * Assemble and resolve in one call — the shape a per-decision consumer wants
 * (the policy stays a first-class value, so it can be inspected on its own).
 */
export function assembleEffectivePermission(input, operation) {
    const policy = assembleEffectivePermissionPolicy(input);
    return { policy, decision: resolveEffectiveOperationPermission(policy, operation) };
}
/**
 * The policy argument of the frozen resolver, derived from the canonical lanes
 * this layer will actually be matched against.
 *
 * A3 reads ONLY `policy.default` from this argument (its lanes arrive as
 * `canonicalRules`) — the same observation the A3 spec records, which is why
 * its fixtures derive an A1-form policy from the canonical rules "to keep the
 * policy argument honest". This is that convention in production: the A1 view
 * is a lossless projection of the same rules (`key` / `rootKey` rendered into
 * the A1 `path` slot), it is never matched against anything, and it cannot
 * disagree with the lanes handed over as `canonicalRules`.
 */
function a1PolicyOf(fallback, lanes) {
    return {
        default: fallback ?? 'deny',
        allow: lanes.allow.map(toA1Rule),
        ask: lanes.ask.map(toA1Rule),
        deny: lanes.deny.map(toA1Rule),
    };
}
/** One canonical rule in its A1 shape (the resolver's policy argument only). */
function toA1Rule(rule) {
    if (rule.resource.kind === 'any') {
        return { tool: rule.tool, resource: { kind: 'any' } };
    }
    if (rule.resource.kind === 'subtree') {
        return { tool: rule.tool, resource: { kind: 'subtree', path: rule.resource.rootKey } };
    }
    return { tool: rule.tool, resource: { kind: 'exact', path: rule.resource.key } };
}
/**
 * ONE layer's own answer: the FROZEN resolver, called with this layer's
 * canonical lanes. Layer precedence lives in the CALL ORDER, not in the rule
 * sets — which is precisely why nothing here merges, wraps or re-implements the
 * matcher.
 */
function consultLayer(layer, operation) {
    const canonical = {
        allow: layer.rules.allow.map((entry) => entry.rule),
        ask: layer.rules.ask.map((entry) => entry.rule),
        deny: layer.rules.deny.map((entry) => entry.rule),
    };
    // `policy.default` is only the resolver's answer to "this layer matched
    // nothing"; the assembler discards it in that case (the effective fallback is
    // the whole-assembly question, decided from the declared layer fallbacks).
    const answer = resolveOperationPermission(a1PolicyOf(layer.fallback, canonical), operation, canonical);
    const matched = answer.provenance.source === 'rule';
    // Audit: which lanes of THIS layer matched. Each probe is the same frozen
    // resolver over a single populated lane, so the matcher is reused and never
    // duplicated.
    const matchedLanes = [];
    const empty = { allow: [], ask: [], deny: [] };
    for (const lane of LANE_PRIORITY) {
        const laneRules = canonical[lane];
        if (laneRules.length === 0)
            continue;
        const probed = { ...empty, [lane]: laneRules };
        const probe = resolveOperationPermission(a1PolicyOf('deny', probed), operation, probed);
        if (probe.provenance.source === 'rule')
            matchedLanes.push(lane);
    }
    const base = { layer: layer.layer, precedence: layer.precedence, matched, matchedLanes };
    const lane = answer.provenance.lane;
    const ruleIndex = answer.provenance.ruleIndex;
    if (!matched || lane === undefined || ruleIndex === undefined) {
        return { ...base, winningProvenance: null };
    }
    const entry = layer.rules[lane][ruleIndex];
    if (entry === undefined) {
        // Unreachable: the resolver indexed into the lane it was just handed.
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.RULE_MALFORMED, 'deciding-rule-index-unreachable', 'the resolver named an index this layer does not carry', { layer: layer.layer, lane, ruleIndex });
    }
    const labelPart = layer.label === undefined ? {} : { layerLabel: layer.label };
    const authorityPart = layer.authority === undefined ? {} : { overlayAuthority: layer.authority };
    const overlayRulePart = entry.overlayRule === undefined ? {} : { overlayRule: entry.overlayRule };
    return {
        ...base,
        winningProvenance: {
            layer: layer.layer,
            precedence: layer.precedence,
            ...labelPart,
            lane,
            ruleIndexInLane: ruleIndex,
            sourceIndex: entry.sourceIndex,
            rule: entry.rule,
            ...authorityPart,
            ...overlayRulePart,
        },
    };
}
// ---------------------------------------------------------------------------
// Explanation rendering (explainability without re-running anything)
// ---------------------------------------------------------------------------
function fmtProvenance(provenance) {
    const authority = provenance.overlayAuthority;
    const where = authority === undefined
        ? `${provenance.layer}${provenance.layerLabel === undefined ? '' : `(${provenance.layerLabel})`}`
        : `${provenance.layer}(snapshot=${authority.snapshotId}, generation=${String(authority.generation)}, mutation=${authority.mutationId}, actor=${authority.actor})`;
    return `${where} ${provenance.lane}[lane index ${String(provenance.ruleIndexInLane)}, source ${String(provenance.sourceIndex)}]`;
}
function fmtOutcomes(outcomes) {
    return outcomes.map((outcome) => `${outcome.layer}=${outcome.matched ? 'matched' : 'no-match'}`).join(', ');
}
function explainRule(operation, provenance, outcomes, overriddenLower) {
    const overridden = overriddenLower.length === 0 ? 'none' : overriddenLower.map((entry) => `${entry.layer} ${entry.lane}`).join(', ');
    return (`${String(operation.tool)}[${operation.resource.key}]: effective ${provenance.lane}; ` +
        `decided by ${fmtProvenance(provenance)}; ` +
        `layers (highest first): ${fmtOutcomes(outcomes)}; overridden lower: ${overridden}`);
}
function explainDefault(operation, fallbackSource, outcomes) {
    const source = fallbackSource.layer === null ? 'no layer declares a fallback (fail closed)' : `${fallbackSource.layer} fallback`;
    return (`${String(operation.tool)}[${operation.resource.key}]: effective ${fallbackSource.effect}; ` +
        `no layer matched; ${source}; layers (highest first): ${fmtOutcomes(outcomes)}`);
}
// ---------------------------------------------------------------------------
// Input validation (structural; semantics stay with the resolver and PR3)
// ---------------------------------------------------------------------------
function requireIdentityField(value, field) {
    if (typeof value !== 'string' || value.length === 0) {
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.ASSEMBLY_INPUT_MALFORMED, 'assembly-identity-malformed', `EffectivePermissionAssemblyInput.${field} must be a non-empty string`, { field });
    }
    return value;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Validate one static layer and put its rules into the resolver's lanes. */
function buildStaticLayer(kind, layer) {
    if (layer === undefined)
        return undefined;
    if (!isRecord(layer)) {
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.LAYER_MALFORMED, 'layer-not-a-record', `the ${kind} permission layer must be a record`, { layer: kind });
    }
    const declaredDefault = layer['default'];
    if (declaredDefault !== 'ask' && declaredDefault !== 'deny') {
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.LAYER_MALFORMED, 'layer-default-outside-closed-set', `the ${kind} permission layer default must be 'ask' or 'deny' (the A1 vocabulary)`, { layer: kind, found: typeof declaredDefault });
    }
    const label = layer['label'];
    if (label !== undefined && (typeof label !== 'string' || label.length === 0)) {
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.LAYER_MALFORMED, 'layer-label-malformed', `the ${kind} permission layer label must be a non-empty string when present`, { layer: kind });
    }
    const rules = layer['rules'];
    if (!isRecord(rules)) {
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.LAYER_MALFORMED, 'layer-rules-not-a-record', `the ${kind} permission layer rules must be a record of the three lanes`, { layer: kind });
    }
    const lanes = { allow: [], ask: [], deny: [] };
    for (const lane of LANE_PRIORITY) {
        const laneRules = rules[lane];
        if (!Array.isArray(laneRules)) {
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.LAYER_MALFORMED, 'layer-lane-not-an-array', `the ${kind} permission layer lane '${lane}' must be an array of rules`, { layer: kind, lane });
        }
        laneRules.forEach((raw, index) => {
            lanes[lane].push({
                lane,
                // The lane-local declaration index: the same address the resolver
                // reports as `ruleIndex`, kept as this layer's own source address.
                sourceIndex: index,
                rule: validateCanonicalRule(raw, { layer: kind, lane, index }),
            });
        });
    }
    return {
        kind,
        precedence: effectivePermissionLayerPrecedence(kind),
        origin: 'static',
        label: typeof label === 'string' ? label : undefined,
        fallback: declaredDefault,
        lanes,
        authority: undefined,
    };
}
/**
 * Validate the overlay snapshots and build the dynamic layer from the
 * HIGHEST generation only (ADR §2: current authority is the highest generation,
 * history is audit-only, no replay).
 */
function buildOverlayLayer(overlays, teamSessionId, memberInstanceId) {
    if (overlays.length === 0)
        return undefined;
    const byGeneration = new Map();
    for (const entry of overlays) {
        if (!isRecord(entry)) {
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.LAYER_MALFORMED, 'overlay-layer-not-a-record', 'an overlay layer must be a record of { snapshot, rules }');
        }
        const snapshot = validateOverlaySnapshot(entry['snapshot']);
        if (snapshot.identity.teamSessionId !== teamSessionId ||
            snapshot.identity.memberInstanceId !== memberInstanceId) {
            // MemberInstance isolation, fail closed. Silently dropping a foreign
            // snapshot would answer the caller's question about instance A with
            // instance B's authority — a cross-instance leak dressed up as a policy.
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.IDENTITY_MISMATCH, 'overlay-identity-mismatch', 'a PermissionOverlaySnapshot does not belong to the assembled MemberInstance', {
                expected: { teamSessionId, memberInstanceId },
                found: {
                    teamSessionId: snapshot.identity.teamSessionId,
                    memberInstanceId: snapshot.identity.memberInstanceId,
                },
                snapshotId: snapshot.snapshotId,
            });
        }
        const views = validateOverlayViews(snapshot, entry['rules']);
        const existing = byGeneration.get(snapshot.metadata.generation);
        if (existing === undefined) {
            byGeneration.set(snapshot.metadata.generation, { snapshot, views });
            continue;
        }
        // The derived snapshotId cannot tell two same-generation rows apart (it is
        // a function of the identity + generation), so the row CONTENT decides
        // whether this is the same authority read twice or two claims on one slot.
        if (JSON.stringify(existing.snapshot) !== JSON.stringify(snapshot)) {
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.AUTHORITY_CONFLICT, 'generation-claims-two-snapshots', `two different PermissionOverlaySnapshots claim generation ${String(snapshot.metadata.generation)}`, {
                generation: snapshot.metadata.generation,
                snapshotIds: [existing.snapshot.snapshotId, snapshot.snapshotId],
            });
        }
        // The identical durable row supplied twice is the same authority (an
        // idempotent read). A second copy that interprets it differently is not.
        //
        // The comparison is CONTENT-sensitive and ORDER-insensitive, because order
        // carries no meaning here: the lane contents are normalized to the
        // snapshot's own declaration order before they reach the matcher, so two
        // view lists that map each snapshot row onto the same canonical rule are the
        // same interpretation even if the caller iterated its canonicalization map
        // the other way round. Comparing the raw arrays instead would report a
        // purely cosmetic difference as an irreconcilable authority conflict.
        // `ruleIndex` is unique per view list (duplicates are refused above), so
        // sorting by it is a canonical form.
        if (canonicalViewKey(existing.views) !== canonicalViewKey(views)) {
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.AUTHORITY_CONFLICT, 'overlay-authority-view-mismatch', `the snapshot of generation ${String(snapshot.metadata.generation)} was supplied twice with different canonical rule views`, { generation: snapshot.metadata.generation, snapshotId: snapshot.snapshotId });
        }
    }
    let authority;
    for (const claim of byGeneration.values()) {
        if (authority === undefined || claim.snapshot.metadata.generation > authority.snapshot.metadata.generation) {
            authority = claim;
        }
    }
    if (authority === undefined)
        return undefined;
    const snapshot = authority.snapshot;
    // Deterministic lane order: the snapshot's own declaration order, never the
    // order the caller happened to hand the views over in.
    const orderedViews = [...authority.views].sort((left, right) => left.ruleIndex - right.ruleIndex);
    const lanes = { allow: [], ask: [], deny: [] };
    for (const view of orderedViews) {
        const carrier = snapshot.state.rules[view.ruleIndex];
        if (carrier === undefined)
            continue; // unreachable: validateOverlayViews checked
        lanes[view.lane].push({
            lane: view.lane,
            sourceIndex: view.ruleIndex,
            rule: view.rule,
            overlayRule: { operation: carrier.operation, resource: carrier.resource },
        });
    }
    return {
        kind: 'overlay',
        precedence: effectivePermissionLayerPrecedence('overlay'),
        origin: 'overlay',
        label: undefined,
        // An overlay snapshot has no fallback term (ADR §2): the dynamic layer can
        // only ever add rules, never move the assembly's default.
        fallback: null,
        lanes,
        authority: {
            snapshotId: snapshot.snapshotId,
            generation: snapshot.metadata.generation,
            previousSnapshotId: snapshot.metadata.previousSnapshotId,
            actor: snapshot.provenance.actor,
            mutationId: snapshot.provenance.mutationId,
            timestamp: snapshot.provenance.timestamp,
            reason: snapshot.provenance.reason,
        },
    };
}
/**
 * The structural minimum needed to READ a snapshot's authority sections. Deep
 * validation is PR1's boundary (`createPermissionOverlaySnapshot` /
 * `parsePermissionOverlaySnapshot` already ran on every durable row); this only
 * guarantees the reads cannot invent an authority — it never re-decides what
 * PR1 decided, and it never relaxes a PR1 refusal.
 *
 * The record is REBUILT from the validated sections (never the caller's object
 * graph), so the authority the provenance quotes is data this function has
 * actually seen.
 */
function validateOverlaySnapshot(value) {
    const record = requireSection(value, 'the snapshot itself');
    const snapshotId = requireString(record, 'snapshotId', 'snapshotId');
    const schemaVersion = record['schemaVersion'];
    if (typeof schemaVersion !== 'number') {
        throw snapshotMalformed('schemaVersion must be a number');
    }
    const identity = requireSection(record['identity'], 'identity');
    const teamSessionId = requireString(identity, 'teamSessionId', 'identity.teamSessionId');
    const memberInstanceId = requireString(identity, 'memberInstanceId', 'identity.memberInstanceId');
    const state = requireSection(record['state'], 'state');
    const rawRules = state['rules'];
    if (!Array.isArray(rawRules)) {
        throw snapshotMalformed('state.rules must be an array');
    }
    const metadata = requireSection(record['metadata'], 'metadata');
    const generation = metadata['generation'];
    if (typeof generation !== 'number' || !Number.isSafeInteger(generation)) {
        throw snapshotMalformed('metadata.generation must be a safe integer');
    }
    const previousSnapshotId = metadata['previousSnapshotId'];
    if (previousSnapshotId !== null && typeof previousSnapshotId !== 'string') {
        throw snapshotMalformed('metadata.previousSnapshotId must be a string or null');
    }
    const provenance = requireSection(record['provenance'], 'provenance');
    const actor = requireString(provenance, 'actor', 'provenance.actor');
    const mutationId = requireString(provenance, 'mutationId', 'provenance.mutationId');
    const timestamp = requireString(provenance, 'timestamp', 'provenance.timestamp');
    const reason = requireString(provenance, 'reason', 'provenance.reason');
    const rules = rawRules.map((raw, index) => {
        const position = `state.rules[${String(index)}]`;
        const rule = requireSection(raw, position);
        return {
            operation: requireString(rule, 'operation', `${position}.operation`),
            resource: requireString(rule, 'resource', `${position}.resource`),
            effect: requireEffect(rule['effect'], `${position}.effect`),
        };
    });
    return {
        schemaVersion,
        snapshotId,
        identity: { teamSessionId, memberInstanceId },
        state: { rules },
        metadata: { generation, previousSnapshotId },
        provenance: { actor, mutationId, timestamp, reason },
    };
}
function snapshotMalformed(detail) {
    return new EffectivePermissionAssemblyError(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.LAYER_MALFORMED, `a PermissionOverlaySnapshot is malformed: ${detail} (problem: overlay-snapshot-malformed)`, { problem: 'overlay-snapshot-malformed', detail });
}
function requireSection(value, detail) {
    if (!isRecord(value)) {
        throw snapshotMalformed(`${detail} must be a record`);
    }
    return value;
}
function requireString(record, key, detail) {
    const value = record[key];
    if (typeof value !== 'string') {
        throw snapshotMalformed(`${detail} must be a string`);
    }
    return value;
}
function requireEffect(value, detail) {
    if (value !== 'allow' && value !== 'ask' && value !== 'deny') {
        throw snapshotMalformed(`${detail} must be one of allow | ask | deny`);
    }
    return value;
}
/**
 * The views must account for the snapshot's rule rows EXACTLY: each view
 * addresses one row and carries its effect (checked per view below), no row is
 * addressed twice, and every row is addressed at all (the coverage check at the
 * end). `views.length === rules.length` plus per-view uniqueness and in-range
 * indices is therefore a bijection onto the durable rows: the assembled dynamic
 * layer always corresponds to the FULL authority snapshot.
 */
/** A canonical, order-independent key for one layer's view list (see above). */
function canonicalViewKey(views) {
    return JSON.stringify([...views].sort((left, right) => left.ruleIndex - right.ruleIndex));
}
function validateOverlayViews(snapshot, value) {
    if (!Array.isArray(value)) {
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.LAYER_MALFORMED, 'overlay-rules-not-an-array', 'an overlay layer rule view list must be an array', { snapshotId: snapshot.snapshotId });
    }
    const seen = new Set();
    const views = [];
    for (const raw of value) {
        if (!isRecord(raw)) {
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.RULE_MALFORMED, 'overlay-rule-view-not-a-record', 'an overlay rule view must be a record', { snapshotId: snapshot.snapshotId });
        }
        const ruleIndex = raw['ruleIndex'];
        if (typeof ruleIndex !== 'number' || !Number.isSafeInteger(ruleIndex) || ruleIndex < 0) {
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.OVERLAY_RULE_REFERENCE_INVALID, 'overlay-rule-index-not-an-index', 'an overlay rule view must address a snapshot rule by a non-negative integer index', { snapshotId: snapshot.snapshotId, ruleIndex: typeof ruleIndex });
        }
        if (ruleIndex >= snapshot.state.rules.length) {
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.OVERLAY_RULE_REFERENCE_INVALID, 'overlay-rule-index-out-of-range', `the overlay rule view addresses rule ${String(ruleIndex)} but the snapshot carries ${String(snapshot.state.rules.length)} rules`, { snapshotId: snapshot.snapshotId, ruleIndex });
        }
        if (seen.has(ruleIndex)) {
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.OVERLAY_RULE_REFERENCE_INVALID, 'overlay-rule-index-duplicate', `the overlay rule view lists snapshot rule ${String(ruleIndex)} more than once (the lane membership would be ambiguous)`, { snapshotId: snapshot.snapshotId, ruleIndex });
        }
        seen.add(ruleIndex);
        const carrier = snapshot.state.rules[ruleIndex];
        const claimed = raw['lane'];
        if (claimed !== carrier.effect) {
            // The EFFECT of a dynamic rule is durable snapshot data, never caller
            // input: a view may not relabel a deny as an allow (or anything else).
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.OVERLAY_EFFECT_MISMATCH, 'overlay-effect-mismatch', `the overlay rule view for snapshot rule ${String(ruleIndex)} claims lane '${String(claimed)}' but the snapshot rule carries effect '${carrier.effect}'`, { snapshotId: snapshot.snapshotId, ruleIndex, claimed: String(claimed), durable: carrier.effect });
        }
        views.push({
            ruleIndex,
            lane: carrier.effect,
            rule: validateCanonicalRule(raw['rule'], { layer: 'overlay', lane: carrier.effect, index: ruleIndex }),
        });
    }
    // COVERAGE: the views must account for EVERY rule row of the authority
    // snapshot — no more (duplicates and out-of-range are refused above) and no
    // less. A short view list is not a smaller overlay, it is a TRUNCATED reading
    // of a durable FULL snapshot: the rows it omits would silently stop applying,
    // which is the same family of defect design §3.1 forbids (the effective view
    // stops corresponding to the authority) and it fails in the unsafe direction —
    // dropping one `deny` row turns the answer into a lower layer's `allow` while
    // the decision still reports `winningLayer: 'overlay'`. An empty rule set is
    // legal ONLY when the snapshot itself is empty (`0` views for `0` rows): the
    // rule that stops applying has to have been removed durably, by a higher
    // generation, not by the caller leaving a row out.
    if (views.length !== snapshot.state.rules.length) {
        const missing = [];
        for (let index = 0; index < snapshot.state.rules.length; index += 1) {
            if (!seen.has(index))
                missing.push(index);
        }
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.OVERLAY_RULE_REFERENCE_INVALID, 'overlay-rule-view-incomplete', `the overlay rule view of ${snapshot.snapshotId} addresses ${String(views.length)} of the ${String(snapshot.state.rules.length)} rules its snapshot carries (missing rule indexes ${missing
            .map((index) => String(index))
            .join(', ')}); a FULL snapshot is read in full — a rule that must stop applying is superseded by a later generation, never by an omitted view`, {
            snapshotId: snapshot.snapshotId,
            generation: snapshot.metadata.generation,
            snapshotRuleCount: snapshot.state.rules.length,
            viewCount: views.length,
            missingRuleIndexes: missing,
        });
    }
    return views;
}
/**
 * The structural gate on one canonical rule (the matcher's input contract). The
 * matcher itself is NOT here: this only guarantees the shape the frozen Alpha.2
 * matcher indexes into, and it copies the rule so the assembled output never
 * aliases the caller's object.
 *
 * Note the `tool` term is only checked to be a non-empty token: the closed
 * `PermissionTool` vocabulary is the A1 blueprint schema's authority for static
 * rules, and an overlay rule's `operation` is an operation-class token (design
 * §4) whose grammar is PR3's — a token outside the tool vocabulary simply never
 * matches, exactly as the frozen matcher already behaves.
 */
function validateCanonicalRule(value, context) {
    const where = { ...context };
    if (!isRecord(value)) {
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.RULE_MALFORMED, 'rule-not-a-record', 'a canonical permission rule must be a record', where);
    }
    const tool = value['tool'];
    if (typeof tool !== 'string' || tool.length === 0) {
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.RULE_MALFORMED, 'rule-tool-missing', 'a canonical permission rule must name a tool', where);
    }
    const named = tool;
    const resource = value['resource'];
    if (!isRecord(resource)) {
        throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.RULE_MALFORMED, 'rule-resource-missing', 'a canonical permission rule must carry a resource', where);
    }
    const kind = resource['kind'];
    if (kind === 'any') {
        return { tool: named, resource: { kind: 'any' } };
    }
    if (kind === 'exact') {
        const key = resource['key'];
        if (typeof key !== 'string' || key.length === 0) {
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.RULE_MALFORMED, 'rule-exact-key-empty', 'an exact canonical rule must carry a non-empty canonical key', where);
        }
        return { tool: named, resource: { kind: 'exact', key } };
    }
    if (kind === 'subtree') {
        const rootKey = resource['rootKey'];
        if (typeof rootKey !== 'string' || rootKey.length === 0) {
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.RULE_MALFORMED, 'rule-subtree-root-key-empty', 'a subtree canonical rule must carry a non-empty rootKey (provenance only)', where);
        }
        const containsOperation = resource['containsOperation'];
        if (typeof containsOperation !== 'boolean') {
            // Containment is the A5 seam's verdict (the pinned `FileSystem.contains`,
            // fresh per decision). An absent verdict is NOT read as `false`: that
            // would be the assembler inventing a match outcome.
            throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.RULE_MALFORMED, 'rule-subtree-containment-not-a-boolean', 'a subtree canonical rule must carry the operation-relative containsOperation boolean', where);
        }
        return { tool: named, resource: { kind: 'subtree', rootKey, containsOperation } };
    }
    throw refuse(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES.RULE_MALFORMED, 'rule-resource-kind-unknown', `a canonical permission rule resource kind must be exact | subtree | any, got ${JSON.stringify(kind)}`, where);
}
//# sourceMappingURL=permission-assembler.js.map