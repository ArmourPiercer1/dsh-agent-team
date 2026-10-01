/**
 * The TeamDomain identity: one durable domain, ten logical stores.
 *
 * TeamDomain is a SINGLE public StorageDomain (`team_domain`) carrying the
 * logical records of Development Plan §17.2 as declared tables
 * (TaskDoc §11.5 P4-T1): `schema_meta`, `team_sessions`,
 * `member_instances`, `session_bindings`, `overrides`, `compatibility`,
 * `operations`, `ledger`, `blueprint_registry` (the ninth, added by the
 * schema-version-2 bump of plan BP2), and — ADDITIVELY at v2, Alpha.3 PR1 —
 * `permission_overlays`.
 * One domain gives the sidecar one seam-level schema version and one
 * write chain (in-domain write serialization), while per-store schema
 * stamps live as rows in the `schema_meta` table.
 *
 * WHY THE TENTH STORE DID NOT BUMP THE VERSION. The pinned upstream backend
 * treats a same-version table-set GROWTH as additive: a declared table the
 * medium does not carry is initialized EMPTY, inside the same version —
 * storage-json `format.ts` L77-85 (`records === undefined` → an empty table
 * map) and storage-sqlite `index.ts` L110-131 (`CREATE TABLE IF NOT EXISTS`
 * per declared table) at baseline `46a7f68b0922371ce7144b668b90e377d8e799f4`.
 * So a new store is a v2 change, not a v3 one: no migration operation, no
 * world reset, and the nine existing tables keep their rows untouched.
 * `version-policy.ts` still forbids IMPLICIT version migration — nothing here
 * migrates a version; only a declared table is initialized empty on open.
 * What an additive store DOES need is an explicit L2 stamp for the new table
 * on a medium stamped before it existed; that bootstrap lives in
 * `repositories/team-domain.ts` and is narrowly conditioned (see there).
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
 * The TeamDomain schema version (v2). v2 added the ninth store
 * `blueprint_registry` (the durable, immutable Blueprint snapshot
 * registry of issue #2 blueprint-loading plan BP2); the first eight
 * stores keep their v1 names and canonical order (a v2 create stamps
 * the stores in the same canonical order, the new store appended last).
 *
 * The tenth store `permission_overlays` (Alpha.3 PR1) did NOT change this
 * number: same-version table additions are additive upstream (see the module
 * header), so v2 is still the only supported version.
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
/**
 * The NINE stores a stamped v2 domain must already carry — the pre-Alpha.3
 * set, in canonical (create) order. Their L2 stamps are verified on every
 * open and are NEVER bootstrapped: a missing or foreign stamp among them is
 * a partial create or corruption, and fails loudly.
 */
export declare const TEAM_DOMAIN_BASELINE_STORES: readonly ["schema_meta", "team_sessions", "member_instances", "session_bindings", "overrides", "compatibility", "operations", "ledger", "blueprint_registry"];
/**
 * The store added to v2 AFTER its stamps were written (Alpha.3 PR1: the
 * append-only PermissionOverlaySnapshot store). A medium stamped before the
 * store existed legitimately lacks its L2 stamp row, and the backend
 * initializes its table empty, so `openTeamDomain` bootstraps that ONE stamp
 * row — and only for a store listed here, and only when its table is empty
 * (see `repositories/team-domain.ts`).
 */
export declare const TEAM_PERMISSION_OVERLAY_STORE = "permission_overlays";
/** The stores whose L2 stamp may be bootstrapped on open (appended-last only). */
export declare const TEAM_DOMAIN_ADDITIVE_STORES: readonly ["permission_overlays"];
/** The ten logical stores, in canonical (create) order. */
export declare const TEAM_DOMAIN_STORES: readonly ["schema_meta", "team_sessions", "member_instances", "session_bindings", "overrides", "compatibility", "operations", "ledger", "blueprint_registry", "permission_overlays"];
/** One of the ten TeamDomain stores. */
export type TeamDomainStore = (typeof TEAM_DOMAIN_STORES)[number];
/** Mirror of the public unit-name rule (`UNIT_NAME_RE`). */
export declare const UNIT_NAME_PATTERN: RegExp;
/** Is `value` one of the ten TeamDomain store names? */
export declare function isTeamDomainStore(value: unknown): value is TeamDomainStore;
/**
 * Assert `value` is a TeamDomain store name.
 * @param value - the unknown input.
 * @returns the store name.
 * @throws `RECORD_INVALID` (problem `unknown-store`) when it is not one of
 *   the ten frozen v2 store names.
 */
export declare function assertTeamDomainStore(value: unknown): TeamDomainStore;
/** Is `name` a valid unit (domain/table) name under the mirrored rule? */
export declare function isValidUnitName(name: unknown): boolean;
/**
 * The seam spec TeamDomain opens with: the frozen domain name, the v2
 * schema version, and the ten declared tables (fresh array per call). A
 * medium that predates a trailing declared table gets that table
 * initialized empty by the backend (additive, same version).
 * @returns the seam spec.
 */
export declare function createTeamDomainSeamSpec(): StorageDomainSpec;
//# sourceMappingURL=stores.d.ts.map