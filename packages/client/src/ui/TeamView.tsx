/**
 * Team conversation view entry: the "团队" tab (P9-T6 collapse). Every
 * section — zero state, timeline, members, activity, and the durable
 * ledger Events surface — resolves the current session through the vNext
 * projection path (the per-session projection mirror plus the per-team
 * ledger store), cold-pulled once when the mirror lacks the session (the
 * frames win), and renders the one-line zero state for every non-team
 * session. The compat mirror path (TeamMirror / `resolveTeamView` /
 * `ensureTeam` / `pageTeamMessages`) is folded away: the durable ledger is
 * the only event authority (plan §8.10 ADAPT), and the four sections are
 * the UI §12.1 fixed order — Timeline → Members → Activity → Events —
 * from ONE input.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the conversation.view slot declaration (declared by
// ui-conversation's session body) must be in the program for this props type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {
  ProjectionSyncAssessment,
  RemoteCatalogGetParams,
  RemoteIntentProbeParams,
  RemoteResponse,
  RemoteTeamAdmitInitialWorkParams,
  RemoteTeamCreateParamsV2,
  RemoteTeamListCorruptControlLegsParams,
  RemoteTeamResolveControlParams,
} from '../../../remote/src/index.js'
import type { TeamProjectionMirror } from '../state/team-session-resolution.js'
import type { TeamProjectionState } from '../state/team-projection-store.js'
import type { TeamReadStateOutcome } from '../state/team-read-state.js'
import type {
  TeamRefreshRoundResult,
  TeamRefreshTrigger,
} from '../state/team-refresh-coordinator.js'
import {
  resolveTeamProjection, sameTeamProjectionResolution,
} from '../state/team-session-resolution.js'
import type { TeamLedgerState } from '../state/team-ledger-store.js'
import { adaptTeamProjection } from '../model/projection-adapter.js'
import { ledgerModelFromStoreState } from '../model/ledger-adapter.js'
import {
  interpretResolveControlProbe,
  RESOLVE_CONTROL_PROBE_REQUEST_ID,
} from '../model/control-surface.js'
import {
  corruptControlLegsParams,
  corruptionReadFailed,
  corruptionReadSucceeded,
  corruptionStateCleared,
  corruptionStateForKey,
  EMPTY_CONTROL_CORRUPTION_READ_STATE,
  parseControlCorruption,
  planControlCorruptionRender,
  type ControlCorruptionReadState,
} from '../model/control-corruption.js'
import type { TeamOpenModeOutcome } from '../plugin/team-mount-core.js'
import type { TeamIntentDraft, TeamPresetRow } from '../model/team-intent-model.js'
import {
  emptyTeamIntentDraft, teamWorkspaceOptions,
} from '../model/team-intent-model.js'
import { TeamTimeline } from './TeamTimeline.js'
import { TeamMembers, type TeamMembersCommandFace } from './TeamMembers.js'
import { TeamActivity } from './TeamActivity.js'
import { TeamLedger } from './TeamLedger.js'
import {
  TeamCreationPanel,
  type TeamCreationHandoffFace,
} from './TeamCreationPanel.js'
import { TeamGovernance, type TeamGovernanceFace } from './TeamGovernance.js'
import {
  parseLegacyInspection,
  type LegacyInspectionWire,
} from '../model/team-legacy.js'
import styles from './TeamView.module.css'

/**
 * The S5-A New Team creation face (UI §3–§9): the frozen Remote catalog /
 * probe / create wrappers (raw RemoteResponse; parsing stays in the model
 * layer) plus the native seam members. Absent → the zero-state "Start
 * Team from Here" entry hides (the T6 projection-only view is unchanged).
 */
export interface TeamViewCreationFace {
  /** `catalog.list` (raw RemoteResponse). */
  readonly listCatalog: () => Promise<RemoteResponse>
  /** `catalog.get` (one blueprint at one revision). */
  readonly getCatalog: (params: RemoteCatalogGetParams) => Promise<RemoteResponse>
  /** `intent.probe` (the pre-creation compatibility probe). */
  readonly probeCompatibility: (params: RemoteIntentProbeParams) => Promise<RemoteResponse>
  /**
   * `team.create` (contract v2, TCM M4 / plan §15.6) — the workspace-
   * aware CREATE-ONLY creation (stamps contract version 2; the only
   * creation wrapper the new UI uses).
   */
  readonly teamCreate: (params: RemoteTeamCreateParamsV2) => Promise<RemoteResponse>
  /**
   * `team.admitInitialWork` (contract v2, v2-only method, TCM M4 / plan
   * §15.6) — the deferred creation-time initial work (stamps contract
   * version 2).
   */
  readonly teamAdmitInitialWork: (params: RemoteTeamAdmitInitialWorkParams) => Promise<RemoteResponse>
  /**
   * The creation-path session open (D-3): opens the host-created root
   * session, re-pulling the host list once when the stream increment
   * lags the RPC (a bare `open` of an unknown id throws). Rejects when
   * the session is unknown even after the re-pull (the panel's typed
   * error lane).
   */
  readonly openCreatedSession: (sessionId: string) => Promise<void>
  /** The runtime preset rows (the S0 seam-6 mapping; broken rows filtered). */
  readonly listAgentPresets: () => Promise<readonly TeamPresetRow[]>
}

/**
 * One remote-safe row of the v3 `team.listRoots` response — the frozen
 * D1 wire shape (mirror of `packages/runtime/src/team-ownership-index.ts`
 * `TeamRootWireRow`; the client must not value-import the runtime
 * package, so the shape is mirrored locally):
 * `{ rootSessionId, blueprintId, revision, defaultWorkspace?, createdAt,
 * generation, memberCount }`.
 */
export interface TeamRootRowWire {
  readonly rootSessionId: string
  readonly blueprintId: string
  /** The blueprint revision of the snapshot binding (human-readable string). */
  readonly revision: string
  readonly defaultWorkspace?: string
  readonly createdAt: string
  readonly generation: number
  readonly memberCount: number
}

/**
 * D1 (Team D1-D6 repair v2, remote contract v3) — the persisted
 * root-identity face of the zero state: the durable roots query
 * (`team.listRoots`, contract v3) and the explicit Team-mode open
 * guarantee (`team.ensureRootLive`, contract v3 — INERT until D2: the
 * host handler is wired by D2, until then the call resolves to the typed
 * `TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED` failure, never a silent
 * success). Absent → the zero state shows no persisted-roots rows.
 * D1 renders the rows WITHOUT open actions (the open action is added by
 * D2/D3 over this same face).
 */
export interface TeamViewRootsFace {
  /** `team.listRoots` (contract v3; raw RemoteResponse). */
  readonly listRoots: () => Promise<RemoteResponse>
  /**
   * `team.ensureRootLive` (contract v3; raw RemoteResponse; INERT until
   * D2 — see the face doc).
   */
  readonly ensureRootLive: (teamSessionId: string) => Promise<RemoteResponse>
}

/**
 * F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4) — the human
 * control-resolution face: the v4-only `team.resolveControl` wrapper.
 * The HOST derives the human principal from the trusted authenticated
 * UI/session ownership (the T12-B4 connection-gate authority basis) —
 * the closed v4 wire carries NO caller/role fields (adjudication U3),
 * and the frozen `CONTROL_RESOLVER_ROLES` + durable exactly-once
 * semantics stay the only resolver authority (a typed failure is
 * rendered as the row's typed error note). Absent → the Events section
 * renders no Allow/Deny commands (the legacy surface is unchanged).
 */
export interface TeamViewControlFace {
  /**
   * `team.resolveControl` (contract v4; raw RemoteResponse — the typed
   * control vocabulary arrives as the frozen `RemoteResponse` error,
   * never exception-ified).
   */
  readonly resolveControl: (params: RemoteTeamResolveControlParams) => Promise<RemoteResponse>
  /**
   * A4-PR7 W1 (contract v9, RULING 5-B warning-first): the corrupt-leg
   * visibility read `team.listCorruptControlLegs` (raw RemoteResponse;
   * a pre-v9 host refuses typed `method-version-unsupported`). This is a
   * PURE READ feeding the fixed warning bar ONLY — it changes no
   * execution semantics and never re-derives legality client-side (the
   * server `runtime/control` is the sole strict reader). Absent → the
   * warning bar never renders (the surface is unchanged).
   */
  readonly listCorruptControlLegs?: (
    params: RemoteTeamListCorruptControlLegsParams,
  ) => Promise<RemoteResponse>
}

/**
 * Parse the v3 `team.listRoots` success value (`data.roots`) into the
 * frozen wire rows (defensive client-boundary parse — a malformed row
 * keeps the zero state with the typed-error note lane, never a throw).
 * @param data - the success `value.data` (`{ roots: [...] }`).
 * @returns the wire rows, or `null` when the value is malformed.
 */
