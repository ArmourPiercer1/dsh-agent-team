/**
 * PermissionOverlayRepository — the durable, append-only store of
 * PermissionOverlaySnapshots (Alpha.3 PR1; ADR §1/§2, design §2).
 *
 * Design §2 assigns exactly three roles to this component:
 *
 *   - durable storage;
 *   - append-only snapshot management;
 *   - generation lookup;
 *
 * and exactly three NON-responsibilities, which this class enforces by
 * construction rather than by comment alone:
 *
 *   - no authorization (it never looks at `provenance.actor` to decide
 *     whether a write may happen);
 *   - no envelope validation (no `MutationEnvelope` term exists anywhere in
 *     this package — ADR §6 is PR3);
 *   - no actor checking.
 *
 * ADR §1 also forbids it to bypass mutation serialization or become an
 * alternative write path. Concretely: the ONLY way a row appears is
 * {@link PermissionOverlayRepository.append}, there is no update / delete /
 * overwrite / replay member on the surface, and appends are serialized on
 * this instance so two in-process writers cannot interleave a
 * read-check-put. `permission-overlay-port-surface.test.ts` pins the surface
 * and the import graph; `permission-overlay-history-immutability.test.ts`
 * pins that no write-bypass verb exists.
 *
 * ## The durable write path stays single (PR1)
 *
 * Production gets NO new permission write path from this PR. The future
 * `GovernanceMutationService` (Alpha.3 PR3) remains the SOLE permission
 * mutation authority (ADR §1: Leader/Human request → GovernanceMutationService
 * → PermissionOverlayRepository → durable store); nothing wires this
 * repository to a tool, a remote method, a control request or a lifecycle
 * transition, so nothing outside that future authority can reach it. PR1
 * makes the durable foundation exist and be tested; it does not enable
 * runtime dynamic permission execution.
 *
 * ## Generation CAS at the persistence boundary
 *
 * `append` commits generation `g` for one (TeamSession, MemberInstance) and
 * refuses, as a TYPED `RECORD_DUPLICATE` conflict, every case where the
 * caller's view of the chain is not the durable chain:
 *
 * | `details.problem`             | case                                          |
 * | ----------------------------- | --------------------------------------------- |
 * | `generation-conflict`         | row `g` already durable with DIFFERENT bytes  |
 * | `previous-snapshot-id-mismatch` | `previousSnapshotId` does not name `g - 1`, or the durable head is not `g - 1` |
 * | `predecessor-not-durable`     | `previousSnapshotId` names `g - 1` but that row was never written (no gaps) |
 *
 * Re-appending the byte-identical snapshot at `g` is an idempotent no-op
 * (the TeamDomain idempotency rule), never a second row. An occupied
 * generation is NEVER overwritten, and rows are never deleted.
 *
 * The public seam has no atomic put-if-absent, so append runs its
 * read-check-put inside this instance's serialized append chain — the same
 * discipline `blueprint_registry` documents, strengthened by the chain. A
 * cross-PROCESS writer is exactly the case ADR §1 reserves for
 * `GovernanceMutationService`'s mutation serialization, which is why this
 * repository is a port, not an entry point.
 *
 * ## Durable placement
 *
 * Its own Team-owned domain, one table, opened through the public seam: L1 is
 * the domain version checked at open, L3 is the row `schemaVersion`. There is
 * deliberately no `schema_meta` stamp table: team_domain carries one because
 * nine stores share a single seam version and need per-store stamps; with a
 * single table the open-time version plus the row stamp already pin the
 * shape, and a stamp table would add writes without a check. Placement
 * literalization lives in `schema/permission-overlay.ts` only (open
 * plan-level decision — see the PR body).
 *
 * @module @dsh-agent-team/storage/repositories/permission-overlays
 */

