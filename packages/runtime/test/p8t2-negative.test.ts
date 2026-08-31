/**
 * P8-T2 mandatory test 5 — NEGATIVE surface (TaskDoc §11.9 P8-T2; DevPlan
 * §21.2).
 *
 * S7 (the §21.2 red line, by construction AND by test): a successful
 *     projection reads the durable source exactly once and NEVER touches a
 *     child Session log. The port interface ({@link TeamDomainReadPort})
 *     exposes ONLY `readProjectionSource` — there is no log-read surface on
 *     the type, so the fold cannot reach a child log even in principle. The
 *     fake additionally carries a NON-interface trap (`__readChildLog`) that
 *     increments `childLogReadCount`; the trap must stay 0.
 *
 * S8 — unknown lifecycle (`'ZOMBIE'`) is rejected by the FROZEN P8-T1 DTO
 *     (`isTeamContractError` true, code `MALFORMED_DTO`) — the service adds no
 *     second error vocabulary for field-level malformations.
 * S9 — a non-leader row missing its durable `childSessionId` is rejected by
 *     the DTO (`MALFORMED_DTO`).
 * S10 — an unknown `admission` value is rejected by the DTO (`MALFORMED_DTO`).
 * S11 — a member whose effective workspace is UNRESOLVABLE (member row AND
 *     team default both absent) is a SERVICE-level error: a
 *     {@link ProjectionError} with the closed code
 *     `PROJECTION_MEMBER_WORKSPACE_UNRESOLVED` (asserted via
 *     {@link assertProjectionCode}).
 *
 * Mock-first (ruling R28): the TeamDomain source port is a fake (with the
 * red-line trap); the service and the pure fold are REAL.
 *
 * Top-level pattern (plain-node shim): each scenario runs at module top level
 * and captures its outcome; `it` bodies assert only over the captures.
 *
 * @module @dsh-agent-team/runtime/test/p8t2-negative
 */

import { describe, expect, it } from 'vitest'
import { isTeamContractError } from '../../contracts/src/index.js'
import type {
  TeamDomainProjectionSource,
  TeamRootFacts,
} from '../projection/index.js'
import { isProjectionError } from '../projection/index.js'
import {
  assertProjectionCode,
  createP8T2World,
  makeSource,
  rawLeaderMember,
  rawMember,
} from './p8t2-helpers.js'

interface Rejection {
  readonly threw: boolean
  readonly isTeamContractError: boolean
  readonly teamContractCode: string | undefined
  readonly isProjectionError: boolean
  readonly projectionCode: string | undefined
  readonly message: string
  readonly rawError: unknown
}

function captureRejection(run: () => unknown): Rejection {
  try {
    run()
    return {
      threw: false,
      isTeamContractError: false,
      teamContractCode: undefined,
      isProjectionError: false,
      projectionCode: undefined,
      message: '',
      rawError: undefined,
    }
  } catch (error) {
    if (isTeamContractError(error)) {
      return {
        threw: true,
        isTeamContractError: true,
        teamContractCode: error.code,
        isProjectionError: false,
        projectionCode: undefined,
        message: error.message,
        rawError: error,
      }
    }
    if (isProjectionError(error)) {
      return {
        threw: true,
        isTeamContractError: false,
        teamContractCode: undefined,
        isProjectionError: true,
        projectionCode: error.code,
        message: error.message,
        rawError: error,
      }
    }
    return {
      threw: true,
      isTeamContractError: false,
      teamContractCode: undefined,
      isProjectionError: false,
      projectionCode: undefined,
      message: error instanceof Error ? error.message : String(error),
      rawError: error,
    }
  }
}

interface CleanProjectionSnapshot {
  readonly readCount: number
  readonly childLogReadCount: number
  readonly isFrozen: boolean
}

let s7: CleanProjectionSnapshot | undefined
let s8: Rejection | undefined
let s9: Rejection | undefined
let s10: Rejection | undefined
let s11: Rejection | undefined

{
  // S7 — a clean projection reads the durable source once and never a log.
  const source = makeSource({ memberCount: 3 })
  const world = createP8T2World({ source, overlay: null })
  const projection = world.service.project(source.teamSessionId)
  s7 = {
    readCount: world.domain.readCount,
    childLogReadCount: world.domain.childLogReadCount,
    isFrozen: Object.isFrozen(projection),
  }
}

