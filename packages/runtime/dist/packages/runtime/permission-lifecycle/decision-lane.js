/**
 * The PR4 permission-lifecycle DECISION lane — the execution read plane.
 *
 * ADR §8 makes the lifecycle an EXECUTION question, not a storage question:
 *
 *     RUNNING   — overlay effective
 *     ARCHIVED  — overlay retained; execution disabled
 *     DISPOSED  — overlay historical only; never effective
 *     new instance — no inheritance
 *
 * This lane is where those sentences become code, in the only order the
 * architecture allows:
 *
 *   1. IDENTITY / LIFECYCLE GATE — the durable MemberInstance state, read
 *      BEFORE any permission fact is consulted. An ARCHIVED instance keeps its
 *      overlay while EXECUTION is refused; a DISPOSED instance's overlay is
 *      historical and therefore never effective; an instance with no row is
 *      its OWN state (`undefined`) — never RUNNING, never ARCHIVED. The gate
 *      refuses execution; it never deletes, rewrites or archives anything
 *      (that is the lifecycle path's job, not the read plane's).
 *   2. THE CURRENT AUTHORITY — `overlay.latest()` (ADR §2: the highest
 *      generation IS the authority — never a fold, never a replay of history).
 *      A NEW MemberInstance has no rows at all: that is "no inheritance", and
 *      it is structural (the port reads per `(teamSessionId,
 *      memberInstanceId)`), not a rule this lane has to remember.
 *   3. THE MERGED PURE READ PLANE (ADR §3) — this lane implements NO
 *      precedence of its own:
 *        - FILESPACE (`read` / `write` / `edit` / `read_image` / `lsp`): PR2's
 *          `assembleEffectivePermission` — Stage 1 assembly (blueprint <
 *          template < overlay, one FULL canonical view per snapshot rule) and
 *          Stage 2, which calls the FROZEN Alpha.2 `resolveOperationPermission`
 *          per layer. The static layers arrive ALREADY CANONICAL from the
 *          decision site (the A3 input contract; H4: canonicalization is
 *          per-decision, so it cannot be done here and is never cached), and
 *          an overlay `subtree` rule carries the per-decision containment
 *          boolean the decision site computed.
 *        - EXECSPACE (`bash` / `pwsh`): the governance kernel's exported pure
 *          effective-answer algebra over the EXACT fingerprint region — the
 *          very function the mutation authority uses to decide what a mutation
 *          changes, exported by PR3 for reuse and pinned against the merged
 *          assembler's layer rules by `a3p3-effective-parity`. It is used here
 *          because the frozen Alpha.2 matcher is structurally exact-on-FILE
 *          keys: `ruleMatches` answers `false` for every non-`file` resource
 *          that is not `any` ("an `exact` key is a file key and can never
 *          equal the tool-level key", plan §4). A `fingerprint:` overlay rule
 *          therefore CANNOT be expressed as a `CanonicalRule` at all: the
 *          choices were to silently drop a durable exec rule, to
 *          re-implement precedence here, or to reuse the merged algebra. The
 *          third is what this does, and a fingerprint region needs no
 *          containment predicate — design §5's exact-identity-only, exactly
 *          as the parent ruling requires for exact/fingerprint contexts.
 *
 * Unknown never answers (the ruling PR3 established and this lane inherits):
 * - no static facts from the decision site -> typed refusal (UNKNOWN is never
 *   conflated with a declared-none `{ layers: [] }` baseline);
 * - a carrier the decoder cannot read, or an operation token outside the
 *   closed tool vocabulary -> typed refusal (dropping a rule would silently
 *   retire a durable deny);
 * - an overlay `subtree` rule this decision cannot judge -> the FROZEN
 *   Alpha.2 lane asymmetry, verbatim: a `deny`/`ask` rule is never dropped
 *   (treated as matching, fail closed) and an `allow` rule is never assumed
 *   (treated as not matching) — the positive `false` from the seam is a
 *   DECIDED non-match and needs no fallback;
 * - a kernel answer of `context-unavailable` -> typed refusal.
 *
 * Pure by construction: zero `node:` builtins, zero I/O of its own, no clock,
 * no randomness. Every durable fact arrives through an injected port.
 *
 * @module @dsh-agent-team/runtime/permission-lifecycle/decision-lane
 */
