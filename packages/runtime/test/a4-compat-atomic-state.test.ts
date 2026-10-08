/**
 * a4-compat-atomic-state.test.ts — A4-PR7 compat-atomic lane: the durability
 * shape of ONE compatibility state transition.
 *
 * WHY THIS FILE EXISTS. `compatibility/probe.ts:replaceState()` used to perform
 * ONE logical state change as THREE separate durable operations —
 * `compatibility.delete()`, `compatibility.put()`,
 * `teamSessions.advanceGeneration()` — while its module doc claimed the change
 * was "serialized on the same team_domain write chain". It was not:
 * `putRecord`/`deleteRow` went straight to `table.put`/`table.delete`, and only
 * `updateRaw` is on that chain (`storage/repositories/base.ts`).
 * `dev/agent-workflow/evidence/a4-pr7/p6t1-flake/FINDINGS.md` SS7 escalated that
 * with a deterministic reproducer (two authorities over ONE repositories object,
 * monotonic clock: 12 chainOk / 12 chainFail over 12 rounds). Consequences
 * measured there, and re-pinned by the FIRST commit of this lane
 * (`…/compat-atomic/raw/characterization-base-01.log` and `…/compat-atomic/characterization-base-transcript.txt`, the 20 green solo runs of the characterization commit `20196925` on the unfixed tree): exactly one of two
 * concurrent consultations lost per round and its rejection surfaced as
 * ACTIVATION_COMPATIBILITY_BLOCKED_FATAL (a false refusal of legitimate work);
 * the row was readable as ABSENT inside the delete->put window, so a crash there
 * lost the compatibility state with its human acknowledgement, and another
 * probe's delete landing in that window made the winner's post-probe re-read see
 * no row at all (`no-state-after-reprobe`).
 *
 * THE LAW THIS COMMIT PINS (the owner ruling on that escalation: "a
 * version-checked atomic update first; convergence of concurrent probe results
 * afterwards"):
 *
 *  1. one state transition is ONE durable write,
 *     `CompatibilityRepository.replaceIfGeneration(record, expectedGeneration)`,
 *     whose generation check runs INSIDE the seam's atomic write-chain slot;
 *  2. a writer conditioned on a generation that moved on is REPORTED
 *     (`RECORD_DUPLICATE` / `stale-generation-compatibility-state`) and writes
 *     NOTHING — a lost race is detectable, never silently destructive;
 *  3. no probe path deletes, so the row is never observable as ABSENT and a
 *     crash mid-write keeps the previous row (acknowledgements included);
 *  4. a consultation whose probe loses converges when the winner's row already
 *     carries the live fingerprint, and still fails closed when it does not.
 *
 * DETERMINISM, NOT RATES. No sleeps and no re-run-until-green anywhere:
 *
 * - a MONOTONIC, always-distinct clock (the `p6t1-parallel` P5 pattern) removes
 *   the same-millisecond byte-identity coincidence that hid the loser on the
 *   wall clock, so every round of a race is the interesting one;
 * - interleavings are DRIVEN through per-method GATES over the repositories (a
 *   `Proxy` that parks a named call at a chosen call index until the test
 *   releases it; `entered` resolves when a call has actually parked, so the
 *   test never guesses that it has). Gates sit only on ASYNCHRONOUS seam calls:
 *   `compatibility.get` is synchronous by contract and parking it would hand the
 *   caller a promise, corrupting the shape under test — which is why the
 *   post-write hold is taken on the generation-stamp advance, the last await
 *   before the authority's post-probe re-read;
 * - crashes are the seam's own armed crash fault (`armCrashAfterWrites`): the
 *   tmp file is written, the rename never happens, memory is not advanced.
 *
 * ASSERT ON FAULT AND DECISION IDENTITIES, NEVER ON RED COUNTS. One product
 * event surfaced as up to five red legs in the family that found it.
 *
 * Restart legs follow the row-17 pattern
 * (`a4p7-governance-warning-restart-reconstruction.test.ts`): `domain.close()`,
 * a NEW `FileStorageSeam` and a NEW `TeamDomain` handle over the SAME scratch
 * dir, a FRESH evaluation of the module under test (`vi.resetModules()` +
 * dynamic import, asserted to be a different function identity), and legs whose
 * assertions a fresh EMPTY store could not pass.
 *
 * The counterfactual legs (the raw `delete`->`put` sequence at the repository
 * seam, and the fresh-EMPTY-store consultation) are kept on purpose: they show
 * WHAT THE FIX REMOVED, which a suite of only-passing-paths legs cannot.
 *
 * @module @dsh-agent-team/runtime/test/a4-compat-atomic-state
 */

import { describe, expect, it, vi } from 'vitest'