import { isTeamContractError, parseInstanceId, parseRootSessionId } from '../../contracts/src/index.js'
import {
  PERMISSION_OVERLAY_DOMAIN_NAME,
  PERMISSION_OVERLAY_SCHEMA_VERSION,
  PERMISSION_OVERLAY_STORE,
  createPermissionOverlaySeamSpec,
  createPermissionOverlaySnapshot,
  deserializePermissionOverlaySnapshot,
  permissionOverlaySnapshotKey,
  serializePermissionOverlaySnapshot,
} from '../schema/permission-overlay.js'
import type { PermissionOverlaySnapshot, PermissionOverlaySnapshotInput } from '../schema/permission-overlay.js'
import {
  isTeamDomainError,
  normalizeSeamError,
  normalizeValidationError,
  seamErrorCode,
  teamDomainError,
} from '../schema/index.js'
import type { StorageDomainHandle, StorageDomainSeam, StorageKvTable, TeamDomainError } from '../schema/index.js'

/** The closed set of append-conflict `details.problem` tags. */
export const PERMISSION_OVERLAY_CONFLICT_PROBLEMS = [
  'generation-conflict',
  'previous-snapshot-id-mismatch',
  'predecessor-not-durable',
] as const

/** One append-conflict tag. */
export type PermissionOverlayConflictProblem = (typeof PERMISSION_OVERLAY_CONFLICT_PROBLEMS)[number]

/**
 * The append-only snapshot repository of one open overlay store.
 *
 * Surface: `store`, `append`, `latest`, `history`, `at` — and nothing else.
 * The seam handle is held in a PRIVATE field, so no caller can reach the raw
 * table (and therefore `put`/`delete`/`update`) through this object.
 */
export class PermissionOverlayRepository {
  readonly #handle: StorageDomainHandle
  /** The serialized append chain (see the CAS section of the header). */
  #appendChain: Promise<void> = Promise.resolve()

  /**
   * @param handle - the open overlay-domain handle (the injected seam
   *   surface); never stored anywhere reachable from the public API.
   */
  constructor(handle: StorageDomainHandle) {
    this.#handle = handle
  }

  /** The store (table) name this repository manages. */
  get store(): string {
    return PERMISSION_OVERLAY_STORE
  }

  /**
   * Append one full snapshot as the next generation of its identity chain.
   *
   * Structural validation happens first (so a rejected input never touches
   * the medium); the CAS checks then compare the caller's chain view with the
   * durable one. This method performs NO authority, envelope or actor check —
   * by ADR §1 design; the caller is expected to be the future
   * GovernanceMutationService, and refusing is that service's job.
   * @param input - the ADR §2 sections (identity/state/metadata/provenance).
   * @returns the durable snapshot (identical to the input for a fresh append;
   *   the STORED snapshot when the identical row was already durable).
   * @throws `RECORD_INVALID` when the input or a stored row is structurally
   *   invalid; `RECORD_DUPLICATE` with a
   *   {@link PermissionOverlayConflictProblem} `details.problem` on a
   *   generation CAS conflict; `SEAM_FAILURE` / `NOT_OPEN` for seam failures.
   */
  async append(input: PermissionOverlaySnapshotInput): Promise<PermissionOverlaySnapshot> {
    let snapshot: PermissionOverlaySnapshot
    try {
      snapshot = createPermissionOverlaySnapshot(input)
    } catch (error) {
      throw normalizeValidationError(error, PERMISSION_OVERLAY_STORE)
    }
    return this.#serialized(() => this.#append(snapshot))
  }

  /**
   * The CURRENT AUTHORITY of one identity: the snapshot with the HIGHEST
   * generation (ADR §2). The read is a direct lookup of that row — state is
   * never rebuilt by replaying earlier rows (design §3.3).
   * @param teamSessionId - the TeamSession identity.
   * @param memberInstanceId - the MemberInstance identity.
   * @returns the highest-generation snapshot, or `undefined` when the
   *   identity has no snapshot yet.
   */
  latest(teamSessionId: string, memberInstanceId: string): PermissionOverlaySnapshot | undefined {
    const rows = this.#rowsOf(teamSessionId, memberInstanceId)
    let head: PermissionOverlaySnapshot | undefined
    for (const snapshot of rows.values()) {
      if (head === undefined || snapshot.metadata.generation > head.metadata.generation) head = snapshot
    }
    return head
  }

