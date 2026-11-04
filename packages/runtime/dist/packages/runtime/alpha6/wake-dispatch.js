/**
 * Alpha.6 — the deterministic wake DISPATCHER (plan → coordinator cycle).
 *
 * `wake-plan.ts` is the authoritative router-first PLAN: every pending leg is
 * routed once and the routes are merged per recipient session. This module is
 * the second slice: it turns ONE planned wake into the coordinator events the
 * `ReviewWakeCoordinator` reducer requires, and performs the ONE delivery the
 * latch allows. It never re-decides routing, never invents a recipient and
 * never invents an event name.
 *
 * ## Identity (deterministic, no randomness)
 *
 * A `ReviewWakeKey` is the single-flight latch identity
 * (`rootSessionId`, `reviewerInstanceId`, `sessionGeneration`). The recipient
 * session IS the reviewer identity; the Team root and the caller-supplied
 * generation complete the key. The merged leg set is summarised by a stable
 * `planFingerprint` (FNV-1a over the sorted leg ids plus the leg count). The
 * fingerprint cannot live in the key: the latch must stay the SAME when the
 * work moves, otherwise `dirty` could never be observed. Instead the reducer
 * derives the deterministic `wakeId` from `(key, fingerprint)`, so the full
 * identity `(key, fingerprint)` is stable for identical work and changes only
 * when the merged leg set changes.
 *
 * ## One delivery cycle (only reducer transitions, in order)
 *
 * 1. A plan arriving while the latch is `running` (an active turn) is an
 *    automatic `poll`: it marks the latch `dirty` and NEVER delivers a second
 *    wake.
 * 2. Otherwise the merged authoritative read is dispatched as
 *    `scan-result { kind: 'ready', fingerprint }`.
 * 3. If — and only if — the reducer answers with a `deliver-wake` effect, the
 *    intent is persisted, the effect is handed to the `ReviewWakeDeliveryPort`
 *    (text rendered by `createReviewWakeDelivery`), and the Inbox acceptance
 *    is recorded (`markAccepted`).
 * 4. Inbox acceptance means QUEUED, not claimed: the latch STAYS `queued`.
 *    The Host adapter calls {@link claimReviewWake} when the recipient turn
 *    actually starts, and {@link releaseReviewWake} at the real turn boundary.
 *    Neither a recipient turn nor a `turn-end` is synthesized here.
 * 5. Delivery rejection is surfaced as `delivery-failed` (with the attempted
 *    `wakeId`), which releases `queued` and resets the progress baseline:
 *    the wake is retryable on a later cycle and is never claimed as delivered.
 *
 * A `dispatched` cycle performs no I/O beyond the caller's delivery port,
 * intent store and Inbox reconcile port; it reads no clock.
 *
 * @module @dsh-agent-team/runtime/alpha6/wake-dispatch
 */
