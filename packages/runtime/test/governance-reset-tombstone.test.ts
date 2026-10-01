/**
 * pre-alpha3 PR-A — GOVERNANCE RESET = TOMBSTONE (plan item 4): a reset
 * re-issues the slot at generation + 1 with EMPTY values (`values: {}`,
 * kind/origin preserved) — it NEVER deletes history (the frozen
 * one-record-per-slot re-issue ruling extended to the reset operation,
 * which used to be a direct storage delete in the demoted forked path).
 *
 * Pinned here:
 *
 * - T1 the tombstone shape: higher generation, empty values, kind/origin
 *   preserved; the full slot history remains in storage;
 * - T2 the tombstone winner contributes nothing to the merged read (the
 *   resolution-side `selectSlotWinner` sees the empty value set);
 * - T3 the deterministic tombstone recordId (`ovr-reset-<target>-g<gen>`)
 *   and the idempotent re-reset no-op;
 * - T4 the reset slot closure mirrors the set closure (member = own
 *   instance only — the reset half of the reset-hole authority closure);
 * - T5 the expectedGeneration guard applies to resets (stale -> conflict);
 * - R1 REAL STORAGE: the tombstone record passes the storage validator
 *   round trip (create -> put -> reopen -> list shows the full history
 *   with the tombstone intact — the audit's storage-legality check).
 *
 * The runner executes these files under plain Node: all async work runs
 * in the top-level block, the `it` bodies assert synchronously; the
 * scratch world is destroyed before the first assertion.
 *
 * @module @dsh-agent-team/runtime/test/governance-reset-tombstone
 */

import { describe, expect, it } from 'vitest'
import { createTeamDomain, openTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam, destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  createGovernanceMutationService,
  isMutationError,
  MUTATION_ERROR_CODES,
  selectSlotWinner,
  slotIdentityOf,
  type GovernanceMutationService,
  type GovernanceTransitionCache,
  type GovernanceTransitionCommit,
} from '../governance/index.js'
import type {
  OverrideRecordView,
  OverrideStorePort,
  PolicyReader,
  PolicyStateTransitionRecord,
} from '../mutation/index.js'
import { createMemberIdentity } from '../../domain/policy/src/index.js'
import type { MemberIdentity, PolicyEntry } from '../../domain/policy/src/index.js'
import { readEffectivePolicy } from '../effective-policy/index.js'
import type { GovernanceOverrideRecord } from '../../storage/schema/index.js'

const ROOT = 'session-gov-tombstone'
const NOW = '2026-09-29T00:00:00.000Z'
const alpha = createMemberIdentity(ROOT, 'inst-alpha')

class MemOverrides implements OverrideStorePort {
  readonly all: OverrideRecordView[] = []
  async list(rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return this.all.filter((record) => record.rootSessionId === rootSessionId)
  }
  async put(record: unknown): Promise<unknown> {
    this.all.push(record as OverrideRecordView)
    return record
  }
}

class MemTransitions implements GovernanceTransitionCache {
  appendTransition(_teamSessionId: string, _transition: PolicyStateTransitionRecord): void {}
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return []
  }
}

class MemCommit implements GovernanceTransitionCommit {
  async commit(
    _rootSessionId: string,
    _transition: PolicyStateTransitionRecord,
  ): Promise<void> {}
}

// The declared envelope: model allows m-a/m-b/m-x for the registered
// member (alpha) — the fail-closed default (no declared envelope = no
// agent allow) is pinned by the authority file; this world needs the
// member's allow writes to pass so the tombstone shape is observable.
const envelopePolicy: PolicyReader = {
  readBlueprintEnvelope: () => ({ autonomyEnvelope: { model: { kind: 'allow', items: ['m-a', 'm-b', 'm-x'] } } }),
  readTemplatePolicy: () => ({ mutationEnvelope: { model: { kind: 'allow', items: ['m-a', 'm-b', 'm-x'] } } }),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}

function makeService(overrides: OverrideStorePort): GovernanceMutationService {
  return createGovernanceMutationService({
    chain: createTeamOperationCoordinator(),
    overrides,
    transitions: new MemTransitions(),
    transitionCommit: new MemCommit(),
    policy: envelopePolicy,
    registeredMembers: () => Promise.resolve([alpha] as MemberIdentity[]),
    policyStates: () => ['default', 'strict'],
    now: () => NOW,
  })
}

