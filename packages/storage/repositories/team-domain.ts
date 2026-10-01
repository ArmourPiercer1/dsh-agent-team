/**
 * TeamDomain — the facade over the `team_domain` sidecar (TaskDoc §11.5
 * P4-T1).
 *
 * `createTeamDomain` opens the domain through the seam and stamps all
 * ten stores (ten single-write durable writes; a crash between stamps
 * leaves a partial domain that `openTeamDomain` diagnoses precisely). It
 * is the STRICT fresh-world entry: an already-stamped domain is a
 * `TEAM_DOMAIN_EXISTS` failure (the harness/test-world boot semantics — a
 * boot world must never silently adopt a pre-existing domain).
 * `openTeamDomain` re-opens an existing domain and verifies the layered
 * version policy before handing out repositories (L1 seam version at open,
 * L2 per-store stamps here, L3 record `schemaVersion` at every read).
 * `createOrOpenTeamDomain` is the RESTART-SAFE production entry (the
 * shipped bundle row's `bootPhase: "create-or-open"`): adopt an existing stamped
 * domain, or initialize a fresh medium with the full ten-store stamp
 * when `schema_meta` is empty; a PARTIAL create is diagnosed exactly as
 * `openTeamDomain` diagnoses it (never papered over).
 *
 * ADDITIVE STORES (Alpha.3 PR1). A store declared at a version AFTER media
 * were stamped at that version (today: `permission_overlays`) legitimately
 * has no L2 stamp row on such a medium, and the pinned backend initializes
 * its declared table EMPTY inside the same version. `verifyStamps` therefore
 * bootstraps that store's stamp row, and ONLY that store's, ONLY when its
 * table holds zero rows. The nine baseline stamps are verified exactly as
 * before, FIRST, and nothing else is ever bootstrapped, repaired, or
 * recreated: a baseline stamp missing or at a foreign version, an additive
 * table that has rows but no stamp, a foreign domain version — all fail
 * loudly with zero writes. This is not a migration: no version changes, no
 * row is read, rewritten, or deleted.
 *
 * Failure paths release the handle: every error raised after `open`
 * closes the handle before re-throwing, so the domain name is freed and a
 * later create/open works (the public `close` frees the domain name).
 *
 * The seam handle is INJECTED — this module has no host-backend import;
 * the real binding lands in P4-T5/P5.
 *
 * @module @dsh-agent-team/storage/repositories/team-domain
 */

import { toRemoteSafeDetail } from '../../contracts/src/index.js'
import {
  TEAM_DOMAIN_ADDITIVE_STORES,
  TEAM_DOMAIN_BASELINE_STORES,
  TEAM_DOMAIN_SCHEMA_VERSION,
  TEAM_DOMAIN_STORES,
  assertSupportedTeamDomainSchemaVersion,
  createTeamDomainSeamSpec,
  isStorageDomainSeam,
  normalizeSeamError,
  seamErrorCode,
  teamDomainError,
} from '../schema/index.js'
import type { StorageDomainHandle, StorageDomainSeam } from '../schema/index.js'
import { BlueprintRegistryRepository } from './blueprint-registry.js'
import { CompatibilityRepository } from './compatibility.js'
import { LedgerRepository } from './ledger.js'
import { MemberInstancesRepository } from './member-instances.js'
import { OperationsRepository } from './operations.js'
import { OverridesRepository } from './overrides.js'
import { PermissionOverlayRepository } from './permission-overlays.js'
import { SchemaMetaRepository } from './schema-meta.js'
import { SessionBindingsRepository } from './session-bindings.js'
import { TeamSessionsRepository } from './team-sessions.js'

/**
 * The store repositories of an open TeamDomain.
 *
 * The tenth store (`permission_overlays`, Alpha.3 PR1) joined this facade at
 * the PR4 round-3 production wiring. Its repository always took the SAME
 * `StorageDomainHandle` as the nine baseline stores — and the upstream
 * facility ENFORCES single-open-per-domain-name (an `already-open` rejection
 * on a second handle), so the facade handle is the ONE legal home for it in
 * production: a consumer that opened its own second handle (the pre-fix
 * `openPermissionOverlayStore(seam)` on an already-open seam) always failed
 * there and silently lost the durable permission authority. The store keeps
 * its own stamp bootstrap and append-only semantics unchanged; the facade's
 * `close()` (the handle's close) remains the single release point.
 * (The documented team-domain ↔ permission-overlays ESM cycle is call-time
 * only: each module uses the other's exports inside functions, never during
 * module evaluation.)
 */
