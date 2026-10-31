/**
 * Alpha.6 PR-I1a (Lane 2) — the durable `ReviewAssignment` writer, driven through the REAL ledger.
 *
 * WHY THIS FILE DRIVES `LedgerRepository` AND NOT A HAND-MADE PORT DOUBLE. The claims PR-I1a makes are about
 * durability: a row that survives a restart, a sequence that is allocated on the one write chain, a crash that
 * leaves a state the next attempt can reason about. None of those claims can be measured against a double that
 * agrees to behave that way. So every leg below runs the writer against `packages/storage`'s own
 * `LedgerRepository`, opened through `createTeamDomain`/`openTeamDomain` over `p4-helpers`'
 * `InMemoryStorageSeam` — the fake that implements the public `StorageDomainSeam` contract exactly, per-domain,
 * with committed-byte inspection and write-count crash injection. That is C1: real durable code, contract-exact
 * medium, deterministic. It is NOT a real Host run — C2 stays ENV_BLOCK, and nothing below is offered as one.
 *
 * The legs are grouped by the six things the ruling requires this PR to cover, in that order: persistence and
 * recovery; epoch/CAS/idempotency/conflict/write-failure; ownership, isolation and corruption; identity and
 * rebuild; attribution-never-authority; and the fallback rule that an unprovable condition is not a permission.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { parseRootSessionId } from '../../contracts/src/index.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/stores.js'
import { createTeamDomain, openTeamDomain } from '../../storage/repositories/team-domain.js'
import type { TeamDomain } from '../../storage/repositories/team-domain.js'
import {
  InMemoryStorageSeam,
  P4_FIXTURE,
  ledgerEntryRecord,
  teamSessionInput,
} from '../../storage/test/p4-helpers.js'

import {
  REVIEW_ASSIGNMENT_WRITE_REFUSALS,
  applyReviewAssignment,
} from '../review-assignment/writer.js'
import type {
  ReviewAssignmentCommand,
  ReviewAssignmentLedgerRow,
  ReviewAssignmentLockPort,
  ReviewAssignmentRowDraft,
  ReviewAssignmentStoreDeps,
  ReviewAssignmentWriteResult,
} from '../review-assignment/writer.js'
import { maySubmitFor } from '../review-assignment/facts.js'
import { REVIEW_ASSIGNMENT_FACT_TYPES, REVIEW_ASSIGNMENT_REFUSALS } from '../review-assignment/types.js'
import { REVIEW_ASSIGNMENT_PAYLOAD_FIELDS } from '../review-assignment/facts.js'
import type { ReviewAssignmentPayload } from '../review-assignment/facts.js'

const RUNTIME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTRACTS_COMMON = join(RUNTIME_ROOT, '..', 'contracts', 'src', 'dto', 'common.ts')

/** Every refusal this file actually observed, collected rather than assumed. */
const observedRefusals = new Set<string>()
/** Every acceptance kind this file actually observed. */
const observedApplied = new Set<string>()

/**
 * The adapter from the writer's port onto the real repository. `schemaVersion` and the branded root are added
 * HERE, which is the point of the split: the lane does not know the storage schema, and this is the thin
 * composition piece the `ArtifactLedgerPort` precedent expects to exist outside the lane.
 */
function ledgerPort(domain: TeamDomain) {
  return {
    allocateSequence: (): Promise<number> => domain.repositories.ledger.allocateSequence(),
    put: (draft: ReviewAssignmentRowDraft): Promise<unknown> =>
      domain.repositories.ledger.put({
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        sequence: draft.sequence,
        rootSessionId: parseRootSessionId(draft.rootSessionId),
        factType: draft.factType,
        payload: draft.payload as unknown as Record<string, string | number | null>,
        createdAt: draft.createdAt,
      }),
    list: (): readonly ReviewAssignmentLedgerRow[] =>
      domain.repositories.ledger.list().map((entry) => ({
        sequence: entry.sequence,
        rootSessionId: entry.rootSessionId,
        factType: entry.factType,
        payload: entry.payload,
      })),
  }
}

/** A per-root FIFO lock, non-reentrant, with the holds recorded so the discipline is assertable. */
function lockPort(): { readonly port: ReviewAssignmentLockPort; readonly holds: string[]; heldFor(): number } {
  const tails = new Map<string, Promise<void>>()
  const holds: string[] = []
  let depth = 0
  let maxDepth = 0
  return {
    holds,
    heldFor: () => maxDepth,
    port: {
      withLock<T>(root: string, critical: () => Promise<T>): Promise<T> {
        holds.push(root)
        const previous = tails.get(root) ?? Promise.resolve()
        let release!: () => void
        tails.set(root, new Promise<void>((resolve) => (release = resolve)))
        return previous.then(async () => {
          depth += 1
          maxDepth = Math.max(maxDepth, depth)
          try {
            return await critical()
          } finally {
            depth -= 1
            release()
          }
        })
      },
    },
  }
}

interface Harness {
  readonly seam: InMemoryStorageSeam
  readonly domain: TeamDomain
  readonly lock: ReturnType<typeof lockPort>
  readonly deps: ReviewAssignmentStoreDeps
  readonly root: string
  readonly familyRows: () => readonly ReviewAssignmentLedgerRow[]
  reopen: () => Promise<Harness>
  clock: (iso: string | (() => string)) => void
}

async function harness(
  options: { readonly root?: string; readonly seedSession?: boolean } = {},
): Promise<Harness> {
  const root = options.root ?? (P4_FIXTURE.rootSessionId as string)
  const seam = new InMemoryStorageSeam()
  const domain = await createTeamDomain(seam)
  // `seedSession: false` is the state round 1 of #517 needed and this harness could not express: a root that is a
  // legal root session id, that the writer accepts, and that names NO TeamSession row. That is precisely where
  // the ledger makes the row durable and then fails to stamp the generation, so it is the only way to drive the
  // third answer of the writer's three-answer law.
  if (options.seedSession !== false) {
    await domain.repositories.teamSessions.put(teamSessionInput(parseRootSessionId(root)))
  }
  return build(seam, domain, root)

  async function build(seam: InMemoryStorageSeam, domain: TeamDomain, rootSessionId: string): Promise<Harness> {
    let nowValue = '2026-10-31T09:00:00Z'
    const lock = lockPort()
    const deps: ReviewAssignmentStoreDeps = {
      ledger: ledgerPort(domain),
      lock: lock.port,
      now: () => (typeof nowValue === 'function' ? (nowValue as unknown as () => string)() : nowValue),
    }
    return {
      seam,
      domain,
      lock,
      deps,
      root: rootSessionId,
      familyRows: () =>
        ledgerPort(domain)
          .list()
          .filter((row) => Object.values<string>(REVIEW_ASSIGNMENT_FACT_TYPES).includes(row.factType)),
      reopen: async () => {
        await domain.close()
        return build(seam, await openTeamDomain(seam), rootSessionId)
      },
      clock: (iso) => {
        nowValue = iso as string
      },
    }
  }
}

function command(overrides: Partial<ReviewAssignmentCommand> = {}): ReviewAssignmentCommand {
  return {
    kind: 'created',
    rootSessionId: P4_FIXTURE.rootSessionId as string,
    approvalCaseId: 'approval-case-1',
    currentLegRequestId: 'leg-request-1',
    target: { kind: 'instance', instanceId: 'inst-alpha' },
    reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
    basedOnCaseVersion: 'case-version-1',
    actorCallerRef: 'caller:leader',
    ...overrides,
  }
}

/** Run one command and record what it answered, so the refusal census below is measured. */
async function run(deps: ReviewAssignmentStoreDeps, overrides: Partial<ReviewAssignmentCommand> = {}): Promise<ReviewAssignmentWriteResult> {
  const result = await applyReviewAssignment(deps, command(overrides))
  if (result.ok) observedApplied.add(result.applied)
  else observedRefusals.add(result.refusal)
  return result
}

/** Seed a row of this family straight into the ledger, bypassing the writer — for corruption and ownership. */
async function seedRow(
  domain: TeamDomain,
  root: string,
  payload: Record<string, unknown>,
  factType: string = REVIEW_ASSIGNMENT_FACT_TYPES.created,
): Promise<number> {
  const sequence = await domain.repositories.ledger.allocateSequence()
  await domain.repositories.ledger.put(
    ledgerEntryRecord(sequence, root, { factType, payload }) as Parameters<TeamDomain['repositories']['ledger']['put']>[0],
  )
  return sequence
}