const cells = (m: string): Record<string, PolicyEntry> => ({ model: { kind: 'allow', items: [m] } })

// ---------------------------------------------------------------------------
// T1/T2/T3: the tombstone shape, the merged read, the deterministic id
// ---------------------------------------------------------------------------
const t1Overrides = new MemOverrides()
const t = makeService(t1Overrides)
const t1seed1 = await t.setOverride({
  authority: { kind: 'member', instanceId: 'inst-alpha' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
  cells: cells('m-a'),
})
const t1seed2 = await t.setOverride({
  authority: { kind: 'member', instanceId: 'inst-alpha' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
  cells: { model: cells('m-b')['model'], mcp: { kind: 'deny' } } as Record<string, PolicyEntry>,
})
const t1reset = await t.resetOverride({
  authority: { kind: 'member', instanceId: 'inst-alpha' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
})
const t1reReset = await t.resetOverride({
  authority: { kind: 'member', instanceId: 'inst-alpha' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
})

// ---------------------------------------------------------------------------
// T4: the reset slot closure (the reset half of the authority closure)
// ---------------------------------------------------------------------------
const t4 = makeService(new MemOverrides())
const t4seed = await t4.setOverride({
  authority: { kind: 'member', instanceId: 'inst-alpha' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
  cells: cells('m-a'),
})
// member reset of the TEAM slot (no team record yet):
const t4memberTeamReset = await t4
  .resetOverride({
    authority: { kind: 'member', instanceId: 'inst-alpha' },
    rootSessionId: ROOT,
    scope: 'team',
  })
  .then(
    (value): { ok: true; value: Awaited<ReturnType<typeof t4.resetOverride>> } => ({ ok: true, value }),
    (error): { ok: false; error: Error } => ({ ok: false, error }),
  )
// member reset of ANOTHER instance's slot:
const t4foreignSeed = await t4.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-beta',
  cells: cells('m-x'),
})
const t4foreignReset = await t4
  .resetOverride({
    authority: { kind: 'member', instanceId: 'inst-alpha' },
    rootSessionId: ROOT,
    scope: 'instance',
    instanceId: 'inst-beta',
  })
  .then(
    (value): { ok: true; value: Awaited<ReturnType<typeof t4.resetOverride>> } => ({ ok: true, value }),
    (error): { ok: false; error: Error } => ({ ok: false, error }),
  )

// ---------------------------------------------------------------------------
// T5: the generation guard on reset
// ---------------------------------------------------------------------------
const t5 = makeService(new MemOverrides())
const t5seed = await t5.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: cells('m-a'),
})
const t5staleReset = await t5
  .resetOverride({
    authority: { kind: 'operator' },
    rootSessionId: ROOT,
    scope: 'team',
    expectedGeneration: 7,
  })
  .then(
    (value): { ok: true; value: Awaited<ReturnType<typeof t5.resetOverride>> } => ({ ok: true, value }),
    (error): { ok: false; error: Error } => ({ ok: false, error }),
  )
const t5freshReset = await t5.resetOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  expectedGeneration: 1,
})

