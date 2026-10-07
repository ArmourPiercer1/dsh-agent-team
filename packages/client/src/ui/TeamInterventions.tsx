/**
 * A4-PR6 §6.D — the intervention panel (UI §18 surface; mounted INSIDE
 * TeamGovernance — no view-level mount, no legacy refactor).
 *
 * Laws this component exists to make visible (and the client spec pins):
 *  - `legalActions` are SERVER-DERIVED: the buttons rendered are exactly
 *    the wire array; an empty array is TERMINAL (the row shows the
 *    structured evidence, never an affordance). The component imports no
 *    authority kernel — it CANNOT derive legality locally.
 *  - escalated/decided legs are visibly terminal (no action remains).
 *  - warnings render a structured block, never a generic JSON dump.
 *  - the administration view renders the effective set AS RULES (one flat
 *    row per rule, matcher by kind + resource text) — subtree rules are
 *    never expanded into a directory/tree.
 *  - after a successful act the panel RE-PULLS; no optimistic mutation.
 */
import { useCallback, useEffect, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResponse } from '../../../remote/src/index.js'
import type { TeamKey } from './locales.js'
import {
  interventionActParams,
  interventionListParams,
  interventionRows,
  permissionAdministrationParams,
  terminalEvidence,
  type InterventionActVerb,
  type InterventionRow,
} from '../model/team-interventions.js'
import {
  parsePermissionAdministration,
  type PermissionAdministrationView,
} from '../model/permission-administration.js'
import styles from './TeamInterventions.module.css'

/** The v8 face slice the panel consumes (OPTIONAL on TeamGovernanceFace —
 *  an older host face simply does not render the section). */
export interface TeamInterventionsFace {
  interventionList(params: { readonly teamSessionId: string }): Promise<RemoteResponse>
  interventionAct(params: {
    readonly teamSessionId: string
    readonly interventionId: string
    readonly action: InterventionActVerb
    readonly note?: string
  }): Promise<RemoteResponse>
  permissionAdministrationGet(params: {
    readonly teamSessionId: string
    readonly memberInstanceId?: string
  }): Promise<RemoteResponse>
}

/** The panel props. */
export interface TeamInterventionsProps {
  readonly teamSessionId: string
  readonly face: TeamInterventionsFace
  readonly t: PropsLocale<'team'>['t']
}

type ReadNote = { readonly code: string; readonly message: string } | undefined

function errorNote(response: RemoteResponse): ReadNote {
  if (response.ok) return undefined
  return { code: response.error.code, message: response.error.message }
}

/** The structured block-scope text: scalar leaves joined, NEVER a raw
 *  serialization of the record (the §6.C renderer law). */
function blockScopeText(scope: Readonly<Record<string, unknown>> | null): string {
  if (scope === null) return ''
  const parts: string[] = []
  for (const [key, value] of Object.entries(scope)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      parts.push(`${key}=${String(value)}`)
    }
  }
  return parts.join(' \u00b7 ')
}

/** The frozen verb → label seat map (display grouping ONLY: an action
 *  not on the wire never gets a button — this map LABELS, it never
 *  supplies). */
const ACTION_LABEL_KEYS: Readonly<Record<string, TeamKey>> = {
  allow: 'interventions.action.allow',
  deny: 'interventions.action.deny',
  escalate: 'interventions.action.escalate',
  acknowledge: 'interventions.action.acknowledge',
}

/** The one read surface of the panel: list + administration, settled. */
interface PanelState {
  readonly rows: readonly InterventionRow[]
  readonly administration?: PermissionAdministrationView
  readonly listError: ReadNote
  readonly administrationError: ReadNote
}

/**
 * The interventions card. A mount pulls `intervention.list` +
 * `override.getPermissionAdministration`; every act dispatch goes through
 * the injected frozen face and is followed by exactly ONE re-pull (no
 * optimistic authority patch — the projection is the final authority).
 */
