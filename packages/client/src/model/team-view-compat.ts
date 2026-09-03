/**
 * P9-T4 — the deprecated legacy-faithful Team view bridge.
 *
 * SCOPE (plan P9-T4, commit table L2132): the kept legacy UI surface
 * (src/ui/Team*.tsx + src/model/team-*-model.ts) and its in-program specs
 * were written against the legacy team-projection view types. T4 adds the
 * vNext data layer (stores + adapters) WITHOUT re-deriving those files
 * (S3-C model migration is T5; the view shell + durable-ledger surface is
 * T6). This bridge is the type-level seam that lets every kept file stay
 * byte-identical in its body: it re-declares the frozen legacy view
 * surface as a local module, so the import specifier is the only line
 * that changes in those files.
 *
 * PROVENANCE (frozen evidence, not a source copy): the type shapes mirror
 * the legacy fork @ pin 506191ba893ac55980dd09680c438710ab24095b,
 * `packages/team/team-projection/src/types.ts` (the 135-line read-only
 * projection view types) and `packages/client/runtime/src/client/
 * sessions/team-mirror.ts` (`TeamMirror` + `resolveTeamView`); the
 * `TeamControlDecision` union mirrors legacy `packages/team/team/src/
 * types.ts` L167. The bridge re-documents those shapes (it is NOT a file
 * copy of `packages/team` — the AGENTS.md red line against copying legacy
 * team source into root packages/ is preserved: this module types the
 * KEPT verbatim UI, it does not bring legacy source code along).
 *
 * DEVIATIONS from the legacy source (documented, both deliberate):
 *   1. `SessionId` here is the PLAIN `string`, not the legacy
 *      `Branded<'SessionId'>`. The kept bodies and their in-program specs
 *      operate on unbranded strings (`'x' as SessionId` casts, plain
 *      literal fixtures); the vNext branded ids live in
 *      `@dsh-agent-team/contracts` and are used only by the new vNext
 *      modules. Plain keeps the legacy assignability in both directions
 *      (branded → plain is always legal; the reverse is never needed in
 *      the kept bodies).
 *   2. `RpcError` here is the OPEN carrier envelope
 *      `{ code: string; message: string; details?: unknown }`, not the
 *      legacy apiproxy closed code union. The legacy carrier itself had
 *      an open catch-all: `transportError()` emits `code: 'internal'`
 *      OUTSIDE the closed business-code map, and the in-program spec
 *      stubs construct `{ code: 'internal', details: {} }` /
 *      `{ code: 'team-anchor-unknown', details: { leaderSessionId } }`.
 *      The open envelope is the level the kept UI actually observes.
 *
 * LIFETIME: `@deprecated` — removed at the END of P9-T6 (the last
 * consumer is the TeamView shell once it reads the vNext stores; T6 drops
 * `TeamMirror` / `messagesBefore` and the durable-ledger surface replaces
 * the message page). Anything NEW written after T4 must not import from
 * this bridge.
 *
 * Pure module: no React, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/model/team-view-compat
 */

import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'

/**
 * Re-exported for the kept UI's slot-face hook declarations
 * (`hooks: { teamMirror: ObservableSnapshot<TeamMirror> }`): the same
 * framework-neutral observable-snapshot contract the DSH client store
 * package publishes (the legacy runtime re-exported exactly this type).
 * Type-only: no runtime immer/zustand coupling for the typechecker.
 */
export type { ObservableSnapshot }

/**
 * The session id as the legacy view surface names it (plain string here —
 * see the module header, deviation 1).
 * @deprecated P9-T4 bridge type; removed at the end of P9-T6.
 */
export type SessionId = string

/**
 * Complete team snapshot keyed by the leader session (legacy projection
 * view, shape-frozen).
 * @deprecated P9-T4 bridge type; removed at the end of P9-T6.
 */
export interface TeamView {
  /** This phase's team identity: always the leader session id (no separate team entity). */
  readonly teamId: string
  /** The leader session whose logs anchor the fold. */
  readonly leaderSessionId: string
  /** Enabled roster definition count (leader included, after enablement filtering). */
  readonly rosterMemberCount: number
  /** Enabled roster members plus every member the logs bound (unbound rows included). */
  readonly members: readonly TeamMemberView[]
  /** One row per leader-log `delegate_to_teammate` call with a parseable teammate id. */
  readonly delegations: readonly TeamDelegationView[]
  /** Latest progress event per taskId, in first-seen order. */
  readonly tasks: readonly TeamTaskView[]
  /** Every control request with its paired decision when one exists. */
  readonly approvals: readonly TeamApprovalView[]
  /** Globally ordered message tail, capped at the legacy message cap (most recent last). */
  readonly messages: readonly TeamMessageView[]
  /** Total message count the fold observed (distinguishes truncation from absence). */
  readonly messageCount: number
}

