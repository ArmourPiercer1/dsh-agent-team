/**
 * permission-overlay-validation — the persistence-boundary structural gate.
 *
 * What the persistence boundary checks is STRUCTURAL ONLY: the ADR §2 section
 * anatomy, the closed field sets, the id grammars, the generation shape, the
 * chain-link shape and the provenance field shapes. It never asks who the
 * caller is, whether an envelope covers the change, or whether a lane
 * transition is an expansion — those are the future
 * GovernanceMutationService's exclusive job (ADR §1/§6/§7). So a snapshot
 * that is structurally perfect and semantically forbidden MUST pass this gate
 * (proved below: a Leader deny→allow expansion appends cleanly here).
 */

import { describe, expect, it } from 'vitest'

import {
  PERMISSION_OVERLAY_MAX_RULES,
  PERMISSION_OVERLAY_SCHEMA_VERSION,
  PERMISSION_OVERLAY_SNAPSHOT_FIELDS,
  createPermissionOverlaySnapshot,
  deserializePermissionOverlaySnapshot,
  parsePermissionOverlaySnapshot,
  serializePermissionOverlaySnapshot,
} from '../../storage/schema/permission-overlay.js'
import type { PermissionLane } from '../operation-permission/permission-resolver.js'
import {
  FIXTURE_INSTANCE_ID,
  capture,
  cloneRows,
  errorCode,
  fixtureKey,
  openWorld,
  rawOverlayRows,
  snapshotInput,
} from './permission-overlay-helpers.js'

type Case = readonly [string, () => ReturnType<typeof snapshotInput>]

const REJECTED_CASES: readonly Case[] = [
  ['generation 0', () => snapshotInput(0)],
  ['a negative generation', () => snapshotInput(-1)],
  ['a fractional generation', () => snapshotInput(1.5)],
  ['a NaN generation', () => snapshotInput(Number.NaN)],
  ['an unsafe generation', () => snapshotInput(Number.MAX_SAFE_INTEGER + 1)],
  ['a TeamSession id containing whitespace', () => snapshotInput(1, { teamSessionId: 'session root 1' })],
  ['an over-long TeamSession id', () => snapshotInput(1, { teamSessionId: 'x'.repeat(256) })],
  ['an empty TeamSession id', () => snapshotInput(1, { teamSessionId: '' })],
  ['a malformed MemberInstance id', () => snapshotInput(1, { memberInstanceId: 'inst-ALPHA' })],
  ['an instance id without the inst- prefix', () => snapshotInput(1, { memberInstanceId: 'alpha' })],
  ['an empty actor', () => snapshotInput(1, { actor: '' })],
  ['an actor with a control character', () => snapshotInput(1, { actor: 'leader\nroot' })],
  ['an empty mutationId', () => snapshotInput(1, { mutationId: '' })],
  ['a non-ISO timestamp', () => snapshotInput(1, { timestamp: 'yesterday' })],
  ['a reason over the audit bound', () => snapshotInput(1, { reason: 'x'.repeat(513) })],
  ['a reason with a control character', () => snapshotInput(1, { reason: 'note\ttab' })],
  ['a TeamSession id carrying the row-key separator', () => snapshotInput(1, { teamSessionId: 'session-root-1#x' })],
]

