/**
 * P7-T1 — probe generation + warning ACK fingerprint (the core of the
 * runtime compatibility module).
 *
 * One {@link CompatibilityProber} owns one TeamSession's compatibility
 * generation line (the durable `compatibility` store row of the
 * TeamDomain, keyed by the root session id):
 *
 * - **probe generation** (Development Plan §20.1): every one of the five
 *   re-probe triggers runs a fresh probe — a fresh environment-facts
 *   read, an engine evaluation carrying the durable acknowledgements,
 *   and a durable state replace at generation + 1 bound to the new
 *   environment fingerprint. A probe never starts, admits, or cancels
 *   any work; it only classifies and records (Architecture §27.2/§28,
 *   the P3 engine contract).
 * - **warning ACK fingerprint** (Architecture §27.3): an
 *   acknowledgement is bound to the CURRENT mismatch fingerprint AND
 *   the CURRENT environment fingerprint of the evaluation it
 *   acknowledges — never a permanent "ignore all warnings" flag. The
 *   engine re-derives both fingerprints on every evaluation and
 *   re-classifies each durable ack VALID / STALE / MISSING; a drift
 *   therefore makes the old ack stale and the warning re-blocks
 *   (the §41.7 invalidation).
 * - **drift → new work admission** (DevPlan §20.1 "新 warning：block
 *   NEW work"; Architecture §28.1/§28.2/§41.7): the new-work gate
 *   re-checks freshness first (a stale/absent generation forces a
 *   `STALE_GENERATION_BEFORE_NEW_WORK` re-probe), then blocks NEW work
 *   on BLOCKED_WARNING / BLOCKED_FATAL. In-flight work admitted before
 *   the drift is tracked per prober and its settle path NEVER
 *   consults the current compatibility state (§28.2: compatibility
 *   drift 不自动取消正在执行的 model/tool operation).
 *
 * DURABLE-WRITE DISCIPLINE (corrected by A4-PR7 `compat-atomic`).
 *
 * The previous version of this block asserted that a state replace is "a
 * delete + put serialized behind the prober's promise-chain lock … on the same
 * team_domain write chain". That was FALSE and the code contradicted it: the
 * promise-chain lock is PER PROBER INSTANCE, and `putRecord`/`deleteRow` go
 * straight to `table.put`/`table.delete` — only `updateRaw` reaches the seam's
 * per-domain write chain. Two independent consultations built over ONE
 * repositories object (which is what every entry point does) therefore raced:
 * one lost per round, deterministically, and its rejection surfaced as
 * ACTIVATION_COMPATIBILITY_BLOCKED_FATAL — a false refusal of legitimate work
 * (`dev/agent-workflow/evidence/a4-pr7/p6t1-flake/FINDINGS.md` SS7). A module
 * comment asserting a property the code lacks is a defect that recruits the
 * next reader; the property is stated below as it NOW holds, including the part
 * that still does not hold.
 *
 * - ONE state transition = ONE durable write:
 *   `compatibility.replaceIfGeneration(record, expectedGeneration)`, whose
 *   generation check runs INSIDE the seam's atomic write-chain slot (the same
 *   `update` read-modify-write `teamSessions.advanceGeneration` uses). A writer
 *   conditioned on a generation that has moved on is rejected with
 *   `RECORD_DUPLICATE` / problem `stale-generation-compatibility-state` and
 *   writes NOTHING: a lost race is detectable, never silently destructive.
 * - NO probe path deletes any more, so the row is never observable as ABSENT
 *   between two writes, and a crash mid-write leaves the PREVIOUS row — human
 *   acknowledgements included — intact. The "documented crash window (delete
 *   landed, put lost)" this block used to describe, and the fail-safe re-probe
 *   it supposedly forced, no longer exist: nothing is lost, so nothing has to
 *   be re-established from nothing.
 * - WHAT IS STILL NOT GUARANTEED, named so the next reader does not have to
 *   rediscover it: the COLD transition (the caller read no row, so
 *   `expectedGeneration: 0`) is a `put`, and the public seam has no conditional
 *   create (`update` rejects a missing key with `missing-key`), so a create
 *   whose occupied-key check reads BEFORE a concurrent create's write is not
 *   detectable at this seam. Its blast radius is bounded: the two candidates
 *   carry the same generation and the same environment fingerprint (both
 *   probed the same live facts) and differ only in `computedAt`; the surviving
 *   row is always ONE probe's complete, well-formed record — never absent,
 *   never torn, never a state no probe computed — and every reader, the loser
 *   included, re-reads the row. Closing this last window needs a conditional
 *   create in the upstream storage seam: that is a host change (CORE_SEAM_BLOCKER
 *   with a zero core-patch budget), so it is disclosed, not papered over.
 * - `teamSessions.advanceGeneration` remains a SEPARATE durable write, ordered
 *   strictly AFTER the state transition is durable (a failed state write
 *   rejects before any advance). The compatibility row's own generation is what
 *   the compare-and-set conditions on; the team-session stamp is the
 *   state-durable-before-stamp lag marker of hooks A/B, unchanged.
 * - CONVERGENCE, not repetition: two consultations that race one generation
 *   still commit exactly ONE transition; the loser used to be refused, and a
 *   refusal of work the durable state actually permits is itself a failure.
 *   `isLostStateRace` identifies the typed signal, and the freshness paths
 *   (`ensureFreshGeneration` here, step 3 of
 *   `createCompatibilityAuthority().evaluate()`) treat a loser whose row now
 *   carries the live fingerprint as the freshness establishment it was waiting
 *   for. A loser whose row does NOT carry the live fingerprint still fails
 *   closed exactly as before, and `probe()` itself keeps rejecting with the
 *   typed conflict, so a version conflict always stays observable by name.
 *
 * In-flight boundary (documented): the in-flight work ledger is in
 * memory per prober instance (process lifetime). Durable crash-window
 * reconciliation of in-flight work belongs to the P4 operation journal;
 * this module encodes only the §28.2 settle semantics.
 *
 * I/O only through the injected TeamDomain repositories and the
 * environment-facts port; no node: builtins, no upstream imports.
 * @module @dsh-agent-team/runtime/compatibility/probe
 */