export interface TeamDomainRepositories {
  /** Per-store schema stamps (L2). */
  readonly schemaMeta: SchemaMetaRepository
  /** The durable TeamSession records. */
  readonly teamSessions: TeamSessionsRepository
  /** The durable MemberInstance records. */
  readonly memberInstances: MemberInstancesRepository
  /** The durable session-kind bindings. */
  readonly sessionBindings: SessionBindingsRepository
  /** The durable governance overrides. */
  readonly overrides: OverridesRepository
  /** The durable compatibility states. */
  readonly compatibility: CompatibilityRepository
  /** The durable operation journal. */
  readonly operations: OperationsRepository
  /** The durable fact ledger. */
  readonly ledger: LedgerRepository
  /** The durable immutable registry of frozen Blueprint snapshots (v2). */
  readonly blueprintRegistry: BlueprintRegistryRepository
  /** The durable append-only permission overlay authority (v2, PR4 wiring). */
  readonly permissionOverlays: PermissionOverlayRepository
}

/**
 * One open TeamDomain: the durable sidecar of the Team control-plane.
 */
export interface TeamDomain {
  /** The durable domain name (`team_domain`). */
  readonly name: string
  /** The store repositories of this domain (see {@link TeamDomainRepositories}). */
  readonly repositories: TeamDomainRepositories
  /** Close the domain (idempotent; the state persists on the medium). */
  close(): Promise<void>
}

/**
 * Read the plain-record detail payload carried by a seam failure, if any
 * (public DomainError carries `detail?`; the fake seam carries `details`).
 * @param error - the unknown thrown value.
 */
function seamErrorDetail(error: unknown): Record<string, unknown> | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const candidate = error as { detail?: unknown; details?: unknown }
  const value = candidate['detail'] !== undefined ? candidate['detail'] : candidate['details']
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
  return undefined
}

/**
 * Open the `team_domain` handle through the seam, classifying failures:
 * the frozen `version-mismatch` code maps to `SCHEMA_VERSION_MISMATCH`
 * (L1 of the version policy); every other seam failure maps via
 * `normalizeSeamError` (`SEAM_FAILURE`).
 */
async function openHandle(seam: StorageDomainSeam): Promise<StorageDomainHandle> {
  try {
    return await seam.open(createTeamDomainSeamSpec())
  } catch (error) {
    if (seamErrorCode(error) === 'version-mismatch') {
      const detail = seamErrorDetail(error)
      const found = detail !== undefined && detail['found'] !== undefined ? detail['found'] : null
      throw teamDomainError(
        'SCHEMA_VERSION_MISMATCH',
        `team_domain is persisted at schema version ${JSON.stringify(found)}; this TeamDomain supports version ${TEAM_DOMAIN_SCHEMA_VERSION} and has no built-in migration`,
        { expected: TEAM_DOMAIN_SCHEMA_VERSION, found: toRemoteSafeDetail(found), seamCode: 'version-mismatch' },
      )
    }
    throw normalizeSeamError(error, 'team_domain', 'open')
  }
}

/** Best-effort handle release on error paths (never masks the error). */
async function closeHandleSafe(handle: StorageDomainHandle): Promise<void> {
  try {
    await handle.close()
  } catch {
    /* best-effort: the original error wins */
  }
}

/** Build the facade over an open, verified handle. */
function buildDomain(handle: StorageDomainHandle): TeamDomain {
  // S1-A hook A wiring: the ledger repository receives the SAME
  // `team_sessions` repository instance (same handle, same upstream
  // domain, one write chain) so the post-fact stamp advance is
  // serialized with the fact put it follows.
  const teamSessions = new TeamSessionsRepository(handle)
  return {
    name: handle.name,
    repositories: {
      schemaMeta: new SchemaMetaRepository(handle),
      teamSessions,
      memberInstances: new MemberInstancesRepository(handle),
      sessionBindings: new SessionBindingsRepository(handle),
      overrides: new OverridesRepository(handle),
      compatibility: new CompatibilityRepository(handle),
      operations: new OperationsRepository(handle),
      ledger: new LedgerRepository(handle, teamSessions),
      blueprintRegistry: new BlueprintRegistryRepository(handle),
      permissionOverlays: new PermissionOverlayRepository(handle),
    },
    close() {
      return handle.close()
    },
  }
}