export function parseTeamRootsList(data: unknown): readonly TeamRootRowWire[] | null {
  if (typeof data !== 'object' || data === null) return null
  const roots = (data as Record<string, unknown>)['roots']
  if (!Array.isArray(roots)) return null
  const rows: TeamRootRowWire[] = []
  for (const raw of roots) {
    if (typeof raw !== 'object' || raw === null) return null
    const row = raw as Record<string, unknown>
    if (
      typeof row['rootSessionId'] !== 'string' ||
      row['rootSessionId'] === '' ||
      typeof row['blueprintId'] !== 'string' ||
      row['blueprintId'] === '' ||
      typeof row['revision'] !== 'string' ||
      row['revision'] === '' ||
      typeof row['createdAt'] !== 'string' ||
      typeof row['generation'] !== 'number' ||
      typeof row['memberCount'] !== 'number' ||
      (row['defaultWorkspace'] !== undefined && typeof row['defaultWorkspace'] !== 'string')
    ) {
      return null
    }
    rows.push({
      rootSessionId: row['rootSessionId'],
      blueprintId: row['blueprintId'],
      revision: row['revision'],
      defaultWorkspace: row['defaultWorkspace'],
      createdAt: row['createdAt'],
      generation: row['generation'],
      memberCount: row['memberCount'],
    })
  }
  return rows
}

export interface TeamViewInjected {
  /** Bare mirror sources; the renderer binds them to the `use*` selector hooks. */
  hooks: {
    /** The per-session projection mirror (frame pushes + the cold-read landing). */
    projectionMirror: ObservableSnapshot<TeamProjectionMirror>
    /** The per-team durable-ledger store states (keyed by the TeamSession id). */
    teamLedgers: ObservableSnapshot<Readonly<Record<string, TeamLedgerState>>>
    /**
     * (repair 20260927, S1-C1) the per-team FULL projection store states
     * (not just applied frames): the first-read loading, the no-frame
     * transport loss / typed error, and the no-frame foreign/inconsistent
     * verdicts. Keyed by team session id; the view selects the current
     * team through `resolution?.team.teamSessionId ?? sessionId`.
     */
    projectionStates: ObservableSnapshot<Readonly<Record<string, TeamProjectionState>>>
    /**
     * (PR #35 follow-up, frozen §1.2) the per-session `team.getReadState`
     * outcomes — the AUTHORITATIVE ownership surface: the refresh
     * coordinator records every probe here (every round, before the
     * optional pull). The view takes its zero-state conclusion from an
     * `ok`/`none` outcome (a positively confirmed no-team session — the
     * probe that answered it made NO projection request); a FAILED probe
     * (remote-error / malformed / transport-loss) carries no ownership
     * conclusion — the view keeps its frame-based fallback (fail closed).
     */
    sessionReadStates: ObservableSnapshot<Readonly<Record<string, TeamReadStateOutcome>>>
  }
  /** Cold-read the named session's team projection when the mirror lacks it (single-flight). */
  ensureProjection: (sessionId: string) => Promise<void>
  /**
   * D4-A1 (Team D1-D6 repair v2): the post-mutation projection refresh —
   * the existing generation-safe pull. The zero-state creation panel calls
   * it exactly once per terminal create/handoff success, targeting the
   * NEW team's id, so a UI-initiated team creation updates without F5.
   * (repair 20260927, S1-C2) the return type is the frozen assessment —
   * a resolved Promise is NOT a success (`rpc-error` / `transport-loss` /
   * `foreign` / `inconsistent` all settle as resolved assessments; the
   * caller inspects the result, never toasts a success over a failure).
   */
  pullProjection: (teamSessionId: string) => Promise<ProjectionSyncAssessment>
  /**
   * team-view-sync-complete (frozen decisions 2 + 5; PR #35 follow-up):
   * the per-SESSION refresh-coordinator face. The view ATTACHES its
   * session on mount (arming the 3s visible tick — every tick is the
   * read-state ROUND: the lightweight `team.getReadState` probe, and a
   * full `team.getProjection` pull only when the applied identity
   * changed) and DETACHES on unmount (stopping it) — hidden → paused, no
   * round trips. Absent → no polling (the Phase 1 surface: manual
   * refresh + the store reconnect episode only).
   */
  refreshCoordinator?: {
    attach: (sessionId: string) => void
    detach: (sessionId: string) => void
    /**
     * (PR #35 follow-up, P1-4) the manual view refresh — one FORCED
     * coordinator round for the session (probe → conditional pull),
     * always runs (single-flighted behind any in-flight round). Returns
     * the round result (the probe outcome + the optional projection
     * assessment); the view uses the probe's team confirmation to fire
     * the explicit ledger refresh (a manual refresh forces a ledger
     * retry, restoring the Phase 1 behavior — the store's
     * applied-generation-advance trigger stays the ONLY automatic one).
     */
    trigger: (
      sessionId: string,
      reason: TeamRefreshTrigger,
    ) => Promise<TeamRefreshRoundResult>
  }
  /** Re-request the team ledger's catch-up episode after a typed failure. */
  refreshTeamLedger: () => Promise<void>
  /** Switch the current session to the named member session (D9 navigation). */
  openSession: (sessionId: string) => void
  /** S5-A: the New Team creation face (absent → the zero-state entry hides). */
  creation?: TeamViewCreationFace
  /** S5-B: the member command face (absent → the members section stays display-only). */
  memberCommands?: TeamMembersCommandFace
  /** P9-T8 (S5-C): the governance face (absent → the governance section hides). */
  governance?: TeamGovernanceFace
  /**
   * P9-T8 (S5-D): the legacy Team inspection (the parameterless seam — the
   * `dshHome` closure is bound at the T9 mount; raw `RemoteResponse`).
   * Absent → the zero state is exactly the T7 surface.
   */
  legacyInspect?: () => Promise<RemoteResponse>
  /** P9-T8 (S5-D): the handoff face (absent → the panel has no handoff block). */
  handoff?: TeamCreationHandoffFace
  /**
   * D1 (Team D1-D6 repair v2, remote contract v3): the persisted
   * root-identity face (absent → the zero state shows no persisted-roots
   * rows; the T7/T8 zero state is unchanged).
   */
  roots?: TeamViewRootsFace
  /**
   * F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4): the human
   * control-resolution face (absent → the Events section has no
   * Allow/Deny commands; the legacy surface is unchanged).
   */
  control?: TeamViewControlFace
  /**
   * D2 (Team D1-D6 repair v2, D6): the explicit open-in-Team-mode entry
   * (the dedicated "以 Team 模式打开 / 回到 Leader" entry): the AWAITED
   * two-phase sequence — the v3 `team.ensureRootLive` guarantee (over the
   * `roots` face) MUST complete before the native session switch; a typed
   * ensure failure returns `{ ok: false, code, message }` WITHOUT opening
   * the session (never a silent open / adoption). Absent → the D1 surface
   * (no entry on the picker rows, no entry/badge on the leader row).
   */
  openTeamMode?: (rootSessionId: string) => Promise<TeamOpenModeOutcome>
  /**
   * D3 (Team D1-D6 repair v2, D6) — C1 rewire (guide §10.2): the
   * EXPLICIT ordinary-mode fallback entry ("以普通模式打开", v2 plan
   * §1.1.3) on the SAME rows as the Team-mode entry: the AWAITED
   * two-phase sequence in the mount — (a) the v5
   * `team.prepareOrdinaryOpen` one-shot permit (the entry's single Team
   * control-plane RPC — NO Team ensure, NO Team Agent side effect, no
   * revoke RPC), then (b) the pure native session open (0.1.7
   * `uiWorkspace.openSession`; 0.1.5: `ctx.sessions.open`). A typed
   * permit failure REJECTS the promise (the row's async error lane
   * renders it; never a silent open / adoption); a failed native open
   * rejects with the seam's own error. The entry's promise is "no Team
   * ensure is performed / activated as an ordinary Session Agent" — it
   * is NOT a tool-removal operation (a root whose agent is already live
   * with the Team setup is adopted as-is; the mode badge shows which
   * entry was used, so the UI never claims a removal). Absent → the D2
   * surface (no ordinary entry on the picker rows or the leader row).
   */
  openOrdinaryMode?: (rootSessionId: string) => Promise<void>
  /**
   * D2/D3 (D6): the per-root client-local open-mode read — WHICH explicit
   * entry this client used while it still sits on the root: `'team'` for
   * openTeamMode, `'ordinary'` for the explicit ordinary entry (D3) —
   * reset on every session switch away; `null` otherwise. The mode badge
   * source (v2 plan §1.1.5: the UI shows which entry was used).
   * Absent → no badge.
   */
  teamOpenMode?: (rootSessionId: string) => 'team' | 'ordinary' | null
}

/** Full team-view props: the view-slot runtime share, injected face, and locale seat. */
export type TeamViewProps =
  & PropsRuntime<'conversation.view'>
  & InjectFace<TeamViewInjected>
  & PropsLocale<'team'>