import { FILE_PERMISSION_TOOL_VALUES, SHELL_PERMISSION_TOOL_VALUES } from '../operation-permission/types.js';
import { assembleEffectivePermission, } from '../effective-policy/permission-assembler.js';
import { PERMISSION_LIFECYCLE_ERROR_CODES, PermissionLifecycleError } from './types.js';
/** The closed shell class (the leaf vocabulary — the kernel's own source). */
const EXEC_CLASS = SHELL_PERMISSION_TOOL_VALUES;
/** The closed file class (the leaf vocabulary). */
const FILE_CLASS = FILE_PERMISSION_TOOL_VALUES;
/**
 * The ADR §8 execution gate as a pure function of the durable lifecycle
 * state. Exported so a spec can pin all five states (and the unknown state)
 * directly, without a world.
 */
export function evaluatePermissionLifecycleGate(state) {
    switch (state) {
        case 'CREATED':
        case 'RUNNING':
        case 'SETTLED':
            return { allowed: true, state };
        case 'ARCHIVED':
            return {
                allowed: false,
                state: 'ARCHIVED',
                code: PERMISSION_LIFECYCLE_ERROR_CODES.EXECUTION_ARCHIVED,
                reason: 'the MemberInstance is ARCHIVED: its overlay is RETAINED but execution is DISABLED (ADR §8) — no permission fact is consulted and nothing is rewritten',
            };
        case 'DISPOSED':
            return {
                allowed: false,
                state: 'DISPOSED',
                code: PERMISSION_LIFECYCLE_ERROR_CODES.EXECUTION_TERMINAL,
                reason: 'the MemberInstance is DISPOSED: its overlay is HISTORICAL ONLY and never effective (ADR §8)',
            };
        default:
            return {
                allowed: false,
                state: undefined,
                code: PERMISSION_LIFECYCLE_ERROR_CODES.EXECUTION_STATE_UNKNOWN,
                reason: 'the MemberInstance lifecycle is UNKNOWN (no durable row in this TeamSession): unknown is never treated as RUNNING and never as ARCHIVED, so nothing executes',
            };
    }
}
/** The operation class of one tool token (the kernel's fs/exec/unknown split). */
function operationClassOf(tool) {
    if (EXEC_CLASS.includes(tool))
        return 'exec';
    if (FILE_CLASS.includes(tool))
        return 'fs';
    return 'unknown';
}
/** One `CanonicalRule` -> the kernel's whole-matcher shape (identity only). */
function canonicalRuleMatcher(rule) {
    if (rule.resource.kind === 'any')
        return { kind: 'any' };
    if (rule.resource.kind === 'exact')
        return { kind: 'exact', resource: rule.resource.key };
    return { kind: 'subtree', resource: rule.resource.rootKey };
}
/**
 * Project the decision site's ALREADY-CANONICAL static layers onto the
 * kernel's static-facts vocabulary (the exec plane's lower layers). A shape
 * conversion only: every canonical identity rides verbatim, declaration order
 * is preserved, no judgement is added or removed, and NO layer is invented —
 * an empty input stays an empty input (`DECLARED-NONE`).
 */
export function toKernelStaticFacts(layers) {
    return {
        layers: layers.map((layer) => ({
            ...(layer.label === undefined ? {} : { label: layer.label }),
            default: layer.default,
            rules: [
                ...layer.rules.deny.map((rule) => ({
                    operationClass: rule.tool,
                    matcher: canonicalRuleMatcher(rule),
                    effect: 'deny',
                })),
                ...layer.rules.ask.map((rule) => ({
                    operationClass: rule.tool,
                    matcher: canonicalRuleMatcher(rule),
                    effect: 'ask',
                })),
                ...layer.rules.allow.map((rule) => ({
                    operationClass: rule.tool,
                    matcher: canonicalRuleMatcher(rule),
                    effect: 'allow',
                })),
            ],
        })),
    };
}
/**
 * The frozen Alpha.2 lane asymmetry for an UNJUDGED subtree rule (P1-3 / H2):
 * a rule the decision cannot judge in the deny/ask lane is never dropped (it
 * keeps restricting — fail closed); a rule it cannot judge in the allow lane
 * is never assumed (a grant is never invented). A positive `false` from the
 * seam is a DECIDED non-match, not an unknown.
 */
export function containmentFallback(verdict, effect) {
    if (verdict === false)
        return false;
    return effect !== 'allow';
}
/**
 * Build the decision lane (see the module doc for the plane split and the
 * unknown-states).
 */