import { createReviewWakeDelivery } from '../review-wake/index.js';
// PR3 lane hygiene: root/host code imports the lane ONLY through alpha6.
export { createReviewWakeCoordinator, renderReviewWake } from '../review-wake/index.js';
export { recoverReviewWake as recoverLatch } from './wake-intent.js';
/** Root-facing aliases: PR3 lane hygiene keeps the lane token inside alpha6. */
export { claimReviewWake as claimLatch, createReviewWakeCoordinator as createLatchCoordinator, dispatchReviewWakes as dispatchLatch, planFingerprint as latchFingerprint, releaseReviewWake as releaseLatch, reviewWakeKeyFor as latchKeyFor, renderReviewWake as renderLatchWake, } from './wake-dispatch.js';
/** The marker every review-wake message carries (the Host filters on it). */
export const ALPHA6_WAKE_MARKER = '[team-review-wake';
/** FNV-1a (32 bit) over UTF-16 code units. Stable across runs/hosts. */
function stableHash(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
/**
 * The stable work fingerprint of one planned wake: the merged leg COUNT plus
 * a hash over the sorted, de-duplicated leg ids and the recipient route. The
 * same plan always yields the same string; no clock, no randomness, and the
 * order in which the asks were routed does not matter.
 */
export function planFingerprint(wake) {
    const legs = [...new Set(wake.currentLegIds)].sort();
    const canonical = [
        'a6-review-wake-plan/v1',
        wake.reviewerInstanceId,
        wake.templateId,
        wake.routeRole,
        String(legs.length),
        ...legs,
    ].join('\u001f');
    return `a6wake:v1:${String(legs.length)}:${stableHash(canonical)}`;
}
/**
 * The deterministic single-flight key for one planned wake. The recipient
 * session is the reviewer identity; the fingerprint is deliberately NOT part
 * of the key (see the module note) — it reaches the reducer as the
 * authoritative work scan, which derives the deterministic `wakeId`.
 */
export function reviewWakeKeyFor(wake, rootSessionId, sessionGeneration) {
    return {
        rootSessionId,
        reviewerInstanceId: wake.reviewerInstanceId,
        sessionGeneration,
    };
}
function sameKey(a, b) {
    return (a.rootSessionId === b.rootSessionId &&
        a.reviewerInstanceId === b.reviewerInstanceId &&
        a.sessionGeneration === b.sessionGeneration);
}
function findCoordinator(coordinators, key) {
    return coordinators.find((coordinator) => sameKey(coordinator.state.key, key));
}
function deliverEffect(transition) {
    if (transition.outcome !== 'applied')
        return undefined;
    return transition.effects.find((effect) => effect.kind === 'deliver-wake');
}
function refusalOf(transition) {
    return transition.outcome === 'refused' ? transition.code : undefined;
}
function failure(sessionId, scope, message, transition, wakeId) {
    const refusal = refusalOf(transition);
    return {
        sessionId,
        scope,
        message,
        ...(refusal !== undefined ? { refusal } : {}),
        ...(wakeId !== undefined ? { wakeId } : {}),
    };
}
function outcome(wake, key, fingerprint, coordinator, delivered, wakeId) {
    return {
        sessionId: wake.reviewerInstanceId,
        templateId: wake.templateId,
        routeRole: wake.routeRole,
        key,
        legCount: new Set(wake.currentLegIds).size,
        workFingerprint: fingerprint,
        wakeId,
        delivered,
        status: coordinator.state.status,
        dirty: coordinator.state.dirty,
        stopped: coordinator.state.stopped,
    };
}
/**
 * Dispatch ONE delivery cycle over a `WakePlan`.
 *
 * Async only because the delivery port is async; every reducer transition is
 * synchronous and pure. The result reports delivered wakes, queued/dirty
 * latches, held/human routes (never dispatched) and every failure. A delivery
 * port rejection is never swallowed and never reported as a success.
 */
export async function dispatchReviewWakes(deps) {
    const generation = deps.sessionGeneration ?? 0;
    const deliver = createReviewWakeDelivery(async (input) => {
        const targetSessionId = deps.plan.wakes.find((wake) => wake.reviewerInstanceId === input.key.reviewerInstanceId)?.targetSessionId;
        if (targetSessionId === undefined)
            throw new Error(`no target session for reviewer instance '${input.key.reviewerInstanceId}'`);
        await deps.deliver(input, targetSessionId);
    });
    const deliveries = [];
    const delivered = [];
    const failures = [];
    for (const wake of deps.plan.wakes) {
        const key = reviewWakeKeyFor(wake, deps.rootSessionId, generation);
        const fingerprint = planFingerprint(wake);
        const coordinator = findCoordinator(deps.coordinators, key);
        if (coordinator === undefined) {
            failures.push({
                sessionId: wake.reviewerInstanceId,
                scope: 'coordinator',
                message: `no ReviewWakeCoordinator is registered for the derived key of session '${wake.reviewerInstanceId}'`,
            });
            // No latch, no state: report an idle, undelivered entry (fail closed).
            deliveries.push({
                sessionId: wake.reviewerInstanceId,
                templateId: wake.templateId,
                routeRole: wake.routeRole,
                key,
                legCount: new Set(wake.currentLegIds).size,
                workFingerprint: fingerprint,
                wakeId: null,
                delivered: false,
                status: 'idle',
                dirty: false,
                stopped: false,
            });
            continue;
        }
        // Sticky Stop outranks every automatic path; the reducer would no-op the
        // events anyway, so report the latch without inventing a transition.
        if (coordinator.state.stopped) {
            deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null));
            continue;
        }
        // An active turn owns the latch. The plan arrival is an automatic poll:
        // it can only dirty the latch, never deliver a second wake.
        if (coordinator.state.status === 'running') {
            const polled = coordinator.dispatch({ type: 'poll' });
            if (polled.outcome === 'refused') {
                failures.push(failure(wake.reviewerInstanceId, 'transition', 'poll was refused during an active turn', polled));
            }
            deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null));
            continue;
        }
        // The merged authoritative read answering the poll/activation rescan.
        const scanned = coordinator.dispatch({
            type: 'scan-result',
            work: { kind: 'ready', fingerprint },
        });
        if (scanned.outcome === 'refused') {
            failures.push(failure(wake.reviewerInstanceId, 'coordinator', 'the merged scan-result was refused', scanned));
            deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null));
            continue;
        }
        const effect = deliverEffect(scanned);
        if (effect === undefined) {
            // Queued (one wake already outstanding) or idle at the same fingerprint
            // (pending-but-unchanged, bounded suppression). No second delivery.
            deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null));
            continue;
        }
        try {
            // Crash window (a)/(b): the intent is durable BEFORE the Inbox call, so
            // "decided but not delivered" is visible to recovery and can be
            // discarded instead of adopted.
            await deps.intent?.persistQueued({
                key: effect.key,
                wakeId: effect.wakeId,
                workFingerprint: effect.workFingerprint,
            });
            await deliver(effect);
            // Crash window (c): the Inbox has the message, but the local mark may be
            // lost. Recovery adopts from the Inbox truth, not from this call.
            await deps.intent?.markAccepted(effect.wakeId);
        }
        catch (error) {
            // A port failure is the reducer's `delivery-failed`: it releases
            // `queued`, resets the baseline and is never a claimed success. The
            // intent row goes too: there is no delivered wake to recover.
            await clearIntent(deps.intent, effect.wakeId);
            const failed = coordinator.dispatch({
                type: 'delivery-failed',
                wakeId: effect.wakeId,
            });
            const reason = error instanceof Error ? error.message : String(error);
            if (failed.outcome === 'refused') {
                failures.push(failure(wake.reviewerInstanceId, 'transition', `delivery failed (${reason}) and delivery-failed was refused`, failed, effect.wakeId));
            }
            else {
                failures.push({
                    sessionId: wake.reviewerInstanceId,
                    scope: 'delivery',
                    message: reason,
                    wakeId: effect.wakeId,
                });
            }
            deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null));
            continue;
        }
        // Inbox acceptance is QUEUED, never claimed: the wake sits in the native
        // Inbox until the Host starts a turn. The dispatcher does not synthesize
        // `turn-start`/`turn-end`; `claimReviewWake`/`releaseReviewWake` own them.
        const entry = outcome(wake, key, fingerprint, coordinator, true, effect.wakeId);
        deliveries.push(entry);
        delivered.push(entry);
    }
    // Latches ABSENT from this plan have no ready work in the authoritative
    // read. Reconcile (withdraw) their stale queued wake; a running/claimed
    // turn is never cancelled by absence.
    const reconciled = await reconcileReviewWakes({
        plan: deps.plan,
        rootSessionId: deps.rootSessionId,
        sessionGeneration: generation,
        coordinators: deps.coordinators,
        ...(deps.intent !== undefined ? { intent: deps.intent } : {}),
        ...(deps.inbox !== undefined ? { inbox: deps.inbox } : {}),
    });
    failures.push(...reconciled.failures);
    return {
        deliveries,
        delivered,
        queued: deliveries.filter((entry) => entry.status === 'queued').map((entry) => entry.sessionId),
        dirty: deliveries.filter((entry) => entry.dirty).map((entry) => entry.sessionId),
        held: deps.plan.held,
        humanLegIds: deps.plan.humanLegIds,
        revoked: reconciled.revoked,
        revokedWakeIds: reconciled.wakeIds,
        failures,
    };
}
async function clearIntent(store, wakeId) {
    try {
        await store?.clear(wakeId);
    }
    catch {
        // The primary delivery/transition failure is the fact worth surfacing;
        // a failing clear leaves the intent for `recoverReviewWake`, which will
        // discard it when the Inbox has no such message.
    }
}
/**
 * The Host's REAL turn-start claim: `queued` -> `running` only.
 *
 * A delivery port's acceptance proves the message reached the native Inbox;
 * it does NOT prove the recipient claimed or started a turn. Only the Host
 * adapter that owns the recipient Agent may call this, from the Agent's actual
 * turn-start boundary. The reducer refuses it in every phase but `queued`.
 */
