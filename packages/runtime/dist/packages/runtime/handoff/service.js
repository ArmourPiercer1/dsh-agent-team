/**
 * Start Team from Here — the handoff service
 * (TaskDoc §11.8 P7-T5; DevPlan §20.5; Architecture §34).
 *
 * The frozen one-shot flow (DevPlan §20.5 / Architecture §34.2):
 *
 * ```text
 * ordinary Session A
 * → freeze canonical surface      (EXACTLY ONE read, §34.2 stage 1)
 * → one-shot summary              (injected §34.4 auxiliary capability)
 * → new TeamIntent                (staged fields + optional provenance,
 *                                   Architecture §7.2)
 * → new Root B / TeamSession B    (DELEGATED to the injected public Team
 *                                   creation entry — the module owns no
 *                                   creation path of its own)
 * ```
 *
 * The §34.3 live-link prohibitions, enforced here:
 *
 * - **snapshot once** — the source surface port is called exactly once
 *   per operation; a same-token replay and a summarization `retry`
 *   re-use the frozen snapshot and never re-read the source;
 * - **B does not reread A later** — the module keeps no accessor that
 *   re-reads the source; the frozen context is the complete source
 *   knowledge of the new team;
 * - **changes in A do not mutate B handoff** — the snapshot is a DETACHED
 *   deep lossless-JSON copy, deep-frozen at materialization;
 * - **B cannot history_read(A) / B cannot search A** —
 *   {@link HandoffService.querySourceHistoryFromTarget} ALWAYS rejects
 *   with `HANDOFF_SOURCE_HISTORY_ACCESS_DENIED`; the presented context
 *   token never grants anything;
 * - **`sourceSessionId` is provenance/navigation metadata, not a read
 *   grant** — the context is pure lossless-JSON data (no functions, no
 *   handles), checked structurally by the tests.
 *
 * The §34.4 failure rule, enforced here: a failed one-shot summarization
 * is CARRIED on the observable state as `awaiting-decision` with the
 * explicit triad Retry / Continue without handoff / Cancel — never thrown
 * away silently, never pretended as a successful handoff. A failed team
 * creation (after the context is frozen) is carried as `creation-failed`;
 * a re-invocation retries the creation idempotently (same stable
 * intentToken, Architecture §18.2).
 *
 * State discipline: the operation registry is IN-MEMORY and
 * process-lifetime — the module owns no durable state; TeamDomain
 * remains the only durable boundary (Architecture §42 invariant 41).
 *
 * Pure orchestration module: no I/O, no `node:` builtins, no live
 * Agent, no creation-path import (see `p7t5-no-creation-scan.mjs`).
 * @module @dsh-agent-team/runtime/handoff/service
 */