/**
 * Verify the L2 per-store stamps of an EXISTING medium.
 *
 * The nine BASELINE stamps are verified first, in canonical order, exactly as
 * always: the first missing one is named (`SCHEMA_STAMP_MISSING`,
 * `{ store, expected, found: null }`) and a foreign stamp version rejects
 * (`SCHEMA_STAMP_MISMATCH`). Nothing about that path changed.
 *
 * Then the ADDITIVE stores (declared at v2 after media were already stamped
 * at v2 — today only `permission_overlays`) get their stamp BOOTSTRAPPED,
 * under three conditions that must all hold:
 *
 *  1. all nine baseline stamps are present and supported (checked above, so a
 *     partial or tampered domain never reaches this point);
 *  2. the store carries no stamp row at all;
 *  3. its table holds ZERO rows — i.e. it is exactly what the pinned backend
 *     hands back for a declared-but-absent table
 *     (`storage-json format.ts` L77-85 / `storage-sqlite index.ts` L110-131).
 *
 * A row-carrying table with no stamp is NOT fresh: it is content without a
 * schema claim, so it fails `SCHEMA_STAMP_MISSING` with
 * `problem: 'rows-without-stamp'` and ZERO writes. The bootstrap writes
 * exactly one row into `schema_meta` — no version changes, no row of any
 * store is read, rewritten, or deleted, so this is an additive-store stamp,
 * not a migration (the no-migration policy of `schema/version-policy.ts`
 * stands unchanged for VERSIONS).
 *
 * @param handle - the open, L1-verified domain handle.
 */
async function verifyStamps(handle: StorageDomainHandle): Promise<void> {
  const schemaMeta = new SchemaMetaRepository(handle)
  const stamps = schemaMeta.listStamps()
  for (const store of TEAM_DOMAIN_BASELINE_STORES) {
    const stamp = stamps.get(store)
    if (stamp === undefined) {
      throw teamDomainError(
        'SCHEMA_STAMP_MISSING',
        `schema_meta stamp for store '${store}' is missing (partial create or corruption)`,
        { store, expected: TEAM_DOMAIN_SCHEMA_VERSION, found: null },
      )
    }
    assertSupportedTeamDomainSchemaVersion(stamp.version, store)
  }
  for (const store of TEAM_DOMAIN_ADDITIVE_STORES) {
    const stamp = stamps.get(store)
    if (stamp !== undefined) {
      assertSupportedTeamDomainSchemaVersion(stamp.version, store)
      continue
    }
    let rows: number
    try {
      rows = handle.table(store).size
    } catch (error) {
      throw normalizeSeamError(error, store, 'table')
    }
    if (rows > 0) {
      throw teamDomainError(
        'SCHEMA_STAMP_MISSING',
        `schema_meta stamp for store '${store}' is missing but its table holds ${String(rows)} row(s); content without a stamp is corruption, never a fresh store`,
        { store, expected: TEAM_DOMAIN_SCHEMA_VERSION, found: null, problem: 'rows-without-stamp', rows },
      )
    }
    await schemaMeta.stampStore(store, new Date().toISOString())
  }
}

/**
 * Create the TeamDomain: open `team_domain` and stamp all ten stores.
 *
 * The ten stamp writes are sequential single-write durable writes; a
 * crash between them leaves a partial domain (openable, but diagnosed by
 * `openTeamDomain` as `SCHEMA_STAMP_MISSING` for the exact first missing
 * store in canonical order).
 *
 * @param seam - the storage seam (injected; an in-memory fake in tests,
 *   the public StorageDomain binding from P4-T5/P5 in production).
 * @returns the open TeamDomain.
 * @throws `TEAM_DOMAIN_EXISTS` when the domain is already stamped;
 *   `SCHEMA_VERSION_MISMATCH` / `SEAM_FAILURE` for seam-level open
 *   failures; `RECORD_INVALID` for a stamp write failure.
 */
export async function createTeamDomain(seam: StorageDomainSeam): Promise<TeamDomain> {
  if (!isStorageDomainSeam(seam)) {
    throw teamDomainError('SEAM_FAILURE', 'createTeamDomain requires a StorageDomainSeam', { problem: 'not-a-seam' })
  }
  const handle = await openHandle(seam)
  try {
    const schemaMeta = new SchemaMetaRepository(handle)
    if (schemaMeta.size > 0) {
      throw teamDomainError(
        'TEAM_DOMAIN_EXISTS',
        `team_domain already exists (schema_meta holds ${schemaMeta.size} stamp row(s)); use openTeamDomain`,
        { store: 'schema_meta', size: schemaMeta.size },
      )
    }
    for (const store of TEAM_DOMAIN_STORES) {
      await schemaMeta.stampStore(store, new Date().toISOString())
    }
    return buildDomain(handle)
  } catch (error) {
    await closeHandleSafe(handle)
    throw error
  }
}

