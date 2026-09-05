/**
 * TeamDomain — the facade over the `team_domain` sidecar (TaskDoc §11.5
 * P4-T1).
 *
 * `createTeamDomain` opens the domain through the seam and stamps all
 * eight stores (eight single-write durable writes; a crash between stamps
 * leaves a partial domain that `openTeamDomain` diagnoses precisely). It
 * is the STRICT fresh-world entry: an already-stamped domain is a
 * `TEAM_DOMAIN_EXISTS` failure (the harness/test-world boot semantics — a
 * boot world must never silently adopt a pre-existing domain).
 * `openTeamDomain` re-opens an existing domain and verifies the layered
 * version policy before handing out repositories (L1 seam version at open,
 * L2 per-store stamps here, L3 record `schemaVersion` at every read).
 * `createOrOpenTeamDomain` is the RESTART-SAFE production entry (the
 * shipped bundle row's `bootPhase: "create-or-open"`): adopt an existing stamped
 * domain, or initialize a fresh medium with the full eight-store stamp
 * when `schema_meta` is empty; a PARTIAL create is diagnosed exactly as
 * `openTeamDomain` diagnoses it (never papered over).
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
import { CompatibilityRepository } from './compatibility.js'
import { LedgerRepository } from './ledger.js'
import { MemberInstancesRepository } from './member-instances.js'
import { OperationsRepository } from './operations.js'
import { OverridesRepository } from './overrides.js'
import { SchemaMetaRepository } from './schema-meta.js'
import { SessionBindingsRepository } from './session-bindings.js'
import { TeamSessionsRepository } from './team-sessions.js'

/** The eight store repositories of an open TeamDomain. */
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
}

/**
 * One open TeamDomain: the durable sidecar of the Team control-plane.
 */
export interface TeamDomain {
  /** The durable domain name (`team_domain`). */
  readonly name: string
  /** The eight store repositories. */
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
    },
    close() {
      return handle.close()
    },
  }
}

/**
 * Create the TeamDomain: open `team_domain` and stamp all eight stores.
 *
 * The eight stamp writes are sequential single-write durable writes; a
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
 * version policy (L1 at the seam open, L2 here — all eight stamps present
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
    const schemaMeta = new SchemaMetaRepository(handle)
    const stamps = schemaMeta.listStamps()
    for (const store of TEAM_DOMAIN_STORES) {
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
 * boot: `schema_meta` empty → initialize with the full eight-store stamp,
 * exactly what `createTeamDomain` writes) and a returning home (a prior
 * boot stamped the domain → adopt it, exactly what `openTeamDomain`
 * verifies). The pre-fix bundle shipped `bootPhase: "create"`, whose
 * `TEAM_DOMAIN_EXISTS` throw on every returning home was swallowed by the
 * row bootstrap (zero terminal signal — the user-world 405).
 *
 * Adopt-or-initialize is "complete or diagnose", never "repair": a
 * PARTIAL create (a crash between the eight stamp writes) fails with the
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
      // Fresh medium (first ever boot): initialize — the same eight
      // sequential single-write durable stamps as createTeamDomain.
      for (const store of TEAM_DOMAIN_STORES) {
        await schemaMeta.stampStore(store, new Date().toISOString())
      }
      return { domain: buildDomain(handle), created: true }
    }
    // Existing stamped domain (returning home): adopt — the exact L2
    // verification of openTeamDomain (all eight stamps present at a
    // supported version, in canonical store order).
    const stamps = schemaMeta.listStamps()
    for (const store of TEAM_DOMAIN_STORES) {
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
