/**
 * P9-T7 (S5-A) — the New Team creation panel (UI doc §3–§9, plan P9-S5
 * S5-A; Gate P9-G5): the blueprint picker over the frozen `catalog.list` /
 * `catalog.get` rows, the revision select, the native workspace picker
 * (`useWorkspaces` rows, hidden when the feed is empty), the runtime
 * AgentPreset select (UI §7: `team` recommended default; free switching
 * re-runs the probe), the initial-work draft, and the live `intent.probe`
 * compatibility block — PASS ✓ Ready, WARNING list + explicit (never
 * default-checked) acknowledgement, FATAL ✕ with no Continue-anyway
 * (the §7.4 complete-persona preset conflict gets its dedicated copy).
 *
 * Create sequence (UI §4.3 canonical order, locked T7): CREATING → native
 * `createRootSession` (the Root DSH session, carrying the selected
 * workspace) → frozen `team.create` (binds the TeamSession, admits the
 * initial work through the real path) → `openSession(rootId)`. On a typed
 * `team.create` failure the panel stays mounted on CREATION_FAILED with
 * the typed error preserved verbatim (NO optimistic authority patch) and a
 * RETRY that re-runs `team.create` on the SAME retained root (cold-root
 * recovery); the real root is never pretended away.
 *
 * Authority discipline: the selected preset reaches the pre-creation
 * probe ONLY through the frozen `environmentFacts` channel (a persona
 * fact for the selected preset id; the domain engine treats a missing
 * fact as unavailable, which is how the §7.4 structural FATAL is
 * reached). The warning ack is a LOCAL UI gate: the frozen probe carries
 * no ack param, and the durable `compatibility.ack` applies
 * post-creation. Everything rendered after the create click is either the
 * retained typed Remote error or the opened Root session — never a
 * locally patched "success".
 */
import { useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  RemoteCatalogGetParams,
  RemoteIntentProbeParams,
  RemoteResponse,
  RemoteTeamCreateParams,
} from '../../../remote/src/index.js'
import type {
  IntentBlueprintDetail,
  IntentBlueprintRow,
  IntentCatalog,
  IntentCompatibility,
  IntentCompatibilityStatus,
  IntentCreateLabel,
  TeamIntentDraft,
  TeamPresetRow,
  TeamWorkspaceOption,
} from '../model/team-intent-model.js'
import {
  intentCreateGate,
  intentEnvironmentFacts,
  isPersonaPresetFatal,
  parseBlueprintDetail,
  parseCatalogList,
  parseCompatibilityResult,
  selectDefaultPresetId,
} from '../model/team-intent-model.js'
import type { TeamKey } from './locales.js'
import styles from './TeamCreationPanel.module.css'

/** The create button label per gate state (the locale-owned copy). */
const CREATE_LABEL_KEYS: Record<IntentCreateLabel, TeamKey> = {
  create: 'intent.create',
  createAndSend: 'intent.createAndSend',
  acknowledge: 'intent.acknowledge',
}

/** The `data-intent-status` vocabulary (the four wire statuses + UI phases). */
type PanelCompatStatus = IntentCompatibilityStatus | 'checking' | 'unknown' | 'none'

/** The typed create failure (code + message preserved verbatim from the Remote). */
export interface TeamCreateError {
  readonly code: string
  readonly message: string
}

/** The New Team panel props (the injected face members are wired at T9). */
export interface TeamCreationPanelProps {
  /** `catalog.list` (raw RemoteResponse; parsing stays in the model layer). */
  readonly listCatalog: () => Promise<RemoteResponse>
  /** `catalog.get` (one blueprint at one revision). */
  readonly getCatalog: (params: RemoteCatalogGetParams) => Promise<RemoteResponse>
  /** `intent.probe` (the pre-creation compatibility probe). */
  readonly probeCompatibility: (params: RemoteIntentProbeParams) => Promise<RemoteResponse>
  /** `team.create` (binds the TeamSession on the named root). */
  readonly teamCreate: (params: RemoteTeamCreateParams) => Promise<RemoteResponse>
  /**
   * Native root-session creation (the public `ISessions.create`; the
   * selected workspace is carried, the preset is probe-side in T7 — the
   * frozen create face has no preset channel).
   */
  readonly createRootSession: (opts?: { readonly workspaceId?: string }) => Promise<string>
  /** Native session switch (the public `ISessions.open`). */
  readonly openSession: (sessionId: string) => void
  /** The runtime preset rows (the S0 seam-6 mapping; broken rows filtered). */
  readonly listAgentPresets: () => Promise<readonly TeamPresetRow[]>
  /** The native workspace feed options (absent/empty → the picker hides). */
  readonly workspaces: readonly TeamWorkspaceOption[]
  /** The draft (held by TeamView: persists within the page run, UI §5.3). */
  readonly draft: TeamIntentDraft
  /** Draft updates (the panel never mutates the draft in place). */
  readonly onDraftChange: (draft: TeamIntentDraft) => void
  /** Close the panel (the draft is retained in TeamView). */
  readonly onCancel: () => void
  /** The team dictionary translate seat. */
  readonly t: PropsLocale<'team'>['t']
}

