/**
 * The TeamDomain v2 schema version policy.
 *
 * Layered versioning (the policy this task owns, TaskDoc §11.5 P4-T1):
 *
 * - **L1 — seam level:** the persisted domain `team_domain` carries
 *   `version: 2`. The public StorageDomain rejects `open` of a persisted
 *   domain at a different version (the frozen `version-mismatch` backend
 *   code); the facade maps that to `SCHEMA_VERSION_MISMATCH` (a v1
 *   medium under a v2 open is this loud mismatch by design — no
 *   migration, ever).
 * - **L2 — store level:** one schema stamp row per store in the
 *   `schema_meta` table, `version: 2`. `createTeamDomain` stamps all
 *   ten stores; `openTeamDomain` verifies all nine BASELINE stamps are
 *   present and at the supported version, failing loudly with the exact
 *   store, expected version, and found value (G4: "schema version
 *   mismatch fails loudly"). The tenth store (`permission_overlays`) is
 *   an ADDITIVE store: a medium stamped before it existed is legitimate,
 *   so its stamp is bootstrapped on open when — and only when — the nine
 *   baseline stamps are valid AND the new table holds no rows. A new
 *   table with rows but no stamp is corruption and fails exactly like any
 *   other missing stamp.
 * - **L3 — record level:** every record carries its own `schemaVersion`
 *   field; the frozen contracts v1 parsers enforce it for the contracts
 *   DTOs, and the storage-level record parsers enforce it for the
 *   TeamDomain-own records.
 *
 * There is NO built-in migration (the public StorageDomain performs
 * none either — version mismatch rejects at open). The v1→v2 step
 * (issue #2 blueprint-loading plan BP2: the ninth store
 * `blueprint_registry`) is exactly this policy in action — a v1
 * medium under a v2 open is the loud `SCHEMA_VERSION_MISMATCH`, never
 * a silent rewrite; the test worlds reset. The upgrade strategy is
 * a documented future extension point only: a future version ships the
 * migration as a new supported version plus an explicit migration
 * operation, never as an implicit in-place rewrite.
 *
 * **A new STORE is not a new VERSION.** Adding a table to the declared
 * store set at an unchanged `TEAM_DOMAIN_SCHEMA_VERSION` (the tenth
 * store, Alpha.3 PR1) is not a version change: nothing bumps, no
 * migration operation exists or runs, no world resets, and the nine
 * existing stores keep their rows and their stamp bytes untouched. It is
 * also what the pinned upstream backends do with a declared-but-absent
 * table — they initialize it empty
 * (<https://github.com/deepseek-ai/deepseek-harness/blob/46a7f68b0922371ce7144b668b90e377d8e799f4/packages/storage/storage-json/src/format.ts#L77-L85>,
 * <https://github.com/deepseek-ai/deepseek-harness/blob/46a7f68b0922371ce7144b668b90e377d8e799f4/packages/storage/storage-sqlite/src/index.ts#L110-L131>).
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/version-policy
 */
/**
 * Is `value` a schema version TeamDomain v2 supports?
 * @param value - the unknown version value.
 */
export declare function isSupportedTeamDomainSchemaVersion(value: unknown): boolean;
/**
 * Assert `value` is a supported TeamDomain schema version.
 * @param value - the version found on a schema stamp (or record).
 * @param store - the store the stamp belongs to, for the diagnostic.
 * @returns the version (a number).
 * @throws `SCHEMA_STAMP_MISMATCH` with `details {store, expected, found}`
 *   when the value is not a supported version.
 */
export declare function assertSupportedTeamDomainSchemaVersion(value: unknown, store: string): number;
//# sourceMappingURL=version-policy.d.ts.map