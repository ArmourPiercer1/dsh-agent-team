/**
 * P8-S6 A30 — the production live-residency diagnostic overlay
 * (plan §20.1 / UI §24).
 *
 * The {@link LiveResidencyOverlayPort} the P8-T2 projection service folds
 * into its member rows (the "optional live residency diagnostic" of
 * §20.1). This is the READ-ONLY half of the projection: it reports, for
 * every durable member instance, whether the agent runtime is currently
 * resident, through the live-agent glue bundle's residency surface.
 *
 * Derivation (documented per the §20.1 fixed field semantics):
 *
 * - the snapshot is TEAM-SCOPED (PR #35 second follow-up P0-1): it iterates
 *   the DURABLE member rows of EXACTLY ONE TeamSession —
 *   `memberInstances.list(teamSessionId)` — and never merges across teams.
 *   Instance ids are WITHIN-team identities (every team's leader is
 *   `inst-leader`; the cross-team identity is `(teamSessionId, instanceId)`),
 *   so a host-wide merged map is UNSOUND (two teams' `inst-leader` rows
 *   collide). Any team the host durably owns (P9-S8: the boot root + teams
 *   created after boot through `team.create` / `handoff.create`) is
 *   servable — the caller requests the team it serves;
 *   the snapshot NEVER scans child Session logs and NEVER touches the
 *   (ephemeral) SessionController Team mirror — the residency fact is the
 *   live glue's own `hasLive` state (the agent handle's residency), not a
 *   reconstructed session-log fact;
 * - a row with a durable `childSessionId` (every boot-world row, including
 *   the leader — its child session IS the root session) is `resident` when
 *   `live.hasLive(childSessionId)`, else `cold`; a `DISPOSED` row is
 *   excluded (it has no live facts — the fold maps absence to
 *   `liveActivity: null`);
 * - a v2 leader row carrying no `childSessionId` is resolved against the
 *   root session of its OWN team (the leader's session is the root) by the
 *   same rule;
 * - `resuming` IS derivable (P8-S7 R2-5 / F12): the live glue owns a
 *   per-session resuming marker (agent-bindings.mjs `resumingSessions` —
 *   written at the production resume points, `ensureLiveAgent` and the
 *   boot resume phase; cleared when the resume settles, success or
 *   failure). This overlay reads it through `live.isResuming`; it never
 *   invents the state — a row is `resuming` only while the glue
 *   reports an in-flight resume for that row's session.
 *
 * Pure read: no I/O beyond the repository list + the residency flag + the
 * resuming marker, no `node:` builtins, no clock writes (the injected
 * clock only stamps the `lastActivityAt` of a resident row).
 * @module @dsh-agent-team/runtime/plugin/s6-live-overlay
 */
import { MEMBER_LIFECYCLE_STATES, RESIDENCY_STATES, } from '../../../contracts/src/index.js';
/**
 * Build the production {@link LiveResidencyOverlayPort} — the TEAM-SCOPED
 * live-residency snapshot (PR #35 second follow-up P0-1). Every
 * `snapshot(teamSessionId)` reads the durable member rows of exactly that
 * team and its live children; teams are never merged, because instance ids
 * are within-team identities (every team's leader is `inst-leader`) and the
 * cross-team identity is `(teamSessionId, instanceId)`. Any TeamSession the
 * host durably owns (the boot root + P9-S8 post-boot teams) is servable.
 * @param options - the repositories + the live glue + the clock.
 * @returns the read-only overlay port.
 */
export function createLiveResidencyOverlay(options) {
    const { repositories, live, now } = options;
    function snapshot(teamSessionId) {
        const result = new Map();
        // Team-scoped (P0-1): the durable member rows of EXACTLY this team. No
        // `teamSessions.list()` walk, no merge across owned roots — a host-wide
        // map is unsound because `inst-leader` (and every member instance id)
        // recurs in every team, and the same id is a different live fact per
        // team (Team A / inst-leader = resident vs Team B / inst-leader = cold).
        for (const record of repositories.memberInstances.list(teamSessionId)) {
            // The repository deserializes every row through the documented type
            // lie (a v2 LeaderInstanceRecordDto can arrive under the member
            // record type — its absent `childSessionId` / `lifecycle` keys are
            // invisible to the declared type), so discriminate STRUCTURALLY at
            // runtime, never by instance id (mirrors the durable read port).
            const row = record;
            const instanceId = row.instanceId;
            // A DISPOSED instance has no live facts: excluded (the fold maps its
            // absence to `liveActivity: null`; the v6 live token maps it to the
            // `absent` marker). Only structurally durable rows carry a lifecycle;
            // a v2 leader row (absent lifecycle) is live by construction and
            // never excluded.
            if ('lifecycle' in row && row.lifecycle === MEMBER_LIFECYCLE_STATES.DISPOSED) {
                continue;
            }
            // The session whose residency defines this instance: the durable child
            // session when present (every boot-world row, including the leader —
            // its child session IS the root), else the root session of the row's
            // own team (a v2 leader row carries no child session) = the requested
            // teamSessionId.
            const childSessionId = 'childSessionId' in row ? row.childSessionId : teamSessionId;
            if (live.hasLive(childSessionId)) {
                result.set(instanceId, {
                    residency: RESIDENCY_STATES.resident,
                    lastActivityAt: now(),
                });
            }
            else if (live.isResuming(childSessionId)) {
                // F12 (P8-S7 R2-5): a cold agent with an in-flight resume at the
                // live glue (the resuming marker — written at the production
                // resume points, cleared when the resume settles). No clock
                // stamp: the row is not live yet, so it carries no live facts
                // beyond the residency state.
                result.set(instanceId, { residency: RESIDENCY_STATES.resuming });
            }
            else {
                result.set(instanceId, { residency: RESIDENCY_STATES.cold });
            }
        }
        return result;
    }
    return { snapshot };
}
//# sourceMappingURL=s6-live-overlay.js.map