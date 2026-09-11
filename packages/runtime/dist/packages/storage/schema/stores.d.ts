/**
 * The TeamDomain identity: one durable domain, nine logical stores.
 *
 * TeamDomain is a SINGLE public StorageDomain (`team_domain`) carrying the
 * logical records of Development Plan §17.2 as declared tables
 * (TaskDoc §11.5 P4-T1): `schema_meta`, `team_sessions`,
 * `member_instances`, `session_bindings`, `overrides`, `compatibility`,
 * `operations`, `ledger`, and — since schema version 2 (issue #2
 * blueprint-loading parallel repair, plan BP2) — `blueprint_registry`.
 * One domain gives the sidecar one seam-level schema version and one
 * write chain (in-domain write serialization), while per-store schema
 * stamps live as rows in the `schema_meta` table.
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
 * The TeamDomain schema version (v2). v2 adds the ninth store
 * `blueprint_registry` (the durable, immutable Blueprint snapshot
 * registry of issue #2 blueprint-loading plan BP2); the first eight
 * stores keep their v1 names and canonical order (a v2 create stamps
 * nine rows in the same canonical order, the new store appended last).
 *
 * The domain-level stamp is enforced at the seam (open rejects a
 * persisted domain at a different version — a v1 medium under a v2
 * open is the LOUD `SCHEMA_VERSION_MISMATCH` mismatch by design,
 * plan BP2: NO v1→v2 migration, ever); the per-store stamps in
 * `schema_meta` carry the same v2 value.
 */
export declare const TEAM_DOMAIN_SCHEMA_VERSION = 2;
/** The schema versions TeamDomain v2 supports (no built-in migration). */
export declare const SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS: readonly number[];
/** The nine logical stores, in canonical (create) order. */
export declare const TEAM_DOMAIN_STORES: readonly ["schema_meta", "team_sessions", "member_instances", "session_bindings", "overrides", "compatibility", "operations", "ledger", "blueprint_registry"];
/** One of the nine TeamDomain stores. */
export type TeamDomainStore = (typeof TEAM_DOMAIN_STORES)[number];
/** Mirror of the public unit-name rule (`UNIT_NAME_RE`). */
export declare const UNIT_NAME_PATTERN: RegExp;
/** Is `value` one of the nine TeamDomain store names? */
export declare function isTeamDomainStore(value: unknown): value is TeamDomainStore;
/**
 * Assert `value` is a TeamDomain store name.
 * @param value - the unknown input.
 * @returns the store name.
 * @throws `RECORD_INVALID` (problem `unknown-store`) when it is not one of
 *   the nine frozen store names.
 */
export declare function assertTeamDomainStore(value: unknown): TeamDomainStore;
/** Is `name` a valid unit (domain/table) name under the mirrored rule? */
export declare function isValidUnitName(name: unknown): boolean;
/**
 * The seam spec TeamDomain opens with: the frozen domain name, the v2
 * schema version, and the nine declared tables (fresh array per call).
 * @returns the seam spec.
 */
export declare function createTeamDomainSeamSpec(): StorageDomainSpec;
//# sourceMappingURL=stores.d.ts.map