export function TeamInterventions({
  teamSessionId, face, t,
}: TeamInterventionsProps): React.JSX.Element {
  const [state, setState] = useState<PanelState>({
    rows: [],
    listError: undefined,
    administrationError: undefined,
  })
  const [actError, setActError] = useState<ReadNote>(undefined)
  const [pendingId, setPendingId] = useState<string | undefined>(undefined)

  const refresh = useCallback(async (): Promise<void> => {
    const [list, administration] = await Promise.all([
      face.interventionList(interventionListParams(teamSessionId)).catch(() => undefined),
      face.permissionAdministrationGet(permissionAdministrationParams(teamSessionId)).catch(() => undefined),
    ])
    setState((previous) => ({
      rows: list !== undefined && list.ok ? interventionRows(list.value.data) : previous.rows,
      ...(administration !== undefined && administration.ok
        ? { administration: parsePermissionAdministration(administration.value.data) }
        : {}),
      listError: list === undefined
        ? { code: 'transport-loss', message: 'intervention.list' }
        : errorNote(list),
      administrationError: administration === undefined
        ? { code: 'transport-loss', message: 'override.getPermissionAdministration' }
        : errorNote(administration),
    }))
  }, [face, teamSessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onAct = useCallback(async (row: InterventionRow, action: InterventionActVerb): Promise<void> => {
    setPendingId(`${row.item.interventionId}:${action}`)
    setActError(undefined)
    try {
      // THE closed body (the builder cannot add a field — never a caller,
      // never an authority claim; ADR A1-2):
      const response = await face.interventionAct(
        interventionActParams(teamSessionId, row.item.interventionId, action),
      )
      const note = errorNote(response)
      if (note !== undefined) setActError(note)
    } catch {
      setActError({ code: 'transport-loss', message: 'intervention.act' })
    } finally {
      setPendingId(undefined)
      // no optimistic mutation: the projection re-read is the truth.
      await refresh()
    }
  }, [face, refresh, teamSessionId])

  return (
    <div className={styles.card} data-interventions>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{t('interventions.title')}</span>
      </div>
      {state.listError !== undefined && (
        <p className={styles.noteError} data-interventions-error>
          {t('interventions.error', { message: `${state.listError.code}: ${state.listError.message}` })}
        </p>
      )}
      {actError !== undefined && (
        <p className={styles.noteError} data-interventions-act-error>
          {t('interventions.error', { message: `${actError.code}: ${actError.message}` })}
        </p>
      )}
      {state.rows.length === 0 && state.listError === undefined && (
        <p className={styles.meta} data-interventions-empty>{t('interventions.empty')}</p>
      )}
      {state.rows.map((row) => {
        const scope = blockScopeText(row.item.blockScope)
        return (
          <div
            key={row.item.interventionId}
            className={styles.row}
            data-intervention
            data-intervention-id={row.item.interventionId}
            data-intervention-kind={row.item.kind}
            data-intervention-status={row.item.status}
            data-intervention-response={row.item.responseBehavior}
            data-intervention-source={row.item.source.kind}
            data-intervention-required={row.item.requiredAuthority ?? ''}
            data-intervention-current={row.item.currentReviewAuthority ?? ''}
            data-terminal={row.terminal ? 'true' : 'false'}
          >
            <span className={styles.rowTitle} data-intervention-summary>
              {`${row.item.kind} \u00b7 ${row.item.status} \u00b7 ${row.item.responseBehavior}`}
            </span>
            <span className={styles.meta} data-intervention-authorities>
              {`${row.item.currentReviewAuthority ?? '-'} \u2192 ${row.item.requiredAuthority ?? '-'}`}
            </span>
            {scope !== '' && <span className={styles.meta} data-intervention-scope>{scope}</span>}
            {row.isWarning && (
              // The structured warning block (§6.C law: never generic JSON).
              <span className={styles.meta} data-intervention-warning>
                {['warning', row.item.source.id,
                  ...(row.item.fingerprint !== undefined ? [`fp ${row.item.fingerprint}`] : []),
                  ...(row.item.observationCount !== undefined ? [`x${String(row.item.observationCount)}`] : []),
                ].join(' \u00b7 ')}
              </span>
            )}
            {!row.isWarning && row.item.source.requestId !== undefined && (
              <span className={styles.meta} data-intervention-request-leaf>
                {`request ${row.item.source.requestId}${row.item.source.legOrdinal !== undefined ? ` \u00b7 leg ${String(row.item.source.legOrdinal)}` : ''}`}
              </span>
            )}
            {row.terminal ? (
              <span className={styles.terminal} data-intervention-terminal>
                {t('interventions.terminal', { evidence: terminalEvidence(row) })}
              </span>
            ) : (
              <span className={styles.actions} data-intervention-actions={row.actions.join(',')}>
                {row.actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className={styles.secondary}
                    data-intervention-action={action}
                    disabled={pendingId !== undefined}
                    onClick={() => {
                      void onAct(row, action)
                    }}
                  >
                    {t(ACTION_LABEL_KEYS[action] ?? 'interventions.title')}
                  </button>
                ))}
              </span>
            )}
          </div>
        )
      })}
      <div className={styles.cardHead} data-administration-head>
        <span className={styles.cardTitle}>{t('interventions.administration')}</span>
      </div>
      {state.administrationError !== undefined && (
        <p className={styles.noteError} data-administration-error>
          {t('interventions.error', {
            message: `${state.administrationError.code}: ${state.administrationError.message}`,
          })}
        </p>
      )}
      {state.administration !== undefined && (
        <div data-administration>
          <p className={styles.meta} data-administration-identity>
            {`${state.administration.teamSessionId}${state.administration.memberInstanceId !== undefined ? ` / ${state.administration.memberInstanceId}` : ''} \u00b7 `}
            {state.administration.generation === null
              ? t('interventions.blueprintDefault')
              : `generation ${String(state.administration.generation)}`}
            {` \u00b7 ${state.administration.source}`}
          </p>
          {/* THE RULES law: one FLAT row per rule — a subtree matcher is
              displayed by its resource TEXT, never expanded into a tree. */}
          <ul className={styles.rules} data-administration-rules>
            {state.administration.rules.map((rule, index) => (
              <li
                key={`${rule.lane}:${rule.matcherKind}:${rule.resource}:${String(index)}`}
                data-permission-rule
                data-rule-lane={rule.lane}
                data-rule-matcher-kind={rule.matcherKind}
                data-rule-resource={rule.resource}
                data-rule-effect={rule.effect}
              >
                {`${rule.lane} \u00b7 ${rule.matcherKind} ${rule.resource} \u00b7 ${rule.effect}`}
              </li>
            ))}
            {state.administration.rules.length === 0 && (
              <li data-administration-no-rules>{t('interventions.noRules')}</li>
            )}
          </ul>
          {state.administration.diagnostics.length > 0 && (
            <ul className={styles.rules} data-administration-diagnostics>
              {state.administration.diagnostics.map((entry, index) => (
                <li key={`${entry}:${String(index)}`} data-administration-diagnostic>{entry}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
