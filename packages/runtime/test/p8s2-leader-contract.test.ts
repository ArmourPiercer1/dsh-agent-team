/**
 * P8-S2 — Leader + Core Contract Repair (the §15.3 acceptance test list,
 * items 1–7; item 8 lives in the contracts package).
 *
 * C1 — archive/restore/dispose on the LeaderInstance is rejected by the
 *   fail-closed lifecycle guard (typed `LIFECYCLE_LEADER_NOT_OPERABLE`),
 *   independent of whether a leader row exists and of its shape;
 * C2 — a fresh root durably mints the LeaderInstance record (schema v2,
 *   no childSessionId/lifecycle keys) through `bindFreshTeamRoot`;
 * C3 — the Leader caller resolves from the durable Root/Team identity
 *   (RootSession + team-root binding) at BOTH fresh root and cold root,
 *   with NO manually seeded member row;
 * C4/C5 — the minted row is the honest v2 leader shape; ordinary members
 *   are unchanged.
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are
 * synchronous): every scenario runs at module top level, its
 * observables are captured into plain snapshots, the world is destroyed
 * after capture; the `it` bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p8s2-leader-contract
 */

import { describe, expect, it } from 'vitest'

import {
  LEADER_INSTANCE_ID,
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordInput } from '../../contracts/src/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import type { BlueprintCatalog } from '../../domain/blueprint/src/index.js'
import {
  LIFECYCLE_RUNTIME_ERROR_CODES,
  isLifecycleRuntimeError,
} from '../lifecycle/index.js'
import {
  ROOT_BINDING_ERROR_CODES,
  bindFreshTeamRoot,
  createTeamDomainWritePort,
  isRootBindingError,
  rehydrateColdTeamRoot,
} from '../root-binding/index.js'
import type { RootBindingPorts, RootBindingResult } from '../root-binding/index.js'
import { createTeamDomainReadHandle } from '../agent-setup/binder/index.js'
import {
  P5T5_FIXTURE,
  captureError,
  createRootBindingWorld,
  destroyWorld,
  restartRootBindingWorld,
} from './p5t5-helpers.js'
import type { P5T5World } from './p5t5-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createP6T2World,
  createP6T2Runtime,
  makeActionRequest,
  memberCaller,
} from './p6t2-helpers.js'
import { destroyP6T1World, restartP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import type { FakeAgentSetupSurface } from './p5t1-helpers.js'
import { P7T3_FIXTURE, createLifecycleWorld } from './p7t3-helpers.js'

const LEADER_ID = String(LEADER_INSTANCE_ID)

/** Plain facts of one leader row (the shape under test, C4/C5). */
interface LeaderRowFacts {
  readonly present: boolean
  readonly schemaVersion: number | undefined
  readonly instanceId: string | undefined
  readonly templateId: string | undefined
  readonly label: string | undefined
  readonly hasChildSessionKey: boolean
  readonly hasLifecycleKey: boolean
}

function leaderRowFacts(record: unknown): LeaderRowFacts {
  if (typeof record !== 'object' || record === null) {
    return {
      present: false,
      schemaVersion: undefined,
      instanceId: undefined,
      templateId: undefined,
      label: undefined,
      hasChildSessionKey: false,
      hasLifecycleKey: false,
    }
  }
  const r = record as Record<string, unknown>
  return {
    present: true,
    schemaVersion: typeof r['schemaVersion'] === 'number' ? r['schemaVersion'] : undefined,
    instanceId: typeof r['instanceId'] === 'string' ? r['instanceId'] : undefined,
    templateId: typeof r['templateId'] === 'string' ? r['templateId'] : undefined,
    label: typeof r['label'] === 'string' ? r['label'] : undefined,
    hasChildSessionKey: Object.prototype.hasOwnProperty.call(r, 'childSessionId'),
    hasLifecycleKey: Object.prototype.hasOwnProperty.call(r, 'lifecycle'),
  }
}

/** Plain facts of one `members-listed` summary row (the projection view). */
interface MemberSummaryFacts {
  readonly instanceId: string
  readonly templateId: string
  readonly label: string
  readonly hasLifecycleValue: boolean
  readonly hasChildSessionValue: boolean
}

function memberFacts(effect: unknown): MemberSummaryFacts[] {
  if (typeof effect !== 'object' || effect === null) {
    throw new Error(`p8s2: effect is not an object: ${String(effect)}`)
  }
  const e = effect as { kind?: unknown; members?: readonly unknown[] }
  if (e.kind !== 'members-listed' || !Array.isArray(e.members)) {
    throw new Error(`p8s2: expected a members-listed effect, got kind ${String(e.kind)}`)
  }
  return e.members.map((member) => {
    const m = (typeof member === 'object' && member !== null ? member : {}) as Record<string, unknown>
    return {
      instanceId: String(m['instanceId']),
      templateId: String(m['templateId']),
      label: String(m['label']),
      hasLifecycleValue: m['lifecycle'] !== undefined,
      hasChildSessionValue: m['childSessionId'] !== undefined,
    }
  })
}

function effectKind(effect: unknown): string | undefined {
  if (typeof effect !== 'object' || effect === null) return undefined
  const kind = (effect as { kind?: unknown }).kind
  return typeof kind === 'string' ? kind : undefined
}

function activatedInstanceId(effect: unknown): string | undefined {
  if (typeof effect !== 'object' || effect === null) return undefined
  const instanceId = (effect as { instanceId?: unknown }).instanceId
  return typeof instanceId === 'string' ? instanceId : undefined
}

// ── Family A: the root-binding mint (C2) + cold rehydration (C3) ──────

interface ASnapshot {
  readonly mintError: unknown
  readonly mintPath: string | undefined
  readonly mintWrote: boolean | undefined
  readonly mintWriteCalls: readonly { readonly method: string }[]
  readonly resultLeaderRow: LeaderRowFacts
  readonly repoLeaderRow: LeaderRowFacts
  readonly rerunError: unknown
  readonly rerunWriteCalls: readonly { readonly method: string }[]
  readonly rerunLeaderRow: LeaderRowFacts
  readonly noCatalogError: unknown
  readonly noCatalogWriteCalls: readonly { readonly method: string }[]
  readonly coldError: unknown
  readonly coldPath: string | undefined
  readonly coldWrote: boolean | undefined
  readonly coldWriteCalls: readonly { readonly method: string }[]
  readonly coldLeaderRow: LeaderRowFacts
}

function freshP5T5Input() {
  return {
    rootSessionId: P5T5_FIXTURE.rootSessionId,
    blueprint: P5T5_FIXTURE.blueprint,
    defaultWorkspace: P5T5_FIXTURE.defaultWorkspace,
  }
}

const aWorld = await createRootBindingWorld('p8s2-a1-fresh-mint')
let aCurrent: P5T5World = aWorld
let aSnapshot: ASnapshot
try {
  let mintResult: RootBindingResult | undefined
  let mintError: unknown
  try {
    mintResult = await bindFreshTeamRoot(aWorld.ports, freshP5T5Input())
  } catch (error) {
    mintError = error
  }
  const repoLeaderRow = leaderRowFacts(
    aWorld.domain.repositories.memberInstances.get(String(P5T5_FIXTURE.rootSessionId), LEADER_ID),
  )
  const resultLeaderRow = leaderRowFacts(mintResult?.durable?.leaderRow)

  // Idempotent re-run: ZERO additional durable writes (succeeds, no error).
  let rerunError: unknown
  try {
    await bindFreshTeamRoot(aWorld.ports, freshP5T5Input())
  } catch (error) {
    rerunError = error
  }
  const rerunWriteCalls = aWorld.writeCalls.map((call) => ({ method: call.method }))
  const rerunLeaderRow = leaderRowFacts(
    aWorld.domain.repositories.memberInstances.get(String(P5T5_FIXTURE.rootSessionId), LEADER_ID),
  )

  // Cold rehydration on the restarted world: zero writes, leader intact.
  aCurrent = await restartRootBindingWorld(aWorld)
  let coldResult: RootBindingResult | undefined
  let coldError: unknown
  try {
    coldResult = await rehydrateColdTeamRoot(aCurrent.ports, {
      rootSessionId: P5T5_FIXTURE.rootSessionId,
    })
  } catch (error) {
    coldError = error
  }
  const coldWriteCalls = aCurrent.writeCalls.map((call) => ({ method: call.method }))
  const coldLeaderRow = leaderRowFacts(
    aCurrent.domain.repositories.memberInstances.get(String(P5T5_FIXTURE.rootSessionId), LEADER_ID),
  )

  aSnapshot = {
    mintError,
    mintPath: mintResult?.path,
    mintWrote: mintResult?.durable?.wrote,
    mintWriteCalls: aWorld.writeCalls.map((call) => ({ method: call.method })),
    resultLeaderRow,
    repoLeaderRow,
    rerunError,
    rerunWriteCalls,
    rerunLeaderRow,
    noCatalogError: undefined,
    noCatalogWriteCalls: [],
    coldError,
    coldPath: coldResult?.path,
    coldWrote: coldResult?.durable?.wrote,
    coldWriteCalls,
    coldLeaderRow,
  }
} finally {
  await destroyWorld(aCurrent)
}

// A3 — the mint requires the blueprint catalog (fail-closed, typed).
const a3World = await createRootBindingWorld('p8s2-a3-no-catalog')
{
  const noCatalogPorts: RootBindingPorts = {
    teamDomain: a3World.ports.teamDomain,
    writes: a3World.writes,
    surface: a3World.surface,
    now: a3World.now,
  }
  const noCatalogError = await captureError(() => bindFreshTeamRoot(noCatalogPorts, freshP5T5Input()))
  aSnapshot = {
    ...aSnapshot,
    noCatalogError,
    noCatalogWriteCalls: a3World.writeCalls.map((call) => ({ method: call.method })),
  }
}
await destroyWorld(a3World)

describe('P8-S2 A: the fresh root mints the LeaderInstance (C2) and the cold root rehydrates it (C3)', () => {
  it('A1: the fresh bind commits the team rows AND the v2 leader row, in order', () => {
    expect(aSnapshot.mintError).toBe(undefined)
    expect(aSnapshot.mintPath).toBe('fresh-root')
    expect(aSnapshot.mintWrote).toBe(true)
    expect(aSnapshot.mintWriteCalls).toEqual([
      { method: 'putTeamSession' },
      { method: 'putSessionBinding' },
      { method: 'putMemberInstance' },
    ])
  })

  it('A2: the minted leader row is the honest v2 shape (no childSessionId/lifecycle keys)', () => {
    expect(aSnapshot.repoLeaderRow.present).toBe(true)
    expect(aSnapshot.repoLeaderRow.schemaVersion).toBe(2)
    expect(aSnapshot.repoLeaderRow.instanceId).toBe(LEADER_ID)
    expect(aSnapshot.repoLeaderRow.templateId).toBe('leader')
    expect(aSnapshot.repoLeaderRow.hasChildSessionKey).toBe(false)
    expect(aSnapshot.repoLeaderRow.hasLifecycleKey).toBe(false)
    // The result carries the same row.
    expect(aSnapshot.resultLeaderRow.present).toBe(true)
    expect(aSnapshot.resultLeaderRow.schemaVersion).toBe(2)
    expect(aSnapshot.resultLeaderRow.hasChildSessionKey).toBe(false)
    expect(aSnapshot.resultLeaderRow.hasLifecycleKey).toBe(false)
  })

  it('A3: the idempotent re-run performs ZERO additional durable writes and keeps the row', () => {
    expect(aSnapshot.rerunError).toBe(undefined)
    expect(aSnapshot.rerunWriteCalls).toEqual([
      { method: 'putTeamSession' },
      { method: 'putSessionBinding' },
      { method: 'putMemberInstance' },
    ])
    expect(aSnapshot.rerunLeaderRow.present).toBe(true)
    expect(aSnapshot.rerunLeaderRow.schemaVersion).toBe(2)
    expect(aSnapshot.rerunLeaderRow.hasChildSessionKey).toBe(false)
    expect(aSnapshot.rerunLeaderRow.hasLifecycleKey).toBe(false)
  })

  it('A4: a missing catalog is a typed ROOT_BINDING_LEADER_MINT_FAILED (fail-closed, not a default)', () => {
    expect(isRootBindingError(aSnapshot.noCatalogError)).toBe(true)
    if (isRootBindingError(aSnapshot.noCatalogError)) {
      expect(aSnapshot.noCatalogError.code).toBe(
        ROOT_BINDING_ERROR_CODES.ROOT_BINDING_LEADER_MINT_FAILED,
      )
      expect(aSnapshot.noCatalogError.details?.['cause']).toBe('catalog-absent')
    }
    // The team rows committed before the mint failure stand (crash-safe order).
    expect(aSnapshot.noCatalogWriteCalls).toEqual([
      { method: 'putTeamSession' },
      { method: 'putSessionBinding' },
    ])
  })

  it('A5: the cold rehydration performs zero writes and the v2 leader row survives the restart', () => {
    expect(aSnapshot.coldError).toBe(undefined)
    expect(aSnapshot.coldPath).toBe('cold-root')
    expect(aSnapshot.coldWrote).toBe(false)
    expect(aSnapshot.coldWriteCalls).toEqual([])
    expect(aSnapshot.coldLeaderRow.present).toBe(true)
    expect(aSnapshot.coldLeaderRow.schemaVersion).toBe(2)
    expect(aSnapshot.coldLeaderRow.instanceId).toBe(LEADER_ID)
    expect(aSnapshot.coldLeaderRow.hasChildSessionKey).toBe(false)
    expect(aSnapshot.coldLeaderRow.hasLifecycleKey).toBe(false)
  })
})

// ── Family B: the Leader caller in the action router (C3, items 1/2/6/7) ─

interface BSnapshot {
  readonly mintError: unknown
  readonly mintLeaderRow: LeaderRowFacts
  readonly listError: unknown
  readonly listKind: string | undefined
  readonly listMembers: readonly MemberSummaryFacts[]
  readonly delegateError: unknown
  readonly delegateKind: string | undefined
  readonly delegateInstanceId: string | undefined
  readonly secondListMembers: readonly MemberSummaryFacts[]
  readonly coldLeaderRow: LeaderRowFacts
  readonly coldListError: unknown
  readonly coldListKind: string | undefined
  readonly coldListMembers: readonly MemberSummaryFacts[]
  readonly progressError: unknown
  readonly progressKind: string | undefined
  readonly noRowListError: unknown
  readonly noRowListMembers: readonly MemberSummaryFacts[]
  readonly noRowDelegateError: unknown
  readonly noRowDelegateKind: string | undefined
}

/** Wire one fresh-root mint port bundle over a P6-T2 world. */
function p8s2MintPorts(
  world: {
    readonly domain: TeamDomain
    readonly catalog: BlueprintCatalog
    readonly surface: FakeAgentSetupSurface
  },
): RootBindingPorts {
  return {
    teamDomain: createTeamDomainReadHandle(world.domain.repositories),
    writes: createTeamDomainWritePort(world.domain.repositories),
    surface: world.surface,
    now: () => P6T2_NOW,
    blueprintCatalog: world.catalog,
  }
}

const bWorld = await createP6T2World('p8s2-b1-minted', ['worker', 'scout'])
let bCurrent: P6T1World = bWorld
let bSnapshot: BSnapshot
try {
  // C2 in the production wiring: the world has NO leader seed; the fresh
  // bind is idempotent on the team rows (already seeded) and mints the row
  // (succeeds; no error).
  let mintError: unknown
  try {
    await bindFreshTeamRoot(p8s2MintPorts(bWorld), {
      rootSessionId: parseRootSessionId(P6T2_ROOT),
      blueprint: createBlueprintSnapshotRef({
        blueprintId: parseBlueprintId(String(bWorld.blueprint.blueprintId)),
        revision: parseBlueprintRevision(String(bWorld.blueprint.revision)),
        contentHash: parseBlueprintContentHash(String(bWorld.blueprint.contentHash)),
      }),
    })
  } catch (error) {
    mintError = error
  }
  const mintLeaderRow = leaderRowFacts(
    bWorld.domain.repositories.memberInstances.get(P6T2_ROOT, LEADER_ID),
  )

  // Item 1: the minted Leader lists and delegates.
  const bRuntime = createP6T2Runtime(bWorld)
  let listError: unknown
  let listEffect: unknown
  try {
    const listOutcome = await bRuntime.performAction(
      makeActionRequest({ action: 'list-members', requestToken: 'tok-p8s2-b1-list' }),
    )
    listEffect = listOutcome.effect
  } catch (error) {
    listError = error
  }

  let delegateError: unknown
  let delegateEffect: unknown
  try {
    const delegateOutcome = await bRuntime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'scout',
        payload: { label: 'p8s2-scout' },
        requestToken: 'tok-p8s2-b1-delegate',
      }),
    )
    delegateEffect = delegateOutcome.effect
  } catch (error) {
    delegateError = error
  }

  let secondListEffect: unknown
  try {
    const secondList = await bRuntime.performAction(
      makeActionRequest({ action: 'list-members', requestToken: 'tok-p8s2-b1-list2' }),
    )
    secondListEffect = secondList.effect
  } catch {
    secondListEffect = undefined
  }

  // Item 2: the cold root (process restart) — the Leader remains valid.
  bCurrent = await restartP6T1World(bWorld)
  const coldLeaderRow = leaderRowFacts(
    bCurrent.domain.repositories.memberInstances.get(P6T2_ROOT, LEADER_ID),
  )
  const b2Runtime = createP6T2Runtime(bCurrent)
  let coldListError: unknown
  let coldListEffect: unknown
  try {
    const coldList = await b2Runtime.performAction(
      makeActionRequest({ action: 'list-members', requestToken: 'tok-p8s2-b2-list' }),
    )
    coldListEffect = coldList.effect
  } catch (error) {
    coldListError = error
  }

  // Item 7: ordinary member behavior is unchanged (the worker reports).
  const workerId = String(P6T2_SEEDS.worker.instanceId)
  let progressError: unknown
  let progressEffect: unknown
  try {
    const progressOutcome = await b2Runtime.performAction(
      makeActionRequest({
        action: 'report-progress',
        caller: memberCaller(workerId),
        targetInstanceId: workerId,
        payload: { progress: 'in-progress', summary: 'p8s2 worker progress' },
        requestToken: 'tok-p8s2-b4-progress',
      }),
    )
    progressEffect = progressOutcome.effect
  } catch (error) {
    progressError = error
  }

  bSnapshot = {
    mintError,
    mintLeaderRow,
    listError,
    listKind: effectKind(listEffect),
    listMembers: listEffect === undefined ? [] : memberFacts(listEffect),
    delegateError,
    delegateKind: effectKind(delegateEffect),
    delegateInstanceId: activatedInstanceId(delegateEffect),
    secondListMembers:
      secondListEffect === undefined ? [] : memberFacts(secondListEffect),
    coldLeaderRow,
    coldListError,
    coldListKind: effectKind(coldListEffect),
    coldListMembers: coldListEffect === undefined ? [] : memberFacts(coldListEffect),
    progressError,
    progressKind: effectKind(progressEffect),
    noRowListError: undefined,
    noRowListMembers: [],
    noRowDelegateError: undefined,
    noRowDelegateKind: undefined,
  }
} finally {
  await destroyP6T1World(bCurrent)
}

