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
import { type RemoteContractError } from './errors.js';
/**
 * The remote contract version stamped by this build.
 * Frozen by P8-T3; changing or replacing it is a remote contract change.
 */
export declare const REMOTE_CONTRACT_VERSION: 1;
/** Type of the v1 remote contract version field: exactly `1`. */
export type RemoteContractVersion = typeof REMOTE_CONTRACT_VERSION;
/** All remote contract versions this build accepts. Frozen: `[1]`. */
export declare const SUPPORTED_REMOTE_CONTRACT_VERSIONS: readonly number[];
/**
 * Is `value` a supported remote contract version (a positive integer in the
 * supported set)?
 * @param value - the raw value.
 */
export declare function isSupportedRemoteContractVersion(value: unknown): boolean;
/**
 * Assert `value` is in the supported set.
 * @throws {RemoteContractError} `contract-version-unsupported` otherwise.
 */
export declare function assertSupportedRemoteContractVersion(value: unknown): void;
/**
 * Parse the request `version` field of a remote request envelope.
 * @param value - the raw `version` value.
 * @returns the version number (guaranteed a supported positive integer).
 * @throws {RemoteContractError} `malformed-request` when the value is not a
 *   positive integer (the envelope is malformed), or
 *   `contract-version-unsupported` when it is an integer outside the
 *   supported set.
 */
export declare function parseRemoteContractVersion(value: unknown): number;
export type { RemoteContractError };
//# sourceMappingURL=version.d.ts.map