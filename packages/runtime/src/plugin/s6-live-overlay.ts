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

import {
  MEMBER_LIFECYCLE_STATES,
  RESIDENCY_STATES,
} from '../../../contracts/src/index.js'
import type {
  InstanceId,
  LeaderInstanceRecordDto,
  MemberInstanceRecordDto,
  MemberLiveActivityDto,
} from '../../../contracts/src/index.js'
import type { TeamDomainRepositories } from '../../../storage/repositories/index.js'
import type { LiveResidencyOverlayPort } from '../../projection/index.js'
import type { TeamAgentBindings } from './types.js'

/** The construction inputs of the production live-residency overlay. */
export interface LiveResidencyOverlayOptions {
  /** The open TeamDomain repositories (the durable member rows). */
  readonly repositories: TeamDomainRepositories
  /** The live-agent glue bundle (the residency flag source). */
  readonly live: TeamAgentBindings
  /** The bound root session id (the boot root; the snapshot additionally
   *  covers every TeamSession root the host durably owns — P9-S8). */
  readonly rootSessionId: string
  /** The deterministic clock (ISO-8601) stamping resident rows. */
  readonly now: () => string
}

/**
 * Build the production {@link LiveResidencyOverlayPort} over the host's
 * owned roots (the bound root + every durably owned TeamSession — P9-S8).
 * @param options - the repositories + the live glue + the root + the clock.
 * @returns the read-only overlay port.
 */
export function createLiveResidencyOverlay(
  options: LiveResidencyOverlayOptions,
): LiveResidencyOverlayPort {
  const { repositories, live, rootSessionId, now } = options

  function snapshot(): ReadonlyMap<InstanceId, MemberLiveActivityDto> {
    const result = new Map<InstanceId, MemberLiveActivityDto>()
    // P9-S8 — the overlay covers the host's OWNED roots, not only the bound
    // root: teams created after boot through `team.create` /
    // `handoff.create` carry their own durable rows and their own live
    // children, and their projections must carry their own residency.
    // Instance ids are globally unique rows, so merging across owned roots
    // is well-defined; each team's projection fold reads only its own
    // members from the map.
    const roots = new Set<string>([rootSessionId])
    for (const record of repositories.teamSessions.list()) {
      roots.add(record.rootSessionId)
    }
    for (const root of roots) {
      for (const record of repositories.memberInstances.list(root)) {
        // The repository deserializes every row through the documented type
        // lie (a v2 LeaderInstanceRecordDto can arrive under the member
        // record type — its absent `childSessionId` / `lifecycle` keys are
        // invisible to the declared type), so discriminate STRUCTURALLY at
        // runtime, never by instance id (mirrors the durable read port).
        const row = record as MemberInstanceRecordDto | LeaderInstanceRecordDto
        const instanceId = row.instanceId as InstanceId

        // A DISPOSED instance has no live facts: excluded (the fold maps its
        // absence to `liveActivity: null`). Only structurally durable rows
        // carry a lifecycle; a v2 leader row (absent lifecycle) is live by
        // construction and never excluded.
        if ('lifecycle' in row && row.lifecycle === MEMBER_LIFECYCLE_STATES.DISPOSED) {
          continue
        }

        // The session whose residency defines this instance: the durable child
        // session when present (every boot-world row, including the leader —
        // its child session IS the root), else the root session of the row's
        // own team (a v2 leader row carries no child session).
        const childSessionId = 'childSessionId' in row ? row.childSessionId : root

        if (live.hasLive(childSessionId)) {
          result.set(instanceId, {
            residency: RESIDENCY_STATES.resident,
            lastActivityAt: now(),
          })
        } else if (live.isResuming(childSessionId)) {
          // F12 (P8-S7 R2-5): a cold agent with an in-flight resume at the
          // live glue (the resuming marker — written at the production
          // resume points, cleared when the resume settles). No clock
          // stamp: the row is not live yet, so it carries no live facts
          // beyond the residency state.
          result.set(instanceId, { residency: RESIDENCY_STATES.resuming })
        } else {
          result.set(instanceId, { residency: RESIDENCY_STATES.cold })
        }
      }
    }
    return result
  }

  return { snapshot }
}