// B3 — item 6: no leader row at all (a legacy/cold world that never minted).
const b3World = await createP6T2World('p8s2-b3-no-row', ['worker'])
{
  const b3Runtime = createP6T2Runtime(b3World)
  let noRowListError: unknown
  let noRowListEffect: unknown
  try {
    const noRowList = await b3Runtime.performAction(
      makeActionRequest({ action: 'list-members', requestToken: 'tok-p8s2-b3-list' }),
    )
    noRowListEffect = noRowList.effect
  } catch (error) {
    noRowListError = error
  }
  let noRowDelegateError: unknown
  let noRowDelegateEffect: unknown
  try {
    const noRowDelegate = await b3Runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'scout',
        payload: { label: 'p8s2-b3-scout' },
        requestToken: 'tok-p8s2-b3-delegate',
      }),
    )
    noRowDelegateEffect = noRowDelegate.effect
  } catch (error) {
    noRowDelegateError = error
  }
  bSnapshot = {
    ...bSnapshot,
    noRowListError,
    noRowListMembers: noRowListEffect === undefined ? [] : memberFacts(noRowListEffect),
    noRowDelegateError,
    noRowDelegateKind: effectKind(noRowDelegateEffect),
  }
}
await destroyP6T1World(b3World)

describe('P8-S2 B: the Leader caller resolves from the durable Root/Team identity (C3)', () => {
  it('B1: a fresh root without any leader seed mints the v2 row and the Leader lists and delegates', () => {
    expect(bSnapshot.mintError).toBe(undefined)
    expect(bSnapshot.mintLeaderRow.present).toBe(true)
    expect(bSnapshot.mintLeaderRow.schemaVersion).toBe(2)
    expect(bSnapshot.mintLeaderRow.hasChildSessionKey).toBe(false)
    expect(bSnapshot.mintLeaderRow.hasLifecycleKey).toBe(false)

    expect(bSnapshot.listError).toBe(undefined)
    expect(bSnapshot.listKind).toBe('members-listed')
    const ids = bSnapshot.listMembers.map((m) => m.instanceId)
    expect(ids.includes(LEADER_ID)).toBe(true)
    expect(ids.includes(String(P6T2_SEEDS.worker.instanceId))).toBe(true)
    expect(ids.includes(String(P6T2_SEEDS.scout.instanceId))).toBe(true)
    const leaderSummary = bSnapshot.listMembers.find((m) => m.instanceId === LEADER_ID)
    expect(leaderSummary?.templateId).toBe('leader')
    // The v2 row carries no lifecycle/childSession values into the summary.
    expect(leaderSummary?.hasLifecycleValue).toBe(false)
    expect(leaderSummary?.hasChildSessionValue).toBe(false)

    expect(bSnapshot.delegateError).toBe(undefined)
    expect(bSnapshot.delegateKind).toBe('member-activated')
    expect(bSnapshot.delegateInstanceId).not.toBe(undefined)
    const secondIds = bSnapshot.secondListMembers.map((m) => m.instanceId)
    expect(secondIds.includes(String(bSnapshot.delegateInstanceId))).toBe(true)
    // The second list keeps the leader row (and its keyless summary).
    const secondLeader = bSnapshot.secondListMembers.find((m) => m.instanceId === LEADER_ID)
    expect(secondLeader?.hasLifecycleValue).toBe(false)
    expect(secondLeader?.hasChildSessionValue).toBe(false)
  })

  it('B2: after a process restart the v2 leader row survives and the Leader still acts', () => {
    expect(bSnapshot.coldLeaderRow.present).toBe(true)
    expect(bSnapshot.coldLeaderRow.schemaVersion).toBe(2)
    expect(bSnapshot.coldLeaderRow.hasChildSessionKey).toBe(false)
    expect(bSnapshot.coldLeaderRow.hasLifecycleKey).toBe(false)
    expect(bSnapshot.coldListError).toBe(undefined)
    expect(bSnapshot.coldListKind).toBe('members-listed')
    const coldIds = bSnapshot.coldListMembers.map((m) => m.instanceId)
    expect(coldIds.includes(LEADER_ID)).toBe(true)
    expect(coldIds.includes(String(bSnapshot.delegateInstanceId))).toBe(true)
  })

  it('B3: with NO leader row at all the Leader caller still resolves (root identity alone)', () => {
    expect(bSnapshot.noRowListError).toBe(undefined)
    const noRowIds = bSnapshot.noRowListMembers.map((m) => m.instanceId)
    expect(noRowIds.includes(String(P6T2_SEEDS.worker.instanceId))).toBe(true)
    // No row, no row in the list — the list reflects the durable roster.
    expect(noRowIds.includes(LEADER_ID)).toBe(false)
    expect(bSnapshot.noRowDelegateError).toBe(undefined)
    expect(bSnapshot.noRowDelegateKind).toBe('member-activated')
  })

  it('B4: ordinary member behavior is unchanged (the worker reports progress)', () => {
    expect(bSnapshot.progressError).toBe(undefined)
    expect(bSnapshot.progressKind).toBe('fact-recorded')
  })
})

