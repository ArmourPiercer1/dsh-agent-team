/**
 * contextPolicy and delegation-target resolution (P3-T3).
 *
 * Authority (Architecture, frozen):
 *
 * - **§11.2 `persistent`** — "对同一 MemberInstance 的后续 work 继续该
 *   instance 的原 child Session. 这是默认行为" (follow-up work on the same
 *   MemberInstance continues the instance's original child Session; this is
 *   the DEFAULT behavior).
 * - **§11.3 `fresh_per_delegation`** — "在 vNext 中解释为**实例创建策略**而
 *   不是'重置实例上下文策略'": a NEW delegation to a fresh-policy template
 *   creates a NEW MemberInstance with a new child Session and independent
 *   context. It is NOT a context-reset on an existing instance:
 *
 *   ```text
 *   Delegation #1 -> inst-A -> Session A
 *   Delegation #2 -> inst-B -> Session B     (NOT: inst-A -> Session B — forbidden identity break, §11.3)
 *   ```
 *
 *   and "对已经明确寻址 inst-A 的 follow-up 永远继续 Session A" — a follow-up
 *   that explicitly addresses an instance ALWAYS continues that instance,
 *   under either policy.
 * - **§21.6** — contextPolicy is **immutable after MemberInstance creation**
 *   (changing it would break continuation identity). There is deliberately NO
 *   mutation API in this module.
 * - **§24.1** — instance-first addressing: transport/audit never depend on
 *   label/templateId, so an explicit instance address is resolved by identity
 *   alone (invariant 18).
 * - **§29.5** — DISPOSED "cannot receive new Team work".
 * - **§29.4 / §30.2** — an ARCHIVED instance stays out of the active work set
 *   until an explicit Restore (ARCHIVED→SETTLED); new work is admitted from
 *   SETTLED (§30.3).
 *
 * Domain rules (this module):
 *
 * - **M1** — A delegation request is EITHER instance-first (exactly one
 *   `explicitInstanceId`) OR template-level (exactly one `templateId`)
 *   (§24.1, §11.3). Both or neither is a domain error
 *   (`DELEGATION_TARGET_INVALID`).
 * - **M2** — An explicit address always resolves to the addressed instance,
 *   under either policy (§11.3: follow-up to an explicitly addressed instance
 *   always continues it). A missing member is the contract rule
 *   `MEMBER_NOT_FOUND`. A DISPOSED member cannot be resolved for new work
 *   (§29.5) → `DELEGATION_TARGET_DISPOSED`. An ARCHIVED member resolves to
 *   itself (identity is preserved, §11.3); the caller must Restore it before
 *   admitting work (the lifecycle FSM enforces that path, §30.2/§30.3).
 * - **M3** — A template-level delegation under `fresh_per_delegation` ALWAYS
 *   creates a new instance, regardless of existing instances (§11.3, §41.4:
 *   "later leader performs NEW delegation to template=researcher → inst-B").
 * - **M4** — A template-level delegation under `persistent` continues the
 *   unique work-accepting instance of that template in the team, creates when
 *   none exists, and is AMBIGUOUS (domain error `DELEGATION_TARGET_AMBIGUOUS`)
 *   when more than one work-accepting instance exists — the frozen docs give
 *   no selection rule among multiple instances, so the domain refuses to
 *   invent one; the caller must address an instance explicitly (§11.2,
 *   invariant 19).
 * - **M5** — Work-accepting states for new Team work: CREATED / RUNNING /
 *   SETTLED (§29.1–§29.3, §30.3). ARCHIVED is not directly work-accepting
 *   (explicit Restore first, §29.4/§30.2/§30.3); DISPOSED never is (§29.5).
 *
 * The v1 contract DTO carries no contextPolicy field (contract v1 note,
 * invariant 29: "contextPolicy freezes at creation — carried by later
 * versions"); the domain therefore owns the value here, frozen at creation
 * (§21.6), and a later contract version will carry it in the record.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/member/context-policy
 */
import { MEMBER_LIFECYCLE_STATES, deepFreeze, teamContractError } from '../../../contracts/src/index.js';
import { MEMBER_DOMAIN_ERROR_CODES, MemberDomainError } from './errors.js';
const CREATED = MEMBER_LIFECYCLE_STATES.CREATED;
const RUNNING = MEMBER_LIFECYCLE_STATES.RUNNING;
const SETTLED = MEMBER_LIFECYCLE_STATES.SETTLED;
const DISPOSED = MEMBER_LIFECYCLE_STATES.DISPOSED;
/**
 * The frozen contextPolicy vocabulary (Architecture §11.2/§11.3, §21.6).
 * Both values are INSTANCE-CREATION policies (§11.3): they decide how
 * delegations map onto MemberInstances — never how an existing instance's
 * context is reset (that is the forbidden legacy semantics, §11.3).
 */