import { computeEnvironmentFingerprint, evaluateCompatibility, parseRequirements, } from '../../domain/compatibility/src/index.js';
import { parseRootSessionId } from '../../contracts/src/index.js';
import { TEAM_DOMAIN_ERROR_CODES, TEAM_DOMAIN_SCHEMA_VERSION, isTeamDomainError } from '../../storage/schema/index.js';
import { compatibilityRequirementsOf } from './blueprint.js';
import { classifyDrift } from './drift.js';
import { COMPATIBILITY_ERROR_CODES, CompatibilityError } from './errors.js';
import { PROBE_TRIGGERS } from './types.js';
/**
 * The plain-JSON lossless mapping of the engine result into the durable
 * record's `outcomes` field (Architecture §14.3 E: the current
 * compatibility facts are durable; storage validates the closed shape,
 * the semantics stay engine-owned). Built field-by-field (no spread of
 * frozen engine values) so the result is a plain mutable JSON record.
 */
function outcomesOf(result) {
    const rows = result.requirements.map((requirement) => {
        const ackRef = requirement.acknowledgement;
        const bound = ackRef !== null ? ackRef.acknowledgement : null;
        const row = {
            requirementId: requirement.requirementId,
            type: requirement.type,
            complete: requirement.complete,
            outcome: requirement.outcome,
            reasonCode: requirement.reasonCode,
            detail: requirement.detail,
            unavailableSubjects: [...requirement.unavailableSubjects],
            mismatchFingerprint: requirement.mismatchFingerprint,
            acknowledgement: ackRef === null
                ? null
                : {
                    status: ackRef.status,
                    acknowledgement: bound === null
                        ? null
                        : {
                            requirementId: bound.requirementId,
                            mismatchFingerprint: bound.mismatchFingerprint,
                            environmentFingerprint: bound.environmentFingerprint,
                            acknowledgedBy: bound.acknowledgedBy,
                            acknowledgedAt: bound.acknowledgedAt,
                            ...(bound.note !== undefined ? { note: bound.note } : {}),
                        },
                },
        };
        return row;
    });
    return {
        counts: {
            pass: result.counts.pass,
            warning: result.counts.warning,
            fatal: result.counts.fatal,
            unackedWarning: result.counts.unackedWarning,
            staleAcknowledgement: result.counts.staleAcknowledgement,
        },
        requirements: rows,
    };
}
/**
 * Extract the blocking requirement ids (WARNING or FATAL outcomes) from
 * a durable record's `outcomes` (defensive read: the record is
 * lossless-JSON; a malformed shape yields no ids, never a throw).
 */