// ── Family C: the lifecycle guard rejects the LeaderInstance (C1) ─────

interface CSnapshot {
  readonly archiveError: unknown
  readonly restoreError: unknown
  readonly disposeError: unknown
  readonly liveCallKinds: readonly string[]
  readonly seamWriteDelta: number
  readonly v2RowPresent: boolean
  readonly v2RowArchiveError: unknown
  readonly v1RowPresent: boolean
  readonly v1RowDisposeError: unknown
}

const LEADER_TARGET = {
  rootSessionId: String(P7T3_FIXTURE.rootSessionId),
  instanceId: LEADER_ID,
}

const c1World = await createLifecycleWorld('p8s2-c1-leader-guard', {})
let cSnapshot: CSnapshot
try {
  const writesBefore = c1World.seam.writeCount
  const archiveError = await captureError(() => c1World.service.archiveMember(LEADER_TARGET))
  const restoreError = await captureError(() => c1World.service.restoreMember(LEADER_TARGET))
  const disposeError = await captureError(() => c1World.service.disposeMember(LEADER_TARGET))
  const liveCallKinds = c1World.clock.kinds()
  const seamWriteDelta = c1World.seam.writeCount - writesBefore

  cSnapshot = {
    archiveError,
    restoreError,
    disposeError,
    liveCallKinds,
    seamWriteDelta,
    v2RowPresent: false,
    v2RowArchiveError: undefined,
    v1RowPresent: false,
    v1RowDisposeError: undefined,
  }
} finally {
  await c1World.destroy()
}

