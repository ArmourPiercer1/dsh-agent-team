/**
 * p8s7r2-disposed-history.test.ts — R2-6 (P8-S7-R2, D14): the DISPOSED
 * retained-history digest of the v2 TeamProjection (plan §21 BQ-04;
 * coverage matrix UI-D14 / UI-I15: history retained after dispose,
 * discoverable as a bounded bundle).
 *
 * The repair is an ADDITIVE DURATIONAL-optional top-level key
 * (`disposedHistory?`) on the v2 projection: ABSENT when the team has no
 * DISPOSED member (the default projection stays field-identical to the
 * frozen v1 shape), PRESENT exactly when at least one DISPOSED member row
 * exists. Each bundle digests the member's attributed share of the root
 * ledger (per-category counts over the eight frozen categories + the
 * first/last attributed sequence — the client's navigation span into
 * `team.getLedgerPage`) and anchors the timeline (durable creation stamp +
 * the latest durable `to: 'DISPOSED'` stamp, ABSENT when not derivable).
 *
 * The world is driven at module top level through the PRODUCTION read port
 * (`createTeamDomainReadPort`) over a fake TeamDomain — the port is the
 * ONLY producer of the source, and the fold (`projectTeam`) passes the
 * bundle through unchanged. The plain-node shim forbids async `it()`
 * bodies, so every fact below is computed before the suite runs.
 *
 * Attributed facts of the fixture (root `session-p8s7r2dh`): a member is
 * attributed the CLOSED addressing keys
 * {instanceId, targetInstanceId, recipientInstanceId,
 * deliveredToInstanceId} — a fact is counted ONCE per member (the first
 * matching key decides), team-level facts (no instance key) are never
 * attributed, and entries of other roots are excluded by the shared
 * root-filtered list (the SAME list the ledger summary consumes — the
 * repair adds no repository read).
 *
 *   C6.1 — the bundle is present with one entry per DISPOSED row, in the
 *          durable member row order (dh1, then dh2);
 *   C6.2 — the dh1 entry is EXACT: identity (incl. the optional groupId),
 *          the durable createdAt, disposedAt = the latest to-DISPOSED
 *          stamp, factCount 9, byCategory summing to factCount over the
 *          eight frozen categories, and the attributed sequence span
 *          (2..10 — the other-root entry 13 and the leader-addressed
 *          facts stay out);
 *   C6.3 — the dh2 entry is EXACT for a ZERO-fact member: factCount 0,
 *          all-zero byCategory, and the firstSequence / lastSequence /
 *          disposedAt / groupId keys ABSENT (missing keys, never
 *          own-undefined);
 *   C6.4 — the no-DISPOSED world: the key is ABSENT, and the v2
 *          projection is field-identical to the v1 projection of the same
 *          source apart from the schemaVersion stamp (byte-identity of
 *          the default projection);
 *   C6.5 — v1 REJECTS the key (MALFORMED_DTO, unknownFields =
 *          ['disposedHistory']); the v2 bundle survives a serialize /
 *          deserialize round-trip unchanged;
 *   C6.6 — the cross-field invariants fail closed on the frozen reasons:
 *          an entry for a non-DISPOSED member, incomplete DISPOSED
 *          coverage, an empty array, and a duplicate instanceId;
 *   C6.7 — the attribution closure: the team-level policy fact is
 *          counted in no bundle, the leader-addressed message enters no
 *          bundle, the dual-addressed coordination fact is counted
 *          exactly once (for its target), and the other-root entry is
 *          excluded from every digest.
 */
import { describe, expect, it } from 'vitest'
import {
  MEMBER_LIFECYCLE_STATES,
  deserializeTeamProjection,
  isTeamContractError,
  parseRootSessionId,
  parseTeamProjection,
  serializeTeamProjection,
} from '../../contracts/src/index.js'
import type { TeamProjectionDto } from '../../contracts/src/index.js'
import { projectTeam } from '../projection/fold.js'
import { createTeamDomainReadPort } from '../src/plugin/projection-source.js'

const ROOT_SID = 'session-p8s7r2dh'
const OTHER_ROOT_SID = 'session-otherroot'
const FIXED_NOW = '2026-08-02T01:00:00.000Z'

const LEADER_ID = 'inst-leader'
const WORKER_ID = 'inst-c6worker'
const DH1_ID = 'inst-c6dh1'
const DH2_ID = 'inst-c6dh2'
const T_DISPOSED_DH1 = '2026-08-02T00:14:00.000Z'

