/**
 * The `team` category handler (design note §3): TeamSession creation,
 * whole-projection observation, and ledger pages. Backed by three ports:
 * {@link RemoteTeamCreatePort} (root binding, P5-T5),
 * {@link RemoteProjectionPort} (ProjectionService, P8-T2), and
 * {@link RemoteLedgerPort} (storage ledger behind a slicing adapter, D-5).
 *
 * The projection is validated at the TOP LEVEL only (D-4): the nine frozen
 * `TeamProjectionDto` fields must be present with the right structural
 * kinds; the nested values pass through. The whole-projection `generation`
 * rides in the reply's provenance (G8 staleness detection).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/team
 */
import { remoteContractError } from '../contracts/errors.js';
import { REMOTE_LEDGER_ENTRY_FIELDS, REMOTE_PROJECTION_FIELDS, } from '../contracts/types.js';
/** Is `value` a plain (non-array) object? */
function isPlainRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
}
/** A port returned a structurally wrong value: a boundary failure. */
function portContractError(field, problem) {
    return remoteContractError('internal-error', `remote backing port returned a malformed value at '${field}': ${problem}`, { field, reason: 'port-contract' });
}
/** Normalize one projection to the closed top-level shape (D-4). */
function normalizeProjection(raw) {
    if (!isPlainRecord(raw)) {
        throw portContractError('projection', `expected an object, got ${String(raw)}`);
    }
    for (const field of REMOTE_PROJECTION_FIELDS) {
        if (!(field in raw)) {
            throw portContractError(`projection.${field}`, 'missing field');
        }
    }
    const schemaVersion = raw['schemaVersion'];
    const generation = raw['generation'];
    if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion)) {
        throw portContractError('projection.schemaVersion', 'must be a safe integer');
    }
    if (typeof generation !== 'number' || !Number.isSafeInteger(generation) || generation < 1) {
        throw portContractError('projection.generation', 'must be a safe integer >= 1');
    }
    return raw;
}
/** Normalize one ledger entry to the closed wire shape. */
function normalizeLedgerEntry(raw) {
    if (!isPlainRecord(raw)) {
        throw portContractError('ledger entry', `expected an object, got ${String(raw)}`);
    }
    for (const field of REMOTE_LEDGER_ENTRY_FIELDS) {
        if (field === 'operationId')
            continue; // optional on the storage row
        if (!(field in raw)) {
            throw portContractError(`ledger entry.${field}`, 'missing field');
        }
    }
    const schemaVersion = raw['schemaVersion'];
    if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion)) {
        throw portContractError('ledger entry.schemaVersion', 'must be a safe integer');
    }
    const sequence = raw['sequence'];
    if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 1) {
        throw portContractError('ledger entry.sequence', 'must be a safe integer >= 1');
    }
    const rootSessionId = raw['rootSessionId'];
    if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) {
        throw portContractError('ledger entry.rootSessionId', 'must be a non-empty string');
    }
    const factType = raw['factType'];
    if (typeof factType !== 'string' || factType.length === 0) {
        throw portContractError('ledger entry.factType', 'must be a non-empty string');
    }
    const payload = raw['payload'];
    if (!isPlainRecord(payload)) {
        throw portContractError('ledger entry.payload', 'must be an object');
    }
    const createdAt = raw['createdAt'];
    if (typeof createdAt !== 'string' || createdAt.length === 0) {
        throw portContractError('ledger entry.createdAt', 'must be a non-empty string');
    }
    const operationId = raw['operationId'];
    if (operationId !== undefined && typeof operationId !== 'string') {
        throw portContractError('ledger entry.operationId', 'must be a string when present');
    }
    return {
        schemaVersion,
        sequence,
        rootSessionId,
        factType,
        // The port contract guarantees a lossless-JSON-safe record; the plain
        // record check above is the structural half of that guarantee.
        payload: payload,
        operationId: operationId === undefined ? null : operationId,
        createdAt,
    };
}
/**
 * The team category handler (`team.create`, `team.getProjection`,
 * `team.getLedgerPage`).
 */
export function createRemoteTeamHandler(ports) {
    return (method, params) => {
        switch (method) {
            case 'team.create': {
                const createParams = params;
                const teamCreate = ports.teamCreate;
                const created = teamCreate.create(createParams.rootSessionId, createParams.blueprintId, createParams.blueprintRevision, createParams.initialWork);
                if (!isPlainRecord(created)) {
                    throw portContractError('teamCreate', `expected an object, got ${String(created)}`);
                }
                const path = created['path'];
                if (path !== 'fresh-root' && path !== 'cold-root') {
                    throw portContractError('teamCreate.path', `must be 'fresh-root' or 'cold-root', got ${String(path)}`);
                }
                const durable = created['durable'];
                if (durable !== undefined &&
                    durable !== null &&
                    (typeof durable !== 'object' || Array.isArray(durable))) {
                    throw portContractError('teamCreate.durable', 'must be an object or null');
                }
                const bind = created['bind'];
                if (!isPlainRecord(bind)) {
                    throw portContractError('teamCreate.bind', 'must be an object');
                }
                return {
                    data: {
                        path,
                        durable: durable === undefined ? null : durable,
                        bind,
                    },
                };
            }
            case 'team.getProjection': {
                const projectionParams = params;
                const raw = ports.projection.project(projectionParams.teamSessionId);
                const projection = normalizeProjection(raw);
                return {
                    data: { projection },
                    projectionGeneration: projection.generation,
                };
            }
            case 'team.getLedgerPage': {
                const pageParams = params;
                const allEntries = ports.ledger.listEntries(pageParams.teamSessionId);
                const entriesAfter = [];
                for (const rawEntry of allEntries) {
                    const entry = normalizeLedgerEntry(rawEntry);
                    if (entry.sequence > pageParams.afterSequence)
                        entriesAfter.push(entry);
                }
                const page = entriesAfter.slice(0, pageParams.limit);
                let nextAfterSequence = null;
                if (entriesAfter.length > pageParams.limit) {
                    const last = page[page.length - 1];
                    if (last === undefined) {
                        throw portContractError('ledger page', 'internal slicing error');
                    }
                    nextAfterSequence = last.sequence;
                }
                return {
                    data: {
                        entries: page,
                        nextAfterSequence,
                        total: ports.ledger.countEntries(pageParams.teamSessionId),
                    },
                };
            }
            default:
                throw new Error(`team handler routed an unknown method: ${method}`);
        }
    };
}
//# sourceMappingURL=team.js.map