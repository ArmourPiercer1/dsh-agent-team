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
import { LEADER_INSTANCE_ID, parseInstanceId, parseRootSessionId, } from '../../contracts/src/index.js';
import { ACTION_NAMES, PROGRESS_VALUES } from '../admission/actions.js';
import { withTeamLock } from '../action-router/effects.js';
import { ACTIVITY_ERROR_CODES, ActivityError } from './errors.js';
import { buildActivityEntry, parseActivityFact } from './facts.js';
import { ACTIVITY_CORRELATION_MAX_LENGTH, ACTIVITY_LAST_ACTION_MAX_LENGTH, ACTIVITY_NOTE_MAX_LENGTH, ACTIVITY_REQUEST_TOKEN_MAX_LENGTH, ACTIVITY_SUBJECT_MAX_LENGTH, ACTIVITY_SUMMARY_MAX_LENGTH, } from './types.js';
/** The fail-closed input validation error (closed code, zero side effects). */
function failInput(problem, details) {
    throw new ActivityError(ACTIVITY_ERROR_CODES.ACTIVITY_INPUT_INVALID, `activity: ${problem}`, details);
}
/** Parse-or-fail for the team root (typed ActivityError, not a raw parse). */
function parseRootOrFail(value) {
    if (typeof value !== 'string')
        failInput('rootSessionId: a string is required', { field: 'rootSessionId' });
    try {
        return parseRootSessionId(value);
    }
    catch {
        failInput(`rootSessionId '${value}' is not a valid root session id`, { field: 'rootSessionId' });
    }
}
/** Parse-or-fail for the target instance id (instanceId-first, inv 18). */
function parseInstanceOrFail(value) {
    if (typeof value !== 'string')
        failInput('instanceId: a string is required', { field: 'instanceId' });
    try {
        return parseInstanceId(value);
    }
    catch {
        failInput(`instanceId '${value}' is not a valid instance id`, { field: 'instanceId' });
    }
}
/** A required bounded string field (typed failure otherwise). */
function requiredString(value, field, max) {
    if (typeof value !== 'string' || value.length < 1 || value.length > max) {
        failInput(`${field}: a string of 1..${max} characters is required`, { field });
    }
    return value;
}
/** An optional bounded string field (absent stays absent). */
function optionalString(value, field, max) {
    if (value === undefined)
        return undefined;
    if (typeof value !== 'string' || value.length < 1 || value.length > max) {
        failInput(`${field}: when present must be a string of 1..${max} characters`, { field });
    }
    return value;
}
/** The closed status value (PROGRESS_VALUES — no invented vocabulary). */
function parseProgress(value) {
    if (typeof value !== 'string' || !PROGRESS_VALUES.includes(value)) {
        failInput(`progress: one of [${PROGRESS_VALUES.join(' | ')}] is required`, { field: 'progress' });
    }
    return value;
}
/** The claimed per-subject sequence (positive integer). */
function parseClaimedSequence(value) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
        failInput('sequence: a positive integer (the claimed per-subject next sequence) is required', {
            field: 'sequence',
        });
    }
    return value;
}
/**
 * The closed ActionCaller shape (the facade re-validates the full identity;
 * this is only the reporter-rule pre-check input).
 */
function parseCaller(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        failInput('caller: a closed ActionCaller object is required', { field: 'caller' });
    }
    const rec = value;
    if (rec['kind'] === 'human') {
        requiredString(rec['humanId'], 'caller.humanId', 128);
        return value;
    }
    if (rec['kind'] === 'instance') {
        parseInstanceOrFail(rec['instanceId']);
        return value;
    }
    failInput("caller: kind must be 'human' or 'instance'", { field: 'caller' });
}
/**
 * The REPORTER RULE (zero side effects, pre-facade — see the module docs):
 * a member may report only for itself; the leader may report for any live
 * instance; a human may not report activity at all.
 */