import { assertRemoteSafeJsonValue, canonicalJsonStringify, deepFreeze, isRemoteSafeJsonValue, parseSessionId, } from '../../contracts/src/index.js';
import { sha256Hex } from '../../domain/blueprint/src/index.js';
import { HANDOFF_ERROR_CODES, HandoffError, } from './errors.js';
import { HANDOFF_DECISION_OPTIONS } from './types.js';
/** One handoff service instance over one fixed port set. */
export function createHandoffService(ports) {
    /** The in-memory operation registry (keyed by
     *  `sourceSessionId + \u0000 + requestToken`). */
    const operations = new Map();
    const service = {
        async startTeamFromHere(request) {
            const sourceSessionId = assertSessionId(request?.sourceSessionId, 'sourceSessionId');
            const requestToken = assertRequestToken(request?.requestToken);
            const staged = assertStaged(request?.staged);
            const key = operationKey(sourceSessionId, requestToken);
            const existing = operations.get(key);
            if (existing !== undefined) {
                if (existing.inflight !== undefined) {
                    // A concurrent fresh start is already driving the pipeline:
                    // coalesce (the source is read once either way).
                    return await existing.inflight;
                }
                const stored = existing.state;
                if (stored !== undefined &&
                    (stored.kind === 'completed' ||
                        stored.kind === 'completed-without-handoff' ||
                        stored.kind === 'canceled' ||
                        stored.kind === 'awaiting-decision')) {
                    // Idempotent replay: the one-shot context is never
                    // re-materialized, the source is never re-read, the creation
                    // entry is never called again.
                    return { ...stored, replayed: true };
                }
                // `creation-failed`: re-drive ONLY the team creation with the
                // same stable intentToken (the context stays frozen; the source
                // is not re-read, the summary is not re-run).
                const reDrive = (async () => {
                    try {
                        return await createOnly(existing);
                    }
                    finally {
                        existing.inflight = undefined;
                    }
                })();
                existing.inflight = reDrive;
                return await reDrive;
            }
            const record = {
                sourceSessionId,
                requestToken,
                staged,
                creationMode: 'with-handoff',
            };
            operations.set(key, record);
            const pipeline = (async () => {
                try {
                    // --- stage 1: read the frozen current canonical surface —
                    // EXACTLY ONCE per operation (snapshot once, §34.2).
                    let raw;
                    try {
                        raw = await ports.sourceSurface.readCanonicalSurface(sourceSessionId);
                    }
                    catch (error) {
                        operations.delete(key);
                        throw new HandoffError(HANDOFF_ERROR_CODES.SOURCE_SURFACE_UNAVAILABLE, `the source canonical surface of '${sourceSessionId}' could not be read: ${describeError(error)}`);
                    }
                    // --- detach: a deep lossless-JSON copy — later changes in the
                    // source can never reach the handoff (§34.3) — then freeze.
                    let snapshot;
                    try {
                        snapshot = deepFreeze(JSON.parse(canonicalJsonStringify(raw)));
                    }
                    catch (error) {
                        operations.delete(key);
                        throw new HandoffError(HANDOFF_ERROR_CODES.SOURCE_SURFACE_UNAVAILABLE, `the source canonical surface of '${sourceSessionId}' is not a lossless-JSON value: ${describeError(error)}`);
                    }
                    record.surface = snapshot;
                    // --- stage 2+3: one-shot summary → new TeamIntent → new team.
                    return await summarizeAndCreate(record);
                }
                finally {
                    record.inflight = undefined;
                }
            })();
            record.inflight = pipeline;
            return await pipeline;
        },
        async resolveHandoffDecision(ref, decision) {
            const sourceSessionId = assertSessionId(ref?.sourceSessionId, 'sourceSessionId');
            const requestToken = assertRequestToken(ref?.requestToken);
            assertDecision(decision);
            const record = operations.get(operationKey(sourceSessionId, requestToken));
            if (record === undefined) {
                throw new HandoffError(HANDOFF_ERROR_CODES.OPERATION_UNKNOWN, `no handoff operation is known for '${sourceSessionId}' / '${requestToken}' on this service instance`);
            }
            const stored = record.state;
            if (stored === undefined || stored.kind === 'awaiting-decision') {
                if (stored === undefined) {
                    throw new HandoffError(HANDOFF_ERROR_CODES.OPERATION_UNKNOWN, `the handoff operation '${requestToken}' has no observable state yet`);
                }
            }
            else if (stored.kind === 'completed' ||
                stored.kind === 'completed-without-handoff' ||
                stored.kind === 'canceled') {
                throw new HandoffError(HANDOFF_ERROR_CODES.OPERATION_ALREADY_FINALIZED, `the handoff operation '${requestToken}' is already finalized (${stored.kind}) — a decision is one-shot`);
            }
            else {
                // stored.kind === 'creation-failed'
                throw new HandoffError(HANDOFF_ERROR_CODES.OPERATION_NOT_DECIDABLE, `the handoff operation '${requestToken}' is awaiting a team-creation re-drive, not a decision — re-invoke startTeamFromHere`);
            }
            // record.state is the awaiting-decision state (narrowed above).
            switch (decision) {
                case HANDOFF_DECISION_OPTIONS.RETRY:
                    // Re-summarize from the FROZEN snapshot — the source is NOT
                    // re-read (snapshot once); on success the team is created.
                    return await summarizeAndCreate(record);
                case HANDOFF_DECISION_OPTIONS.CONTINUE_WITHOUT_HANDOFF:
                    // Create the team WITHOUT the handoff context (§7.2: the
                    // TeamIntent's handoff provenance is optional).
                    record.creationMode = 'without-handoff';
                    return await createOnly(record);
                case HANDOFF_DECISION_OPTIONS.CANCEL: {
                    const state = {
                        kind: 'canceled',
                        replayed: false,
                    };
                    record.state = state;
                    return state;
                }
            }
        },
        /**
         * BQ-17 (P8-S7-R4 W2): the READ-ONLY operation state/provenance
         * view — a pure registry read (no mutation, no I/O, no source
         * re-read). An unknown (sourceSessionId, requestToken) pair is NOT
         * an error: it reports `known: false` with a null state.
         */
        describeOperation(sourceSessionId, requestToken) {
            const record = operations.get(operationKey(sourceSessionId, requestToken));
            if (record === undefined) {
                return {
                    sourceSessionId,
                    requestToken,
                    known: false,
                    snapshotStatus: 'absent',
                    state: null,
                    team: null,
                };
            }
            const snapshotStatus = record.context !== undefined
                ? 'context-frozen'
                : record.surface !== undefined
                    ? 'surface-frozen'
                    : 'absent';
            return {
                sourceSessionId,
                requestToken,
                known: true,
                snapshotStatus,
                state: record.state ?? null,
                team: record.team ?? null,
            };
        },
        async querySourceHistoryFromTarget(contextToken, query) {
            assertContextToken(contextToken);
            assertQuery(query);
            // Architecture §34.3: B cannot history_read(A); B cannot search A.
            // The rejection is unconditional: the presented context token is
            // provenance/navigation metadata, NOT a read grant — and the
            // source surface port is never touched by this path.
            throw new HandoffError(HANDOFF_ERROR_CODES.SOURCE_HISTORY_ACCESS_DENIED, `the target team has no history/search permission on the source session (one-shot handoff: no live link, Architecture §34.3)`, { contextToken, mode: query.mode });
        },
    };
    /**
     * Stage 2+3 for one record: the one-shot summarize/compress over the
     * FROZEN snapshot, then the delegated team creation (with or without
     * the handoff context per `record.creationMode`).
     */
    async function summarizeAndCreate(record) {
        // Invariant (unreachable in practice): this stage runs only after the
        // snapshot was detached and frozen (snapshot once).
        const surface = record.surface;
        if (surface === undefined) {
            throw new HandoffError(HANDOFF_ERROR_CODES.OPERATION_UNKNOWN, `the handoff operation '${record.requestToken}' has no frozen snapshot`);
        }
        let summary;
        let summaryError;
        try {
            summary = await ports.summarizer.summarize(surface);
        }
        catch (error) {
            summaryError = error;
        }
        // A summary that is not lossless JSON is a summarization failure
        // (the context must be pure data — no live values may enter it).
        if (summaryError === undefined && !isRemoteSafeJsonValue(summary)) {
            summaryError = new Error('the summarizer returned a non lossless-JSON summary');
        }
        if (summaryError !== undefined) {
            // Architecture §34.4: the failure is surfaced EXPLICITLY with the
            // Retry / Continue without handoff / Cancel triad — never silently
            // pretended as a successful handoff; NO team is created.
            const state = {
                kind: 'awaiting-decision',
                replayed: false,
                failure: toFailure(HANDOFF_ERROR_CODES.SUMMARIZATION_FAILED, summaryError),
                options: [
                    HANDOFF_DECISION_OPTIONS.RETRY,
                    HANDOFF_DECISION_OPTIONS.CONTINUE_WITHOUT_HANDOFF,
                    HANDOFF_DECISION_OPTIONS.CANCEL,
                ],
            };
            record.state = state;
            return state;
        }
        const context = deepFreeze({
            contextToken: contextTokenOf(record),
            sourceSessionId: record.sourceSessionId,
            capturedAt: ports.clock(),
            surface,
            summary: summary,
        });
        record.context = context;
        return await createOnly(record);
    }
    /**
     * The delegated team creation (the module's only team-adjacent effect,
     * and it is DELEGATED — the module owns no creation path of its own):
     * one staged TeamIntent (stable intentToken → idempotency contract)
     * into the public Team creation entry.
     */
    async function createOnly(record) {
        const intent = buildIntent(record);
        const context = record.context;
        try {
            const team = await ports.teamCreation.createTeam(intent);
            assertOutcome(team);
            record.team = team;
            // Invariant (unreachable otherwise): the `with-handoff` mode is
            // entered only after the one-shot context was materialized.
            const state = record.creationMode === 'with-handoff'
                ? {
                    kind: 'completed',
                    replayed: false,
                    context: context,
                    team,
                }
                : { kind: 'completed-without-handoff', replayed: false, team };
            record.state = state;
            return state;
        }
        catch (error) {
            // The context (if present) stays frozen; NO team exists; the
            // failure is carried explicitly — a re-invocation retries the
            // creation idempotently (same stable intentToken).
            const state = {
                kind: 'creation-failed',
                replayed: false,
                context,
                failure: toFailure(HANDOFF_ERROR_CODES.TEAM_CREATION_FAILED, error),
            };
            record.state = state;
            return state;
        }
    }
    /**
     * Build the staged TeamIntent for the next creation call. T12-B5
     * (plan §7-B3): the intentToken is the composite identity of the
     * `(sourceSessionId, requestToken)` pair — a replay re-derives the
     * same stable token (the idempotency contract), and a different
     * source can never collide with it (the BC: `(A,X)` and `(B,X)` are
     * different operations with different target roots). T12-B6 (plan
     * §7-B4): the with-handoff intent ALSO carries the frozen
     * `context` itself (lossless-JSON, the same value the `handoff`
     * provenance describes) — the creation entry delivers it into the
     * target Root Agent through the real Agent input/context seam; the
     * `handoff` field stays the identity-only provenance.
     */
    function buildIntent(record) {
        const context = record.context;
        if (record.creationMode === 'with-handoff' && context !== undefined) {
            return {
                intentToken: intentTokenOf(record),
                staged: record.staged,
                handoff: {
                    sourceSessionId: record.sourceSessionId,
                    contextToken: context.contextToken,
                    capturedAt: context.capturedAt,
                },
                context,
            };
        }
        return {
            intentToken: intentTokenOf(record),
            staged: record.staged,
        };
    }
    return service;
}
/**
 * Assert one DSH session id (the contracts structural rules) and return
 * its canonical string form.
 * @throws {HandoffError} `HANDOFF_REQUEST_MALFORMED`.
 */
