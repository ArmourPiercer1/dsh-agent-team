/**
 * P8-T2 mandatory test 1 — COLD projection (TaskDoc §11.9 P8-T2;
 * DevPlan §21.2): the whole projection is produced from the durable
 * TeamDomain ONLY (no live overlay port — `overlay: null`); the result is
 * a valid frozen `TeamProjectionDto` whose facts are the durable truth, and
 * every member's `liveActivity` is `null` (the nullable overlay with no
 * live facts). The durable source is read exactly once, no child Session log
 * is ever read (§21.2 red line), and the produced value is a lossless-JSON,
 * deep-frozen DTO.
 *
 * Mock-first (ruling R28): the TeamDomain source port is a fake; the
 * projection service (and the pure fold) are REAL.
 *
 * Top-level pattern (plain-node shim): the scenario runs at module top
 * level (synchronous — the service and fold are synchronous); the `it`
 * bodies assert only over the captured snapshot.
 *
 * @module @dsh-agent-team/runtime/test/p8t2-cold
 */

import { describe, expect, it } from 'vitest'
import { isRemoteSafeJsonValue } from '../../contracts/src/index.js'
import type { TeamProjectionDto } from '../../contracts/src/index.js'
import {
  DEFAULT_PROJECTION_TIMESTAMP,
  P8T2_FIXTURE,
  createP8T2World,
  makeSource,
} from './p8t2-helpers.js'

interface ColdSnapshot {
  readonly projection: TeamProjectionDto
  readonly readCount: number
  readonly childLogReadCount: number
  readonly overlayIsNullOrLikeNull: boolean
  readonly generatedAt: string
  readonly generation: number
  readonly teamSessionId: string
  readonly blueprint: {
    readonly blueprintId: string
    readonly revision: string
    readonly contentHash: string
  }
  readonly root: {
    readonly teamSessionId: string
    readonly defaultWorkspace: string | undefined
    readonly createdAt: string
    readonly policyState: string
    readonly admission: string
    readonly creationBudgetConsumed: number
    readonly hasHandoffSource: boolean
  }
  readonly templates: readonly {
    readonly kind: string
    readonly templateId: string
  }[]
  readonly members: readonly {
    readonly instanceId: string
    readonly templateId: string
    readonly label: string
    readonly workspace: string
    readonly lifecycle: string
    readonly contextPolicy: string
    readonly hasChildSessionId: boolean
    readonly childSessionId: string | undefined
  }[]
  readonly allLiveActivityNull: boolean
  readonly ledger: {
    readonly latestSequence: number
    readonly totalEntries: number
    readonly pendingControlCount: number
    readonly byCategory: Record<string, number>
  }
  readonly isLosslessJson: boolean
  readonly isFrozen: boolean
  readonly serialized: string
}

let s1: ColdSnapshot | undefined

{
  const source = makeSource({ memberCount: 3, generation: 5 })
  const world = createP8T2World({ source, overlay: null })
  const projection = world.service.project(P8T2_FIXTURE.teamSessionId)

  s1 = {
    projection,
    readCount: world.domain.readCount,
    childLogReadCount: world.domain.childLogReadCount,
    // A cold service has no overlay port at all (overlay === null).
    overlayIsNullOrLikeNull: world.overlay === null,
    generatedAt: projection.generatedAt,
    generation: projection.generation,
    teamSessionId: projection.teamSessionId,
    blueprint: {
      blueprintId: projection.blueprint.blueprintId,
      revision: projection.blueprint.revision,
      contentHash: projection.blueprint.contentHash,
    },
    root: {
      teamSessionId: projection.root.teamSessionId,
      defaultWorkspace: projection.root.defaultWorkspace,
      createdAt: projection.root.createdAt,
      policyState: projection.root.policyState,
      admission: projection.root.admission,
      creationBudgetConsumed: projection.root.creationBudgetConsumed,
      hasHandoffSource: projection.root.handoffSourceSessionId !== undefined,
    },
    templates: projection.templates.map((t) => ({
      kind: t.kind,
      templateId: t.templateId,
    })),
    members: projection.members.map((m) => ({
      instanceId: m.instanceId,
      templateId: m.templateId,
      label: m.label,
      workspace: m.workspace,
      lifecycle: m.lifecycle,
      contextPolicy: m.contextPolicy,
      hasChildSessionId: 'childSessionId' in m,
      childSessionId: 'childSessionId' in m ? m.childSessionId : undefined,
    })),
    allLiveActivityNull: projection.members.every((m) => m.liveActivity === null),
    ledger: {
      latestSequence: projection.ledger.latestSequence,
      totalEntries: projection.ledger.totalEntries,
      pendingControlCount: projection.ledger.pendingControlCount,
      byCategory: { ...projection.ledger.byCategory },
    },
    isLosslessJson: isRemoteSafeJsonValue(projection),
    isFrozen: Object.isFrozen(projection),
    serialized: JSON.stringify(projection),
  }
}

