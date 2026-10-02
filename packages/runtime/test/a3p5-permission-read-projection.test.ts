/**
 * Alpha.3 PR5 — the permission READ PROJECTION specs, over the REAL
 * durable overlay world (the PR1 helper harness; no host, no ports, no
 * network). Pinned contracts:
 *
 * - the authority view MIRRORS the highest-generation durable snapshot
 *   that the port's `latest` returns (never a fold, never a replay —
 *   ADR §2; the projection adds a view, not a second read model);
 * - the history view lists the audit rows ASCENDING (the port's own
 *   order) and computes NOTHING from them (audit only);
 * - every view is a deep-frozen COPY (a projection can never be steered
 *   back into a write, and never leaks the port's row object identity);
 * - the ONLY port members reachable are `latest` / `history` — the
 *   injected type narrows `append` away, and the Proxy leg here throws on
 *   ANY other member (the walk itself is then asserted);
 * - identity isolation: another instance's / another team's rows never
 *   appear in this view.
 *
 * @module @dsh-agent-team/runtime/test/a3p5-permission-read-projection
 */

import { describe, expect, it } from 'vitest'
import { createPermissionReadProjection } from '../permission-notification/index.js'
import type {
  PermissionAuthorityView,
  PermissionHistoryAuditView,
} from '../permission-notification/index.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'
import {
  FIXTURE_INSTANCE_ID,
  FIXTURE_TEAM_SESSION_ID,
  OTHER_INSTANCE_ID,
  OTHER_TEAM_SESSION_ID,
  fixtureKey,
  openWorld,
  snapshotInput,
} from './permission-overlay-helpers.js'

/** Port wrapper that RECORDS every member access and THROWS on any member
 *  outside the two read boundaries the projection may name. */
function recordedReadPort(worldPort: PermissionOverlayRepositoryPort): {
  overlay: Pick<PermissionOverlayRepositoryPort, 'latest' | 'history'>
  touched: Set<string>
} {
  const touched = new Set<string>()
  const proxy = new Proxy(worldPort as unknown as Record<string, unknown>, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined
      touched.add(prop)
      if (prop !== 'latest' && prop !== 'history') {
        throw new Error(`read projection reached port member "${prop}"`)
      }
      const member = target[prop]
      return typeof member === 'function' ? (member as (...a: unknown[]) => unknown).bind(target) : member
    },
  })
  return { overlay: proxy as unknown as Pick<PermissionOverlayRepositoryPort, 'latest' | 'history'>, touched }
}

const IDENTITY = {
  teamSessionId: FIXTURE_TEAM_SESSION_ID,
  memberInstanceId: FIXTURE_INSTANCE_ID,
}

describe('the authority view mirrors the durable current authority', () => {
  it('an empty identity reads present:false (no fabricated authority)', async () => {
    const world = await openWorld('proj-empty')
    try {
      const seam = recordedReadPort(world.port)
      const projection = createPermissionReadProjection({ overlay: seam.overlay })

      const view = await projection.readAuthority(IDENTITY)

      expect(view).toEqual({ present: false, identity: IDENTITY })
      expect([...seam.touched].sort()).toEqual(['latest'])
    } finally {
      world.destroy()
    }
  })

  it('the highest generation is the authority (never a fold of the history)', async () => {
    const world = await openWorld('proj-authority')
    try {
      await world.port.append(snapshotInput(1))
      await world.port.append(snapshotInput(2))
      const latest3 = await world.port.append(
        snapshotInput(3, { rules: [
          { operation: 'write', resource: 'output/a.json', effect: 'allow' },
          { operation: 'exec', resource: 'shell:*', effect: 'ask' },
        ] }),
      )
      const seam = recordedReadPort(world.port)
      const projection = createPermissionReadProjection({ overlay: seam.overlay })

      const view = await projection.readAuthority(IDENTITY)

      expect(view.present).toBe(true)
      if (!view.present) return
      expect(view.snapshotId).toBe(fixtureKey(3))
      expect(view.generation).toBe(3)
      expect(view.previousSnapshotId).toBe(fixtureKey(2))
      expect(view.ruleCount).toBe(2)
      expect(view.rules).toEqual(latest3.state.rules)
      expect(view.provenance).toEqual({
        actor: 'leader:inst-root',
        mutationId: 'mut-3',
        timestamp: '2026-10-01T12:00:00.000Z',
        reason: 'fixture generation 3',
      })
      expect([...seam.touched].sort()).toEqual(['latest'])
    } finally {
      world.destroy()
    }
  })

  it('identity isolation: the view answers for the addressed pair only', async () => {
    const world = await openWorld('proj-isolation')
    try {
      await world.port.append(snapshotInput(1))
      await world.port.append(snapshotInput(1, { memberInstanceId: OTHER_INSTANCE_ID }))
      // NOTE: NO row is written for (OTHER_TEAM, FIXTURE_INSTANCE) — the
      // foreign-team read below must come back present:false precisely
      // because that pair's chain is empty.
      const seam = recordedReadPort(world.port)
      const projection = createPermissionReadProjection({ overlay: seam.overlay })

      const own = await projection.readAuthority(IDENTITY)
      const sibling = await projection.readAuthority({
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: OTHER_INSTANCE_ID,
      })
      const foreignTeam = await projection.readAuthority({
        teamSessionId: OTHER_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
      })

      expect(own.present && own.identity).toEqual(IDENTITY)
      expect(sibling.present && sibling.identity.memberInstanceId).toBe(OTHER_INSTANCE_ID)
      expect(sibling.present && sibling.snapshotId).toBe(
        `${FIXTURE_TEAM_SESSION_ID}#${OTHER_INSTANCE_ID}#1`,
      )
      expect(foreignTeam).toMatchObject({ present: false })
    } finally {
      world.destroy()
    }
  })
})

