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
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
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
      new URL('../../runtime/governance/proposal-store.ts', import.meta.url),
      'utf8',
    )
    const m = /const RECORD_FIELDS = \[([\s\S]*?)\]/.exec(host)
    expect(m, 'the host strict reader still declares RECORD_FIELDS').not.toBeNull()
    const fields = [...(m as RegExpExecArray)[1].matchAll(/'([^']+)'/g)].map((x) => x[1] as string)
    expect(fields.length).toBeGreaterThan(0)
    expect([...GOVERNANCE_PROPOSAL_RECORD_FIELDS].sort()).toEqual([...fields].sort())
  })
})
