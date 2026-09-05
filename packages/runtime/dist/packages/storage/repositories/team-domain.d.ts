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
    readonly domain: TeamDomain;
    /**
     * `true` when the medium was FRESH (`schema_meta` empty) and this call
     * INITIALIZED it; `false` when an already-stamped domain was adopted.
     * The production host resolves the row-level `create-or-open` boot
     * phase with this flag (fresh medium → the root mints the Team
     * identity, adopted medium → the root loads it).
     */
    readonly created: boolean;
}
export declare function createOrOpenTeamDomainDetailed(seam: StorageDomainSeam): Promise<CreateOrOpenTeamDomainOutcome>;
/**
 * Create-or-open without the outcome — the convenience surface for
 * callers that only need the open domain (the unit-test entry; the
 * production host uses the detailed variant to resolve the boot phase
 * from the medium's actual state).
 */
export declare function createOrOpenTeamDomain(seam: StorageDomainSeam): Promise<TeamDomain>;
//# sourceMappingURL=team-domain.d.ts.map