import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import type { CompatibilityStateRecord } from '../../storage/schema/index.js'
import { createCompatibilityAuthority } from '../compatibility/index.js'
import type {
  CompatibilityAdmissionDecision,
  CompatibilityAuthority,
} from '../compatibility/index.js'
import {
  P6T1_FIXTURE,
  createP6T1World,
  destroyP6T1World,
  makeEnvironmentFacts,
  restartP6T1World,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { factsSkillBaseDown, factsWebDown } from './p7t1-helpers.js'

// ---------------------------------------------------------------------------
// The world: one real TeamDomain, N independent authorities over ONE
// repositories object, a monotonic clock, and per-method gates.
// ---------------------------------------------------------------------------

const ROOT = String(P6T1_FIXTURE.rootSessionId)

/** Fixed epoch; the clock is monotonic from here, never the wall clock. */
const CLOCK_START_MS = Date.parse('2026-10-08T00:00:00.000Z')

/** The requirement the WARNING arm acknowledges (the fixture's own id). */
const WEB_REQUIREMENT_ID = 'req-tool-web'

/** The mutable environment-facts holder (drift by replacing `current`). */
interface Facts {
  current: EnvironmentFact[]
}

/** One durable compatibility row, reduced to what these legs assert on. */
interface RowView {
  readonly generation: number
  readonly status: string
  readonly fingerprint: string
  readonly acks: number
}

/** The identity of a thrown fault: `name` + `code` + the typed problem. */
interface FaultIdentity {
  readonly name: string
  readonly code: string
  readonly problem: string
}

/** The identity of one authority decision (never a message string). */
interface DecisionView {
  readonly decision: string
  readonly reprobeReason: string | undefined
  readonly status: string | undefined
  readonly generation: number | undefined
  readonly reprobed: boolean | undefined
  readonly cause: FaultIdentity | undefined
}

function faultIdentity(error: unknown): FaultIdentity {
  const e = error as { name?: unknown; code?: unknown; details?: Record<string, unknown> }
  return {
    name: typeof e?.name === 'string' ? e.name : '<none>',
    code: typeof e?.code === 'string' ? e.code : '<none>',
    problem: typeof e?.details?.['problem'] === 'string'
      ? String(e.details['problem'])
      : '<none>',
  }
}

function decisionView(d: CompatibilityAdmissionDecision): DecisionView {
  if (d.decision === 'reprobe') {
    return {
      decision: d.decision,
      reprobeReason: d.reprobeReason,
      status: undefined,
      generation: undefined,
      reprobed: undefined,
      cause: d.cause === undefined ? undefined : faultIdentity(d.cause),
    }
  }
  return {
    decision: d.decision,
    reprobeReason: undefined,
    status: d.status,
    generation: d.generation,
    reprobed: d.reprobed,
    cause: undefined,
  }
}

function rowView(row: CompatibilityStateRecord | undefined): RowView | undefined {
  if (row === undefined) return undefined
  return {
    generation: row.generation,
    status: row.status,
    fingerprint: row.fingerprint,
    acks: row.acknowledgements.length,
  }
}

/** Stable key for one row view (identity comparison inside a Set). */
function rowKey(row: RowView | undefined): string {
  return row === undefined
    ? 'absent'
    : `gen=${row.generation} status=${row.status} acks=${row.acks}`
}

/** One scenario captured at module load, or the error that broke it. */
type Captured<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly label: string; readonly error: unknown }

/**
 * Run one scenario at module load and KEEP the failure instead of throwing it.
 * A broken schedule must report as a leg failure naming its scenario, never as
 * a collection error (an un-loaded file hides every other leg of this family).
 */
async function captureRun<T>(label: string, run: () => Promise<T>): Promise<Captured<T>> {
  try {
    return { ok: true, value: await run() }
  } catch (error) {
    return { ok: false, label, error }
  }
}

/** Unwrap a capture inside a leg: a failed capture fails THIS leg, loudly. */
function must<T>(captured: Captured<T>): T {
  if (captured.ok) return captured.value
  const error = captured.error as Error | undefined
  throw new Error(
    `scenario ${captured.label} did not complete: ${error?.name ?? 'unknown'}: ${error?.message ?? 'unknown'}`,
  )
}

/**
 * One parked call site. `pass()` is consulted on every call of the gated
 * method; it parks ONLY from the `armAt`-th call on, and `entered` resolves
 * when a call has actually parked (the test never guesses that it has).
 */
class Gate {
  private calls = 0
  private waiters: Array<() => void> = []
  private armed = true
  private resolveEntered: (() => void) | undefined
  private enteredFired = false
  readonly entered: Promise<void>

  private readonly armAt: number

  constructor(armAt = 1) {
    this.armAt = armAt
    this.entered = new Promise<void>((resolve) => {
      this.resolveEntered = resolve
    })
  }

  async pass(): Promise<void> {
    this.calls += 1
    if (this.calls < this.armAt || !this.armed) return
    if (!this.enteredFired) {
      this.enteredFired = true
      this.resolveEntered?.()
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve)
    })
  }

  release(): void {
    this.armed = false
    for (const resolve of this.waiters.splice(0)) resolve()
  }
}

