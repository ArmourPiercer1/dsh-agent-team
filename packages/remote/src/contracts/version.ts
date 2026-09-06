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

import { remoteContractError, type RemoteContractError } from './errors.js'

/**
 * The frozen remote contract v1 baseline (contract v1, frozen by P8-T3).
 * This is the version the legacy (pre-v2) client wrappers stamp on every
 * request — v1 wire behavior is preserved byte-for-byte (TCM vNext §15.6:
 * "keep all v1 methods; the client defaults every existing wrapper to
 * v1"). Changing or replacing it is a remote contract change.
 */
export const REMOTE_CONTRACT_VERSION = 1 as const

/**
 * The remote contract v2 (TCM vNext §15.6, the Team-create minimal fix):
 * the workspace-aware `team.create` variant plus the v2-only
 * `team.admitInitialWork` command. Only the two v2 client wrappers
 * (`teamCreateV2` / `teamAdmitInitialWorkV2`) stamp this version; every
 * other wrapper keeps stamping {@link REMOTE_CONTRACT_VERSION}.
 */
export const REMOTE_CONTRACT_VERSION_V2 = 2 as const

/**
 * The remote contract v3 (Team D1-D6 repair v2, D1 — user-approved at G1
 * as a single CONTRACT_CHANGE_REQUEST): the v3-only read/ensure pair for
 * the Team UI dedicated mode — `team.listRoots` (the durable ownership /
 * root-identity query over the TeamDomain) and `team.ensureRootLive`
 * (the explicit open-in-Team-mode guarantee; the host handler is wired by
 * D2, the v3-only client wrapper is inert until then). Every v1/v2 method
 * stays available in v3; v1 and v2 wire behavior is preserved.
 */
export const REMOTE_CONTRACT_VERSION_V3 = 3 as const

/**
 * Type of a remote contract version field this build accepts: exactly
 * `1 | 2 | 3` (TCM vNext §15.3: `RemoteContractVersion = 1 | 2`, extended
 * by the D1 v3 bump).
 */
export type RemoteContractVersion =
  | typeof REMOTE_CONTRACT_VERSION
  | typeof REMOTE_CONTRACT_VERSION_V2
  | typeof REMOTE_CONTRACT_VERSION_V3

/**
 * All remote contract versions this build accepts: `[1, 2, 3]`.
 * v1 was frozen by P8-T3; v2 was added by the TCM vNext §15.6 revision;
 * v3 by the Team D1-D6 repair v2 D1 task (a version bump ADDS supported
 * versions, never edits v1/v2 semantics).
 */
export const SUPPORTED_REMOTE_CONTRACT_VERSIONS: readonly number[] = [
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V3,
]

/**
 * Is `value` a supported remote contract version (a positive integer in the
 * supported set)?
 * @param value - the raw value.
 */
export function isSupportedRemoteContractVersion(value: unknown): boolean {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return false
  return SUPPORTED_REMOTE_CONTRACT_VERSIONS.includes(value)
}

/**
 * Assert `value` is in the supported set.
 * @throws {RemoteContractError} `contract-version-unsupported` otherwise.
 */
export function assertSupportedRemoteContractVersion(value: unknown): void {
  if (!isSupportedRemoteContractVersion(value)) {
    throw remoteContractError(
      'contract-version-unsupported',
      `remote contract version ${String(value)} is not supported (supported: ${JSON.stringify(
        [...SUPPORTED_REMOTE_CONTRACT_VERSIONS],
      )})`,
      { field: 'version', value: String(value) },
    )
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
export function parseRemoteContractVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw remoteContractError(
      'malformed-request',
      `request 'version' must be a positive integer, got ${JSON.stringify(value)}`,
      { field: 'version', value: String(value) },
    )
  }
  assertSupportedRemoteContractVersion(value)
  return value
}

export type { RemoteContractError }