function blockingRequirementIdsOf(record) {
    const raw = record.outcomes['requirements'];
    if (!Array.isArray(raw))
        return [];
    const ids = [];
    for (const item of raw) {
        if (typeof item !== 'object' || item === null)
            continue;
        const requirement = item;
        const id = requirement['requirementId'];
        const outcome = requirement['outcome'];
        if (typeof id === 'string' && (outcome === 'WARNING' || outcome === 'FATAL'))
            ids.push(id);
    }
    return ids;
}
/**
 * Is `error` the typed signal that ANOTHER writer committed the compatibility
 * state this writer was about to commit — a LOST COMPARE-AND-SET rather than a
 * failing write path?
 *
 * Both shapes of that signal come from `CompatibilityRepository` and both are
 * `RECORD_DUPLICATE` on the `compatibility` store, which is precisely what the
 * closed v1 code means — "a different record already occupies the key"
 * (`storage/schema/errors.ts`):
 *
 * - problem `stale-generation-compatibility-state`: the generation check inside
 *   the seam's write-chain slot rejected this writer because the row moved on;
 * - problem `duplicate-compatibility-state`: the cold create found the key
 *   already occupied by another creator's row.
 *
 * The predicate never swallows anything on its own: its users converge ONLY when
 * the durable row now carries the fingerprint they were trying to establish
 * (`ensureFreshGeneration`, and step 3 of the authority's evaluation chain);
 * otherwise the error propagates unchanged and the consultation fails closed
 * exactly as before. `probe()` itself always rejects with it, so a version
 * conflict stays observable BY NAME to any caller that asked for a probe.
 */
export function isLostStateRace(error) {
    return (isTeamDomainError(error)
        && error.code === TEAM_DOMAIN_ERROR_CODES.RECORD_DUPLICATE
        && error.details?.['store'] === 'compatibility');
}
/**
 * Create one per-TeamSession compatibility prober (the P7-T1 public
 * constructor).
 *
 * @param deps - the injected dependencies (see {@link CompatibilityProberDeps}).
 * @returns the prober (implements {@link CompatibilityProber}).
 */
