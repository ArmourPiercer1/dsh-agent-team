/**
 * Alpha.3 PR5 — the closed type surface of the permission NOTIFICATION and
 * READ PROJECTION layer (plan PR5 "notification and the read projection";
 * ADR §9: notification is awareness only, NEVER authorization evidence).
 *
 * This module is the pure awareness layer over the merged PR1–PR3 durable
 * surface:
 *
 * - the NOTIFICATION half turns ONE committed `PermissionOverlaySnapshot`
 *   (the PR3 mutation result's durable row, ADR §2) into one generation-
 *   tagged, model-visible notice delivered best-effort to ACTIVE Agents
 *   only — it never wakes idle Agents, never retries, never records a
 *   ledger, and its success or failure NEVER touches the mutation result
 *   or the mutation ack (the commit-before-ack path of
 *   `GovernanceMutationService.mutatePermission` stays untouched: this
 *   layer is called AFTER the ack and observes it, never wraps it);
 * - the PROJECTION half is a READ view over the durable overlay snapshots
 *   and their history, reached through the EXISTING access boundaries only
 *   (the PR1 `PermissionOverlayRepositoryPort` members `latest` /
 *   `history` — never `append`, which the injected type narrows away).
 *
 * Authority boundary (the reason this module imports NOTHING at runtime):
 * - every vocabulary type here is TYPE-ONLY (the PR1 overlay vocabulary
 *   through `../permission-governance/*`), so this lane carries no runtime
 *   edge to governance, storage, the resolver, or the host;
 * - nothing here is an input to any decision: the notification renders
 *   metadata (identity / generation / provenance / rule COUNT — never the
 *   rule set), the projection mirrors durable rows as frozen read views,
 *   and the module exposes no authorize / resolve / assemble / mutate /
 *   grant / revoke / envelope member (pinned structurally by
 *   `test/a3p5-permission-notification-lane-hygiene.test.ts`);
 * - a stale notification only MARKS its generation (and the superseding
 *   generation when known); permissions live in the durable store and this
 *   lane can neither read-modify nor write them.
 *
 * WIRED VS PENDING (current state, see the module README): the notification
 * emitter is WIRED at exactly ONE production point — `src/plugin/root.ts`,
 * the governance-mutation completion point (post-COMMIT, detached,
 * inject-only receipt gate). The READ PROJECTION remains a library until a
 * production read surface consumes it. The layer's outputs are consumed by
 * NOTHING else — awareness, never authorization evidence (ADR §9).
 *
 * @module @dsh-agent-team/runtime/permission-notification/types
 */
import type { PermissionOverlayIdentity } from '../permission-governance/types.js';
/** Re-export of the ADR §2 identity pair (one definition, PR1 owns it). */
export type { PermissionOverlayIdentity } from '../permission-governance/types.js';
/**
 * The closed liveness answer of one addressed Agent, as read READ-ONLY from
 * the existing runtime surfaces (the DSH Agent `status === 'idle'`
 * semantics the existing notification glue already uses; the production
 * binding of this port is the root splice's advisory read over the glue
 * receipt point — never a decision, never a wake).
 *
 * `unknown` is a DISTINCT state (no live binding, closed glue, failed
 * read): like `idle` it suppresses delivery — the awareness layer never
 * guesses liveness and never performs a wake.
 */
export type PermissionAgentLiveness = 'active' | 'idle' | 'unknown';
/**
 * The identity the liveness question is asked for — the ADR §2 identity
 * pair verbatim (an alias, so the vocabulary has exactly one definition).
 */
export type PermissionAgentLivenessQuery = PermissionOverlayIdentity;
/**
 * The READ-ONLY liveness seam. Exactly ONE member, ONE question, zero side
 * effects: it must never wake, queue, materialize or resume anything — the
 * idle-never-awakened rule (plan PR5) is enforced by THIS port's contract
 * plus the notifier's active-only gate, and pinned by the specs.
 */
