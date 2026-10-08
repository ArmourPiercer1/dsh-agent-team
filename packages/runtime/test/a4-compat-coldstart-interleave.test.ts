/**
 * a4-compat-coldstart-interleave.test.ts — A4-PR7 f2 lane: what an external
 * reviewer called **F2**, decided by experiment instead of by comment.
 *
 * THE TWO CLAIMS UNDER TEST (an external review of PR #208, which replaced the
 * probe's `delete`+`put` with `replaceIfGeneration`; the law that fix pinned is
 * `a4-compat-atomic-state.test.ts`).
 *
 *  F2.1 — COLD START HAS NO CAS. `CompatibilityRepository.replaceIfGeneration`
 *         routes `expectedGeneration === 0` to `put`, and
 *         `BaseRepository.putRecord` reads the key (`readRow`) OUTSIDE any
 *         atomic slot (`storage/repositories/base.ts`). The repository ALREADY
 *         discloses this ("DISCLOSED RESIDUAL",
 *         `storage/repositories/compatibility.ts`), so this lane does not
 *         re-litigate the disclosure: it tests the CONSEQUENCE and the
 *         DETECTABILITY. The disclosure's defence is that a concurrent creator
 *         is reported as `RECORD_DUPLICATE` / `duplicate-compatibility-state` —
 *         true only when the loser's occupancy read lands AFTER the winner's
 *         commit. Legs C1/C4 force the other interleave (both occupancy reads
 *         before either commit) and pin what is then observable: BOTH creates
 *         commit and NEITHER is reported. They also pin what survives anyway —
 *         one complete record, the winner's generation, no absent window, no
 *         torn row — which is the exact boundary of the harm.
 *
 *  F2.2 — STATUS EQUALITY IS NOT FINGERPRINT AGREEMENT. After the freshness
 *         re-probe, `compatibility/authority.ts` re-reads the row and compares
 *         `result.status` with `state.status`, but never compares the persisted
 *         `state.fingerprint` with the `liveFingerprint` of THAT consultation.
 *         The assumption in `replaceIfGeneration`'s comment — that two cold
 *         creators necessarily share a fingerprint because they read the same
 *         environment — is FALSE by construction: `options.environmentFacts()`
 *         is a port called once per consultation (and AGAIN inside `probe`), so
 *         two authorities can hold different facts. Leg C1 gives them exactly
 *         that: different fingerprints, SAME status `OPEN`, and shows a
 *         consultation returning a verdict carrying a fingerprint it never
 *         computed.
 *
 * WHY THE STOCK FAKE HIDES F2.1, AND WHAT THE BARRIER DOES INSTEAD.
 * `packages/testkit/fault-injection/file-seam.mjs:makeTable().put` advances the
 * in-memory rows SYNCHRONOUSLY inside the call, so on that double
 * `putRecord`'s occupancy read and its commit form one uninterruptible block —
 * the cold double-create cannot be entered at all, which is why the cold-race
 * legs of `a4-compat-atomic-state.test.ts` see the loser reported every single
 * time. The pinned upstream seam is not built that way:
 * `storage-domain/src/domain.ts:KvTableImpl.put` (baseline `639ed01539`,
 * 0.2.0-rc.2) is `enqueue(async () => { await unit.putRecord(...);
 * this.records.set(key, value) })` — the commit happens at the write-chain slot,
 * after a durability await, never at call time. The TeamDomain seam contract
 * says the same from the consumer's side: `put` is "insert or overwrite one
 * record durably" returning a promise, while only `update` is documented as
 * running "on the domain's write chain" (`packages/storage/schema/seam.ts`).
 *
 * So the barrier here does NOT simulate an outcome. It is a seam double that
 * restores the pinned seam's documented commit timing — every write's commit is
 * deferred past an await, and the test may hold one chosen commit parked. The
 * product path is walked end to end and untouched (authority → prober →
 * CompatibilityRepository → BaseRepository → table), nothing internal is called
 * to fake a result, and the durable medium stays the real file-backed one, so
 * the write log remains durable truth. `FileStorageSeam`'s synchronous commit
 * is reported as a separate fidelity finding; rewriting shared test
 * infrastructure would reschedule every suite that uses it, which is outside
 * this lane.
 *
 * THE LAW THESE LEGS PIN (and the fix that makes it hold):
 *
 *   A consultation returns a verdict about ONE environment: the fingerprint it
 *   reports is the fingerprint of the facts THAT consultation read AND the
 *   fingerprint of the durable row. A consultation whose re-probe left a row
 *   describing a DIFFERENT environment fails closed — the same boundary
 *   `a4-compat-atomic-state.test.ts` A7 pins for a loser of the compare-and-set
 *   ("converging there would trust a state that does not describe the live
 *   environment"), applied to the case the compare-and-set cannot see.
 *
 * THE RESIDUAL THIS FILE PINS BUT CANNOT CLOSE (CORE_SEAM_BLOCKER, leg C4): when
 * the loser's commit is overwritten only AFTER its own post-probe re-read, every
 * read inside that chain was TRUE at the instant it happened, and no later
 * re-read can distinguish it — only a conditional CREATE at the seam could
 * (`update` rejects a missing key with `missing-key`, so the public seam has no
 * compare-and-set for a create). The bounded consequence is recorded in C4.
 *
 * DETERMINISM, NOT RATES. No sleeps, no timers, no re-run-until-green: parking
 * is confirmed through `entered`, and every release is followed by an await on
 * the COMMIT LEDGER (a released write is known to have landed, not assumed).
 * The one ordered hold point is the generation-stamp advance — the last await
 * before the authority's post-probe re-read, the same handle
 * `a4-compat-atomic-state.test.ts` uses. A monotonic, always-distinct clock keeps
 * the two candidate records byte-distinct, so a "same bytes anyway" rescue is
 * impossible, and the two facts pairs are pinned apart up front (leg C0) so no
 * leg can go vacuous silently.
 *
 * @module @dsh-agent-team/runtime/test/a4-compat-coldstart-interleave
 */