describe('P8-T2 cold projection (durable-only, live null)', () => {
  it('S1.1: the cold projection is a lossless-JSON, deep-frozen DTO', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.isLosslessJson).toBe(true)
    expect(s1.isFrozen).toBe(true)
    expect(s1.projection.schemaVersion).toBe(1)
  })

  it('S1.2: the durable source is read exactly once and NO child log is read', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.readCount).toBe(1)
    expect(s1.childLogReadCount).toBe(0)
    expect(s1.overlayIsNullOrLikeNull).toBe(true)
  })

  it('S1.3: identity + generation + produced-at are the durable truth (no overlay effect)', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.teamSessionId).toBe(P8T2_FIXTURE.teamSessionId)
    expect(s1.generation).toBe(5)
    expect(s1.generatedAt).toBe(DEFAULT_PROJECTION_TIMESTAMP)
    expect(s1.blueprint.blueprintId).toBe(P8T2_FIXTURE.blueprintId)
    expect(s1.blueprint.revision).toBe(P8T2_FIXTURE.blueprintRevision)
    expect(s1.blueprint.contentHash).toBe(P8T2_FIXTURE.blueprintContentHash)
  })

  it('S1.4: the root carries the durable identity + admission facts (no lifecycle field)', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.root.teamSessionId).toBe(P8T2_FIXTURE.teamSessionId)
    expect(s1.root.defaultWorkspace).toBe(P8T2_FIXTURE.defaultWorkspace)
    expect(s1.root.createdAt).toBe(P8T2_FIXTURE.createdAt)
    expect(s1.root.policyState).toBe('active')
    expect(s1.root.admission).toBe('OPEN')
    expect(s1.root.creationBudgetConsumed).toBe(0)
    expect(s1.root.hasHandoffSource).toBe(false)
    // The root has NO lifecycle field (Architecture §8.6).
    expect('lifecycle' in s1.projection.root).toBe(false)
  })

  it('S1.5: the templates are the durable rows (exactly one leader)', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.templates.length).toBe(2)
    const kinds = s1.templates.map((t) => t.kind).sort()
    expect(kinds).toEqual(['leader', 'member'])
  })

  it('S1.6: every member row is the durable truth with liveActivity null', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    // leader + 3 members
    expect(s1.members.length).toBe(4)
    expect(s1.allLiveActivityNull).toBe(true)
    const leader = s1.members.find((m) => m.instanceId === 'inst-leader')
    expect(leader?.hasChildSessionId).toBe(false)
    expect(leader?.workspace).toBe(P8T2_FIXTURE.defaultWorkspace)
    const worker = s1.members.find((m) => m.instanceId === 'inst-p8t2m1')
    expect(worker?.hasChildSessionId).toBe(true)
    expect(worker?.childSessionId).toBe('child-p8t2-1')
    expect(worker?.workspace).toBe(P8T2_FIXTURE.defaultWorkspace)
    expect(worker?.lifecycle).toBe('RUNNING')
  })

  it('S1.7: the ledger summary is the durable summary (entries never projected)', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.ledger.latestSequence).toBe(0)
    expect(s1.ledger.totalEntries).toBe(0)
    expect(s1.ledger.pendingControlCount).toBe(0)
    // all eight categories, all explicit zeros
    const keys = Object.keys(s1.ledger.byCategory).sort()
    expect(keys).toEqual(
      ['compatibility', 'control', 'lifecycle', 'member', 'message', 'policy', 'progress', 'team'],
    )
    for (const key of Object.keys(s1.ledger.byCategory)) {
      expect(s1.ledger.byCategory[key]).toBe(0)
    }
  })
})