export function createPermissionDecisionLane(deps) {
    const decide = async (request) => {
        const { teamSessionId, memberInstanceId, operation } = request;
        // (1) the ADR §8 gate — before any permission fact is read.
        const state = await deps.members.readLifecycle(teamSessionId, memberInstanceId);
        const gate = evaluatePermissionLifecycleGate(state);
        if (gate.allowed === false) {
            return { kind: 'refused', code: gate.code, reason: gate.reason, lifecycleState: gate.state };
        }
        // (2) the decision site's static facts (UNKNOWN is a real state).
        const staticFacts = request.staticFacts;
        if (staticFacts === undefined) {
            return {
                kind: 'refused',
                code: PERMISSION_LIFECYCLE_ERROR_CODES.STATIC_FACTS_UNKNOWN,
                reason: 'the decision site supplied NO static permission facts: UNKNOWN lower layers are never conflated with a declared-none baseline, so no effective answer is reported',
                lifecycleState: gate.state,
            };
        }
        const staticLayers = [
            ...(staticFacts.blueprint === undefined ? [] : [staticFacts.blueprint]),
            ...(staticFacts.template === undefined ? [] : [staticFacts.template]),
        ];
        // (3) the current authority (ADR §2 — latest, never a replay).
        const snapshot = await deps.overlay.latest({ teamSessionId, memberInstanceId });
        const overlayGeneration = snapshot === undefined ? null : snapshot.metadata.generation;
        const operationClass = operationClassOf(operation.tool);
        if (operationClass === 'unknown') {
            // The A5 adapter classifies the tool BEFORE entering this plane; an
            // unknown token here is a contract violation, and the only safe answer
            // to a contract violation is a refusal (never a pass-through).
            return {
                kind: 'refused',
                code: PERMISSION_LIFECYCLE_ERROR_CODES.OVERLAY_VIEW_UNDECODABLE,
                reason: `the operation class ${JSON.stringify(operation.tool)} is outside the closed permission-tool vocabulary`,
                lifecycleState: gate.state,
                details: { tool: operation.tool },
            };
        }
        // (4a) the execspace plane: the kernel's algebra over the fingerprint
        // region (design §5 — exact identity, no subtree, no `any`, no predicate).
        if (operationClass === 'exec') {
            return decideExec({ deps, snapshot, staticLayers, operation, gate, overlayGeneration });
        }
        // (4b) the filespace plane: the merged assembler + the frozen resolver.
        // The subtree verdicts are awaited BEFORE the pure kernel runs (the
        // parent ruling on the async boundary): the outer layer may await the
        // real provider, and the assembler/resolver then receive THIS round's
        // identity-bound, read-only canonical facts — sync, pure, unchanged.
        const overlays = snapshot === undefined
            ? []
            : [{ snapshot, rules: await buildOverlayViews(snapshot, deps.decodeResource, request.containment, operation) }];
        try {
            const { decision } = assembleEffectivePermission({
                teamSessionId,
                memberInstanceId,
                ...(staticFacts.blueprint === undefined ? {} : { blueprint: staticFacts.blueprint }),
                ...(staticFacts.template === undefined ? {} : { template: staticFacts.template }),
                overlays,
            }, operation);
            return {
                kind: 'effective',
                plane: 'file',
                effect: decision.decision,
                source: decision.source,
                winningLayer: (decision.winningLayer ?? null),
                explanation: decision.explanation,
                lifecycleState: gate.state,
                overlayGeneration,
                effective: decision,
            };
        }
        catch (error) {
            if (error instanceof PermissionLifecycleError)
                throw error;
            // The assembler refuses ambiguity (a foreign snapshot, an incomplete
            // view, a malformed section). It is never guessed around.
            throw new PermissionLifecycleError(PERMISSION_LIFECYCLE_ERROR_CODES.ASSEMBLY_FAILED, `the effective permission assembly refused this decision: ${error instanceof Error ? error.message : String(error)}`, { teamSessionId, memberInstanceId });
        }
    };
    return Object.freeze({ decide });
}
/** The execspace plane of one decision (see the module doc). */
function decideExec(input) {
    const answer = input.deps.effectiveAnswer === undefined
        ? undefined
        : input.deps.effectiveAnswer({
            // The snapshot's OWN carrier rules, verbatim — the kernel parses the
            // carrier itself, so this lane never re-renders the grammar.
            overlayRules: (input.snapshot?.state.rules ?? []),
            staticFacts: toKernelStaticFacts(input.staticLayers),
            operationClass: input.operation.tool,
            region: { kind: 'fingerprint', resource: input.operation.fingerprint },
        });
    if (answer === undefined) {
        return {
            kind: 'refused',
            code: PERMISSION_LIFECYCLE_ERROR_CODES.EXEC_PLANE_UNAVAILABLE,
            reason: 'the exec (fingerprint) decision plane is not wired: a fingerprint overlay rule cannot be expressed in the frozen Alpha.2 matcher (an exact key is a FILE key), and this lane never re-implements precedence',
            lifecycleState: input.gate.state,
            details: { tool: input.operation.tool },
        };
    }
    if (answer.status === 'context-unavailable') {
        return {
            kind: 'refused',
            code: PERMISSION_LIFECYCLE_ERROR_CODES.STATIC_FACTS_UNKNOWN,
            reason: 'the governance kernel could not answer this exec region from the facts of this round (unknown coverage or unknown lower layers): unknown never answers',
            lifecycleState: input.gate.state,
        };
    }
    const winningLayer = answer.source === 'overlay' ? 'overlay' : answer.source === 'layer' ? 'template' : null;
    return {
        kind: 'effective',
        plane: 'exec',
        effect: answer.effect,
        source: answer.source === 'fallback' ? 'default' : 'rule',
        winningLayer,
        explanation: `exec fingerprint ${input.operation.fingerprint} answered ${answer.effect} from the ${answer.source}`,
        lifecycleState: input.gate.state,
        overlayGeneration: input.overlayGeneration,
    };
}
/**
 * One FULL canonical view per snapshot rule (the assembler refuses a short
 * list — an omitted view would silently retire a durable rule). A rule of a
 * DIFFERENT operation class is still interpreted and simply never matches
 * (the frozen matcher checks the tool first), so the overlay layer keeps
 * being a FULL reading of the authority snapshot.
 */
