/**
 * P9-T4 (S3-A) — team-session resolution over the vNext projection mirror.
 *
 * The vNext successor of the legacy `resolveTeamView` (the frozen legacy
 * fork's derivation, evidence only — the transitional client bridge was
 * folded away in P9-T6): same two-stage derivation, same
 * identity-stable references, plus the vNext additions the legacy
 * surface did not need:
 *
 *   1. OWN KEY — the session IS a TeamSession (root DSH session id,
 *      invariant 9: `TeamSessionId = RootSessionId`): the session's own
 *      projection frame, perspective `team-root`;
 *   2. MEMBER CHILD — a member instance's durable child session (invariant
 *      23): the projection frame of the member's team, perspective
 *      `member-child` naming the instance (the plan §8.10 "current member
 *      perspective highlight" input);
 *   3. DISPOSED CHILD (vNext addition over the legacy surface) — a
 *      `disposedHistory` row's child session: the disposed instance's
 *      team is still reachable from its (now archived) child session,
 *      with the same `member-child` perspective;
 *   4. otherwise `undefined` — an ordinary or legacy session: the kept
 *      UI's one-line zero state (unchanged criterion).
 *
 * Never inferred from labels, templates, or a session list: only the
 * frozen id fields (`teamSessionId`, `members[].childSessionId`,
 * `disposedHistory[].childSessionId`) participate (plan §7.2 "never infer
 * from label/template/session list").
 *
 * Determinism: mirror entries are walked in `Object.keys` order; within a
 * frame, `members` then `disposedHistory` in array order; the FIRST match
 * wins (one root session -> 0 or 1 TeamSession, invariant 8, so a
 * collision is a source anomaly, not a tie-break).
 *
 * Pure module: no React, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/state/team-session-resolution
 */

import type {
  TeamProjectionDto,
  TeamSessionId,
} from '../../../contracts/src/index.js'

/**
 * The team-keyed projection mirror: one `TeamProjectionDto` per known
 * TeamSession (the vNext analogue of the legacy leader-keyed
 * `TeamMirror`; the frames are the generation-verified store frames).
 */
export type TeamProjectionMirror = Readonly<Record<TeamSessionId, TeamProjectionDto>>

/**
 * The viewer perspective resolved for one session (the §8.10 "current
 * member perspective highlight" input, carried as data, never read from
 * the DOM): `team-root` for the TeamSession's own session, `member-child`
 * for a member's bound (or disposed) child session.
 */
export type TeamPerspective =
  | { readonly kind: 'team-root' }
  | { readonly kind: 'member-child'; readonly memberInstanceId: string }

/** One successful resolution: the frame plus the viewer perspective. */
export interface TeamProjectionResolution {
  /** The resolved TeamSession's projection frame (identity-stable reference). */
  readonly team: TeamProjectionDto
  /** How the resolved session belongs to that team. */
  readonly perspective: TeamPerspective
}

/**
 * Resolve one session's team projection and viewer perspective over the
 * mirror (semantics above; the legacy own-key-first, member-scan-second
 * order is preserved).
 *
 * @param mirror - the team-keyed projection mirror (may be empty).
 * @param sessionId - the session to resolve (any DSH session id; branded
 *   vNext ids are accepted, plain strings are the wire level).
 * @returns the frame + perspective, or `undefined` for a non-team session.
 */
export function resolveTeamProjection(
  mirror: TeamProjectionMirror,
  sessionId: string,
): TeamProjectionResolution | undefined {
  // 1. Own key: the session IS the TeamSession (root session, invariant 9).
  //    One documented boundary cast: the mirror is keyed by the branded
  //    TeamSessionId; the caller's session id is the same string at the
  //    wire level.
  const own = mirror[sessionId as TeamSessionId]
  if (own !== undefined) {
    return { team: own, perspective: { kind: 'team-root' } }
  }
  // 2./3. Member child scan, then disposed child scan (deterministic
  //   Object.keys order; members before disposedHistory).
  for (const key of Object.keys(mirror)) {
    const view = mirror[key as TeamSessionId]
    if (view === undefined) continue
    const member = view.members.find(candidate => candidate.childSessionId === sessionId)
    if (member !== undefined) {
      return { team: view, perspective: { kind: 'member-child', memberInstanceId: member.instanceId } }
    }
    const history = view.disposedHistory?.find(candidate => candidate.childSessionId === sessionId)
    if (history !== undefined) {
      return {
        team: view,
        perspective: { kind: 'member-child', memberInstanceId: history.instanceId },
      }
    }
  }
  return undefined
}

/**
 * Equality comparator for the resolution selector (the slot selector
 * hook's optional `eq` seat): `resolveTeamProjection` returns a fresh
 * wrapper object per call, so the default Object.is comparison would
 * re-render on every notification even when nothing changed. Two
 * resolutions are equal when they name the same team reference (the
 * projection frames are identity-stable) and the same viewer perspective.
 * @param a - the previously selected resolution (or `undefined`).
 * @param b - the freshly selected resolution (or `undefined`).
 * @returns whether both selections name the same team + perspective.
 */
export function sameTeamProjectionResolution(
  a: TeamProjectionResolution | undefined,
  b: TeamProjectionResolution | undefined,
): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined) return false
  if (a.team !== b.team) return false
  if (a.perspective.kind === 'member-child' && b.perspective.kind === 'member-child') {
    return a.perspective.memberInstanceId === b.perspective.memberInstanceId
  }
  return a.perspective.kind === 'team-root' && b.perspective.kind === 'team-root'
}