function checkReporter(caller, targetInstanceId) {
    if (caller.kind === 'human') {
        throw new ActivityError(ACTIVITY_ERROR_CODES.ACTIVITY_UNAUTHORIZED_REPORTER, `activity: a human caller ('${caller.humanId}') cannot report member activity — self-report (member) or leader report is required`, { kind: 'human-reporter', humanId: caller.humanId, targetInstanceId });
    }
    if (caller.instanceId !== targetInstanceId) {
        const isLeader = caller.instanceId === String(LEADER_INSTANCE_ID);
        if (!isLeader) {
            throw new ActivityError(ACTIVITY_ERROR_CODES.ACTIVITY_UNAUTHORIZED_REPORTER, `activity: member '${caller.instanceId}' cannot report for another instance ('${targetInstanceId}') — only the leader may report for other members`, {
                kind: 'member-proxy-report',
                callerInstanceId: caller.instanceId,
                targetInstanceId,
            });
        }
    }
}
function validateBase(input) {
    return {
        rootSessionId: parseRootOrFail(input.rootSessionId),
        caller: parseCaller(input.caller),
        instanceId: parseInstanceOrFail(input.instanceId),
        subject: requiredString(input.subject, 'subject', ACTIVITY_SUBJECT_MAX_LENGTH),
        sequence: parseClaimedSequence(input.sequence),
        progress: parseProgress(input.progress),
        requestToken: requiredString(input.requestToken, 'requestToken', ACTIVITY_REQUEST_TOKEN_MAX_LENGTH),
    };
}
/**
 * The durable row list shared by the guarded commit and the in-facade
 * work writer (deterministic order — the single source of truth for a
 * subject's activity state; no optional-filter call sites exist
 * internally, but the query shape mirrors `ActivityFactQuery`).
 */
function listSubjectActivityRows(repositories, query) {
    const rootSessionId = parseRootOrFail(query.rootSessionId);
    const instanceId = query.instanceId !== undefined ? parseInstanceOrFail(query.instanceId) : undefined;
    const rows = [];
    for (const entry of repositories.ledger.list()) {
        const row = parseActivityFact(entry);
        if (row === undefined)
            continue;
        if (row.rootSessionId !== rootSessionId)
            continue;
        if (instanceId !== undefined && row.instanceId !== instanceId)
            continue;
        if (query.subject !== undefined && row.subject !== query.subject)
            continue;
        rows.push(row);
    }
    rows.sort((a, b) => a.globalSequence - b.globalSequence);
    return rows;
}
/**
 * The interval state guards shared by the guarded commit and the
 * in-facade work writer: at most one open interval per
 * `(instanceId, subject, correlation)` — open-while-open fails with
 * `ACTIVITY_INTERVAL_ALREADY_OPEN`, close-without-open fails with
 * `ACTIVITY_INTERVAL_NOT_OPEN` (zero durable writes in either case).
 */
function assertIntervalGuards(rows, args) {
    const lastIntervalOp = new Map();
    for (const row of rows) {
        if (row.op === 'interval-open' || row.op === 'interval-close') {
            lastIntervalOp.set(row.correlation, row);
        }
    }
    const last = lastIntervalOp.get(args.correlation);
    const open = last !== undefined && last.op === 'interval-open';
    if (args.op === 'interval-open' && open) {
        throw new ActivityError(ACTIVITY_ERROR_CODES.ACTIVITY_INTERVAL_ALREADY_OPEN, `activity: interval '${args.correlation}' of '${args.subject}' for '${args.instanceId}' is already open (since per-subject sequence ${last?.sequence})`, {
            kind: 'already-open',
            correlation: args.correlation,
            instanceId: args.instanceId,
            subject: args.subject,
            openSinceSequence: last?.sequence,
        });
    }
    if (args.op === 'interval-close' && !open) {
        throw new ActivityError(ACTIVITY_ERROR_CODES.ACTIVITY_INTERVAL_NOT_OPEN, `activity: interval '${args.correlation}' of '${args.subject}' for '${args.instanceId}' is not open — close-without-open fails closed`, {
            kind: 'no-open-interval',
            correlation: args.correlation,
            instanceId: args.instanceId,
            subject: args.subject,
        });
    }
}
/**
 * The durable write shared by the guarded commit and the in-facade
 * work writer (TeamLedger — invariant 41/44): allocate the global
 * sequence, build the closed entry shape, put, and re-parse the
 * committed row (any fault → `ACTIVITY_DURABLE_WRITE_FAILED`).
 */