// C2 — the guard rejects regardless of a PRESENT v2 leader row.
const c2World = await createLifecycleWorld('p8s2-c2-v2-row', {})
{
  // Seed a genuine v2 leader row through the public put seam: the
  // factory shape-branches the keyless LeaderInstance input into the
  // honest v2 record (declared v1 parameter — documented type-lie).
  await c2World.domain.repositories.memberInstances.put({
    rootSessionId: P7T3_FIXTURE.rootSessionId,
    instanceId: LEADER_INSTANCE_ID,
    templateId: parseTemplateId('p7t3leader'),
    label: 'p7t3-leader',
    createdAt: '2026-09-01T00:00:00.000Z',
    activityVersion: 1,
  } as unknown as MemberInstanceRecordInput)
  const v2Row = c2World.domain.repositories.memberInstances.get(
    String(P7T3_FIXTURE.rootSessionId),
    LEADER_ID,
  )
  const v2RowArchiveError = await captureError(() => c2World.service.archiveMember(LEADER_TARGET))
  cSnapshot = {
    ...cSnapshot,
    v2RowPresent: v2Row !== undefined,
    v2RowArchiveError,
  }
}
await c2World.destroy()

// C3 — the guard rejects a legacy v1 hack leader row too (shape-agnostic).
const c3World = await createLifecycleWorld('p8s2-c3-v1-row', {})
{
  await c3World.domain.repositories.memberInstances.put({
    rootSessionId: P7T3_FIXTURE.rootSessionId,
    instanceId: LEADER_INSTANCE_ID,
    templateId: parseTemplateId('p7t3leader'),
    label: 'p7t3-leader-hack',
    childSessionId: parseChildSessionId('session-child-p7t3-leader-hack'),
    lifecycle: 'RUNNING',
    createdAt: '2026-09-01T00:00:00.000Z',
    activityVersion: 1,
  })
  const v1Row = c3World.domain.repositories.memberInstances.get(
    String(P7T3_FIXTURE.rootSessionId),
    LEADER_ID,
  )
  const v1RowDisposeError = await captureError(() => c3World.service.disposeMember(LEADER_TARGET))
  cSnapshot = {
    ...cSnapshot,
    v1RowPresent: v1Row !== undefined,
    v1RowDisposeError,
  }
}
await c3World.destroy()

