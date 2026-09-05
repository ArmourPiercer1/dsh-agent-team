/**
 * The operation journal engine (TaskDoc §11.5 P4-T2).
 *
 * Implements the vNext crash model (Development Plan §17.3, Architecture
 * §14.4) over the P4-T1 `operations` and `ledger` repositories:
 *
 * ```text
 * PREPARED operation → idempotent effects → ledger fact → COMMITTED
 * ```
 *
 * with the generation CAS (`expectedGeneration`) as the optimistic
 * concurrency guard on the journal row, and roll-forward (never rollback)
 * as the only recovery strategy: a crash between ANY two durable writes
 * leaves a state that re-driving the same operation converges to the same
 * durable result. The engine performs ZERO deletes: sidecar rows are never
 * rolled back, only reconciled forward (orphan rows — e.g. an externally
 * created child session whose TeamDomain writes never landed — are
 * diagnosed by their absence from the journal, Development Plan §17.4).
 *
 * Team scoping: one journal instance is bound to ONE TeamSession
 * (`rootSessionId`). The frozen v1 `OperationRecord` carries no team field
 * (the operations store is global across teams), so team scoping is a
 * journal-level concern: the request needs no root (the journal adds it),
 * and every ledger fact this journal writes (or reads for
 * `lastApplied()`/`factSequence()`) is verified against the bound team.
 *
 * `lastAppliedOperationId` embodiment: the frozen v1 target DTOs carry no
 * such field (verified by inspection of `packages/contracts`), so the
 * durable "this operation was applied to this team" marker is the ledger
 * FACT's `operationId` link: `lastApplied()` returns the operation id of
 * the highest-sequence fact of the bound team that links one.
 *
 * Concurrency: per-operationId process-local async serialization (a chain
 * of settled promises) COMPLEMENTS — it does not replace — the domain
 * write chain. There is no cross-process guarantee (Architecture §14.4:
 * in-domain write serialization only); a second process re-driving the
 * same operation relies on the row-level CAS and the ledger/repository
 * conflict tags to fail loudly instead of double-applying.
 *
 * Error discipline: every failure is a `TeamDomainError`; consumers branch
 * on `code` + `details.problem` (see `JOURNAL_PROBLEMS`), never on
 * message text.
 * @module @dsh-agent-team/storage/operations/journal
 */
import { canonicalJsonStringify, isTeamContractError, parseRootSessionId } from '../../contracts/src/index.js';
import { errorMessage, isTeamDomainError, normalizeValidationError, OPERATION_PHASES, OPERATION_TERMINAL_PHASES, TEAM_DOMAIN_SCHEMA_VERSION, teamDomainError, } from '../schema/index.js';
import { JOURNAL_PROBLEMS, } from './types.js';
/**
 * Build the operation journal of one TeamSession.
 *
 * @param domain - The open TeamDomain (sole sidecar access for the protocol AND for the effects).
 * @param rootSessionId - The team (root session id) this journal is scoped to.
 * @param effects - Optional intent → idempotent effects resolver (bound once; the resolver of an intent type must stay stable for the lifetime of that operation).
 * @throws `RECORD_INVALID` (`normalizeValidationError`) when `rootSessionId` is not a valid root session id.
 */