export function createCompatibilityProber(deps) {
    const now = deps.now ?? (() => new Date().toISOString());
    const repositories = deps.repositories;
    const rootSessionId = deps.rootSessionId;
    // The branded root session id (fail fast at construction; the durable
    // record's field is the contracts-branded identity, exactly as the
    // repositories validate it).
    const rootId = parseRootSessionId(rootSessionId);
    // The typed requirements of the bound blueprint (memoized: the
    // blueprint snapshot is immutable; a single derivation keeps the
    // fingerprint inputs stable across probes).
    let requirementsCache;
    function requirements() {
        if (requirementsCache === undefined) {
            requirementsCache = parseRequirements(compatibilityRequirementsOf(deps.blueprint));
        }
        return requirementsCache;
    }
    // The promise-chain lock: one durable writer per prober (the P6-T1
    // provider pattern).
    let lock = Promise.resolve();
    function withLock(work) {
        const next = lock.then(work, work);
        // Keep the chain alive even when `work` rejects.
        lock = next.then(() => undefined, () => undefined);
        return next;
    }
    // The in-flight work ledger (§28.2): per prober instance, in memory.
    const inFlight = new Map();
    let workCounter = 0;
    /** Evaluate one fresh facts read against the durable acks (pure). */
    async function evaluateFresh(acks) {
        const facts = await deps.environmentFacts();
        return evaluateCompatibility({
            requirements: requirements(),
            environmentFacts: facts,
            acknowledgements: acks,
        });
    }
    /**
     * Durably replace the compatibility state with ONE conditioned write:
     * `replaceIfGeneration(record, expectedGeneration)` commits only while the
     * row still carries the generation the caller read (`0` = the caller read no
     * row, and the transition is a single create). No delete is involved, so the
     * row is never observable as ABSENT and a crash mid-write keeps the previous
     * row — the module docs state exactly what that guarantees and what it does
     * not.
     *
     * S1-A hook B: the compatibility state is durable team state that never
     * passes through a ledger fact, so this replaceState is the state's own stamp
     * choke point. The generation advance happens only AFTER the state transition
     * is durable (a rejected compare-and-set advances nothing), the same
     * state-durable-before-stamp order and v1 lag model as hook A. Warning-ACK
     * writes take the same replaceState path and are covered here.
     *
     * A lost compare-and-set REJECTS here with the typed `RECORD_DUPLICATE`
     * (`isLostStateRace` classifies it) and this method keeps rejecting: a caller
     * of `probe()` asked for THIS probe's verdict; the decision to converge on
     * the winner's row belongs to the freshness paths, not to the prober.
     */
    async function replaceState(record, expectedGeneration) {
        await repositories.compatibility.replaceIfGeneration(record, expectedGeneration);
        await repositories.teamSessions.advanceGeneration(rootSessionId);
    }
    function verdictOf(result, recordedAt, generation) {
        return {
            recordedAt,
            generation,
            environmentFingerprint: result.environmentFingerprint,
            status: result.status,
            pass: result.counts.pass,
            warning: result.counts.warning,
            fatal: result.counts.fatal,
            unackedWarning: result.counts.unackedWarning,
        };
    }
    async function probe(trigger) {
        return withLock(async () => {
            const previous = await repositories.compatibility.get(rootSessionId);
            const result = await evaluateFresh(previous !== undefined ? previous.acknowledgements : []);
            const recordedAt = now();
            const expectedGeneration = previous !== undefined ? previous.generation : 0;
            const generation = expectedGeneration + 1;
            const record = {
                schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
                rootSessionId: rootId,
                status: result.status,
                fingerprint: result.environmentFingerprint,
                generation,
                outcomes: outcomesOf(result),
                acknowledgements: previous !== undefined ? [...previous.acknowledgements] : [],
                computedAt: recordedAt,
            };
            await replaceState(record, expectedGeneration);
            const verdict = verdictOf(result, recordedAt, generation);
            const outcome = { ...verdict, trigger };
            const drift = classifyDrift(previous, verdict);
            const observer = deps.onProbe;
            if (observer !== undefined) {
                try {
                    observer(outcome, drift);
                }
                catch {
                    // The observer is a provenance channel; a fault never fails
                    // the probe (the durable state is authoritative).
                }
            }
            return outcome;
        });
    }
    async function acknowledge(input) {
        return withLock(async () => {
            const previous = await repositories.compatibility.get(rootSessionId);
            const previousAcks = previous !== undefined ? previous.acknowledgements : [];
            // ONE facts read: the ack must bind to the exact mismatch +
            // environment fingerprint pair of THIS evaluation (§27.3) — the
            // re-evaluation below reuses the same facts so the bound pair cannot
            // drift between the two classifications.
            const facts = await deps.environmentFacts();
            const result = evaluateCompatibility({
                requirements: requirements(),
                environmentFacts: facts,
                acknowledgements: previousAcks,
            });
            const target = result.requirements.find((requirement) => requirement.requirementId === input.requirementId);
            if (target === undefined) {
                throw new CompatibilityError(COMPATIBILITY_ERROR_CODES.ACK_TARGET_NOT_WARNING, `compatibility: no requirement '${input.requirementId}' in the bound blueprint's evaluation (nothing to acknowledge)`, { rootSessionId, requirementId: input.requirementId, outcome: 'ABSENT' });
            }
            if (target.outcome === 'FATAL') {
                throw new CompatibilityError(COMPATIBILITY_ERROR_CODES.FATAL_NOT_ACKNOWLEDGABLE, `compatibility: FATAL requirement '${target.requirementId}' is not ack-able (Architecture §27.2: FATAL 不允许 Continue Anyway)`, {
                    rootSessionId,
                    requirementId: target.requirementId,
                    reasonCode: target.reasonCode,
                    detail: target.detail,
                });
            }
            if (target.outcome === 'PASS' || target.mismatchFingerprint === null) {
                throw new CompatibilityError(COMPATIBILITY_ERROR_CODES.ACK_TARGET_NOT_WARNING, `compatibility: requirement '${target.requirementId}' is PASS in the current evaluation — there is no mismatch to bind an acknowledgement to (Architecture §27.3)`, { rootSessionId, requirementId: target.requirementId, outcome: 'PASS' });
            }
            // The ack binds to the CURRENT mismatch + environment generation
            // (§27.3): exactly this fingerprint pair, never a global flag.
            const ack = {
                requirementId: target.requirementId,
                mismatchFingerprint: target.mismatchFingerprint,
                environmentFingerprint: result.environmentFingerprint,
                acknowledgedBy: input.acknowledgedBy,
                acknowledgedAt: now(),
                ...(input.note !== undefined ? { note: input.note } : {}),
            };
            const reResult = evaluateCompatibility({
                requirements: requirements(),
                environmentFacts: facts,
                acknowledgements: [...previousAcks, ack],
            });
            const recordedAt = now();
            const expectedGeneration = previous !== undefined ? previous.generation : 0;
            const generation = expectedGeneration + 1;
            const record = {
                schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
                rootSessionId: rootId,
                status: reResult.status,
                fingerprint: reResult.environmentFingerprint,
                generation,
                outcomes: outcomesOf(reResult),
                acknowledgements: [...previousAcks, ack],
                computedAt: recordedAt,
            };
            await replaceState(record, expectedGeneration);
            return verdictOf(reResult, recordedAt, generation);
        });
    }
    /**
     * Establish a durable generation carrying `liveFingerprint`, CONVERGING on a
     * concurrent winner when this probe loses the compare-and-set.
     *
     * A loser of the conditioned write is not in a failed state: another writer
     * just committed a state built from the same live facts. When that row
     * carries the fingerprint this caller wanted, the freshness establishment it
     * was waiting for HAS happened — durably, by the winner, with the winner's
     * probe recorded behind the winner's `onProbe`. Repeating the probe would
     * burn a generation on work the durable state already reflects, and refusing
     * the consultation would refuse work the state permits (the false
     * ACTIVATION_COMPATIBILITY_BLOCKED_FATAL the p6t1 escalation measured). So the
     * loser returns, and the caller's own re-read of the row is what it acts on.
     *
     * Everything else still fails closed, unchanged: a non-race fault propagates,
     * and a lost race whose row is absent or carries a DIFFERENT fingerprint (the
     * winner probed a different environment) propagates too — converging there
     * would trust a state that does not describe the live environment.
     */
    async function probeToEstablish(liveFingerprint) {
        try {
            await probe(PROBE_TRIGGERS.STALE_GENERATION_BEFORE_NEW_WORK);
        }
        catch (error) {
            if (!isLostStateRace(error))
                throw error;
            const row = await repositories.compatibility.get(rootSessionId);
            if (row === undefined || row.fingerprint !== liveFingerprint)
                throw error;
            // Converged on the winner's row; the caller re-reads it.
        }
    }
    /**
     * The freshness gate (DevPlan §20.1 trigger 5): a missing or stale
     * durable generation forces a re-probe BEFORE any admission decision.
     * "Stale" = the live environment fingerprint (a fresh facts read)
     * differs from the durable fingerprint — this also covers the
     * "relevant capability generation change" trigger, because the
     * generation is part of the probe record and therefore of the
     * fingerprint.
     */
    async function ensureFreshGeneration() {
        const liveFacts = await deps.environmentFacts();
        const liveFingerprint = computeEnvironmentFingerprint(requirements(), liveFacts);
        const state = await repositories.compatibility.get(rootSessionId);
        if (state === undefined || state.fingerprint !== liveFingerprint) {
            await probeToEstablish(liveFingerprint);
            const fresh = await repositories.compatibility.get(rootSessionId);
            if (fresh === undefined) {
                throw new CompatibilityError(COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED, `compatibility: the re-probe did not establish a durable state for '${rootSessionId}' (fail closed, §28.1)`, { rootSessionId, problem: 'no-durable-state-after-probe' });
            }
            return fresh;
        }
        return state;
    }
    /** The §28 gate: throw when new work must be blocked. */
    function gateNewWork(state) {
        if (state.status === 'BLOCKED_WARNING' || state.status === 'BLOCKED_FATAL') {
            throw new CompatibilityError(COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED, `compatibility: the team's compatibility state is ${state.status} —new work admission is blocked (DevPlan §20.1: 新 warning block NEW work; Architecture §28.1/§41.7); already admitted work may still settle (§28.2)`, {
                rootSessionId,
                status: state.status,
                fingerprint: state.fingerprint,
                generation: state.generation,
                blockingRequirementIds: blockingRequirementIdsOf(state),
            });
        }
    }
    async function admitNewWork(workKey) {
        const state = await ensureFreshGeneration();
        gateNewWork(state);
        const decision = await withLock(async () => {
            workCounter += 1;
            const workId = `work-${workCounter}`;
            const entry = {
                workId,
                workKey,
                admittedAt: now(),
                admittedGeneration: state.generation,
                admittedStatus: state.status,
                settled: false,
            };
            inFlight.set(workId, entry);
            return {
                admitted: true,
                workId,
                status: state.status,
                fingerprint: state.fingerprint,
                generation: state.generation,
            };
        });
        return decision;
    }
    async function settleWork(workId) {
        // §28.2: this path NEVER reads the compatibility state —drift does
        // not cancel in-flight work; settling is always allowed for a work
        // this prober admitted.
        const entry = inFlight.get(workId);
        if (entry === undefined) {
            throw new CompatibilityError(COMPATIBILITY_ERROR_CODES.WORK_UNKNOWN, `compatibility: work '${workId}' was never admitted by this prober`, { rootSessionId, workId });
        }
        if (entry.settled) {
            throw new CompatibilityError(COMPATIBILITY_ERROR_CODES.WORK_ALREADY_SETTLED, `compatibility: work '${workId}' already settled`, { rootSessionId, workId, admittedGeneration: entry.admittedGeneration });
        }
        entry.settled = true;
        return {
            workId,
            settledAt: now(),
            admittedGeneration: entry.admittedGeneration,
        };
    }
    async function enforceNewWorkAdmission() {
        const state = await ensureFreshGeneration();
        gateNewWork(state);
    }
    return {
        rootSessionId,
        probe,
        current: async () => repositories.compatibility.get(rootSessionId),
        acknowledge,
        admitNewWork,
        settleWork,
        enforceNewWorkAdmission,
    };
}
//# sourceMappingURL=probe.js.map