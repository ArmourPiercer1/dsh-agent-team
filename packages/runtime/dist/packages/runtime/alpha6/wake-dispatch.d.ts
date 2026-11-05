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
import type { ReviewWakeCoordinator, ReviewWakeDeliverEffect, ReviewWakeDeliveryPort, ReviewWakeEffect, ReviewWakeKey, ReviewWakeRefusalCode, ReviewWakeStatus, ReviewWakeTransition, ReviewWorkScan } from '../review-wake/index.js';
import type { ReviewWakeInboxPort, ReviewWakeIntentStore } from './wake-intent.js';
import type { PlannedWake, WakePlan } from './wake-plan.js';
export { createReviewWakeCoordinator, renderReviewWake } from '../review-wake/index.js';
export type { ReviewWakeCoordinator as LatchCoordinator } from '../review-wake/index.js';
export { recoverReviewWake as recoverLatch } from './wake-intent.js';
/** Root-facing aliases: PR3 lane hygiene keeps the lane token inside alpha6. */
export { claimReviewWake as claimLatch, createReviewWakeCoordinator as createLatchCoordinator, dispatchReviewWakes as dispatchLatch, planFingerprint as latchFingerprint, releaseReviewWake as releaseLatch, reviewWakeKeyFor as latchKeyFor, renderReviewWake as renderLatchWake, } from './wake-dispatch.js';
/** The marker every review-wake message carries (the Host filters on it). */
export declare const ALPHA6_WAKE_MARKER = "[team-review-wake";
export interface WakeDispatchDeps {
    /** The router-first plan; held/human entries are surfaced, never dispatched. */
    readonly plan: WakePlan;
    /** The Team root that owns every reviewed leg. */
    readonly rootSessionId: string;
    /**
     * The per-identity latches the caller owns. The dispatcher derives the key
     * for each planned wake and binds it to the coordinator whose `state.key`
     * matches EXACTLY; a missing/mismatched latch fails closed (no delivery).
     */
    readonly coordinators: readonly ReviewWakeCoordinator[];
    /** The delivery seam; a rejection becomes the reducer's `delivery-failed`. */
    readonly deliver: (input: Parameters<ReviewWakeDeliveryPort>[0], targetSessionId: string) => Promise<void>;
    /** Current generation of the recipient latch; 0 when the caller omits it. */
    readonly sessionGeneration?: number;
    /**
     * Production turn ownership: accepted for compatibility, but no longer
     * changes the latch. Inbox acceptance NEVER claims a turn, so a dispatch
     * always leaves the latch `queued` in both modes; the caller claims
     * ({@link claimReviewWake}) and releases ({@link releaseReviewWake}) at the
     * Host's real turn boundaries.
     */
    readonly deferTurnEnd?: boolean;
    /**
     * The minimal persisted intent seam: one row per latch, written BEFORE the
     * delivery attempt and marked accepted AFTER the Inbox accepts it. Optional
     * for pure unit cycles; production supplies the durable port (window a–d
     * recovery lives in `wake-intent.ts`).
     */
    readonly intent?: ReviewWakeIntentStore;
    /**
     * The native Inbox probe used by the no-ready-work reconcile: a queued
     * wake whose recipient is absent from the new plan is withdrawn from the
     * Inbox (when the port offers `remove`) and the latch is revoked.
     */
    readonly inbox?: ReviewWakeInboxPort;
}
/** Per-recipient outcome of one dispatch cycle. */
export interface WakeDispatchDelivery {
    readonly sessionId: string;
    readonly templateId: string;
    readonly routeRole: PlannedWake['routeRole'];
    readonly key: ReviewWakeKey;
    /** The merged leg count the fingerprint was derived from. */
    readonly legCount: number;
    /** The stable plan fingerprint used as the authoritative work read. */
    readonly workFingerprint: string;
    /** The one wake this cycle delivered, `null` when nothing was delivered. */
    readonly wakeId: string | null;
    readonly delivered: boolean;
    /** The latch phase after the cycle (running = an active turn kept the wake). */
    readonly status: ReviewWakeStatus;
    readonly dirty: boolean;
    readonly stopped: boolean;
}
/** Why a planned wake did not reach a successful delivery. */
export interface WakeDispatchFailure {
    readonly sessionId: string;
    readonly scope: 'coordinator' | 'delivery' | 'transition';
    readonly message: string;
    readonly refusal?: ReviewWakeRefusalCode;
    readonly wakeId?: string;
}
export interface WakeDispatchResult {
    /** One entry per planned wake, in plan order (delivered or not). */
    readonly deliveries: readonly WakeDispatchDelivery[];
    /** The wakes actually delivered this cycle. */
    readonly delivered: readonly WakeDispatchDelivery[];
    /** Session ids whose latch is `queued` after the cycle. */
    readonly queued: readonly string[];
    /** Session ids whose latch is `dirty` after the cycle. */
    readonly dirty: readonly string[];
    /** Held routes from the plan: surfaced as data, never dispatched. */
    readonly held: WakePlan['held'];
    /** Human targets from the plan: no Agent inbox, never dispatched. */
    readonly humanLegIds: readonly string[];
    /**
     * Session ids whose stale queued wake the no-ready-work reconcile revoked
     * because the recipient was ABSENT from this plan (an empty plan revokes
     * every queued latch at this root/generation).
     */
    readonly revoked: readonly string[];
    /** The withdrawn Inbox message ids (the reconcile effects actually drained). */
    readonly revokedWakeIds: readonly string[];
    readonly failures: readonly WakeDispatchFailure[];
}
/**
 * The stable work fingerprint of one planned wake: the merged leg COUNT plus
 * a hash over the sorted, de-duplicated leg ids and the recipient route. The
 * same plan always yields the same string; no clock, no randomness, and the
 * order in which the asks were routed does not matter.
 */