const VALID_PAYLOAD: ReviewAssignmentPayload = {
  rootSessionId: P4_FIXTURE.rootSessionId as string,
  approvalCaseId: 'approval-case-1',
  currentLegRequestId: 'leg-request-1',
  targetKind: 'instance',
  targetInstanceId: 'inst-alpha',
  assignmentEpoch: 1,
  previousEpoch: 0,
  reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
  basedOnCaseVersion: 'case-version-1',
  actorCallerRef: 'caller:leader',
}

// --- 1. persistence and recovery -------------------------------------------------------------------

describe('PR-I1a durable persistence and recovery', () => {
  it('writes the created row into the real ledger, at a real sequence, with the real fact type', async () => {
    const world = await harness()
    const result = await run(world.deps)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.applied).toBe('written')
    expect(result.sequence).toBe(1)
    expect(result.factType).toBe('review-assignment-created')
    expect(result.assignmentEpoch).toBe(1)

    const rows = world.familyRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.sequence).toBe(1)
    // Read the bytes back out of the durable store, not out of the writer's own return value.
    const stored = world.domain.repositories.ledger.list()[0]
    expect(stored?.factType).toBe('review-assignment-created')
    expect((stored?.payload as Record<string, unknown>)['previousEpoch']).toBe(0)
    expect((stored?.payload as Record<string, unknown>)['assignmentEpoch']).toBe(1)
  })

  it('advances team_sessions.generation the way every other ledger row does', async () => {
    // S1-A hook A: a NEW ledger entry durably advances the session generation after the entry write. If this
    // writer's rows did not participate, they would be invisible to every consumer that notices change by
    // generation — which is the honest test of "this is a ledger row", not of "this returned ok".
    const world = await harness()
    const before = world.domain.repositories.teamSessions.get(world.root)?.generation ?? 0
    await run(world.deps)
    expect(world.domain.repositories.teamSessions.get(world.root)?.generation).toBe(before + 1)
  })

  it('carries create, transfer and retire through epoch 1, 2 and 3 in sequence order', async () => {
    const world = await harness()
    const created = await run(world.deps)
    const transferred = await run(world.deps, { kind: 'transferred', target: { kind: 'leader' }, reasonCode: 'LEADER_GLOBAL_INFORMATION_NEEDED' })
    const retired = await run(world.deps, { kind: 'retired', target: { kind: 'leader' }, reasonCode: 'OFFICER_UNAVAILABLE' })
    expect([created.ok, transferred.ok, retired.ok]).toEqual([true, true, true])
    if (!created.ok || !transferred.ok || !retired.ok) return
    expect([created.assignmentEpoch, transferred.assignmentEpoch, retired.assignmentEpoch]).toEqual([1, 2, 3])
    expect(world.familyRows().map((row) => row.factType)).toEqual([
      'review-assignment-created',
      'review-assignment-transferred',
      'review-assignment-retired',
    ])
    expect(retired.state.live).toBe(false)
    expect(retired.state.epochApplied).toBe(3)
    expect(retired.state.diagnostics).toEqual([])
  })

  it('rebuilds the same state from the ledger after close and re-open', async () => {
    const world = await harness()
    await run(world.deps)
    await run(world.deps, { kind: 'transferred', target: { kind: 'leader' } })

    const reopened = await world.reopen()
    const rows = reopened.familyRows()
    expect(rows.map((row) => row.sequence)).toEqual([1, 2])

    // A fresh writer, a fresh process-equivalent: the state it computes comes out of the durable rows alone.
    const probe = await run(reopened.deps, { kind: 'retired', target: { kind: 'leader' } })
    expect(probe.ok).toBe(true)
    if (!probe.ok) return
    expect(probe.assignmentEpoch).toBe(3)
    expect(probe.state.assignment?.target).toEqual({ kind: 'leader' })
  })

  it('reports a replay after a restart as already-applied, at the ORIGINAL sequence', async () => {
    // This is the crash-recovery idempotency the ruling asks for: the caller retried because it never learned
    // the first write landed. It must not double-write, and it must be told which row is the durable answer.
    const world = await harness()
    const first = await run(world.deps)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const reopened = await world.reopen()
    const replay = await run(reopened.deps)
    expect(replay.ok).toBe(true)
    if (!replay.ok) return
    expect(replay.applied).toBe('already')
    expect(replay.sequence).toBe(first.sequence)
    expect(reopened.familyRows()).toHaveLength(1)
  })
})

// --- 2. epoch, CAS, idempotency, conflict, write failure ---------------------------------------------

