/**
 * permission-overlay-append — Alpha.3 PR1 plan test 1 ("append snapshot").
 *
 * Proves the durable append of one PermissionOverlaySnapshot over the REAL
 * file-backed storage seam: the four ADR §2 sections round-trip byte-for-byte
 * through the medium, an identical re-append is an idempotent no-op, and
 * snapshots of different identities (TeamSession / MemberInstance) never see
 * each other.
 *
 * Scope guard: no resolver, no assembler, no notification, no mutation
 * authority — this is the persistence foundation only.
 */

import { describe, expect, it } from 'vitest'

import {
  PERMISSION_OVERLAY_DOMAIN_NAME,
  PERMISSION_OVERLAY_SCHEMA_VERSION,
  PERMISSION_OVERLAY_STORE,
} from '../../storage/schema/permission-overlay.js'
import {
  FIXTURE_INSTANCE_ID,
  FIXTURE_TEAM_SESSION_ID,
  OTHER_INSTANCE_ID,
  OTHER_TEAM_SESSION_ID,
  capture,
  cloneRows,
  fixtureKey,
  openWorld,
  rawOverlayRows,
  snapshotInput,
} from './permission-overlay-helpers.js'

describe('permission-overlay append (PR1 plan test 1)', () => {
  it('appends one snapshot and reads it back with the four ADR §2 sections intact', async () => {
    const world = await openWorld('append-roundtrip')
    const appended = await world.port.append(snapshotInput(1))

    expect(appended.identity).toEqual({
      teamSessionId: FIXTURE_TEAM_SESSION_ID,
      memberInstanceId: FIXTURE_INSTANCE_ID,
    })
    expect(appended.state.rules).toEqual([{ operation: 'write', resource: 'output/result.json', effect: 'allow' }])
    expect(appended.metadata).toEqual({ generation: 1, previousSnapshotId: null })
    expect(appended.provenance).toEqual({
      actor: 'leader:inst-root',
      mutationId: 'mut-1',
      timestamp: '2026-10-01T12:00:00.000Z',
      reason: 'fixture generation 1',
    })
    expect(appended.schemaVersion).toBe(PERMISSION_OVERLAY_SCHEMA_VERSION)
    expect(appended.snapshotId).toBe(fixtureKey(1))

    expect(await world.port.latest(world.identity)).toEqual(appended)
    world.destroy()
  })

  it('writes one durable row into the overlay store of the overlay domain', async () => {
    const world = await openWorld('append-one-row')
    const appended = await world.port.append(snapshotInput(1))

    const rows = rawOverlayRows(world.dir)
    expect(Object.keys(rows)).toEqual([appended.snapshotId])
    // Canonical-bytes discipline: the stored text is the snapshot itself,
    // field for field (no silent normalization on write).
    expect(JSON.parse(rows[appended.snapshotId]!)).toEqual({
      schemaVersion: PERMISSION_OVERLAY_SCHEMA_VERSION,
      snapshotId: appended.snapshotId,
      identity: appended.identity,
      state: appended.state,
      metadata: appended.metadata,
      provenance: appended.provenance,
    })
    world.destroy()
  })

  it('is idempotent for the identical snapshot at the same generation (no second row, no rewrite)', async () => {
    const world = await openWorld('append-idempotent')
    const input = snapshotInput(1)
    const first = await world.port.append(input)
    const rowsAfterFirst = cloneRows(rawOverlayRows(world.dir))

    const second = await world.port.append(input)
    expect(second).toEqual(first)
    expect(rawOverlayRows(world.dir)).toEqual(rowsAfterFirst)
    expect((await world.port.history(world.identity)).map((s) => s.metadata.generation)).toEqual([1])
    world.destroy()
  })

  it('keeps MemberInstances of one TeamSession apart (no cross-instance read)', async () => {
    const world = await openWorld('append-per-instance')
    await world.port.append(snapshotInput(1))
    await world.port.append(snapshotInput(1, { memberInstanceId: OTHER_INSTANCE_ID, actor: 'human:operator' }))

    const alpha = await world.port.latest({ teamSessionId: FIXTURE_TEAM_SESSION_ID, memberInstanceId: FIXTURE_INSTANCE_ID })
    const beta = await world.port.latest({ teamSessionId: FIXTURE_TEAM_SESSION_ID, memberInstanceId: OTHER_INSTANCE_ID })
    expect(alpha?.identity.memberInstanceId).toBe(FIXTURE_INSTANCE_ID)
    expect(beta?.identity.memberInstanceId).toBe(OTHER_INSTANCE_ID)
    expect(beta?.provenance.actor).toBe('human:operator')
    expect(await world.port.history({ teamSessionId: FIXTURE_TEAM_SESSION_ID, memberInstanceId: OTHER_INSTANCE_ID })).toHaveLength(1)
    expect(Object.keys(rawOverlayRows(world.dir))).toHaveLength(2)
    world.destroy()
  })

  it('keeps TeamSessions apart for the same instance id (no cross-team read)', async () => {
    const world = await openWorld('append-per-team')
    await world.port.append(snapshotInput(1))
    await world.port.append(snapshotInput(1, { teamSessionId: OTHER_TEAM_SESSION_ID, mutationId: 'mut-other-team' }))

    const mine = await world.port.history({ teamSessionId: FIXTURE_TEAM_SESSION_ID, memberInstanceId: FIXTURE_INSTANCE_ID })
    const theirs = await world.port.history({ teamSessionId: OTHER_TEAM_SESSION_ID, memberInstanceId: FIXTURE_INSTANCE_ID })
    expect(mine.map((s) => s.provenance.mutationId)).toEqual(['mut-1'])
    expect(theirs.map((s) => s.provenance.mutationId)).toEqual(['mut-other-team'])
    world.destroy()
  })

  it('reports no authority and an empty history for an identity that has no snapshot', async () => {
    const world = await openWorld('append-empty')
    expect(await world.port.latest({ teamSessionId: FIXTURE_TEAM_SESSION_ID, memberInstanceId: OTHER_INSTANCE_ID })).toBeUndefined()
    expect(await world.port.history({ teamSessionId: OTHER_TEAM_SESSION_ID, memberInstanceId: OTHER_INSTANCE_ID })).toEqual([])
    world.destroy()
  })

  it('rejects a structurally invalid append WITHOUT writing a row', async () => {
    const world = await openWorld('append-invalid')
    const failure = await capture(() => world.port.append(snapshotInput(1, { actor: '' })))
    expect(failure.ok).toBe(false)
    if (!failure.ok) expect(failure.error).toMatchObject({ code: 'RECORD_INVALID' })
    // The medium still exists (the store initialized on open) with zero rows.
    expect(rawOverlayRows(world.dir)).toEqual({})
    world.destroy()
  })

  it('chains TWO generations on a MAX-length identity (the snapshot-id bound must be derived)', async () => {
    // Contract bound: a snapshotId is DERIVED as
    //   teamSessionId + '#' + memberInstanceId + '#' + generation
    // so its bound must be the sum of the component maxima (the session-id
    // maximum + one separator + the instance-id maximum + one separator + the
    // digits of the largest legal generation), never a hand-picked number. A
    // hand-picked bound BELOW that sum breaks a legal max-length identity at
    // generation 2: generation 1 appends (previousSnapshotId null), but its
    // own derived key exceeds the bound, so generation 2's
    // previousSnapshotId — naming a row that IS durable — is necessarily
    // rejected and the chain can never advance past its first snapshot.
    const longestTeamSessionId = 'session-root-'.padEnd(255, 'x')
    const longestInstanceId = `inst-${'0'.repeat(32)}`
    expect(longestTeamSessionId).toHaveLength(255)
    expect(longestInstanceId).toHaveLength(37)

    const world = await openWorld('append-max-identity-chain')
    const identity = { teamSessionId: longestTeamSessionId, memberInstanceId: longestInstanceId }
    const first = await world.port.append(snapshotInput(1, identity))
    expect(first.snapshotId).toBe(`${longestTeamSessionId}#${longestInstanceId}#1`)
    expect(first.metadata.previousSnapshotId).toBeNull()

    const second = await world.port.append(snapshotInput(2, identity))
    expect(second.metadata.previousSnapshotId).toBe(first.snapshotId)
    expect((await world.port.latest(identity))?.metadata.generation).toBe(2)
    expect((await world.port.history(identity)).map((s) => s.metadata.generation)).toEqual([1, 2])
    world.destroy()
  })

  it('names the overlay domain and store exactly (the durable placement contract)', async () => {
    const world = await openWorld('append-placement')
    expect(PERMISSION_OVERLAY_DOMAIN_NAME).toBe('team_permission_overlay')
    expect(PERMISSION_OVERLAY_STORE).toBe('permission_overlays')
    expect(world.store.name).toBe(PERMISSION_OVERLAY_DOMAIN_NAME)
    expect(world.store.repository.store).toBe(PERMISSION_OVERLAY_STORE)
    expect(world.store.schemaVersion).toBe(PERMISSION_OVERLAY_SCHEMA_VERSION)
    world.destroy()
  })
})
