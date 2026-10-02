/**
 * Alpha.3 PR5 — the permission-change NOTIFICATION: pure builder + pure
 * deterministic renderer + the active-only best-effort notifier factory.
 *
 * Semantics (plan PR5 / ADR §9, all three pinned by
 * `test/a3p5-permission-notification.test.ts`):
 *
 * - AWARENESS ONLY: the record and the rendered text carry identity, the
 *   GENERATION TAG, provenance and the rule COUNT — never the rule set,
 *   never an effect, never a matcher. Nothing produced here is an input to
 *   any authorization decision (the lane-hygiene spec pins the module
 *   surface structurally); the durable snapshot store is the authority and
 *   the read projection is the read-back.
 * - ACTIVE-ONLY, IDLE NEVER AWAKENED: the notifier point-reads liveness
 *   through the injected READ-ONLY port and skips delivery for `idle` and
 *   `unknown`; the delivery seam is never called for a non-active target,
 *   and this module owns no wake/followup/steer path of its own.
 * - STALE = MARKED, NEVER ACTED ON: supersession is decided by comparing
 *   the notice's generation against the durable CURRENT authority read
 *   through the injected `latest` boundary (the PR1 port member, narrowed
 *   so `append` is not even nameable). A superseded notice still delivers
 *   (when active) with its own generation and the superseding generation
 *   MARKED in the text; the notifier performs zero durable writes, so a
 *   stale notice cannot and does not change permissions.
 * - FAILURE-ISOLATED: the notifier NEVER throws. Every seam failure
 *   (liveness read, authority read handled as `unknown` staleness,
 *   delivery) lands in the closed {@link PermissionNotificationOutcome}.
 *   Because the layer is called after the mutation ack and cannot throw,
 *   a failed delivery cannot alter the mutation result or the ack — the
 *   spec pins that composition leg.
 *
 * Determinism: the same notification + staleness renders byte-identical
 * text (token-leading, machine-dedup friendly — the same discipline as the
 * `[team-work-settled …]` lane).
 *
 * @module @dsh-agent-team/runtime/permission-notification/notification
 */
import type { PermissionOverlaySnapshot } from '../permission-governance/types.js';
import type { PermissionAgentLivenessPort, PermissionChangeNotification, PermissionNotificationDeliveryPort, PermissionNotificationOutcome, PermissionNotificationStaleness } from './types.js';
/**
 * Build the awareness record for ONE committed snapshot (the changed:true
 * branch of the PR3 mutation result — the caller maps the result; the
 * changed:false no-change branch produces NO notification because no
 * permission state was created or replaced).
 *
 * Pure: no ports, no clock, deterministic per input; the result is frozen
 * and carries NO rule set (rule COUNT only — see the module docs).
 *
 * @param snapshot - the durable snapshot as returned by the commit
 *   (backend truth; the builder copies primitives, it never holds the row).
 */
export declare function permissionChangeNotificationFromSnapshot(snapshot: PermissionOverlaySnapshot): PermissionChangeNotification;
/**
 * Render the model-visible text for ONE notice (pure, deterministic).
 *
 * The text leads with the machine-dedup token
 * `[team-perm-changed team=<t> instance=<i> generation=<g>]`; the
 * `superseded` variant adds the marking line naming BOTH generations right
 * after the token; the `unknown` variant says so verbatim. Every variant
 * closes with the awareness-only statement and the read-back pointer —
 * the durable snapshot store is the authority, this text is not.
 *
 * @param notification - the awareness record (rendered verbatim from it).
 * @param staleness - the delivery-time staleness judgement.
 * @param supersededByGeneration - the current authority generation;
 *   REQUIRED for `superseded`, ignored otherwise.
 */
export declare function renderPermissionChangeNotification(notification: PermissionChangeNotification, staleness: PermissionNotificationStaleness, supersededByGeneration?: number): string;
/** The notifier factory dependencies. */
export interface CreatePermissionChangeNotifierDeps {
    /**
     * The CURRENT-AUTHORITY read boundary. The type NARROWS the PR1 port to
     * `latest` only — `append`/`history` are not nameable through this seam,
     * so the notifier cannot write or even reach the audit list.
     */
    readonly authority: {
        latest(identity: {
            readonly teamSessionId: string;
            readonly memberInstanceId: string;
        }): Promise<PermissionOverlaySnapshot | undefined>;
    };
    /** The READ-ONLY agent liveness seam (point read; wakes nothing). */
    readonly liveness: PermissionAgentLivenessPort;
    /** The best-effort active-target delivery seam. */
    readonly deliver: PermissionNotificationDeliveryPort;
}
/**
 * The notifier factory. WIRED at exactly one production point (final
 * splice, `src/plugin/root.ts`): post-commit of `mutatePermission` →
 * `notifyPermissionCommit(result.snapshot)` through `detachPermissionNotice`
 * — fire-and-forget, the outcome NEVER joined into the ack (the ack is
 * fully settled by the durable commit; this dispatch cannot delay,
 * reorder, or alter it).
 *
 * `notifyPermissionCommit(snapshot)` pipeline, in order:
 * 1. build the awareness record (pure);
 * 2. point-read liveness — NOT `active` (or a throwing read) →
 *    `{ delivered: false, skip: 'agent-idle' | 'agent-liveness-unknown' }`,
 *    the delivery seam is NEVER touched (idle never awakened);
 * 3. read the durable current authority through the `latest` boundary —
 *    higher generation → `superseded` (marking only); absent/throwing read
 *    → `unknown` staleness (honestly unmarked-but-flagged);
 * 4. render deterministically and hand the text to the delivery seam
 *    ONCE (at-most-once; no retry) — throw →
 *    `{ delivered: false, skip: 'delivery-failed' }`.
 *
 * No branch throws, no branch writes durable state, no branch interprets
 * provenance.
 *
 * @param deps - the three injected seams (all pending production bindings
 *   are read-only or input-turn delivery over EXISTING surfaces).
 */
export declare function createPermissionChangeNotifier(deps: CreatePermissionChangeNotifierDeps): {
    notifyPermissionCommit(snapshot: PermissionOverlaySnapshot): Promise<PermissionNotificationOutcome>;
};
//# sourceMappingURL=notification.d.ts.map