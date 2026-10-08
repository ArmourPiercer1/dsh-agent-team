/**
 * a4-compat-atomic-state.test.ts — A4-PR7 compat-atomic lane: the durability
 * shape of ONE compatibility state transition.
 *
 * WHY THIS FILE EXISTS. `dev/agent-workflow/evidence/a4-pr7/p6t1-flake/`
 * escalated, with a deterministic reproducer
 * (`probe/repro.probe.ts`: 12 chainOk / 12 chainFail over 12 rounds), that
 * `compatibility/probe.ts:replaceState()` is THREE separate durable
 * operations — `compatibility.delete()`, `compatibility.put()`,
 * `teamSessions.advanceGeneration()` — while its module doc claimed the state
 * change was "serialized on the same team_domain write chain". It is not:
 * `putRecord`/`deleteRow` go straight to `table.put`/`table.delete`
 * (`storage/repositories/base.ts`); only `updateRaw` is on that chain. Two
 * consequences, both measured there: (1) two concurrent consultations
 * (`authority.evaluate()` and its `admit()` mapping — the same chain) over
 * ONE repositories object lose exactly one per round, and the
 * loser's rejection becomes `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL` — a false
 * refusal of legitimate work; (2) a crash between the `delete` and the `put`
 * loses the compatibility state, and a loser's `delete` landing inside a
 * winner's `put`→re-read gap can make the winner see no row at all
 * (`no-state-after-reprobe`).
 *
 * THIS COMMIT (the characterization) pins the CURRENT shape so the fix can be
 * shown to change exactly it. Every leg is deterministic — no sleeps, no
 * re-run-until-green:
 *
 * - a MONOTONIC, always-distinct clock (the `p6t1-parallel` P5 pattern) removes
 *   the same-millisecond byte-identity coincidence that made the race
 *   invisible on the default clock, so the loser is visible every round;
 * - the interleavings are driven through a per-method GATE over the
 *   compatibility repository (a `Proxy` that parks a named call, at a chosen
 *   call index, until the test releases it; `entered` resolves when a call has
 *   actually parked, so the test never guesses that it has). Every knob is a
 *   promise the test owns; nothing depends on wall-clock timing or scheduler
 *   luck;
 * - crashes are the seam's own armed crash fault (`armCrashAfterWrites`), which
 *   lands mid-atomic-write: the tmp file is written, the rename never happens,
 *   the in-memory row is not advanced.
 *
 * ASSERT ON FAULT IDENTITIES, NEVER ON RED COUNTS. One product event here
 * surfaced as up to five red legs in the family that found it; the identity of
 * the rejection (`name` + `code` + `details.problem`) and the identity of the
 * decision (`decision` + `reprobeReason`) are what these legs pin.
 *
 * Restart legs follow the row-17 pattern
 * (`a4p7-governance-warning-restart-reconstruction.test.ts`): `domain.close()`,
 * a NEW `FileStorageSeam` and a NEW `TeamDomain` handle over the SAME scratch
 * dir, a FRESH evaluation of the module under test (`vi.resetModules()` +
 * dynamic import, asserted to be a different function identity), and legs whose
 * assertions a fresh EMPTY store could not pass.
 *
 * @module @dsh-agent-team/runtime/test/a4-compat-atomic-state
 */

import { describe, expect, it, vi } from 'vitest'