import { describe, expect, it } from 'vitest'

import {
  computeEnvironmentFingerprint,
  parseRequirements,
} from '../../domain/compatibility/src/index.js'
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import { openTeamDomain } from '../../storage/repositories/index.js'
import type { TeamDomain, TeamDomainRepositories } from '../../storage/repositories/index.js'
import type {
  StorageDomainHandle,
  StorageDomainSeam,
  StorageKvTable,
} from '../../storage/schema/index.js'
import type { CompatibilityStateRecord } from '../../storage/schema/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import { compatibilityRequirementsOf } from '../compatibility/blueprint.js'
import { createCompatibilityAuthority } from '../compatibility/index.js'
import type {
  CompatibilityAdmissionDecision,
  CompatibilityAuthority,
} from '../compatibility/index.js'
// The RAW chain result type is exported by the module that owns it; the barrel
// does not re-export it and this lane does not widen the public surface for a
// test.
import type { CompatibilityEvaluation } from '../compatibility/authority.js'
import {
  P6T1_FIXTURE,
  createP6T1World,
  destroyP6T1World,
  makeEnvironmentFacts,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { factsWebGenerationBump } from './p7t1-helpers.js'

const ROOT = String(P6T1_FIXTURE.rootSessionId)

/** Fixed epoch; the clock is monotonic from here, never the wall clock. */
const CLOCK_START_MS = Date.parse('2026-10-09T00:00:00.000Z')

/**
 * The two environment readings under test. `FACTS_A` is the fixture's OPEN
 * environment; `FACTS_B` bumps the generation of ONE relevant capability with
 * availability unchanged — a DIFFERENT fingerprint (the probe records carry the
 * generation) and the SAME status `OPEN`. That pair is the whole point: a
 * status comparison cannot tell the two environments apart. Leg C0 pins it.
 */
const FACTS_A: readonly EnvironmentFact[] = makeEnvironmentFacts()
const FACTS_B: readonly EnvironmentFact[] = factsWebGenerationBump()

// ---------------------------------------------------------------------------
// The write barrier: a seam double that commits when the test lets it.
// ---------------------------------------------------------------------------

/** One write observed by the wrapper, at its commit point. */
interface WriteObservation {
  readonly table: string
  readonly key: string
  readonly op: 'put' | 'update' | 'delete'
  /** What the table itself held for this key when this write reached its commit. */
  readonly rowAbsentAtCommit: boolean
  /** For a compatibility create: the fingerprint the record carries. */
  readonly fingerprint: string | undefined
  /** For a compatibility create: the `computedAt` that record carries. */
  readonly computedAt: string | undefined
}

/** Park one write: resolve to let it commit, hold it to keep it parked. */
type Park = (observation: WriteObservation) => Promise<void>

/** Read one field out of one canonical compatibility row. */
function fieldOf(row: string, field: 'fingerprint' | 'computedAt'): string | undefined {
  try {
    const parsed = JSON.parse(row) as Record<string, unknown>
    const value = parsed[field]
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * Wrap a seam so every table write commits only after `park` resolves. This is
 * the pinned upstream timing (`put` commits at its write-chain slot, after a
 * durability await), not a shortcut: reads stay synchronous, the durable write
 * is still the real tmp+rename of the file seam, and every product layer runs
 * its own code.
 */
function commitDeferredSeam(
  seam: StorageDomainSeam,
  park: Park,
  onCommit: (observation: WriteObservation) => void,
): StorageDomainSeam {
  const deferTable = (real: StorageKvTable, table: string): StorageKvTable => {
    const observe = (
      key: string,
      op: WriteObservation['op'],
      value: unknown,
    ): WriteObservation => {
      const row = op === 'put' && table === 'compatibility' && typeof value === 'string' ? value : undefined
      return {
        table,
        key,
        op,
        rowAbsentAtCommit: real.get(key) === undefined,
        fingerprint: row === undefined ? undefined : fieldOf(row, 'fingerprint'),
        computedAt: row === undefined ? undefined : fieldOf(row, 'computedAt'),
      }
    }
    return {
      get: (key) => real.get(key),
      entries: () => real.entries(),
      keys: () => real.keys(),
      get size() {
        return real.size
      },
      put: async (key, value) => {
        const observation = observe(key, 'put', value)
        await park(observation)
        await real.put(key, value)
        onCommit(observation)
      },
      delete: async (key) => {
        const observation = observe(key, 'delete', undefined)
        await park(observation)
        const existed = await real.delete(key)
        onCommit(observation)
        return existed
      },
      update: async (key, fn) => {
        const observation = observe(key, 'update', undefined)
        await park(observation)
        const next = await real.update(key, fn)
        onCommit(observation)
        return next
      },
    }
  }
  const deferHandle = (handle: StorageDomainHandle): StorageDomainHandle => {
    // One stable handle per table, as the seam contract requires.
    const tables = new Map<string, StorageKvTable>()
    return {
      name: handle.name,
      table: (name) => {
        const cached = tables.get(name)
        if (cached !== undefined) return cached
        const deferred = deferTable(handle.table(name), name)
        tables.set(name, deferred)
        return deferred
      },
      close: () => handle.close(),
    }
  }
  return {
    open: async (spec) => deferHandle(await seam.open(spec)),
    closeAll: () => seam.closeAll(),
  }
}

/**
 * One parking point. `pass()` parks a call until `release()`; `entered`
 * resolves when a call has ACTUALLY parked, so the test never guesses that the
 * interleave happened. After `release()` every later call passes untouched.
 */
class ParkGate {
  private waiters: Array<() => void> = []
  private armed = true
  private resolveEntered: (() => void) | undefined
  private enteredFired = false
  readonly entered: Promise<void>

  constructor() {
    this.entered = new Promise<void>((resolve) => {
      this.resolveEntered = resolve
    })
  }

  async pass(): Promise<void> {
    if (!this.armed) return
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
 * The commit ledger: every write that ACTUALLY committed through the wrapper,
 * in commit order, plus awaits on "n compatibility creates have landed" — so a
 * release is followed by its consequence instead of by a guess.
 */
class CommitLedger {
  private readonly committed: WriteObservation[] = []
  private waiters: Array<() => void> = []

  note(observation: WriteObservation): void {
    this.committed.push(observation)
    for (const resolve of this.waiters.splice(0)) resolve()
  }

  private async untilMatch(
    predicate: (committed: readonly WriteObservation[]) => boolean,
  ): Promise<void> {
    while (!predicate(this.committed)) {
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve)
      })
    }
  }

  /** Await "at least `count` compatibility creates have committed". */
  untilCreates(count: number): Promise<void> {
    return this.untilMatch((c) => c.filter(isCompatibilityCreate).length >= count)
  }

  /** The committed compatibility creates, in COMMIT order. */
  creates(): WriteObservation[] {
    return this.committed.filter(isCompatibilityCreate)
  }

  /** The committed ops of one table, in commit order. */
  ops(table: string): string[] {
    return this.committed.filter((w) => w.table === table).map((w) => w.op)
  }
}

function isCompatibilityCreate(w: WriteObservation): boolean {
  return w.table === 'compatibility' && w.op === 'put'
}

// ---------------------------------------------------------------------------
// Views, capture helpers.
// ---------------------------------------------------------------------------

/** One durable compatibility row, reduced to what these legs assert on. */
interface RowView {
  readonly generation: number
  readonly status: string
  readonly fingerprint: string
  readonly computedAt: string
  readonly acks: number
}

/** One probe as the authority that fired it saw it (its own candidate). */
interface ProbeView {
  readonly fingerprint: string
  readonly status: string
  readonly generation: number
  readonly recordedAt: string
}

/** The identity of one authority decision (never a message string). */
interface DecisionView {
  readonly decision: string
  readonly reprobeReason: string | undefined
  readonly status: string | undefined
  readonly fingerprint: string | undefined
  readonly generation: number | undefined
  readonly reprobed: boolean | undefined
}

function decisionView(d: CompatibilityAdmissionDecision): DecisionView {
  if (d.decision === 'reprobe') {
    return {
      decision: d.decision,
      reprobeReason: d.reprobeReason,
      status: undefined,
      fingerprint: d.fingerprint,
      generation: undefined,
      reprobed: undefined,
    }
  }
  return {
    decision: d.decision,
    reprobeReason: undefined,
    status: d.status,
    fingerprint: d.fingerprint,
    generation: d.generation,
    reprobed: d.reprobed,
  }
}

/** The same identity for the RAW evaluation entry point (plan §E.4 consumer). */
function evaluationView(e: CompatibilityEvaluation): DecisionView {
  if (!e.chainOk) {
    return {
      decision: 'reprobe',
      reprobeReason: e.reprobeReason,
      status: undefined,
      fingerprint: e.fingerprint,
      generation: undefined,
      reprobed: undefined,
    }
  }
  return {
    decision: 'evaluate',
    reprobeReason: undefined,
    status: e.status,
    fingerprint: e.fingerprint,
    generation: e.generation,
    reprobed: e.reprobed,
  }
}

function rowView(row: CompatibilityStateRecord | undefined): RowView | undefined {
  if (row === undefined) return undefined
  return {
    generation: row.generation,
    status: row.status,
    fingerprint: row.fingerprint,
    computedAt: row.computedAt,
    acks: row.acknowledgements.length,
  }
}

/** One scenario captured at module load, or the error that broke it. */
type Captured<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly label: string; readonly error: unknown }

/**
 * Run one scenario at module load and KEEP the failure instead of throwing it:
 * a broken schedule must report as a leg failure naming its scenario, never as
 * a collection error that hides every other leg of the family.
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

// ---------------------------------------------------------------------------
// The world: the real P6-T1 durable team, reopened through the barrier.
// ---------------------------------------------------------------------------

/** One cold (no compatibility row) world over the commit-deferred seam. */
interface ColdWorld {
  readonly repositories: TeamDomainRepositories
  readonly blueprint: TeamBlueprint
  readonly ledger: CommitLedger
  /** Replace the parking rule between phases of a scenario. */
  setPark: (park: Park) => void
  /** The fingerprint one environment reading produces for THIS blueprint. */
  fp: (facts: readonly EnvironmentFact[]) => string
  /** One authority plus the probe identities it fires (its own candidates). */
  probing: (facts: readonly EnvironmentFact[]) => {
    readonly authority: CompatibilityAuthority
    readonly probes: () => ProbeView[]
  }
  /** The durable compatibility row, reduced. */
  row: () => RowView | undefined
  close: () => Promise<void>
}

/**
 * Build one cold world: seed the durable TeamSession + team-root binding with
 * the shared P6-T1 factory, then REOPEN the same directory through the
 * commit-deferred seam — the row-17 restart pattern, with the seam's commit
 * timing made the thing under test.
 */
async function createColdWorld(basename: string): Promise<ColdWorld> {
  const seeded: P6T1World = await createP6T1World(basename, {
    environmentFacts: async () => FACTS_A,
  })
  await seeded.domain.close()

  const ledger = new CommitLedger()
  let park: Park = async () => undefined
  const seam = new FileStorageSeam(seeded.scratchDir)
  const domain: TeamDomain = await openTeamDomain(
    commitDeferredSeam(seam, (observation) => park(observation), (observation) => {
      ledger.note(observation)
    }),
  )

  let tick = 0
  const now = (): string => new Date(CLOCK_START_MS + (tick += 1) * 1_000).toISOString()
  const blueprint = seeded.blueprint
  const requirements = parseRequirements(compatibilityRequirementsOf(blueprint))

  return {
    repositories: domain.repositories,
    blueprint,
    ledger,
    setPark: (next) => {
      park = next
    },
    fp: (facts) => computeEnvironmentFingerprint(requirements, facts),
    probing: (facts) => {
      const record: ProbeView[] = []
      const authority = createCompatibilityAuthority({
        repositories: domain.repositories,
        rootSessionId: ROOT,
        blueprint,
        environmentFacts: async () => facts,
        now,
        onProbe: (outcome) => {
          record.push({
            fingerprint: outcome.environmentFingerprint,
            status: outcome.status,
            generation: outcome.generation,
            recordedAt: outcome.recordedAt,
          })
        },
      })
      return { authority, probes: () => record }
    },
    row: () => rowView(domain.repositories.compatibility.get(ROOT)),
    close: async () => {
      await domain.close()
      await destroyP6T1World(seeded)
    },
  }
}

// ---------------------------------------------------------------------------
// The choreography: two creators, ONE cold generation, BOTH occupancy reads
// before EITHER commit.
// ---------------------------------------------------------------------------

/** Everything one forced interleaving leaves behind. */
interface Choreo<T> {
  readonly fpA: string
  readonly fpB: string
  readonly a: T
  readonly b: T
  /** The two creates as they reached their commit point, in arrival order. */
  readonly parked: WriteObservation[]
  /** The two creates as they COMMITTED, in commit order. */
  readonly committedCreates: WriteObservation[]
  readonly compatibilityOps: string[]
  readonly teamSessionOps: string[]
  readonly row: RowView | undefined
  readonly probesA: ProbeView[]
  readonly probesB: ProbeView[]
  /** A fresh consultation over FACTS_A after the dust settled (admit entry). */
  readonly recovery: DecisionView | undefined
}

/**
 * Drive the cold double-create.
 *
 *  1. two independent authorities (their own facts, their own prober, their own
 *     lock) consult ONE cold generation concurrently;
 *  2. BOTH park at the commit of their cold create — since `putRecord` performs
 *     its occupancy read BEFORE handing the row to the table, a parked commit
 *     proves the occupancy read already happened; the wrapper additionally
 *     records what the table itself held at that instant;
 *  3. the first creator is released, its row lands, and it is then held at its
 *     OWN generation-stamp advance: committed, not yet stamped, and therefore
 *     provably before its post-probe re-read;
 *  4. the second creator's parked commit is released and lands on top;
 *  5. the first creator's stamp is released and both consultations settle.
 *
 * `loserFinishesFirst` switches 3–5 for the schedule in which the first creator
 * completes its whole consultation while the second creator's commit is still
 * parked — the CORE_SEAM_BLOCKER schedule of leg C4.
 */
async function choreographColdCreate<T>(
  basename: string,
  options: {
    readonly factsB: readonly EnvironmentFact[]
    readonly consult: (authority: CompatibilityAuthority) => Promise<T>
    readonly loserFinishesFirst?: boolean
    readonly withRecovery?: boolean
  },
): Promise<Choreo<T>> {
  const world = await createColdWorld(basename)
  try {
    const fpA = world.fp(FACTS_A)
    const fpB = world.fp(options.factsB)
    const sameFingerprint = fpA === fpB
    const gateA = new ParkGate()
    const gateB = new ParkGate()
    const stampOfA = new ParkGate()
    const parked: WriteObservation[] = []

    // Phase 1: park each creator's cold create. Different fingerprints route by
    // fingerprint; identical ones route by arrival (the barrier below proves
    // both parked, and leg C2 re-identifies each candidate by its own clock
    // stamp, so the assignment is verified, not assumed).
    let arrivals = 0
    world.setPark(async (observation) => {
      if (observation.table !== 'compatibility' || observation.op !== 'put') return
      arrivals += 1
      parked.push(observation)
      const gate = sameFingerprint
        ? arrivals === 1
          ? gateA
          : gateB
        : observation.fingerprint === fpA
          ? gateA
          : gateB
      await gate.pass()
    })

    const a = world.probing(FACTS_A)
    const b = world.probing(options.factsB)
    const runA = options.consult(a.authority)
    const runB = options.consult(b.authority)

    // THE BARRIER: both creators are now standing at their commit with nothing
    // committed — each one's `putRecord` occupancy read has already returned
    // "absent". Nothing here guesses: `entered` fired inside the real write.
    await Promise.all([gateA.entered, gateB.entered])

    // Phase 2: hold A at its stamp (the last await before its post-probe
    // re-read); everything else flows.
    world.setPark(async (observation) => {
      if (observation.table === 'team_sessions' && observation.op === 'update') {
        await stampOfA.pass()
      }
    })
    gateA.release()
    await world.ledger.untilCreates(1)
    await stampOfA.entered

    if (options.loserFinishesFirst === true) {
      stampOfA.release()
      const first = await runA
      gateB.release()
      await world.ledger.untilCreates(2)
      const second = await runB
      // NOT `return finish(...)`: a `return` inside a try/finally runs the
      // finally (the domain close) BEFORE the awaited value settles, which
      // would close the store under the scenario's own read-back.
      const done = await finish(world, options, fpA, fpB, first, second, a, b, parked)
      return done
    }

    gateB.release()
    await world.ledger.untilCreates(2)
    stampOfA.release()
    const [first, second] = await Promise.all([runA, runB])
    const done = await finish(world, options, fpA, fpB, first, second, a, b, parked)
    return done
  } finally {
    await world.close()
  }
}

async function finish<T>(
  world: ColdWorld,
  options: {
    readonly factsB: readonly EnvironmentFact[]
    readonly consult: (authority: CompatibilityAuthority) => Promise<T>
    readonly withRecovery?: boolean
  },
  fpA: string,
  fpB: string,
  a: T,
  b: T,
  probesA: { probes: () => ProbeView[] },
  probesB: { probes: () => ProbeView[] },
  parked: WriteObservation[],
): Promise<Choreo<T>> {
  // The durable truth of the RACE is read back BEFORE any later consultation
  // can touch it: the recovery consult below is a separate, deliberate event.
  const committedCreates = world.ledger.creates()
  const compatibilityOps = world.ledger.ops('compatibility')
  const teamSessionOps = world.ledger.ops('team_sessions')
  const row = world.row()
  const recovery =
    options.withRecovery === true
      ? decisionView(await world.probing(FACTS_A).authority.admit())
      : undefined
  return {
    fpA,
    fpB,
    a,
    b,
    parked,
    committedCreates,
    compatibilityOps,
    teamSessionOps,
    row,
    probesA: probesA.probes(),
    probesB: probesB.probes(),
    recovery,
  }
}

/** One consultation on a cold world with no barrier (the premise leg). */
async function soloConsult(
  basename: string,
  facts: readonly EnvironmentFact[],
): Promise<{ readonly decision: DecisionView; readonly row: RowView | undefined; readonly fp: string }> {
  const world = await createColdWorld(basename)
  try {
    const { authority } = world.probing(facts)
    const decision = decisionView(await authority.admit())
    return { decision, row: world.row(), fp: world.fp(facts) }
  } finally {
    await world.close()
  }
}

// ---------------------------------------------------------------------------
// The runs (module load, captured — never inside a `describe` body).
// ---------------------------------------------------------------------------

const admitEntry = (authority: CompatibilityAuthority): Promise<CompatibilityAdmissionDecision> =>
  authority.admit()
const evaluateEntry = (authority: CompatibilityAuthority): Promise<CompatibilityEvaluation> =>
  authority.evaluate()

const premiseA = await captureRun('C0 solo A', () => soloConsult('a4f2-solo-a', FACTS_A))
const premiseB = await captureRun('C0 solo B', () => soloConsult('a4f2-solo-b', FACTS_B))

/** C1: crossed commits, DIFFERENT facts, admit entry. */
const crossed = await captureRun('C1 crossed commits (different facts)', () =>
  choreographColdCreate<CompatibilityAdmissionDecision>('a4f2-crossed-different', {
    factsB: FACTS_B,
    consult: admitEntry,
    withRecovery: true,
  }),
)

/** C2: the same schedule with IDENTICAL facts — the control. */
const crossedSame = await captureRun('C2 crossed commits (identical facts)', () =>
  choreographColdCreate<CompatibilityAdmissionDecision>('a4f2-crossed-same', {
    factsB: FACTS_A,
    consult: admitEntry,
  }),
)

/** C3: the same schedule, RAW evaluation entry point. */
const crossedEval = await captureRun('C3 crossed commits (evaluate entry)', () =>
  choreographColdCreate<CompatibilityEvaluation>('a4f2-crossed-eval', {
    factsB: FACTS_B,
    consult: evaluateEntry,
  }),
)

/** C4: the loser completes before the winner's commit lands. */
const loserFirst = await captureRun('C4 loser finishes first', () =>
  choreographColdCreate<CompatibilityAdmissionDecision>('a4f2-loser-first', {
    factsB: FACTS_B,
    consult: admitEntry,
    loserFinishesFirst: true,
  }),
)

// ---------------------------------------------------------------------------
// the legs
// ---------------------------------------------------------------------------

describe('A4 f2 C0: the premise — two environment readings that differ in fingerprint and agree in status', () => {
  it('FACTS_A and FACTS_B produce DIFFERENT fingerprints', () => {
    const a = must(premiseA)
    const b = must(premiseB)
    expect(a.fp === b.fp).toBe(false)
  })

  it('and BOTH are status OPEN on their own, so no status check can tell them apart', () => {
    const a = must(premiseA)
    const b = must(premiseB)
    expect(a.decision.decision).toBe('admit')
    expect(a.decision.status).toBe('OPEN')
    expect(b.decision.decision).toBe('admit')
    expect(b.decision.status).toBe('OPEN')
    expect(a.row?.fingerprint).toBe(a.fp)
    expect(b.row?.fingerprint).toBe(b.fp)
  })
})

describe('A4 f2 C1: two creators, one cold generation, both occupancy reads before either commit', () => {
  it('the interleave is real: BOTH creators read the key as ABSENT and BOTH creates committed (F2.1)', () => {
    const run = must(crossed)
    // Both creators reached their commit standing on an absent key.
    expect(run.parked.length).toBe(2)
    expect(run.parked.map((p) => p.rowAbsentAtCommit)).toEqual([true, true])
    // The two candidates really are the two different environments.
    expect(run.parked.map((p) => p.fingerprint).sort()).toEqual([run.fpA, run.fpB].sort())
    // AND BOTH LANDED: the cold create is not reported. The disclosure's
    // "a concurrent creator is reported as duplicate" holds only when the
    // loser's read lands after the winner's commit — not here.
    expect(run.committedCreates.length).toBe(2)
    expect(run.committedCreates.map((p) => p.fingerprint).sort()).toEqual([run.fpA, run.fpB].sort())
  })

  it('the durable truth is still exactly ONE complete record: the winner\'s, at generation 1, never absent, never torn', () => {
    const run = must(crossed)
    // One logical transition per creator, and NO delete on the store: the row
    // is never observable as absent, because nothing removes it.
    expect(run.compatibilityOps).toEqual(['put', 'put'])
    expect(run.compatibilityOps.includes('delete')).toBe(false)
    const row = run.row
    if (row === undefined) throw new Error('C1: the compatibility row is absent after the race')
    expect(row.generation).toBe(1)
    expect(row.status).toBe('OPEN')
    expect(row.acks).toBe(0)
    // The surviving row is ONE probe\'s complete record — the last committer\'s,
    // identified by that probe\'s own clock stamp, not by a guess.
    const winner = run.committedCreates[run.committedCreates.length - 1]
    if (winner === undefined) throw new Error('C1: no create committed')
    expect(row.fingerprint).toBe(winner.fingerprint)
    expect(row.computedAt).toBe(winner.computedAt)
    const loserStamps = [
      ...(winner.fingerprint === run.fpA ? run.probesB : run.probesA).map((p) => p.recordedAt),
    ]
    expect(loserStamps.includes(row.computedAt)).toBe(false)
  })

  it('every consultation that returns a verdict returns the row\'s generation (no false generation is ever reported)', () => {
    const run = must(crossed)
    if (run.row === undefined) throw new Error('C1: no row')
    const durable = run.row.generation
    const verdicts = [decisionView(run.a), decisionView(run.b)].filter((d) => d.decision !== 'reprobe')
    expect(verdicts.length).toBeGreaterThan(0)
    for (const decision of verdicts) {
      expect(decision.generation).toBe(durable)
    }
  })

  it('THE LAW — a verdict carries the fingerprint of the consultation that reports it, never another environment\'s (F2.2)', () => {
    const run = must(crossed)
    if (run.row === undefined) throw new Error('C1: no row')
    const durable = run.row.fingerprint
    const consultations: Array<{ readonly who: string; readonly live: string; readonly view: DecisionView }> = [
      { who: 'A', live: run.fpA, view: decisionView(run.a) },
      { who: 'B', live: run.fpB, view: decisionView(run.b) },
    ]
    for (const one of consultations) {
      if (one.view.decision === 'reprobe') continue // a chain that failed closed reports no verdict
      // The fingerprint of the facts THIS consultation read …
      expect(one.view.fingerprint).toBe(one.live)
      // … and the fingerprint of the durable row, which are one and the same
      // for any consultation allowed to answer at all.
      expect(one.view.fingerprint).toBe(durable)
    }
  })

  it('a consultation whose re-probe left a row of a DIFFERENT environment fails closed (state-mismatch)', () => {
    const run = must(crossed)
    if (run.row === undefined) throw new Error('C1: no row')
    // Exactly ONE consultation authored the row it reports: the last committer
    // agrees with the durable row; the other one read a row it did not write
    // with facts it did not read, and MUST fail closed instead of admitting.
    const a = decisionView(run.a)
    const b = decisionView(run.b)
    const durable = run.row.fingerprint
    const agreed = [a, b].filter((d) => d.decision !== 'reprobe' && d.fingerprint === durable)
    const refused = [a, b].filter((d) => d.decision === 'reprobe')
    expect(agreed.length).toBe(1)
    expect(refused.length).toBe(1)
    expect(refused[0]?.reprobeReason).toBe('state-mismatch')
    // The refusal names the environment the caller actually read — the one the
    // surviving row does NOT describe.
    const other = durable === run.fpA ? run.fpB : run.fpA
    expect(refused[0]?.fingerprint).toBe(other)
  })

  it('the refusal is transient: the next consultation of the same environment establishes its own generation', () => {
    const run = must(crossed)
    if (run.row === undefined) throw new Error('C1: no row')
    if (run.recovery === undefined) throw new Error('C1: no recovery consultation')
    expect(run.recovery.decision).toBe('admit')
    expect(run.recovery.fingerprint).toBe(run.fpA)
    expect(run.recovery.generation).toBe(run.row.generation + 1)
  })

  it('each creator stamped the team generation for its own create (two advances, one surviving state row)', () => {
    const run = must(crossed)
    // The residue of a create that loses WITHOUT being detected: the stamp
    // advance runs after the state write, so the undetected loser stamps too —
    // TWO advances of the team-session generation for TWO compatibility creates
    // of which exactly ONE survived. That counter is the S1-A stamp-lag
    // instrument, not the compatibility generation the API returns (both
    // consultations were told generation 1, the durable one), so the residue is
    // a counter that ran one ahead, never a wrong state.
    expect(run.teamSessionOps).toEqual(['update', 'update'])
    expect(run.compatibilityOps).toEqual(['put', 'put'])
    expect(run.row?.generation).toBe(1)
  })
})

describe('A4 f2 C2: the SAME schedule with IDENTICAL facts — the control that keeps C1 honest', () => {
  it('both creators carry one fingerprint, so both consultations agree with the row and neither is refused', () => {
    const run = must(crossedSame)
    expect(run.fpA).toBe(run.fpB)
    // The barrier really fired for this schedule too (the leg is not vacuous).
    expect(run.parked.map((p) => p.rowAbsentAtCommit)).toEqual([true, true])
    expect(run.committedCreates.length).toBe(2)
    if (run.row === undefined) throw new Error('C2: the compatibility row is absent')
    const a = decisionView(run.a)
    const b = decisionView(run.b)
    expect(a.decision).toBe('admit')
    expect(b.decision).toBe('admit')
    expect(a.fingerprint).toBe(run.row.fingerprint)
    expect(b.fingerprint).toBe(run.row.fingerprint)
    expect(a.generation).toBe(1)
    expect(b.generation).toBe(1)
  })

  it('the two candidates are still distinct records and the row is one of them whole (no merge, no tear)', () => {
    const run = must(crossedSame)
    if (run.row === undefined) throw new Error('C2: no row')
    // Distinct clock stamps: identical bytes can never silently rescue a loser.
    const stampA = run.probesA[0]?.recordedAt
    const stampB = run.probesB[0]?.recordedAt
    expect(stampA).not.toBe(stampB)
    // The arrival routing this scenario had to fall back to (one shared
    // fingerprint) is VERIFIED here, not assumed: the first create that reached
    // its commit is A's record, by its own clock stamp.
    expect(run.parked[0]?.computedAt).toBe(stampA)
    expect(run.parked[1]?.computedAt).toBe(stampB)
    expect([stampA, stampB]).toContain(run.row.computedAt)
    expect(run.compatibilityOps).toEqual(['put', 'put'])
  })
})

describe('A4 f2 C3: the RAW evaluation entry point cannot carry two fingerprints in one object', () => {
  it('every chainOk evaluation reports ONE fingerprint: its own result\'s and the row\'s', () => {
    const run = must(crossedEval)
    const evaluations: Array<{ readonly who: string; readonly evaluation: CompatibilityEvaluation }> = [
      { who: 'A', evaluation: run.a },
      { who: 'B', evaluation: run.b },
    ]
    for (const one of evaluations) {
      const evaluation = one.evaluation
      if (!evaluation.chainOk || evaluation.result === undefined) continue
      // One object, one environment: the fingerprint of the row it read IS the
      // fingerprint of the engine result it re-derived.
      expect(evaluation.fingerprint).toBe(evaluation.result.environmentFingerprint)
    }
  })

  it('and the chain that cannot honour that fails closed instead of returning a mixed verdict', () => {
    const run = must(crossedEval)
    if (run.row === undefined) throw new Error('C3: no row')
    const views = [evaluationView(run.a), evaluationView(run.b)]
    const mixed = views.filter(
      (v) => v.decision === 'evaluate' && v.fingerprint !== run.row?.fingerprint,
    )
    expect(mixed.length).toBe(0)
    const refused = views.filter((v) => v.decision === 'reprobe')
    const agreed = views.filter((v) => v.decision === 'evaluate')
    expect(agreed.length + refused.length).toBe(2)
    expect(agreed.length).toBe(1)
    expect(refused[0]?.reprobeReason).toBe('state-mismatch')
  })
})

describe('A4 f2 C4: the bounded residual — a create overwritten AFTER the loser re-read (CORE_SEAM_BLOCKER)', () => {
  it('BOTH creates still commit unreported, and the caller that finished first reports a fingerprint the row no longer carries', () => {
    const run = must(loserFirst)
    expect(run.parked.map((p) => p.rowAbsentAtCommit)).toEqual([true, true])
    expect(run.committedCreates.length).toBe(2)
    expect(run.compatibilityOps).toEqual(['put', 'put'])
    if (run.row === undefined) throw new Error('C4: no row')
    const a = decisionView(run.a)
    const b = decisionView(run.b)
    // A completed its whole consultation while B\'s commit was parked: every
    // read inside A\'s chain was TRUE at the instant it happened.
    expect(a.decision).toBe('admit')
    expect(a.fingerprint).toBe(run.fpA)
    // B\'s create then landed on top: the durable row is B\'s.
    expect(b.decision).toBe('admit')
    expect(b.fingerprint).toBe(run.fpB)
    expect(run.row.fingerprint).toBe(run.fpB)
    expect(run.row.generation).toBe(1)
    // So A\'s belief is falsified AFTER the fact, by an event no re-read in
    // A\'s chain could have observed: only a conditional CREATE at the seam —
    // which the public seam does not offer (`update` rejects a missing key with
    // `missing-key`) — could have made B\'s create fail instead.
    expect(a.fingerprint).not.toBe(run.row.fingerprint)
    // Still: exactly one complete record, never absent, never torn, and the
    // generation both callers were told is the durable one.
    expect(run.row.status).toBe('OPEN')
    expect(a.generation).toBe(run.row.generation)
    expect(b.generation).toBe(run.row.generation)
  })
})