export declare function planFingerprint(wake: PlannedWake): string;
/**
 * The deterministic single-flight key for one planned wake. The recipient
 * session is the reviewer identity; the fingerprint is deliberately NOT part
 * of the key (see the module note) — it reaches the reducer as the
 * authoritative work scan, which derives the deterministic `wakeId`.
 */
export declare function reviewWakeKeyFor(wake: PlannedWake, rootSessionId: string, sessionGeneration: number): ReviewWakeKey;
/**
 * Dispatch ONE delivery cycle over a `WakePlan`.
 *
 * Async only because the delivery port is async; every reducer transition is
 * synchronous and pure. The result reports delivered wakes, queued/dirty
 * latches, held/human routes (never dispatched) and every failure. A delivery
 * port rejection is never swallowed and never reported as a success.
 */
export declare function dispatchReviewWakes(deps: WakeDispatchDeps): Promise<WakeDispatchResult>;
/**
 * The Host's REAL turn-start claim: `queued` -> `running` only.
 *
 * A delivery port's acceptance proves the message reached the native Inbox;
 * it does NOT prove the recipient claimed or started a turn. Only the Host
 * adapter that owns the recipient Agent may call this, from the Agent's actual
 * turn-start boundary. The reducer refuses it in every phase but `queued`.
 */
export declare function claimReviewWake(coordinator: ReviewWakeCoordinator): ReviewWakeTransition;
/** Drain one emitted `deliver-wake` through the Host delivery seam. */
export type ReviewWakeReleaseDeliver = (effect: ReviewWakeDeliverEffect) => void | Promise<void>;
/** Optional seams for a release; none of them is authority. */
export interface ReviewWakeReleaseOptions {
    /**
     * Required whenever the release emits a fresh `deliver-wake` (the fresh
     * fingerprint moved). A missing port THROWS instead of leaving an
     * unconsumed queued wake behind.
     */
    readonly deliver?: ReviewWakeReleaseDeliver;
    /** Persist the fresh intent before its delivery; mark/clear around it. */
    readonly intent?: ReviewWakeIntentStore;
    /** Native Inbox removal for a `withdraw-wake` effect. */
    readonly inbox?: ReviewWakeInboxPort;
    /** The exact legs this release's fresh wake covers (see deliver effect). */
    readonly requestIds?: readonly string[];
}
export interface ReviewWakeReleaseFailure {
    readonly scope: 'delivery' | 'transition';
    readonly message: string;
    readonly wakeId?: string;
}
/** Every effect a release produced, and how each one was consumed. */
export interface ReviewWakeReleaseResult {
    readonly outcome: ReviewWakeTransition['outcome'];
    readonly refusal?: ReviewWakeRefusalCode;
    /** The latch phase after the release (`queued` = a fresh wake is pending). */
    readonly status: ReviewWakeStatus;
    readonly wakeId: string | null;
    readonly effects: readonly ReviewWakeEffect[];
    /** The fresh wake ids this release delivered itself. */
    readonly delivered: readonly string[];
    /** The stale Inbox message ids this release withdrew itself. */
    readonly withdrawn: readonly string[];
    readonly failures: readonly ReviewWakeReleaseFailure[];
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
export declare function releaseReviewWake(coordinator: ReviewWakeCoordinator, work: ReviewWorkScan, deliverOrOptions?: ReviewWakeReleaseDeliver | ReviewWakeReleaseOptions): Promise<ReviewWakeReleaseResult>;
/** One no-ready-work reconcile cycle's dependency set. */
export interface WakeReconcileDeps {
    readonly plan: WakePlan;
    readonly rootSessionId: string;
    readonly sessionGeneration?: number;
    readonly coordinators: readonly ReviewWakeCoordinator[];
    readonly intent?: ReviewWakeIntentStore;
    readonly inbox?: ReviewWakeInboxPort;
}
export interface WakeReconcileResult {
    /** Session ids whose stale queued latch was revoked. */
    readonly revoked: readonly string[];
    /** The withdrawn Inbox message ids. */
    readonly wakeIds: readonly string[];
    readonly failures: readonly WakeDispatchFailure[];
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
export declare function reconcileReviewWakes(deps: WakeReconcileDeps): Promise<WakeReconcileResult>;
//# sourceMappingURL=wake-dispatch.d.ts.map