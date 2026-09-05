/**
 * P6-T2 — TeamRuntime admission: the authority/envelope/quota/compat
 * resolution layer of the unified runtime/control action facade.
 *
 * Composition:
 *   - `errors.ts`   — the closed TeamRuntime error-code vocabulary
 *   - `types.ts`    — the caller roles, request/result/effect vocabulary,
 *                     the facade ports (TeamRuntimeOptions/TeamRuntime)
 *   - `actions.ts`  — the closed action registry (name -> category/ops/
 *                     effect) + request validation (step 0)
 *   - `resolve.ts`  — steps 1-2: instanceId-first team/target resolution +
 *                     caller identity/role from the TeamDomain
 *   - `envelope.ts` — step 3: the caller's effective mutation envelope
 *                     (team/template/overlay intersection, fail closed)
 *   - `gate.ts`     — step 4: the compatibility/work-state gates (inv 50)
 *                     + the provider error mapping (step 5 quota codes)
 *
 * The documented enforcement order (the facade contract, enforced in
 * `action-router/router.ts`):
 *   (0) request validation (closed action vocabulary, per-action shape);
 *   (1) team + target resolution (instanceId-first; label/template tokens
 *       REJECTED — invariant 19);
 *   (2) caller identity + role from the TeamDomain (human/leader/member;
 *       DISPOSED/ARCHIVED callers are stale);
 *   (3) caller authority + mutation envelope (human: not team-envelope-bound,
 *       inv 34; leader: team envelope, inv 36; member: team ∩ template ∩
 *       instance overlay, fail closed, inv 37);
 *   (4) compatibility/admission (inv 50: the compat gate blocks NEW WORK;
 *       work targets must be work-accepting);
 *   (5) quota (creation actions enforce inside the ActivationProvider step
 *       7 under its per-team lock; boundary: count+1 > limit rejects);
 *   (6) durable effects (TeamDomain repositories only, inv 41).
 *
 * Rejection at steps 0-5 carries ZERO durable side effects (no repository
 * `put` has run); the single effect-phase fault code is
 * DURABLE_WRITE_FAILED (bounded partial-commit semantics documented in
 * `action-router/effects.ts`).
 */
export { TEAM_RUNTIME_ERROR_CODES, TEAM_RUNTIME_ERROR_CODE_VALUES, TeamRuntimeError, isTeamRuntimeError, } from './errors.js';
export { CALLER_ROLES, CALLER_ROLE_VALUES, effectivePolicyView, memberSummary, } from './types.js';
export { ACTION_NAMES, ACTION_NAME_VALUES, ACTION_CATEGORIES, RUNTIME_OPS, PROGRESS_VALUES, CONTROL_DECISION_VALUES, ACTION_SPECS, actionSpecOf, validateActionRequest, } from './actions.js';
export { checkCallerRoleAuthority, resolveCaller, resolveInstanceToken, resolveTeamAndTarget, } from './resolve.js';
export { ALL_MUTATION_OPS, callerEnvelope, enforceEnvelope, overlayEnvelopeOf, } from './envelope.js';
export { enforceCompatibilityGate, enforceWorkAcceptingState, isNewWorkAdmission, mapActivationError, } from './gate.js';
//# sourceMappingURL=index.js.map