// ---------------------------------------------------------------------------
// R1: the real-storage tombstone round trip
// ---------------------------------------------------------------------------
const r1Dir = scratchDir('gov-tombstone-r1')
destroyDir(r1Dir) // self-cleaning: a crashed prior run may leave a domain behind
const r1Seam = new FileStorageSeam(r1Dir)
const r1Domain = await createTeamDomain(r1Seam)
const r1Store: OverrideStorePort = {
  list: (rootSessionId) => Promise.resolve(r1Domain.repositories.overrides.list(rootSessionId)),
  put: (record) => r1Domain.repositories.overrides.put(record),
}
const r1 = makeService(r1Store)
const r1seed1 = await r1.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: cells('m-a'),
})
const r1seed2 = await r1.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { model: cells('m-b')['model'], skills: { kind: 'deny' } } as Record<string, PolicyEntry>,
})
const r1reset = await r1.resetOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
})
// RESTART: a NEW seam over the SAME dir (the durable rows survive).
const r1Seam2 = new FileStorageSeam(r1Dir)
const r1Domain2 = await openTeamDomain(r1Seam2)
const r1restartedList = r1Domain2.repositories.overrides.list(ROOT)
destroyDir(r1Dir)

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('PR-A governance reset — the tombstone (history-preserving)', () => {
  it('reset re-issues the slot at generation + 1 with empty values; nothing is deleted', () => {
    expect(t1seed1.changed).toBe(true)
    expect(t1seed2.changed).toBe(true)
    if (t1seed2.changed) expect(t1seed2.record.generation).toBe(2)

    expect(t1reset.removed).toBe(true)
    if (!t1reset.removed) throw new Error('reset not removed')
    const tombstone = t1reset.tombstone
    expect(tombstone.values).toEqual({})
    expect(tombstone.kind).toBe('autonomy-overlay')
    expect(tombstone.origin).toBe('member')
    expect(tombstone.scope).toBe('instance')
    expect(tombstone.instanceId).toBe('inst-alpha')
    expect(tombstone.generation).toBe(3)
    // The full slot history is intact (the reset NEVER deletes):
    // seed1 + re-issue + tombstone.
    expect(t1Overrides.all).toHaveLength(3)
  })

  it('the tombstone winner contributes nothing to the merged read', () => {
    const records = r1restartedList
    // R1's real storage view doubles as the merged-read evidence:
    // the winner is the tombstone (highest generation) with empty values.
    const teamSlot = slotIdentityOf({ kind: 'human-override', scope: 'team', origin: undefined }, ROOT)
    const winner = selectSlotWinner(records, teamSlot)
    expect(winner).not.toBeNull()
    if (winner === null) throw new Error('no winner')
    expect(Object.keys(winner.values)).toHaveLength(0)
    expect(winner.recordId).toBe('ovr-reset-team-g2')
  })

  it('the tombstone recordId is deterministic; a re-reset is a typed no-op', () => {
    expect(t1reset.removed).toBe(true)
    if (t1reset.removed) {
      // The slot winner was generation 2 -> the tombstone id pins it.
      expect(t1reset.tombstone.recordId).toBe('ovr-reset-inst-alpha-g2')
    }
    expect(t1reReset.removed).toBe(false)
    if (!t1reReset.removed) {
      expect(t1reReset.current).toBeTruthy()
      if (t1reReset.current) expect(t1reReset.current.recordId).toBe('ovr-reset-inst-alpha-g2')
    }
  })
})

describe('PR-A governance reset — the slot closure', () => {
  it('a member cannot reset the TEAM slot (typed rejection, the reset-hole closure)', () => {
    expect(t4seed.changed).toBe(true)
    expect(t4memberTeamReset.ok).toBe(false)
    if (!t4memberTeamReset.ok) {
      const error = t4memberTeamReset.error
      expect(isMutationError(error)).toBe(true)
      if (isMutationError(error)) expect(error.code).toBe(MUTATION_ERROR_CODES.UNAUTHORIZED_MUTATION)
    }
  })

  it('a member cannot reset ANOTHER instance slot (typed rejection)', () => {
    expect(t4foreignSeed.changed).toBe(true)
    expect(t4foreignReset.ok).toBe(false)
    if (!t4foreignReset.ok) {
      const error = t4foreignReset.error
      expect(isMutationError(error)).toBe(true)
      if (isMutationError(error)) expect(error.code).toBe(MUTATION_ERROR_CODES.UNAUTHORIZED_MUTATION)
    }
  })
})

describe('PR-A governance reset — the generation guard', () => {
  it('a stale expectedGeneration conflicts; the fresh guard resets', () => {
    expect(t5seed.changed).toBe(true)
    expect(t5staleReset.ok).toBe(false)
    if (!t5staleReset.ok) {
      const error = t5staleReset.error
      expect(isMutationError(error)).toBe(true)
      if (isMutationError(error)) {
        expect(error.code).toBe(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT)
      }
    }
    expect(t5freshReset.removed).toBe(true)
  })
})

