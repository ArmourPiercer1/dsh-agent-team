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
 * The remote contract v5 (C1, the restart-0.1.7-rc.1 recovery round —
 * guide §10/§10.2): the v5-only `team.prepareOrdinaryOpen` command — the
 * narrow one-shot ordinary-activation PERMIT of the Team fence (the host
 * arms the fence's per-root one-shot activation permit for a Team root the
 * caller is allowed to touch; the client consumes it on the following
 * plain session open). It is a Team CONTROL-PLANE RPC (the TeamDomain /
 * fence state change is the host-side activation-allow fact): it performs
 * NO Team ensure, NO Team Agent side effect, and no TeamDomain mutation
 * beyond the one-shot permit itself. Every v1/v2/v3/v4 method stays
 * available in v5; v1/v2/v3/v4 wire behavior is preserved.
 */
export declare const REMOTE_CONTRACT_VERSION_V5: 5;
/**
 * The remote contract v6 (team-view sync complete, Phase 2 — frozen design
 * decisions, 2026-09-28): the v6-only `team.getReadState` command — the
 * authoritative session-ownership read over the TeamDomain durable rows
 * (a session resolves to `team-root` / `team-member` / `none`; a disposed
 * member still resolves to the member relation marked disposed; only a
 * successful read that positively confirms no affiliation may answer
 * `none`; every storage/integrity failure fails closed with a typed
 * error) — plus the version-aware `team.getProjection` v6 wire shape: the
 * projection value additionally carries `durableGeneration` (the durable
 * TeamSession generation, explicitly named) and `liveToken` (the
 * deterministic opaque live-invalidation token; durable generation and
 * live invalidation are SEPARATED — a live change moves only the token,
 * never the durable generation). Every v1/v2/v3/v4/v5 method stays
 * available in v6 and every v1–v5 wire shape is preserved for
 * version-1–5 requests.
 */
export declare const REMOTE_CONTRACT_VERSION_V6: 6;
/**
 * The remote contract v7 (pre-alpha3 W1 fix-A, F10 — the Governance
 * optimistic-guard ingress): the version-aware `override.set` /
 * `override.reset` closed field sets gain the optional
 * `expectedGeneration` — the client-supplied slot-generation guard of the
 * production Governance mutation authority (PR-A / ADR-03: the service
 * compares it against the current slot winner inside the shared chain and
 * answers the typed `OVERRIDE_GENERATION_CONFLICT` with zero write on
 * mismatch). ABSENT is legacy-compatible (no conflict check — the
 * byte-for-byte v1–v6 wire behavior); PRESENT is the optimistic guard
 * (a non-negative safe integer). NO new method: every v1/v2/v3/v4/v5/v6
 * method stays available in v7 and every v1–v6 wire shape is preserved
 * for version-1–6 requests (a version bump ADDS supported versions,
 * never edits v1/v2/v3/v4/v5/v6 semantics).
 */
export declare const REMOTE_CONTRACT_VERSION_V7: 7;
/**
 * Type of a remote contract version field this build accepts: exactly
 * `1 | 2 | 3 | 4 | 5 | 6 | 7` (TCM vNext §15.3: `RemoteContractVersion = 1 | 2`,
 * extended by the D1 v3 bump, the F9 v4 bump, the C1 restart-recovery
 * v5 bump, the team-view-sync-complete v6 bump, and the pre-alpha3 W1
 * fix-A v7 bump).
 */
export type RemoteContractVersion = typeof REMOTE_CONTRACT_VERSION | typeof REMOTE_CONTRACT_VERSION_V2 | typeof REMOTE_CONTRACT_VERSION_V3 | typeof REMOTE_CONTRACT_VERSION_V4 | typeof REMOTE_CONTRACT_VERSION_V5 | typeof REMOTE_CONTRACT_VERSION_V6 | typeof REMOTE_CONTRACT_VERSION_V7;
/**
 * All remote contract versions this build accepts:
 * `[1, 2, 3, 4, 5, 6, 7]`.
 * v1 was frozen by P8-T3; v2 was added by the TCM vNext §15.6 revision;
 * v3 by the Team D1-D6 repair v2 D1 task; v4 by the F3/F11/F9/T1.4
 * repair round r1 F9 task; v5 by the C1 restart-0.1.7-rc.1 recovery
 * task (guide §10.2: the v5-only `team.prepareOrdinaryOpen` permit);
 * v6 by the team-view-sync-complete task (2026-09-28: the v6-only
 * `team.getReadState` read + the version-aware v6 projection shape with
 * `durableGeneration` / `liveToken`); v7 by the pre-alpha3 W1 fix-A task
 * (F10: the version-aware `override.set` / `override.reset` closed sets
 * gain the optional `expectedGeneration` slot-guard field — additive,
 * NO new method) (a version bump ADDS supported versions, never edits
 * v1/v2/v3/v4/v5/v6 semantics).
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