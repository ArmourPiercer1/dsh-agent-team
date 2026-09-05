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
 * - the snapshot iterates the DURABLE member rows of the host's OWNED roots
 *   (P9-S8: the bound root + any TeamSession root the host durably owns —
 *   teams created after boot through `team.create` / `handoff.create`),
 *   via `memberInstances.list(root)` per owned root, NEVER scanning child
 *   Session logs and NEVER touching the (ephemeral) SessionController Team
 *   mirror — the residency fact is the live glue's own `hasLive` state
 *   (the agent handle's residency), not a reconstructed session-log fact;
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
    /** The bound root session id (the boot root; the snapshot additionally
     *  covers every TeamSession root the host durably owns — P9-S8). */
    readonly rootSessionId: string;
    /** The deterministic clock (ISO-8601) stamping resident rows. */
    readonly now: () => string;
}
/**
 * Build the production {@link LiveResidencyOverlayPort} over the host's
 * owned roots (the bound root + every durably owned TeamSession — P9-S8).
 * @param options - the repositories + the live glue + the root + the clock.
 * @returns the read-only overlay port.
 */
export declare function createLiveResidencyOverlay(options: LiveResidencyOverlayOptions): LiveResidencyOverlayPort;
//# sourceMappingURL=s6-live-overlay.d.ts.map