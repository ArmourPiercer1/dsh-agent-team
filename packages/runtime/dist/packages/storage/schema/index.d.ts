/**
 * The storage-level TeamDomain schema surface.
 *
 * One durable domain (`team_domain`) with nine tables
 * (TEAM_DOMAIN_STORES): the sidecar control-plane storage owned by the
 * TeamDomain. This index re-exports every schema module:
 *
 * - `seam` — the narrow typed seam over the public StorageDomain
 *   (the ONLY way storage touches the host backend);
 * - `stores` — the domain name, the nine store names, and the seam spec
 *   factory (schema version 2, no migration by design);
 * - `version-policy` — the layered version policy (L1 seam / L2 stamps /
 *   L3 records);
 * - `schema-meta` — the per-store stamp rows (L2);
 * - `field-rules` — shared strict field rules for storage-level ids;
 * - `blueprint-registry` — BlueprintRegistryRecord (the v2 registry row);
 * - `override` — GovernanceOverrideRecord (category D);
 * - `compatibility` — CompatibilityStateRecord (category E);
 * - `operation` — OperationRecord (category F);
 * - `ledger` — LedgerEntry + LedgerSequenceCounter (category G);
 * - `errors` — the TeamDomainError vocabulary (RECORD_INVALID,
 *   SCHEMA_STAMP_MISMATCH, SEAM_FAILURE, ...).
 *
 * @module @dsh-agent-team/storage/schema
 */
export * from './seam.js';
export * from './stores.js';
export * from './errors.js';
export * from './version-policy.js';
export * from './field-rules.js';
export * from './schema-meta.js';
export * from './blueprint-registry.js';
export * from './override.js';
export * from './compatibility.js';
export * from './operation.js';
export * from './ledger.js';
//# sourceMappingURL=index.d.ts.map