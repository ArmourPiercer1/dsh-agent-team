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
 * The remote contract v3 (Team D1-D6 repair v2, D1 — user-approved at G1
 * as a single CONTRACT_CHANGE_REQUEST): the v3-only read/ensure pair for
 * the Team UI dedicated mode — `team.listRoots` (the durable ownership /
 * root-identity query over the TeamDomain) and `team.ensureRootLive`
 * (the explicit open-in-Team-mode guarantee; the host handler is wired by
 * D2, the v3-only client wrapper is inert until then). Every v1/v2 method
 * stays available in v3; v1 and v2 wire behavior is preserved.
 */
export declare const REMOTE_CONTRACT_VERSION_V3: 3;
/**
 * The remote contract v4 (F3/F11/F9/T1.4 repair round r1, F9 — user
 * adjudications U1–U4, 2026-09-07): the v4-only `team.resolveControl`
 * command — the human ingress for the durable control plane (a human
 * resolves a pending control request through the trusted authenticated
 * UI; the host derives the human principal from the connection-gate
 * authority basis, never from a payload claim — the wire carries NO
 * caller/actor fields). The v4 shared record also documents the T1.4
 * probe-semantics entry (T14-H carries its code; this build freezes only
 * the F9 method — the version exists, the entry is additive). Every
 * v1/v2/v3 method stays available in v4; v1/v2/v3 wire behavior is
 * preserved.
 */
export declare const REMOTE_CONTRACT_VERSION_V4: 4;
/**
 * Type of a remote contract version field this build accepts: exactly
 * `1 | 2 | 3 | 4` (TCM vNext §15.3: `RemoteContractVersion = 1 | 2`,
 * extended by the D1 v3 bump and the F9 v4 bump).
 */
export type RemoteContractVersion = typeof REMOTE_CONTRACT_VERSION | typeof REMOTE_CONTRACT_VERSION_V2 | typeof REMOTE_CONTRACT_VERSION_V3 | typeof REMOTE_CONTRACT_VERSION_V4;
/**
 * All remote contract versions this build accepts: `[1, 2, 3, 4]`.
 * v1 was frozen by P8-T3; v2 was added by the TCM vNext §15.6 revision;
 * v3 by the Team D1-D6 repair v2 D1 task; v4 by the F3/F11/F9/T1.4
 * repair round r1 F9 task (a version bump ADDS supported versions,
 * never edits v1/v2/v3 semantics).
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