describe('the history view is an ascending AUDIT mirror — never a fold', () => {
  it('lists every durable generation ascending, with frozen provenance copies', async () => {
    const world = await openWorld('proj-history')
    try {
      await world.port.append(snapshotInput(1))
      await world.port.append(snapshotInput(2, { actor: 'human' }))
      await world.port.append(snapshotInput(3))
      const seam = recordedReadPort(world.port)
      const projection = createPermissionReadProjection({ overlay: seam.overlay })

      const view: PermissionHistoryAuditView = await projection.readHistoryAudit(IDENTITY)

      expect(view.identity).toEqual(IDENTITY)
      expect(view.entries.map((entry) => entry.generation)).toEqual([1, 2, 3])
      expect(view.entries.map((entry) => entry.snapshotId)).toEqual([
        fixtureKey(1),
        fixtureKey(2),
        fixtureKey(3),
      ])
      expect(view.entries[1]?.provenance.actor).toBe('human')
      expect(view.entries[0]?.previousSnapshotId).toBe(null)
      expect(view.entries[2]?.previousSnapshotId).toBe(fixtureKey(2))
      // AUDIT presentation only: the view computes no effective state —
      // the closed entry shape is metadata, no decision vocabulary.
      for (const entry of view.entries) {
        expect(Object.keys(entry).sort()).toEqual([
          'generation',
          'previousSnapshotId',
          'provenance',
          'ruleCount',
          'snapshotId',
        ])
        expect(Object.keys(entry.provenance).sort()).toEqual([
          'actor',
          'mutationId',
          'reason',
          'timestamp',
        ])
      }
      expect([...seam.touched].sort()).toEqual(['history'])
    } finally {
      world.destroy()
    }
  })

  it('an empty identity reads an empty audit list', async () => {
    const world = await openWorld('proj-history-empty')
    try {
      const seam = recordedReadPort(world.port)
      const projection = createPermissionReadProjection({ overlay: seam.overlay })

      const view = await projection.readHistoryAudit(IDENTITY)

      expect(view.entries).toEqual([])
    } finally {
      world.destroy()
    }
  })
})

describe('projections are frozen copies, and `append` is unreachable', () => {
  it('authority + history views deep-freeze, copy, and never leak row identity', async () => {
    const world = await openWorld('proj-frozen')
    try {
      await world.port.append(snapshotInput(1))
      const seam = recordedReadPort(world.port)
      const projection = createPermissionReadProjection({ overlay: seam.overlay })

      const authority: PermissionAuthorityView = await projection.readAuthority(IDENTITY)
      const history = await projection.readHistoryAudit(IDENTITY)

      expect(authority.present).toBe(true)
      if (!authority.present) return
      expect(Object.isFrozen(authority)).toBe(true)
      expect(Object.isFrozen(authority.identity)).toBe(true)
      expect(Object.isFrozen(authority.rules)).toBe(true)
      expect(Object.isFrozen(authority.rules[0])).toBe(true)
      expect(Object.isFrozen(authority.provenance)).toBe(true)
      expect(Object.isFrozen(history)).toBe(true)
      expect(Object.isFrozen(history.entries)).toBe(true)
      expect(Object.isFrozen(history.entries[0])).toBe(true)

      // A frozen COPY: the durable row object is not handed out, so a
      // caller cannot mutate-through into the durable read model…
      const durable = await world.port.latest(IDENTITY)
      expect(durable).toBeDefined()
      expect(authority.rules).not.toBe(durable?.state.rules)
      expect(authority.provenance).not.toBe(durable?.provenance)
      // …and even if a caller ignored the freeze, the medium is behind the
      // port and stays untouched.
      const mutated = authority as unknown as { generation?: number }
      expect(() => {
        'use strict'
        mutated.generation = 99
      }).toThrow()
    } finally {
      world.destroy()
    }
  })

  it('reaching `append` through the injected seam throws, and both reads still succeed', async () => {
    const world = await openWorld('proj-append-guard')
    try {
      await world.port.append(snapshotInput(1))
      const seam = recordedReadPort(world.port)
      // The guard fires on a write attempt — probed on a THROWAWAY wrapper
      // so the probe itself never pollutes the projection seam's walk.
      const probe = recordedReadPort(world.port)
      expect(() => (probe.overlay as unknown as Record<string, unknown>)['append']).toThrow(
        /read projection reached port member "append"/,
      )
      const projection = createPermissionReadProjection({ overlay: seam.overlay })

      const authority = await projection.readAuthority(IDENTITY)
      const history = await projection.readHistoryAudit(IDENTITY)

      expect(authority.present).toBe(true)
      expect(history.entries).toHaveLength(1)
      // The walk over the seam touched EXACTLY the two read boundaries.
      expect([...seam.touched].sort()).toEqual(['history', 'latest'])
    } finally {
      world.destroy()
    }
  })
})