/** One member row: the roster half joined with the log-bound half. */
export interface TeamMemberView {
  /** The bound member id when bound; otherwise the roster definition id. */
  readonly memberId: string
  /** Roster name; a never-rostered bound member falls back to its creation label (display only). */
  readonly name: string
  readonly role: 'leader' | 'teammate'
  /** Sessions bound to this member (at most one under the persistent policy); empty while unbound. */
  readonly sessionIds: readonly string[]
  /** Log baseline (`unbound`/`bound`/`settled`) with the live running overlay applied. */
  readonly status: 'unbound' | 'bound' | 'running' | 'settled'
  /** Name of the latest tool call in the member's own log suffix; absent while unbound or before any call. */
  readonly currentAction?: string
  /** This member's control requests that still have no paired decision. */
  readonly pendingControlCount: number
}

/** One delegation span from a `delegate_to_teammate` call to its settlement notice. */
export interface TeamDelegationView {
  readonly memberId: string
  /** The settling child id once revealed; an open span names the member's latest bound session ('' when the child log is unavailable). */
  readonly childSessionId: string
  /** The delegate call's event time. */
  readonly startedAt: number
  /** The settlement notice's event time; absent while the span is open. */
  readonly endedAt?: number
  /** True while no settlement notice has closed this span. */
  readonly inProgress: boolean
}

/** One task-board row: the latest progress event for a taskId. */
export interface TeamTaskView {
  readonly taskId: string
  readonly subject: string
  readonly status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  readonly summary?: string
  readonly memberId: string
  /** Log seq of the latest progress event. */
  readonly seq: number
  /** Event time of the latest progress event (the row's timeline endpoint). */
  readonly at: number
}

/** One control request paired with its decision when the leader log carries one. */
export interface TeamApprovalView {
  readonly requestId: string
  readonly memberId: string
  readonly toolName: string
  readonly reason: string
  readonly kind?: 'tool' | 'plan'
  /** Event time of the request. */
  readonly requestedAt: number
  /** Paired control decision; absent means the request is still pending in the log view. */
  readonly decision?: {
    readonly value: TeamControlDecision
    readonly reason?: string
    readonly decidedAt: number
  }
}

/** One member-to-member message in the global order. */
export interface TeamMessageView {
  readonly from: string
  readonly to: string
  readonly message: string
  /** Event time. */
  readonly at: number
  /** Event seq within the recording session. */
  readonly seq: number
  /** The session that recorded the event (the sender's session). */
  readonly sessionId: string
}

/** Identifies one folded message: the global order's deciding triple. */
export interface MessageAnchor {
  readonly at: number
  readonly sessionId: string
  readonly seq: number
}

/** One older-messages page: strictly earlier than the anchor, ascending, at most `limit` rows. */
export interface TeamMessagePage {
  readonly kind: 'message-page'
  /** Echoes the team identity for concurrent-request matching. */
  readonly teamId: string
  /** Echoes the request's leader session. */
  readonly leaderSessionId: string
  readonly messages: readonly TeamMessageView[]
  /** Same count basis as the snapshot; the client derives hasMore from loaded < messageCount. */
  readonly messageCount: number
}

/** Pagination options for the message-page request form. */
export interface TeamPageOptions {
  /** Anchor naming one folded message; the page is strictly earlier. */
  readonly messagesBefore?: MessageAnchor
  /** Page length bound; defaults to the legacy message cap. */
  readonly limit?: number
}

/** Change-feed listener: one call per committed leader snapshot. */
export type TeamProjectionListener = (leaderSessionId: SessionId, view: TeamView) => void

/**
 * The closed five-value control decision vocabulary (legacy
 * `packages/team/team/src/types.ts` L167).
 * @deprecated P9-T4 bridge type; removed at the end of P9-T6.
 */
export type TeamControlDecision =
  | 'allow_once'
  | 'deny'
  | 'escalate_to_user'
  | 'approve_plan'
  | 'request_revision'

/**
 * The leader-keyed mirror: one committed team view per leader session
 * (legacy `team-mirror.ts` L12 shape).
 * @deprecated P9-T4 bridge type; removed at the end of P9-T6.
 */
export type TeamMirror = Readonly<Record<SessionId, TeamView>>

/**
 * The open carrier-level RPC error envelope (see module header,
 * deviation 2): what the kept UI and its spec stubs observe, code
 * unbounded, `details` an opaque payload.
 * @deprecated P9-T4 bridge type; removed at the end of P9-T6.
 */
export interface RpcError {
  readonly code: string
  readonly message: string
  readonly details?: unknown
}

/** The legacy two-arm RPC result the kept UI is written against. */
export type RpcResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RpcError }

/**
 * Resolve one session's team view over the leader-keyed mirror (legacy
 * `resolveTeamView`, semantics verbatim): the own-key hit first, then the
 * member-binding scan (a view whose any member row binds the session is
 * that session's team view), else `undefined` — the non-team zero state.
 * Returns the stored reference (identity-stable across mirror frames).
 *
 * @deprecated P9-T4 bridge value; removed at the end of P9-T6 (replaced by
 *   `team-session-resolution.ts` + the vNext projection store).
 */
export function resolveTeamView(mirror: TeamMirror, sessionId: SessionId): TeamView | undefined {
  const own = mirror[sessionId]
  if (own !== undefined) return own
  for (const leader of Object.keys(mirror)) {
    const view = mirror[leader as SessionId]
    if (view !== undefined && view.members.some(member => member.sessionIds.includes(sessionId))) return view
  }
  return undefined
}
