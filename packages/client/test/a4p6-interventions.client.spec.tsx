// @vitest-environment jsdom
/**
 * A4-PR6 §6.C/§6.D — the intervention-plane client laws (client lane).
 *
 * §6.C (this describe block): the RENDERER LAW — a governance row never
 * lands in a generic JSON-dumped Event row, ONE CASE PER NEW FACT TYPE
 * including `governance-proposal-recorded`. Three owners register each
 * type; this test is what makes the third (rendering) owner real: without
 * it a registration miss is invisible forever. Plus the first PR5 leftover:
 * an INCOMPLETE proposal record set renders corrupt/incomplete — the row
 * can never show a wait nothing is waiting on.
 *
 * §6.D (later blocks): the TeamInterventions panel + the Permission
 * Administration view mount laws.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** jsdom rewrites import.meta.url — anchor file reads at the repo root by
 *  walking up from the process cwd (stable for both the vitest lane and
 *  the root shim). */
function repoRoot(): string {
  let dir = resolve(process.cwd())
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'packages', 'runtime', 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('repo root not found from cwd')
}
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import {
  REMOTE_CONTRACT_VERSION_V8,
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteResponse,
  type RemoteSafeRecord,
} from '../../remote/src/index.js'
import { en } from '../src/ui/locales.js'
import { TeamInterventions, type TeamInterventionsFace } from '../src/ui/TeamInterventions.js'
import type { LedgerCategory } from '../../contracts/src/index.js'
import type {
  TeamUiLedgerModel, TeamUiLedgerRow, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
import {
  GOVERNANCE_PROPOSAL_RECORD_FIELDS,
  TEAM_LEDGER_INITIAL_LIMIT,
  deriveTeamLedgerSection,
  type TeamLedgerFilter, type TeamLedgerSectionModel,
} from '../src/model/team-ledger-model.js'

const LEADER = 'team-leader'
const MEMBER = 'team-member'
const T = 1_700_000_000_000

const iso = (ms: number): string => new Date(ms).toISOString()

function uiEntry(
  sequence: number,
  factType: string,
  createdAt: number,
  payload: Record<string, unknown>,
  category?: LedgerCategory,
): TeamUiLedgerRow {
  return {
    sequence,
    factType,
    ...(category === undefined ? {} : { category }),
    rootSessionId: LEADER,
    operationId: null,
    createdAt: iso(createdAt),
    payload,
  } as unknown as TeamUiLedgerRow
}

function uiMember(
  instanceId: string,
  childSessionId: string | null,
  label: string,
  templateId: string,
): TeamUiMemberInstance {
  return { instanceId, templateId, label, childSessionId } as unknown as TeamUiMemberInstance
}

const DEFAULT_MEMBERS: readonly TeamUiMemberInstance[] = [
  uiMember('lead', null, 'Lead', 'tpl-lead'),
  uiMember('mate', MEMBER, 'Mate', 'tpl-mate'),
]

function snapshot(
  members: readonly TeamUiMemberInstance[] = DEFAULT_MEMBERS,
): TeamUiSnapshot {
  return { teamSessionId: LEADER, generation: 1, members } as unknown as TeamUiSnapshot
}

function ledger(entries: readonly TeamUiLedgerRow[]): TeamUiLedgerModel {
  return {
    completeness: 'partial',
    entries,
    controls: [],
    messages: [],
    intervals: [],
    progress: [],
    pendingControlByInstance: {},
  } as unknown as TeamUiLedgerModel
}

function derive(entries: readonly TeamUiLedgerRow[]): TeamLedgerSectionModel {
  return deriveTeamLedgerSection({
    ledger: ledger(entries),
    snapshot: snapshot(),
    loadedCount: TEAM_LEDGER_INITIAL_LIMIT,
    filter: { category: 'all', instanceId: null } satisfies TeamLedgerFilter,
    total: entries.length,
    completeThrough: entries.length,
  })
}

const SOUND_PROPOSAL: Record<string, unknown> = {
  targetMemberInstanceId: 'mate',
  baseGeneration: 3,
  baseSnapshotId: 'snap-3',
  desiredEffect: 'allow',
  authorityEnvelopeAst: { kind: 'exact', resource: 'shell' },
  requiredAuthority: 'human-user',
  caseFingerprint: 'fp-1',
  status: 'proposed',
  recordedAt: iso(T),
}

function okResponse8(data: Record<string, unknown>, method: string): RemoteResponse {
  return buildRemoteSuccess(data as RemoteSafeRecord, {
    method,
    endpoint: method,
    contractVersion: REMOTE_CONTRACT_VERSION_V8,
    requestToken: null,
  } as never)
}

function errorResponse8(code: string, message: string, method: string): RemoteResponse {
  return buildRemoteError(code, message, {
    method,
    endpoint: method,
    contractVersion: REMOTE_CONTRACT_VERSION_V8,
    requestToken: null,
  } as never)
}

const APPROVAL_OPEN = {
  interventionId: 'int-case-a',
  kind: 'approval',
  responseBehavior: 'wait-for-response',
  blockScope: null,
  source: { kind: 'control-case', id: 'case-a', requestId: 'req-1', legOrdinal: 1 },
  status: 'open',
  requiredAuthority: 'leader',
  currentReviewAuthority: 'leader',
  legalActions: ['allow', 'escalate', 'deny'],
  derivationReasons: [],
  createdAt: '2026-10-07T00:00:00.000Z',
}

const WARNING_OPEN = {
  interventionId: 'int-warn-w1',
  kind: 'warning',
  responseBehavior: 'informational',
  blockScope: null,
  source: { kind: 'governance-warning', id: 'warn-1' },
  status: 'open',
  legalActions: ['acknowledge'],
  derivationReasons: [],
  createdAt: '2026-10-07T00:00:00.000Z',
  fingerprint: 'fp-1',
  observationCount: 2,
}

const APPROVAL_DECIDED = {
  ...APPROVAL_OPEN,
  status: 'resolved',
  legalActions: [],
}

const EMPTY_ADMIN = {
  teamSessionId: LEADER,
  memberInstanceId: 'mate',
  generation: null,
  source: 'blueprint-default',
  effective: { rules: [] },
  diagnostics: [],
}

interface V8FaceArgs {
  readonly lists: readonly (readonly Record<string, unknown>[])[]
  readonly administration?: Record<string, unknown>
  readonly administrationResponse?: RemoteResponse
}

/** A scripted v8 face: each `intervention.list` answers the NEXT scripted
 *  page (the last page repeats), the act always succeeds, calls recorded. */
function makeV8Face(args: V8FaceArgs) {
  const calls: { endpoint: string; params: unknown }[] = []
  let listIndex = 0
  const face: TeamInterventionsFace = {
    interventionList: vi.fn(async (params) => {
      calls.push({ endpoint: 'intervention.list', params })
      const items = args.lists[Math.min(listIndex, args.lists.length - 1)] ?? []
      listIndex += 1
      return okResponse8({ items: [...items] }, 'intervention.list')
    }),
    interventionAct: vi.fn(async (params) => {
      calls.push({ endpoint: 'intervention.act', params })
      return okResponse8({ outcome: 'decided' }, 'intervention.act')
    }),
    permissionAdministrationGet: vi.fn(async (params) => {
      calls.push({ endpoint: 'override.getPermissionAdministration', params })
      return args.administrationResponse ?? okResponse8({ administration: args.administration ?? EMPTY_ADMIN }, 'override.getPermissionAdministration')
    }),
  }
  return { face, calls }
}

function renderPanel(face: TeamInterventionsFace) {
  return render(
    <TeamInterventions teamSessionId={LEADER} face={face} t={makeTranslate(en)} />,
  )
}

afterEach(cleanup)

describe('A4-PR6 §6.D the intervention panel renders the server-given plane', () => {
  it('rows carry the closed columns; warnings render structured, never generic JSON', async () => {
    const { face } = makeV8Face({ lists: [[APPROVAL_OPEN, WARNING_OPEN]] })
    const view = renderPanel(face)
    await waitFor(() => expect(view.container.querySelectorAll('[data-intervention]').length).toBe(2))
    const approval = view.container.querySelector<HTMLElement>('[data-intervention-id="int-case-a"]')
    expect(approval?.dataset['interventionKind']).toBe('approval')
    expect(approval?.dataset['interventionStatus']).toBe('open')
    expect(approval?.dataset['interventionResponse']).toBe('wait-for-response')
    expect(approval?.dataset['interventionSource']).toBe('control-case')
    expect(approval?.dataset['interventionRequired']).toBe('leader')
    expect(approval?.dataset['interventionCurrent']).toBe('leader')
    expect(approval?.dataset['terminal']).toBe('false')
    // exactly the server-given affordances, in the given order:
    const actions = [...(approval?.querySelectorAll<HTMLButtonElement>('[data-intervention-action]') ?? [])]
      .map((button) => button.dataset['interventionAction'])
    expect(actions).toEqual(['allow', 'escalate', 'deny'])
    const warning = view.container.querySelector<HTMLElement>('[data-intervention-id="int-warn-w1"]')
    expect(warning?.querySelector('[data-intervention-warning]')?.textContent).toContain('fp-1')
    expect(warning?.querySelectorAll('[data-intervention-action]').length).toBe(1)
    // The §6.C law holds on the panel too: no serialized payload is ever
    // rendered as visible text.
    expect(view.container.textContent).not.toContain('{"')
  })

  it('a row with EMPTY legalActions is terminal: no affordance, the evidence stands (the client derives NOTHING)', async () => {
    const { face } = makeV8Face({ lists: [[APPROVAL_DECIDED]] })
    const view = renderPanel(face)
    await waitFor(() => expect(view.container.querySelectorAll('[data-intervention]').length).toBe(1))
    const row = view.container.querySelector<HTMLElement>('[data-intervention]')
    expect(row?.dataset['terminal']).toBe('true')
    expect(row?.querySelectorAll('[data-intervention-action]').length).toBe(0)
    expect(row?.querySelector('[data-intervention-terminal]')?.textContent).toContain('req-1')
  })

  it('an act dispatch rides the closed body and the panel RE-PULLS (no optimistic mutation)', async () => {
    const { face, calls } = makeV8Face({ lists: [[APPROVAL_OPEN], [APPROVAL_DECIDED]] })
    const view = renderPanel(face)
    await waitFor(() => expect(view.container.querySelectorAll('[data-intervention-action]').length).toBe(3))
    const allow = view.container.querySelector<HTMLButtonElement>('[data-intervention-action="allow"]')
    expect(allow).not.toBeNull()
    await act(async () => {
      fireEvent.click(allow as HTMLButtonElement)
    })
    await waitFor(() => expect(
      view.container.querySelector<HTMLElement>('[data-intervention]')?.dataset['terminal'],
    ).toBe('true'))
    expect(calls.map((call) => call.endpoint)).toEqual([
      'intervention.list',
      'override.getPermissionAdministration',
      'intervention.act',
      'intervention.list',
      'override.getPermissionAdministration',
    ])
    const actCall = calls[2] as { params: Record<string, unknown> }
    expect(Object.keys(actCall.params).sort()).toEqual(['action', 'interventionId', 'teamSessionId'])
    expect(actCall.params['interventionId']).toBe('int-case-a')
    expect(actCall.params['action']).toBe('allow')
  })

  it('the model and the component import NO authority kernel (source law: legality is server-derived)', () => {
    for (const path of ['../src/model/team-interventions.ts', '../src/ui/TeamInterventions.tsx']) {
      const source = readFileSync(join(repoRoot(), 'packages', 'client', path.replace('../src/', 'src/')), 'utf8')
      expect(/authorityRank|planPermissionMutationApproval|evaluateAuthorityCeiling/.test(source), path).toBe(false)
      expect(/from '[^']*governance\//.test(source), path).toBe(false)
    }
  })

  it('a typed list refusal renders verbatim, never a silent empty plane', async () => {
    const face = makeV8Face({ lists: [[]] }).face
    face.interventionList = vi.fn(async () =>
      errorResponse8('internal-error', 'the control source is unwired', 'intervention.list'),
    )
    const view = renderPanel(face)
    await waitFor(() => expect(view.container.querySelector('[data-interventions-error]')).not.toBeNull())
    expect(view.container.querySelector('[data-interventions-error]')?.textContent).toContain('internal-error')
    expect(view.container.querySelector('[data-interventions-error]')?.textContent).toContain('the control source is unwired')
  })
})

describe('A4-PR6 §6.C the governance rows never render as generic JSON Events', () => {
  it('the warning family never becomes an Events row at all (its surface is TeamInterventions)', () => {
    const section = derive([
      uiEntry(1, 'governance-warning-observed', T, {
        interventionId: 'int-warn-w1', verdict: 'mismatch', fingerprint: 'fp-1',
      }, 'policy'),
      uiEntry(2, 'governance-warning-acknowledged', T + 1, {
        interventionId: 'int-warn-w1', principalId: 'human-1',
      }, 'policy'),
    ])
    expect(section.rows).toHaveLength(0)
  })

  it('governance-proposal-recorded renders a STRUCTURED row, never a serialized payload', () => {
    const section = derive([uiEntry(1, 'governance-proposal-recorded', T, SOUND_PROPOSAL, 'policy')])
    expect(section.rows).toHaveLength(1)
    const row = section.rows[0] as NonNullable<(typeof section.rows)[number]>
    expect(row.kind).toBe('governance-proposal')
    expect(row.governanceRecordStatus).toBe('sound')
    expect(row.summary).toContain('governance proposal')
    // THE renderer law: no serialized JSON anywhere on the row.
    expect(row.summary).not.toContain('{')
    expect(row.detail).not.toContain('{')
    expect(row.summary).not.toContain('"authorityEnvelopeAst"')
  })

  it('an INCOMPLETE proposal record set renders corrupt/incomplete — never an awaiting proposal (PR5 leftover A)', () => {
    const partial: Record<string, unknown> = { ...SOUND_PROPOSAL }
    delete partial['status']
    delete partial['authorityEnvelopeAst']
    const section = derive([uiEntry(1, 'governance-proposal-recorded', T, partial, 'policy')])
    const row = section.rows[0] as NonNullable<(typeof section.rows)[number]>
    expect(row.governanceRecordStatus).toBe('corrupt')
    expect(row.summary).toContain('INCOMPLETE')
    expect(row.summary).toContain('nothing is waiting on it')
    // the marker NAMES the partial set (the corrupt/incomplete marker is
    // carried all the way to the rendered row, §6.C).
    expect(row.detail).toContain('missing status')
    expect(row.detail).toContain('missing authorityEnvelopeAst')
    // never a wait claim:
    expect(row.pending).toBe(false)
    expect(row.summary.toLowerCase()).not.toContain('awaiting')
    expect(row.summary.toLowerCase()).not.toContain('pending')
  })

  it('control-escalation-recorded renders structured from the frozen A3-12(ii) leaves', () => {
    const section = derive([
      uiEntry(1, 'control-escalation-recorded', T, {
        approvalCaseId: 'case-1',
        legOrdinal: 2,
        previousRequestId: 'req-1',
        escalatedBy: { kind: 'human', humanId: 'human-1' },
        reason: 'below ceiling',
      }, 'control'),
    ])
    const row = section.rows[0] as NonNullable<(typeof section.rows)[number]>
    expect(row.kind).toBe('control-escalation')
    expect(row.summary).toContain('escalation')
    expect(row.summary).toContain('leg 2')
    expect(row.detail).toContain('previous req-1')
    expect(row.summary).not.toContain('{')
    expect(row.detail).not.toContain('{')
    // the actor is the ESCALATION fact, not a guessed instance
    expect(row.actorInstanceId).toBe('')
  })

  it('the completeness mirror equals the HOST strict reader closed set (drift pin)', () => {
    const host = readFileSync(
      join(repoRoot(), 'packages', 'runtime', 'governance', 'proposal-store.ts'),
      'utf8',
    )
    const m = /const RECORD_FIELDS = \[([\s\S]*?)\]/.exec(host)
    expect(m, 'the host strict reader still declares RECORD_FIELDS').not.toBeNull()
    const body = (m as RegExpExecArray)[1] ?? ''
    const fields = [...body.matchAll(/'([^']+)'/g)].map((x) => x[1] as string)
    expect(fields.length).toBeGreaterThan(0)
    expect([...GOVERNANCE_PROPOSAL_RECORD_FIELDS].sort()).toEqual([...fields].sort())
  })
})
