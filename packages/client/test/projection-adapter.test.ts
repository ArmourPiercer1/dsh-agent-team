/**
 * P9-T4 (S3-A / §7.1-§7.4) — the pure projection → UI snapshot adapter.
 *
 * Coverage (G3 gates + the §7 frozen mapping rules): `projectionFromWire`
 * is the single documented wire→DTO boundary (a plain 9-field D-4 mirror,
 * identity-stable, input never mutated); the §7.2 display mapping
 * (CREATED→created, RUNNING→running, SETTLED→settled, ARCHIVED→archived,
 * DISPOSED→disposed) with the RAW lifecycle kept alongside; the
 * `currentAction` presentation fallback (`liveActivity.currentAction`
 * first, then `activity.lastAction`, never inferred — absent stays
 * absent); the leader's absent `childSessionId` becomes `null` (nav
 * target: the root session); `pendingControlCount` is `null` at the
 * projection level (§7.3 — unknown until the ledger is known-complete);
 * the §7.4 current-work row is emitted only when at least one of
 * status / subject / summary / current-action exists (no invented rows);
 * the disposed history rows are merged into `members` (fromHistory,
 * lifecycle DISPOSED, liveActivity null) AND retained verbatim in
 * `disposedHistory`; identity is the instanceId — duplicate labels never
 * collide; the perspective is passed through by reference.
 *
 * Shim-constrained spec (run-tests.mjs): the adapter is pure and
 * synchronous, so every scenario runs inside the `it()` bodies.
 * Matchers used: toBe / toEqual (+ .not) only.
 */
import { describe, expect, it } from 'vitest'
import { adaptTeamProjection, projectionFromWire } from '../src/model/projection-adapter.js'
import type { TeamPerspective } from '../src/state/team-session-resolution.js'
import type { RemoteProjectionValue } from '../../remote/src/index.js'

/**
 * Test-only narrowing: a missing row means the fixture or the adapter
 * contract broke, so throw (the shim exposes no toBeDefined matcher, and a
 * silently `undefined` row would mask the assertions that follow).
 */
function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`missing: ${label}`)
  return value
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** One minimal wire member row (plain object — no branded ids at the wire level). */
function wireMember(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    instanceId: 'i1',
    templateId: 'tpl-1',
    label: 'Alpha',
    childSessionId: 'child-1',
    workspace: 'wsp',
    createdAt: '2026-08-29T00:00:00.000Z',
    lifecycle: 'RUNNING',
    contextPolicy: 'persistent',
    effectiveConfig: { model: 'm', workspace: 'wsp', permissions: {}, autonomy: 'full' },
    liveActivity: null,
    ...overrides,
  }
}

/** One minimal 9-field D-4 wire projection (the `RemoteProjectionValue` shape). */
function wireFrame(overrides: Record<string, unknown> = {}): RemoteProjectionValue {
  return {
    schemaVersion: 1,
    teamSessionId: 'team-1',
    blueprint: { blueprintId: 'bp-1', revision: 2, contentHash: 'sha-1' },
    generation: 7,
    generatedAt: '2026-08-29T00:00:00.000Z',
    root: {
      teamSessionId: 'team-1',
      createdAt: '2026-08-29T00:00:00.000Z',
      policyState: 'open',
      compatibility: {
        status: 'OPEN',
        probeGeneration: 1,
        requirementFingerprint: 'rf-1',
        environmentFingerprint: 'ef-1',
        warningCount: 0,
        fatalCount: 0,
        acknowledgedWarningCount: 0,
      },
      creationBudgetConsumed: true,
    },
    templates: [],
    members: [],
    ledger: {
      latestSequence: 0,
      totalEntries: 0,
      byCategory: {
        team: 0,
        member: 0,
        lifecycle: 0,
        message: 0,
        control: 0,
        policy: 0,
        compatibility: 0,
        progress: 0,
      },
      pendingControlCount: 0,
    },
    ...overrides,
  } as unknown as RemoteProjectionValue
}

const ROOT_PERSPECTIVE: TeamPerspective = { kind: 'team-root' }

// ---------------------------------------------------------------------------
// projectionFromWire — the boundary
// ---------------------------------------------------------------------------