export const CONTEXT_POLICIES = {
    /** DEFAULT: follow-up work on the same MemberInstance continues its original child Session (§11.2). */
    PERSISTENT: 'persistent',
    /** A new delegation to the template creates a new MemberInstance with a new child Session and independent context (§11.3, §41.4). */
    FRESH_PER_DELEGATION: 'fresh_per_delegation',
};
/** Every contextPolicy value, for membership checks. */
export const CONTEXT_POLICY_VALUES = Object.values(CONTEXT_POLICIES);
/** The default contextPolicy (Architecture §11.2: persistent is the default). */
export const DEFAULT_CONTEXT_POLICY = CONTEXT_POLICIES.PERSISTENT;
/** Type guard for the contextPolicy vocabulary. */
export function isContextPolicy(value) {
    return typeof value === 'string' && CONTEXT_POLICY_VALUES.includes(value);
}
/**
 * The lifecycle states in which a member may accept NEW Team work (M5).
 * ARCHIVED requires an explicit Restore first (§29.4/§30.2); DISPOSED never
 * accepts new work (§29.5).
 */
export const WORK_ACCEPTING_STATES = Object.freeze([
    CREATED,
    RUNNING,
    SETTLED,
]);
/**
 * Resolve where a delegation / follow-up lands (M1–M5).
 *
 * This is a pure mapping over durable state — it creates nothing; the
 * ActivationProvider (§17.1) performs the actual (quasi-)transactional
 * creation when the result is `create`.
 *
 * @param rootSessionId - the TeamSession (root session id, invariant 9) the delegation happens in.
 * @param contextPolicy - the contextPolicy of the targeted template (§21.6: it is the template's frozen creation-time policy).
 * @param request - the delegation request (M1 shape).
 * @param members - the durable member records to resolve against (any teams; scoping is by `rootSessionId` per invariant 18).
 * @returns the resolved target (continue an instance, or create a new one).
 * @throws {@link MemberDomainError} `DELEGATION_TARGET_INVALID` (M1),
 *   `DELEGATION_TARGET_AMBIGUOUS` (M4), `DELEGATION_TARGET_DISPOSED` (M2);
 *   `TeamContractError` `MEMBER_NOT_FOUND` when an explicit address names no
 *   member in this team (contract roster-lookup rule).
 */
export function resolveDelegationTarget(rootSessionId, contextPolicy, request, members) {
    const hasExplicit = request.explicitInstanceId !== undefined;
    const hasTemplate = request.templateId !== undefined;
    if (hasExplicit === hasTemplate) {
        throw new MemberDomainError(MEMBER_DOMAIN_ERROR_CODES.DELEGATION_TARGET_INVALID, `a delegation request must be EITHER instance-first (explicitInstanceId) OR template-level (templateId) — exactly one (Architecture §24.1, §11.3); got explicit=${hasExplicit}, template=${hasTemplate}`, { rootSessionId });
    }
    if (hasExplicit) {
        // M2: an explicit address always continues the addressed instance,
        // under either policy (§11.3) — resolved by identity alone (§24.1).
        const instanceId = request.explicitInstanceId;
        const found = members.find((m) => m.rootSessionId === rootSessionId && m.instanceId === instanceId);
        if (found === undefined) {
            throw teamContractError('MEMBER_NOT_FOUND', `no member with instanceId '${instanceId}' in TeamSession '${rootSessionId}'; an explicit address resolves by identity (invariant 18)`, { rootSessionId, instanceId });
        }
        if (found.lifecycle === DISPOSED) {
            throw new MemberDomainError(MEMBER_DOMAIN_ERROR_CODES.DELEGATION_TARGET_DISPOSED, `instance '${instanceId}' is DISPOSED and cannot receive new Team work (Architecture §29.5); it is not a recoverable runtime entity`, { rootSessionId, instanceId, lifecycle: found.lifecycle });
        }
        // ARCHIVED resolves to itself (identity preserved, M2); the caller must
        // Restore it (ARCHIVED→SETTLED, §30.2) before admitting work.
        return deepFreeze({ kind: 'continue', instanceId: found.instanceId });
    }
    // Template-level delegation.
    const templateId = request.templateId;
    if (contextPolicy === CONTEXT_POLICIES.FRESH_PER_DELEGATION) {
        // M3: fresh_per_delegation is an instance-CREATION strategy (§11.3):
        // every new delegation creates a new instance — §41.4:
        // "later leader performs NEW delegation to template=researcher → inst-B".
        return deepFreeze({
            kind: 'create',
            reason: 'fresh_per_delegation',
            contextPolicy,
        });
    }
    // M4: persistent — continue the unique work-accepting instance of this
    // template in this team; create when none; refuse to invent a selection
    // when several are work-accepting (M5 work-accepting set).
    const candidates = members.filter((m) => m.rootSessionId === rootSessionId &&
        m.templateId === templateId &&
        WORK_ACCEPTING_STATES.includes(m.lifecycle));
    if (candidates.length === 0) {
        return deepFreeze({ kind: 'create', reason: 'no_active_instance', contextPolicy });
    }
    if (candidates.length === 1) {
        const only = candidates[0];
        if (only !== undefined) {
            return deepFreeze({ kind: 'continue', instanceId: only.instanceId });
        }
    }
    throw new MemberDomainError(MEMBER_DOMAIN_ERROR_CODES.DELEGATION_TARGET_AMBIGUOUS, `persistent template-level delegation to '${templateId}' in TeamSession '${rootSessionId}' matched ${candidates.length} work-accepting instances; the frozen architecture defines no selection rule among multiple instances of a template — address an instance explicitly (Architecture §11.2, invariant 19)`, {
        rootSessionId,
        templateId,
        candidateInstanceIds: candidates.map((m) => m.instanceId),
    });
}
//# sourceMappingURL=context-policy.js.map