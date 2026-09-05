/**
 * P6-T3 — the member→member mediation decision (pure, fail closed).
 *
 * The EXACT member→member mediation rule the task card requires to be
 * documented (the full rule, for every caller kind):
 *
 * 1. **Human caller** → `direct` (the attributed input goes to the
 *    recipient's own bound session). The human owner is not bound by the
 *    team envelope (invariant 34) and is the team's coordination authority.
 * 2. **Leader caller** (the LeaderInstance — `instanceId ===
 *    LEADER_INSTANCE_ID`, the role the facade resolves) → `direct`. The
 *    leader coordinates the team within its envelope (invariant 36).
 * 3. **Member caller, recipient is the leader** → `direct`. Upward
 *    coordination is never mediated: a member always reaches its leader
 *    (the facade's envelope check on the `send-message` op still applies —
 *    mediation only decides the DELIVERY PATH, it never grants authority).
 * 4. **Member caller, recipient is a PEER** → `direct` iff the sender's
 *    LATEST instance-scoped autonomy overlay (kind `autonomy-overlay`,
 *    scope `instance`, `instanceId` = the SENDER — grants are per-sender,
 *    never per-recipient) carries `values.messagingPeerDirect === true`
 *    (the P6-T3 grant key {@link PEER_DIRECT_GRANT_KEY}). The overlay is
 *    the authority-recorded grant written by ANOTHER authority (leader or
 *    member record of higher standing); a member cannot self-escalate by
 *    writing its own overlay (invariant 37 — enforced by the P4 governance
 *    store, not re-implemented here). Otherwise → `mediated`: the
 *    attributed input is delivered to the LEADER's bound session (marked
 *    `intended-for` the peer in the attribution and the relay text); the
 *    leader acknowledges / relays itself — the runtime NEVER auto-forwards.
 * 5. **Fail closed**: any missing/unknown caller identity, absent overlay
 *    record, or grant value that is not strictly `true` → `mediated` (the
 *    default). The decision consumes only durable, lossless-JSON records.
 *
 * The delivery target's liveness is NOT part of this decision: it is
 * checked fresh at delivery time by the coordinator (a dead target fails
 * closed with `MESSAGING_TARGET_NOT_LIVE`, the intent fact remains).
 *
 * Pure module: no I/O.
 * @module messaging (P6-T3)
 */
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js';
/**
 * The P6-T3 overlay grant key for direct peer-to-peer messaging: an
 * instance-scoped `autonomy-overlay` whose `values` carry
 * `messagingPeerDirect: true` (strictly `true`) grants that SENDER direct
 * member→member delivery. Any other value (absent, `false`, a string, ...)
 * means NO grant (fail closed).
 */
export const PEER_DIRECT_GRANT_KEY = 'messagingPeerDirect';
/** The closed decision reasons (audit vocabulary of the plan). */
export const DELIVERY_PLAN_REASONS = {
    /** Rule 1: the human caller is unbounded (invariant 34). */
    HUMAN_CALLER: 'human-caller',
    /** Rule 2: the LeaderInstance caller (invariant 36). */
    LEADER_CALLER: 'leader-caller',
    /** Rule 3: a member always reaches its leader directly. */
    MEMBER_TO_LEADER: 'member-to-leader',
    /** Rule 4 (grant branch): the sender holds the peer-direct grant. */
    PEER_DIRECT_GRANTED: 'peer-direct-granted',
    /** Rule 4 (default branch) / rule 5: fail-closed mediation via the
     *  leader. */
    MEMBER_TO_MEMBER_DEFAULT: 'member-to-member-default-mediation',
};
/**
 * Whether the sender's LATEST instance-scoped autonomy overlay grants
 * direct peer-to-peer messaging.
 *
 * "Latest" = the highest `generation` among the records with
 * (kind `autonomy-overlay`, scope `instance`, `instanceId` = the sender);
 * a grant in a superseded generation does not count.
 *
 * @param overlays - the team's governance override records (durable view).
 * @param senderInstanceId - the sending instance id.
 * @returns `true` iff the latest matching overlay carries the grant
 *  strictly.
 */