export function claimReviewWake(coordinator) {
    return coordinator.dispatch({ type: 'turn-start' });
}
function releaseSnapshot(coordinator, transition, effects, delivered, withdrawn, failures) {
    return {
        outcome: transition.outcome,
        ...(transition.outcome === 'refused' ? { refusal: transition.code } : {}),
        status: coordinator.state.status,
        wakeId: coordinator.state.wakeId,
        effects,
        delivered,
        withdrawn,
        failures,
    };
}
/**
 * Release a wake at the recipient's REAL turn boundary and CONSUME every
 * effect it produces.
 *
 * The old shape returned the reducer transition and let a `deliver-wake`
 * effect escape unconsumed (a fresh fingerprint after `turn-end` left a
 * queued wake the caller never delivered). This function drains it: the fresh
 * wake is persisted, delivered and marked accepted inside the same call, so a
 * release with NEW work yields exactly one new delivery and the latch ends
 * `queued` (never a phantom queued wake with no Inbox message).
 *
 * If the latch is still `queued` (the Host never claimed, or the claim was
 * lost across a crash), the release claims it first: a real turn boundary is
 * proof that the turn ran. `turn-end` is dispatched only from this function.
 */
export async function releaseReviewWake(coordinator, work, deliverOrOptions = {}) {
    // The third argument may be the delivery port itself (the terse shape) or
    // the full options object.
    const options = typeof deliverOrOptions === 'function'
        ? { deliver: deliverOrOptions }
        : deliverOrOptions;
    const effects = [];
    const delivered = [];
    const withdrawn = [];
    const failures = [];
    const releasedWakeId = coordinator.state.wakeId;
    if (coordinator.state.status === 'queued') {
        const claimed = claimReviewWake(coordinator);
        if (claimed.outcome === 'refused') {
            return releaseSnapshot(coordinator, claimed, effects, delivered, withdrawn, failures);
        }
        effects.push(...claimed.effects);
    }
    const ended = coordinator.dispatch({ type: 'turn-end' });
    if (ended.outcome === 'refused') {
        return releaseSnapshot(coordinator, ended, effects, delivered, withdrawn, failures);
    }
    effects.push(...ended.effects);
    let transition = ended;
    if (ended.effects.some((effect) => effect.kind === 'rescan')) {
        // The caller's FRESH authoritative read answers the ONE post-turn rescan.
        transition = coordinator.dispatch({ type: 'scan-result', work });
        if (transition.outcome === 'refused') {
            return releaseSnapshot(coordinator, transition, effects, delivered, withdrawn, failures);
        }
        effects.push(...transition.effects);
    }
    // The released turn's Inbox message was consumed at the turn boundary.
    if (releasedWakeId !== null)
        await clearIntent(options.intent, releasedWakeId);
    // Drain EVERY effect. `rescan` was answered above; `deliver-wake` and
    // `withdraw-wake` are consumed here.
    for (const effect of effects) {
        if (effect.kind === 'withdraw-wake') {
            try {
                await options.inbox?.remove?.(effect.wakeId);
                await options.intent?.clear(effect.wakeId);
                withdrawn.push(effect.wakeId);
            }
            catch (error) {
                failures.push({
                    scope: 'transition',
                    message: error instanceof Error ? error.message : String(error),
                    wakeId: effect.wakeId,
                });
            }
            continue;
        }
        if (effect.kind !== 'deliver-wake')
            continue;
        if (options.deliver === undefined) {
            // Fail closed: leaving this effect unconsumed is exactly the defect the
            // release path is fixing.
            throw new TypeError('review-wake: release emitted a deliver-wake effect but no delivery port was supplied');
        }
        try {
            await options.intent?.persistQueued({
                key: effect.key,
                wakeId: effect.wakeId,
                workFingerprint: effect.workFingerprint,
            });
            await options.deliver(effect);
            await options.intent?.markAccepted(effect.wakeId);
            delivered.push(effect.wakeId);
        }
        catch (error) {
            await clearIntent(options.intent, effect.wakeId);
            const failed = coordinator.dispatch({
                type: 'delivery-failed',
                wakeId: effect.wakeId,
            });
            failures.push({
                scope: 'delivery',
                message: error instanceof Error ? error.message : String(error),
                wakeId: effect.wakeId,
            });
            if (failed.outcome === 'refused') {
                failures.push({
                    scope: 'transition',
                    message: 'delivery-failed was refused after the release delivery failed',
                    wakeId: effect.wakeId,
                });
            }
        }
    }
    return releaseSnapshot(coordinator, transition, effects, delivered, withdrawn, failures);
}
/**
 * Reconcile latches ABSENT from the new plan with the authoritative
 * `no-ready-work` read.
 *
 * Plan absence means the router no longer sees ready work for that recipient.
 * A stale `queued` wake must not survive it (it could wake the recipient for
 * nothing and keep the single-flight latch occupied). The reconcile answers
 * the rescan with `{ kind: 'no-ready-work' }`, drains the `withdraw-wake`
 * effect through the native Inbox (when `remove` exists) and clears the
 * persisted intent. A `running`/claimed turn is never cancelled this way.
 *
 * Dispatch calls this automatically at the end of every cycle, which makes an
 * EMPTY plan revoke every queued latch at the same root/generation.
 */