// --- the fake durable TeamDomain ----------------------------------------------------

/** The v1 TeamSessionRecordDto (identity core only — the closed field set). */
const teamRow = {
  schemaVersion: 1,
  rootSessionId: ROOT_SID,
  blueprint: {
    blueprintId: 'P8S7R2DH-BP',
    revision: '1',
    contentHash: 'sha256:c6e0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0',
  },
  defaultWorkspace: 'C:/agent-team/work/p8s7r2dh',
  createdAt: '2026-08-01T00:00:00.000Z',
  generation: 1,
}

/** One durable member row (the fakes bypass the storage parser). */
const leaderRow = {
  schemaVersion: 1,
  rootSessionId: ROOT_SID,
  instanceId: LEADER_ID,
  templateId: 'leader',
  label: 'c6-leader',
  createdAt: '2026-08-01T00:00:00.000Z',
}
const workerRow = {
  schemaVersion: 1,
  rootSessionId: ROOT_SID,
  instanceId: WORKER_ID,
  templateId: 'worker',
  label: 'c6-worker',
  childSessionId: 'session-child-c6w',
  lifecycle: MEMBER_LIFECYCLE_STATES.RUNNING,
  createdAt: '2026-08-02T00:00:00.000Z',
}
const dh1Row = {
  schemaVersion: 1,
  rootSessionId: ROOT_SID,
  instanceId: DH1_ID,
  templateId: 'worker',
  label: 'c6-disposed-1',
  childSessionId: 'session-child-dh1',
  lifecycle: MEMBER_LIFECYCLE_STATES.DISPOSED,
  groupId: 'grp-c6',
  createdAt: '2026-08-02T00:00:00.000Z',
}
const dh2Row = {
  schemaVersion: 1,
  rootSessionId: ROOT_SID,
  instanceId: DH2_ID,
  templateId: 'scout',
  label: 'c6-disposed-2',
  childSessionId: 'session-child-dh2',
  lifecycle: MEMBER_LIFECYCLE_STATES.DISPOSED,
  createdAt: '2026-08-03T00:00:00.000Z',
}

function entry(
  sequence: number,
  rootSessionId: string,
  factType: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sequence,
    rootSessionId,
    factType,
    payload,
    operationId: null,
    createdAt: '2026-08-02T00:00:00.000Z',
  }
}