describe('permission-overlay structural validation (the persistence boundary)', () => {
  it('carries exactly the ADR §2 sections plus the two mechanical row fields', () => {
    expect([...PERMISSION_OVERLAY_SNAPSHOT_FIELDS].sort()).toEqual([
      'identity',
      'metadata',
      'provenance',
      'schemaVersion',
      'snapshotId',
      'state',
    ])
  })

  it('mirrors the Alpha.2 resolver lane vocabulary (type-level drift guard)', () => {
    // `import type` only: the overlay carrier stays free of any runtime edge
    // to the resolver, while the vocabulary stays compile-time checked.
    const resolverLanes: readonly PermissionLane[] = ['allow', 'ask', 'deny']
    for (const lane of resolverLanes) {
      const rules = [{ operation: 'write', resource: 'output/result.json', effect: lane }]
      expect(() => createPermissionOverlaySnapshot(snapshotInput(1, { rules }))).not.toThrow()
    }
  })

  it.each(REJECTED_CASES)('rejects %s with a typed RECORD_INVALID and writes nothing', async (_label, makeInput) => {
    const world = await openWorld(`validate-${fixtureSlug(_label)}`)
    const rowsBefore = cloneRows(rawOverlayRows(world.dir))
    const failure = await capture(() => world.port.append(makeInput()))
    expect(failure.ok).toBe(false)
    if (!failure.ok) expect(failure.error).toMatchObject({ code: 'RECORD_INVALID' })
    expect(rawOverlayRows(world.dir)).toEqual(rowsBefore)
    world.destroy()
  })

  it('rejects a legacy identity field (vNext has no memberId)', () => {
    const input = snapshotInput(1) as unknown as { identity: Record<string, unknown> }
    const poisoned = { ...input, identity: { ...input.identity, memberId: 'legacy-1' } }
    let caught: unknown
    try {
      createPermissionOverlaySnapshot(poisoned as never)
    } catch (error) {
      caught = error
    }
    expect(errorCode(caught)).toBe('LEGACY_MEMBER_ID_REJECTED')
  })

  it('rejects an effect outside the closed lane set', () => {
    expect(() =>
      createPermissionOverlaySnapshot(
        snapshotInput(1, { rules: [{ operation: 'write', resource: 'a', effect: 'maybe' as 'allow' }] }),
      ),
    ).toThrow()
  })

  it('rejects an unknown rule field (the rule record is closed)', () => {
    const poisoned = {
      ...snapshotInput(1),
      state: { rules: [{ operation: 'write', resource: 'a', effect: 'allow', precedence: 1 }] },
    }
    expect(() => createPermissionOverlaySnapshot(poisoned as never)).toThrow()
  })

  it('rejects a duplicate (operation, resource) pair (the row would be ambiguous)', () => {
    expect(() =>
      createPermissionOverlaySnapshot(
        snapshotInput(1, {
          rules: [
            { operation: 'write', resource: 'output/result.json', effect: 'allow' },
            { operation: 'write', resource: 'output/result.json', effect: 'deny' },
          ],
        }),
      ),
    ).toThrow()
  })

  it(`bounds the rule set structurally (PERMISSION_OVERLAY_MAX_RULES = ${String(PERMISSION_OVERLAY_MAX_RULES)})`, () => {
    const over = Array.from({ length: PERMISSION_OVERLAY_MAX_RULES + 1 }, (_unused, index) => ({
      operation: 'write',
      resource: `output/file-${String(index)}.json`,
      effect: 'allow' as const,
    }))
    expect(() => createPermissionOverlaySnapshot(snapshotInput(1, { rules: over }))).toThrow()
    const atLimit = Array.from({ length: PERMISSION_OVERLAY_MAX_RULES }, (_unused, index) => ({
      operation: 'write',
      resource: `output/file-${String(index)}.json`,
      effect: 'allow' as const,
    }))
    expect(() => createPermissionOverlaySnapshot(snapshotInput(1, { rules: atLimit }))).not.toThrow()
  })

  it('accepts an empty rule set (a revoke-shaped snapshot is just data here)', async () => {
    const world = await openWorld('validate-empty-rules')
    const snapshot = await world.port.append(snapshotInput(1, { rules: [] }))
    expect(snapshot.state.rules).toEqual([])
    world.destroy()
  })

  it('does NOT police semantics: a deny→allow expansion appends cleanly at this boundary', async () => {
    const world = await openWorld('validate-no-envelope-check')
    await world.port.append(
      snapshotInput(1, { rules: [{ operation: 'write', resource: 'output/result.json', effect: 'deny' }] }),
    )
    // Whether deny -> allow needs envelope permission is ADR §6, PR3's
    // GovernanceMutationService. The persistence layer must accept the row.
    const expanded = await world.port.append(
      snapshotInput(2, { rules: [{ operation: 'write', resource: 'output/result.json', effect: 'allow' }] }),
    )
    expect(expanded.state.rules).toEqual([{ operation: 'write', resource: 'output/result.json', effect: 'allow' }])
    expect(await world.port.latest(world.identity)).toEqual(expanded)
    world.destroy()
  })

  it('preserves provenance verbatim (no normalization, no actor rewriting)', async () => {
    const world = await openWorld('validate-provenance-verbatim')
    const appended = await world.port.append(
      snapshotInput(1, { actor: 'human:operator-ü', reason: 'operator decision — 批注', mutationId: 'mut-unicode-1' }),
    )
    expect(appended.provenance).toEqual({
      actor: 'human:operator-ü',
      mutationId: 'mut-unicode-1',
      timestamp: '2026-10-01T12:00:00.000Z',
      reason: 'operator decision — 批注',
    })
    expect((await world.port.latest(world.identity))?.provenance.reason).toBe('operator decision — 批注')
    world.destroy()
  })

  it('freezes the returned snapshot (the record is a value, not a mutable view)', async () => {
    const world = await openWorld('validate-frozen-record')
    const snapshot = await world.port.append(snapshotInput(1))
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.metadata)).toBe(true)
    expect(Object.isFrozen(snapshot.state.rules)).toBe(true)
    expect(() => {
      ;(snapshot.metadata as { generation: number }).generation = 99
    }).toThrow(TypeError)
    world.destroy()
  })

  it('stamps its own row version and rejects a foreign version or an unknown field', () => {
    const snapshot = createPermissionOverlaySnapshot(snapshotInput(7, { rules: [] }))
    expect(snapshot.schemaVersion).toBe(PERMISSION_OVERLAY_SCHEMA_VERSION)
    const foreign = JSON.parse(serializePermissionOverlaySnapshot(snapshot)) as Record<string, unknown>
    foreign['schemaVersion'] = 99
    expect(() => parsePermissionOverlaySnapshot(foreign)).toThrow()
    const unknownField = JSON.parse(serializePermissionOverlaySnapshot(snapshot)) as Record<string, unknown>
    unknownField['resolverHint'] = 'allow'
    expect(() => parsePermissionOverlaySnapshot(unknownField)).toThrow()
    const movedId = JSON.parse(serializePermissionOverlaySnapshot(snapshot)) as Record<string, unknown>
    movedId['snapshotId'] = 'someone-elses-row'
    expect(() => parsePermissionOverlaySnapshot(movedId)).toThrow()
  })

  it('round-trips canonical bytes (serialize -> deserialize -> serialize)', () => {
    const snapshot = createPermissionOverlaySnapshot(snapshotInput(7, { rules: [] }))
    const bytes = serializePermissionOverlaySnapshot(snapshot)
    expect(serializePermissionOverlaySnapshot(deserializePermissionOverlaySnapshot(bytes))).toBe(bytes)
    expect(deserializePermissionOverlaySnapshot(bytes)).toEqual(snapshot)
    expect(() => deserializePermissionOverlaySnapshot('{')).toThrow()
    expect(fixtureKey(7)).toContain(snapshot.metadata.generation === 7 ? '#7' : '#')
  })

  it('never mutates the caller’s input object', async () => {
    const world = await openWorld('validate-no-input-mutation')
    const input = snapshotInput(1)
    const before = JSON.stringify(input)
    await world.port.append(input)
    expect(JSON.stringify(input)).toBe(before)
    expect(FIXTURE_INSTANCE_ID).toBe('inst-alpha')
    world.destroy()
  })
})

/** A scratch-dir-safe slug for one case label. */
function fixtureSlug(label: string): string {
  return label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
}