function assertSessionId(value, label) {
    if (typeof value !== 'string') {
        throw new HandoffError(HANDOFF_ERROR_CODES.REQUEST_MALFORMED, `${label} must be a string`, { label, actual: typeof value });
    }
    try {
        return String(parseSessionId(value));
    }
    catch (error) {
        throw new HandoffError(HANDOFF_ERROR_CODES.REQUEST_MALFORMED, `${label} is not a structurally valid DSH session id: ${describeError(error)}`, { label });
    }
}
/**
 * Assert one request token (non-empty, ≤ 255 chars, no control
 * characters) and return it unchanged.
 * @throws {HandoffError} `HANDOFF_REQUEST_MALFORMED`.
 */
function assertRequestToken(value) {
    if (typeof value !== 'string' ||
        value.length === 0 ||
        value.length > 255 ||
        /\p{C}/u.test(value)) {
        throw new HandoffError(HANDOFF_ERROR_CODES.REQUEST_MALFORMED, 'requestToken must be a non-empty string of at most 255 characters without control characters');
    }
    return value;
}
/**
 * Assert the optional staged TeamIntent fields (a lossless-JSON record)
 * and return the effective value (`{}` when absent).
 * @throws {HandoffError} `HANDOFF_REQUEST_MALFORMED`.
 */