describe('projectionFromWire — the single documented boundary', () => {
  it('mirrors the 9-field D-4 value shape (ids, generation, blueprint)', () => {
    const wire = wireFrame()
    const dto = projectionFromWire(wire)
    expect(dto.teamSessionId).toBe('team-1')
    expect(dto.generation).toBe(7)
    expect(dto.blueprint).toEqual({ blueprintId: 'bp-1', revision: 2, contentHash: 'sha-1' })
    expect(dto.members).toBe(wire.members as never)
  })

  it('never mutates the wire input (pure)', () => {
    const wire = wireFrame({ members: [wireMember()] })
    const before = JSON.stringify(wire)
    projectionFromWire(wire)
    expect(JSON.stringify(wire)).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// §7.2 — display status + currentAction fallback + leader childSession
// ---------------------------------------------------------------------------

describe('adaptTeamProjection — §7.2 display mapping', () => {
  it('maps every RAW lifecycle to its display status and keeps the RAW value', () => {
    const cases: Array<[string, string]> = [
      ['CREATED', 'created'],
      ['RUNNING', 'running'],
      ['SETTLED', 'settled'],
      ['ARCHIVED', 'archived'],
      ['DISPOSED', 'disposed'],
    ]
    const members = cases.map(([lifecycle, display], index) =>
      wireMember({
        instanceId: `i${index}`,
        label: `label-${lifecycle}`,
        lifecycle,
        childSessionId: `child-${index}`,
      }),
    )
    const snapshot = adaptTeamProjection(projectionFromWire(wireFrame({ members })), ROOT_PERSPECTIVE)
    for (const [index, [lifecycle, display]] of cases.entries()) {
      const row = must(snapshot.members[index], 'member row ' + index)
      expect(row.lifecycle).toBe(lifecycle)
      expect(row.displayStatus).toBe(display)
    }
  })

  it('currentAction prefers the live activity action over the durable last action', () => {
    const snapshot = adaptTeamProjection(
      projectionFromWire(
        wireFrame({
          members: [
            wireMember({
              instanceId: 'i-live',
              liveActivity: { residency: 'resident', currentAction: 'git:push', lastActivityAt: '2026-08-29T00:01:00.000Z' },
              activity: { lastAction: 'durable:action' },
            }),
          ],
        }),
      ),
      ROOT_PERSPECTIVE,
    )
    expect(must(snapshot.members[0], 'member row 0').currentAction).toBe('git:push')
  })

  it('currentAction falls back to the durable last action when no live action exists', () => {
    const snapshot = adaptTeamProjection(
      projectionFromWire(
        wireFrame({
          members: [wireMember({ instanceId: 'i-fallback', liveActivity: null, activity: { lastAction: 'durable:action' } })],
        }),
      ),
      ROOT_PERSPECTIVE,
    )
    expect(must(snapshot.members[0], 'member row 0').currentAction).toBe('durable:action')
  })

  it('currentAction stays ABSENT when neither source has an action (never inferred)', () => {
    const snapshot = adaptTeamProjection(
      projectionFromWire(
        wireFrame({ members: [wireMember({ instanceId: 'i-quiet', liveActivity: { residency: 'cold' }, activity: { status: 'in-progress' } })] }),
      ),
      ROOT_PERSPECTIVE,
    )
    const row = must(snapshot.members[0], 'member row 0')
    expect('currentAction' in row).toBe(false)
  })

  it('the leader (absent childSessionId) gets null — the nav target is the root session', () => {
    const leader = { ...wireMember({ instanceId: 'i-leader', label: 'Leader' }) }
    delete leader['childSessionId']
    const snapshot = adaptTeamProjection(
      projectionFromWire(wireFrame({ members: [leader, wireMember({ instanceId: 'i-child' })] })),
      ROOT_PERSPECTIVE,
    )
    expect(must(snapshot.members[0], 'member row 0').childSessionId).toBe(null)
    expect(must(snapshot.members[1], 'member row 1').childSessionId).toBe('child-1')
  })
})

// ---------------------------------------------------------------------------
// §7.3 / §7.4 — badges stay unknown; current-work rows only from real facts
// ---------------------------------------------------------------------------

describe('adaptTeamProjection — §7.3 badges and §7.4 current work', () => {
  it('pendingControlCount is null for every live and history row at the projection level', () => {
    const snapshot = adaptTeamProjection(
      projectionFromWire(
        wireFrame({
          members: [wireMember({ instanceId: 'i1' })],
          disposedHistory: [{ instanceId: 'i9', templateId: 'tpl-1', label: 'gone', childSessionId: 'child-9', createdAt: '2026-08-29T00:00:00.000Z', factCount: 0, byCategory: {} }],
        }),
      ),
      ROOT_PERSPECTIVE,
    )
    for (const row of snapshot.members) expect(row.pendingControlCount).toBe(null)
  })

  it('emits a current-work row only when at least one work fact exists (no invented rows)', () => {
    const snapshot = adaptTeamProjection(
      projectionFromWire(
        wireFrame({
          members: [
            wireMember({ instanceId: 'i-none', liveActivity: null }),
            wireMember({ instanceId: 'i-subject', activity: { subject: 'building the thing' } }),
            wireMember({ instanceId: 'i-cold', liveActivity: { residency: 'cold' }, activity: {} }),
          ],
        }),
      ),
      ROOT_PERSPECTIVE,
    )
    expect(snapshot.activity.length).toBe(1)
    const row = must(snapshot.activity[0], 'activity row 0')
    expect(row.instanceId).toBe('i-subject')
    expect(row.subject).toBe('building the thing')
  })

  it('the current-work row carries the live fields only when present', () => {
    const snapshot = adaptTeamProjection(
      projectionFromWire(
        wireFrame({
          members: [
            wireMember({
              instanceId: 'i-full',
              activity: { status: 'in-progress', subject: 's', summary: 'sum', lastProgressAt: '2026-08-29T00:02:00.000Z' },
              liveActivity: { residency: 'resident', currentAction: 'act', lastActivityAt: '2026-08-29T00:03:00.000Z', runningSince: '2026-08-29T00:00:10.000Z' },
            }),
          ],
        }),
      ),
      ROOT_PERSPECTIVE,
    )
    const row = must(snapshot.activity[0], 'activity row 0')
    expect(row.status).toBe('in-progress')
    expect(row.currentAction).toBe('act')
    expect(row.lastProgressAt).toBe('2026-08-29T00:02:00.000Z')
    expect(row.lastActivityAt).toBe('2026-08-29T00:03:00.000Z')
    expect(row.runningSince).toBe('2026-08-29T00:00:10.000Z')
    expect('admittedWorkCorrelation' in row).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// G3 — history merge, identity, templates, perspective
// ---------------------------------------------------------------------------

describe('adaptTeamProjection — G3 roster rules', () => {
  it('merges the disposed history into members AND retains it verbatim', () => {
    const historyRow = {
      instanceId: 'i9',
      templateId: 'tpl-1',
      label: 'Gone',
      childSessionId: 'child-9',
      createdAt: '2026-08-29T00:00:00.000Z',
      disposedAt: '2026-08-29T01:00:00.000Z',
      factCount: 3,
      byCategory: { team: 3 },
    }
    const history = [historyRow]
    const wire = wireFrame({ members: [wireMember({ instanceId: 'i1' })], disposedHistory: history })
    const snapshot = adaptTeamProjection(projectionFromWire(wire), ROOT_PERSPECTIVE)
    expect(snapshot.members.length).toBe(2)
    const merged = must(snapshot.members[1], 'merged history row')
    expect(merged.instanceId).toBe('i9')
    expect(merged.fromHistory).toBe(true)
    expect(merged.lifecycle).toBe('DISPOSED')
    expect(merged.displayStatus).toBe('disposed')
    expect(merged.childSessionId).toBe('child-9')
    expect(merged.liveActivity).toBe(null)
    expect(merged.disposedAt).toBe('2026-08-29T01:00:00.000Z')
    expect('workspace' in merged).toBe(false)
    expect('activity' in merged).toBe(false)
    expect(must(snapshot.members[0], 'member row 0').fromHistory).toBe(false)
    expect(snapshot.disposedHistory).toBe(history)
  })

  it('identity is the instanceId: duplicate labels never collide', () => {
    const snapshot = adaptTeamProjection(
      projectionFromWire(
        wireFrame({
          members: [
            wireMember({ instanceId: 'i-a', label: 'Same Name', childSessionId: 'child-a' }),
            wireMember({ instanceId: 'i-b', label: 'Same Name', childSessionId: 'child-b' }),
          ],
        }),
      ),
      ROOT_PERSPECTIVE,
    )
    expect(snapshot.members.length).toBe(2)
    expect(must(snapshot.members[0], 'member row 0').instanceId).toBe('i-a')
    expect(must(snapshot.members[1], 'member row 1').instanceId).toBe('i-b')
  })

  it('templates map through with the optional leaves present only when set', () => {
    const snapshot = adaptTeamProjection(
      projectionFromWire(
        wireFrame({
          templates: [
            { kind: 'leader', templateId: 'tpl-l', displayName: 'Leader', contextPolicy: 'persistent', description: 'the lead', instanceQuota: 1 },
            { kind: 'member', templateId: 'tpl-m', displayName: 'Member', contextPolicy: 'fresh_per_delegation' },
          ],
        }),
      ),
      ROOT_PERSPECTIVE,
    )
    expect(snapshot.templates.length).toBe(2)
    const lead = must(snapshot.templates[0], 'template 0')
    expect(lead.description).toBe('the lead')
    expect(lead.instanceQuota).toBe(1)
    const second = must(snapshot.templates[1], 'template 1')
    expect('description' in second).toBe(false)
    expect('instanceQuota' in second).toBe(false)
  })

  it('the perspective is passed through by reference', () => {
    const perspective: TeamPerspective = { kind: 'member-child', memberInstanceId: 'i1' }
    const snapshot = adaptTeamProjection(projectionFromWire(wireFrame()), perspective)
    expect(snapshot.perspective).toBe(perspective)
    expect(snapshot.teamSessionId).toBe('team-1')
    expect(snapshot.generation).toBe(7)
    expect(snapshot.policyState).toBe('open')
    expect(snapshot.ledgerSummary.pendingControlCount).toBe(0)
  })

  it('multiple instances of one template stay separate rows (no template-keyed collapse)', () => {
    const wire = wireFrame({
      members: [
        wireMember({ instanceId: 'i-1', templateId: 'tpl-lead', childSessionId: 'child-1' }),
        wireMember({ instanceId: 'i-2', templateId: 'tpl-lead', childSessionId: 'child-2' }),
      ],
    })
    const snapshot = adaptTeamProjection(projectionFromWire(wire), ROOT_PERSPECTIVE)
    expect(snapshot.members.length).toBe(2)
    const first = must(snapshot.members[0], 'member row 0')
    const second = must(snapshot.members[1], 'member row 1')
    // Same templateId, distinct instanceIds: the roster is keyed by the
    // instanceId, never collapsed or de-duplicated per template.
    expect(first.instanceId).toBe('i-1')
    expect(second.instanceId).toBe('i-2')
    expect(first.templateId).toBe('tpl-lead')
    expect(second.templateId).toBe('tpl-lead')
    expect(first.childSessionId).toBe('child-1')
    expect(second.childSessionId).toBe('child-2')
  })

  it('groupId is an opaque passthrough: present verbatim only when set (invariant 20)', () => {
    const wire = wireFrame({
      members: [
        wireMember({ instanceId: 'i-g', groupId: 'grp-7' }),
        wireMember({ instanceId: 'i-plain' }),
      ],
    })
    const snapshot = adaptTeamProjection(projectionFromWire(wire), ROOT_PERSPECTIVE)
    const grouped = must(snapshot.members[0], 'member row 0')
    const plain = must(snapshot.members[1], 'member row 1')
    expect(grouped.groupId).toBe('grp-7')
    // Absent on the wire → absent on the row (never materialized to null/
    // ''/a placeholder — the client never interprets the opaque value).
    expect('groupId' in plain).toBe(false)
  })
})