  /**
   * The audit history of one identity: every durable snapshot, ascending by
   * generation. History is AUDIT ONLY (ADR §2) — this read has no effect on
   * what {@link latest} reports, and nothing here folds the rows together.
   * @param teamSessionId - the TeamSession identity.
   * @param memberInstanceId - the MemberInstance identity.
   */
  history(teamSessionId: string, memberInstanceId: string): readonly PermissionOverlaySnapshot[] {
    const rows = [...this.#rowsOf(teamSessionId, memberInstanceId).values()]
    rows.sort((left, right) => left.metadata.generation - right.metadata.generation)
    return rows
  }

  /**
   * Read one snapshot at an exact generation (the durable audit point read).
   * @param teamSessionId - the TeamSession identity.
   * @param memberInstanceId - the MemberInstance identity.
   * @param generation - the generation to read.
   * @returns the snapshot, or `undefined` when that generation is not durable.
   * @throws `RECORD_INVALID` for a malformed identity or generation.
   */
  at(teamSessionId: string, memberInstanceId: string, generation: number): PermissionOverlaySnapshot | undefined {
    const key = this.#keyOf(teamSessionId, memberInstanceId, generation)
    const raw = this.#readRow(key)
    if (raw === undefined) return undefined
    return this.#verifyRow(key, raw)
  }

  // -------------------------------------------------------------------------
  // internals
  // -------------------------------------------------------------------------

  /** Run `task` at the tail of the serialized append chain. */
  #serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = this.#appendChain.then(task, task)
    this.#appendChain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  /** The read-check-put critical section of one append. */
  async #append(snapshot: PermissionOverlaySnapshot): Promise<PermissionOverlaySnapshot> {
    const { teamSessionId, memberInstanceId } = snapshot.identity
    const generation = snapshot.metadata.generation
    const key = this.#keyOf(teamSessionId, memberInstanceId, generation)

    // 1. occupied generation: identical bytes are the idempotent no-op, any
    //    other bytes are a conflict that must NOT overwrite.
    const existing = this.#readRow(key)
    const bytes = serializePermissionOverlaySnapshot(snapshot)
    if (existing !== undefined) {
      if (existing === bytes) return this.#verifyRow(key, existing)
      throw this.#conflict('generation-conflict', key, snapshot, existing)
    }

    // 2. the chain link must name the generation this snapshot claims.
    if (generation > 1) {
      const expectedPrevious = permissionOverlaySnapshotKey(teamSessionId, memberInstanceId, generation - 1)
      if (snapshot.metadata.previousSnapshotId !== expectedPrevious) {
        throw this.#conflict('previous-snapshot-id-mismatch', key, snapshot, undefined, {
          expectedPreviousSnapshotId: expectedPrevious,
          foundPreviousSnapshotId: snapshot.metadata.previousSnapshotId,
        })
      }
      // 3. and that predecessor must actually be durable (gapless chain).
      if (this.#readRow(expectedPrevious) === undefined) {
        throw this.#conflict('predecessor-not-durable', key, snapshot, undefined, {
          expectedPreviousSnapshotId: expectedPrevious,
        })
      }
    }

    // 4. the durable head must be exactly the generation being replaced.
    const head = this.latest(teamSessionId, memberInstanceId)
    if (head === undefined ? generation !== 1 : head.metadata.generation !== generation - 1) {
      throw this.#conflict('previous-snapshot-id-mismatch', key, snapshot, undefined, {
        expectedHeadGeneration: generation - 1,
        foundHeadGeneration: head?.metadata.generation ?? null,
      })
    }

    await this.#putRow(key, bytes)
    return this.#verifyRow(key, bytes)
  }

  /** Build a typed generation-CAS conflict. */
  #conflict(
    problem: PermissionOverlayConflictProblem,
    key: string,
    snapshot: PermissionOverlaySnapshot,
    existing: string | undefined,
    extra: Record<string, unknown> = {},
  ): TeamDomainError {
    const details: Record<string, unknown> = {
      store: PERMISSION_OVERLAY_STORE,
      key,
      problem,
      generation: snapshot.metadata.generation,
      teamSessionId: snapshot.identity.teamSessionId,
      memberInstanceId: snapshot.identity.memberInstanceId,
      ...extra,
    }
    if (existing !== undefined) {
      try {
        details['foundSnapshotId'] = deserializePermissionOverlaySnapshot(existing).snapshotId
        details['foundMutationId'] = deserializePermissionOverlaySnapshot(existing).provenance.mutationId
      } catch {
        details['foundBytesUnparsable'] = true
      }
    }
    return teamDomainError(
      'RECORD_DUPLICATE',
      `permission overlay append at generation ${String(snapshot.metadata.generation)} of ${snapshot.identity.teamSessionId}/${snapshot.identity.memberInstanceId} conflicts with the durable chain (${problem})`,
      details,
    )
  }

  /** Every durable row of one identity, keyed by row key. */
  #rowsOf(teamSessionId: string, memberInstanceId: string): Map<string, PermissionOverlaySnapshot> {
    let team: string
    let instance: string
    try {
      team = String(parseRootSessionId(teamSessionId))
      instance = String(parseInstanceId(memberInstanceId))
    } catch (error) {
      throw normalizeValidationError(error, PERMISSION_OVERLAY_STORE, teamSessionId)
    }
    const found = new Map<string, PermissionOverlaySnapshot>()
    for (const [key, raw] of this.#entries()) {
      const snapshot = this.#verifyRow(key, raw)
      if (snapshot.identity.teamSessionId !== team || snapshot.identity.memberInstanceId !== instance) continue
      found.set(key, snapshot)
    }
    return found
  }

  /** The derived row key of one (identity, generation), arguments validated. */
  #keyOf(teamSessionId: string, memberInstanceId: string, generation: number): string {
    try {
      const team = String(parseRootSessionId(teamSessionId))
      const instance = String(parseInstanceId(memberInstanceId))
      return permissionOverlaySnapshotKey(team, instance, generation)
    } catch (error) {
      if (isTeamDomainError(error)) throw error
      throw normalizeValidationError(error, PERMISSION_OVERLAY_STORE, String(teamSessionId))
    }
  }

  /** The table handle (per call: the handle may be closed between calls). */
  get #table(): StorageKvTable {
    try {
      return this.#handle.table(PERMISSION_OVERLAY_STORE)
    } catch (error) {
      throw normalizeSeamError(error, PERMISSION_OVERLAY_STORE, 'table')
    }
  }

  /** Read one raw row, enforcing the TeamDomain string invariant. */
  #readRow(key: string): string | undefined {
    let value: unknown
    try {
      value = this.#table.get(key)
    } catch (error) {
      throw normalizeSeamError(error, PERMISSION_OVERLAY_STORE, 'get')
    }
    if (value === undefined) return undefined
    if (typeof value !== 'string') {
      throw teamDomainError(
        'RECORD_INVALID',
        `row '${key}' of store '${PERMISSION_OVERLAY_STORE}' is not a string (TeamDomain rows are canonical JSON strings)`,
        { store: PERMISSION_OVERLAY_STORE, key, problem: 'row-not-a-string' },
      )
    }
    return value
  }

  /** Durably write one raw row (single-write durability before resolve). */
  async #putRow(key: string, value: string): Promise<void> {
    try {
      await this.#table.put(key, value)
    } catch (error) {
      throw normalizeSeamError(error, PERMISSION_OVERLAY_STORE, 'put')
    }
  }

  /** Snapshot iterator over `[key, raw]`, string-checking every row. */
  *#entries(): IterableIterator<[string, string]> {
    let iterator: IterableIterator<[string, unknown]>
    try {
      iterator = this.#table.entries()
    } catch (error) {
      throw normalizeSeamError(error, PERMISSION_OVERLAY_STORE, 'entries')
    }
    for (const [key, value] of iterator) {
      if (typeof value !== 'string') {
        throw teamDomainError(
          'RECORD_INVALID',
          `row '${key}' of store '${PERMISSION_OVERLAY_STORE}' is not a string (TeamDomain rows are canonical JSON strings)`,
          { store: PERMISSION_OVERLAY_STORE, key, problem: 'row-not-a-string' },
        )
      }
      yield [key, value]
    }
  }

  /**
   * Deserialize one row and verify it is what its key claims: canonical
   * bytes, the overlay row version, and a row key that agrees with the
   * stored identity/generation.
   */
  #verifyRow(key: string, raw: string): PermissionOverlaySnapshot {
    let snapshot: PermissionOverlaySnapshot
    try {
      snapshot = deserializePermissionOverlaySnapshot(raw)
    } catch (error) {
      if (isTeamDomainError(error) || isTeamContractError(error)) {
        throw normalizeValidationError(error, PERMISSION_OVERLAY_STORE, key)
      }
      throw error
    }
    if (serializePermissionOverlaySnapshot(snapshot) !== raw) {
      throw teamDomainError(
        'RECORD_INVALID',
        `row '${key}' of store '${PERMISSION_OVERLAY_STORE}' is not in canonical byte form`,
        { store: PERMISSION_OVERLAY_STORE, key, problem: 'non-canonical-bytes' },
      )
    }
    const expectedKey = permissionOverlaySnapshotKey(
      snapshot.identity.teamSessionId,
      snapshot.identity.memberInstanceId,
      snapshot.metadata.generation,
    )
    if (expectedKey !== key) {
      throw teamDomainError(
        'RECORD_INVALID',
        `row '${key}' of store '${PERMISSION_OVERLAY_STORE}' is stored under a key that does not match its identity/generation ('${expectedKey}')`,
        { store: PERMISSION_OVERLAY_STORE, key, expectedKey, problem: 'row-key-mismatch' },
      )
    }
    return snapshot
  }
}