function assertStaged(value) {
    if (value === undefined)
        return {};
    if (typeof value !== 'object' ||
        value === null ||
        Array.isArray(value) ||
        !isRemoteSafeJsonValue(value)) {
        throw new HandoffError(HANDOFF_ERROR_CODES.REQUEST_MALFORMED, 'staged must be a lossless-JSON record (the staged TeamIntent fields)');
    }
    assertRemoteSafeJsonValue(value);
    return value;
}
/**
 * Assert one decision option against the closed §34.4 triad.
 * @throws {HandoffError} `HANDOFF_REQUEST_MALFORMED`.
 */
function assertDecision(value) {
    if (typeof value !== 'string' ||
        !(HANDOFF_DECISION_OPTIONS.RETRY === value ||
            HANDOFF_DECISION_OPTIONS.CONTINUE_WITHOUT_HANDOFF === value ||
            HANDOFF_DECISION_OPTIONS.CANCEL === value)) {
        throw new HandoffError(HANDOFF_ERROR_CODES.REQUEST_MALFORMED, `decision must be one of the explicit triad: ${HANDOFF_DECISION_OPTIONS.RETRY} | ${HANDOFF_DECISION_OPTIONS.CONTINUE_WITHOUT_HANDOFF} | ${HANDOFF_DECISION_OPTIONS.CANCEL}`);
    }
}
/**
 * Assert one context token argument of the target-side guard.
 * @throws {HandoffError} `HANDOFF_REQUEST_MALFORMED`.
 */
