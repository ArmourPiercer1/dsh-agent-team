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
 * The frozen remote contract v1 baseline (contract v1, frozen by P8-T3).
 * This is the version the legacy (pre-v2) client wrappers stamp on every
 * request — v1 wire behavior is preserved byte-for-byte (TCM vNext §15.6:
 * "keep all v1 methods; the client defaults every existing wrapper to
 * v1"). Changing or replacing it is a remote contract change.
 */
export const REMOTE_CONTRACT_VERSION = 1;
/**
 * The remote contract v2 (TCM vNext §15.6, the Team-create minimal fix):
 * the workspace-aware `team.create` variant plus the v2-only
 * `team.admitInitialWork` command. Only the two v2 client wrappers
 * (`teamCreate` / `teamAdmitInitialWork` — the pre-alpha3 PR-F
 * de-versioned names; the v1 legacy create is `teamCreateEmbeddedWork`)
 * stamp this version; every other wrapper keeps stamping
 * {@link REMOTE_CONTRACT_VERSION}.
 */
export const REMOTE_CONTRACT_VERSION_V2 = 2;
/**
 * The remote contract v3 (Team D1-D6 repair v2, D1 — user-approved at G1
 * as a single CONTRACT_CHANGE_REQUEST): the v3-only read/ensure pair for
 * the Team UI dedicated mode — `team.listRoots` (the durable ownership /
 * root-identity query over the TeamDomain) and `team.ensureRootLive`
 * (the explicit open-in-Team-mode guarantee; the host handler is wired by
 * D2, the v3-only client wrapper is inert until then). Every v1/v2 method
 * stays available in v3; v1 and v2 wire behavior is preserved.
 */
export const REMOTE_CONTRACT_VERSION_V3 = 3;
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
export const REMOTE_CONTRACT_VERSION_V4 = 4;
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
export const REMOTE_CONTRACT_VERSION_V5 = 5;
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
export const REMOTE_CONTRACT_VERSION_V6 = 6;
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
export const REMOTE_CONTRACT_VERSION_V7 = 7;
/**
 * The remote contract v8 (A4-PR6 §6.B, Alpha.4 governance UX — a
 * CONTRACT CHANGE, reason recorded in the PR body): the v8-only
 * intervention plane — `intervention.list` / `intervention.get` /
 * `intervention.act` (the GovernanceWarning + approval-case work surface
 * with SERVER-derived legal actions and a closed param set: the act body
 * is exactly `{teamSessionId, interventionId, action, note?}`, so an
 * `asRole`/`impersonate` field cannot exist without a version bump) — plus
 * the `override.getPermissionAdministration` read (a server-side
 * STRIP-projection: authority-bearing and round-trippable decision fields
 * never reach the wire). Every v1/v2/v3/v4/v5/v6/v7 method stays
 * available in v8 and every v1–v7 wire shape is preserved byte-for-byte
 * for version-1–7 requests (a version bump ADDS supported versions and
 * methods, never edits older semantics). Orthogonality law (spec §15,
 * plan 6.B): the wire version NEVER selects the authority algebra — the
 * v3-only switch reads the BOUND DOCUMENT's version only (ADR A5-12); a
 * v2 `team.create` may create a Blueprint-v3 Team and a v8 call may carry
 * a v1 document during the bridge.
 */
export const REMOTE_CONTRACT_VERSION_V8 = 8;
/**
 * The remote contract v9 (A4-PR7 W1, RULING 5-B warning-first — a
 * CONTRACT CHANGE, reason recorded in the PR body): ONE new READ-ONLY
 * method, `team.listCorruptControlLegs` — the human read-plane surface
 * for the control ledger's CORRUPT LEGS (the `control-request-recorded`
 * rows the strict reader `parseRequestPayload` refuses; the
 * `corruptLegs` list of `ControlService.listControlState()`, the ONE
 * authority — nothing on this lane re-reads or re-judges ledger rows).
 * The v8 intervention plane CANNOT carry this: its items are actionable
 * approval/warning cases, and a corrupt leg is deliberately NOT a work
 * item (RULING 5-B: no governance isolation state machine; execution
 * semantics are unchanged — this is VISIBILITY ONLY, a report, never a
 * gate). Closed param set `{ teamSessionId }`; closed response shape
 * (`types.ts`); the legs echo ONLY what a damaged row still discloses
 * (the report never invents an identity it did not read). Every v1–v8
 * method stays available in v9 and every v1–v8 wire shape is preserved
 * byte-for-byte (a version bump ADDS; it never edits older semantics).
 */
export const REMOTE_CONTRACT_VERSION_V9 = 9;
/**
 * All remote contract versions this build accepts:
 * `[1, 2, 3, 4, 5, 6, 7, 8, 9]`.
 * v1 was frozen by P8-T3; v2 was added by the TCM vNext §15.6 revision;
 * v3 by the Team D1-D6 repair v2 D1 task; v4 by the F3/F11/F9/T1.4
 * repair round r1 F9 task; v5 by the C1 restart-0.1.7-rc.1 recovery
 * task (guide §10.2: the v5-only `team.prepareOrdinaryOpen` permit);
 * v6 by the team-view-sync-complete task (2026-09-28: the v6-only
 * `team.getReadState` read + the version-aware v6 projection shape with
 * `durableGeneration` / `liveToken`); v7 by the pre-alpha3 W1 fix-A task
 * (F10: the version-aware `override.set` / `override.reset` closed sets
 * gain the optional `expectedGeneration` slot-guard field — additive,
 * NO new method); v8 by A4-PR6 (the intervention plane); v9 by A4-PR7 W1
 * (the v9-only `team.listCorruptControlLegs` corrupt-leg visibility
 * read) (a version bump ADDS supported versions, never edits
 * v1/v2/v3/v4/v5/v6 semantics).
 */
export const SUPPORTED_REMOTE_CONTRACT_VERSIONS = [
    REMOTE_CONTRACT_VERSION,
    REMOTE_CONTRACT_VERSION_V2,
    REMOTE_CONTRACT_VERSION_V3,
    REMOTE_CONTRACT_VERSION_V4,
    REMOTE_CONTRACT_VERSION_V5,
    REMOTE_CONTRACT_VERSION_V6,
    REMOTE_CONTRACT_VERSION_V7,
    REMOTE_CONTRACT_VERSION_V8,
    REMOTE_CONTRACT_VERSION_V9,
];
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