/**
 * Wrap one repositories object so the named methods of the named store park on
 * a gate before doing their work. Only legs that arm a gate use this: parking
 * adds a microtask hop, and an unarmed leg must keep the untouched schedule.
 *
 * A gate belongs on an ASYNCHRONOUS seam call only: `compatibility.get` is
 * synchronous by contract (`state = repositories.compatibility.get(...)` in the
 * authority, not awaited), so parking it would hand the caller a promise and
 * corrupt the very shape under test. The post-write hold is therefore taken on
 * the probe's generation-stamp advance, the last await before the authority's
 * post-probe re-read.
 */
function gatedRepositories(
  repositories: TeamDomainRepositories,
  gates: Readonly<{
    compatibility?: Readonly<Record<string, Gate>>
    teamSessions?: Readonly<Record<string, Gate>>
  }>,
): TeamDomainRepositories {
  const wrap = <T extends object>(real: T, byName: Readonly<Record<string, Gate>>): T => {
    const entries = Object.entries(byName)
    return new Proxy(real, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver)
        if (typeof property !== 'string' || typeof value !== 'function') return value
        const gate = entries.find(([name]) => name === property)?.[1]
        if (gate === undefined) return value
        const call = value as (...args: unknown[]) => unknown
        return (...args: unknown[]): unknown =>
          Promise.resolve(gate.pass()).then(() => call.apply(target, args))
      },
    }) as T
  }
  return {
    ...repositories,
    ...(gates.compatibility !== undefined
      ? { compatibility: wrap(repositories.compatibility, gates.compatibility) }
      : {}),
    ...(gates.teamSessions !== undefined
      ? { teamSessions: wrap(repositories.teamSessions, gates.teamSessions) }
      : {}),
  }
}

/** One authority factory over one repositories object. */
interface AtomicWorld {
  readonly world: P6T1World
  readonly facts: Facts
  readonly repositories: TeamDomainRepositories
  /** One authority with its own probe-observer count. */
  authority: () => { readonly authority: CompatibilityAuthority; probes: () => number }
  /** An authority sharing this world over a caller-chosen repositories view. */
  authorityOver: (repositories: TeamDomainRepositories) => CompatibilityAuthority
  /** An authority whose consultation sees caller-supplied environment facts,
   *  optionally through a caller-chosen repositories view (a gated one). */
  authoritySeeing: (
    facts: readonly EnvironmentFact[],
    repositories?: TeamDomainRepositories,
  ) => CompatibilityAuthority
  /** The durable compatibility row, reduced. */
  row: () => RowView | undefined
  /** The durable writes of this world since a seam write-count mark. */
  writesSince: (mark: number) => Array<{ table: string; op: string }>
  readonly writeCount: () => number
}

async function createAtomicWorld(basename: string): Promise<AtomicWorld> {
  const facts: Facts = { current: makeEnvironmentFacts() }
  const world = await createP6T1World(basename, {
    environmentFacts: async () => facts.current,
  })
  // A MONOTONIC clock: every stamp is distinct, so a losing write can never be
  // silently rescued by byte-identity (the p6t1-parallel P5 pattern).
  let tick = 0
  const now = (): string => new Date(CLOCK_START_MS + (tick += 1) * 1_000).toISOString()
  const wire = (
    repositories: TeamDomainRepositories,
    countProbes: boolean,
    factsView?: () => readonly EnvironmentFact[],
  ) => {
    let probes = 0
    const authority = createCompatibilityAuthority({
      repositories,
      rootSessionId: ROOT,
      blueprint: world.blueprint,
      environmentFacts: async () => (factsView !== undefined ? factsView() : facts.current),
      now,
      ...(countProbes ? { onProbe: () => { probes += 1 } } : {}),
    })
    return { authority, probes: () => probes }
  }
  return {
    world,
    facts,
    repositories: world.domain.repositories,
    writeCount: () => world.seam.writeCount,
    authority: () => wire(world.domain.repositories, true),
    authorityOver: (repositories) => wire(repositories, false).authority,
    authoritySeeing: (view, repositories) =>
      wire(repositories ?? world.domain.repositories, false, () => view).authority,
    row: () => rowView(world.domain.repositories.compatibility.get(ROOT)),
    writesSince: (mark) => world.seam.writeLog.slice(mark).map((w) => ({ table: w.table, op: w.op })),
  }
}

// ---------------------------------------------------------------------------
// A1/A2 — two independent consultations over ONE cold generation.
// ---------------------------------------------------------------------------

/** The cold-race outcome of one round: both decision identities + residue. */
interface ColdRound {
  readonly decisions: readonly [DecisionView, DecisionView]
  readonly probes: readonly [number, number]
  readonly row: RowView | undefined
  readonly writes: ReadonlyArray<{ table: string; op: string }>
}

const RACE_ROUNDS = 8

