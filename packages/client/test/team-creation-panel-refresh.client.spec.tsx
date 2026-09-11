// @vitest-environment jsdom
/**
 * RED-3 probe for the issue #2 blueprint-loading parallel repair
 * (plan §4 / §13, BP9): the New Team creation panel's mount-once catalog
 * load has NO recovery path.
 *
 * The probe pins the DESIRED behavior (BP9): after the first
 * `listCatalog()` fails, the panel exposes a MANUAL "Refresh blueprints"
 * action; invoking it re-runs the load (a new request, generation-guarded)
 * and a subsequently successful response fills the picker — saving/editing
 * a saved source and clicking Refresh is the no-HMR authoring loop.
 *
 * Against the base 6a2f3e1 the mount-once effect (no refresh surface)
 * makes this probe fail (RED); it turns green with BP9.
 *
 * Runner: real vitest (jsdom) via `pnpm --filter @dsh-agent-team/client
 * test` — the plain-node shim does not run `.client.spec.tsx` files.
 *
 * @module @dsh-agent-team/client/test/team-creation-panel-refresh
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  RemoteCatalogGetParams, RemoteIntentProbeParams, RemoteResponse, RemoteSafeJsonValue,
  RemoteTeamAdmitInitialWorkParams, RemoteTeamCreateParamsV2,
} from '../../remote/src/index.js'
import type {
  TeamIntentDraft, TeamPresetRow, TeamWorkspaceOption,
} from '../src/model/team-intent-model.js'
import { emptyTeamIntentDraft } from '../src/model/team-intent-model.js'
import { TeamCreationPanel } from '../src/ui/TeamCreationPanel.js'
import { zh } from '../src/ui/locales.js'

const BP = 'bp-refresh-1'

/** The frozen catalog wire payload (one blueprint, one revision). */
const CATALOG_DATA = { blueprints: [{ blueprintId: BP, revisions: [1] }] }

/** The frozen catalog detail wire payload. */
const DETAIL_DATA = {
  blueprint: {
    blueprintId: BP,
    revision: 1,
    displayName: 'Refresh',
    description: 'Refresh probe blueprint',
    metadata: { source: 'saved' },
    members: [{ templateId: 'tpl-lead' }],
  },
}

/** An OPEN probe verdict. */
const OPEN_DATA = {
  compatibility: {
    status: 'OPEN',
    requirements: [{ outcome: 'PASS', requirementId: 'req-1', unavailableSubjects: [], detail: 'ok', complete: false }],
  },
}

const PRESETS: readonly TeamPresetRow[] = [
  { id: 'team', name: 'Team runtime', isDefault: false },
  { id: 'solo', name: 'Solo', isDefault: true },
]

function okResponse(data: unknown, method: string): RemoteResponse {
  return {
    ok: true,
    value: {
      data: data as RemoteSafeJsonValue,
      provenance: {
        origin: 'team-remote', method, endpoint: method, contractVersion: 1,
        requestToken: null, projectionGeneration: null, effectSequence: null,
      },
    },
  }
}

interface PanelFace {
  listCatalog: () => Promise<RemoteResponse>
  getCatalog: (params: RemoteCatalogGetParams) => Promise<RemoteResponse>
  probeCompatibility: (params: RemoteIntentProbeParams) => Promise<RemoteResponse>
  teamCreateV2: (params: RemoteTeamCreateParamsV2) => Promise<RemoteResponse>
  teamAdmitInitialWorkV2: (params: RemoteTeamAdmitInitialWorkParams) => Promise<RemoteResponse>
  listAgentPresets: () => Promise<readonly TeamPresetRow[]>
}

function makeFace(listCatalog: PanelFace['listCatalog']): PanelFace {
  return {
    listCatalog,
    getCatalog: vi.fn(() => Promise.resolve(okResponse(DETAIL_DATA, 'catalog.get'))),
    probeCompatibility: vi.fn(() => Promise.resolve(okResponse(OPEN_DATA, 'intent.probe'))),
    teamCreateV2: vi.fn(() => Promise.resolve(okResponse({ path: 'root-1', durable: true, bind: {} }, 'team.create'))),
    teamAdmitInitialWorkV2: vi.fn(() => Promise.resolve(okResponse({ workOutcome: 'delivered' }, 'team.admitInitialWork'))),
    listAgentPresets: vi.fn(() => Promise.resolve(PRESETS)),
  }
}

function PanelHarness(props: {
  readonly face: PanelFace
  readonly workspaces?: readonly TeamWorkspaceOption[]
  readonly initialDraft?: TeamIntentDraft
  readonly onDraftChangeSpy?: ((draft: TeamIntentDraft) => void) | undefined
}) {
  const [draft, setDraft] = useState<TeamIntentDraft>(props.initialDraft ?? emptyTeamIntentDraft)
  return (
    <TeamCreationPanel
      listCatalog={props.face.listCatalog}
      getCatalog={props.face.getCatalog}
      probeCompatibility={props.face.probeCompatibility}
      teamCreateV2={props.face.teamCreateV2}
      teamAdmitInitialWorkV2={props.face.teamAdmitInitialWorkV2}
      listAgentPresets={props.face.listAgentPresets}
      openCreatedSession={async () => undefined}
      workspaces={props.workspaces ?? []}
      draft={draft}
      onDraftChange={(next) => {
        props.onDraftChangeSpy?.(next)
        setDraft(next)
      }}
      onCancel={() => undefined}
      t={makeTranslate(zh)}
    />
  )
}

function refreshButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('[data-intent-refresh-catalog]')
}

afterEach(cleanup)

describe('TeamCreationPanel (RED-3: the manual catalog refresh, plan §13)', () => {
  it('survives a first catalog failure with a MANUAL refresh that re-runs the load (no polling, no subscription)', async () => {
    // First load: a carrier failure (the route missing during boot — the
    // 405 symptom of plan §0.2, surfacing as a rejected RPC). Second load
    // (the user's explicit Refresh click): success with the saved rows.
    const listCatalog = vi
      .fn()
      .mockRejectedValueOnce(new Error('route /team-remote missing'))
      .mockResolvedValueOnce(okResponse(CATALOG_DATA, 'catalog.list'))
    const face = makeFace(listCatalog)
    const view = render(<PanelHarness face={face} />)
    const { container } = view

    // The failed first load: the verbatim note + the inert picker.
    await vi.waitFor(() => {
      expect(container.querySelector('[data-intent-catalog-error]') !== null).toBe(true)
    })
    expect(listCatalog).toHaveBeenCalledTimes(1)

    // The manual refresh surface (BP9): present, actionable.
    const button = refreshButton(container)
    expect(button !== null).toBe(true)
    if (button === null) return

    await act(async () => {
      fireEvent.click(button)
    })

    // The refresh re-ran the load (exactly one NEW request) and the
    // successful response filled the picker (the row selectable).
    await vi.waitFor(() => {
      expect(listCatalog).toHaveBeenCalledTimes(2)
    })
    await vi.waitFor(() => {
      const select = container.querySelector<HTMLSelectElement>('[data-intent-blueprint]')
      expect(select !== null && !select.disabled).toBe(true)
    })
    const select = container.querySelector<HTMLSelectElement>('[data-intent-blueprint]')
    const options = select !== null ? Array.from(select.options).map((o) => o.value) : []
    expect(options).toContain(BP)
    // No polling: after the refresh settles, the call count stays at 2.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(listCatalog).toHaveBeenCalledTimes(2)
  })
})
