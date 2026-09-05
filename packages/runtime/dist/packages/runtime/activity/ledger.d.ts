/**
 * P6-T5 — the activity ledger write path: `createActivityLedger`.
 *
 * Every durable activity row is written EXACTLY ONCE through this module,
 * in two serialized critical sections:
 *
 *   1. THE FACADE (P6-T2 authority): `runtime.performAction` with the
 *      closed `report-progress` action — the facade validates the request
 *      shape, resolves the instanceId-first target, resolves the caller
 *      identity + role from the durable TeamDomain, enforces the closed
 *      role set + the mutation envelope, and (under the runtime's own
 *      per-team lock) requires a LIVE, work-accepting target, then
 *      commits its `team-coordination-recorded` audit fact (the
 *      authorization evidence: action / caller / target / progress /
 *      summary / token / at).
 *   2. THE GUARDED COMMIT (this module's per-team lock, `withTeamLock` — the P8-S5B shared coordinator chain when the production root installs one, otherwise a private map
 *      from `action-router/effects.js`): a FRESH durable re-read of the
 *      subject's rows, then
 *        a. the OUT-OF-ORDER GUARD (REJECT policy): the claimed per-subject
 *           `sequence` must equal the durable head + 1 exactly;
 *           `ACTIVITY_SEQUENCE_STALE` otherwise (`details.kind` `'stale'`
 *           when claimed ≤ head — a stale update can NEVER overwrite
 *           newer state; `'gap'` when claimed > head + 1 — a gap is never
 *           silently filled);
 *        b. the INTERVAL GUARDS: at most one open interval per
 *           `(instanceId, subject, correlation)` — open-while-open fails
 *           with `ACTIVITY_INTERVAL_ALREADY_OPEN`, close-without-open
 *           FAILS CLOSED with `ACTIVITY_INTERVAL_NOT_OPEN`;
 *        c. `ledger.allocateSequence()` (the TeamLedger global sequence,
 *           invariant 44) + `ledger.put(...)` the structured activity row.
 *
 * CRASH WINDOW (documented): a crash between the two sections leaves the
 * audit fact without its structured row. It is detectable (an audit
 * `report-progress` fact with no matching activity row at the re-read
 * head) and repairable (re-report at the re-read head + 1 — the guard
 * admits it because the head never moved). The raw TeamLedger keeps both
 * families forever (append-only; no deletion path exists).
 *
 * REPORTER RULE (documented + enforced pre-facade, zero side effects):
 * - a MEMBER caller may report ONLY for its own instance (self-report) —
 *   reporting for another instance is `ACTIVITY_UNAUTHORIZED_REPORTER`;
 * - the LEADER (the fixed id `inst-leader`, `contracts/src/identity.ts` —
 *   the same identity test the facade uses to derive the role) may report
 *   for ANY live instance;
 * - a HUMAN caller is rejected (`ACTIVITY_UNAUTHORIZED_REPORTER`).
 * Full caller identity / role-staleness / target liveness remain the
 * FACADE's enforcement (no duplication here): an unknown caller fails with
 * CALLER_NOT_FOUND, a stale caller with CALLER_ROLE_STALE, an unknown
 * target with INSTANCE_NOT_FOUND, a non-work-accepting target with
 * WORK_STATE_REJECTED.
 *
 * NO WORKFLOW AUTHORITY (structural): this module imports only the storage
 * repositories (reads + the ledger writes above), the closed admission
 * vocabularies, and the per-team lock helper. It never reads or writes
 * lifecycle state, member records, or quota counters; nothing downstream
 * may consume an activity row as a lifecycle/completion decision
 * (DevPlan §19.5).
 *
 * P8-S3: the in-facade work writer (`createWorkActivityWriter`) commits
 * the work-unit interval facts through the SAME guarded write path
 * (fresh re-read + interval guards + head + 1 claim + shared durable
 * write) but WITHOUT the report-progress facade stage — its caller (the
 * work chain) already holds the router's non-reentrant per-team lock.
 */
import type { TeamDomain } from '../../storage/repositories/index.js';
import type { WorkActivityPort } from '../admission/index.js';
import type { ActivityLedger, ActivityLedgerOptions } from './types.js';
/**
 * Build one activity ledger over an injected TeamDomain + TeamRuntime
 * facade (the production wiring — both dependencies are injected ports,
 * so the ledger is testable without a live team and carries no
 * router-owned state beyond its per-team lock map (the P8-S5B shared coordinator chain when installed, otherwise its own)).
 *
 * @param options - the wiring (TeamDomain repositories, the facade, the
 *        display clock).
 * @returns the closed `ActivityLedger` surface.
 */
export declare function createActivityLedger(options: ActivityLedgerOptions): ActivityLedger;
/**
 * Build the in-facade work-activity writer (P8-S3).
 *
 * Opens/closes the activity interval of one admitted work unit by
 * committing the guarded interval fact DIRECTLY — WITHOUT the
 * report-progress facade (whose `performAction` stage would re-enter
 * the router's NON-reentrant per-team lock and deadlock) and WITHOUT a
 * second lock map (the caller — the work chain — already holds the
 * router's team lock, so the fresh re-read, the head + 1 claim, and
 * the interval guards observe the same durable state the router
 * observed).
 *
 * Contract differences from the facade-driven ledger writes:
 *   - NO authorization stage: the work chain IS the runtime (the
 *     admission + delivery owner), so the reporter is the fixed
 *     runtime sentinel `'team-runtime'`;
 *   - NO caller-claimed sequence: the writer claims head + 1 itself
 *     from the fresh read (there is no stale/gap surface);
 *   - the `progress` value is audit context only ('in-progress' on
 *     open, 'completed' on close); the projected status still derives
 *     from the progress facts — interval rows carry no authority of
 *     their own (telemetry, not authority — DevPlan §19.5).
 *
 * @param options - the wiring (the TeamDomain, the display clock).
 * @returns the closed `WorkActivityPort` surface.
 */
export declare function createWorkActivityWriter(options: {
    readonly teamDomain: TeamDomain;
    readonly now?: () => string;
}): WorkActivityPort;
//# sourceMappingURL=ledger.d.ts.map