/**
 * The team tab body: the one-line zero state for a non-team session (or a
 * team session whose frame has not landed yet) — carrying the S5-A "Start
 * Team from Here" entry and New Team panel when the injected creation face
 * is present; otherwise the UI §12.1
 * four sections from one input — the timeline and the member groups, the
 * activity / progress rows from the snapshot's current-work face, and the
 * durable-ledger Events surface from the per-team ledger store — with the
 * current session's member lane and member group highlighted when the
 * session is a member's.
 * @param props - the framework session kit, the injected mirror hooks and
 *   cold-pull / retry / navigation callbacks, and the team dictionary.
 * @returns the view body.
 */
export function TeamView(props: TeamViewProps): React.JSX.Element {
  const {
    sessionId, useProjectionMirror, useTeamLedgers, useProjectionStates,
    useSessionReadStates,
    ensureProjection, pullProjection, refreshTeamLedger, openSession,
    creation, memberCommands, governance, legacyInspect, handoff, roots,
    control,
    openTeamMode, openOrdinaryMode, teamOpenMode,
    refreshCoordinator,
    useWorkspaces, t,
  } = props
  const [creationOpen, setCreationOpen] = useState(false)
  // UI §5.3: the intent draft is page-run UI state only (never authority) —
  // held here so the panel can open and close in the zero state without
  // losing the in-flight selection.
  const [intentDraft, setIntentDraft] = useState<TeamIntentDraft>(emptyTeamIntentDraft)
  const workspaceViews = useWorkspaces(s => s.items)
  const workspaceOptions = useMemo(() => teamWorkspaceOptions(workspaceViews), [workspaceViews])
  // R119 trial fix: the creation panel's handoff-prepare effect keys off the
  // `handoffSource` prop identity. An inline object literal here re-fired
  // `handoff.prepare` on EVERY TeamView re-render — including every
  // initial-work keystroke (draft update -> re-render) — clearing and
  // re-fetching the one-shot summary, which is what the trial surfaced as
  // the creation panel flickering/jumping while typing (plus a prepare-RPC
  // per keystroke). The memo keeps the identity stable across re-renders;
  // it still changes on the real inputs (session switch / workspace feed).
  const handoffSource = useMemo(
    () => ({
      sourceSessionId: sessionId,
      sourceWorkspaceId: workspaceViews?.find(
        item => item.sessionIds.includes(sessionId),
      )?.workspaceId ?? null,
    }),
    [sessionId, workspaceViews],
  )
  const resolution = useProjectionMirror(
    mirror => resolveTeamProjection(mirror, sessionId),
    sameTeamProjectionResolution,
  )
  // (repair 20260927, S1-C1) the current team's FULL projection store
  // state (not just the applied frame): selected through
  // `resolution?.team.teamSessionId ?? sessionId` (the guide's fixed key —
  // the team id the cold pull targets IS the candidate root id for an
  // unresolved session). `null` before the team's first store publish —
  // the view treats that as the first-read loading state (NEVER a
  // definitive "no team": the cold open is still in flight).
  const projectionStates = useProjectionStates(s => s)
  // (PR #35 follow-up, frozen §1.2) the current session's READ-STATE
  // outcome — the authoritative ownership surface (the refresh
  // coordinator records every probe here). `null` before the first
  // settled probe: NO ownership conclusion yet (the frame-based
  // resolution below stays the fallback — a cold open is still in
  // flight, and a failed probe NEVER degrades to a `none` conclusion).
  const readStates = useSessionReadStates(s => s)
  const readState = readStates[sessionId] ?? null
  const ownership = readState !== null && readState.status === 'ok' ? readState.relation : null
  // The AUTHORITATIVE no-team verdict: a positively confirmed `none`
  // probe (the round that answered it made NO projection request).
  const authoritativeNone = ownership !== null && ownership.kind === 'none'
  const projectionState = useMemo(
    () => {
      // (PR #35 follow-up) the store key: an ok team relation names the
      // OWNING ROOT directly (a cold member's root resolves through the
      // probe — no frame required); an `ok`/`none` has no store at all;
      // no settled probe falls back to the frame-based candidate
      // (resolution's team id, else the session id — the guide's fixed
      // key while the cold read is in flight).
      const key = ownership === null
        ? resolution?.team.teamSessionId ?? sessionId
        : ownership.kind === 'none'
          ? null
          : ownership.teamSessionId
      if (key === null) return null
      return projectionStates[key] ?? null
    },
    [projectionStates, resolution, sessionId, ownership],
  )
  // (repair 20260927, S1-C2) the manual "refresh team view" state —
  // `refreshPending` doubles as the double-click guard; `refreshEpoch`
  // discards late responses after a newer refresh — and (PR #34 review
  // follow-up, F2) the lifetime effect below advances it on session
  // switch / unmount, so an in-flight refresh of a LEFT scope is dead
  // on settlement before its ledger continuation and pending-flag
  // settle run. The round-trip OUTCOME itself has no local copy: the
  // projection store's published state (the same visible state surface
  // the member/governance reads flow through) carries it — a resolved
  // Promise is NOT a success, and the state's status/assessment is the
  // verdict (no success toast over a failed pull).
  const [refreshPending, setRefreshPending] = useState(false)
  const refreshEpoch = useRef(0)
  // (PR #34 review follow-up, F2) the manual refresh lifetime is bound
  // to the session scope: entering a new session — and the unmount /
  // sessionId-change cleanup — advances `refreshEpoch`, invalidating
  // every refresh started in the previous scope (its continuation then
  // sees a mismatched epoch and returns before the ledger refresh and
  // before the pending flag settles). The effect body clears the
  // pending flag (the new scope starts fresh); the cleanup only
  // advances the REF — no setState in cleanup. StrictMode's simulated
  // unmount/remount only adds extra monotonic bumps (the epoch only
  // requires monotonicity). `loadRoots` is deliberately NOT bound
  // here: it is the global persisted-roots read with its own
  // `rootsEpoch` / unmount guard.
  useEffect(() => {
    refreshEpoch.current += 1
    setRefreshPending(false)
    return () => {
      refreshEpoch.current += 1
    }
  }, [sessionId])
  // (repair 20260927, S1-C1) the WITH-frame status derivations — computed
  // UNCONDITIONALLY (hooks order) though only the with-frame render uses
  // them: the content is ALWAYS kept; a refresh in flight (the manual
  // pull or the store's reconnect episode) shows a light pending mark,
  // and a FAILED latest round trip shows "更新失败，当前显示上次成功的数
  // 据" with the code/message — judged by the store's CURRENT
  // status/assessment (never by the presence of a `lastError` property
  // alone), and a successful recovery (including a same-generation
  // duplicate) clears it (the store drops the stale lastError on
  // recovery).
  const withFrameStatus = projectionState?.status ?? 'ready'
  const withFrameRefreshing = refreshPending
    || withFrameStatus === 'reconnecting'
    || withFrameStatus === 'loading'
  const withFrameError = useMemo(() => {
    if (projectionState === null || projectionState.status !== 'error') return null
    const err = projectionState.lastError
    if (err !== undefined) return { code: err.code, message: err.message }
    const a = projectionState.lastAssessment
    if (a === null) return { code: 'unknown', message: '' }
    if (a.status === 'transport-loss') return { code: 'transport-loss', message: '' }
    return { code: a.status, message: `generation ${a.receivedGeneration}` }
  }, [projectionState])
  // team-view-sync-complete (frozen decisions 2 + 5; PR #35 follow-up,
  // P0-1): the per-SESSION refresh-coordinator ATTACH — the round is
  // the read-state probe for the SESSION (P0-1: the probe input is the
  // current sessionId, never a root id guess), so the tick scope IS the
  // session id: stable for the whole view lifetime, no re-attach across
  // the cold read. Mounting the view arms the 3s visible tick (every
  // tick = the frozen §1.2 round); unmounting (session switch / tab
  // away) stops it. attach is idempotent either way.
  // (PR #35 third follow-up P1, guide §12) this effect now runs
  // BEFORE the cold ensureProjection effect: the view attaches FIRST,
  // so the cold open's trigger runs in the ATTACHED entry's lane (no
  // transient path on the UI route). The coordinator stays safe for
  // the reversed order too (trigger → attach reuses the transient
  // entry) — the reorder only shrinks the transient path.
  useEffect(() => {
    const face = refreshCoordinator
    if (face === undefined) return
    face.attach(sessionId)
    return () => face.detach(sessionId)
  }, [sessionId, refreshCoordinator])
  useEffect(() => {
    // The tab mounts per session and one-at-a-time, so "mounted" IS "the
    // team UI needs the view": fill a mirror gap once, then let frames win.
    if (resolution === undefined) void ensureProjection(sessionId)
  }, [sessionId, resolution, ensureProjection])
  const snapshot = useMemo(
    () => (resolution === undefined
      ? null
      : adaptTeamProjection(resolution.team, resolution.perspective)),
    [resolution],
  )
  // (PR #35 second follow-up P1-A) the AUTHORITATIVE view mode — the
  // settled read-state outcome is the single driver of which face
  // renders (guide §4.2 state machine):
  //   · `ok/none` → the DEFINITIVE ordinary zero state. The authority
  //     WINS over any stale mirror frame (a none probe never degrades
  //     into a team body; the stale mirror is ignored).
  //   · `ok/team-root|team-member` → the team face: the last applied
  //     frame, or the team-loading line while the first frame is in
  //     flight (the probe already confirmed the ownership).
  //   · `remote-error / malformed / transport-loss` (no frame) → the
  //     ownership-error line for the exact failure kind (NEVER a
  //     permanent "loading": a failed probe carries no ownership
  //     conclusion, but it is a CONCLUDED failure — the UI says so);
  //     (with a frame) → the LAST GOOD team face + the stale banner
  //     (the failed refresh neither drops the frame nor degrades the
  //     session to `none`).
  //   · `null` (no settled probe yet) → the projection-store-driven
  //     face: while the store has no concrete state the ownership read
  //     is announced as in flight; a concrete store state (error /
  //     reconnecting / foreign — the S1-C1 cold-open surface) keeps its
  //     own line (it is strictly more specific than "reading…").
  const viewMode = useMemo(
    ():
      | { readonly kind: 'ordinary' }
      | { readonly kind: 'ownership-error'; readonly detail: Exclude<TeamReadStateOutcome, { readonly status: 'ok' }> }
      | { readonly kind: 'team-loading' }
      | { readonly kind: 'store-driven' }
      | { readonly kind: 'team-ready'; readonly stale: boolean } => {
      if (authoritativeNone) return { kind: 'ordinary' }
      if (readState !== null && readState.status !== 'ok') {
        const detail = readState
        if (snapshot === null) return { kind: 'ownership-error', detail }
        return { kind: 'team-ready', stale: true }
      }
      if (snapshot === null) {
        if (readState === null) return { kind: 'store-driven' }
        // ok + a team relation (the none case is handled above): the
        // ownership is confirmed, the first frame is still in flight.
        return { kind: 'team-loading' }
      }
      return { kind: 'team-ready', stale: false }
    },
    [authoritativeNone, readState, snapshot],
  )
  // P9-T8 (S5-D): the one-shot legacy inspection for the ZERO state (plan
  // §10.6, UI §34). It is a read, not a command flow — no projection pull;
  // it only decides WHICH zero state renders. Gated to the zero state and
  // skipped while the creation panel is open (the result is irrelevant
  // there). A typed failure keeps the ordinary zero state + ONE verbatim
  // note; `legacy-team` REPLACES the zero state with the read-only banner.
  const [legacy, setLegacy] = useState<
    | { readonly status: 'pending' }
    | { readonly status: 'ok'; readonly inspection: LegacyInspectionWire }
    | { readonly status: 'error'; readonly code: string; readonly message: string }
    | null
  >(null)
  // (PR #35 follow-up, frozen §1.2) the zero-state test: the
  // AUTHORITATIVE `none` probe wins (a positively confirmed no-team
  // session — the round that answered it made no projection request, so
  // there is no frame to wait for); otherwise the frame-based test
  // stands (a failed probe keeps the last-known surface — fail closed,
  // and a cold open with no settled probe yet reads as "still loading",
  // never as a definitive no-team).
  // (PR #35 second follow-up P1-A) the zero-state gate is the view mode,
  // NOT the raw frame absence: the team face renders exactly when the
  // mode is `team-ready` (a last applied frame — with or without a
  // stale-refresh banner); every other mode renders the zero face, and
  // the zero face's CONCLUSION comes from the mode (the authoritative
  // none / the ownership lines / the store-driven cold-open lines).
  const inZeroState = viewMode.kind !== 'team-ready'
  useEffect(() => {
    if (!inZeroState || legacyInspect === undefined || creationOpen) return
    let live = true
    setLegacy({ status: 'pending' })
    void legacyInspect().then(response => {
      if (!live) return
      if (!response.ok) {
        setLegacy({ status: 'error', code: response.error.code, message: response.error.message })
        return
      }
      setLegacy({ status: 'ok', inspection: parseLegacyInspection(response.value.data) })
    }).catch(error => {
      if (!live) return
      setLegacy({
        status: 'error',
        code: 'native-error',
        message: error instanceof Error ? error.message : String(error),
      })
    })
    return () => { live = false }
  }, [inZeroState, legacyInspect, creationOpen, sessionId])
  // D1 (Team D1-D6 repair v2, remote contract v3): the persisted roots
  // read for the ZERO state — the same read-not-command discipline as the
  // legacy inspection above (the auto-read is gated to the zero state and
  // skipped while the creation panel is open; one verbatim note on a
  // typed failure). The rows render WITHOUT open actions in D1 (D2/D3 add
  // the open action over this same face); the list is read-only here.
  // (repair 20260927, S1-C2) the request logic is EXTRACTED into the
  // awaitable `loadRoots` helper: the manual view refresh calls it
  // directly (NOT subject to the auto-read's `creationOpen` guard), and
  // the state KEEPS the last successful rows while a re-read is pending
  // or failed (the old list is never cleared just to show an error).
  // `rootsEpoch` discards late responses after a newer read; the
  // unmount flag (set by the cleanup effect below) discards the rest.
  const [teamRoots, setTeamRoots] = useState<{
    readonly rows: readonly TeamRootRowWire[] | null
    readonly pending: boolean
    readonly error: { readonly code: string; readonly message: string } | null
  }>({ rows: null, pending: false, error: null })
  const rootsEpoch = useRef(0)
  // The unmount flag is a REF (not state): the mount effect resets it on
  // (re)mount — a React 18 StrictMode simulated unmount/re-mount keeps
  // component state, so a state flag would stay `true` across the
  // simulated remount and discard every later response.
  const rootsUnmounted = useRef(false)
  useEffect(() => {
    rootsUnmounted.current = false
    return () => { rootsUnmounted.current = true }
  }, [])
  const loadRoots = useCallback((): Promise<void> => {
    const face = roots
    if (face === undefined) return Promise.resolve()
    rootsEpoch.current += 1
    const epoch = rootsEpoch.current
    setTeamRoots(prev => ({ ...prev, pending: true, error: null }))
    return face.listRoots().then(response => {
      if (rootsUnmounted.current || rootsEpoch.current !== epoch) return
      if (!response.ok) {
        setTeamRoots(prev => ({
          ...prev,
          pending: false,
          error: { code: response.error.code, message: response.error.message },
        }))
        return
      }
      const rows = parseTeamRootsList(response.value.data)
      if (rows === null) {
        setTeamRoots(prev => ({
          ...prev,
          pending: false,
          error: {
            code: 'malformed-response',
            message: 'the team.listRoots response did not carry the closed roots list',
          },
        }))
        return
      }
      setTeamRoots({ rows, pending: false, error: null })
    }).catch(error => {
      if (rootsUnmounted.current || rootsEpoch.current !== epoch) return
      setTeamRoots(prev => ({
        ...prev,
        pending: false,
        error: {
          code: 'native-error',
          message: error instanceof Error ? error.message : String(error),
        },
      }))
    })
  }, [roots])
  useEffect(() => {
    if (!inZeroState || roots === undefined || creationOpen) return
    void loadRoots()
  }, [inZeroState, roots, creationOpen, sessionId, loadRoots])
  // team-view-sync-complete (frozen decision 6): the ZERO-STATE roots
  // cadence — while the zero state is VISIBLE, re-read `team.listRoots`
  // at the same 3s tick (the initial read above covers t=0). The
  // periodic read STOPS once a resolved Team frame exists (`inZeroState`
  // flips false — no roots polling behind a resolved view), and the
  // manual view refresh re-reads roots unconditionally (runRefresh's
  // independent `loadRoots`). The tick no-ops while the host tab is
  // hidden (the "visible" gate; headless/node tests have no document and
  // read as visible).
  useEffect(() => {
    if (!inZeroState || roots === undefined || creationOpen) return
    const id = setInterval(() => {
      const doc = typeof document === 'undefined' ? null : document
      if (doc !== null && doc.visibilityState !== 'visible') return
      void loadRoots()
    }, 3000)
    return () => clearInterval(id)
  }, [inZeroState, roots, creationOpen, sessionId, loadRoots])
  // A4-PR7 W1 (remote contract v9, RULING 5-B warning-first) — the
  // corrupt-leg visibility read for the FIXED warning bar: one read per
  // resolved team session, re-read on every manual refresh. The bar is
  // LEDGER-DERIVED (the read rides the durable control ledger, not the
  // live member set), so a Member destroy/rebuild cannot clear it — the
  // fact is the Team's, never a member's, and the wording stays
  // Team-level. Failure posture is CONSERVATIVE-HIDE: a typed refusal
  // (a pre-v9 host answers `method-version-unsupported`), a malformed
  // payload, or a transport loss all keep the bar hidden — the warning
  // NEVER blocks or alters the ledger surface below it, and the client
  // never re-derives which records are corrupt (the server
  // `runtime/control` is the sole strict reader; 严禁客户端复刻严格读者).
  //
  // A4-PR7 W4 (external review of the merged W1) repairs two P2 UI defects
  // in THIS block and its render, and changes no execution semantics:
  //   F1 — a read that did not SUCCEED is now visible: W1 stored
  //        `error` and rendered nothing, so "this Team has no corrupt
  //        records" was indistinguishable from "the integrity check never
  //        ran successfully". The same position now carries one NEUTRAL,
  //        non-dismissible, non-modal notice (see `planControlCorruptionRender`).
  //   F2 — the state is bound to the `teamSessionId` it was read for, so a
  //        disclosure can never be displayed for a different Team.
  // KNOWN LIMITATION (recorded, deliberately NOT "fixed" here): this read
  // fires on entry to the Team page, on a manual refresh, and on a Team-key
  // change — it is NOT a continuous watch, so a corrupt record that appears
  // mid-session only becomes visible at the next read. No polling is added.
  const [corruption, setCorruption] = useState<ControlCorruptionReadState>(EMPTY_CONTROL_CORRUPTION_READ_STATE)
  const corruptionEpoch = useRef(0)
  const corruptionUnmounted = useRef(false)
  useEffect(() => {
    corruptionUnmounted.current = false
    return () => { corruptionUnmounted.current = true }
  }, [])
  const corruptionTeamKey = inZeroState ? null : snapshot?.teamSessionId ?? null
  const loadControlCorruption = useCallback((): Promise<void> => {
    const face = control?.listCorruptControlLegs
    const key = corruptionTeamKey
    if (face === undefined || key === null) return Promise.resolve()
    corruptionEpoch.current += 1
    const epoch = corruptionEpoch.current
    return face(corruptControlLegsParams(key)).then(response => {
      if (corruptionUnmounted.current || corruptionEpoch.current !== epoch) return
      if (!response.ok) {
        // W4 F1: the failed check becomes VISIBLE as the neutral notice (never
        // a modal, never a blocker, never a claim that anything was refused);
        // a same-key failure still KEEPS the last good view (W1 semantics).
        setCorruption(prev => corruptionReadFailed(prev, key, {
          code: response.error.code,
          message: response.error.message,
        }))
        return
      }
      const view = parseControlCorruption(response.value.data)
      if (view === null) {
        setCorruption(prev => corruptionReadFailed(prev, key, {
          code: 'malformed-response',
          message: 'the team.listCorruptControlLegs response did not carry the closed corruption wire',
        }))
        return
      }
      setCorruption(prev => corruptionReadSucceeded(prev, key, view))
    }).catch(error => {
      if (corruptionUnmounted.current || corruptionEpoch.current !== epoch) return
      setCorruption(prev => corruptionReadFailed(prev, key, {
        code: 'native-error',
        message: error instanceof Error ? error.message : String(error),
      }))
    })
  }, [control, corruptionTeamKey])
  useEffect(() => {
    const key = corruptionTeamKey
    if (key === null || control?.listCorruptControlLegs === undefined) {
      // No face / no resolved team: no read, no bar, no notice (the legacy surface).
      setCorruption(prev => corruptionStateCleared(prev))
      return
    }
    // W4 F2: the moment the Team key moves, the previous round's result is
    // dropped — a disclosure is a fact about ONE Team and must not sit on
    // another one's page while its own read is in flight. The epoch guard in
    // `loadControlCorruption` still orders interleaved reads; this is the
    // ownership gate on top of it.
    setCorruption(prev => corruptionStateForKey(prev, key))
    void loadControlCorruption()
  }, [corruptionTeamKey, control, loadControlCorruption])
  // The single render decision for the Team CURRENTLY on screen (W4 F2): a
  // state row owned by another key contributes nothing, and the disclosure
  // bar and the neutral notice are mutually exclusive (F1).
  const { bar: corruptionBar, unavailableNotice: corruptionNotice } = planControlCorruptionRender(
    corruption,
    corruptionTeamKey,
  )
  // (repair 20260927, S1-C2; PR #35 follow-up, P1-4) the manual "refresh
  // team view" — the one awaitable read-only re-read. Captures THIS
  // invocation's session id and a request epoch at call time:
  //   (a) the roots re-read starts independently (the manual call is NOT
  //       subject to the auto-read's zero-state / `creationOpen` guard —
  //       frozen decision 6: the manual refresh ALWAYS re-reads roots);
  //   (b) the round is a FORCED trigger for the SESSION through the
  //       refresh coordinator (the read-state-driven §1.2 round:
  //       single-flighted per session, coalesced behind an in-flight
  //       round, never re-fired on a failed read).
  // (PR #35 follow-up, P1-4) the manual refresh FORCES ONE EXPLICIT
  // ledger refresh attempt when the round CONFIRMS a team (the probe
  // answered a team relation): restoring the Phase 1 "explicit refresh
  // re-reads the durable ledger" behavior — a failed earlier ledger read
  // gets a retry on the user's explicit action even when the generation
  // did not advance. The AUTOMATIC ledger refresh stays owned by the
  // applied-durable-generation advance (frozen decision 4 — a
  // live-token-only overlay apply still does NOT refresh the ledger);
  // this explicit attempt is the user-driven exception the follow-up
  // guide reinstates (documented in the PR). A resolved Promise is NOT a
  // success: the round-trip outcome is read back through the projection
  // store's published state (the same visible state surface the
  // member/governance background reads flow through) — `rpc-error` /
  // `transport-loss` / `foreign` / `inconsistent` all settle as resolved
  // assessments. Nothing here re-fires a mutation on a failed read.
  const runRefresh = useCallback((): void => {
    if (refreshPending) return // the double-click guard
    const sessionIdAtStart = sessionId
    const resolutionAtStart = resolution
    const faceAtStart = refreshCoordinator
    refreshEpoch.current += 1
    const epoch = refreshEpoch.current
    setRefreshPending(true)
    void loadRoots()
    // A4-PR7 W1: the manual refresh re-reads the corrupt-leg visibility
    // alongside the roots (the same read-not-command discipline).
    void loadControlCorruption()
    void (async () => {
      // P1-4: does the refresh CONFIRM a team? (the explicit ledger
      // retry below runs only then.)
      let teamConfirmed: boolean
      if (faceAtStart === undefined) {
        // Phase 1 fallback (no coordinator face — the degraded
        // injection): the direct generation-safe pull for the resolved
        // team id (the old manual-refresh path); the team is confirmed
        // from the frame (the mirror resolution at call time).
        try {
          await pullProjection(resolutionAtStart?.team.teamSessionId ?? sessionIdAtStart)
        } catch {
          // The frozen client carrier never rejects (it resolves as a
          // typed assessment); defensive only.
        }
        teamConfirmed = resolutionAtStart !== undefined
      } else {
        // The read-state-driven forced round (probe → conditional
        // pull): the team is confirmed when the probe answered a team
        // relation (an authoritative `none` / a failed probe never
        // re-reads the ledger — there is no ledger, or no ownership
        // conclusion).
        let round: TeamRefreshRoundResult | null = null
        try {
          round = await faceAtStart.trigger(sessionIdAtStart, 'manual')
        } catch {
          // The round never rejects (every outcome is resolved);
          // defensive only.
        }
        teamConfirmed =
          round !== null &&
          round.readState.status === 'ok' &&
          round.readState.relation.kind !== 'none'
      }
      if (refreshEpoch.current !== epoch) return // newer refresh / unmount
      // P1-4: the explicit ledger retry — the user's "refresh" re-reads
      // the durable ledger even when the generation did not advance (a
      // failed earlier ledger read gets its retry here); the AUTOMATIC
      // refresh stays owned by the applied durable-generation advance.
      if (teamConfirmed) {
        try {
          await refreshTeamLedger()
        } catch {
          // The ledger store's refresh resolves with the typed failure
          // in state.error; defensive only.
        }
      }
    })().finally(() => {
      if (refreshEpoch.current === epoch) setRefreshPending(false)
    })
  }, [refreshPending, sessionId, resolution, refreshCoordinator, loadRoots, loadControlCorruption, pullProjection, refreshTeamLedger])
  // D2 (Team D1-D6 repair v2, D6): the in-flight explicit open per picker
  // row (root id → pending) and the last typed failure per row (ONE
  // verbatim note, the UI §38 greyed-surface discipline). Page-run UI
  // state only — the open-mode FACT stays in the mount (client-local).
  const [rootOpenTeamPending, setRootOpenTeamPending] = useState<Readonly<Record<string, boolean>>>({})
  const [rootOpenTeamErrors, setRootOpenTeamErrors] = useState<
    Readonly<Record<string, { readonly code: string; readonly message: string }>>
  >({})
  /** Run the row's explicit open-in-Team-mode entry through the face (the two-phase
   *  sequence lives in the mount; the row only triggers it and renders the
   *  settled typed failure when it comes back). */
  const runPickerOpenTeamMode = (rootSessionId: string): void => {
    const face = openTeamMode
    if (face === undefined) return
    setRootOpenTeamPending(prev => ({ ...prev, [rootSessionId]: true }))
    setRootOpenTeamErrors(prev => {
      const next = { ...prev }
      delete next[rootSessionId]
      return next
    })
    void face(rootSessionId).then(outcome => {
      if (!outcome.ok) {
        setRootOpenTeamErrors(prev => ({
          ...prev,
          [rootSessionId]: { code: outcome.code, message: outcome.message },
        }))
      }
    }).finally(() => {
      setRootOpenTeamPending(prev => {
        if (prev[rootSessionId] !== true) return prev
        const next = { ...prev }
        delete next[rootSessionId]
        return next
      })
    })
  }
  // D3 (D6) — C1 rewire (guide §10.2): the SAME async error lane for the
  // explicit ordinary-mode entry (the AWAITED two-phase sequence — v5
  // prepare permit, then the native open — lives in the mount; the row
  // only triggers it and renders the settled rejection). Rejections
  // arrive as the mount's typed `${code}: ${message}` Error (the code is
  // a closed SCREAMING_SNAKE constant with no colon, so the first
  // `': '` split is unambiguous) or the seam's own native-open error.
  // The error note is NEVER swallowed: every rejection renders the
  // verbatim typed note.
  const [rootOpenOrdinaryPending, setRootOpenOrdinaryPending] = useState<Readonly<Record<string, boolean>>>({})
  const [rootOpenOrdinaryErrors, setRootOpenOrdinaryErrors] = useState<
    Readonly<Record<string, { readonly code: string; readonly message: string }>>
  >({})
  /** Run the row's explicit ordinary-mode entry through the face (the
   *  two-phase sequence lives in the mount; the row only triggers it and
   *  renders the settled rejection when it comes back). */
  const runPickerOpenOrdinaryMode = (rootSessionId: string): void => {
    const face = openOrdinaryMode
    if (face === undefined) return
    setRootOpenOrdinaryPending(prev => ({ ...prev, [rootSessionId]: true }))
    setRootOpenOrdinaryErrors(prev => {
      const next = { ...prev }
      delete next[rootSessionId]
      return next
    })
    void face(rootSessionId).catch((error: unknown) => {
      const rawMessage = error instanceof Error ? error.message : String(error)
      const separatorIndex = rawMessage.indexOf(': ')
      const code = separatorIndex > 0 ? rawMessage.slice(0, separatorIndex) : 'ORDINARY_OPEN_FAILED'
      const message = separatorIndex > 0 ? rawMessage.slice(separatorIndex + 2) : rawMessage
      setRootOpenOrdinaryErrors(prev => ({
        ...prev,
        [rootSessionId]: { code, message },
      }))
    }).finally(() => {
      setRootOpenOrdinaryPending(prev => {
        if (prev[rootSessionId] !== true) return prev
        const next = { ...prev }
        delete next[rootSessionId]
        return next
      })
    })
  }
  const ledgerState = useTeamLedgers(map => map[snapshot?.teamSessionId ?? ''])
  const ledger = useMemo(() => ledgerModelFromStoreState(ledgerState), [ledgerState])
  // F9 (remote contract v4) — the human control-resolution command face
  // wiring: the v4 wrapper (the host derives the human principal — the
  // wire carries no caller fields) plus the D4-A1 post-success
  // projection pull (the decision settles the projection's
  // pending-control facts without F5; the LEDGER catch-up re-pull is the
  // TeamLedger side — it re-requests after every completed command,
  // success and typed failure alike). Absent face → the surface renders
  // no commands (the legacy surface is unchanged).
  const onResolveControl = useMemo(() => {
    if (control === undefined) return undefined
    return (teamSessionId: string, requestId: string, decision: 'allow' | 'deny'): Promise<RemoteResponse> =>
      control.resolveControl({ teamSessionId, requestId, decision }).then(response => {
        if (response.ok === true) {
          void pullProjection(teamSessionId)
        }
        return response
      })
  }, [control, pullProjection])
  // F9U (gate-review supplement 4) — the served-version-gated command
  // surface: ONE side-effect-free v4 probe per team session decides
  // whether the SERVED host serves the v4-only `team.resolveControl`.
  // The probe's closed `requestId` (the empty string) fails the closed
  // 1..255 opaque-token rule, so a v4 host answers with a TYPED
  // `malformed-params` BEFORE any port work — the probe never reaches
  // the control service, never resolves a request, and never writes.
  // A pre-v4 build's closed catalog lacks the v4-only method, so it
  // answers `unknown-method` before the envelope is even parsed. The
  // typed outcomes map (the control-surface model): v4 served →
  // 'enabled' (the Allow/Deny commands go live); a pre-v4 build →
  // 'read-only' (the UI §26 pending state stays visible, the commands
  // do not). A transport rejection leaves the mode unresolved
  // (fail-closed: no command affordance) and the probe re-runs on the
  // next ledger publish (the effect deps carry the store state
  // identity); a team switch re-probes for the new team.
  const [controlSurfaceProbe, setControlSurfaceProbe] = useState<
    | { readonly status: 'unresolved' }
    | { readonly status: 'resolved'; readonly teamSessionId: string; readonly mode: 'read-only' | 'enabled' }
  >({ status: 'unresolved' })
  const controlProbeInFlight = useRef(false)
  const ledgerHasPendingControl = useMemo(
    () => ledger.controls.some(chain => chain.pending && chain.requestId !== ''),
    [ledger.controls],
  )
  useEffect(() => {
    if (control === undefined || snapshot === null) return
    if (ledgerHasPendingControl === false) return
    if (
      controlSurfaceProbe.status === 'resolved'
      && controlSurfaceProbe.teamSessionId === snapshot.teamSessionId
    ) {
      return
    }
    if (controlProbeInFlight.current) return
    controlProbeInFlight.current = true
    let live = true
    const teamSessionId = snapshot.teamSessionId
    void control.resolveControl({
      teamSessionId,
      requestId: RESOLVE_CONTROL_PROBE_REQUEST_ID,
      decision: 'allow',
    }).then(response => {
      if (!live) return
      setControlSurfaceProbe({
        status: 'resolved',
        teamSessionId,
        mode: interpretResolveControlProbe(response),
      })
    }).catch(() => {
      // Transport-level channel loss (the ONLY rejection kind): the
      // mode stays unresolved (fail-closed) — the next ledger publish
      // re-runs the probe.
    }).finally(() => {
      controlProbeInFlight.current = false
    })
    return () => {
      live = false
      controlProbeInFlight.current = false
    }
  }, [control, snapshot, ledgerHasPendingControl, ledgerState, controlSurfaceProbe])
  // The display input for the Events section (absent = unresolved —
  // fail-closed: the detail panel renders, the commands wait for the
  // v4 proof).
  const controlSurfaceMode =
    controlSurfaceProbe.status === 'resolved' && controlSurfaceProbe.teamSessionId === snapshot?.teamSessionId
      ? controlSurfaceProbe.mode
      : undefined
  // D1 (Team D1-D6 repair v2, remote contract v3): the persisted-roots
  // zero-state share — the typed-failure note (ONE verbatim line, UI §38
  // greyed-surface discipline) + the read-only rows (blueprint@revision,
  // default workspace, member count, creation time, root id). D2 (D6)
  // adds the dedicated open-in-Team-mode entry over the SAME face: each
  // row gains the explicit "以 Team 模式打开 / 回到 Leader" button
  // (absent without the `openTeamMode` face — the D1 surface unchanged),
  // with a per-row pending mark + ONE verbatim typed error note. An empty
  // list renders nothing (the host has no persisted teams yet).
  // (repair 20260927, S1-C2) the note renders the CURRENT read error
  // while the last successful rows stay in `rootsList` (the old list is
  // never cleared to show an error — the state carries both).
  const rootsNote =
    teamRoots.error !== null
      ? t('view.roots.note', { message: `${teamRoots.error.code}: ${teamRoots.error.message}` })
      : null
  const rootsList =
    teamRoots.rows !== null && teamRoots.rows.length > 0
      ? (
        <div className={styles.roots} data-team-roots>
          <h3 className={styles.rootsTitle}>{t('view.roots.title')}</h3>
          <ul className={styles.rootsList} data-team-roots-list>
            {teamRoots.rows.map(row => {
              const rowError = rootOpenTeamErrors[row.rootSessionId]
              const rowOrdinaryError = rootOpenOrdinaryErrors[row.rootSessionId]
              return (
                <li
                  key={row.rootSessionId}
                  className={styles.rootRow}
                  data-team-root-row
                  data-root-session-id={row.rootSessionId}
                >
                  <span className={styles.rootId} data-root-id>{row.rootSessionId}</span>
                  <span data-root-blueprint>{`${row.blueprintId}@${row.revision}`}</span>
                  <span data-root-workspace>
                    {row.defaultWorkspace ?? t('view.roots.noWorkspace')}
                  </span>
                  <span data-root-members>
                    {t('view.roots.members', { count: String(row.memberCount) })}
                  </span>
                  <span data-root-created title={row.createdAt}>{row.createdAt}</span>
                  {/* D2 (D6): the dedicated open-in-Team-mode entry — the
                      face-only trigger (the AWAITED two-phase sequence lives
                      in the mount); ABSENT without the face (the D1 surface
                      is unchanged). */}
                  {openTeamMode !== undefined
                    ? (
                      <button
                        type="button"
                        className={styles.rootRowOpen}
                        data-team-mode-open-root={row.rootSessionId}
                        disabled={rootOpenTeamPending[row.rootSessionId] === true || undefined}
                        onClick={() => { runPickerOpenTeamMode(row.rootSessionId) }}
                      >
                        {t('view.members.openTeamMode')}
                      </button>
                    )
                    : null}
                   {/* D3 (D6): the explicit ordinary-mode fallback entry — the
                     SAME rows as the Team-mode entry (v2 plan §1.1.3): the face-only
                     trigger (the pure native open lives in the mount; no team-remote
                     call, no ensure-live step). ABSENT without the face (the D2 surface
                     is unchanged). The title carries the semantic promise: no Team ensure
                     is performed / team_* tools are NOT guaranteed (never a tool-removal
                     claim). */}
                   {openOrdinaryMode !== undefined
                     ? (
                       <button
                         type="button"
                         className={styles.rootRowOpen}
                         data-team-ordinary-open-root={row.rootSessionId}
                         disabled={rootOpenOrdinaryPending[row.rootSessionId] === true || undefined}
                         title={t('view.members.openOrdinaryMode.hint')}
                         onClick={() => { runPickerOpenOrdinaryMode(row.rootSessionId) }}
                       >
                         {t('view.members.openOrdinaryMode')}
                       </button>
                     )
                     : null}
                   {/* D3 (D6) — C1 rewire (guide §10.2): the settled
                     rejection of the ordinary entry (typed code +
                     message, the async error lane — never a silent
                     failure, never swallowed). */}
                   {rowOrdinaryError !== undefined
                    ? (
                      <div className={styles.legacyNote} data-team-ordinary-open-error>
                        {t('view.members.openOrdinaryMode.error', {
                          code: rowOrdinaryError.code,
                          message: rowOrdinaryError.message,
                        })}
                      </div>
                    )
                    : null}
                   {rowError !== undefined
                    ? (
                      <div className={styles.legacyNote} data-team-mode-open-error>
                        {t('view.members.openMode.error', {
                          code: rowError.code,
                          message: rowError.message,
                        })}
                      </div>
                    )
                    : null}
                </li>
              )
            })}
          </ul>
        </div>
      )
      : null
  if (viewMode.kind !== 'team-ready') {
    // (PR #35 second follow-up P1-A) the zero-face status line is the
    // VIEW MODE (the settled read-state outcome is the authority; guide
    // §4.2):
    //   · ordinary (ok/none) → the DEFINITIVE no-team line (the
    //     authority wins over any stale mirror — this is the ONLY mode
    //     that may say "未加入团队");
    //   · ownership-error → the exact failed-probe line
    //     (remote-error: code + message; malformed: the reason;
    //     transport-loss: the reconnect line) — NEVER a permanent
    //     loading;
    //   · team-loading (ok/team, frame in flight) → the team-loading
    //     line (the ownership is already confirmed);
    //   · store-driven (no settled probe yet) → the S1-C1
    //     projection-store lines: while the store has no concrete state
    //     the ownership read is announced as in flight; a concrete
    //     store state (reconnecting / error / foreign — the
    //     cold-open surface) keeps its own line:
    //       · no state yet / idle / loading / ready → 读取归属中;
    //       · reconnecting (no frame) → 尚未成功加载 (transport loss,
    //         the store's retry episode is running);
    //       · error → 团队信息加载失败 + code/message (typed RPC
    //         error, transport loss, foreign/inconsistent — the
    //         FOREIGN_TEAM case keeps the NEUTRAL wording).
    let zeroStatusLine: string
    let zeroStatus: string
    if (viewMode.kind === 'ordinary') {
      zeroStatusLine = t('view.ownership.none')
      zeroStatus = 'none'
    } else if (viewMode.kind === 'ownership-error') {
      zeroStatus = 'ownership-error'
      if (viewMode.detail.status === 'remote-error') {
        zeroStatusLine = t('view.ownership.error', {
          code: viewMode.detail.code,
          message: viewMode.detail.message,
        })
      } else if (viewMode.detail.status === 'malformed') {
        zeroStatusLine = t('view.ownership.malformed', {
          reason: viewMode.detail.reason,
        })
      } else {
        zeroStatusLine = t('view.ownership.transport')
      }
    } else if (viewMode.kind === 'team-loading') {
      zeroStatusLine = t('view.ownership.teamLoading')
      zeroStatus = 'team-loading'
    } else {
      // store-driven (the probe is still in flight; the store state is
      // the only concrete evidence).
      const foreign =
        projectionState !== null
        && (projectionState.lastError?.code === 'TEAM_REMOTE_FOREIGN_TEAM'
          || projectionState.lastAssessment?.status === 'foreign')
      if (
        projectionState === null
        || projectionState.status === 'idle'
        || projectionState.status === 'loading'
        || projectionState.status === 'ready'
      ) {
        zeroStatusLine = t('view.ownership.loading')
        zeroStatus = 'ownership-loading'
      } else if (projectionState.status === 'reconnecting') {
        zeroStatusLine = t('view.projection.notLoaded')
        zeroStatus = projectionState.status
      } else if (foreign) {
        zeroStatusLine = t('view.projection.foreign')
        zeroStatus = projectionState.status
      } else {
        const code = projectionState.lastError?.code
          ?? projectionState.lastAssessment?.status
          ?? 'unknown'
        const message = projectionState.lastError?.message ?? ''
        zeroStatusLine = `${t('view.projection.failed')} — ${code}${message !== '' ? `: ${message}` : ''}`
        zeroStatus = projectionState.status
      }
    }
    const refreshButton = (
      <button
        type="button"
        className={styles.zeroStart}
        data-team-refresh
        disabled={refreshPending}
        onClick={runRefresh}
      >
        {t('view.refresh')}
      </button>
    )
    if (creation === undefined) {
      return (
        <div className={styles.zero} data-team-zero>
          <div className={styles.zeroInner}>
            <p className={styles.zeroText} data-team-projection-status={zeroStatus}>
              {zeroStatusLine}
            </p>
            {refreshButton}
            {rootsNote !== null && (
              <p className={styles.legacyNote} data-roots-note>{rootsNote}</p>
            )}
            {rootsList}
          </div>
        </div>
      )
    }
    // P9-T8 (S5-D, UI §34.1): a decoded `legacy-team` inspection REPLACES
    // the ordinary zero state with the persistent read-only banner — NO
    // Start-Team entry (§34.3 forbidden executable list: no Resume Team /
    // Restore Member / Create Member / Change PolicyState / Edit Team
    // override / Continue legacy Team mutation / Upgrade in place).
    if (legacy !== null && legacy.status === 'ok' && legacy.inspection.status === 'legacy-team') {
      const inspection = legacy.inspection
      return (
        <div className={styles.zero} data-team-zero data-legacy-zero="legacy-team">
          <div className={styles.legacyBanner} data-legacy-banner>
            <p>{t('legacy.banner.line1')}</p>
            <p>{t('legacy.banner.line2')}</p>
            <p>{t('legacy.banner.line3')}</p>
          </div>
          <div className={styles.legacySummary} data-legacy-summary>
            <h3 className={styles.legacySummaryTitle}>{t('legacy.summary')}</h3>
            {inspection.teamId !== null && (
              <p data-legacy-team-id>{inspection.teamId}</p>
            )}
            {inspection.leaderSessionId !== null && (
              <p data-legacy-leader-session>{inspection.leaderSessionId}</p>
            )}
            <p data-legacy-counts>
              {t('legacy.counts', {
                roster: String(inspection.roster.length),
                sessions: String(inspection.sessionCount),
              })}
            </p>
            {inspection.rosterWarningCount > 0 && (
              <p data-legacy-roster-warning>{String(inspection.rosterWarningCount)}</p>
            )}
            {inspection.roster.length > 0 && (
              <ul data-legacy-roster>
                {inspection.roster.map((row, index) => (
                  <li
                    key={`${row.source}:${row.fileName}:${String(index)}`}
                    data-legacy-roster-row
                  >
                    {row.name ?? row.id ?? row.fileName}
                    {row.role !== null ? ` (${row.role})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )
    }
    // UI §3: a non-team session (or an unlanded team frame) offers the New
    // Team entry; the panel replaces the entry while open, and the intent
    // draft persists in view state across open/close. The inspection
    // failure / unrecognized status keeps this zero state + ONE verbatim
    // note (UI §38: a greyed surface must state its reason).
    const legacyNote =
      legacy !== null && legacy.status === 'error'
        ? t('legacy.inspectError', { message: `${legacy.code}: ${legacy.message}` })
        : legacy !== null && legacy.status === 'ok' &&
            legacy.inspection.status === 'unknown'
          ? t('legacy.inspectError', {
              message: `unrecognized status: ${JSON.stringify(legacy.inspection.raw)}`,
            })
          : null
    return (
      <div className={styles.zero} data-team-zero>
        <div className={styles.zeroInner}>
          <p className={styles.zeroText} data-team-projection-status={zeroStatus}>
            {zeroStatusLine}
          </p>
          {refreshButton}
          {legacyNote !== null && (
            <p className={styles.legacyNote} data-legacy-note>{legacyNote}</p>
          )}
          {rootsNote !== null && (
            <p className={styles.legacyNote} data-roots-note>{rootsNote}</p>
          )}
          {rootsList}
          {creationOpen
            ? <TeamCreationPanel
                listCatalog={creation.listCatalog}
                getCatalog={creation.getCatalog}
                probeCompatibility={creation.probeCompatibility}
                teamCreate={creation.teamCreate}
                teamAdmitInitialWork={creation.teamAdmitInitialWork}
                openCreatedSession={creation.openCreatedSession}
                onCreated={() => setCreationOpen(false)}
                pullProjection={pullProjection}
                listAgentPresets={creation.listAgentPresets}
                workspaces={workspaceOptions}
                handoffSource={handoffSource}
                handoffFace={handoff}
                draft={intentDraft}
                onDraftChange={setIntentDraft}
                onCancel={() => setCreationOpen(false)}
                t={t}
              />
            : (
              <button
                type="button"
                className={styles.zeroStart}
                data-intent-start-here
                onClick={() => setCreationOpen(true)}
              >
                {t('intent.startHere')}
              </button>
            )}
        </div>
      </div>
    )
  }
  // `team-ready` is derived from `snapshot !== null` (which is derived
  // from a resolved mirror), so this re-check is a guaranteed no-op — it
  // only restores the narrowing TS cannot see through the memo.
  if (resolution === undefined || snapshot === null) {
    // Unreachable: `team-ready` is derived from a non-null snapshot (the
    // frame is resolved). The throw only restores the narrowing TS
    // cannot see through the viewMode memo.
    throw new Error('team-ready view mode without a resolved frame')
  }
  const currentInstanceId = resolution.perspective.kind === 'member-child'
    ? resolution.perspective.memberInstanceId
    : undefined
  return (
    <div className={styles.body} data-team-view>
      <div
        className={styles.viewStatus}
        data-team-view-status={withFrameStatus}
        data-refresh-pending={withFrameRefreshing || undefined}
      >
        {viewMode.kind === 'team-ready' && viewMode.stale ? (
          // (PR #35 second follow-up P1-A) the read-state refresh FAILED
          // over a last good frame: the frame is KEPT (never degraded to
          // none, never dropped) + the explicit stale banner (guide §4.2
          // "已有旧 frame").
          <span className={styles.legacyNote} data-team-ownership-stale>
            {t('view.ownership.stale')}
          </span>
        ) : null}
        {withFrameError !== null
          ? (
            <span className={styles.legacyNote} data-team-view-error>
              {t('view.refresh.failed')}
              {` — ${withFrameError.code}`}
              {withFrameError.message !== '' ? `: ${withFrameError.message}` : ''}
            </span>
          )
          : withFrameRefreshing
            ? <span data-team-view-refreshing>{t('view.refreshing')}</span>
            : null}
        <button
          type="button"
          className={styles.zeroStart}
          data-team-refresh
          disabled={refreshPending}
          onClick={runRefresh}
        >
          {t('view.refresh')}
        </button>
      </div>
      {corruptionBar !== null ? (
        // A4-PR7 W1 (RULING 5-B) — the FIXED, non-dismissible corrupt-record
        // warning bar at the TOP of the team body: visibility only (no
        // action, no dismiss — it persists while the ledger fact exists and
        // survives Member destroy/rebuild because the read is ledger-derived,
        // never member-derived). The count/sequences are the server's own
        // facts; `disclosesMember` marks a row that carries its OWN
        // attribution clue — an identity OR an operation member — which is
        // never a claim that a named Member caused the corruption; a false
        // row gets Team-level wording, never an invented name.
        // W4 (finding F2): the bar renders ONLY from the state row owned by
        // the Team on screen (`corruptionBar`), never from an inherited one.
        <div className={styles.corruptionBar} data-team-control-corruption role="alert">
          <span data-team-control-corruption-summary>
            {t('view.corruption.summary')}
            {`: ${corruptionBar.corruptCount}`}
          </span>
          <ul className={styles.corruptionRows} data-team-control-corruption-rows>
            {corruptionBar.legs.map(leg => (
              <li
                key={leg.sequence}
                data-team-control-corruption-leg
                data-team-control-corruption-attributable={leg.disclosesMember ? 'yes' : 'no'}
              >
                {`${t('view.corruption.leg')} #${leg.sequence}`}
                {leg.disclosesMember
                  ? ` — ${t('view.corruption.attributed')}`
                  : ` — ${t('view.corruption.unattributed')}`}
                {leg.requestId !== null ? ` · request ${leg.requestId}` : ''}
                {leg.approvalCaseId !== null ? ` · case ${leg.approvalCaseId}` : ''}
              </li>
            ))}
          </ul>
          {corruptionBar.truncated
            ? <span data-team-control-corruption-truncated>{t('view.corruption.truncated')}</span>
            : null}
        </div>
      ) : corruptionNotice !== null ? (
        // A4-PR7 W4 (finding F1) — the NEUTRAL companion of the bar, in the
        // SAME position: THIS Team's integrity read did not succeed, so the
        // absence of a bar proves nothing either way. Same posture as the bar
        // (fixed, non-dismissible, no action, no modal, never a blocker, and
        // it never touches the ledger surface below) and deliberately NOT the
        // warning-lane styling: it reports the availability of the CHECK, not
        // a claim about records, and it asserts nothing about execution. The
        // typed code travels with it for diagnostics (the W1 note lane was
        // recorded but never rendered — that invisibility WAS finding F1).
        <div
          className={styles.corruptionCheckNote}
          data-team-control-corruption-check-unavailable
          role="status"
        >
          {t('view.corruption.checkUnavailable')}
          {` — ${corruptionNotice.code}`}
        </div>
      ) : null}
      <section className={styles.section} data-team-section="timeline">
        <h3 className={styles.sectionTitle}>{t('view.timeline.title')}</h3>
        <TeamTimeline
          snapshot={snapshot}
          ledger={ledger}
          currentInstanceId={currentInstanceId}
          onSelectSession={openSession}
          t={t}
        />
      </section>
      <section className={styles.section} data-team-section="members">
        <h3 className={styles.sectionTitle}>{t('view.members.title')}</h3>
        <TeamMembers
          snapshot={snapshot}
          ledger={ledger}
          currentSessionId={sessionId}
          onSelectSession={openSession}
          memberCommands={memberCommands}
          openTeamMode={openTeamMode}
          openOrdinaryMode={openOrdinaryMode}
          teamOpenMode={teamOpenMode}
          workspaces={workspaceOptions}
          t={t}
        />
      </section>
      {governance !== undefined && (
        <section className={styles.section} data-team-section="governance">
          <h3 className={styles.sectionTitle}>{t('governance.title')}</h3>
          <TeamGovernance snapshot={snapshot} governance={governance} t={t} />
        </section>
      )}
      <section className={styles.section} data-team-section="activity">
        <h3 className={styles.sectionTitle}>{t('view.activity.title')}</h3>
        <TeamActivity activity={snapshot.activity} t={t} />
      </section>
      <section className={styles.section} data-team-section="ledger">
        <h3 className={styles.sectionTitle}>{t('view.ledger.title')}</h3>
        <TeamLedger
          snapshot={snapshot}
          ledger={ledger}
          ledgerState={ledgerState}
          onRetry={refreshTeamLedger}
          onSelectSession={openSession}
          onResolveControl={onResolveControl}
          controlSurfaceMode={controlSurfaceMode}
          t={t}
        />
      </section>
    </div>
  )
}