/**
 * Open an existing TeamDomain: open `team_domain` and verify the layered
 * version policy (L1 at the seam open, L2 here — all nine stamps present
 * and at a supported version, in canonical store order).
 *
 * @param seam - the storage seam (injected).
 * @returns the open TeamDomain.
 * @throws `SCHEMA_VERSION_MISMATCH` (L1), `SCHEMA_STAMP_MISSING` for the
 *   exact first missing store (details `{ store, expected, found: null }`),
 *   `SCHEMA_STAMP_MISMATCH` for an unsupported stamp version, or
 *   `SEAM_FAILURE` for other seam failures.
 */
export async function openTeamDomain(seam: StorageDomainSeam): Promise<TeamDomain> {
  if (!isStorageDomainSeam(seam)) {
    throw teamDomainError('SEAM_FAILURE', 'openTeamDomain requires a StorageDomainSeam', { problem: 'not-a-seam' })
  }
  const handle = await openHandle(seam)
  try {
    await verifyStamps(handle)
    return buildDomain(handle)
  } catch (error) {
    await closeHandleSafe(handle)
    throw error
  }
}

/**
 * Create-or-open (ADOPT OR INITIALIZE) the `team_domain` — the
 * restart-safe production entry point (remote-mount-race fix, root cause
 * B): the shipped bundle row boots with `bootPhase: "create-or-open"`, and a
 * production host must be bootable from BOTH a fresh medium (first ever
 * boot: `schema_meta` empty → initialize with the full nine-store stamp,
 * exactly what `createTeamDomain` writes) and a returning home (a prior
 * boot stamped the domain → adopt it, exactly what `openTeamDomain`
 * verifies). The pre-fix bundle shipped `bootPhase: "create"`, whose
 * `TEAM_DOMAIN_EXISTS` throw on every returning home was swallowed by the
 * row bootstrap (zero terminal signal — the user-world 405).
 *
 * Adopt-or-initialize is "complete or diagnose", never "repair": a
 * PARTIAL create (a crash between the nine stamp writes) fails with the
 * same precise `SCHEMA_STAMP_MISSING` diagnosis `openTeamDomain` gives
 * (the exact first missing store in canonical order).
 *
 * @param seam - the storage seam (injected; an in-memory fake in tests,
 *   the public StorageDomain binding in production).
 * @returns the open TeamDomain (freshly stamped or adopted).
 * @throws `SCHEMA_STAMP_MISSING` for a partial existing domain,
 *   `SCHEMA_VERSION_MISMATCH` / `SCHEMA_STAMP_MISMATCH` for unsupported
 *   versions, `SEAM_FAILURE` for seam-level failures, `RECORD_INVALID`
 *   for a stamp write failure.
 */
export interface CreateOrOpenTeamDomainOutcome {
  /** The open TeamDomain (freshly stamped or adopted). */
  readonly domain: TeamDomain
  /**
   * `true` when the medium was FRESH (`schema_meta` empty) and this call
   * INITIALIZED it; `false` when an already-stamped domain was adopted.
   * The production host resolves the row-level `create-or-open` boot
   * phase with this flag (fresh medium → the root mints the Team
   * identity, adopted medium → the root loads it).
   */
  readonly created: boolean
}

export async function createOrOpenTeamDomainDetailed(seam: StorageDomainSeam): Promise<CreateOrOpenTeamDomainOutcome> {
  if (!isStorageDomainSeam(seam)) {
    throw teamDomainError(
      'SEAM_FAILURE',
      'createOrOpenTeamDomain requires a StorageDomainSeam',
      { problem: 'not-a-seam' },
    )
  }
  const handle = await openHandle(seam)
  try {
    const schemaMeta = new SchemaMetaRepository(handle)
    if (schemaMeta.size === 0) {
      // Fresh medium (first ever boot): initialize — the same nine
      // sequential single-write durable stamps as createTeamDomain.
      for (const store of TEAM_DOMAIN_STORES) {
        await schemaMeta.stampStore(store, new Date().toISOString())
      }
      return { domain: buildDomain(handle), created: true }
    }
    // Existing stamped domain (returning home): adopt — the exact L2
    // verification of openTeamDomain (the nine baseline stamps present at a
    // supported version in canonical store order, plus the additive-store
    // stamp bootstrap).
    await verifyStamps(handle)
    return { domain: buildDomain(handle), created: false }
  } catch (error) {
    await closeHandleSafe(handle)
    throw error
  }
}

/**
 * Create-or-open without the outcome — the convenience surface for
 * callers that only need the open domain (the unit-test entry; the
 * production host uses the detailed variant to resolve the boot phase
 * from the medium's actual state).
 */
export async function createOrOpenTeamDomain(seam: StorageDomainSeam): Promise<TeamDomain> {
  return (await createOrOpenTeamDomainDetailed(seam)).domain
}