/** One open overlay store: the repository plus the handle lifecycle. */
export interface PermissionOverlayStore {
  /** The durable domain name. */
  readonly name: string
  /** The append-only snapshot repository. */
  readonly repository: PermissionOverlayRepository
  /** The overlay row version this store serves. */
  readonly schemaVersion: number
  /** Close the domain (idempotent; the medium keeps its state). */
  close(): Promise<void>
}

/**
 * Open (or initialize, then open) the durable overlay store — the
 * restart-safe entry point. The public seam initializes a fresh medium on
 * first open and adopts an existing one, re-checking the L1 domain version on
 * every open; a medium stamped at another version rejects loudly
 * (`SCHEMA_VERSION_MISMATCH`, no built-in migration — the same policy
 * `team_domain` states in its version policy).
 * @param seam - the public storage seam (injected; the file-backed seam in
 *   tests, the real `StorageDomain` binding in production).
 * @returns the open store.
 * @throws `SCHEMA_VERSION_MISMATCH` for a foreign-version medium,
 *   `SEAM_FAILURE` for any other seam failure.
 */
export async function openPermissionOverlayStore(seam: StorageDomainSeam): Promise<PermissionOverlayStore> {
  let handle: StorageDomainHandle
  try {
    handle = await seam.open(createPermissionOverlaySeamSpec())
  } catch (error) {
    if (seamErrorCode(error) === 'version-mismatch') {
      const detail = (error as { detail?: unknown; details?: unknown })['detail'] ?? (error as { details?: unknown })['details']
      const found =
        typeof detail === 'object' && detail !== null ? (detail as Record<string, unknown>)['found'] ?? null : null
      throw teamDomainError(
        'SCHEMA_VERSION_MISMATCH',
        `the permission overlay store is persisted at schema version ${JSON.stringify(found)}; this store supports version ${String(PERMISSION_OVERLAY_SCHEMA_VERSION)} and has no built-in migration`,
        { expected: PERMISSION_OVERLAY_SCHEMA_VERSION, found },
      )
    }
    throw normalizeSeamError(error, PERMISSION_OVERLAY_STORE, 'open')
  }
  return {
    name: PERMISSION_OVERLAY_DOMAIN_NAME,
    schemaVersion: PERMISSION_OVERLAY_SCHEMA_VERSION,
    repository: new PermissionOverlayRepository(handle),
    close: () => handle.close(),
  }
}
