/**
 * P6-T3 — the messaging coordinator: instance-addressed send/relay over the
 * P6-T2 TeamRuntime facade with the two-record split and restart recovery.
 *
 * ## Flow of `sendTeamMessage` (documented rulings below)
 *
 * 1. **Module input validation** (zero writes): the request shape, the
 *    non-empty body/token/ids, the caller form.
 * 2. **Self-send policy** (zero writes): an instance caller addressing its
 *    OWN instance is rejected with `MESSAGING_SELF_SEND_REJECTED` (defined
 *    policy — self-talk is not team coordination; the check resolves the
 *    recipient token first so a label that would resolve to the caller's
 *    own instance cannot smuggle a self-send past it — labels are rejected
 *    by the facade anyway, so the check is exact and complete on instance
 *    tokens).
 * 3. **The P6-T2 facade** (`TeamRuntime.performAction`, action
 *    `send-message`): steps 0–5 (request validation, instanceId-first team
 *    + target resolution — label/template tokens REJECTED, invariant 19 —
 *    caller identity/role, role authority + mutation envelope, the
 *    compatibility gate) and the durable **intent fact**
 *    `team-coordination-recorded` (step 6, under the facade's own
 *    per-team lock). Any rejection is a `TeamRuntimeError` with ZERO
 *    durable writes — it propagates UNMAPPED (the facade stays the single
 *    authority; this module never re-implements admission).
 * 4. **Delivery phase** (under the COORDINATOR's per-team lock — the
 *    exported `withTeamLock` seam, its own lock map, so the two lock
 *    owners compose: the facade serializes its effects, the coordinator
 *    serializes its deliveries):
 *      - the delivery plan is re-derived from the DURE intent fact
 *        (`payload.caller` + `payload.recipientInstanceId`) + the FRESH
 *        override records (same pure rule as recovery — one code path);
 *      - the delivery target record is read fresh and must be
 *        work-accepting (CREATED/RUNNING/SETTLED, the facade's live set —
 *        `WORK_ACCEPTING_STATES`), else `MESSAGING_TARGET_NOT_LIVE`;
 *      - the attributed input is submitted through the injected
 *        `SessionInputPort`; a rejection is `MESSAGING_DELIVERY_FAILED`
 *        and the intent fact REMAINS durable (Architecture §24.2 orders
 *        the intent before the delivery — the coordination is recoverable);
 *      - the **confirmation fact** `team-message-delivered` is committed
 *        through the ledger repository (sequence allocated through the
 *        atomic counter); a commit failure is
 *        `MESSAGING_LEDGER_WRITE_FAILED` (the input may already have been
 *        delivered — at-least-once, detectable through the correlation
 *        token).
 *
 * ## Documented rulings (the semantics this module is accountable for)
 *
 * - **R1 (single authoritative record):** the durable intent fact is the
 *   single authoritative record of the coordination (who → whom,
 *   instanceIds, token); the delivery plan is NOT persisted inside it
 *   (the facade's fact payload is closed) and is RE-DERIVED from it plus
 *   the current durable governance state at delivery time. An overlay
 *   written between the intent and the delivery therefore changes the
 *   delivery PATH but never the coordination (same sender, same recipient,
 *   same content); the confirmation fact records the path actually taken.
 * - **R2 (intent survives delivery failure):** a delivery failure after
 *   the intent fact leaves the intent fact durable WITHOUT a confirmation
 *   fact — a *pending delivery*. The intent is the team-wide fact (the
 *   coordination happened); the input to the session is at-least-once.
 * - **R3 (restart recovery):** `recoverPendingDeliveries` scans the
 *   durable ledger for `send-message` intents lacking a confirmation fact
 *   (matched by `requestToken`), in intent-fact sequence order, and
 *   re-delivers each (fresh plan, fresh target view, fresh delivery,
 *   confirmation commit). It is exactly-once on the TeamLedger (one
 *   confirmation per pending intent) and at-least-once on the session
 *   input (a crash between the input write and the confirmation commit
 *   redelivers — detectable through the correlation token).
 * - **R4 (dead targets at recovery are skipped):** a pending delivery
 *   whose (re-derived) target record is missing or not work-accepting is
 *   SKIPPED with the closed reason (`delivery-target-missing` /
 *   `delivery-target-not-live`) and stays pending: a later restore +
 *   recovery delivers it; a DISPOSED target is skipped permanently (the
 *   intent fact is the durable record of the coordination).
 * - **R5 (recovery aborts on hard failure):** a delivery or confirmation
 *   failure during recovery aborts the scan with the typed error;
 *   deliveries confirmed earlier in the run stay durable, the rest stay
 *   pending for the next scan.
 * - **R6 (ordering):** the coordinator's delivery phase runs under its own
 *   per-team lock; the ledger sequence is the team-order authority
 *   (invariant 44) — the session-input order of two concurrent sends may
 *   interleave, the ledger does not.
 * - **R7 (no Team SessionEvents, invariant 42):** the module creates
 *   exactly two record kinds — the facade's ledger intent row and its own
 *   ledger confirmation row — plus ordinary attributed input on the target
 *   session. Nothing else.
 *
 * @module messaging (P6-T3)
 */