/** The root ledger (12 entries of the fixture root + 1 other-root entry). */
const ROOT_ENTRIES: readonly Record<string, unknown>[] = [
  entry(1, ROOT_SID, 'policy-state-transitioned', {
    from: 'default',
    to: 'strict',
    at: '2026-08-01T12:00:00.000Z',
    requestToken: 'tok-policy',
  }),
  entry(2, ROOT_SID, 'provision-member-instance', {
    instanceId: DH1_ID,
    templateId: 'worker',
    childSessionId: 'session-child-dh1',
    groupId: 'grp-c6',
    at: '2026-08-02T00:00:00.000Z',
    requestToken: 'tok-prov',
  }),
  entry(3, ROOT_SID, 'member-lifecycle-changed', {
    instanceId: DH1_ID,
    from: 'CREATED',
    to: 'RUNNING',
    action: 'start',
    caller: LEADER_ID,
    at: '2026-08-02T00:05:00.000Z',
    requestToken: 'tok-start',
  }),
  entry(4, ROOT_SID, 'team-work-admitted', {
    action: 'delegate',
    caller: LEADER_ID,
    targetInstanceId: DH1_ID,
    childSessionId: 'session-child-dh1',
    fromLifecycle: 'CREATED',
    lifecycleCommitted: true,
    at: '2026-08-02T00:10:00.000Z',
    requestToken: 'tok-del',
  }),
  entry(5, ROOT_SID, 'activity-interval-opened', {
    instanceId: DH1_ID,
    reason: 'work-started',
    at: '2026-08-02T00:10:30.000Z',
    requestToken: 'tok-act',
  }),
  entry(6, ROOT_SID, 'team-message-delivered', {
    deliveredToInstanceId: DH1_ID,
    recipientInstanceId: DH1_ID,
    subject: 'status',
    at: '2026-08-02T00:11:00.000Z',
    requestToken: 'tok-msg',
  }),
  entry(7, ROOT_SID, 'team-coordination-recorded', {
    action: 'send-message',
    caller: LEADER_ID,
    targetInstanceId: DH1_ID,
    recipientInstanceId: LEADER_ID,
    subject: 'question',
    at: '2026-08-02T00:12:00.000Z',
    requestToken: 'tok-coord',
  }),
  entry(8, ROOT_SID, 'member-lifecycle-changed', {
    instanceId: DH1_ID,
    from: 'RUNNING',
    to: 'ARCHIVED',
    action: 'archive',
    caller: LEADER_ID,
    at: '2026-08-02T00:13:00.000Z',
    requestToken: 'tok-arch',
  }),
  entry(9, ROOT_SID, 'member-lifecycle-changed', {
    instanceId: DH1_ID,
    from: 'ARCHIVED',
    to: MEMBER_LIFECYCLE_STATES.DISPOSED,
    action: 'dispose',
    caller: LEADER_ID,
    at: T_DISPOSED_DH1,
    requestToken: 'tok-disp',
  }),
  entry(10, ROOT_SID, 'control-request-recorded', {
    targetInstanceId: DH1_ID,
    requestId: 'req-c6-1',
    at: '2026-08-02T00:15:00.000Z',
    requestToken: 'tok-ctrl',
  }),
  entry(11, ROOT_SID, 'team-message-delivered', {
    deliveredToInstanceId: LEADER_ID,
    recipientInstanceId: LEADER_ID,
    subject: 'report',
    at: '2026-08-02T00:16:00.000Z',
    requestToken: 'tok-msg2',
  }),
  entry(12, ROOT_SID, 'team-work-admitted', {
    action: 'delegate',
    caller: LEADER_ID,
    targetInstanceId: WORKER_ID,
    childSessionId: 'session-child-c6w',
    fromLifecycle: 'CREATED',
    lifecycleCommitted: true,
    at: '2026-08-02T00:17:00.000Z',
    requestToken: 'tok-del2',
  }),
  // The other-root entry: if the root filter leaked, dh1's digest would
  // gain a `team` fact and its span would stretch to sequence 13.
  entry(13, OTHER_ROOT_SID, 'team-work-admitted', {
    action: 'delegate',
    caller: 'inst-other',
    targetInstanceId: DH1_ID,
    childSessionId: 'session-child-dh1',
    fromLifecycle: 'CREATED',
    lifecycleCommitted: true,
    at: '2026-08-02T00:18:00.000Z',
    requestToken: 'tok-other',
  }),
]

const FIXED_TEMPLATES: readonly Record<string, unknown>[] = [
  { kind: 'leader', templateId: 'leader', displayName: 'Leader', contextPolicy: 'persistent' },
  { kind: 'member', templateId: 'worker', displayName: 'Worker', contextPolicy: 'persistent' },
  {
    kind: 'member',
    templateId: 'scout',
    displayName: 'Scout',
    contextPolicy: 'fresh_per_delegation',
  },
]

function readSource(
  rows: readonly Record<string, unknown>[],
  entries: readonly Record<string, unknown>[],
) {
  const repositories = {
    teamSessions: { get: () => teamRow },
    memberInstances: { list: () => rows },
    compatibility: { get: () => undefined },
    ledger: { list: () => entries },
  }
  const domain = { name: 'c6-domain', repositories }
  const port = createTeamDomainReadPort(domain as never, {
    templates: () => FIXED_TEMPLATES as never,
    policyState: () => 'default',
  })
  return port.readProjectionSource(parseRootSessionId(ROOT_SID))
}

const disposedSource = readSource([leaderRow, workerRow, dh1Row, dh2Row], ROOT_ENTRIES)
const noDisposedSource = readSource([leaderRow, workerRow], ROOT_ENTRIES)

const disposedProjection: TeamProjectionDto = projectTeam(disposedSource, null, FIXED_NOW, 2)
const noDisposedProjection: TeamProjectionDto = projectTeam(noDisposedSource, null, FIXED_NOW, 2)
const noDisposedProjectionV1: TeamProjectionDto = projectTeam(
  noDisposedSource,
  null,
  FIXED_NOW,
  1,
)