import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import type { CompatibilityRepository, TeamDomainRepositories } from '../../storage/repositories/index.js'
import type { CompatibilityStateRecord } from '../../storage/schema/index.js'
import {
  createCompatibilityAuthority,
} from '../compatibility/index.js'
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
type Captured<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly label: string; readonly error: unknown }

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
 * corrupt the very shape under test. The post-probe hold is therefore taken on
 * the probe's generation-stamp advance, which is the last await before that
 * re-read.
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
  const wire = (repositories: TeamDomainRepositories, countProbes: boolean) => {
    let probes = 0
    const authority = createCompatibilityAuthority({
      repositories,
      rootSessionId: ROOT,
      blueprint: world.blueprint,
      environmentFacts: async () => facts.current,
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
    row: () => rowView(world.domain.repositories.compatibility.get(ROOT)),
    writesSince: (mark) => world.seam.writeLog.slice(mark).map((w) => ({ table: w.table, op: w.op })),
  }
}

// ---------------------------------------------------------------------------
// C1/C2 — two independent consultations over ONE cold generation.
// ---------------------------------------------------------------------------

/** The cold-race outcome of one round: the two decision identities + residue. */
interface ColdRound {
  readonly decisions: readonly [DecisionView, DecisionView]
  readonly row: RowView | undefined
  readonly writes: ReadonlyArray<{ table: string; op: string }>
}

const COLD_ROUNDS = 8

async function runColdRound(basename: string): Promise<ColdRound> {
  const world = await createAtomicWorld(basename)
  try {
    const a = world.authority()
    const b = world.authority()
    const mark = world.writeCount()
    const [ra, rb] = await Promise.all([a.authority.admit(), b.authority.admit()])
    return {
      decisions: [decisionView(ra), decisionView(rb)],
      row: world.row(),
      writes: world.writesSince(mark),
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

const coldRounds: Array<Captured<ColdRound>> = []
for (let round = 0; round < COLD_ROUNDS; round += 1) {
  coldRounds.push(await captureRun(`C1 cold round ${round}`, () => runColdRound(`a4compat-cold-${round}`)))
}

// ---------------------------------------------------------------------------
// C3 — the delete→put gap, driven deterministically.
// ---------------------------------------------------------------------------

/**
 * The escalation's second interleaving: a consultation's post-probe re-read
 * landing inside ANOTHER probe's `delete`→`put` gap. Driven, not hunted. The
 * schedule the window needs is
 *
 *   B.step3-read < A.delete < A.put < B.delete < A.re-read < B.put
 *
 * (B must decide to re-probe from the pre-A row, A must land its put, B must
 * then delete it, and A's re-read must observe the hole):
 *
 * 1. A parks on its `delete` (its step-3 read has happened, its put has not);
 * 2. B runs to its own `delete` and parks there (its step-3 read saw the stale
 *    generation, which is why it is probing);
 * 3. A is released: A deletes the generation-1 row and puts its own, then parks
 *    on the generation-stamp advance that precedes its post-probe re-read;
 * 4. B is released: B deletes the row A just wrote, and parks on its `put`;
 * 5. A's stamp advance is released, so its re-read runs — it is looking at the
 *    hole, right now.
 */
interface GapRun {
  readonly a: DecisionView
  readonly b: DecisionView
  readonly row: RowView | undefined
}

async function runGapLeg(basename: string): Promise<GapRun> {
  const world = await createAtomicWorld(basename)
  try {
    // Warm the row: generation 1 over the CLEAN environment.
    const warm = await world.authority().authority.admit()
    if (warm.decision !== 'admit') {
      throw new Error(`gap leg: warm-up expected admit, got ${warm.decision}`)
    }
    // Drift: every later consultation finds the durable row stale.
    world.facts.current = factsSkillBaseDown()

    const aDelete = new Gate()
    // A's hold AFTER its own state write is taken on the generation-stamp
    // advance: it is the last await before the authority's post-probe re-read
    // (`compatibility.get` itself is synchronous and must not be parked).
    const aStamp = new Gate()
    const bDelete = new Gate()
    const bPut = new Gate()
    const a = world.authorityOver(
      gatedRepositories(world.repositories, {
        compatibility: { delete: aDelete },
        teamSessions: { advanceGeneration: aStamp },
      }),
    )
    const b = world.authorityOver(
      gatedRepositories(world.repositories, { compatibility: { delete: bDelete, put: bPut } }),
    )

    const aRun = a.admit()
    await aDelete.entered
    const bRun = b.admit()
    await bDelete.entered
    aDelete.release()
    await aStamp.entered
    bDelete.release()
    await bPut.entered
    aStamp.release()
    const ra = await aRun
    bPut.release()
    const rb = await bRun
    return { a: decisionView(ra), b: decisionView(rb), row: world.row() }
  } finally {
    await destroyP6T1World(world.world)
  }
}

const gapRun = await captureRun('C3 gap leg', () => runGapLeg('a4compat-gap-0'))

// ---------------------------------------------------------------------------
// C4 — the crash window, and what a reopen can reconstruct.
// ---------------------------------------------------------------------------

/** One crash arm: the row before the crash, the row after a real reopen, and
 *  the row a fresh consultation leaves behind after the reopen. */
interface CrashRun {
  readonly before: RowView
  readonly crashed: DecisionView
  readonly afterReopen: RowView | undefined
  readonly afterRecovery: RowView | undefined
}

/**
 * Arm the seam's crash so the probe's SECOND durable write is the one that
 * dies (the first is the `delete` of the now-existing row; the second is the
 * `put`). Then close the domain and re-open it over the SAME directory with a
 * NEW seam and a NEW handle, and read what survived.
 */
async function runCrashLeg(basename: string): Promise<CrashRun> {
  const world = await createAtomicWorld(basename)
  let reopened: P6T1World | undefined
  try {
    // A WARNING environment plus a human acknowledgement: the durable fact a
    // crash must not be able to erase.
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

    // Drift, then crash the consultation that would replace the row.
    world.facts.current = factsSkillBaseDown()
    const mark = world.writeCount()
    // Exactly one more durable write may land (the `delete` of the old row);
    // every later one dies mid-atomic-write (the `put` of the new row).
    world.world.seam.armCrashAfterWrites(mark + 1)
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
    return { before, crashed, afterReopen, afterRecovery }
  } finally {
    await destroyP6T1World(reopened ?? world.world)
  }
}

const crashRun = await captureRun('C4 crash leg', () => runCrashLeg('a4compat-crash-0'))

// ---------------------------------------------------------------------------
// C5 — restart reconstruction over a real reopened store.
// ---------------------------------------------------------------------------

/** The restart arm: probe, restart, and consult a SECOND time through a
 *  freshly-evaluated module over the reopened handle. */
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

const restartRun = await captureRun('C5 restart leg', () => runRestartLeg('a4compat-restart-0'))

// ---------------------------------------------------------------------------
// C6 — the sequence itself, at the repository seam.
// ---------------------------------------------------------------------------

/**
 * The `delete`→`put` sequence observed directly on the repository: between the
 * two writes the row is readable as ABSENT by anyone. No concurrency is needed
 * to show it — the window is a property of the SEQUENCE, which is why the fix
 * has to remove the sequence rather than schedule it better.
 */
async function runSequenceLeg(basename: string): Promise<{
  readonly observedBetween: RowView | undefined
  readonly after: RowView | undefined
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
    await repository.put({ ...current, generation: current.generation + 1 })
    return { observedBetween, after: world.row() }
  } finally {
    await destroyP6T1World(world.world)
  }
}

const sequenceLeg = await captureRun('C6 sequence leg', () => runSequenceLeg('a4compat-sequence-0'))

// ---------------------------------------------------------------------------
// the legs
// ---------------------------------------------------------------------------

describe('A4 compat-atomic C1: two independent consultations over one cold generation', () => {
  const rounds = coldRounds.map((round) => must(round))

  it(`every one of ${COLD_ROUNDS} rounds produces the SAME outcome inventory (the race is a property, not a coincidence)`, () => {
    const inventories = new Set(
      rounds.map((round) =>
        JSON.stringify({
          decisions: round.decisions.map((d) => [
            d.decision,
            d.reprobeReason ?? '',
            d.status ?? '',
            d.generation ?? -1,
          ]),
          row: rowKey(round.row),
          writes: round.writes.map((w) => `${w.table}:${w.op}`),
        }),
      ),
    )
    expect(inventories.size).toBe(1)
  })

  it('exactly ONE consultation establishes the generation and the other is refused', () => {
    for (const round of rounds) {
      const ok = round.decisions.filter((d) => d.decision === 'admit')
      const refused = round.decisions.filter((d) => d.decision === 'reprobe')
      expect(ok.length).toBe(1)
      expect(refused.length).toBe(1)
      expect(refused[0]?.reprobeReason).toBe('reprobe-failed')
    }
  })

  it('the loser is refused with the typed storage conflict, named (and the row is never corrupt)', () => {
    for (const round of rounds) {
      const refused = round.decisions.find((d) => d.decision === 'reprobe')
      expect(refused?.cause).toEqual({
        name: 'TeamDomainError',
        code: 'RECORD_DUPLICATE',
        problem: 'duplicate-compatibility-state',
      })
      expect(round.row?.generation).toBe(1)
      expect(round.row?.status).toBe('OPEN')
    }
  })

  it('the durable residue is one create plus one stamp advance per round', () => {
    for (const round of rounds) {
      expect(round.writes).toEqual([
        { table: 'compatibility', op: 'put' },
        { table: 'team_sessions', op: 'update' },
      ])
    }
  })
})

describe('A4 compat-atomic C2: the delete -> put gap is an observable window', () => {
  it('a consultation whose post-probe re-read lands in another probe gap sees NO row and fails closed', () => {
    const run = must(gapRun)
    expect(run.a.decision).toBe('reprobe')
    expect(run.a.reprobeReason).toBe('no-state-after-reprobe')
  })

  it('the row is present and drift-bound again once the gap closes (the window is transient, the refusal is not)', () => {
    const run = must(gapRun)
    expect(run.row !== undefined).toBe(true)
    expect(run.row?.generation).toBe(2)
    expect(run.b.decision).toBe('block')
  })
})

describe('A4 compat-atomic C3: a crash between the delete and the put', () => {
  it('the crash fires inside the state transition and reaches the caller as a typed seam failure', () => {
    const run = must(crashRun)
    expect(run.crashed.decision).toBe('reprobe')
    // `normalizeSeamError` flattens a crash that carries no seam code into
    // SEAM_FAILURE / problem `unclassified-seam-error`: that the write died
    // MID-ATOMIC-WRITE survives only in the message text, not in the identity.
    // Pinned as observed; widening the error vocabulary is not this lane's call.
    expect(run.crashed.cause).toEqual({
      name: 'TeamDomainError',
      code: 'SEAM_FAILURE',
      problem: 'unclassified-seam-error',
    })
  })

  it('after a real reopen the compatibility state is GONE - the row, its generation and the human acknowledgement with it', () => {
    const run = must(crashRun)
    expect(run.before.generation).toBe(2)
    expect(run.before.acks).toBe(1)
    expect(run.afterReopen).toBeUndefined()
  })

  it('recovery re-establishes the state from scratch: the generation line resets to 1 and the acknowledgement is not recoverable', () => {
    const run = must(crashRun)
    expect(run.afterRecovery !== undefined).toBe(true)
    expect(run.afterRecovery?.generation).toBe(1)
    expect(run.afterRecovery?.acks).toBe(0)
  })
})

describe('A4 compat-atomic C4: restart reconstruction from a real reopened store', () => {
  it('the durable state survives the restart and the second process sees it as FRESH (no re-probe, zero writes)', () => {
    const run = must(restartRun)
    expect(run.moduleIsFresh).toBe(true)
    expect(run.after?.generation).toBe(run.before.generation)
    expect(run.after?.fingerprint).toBe(run.before.fingerprint)
    expect(run.consultation.decision).toBe('admit')
    expect(run.consultation.reprobed).toBe(false)
    expect(run.freshWriteCount).toBe(0)
  })

  it('the same consultation over a FRESH EMPTY store is a different shape (the leg above is not vacuous)', () => {
    const run = must(restartRun)
    expect(run.emptyCounterfactual.reprobed).toBe(true)
    expect(run.emptyCounterfactual.decision).toBe('admit')
  })
})

describe('A4 compat-atomic C5: the replace sequence at the repository seam', () => {
  it('between the delete and the put the row reads as ABSENT to anyone who looks', () => {
    const run = must(sequenceLeg)
    expect(run.observedBetween).toBeUndefined()
    expect(run.after?.generation).toBe(2)
  })
})