async function runColdRound(basename: string): Promise<ColdRound> {
  const world = await createAtomicWorld(basename)
  try {
    const a = world.authority()
    const b = world.authority()
    const mark = world.writeCount()
    const [ra, rb] = await Promise.all([a.authority.admit(), b.authority.admit()])
    return {
      decisions: [decisionView(ra), decisionView(rb)],
      probes: [a.probes(), b.probes()],
      row: world.row(),
      writes: world.writesSince(mark),
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

const coldRounds: Array<Captured<ColdRound>> = []
for (let round = 0; round < RACE_ROUNDS; round += 1) {
  coldRounds.push(await captureRun(`A1 cold round ${round}`, () => runColdRound(`a4compat-cold-${round}`)))
}

/**
 * The WARM race: the row exists but is stale (the environment drifted), so both
 * consultations condition on the SAME generation and one of them must lose the
 * compare-and-set — the shape the p6t1 reproducer hit on a warm store.
 */
async function runWarmRound(basename: string): Promise<ColdRound> {
  const world = await createAtomicWorld(basename)
  try {
    const warm = await world.authority().authority.admit()
    if (warm.decision !== 'admit') {
      throw new Error(`warm race: the warm-up did not admit (${warm.decision})`)
    }
    world.facts.current = factsSkillBaseDown()
    const a = world.authority()
    const b = world.authority()
    const mark = world.writeCount()
    const [ra, rb] = await Promise.all([a.authority.admit(), b.authority.admit()])
    return {
      decisions: [decisionView(ra), decisionView(rb)],
      probes: [a.probes(), b.probes()],
      row: world.row(),
      writes: world.writesSince(mark),
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

const warmRounds: Array<Captured<ColdRound>> = []
for (let round = 0; round < RACE_ROUNDS; round += 1) {
  warmRounds.push(await captureRun(`A2 warm round ${round}`, () => runWarmRound(`a4compat-warm-${round}`)))
}

// ---------------------------------------------------------------------------
// A3 — the hole cannot be entered: a reader concurrent with a committed,
//      not-yet-stamped winner sees a PRESENT row.
// ---------------------------------------------------------------------------

/**
 * The schedule the old `no-state-after-reprobe` needed was
 * `A.delete < A.put < B.delete < A.re-read < B.put`. Under one generation-checked
 * write there is no interval to land in: A commits its row and is then held only
 * on the stamp advance, and EVERY consultation started inside that hold reads a
 * present, fresh row — it does not probe at all.
 */
interface HoleRun {
  readonly winner: DecisionView
  readonly reader: DecisionView
  readonly readerWrites: number
  readonly row: RowView | undefined
  readonly compatibilityOps: string[]
}

async function runHoleLeg(basename: string): Promise<HoleRun> {
  const world = await createAtomicWorld(basename)
  try {
    const warm = await world.authority().authority.admit()
    if (warm.decision !== 'admit') {
      throw new Error(`hole leg: the warm-up did not admit (${warm.decision})`)
    }
    world.facts.current = factsSkillBaseDown()

    // The winner is held on the advance that FOLLOWS its durable state write:
    // exactly the instant at which the old sequence had removed the row and not
    // yet restored it.
    const aStamp = new Gate()
    const a = world.authorityOver(
      gatedRepositories(world.repositories, { teamSessions: { advanceGeneration: aStamp } }),
    )
    const aRun = a.admit()
    await aStamp.entered
    const readerMark = world.writeCount()
    const reader = await world.authority().authority.admit()
    const readerWrites = world.writeCount() - readerMark
    aStamp.release()
    const winner = await aRun
    return {
      winner: decisionView(winner),
      reader: decisionView(reader),
      readerWrites,
      row: world.row(),
      compatibilityOps: world
        .writesSince(0)
        .filter((w) => w.table === 'compatibility')
        .map((w) => w.op),
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

const holeLeg = await captureRun('A3 hole leg', () => runHoleLeg('a4compat-hole-0'))

// ---------------------------------------------------------------------------
// A4 — the version conflict, raised BY NAME, and it writes nothing.
// ---------------------------------------------------------------------------

/** A stale conditioned write: the fault identity, the residue, the write count. */
interface ConflictRun {
  readonly fault: FaultIdentity
  readonly faultDetails: { readonly expected: number; readonly observed: number }
  readonly row: RowView | undefined
  readonly durableWrites: number
  readonly coldFault: FaultIdentity
}

async function runConflictLeg(basename: string): Promise<ConflictRun> {
  const world = await createAtomicWorld(basename)
  try {
    const established = await world.authority().authority.admit()
    if (established.decision !== 'admit') {
      throw new Error(`conflict leg: the warm-up did not admit (${established.decision})`)
    }
    const row = world.row()
    if (row === undefined) throw new Error('conflict leg: no row to conflict with')
    const repository = world.repositories.compatibility
    const current = repository.get(ROOT)
    if (current === undefined) throw new Error('conflict leg: the row vanished')
    const mark = world.writeCount()
    let fault: FaultIdentity = { name: '<none>', code: '<none>', problem: '<none>' }
    let expected = -1
    let observed = -1
    try {
      // Conditioned on a generation that is not the live one: this write MUST
      // lose, and lose LOUDLY.
      await repository.replaceIfGeneration(
        { ...current, generation: 99, computedAt: '2026-10-08T00:59:59.000Z' },
        7,
      )
      throw new Error('conflict leg: the stale write was accepted')
    } catch (error) {
      fault = faultIdentity(error)
      const details = (error as { details?: Record<string, unknown> }).details ?? {}
      expected = Number(details['expectedGeneration'])
      observed = Number(details['observedGeneration'])
    }
    // The cold shape of the same signal: a create over an occupied key.
    let coldFault: FaultIdentity = { name: '<none>', code: '<none>', problem: '<none>' }
    try {
      await repository.replaceIfGeneration(
        { ...current, generation: 1, computedAt: '2026-10-08T00:59:58.000Z' },
        0,
      )
      throw new Error('conflict leg: the cold create overwrote an occupied key')
    } catch (error) {
      coldFault = faultIdentity(error)
    }
    return {
      fault,
      faultDetails: { expected, observed },
      row: world.row(),
      durableWrites: world.writeCount() - mark,
      coldFault,
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

const conflictLeg = await captureRun('A4 conflict leg', () => runConflictLeg('a4compat-conflict-0'))

// ---------------------------------------------------------------------------
// A5 — a crash inside the transition: the previous row survives.
// ---------------------------------------------------------------------------

/** One crash arm: before, the fault, the row after a real reopen, after recovery. */
interface CrashRun {
  readonly before: RowView
  readonly crashed: DecisionView
  readonly afterReopen: RowView | undefined
  readonly afterRecovery: RowView | undefined
  readonly writesAtArm: number
}

/**
 * Arm the seam's crash so the probe's state write is the one that dies. Under the
 * old sequence the SECOND write (`put`) died after the FIRST (`delete`) had
 * landed, so the row was gone for good; under one conditioned write the dying
 * operation never got the row out of the way, so the PREVIOUS row — including
 * the human acknowledgement, the durable fact a crash must not be able to erase
 * — is what the reopened store reads.
 */
async function runCrashLeg(basename: string): Promise<CrashRun> {
  const world = await createAtomicWorld(basename)
  let reopened: P6T1World | undefined
  try {
    // A WARNING environment plus a human acknowledgement.
    world.facts.current = factsWebDown()
    const warm = await world.authority().authority.admit()
    if (warm.decision !== 'block') {
      throw new Error(`crash leg: warm-up expected a blocked warning, got ${warm.decision}`)
    }
    const acked = await world.authority().authority.acknowledge({
      requirementId: WEB_REQUIREMENT_ID,
      acknowledgedBy: 'a4-compat-atomic',
    })
    if (acked.status !== 'DEGRADED_ACKNOWLEDGED') {
      throw new Error(`crash leg: the acknowledgement did not clear the warning (${acked.status})`)
    }
    const before = world.row()
    if (before === undefined || before.acks !== 1) {
      throw new Error(`crash leg: the durable acknowledgement did not land (${rowKey(before)})`)
    }

    // Drift, then crash the consultation that would replace the row: no further
    // durable write survives, so the state write itself is the one that dies.
    world.facts.current = factsSkillBaseDown()
    const mark = world.writeCount()
    world.world.seam.armCrashAfterWrites(mark)
    const crashed = decisionView(await world.authorityOver(world.repositories).admit())
    world.world.seam.clearCrash()

    // The unit restart: new seam, new handle, same directory.
    reopened = await restartP6T1World(world.world)
    const afterReopen = rowView(reopened.domain.repositories.compatibility.get(ROOT))

    // Recovery: a fresh consultation over the reopened store.
    const recovered = createCompatibilityAuthority({
      repositories: reopened.domain.repositories,
      rootSessionId: ROOT,
      blueprint: world.world.blueprint,
      environmentFacts: async () => world.facts.current,
      now: () => new Date(CLOCK_START_MS + 10_000_000).toISOString(),
    })
    await recovered.admit()
    const afterRecovery = rowView(reopened.domain.repositories.compatibility.get(ROOT))
    return { before, crashed, afterReopen, afterRecovery, writesAtArm: mark }
  } finally {
    await destroyP6T1World(reopened ?? world.world)
  }
}

const crashLeg = await captureRun('A5 crash leg', () => runCrashLeg('a4compat-crash-0'))

// ---------------------------------------------------------------------------
// A6 — restart reconstruction over a real reopened store.
// ---------------------------------------------------------------------------

/** The restart arm: probe, restart, consult again through a fresh module. */
interface RestartRun {
  readonly before: RowView
  readonly after: RowView | undefined
  readonly consultation: DecisionView
  readonly freshWriteCount: number
  readonly emptyCounterfactual: DecisionView
  readonly moduleIsFresh: boolean
}

async function runRestartLeg(basename: string): Promise<RestartRun> {
  const world = await createAtomicWorld(basename)
  let reopened: P6T1World | undefined
  try {
    const established = await world.authority().authority.admit()
    if (established.decision !== 'admit') {
      throw new Error(`restart leg: the first consultation did not admit (${established.decision})`)
    }
    const before = world.row()
    if (before === undefined) throw new Error('restart leg: no row before the restart')

    reopened = await restartP6T1World(world.world)

    // A FRESH evaluation of the module under test: the restarted process must
    // carry no module-level memory of the first one.
    await vi.resetModules()
    const fresh = (await import('../compatibility/index.js')) as typeof import('../compatibility/index.js')
    const moduleIsFresh = fresh.createCompatibilityAuthority !== createCompatibilityAuthority

    const repositories = reopened.domain.repositories
    const mark = reopened.seam.writeCount
    const consultation = decisionView(
      await fresh.createCompatibilityAuthority({
        repositories,
        rootSessionId: ROOT,
        blueprint: world.world.blueprint,
        environmentFacts: async () => world.facts.current,
        now: () => new Date(CLOCK_START_MS + 20_000_000).toISOString(),
      }).admit(),
    )
    const freshWriteCount = reopened.seam.writeCount - mark
    const after = rowView(repositories.compatibility.get(ROOT))

    // The counterfactual that keeps the leg non-vacuous: the SAME consultation
    // over a brand-new empty store must NOT look like a reconstruction.
    const empty = await createAtomicWorld(`${basename}-empty`)
    try {
      const emptyConsultation = decisionView(await empty.authority().authority.admit())
      return {
        before,
        after,
        consultation,
        freshWriteCount,
        emptyCounterfactual: emptyConsultation,
        moduleIsFresh,
      }
    } finally {
      await destroyP6T1World(empty.world)
    }
  } finally {
    await destroyP6T1World(reopened ?? world.world)
  }
}

const restartLeg = await captureRun('A6 restart leg', () => runRestartLeg('a4compat-restart-0'))

// ---------------------------------------------------------------------------
// A7 — convergence has a boundary: a loser whose row describes a DIFFERENT
//      environment still fails closed.
// ---------------------------------------------------------------------------

/**
 * The winner establishes the generation for the live environment while the loser
 * is mid-probe; the loser then conditions on a generation that has moved on. If
 * the winner's row carries the fingerprint the loser wanted, that IS the
 * establishment it waited for (A1/A2 above). If it carries ANOTHER one — the two
 * consultations read different environments — converging would mean trusting a
 * state that does not describe the live environment, so the typed conflict must
 * still surface. The schedules are identical; only the facts differ, which is
 * what makes the pair a boundary and not a coincidence.
 */
interface DivergeRun {
  readonly winner: DecisionView
  readonly loser: DecisionView
  readonly row: RowView | undefined
}

async function runDivergeLeg(basename: string): Promise<DivergeRun> {
  const world = await createAtomicWorld(basename)
  try {
    const warm = await world.authority().authority.admit()
    if (warm.decision !== 'admit') {
      throw new Error(`diverge leg: the warm-up did not admit (${warm.decision})`)
    }
    const loserFacts = factsSkillBaseDown()
    const winnerFacts = factsWebDown()

    // The loser is parked on its state write, AFTER it has read the generation
    // it conditions on. The winner then commits behind its back, so when the
    // loser is released its compare-and-set loses by construction — and the row
    // it must judge carries a fingerprint it never asked for.
    const loserCas = new Gate()
    const loserPending = world
      .authoritySeeing(
        loserFacts,
        gatedRepositories(world.repositories, { compatibility: { replaceIfGeneration: loserCas } }),
      )
      .admit()
    await loserCas.entered
    const winner = await world.authoritySeeing(winnerFacts).admit()
    loserCas.release()
    const loserSettled = await loserPending
    return {
      winner: decisionView(winner),
      loser: decisionView(loserSettled),
      row: world.row(),
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

const divergeLeg = await captureRun('A7 diverge leg', () => runDivergeLeg('a4compat-diverge-0'))

// ---------------------------------------------------------------------------
// A8 — the counterfactual: the delete -> put sequence, at the repository seam.
// ---------------------------------------------------------------------------

/**
 * The `delete`->`put` sequence, called DIRECTLY on the repository (the product
 * path performs no such sequence any more — leg A3 pins the durable op log).
 * Between the two writes the row is readable as ABSENT by anyone: the window is
 * a property of the SEQUENCE, which is why the fix had to remove the sequence
 * rather than schedule it better. Kept so the removal stays visible.
 */
async function runSequenceLeg(basename: string): Promise<{
  readonly observedBetween: RowView | undefined
  readonly stillAbsent: RowView | undefined
  readonly absentFault: FaultIdentity & { seamCode: string }
  readonly after: RowView | undefined
  readonly compatibilityOps: string[]
}> {
  const world = await createAtomicWorld(basename)
  try {
    const established = await world.authority().authority.admit()
    if (established.decision !== 'admit') {
      throw new Error(`sequence leg: the first consultation did not admit (${established.decision})`)
    }
    const repository = world.repositories.compatibility
    const current = repository.get(ROOT)
    if (current === undefined) throw new Error('sequence leg: no row to replace')
    await repository.delete(ROOT)
    const observedBetween = world.row()
    // What a warm conditioned write does INSIDE that window: it must refuse, and
    // refuse with the seam's own typed identity, writing nothing.
    let absentFault: FaultIdentity & { seamCode: string } = {
      name: '<none>',
      code: '<none>',
      problem: '<none>',
      seamCode: '<none>',
    }
    try {
      await repository.replaceIfGeneration(
        { ...current, generation: current.generation + 1 },
        current.generation,
      )
      throw new Error('sequence leg: a conditioned write succeeded over an absent row')
    } catch (error) {
      const identity = faultIdentity(error)
      const details = (error as { details?: Record<string, unknown> }).details ?? {}
      absentFault = {
        ...identity,
        seamCode: typeof details['seamCode'] === 'string' ? String(details['seamCode']) : '<none>',
      }
    }
    const stillAbsent = world.row()
    await repository.put({ ...current, generation: current.generation + 1 })
    return {
      observedBetween,
      stillAbsent,
      absentFault,
      after: world.row(),
      compatibilityOps: world
        .writesSince(0)
        .filter((w) => w.table === 'compatibility')
        .map((w) => w.op),
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

const sequenceLeg = await captureRun('A8 sequence leg', () => runSequenceLeg('a4compat-sequence-0'))

// ---------------------------------------------------------------------------
// the legs
// ---------------------------------------------------------------------------

/**
 * Unwrap the captured rounds INSIDE a leg body. Never at describe scope: a
 * `describe` body runs at COLLECTION time, so a failed scenario there would
 * turn one product event into a file-level collection error and hide every
 * other leg of this family (the failure mode the instrument rules call a red
 * that resolves into a collection error).
 */
function coldRoundList(): ColdRound[] {
  return coldRounds.map(must)
}

function warmRoundList(): ColdRound[] {
  return warmRounds.map(must)
}

describe('A4 compat-atomic A1: two independent consultations race one COLD generation', () => {

  it(`every one of ${RACE_ROUNDS} rounds produces the SAME outcome inventory (a property, not a coincidence)`, () => {
    const rounds = coldRoundList()
    const inventories = new Set(
      rounds.map((round) =>
        JSON.stringify({
          decisions: round.decisions.map((d) => [d.decision, d.reprobeReason ?? '', d.status ?? '', d.generation ?? -1]),
          probes: round.probes,
          row: rowKey(round.row),
          writes: round.writes.map((w) => `${w.table}:${w.op}`),
        }),
      ),
    )
    expect(inventories.size).toBe(1)
  })

  it('exactly ONE transition is committed per round: one state write plus one stamp advance', () => {
    const rounds = coldRoundList()
    for (const round of rounds) {
      expect(round.writes).toEqual([
        { table: 'compatibility', op: 'put' },
        { table: 'team_sessions', op: 'update' },
      ])
      expect(round.row?.generation).toBe(1)
    }
  })

  it('NEITHER consultation is refused: the loser converges on the winner\'s row instead of failing work', () => {
    const rounds = coldRoundList()
    for (const round of rounds) {
      for (const decision of round.decisions) {
        expect(decision.decision).toBe('admit')
        expect(decision.reprobeReason).toBeUndefined()
        expect(decision.cause).toBeUndefined()
      }
      // Exactly one consultation authored the row: the loser fired no probe of
      // its own, so convergence is visible in the durable record and not only
      // in a boolean.
      expect(round.probes.filter((p) => p === 1).length).toBe(1)
      expect(round.probes.filter((p) => p === 0).length).toBe(1)
    }
  })

  it('the row is never absent and never torn: one probe\'s complete record survives the race', () => {
    const rounds = coldRoundList()
    for (const round of rounds) {
      expect(round.row !== undefined).toBe(true)
      expect(round.row?.status).toBe('OPEN')
      expect(round.row?.acks).toBe(0)
    }
  })
})

describe('A4 compat-atomic A2: two independent consultations race one WARM (stale) generation', () => {

  it('both consultations are served and the drift-bound generation advances exactly once', () => {
    const rounds = warmRoundList()
    for (const round of rounds) {
      for (const decision of round.decisions) {
        expect(decision.decision).toBe('block')
        expect(decision.generation).toBe(2)
      }
      expect(round.writes).toEqual([
        { table: 'compatibility', op: 'update' },
        { table: 'team_sessions', op: 'update' },
      ])
      expect(round.probes.filter((p) => p === 1).length).toBe(1)
    }
  })
})

describe('A4 compat-atomic A3: the hole cannot be entered', () => {
  it('a consultation started while the winner is committed-but-unstamped sees a PRESENT row and does not probe', () => {
    const run = must(holeLeg)
    expect(run.reader.decision).toBe('block')
    expect(run.reader.reprobed).toBe(false)
    expect(run.readerWrites).toBe(0)
    expect(run.winner.decision).toBe('block')
    expect(run.row?.generation).toBe(2)
  })

  it('the product path performs NO delete on the compatibility store (the window is removed, not rescheduled)', () => {
    const run = must(holeLeg)
    expect(run.compatibilityOps).toEqual(['put', 'update'])
  })
})

describe('A4 compat-atomic A4: the version conflict is raised by name and writes nothing', () => {
  it('a conditioned write on a generation that moved on raises RECORD_DUPLICATE / stale-generation-compatibility-state', () => {
    const run = must(conflictLeg)
    expect(run.fault).toEqual({
      name: 'TeamDomainError',
      code: 'RECORD_DUPLICATE',
      problem: 'stale-generation-compatibility-state',
    })
    expect(run.faultDetails).toEqual({ expected: 7, observed: 1 })
  })

  it('the loser writes NOTHING and the winner\'s row is untouched (a lost race is detectable, never destructive)', () => {
    const run = must(conflictLeg)
    expect(run.durableWrites).toBe(0)
    expect(run.row?.generation).toBe(1)
    expect(run.row?.status).toBe('OPEN')
  })

  it('the cold shape of the same signal: a create over an occupied key raises the typed duplicate', () => {
    const run = must(conflictLeg)
    expect(run.coldFault).toEqual({
      name: 'TeamDomainError',
      code: 'RECORD_DUPLICATE',
      problem: 'duplicate-compatibility-state',
    })
  })
})

describe('A4 compat-atomic A5: a crash inside the transition keeps the previous state', () => {
  it('the crash reaches the caller as a typed seam failure (identity flattened by normalizeSeamError)', () => {
    const run = must(crashLeg)
    expect(run.crashed.decision).toBe('reprobe')
    expect(run.crashed.cause).toEqual({
      name: 'TeamDomainError',
      code: 'SEAM_FAILURE',
      problem: 'unclassified-seam-error',
    })
  })

  it('after a real reopen the state SURVIVES: same generation, same status, and the human acknowledgement intact', () => {
    const run = must(crashLeg)
    expect(run.before.generation).toBe(2)
    expect(run.before.acks).toBe(1)
    expect(run.afterReopen).toEqual(run.before)
  })

  it('recovery continues the generation line from the surviving row instead of restarting it', () => {
    const run = must(crashLeg)
    expect(run.afterRecovery !== undefined).toBe(true)
    expect(run.afterRecovery?.generation).toBe(3)
    expect(run.afterRecovery?.acks).toBe(1)
  })
})

describe('A4 compat-atomic A6: restart reconstruction from a real reopened store', () => {
  it('the durable state survives the restart and the second process sees it as FRESH (no re-probe, zero writes)', () => {
    const run = must(restartLeg)
    expect(run.moduleIsFresh).toBe(true)
    expect(run.after?.generation).toBe(run.before.generation)
    expect(run.after?.fingerprint).toBe(run.before.fingerprint)
    expect(run.consultation.decision).toBe('admit')
    expect(run.consultation.reprobed).toBe(false)
    expect(run.freshWriteCount).toBe(0)
  })

  it('the same consultation over a FRESH EMPTY store is a different shape (the leg above is not vacuous)', () => {
    const run = must(restartLeg)
    expect(run.emptyCounterfactual.reprobed).toBe(true)
    expect(run.emptyCounterfactual.decision).toBe('admit')
  })
})

describe('A4 compat-atomic A7: convergence has a boundary', () => {
  it('a loser whose row describes a DIFFERENT environment still fails closed with the typed conflict', () => {
    const run = must(divergeLeg)
    expect(run.winner.decision).toBe('block')
    expect(run.row?.generation).toBe(2)
    expect(run.loser.decision).toBe('reprobe')
    expect(run.loser.reprobeReason).toBe('reprobe-failed')
    expect(run.loser.cause).toEqual({
      name: 'TeamDomainError',
      code: 'RECORD_DUPLICATE',
      problem: 'stale-generation-compatibility-state',
    })
  })
})

describe('A4 compat-atomic A8: the counterfactual — the delete -> put sequence at the repository seam', () => {
  it('between the delete and the put the row reads as ABSENT to anyone who looks', () => {
    const run = must(sequenceLeg)
    expect(run.observedBetween).toBeUndefined()
    expect(run.after?.generation).toBe(2)
  })

  it('and that window costs a durable DELETE that the product path no longer performs', () => {
    const run = must(sequenceLeg)
    expect(run.compatibilityOps).toEqual(['put', 'delete', 'put'])
  })

  it('inside that window a conditioned write refuses with the seam\'s own typed identity and writes nothing', () => {
    const run = must(sequenceLeg)
    // `updateRaw` over an absent key is the public seam's `missing-key`, which
    // TeamDomain classifies as SEAM_FAILURE (the identity `advanceGeneration`
    // rejects with over a missing team row). The row stays absent, and the
    // window is exactly as destructive as the fix's whole point says.
    expect(run.absentFault).toEqual({
      name: 'TeamDomainError',
      code: 'SEAM_FAILURE',
      problem: '<none>',
      seamCode: 'missing-key',
    })
    expect(run.stillAbsent).toBeUndefined()
  })
})