/** The v2 record as the wire would carry it (canonical JSON -> plain record). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
const v2Record: Record<string, any> = JSON.parse(
  serializeTeamProjection(disposedProjection),
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function v2With(mutate: (record: Record<string, any>) => void): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const record = JSON.parse(JSON.stringify(v2Record)) as Record<string, any>
  mutate(record)
  return record
}

/** Assert a `MALFORMED_DTO` contract error carrying `details.reason`. */
function expectMalformedWithReason(fn: () => unknown, reason: string): void {
  let captured: unknown
  try {
    fn()
  } catch (err) {
    captured = err
  }
  if (captured === undefined) {
    throw new Error(`expected MALFORMED_DTO(reason=${reason}) but nothing was thrown`)
  }
  if (!isTeamContractError(captured)) {
    throw new Error(
      `expected a TeamContractError but got: ${captured instanceof Error ? captured.message : String(captured)}`,
    )
  }
  if (captured.code !== 'MALFORMED_DTO') {
    throw new Error(`expected MALFORMED_DTO but got ${captured.code}`)
  }
  const actual = captured.details === undefined ? undefined : captured.details['reason']
  if (actual !== reason) {
    throw new Error(`expected details.reason '${reason}' but got ${JSON.stringify(actual)}`)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function bundleOf(instanceId: string): Record<string, any> {
  const bundle = disposedProjection.disposedHistory
  if (bundle === undefined) {
    throw new Error('disposedHistory is absent on the DISPOSED-world projection')
  }
  const found = bundle.find((entry) => entry.instanceId === instanceId)
  if (found === undefined) {
    throw new Error(`no bundle for member '${instanceId}'`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  return found as unknown as Record<string, any>
}

// --- C6.1 / C6.2 / C6.3 — the digest content -----------------------------------------

describe('p8s7r2 disposed history (R2-6)', () => {
  it('C6.1 the bundle carries one entry per DISPOSED row, in the durable row order', () => {
    expect('disposedHistory' in disposedProjection).toBe(true)
    const bundle = disposedProjection.disposedHistory
    if (bundle === undefined) throw new Error('disposedHistory absent')
    expect(bundle.length).toBe(2)
    expect(bundle.map((entry) => entry.instanceId)).toEqual([DH1_ID, DH2_ID])
  })

  it('C6.2 the dh1 bundle is exact: identity, timeline, the attributed digest', () => {
    expect(bundleOf(DH1_ID)).toEqual({
      instanceId: DH1_ID,
      label: 'c6-disposed-1',
      templateId: 'worker',
      childSessionId: 'session-child-dh1',
      groupId: 'grp-c6',
      createdAt: '2026-08-02T00:00:00.000Z',
      disposedAt: T_DISPOSED_DH1,
      factCount: 9,
      byCategory: {
        team: 1,
        member: 1,
        lifecycle: 3,
        message: 2,
        control: 1,
        policy: 0,
        compatibility: 0,
        progress: 1,
      },
      firstSequence: 2,
      lastSequence: 10,
    })
  })

  it('C6.3 the zero-fact dh2 bundle has the span and stamp keys ABSENT', () => {
    expect(bundleOf(DH2_ID)).toEqual({
      instanceId: DH2_ID,
      label: 'c6-disposed-2',
      templateId: 'scout',
      childSessionId: 'session-child-dh2',
      createdAt: '2026-08-03T00:00:00.000Z',
      factCount: 0,
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
    })
  })
})

// --- C6.4 — the no-DISPOSED world: byte-identity of the default projection -----------

describe('p8s7r2 disposed history absence (R2-6)', () => {
  it('C6.4 without DISPOSED members the key is absent and v2 equals v1', () => {
    expect('disposedHistory' in noDisposedProjection).toBe(false)
    // Field-identity apart from the version stamp: the additive key must
    // not change ANY other part of the default projection.
    const strip = (projection: TeamProjectionDto): Record<string, unknown> => {
      const record = { ...projection } as Record<string, unknown>
      delete record['schemaVersion']
      return record
    }
    expect(strip(noDisposedProjection)).toEqual(strip(noDisposedProjectionV1))
    // The surrounding surface stays intact.
    expect(noDisposedProjection.teamSessionId).toBe(ROOT_SID)
    expect(noDisposedProjection.generation).toBe(1)
    expect(noDisposedProjection.members.length).toBe(2)
    expect(noDisposedProjection.ledger.totalEntries).toBe(12)
    expect(noDisposedProjection.ledger.latestSequence).toBe(12)
  })
})

// --- C6.5 — the frozen wire rules ------------------------------------------------------

describe('p8s7r2 disposed history wire rules (R2-6)', () => {
  it('C6.5 v1 rejects the key; the v2 bundle round-trips through the wire', () => {
    const v1Record = JSON.parse(
      serializeTeamProjection(noDisposedProjectionV1),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    ) as Record<string, any>
    v1Record['disposedHistory'] = []
    let captured: unknown
    try {
      parseTeamProjection(v1Record)
    } catch (err) {
      captured = err
    }
    if (captured === undefined) {
      throw new Error('expected v1 with the disposedHistory key to throw')
    }
    if (!isTeamContractError(captured) || captured.code !== 'MALFORMED_DTO') {
      throw new Error('expected MALFORMED_DTO for the v1 key')
    }
    expect(captured.details?.['unknownFields']).toEqual(['disposedHistory'])

    // The valid v2 base round-trips, and the reparse is identity.
    expect(parseTeamProjection(v2Record)).toEqual(disposedProjection)
    expect(deserializeTeamProjection(serializeTeamProjection(disposedProjection))).toEqual(
      disposedProjection,
    )
  })
})

// --- C6.6 — the cross-field invariants -------------------------------------------------

describe('p8s7r2 disposed history cross-field invariants (R2-6)', () => {
  it('C6.6 an entry for a non-DISPOSED member is rejected', () => {
    const record = v2With((base) => {
      base['disposedHistory'].push({
        instanceId: WORKER_ID,
        label: 'c6-worker',
        templateId: 'worker',
        childSessionId: 'session-child-c6w',
        createdAt: '2026-08-02T00:00:00.000Z',
        factCount: 1,
        byCategory: {
          team: 1,
          member: 0,
          lifecycle: 0,
          message: 0,
          control: 0,
          policy: 0,
          compatibility: 0,
          progress: 0,
        },
        firstSequence: 12,
        lastSequence: 12,
      })
    })
    expectMalformedWithReason(() => parseTeamProjection(record), 'DISPOSED_HISTORY_UNKNOWN_INSTANCE')
  })

  it('C6.6 incomplete DISPOSED coverage is rejected', () => {
    const record = v2With((base) => {
      base['disposedHistory'] = base['disposedHistory'].filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
        (entry: Record<string, any>) => entry.instanceId === DH1_ID,
      )
    })
    expectMalformedWithReason(() => parseTeamProjection(record), 'DISPOSED_HISTORY_INCOMPLETE')
  })

  it('C6.6 an empty bundle is rejected (presence implies non-emptiness)', () => {
    const record = v2With((base) => {
      base['disposedHistory'] = []
    })
    expectMalformedWithReason(() => parseTeamProjection(record), 'DISPOSED_HISTORY_EMPTY')
  })

  it('C6.6 a duplicate instanceId is rejected', () => {
    const record = v2With((base) => {
      base['disposedHistory'].push(JSON.parse(JSON.stringify(base['disposedHistory'][0])))
    })
    expectMalformedWithReason(() => parseTeamProjection(record), 'DISPOSED_HISTORY_DUPLICATE_INSTANCE')
  })
})

// --- C6.7 — the attribution closure ------------------------------------------------------

describe('p8s7r2 disposed history attribution (R2-6)', () => {
  it('C6.7 unattributed facts, leader facts, and other-root entries stay out', () => {
    const dh1 = bundleOf(DH1_ID)
    const dh2 = bundleOf(DH2_ID)

    // The team-level policy fact (sequence 1, no instance key) is counted
    // in NO bundle.
    expect(dh1.byCategory.policy).toBe(0)
    expect(dh2.byCategory.policy).toBe(0)

    // The leader-addressed message (sequence 11) and the worker-admission
    // (sequence 12) enter no bundle: the combined message total is the two
    // dh1-addressed facts (sequences 6 and 7) and nothing else.
    const messageTotal =
      dh1.byCategory.message + dh2.byCategory.message
    expect(messageTotal).toBe(2)

    // The dual-addressed coordination fact (sequence 7: target dh1,
    // recipient leader) is counted EXACTLY ONCE — for its target dh1 —
    // pinned by dh1's exact message total of 2 and its span end at 10.
    expect(dh1.byCategory.message).toBe(2)
    expect(dh1.firstSequence).toBe(2)
    expect(dh1.lastSequence).toBe(10)

    // The other-root entry (sequence 13) would have stretched dh1's span
    // and bumped its `team` category — the exact digest rules it out.
    expect(dh1.byCategory.team).toBe(1)
    expect(dh1.factCount).toBe(9)

    // The digest invariant: every bundle's category counts sum to its
    // factCount (the eight frozen categories, no leaks).
    const sum = (category: Record<string, number>): number =>
      Object.values(category).reduce((acc, value) => acc + value, 0)
    expect(sum(dh1.byCategory as Record<string, number>)).toBe(dh1.factCount)
    expect(sum(dh2.byCategory as Record<string, number>)).toBe(dh2.factCount)
  })
})