export async function reconcileReviewWakes(deps) {
    const generation = deps.sessionGeneration ?? 0;
    const planned = new Set(deps.plan.wakes.map((wake) => wake.reviewerInstanceId));
    const revoked = [];
    const wakeIds = [];
    const failures = [];
    for (const coordinator of deps.coordinators) {
        const key = coordinator.state.key;
        if (key.rootSessionId !== deps.rootSessionId)
            continue;
        if (key.sessionGeneration !== generation)
            continue;
        if (planned.has(key.reviewerInstanceId))
            continue;
        if (coordinator.state.stopped)
            continue;
        const reconciled = coordinator.dispatch({
            type: 'scan-result',
            work: { kind: 'no-ready-work' },
        });
        if (reconciled.outcome === 'refused') {
            failures.push({
                sessionId: key.reviewerInstanceId,
                scope: 'transition',
                message: 'the no-ready-work reconcile was refused',
                refusal: reconciled.code,
            });
            continue;
        }
        const withdrawals = reconciled.effects.filter((effect) => effect.kind === 'withdraw-wake');
        for (const effect of withdrawals) {
            try {
                await deps.inbox?.remove?.(effect.wakeId);
                await deps.intent?.clear(effect.wakeId);
                wakeIds.push(effect.wakeId);
            }
            catch (error) {
                failures.push({
                    sessionId: key.reviewerInstanceId,
                    scope: 'transition',
                    message: error instanceof Error ? error.message : String(error),
                    wakeId: effect.wakeId,
                });
            }
        }
        if (withdrawals.length > 0)
            revoked.push(key.reviewerInstanceId);
    }
    return { revoked, wakeIds, failures };
}
//# sourceMappingURL=wake-dispatch.js.map