export interface PermissionAgentLivenessPort {
    /**
     * Read the CURRENT liveness of one addressed Agent (no latch, no
     * subscription — a point read, best-effort). A throw is handled by the
     * notifier as `unknown` (delivery suppressed).
     * @param query - the addressed (TeamSession, MemberInstance) pair.
     */
    status(query: PermissionAgentLivenessQuery): Promise<PermissionAgentLiveness>;
}
/**
 * The delivery seam: put ONE model-visible input in front of one
 * ACTIVE Agent WITHOUT waking anything. The production binding is the
 * binding module's INJECT-ONLY receipt gate (parent GO ruling, pinned to
 * pristine 0.1.7-rc.1: the public `Agent.inject` is the one input whose
 * implementation never wakes and never latches; `steer`/`followup` start
 * a turn on an idle target and are FORBIDDEN in this layer). The seam
 * owns the at-MOST-once best-effort attempt: no redelivery, no
 * acknowledgement, no queue of its own (host durable-inbox semantics are
 * the upstream's own; the durable snapshot store is the authority; the
 * read projection is the recovery path for a lost notice).
 */
export interface PermissionNotificationDeliveryPort {
    /**
     * Deliver the rendered text to one addressed Agent. A throw is a
     * LIVENESS failure only — the notifier converts it into a typed
     * outcome and never rethrows to its caller, so a failed delivery can
     * never alter an already-returned mutation result or ack.
     */
    deliver(input: {
        readonly teamSessionId: string;
        readonly memberInstanceId: string;
        readonly text: string;
    }): Promise<void>;
}
/**
 * One awareness record built from ONE committed `PermissionOverlaySnapshot`
 * (the changed:true branch of the PR3 mutation result). Every field is a
 * primitive COPY of durable metadata — the record deliberately carries NO
 * rule set, no effect, no matcher: it cannot describe a permission STATE,
 * only the fact and generation that one changed (the state payload stays
 * behind the read projection, ADR §9 "awareness only").
 */
export interface PermissionChangeNotification {
    /** The owning TeamSession (ADR §2 identity). */
    readonly teamSessionId: string;
    /** The addressed MemberInstance whose overlay changed (ADR §2 identity). */
    readonly memberInstanceId: string;
    /** The durable snapshot this notice names (derived row key). */
    readonly snapshotId: string;
    /** THE GENERATION TAG: the snapshot's monotonic overlay generation. */
    readonly generation: number;
    /** The replaced snapshot id (`null` exactly at generation 1). */
    readonly previousSnapshotId: string | null;
    /** Provenance carrier: the producing mutation id (audit, never precedence). */
    readonly mutationId: string;
    /** Provenance carrier: the durable actor verbatim (audit, never precedence). */
    readonly actor: string;
    /** Provenance carrier: the durable commit timestamp, ISO-8601. */
    readonly changedAt: string;
    /** Provenance carrier: the audit reason (whitespace-collapsed, bounded). */
    readonly reason: string;
    /** How many rules the new snapshot carries (COUNT only, never the rules). */
    readonly ruleCount: number;
}
/**
 * The staleness judgement attached to one DELIVERED notice:
 * - `current` — the notice's generation equals the durable authority;
 * - `superseded` — the durable authority has moved past it (the rendered
 *   text marks BOTH generations; the notice can never alter permissions);
 * - `unknown` — the durable authority could not be read at delivery time,
 *   so staleness is honestly undetermined (the text says so; the read
 *   projection is the authority).
 */
export type PermissionNotificationStaleness = 'current' | 'superseded' | 'unknown';
/** Why a notice was NOT delivered (each case leaves durable state untouched). */
export type PermissionNotificationSkip = 
/** The target Agent is idle — never awakened (plan PR5 active-only rule). */
'agent-idle'
/** The target Agent is not live (closed glue, failed read, no binding). */
 | 'agent-liveness-unknown'