describe('PR-A governance reset — the real-storage tombstone round trip', () => {
  it('the tombstone passes the storage validator: seed + re-issue + tombstone all survive the reopen', () => {
    expect(r1seed1.changed).toBe(true)
    expect(r1seed2.changed).toBe(true)
    expect(r1reset.removed).toBe(true)

    // The reopened domain lists the FULL slot history — the tombstone
    // (values: {}) is legal storage content and its winner status is
    // preserved (asserted in the merged-read case above).
    expect(r1restartedList).toHaveLength(3)
    const ids = r1restartedList.map((record) => record.recordId).sort()
    expect(ids).toEqual(['ovr-model+skills-team-g1', 'ovr-model-team-g0', 'ovr-reset-team-g2'])
    const tombstone = r1restartedList.find((record) => record.recordId === 'ovr-reset-team-g2')
    expect(tombstone).toBeTruthy()
    if (tombstone === undefined) throw new Error('tombstone missing after reopen')
    expect(tombstone.values).toEqual({})
    expect(tombstone.kind).toBe('human-override')
  })
})

// ---------------------------------------------------------------------------
// E-regression (fix/effective-policy-reset-fallback): the instance-slot
// RESET TOMBSTONE must not mask a still-effective TEAM human deny in the
// canonical read (the PR-B regression: the slot selector picked the
// tombstone row as the human-slot winner, the tombstone's empty value set
// contributed nothing, and the cell fell through to the template/static
// layer — a reset into ALLOW). Ruling: a slot whose LATEST event is a
// reset tombstone has NO effective value for that slot; precedence falls
// back to the team slot; an OLDER event of the SAME slot is never
// resurrected.
// ---------------------------------------------------------------------------

/** The static-facts authority for the canonical-read legs: the template
 *  grants the MCP server `srv/x` (the baseline ALLOW a human deny must
 *  beat); no blueprint values; no external restrictions. */
const eReader: PolicyReader = {
  readBlueprintEnvelope: () => ({}),
  readTemplatePolicy: () => ({ values: { mcp: { kind: 'allow', items: ['srv/x'] } } }),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}

/** One canonical read over the durable records (fresh, stateless — the
 *  canonical read is pure; each call re-reads the facts it is given). */
function eRead(overrides: readonly GovernanceOverrideRecord[]): ReturnType<typeof readEffectivePolicy> {
  return readEffectivePolicy({
    rootSessionId: ROOT,
    instanceId: 'inst-alpha',
    policy: eReader,
    transitions: [],
    overrides,
  })
}

// The REAL STORAGE world: the full repro sequence through the REAL
// governance mutation service over the durable TeamDomain.
const eDir = scratchDir('gov-tombstone-e')
destroyDir(eDir) // self-cleaning: a crashed prior run may leave a domain behind
const eSeam = new FileStorageSeam(eDir)
const eDomain = await createTeamDomain(eSeam)
const eStore: OverrideStorePort = {
  list: (rootSessionId) => Promise.resolve(eDomain.repositories.overrides.list(rootSessionId)),
  put: (record) => eDomain.repositories.overrides.put(record),
}
const e = makeService(eStore)
const eTeamDeny = await e.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { mcp: { kind: 'deny' } },
})
const eInstanceDeny = await e.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
  cells: { mcp: { kind: 'deny' } },
})
const eReadBeforeReset = eRead(eDomain.repositories.overrides.list(ROOT))
const eReset = await e.resetOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
})
const eRecordsAfterInstanceReset = eDomain.repositories.overrides.list(ROOT)
const eReadAfterReset = eRead(eRecordsAfterInstanceReset)
// RESTART: a NEW seam over the SAME dir (the durable rows survive) — the
// reopened canonical read (a fresh read, not a cached one).
const eSeam2 = new FileStorageSeam(eDir)
const eDomain2 = await openTeamDomain(eSeam2)
const eReopenedRecords = eDomain2.repositories.overrides.list(ROOT)
const eReopenedRead = eRead(eReopenedRecords)
// Control: the TEAM slot reset too -> NO human slot value at all -> the
// template baseline comes back (a tombstone is never a value source).
const eTeamReset = await e.resetOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
})
const eReadBothReset = eRead(eDomain.repositories.overrides.list(ROOT))
destroyDir(eDir)

