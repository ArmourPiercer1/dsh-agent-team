/**
 * Remote contract version discipline (contract v1).
 *
 * Mirrors the P8-T1 schema-version pattern of
 * `packages/contracts/src/schema-version.ts` (value-level mirror; the frozen
 * module remains the authority for the *pattern*):
 *
 * - a request whose `version` is not in the supported set is a
 *   `contract-version-unsupported` error;
 * - a request whose `version` is missing or not a positive integer is a
 *   `malformed-request` error (the envelope itself is malformed);
 * - version bumps are contract changes: a new version is introduced by a new
 *   remote contract version that ADDS (never edits) the supported-set
 *   semantics; v1 endpoints keep working.
 *
 * Every response (success or error) echoes the serving `contractVersion` in
 * provenance / error details, so a client can attribute the reply.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
 * @module @dsh-agent-team/remote/contracts/version
 */
import { remoteContractError } from './errors.js';
/**
 * The remote contract version stamped by this build.
 * Frozen by P8-T3; changing or replacing it is a remote contract change.
 */
export const REMOTE_CONTRACT_VERSION = 1;
/** All remote contract versions this build accepts. Frozen: `[1]`. */
export const SUPPORTED_REMOTE_CONTRACT_VERSIONS = [1];
/**
 * Is `value` a supported remote contract version (a positive integer in the
 * supported set)?
 * @param value - the raw value.
 */
export function isSupportedRemoteContractVersion(value) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1)
        return false;
    return SUPPORTED_REMOTE_CONTRACT_VERSIONS.includes(value);
}
/**
 * Assert `value` is in the supported set.
 * @throws {RemoteContractError} `contract-version-unsupported` otherwise.
 */
export function assertSupportedRemoteContractVersion(value) {
    if (!isSupportedRemoteContractVersion(value)) {
        throw remoteContractError('contract-version-unsupported', `remote contract version ${String(value)} is not supported (supported: ${JSON.stringify([...SUPPORTED_REMOTE_CONTRACT_VERSIONS])})`, { field: 'version', value: String(value) });
    }
}
/**
 * Parse the request `version` field of a remote request envelope.
 * @param value - the raw `version` value.
 * @returns the version number (guaranteed a supported positive integer).
 * @throws {RemoteContractError} `malformed-request` when the value is not a
 *   positive integer (the envelope is malformed), or
 *   `contract-version-unsupported` when it is an integer outside the
 *   supported set.
 */
export function parseRemoteContractVersion(value) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
        throw remoteContractError('malformed-request', `request 'version' must be a positive integer, got ${JSON.stringify(value)}`, { field: 'version', value: String(value) });
    }
    assertSupportedRemoteContractVersion(value);
    return value;
}
//# sourceMappingURL=version.js.map