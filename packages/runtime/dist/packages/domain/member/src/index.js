/**
 * @dsh-agent-team/domain/member — Template→Instance creation, contextPolicy
 * and delegation resolution, and workspace creation semantics (P3-T3).
 *
 * Pure domain layer over the frozen contracts v1 vocabulary (Development
 * Plan §9.2: "MemberInstance", "TeamSession aggregate semantics" live in
 * `domain`):
 *
 * - **Template → N Instance** (Architecture §10.1, invariant 17): the same
 *   template — even with the same label — yields any number of distinct
 *   persistent MemberInstances in one TeamSession; runtime identity is the
 *   composite `(rootSessionId, instanceId)` (invariant 18); no per-template
 *   cap here (quota rules are a separate domain concern, Architecture §32).
 * - **contextPolicy** (§11.2/§11.3, §21.6): `persistent` (default) and
 *   `fresh_per_delegation`, frozen at creation; `fresh_per_delegation` is an
 *   INSTANCE-CREATION strategy (new delegation → new instance + new child
 *   Session + independent context), never a context reset; an explicit
 *   instance address always continues that instance (§11.3, §24.1).
 * - **Workspace creation semantics** (§21.2): creation-mutable, immutable
 *   after first RUNNING, inherits `TeamSession.defaultWorkspace` when
 *   unspecified; a new route means a new MemberInstance.
 *
 * No Agent/Session handle anywhere: the module describes durable state and
 * the pure rules over it (TaskDoc §11.4 P3-T3 实现要点).
 *
 * Pure module: no I/O, no live Agent, no ambient state.
 * @module @dsh-agent-team/domain/member
 */
export { MEMBER_DOMAIN_ERROR_CODES, MemberDomainError, isMemberDomainError, } from './errors.js';
export { CONTEXT_POLICIES, CONTEXT_POLICY_VALUES, DEFAULT_CONTEXT_POLICY, isContextPolicy, WORK_ACCEPTING_STATES, resolveDelegationTarget, } from './context-policy.js';
export { createMemberInstance, instancesForTemplate, instanceCountForTemplate, findMemberRecord, } from './roster.js';
export { resolveEffectiveWorkspace, setWorkspace } from './workspace.js';
export { transitionInstance } from './instance.js';
//# sourceMappingURL=index.js.map