async function commitActivityEntry(args) {
    const globalSequence = await args.repositories.ledger.allocateSequence();
    const entry = buildActivityEntry({
        rootSessionId: args.input.rootSessionId,
        globalSequence,
        op: args.input.op,
        instanceId: args.input.instanceId,
        subject: args.input.subject,
        sequence: args.input.sequence,
        progress: args.input.progress,
        summary: args.input.summary,
        lastAction: args.input.lastAction,
        correlation: args.input.correlation,
        note: args.input.note,
        closeNote: args.input.closeNote,
        requestToken: args.input.requestToken,
        reportedByInstanceId: args.input.reportedByInstanceId,
        createdAt: args.input.createdAt,
    });
    let put;
    try {
        put = await args.repositories.ledger.put(entry);
    }
    catch (error) {
        throw new ActivityError(ACTIVITY_ERROR_CODES.ACTIVITY_DURABLE_WRITE_FAILED, `activity: the TeamLedger durable write failed: ${error instanceof Error ? error.message : String(error)}`, { globalSequence });
    }
    const row = parseActivityFact(put);
    if (row === undefined) {
        // unreachable: the builder emits the closed shape the parser accepts
        throw new ActivityError(ACTIVITY_ERROR_CODES.ACTIVITY_DURABLE_WRITE_FAILED, 'activity: the committed entry failed re-parse (internal invariant)', { globalSequence });
    }
    return row;
}
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
export function createActivityLedger(options) {
    const repositories = options.teamDomain.repositories;
    const now = options.now ?? (() => new Date().toISOString());
    /** P8-S5B (CR-8): the guarded commit serializes on the shared coordinator
     * chain when the production root installs one (strictly sequential with
     * the facade critical section — release, then re-acquire, never nested);
     * otherwise a private map (previous behavior). */
    const teamLocks = options.teamLocks ?? new Map();
    const listActivityFacts = (query) => listSubjectActivityRows(repositories, query);
    /**
     * The guarded commit (critical section 2): fresh durable re-read under
     * the per-team lock, the out-of-order guard, the interval guards, then
     * the TeamLedger allocation + put. Throws the typed ActivityError on
     * any guard failure (zero durable writes in that case); the facade
     * audit fact from critical section 1 is NOT rolled back (documented
     * crash-window semantics — see the module docs).
     */
    const commit = async (args) => {
        const { base } = args;
        return withTeamLock(teamLocks, base.rootSessionId, async () => {
            const rows = listActivityFacts({
                rootSessionId: base.rootSessionId,
                instanceId: base.instanceId,
                subject: base.subject,
            });
            // (a) the out-of-order guard — REJECT policy (deterministic total
            // order per subject; a stale update can never overwrite newer state)
            const head = rows.reduce((max, row) => Math.max(max, row.sequence), 0);
            const expected = head + 1;
            if (base.sequence !== expected) {
                throw new ActivityError(ACTIVITY_ERROR_CODES.ACTIVITY_SEQUENCE_STALE, `activity: claimed per-subject sequence ${base.sequence} for '${base.subject}' of '${base.instanceId}' is out of order — the durable head is ${head} and the next admissible sequence is ${expected}`, {
                    kind: base.sequence < expected ? 'stale' : 'gap',
                    instanceId: base.instanceId,
                    subject: base.subject,
                    claimed: base.sequence,
                    head,
                    expected,
                });
            }
            // (b) the interval guards (per-correlation fold in sequence order)
            if (args.op !== 'progress' && args.correlation !== undefined) {
                assertIntervalGuards(rows, {
                    op: args.op,
                    correlation: args.correlation,
                    subject: base.subject,
                    instanceId: base.instanceId,
                });
            }
            // (c) the durable write (TeamLedger — invariant 41/44)
            return commitActivityEntry({
                repositories,
                input: {
                    rootSessionId: base.rootSessionId,
                    op: args.op,
                    instanceId: base.instanceId,
                    subject: base.subject,
                    sequence: base.sequence,
                    progress: base.progress,
                    summary: args.summary,
                    lastAction: args.lastAction,
                    correlation: args.correlation,
                    note: args.note,
                    closeNote: args.closeNote,
                    requestToken: base.requestToken,
                    reportedByInstanceId: base.caller.kind === 'instance' ? base.caller.instanceId : 'human',
                    createdAt: now(),
                },
            });
        });
    };
    const facadeRequest = (base, payload) => ({
        rootSessionId: base.rootSessionId,
        action: ACTION_NAMES.REPORT_PROGRESS,
        caller: base.caller,
        targetInstanceId: base.instanceId,
        requestToken: base.requestToken,
        payload,
    });
    const recordProgress = async (input) => {
        const base = validateBase(input);
        const summary = optionalString(input.summary, 'summary', ACTIVITY_SUMMARY_MAX_LENGTH);
        const lastAction = optionalString(input.lastAction, 'lastAction', ACTIVITY_LAST_ACTION_MAX_LENGTH);
        const correlation = optionalString(input.correlation, 'correlation', ACTIVITY_CORRELATION_MAX_LENGTH);
        checkReporter(base.caller, base.instanceId);
        // critical section 1 — the facade (authorization + audit fact)
        await options.runtime.performAction(facadeRequest(base, {
            progress: base.progress,
            op: 'progress',
            subject: base.subject,
            sequence: base.sequence,
            ...(summary !== undefined ? { summary } : {}),
            ...(lastAction !== undefined ? { lastAction } : {}),
            ...(correlation !== undefined ? { correlation } : {}),
        }));
        // critical section 2 — the guarded commit (structured row)
        return commit({
            base,
            op: 'progress',
            summary,
            lastAction,
            correlation,
        });
    };
    const openInterval = async (input) => {
        const base = validateBase(input);
        const correlation = requiredString(input.correlation, 'correlation', ACTIVITY_CORRELATION_MAX_LENGTH);
        const note = optionalString(input.note, 'note', ACTIVITY_NOTE_MAX_LENGTH);
        checkReporter(base.caller, base.instanceId);
        await options.runtime.performAction(facadeRequest(base, {
            progress: base.progress,
            op: 'interval-open',
            subject: base.subject,
            sequence: base.sequence,
            correlation,
            ...(note !== undefined ? { note } : {}),
        }));
        return commit({ base, op: 'interval-open', correlation, note });
    };
    const closeInterval = async (input) => {
        const base = validateBase(input);
        const correlation = requiredString(input.correlation, 'correlation', ACTIVITY_CORRELATION_MAX_LENGTH);
        const closeNote = optionalString(input.closeNote, 'closeNote', ACTIVITY_NOTE_MAX_LENGTH);
        checkReporter(base.caller, base.instanceId);
        await options.runtime.performAction(facadeRequest(base, {
            progress: base.progress,
            op: 'interval-close',
            subject: base.subject,
            sequence: base.sequence,
            correlation,
            ...(closeNote !== undefined ? { closeNote } : {}),
        }));
        return commit({ base, op: 'interval-close', correlation, closeNote });
    };
    return { recordProgress, openInterval, closeInterval, listActivityFacts };
}
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
export function createWorkActivityWriter(options) {
    const repositories = options.teamDomain.repositories;
    const now = options.now ?? (() => new Date().toISOString());
    const commitInterval = async (op, args) => {
        // parse-or-fail the durable ids (ACTIVITY_INPUT_INVALID when malformed)
        const rootSessionId = parseRootOrFail(args.rootSessionId);
        const instanceId = parseInstanceOrFail(args.instanceId);
        const rows = listSubjectActivityRows(repositories, {
            rootSessionId: args.rootSessionId,
            instanceId: args.instanceId,
            subject: args.subject,
        });
        const head = rows.reduce((max, row) => Math.max(max, row.sequence), 0);
        assertIntervalGuards(rows, {
            op,
            correlation: args.correlation,
            subject: args.subject,
            instanceId: args.instanceId,
        });
        await commitActivityEntry({
            repositories,
            input: {
                rootSessionId,
                instanceId,
                op,
                subject: args.subject,
                sequence: head + 1,
                progress: op === 'interval-open' ? 'in-progress' : 'completed',
                correlation: args.correlation,
                note: op === 'interval-open' ? args.note : undefined,
                closeNote: op === 'interval-close' ? args.closeNote : undefined,
                requestToken: args.requestToken,
                reportedByInstanceId: 'team-runtime',
                createdAt: now(),
            },
        });
    };
    return {
        openInterval: (args) => commitInterval('interval-open', { ...args, closeNote: undefined }),
        closeInterval: (args) => commitInterval('interval-close', { ...args, note: undefined }),
    };
}
//# sourceMappingURL=ledger.js.map