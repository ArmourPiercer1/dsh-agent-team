/**
 * The TeamDomain identity: one durable domain, eight logical stores.
 *
 * TeamDomain is a SINGLE public StorageDomain (`team_domain`) carrying the
 * eight logical records of Development Plan §17.2 as eight declared
 * tables (TaskDoc §11.5 P4-T1): `schema_meta`, `team_sessions`,
 * `member_instances`, `session_bindings`, `overrides`, `compatibility`,
 * `operations`, `ledger`. One domain gives the sidecar one seam-level
 * schema version and one write chain (in-domain write serialization),
 * while per-store schema stamps live as rows in the `schema_meta` table.
 *
 * The public backend validates domain and table names against
 * `UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/` — all names below satisfy it, and
 * {@link UNIT_NAME_PATTERN} mirrors that rule so the seam spec is checked
 * before it crosses the seam.
 *
 * Pure module: constants and small guards, no I/O.
 * @module @dsh-agent-team/storage/schema/stores
 */

import { teamDomainError } from './errors.js'
import type { StorageDomainSpec } from './seam.js'

/** The durable domain name TeamDomain opens through the seam. */
export const TEAM_DOMAIN_NAME = 'team_domain'

/**
 * The TeamDomain schema version (v1). The domain-level stamp is enforced
 * at the seam (open rejects a persisted domain at a different version);
 * the per-store stamps in `schema_meta` carry the same v1 value.
 */
export const TEAM_DOMAIN_SCHEMA_VERSION = 1

/** The schema versions TeamDomain v1 supports (no built-in migration). */
export const SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS: readonly number[] = [1]

/** The eight logical stores, in canonical (create) order. */
export const TEAM_DOMAIN_STORES = [
  'schema_meta',
  'team_sessions',
  'member_instances',
  'session_bindings',
  'overrides',
  'compatibility',
  'operations',
  'ledger',
] as const

/** One of the eight TeamDomain stores. */
export type TeamDomainStore = (typeof TEAM_DOMAIN_STORES)[number]

/** Mirror of the public unit-name rule (`UNIT_NAME_RE`). */
export const UNIT_NAME_PATTERN = /^[a-z][a-z0-9_]*$/

/** Is `value` one of the eight TeamDomain store names? */
export function isTeamDomainStore(value: unknown): value is TeamDomainStore {
  return typeof value === 'string' && (TEAM_DOMAIN_STORES as readonly string[]).includes(value)
}

/**
 * Assert `value` is a TeamDomain store name.
 * @param value - the unknown input.
 * @returns the store name.
 * @throws `RECORD_INVALID` (problem `unknown-store`) when it is not one of
 *   the eight frozen store names.
 */
export function assertTeamDomainStore(value: unknown): TeamDomainStore {
  if (!isTeamDomainStore(value)) {
    throw teamDomainError(
      'RECORD_INVALID',
      `unknown TeamDomain store '${String(value)}'; the frozen v1 store set is: ${TEAM_DOMAIN_STORES.join(', ')}`,
      { store: String(value), problem: 'unknown-store' },
    )
  }
  return value
}

/** Is `name` a valid unit (domain/table) name under the mirrored rule? */
export function isValidUnitName(name: unknown): boolean {
  return typeof name === 'string' && UNIT_NAME_PATTERN.test(name)
}

/**
 * The seam spec TeamDomain opens with: the frozen domain name, the v1
 * schema version, and the eight declared tables (fresh array per call).
 * @returns the seam spec.
 */
export function createTeamDomainSeamSpec(): StorageDomainSpec {
  return {
    name: TEAM_DOMAIN_NAME,
    version: TEAM_DOMAIN_SCHEMA_VERSION,
    tables: [...TEAM_DOMAIN_STORES],
  }
}
