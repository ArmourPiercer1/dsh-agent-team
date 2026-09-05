/**
 * TeamDomain — the facade over the `team_domain` sidecar (TaskDoc §11.5
 * P4-T1).
 *
 * `createTeamDomain` opens the domain through the seam and stamps all
 * eight stores (eight single-write durable writes; a crash between stamps
 * leaves a partial domain that `openTeamDomain` diagnoses precisely).
 * `openTeamDomain` re-opens an existing domain and verifies the layered
 * version policy before handing out repositories (L1 seam version at open,
 * L2 per-store stamps here, L3 record `schemaVersion` at every read).
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
import type { StorageDomainSeam } from '../schema/index.js';
import { CompatibilityRepository } from './compatibility.js';
import { LedgerRepository } from './ledger.js';
import { MemberInstancesRepository } from './member-instances.js';
import { OperationsRepository } from './operations.js';
import { OverridesRepository } from './overrides.js';
import { SchemaMetaRepository } from './schema-meta.js';
import { SessionBindingsRepository } from './session-bindings.js';
import { TeamSessionsRepository } from './team-sessions.js';
/** The eight store repositories of an open TeamDomain. */
export interface TeamDomainRepositories {
    /** Per-store schema stamps (L2). */
    readonly schemaMeta: SchemaMetaRepository;
    /** The durable TeamSession records. */
    readonly teamSessions: TeamSessionsRepository;
    /** The durable MemberInstance records. */
    readonly memberInstances: MemberInstancesRepository;
    /** The durable session-kind bindings. */
    readonly sessionBindings: SessionBindingsRepository;
    /** The durable governance overrides. */
    readonly overrides: OverridesRepository;
    /** The durable compatibility states. */
    readonly compatibility: CompatibilityRepository;
    /** The durable operation journal. */
    readonly operations: OperationsRepository;
    /** The durable fact ledger. */
    readonly ledger: LedgerRepository;
}
/**
 * One open TeamDomain: the durable sidecar of the Team control-plane.
 */
export interface TeamDomain {
    /** The durable domain name (`team_domain`). */
    readonly name: string;
    /** The eight store repositories. */
    readonly repositories: TeamDomainRepositories;
    /** Close the domain (idempotent; the state persists on the medium). */
    close(): Promise<void>;
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
export declare function createTeamDomain(seam: StorageDomainSeam): Promise<TeamDomain>;
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
export declare function openTeamDomain(seam: StorageDomainSeam): Promise<TeamDomain>;
//# sourceMappingURL=team-domain.d.ts.map