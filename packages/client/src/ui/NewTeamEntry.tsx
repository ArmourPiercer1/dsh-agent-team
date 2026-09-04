/**
 * The global New Team entry (frozen UI design §3.1 MUST, the R118 gap):
 * an additive action fixed at `sidebar.footer.action`, independent of any
 * session — the always-discoverable way into the Team-owned creation
 * overlay. Opening the overlay creates NO DSH Session (§3.1: "不创建 DSH
 * Session"; §2.2: no fake blank Session); the overlay mounts the SAME
 * TeamCreationPanel the zero-state "Start Team from Here" path uses, with
 * no handoff face or source (the panel then renders exactly the T7
 * surface — TeamCreationPanel.tsx: absent source → no handoff block).
 *
 * Visual pattern: the native sidebar New Session row (SidebarRoot.tsx
 * L189–200: Tooltip delay 500ms disabled in the wide state, where the
 * button carries its own label; icon-only + tooltip on the rail). The
 * glyph is IconUserOutline16 (a member icon, deliberately NOT the native
 * New Session chat glyph — §3.1: "不与原生 New Session 使用完全相同 icon").
 *
 * The component is registered by the mount core through the
 * `sidebar.footer.action` slot (id `team-new`, order 10); the inject face
 * carries the frozen S5-A creation wrappers plus the native session
 * switch, so the overlay's create-success navigation goes through the
 * same public `ctx.sessions.open` seam as every other Team surface.
 */
import { useMemo, useState } from 'react'
import { IconUserOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the ui-conversation contract merge carries the global
// `useWorkspaces` seat (GlobalStandardProps) this component reads; the
// `sidebar.footer.action` SlotMap entry itself is mirrored by
// team-mount-core.ts (ui-sidebar is not linked into this package).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  RemoteCatalogGetParams,
  RemoteIntentProbeParams,
  RemoteResponse,
  RemoteTeamCreateParams,
} from '../../../remote/src/index.js'
import type { TeamPresetRow } from '../model/team-intent-model.js'
import {
  emptyTeamIntentDraft,
  teamWorkspaceOptions,
} from '../model/team-intent-model.js'
import { TeamCreationPanel } from './TeamCreationPanel.js'
import styles from './NewTeamEntry.module.css'

/**
 * The injected face of the global New Team entry: the S5-A creation face
 * members (the frozen Remote wrappers verbatim) plus the native session
 * switch — the same seams the TeamView zero-state panel consumes.
 */
export interface NewTeamEntryInjected {
  /** `catalog.list` (raw RemoteResponse). */
  readonly listCatalog: () => Promise<RemoteResponse>
  /** `catalog.get` (one blueprint at one revision). */
  readonly getCatalog: (params: RemoteCatalogGetParams) => Promise<RemoteResponse>
  /** `intent.probe` (the pre-creation compatibility probe). */
  readonly probeCompatibility: (params: RemoteIntentProbeParams) => Promise<RemoteResponse>
  /** `team.create` (binds the TeamSession on the named root). */
  readonly teamCreate: (params: RemoteTeamCreateParams) => Promise<RemoteResponse>
  /** Native root-session creation (the public `ISessions.create`). */
  readonly createRootSession: (opts?: { readonly workspaceId?: string }) => Promise<string>
  /** Native session switch (the public `ISessions.open`). */
  readonly openSession: (sessionId: string) => void
  /** The runtime preset rows (the S0 seam-6 mapping; broken rows filtered). */
  readonly listAgentPresets: () => Promise<readonly TeamPresetRow[]>
}

/** Full entry props: owner share (`wide`), injected face, and locale seat. */
export type NewTeamEntryProps =
  & PropsRuntime<'sidebar.footer.action'>
  & InjectFace<NewTeamEntryInjected>
  & PropsLocale<'team'>

/**
 * The sidebar-foot New Team action (UI §3.1): the trigger row plus the
 * Team-owned creation overlay. The draft is component-local (fresh on
 * every open, UI §5.3 page-run state — never authority); the panel is
 * the shared TeamCreationPanel, unmodified.
 * @param props - the owner `wide` flag, the injected creation face, and
 *   the team dictionary.
 * @returns the trigger row (and the overlay while open).
 */
export function NewTeamEntry(props: NewTeamEntryProps): React.JSX.Element {
  const {
    wide,
    listCatalog, getCatalog, probeCompatibility, teamCreate,
    createRootSession, listAgentPresets, openSession,
    useWorkspaces, t,
  } = props
  const [overlayOpen, setOverlayOpen] = useState(false)
  // UI §5.3: the intent draft is page-run UI state only (never authority).
  // The overlay holds its own copy — a fresh empty draft on every open.
  const [draft, setDraft] = useState(emptyTeamIntentDraft)
  const workspaceViews = useWorkspaces(s => s.items)
  const workspaces = useMemo(() => teamWorkspaceOptions(workspaceViews), [workspaceViews])

  const openOverlay = (): void => {
    // §3.1: opening the overlay creates NO session — it only mounts the
    // Team-owned panel on a fresh draft.
    setDraft(emptyTeamIntentDraft)
    setOverlayOpen(true)
  }
  const closeOverlay = (): void => {
    setOverlayOpen(false)
  }
  // The ONE close timing that must outlive the panel: a successful create
  // navigates to the freshly opened root, so the overlay closes BEFORE the
  // native session switch (the panel calls this after `team.create` ok).
  const openSessionAfterCreate = (sessionId: string): void => {
    closeOverlay()
    openSession(sessionId)
  }

  return (
    <>
      <Tooltip label={t('entry.label')} delayMs={500} disabled={wide}>
        <button
          type="button"
          className={wide ? styles.wide : styles.rail}
          aria-label={t('entry.label')}
          data-new-team-entry
          onClick={openOverlay}
        >
          <IconUserOutline16 size={wide ? 14 : 18} />
          {wide && <span className={styles.label}>{t('entry.label')}</span>}
        </button>
      </Tooltip>
      {overlayOpen && (
        <div
          className={styles.backdrop}
          data-new-team-overlay
          onClick={closeOverlay}
        >
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label={t('entry.label')}
            onClick={event => event.stopPropagation()}
          >
            <TeamCreationPanel
              listCatalog={listCatalog}
              getCatalog={getCatalog}
              probeCompatibility={probeCompatibility}
              teamCreate={teamCreate}
              createRootSession={createRootSession}
              listAgentPresets={listAgentPresets}
              openSession={openSessionAfterCreate}
              workspaces={workspaces}
              draft={draft}
              onDraftChange={setDraft}
              onCancel={closeOverlay}
              t={t}
            />
          </div>
        </div>
      )}
    </>
  )
}