/** A typed Remote failure rendered as `code: message` (verbatim, G5). */
function remoteFailureMessage(response: RemoteResponse): string {
  return response.ok ? '' : `${response.error.code}: ${response.error.message}`
}

/** A thrown error (channel loss / native create) rendered to a string. */
function throwableMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The `data-intent-status` value for the current panel state (the four
 * wire statuses when a result has landed, `checking` while a probe is in
 * flight, `unknown` when none has (a loud state, never a silent ready),
 * `none` before any blueprint is selected).
 */
function panelCompatStatus(
  blueprintId: string | null,
  checking: boolean,
  compat: IntentCompatibility | undefined,
): PanelCompatStatus {
  if (blueprintId === null) return 'none'
  if (checking) return 'checking'
  if (compat === undefined || !compat.ok) return 'unknown'
  return compat.status
}

/** The New Team creation panel (UI §3–§9). */
export function TeamCreationPanel(props: TeamCreationPanelProps): React.JSX.Element {
  const {
    listCatalog, getCatalog, probeCompatibility, teamCreate,
    createRootSession, openSession, listAgentPresets, workspaces,
    draft, onDraftChange, onCancel, t,
  } = props

  // -- catalog + per-row details (the §6 picker display names) -------------
  const [catalog, setCatalog] = useState<IntentCatalog | undefined>(undefined)
  const [catalogDetails, setCatalogDetails] = useState<Record<string, IntentBlueprintDetail | undefined>>({})
  // -- runtime presets (UI §7) ----------------------------------------------
  const [presets, setPresets] = useState<readonly TeamPresetRow[]>([])
  const [presetsReady, setPresetsReady] = useState(false)
  // -- probe + detail (generation-guarded: stale results are ignored) ------
  const [checking, setChecking] = useState(false)
  const [compat, setCompat] = useState<IntentCompatibility | undefined>(undefined)
  const [detail, setDetail] = useState<IntentBlueprintDetail | undefined>(undefined)
  // -- create (CREATING / CREATION_FAILED on the retained root) -------------
  const [creating, setCreating] = useState(false)
  const [createdRootId, setCreatedRootId] = useState<string | null>(null)
  const [createError, setCreateError] = useState<TeamCreateError | null>(null)

  // Latest draft/face refs: async settlements must never act on a stale
  // closure, and the settle-time ack reset must not feed the probe effect.
  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft }, [draft])
  const probeSeq = useRef(0)
  const detailSeq = useRef(0)

  // The catalog load (mount once): the rows, then one `catalog.get` per
  // row's latest revision for the picker display names (fail-safe per row:
  // a detail failure degrades that option to the blueprint id, never the
  // whole list).
  useEffect(() => {
    let live = true
    void listCatalog().then(async response => {
      if (!response.ok) {
        if (live) setCatalog({ ok: false, message: remoteFailureMessage(response) })
        return
      }
      const parsed = parseCatalogList(response.value.data)
      if (!parsed.ok) {
        if (live) setCatalog({ ok: false, message: parsed.message })
        return
      }
      const rows = parsed.rows
      const details: Record<string, IntentBlueprintDetail | undefined> = {}
      await Promise.all(rows.map(async row => {
        try {
          const detailResponse = await getCatalog({
            blueprintId: row.blueprintId,
            blueprintRevision: row.latestRevision,
          })
          if (detailResponse.ok) details[row.blueprintId] = parseBlueprintDetail(detailResponse.value.data)
        } catch {
          // Per-row fail-safe: the option falls back to the blueprint id.
        }
      }))
      if (live) {
        setCatalogDetails(details)
        setCatalog(parsed)
      }
    }).catch(error => {
      if (live) setCatalog({ ok: false, message: throwableMessage(error) })
    })
    return () => { live = false }
    // The injected face is built once per mount (T9 wiring); the load is
    // deliberately mount-scoped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The preset rows (mount once): after they land, preselect the §7.2
  // default when the draft has no explicit selection yet.
  useEffect(() => {
    let live = true
    void listAgentPresets().then(rows => {
      if (!live) return
      setPresets(rows)
      setPresetsReady(true)
      const current = draftRef.current
      if (current.presetId === null) {
        const id = selectDefaultPresetId(rows)
        if (id !== null) onDraftChange({ ...current, presetId: id })
      }
    }).catch(() => {
      if (live) setPresetsReady(true)
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The live probe (UI §7.3: free preset switching re-runs compatibility):
  // re-fires on blueprint / revision / preset changes; the generation
  // counter drops stale settlements. The selected preset travels as the
  // persona environment fact (the only frozen environment channel).
  useEffect(() => {
    if (draft.blueprintId === null) {
      setCompat(undefined)
      setChecking(false)
      return
    }
    const seq = ++probeSeq.current
    setChecking(true)
    const params: RemoteIntentProbeParams = {
      blueprintId: draft.blueprintId,
      ...(draft.revision !== null ? { blueprintRevision: draft.revision } : {}),
      environmentFacts: intentEnvironmentFacts(draftRef.current, presets),
    }
    void probeCompatibility(params).then(response => {
      if (probeSeq.current !== seq) return
      setChecking(false)
      setCompat(
        response.ok
          ? parseCompatibilityResult(response.value.data)
          : { ok: false, message: remoteFailureMessage(response) },
      )
      // A new verdict binds to a new mismatch set: the local ack gate
      // resets (the frozen engine's drift semantics, UI §9.2).
      const current = draftRef.current
      if (current.ack) onDraftChange({ ...current, ack: false })
    }).catch(error => {
      if (probeSeq.current !== seq) return
      setChecking(false)
      setCompat({ ok: false, message: throwableMessage(error) })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.blueprintId, draft.revision, draft.presetId, presets])

  // The selected blueprint's detail (the §6 display block under the
  // picker): one `catalog.get` per selection, generation-guarded.
  useEffect(() => {
    if (draft.blueprintId === null || draft.revision === null) {
      setDetail(undefined)
      return
    }
    const seq = ++detailSeq.current
    void getCatalog({
      blueprintId: draft.blueprintId,
      blueprintRevision: draft.revision,
    }).then(response => {
      if (detailSeq.current !== seq) return
      setDetail(response.ok ? parseBlueprintDetail(response.value.data) : undefined)
    }).catch(() => {
      if (detailSeq.current !== seq) return
      setDetail(undefined)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.blueprintId, draft.revision])

  // A blueprint / revision change starts a NEW creation attempt: the
  // retained root and its error belong to the previous attempt (the old
  // bound root stays real and reachable; it is never pretended away).
  useEffect(() => {
    setCreatedRootId(null)
    setCreateError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.blueprintId, draft.revision])

  const rows: readonly IntentBlueprintRow[] = catalog !== undefined && catalog.ok ? catalog.rows : []

  const setBlueprint = (blueprintId: string): void => {
    const row = rows.find(candidate => candidate.blueprintId === blueprintId)
    onDraftChange({
      ...draft,
      blueprintId: blueprintId === '' ? null : blueprintId,
      revision: row !== undefined ? row.latestRevision : null,
      ack: false,
    })
  }

  const setRevision = (raw: string): void => {
    onDraftChange({ ...draft, revision: raw === '' ? null : Number(raw), ack: false })
  }

  const setPreset = (presetId: string): void => {
    onDraftChange({ ...draft, presetId: presetId === '' ? null : presetId, ack: false })
  }

  const setWorkspace = (workspaceId: string): void => {
    onDraftChange({ ...draft, workspaceId: workspaceId === '' ? null : workspaceId })
  }

  const setInitialWork = (initialWork: string): void => {
    onDraftChange({ ...draft, initialWork })
  }

  const setAck = (ack: boolean): void => {
    onDraftChange({ ...draft, ack })
  }

  const gate = intentCreateGate(compat, checking, draft.ack, draft.initialWork)

  const runCreate = (retry: boolean): void => {
    if (creating) return
    if (!retry && !gate.enabled) return
    const blueprintId = draft.blueprintId
    if (blueprintId === null) return
    setCreating(true)
    setCreateError(null)
    const workspaceId = draft.workspaceId
    void (async () => {
      try {
        // 1) the real Root DSH session (retained on every later failure).
        let rootSessionId = createdRootId
        if (rootSessionId === null) {
          rootSessionId = workspaceId !== null
            ? await createRootSession({ workspaceId })
            : await createRootSession()
          setCreatedRootId(rootSessionId)
        }
        // 2) the frozen team.create on that root (cold path on retry).
        const initialWork = draft.initialWork.trim()
        const params: RemoteTeamCreateParams = {
          rootSessionId,
          blueprintId,
          ...(draft.revision !== null ? { blueprintRevision: draft.revision } : {}),
          ...(initialWork !== '' ? { initialWork: { prompt: initialWork } } : {}),
        }
        const response = await teamCreate(params)
        if (!response.ok) {
          // CREATION_FAILED: the typed Remote result, verbatim (G5). The
          // root is retained; RETRY re-runs team.create on the same root.
          setCreateError({ code: response.error.code, message: response.error.message })
          return
        }
        // 3) Root + TeamSession exist → open the Root (UI §4.3 order).
        openSession(rootSessionId)
      } catch (error) {
        // Channel loss (the only Remote rejection kind) or a native
        // create failure: a local marker code, the message verbatim.
        setCreateError({ code: 'native-error', message: throwableMessage(error) })
      } finally {
        setCreating(false)
      }
    })()
  }

  const status = panelCompatStatus(draft.blueprintId, checking, compat)
  const selectedRow = rows.find(row => row.blueprintId === draft.blueprintId)

  return (
    <div className={styles.panel} data-team-creation-panel>
      <h2 className={styles.title}>{t('intent.title')}</h2>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('intent.blueprint')}</span>
        <select
          className={styles.select}
          data-intent-blueprint
          value={draft.blueprintId ?? ''}
          disabled={catalog === undefined}
          onChange={event => setBlueprint(event.target.value)}
        >
          {catalog === undefined && <option value="">{t('intent.blueprint.loading')}</option>}
          {catalog !== undefined && !catalog.ok && <option value="">{t('intent.blueprint.empty')}</option>}
          {catalog !== undefined && catalog.ok && catalog.rows.length === 0 && (
            <option value="">{t('intent.blueprint.empty')}</option>
          )}
          {rows.map(row => {
            const rowDetail = catalogDetails[row.blueprintId]
            return (
              <option key={row.blueprintId} value={row.blueprintId}>
                {rowDetail !== undefined && rowDetail.displayName !== undefined
                  ? `${rowDetail.displayName} (rev ${String(row.latestRevision)})`
                  : `${row.blueprintId} (rev ${String(row.latestRevision)})`}
              </option>
            )
          })}
        </select>
      </label>

      {catalog !== undefined && !catalog.ok && (
        <div className={styles.error} data-intent-error data-intent-catalog-error>
          {t('intent.blueprint.error', { message: catalog.message })}
        </div>
      )}

      {detail !== undefined && (
        <div className={styles.detail} data-intent-detail>
          {detail.displayName !== undefined && (
            <span className={styles.detailName} data-intent-detail-name>{detail.displayName}</span>
          )}
          {detail.source !== undefined && (
            <span className={styles.detailSource} data-intent-detail-source>{detail.source}</span>
          )}
          {detail.description !== undefined && (
            <p className={styles.detailDescription} data-intent-detail-description>{detail.description}</p>
          )}
          <span className={styles.detailTemplates} data-intent-detail-templates>
            {String(detail.templateCount)}
          </span>
        </div>
      )}

      {selectedRow !== undefined && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('intent.revision')}</span>
          <select
            className={styles.select}
            data-intent-revision
            value={draft.revision === null ? '' : String(draft.revision)}
            onChange={event => setRevision(event.target.value)}
          >
            {selectedRow.revisions.map(revision => (
              <option key={revision} value={String(revision)}>
                {String(revision)}
              </option>
            ))}
          </select>
        </label>
      )}

      {workspaces.length > 0 && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('intent.workspace')}</span>
          <select
            className={styles.select}
            data-intent-workspace
            value={draft.workspaceId ?? ''}
            onChange={event => setWorkspace(event.target.value)}
          >
            <option value="">{t('intent.workspace')}</option>
            {workspaces.map(option => (
              <option key={option.id} value={option.id}>{option.title}</option>
            ))}
          </select>
        </label>
      )}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('intent.preset')}</span>
        <select
          className={styles.select}
          data-intent-preset
          value={draft.presetId ?? ''}
          disabled={!presetsReady || presets.length === 0}
          onChange={event => setPreset(event.target.value)}
        >
          {!presetsReady && <option value="">{t('intent.blueprint.loading')}</option>}
          {presetsReady && presets.length === 0 && <option value="">{t('intent.blueprint.empty')}</option>}
          {presets.map(row => (
            <option key={row.id} value={row.id}>
              {row.name !== undefined ? row.name : row.id}
            </option>
          ))}
        </select>
      </label>
      <p className={styles.hint}>{t('intent.preset.hint')}</p>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('intent.initialWork')}</span>
        <textarea
          className={styles.textarea}
          data-intent-initial-work
          value={draft.initialWork}
          placeholder={t('intent.initialWork.placeholder')}
          onChange={event => setInitialWork(event.target.value)}
        />
      </label>

      <div
        className={styles.compat}
        data-intent-compatibility
        data-intent-status={status}
        role="status"
      >
        <span className={styles.compatTitle}>{t('intent.compatibility')}</span>
        {status === 'checking' && (
          <p className={styles.compatNote}>{t('intent.compatibility.checking')}</p>
        )}
        {status === 'OPEN' && (
          <p className={styles.compatReady}>{t('intent.compatibility.ready')}</p>
        )}
        {status === 'DEGRADED_ACKNOWLEDGED' && (
          <p className={styles.compatNote}>{t('intent.compatibility.degraded')}</p>
        )}
        {status === 'unknown' && (
          <p className={styles.compatUnknown}>
            {t('intent.compatibility.unknown', {
              message: compat !== undefined && !compat.ok ? compat.message : '',
            })}
          </p>
        )}
        {compat !== undefined && compat.ok && compat.status === 'BLOCKED_WARNING' && (
          <ul className={styles.warningList}>
            {compat.warnings.map(row => (
              <li key={row.requirementId} className={styles.warningRow} data-intent-warning>
                <span className={styles.warningOwner}>
                  {t('intent.compatibility.owner')} {row.requirementId}
                </span>
                {row.unavailableSubjects.length > 0 && (
                  <span className={styles.warningSubjects}>
                    {t('intent.compatibility.subjects')}: {row.unavailableSubjects.join(', ')}
                  </span>
                )}
                <span className={styles.warningDetail}>{row.detail}</span>
              </li>
            ))}
          </ul>
        )}
        {compat !== undefined && compat.ok && compat.status === 'BLOCKED_WARNING' && (
          <label className={styles.ack} data-intent-ack>
            <input
              type="checkbox"
              checked={draft.ack}
              onChange={event => setAck(event.target.checked)}
            />
            {t('intent.ack')}
          </label>
        )}
        {status === 'BLOCKED_FATAL' && (
          <div className={styles.fatal} data-intent-fatal>
            <p className={styles.fatalTitle}>{t('intent.compatibility.fatal')}</p>
            {compat !== undefined && compat.ok && compat.fatals.map(row => (
              <p key={row.requirementId} className={styles.fatalRow}>
                {t('intent.compatibility.owner')} {row.requirementId} — {row.detail}
              </p>
            ))}
            {isPersonaPresetFatal(compat) && (
              <p className={styles.fatalPreset}>{t('intent.fatal.preset')}</p>
            )}
          </div>
        )}
      </div>

      {createError !== null && (
        <div className={styles.error} data-intent-error data-intent-create-error>
          {t('intent.error', { message: `${createError.code}: ${createError.message}` })}
          {createdRootId !== null && <p className={styles.rootKept}>{t('intent.rootKept')}</p>}
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          data-intent-create
          disabled={!gate.enabled || creating}
          onClick={() => runCreate(false)}
        >
          {creating ? t('intent.creating') : t(CREATE_LABEL_KEYS[gate.label])}
        </button>
        {createError !== null && createdRootId !== null && (
          <button
            type="button"
            className={styles.secondary}
            data-intent-retry
            disabled={creating}
            onClick={() => runCreate(true)}
          >
            {t('intent.retry')}
          </button>
        )}
        <button
          type="button"
          className={styles.secondary}
          data-intent-cancel
          disabled={creating}
          onClick={onCancel}
        >
          {t('intent.cancel')}
        </button>
      </div>
    </div>
  )
}
