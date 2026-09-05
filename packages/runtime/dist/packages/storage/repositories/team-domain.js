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
import { toRemoteSafeDetail } from '../../contracts/src/index.js';
import { TEAM_DOMAIN_SCHEMA_VERSION, TEAM_DOMAIN_STORES, assertSupportedTeamDomainSchemaVersion, createTeamDomainSeamSpec, isStorageDomainSeam, normalizeSeamError, seamErrorCode, teamDomainError, } from '../schema/index.js';
import { CompatibilityRepository } from './compatibility.js';
import { LedgerRepository } from './ledger.js';
import { MemberInstancesRepository } from './member-instances.js';
import { OperationsRepository } from './operations.js';
import { OverridesRepository } from './overrides.js';
import { SchemaMetaRepository } from './schema-meta.js';
import { SessionBindingsRepository } from './session-bindings.js';
import { TeamSessionsRepository } from './team-sessions.js';
/**
 * Read the plain-record detail payload carried by a seam failure, if any
 * (public DomainError carries `detail?`; the fake seam carries `details`).
 * @param error - the unknown thrown value.
 */
function seamErrorDetail(error) {
    if (typeof error !== 'object' || error === null)
        return undefined;
    const candidate = error;
    const value = candidate['detail'] !== undefined ? candidate['detail'] : candidate['details'];
    if (typeof value === 'object' && value !== null)
        return value;
    return undefined;
}
/**
 * Open the `team_domain` handle through the seam, classifying failures:
 * the frozen `version-mismatch` code maps to `SCHEMA_VERSION_MISMATCH`
 * (L1 of the version policy); every other seam failure maps via
 * `normalizeSeamError` (`SEAM_FAILURE`).
 */
async function openHandle(seam) {
    try {
        return await seam.open(createTeamDomainSeamSpec());
    }
    catch (error) {
        if (seamErrorCode(error) === 'version-mismatch') {
            const detail = seamErrorDetail(error);
            const found = detail !== undefined && detail['found'] !== undefined ? detail['found'] : null;
            throw teamDomainError('SCHEMA_VERSION_MISMATCH', `team_domain is persisted at schema version ${JSON.stringify(found)}; this TeamDomain supports version ${TEAM_DOMAIN_SCHEMA_VERSION} and has no built-in migration`, { expected: TEAM_DOMAIN_SCHEMA_VERSION, found: toRemoteSafeDetail(found), seamCode: 'version-mismatch' });
        }
        throw normalizeSeamError(error, 'team_domain', 'open');
    }
}
/** Best-effort handle release on error paths (never masks the error). */
async function closeHandleSafe(handle) {
    try {
        await handle.close();
    }
    catch {
        /* best-effort: the original error wins */
    }
}
/** Build the facade over an open, verified handle. */
function buildDomain(handle) {
    // S1-A hook A wiring: the ledger repository receives the SAME
    // `team_sessions` repository instance (same handle, same upstream
    // domain, one write chain) so the post-fact stamp advance is
    // serialized with the fact put it follows.
    const teamSessions = new TeamSessionsRepository(handle);
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
            return handle.close();
        },
    };
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
export async function createTeamDomain(seam) {
    if (!isStorageDomainSeam(seam)) {
        throw teamDomainError('SEAM_FAILURE', 'createTeamDomain requires a StorageDomainSeam', { problem: 'not-a-seam' });
    }
    const handle = await openHandle(seam);
    try {
        const schemaMeta = new SchemaMetaRepository(handle);
        if (schemaMeta.size > 0) {
            throw teamDomainError('TEAM_DOMAIN_EXISTS', `team_domain already exists (schema_meta holds ${schemaMeta.size} stamp row(s)); use openTeamDomain`, { store: 'schema_meta', size: schemaMeta.size });
        }
        for (const store of TEAM_DOMAIN_STORES) {
            await schemaMeta.stampStore(store, new Date().toISOString());
        }
        return buildDomain(handle);
    }
    catch (error) {
        await closeHandleSafe(handle);
        throw error;
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
export async function openTeamDomain(seam) {
    if (!isStorageDomainSeam(seam)) {
        throw teamDomainError('SEAM_FAILURE', 'openTeamDomain requires a StorageDomainSeam', { problem: 'not-a-seam' });
    }
    const handle = await openHandle(seam);
    try {
        const schemaMeta = new SchemaMetaRepository(handle);
        const stamps = schemaMeta.listStamps();
        for (const store of TEAM_DOMAIN_STORES) {
            const stamp = stamps.get(store);
            if (stamp === undefined) {
                throw teamDomainError('SCHEMA_STAMP_MISSING', `schema_meta stamp for store '${store}' is missing (partial create or corruption)`, { store, expected: TEAM_DOMAIN_SCHEMA_VERSION, found: null });
            }
            assertSupportedTeamDomainSchemaVersion(stamp.version, store);
        }
        return buildDomain(handle);
    }
    catch (error) {
        await closeHandleSafe(handle);
        throw error;
    }
}
//# sourceMappingURL=team-domain.js.map