import { LEADER_INSTANCE_ID, parseInstanceId } from '../../contracts/src/index.js';
import { WORK_ACCEPTING_STATES } from '../../domain/member/src/index.js';
import { withTeamLock } from '../action-router/index.js';
import { DELIVERY_PLAN_REASONS, decideDeliveryPlan, renderRelayText, } from './mediation.js';
import { MESSAGING_ERROR_CODES, MessagingError, } from './errors.js';
import { MESSAGING_FACT_COORDINATION, MESSAGING_FACT_DELIVERED, } from './types.js';
// --- small closed helpers ----------------------------------------------------------
function fail(code, message, details) {
    throw new MessagingError(code, message, details);
}
function isPlainRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}
function describeError(error) {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
/** The frozen live (work-accepting) set the delivery target must be in. */
const LIVE_DELIVERY_LIFECYCLES = WORK_ACCEPTING_STATES;
// --- input validation --------------------------------------------------------------
/**
 * Validate the module-level request shape (fail closed; zero writes —
 * this runs BEFORE any facade call).
 */
function assertSendRequestShape(request) {
    if (!nonEmptyString(request.rootSessionId) ||
        !nonEmptyString(request.recipientInstanceId) ||
        !nonEmptyString(request.body) ||
        !nonEmptyString(request.requestToken)) {
        fail(MESSAGING_ERROR_CODES.MESSAGING_REQUEST_MALFORMED, 'messaging: rootSessionId / recipientInstanceId / body / requestToken must all be non-empty strings', { problem: 'required-fields' });
    }
    if (request.subject !== undefined && !nonEmptyString(request.subject)) {
        fail(MESSAGING_ERROR_CODES.MESSAGING_REQUEST_MALFORMED, 'messaging: subject must be a non-empty string when present', { problem: 'subject' });
    }
    const caller = request.caller;
    if (!isPlainRecord(caller) || (caller['kind'] !== 'human' && caller['kind'] !== 'instance')) {
        fail(MESSAGING_ERROR_CODES.MESSAGING_REQUEST_MALFORMED, 'messaging: caller must be { kind: "human", humanId } or { kind: "instance", instanceId }', { problem: 'caller' });
    }
    if (caller['kind'] === 'human' && !nonEmptyString(caller['humanId'])) {
        fail(MESSAGING_ERROR_CODES.MESSAGING_REQUEST_MALFORMED, 'messaging: a human caller requires a non-empty humanId', { problem: 'caller.humanId' });
    }
    if (caller['kind'] === 'instance' && !nonEmptyString(caller['instanceId'])) {
        fail(MESSAGING_ERROR_CODES.MESSAGING_REQUEST_MALFORMED, 'messaging: an instance caller requires a non-empty instanceId', { problem: 'caller.instanceId' });
    }
}
/**
 * The self-send policy (R: defined policy — self-talk is not team
 * coordination; zero durable writes). The recipient token is resolved
 * first: a token that is not an instance id cannot be a self-send (the
 * facade classifies it); an instance id that exists and equals the
 * caller's own is rejected.
 */
function assertNotSelfSend(options, rootSessionId, request) {
    if (request.caller.kind !== 'instance')
        return;
    let instanceId;
    try {
        instanceId = String(parseInstanceId(request.recipientInstanceId));
    }
    catch {
        return; // not an instance token — the facade classifies it (zero writes)
    }
    const record = options.teamDomain.repositories.memberInstances.get(rootSessionId, instanceId);
    if (record !== undefined && String(record.instanceId) === request.caller.instanceId) {
        fail(MESSAGING_ERROR_CODES.MESSAGING_SELF_SEND_REJECTED, `messaging: an instance cannot send team coordination to itself (defined policy)`, { rootSessionId, instanceId: request.caller.instanceId });
    }
}
/**
 * Parse + validate the caller ref durably stored in an intent fact's
 * `payload.caller` (written by the facade; a malformed shape is an
 * internal invariant violation, never a caller-reachable rejection).
 */
function parseCallerRef(raw) {
    if (!isPlainRecord(raw) || typeof raw['kind'] !== 'string') {
        fail(MESSAGING_ERROR_CODES.MESSAGING_INTERNAL, 'messaging: the coordination fact carries a malformed caller ref', { problem: 'caller-ref-malformed' });
    }
    if (raw['kind'] === 'human') {
        if (!nonEmptyString(raw['humanId'])) {
            fail(MESSAGING_ERROR_CODES.MESSAGING_INTERNAL, 'messaging: the coordination fact human caller ref lacks a humanId', { problem: 'human-id-missing' });
        }
        return { kind: 'human', humanId: raw['humanId'] };
    }
    if (raw['kind'] === 'instance') {
        if (!nonEmptyString(raw['instanceId'])) {
            fail(MESSAGING_ERROR_CODES.MESSAGING_INTERNAL, 'messaging: the coordination fact instance caller ref lacks an instanceId', { problem: 'instance-id-missing' });
        }
        const role = raw['role'] === 'leader' || raw['role'] === 'member'
            ? raw['role']
            : 'member'; // fail closed: an unrecorded role is treated as member
        return { kind: 'instance', instanceId: raw['instanceId'], role };
    }
    fail(MESSAGING_ERROR_CODES.MESSAGING_INTERNAL, 'messaging: the coordination fact carries an unknown caller kind', { problem: 'caller-kind-unknown', kind: raw['kind'] });
}
/** The facade payload of one send (the closed per-action contract). */
function buildFacadePayload(request) {
    const payload = {
        recipientInstanceId: request.recipientInstanceId,
        body: request.body,
    };
    if (request.subject !== undefined) {
        payload['subject'] = request.subject;
    }
    return payload;
}
/** Render one instance reference for the relay text. */
function describeInstance(instanceId, label) {
    return label !== undefined ? `${instanceId} (label: ${label})` : instanceId;
}
/**
 * Create the P6-T3 messaging coordinator.
 *
 * @param options - the injected wiring (facade + TeamDomain + session
 *  input port + clock).
 * @returns the messaging surface.
 */
export function createMessagingCoordinator(options) {
    // The coordinator's own per-team lock map (the exported P6-T1 lock
    // pattern; R6: it composes with the facade's internal lock map).
    const teamLocks = new Map();
    const repositories = options.teamDomain.repositories;
    async function allocateSequenceGuarded(rootSessionId) {
        try {
            return await repositories.ledger.allocateSequence();
        }
        catch (error) {
            fail(MESSAGING_ERROR_CODES.MESSAGING_LEDGER_WRITE_FAILED, `messaging: the ledger sequence allocation failed: ${describeError(error)}`, { rootSessionId, cause: describeError(error) });
        }
    }
    /**
     * Deliver one durable intent fact: fresh plan (R1), fresh target view,
     * attributed input through the port (at-least-once), confirmation fact
     * (exactly-once). Used by BOTH the live send path and recovery — one
     * code path (R1/R3).
     */
    async function deliverOne(intent) {
        const rootSessionId = String(intent.rootSessionId);
        const payload = intent.payload;
        const caller = parseCallerRef(payload['caller']);
        const recipientInstanceId = payload['recipientInstanceId'];
        if (!nonEmptyString(recipientInstanceId)) {
            fail(MESSAGING_ERROR_CODES.MESSAGING_INTERNAL, 'messaging: the coordination fact lacks recipientInstanceId', { problem: 'recipient-missing', factSequence: intent.sequence });
        }
        const body = nonEmptyString(payload['body']) ? payload['body'] : '';
        const subject = nonEmptyString(payload['subject']) ? payload['subject'] : undefined;
        const requestToken = payload['requestToken'];
        if (!nonEmptyString(requestToken)) {
            fail(MESSAGING_ERROR_CODES.MESSAGING_INTERNAL, 'messaging: the coordination fact lacks requestToken', { problem: 'request-token-missing', factSequence: intent.sequence });
        }
        // R1 — the plan is re-derived from the durable intent + the FRESH
        // governance state (the same pure rule recovery uses).
        const overlays = repositories.overrides.list(rootSessionId);
        const plan = decideDeliveryPlan({ caller, recipientInstanceId, overlays });
        // The delivery target, fresh (authoritative over every earlier view).
        const target = repositories.memberInstances.get(rootSessionId, plan.deliveredToInstanceId);
        if (target === undefined) {
            fail(MESSAGING_ERROR_CODES.MESSAGING_TARGET_NOT_LIVE, `messaging: the delivery target '${plan.deliveredToInstanceId}' (${plan.deliveryMode} delivery) no longer exists — the intent fact remains; restart recovery skips missing targets (R4)`, {
                rootSessionId,
                instanceId: plan.deliveredToInstanceId,
                deliveryMode: plan.deliveryMode,
                requestToken,
                factSequence: intent.sequence,
                reason: 'delivery-target-missing',
            });
        }
        if (!LIVE_DELIVERY_LIFECYCLES.includes(target.lifecycle)) {
            fail(MESSAGING_ERROR_CODES.MESSAGING_TARGET_NOT_LIVE, `messaging: the delivery target '${plan.deliveredToInstanceId}' is ${target.lifecycle} — delivery is accepted only in CREATED/RUNNING/SETTLED; the intent fact remains (R2/R4)`, {
                rootSessionId,
                instanceId: plan.deliveredToInstanceId,
                deliveryMode: plan.deliveryMode,
                lifecycle: target.lifecycle,
                requestToken,
                factSequence: intent.sequence,
                reason: 'delivery-target-not-live',
            });
        }
        // The relay attribution + text (deterministic; no live objects).
        const senderRecord = caller.kind === 'instance'
            ? repositories.memberInstances.get(rootSessionId, caller.instanceId)
            : undefined;
        const recipientRecord = plan.deliveredToInstanceId === recipientInstanceId
            ? target
            : repositories.memberInstances.get(rootSessionId, recipientInstanceId);
        const fromRef = caller.kind === 'human'
            ? `human:${caller.humanId}`
            : describeInstance(caller.instanceId, senderRecord?.label);
        const recipientRef = describeInstance(recipientInstanceId, recipientRecord?.label);
        const input = {
            sessionId: String(target.childSessionId),
            text: renderRelayText({
                fromRef,
                recipientRef,
                deliveryMode: plan.deliveryMode,
                subject,
                body,
            }),
            attribution: {
                kind: 'team-relay',
                ...(caller.kind === 'human'
                    ? { fromHumanId: caller.humanId }
                    : { fromInstanceId: caller.instanceId }),
                intendedForInstanceId: recipientInstanceId,
                correlation: { requestToken, factSequence: intent.sequence },
            },
        };
        // (a) Deliver — at-least-once (R2/R3): a failure leaves the intent
        // pending; the input commit-or-throws contract is the port's.
        try {
            await options.sessionInput.submitAttributedInput(input);
        }
        catch (error) {
            fail(MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED, `messaging: the session input port rejected the attributed input for '${requestToken}' — the intent fact remains durable; the coordination is recoverable (R2/R3)`, {
                rootSessionId,
                requestToken,
                factSequence: intent.sequence,
                cause: describeError(error),
            });
        }
        // (b) Confirm — exactly-once per logical delivery (R3): the
        // delivery/result correlation row of the ledger.
        const deliveredSequence = await allocateSequenceGuarded(rootSessionId);
        const at = options.now();
        const confirmationPayload = {
            action: 'send-message',
            requestToken,
            factSequence: intent.sequence,
            ...(caller.kind === 'human'
                ? { fromHumanId: caller.humanId }
                : { fromInstanceId: caller.instanceId }),
            recipientInstanceId,
            deliveryMode: plan.deliveryMode,
            deliveredToInstanceId: plan.deliveredToInstanceId,
            deliveredToSessionId: String(target.childSessionId),
            at,
        };
        try {
            await repositories.ledger.put({
                schemaVersion: 1,
                sequence: deliveredSequence,
                rootSessionId,
                factType: MESSAGING_FACT_DELIVERED,
                payload: confirmationPayload,
                createdAt: at,
            });
        }
        catch (error) {
            fail(MESSAGING_ERROR_CODES.MESSAGING_LEDGER_WRITE_FAILED, `messaging: the confirmation fact commit failed for '${requestToken}' — the input may have been delivered (at-least-once, detectable through the correlation token; R3)`, {
                rootSessionId,
                requestToken,
                factSequence: intent.sequence,
                sequence: deliveredSequence,
                cause: describeError(error),
            });
        }
        return {
            requestToken,
            recipientInstanceId,
            deliveryMode: plan.deliveryMode,
            deliveredToInstanceId: plan.deliveredToInstanceId,
            deliveredToSessionId: String(target.childSessionId),
            deliveredSequence,
        };
    }
    async function sendTeamMessage(request) {
        // (1) Module input validation — zero writes.
        assertSendRequestShape(request);
        // (2) Self-send policy — zero writes.
        assertNotSelfSend(options, request.rootSessionId, request);
        // (3) The P6-T2 facade: the documented admission order (steps 0–5) +
        // the durable intent fact (step 6, the facade's own per-team lock).
        // Any rejection is an UNMAPPED TeamRuntimeError with zero durable
        // writes (the facade stays the single authority).
        const outcome = await options.teamRuntime.performAction({
            rootSessionId: request.rootSessionId,
            action: 'send-message',
            caller: request.caller,
            targetInstanceId: request.recipientInstanceId,
            requestToken: request.requestToken,
            payload: buildFacadePayload(request),
        });
        if (outcome.effect.kind !== 'fact-recorded' ||
            outcome.effect.factType !== MESSAGING_FACT_COORDINATION) {
            fail(MESSAGING_ERROR_CODES.MESSAGING_INTERNAL, 'messaging: the facade recorded an unexpected effect for send-message', { effectKind: outcome.effect.kind });
        }
        const factSequence = outcome.effect.sequence;
        // (4) The delivery phase under the COORDINATOR's per-team lock (R6).
        return withTeamLock(teamLocks, request.rootSessionId, async () => {
            const intent = repositories.ledger.get(factSequence);
            if (intent === undefined ||
                intent.factType !== MESSAGING_FACT_COORDINATION) {
                fail(MESSAGING_ERROR_CODES.MESSAGING_INTERNAL, 'messaging: the intent fact is missing from the ledger after a facade success', { sequence: factSequence });
            }
            const delivered = await deliverOne(intent);
            return {
                status: 'delivered',
                rootSessionId: request.rootSessionId,
                action: 'send-message',
                callerRole: outcome.callerRole,
                recipientInstanceId: delivered.recipientInstanceId,
                deliveryMode: delivered.deliveryMode,
                deliveredToInstanceId: delivered.deliveredToInstanceId,
                deliveredToSessionId: delivered.deliveredToSessionId,
                factSequence,
                deliveredSequence: delivered.deliveredSequence,
                requestToken: request.requestToken,
            };
        });
    }
    async function recoverPendingDeliveries(rootSessionId) {
        return withTeamLock(teamLocks, rootSessionId, async () => {
            if (!nonEmptyString(rootSessionId)) {
                fail(MESSAGING_ERROR_CODES.MESSAGING_REQUEST_MALFORMED, 'messaging: rootSessionId must be a non-empty string', { problem: 'rootSessionId' });
            }
            // The durable scan: pending = send-message intents (R3) whose
            // requestToken has no confirmation fact yet.
            const entries = repositories.ledger.list();
            const confirmedTokens = new Set();
            const intents = [];
            for (const entry of entries) {
                if (String(entry.rootSessionId) !== rootSessionId)
                    continue;
                if (entry.factType === MESSAGING_FACT_DELIVERED) {
                    const token = entry.payload['requestToken'];
                    if (nonEmptyString(token))
                        confirmedTokens.add(token);
                    continue;
                }
                if (entry.factType !== MESSAGING_FACT_COORDINATION)
                    continue;
                if (entry.payload['action'] !== 'send-message')
                    continue;
                intents.push(entry);
            }
            const pending = intents
                .filter((intent) => {
                const token = intent.payload['requestToken'];
                return !nonEmptyString(token) || !confirmedTokens.has(token);
            })
                .sort((a, b) => a.sequence - b.sequence);
            const recovered = [];
            const skipped = [];
            for (const intent of pending) {
                const rawToken = intent.payload['requestToken'];
                const requestToken = nonEmptyString(rawToken)
                    ? rawToken
                    : `<fact-${intent.sequence}>`;
                // R4 — a fresh view of the (re-derived) delivery target decides
                // skip-vs-deliver BEFORE the delivery attempt (no side effects for
                // a dead target).
                const caller = parseCallerRef(intent.payload['caller']);
                const rawRecipient = intent.payload['recipientInstanceId'];
                const recipientInstanceId = nonEmptyString(rawRecipient) ? rawRecipient : '';
                const plan = recipientInstanceId.length > 0
                    ? decideDeliveryPlan({
                        caller,
                        recipientInstanceId,
                        overlays: repositories.overrides.list(rootSessionId),
                    })
                    : {
                        deliveryMode: 'mediated',
                        deliveredToInstanceId: String(LEADER_INSTANCE_ID),
                        reason: DELIVERY_PLAN_REASONS.MEMBER_TO_MEMBER_DEFAULT,
                    };
                const target = repositories.memberInstances.get(rootSessionId, plan.deliveredToInstanceId);
                if (target === undefined) {
                    skipped.push({
                        requestToken,
                        factSequence: intent.sequence,
                        reason: 'delivery-target-missing',
                    });
                    continue;
                }
                if (!LIVE_DELIVERY_LIFECYCLES.includes(target.lifecycle)) {
                    skipped.push({
                        requestToken,
                        factSequence: intent.sequence,
                        reason: 'delivery-target-not-live',
                    });
                    continue;
                }
                // R3/R5 — deliver + confirm (one code path with the live send).
                const delivered = await deliverOne(intent);
                recovered.push({
                    requestToken: delivered.requestToken,
                    factSequence: intent.sequence,
                    deliveryMode: delivered.deliveryMode,
                    deliveredToInstanceId: delivered.deliveredToInstanceId,
                    deliveredSequence: delivered.deliveredSequence,
                });
            }
            return { rootSessionId, recovered, skipped };
        });
    }
    return { sendTeamMessage, recoverPendingDeliveries };
}
//# sourceMappingURL=coordinator.js.map