export function peerDirectGranted(overlays, senderInstanceId) {
    let latest;
    for (const record of overlays) {
        if (record.kind !== 'autonomy-overlay')
            continue;
        if (record.scope !== 'instance')
            continue;
        if (record.instanceId !== senderInstanceId)
            continue;
        if (latest === undefined || record.generation > latest.generation) {
            latest = record;
        }
    }
    if (latest === undefined)
        return false;
    return latest.values[PEER_DIRECT_GRANT_KEY] === true;
}
/**
 * Decide the delivery plan of one send (the documented rule above).
 *
 * @param args.caller - the validated caller ref (the shape durably stored
 *  in the intent fact's `payload.caller`).
 * @param args.recipientInstanceId - the intended recipient instance id.
 * @param args.overlays - the team's governance override records (fresh
 *  durable view).
 * @returns the delivery plan (lossless JSON).
 */
export function decideDeliveryPlan(args) {
    const { caller, recipientInstanceId, overlays } = args;
    const leaderInstanceId = String(LEADER_INSTANCE_ID);
    // Rule 1 — the human caller.
    if (caller.kind === 'human') {
        return {
            deliveryMode: 'direct',
            deliveredToInstanceId: recipientInstanceId,
            reason: DELIVERY_PLAN_REASONS.HUMAN_CALLER,
        };
    }
    // Rule 2 — the LeaderInstance caller (the recorded role, or the frozen
    // leader instance id — they agree by the facade's resolution).
    if (caller.role === 'leader' ||
        caller.instanceId === leaderInstanceId) {
        return {
            deliveryMode: 'direct',
            deliveredToInstanceId: recipientInstanceId,
            reason: DELIVERY_PLAN_REASONS.LEADER_CALLER,
        };
    }
    // Rule 3 — a member always reaches its leader directly.
    if (recipientInstanceId === leaderInstanceId) {
        return {
            deliveryMode: 'direct',
            deliveredToInstanceId: recipientInstanceId,
            reason: DELIVERY_PLAN_REASONS.MEMBER_TO_LEADER,
        };
    }
    // Rule 4 — member→member peer: the per-sender overlay grant decides.
    if (peerDirectGranted(overlays, caller.instanceId)) {
        return {
            deliveryMode: 'direct',
            deliveredToInstanceId: recipientInstanceId,
            reason: DELIVERY_PLAN_REASONS.PEER_DIRECT_GRANTED,
        };
    }
    // Rule 4 default / rule 5 — fail-closed mediation via the leader.
    return {
        deliveryMode: 'mediated',
        deliveredToInstanceId: leaderInstanceId,
        reason: DELIVERY_PLAN_REASONS.MEMBER_TO_MEMBER_DEFAULT,
    };
}
/**
 * Render the deterministic relay text of one delivery (ordinary
 * first-person input for the target session; the attribution carries the
 * structured correlation, this text carries the human/agent-readable form).
 *
 * @param args.fromRef - the rendered sender reference (e.g.
 *  `inst-p6t3seedw01 (label: existing-worker)` or `human:human-p6t3-owner`).
 * @param args.recipientRef - the rendered intended-recipient reference.
 * @param args.deliveryMode - the executed delivery mode.
 * @param args.subject - the optional subject (omitted when absent).
 * @param args.body - the message body (verbatim).
 * @returns the relay text.
 */
export function renderRelayText(args) {
    const header = args.deliveryMode === 'direct'
        ? `[team-relay] from=${args.fromRef} to=${args.recipientRef}`
        : `[team-relay:mediated via leader] from=${args.fromRef} intended-for=${args.recipientRef}`;
    const subjectLine = args.subject !== undefined ? `subject=${args.subject}\n` : '';
    return `${header}\n${subjectLine}${args.body}`;
}
//# sourceMappingURL=mediation.js.map