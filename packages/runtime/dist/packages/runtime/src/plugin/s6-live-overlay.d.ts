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
import type { TeamDomainRepositories } from '../../../storage/repositories/index.js';
import type { LiveResidencyOverlayPort } from '../../projection/index.js';
import type { TeamAgentBindings } from './types.js';
/** The construction inputs of the production live-residency overlay. */
export interface LiveResidencyOverlayOptions {
    /** The open TeamDomain repositories (the durable member rows). */
    readonly repositories: TeamDomainRepositories;
    /** The live-agent glue bundle (the residency flag source). */
    readonly live: TeamAgentBindings;
    /** The deterministic clock (ISO-8601) stamping resident rows. */
    readonly now: () => string;
}
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
export declare function createLiveResidencyOverlay(options: LiveResidencyOverlayOptions): LiveResidencyOverlayPort;
//# sourceMappingURL=s6-live-overlay.d.ts.map