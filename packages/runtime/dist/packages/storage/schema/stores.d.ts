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
import type { StorageDomainSpec } from './seam.js';
/** The durable domain name TeamDomain opens through the seam. */
export declare const TEAM_DOMAIN_NAME = "team_domain";
/**
 * The TeamDomain schema version (v1). The domain-level stamp is enforced
 * at the seam (open rejects a persisted domain at a different version);
 * the per-store stamps in `schema_meta` carry the same v1 value.
 */
export declare const TEAM_DOMAIN_SCHEMA_VERSION = 1;
/** The schema versions TeamDomain v1 supports (no built-in migration). */
export declare const SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS: readonly number[];
/** The eight logical stores, in canonical (create) order. */
export declare const TEAM_DOMAIN_STORES: readonly ["schema_meta", "team_sessions", "member_instances", "session_bindings", "overrides", "compatibility", "operations", "ledger"];
/** One of the eight TeamDomain stores. */
export type TeamDomainStore = (typeof TEAM_DOMAIN_STORES)[number];
/** Mirror of the public unit-name rule (`UNIT_NAME_RE`). */
export declare const UNIT_NAME_PATTERN: RegExp;
/** Is `value` one of the eight TeamDomain store names? */
export declare function isTeamDomainStore(value: unknown): value is TeamDomainStore;
/**
 * Assert `value` is a TeamDomain store name.
 * @param value - the unknown input.
 * @returns the store name.
 * @throws `RECORD_INVALID` (problem `unknown-store`) when it is not one of
 *   the eight frozen store names.
 */
export declare function assertTeamDomainStore(value: unknown): TeamDomainStore;
/** Is `name` a valid unit (domain/table) name under the mirrored rule? */
export declare function isValidUnitName(name: unknown): boolean;
/**
 * The seam spec TeamDomain opens with: the frozen domain name, the v1
 * schema version, and the eight declared tables (fresh array per call).
 * @returns the seam spec.
 */
export declare function createTeamDomainSeamSpec(): StorageDomainSpec;
//# sourceMappingURL=stores.d.ts.map