async function buildOverlayViews(snapshot, decodeResource, containment, operation) {
    const views = [];
    for (const [ruleIndex, rule] of snapshot.state.rules.entries()) {
        const matcher = decodeResource(rule.resource);
        if (matcher === undefined) {
            throw new PermissionLifecycleError(PERMISSION_LIFECYCLE_ERROR_CODES.OVERLAY_VIEW_UNDECODABLE, `overlay rule ${String(ruleIndex)} carries a resource the carrier grammar cannot decode (${JSON.stringify(rule.resource)}): a rule is never silently dropped`, { ruleIndex, resource: rule.resource });
        }
        if (!EXEC_CLASS.includes(rule.operation) && !FILE_CLASS.includes(rule.operation)) {
            throw new PermissionLifecycleError(PERMISSION_LIFECYCLE_ERROR_CODES.OVERLAY_VIEW_UNDECODABLE, `overlay rule ${String(ruleIndex)} addresses operation class ${JSON.stringify(rule.operation)}, outside the closed permission-tool vocabulary`, { ruleIndex, operationClass: rule.operation });
        }
        const tool = rule.operation;
        // Awaited here (never inside the kernel): the verdict is THIS round's.
        const verdict = matcher.kind === 'subtree' && containment !== undefined
            ? await containment(matcher.resource, { tool: operation.tool, key: operation.resource.key })
            : undefined;
        views.push({
            ruleIndex,
            lane: rule.effect,
            rule: canonicalOverlayRule({ matcher, tool, effect: rule.effect, verdict, operation }),
        });
    }
    return views;
}
/** The carrier matcher -> the canonical matcher of THIS decision. */
function canonicalOverlayRule(input) {
    const { matcher, tool, effect, verdict } = input;
    if (matcher.kind === 'exact') {
        return { tool, resource: { kind: 'exact', key: matcher.resource } };
    }
    if (matcher.kind === 'fingerprint') {
        // Reachable only for a rule of the OTHER class (an exec rule seen by a
        // file decision, or vice versa): the tool check makes it inert, and
        // projecting it verbatim keeps the overlay layer a FULL reading instead
        // of a silent drop.
        return { tool, resource: { kind: 'exact', key: matcher.resource } };
    }
    // subtree: the operation-relative verdict of THIS decision (H4 — fresh per
    // decision, never cached), with the frozen lane asymmetry on unknown.
    const containsOperation = verdict === true ? true : containmentFallback(verdict, effect);
    return { tool, resource: { kind: 'subtree', rootKey: matcher.resource, containsOperation } };
}
//# sourceMappingURL=decision-lane.js.map