function assertContextToken(value) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new HandoffError(HANDOFF_ERROR_CODES.REQUEST_MALFORMED, 'contextToken must be a non-empty string');
    }
}
/**
 * Assert one source-history query argument of the target-side guard.
 * @throws {HandoffError} `HANDOFF_REQUEST_MALFORMED`.
 */
function assertQuery(value) {
    const mode = value?.mode;
    const target = value?.target;
    if (typeof value !== 'object' ||
        value === null ||
        (mode !== 'history-read' && mode !== 'search') ||
        typeof target !== 'string') {
        throw new HandoffError(HANDOFF_ERROR_CODES.REQUEST_MALFORMED, "query must be { mode: 'history-read' | 'search', target: string }");
    }
}
/**
 * Assert the team creation outcome (both ids, invariant 9: equal).
 * @throws {HandoffError} `HANDOFF_TEAM_CREATION_FAILED` on a malformed
 *   outcome (the creation entry violated its own contract).
 */
function assertOutcome(outcome) {
    if (typeof outcome?.teamSessionId !== 'string' ||
        outcome.teamSessionId.length === 0 ||
        typeof outcome?.rootSessionId !== 'string' ||
        outcome.rootSessionId.length === 0 ||
        outcome.teamSessionId !== outcome.rootSessionId) {
        throw new HandoffError(HANDOFF_ERROR_CODES.TEAM_CREATION_FAILED, 'the Team creation entry returned a malformed outcome (invariant 9: teamSessionId = rootSessionId)');
    }
}
/** One registry key per `(sourceSessionId, requestToken)` pair. */
function operationKey(sourceSessionId, requestToken) {
    return `${sourceSessionId}\u0000${requestToken}`;
}
/**
 * T12-B5 (plan §7-B3) — the canonical composite identity: the ONE
 * digest over the canonical JSON of the `(sourceSessionId, requestToken)`
 * pair, carried as the 40-hex-digit suffix of BOTH handoff tokens under
 * different prefixes (`handoff-ctx-…` and `handoff-intent-…`) and,
 * through the intentToken, of the deterministic target root (the public
 * Team creation entry derives it). A replay (same source, same request
 * token) therefore re-derives the SAME logical operation and the SAME
 * target; a different source with the same request token is a
 * DIFFERENT operation with a different token and a different target
 * root (no cross-source collision).
 */
function compositeIdentityDigest(sourceSessionId, requestToken) {
    return sha256Hex(canonicalJsonStringify({ requestToken, sourceSessionId })).slice(0, 40);
}
/** The one-shot handoff context token of one operation (T12-B5). */
function contextTokenOf(record) {
    return `handoff-ctx-${compositeIdentityDigest(record.sourceSessionId, record.requestToken)}`;
}
/** The stable team intent token of one operation (T12-B5). */
function intentTokenOf(record) {
    return `handoff-intent-${compositeIdentityDigest(record.sourceSessionId, record.requestToken)}`;
}
/** Map one thrown value onto the closed failure record of a code. */
function toFailure(code, error) {
    return { code, message: describeError(error) };
}
/** A safe one-line rendering of one thrown value. */
function describeError(error) {
    if (error instanceof Error)
        return error.message;
    return String(error);
}
//# sourceMappingURL=service.js.map