export function createOperationJournal(domain, rootSessionId, effects) {
    let root;
    try {
        root = parseRootSessionId(rootSessionId);
    }
    catch (error) {
        throw normalizeValidationError(error, 'operations');
    }
    const operations = domain.repositories.operations;
    const ledger = domain.repositories.ledger;
    /** Per-operationId serialization gate (process-local; see module docs). */
    const locks = new Map();
    // ---------------------------------------------------------------- helpers
    function nowIso() {
        return new Date().toISOString();
    }
    function resolveEffects(intent) {
        return effects === undefined ? [] : effects(intent);
    }
    /**
     * Run `work` with per-operationId serialization. The gate chains onto the
     * PREVIOUS settled task (success or failure), so a failed drive never
     * wedges later drives of the same operation.
     */
    function withOperationLock(operationId, work) {
        const previous = locks.get(operationId) ?? Promise.resolve();
        const gate = previous.then(() => undefined, () => undefined);
        const task = gate.then(work);
        const settled = task.then(() => undefined, () => undefined);
        locks.set(operationId, settled);
        void settled.then(() => {
            if (locks.get(operationId) === settled)
                locks.delete(operationId);
        });
        return task;
    }
    /** The ledger fact linking `operationId` (any team — callers verify scope), or `undefined`. */
    function findFact(operationId) {
        for (const entry of ledger.list()) {
            if (entry.operationId === operationId)
                return entry;
        }
        return undefined;
    }
    function isOurFact(operationId, factRoot) {
        return factRoot === String(root);
    }
    // ------------------------------------------------------------------ errors
    function idempotencyConflict(operationId, message, extra = {}) {
        return teamDomainError('RECORD_DUPLICATE', message, {
            store: 'operations',
            key: operationId,
            problem: JOURNAL_PROBLEMS.IDEMPOTENCY_CONFLICT,
            ...extra,
        });
    }
    function factTeamConflict(operationId, message, foundRoot) {
        return teamDomainError('RECORD_DUPLICATE', message, {
            store: 'ledger',
            key: operationId,
            problem: JOURNAL_PROBLEMS.IDEMPOTENCY_CONFLICT,
            expected: String(root),
            found: foundRoot,
        });
    }
    function staleGeneration(operationId, expected, found) {
        return teamDomainError('RECORD_INVALID', `operation '${operationId}' generation CAS failed: expected ${expected}, found ${found === null ? 'no row' : found}`, { store: 'operations', key: operationId, problem: JOURNAL_PROBLEMS.STALE_GENERATION, expected, found });
    }
    function operationNotFound(operationId) {
        return teamDomainError('RECORD_INVALID', `operation '${operationId}' has no durable journal row`, {
            store: 'operations',
            key: operationId,
            problem: JOURNAL_PROBLEMS.OPERATION_NOT_FOUND,
        });
    }
    function childSessionConflict(operationId, recorded, provided) {
        return teamDomainError('RECORD_DUPLICATE', `operation '${operationId}' already records a different external child session`, {
            store: 'operations',
            key: operationId,
            problem: JOURNAL_PROBLEMS.CHILD_SESSION_CONFLICT,
            expected: recorded,
            found: provided,
        });
    }
    function terminalOperation(row) {
        return teamDomainError('RECORD_DUPLICATE', `operation '${row.operationId}' is terminal in phase '${row.phase}' and immutable`, {
            store: 'operations',
            key: row.operationId,
            problem: JOURNAL_PROBLEMS.TERMINAL_OPERATION,
            phase: row.phase,
        });
    }
    /**
     * Effect error classification (mirrors `BaseRepository.updateRaw`):
     * TeamDomain/contracts errors pass through UNCHANGED (the typed conflict
     * is the effect's answer); anything else is wrapped as `SEAM_FAILURE`
     * with `unclassified-effect-error`.
     */
    function classifyEffectError(error, effectName) {
        if (isTeamDomainError(error) || isTeamContractError(error))
            return error;
        return teamDomainError('SEAM_FAILURE', `effect '${effectName}' failed: ${errorMessage(error)}`, {
            problem: JOURNAL_PROBLEMS.UNCLASSIFIED_EFFECT_ERROR,
            effect: effectName,
        });
    }
    // ---------------------------------------------------------- verification
    /**
     * The idempotency identity check on a stored row: same operationId +
     * different key, or a different canonical intent, is a loud conflict
     * (never a silent re-prepare). Checked BEFORE any write.
     */
    function verifyRequestIdentity(row, request) {
        if (row.idempotencyKey !== request.idempotencyKey) {
            throw idempotencyConflict(row.operationId, `operation '${row.operationId}' was prepared under a different idempotency key`, { expected: row.idempotencyKey, found: request.idempotencyKey });
        }
        if (canonicalJsonStringify(row.intent) !== canonicalJsonStringify(request.intent)) {
            throw idempotencyConflict(row.operationId, `operation '${row.operationId}' was re-submitted with a different intent`, {
                intentChanged: true,
            });
        }
    }
    function verifyGeneration(operationId, row, expected) {
        const found = row === undefined ? null : row.generation;
        // `expectedGeneration: 0` means "expect the row to be absent": an
        // absent row (found === null) satisfies exactly that CAS.
        const effective = found === null ? 0 : found;
        if (effective !== expected)
            throw staleGeneration(operationId, expected, found);
    }
    // ------------------------------------------------------------- transitions
    /**
     * Re-verify (or first record) the PREPARED row. Idempotent: an existing
     * row is returned as-is (no write, no generation bump); a provided child
     * session is recorded when the (non-terminal) row does not carry one yet.
     */
    async function prepareInternal(request) {
        const existing = operations.get(request.operationId);
        if (existing !== undefined) {
            verifyRequestIdentity(existing, request);
            if (OPERATION_TERMINAL_PHASES.includes(existing.phase)) {
                if (request.childSessionId !== undefined && existing.childSessionId !== request.childSessionId) {
                    throw terminalOperation(existing);
                }
                return existing;
            }
            return ensureChildSession(existing, request.childSessionId);
        }
        return operations.put({
            schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
            operationId: request.operationId,
            idempotencyKey: request.idempotencyKey,
            intent: request.intent,
            phase: OPERATION_PHASES.PREPARED,
            ...(request.childSessionId !== undefined ? { childSessionId: request.childSessionId } : {}),
            updatedAt: nowIso(),
            generation: 1,
        });
    }
    /**
     * Record `childSessionId` on one PREPARED row (generation bump).
     * `undefined` / identical → the row is returned unchanged; a different
     * recorded child → `child-session-conflict`. Terminal rows are handled by
     * the caller (they must not reach here).
     */
    async function ensureChildSession(row, childSessionId) {
        if (childSessionId === undefined)
            return row;
        if (row.childSessionId === childSessionId)
            return row;
        if (row.childSessionId !== undefined) {
            throw childSessionConflict(row.operationId, String(row.childSessionId), String(childSessionId));
        }
        return operations.put({
            schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
            operationId: row.operationId,
            idempotencyKey: row.idempotencyKey,
            intent: row.intent,
            phase: row.phase,
            childSessionId,
            updatedAt: nowIso(),
            generation: row.generation + 1,
        });
    }
    /**
     * The durable result of a terminal row (no re-apply, no writes):
     * effectsApplied/effectsSkipped report 0/0 — nothing was done by this
     * call; the ledger sequence is the fact's (or `undefined` if the fact is
     * missing, which can only happen to a FAILED row or a pre-protocol row).
     */
    function durableResult(row) {
        const fact = findFact(row.operationId);
        return {
            operationId: row.operationId,
            record: row,
            phase: row.phase,
            ledgerSequence: fact === undefined ? undefined : fact.sequence,
            effectsApplied: 0,
            effectsSkipped: 0,
        };
    }
    /**
     * The apply phase of one non-terminal row: idempotent effects (in
     * declaration order) → duplicate-prevented ledger fact → COMMITTED.
     * `fact` is the pre-scan result (under the per-operation lock a fresh
     * scan would see the same thing; passing it avoids a second list).
     */
    async function applyPhase(row, fact) {
        let effectsApplied = 0;
        let effectsSkipped = 0;
        for (const effect of resolveEffects(row.intent)) {
            let outcome;
            try {
                outcome = await effect.apply({ domain, rootSessionId: root, operation: row });
            }
            catch (error) {
                throw classifyEffectError(error, effect.name);
            }
            if (outcome.applied)
                effectsApplied += 1;
            else
                effectsSkipped += 1;
        }
        let durableFact = fact;
        if (durableFact === undefined) {
            const sequence = await ledger.allocateSequence();
            durableFact = await ledger.put({
                schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
                sequence,
                rootSessionId: root,
                factType: row.intent.type,
                payload: row.intent.payload,
                operationId: row.operationId,
                createdAt: nowIso(),
            });
        }
        const committed = await operations.put({
            schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
            operationId: row.operationId,
            idempotencyKey: row.idempotencyKey,
            intent: row.intent,
            phase: OPERATION_PHASES.COMMITTED,
            ...(row.childSessionId !== undefined ? { childSessionId: row.childSessionId } : {}),
            updatedAt: nowIso(),
            generation: row.generation + 1,
        });
        return {
            operationId: row.operationId,
            record: committed,
            phase: OPERATION_PHASES.COMMITTED,
            ledgerSequence: durableFact.sequence,
            effectsApplied,
            effectsSkipped,
        };
    }
    /**
     * Drive one existing row from its stored state (CAS → foreign-fact scope
     * check → terminal short-circuit → apply phase). The scope check runs
     * BEFORE the terminal short-circuit so that a COMMITTED row whose fact
     * belongs to a different team is rejected — matching `execute` — rather
     * than silently served from a foreign ledger.
     */
    async function driveRow(row, options) {
        if (options?.expectedGeneration !== undefined)
            verifyGeneration(row.operationId, row, options.expectedGeneration);
        const fact = findFact(row.operationId);
        if (fact !== undefined && !isOurFact(row.operationId, String(fact.rootSessionId))) {
            throw factTeamConflict(row.operationId, `operation '${row.operationId}' was already committed under a different team`, String(fact.rootSessionId));
        }
        if (OPERATION_TERMINAL_PHASES.includes(row.phase))
            return durableResult(row);
        return applyPhase(row, fact);
    }
    // -------------------------------------------------------------- public API
    const journal = {
        rootSessionId: root,
        async execute(request, options) {
            return withOperationLock(request.operationId, async () => {
                const existing = operations.get(request.operationId);
                if (existing !== undefined) {
                    if (options?.expectedGeneration !== undefined)
                        verifyGeneration(request.operationId, existing, options.expectedGeneration);
                    verifyRequestIdentity(existing, request);
                    const fact = findFact(request.operationId);
                    if (fact !== undefined && !isOurFact(request.operationId, String(fact.rootSessionId))) {
                        throw factTeamConflict(request.operationId, `operation '${request.operationId}' was already committed under a different team`, String(fact.rootSessionId));
                    }
                    if (OPERATION_TERMINAL_PHASES.includes(existing.phase)) {
                        if (request.childSessionId !== undefined && existing.childSessionId !== request.childSessionId) {
                            throw terminalOperation(existing);
                        }
                        return durableResult(existing);
                    }
                    const current = await ensureChildSession(existing, request.childSessionId);
                    return applyPhase(current, fact);
                }
                if (options?.expectedGeneration !== undefined)
                    verifyGeneration(request.operationId, undefined, options.expectedGeneration);
                const prepared = await prepareInternal(request);
                return applyPhase(prepared, findFact(prepared.operationId));
            });
        },
        async prepare(request) {
            return withOperationLock(request.operationId, () => prepareInternal(request));
        },
        async drive(operationId, options) {
            return withOperationLock(operationId, async () => {
                const row = operations.get(operationId);
                if (row === undefined)
                    throw operationNotFound(operationId);
                return driveRow(row, options);
            });
        },
        async fail(operationId, diagnostic) {
            return withOperationLock(operationId, async () => {
                const row = operations.get(operationId);
                if (row === undefined)
                    throw operationNotFound(operationId);
                if (row.phase === OPERATION_PHASES.FAILED) {
                    if (row.failureDiagnostic === diagnostic)
                        return row;
                    throw terminalOperation(row);
                }
                if (OPERATION_TERMINAL_PHASES.includes(row.phase))
                    throw terminalOperation(row);
                return operations.put({
                    schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
                    operationId: row.operationId,
                    idempotencyKey: row.idempotencyKey,
                    intent: row.intent,
                    phase: OPERATION_PHASES.FAILED,
                    ...(row.childSessionId !== undefined ? { childSessionId: row.childSessionId } : {}),
                    failureDiagnostic: diagnostic,
                    updatedAt: nowIso(),
                    generation: row.generation + 1,
                });
            });
        },
        async recordChildSession(operationId, childSessionId) {
            return withOperationLock(operationId, async () => {
                const row = operations.get(operationId);
                if (row === undefined)
                    throw operationNotFound(operationId);
                if (OPERATION_TERMINAL_PHASES.includes(row.phase))
                    throw terminalOperation(row);
                if (row.childSessionId === childSessionId)
                    return row;
                if (row.childSessionId !== undefined) {
                    throw childSessionConflict(operationId, String(row.childSessionId), String(childSessionId));
                }
                return operations.put({
                    schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
                    operationId: row.operationId,
                    idempotencyKey: row.idempotencyKey,
                    intent: row.intent,
                    phase: row.phase,
                    childSessionId,
                    updatedAt: nowIso(),
                    generation: row.generation + 1,
                });
            });
        },
        get(operationId) {
            return operations.get(operationId);
        },
        list() {
            return operations.list();
        },
        lastApplied() {
            let best;
            for (const entry of ledger.list()) {
                if (!isOurFact(entry.operationId ?? '', String(entry.rootSessionId)))
                    continue;
                if (entry.operationId === undefined)
                    continue;
                if (best === undefined || entry.sequence > best.sequence) {
                    best = { sequence: entry.sequence, operationId: entry.operationId };
                }
            }
            return best === undefined ? undefined : best.operationId;
        },
        factSequence(operationId) {
            const fact = findFact(operationId);
            if (fact === undefined)
                return undefined;
            if (!isOurFact(operationId, String(fact.rootSessionId))) {
                throw factTeamConflict(operationId, `operation '${operationId}' was committed under a different team`, String(fact.rootSessionId));
            }
            return fact.sequence;
        },
    };
    return journal;
}
//# sourceMappingURL=journal.js.map