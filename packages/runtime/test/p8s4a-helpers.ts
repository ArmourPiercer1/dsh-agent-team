/**
 * p8s4a-helpers — shared fixtures for the P8-S4A (unified compatibility
 * admission) acceptance tests (closure plan §17.1; DevPlan §20.1).
 *
 * The P8-S4A deliverable is the SINGLE compatibility admission authority
 * (`createCompatibilityAuthority`): every NEW WORK entry point (follow-up,
 * delegate-continue, delegate-create, explicit-create) consults ONE
 * authority through the exact chain
 *
 *   read facts -> fingerprint -> ensure freshness -> durable state ->
 *   validate ACKs -> one admission result.
 *
 * These helpers build the world + authority fixtures the C-item tests
 * drive (C1 stale OPEN, C2 stale ACK after drift, C6 FATAL never
 * ack-able at the authority level; the C3/C4/C5 entry-point fixtures are
 * composed inline in `p8s4a-entrypoints.test.ts` over the P6-T2 world).
 *
 * Contents:
 *
 * - {@link MutableFacts} — the mutable environment-facts holder: the tests
 *   replace `current` between calls to model the environment drifting, and
 *   every later authority / entry-point read observes the drifted
 *   environment (the environment itself is the fixture);
 * - {@link P8S4AAuthorityHandle} — a P6-T1 durable world (REAL
 *   repositories, REAL fixture blueprint) + the SINGLE compatibility
 *   admission authority wired to the SAME mutable facts + a controlled
 *   clock (one authority per handle — the entry points build their own
 *   over the same durable store, so all agree on one state);
 * - {@link createP8S4AAuthorityWorld} / {@link destroyP8S4AAuthorityWorld}
 *   — build / destroy;
 * - {@link plantStaleRow} — install a synthetic DURABLE compatibility row
 *   with a caller-chosen (deliberately STALE) fingerprint: the "stale
 *   durable verdict" fixture the authority must never trust without a
 *   freshness re-probe;
 * - {@link outcomeRows} / {@link outcomeAck} — read one durable row's
 *   requirement outcome rows + a row's ack classification (the ack
 *   VALID / STALE / MISSING evidence for C2).
 *
 * Top-level-await pattern (plain-node shim): the world is built at module
 * top level in the test, this file only exports factories.
 *
 * @module @dsh-agent-team/runtime/test/p8s4a-helpers
 */

