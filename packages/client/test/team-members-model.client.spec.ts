/**
 * Team member-group projection: the fixed leading leader row (including the
 * roster-absent fallback anchored to the team session), the
 * group/instance fold with the running tally, the templateId multi-instance
 * merge (the multi-instance interface), and the instance field pass-through
 * (lifecycle/status never re-derived; the pending badge is
 * completeness-aware per plan §7.3).
 *
 * P9-T5 (S3-C): fixtures build the vNext snapshot + ledger model inputs
 * (plan §8.4 mapping). The legacy "unbound row" vocabulary is abolished —
 * every snapshot instance is a real row (the CREATED lifecycle replaces the
 * absent bound session), so the legacy no-instance group case becomes a
 * created instance in its group.
 */
import { describe, expect, it } from 'vitest'
import type {
  TeamUiDisplayStatus, TeamUiLedgerModel, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
import { deriveTeamMembers } from '../src/model/team-members-model.js'

const LEADER = 'leader-s'
const A = 'a'
const B = 'b'

const iso = (ms: number): string => new Date(ms).toISOString()

const ZERO_CATEGORIES = {
  team: 0, member: 0, lifecycle: 0, message: 0, control: 0, policy: 0, compatibility: 0, progress: 0,
} as const

/** The §7.2 display → raw lifecycle pairing for fixture rows. */
const LIFECYCLE: Record<TeamUiDisplayStatus, TeamUiMemberInstance['lifecycle']> = {
  created: 'CREATED',
  running: 'RUNNING',
  settled: 'SETTLED',
  archived: 'ARCHIVED',
  disposed: 'DISPOSED',
}

function snapshot(members: readonly TeamUiMemberInstance[], overrides: Partial<TeamUiSnapshot> = {}): TeamUiSnapshot {
  return {
    teamSessionId: LEADER,
    generation: 1,
    blueprint: { blueprintId: 'bp-1', revision: '1', contentHash: 'h-1' },
    perspective: { kind: 'team-root' },
    templates: [
      { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
      { kind: 'member', templateId: `tpl-${A}`, displayName: A, contextPolicy: 'persistent' },
      { kind: 'member', templateId: `tpl-${B}`, displayName: B, contextPolicy: 'persistent' },
    ],
    members,
    compatibility: {
      status: 'OPEN', probeGeneration: 1, requirementFingerprint: 'rf-1', environmentFingerprint: 'ef-1',
      warningCount: 0, fatalCount: 0, acknowledgedWarningCount: 0,
    },
    policyState: 'open',
    ledgerSummary: { latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 0 },
    activity: [],
    disposedHistory: [],
    ...overrides,
  } as unknown as TeamUiSnapshot
}

function instance(
  overrides: Partial<TeamUiMemberInstance> & Pick<TeamUiMemberInstance, 'instanceId' | 'templateId' | 'label'>,
): TeamUiMemberInstance {
  return {
    childSessionId: null,
    lifecycle: 'CREATED',
    displayStatus: 'created',
    liveActivity: null,
    pendingControlCount: null,
    fromHistory: false,
    createdAt: iso(1_700_000_000_000),
    ...overrides,
  } as unknown as TeamUiMemberInstance
}

function ledger(overrides: Partial<TeamUiLedgerModel> = {}): TeamUiLedgerModel {
  return {
    completeness: 'partial',
    entries: [],
    controls: [],
    messages: [],
    intervals: [],
    progress: [],
    pendingControlByInstance: {},
    ...overrides,
  } as unknown as TeamUiLedgerModel
}

function leaderInstance(status: TeamUiDisplayStatus = 'created', childSessionId: string = LEADER): TeamUiMemberInstance {
  return instance({
    instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead',
    childSessionId, lifecycle: LIFECYCLE[status], displayStatus: status,
  })
}

function mate(id: string, status: TeamUiDisplayStatus, childSessionId?: string): TeamUiMemberInstance {
  return instance({
    instanceId: id, templateId: `tpl-${id}`, label: id,
    ...(childSessionId === undefined ? {} : { childSessionId }),
    lifecycle: LIFECYCLE[status], displayStatus: status,
  })
}

describe('deriveTeamMembers', () => {
  it('builds the leading leader row from the leader-kind instance and keeps it out of the groups', () => {
    const model = deriveTeamMembers(
      snapshot([leaderInstance('running'), mate(A, 'created', 'sa')]),
      ledger({ completeness: 'complete' }),
    )
    expect(model.leader).toEqual({
      templateId: 'tpl-lead',
      name: 'Lead',
      role: 'leader',
      activeCount: 1,
      instances: [{
        key: 'lead:leader-s:0',
        childSessionId: LEADER,
        label: 'Lead',
        lifecycle: 'RUNNING',
        status: 'running',
        pendingControlCount: 0,
        fromHistory: false,
      }],
    })
    // UI §16.1/§17.1 (P9 bug #5): the template rows are CONSTANT — a
    // zero-instance member template keeps its fixed row (the §17 "+"
    // first-instance entry must exist before any instance does).
    expect(model.groups.map(group => group.templateId)).toEqual([`tpl-${A}`, `tpl-${B}`])
  })

  it('keeps a created leader instance out of the running tally', () => {
    const model = deriveTeamMembers(
      snapshot([leaderInstance('created'), mate(A, 'running', 'sa')]),
      ledger({ completeness: 'complete' }),
    )
    expect(model.leader.activeCount).toBe(0)
    expect(model.leader.instances).toHaveLength(1)
    expect(model.leader.instances[0]?.status).toBe('created')
    expect(model.groups[0]?.activeCount).toBe(1)
  })

  it('synthesizes the leading row from the team session when the instances carry no leader kind', () => {
    const model = deriveTeamMembers(snapshot([mate(A, 'running', 'sa')]), ledger())
    expect(model.leader).toEqual({
      templateId: LEADER,
      role: 'leader',
      activeCount: 0,
      instances: [],
    })
    expect(model.leader.name).toBeUndefined()
    // UI §16.1/§17.1 (P9 bug #5): both member templates keep their rows.
    expect(model.groups.map(group => group.templateId)).toEqual([`tpl-${A}`, `tpl-${B}`])
  })

  it('tallies the container row per running instance, including a multi-instance member', () => {
    const model = deriveTeamMembers(
      snapshot([
        leaderInstance(),
        mate(A, 'running', 'sa1'),
        mate(A, 'running', 'sa2'),
        mate(A, 'settled', 'sa3'),
      ]),
      ledger({ completeness: 'complete' }),
    )
    const group = model.groups[0]
    expect(group?.activeCount).toBe(2)
    expect(group?.instances.map(instanceRow => instanceRow.childSessionId)).toEqual(['sa1', 'sa2', 'sa3'])
    expect(group?.instances.map(instanceRow => instanceRow.key)).toEqual([
      'a:sa1:0', 'a:sa2:1', 'a:sa3:2',
    ])
  })

  it('keeps a created instance in its group (the unbound vocabulary is abolished)', () => {
    const model = deriveTeamMembers(
      snapshot([leaderInstance(), mate(B, 'created')]),
      ledger({ completeness: 'complete' }),
    )
    expect(model.groups[0]).toEqual({
      templateId: `tpl-${B}`,
      name: B,
      role: 'teammate',
      activeCount: 0,
      instances: [{
        key: 'b::0',
        childSessionId: '',
        label: B,
        lifecycle: 'CREATED',
        status: 'created',
        pendingControlCount: 0,
        fromHistory: false,
      }],
    })
  })

  it('leaves the pending badge unknown under a partial ledger and zero when none are pending', () => {
    const partial = deriveTeamMembers(
      snapshot([leaderInstance('created'), mate(A, 'running', 'sa')]),
      ledger({ completeness: 'partial' }),
    )
    expect(partial.leader.instances[0]?.pendingControlCount).toBeNull()
    expect(partial.groups[0]?.instances[0]?.pendingControlCount).toBeNull()

    const complete = deriveTeamMembers(
      snapshot([leaderInstance('created'), mate(A, 'running', 'sa')]),
      ledger({ completeness: 'complete' }),
    )
    expect(complete.leader.instances[0]?.pendingControlCount).toBe(0)
    expect(complete.groups[0]?.instances[0]?.pendingControlCount).toBe(0)
  })

  it('passes the instance fields through untouched (lifecycle, status, action, pending count, child session)', () => {
    const model = deriveTeamMembers(
      snapshot([
        leaderInstance(),
        instance({
          instanceId: B, templateId: `tpl-${B}`, label: B,
          childSessionId: 'sb', currentAction: 'Bash',
          lifecycle: 'RUNNING', displayStatus: 'running',
        }),
      ]),
      ledger({ completeness: 'complete', pendingControlByInstance: { [B]: 2 } }),
    )
    expect(model.groups[0]?.instances).toEqual([{
      key: 'b:sb:0',
      childSessionId: 'sb',
      label: B,
      lifecycle: 'RUNNING',
      status: 'running',
      currentAction: 'Bash',
      pendingControlCount: 2,
      fromHistory: false,
    }])
    const plain = deriveTeamMembers(
      snapshot([leaderInstance(), mate(A, 'created', 'sa')]),
      ledger({ completeness: 'complete' }),
    )
    expect(plain.groups[0]?.instances[0]).toEqual({
      key: 'a:sa:0',
      childSessionId: 'sa',
      label: A,
      lifecycle: 'CREATED',
      status: 'created',
      pendingControlCount: 0,
      fromHistory: false,
    })
    expect(plain.groups[0]?.instances[0]?.currentAction).toBeUndefined()
  })

  it('folds a second leader-kind instance into the leading group (multi-instance interface)', () => {
    const model = deriveTeamMembers(
      snapshot([
        leaderInstance('running', LEADER),
        instance({
          instanceId: 'lead2', templateId: 'tpl-lead', label: 'Lead',
          childSessionId: 'leader-s2', lifecycle: 'SETTLED', displayStatus: 'settled',
        }),
      ]),
      ledger({ completeness: 'complete' }),
    )
    expect(model.leader.activeCount).toBe(1)
    expect(model.leader.instances.map(instanceRow => instanceRow.childSessionId)).toEqual([LEADER, 'leader-s2'])
    expect(model.leader.instances.map(instanceRow => instanceRow.key)).toEqual([
      'lead:leader-s:0', 'lead2:leader-s2:1',
    ])
    // UI §16.1/§17.1 (P9 bug #5): no member instances → the two member
    // templates keep their zero-instance fixed rows.
    expect(model.groups.map(group => group.templateId)).toEqual([`tpl-${A}`, `tpl-${B}`])
  })

  it('synthesizes an empty leader group for a snapshot with no member instances at all', () => {
    const model = deriveTeamMembers(snapshot([]), ledger())
    expect(model.leader).toEqual({
      templateId: LEADER,
      role: 'leader',
      activeCount: 0,
      instances: [],
    })
    // UI §16.1/§17.1 (P9 bug #5): every declared member template carries a
    // fixed zero-instance row (empty, teammate role).
    expect(model.groups.map(group => group.templateId)).toEqual([`tpl-${A}`, `tpl-${B}`])
    expect(model.groups.every(group => group.activeCount === 0 && group.instances.length === 0)).toBe(true)
  })

  it('keeps the groups in members order with a mid-list leader-kind instance', () => {
    const model = deriveTeamMembers(
      snapshot([mate(A, 'created', 'sa'), leaderInstance(), mate(B, 'created')]),
      ledger(),
    )
    expect(model.groups.map(group => group.templateId)).toEqual([`tpl-${A}`, `tpl-${B}`])
    expect(model.leader.templateId).toBe('tpl-lead')
  })
})
