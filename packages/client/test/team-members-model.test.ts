/**
 * P9-T10 / S8 — bug #5 (UI §16.1 fixed hierarchy): the members-section model
 * must emit a fixed group row for every non-leader template even while the
 * template has no instances yet (the §17 "+" first-instance entry —
 * "Explicit create vs delegate-and-create", UI §17.3). The renderer already
 * renders the "尚无实例" expansion for empty groups and the create dialog
 * binds the template; the instance-only fold previously dropped such groups
 * entirely, making the first delegation to a template unreachable from the
 * UI (S8 vertical S5: no 创建成员实例 button on a zero-instance roster).
 *
 * Plain-node test (the sanctioned runner executes `.test.ts` only): the
 * model is pure — no React, no I/O, no timers.
 */
import { describe, expect, it } from 'vitest'
import { deriveTeamMembers } from '../src/model/team-members-model.js'
import type {
  TeamUiLedgerModel, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'

const TEAM = 'team-root-s'

function instance(
  overrides: Partial<TeamUiMemberInstance> & Pick<TeamUiMemberInstance, 'instanceId' | 'templateId' | 'label'>,
): TeamUiMemberInstance {
  return {
    childSessionId: null,
    lifecycle: 'CREATED',
    displayStatus: 'created',
    ...overrides,
  } as unknown as TeamUiMemberInstance
}

function template(
  kind: 'leader' | 'member',
  templateId: string,
  displayName: string,
): { kind: 'leader' | 'member'; templateId: string; displayName: string; contextPolicy: 'persistent' } {
  return { kind, templateId, displayName, contextPolicy: 'persistent' }
}

function snapshot(
  members: readonly TeamUiMemberInstance[],
  templates: readonly { kind: 'leader' | 'member'; templateId: string; displayName: string; contextPolicy: 'persistent' }[],
): TeamUiSnapshot {
  return {
    teamSessionId: TEAM,
    generation: 1,
    templates,
    members,
  } as unknown as TeamUiSnapshot
}

const LEDGER: TeamUiLedgerModel = {
  completeness: 'partial',
  pendingControlByInstance: {},
} as unknown as TeamUiLedgerModel

describe('deriveTeamMembers — UI §16.1 fixed template rows (bug #5)', () => {
  it('emits a fixed group row for a zero-instance template (the §17 "+" first-instance entry)', () => {
    const model = deriveTeamMembers(
      snapshot(
        [instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: TEAM })],
        [
          template('leader', 'tpl-lead', 'Lead'),
          template('member', 'tpl-w', 'S8 Worker A'),
        ],
      ),
      LEDGER,
    )
    expect(model.groups.length).toBe(1)
    expect(model.groups[0]?.templateId).toBe('tpl-w')
    expect(model.groups[0]?.name).toBe('S8 Worker A')
    expect(model.groups[0]?.role).toBe('teammate')
    expect(model.groups[0]?.activeCount).toBe(0)
    expect([...(model.groups[0]?.instances ?? [])]).toEqual([])
  })

  it('keeps the instance-folded groups in `members` order and appends the zero-instance templates in `templates` order', () => {
    const model = deriveTeamMembers(
      snapshot(
        [
          instance({ instanceId: 'c1', templateId: 'tpl-c', label: 'Gamma-1' }),
          instance({ instanceId: 'a1', templateId: 'tpl-a', label: 'Alpha-1' }),
        ],
        [
          template('leader', 'tpl-lead', 'Lead'),
          template('member', 'tpl-a', 'Alpha'),
          template('member', 'tpl-b', 'Beta'),
          template('member', 'tpl-c', 'Gamma'),
        ],
      ),
      LEDGER,
    )
    expect(model.groups.map(group => group.templateId)).toEqual(['tpl-c', 'tpl-a', 'tpl-b'])
    expect(model.groups[0]?.name).toBe('Gamma')
    expect(model.groups[1]?.name).toBe('Alpha')
    expect(model.groups[2]?.name).toBe('Beta')
    expect([...(model.groups[2]?.instances ?? [])]).toEqual([])
  })

  it('never duplicates a template that already folded instances', () => {
    const model = deriveTeamMembers(
      snapshot(
        [
          instance({ instanceId: 'a1', templateId: 'tpl-a', label: 'Alpha-1' }),
          instance({ instanceId: 'a2', templateId: 'tpl-a', label: 'Alpha-2' }),
        ],
        [
          template('leader', 'tpl-lead', 'Lead'),
          template('member', 'tpl-a', 'Alpha'),
        ],
      ),
      LEDGER,
    )
    expect(model.groups.length).toBe(1)
    expect(model.groups[0]?.instances.length).toBe(2)
  })

  it('skips the leader template in the fixed backfill (the leading row is synthesized separately)', () => {
    const model = deriveTeamMembers(
      snapshot(
        [instance({ instanceId: 'w1', templateId: 'tpl-w', label: 'Worker-1' })],
        [
          template('leader', 'tpl-lead', 'Lead'),
          template('member', 'tpl-w', 'Worker'),
        ],
      ),
      LEDGER,
    )
    // No leader-kind instance row: the leading row is synthesized from the
    // team session; the single worker instance folds into its template group.
    expect(model.leader.templateId).toBe(TEAM)
    expect(model.leader.instances.length).toBe(0)
    expect(model.groups.length).toBe(1)
    expect(model.groups[0]?.templateId).toBe('tpl-w')
    expect(model.groups[0]?.instances.length).toBe(1)
  })

  it('renders an empty group list for a leader-only roster', () => {
    const model = deriveTeamMembers(
      snapshot(
        [instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: TEAM, lifecycle: 'RUNNING', displayStatus: 'running' })],
        [template('leader', 'tpl-lead', 'Lead')],
      ),
      LEDGER,
    )
    expect(model.groups.length).toBe(0)
    expect(model.leader.activeCount).toBe(1)
    expect(model.leader.instances.length).toBe(1)
  })
})