describe('PR-I1a epoch discipline and failure honesty', () => {
  it('short-circuits an immediate replay without touching the ledger again', async () => {
    const world = await harness()
    const first = await run(world.deps)
    const writesAfterFirst = world.seam.writeCount
    const replay = await run(world.deps)
    expect(first.ok && replay.ok).toBe(true)
    if (!first.ok || !replay.ok) return
    expect(replay.applied).toBe('already')
    expect(replay.sequence).toBe(first.sequence)
    expect(world.seam.writeCount, 'a replay must not perform a single durable write').toBe(writesAfterFirst)
    expect(world.familyRows()).toHaveLength(1)
  })

  it('does not mistake a different decision for a replay', async () => {
    // Same target, different reason: not the same command, and reporting it as `already` would quietly lose
    // the second decision's audit trail. The kernel's ALREADY_ACTIVE is the truthful answer.
    const world = await harness()
    await run(world.deps)
    const other = await run(world.deps, { reasonCode: 'AWAITING_EVIDENCE' })
    expect(other.ok).toBe(false)
    if (other.ok) return
    expect(other.refusal).toBe('REVIEW_ASSIGNMENT_ALREADY_ACTIVE')
    expect(world.familyRows()).toHaveLength(1)
  })

  it('serialises two concurrent identical commands into one write and one already', async () => {
    const world = await harness()
    const [a, b] = await Promise.all([run(world.deps), run(world.deps)])
    const outcomes = [a, b].map((result) => (result.ok ? result.applied : result.refusal)).sort()
    expect(outcomes).toEqual(['already', 'written'])
    expect(world.familyRows()).toHaveLength(1)
    const sequences = [a, b].map((result) => (result.ok ? result.sequence : -1))
    expect(new Set(sequences)).toEqual(new Set([1]))
  })

  it('gives two concurrent mutations different epochs instead of the same one', async () => {
    // Both transfers are legal decisions, so the law this leg pins is not "one of them loses" — it is that the
    // serialisation produced two DIFFERENT epochs with a hole-free history, and that exactly one handler stands
    // at the end. Two rows at epoch 2 is the failure this cannot allow, because A-2's staleness test reads the
    // epoch as a version token.
    const world = await harness()
    await run(world.deps)
    const [first, second] = await Promise.all([
      run(world.deps, { kind: 'transferred', target: { kind: 'instance', instanceId: 'inst-beta' } }),
      run(world.deps, { kind: 'transferred', target: { kind: 'leader' } }),
    ])
    expect([first.ok, second.ok]).toEqual([true, true])
    const epochs = [first, second].map((result) => (result.ok ? result.assignmentEpoch : -1)).sort()
    expect(epochs).toEqual([2, 3])
    expect(world.familyRows().map((row) => (row.payload as Record<string, unknown>)['assignmentEpoch'])).toEqual([1, 2, 3])
    expect(new Set(world.familyRows().map((row) => row.sequence)).size).toBe(3)
    // Whichever of the two landed last is current, and naming IT — read out of the durable rows rather than
    // assumed from the order the promises were started — is the only way this leg stays deterministic.
    const lastEpochRow = world.familyRows().reduce((best, row) =>
      ((row.payload as Record<string, unknown>)['assignmentEpoch'] as number) > ((best.payload as Record<string, unknown>)['assignmentEpoch'] as number) ? row : best)
    const currentTarget = (lastEpochRow.payload as Record<string, unknown>)['targetKind'] === 'leader'
      ? { kind: 'leader' as const }
      : { kind: 'instance' as const, instanceId: String((lastEpochRow.payload as Record<string, unknown>)['targetInstanceId']) }
    // Two truthful answers to "assign the target that is already current", and the writer must tell them
    // apart. Re-issuing the SAME decision — same target, same leg, same reason, same case version — is what a
    // caller does after losing the response, so it answers `already` at the row that already carries it: the
    // payload IS the identity, and there is no fact left that could distinguish the two. Change the reason,
    // and it becomes a NEW decision the kernel refuses as TARGET_UNCHANGED, because a different reason for an
    // unchanged target is a claim the ledger must not record silently.
    const duplicate = await run(world.deps, { kind: 'transferred', target: currentTarget })
    expect(duplicate.ok).toBe(true)
    if (duplicate.ok) {
      expect(duplicate.applied).toBe('already')
      expect(duplicate.sequence).toBe(lastEpochRow.sequence)
    }
    const differentReason = await run(world.deps, { kind: 'transferred', target: currentTarget, reasonCode: 'AWAITING_EVIDENCE' })
    expect(differentReason.ok, 'an unchanged target under a new reason must not create a fourth epoch').toBe(false)
    if (!differentReason.ok) expect(differentReason.refusal).toBe('REVIEW_ASSIGNMENT_TARGET_UNCHANGED')
    expect(world.familyRows()).toHaveLength(3)
  })

  it('says which half failed when the ledger cannot allocate a sequence', async () => {
    const world = await harness()
    world.seam.setCrashAfterWrites(world.seam.writeCount)
    const result = await run(world.deps)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED')
    expect(result.detail).toContain('allocate')
    expect(world.familyRows()).toHaveLength(0)
  })

  it('names the spent sequence when the row write fails after allocation, and the retry rolls forward', async () => {
    // The failure mode this leg exists for is the one an append-only ledger cannot undo. The refusal must say a
    // sequence was spent and no row exists at it, and the next attempt must be able to succeed on top of it.
    const world = await harness()
    await run(world.deps) // the counter row now exists, so the next crash can land on the entry write
    const spent = world.seam.writeCount + 1
    world.seam.setCrashAfterWrites(spent)
    const failed = await run(world.deps, { kind: 'transferred', target: { kind: 'leader' } })
    expect(failed.ok).toBe(false)
    if (failed.ok) return
    expect(failed.refusal).toBe('REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED')
    expect(failed.detail).toMatch(/allocated .*no assignment row exists/)
    // ...and the sentence is now earned: the writer re-read the ledger before claiming the gap exists.
    expect(failed.detail).toContain('re-read')
    const gapSequence = Number(/sequence (\d+) was allocated/.exec(failed.detail)?.[1])
    expect(Number.isSafeInteger(gapSequence)).toBe(true)
    expect(world.domain.repositories.ledger.list().some((row) => row.sequence === gapSequence)).toBe(false)

    world.seam.clearCrash()
    const retry = await run(world.deps, { kind: 'transferred', target: { kind: 'leader' } })
    expect(retry.ok).toBe(true)
    if (!retry.ok) return
    expect(retry.applied).toBe('written')
    expect(retry.sequence).toBeGreaterThan(gapSequence)
    expect(retry.assignmentEpoch).toBe(2)
    // The gap is visible, not silently closed: the ledger holds sequences 1 and 3, and the fold is intact.
    expect(world.familyRows().map((row) => row.sequence)).toEqual([1, 3])
    expect(retry.state.diagnostics).toEqual([])
  })

  it('refuses a sequence the ledger cannot have meant', async () => {
    for (const bad of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const world = await harness()
      const deps: ReviewAssignmentStoreDeps = {
        ...world.deps,
        ledger: { ...ledgerPort(world.domain), allocateSequence: async () => bad },
      }
      const result = await run(deps)
      expect(result.ok, `sequence ${String(bad)} accepted`).toBe(false)
      if (result.ok) continue
      expect(result.refusal).toBe('REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED')
      expect(world.familyRows()).toHaveLength(0)
    }
  })

  it('refuses a row that came back different, and does not pretend to take it back', async () => {
    const world = await harness()
    const inner = ledgerPort(world.domain)
    const deps: ReviewAssignmentStoreDeps = {
      ...world.deps,
      ledger: {
        ...inner,
        put: (draft) =>
          inner.put({ ...draft, payload: { ...draft.payload, reasonCode: 'REWRITTEN_BY_THE_MEDIUM' } }),
      },
    }
    const result = await run(deps)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_ASSIGNMENT_READBACK_MISMATCH')
    // No rollback exists in this storage layer, and the refusal must not imply one: the tampered row IS there.
    expect(world.familyRows()).toHaveLength(1)
    expect((world.familyRows()[0]?.payload as Record<string, unknown>)['reasonCode']).toBe('REWRITTEN_BY_THE_MEDIUM')
  })

  it('reports an unreadable clock before allocating anything', async () => {
    // The middle four are the shapes a structural pattern lets through: month 13, the 45th day, February the
    // 30th, and a second that does not exist. The durable layer rejects all four, and the leg below proves the
    // writer refuses them BEFORE allocating, so no sequence is spent on a stamp that cannot be stored.
    for (const bad of ['', 'yesterday', '2026-13-45T99:99:99Z', '2026-10-31', '2026-10-31T09:00:00',
      '2026-02-30T00:00:00Z', '2026-04-31T00:00:00Z', '2026-10-31T09:00:60Z']) {
      const world = await harness()
      world.clock(bad)
      const writes = world.seam.writeCount
      const result = await run(world.deps)
      expect(result.ok, `${JSON.stringify(bad)} accepted`).toBe(false)
      if (result.ok) continue
      expect(result.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_CLOCK_UNREADABLE')
      expect(world.seam.writeCount).toBe(writes)
      expect(world.familyRows()).toHaveLength(0)
    }
  })
})

// --- 3. ownership, isolation, corruption ---------------------------------------------------------------

describe('PR-I1a ledger ownership, cross-team isolation and corrupt rows', () => {
  it('keeps two teams that share a case id from sharing a fold', async () => {
    const world = await harness()
    const other = P4_FIXTURE.otherRootSessionId as string
    // A ledger row durably advances its team session's generation, so the other team needs a session record of
    // its own before it can hold a row. Seeding it here is the same precondition the Host creates when it opens
    // a second Team; without it the shared-medium test would measure a missing row, not an isolation rule.
    await world.domain.repositories.teamSessions.put(teamSessionInput(parseRootSessionId(other)))
    const firstTeam = await run(world.deps)
    const secondTeam = await run(world.deps, { rootSessionId: other })
    expect(firstTeam.ok && secondTeam.ok).toBe(true)
    if (!secondTeam.ok) return
    // Both are epoch 1 at their own sequence: the second team's rows must not move this team's epoch, and the
    // second team's write must not be blocked by the first team having one.
    expect(secondTeam.assignmentEpoch).toBe(1)
    expect(world.familyRows().filter((row) => row.rootSessionId === world.root)).toHaveLength(1)
    expect(world.familyRows().filter((row) => row.rootSessionId === other)).toHaveLength(1)
    expect((world.familyRows()[0]?.payload as Record<string, unknown>)['rootSessionId']).toBe(world.root)
  })

  it('cannot see a reader that hides a row, and says so on the port instead of pretending otherwise', async () => {
    // The fold is done "from the ledger" — which is only a guarantee if the port delivers the ledger. Round 1
    // wrapped the real repository in a filter that dropped one row and the writer accepted a second live
    // assignment into the same epoch: the CAS did not fail, it had nothing to conflict with. That is an adapter
    // bug, not something this module can detect from its seat, so the consequence is measured and the obligation
    // is stated where an adapter author will read it.
    const world = await harness()
    const first = await run(world.deps)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const inner = ledgerPort(world.domain)
    const hiding: ReviewAssignmentStoreDeps = {
      ...world.deps,
      ledger: { ...inner, list: () => inner.list().filter((row) => row.sequence !== first.sequence) },
    }
    const blind = await run(hiding)
    expect(blind.ok).toBe(true) // the finding, measured: a shorter ledger is just a shorter ledger
    if (!blind.ok) return
    expect(world.familyRows().map((row) => row.sequence)).toEqual([1, 2])
    const epochs = new Set(
      world.familyRows().map((row) => (row.payload as unknown as ReviewAssignmentPayload).assignmentEpoch),
    )
    expect([...epochs]).toEqual([1]) // two live rows, one epoch — the CAS never had a second epoch to refuse

    // The same command over the true ledger is refused, which is what makes the difference the port's.
    const honest = await applyReviewAssignment(world.deps, command())
    expect(honest.ok).toBe(false)

    // And the contract sentence that carries this obligation is pinned, because an unpinned doc sentence is a
    // claim nobody runs.
    const source = readFileSync(join(RUNTIME_ROOT, 'review-assignment', 'writer.ts'), 'utf8')
    expect(source).toMatch(/unfiltered, un-truncated, non-stale read is part of this port's contract/)
  })

  it('refuses to write when a row filed under this root names another team', async () => {
    const world = await harness()
    const foreign = { ...VALID_PAYLOAD, rootSessionId: P4_FIXTURE.otherRootSessionId }
    const sequence = await seedRow(world.domain, world.root as string, foreign as unknown as Record<string, unknown>)

    const result = await run(world.deps, { kind: 'transferred', target: { kind: 'leader' } })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_CROSS_TEAM_ROW')
    expect(result.detail).toContain(`review-assignment-created@${String(sequence)}`)
    expect(world.familyRows()).toHaveLength(1) // the foreign row stays; reporting it never hides it
  })

  it('refuses on an unreconciled fold and names the diagnostic that made it unreconciled', async () => {
    const world = await harness()
    // An authority-bearing key is the kernel's most serious payload offence, and the durable consequence is
    // the same as any other unreadable row: nothing may be written on top of a fold that may be missing an
    // assignment. The detail names WHICH code, because the three causes want three different repairs.
    await seedRow(world.domain, world.root as string, { ...VALID_PAYLOAD, authorityEnvelope: { kind: 'grant' } } as unknown as Record<string, unknown>)

    const result = await run(world.deps, { kind: 'transferred', target: { kind: 'leader' } })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED')
    expect(result.detail).toContain('REVIEW_ASSIGNMENT_')
    expect(world.familyRows()).toHaveLength(1)
  })

  it('names which rows it refused to fold, and stops short of dumping the ledger', async () => {
    // Ten bad rows is the shape that turns a helpful message into an unbounded one. The refusal must carry
    // enough handles to start repairing, plus a count of the rest, so a caller can tell "ten rows" from
    // "ten rows and the message gave up".
    const world = await harness()
    const sequences: number[] = []
    for (let index = 0; index < 10; index += 1) {
      sequences.push(await seedRow(world.domain, world.root as string, {
        ...VALID_PAYLOAD,
        [`unknownField${String(index)}`]: 'x',
      } as unknown as Record<string, unknown>))
    }
    const result = await run(world.deps)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED')
    const created = REVIEW_ASSIGNMENT_FACT_TYPES.created
    expect(result.detail).toContain(`${created}@${String(sequences[0])}`)
    expect(result.detail).toContain(`${created}@${String(sequences[7])}`)
    expect(result.detail).not.toContain(`${created}@${String(sequences[8])}`)
    expect(result.detail).toContain('+2 more')
    expect(result.detail.length, 'a refusal is not a log dump').toBeLessThan(1200)
  })

  it('does not copy the control fold\'s habit of dropping a row it cannot read', async () => {
    // `control/service.ts:1801-1812` silently skips a known fact type whose payload will not parse. A-7 forbids
    // that here, and the leg that matters is the one where the row LOOKS clean: a sequence that went backwards
    // must produce a diagnostic and a refusal, not a shorter history.
    const world = await harness()
    await seedRow(world.domain, world.root as string, { ...VALID_PAYLOAD, unknownField: 'x' } as unknown as Record<string, unknown>)
    const result = await run(world.deps)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED')
  })

  it('gives two cases under one team independent epochs and independent targets', async () => {
    const world = await harness()
    const caseA = await run(world.deps)
    const caseB = await run(world.deps, { approvalCaseId: 'approval-case-2', target: { kind: 'instance', instanceId: 'inst-beta' } })
    expect(caseA.ok && caseB.ok).toBe(true)
    if (!caseB.ok) return
    expect(caseB.assignmentEpoch).toBe(1)
    expect(caseB.state.assignment?.approvalCaseId).toBe('approval-case-2')
    const transferA = await run(world.deps, { kind: 'transferred', target: { kind: 'leader' } })
    expect(transferA.ok).toBe(true)
    if (!transferA.ok) return
    expect(transferA.state.assignment?.approvalCaseId).toBe('approval-case-1')
    expect(transferA.state.epochApplied).toBe(2)
    expect(caseB.state.epochApplied).toBe(1)
  })

  it('refuses a root that is not a root session id, before taking the lock', async () => {
    const world = await harness()
    // `''` is not in this list on purpose: an empty id is refused one check earlier, as a malformed command,
    // and a leg that lumps the two would hide the fact that the door check runs before the parser.
    // `assertSessionIdValue` checks three things — a string, no whitespace or control characters, and a length
    // bound — so these four are exactly the shapes it rejects. The leg proves that against the parser itself
    // before it asks the writer anything, because a list of strings someone believed would be rejected is the
    // weakest kind of test there is, and I found that out by writing one.
    const rejectedByTheParser = ['not a root id', 'session root 1', 'x'.repeat(300), 'session\u0000id']
    for (const bad of rejectedByTheParser) {
      expect(() => parseRootSessionId(bad), `${JSON.stringify(bad)} actually mints — this list is stale`).toThrow()
      const result = await run(world.deps, { rootSessionId: bad })
      expect(result.ok, `${JSON.stringify(bad)} accepted`).toBe(false)
      if (result.ok) continue
      expect(result.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_ROOT_UNMINTABLE')
    }
    // A NUL is the interesting one: the contract's root-session parser is not the same screen as this lane's id
    // grammar, so the string can be mintable and still unusable, and the refusal that comes back is the kernel's
    // `INPUT_MALFORMED`. The claim that survives both screens is the one worth pinning: an id either screen
    // rejects produces no row. Asserting one code for both screens would just be a guess about which fired.
    expect(world.lock.holds).toEqual([])
    expect(world.familyRows()).toHaveLength(0)
  })

  it('proves a root is an id, not that the team exists — and says which of the two it checked', async () => {
    // `session/../../etc` MINTS: the contract's session-id grammar allows slashes, and nothing in this lane
    // resolves a path anyway — `rootSessionId` is a row key, not a filename, and the seam treats it as a key.
    // The leg exists to keep that honest rather than to hide it: what the writer proves is "this string is a
    // root session id", and what it does NOT prove is "this team is one the Host knows". That second fact is
    // the caller's, and PR-I1b's admission path is the place that must supply it, because it is the only layer
    // that has ever seen a TeamSession. A writer that invented the second check would be inventing a fact.
    expect(() => parseRootSessionId('session/../../etc')).not.toThrow()
    const world = await harness()
    const slash = await run(world.deps, { rootSessionId: 'session/../../etc' })
    expect(slash.ok).toBe(false)
    if (slash.ok) return
    // Three screens stand between a string and a durable row, and this id stops at the middle one: the
    // contract's session-id rule lets a slash through, the lane's own id grammar (which is the payload's) does
    // not. Naming the screen that bites is the point — `WRITE_ROOT_UNMINTABLE` would claim the contract
    // rejected it, and the next reader would go looking for a parser bug that is not there.
    expect(slash.refusal, 'the lane grammar, not the contract parser, is what rejects a slash here').not.toBe(
      'REVIEW_ASSIGNMENT_WRITE_ROOT_UNMINTABLE',
    )
    expect(slash.refusal).toBe('REVIEW_ASSIGNMENT_INPUT_MALFORMED')
    expect(world.familyRows()).toHaveLength(0)
  })

  it('says the truth about what is durable when the append lands and the stamp fails', async () => {
    // Round 1 of #517 drove a legal root that names no TeamSession row and found the writer claiming "no
    // assignment row exists at that sequence" about a row that WAS there, then answering `already` on the retry —
    // one command, two mutually exclusive claims. Both halves of the pair are pinned here, together with the
    // sentence that used to be a lie.
    const root = 'session-root-9'
    const world = await harness({ root, seedSession: false })
    const failed = await run(world.deps, { rootSessionId: root })
    expect(failed.ok).toBe(false)
    if (failed.ok) return
    expect(failed.refusal).toBe('REVIEW_ASSIGNMENT_ROW_DURABLE')
    expect(failed.detail).toMatch(/row this command wrote IS durable at that sequence \(review-assignment-created@1/)
    expect(failed.detail).not.toMatch(/no assignment row exists/)
    expect(world.familyRows().map((row) => row.sequence)).toEqual([1])

    // And the answer agrees with the bytes it refuses to contradict: the retry recognises the durable row.
    const retry = await run(world.deps, { rootSessionId: root })
    expect(retry.ok).toBe(true)
    if (!retry.ok) return
    expect(retry.applied).toBe('already')
    expect(retry.sequence).toBe(1)
  })

  it('answers with a refusal rather than an exception when even the re-read fails', async () => {
    // The law this PR is named for is "a refusal is an answer", and the fix for F1 introduced a NEW call that
    // can fail: the re-read inside the catch. A reader port that throws when asked twice would otherwise turn
    // the answer to "did my row land?" into an exception escaping the module, which is the one thing the header
    // forbids. So the re-read is guarded, and what comes back says the thing that is actually true: unknown.
    const root = 'session-root-9'
    const world = await harness({ root, seedSession: false })
    const inner = ledgerPort(world.domain)
    let lists = 0
    const deps: ReviewAssignmentStoreDeps = {
      ...world.deps,
      ledger: {
        ...inner,
        list: () => {
          lists += 1
          if (lists > 1) throw new Error('reader unavailable after the write attempt')
          return inner.list()
        },
      },
    }
    // No crash switch needed: the missing TeamSession row makes the write's own generation stamp throw, and
    // the second read — the one this writer added to answer honestly — is the one this reader refuses.
    const result = await run(deps, { rootSessionId: root })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_ASSIGNMENT_DURABLE_STATE_UNKNOWN')
    expect(result.detail).toMatch(/could not be re-read/)
    expect(result.detail).toContain('reader unavailable after the write attempt')
    expect(result.detail).toMatch(/MAY be durable/)
    // The claim is that the module answers, not that it answers correctly-under-ignorance: the row IS there,
    // and the next command over a working reader finds it as `already`.
    expect(world.familyRows().map((row) => row.sequence)).toEqual([1])
    const retry = await run(world.deps, { rootSessionId: root })
    expect(retry.ok).toBe(true)
    if (!retry.ok) return
    expect(retry.applied).toBe('already')
  })

  it('will not certify a row it did not write, when the append landed and the stamp failed', async () => {
    // Round 2 of #517, finding F-R2-1. Round 1 made this branch look before it speaks; it looked at the SEQUENCE
    // ALONE (`find(row => row.sequence === sequence)`), while the success path forty lines below asks a stricter
    // question — same family, same root, same payload. The failure path was the one place in the module that
    // answered a durability question without asking whose row it had found, and the medium this spec already
    // admits proves the state is reachable: the same payload difference that answers READBACK_MISMATCH over a
    // healthy session answered ROW_DURABLE — plus a promise that a retry "will be recognised as already
    // applied" — once the stamp also failed. The retry then refused ALREADY_ACTIVE.
    const root = 'session-root-9'
    const world = await harness({ root, seedSession: false })
    const inner = ledgerPort(world.domain)
    const deps: ReviewAssignmentStoreDeps = {
      ...world.deps,
      ledger: {
        ...inner,
        put: (draft) =>
          inner.put({ ...draft, payload: { ...draft.payload, reasonCode: 'REWRITTEN_BY_THE_MEDIUM' } }),
      },
    }
    const failed = await run(deps, { rootSessionId: root })
    expect(failed.ok).toBe(false)
    if (failed.ok) return
    expect(failed.refusal).toBe('REVIEW_ASSIGNMENT_READBACK_MISMATCH')
    expect(failed.detail).toMatch(/is not the row this command wrote/)
    expect(failed.detail).not.toMatch(/IS durable/)
    expect(failed.detail).not.toMatch(/recognised as already applied/)
    // And the row stays, as it does everywhere else in this module: no refusal here implies a take-back.
    expect(world.familyRows()).toHaveLength(1)
  })

  it('will not name a row of another family on another root as this durable row', async () => {
    // An append that never lands, in front of a reader that obeys the port contract EXACTLY — the whole ledger,
    // in sequence order, unfiltered — so whatever sits at the allocated sequence belongs to someone else. Matching
    // on sequence alone called that "this command's row IS durable … a retry will be recognised as already
    // applied", then answered the same refusal forever. Nothing in the module was asking whether the row it found
    // was this family's, this root's, or this command's.
    const root = 'session-root-9'
    const world = await harness({ root })
    const inner = ledgerPort(world.domain)
    const foreign: ReviewAssignmentLedgerRow = {
      sequence: 1,
      rootSessionId: 'session-root-2',
      factType: 'control-leg-decided',
      payload: { decision: 'deny' },
    }
    const deps: ReviewAssignmentStoreDeps = {
      ...world.deps,
      ledger: {
        ...inner,
        put: () => Promise.reject(new Error('seam refused the append')),
        list: () => [foreign],
      },
    }
    const failed = await run(deps, { rootSessionId: root })
    expect(failed.ok).toBe(false)
    if (failed.ok) return
    expect(failed.refusal).toBe('REVIEW_ASSIGNMENT_READBACK_MISMATCH')
    expect(failed.refusal).not.toBe('REVIEW_ASSIGNMENT_ROW_DURABLE')
    expect(failed.detail).toContain('control-leg-decided@1')
    expect(failed.detail).toContain('session-root-2')
    expect(failed.detail).not.toMatch(/recognised as already applied/)
  })

  it('answers with a refusal instead of an exception at EVERY read of the injected ledger', async () => {
    // Round 1's no-escape rule ("a call that throws while answering 'did my row land?' must not escape") is
    // applied at one of this module's four reads of `list()`. Round 2 drove the others and found them escaping as
    // exceptions on a corrupt row — including the read-back after a SUCCESSFUL append, which is the same question
    // asked at the sibling site with no branch at all. All four are driven here, each with the read that fails
    // named, and the law asserted is the strong one: nothing throws at the caller, whatever the answer is.
    const root = 'session-root-9'
    const cases = [
      { name: 'the fold read before allocation', failAt: 1, seedSession: false, code: 'REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED' },
      { name: 'the re-read after a failed append', failAt: 2, seedSession: false, code: 'REVIEW_ASSIGNMENT_DURABLE_STATE_UNKNOWN' },
      { name: 'the read-back after a successful append', failAt: 2, seedSession: true, code: 'REVIEW_ASSIGNMENT_DURABLE_STATE_UNKNOWN' },
      { name: 'the state read after a verified row', failAt: 3, seedSession: true, code: 'REVIEW_ASSIGNMENT_ROW_DURABLE' },
    ] as const
    for (const one of cases) {
      const world = await harness({ root, seedSession: one.seedSession })
      const inner = ledgerPort(world.domain)
      let lists = 0
      const deps: ReviewAssignmentStoreDeps = {
        ...world.deps,
        ledger: {
          ...inner,
          list: () => {
            lists += 1
            if (lists === one.failAt) throw new Error(`reader corrupt at read ${String(one.failAt)}`)
            return inner.list()
          },
        },
      }
      let thrown: unknown = null
      let result: ReviewAssignmentWriteResult | undefined
      try {
        result = await run(deps, { rootSessionId: root })
      } catch (error) {
        thrown = error
      }
      expect(thrown, `${one.name} let an exception escape the module`).toBeNull()
      expect(result, `${one.name} produced no answer`).toBeDefined()
      if (result === undefined || result.ok) throw new Error(`${one.name} did not answer with a refusal`)
      expect(result.refusal, `${one.name} answered ${result.refusal}`).toBe(one.code)
      expect(result.detail).toContain(`reader corrupt at read ${String(one.failAt)}`)
    }
  })

  it('carries the medium code into the refusal instead of the word "object"', async () => {
    // INFO-1: `describe` rendered any non-`Error` throw as `typeof error`, so a composed adapter that rejects
    // with `{ code: 'RECORD_DUPLICATE', problem: 'duplicate-ledger-entry' }` produced a refusal reading "the row
    // write failed (object)" — the string is what an operator reads, and it was thrown away at exactly the moment
    // it was wanted.
    const root = 'session-root-9'
    const world = await harness({ root })
    const inner = ledgerPort(world.domain)
    const hostile = { code: 'RECORD_DUPLICATE', problem: 'duplicate-ledger-entry' }
    const deps: ReviewAssignmentStoreDeps = {
      ...world.deps,
      ledger: { ...inner, put: () => Promise.reject(hostile) },
    }
    const failed = await run(deps, { rootSessionId: root })
    expect(failed.ok).toBe(false)
    if (failed.ok) return
    expect(failed.detail).toContain('RECORD_DUPLICATE')
    expect(failed.detail).toContain('duplicate-ledger-entry')
    expect(failed.detail).not.toContain('(object)')
  })

  it('sees an omission that breaks the epoch chain, and is blind only to one that does not — and the blind spot costs more than disclosed', async () => {
    // INFO-2. The port contract said the writer "cannot detect an omission", which is over-universal: hide a MIDDLE
    // row of a real chain and the epoch CAS convicts the reader (EPOCH_CONFLICT, folded into
    // WRITE_FOLD_UNRECONCILED). The shape it genuinely cannot see is a SUFFIX, and the consequence there is worse
    // than the "two live rows in one epoch" this file disclosed: the writer mints the next sequence claiming an
    // epoch that is already durable, and the case is unwritable from then on.
    const world = await harness()
    const created = await run(world.deps)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const transferred = await run(world.deps, { kind: 'transferred', target: { kind: 'leader' } })
    expect(transferred.ok).toBe(true)
    if (!transferred.ok) return
    const real = world.familyRows().map((row) => row.sequence)
    expect(real).toEqual([1, 2])
    const inner = ledgerPort(world.domain)

    // Middle row hidden: the chain breaks, so the fold refuses. Detected.
    const middle: ReviewAssignmentStoreDeps = {
      ...world.deps,
      ledger: { ...inner, list: () => inner.list().filter((row) => row.sequence !== 1) },
    }
    const caughtByChain = await run(middle, { kind: 'transferred', target: { kind: 'leader' } })
    expect(caughtByChain.ok).toBe(false)
    if (caughtByChain.ok) return
    expect(caughtByChain.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED')
    expect(caughtByChain.detail).toContain('REVIEW_ASSIGNMENT_EPOCH_CONFLICT')

    // Suffix hidden: the writer sees a one-row ledger, mints epoch 2 at sequence 3, and calls it `written`.
    const suffix: ReviewAssignmentStoreDeps = {
      ...world.deps,
      ledger: { ...inner, list: () => inner.list().filter((row) => row.sequence !== 2) },
    }
    const blind = await run(suffix, { kind: 'transferred', target: { kind: 'leader' } })
    expect(blind.ok).toBe(true) // the boundary, measured
    if (!blind.ok) return
    expect(blind.assignmentEpoch).toBe(2)
    expect(world.familyRows().map((row) => row.sequence)).toEqual([1, 2, 3])

    // And what that costs: over the TRUE ledger the case is now permanently unwritable, because sequence 3 claims
    // an epoch sequence 2 already claimed. This is the sentence the port contract has to carry.
    const after = await applyReviewAssignment(world.deps, command({ kind: 'transferred', target: { kind: 'leader' } }))
    expect(after.ok).toBe(false)
    if (after.ok) return
    expect(after.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED')
    expect(after.detail).toContain('REVIEW_ASSIGNMENT_EPOCH_CONFLICT')

    const source = readFileSync(join(RUNTIME_ROOT, 'review-assignment', 'writer.ts'), 'utf8')
    expect(source).toMatch(/blind to a suffix it is never shown/)
    expect(source).toMatch(/permanently unwritable/)
  })

  it('produces four different durability claims from four different codes, and the header names four', async () => {
    // F-R2-4. The header used to enumerate three answers and the fix for F1 added a fourth state while leaving it
    // at three, so the sentence was both false and unpinned. This leg is the pin: it drives one state per code,
    // asserts no two states share a code, and greps the header for the claim each code carries. The vocabulary
    // census pins the NAMES; this pins that a name means one thing, which is what a caller switch-ing on the
    // closed set is actually reading.
    const root = 'session-root-9'
    const arms: readonly { readonly code: string; readonly claim: RegExp; readonly deps: (w: Harness) => ReviewAssignmentStoreDeps; readonly seed: boolean }[] = [
      {
        code: 'REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED',
        claim: /no assignment row exists at that sequence/,
        seed: false,
        deps: (w) => {
          const inner = ledgerPort(w.domain)
          return { ...w.deps, ledger: { ...inner, put: () => Promise.reject(new Error('append refused')), list: () => [] } }
        },
      },
      {
        code: 'REVIEW_ASSIGNMENT_ROW_DURABLE',
        claim: /row this command wrote IS durable at that sequence/,
        seed: false,
        // No port tampering: a root that names no TeamSession row is enough, which is the point of F1.
        deps: (w) => w.deps,
      },
      {
        code: 'REVIEW_ASSIGNMENT_READBACK_MISMATCH',
        claim: /is not the row this command wrote/,
        seed: false,
        deps: (w) => {
          const inner = ledgerPort(w.domain)
          return {
            ...w.deps,
            ledger: { ...inner, put: (d) => inner.put({ ...d, payload: { ...d.payload, reasonCode: 'REWRITTEN_BY_THE_MEDIUM' } }) },
          }
        },
      },
      {
        code: 'REVIEW_ASSIGNMENT_DURABLE_STATE_UNKNOWN',
        claim: /MAY be durable at that sequence and it MAY be absent/,
        seed: false,
        deps: (w) => {
          const inner = ledgerPort(w.domain)
          let lists = 0
          return {
            ...w.deps,
            ledger: {
              ...inner,
              list: () => {
                lists += 1
                if (lists > 1) throw new Error('reader unavailable after the write attempt')
                return inner.list()
              },
            },
          }
        },
      },
    ]
    const codes = new Set<string>()
    for (const arm of arms) {
      const world = await harness({ root, seedSession: arm.seed })
      const failed = await run(arm.deps(world), { rootSessionId: root })
      expect(failed.ok, `${arm.code} answered accepted`).toBe(false)
      if (failed.ok) return
      expect(failed.refusal, `expected ${arm.code}`).toBe(arm.code)
      expect(failed.detail).toMatch(arm.claim)
      codes.add(failed.refusal)
    }
    expect(codes.size).toBe(arms.length)

    const source = readFileSync(join(RUNTIME_ROOT, 'review-assignment', 'writer.ts'), 'utf8')
    expect(source).not.toMatch(/which of three things happened/)
    for (const phrase of [
      'nothing this command did is durable',
      'IS durable at that sequence',
      'is not the row this command wrote',
      'MAY be durable at that sequence and it MAY be absent',
    ]) {
      expect(source, `the header no longer states: ${phrase}`).toContain(phrase)
    }
    expect(source).toMatch(/four durability claims/)
  })

  it('refuses a malformed command before touching the ledger or the lock', async () => {
    const world = await harness()
    // The fourth entry is the confusion this file's first draft actually made in the writer: a fact-type VALUE
    // passed where the KEY belongs. It must be refused, not tolerated, because a row written under a value is a
    // row whose kind field means something the encoder never declared.
    const badKinds = ['deleted', '', 'REVIEW-ASSIGNMENT-CREATED', 'created ', 'review-assignment-created']
    const writesAtDoor = world.seam.writeCount
    for (const kind of badKinds) {
      const result = await run(world.deps, { kind: kind as ReviewAssignmentCommand['kind'] })
      expect(result.ok, `kind ${JSON.stringify(kind)} accepted`).toBe(false)
      if (result.ok) continue
      expect(result.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_COMMAND_MALFORMED')
    }
    expect(world.lock.holds, 'a kind the door check can see must not reach the ledger').toEqual([])
    expect(world.seam.writeCount).toBe(writesAtDoor)
    // Two refusal sites, and the leg names both instead of pretending they are one. Shapes the door check can
    // see (a kind outside the three, an empty id) are refused before the lock is taken. Shapes that need the
    // kernel's own id grammar — a whitespace-padded case id — are refused INSIDE the critical section, because
    // the fold that has to happen first requires a stable read, and taking the lock to discover a bad id is
    // correct: it is the write that must not happen, not the read.
    for (const empty of ['', '   ']) {
      const caseId = await run(world.deps, { approvalCaseId: empty })
      const legRequest = await run(world.deps, { currentLegRequestId: empty })
      expect(caseId.ok || legRequest.ok).toBe(false)
      if (caseId.ok || caseId === null) continue
      expect(['REVIEW_ASSIGNMENT_WRITE_COMMAND_MALFORMED', 'REVIEW_ASSIGNMENT_INPUT_MALFORMED']).toContain(caseId.refusal)
      if (!legRequest.ok) {
        expect(['REVIEW_ASSIGNMENT_WRITE_COMMAND_MALFORMED', 'REVIEW_ASSIGNMENT_INPUT_MALFORMED']).toContain(legRequest.refusal)
      }
    }
    expect(world.seam.writeCount, 'a refused command must not perform a durable write').toBe(writesAtDoor)
    expect(world.familyRows()).toHaveLength(0)
    // Door shapes are refused before the lock; only the two whitespace commands reached the critical section.
    // Counting the holds, rather than asserting none, is what keeps this leg honest about both refusal sites.
    expect(world.lock.holds.length, 'only the kernel-grammar refusals may take the lock').toBe(2)
    expect(world.lock.holds.every((root) => root === world.root)).toBe(true)
  })
})

// --- 4. identity and rebuild -------------------------------------------------------------------------

describe('PR-I1a identity pinned to the surfaces that read the rows', () => {
  it('spells createdAt exactly as the contract spells it', async () => {
    // The writer duplicates the contract's ISO rule instead of importing it, which is only safe if the two are
    // the same expression. Read the contract rather than trusting this comment.
    const contracts = readFileSync(CONTRACTS_COMMON, 'utf8')
    const declared = /ISO_8601_TIMESTAMP_PATTERN\s*=\s*(\/[^\n]+\/)/.exec(contracts)
    expect(declared, 'ISO_8601_TIMESTAMP_PATTERN moved or was reformatted — re-read the contract').not.toBeNull()
    const writerSource = readFileSync(join(RUNTIME_ROOT, 'review-assignment', 'writer.ts'), 'utf8')
    const mine = /const CREATED_AT_PATTERN = (\/[^\n]+\/)/.exec(writerSource)
    expect(mine, 'CREATED_AT_PATTERN is no longer a literal in writer.ts').not.toBeNull()
    expect(mine?.[1]).toBe(declared?.[1])
  })

  it('writes rows the frozen category of each fact type still describes as team facts', async () => {
    // The projection surfaces mirror the three literals; PR2′ pins both mirrors against the lane's constants.
    // What this PR adds is the DURABLE half: the strings the writer puts into the ledger are the strings those
    // mirrors were written for, byte for byte, or a row appears in no category at all.
    const world = await harness()
    await run(world.deps)
    await run(world.deps, { kind: 'transferred', target: { kind: 'leader' } })
    await run(world.deps, { kind: 'retired', target: { kind: 'leader' } })
    expect(world.familyRows().map((row) => row.factType).sort()).toEqual(
      ['review-assignment-created', 'review-assignment-retired', 'review-assignment-transferred'].sort(),
    )
    const projection = readFileSync(join(RUNTIME_ROOT, 'src', 'plugin', 'projection-source.ts'), 'utf8')
    for (const factType of ['review-assignment-created', 'review-assignment-transferred', 'review-assignment-retired']) {
      expect(projection, `${factType} is no longer mirrored in the projection source`).toContain(`'${factType}'`)
    }
  })
})

// --- 5. attribution, never authority ----------------------------------------------------------------

describe('PR-I1a writes attribution and cannot write authority', () => {
  it('puts no authority-bearing key in a durable payload', async () => {
    const world = await harness()
    const result = await run(world.deps)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const stored = world.domain.repositories.ledger.list()[0]?.payload as Record<string, unknown>
    const keys = Object.keys(stored).sort()
    // The strongest form of the claim is not a regex over key names, it is equality with the declared field set:
    // nothing outside `REVIEW_ASSIGNMENT_PAYLOAD_FIELDS` may reach the medium, so no key can claim anything the
    // kernel did not declare. The regex is kept on top of it as an independent read of the same bytes.
    expect(keys).toEqual([...REVIEW_ASSIGNMENT_PAYLOAD_FIELDS].sort())
    const authorityLike = keys.filter((key) => /authorit|permission|grant|credential|token|allowed|scope/i.test(key))
    expect(authorityLike).toEqual([])
    // `approvalCaseId` names the case a row is about; it is the one key whose name contains a governance word
    // and the one the kernel mandates, which is why the regex above looks for `authorit` and not `approv`.
    expect(keys).toContain('approvalCaseId')
    expect(stored['actorCallerRef']).toBe('caller:leader')
  })

  it('cannot be talked into an authority field by a caller that supplies one', async () => {
    const world = await harness()
    const deps: ReviewAssignmentStoreDeps = {
      ...world.deps,
      ledger: {
        ...ledgerPort(world.domain),
        put: (draft) => {
          const tainted = { ...draft, payload: { ...draft.payload, authority: 'granted' } as ReviewAssignmentPayload }
          return ledgerPort(world.domain).put(tainted)
        },
      },
    }
    const result = await run(deps)
    // The tampering happens AFTER the kernel encoded the payload, so what must catch it is the read-back: the
    // row that came back is not the row that was written, and that is a refusal, not an acceptance.
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_ASSIGNMENT_READBACK_MISMATCH')
  })
})

// --- 6. an unprovable condition is not a permission ------------------------------------------------------

describe('PR-I1a never infers permission from an empty assignment', () => {
  it('refuses a transfer when no assignment exists, instead of creating one', async () => {
    const world = await harness()
    const result = await run(world.deps, { kind: 'transferred', target: { kind: 'leader' } })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT')
    expect(world.familyRows()).toHaveLength(0)
  })

  it('says no instance may submit against an empty state, at any epoch', async () => {
    const empty = {
      rootSessionId: P4_FIXTURE.rootSessionId as string,
      approvalCaseId: 'approval-case-1',
      assignment: null,
      live: false,
      epochApplied: 0,
      diagnostics: [],
      unreconciled: false,
    } as const
    for (const caller of [
      { instanceId: 'inst-alpha', callerRef: 'caller:a', isLeaderInstance: false },
      { instanceId: null, callerRef: 'caller:none', isLeaderInstance: false },
      { instanceId: 'inst-alpha', callerRef: 'caller:a', isLeaderInstance: true },
    ]) {
      for (const epoch of [0, 1, 7]) {
        const decision = maySubmitFor(empty, caller, epoch)
        expect(decision.ok, `empty state admitted ${caller.callerRef} at epoch ${String(epoch)}`).toBe(false)
      }
    }
  })

  it('leaves a retired case unable to accept any further assignment row', async () => {
    // This leg began as "retire, then create again" and the writer refused, which sent me to the kernel rather
    // than to a fix: `checkAssignmentMutation` admits `created` only when the family has NEVER produced an
    // assignment, and admits `transferred`/`retired` only against a LIVE one. Retirement is therefore terminal
    // per case in the current row vocabulary — a visible limitation of PR2\u2032\u0027s kernel, not a defect of
    // this writer, and not something PR-I1a may paper over by writing a fourth row kind (a fourth kind costs a
    // frozen-category booking plus a mirror on two projection surfaces, and that is a named decision).
    // Recorded in `pri1a-writer-design-20261031.md` as an undecidable and in the PR body as a limitation.
    const world = await harness()
    await run(world.deps)
    const retired = await run(world.deps, { kind: 'retired', target: { kind: 'leader' } })
    expect(retired.ok).toBe(true)
    if (!retired.ok) return
    expect(retired.state.live).toBe(false)

    const reviveByCreate = await run(world.deps, { target: { kind: 'instance', instanceId: 'inst-beta' } })
    expect(reviveByCreate.ok).toBe(false)
    if (reviveByCreate.ok) return
    expect(reviveByCreate.refusal).toBe('REVIEW_ASSIGNMENT_ALREADY_ACTIVE')

    const reviveByTransfer = await run(world.deps, { kind: 'transferred', target: { kind: 'instance', instanceId: 'inst-beta' } })
    expect(reviveByTransfer.ok).toBe(false)
    if (reviveByTransfer.ok) return
    expect(reviveByTransfer.refusal).toBe('REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT')

    // Nothing was written by the attempts, so the durable history is still exactly the two rows.
    expect(world.familyRows()).toHaveLength(2)
    // And a DIFFERENT case under the same team is untouched by that terminality: the terminality is per case,
    // not per team, which is what makes it a rule about a case closing rather than a dead team.
    const otherCase = await run(world.deps, { approvalCaseId: 'approval-case-9', target: { kind: 'instance', instanceId: 'inst-beta' } })
    expect(otherCase.ok).toBe(true)
  })
})

// --- lock discipline and the refusal census --------------------------------------------------------------

describe('PR-I1a the injected lock is load-bearing, and the writer says so by failing', () => {
  it('produces two rows at one epoch when the caller hands it a lock that does not lock', async () => {
    // D-2 says the epoch chain is protected by the caller's lock, NOT by the writer's own re-read, because the
    // ledger offers no compare-and-set: `put` accepts any allocated sequence and the first writer to land wins
    // by arrival, not by version. This leg hands the writer a `withLock` that only records the call, runs two
    // transfers at once, and shows the consequence in the durable rows — two rows both naming
    // `assignmentEpoch: 2, previousEpoch: 1` — and then shows the fold refusing to pretend that is a state.
    //
    // The leg is written as an observation of a hostile caller, not as a bug report about the writer: no
    // plugin-only code can make an append-only ledger atomic, and the honest artefact is the evidence that a
    // non-serialising lock port turns the epoch token into decoration. It is also the reason PR-I1b must route
    // through this writer with the real per-root lock instead of re-implementing the sequence.
    const seam = new InMemoryStorageSeam()
    const domain = await createTeamDomain(seam)
    await domain.repositories.teamSessions.put(teamSessionInput(P4_FIXTURE.rootSessionId))
    const recorded: string[] = []
    const deps: ReviewAssignmentStoreDeps = {
      ledger: ledgerPort(domain),
      lock: {
        withLock<T>(root: string, critical: () => Promise<T>): Promise<T> {
          recorded.push(root)
          return critical()
        },
      },
      now: () => '2026-10-31T09:00:00Z',
    }
    const created = await applyReviewAssignment(deps, command())
    expect(created.ok).toBe(true)
    const [first, second] = await Promise.all([
      applyReviewAssignment(deps, command({ kind: 'transferred', target: { kind: 'instance', instanceId: 'inst-beta' } })),
      applyReviewAssignment(deps, command({ kind: 'transferred', target: { kind: 'leader' } })),
    ])
    expect([first.ok, second.ok], 'both races wrote, which is the point').toEqual([true, true])
    const epochs = ledgerPort(domain)
      .list()
      .map((row) => (row.payload as Record<string, unknown>)['assignmentEpoch'])
    expect(epochs).toEqual([1, 2, 2])
    expect(recorded).toHaveLength(3)

    // And the corruption is not silent: the next fold names the conflict and refuses to build a state from it,
    // so the worst outcome of a caller that skipped the lock is a loud refusal, not a wrong assignment.
    const after = await applyReviewAssignment(deps, command({ kind: 'transferred', target: { kind: 'leader' }, reasonCode: 'AWAITING_EVIDENCE' }))
    expect(after.ok).toBe(false)
    if (after.ok) return
    expect(after.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED')
    expect(after.detail).toContain('REVIEW_ASSIGNMENT_EPOCH_CONFLICT')
    // The detail names the rows it could not apply by sequence, which is the only handle an operator has when
    // the durable history is the artefact that is wrong.
    expect(after.detail).toMatch(/review-assignment-transferred@\d/)
  })
})


describe('PR-I1a lock discipline and refusal vocabulary', () => {
  it('holds the lock exactly once per command, keyed by the minted root, and never nests', async () => {
    const world = await harness()
    await run(world.deps)
    await run(world.deps, { kind: 'transferred', target: { kind: 'leader' } })
    expect(world.lock.holds).toEqual([world.root, world.root])
    expect(world.lock.heldFor(), 'the writer re-entered its own lock').toBe(1)
  })

  it('takes one lock per root, so another team is not queued behind this one', async () => {
    const world = await harness()
    const other = P4_FIXTURE.otherRootSessionId as string
    await world.domain.repositories.teamSessions.put(teamSessionInput(parseRootSessionId(other)))
    await Promise.all([run(world.deps), run(world.deps, { rootSessionId: other })])
    expect(new Set(world.lock.holds)).toEqual(new Set([world.root, other]))
    // Two here is the finding, not a failure: both teams were inside their own critical section at the same
    // moment. A writer that reached for one global lock would report 1, and every team on the host would queue
    // behind whoever happened to be assigning.
    expect(world.lock.heldFor()).toBe(2)
  })

  it('names every refusal it can produce, and produces every refusal it names', () => {
    // A closed set with no census is a list of intentions: PR4's round-4 review proved that by leaving a
    // reason code in the vocabulary and out of every assertion. Same trap, same fix.
    // The declared vocabulary, written out here rather than compared to itself. Round 1 of #517 found this
    // position holding `expect([...SET].sort()).toEqual([...SET].sort())` — true for any value whatsoever, the
    // one statically-dead assertion in the file. A name list a reader can diff against the source is the check.
    expect([...REVIEW_ASSIGNMENT_WRITE_REFUSALS].sort()).toEqual([
      'REVIEW_ASSIGNMENT_DURABLE_STATE_UNKNOWN',
      'REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED',
      'REVIEW_ASSIGNMENT_READBACK_MISMATCH',
      'REVIEW_ASSIGNMENT_ROW_DURABLE',
      'REVIEW_ASSIGNMENT_WRITE_CLOCK_UNREADABLE',
      'REVIEW_ASSIGNMENT_WRITE_COMMAND_MALFORMED',
      'REVIEW_ASSIGNMENT_WRITE_CROSS_TEAM_ROW',
      'REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED',
      'REVIEW_ASSIGNMENT_WRITE_ROOT_UNMINTABLE',
    ])
    // No code is named twice, and every name carries this lane's prefix, so a reader can tell whose refusal it is.
    expect(new Set(REVIEW_ASSIGNMENT_WRITE_REFUSALS).size).toBe(REVIEW_ASSIGNMENT_WRITE_REFUSALS.length)
    const declared = new Set<string>(REVIEW_ASSIGNMENT_WRITE_REFUSALS)
    // The pass-through codes are the kernel's, and this file observed some of them; they are not this set's
    // business, but they must not COLLIDE with it, or a reader cannot tell which module refused.
    for (const code of declared) expect(REVIEW_ASSIGNMENT_REFUSALS).not.toContain(code)
    const mine = [...observedRefusals].filter((code) => declared.has(code))
    expect(mine.sort()).toEqual([...declared].sort())
    // And every kernel code this file produced is a real member of the kernel's closed set.
    for (const code of observedRefusals) {
      if (declared.has(code)) continue
      expect(REVIEW_ASSIGNMENT_REFUSALS, `${code} is not in the kernel vocabulary`).toContain(code)
    }
    expect([...observedApplied].sort()).toEqual(['already', 'written'])
  })

  it('reports a refusal type a caller can branch on, never a thrown error, for hostile input shapes', async () => {
    const world = await harness()
    const hostile = [
      null,
      undefined,
      'nope',
      42,
      [],
      { kind: 'created' },
      { ...command(), target: null },
      { ...command(), target: 'inst-alpha' },
      { ...command(), kind: Symbol('created') as unknown as 'created' },
    ]
    for (const shape of hostile) {
      let outcome: ReviewAssignmentWriteResult | null = null
      let threw: unknown = null
      try {
        outcome = await applyReviewAssignment(world.deps, shape as unknown as ReviewAssignmentCommand)
      } catch (error) {
        threw = error
      }
      expect(threw, `hostile shape ${JSON.stringify(String(shape))} threw ${String(threw)}`).toBeNull()
      expect(outcome?.ok, `hostile shape ${JSON.stringify(String(shape))} accepted`).toBe(false)
      if (outcome === null || outcome.ok) continue
      expect(typeof outcome.detail).toBe('string')
      expect(outcome.detail.length).toBeGreaterThan(0)
      observedRefusals.add(outcome.refusal)
    }
    expect(world.familyRows()).toHaveLength(0)
  })

  it('keeps a refusal code inside the closed set when the medium lies about a row', async () => {
    // The last leg is the one a reviewer should try to break first: a medium that answers `list()` with a row
    // that is not a row — the durable analogue of a corrupt read. The writer must refuse, and the code it
    // refuses with must be one a caller can switch on.
    const world = await harness()
    const inner = ledgerPort(world.domain)
    let lied = false
    const deps: ReviewAssignmentStoreDeps = {
      ...world.deps,
      ledger: {
        ...inner,
        list: () => {
          const rows = inner.list()
          // Unconditional on the first call: the writer reads the ledger exactly once per command, so a lie
          // gated on "there are already rows" would never be served to the fold it is meant to poison.
          if (lied) return rows
          lied = true
          return [...rows, { sequence: 99, rootSessionId: world.root, factType: 'review-assignment-created', payload: 'not-a-record' }]
        },
      },
    }
    const result = await run(deps)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED')
    expect(result.detail).toContain('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE')
  })
})
