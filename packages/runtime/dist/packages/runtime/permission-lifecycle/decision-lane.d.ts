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
import type { EffectivePermissionStaticLayer } from '../effective-policy/permission-assembler.js';
import type { PermissionDecisionLane, PermissionDecisionLaneDeps, PermissionKernelStaticFacts, PermissionLifecycleGateVerdict } from './types.js';
/**
 * The ADR §8 execution gate as a pure function of the durable lifecycle
 * state. Exported so a spec can pin all five states (and the unknown state)
 * directly, without a world.
 */
export declare function evaluatePermissionLifecycleGate(state: string | undefined): PermissionLifecycleGateVerdict;
/**
 * Project the decision site's ALREADY-CANONICAL static layers onto the
 * kernel's static-facts vocabulary (the exec plane's lower layers). A shape
 * conversion only: every canonical identity rides verbatim, declaration order
 * is preserved, no judgement is added or removed, and NO layer is invented —
 * an empty input stays an empty input (`DECLARED-NONE`).
 */
export declare function toKernelStaticFacts(layers: readonly EffectivePermissionStaticLayer[]): PermissionKernelStaticFacts;
/**
 * The frozen Alpha.2 lane asymmetry for an UNJUDGED subtree rule (P1-3 / H2):
 * a rule the decision cannot judge in the deny/ask lane is never dropped (it
 * keeps restricting — fail closed); a rule it cannot judge in the allow lane
 * is never assumed (a grant is never invented). A positive `false` from the
 * seam is a DECIDED non-match, not an unknown.
 */
export declare function containmentFallback(verdict: boolean | undefined, effect: 'allow' | 'ask' | 'deny'): boolean;
/**
 * Build the decision lane (see the module doc for the plane split and the
 * unknown-states).
 */
export declare function createPermissionDecisionLane(deps: PermissionDecisionLaneDeps): PermissionDecisionLane;
//# sourceMappingURL=decision-lane.d.ts.map