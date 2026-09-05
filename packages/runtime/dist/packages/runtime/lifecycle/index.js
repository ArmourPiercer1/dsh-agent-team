/**
 * P7-T3 — the MemberInstance lifecycle runtime: Archive / Restore /
 * Dispose + descendant drain (TaskDoc §11.5 P7-T3 card; ruling R34 owned
 * surface `packages/runtime/lifecycle/**`).
 *
 * - `types.ts`   — the port / request / result / step vocabulary;
 * - `errors.ts`  — the closed runtime error channel (seven codes);
 * - `resolve.ts` — the shared fail-closed prologue (identity →
 *   LeaderInstance guard → durable read → dry-run legality) + the single
 *   durable commit path;
 * - `quiesce.ts` — the shared five-step quiescence procedure (DevPlan
 *   §20.3 steps 1–5, shared by Archive and Dispose);
 * - `archive.ts` — `archiveMember` (RUNNING ⇒ settle-then-archive — the
 *   frozen §29 FSM has no RUNNING→ARCHIVED edge; SETTLED ⇒ direct);
 * - `restore.ts` — `restoreMember` (ARCHIVED → SETTLED only; ZERO live
 *   contact — the structural G7 guarantee);
 * - `dispose.ts` — `disposeMember` (quiesce → single DISPOSED commit;
 *   history preserved);
 * - this index  — the re-exports + {@link createLifecycleService}.
 *
 * Concurrency: the standalone functions are the UNLOCKED cores (one
 * operation, caller-serialized). {@link createLifecycleService} wraps
 * them in the P6 per-team promise-chain lock (`withTeamLock`, one lock
 * per root session id), so concurrent lifecycle operations on the SAME
 * team serialize — a concurrent double-dispose (or dispose-vs-archive
 * race) commits exactly once, and the loser observes the durable state
 * the winner wrote (re-read at its prologue) and is rejected as
 * `LIFECYCLE_ILLEGAL_STATE`.
 *
 * Mock-first (ruling R28): every live-runtime contact is an injected
 * port; the real bindings (the P2-T2/P2-T5 public descendant seam, the
 * P5-T6 `ResidencyPort` over the live agent runtime) land in P7-T7.
 *
 * @module @dsh-agent-team/runtime/lifecycle
 */
export { LIFECYCLE_RUNTIME_ERROR_CODES, LIFECYCLE_RUNTIME_ERROR_CODE_VALUES, LifecycleRuntimeError, isLifecycleRuntimeError, errorMessage, } from './errors.js';
export { LIFECYCLE_STEP_NAMES, LIFECYCLE_STEP_NAME_VALUES } from './types.js';
export { quiesceMember } from './quiesce.js';
export { archiveMember } from './archive.js';
export { restoreMember } from './restore.js';
export { disposeMember } from './dispose.js';
import { withTeamLock } from '../action-router/index.js';
import { archiveMember } from './archive.js';
import { disposeMember } from './dispose.js';
import { restoreMember } from './restore.js';
/**
 * Create the locked lifecycle service: the three operations wrapped in
 * the P6 per-team promise-chain lock (one chain per root session id).
 * The service is the documented call surface for the tools/remote
 * layers; the standalone functions remain available for direct
 * (caller-serialized) use.
 *
 * @param ports - the lifecycle ports (shared by all three operations).
 * @param teamLocks - optional: the P8-S5B shared coordinator chain (the
 *   production root installs one, CR-8); when absent, a private map
 *   (previous behavior).
 * @returns the locked {@link LifecycleService}.
 */
export function createLifecycleService(ports, teamLocks) {
    // P8-S5B (CR-8): when the production root installs the shared coordinator
    // chain, the locked service serializes on it; otherwise a private map
    // (previous behavior). The production row itself runs the UNLOCKED cores
    // under the router's chain — this lock fences standalone service use.
    const locks = teamLocks ?? new Map();
    /**
     * The pre-op durable read (under the same team lock) that supplies the
     * evidence `from`. GUARDED: a malformed identity or a read fault must
     * NOT surface the storage-layer error — the core's fail-closed prologue
     * (identity → guard → read → dry-run) owns the typed error channel
     * (LIFECYCLE_INVALID_INPUT / MEMBER_NOT_FOUND / DURABLE_STATE_FAILED);
     * a swallowed read simply yields `from === undefined`, and the core
     * either rejects (no evidence) or re-reads successfully.
     */
    const preRead = (target) => {
        try {
            return ports.teamDomain.repositories.memberInstances.get(target.rootSessionId, target.instanceId);
        }
        catch {
            return undefined;
        }
    };
    /**
     * Commit the durable evidence AFTER a committed standalone operation,
     * under the same team lock, from the pre-op durable read. Exactly ONE
     * fact per operation (the RUNNING archive's settle + archive is one
     * operation). Rejected operations never reach this point (the core
     * throws before any commit). The evidence commit is fail-closed: a
     * durable write fault rejects the whole call (the transition is
     * already committed; the typed failure is surfaced, never swallowed).
     */
    const evidenceAfter = async (target, operation, from, member, steps) => {
        if (ports.evidence === undefined || from === undefined)
            return;
        await ports.evidence.commitLifecycleChanged({
            rootSessionId: target.rootSessionId,
            instanceId: target.instanceId,
            operation,
            from: from.lifecycle,
            to: member.lifecycle,
            steps: [...steps],
        });
    };
    return {
        archiveMember: (target) => withTeamLock(locks, target.rootSessionId, async () => {
            const from = preRead(target);
            const result = await archiveMember(ports, target);
            await evidenceAfter(target, 'archive', from, result.member, result.steps);
            return result;
        }),
        restoreMember: (target) => withTeamLock(locks, target.rootSessionId, async () => {
            const from = preRead(target);
            const result = await restoreMember(ports, target);
            await evidenceAfter(target, 'restore', from, result.member, result.steps);
            return result;
        }),
        disposeMember: (target) => withTeamLock(locks, target.rootSessionId, async () => {
            const from = preRead(target);
            const result = await disposeMember(ports, target);
            await evidenceAfter(target, 'dispose', from, result.member, result.steps);
            return result;
        }),
    };
}
//# sourceMappingURL=index.js.map