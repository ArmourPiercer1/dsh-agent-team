/**
 * Member roster creation semantics: Template → N MemberInstance (P3-T3).
 *
 * Authority (Architecture, frozen):
 *
 * - **§10.1 / invariant 17** — one MemberTemplate produces `0..N`
 *   MemberInstances: the same template (even the same label) may yield any
 *   number of distinct persistent instances in one TeamSession.
 * - **§10.2 / invariant 18** — runtime identity is the composite
 *   `(rootSessionId, instanceId)`; `instanceId` is unique within one
 *   TeamSession; templateId / label / groupId are NOT runtime identities
 *   (invariant 19); groupId is opaque grouping metadata (invariant 20).
 * - **invariant 23** — every MemberInstance binds exactly one durable child
 *   Session; the binding is never re-pointed and a child session is never
 *   shared between members (contract: `SESSION_ALREADY_BOUND`).
 * - **invariants 13/14** — the LeaderInstance is the only special member:
 *   reserved id `inst-leader`, owned by the runtime; the member creation path
 *   must not mint it.
 * - **§17.1/§17.4** — creation freezes the creation-time fields (identity,
 *   child Session, creation config incl. contextPolicy §21.6) and commits the
 *   instance in state CREATED with a durable TeamDomain binding.
 * - **§11.2/§11.3, §21.6** — contextPolicy freezes at creation.
 *
 * Domain rules (this module):
 *
 * - **R1** — Creation is the only minting point: `createMemberInstance`
 *   validates every input against contracts v1, enforces the in-team
 *   instanceId uniqueness (contract rule `DUPLICATE_INSTANCE_ID`) and the
 *   global child-session binding uniqueness (contract rule
 *   `SESSION_ALREADY_BOUND`), then returns a NEW frozen
 *   {@link MemberInstance} in state CREATED with `activityVersion = 1`.
 * - **R2** — The same template may be instantiated N times: there is NO
 *   per-template cap in this module (quota rules — per-template
 *   maxConcurrent/maxTotal, team maxConcurrent — are a separate domain
 *   concern per Development Plan §9.2 and are owned by the policy/quota
 *   task, Architecture §32).
 * - **R3** — The v1 contract DTO carries no contextPolicy field (contract v1
 *   note, invariant 29: carried by later versions); the domain
 *   {@link MemberInstance} wrapper owns the frozen contextPolicy value
 *   alongside the durable record (§21.6).
 * - **R4** — `hasEnteredRunning` (initially `false`) is the durable
 *   "first RUNNING" fact that §21.2 needs (workspace locks after first
 *   RUNNING) and §31 distinguishes (lifecycle != residency: a SETTLED
 *   instance that never ran is not the same as one that ran and settled).
 *   The v1 DTO cannot express this, so the domain wrapper carries it.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/member/roster
 */
import { LEADER_INSTANCE_ID, MEMBER_LIFECYCLE_STATES, assertInstanceIdUniqueWithinTeam, createMemberInstanceRecord, deepFreeze, parseChildSessionId, parseInstanceId, parseRootSessionId, parseTemplateId, teamContractError, } from '../../../contracts/src/index.js';
import { GROUP_ID_MAX_LENGTH, LABEL_MAX_LENGTH, parseIso8601TimestampField, parseLabelLikeField, parseWorkspaceField, } from '../../../contracts/src/dto/common.js';
import { CONTEXT_POLICY_VALUES, DEFAULT_CONTEXT_POLICY, isContextPolicy } from './context-policy.js';
import { MEMBER_DOMAIN_ERROR_CODES, MemberDomainError } from './errors.js';
/**
 * Create a new MemberInstance from a template (R1–R4) — the pure, durable
 * half of the §17.1 ActivationProvider pipeline ("freeze creation-time
 * fields", "allocate instanceId", "persist TeamDomain binding", "publish
 * committed MemberInstance").
 *
 * @param input - the raw creation input (all fields validated here).
 * @param existing - the already-committed member records to check against (any teams; the instanceId uniqueness check is team-scoped per invariant 18, the child-session check is global per invariant 23).
 * @returns a NEW frozen {@link MemberInstance} in state CREATED with
 *   `activityVersion = 1`, `hasEnteredRunning = false`, and the frozen
 *   contextPolicy.
 * @throws `TeamContractError` for contract-rule violations
 *   (`INVALID_ROOT_SESSION_ID`, `INVALID_INSTANCE_ID`, `INVALID_TEMPLATE_ID`,
 *   `INVALID_CHILD_SESSION_ID`, `MALFORMED_DTO` for label/groupId/workspace/
 *   createdAt, `DUPLICATE_INSTANCE_ID`, `SESSION_ALREADY_BOUND`);
 *   {@link MemberDomainError} `INSTANCE_ID_RESERVED` (leader's id) and
 *   `CONTEXT_POLICY_UNKNOWN` (unknown policy value).
 */