/** The delivery seam threw — a liveness failure only. */
 | 'delivery-failed';
/**
 * The notifier's outcome — an AWARENESS report, structurally incapable of
 * carrying permission state and never joined into a mutation result. The
 * notifier NEVER throws: every seam failure lands in this closed union.
 */
export type PermissionNotificationOutcome = {
    readonly delivered: true;
    readonly staleness: PermissionNotificationStaleness;
} | {
    readonly delivered: false;
    readonly skip: PermissionNotificationSkip;
};
/** The provenance copy of a durable snapshot (audit data, never precedence). */
export interface PermissionProvenanceView {
    /** The durable actor verbatim (no authority meaning; ADR §7). */
    readonly actor: string;
    /** The producing mutation id. */
    readonly mutationId: string;
    /** ISO-8601 commit timestamp. */
    readonly timestamp: string;
    /** The audit reason (verbatim from the durable row). */
    readonly reason: string;
}
/**
 * The frozen read view of the CURRENT AUTHORITY of one identity: either
 * `present: false` (no snapshot yet) or a faithful deep-frozen COPY of the
 * highest-generation durable snapshot. It is a MIRROR of the durable row,
 * never a fold, never a replay, never a decision input — writing back is
 * structurally impossible (frozen, no identity of the stored row preserved).
 */
export type PermissionAuthorityView = {
    readonly present: false;
    /** The queried identity (echoed for caller ergonomics). */
    readonly identity: PermissionOverlayIdentity;
} | {
    readonly present: true;
    /** The queried identity. */
    readonly identity: PermissionOverlayIdentity;
    /** The derived durable row key. */
    readonly snapshotId: string;
    /** The authority generation (the durable CURRENT authority is the HIGHEST generation). */
    readonly generation: number;
    /** The replaced snapshot id (`null` exactly at generation 1). */
    readonly previousSnapshotId: string | null;
    /** How many rules the authority carries. */
    readonly ruleCount: number;
    /** Frozen copies of the authority's rules (read view; never interpreted here). */
    readonly rules: readonly {
        readonly operation: string;
        readonly resource: string;
        readonly effect: 'allow' | 'ask' | 'deny';
    }[];
    /** Frozen provenance copy (audit only). */
    readonly provenance: PermissionProvenanceView;
};
/** One ascending audit entry of the history view (audit only, never folded). */
export interface PermissionHistoryEntryView {
    /** The derived durable row key. */
    readonly snapshotId: string;
    /** This row's generation (ascending across the view). */
    readonly generation: number;
    /** The replaced snapshot id (`null` exactly at generation 1). */
    readonly previousSnapshotId: string | null;
    /** How many rules this row carried. */
    readonly ruleCount: number;
    /** Frozen provenance copy (audit only). */
    readonly provenance: PermissionProvenanceView;
}
/** The frozen history-audit view of one identity (ascending by generation). */
export interface PermissionHistoryAuditView {
    /** The queried identity. */
    readonly identity: PermissionOverlayIdentity;
    /** The durable audit rows, ascending by generation (empty when none). */
    readonly entries: readonly PermissionHistoryEntryView[];
}
/**
 * The read projection surface. TWO members, both pure reads through the
 * existing PR1 port boundaries (`latest` / `history`); the injected port
 * type NARROWS `append` away, so the projection cannot write even by
 * accident — and the specs additionally wrap the port in a Proxy that
 * throws on any other member access.
 */
export interface PermissionReadProjection {
    /** The CURRENT AUTHORITY view (the highest-generation snapshot, never a fold). */
    readAuthority(identity: PermissionOverlayIdentity): Promise<PermissionAuthorityView>;
    /** The AUDIT history view (ascending; audit-only, ADR §2 — never folded). */
    readHistoryAudit(identity: PermissionOverlayIdentity): Promise<PermissionHistoryAuditView>;
}
//# sourceMappingURL=types.d.ts.map