{
  // S8 — unknown lifecycle on a non-leader row.
  const badLifecycleMember = { ...rawMember(1), lifecycle: 'ZOMBIE' } as unknown as ReturnType<
    typeof rawMember
  >
  s8 = captureRejection(() => {
    const source = makeSource({ members: [rawLeaderMember(), badLifecycleMember] })
    const world = createP8T2World({ source, overlay: null })
    world.service.project(source.teamSessionId)
  })
}

{
  // S9 — a non-leader row missing its durable childSessionId.
  const noChild = rawMember(1)
  delete (noChild as unknown as Record<string, unknown>).childSessionId
  s9 = captureRejection(() => {
    const source = makeSource({ members: [rawLeaderMember(), noChild] })
    const world = createP8T2World({ source, overlay: null })
    world.service.project(source.teamSessionId)
  })
}

{
  // S10 — an unknown admission value on the root.
  s10 = captureRejection(() => {
    const source = makeSource({
      root: { admission: 'ZOMBIE_ADMISSION' } as unknown as Partial<TeamRootFacts>,
    })
    const world = createP8T2World({ source, overlay: null })
    world.service.project(source.teamSessionId)
  })
}

{
  // S11 — a member with no resolvable effective workspace (member row AND the
  // team default are both absent). Built by taking a valid source and
  // dropping the team default workspace.
  const base = makeSource({
    members: [rawLeaderMember({ workspace: '/ws/p8t2-leader' }), rawMember(1)],
  })
  const noDefaultSource: TeamDomainProjectionSource = {
    ...base,
    defaultWorkspace: undefined,
  }
  s11 = captureRejection(() => {
    const world = createP8T2World({ source: noDefaultSource, overlay: null })
    world.service.project(noDefaultSource.teamSessionId)
  })
}

describe('P8-T2 red line: the projection never reads a child Session log (§21.2)', () => {
  it('S7.1: a successful projection reads the durable source exactly once and no log', () => {
    if (s7 === undefined) throw new Error('S7 did not run')
    expect(s7.readCount).toBe(1)
    expect(s7.childLogReadCount).toBe(0)
  })

  it('S7.2: the produced projection is frozen (a pure DTO, not a live handle)', () => {
    if (s7 === undefined) throw new Error('S7 did not run')
    expect(s7.isFrozen).toBe(true)
  })
})

describe('P8-T2 malformed inputs are rejected by the frozen P8-T1 DTO surface', () => {
  it('S8: an unknown lifecycle (ZOMBIE) → isTeamContractError, code MALFORMED_DTO', () => {
    if (s8 === undefined) throw new Error('S8 did not run')
    expect(s8.threw).toBe(true)
    expect(s8.isTeamContractError).toBe(true)
    expect(s8.teamContractCode).toBe('MALFORMED_DTO')
    expect(s8.isProjectionError).toBe(false)
  })

  it('S9: a non-leader missing its childSessionId → isTeamContractError, code MALFORMED_DTO', () => {
    if (s9 === undefined) throw new Error('S9 did not run')
    expect(s9.threw).toBe(true)
    expect(s9.isTeamContractError).toBe(true)
    expect(s9.teamContractCode).toBe('MALFORMED_DTO')
  })

  it('S10: an unknown admission value → isTeamContractError, code MALFORMED_DTO', () => {
    if (s10 === undefined) throw new Error('S10 did not run')
    expect(s10.threw).toBe(true)
    expect(s10.isTeamContractError).toBe(true)
    expect(s10.teamContractCode).toBe('MALFORMED_DTO')
  })
})

describe('P8-T2 the one service-level invariant: effective workspace resolution', () => {
  it('S11: an unresolvable workspace → ProjectionError(MEMBER_WORKSPACE_UNRESOLVED)', () => {
    if (s11 === undefined) throw new Error('S11 did not run')
    expect(s11.threw).toBe(true)
    expect(s11.isProjectionError).toBe(true)
    expect(s11.isTeamContractError).toBe(false)
    assertProjectionCode(s11.rawError, 'PROJECTION_MEMBER_WORKSPACE_UNRESOLVED')
    expect(s11.projectionCode).toBe('PROJECTION_MEMBER_WORKSPACE_UNRESOLVED')
  })
})