describe('E-regression — the instance reset tombstone must not mask a still-effective TEAM human deny (the canonical read)', () => {
  it('repro: the instance deny resets -> the inherited TEAM deny is restored (not the template allow)', () => {
    expect(eTeamDeny.changed).toBe(true)
    expect(eInstanceDeny.changed).toBe(true)
    // Pre-reset control: the INSTANCE slot's deny is the effective value.
    expect(eReadBeforeReset.policy.cells['mcp'].effective).toEqual({ kind: 'deny' })
    expect(eReadBeforeReset.policy.cells['mcp'].team.recordId).toBe('ovr-mcp-inst-alpha-g0')
    expect(eReadBeforeReset.humanOverride?.overrideId).toBe('ovr-mcp-inst-alpha-g0')
    expect(eReadBeforeReset.committedGeneration).toBe(1)
    // The reset is the tombstone (history-preserving; T1 pins the shape).
    expect(eReset.removed).toBe(true)
    // Post-reset: the TEAM deny is restored — the instance slot's LATEST
    // event is a tombstone (NO effective value for that slot), so the
    // precedence falls back to the team slot.
    expect(eReadAfterReset.policy.cells['mcp'].effective).toEqual({ kind: 'deny' })
    expect(eReadAfterReset.policy.cells['mcp'].team.layer).toBe('humanOverride')
    expect(eReadAfterReset.policy.cells['mcp'].team.recordId).toBe('ovr-mcp-team-g0')
    // Provenance: the selected human winner is the TEAM record, not the
    // instance tombstone (a tombstone is never a value source).
    expect(eReadAfterReset.humanOverride?.overrideId).toBe('ovr-mcp-team-g0')
    expect(eReadAfterReset.humanOverride?.scope).toBe('team')
    // The staleness anchor keeps counting the tombstone generation (the
    // read reflects the state after the instance-slot reset at g2).
    expect(eReadAfterReset.committedGeneration).toBe(2)
    // The pre-reset instance value is NOT resurrected, and the history
    // rows are untouched (audit-only).
    expect(eRecordsAfterInstanceReset).toHaveLength(3)
    const ids = eRecordsAfterInstanceReset.map((record) => record.recordId).sort()
    expect(ids).toEqual(['ovr-mcp-inst-alpha-g0', 'ovr-mcp-team-g0', 'ovr-reset-inst-alpha-g1'])
    const tombstone = eRecordsAfterInstanceReset.find((record) => record.recordId === 'ovr-reset-inst-alpha-g1')
    expect(tombstone).toBeTruthy()
    if (tombstone === undefined) throw new Error('tombstone missing')
    expect(tombstone.values).toEqual({})
  })

  it('the reopened canonical read (fresh read from the durable store) still sees the TEAM deny', () => {
    expect(eReopenedRecords).toHaveLength(3)
    const tombstone = eReopenedRecords.find((record) => record.recordId === 'ovr-reset-inst-alpha-g1')
    expect(tombstone).toBeTruthy()
    if (tombstone === undefined) throw new Error('tombstone missing after reopen')
    expect(tombstone.values).toEqual({})
    expect(eReopenedRead.policy.cells['mcp'].effective).toEqual({ kind: 'deny' })
    expect(eReopenedRead.policy.cells['mcp'].team.layer).toBe('humanOverride')
    expect(eReopenedRead.policy.cells['mcp'].team.recordId).toBe('ovr-mcp-team-g0')
    expect(eReopenedRead.humanOverride?.overrideId).toBe('ovr-mcp-team-g0')
  })

  it('control: a TEAM-slot tombstone contributes no value either (the template baseline returns)', () => {
    expect(eTeamReset.removed).toBe(true)
    expect(eReadBothReset.policy.cells['mcp'].effective).toEqual({ kind: 'allow', items: ['srv/x'] })
    expect(eReadBothReset.policy.cells['mcp'].team.layer).toBe('template')
    expect(eReadBothReset.humanOverride).toBeUndefined()
    expect(eReadBothReset.committedGeneration).toBe(2)
  })
})