export function createMemberInstance(input, existing) {
    const rootSessionId = parseRootSessionId(input.rootSessionId);
    const instanceId = parseInstanceId(input.instanceId);
    if (instanceId === LEADER_INSTANCE_ID) {
        throw new MemberDomainError(MEMBER_DOMAIN_ERROR_CODES.INSTANCE_ID_RESERVED, `'${LEADER_INSTANCE_ID}' is the reserved LeaderInstance id (invariants 13/14): the leader's row is owned by the runtime that creates the TeamSession and cannot be minted by the member creation path`, { rootSessionId, instanceId });
    }
    const templateId = parseTemplateId(input.templateId);
    const label = parseLabelLikeField(input.label, 'label', LABEL_MAX_LENGTH);
    const groupId = input.groupId === undefined
        ? undefined
        : parseLabelLikeField(input.groupId, 'groupId', GROUP_ID_MAX_LENGTH);
    const childSessionId = parseChildSessionId(input.childSessionId);
    const workspace = parseWorkspaceField(input.workspace, 'workspace');
    let contextPolicy;
    if (input.contextPolicy === undefined) {
        contextPolicy = DEFAULT_CONTEXT_POLICY;
    }
    else if (isContextPolicy(input.contextPolicy)) {
        contextPolicy = input.contextPolicy;
    }
    else {
        throw new MemberDomainError(MEMBER_DOMAIN_ERROR_CODES.CONTEXT_POLICY_UNKNOWN, `unknown contextPolicy ${JSON.stringify(input.contextPolicy)} (expected one of: ${CONTEXT_POLICY_VALUES.join(', ')}); the policy freezes at creation (Architecture §21.6)`, { rootSessionId, instanceId });
    }
    const createdAt = parseIso8601TimestampField(input.createdAt);
    // Contract rules (cardinality invariants 18 / 23).
    assertInstanceIdUniqueWithinTeam(rootSessionId, instanceId, existing);
    const childClash = existing.find((m) => m.childSessionId === childSessionId);
    if (childClash !== undefined) {
        throw teamContractError('SESSION_ALREADY_BOUND', `child session '${childSessionId}' is already bound to member ('${childClash.rootSessionId}', '${childClash.instanceId}'); a child session is never shared between members (invariant 23)`, { childSessionId, existingInstanceId: childClash.instanceId });
    }
    const record = createMemberInstanceRecord({
        rootSessionId,
        instanceId,
        templateId,
        label,
        ...(groupId !== undefined ? { groupId } : {}),
        childSessionId,
        ...(workspace !== undefined ? { workspace } : {}),
        lifecycle: MEMBER_LIFECYCLE_STATES.CREATED,
        createdAt,
        activityVersion: 1,
    });
    return deepFreeze({ record, contextPolicy, hasEnteredRunning: false });
}
/**
 * The durable member records of one template inside one TeamSession
 * (invariant 17: 0..N; scoping per invariant 18).
 * @param members - the member records to scan (any teams).
 * @param rootSessionId - the TeamSession scope.
 * @param templateId - the template to filter by.
 */
export function instancesForTemplate(members, rootSessionId, templateId) {
    return members.filter((m) => m.rootSessionId === rootSessionId && m.templateId === templateId);
}
/**
 * Count of instances a template has produced inside one TeamSession
 * (invariant 17: 0..N; Architecture §32 maxTotal budgets count exactly this).
 * @param members - the member records to scan (any teams).
 * @param rootSessionId - the TeamSession scope.
 * @param templateId - the template to count.
 */
export function instanceCountForTemplate(members, rootSessionId, templateId) {
    return instancesForTemplate(members, rootSessionId, templateId).length;
}
/**
 * Look up one durable member by its composite runtime identity
 * (invariant 18). Returns `undefined` when no such member exists (callers that
 * need the contract `MEMBER_NOT_FOUND` error should use
 * {@link import('./context-policy.js').resolveDelegationTarget} or throw the
 * contract error themselves).
 * @param members - the member records to scan (any teams).
 * @param rootSessionId - the TeamSession scope.
 * @param instanceId - the instance id.
 */
export function findMemberRecord(members, rootSessionId, instanceId) {
    return members.find((m) => m.rootSessionId === rootSessionId && m.instanceId === instanceId);
}
//# sourceMappingURL=roster.js.map