function expectLeaderGuardRejection(error: unknown): void {
  expect(isLifecycleRuntimeError(error)).toBe(true)
  if (isLifecycleRuntimeError(error)) {
    expect(error.code).toBe(LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_LEADER_NOT_OPERABLE)
  }
}

describe('P8-S2 C: archive/restore/dispose on the LeaderInstance is rejected (C1, items 3–5)', () => {
  it('C1: archive/restore/dispose all reject with the typed guard code BEFORE any read or effect', () => {
    expectLeaderGuardRejection(cSnapshot.archiveError)
    expectLeaderGuardRejection(cSnapshot.restoreError)
    expectLeaderGuardRejection(cSnapshot.disposeError)
    // Zero live contact, zero durable writes (the guard fires first).
    expect(cSnapshot.liveCallKinds).toEqual([])
    expect(cSnapshot.seamWriteDelta).toBe(0)
  })

  it('C2: the rejection holds for a PRESENT v2 leader row (not MEMBER_NOT_FOUND, not a lifecycle fault)', () => {
    expect(cSnapshot.v2RowPresent).toBe(true)
    expectLeaderGuardRejection(cSnapshot.v2RowArchiveError)
  })

  it('C3: the rejection holds for a legacy v1 hack leader row (shape-agnostic)', () => {
    expect(cSnapshot.v1RowPresent).toBe(true)
    expectLeaderGuardRejection(cSnapshot.v1RowDisposeError)
  })
})
