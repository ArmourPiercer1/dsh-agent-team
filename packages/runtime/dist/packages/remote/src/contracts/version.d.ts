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
 * The frozen remote contract v1 baseline (contract v1, frozen by P8-T3).
 * This is the version the legacy (pre-v2) client wrappers stamp on every
 * request — v1 wire behavior is preserved byte-for-byte (TCM vNext §15.6:
 * "keep all v1 methods; the client defaults every existing wrapper to
 * v1"). Changing or replacing it is a remote contract change.
 */
export declare const REMOTE_CONTRACT_VERSION: 1;
/**
 * The remote contract v2 (TCM vNext §15.6, the Team-create minimal fix):
 * the workspace-aware `team.create` variant plus the v2-only
 * `team.admitInitialWork` command. Only the two v2 client wrappers
 * (`teamCreateV2` / `teamAdmitInitialWorkV2`) stamp this version; every
 * other wrapper keeps stamping {@link REMOTE_CONTRACT_VERSION}.
 */
export declare const REMOTE_CONTRACT_VERSION_V2: 2;
/**
 * Type of a remote contract version field this build accepts: exactly
 * `1 | 2` (TCM vNext §15.3: `RemoteContractVersion = 1 | 2`).
 */
export type RemoteContractVersion = typeof REMOTE_CONTRACT_VERSION | typeof REMOTE_CONTRACT_VERSION_V2;
/**
 * All remote contract versions this build accepts: `[1, 2]`.
 * v1 was frozen by P8-T3; v2 was added by the TCM vNext §15.6 revision
 * (a version bump ADDS supported versions, never edits v1 semantics).
 */
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