import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import type { CompatibilityStateRecord } from '../../storage/schema/index.js'
import { createCompatibilityAuthority } from '../compatibility/index.js'
import type { CompatibilityAuthority } from '../compatibility/index.js'
import {
  P6T1_FIXTURE,
  createP6T1World,
  destroyP6T1World,
  makeEnvironmentFacts,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

/** The controlled clock state (one shared counter, ISO-8601 UTC output). */
interface P8S4AClock {
  /** The clock value in epoch milliseconds (mutated by `advance`). */
  ms: number
}

const P8S4A_CLOCK_START_MS = Date.parse('2026-08-31T12:00:00.000Z')
const P8S4A_NOW = '2026-08-31T12:00:00Z'

function makeNow(clock: P8S4AClock): () => string {
  return () => new Date(clock.ms).toISOString()
}

/**
 * The mutable environment-facts holder. Replace `current` between
 * authority / entry-point calls to model the environment drifting (a
 * capability disappears, a probe generation bumps); every later read
 * observes the drifted environment.
 */
export interface MutableFacts {
  /** The facts the next environment read observes. */
  current: EnvironmentFact[]
}

/**
 * One P8-S4A authority test world: the P6-T1 durable world (REAL
 * repositories, REAL fixture blueprint) + the SINGLE compatibility
 * admission authority wired to the mutable facts + the controlled clock.
 */
export interface P8S4AAuthorityHandle {
  /** The P6-T1 durable world (the REAL repositories + blueprint). */
  readonly world: P6T1World
  /** The SINGLE compatibility admission authority under test. */
  readonly authority: CompatibilityAuthority
  /** The mutable environment-facts holder (drift by replacing `current`). */
  readonly facts: MutableFacts
  /** Advance the controlled clock by `ms` milliseconds. */
  advance: (ms: number) => void
}

/**
 * Build one P8-S4A authority world: the P6-T1 durable world (a REAL
 * TeamDomain over a fresh scratch dir, the REAL fixture blueprint) with
 * the SINGLE compatibility admission authority wired to a mutable facts
 * holder + a controlled clock.
 *
 * @param basename - the scratch dir basename (unique per test).
 */
export async function createP8S4AAuthorityWorld(
  basename: string,
): Promise<P8S4AAuthorityHandle> {
  const facts: MutableFacts = { current: makeEnvironmentFacts() }
  const clock: P8S4AClock = { ms: P8S4A_CLOCK_START_MS }
  const world = await createP6T1World(basename, {
    environmentFacts: async () => facts.current,
  })
  const authority = createCompatibilityAuthority({
    repositories: world.domain.repositories,
    rootSessionId: String(P6T1_FIXTURE.rootSessionId),
    blueprint: world.blueprint,
    environmentFacts: async () => facts.current,
    now: makeNow(clock),
  })
  return {
    world,
    authority,
    facts,
    advance: (ms: number) => {
      clock.ms += ms
    },
  }
}

/** Destroy one P8-S4A authority world (the durable scratch dir). */
export async function destroyP8S4AAuthorityWorld(
  handle: P8S4AAuthorityHandle,
): Promise<void> {
  await destroyP6T1World(handle.world)
}

/** The options of one synthetic durable compatibility row. */
export interface PlantStaleRowOptions {
  /** The durable status to install (e.g. a STALE `OPEN` verdict). */
  readonly status: CompatibilityStateRecord['status']
  /** The (deliberately stale) environment fingerprint to bind. */
  readonly fingerprint: string
  /** The generation counter to install (defaults to 1). */
  readonly generation?: number
}

/**
 * Install a synthetic DURABLE compatibility row for the team root with a
 * caller-chosen fingerprint (the "stale durable verdict" fixture). The row
 * is written DIRECTLY through the repository (no probe) so its fingerprint
 * is whatever the caller chooses — deliberately UNRELATED to the live
 * environment, which is exactly the stale-generation the authority must
 * re-probe rather than trust.
 *
 * @param world - the P8-S4A world (fresh: the store has no row yet).
 * @param options - the status / fingerprint / generation to install.
 * @returns the frozen stored record.
 */
export async function plantStaleRow(
  world: P6T1World,
  options: PlantStaleRowOptions,
): Promise<CompatibilityStateRecord> {
  return world.domain.repositories.compatibility.put({
    schemaVersion: 1,
    rootSessionId: P6T1_FIXTURE.rootSessionId,
    status: options.status,
    fingerprint: options.fingerprint,
    generation: options.generation ?? 1,
    outcomes: {},
    acknowledgements: [],
    computedAt: P8S4A_NOW,
  })
}

/**
 * Read one durable row's requirement outcome rows (the closed
 * `outcomes.requirements` array). Test failure when the shape is wrong.
 */
export function outcomeRows(
  record: CompatibilityStateRecord,
): readonly Record<string, unknown>[] {
  const raw = record.outcomes['requirements']
  if (!Array.isArray(raw)) {
    throw new Error('p8s4a: outcomes.requirements is not an array')
  }
  return raw as readonly Record<string, unknown>[]
}

/**
 * Read one requirement outcome row's acknowledgement classification
 * (`status` = VALID / STALE / MISSING, and the bound environment
 * fingerprint) — the C2 "stale ACK is invalid" evidence.
 */
export function outcomeAck(
  row: Record<string, unknown>,
): { readonly status: string | undefined; readonly envFp: string | undefined } {
  const refRaw = row['acknowledgement']
  const ref =
    typeof refRaw === 'object' && refRaw !== null
      ? (refRaw as Record<string, unknown>)
      : undefined
  if (ref === undefined) return { status: undefined, envFp: undefined }
  const boundRaw = ref['acknowledgement']
  const bound =
    typeof boundRaw === 'object' && boundRaw !== null
      ? (boundRaw as Record<string, unknown>)
      : undefined
  return {
    status: ref['status'] !== undefined ? String(ref['status']) : undefined,
    envFp:
      bound !== undefined && typeof bound['environmentFingerprint'] === 'string'
        ? bound['environmentFingerprint']
        : undefined,
  }
}
