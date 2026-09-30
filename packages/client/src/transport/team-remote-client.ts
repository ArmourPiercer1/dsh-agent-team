/**
 * P9-T3 (S2-A) — the Team Remote client over the frozen public seam.
 *
 * REIMPLEMENT per plan §6.1 (the legacy TeamMirror transport is on the
 * DROP list). This is the ONLY place in the client that assembles the
 * frozen request envelope `{ version, params }` and that names the
 * `/team-remote` channel: React components never hand-build the channel
 * or the envelope, and no UI mapping happens here — the typed
 * `RemoteResponse` (frozen `code` / `details` / `provenance` intact) is
 * returned as-is, never exception-ified.
 *
 * Version stamping (TCM vNext §15.3) is ALSO exclusive to this module —
 * it is the client REMOTE WRAPPER BOUNDARY, one of the three closed
 * places a wire contract version may appear (pre-alpha3 PR-F plan §F.3;
 * the other two are the remote contracts semantic adapter and the
 * dispatch transport adapter). Every OTHER client module calls the
 * SEMANTIC wrappers below and never sees a version number: the generic
 * {@link call} and the two frozen-wire legacy wrappers
 * ({@link teamCreateEmbeddedWork}, {@link getProjectionLegacy}) stamp
 * contract version 1 (frozen v1 wire behavior); {@link teamCreate} and
 * {@link teamAdmitInitialWork} stamp contract version 2;
 * {@link listRoots} and {@link ensureRootLive} stamp contract version 3;
 * {@link resolveControl} (F3/F11/F9/T1.4 repair round r1 F9) stamps
 * contract version 4; {@link prepareOrdinaryOpen} (C1
 * restart-0.1.7-rc.1 recovery, guide §10.2) stamps contract version 5;
 * {@link getProjection} (the projection freshness pair) and
 * {@link getReadState} stamp contract version 6; and — pre-alpha3 W1
 * fix-A (F10) — {@link overrideSet} / {@link overrideReset} stamp
 * contract version 7 (the version-aware override mutation closed sets
 * gain the optional `expectedGeneration` slot-guard; ABSENT = the
 * byte-for-byte v1 behavior, PRESENT = the Governance optimistic guard).
 *
 * Failure discipline (frozen `RemotePushTransport` contract, mirrored
 * here for the unary path): every RPC-level outcome arrives as a typed
 * `RemoteResponse`; the promise REJECTS only on transport-level
 * channel loss (seam fetch/HTTP failure, malformed server-response
 * envelope, correlation mismatch), reported as the frozen
 * `PushTransportLossError` — the ONLY rejection kind.
 *
 * Forbidden edges (plan §6.1): no TeamDomain, no storage, no Session log
 * scan, no private DSH server API — the only outbound edge is the
 * public unary seam carrier (host-seams.ts, Seam 5).
 *
 * Cross-package import style follows the vNext repo convention
 * (packages/runtime, packages/domain): relative source imports into
 * `packages/remote/src` — no dist build in between.
 *
 * Pure module: no React, no node: builtins, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/transport/team-remote-client
 */

import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V3,
  REMOTE_CONTRACT_VERSION_V4,
  REMOTE_CONTRACT_VERSION_V5,
  REMOTE_CONTRACT_VERSION_V6,
  REMOTE_CONTRACT_VERSION_V7,
  REMOTE_RPC_CHANNEL,
  PushTransportLossError,
  type RemoteContractVersion,
  type RemoteCatalogGetParams,
  type RemoteCompatibilityAckParams,
  type RemoteCompatibilityGetParams,
  type RemoteCompatibilityReprobeParams,
  type RemoteHandoffCreateParams,
  type RemoteHandoffPrepareParams,
  type RemoteIntentProbeParams,
  type RemoteLegacyInspectParams,
  type RemoteMemberCreateParams,
  type RemoteMemberFollowupParams,
  type RemoteMemberLifecycleParams,
  type RemoteMemberSendParams,
  type RemoteOverrideGetParams,
  type RemoteOverrideResetParamsV7,
  type RemoteOverrideSetParamsV7,
  type RemotePolicyStateGetParams,
  type RemotePolicyStateSetParams,
  type RemoteResponse,
  type RemoteSafeRecord,
  type RemoteTeamCreateParams,
  type RemoteTeamCreateParamsV2,
  type RemoteTeamAdmitInitialWorkParams,
  type RemoteTeamResolveControlParams,
} from '../../../remote/src/index.js'
import type { TeamRpcCarrier, TeamRpcResult } from './host-seams.js'

/**
 * The Team Remote client surface (plan §6.1): the frozen unary endpoint
 * `call` plus typed wrappers for every catalog method (29 — the 23
 * frozen v1 methods + the v2-only `team.admitInitialWork` + the v3-only
 * `team.listRoots` / `team.ensureRootLive` + the v4-only
 * `team.resolveControl` + the v5-only `team.prepareOrdinaryOpen` + the
 * v6-only `team.getReadState`; the v6 projection wrapper
 * {@link getProjection} re-addresses the v1 `team.getProjection`
 * endpoint with the v6 freshness pair).
 *
 * **Version routing (TCM vNext §15.3, pre-alpha3 PR-F plan §F.3)**: the
 * wrapper NAMES are semantic — the version is an internal detail of each
 * wrapper (the client remote wrapper boundary is the ONLY client place a
 * version literal appears). The v6 wrappers — {@link getProjection} and
 * {@link getReadState} — stamp contract version **6** (team-view-sync-
 * complete: the projection freshness pair + the per-session durable
 * read-state query); the v5 wrapper — {@link prepareOrdinaryOpen} —
 * stamps contract version **5** (C1 restart-0.1.7-rc.1 recovery, guide
 * §10.2); the v4 wrapper — {@link resolveControl} — stamps contract
 * version **4** (F3/F11/F9/T1.4 repair round r1 F9); the two v3
 * wrappers — {@link listRoots} and {@link ensureRootLive} — stamp
 * contract version **3** (Team D1-D6 repair v2, D1); the two v2
 * wrappers — {@link teamCreate} (the workspace-aware create, the current
 * product create) and {@link teamAdmitInitialWork} — stamp contract
 * version **2**; and the frozen-wire legacy wrappers —
 * {@link teamCreateEmbeddedWork} (the v1 `team.create` field set) and
 * {@link getProjectionLegacy} (the v1 `team.getProjection` frozen shape)
 * — plus the generic {@link call} stamp contract version **1** (the
 * frozen v1 wire behavior, unchanged).
 */
export interface TeamRemoteClient {
  /**
   * Call one frozen catalog method with its closed param object.
   * STAMPS CONTRACT VERSION 1 (the frozen default — TCM vNext §15.3:
   * the client defaults every existing method to v1).
   * @param method - the catalog method name (e.g. `team.getProjection`).
   * @param params - the method's closed param object: one of the frozen
   *   `Remote*Params` interfaces (use the typed wrappers). Typed as
   *   `object` because the frozen interfaces' nominal/readonly variance
   *   is rejected by the `RemoteSafeRecord` index signature although the
   *   wire value is identical; the single cast to `RemoteSafeRecord`
   *   happens at the envelope assembly below. Host-authoritative
   *   per-field validation applies; unknown fields are rejected there.
   * @returns the typed `RemoteResponse`; rejects only on channel loss.
   */
  call(method: string, params: object): Promise<RemoteResponse>
  /**
   * `team.getProjection` — the whole-projection pull over the FROZEN
   * `base` wire shape (the exact nine-field `TeamProjectionDto`, no
   * freshness cells — the legacy wire wrapper; the current product pull
   * is {@link getProjection}, which serves the `live` shape with the
   * `durableGeneration` + `liveToken` pair). Stamps contract version 1.
   */
  getProjectionLegacy(teamSessionId: string): Promise<RemoteResponse>
  /**
   * `team.getLedgerPage` — one anchored durable ledger page.
   * @param teamSessionId - the TeamSession (root DSH session) id.
   * @param afterSequence - exclusive lower bound (frozen default 0).
   * @param limit - page size 1..500 (frozen default 50).
   */
  getLedgerPage(
    teamSessionId: string,
    afterSequence?: number,
    limit?: number,
  ): Promise<RemoteResponse>
  /** `catalog.list` — the blueprint catalog (no fields). */
  catalogList(): Promise<RemoteResponse>
  /** `catalog.get` — one blueprint + revision. */
  catalogGet(params: RemoteCatalogGetParams): Promise<RemoteResponse>
  /** `intent.probe` — compatibility preflight for a blueprint. */
  intentProbe(params: RemoteIntentProbeParams): Promise<RemoteResponse>
  /**
   * `team.create` (contract v1) — materialize a fresh TeamSession.
   * Stamps contract version 1 (frozen v1 wire behavior).
   */
  teamCreateEmbeddedWork(params: RemoteTeamCreateParams): Promise<RemoteResponse>
  /**
   * `team.create` (contract v2, TCM vNext §15.6) — the workspace-aware
   * creation variant. CREATE-ONLY: the closed v2 field set carries
   * `workspace?` and NO `initialWork` (the creation-time initial work is
   * issued with {@link teamAdmitInitialWork} after the root is open).
   * Stamps contract version 2.
   */
  teamCreate(params: RemoteTeamCreateParamsV2): Promise<RemoteResponse>
  /**
   * `team.admitInitialWork` (contract v2, v2-only method, TCM vNext
   * §15.6) — admit the creation-time initial work for one root through
   * the Team compatibility/admission authority (idempotent per
   * `(rootSessionId, requestToken)`). Stamps contract version 2.
   */
  teamAdmitInitialWork(params: RemoteTeamAdmitInitialWorkParams): Promise<RemoteResponse>
  /**
   * `team.listRoots` (contract v3, v3-only method, Team D1-D6 repair v2
   * D1) — the durable ownership / root-identity query. No fields (closed
   * v3 set is empty; the host answers from its own durable TeamDomain).
   * On success `data.roots` is the remote-safe root rows
   * (`{ rootSessionId, blueprintId, revision, defaultWorkspace?,
   * createdAt, generation, memberCount }`). Stamps contract version 3.
   */
  listRoots(): Promise<RemoteResponse>
  /**
   * `team.ensureRootLive` (contract v3, v3-only method, Team D1-D6 repair
   * v2 D1) — the explicit open-in-Team-mode guarantee for one persisted
   * root. **INERT until D2**: the v3-only client wrapper is shipped now
   * (stamping contract version 3, params `{ teamSessionId }`) but the
   * production host handler is wired by D2 (the live glue's
   * `ensureLiveAgent`); until then a call resolves to the typed
   * `TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED` failure — never a
   * silent success. Stamps contract version 3.
   * @param teamSessionId - the TeamSession (root session) id to guarantee.
   */
  ensureRootLive(teamSessionId: string): Promise<RemoteResponse>
  /**
   * `team.resolveControl` (contract v4, v4-only method, F3/F11/F9/T1.4
   * repair round r1 F9) — the human ingress of the durable control
   * plane: resolve ONE pending control request of one team (allow /
   * deny). The closed v4 param set is `{ teamSessionId, requestId,
   * decision, note? }` — NO caller/role/principal fields (adjudication
   * U3): the host derives the human principal from the trusted
   * authenticated UI/session ownership (the T12-B4 connection-gate
   * authority basis). On success `data.decision` is the durable
   * ControlDecision record; the typed control vocabulary (already-
   * decided / not-found / resolver-not-authorized / stale / external
   * policy) arrives as the typed `RemoteResponse` error. Stamps contract
   * version 4.
   */
  resolveControl(params: RemoteTeamResolveControlParams): Promise<RemoteResponse>
  /**
   * `team.prepareOrdinaryOpen` (contract v5, v5-only method, C1
   * restart-0.1.7-rc.1 recovery — guide §10.2) — the narrow one-shot
   * ordinary-activation PERMIT of the Team fence: the host arms the
   * fence's per-root one-shot activation permit for the given Team root
   * (process-local, single-use, TTL-bounded; an unconsumed permit expires
   * silently — there is NO revoke RPC). This is a Team CONTROL-PLANE RPC:
   * it performs NO Team ensure, NO Team Agent side effect, and no
   * TeamDomain mutation beyond the one-shot activation-allow fact. The
   * closed v5 param set is `{ teamSessionId }` ONLY (the host authority
   * is the connection gate — no caller claim, no token). On success
   * `data` is at least `{ rootSessionId, permitted: true }`; the typed
   * failure vocabulary (foreign root / permit port unavailable) arrives
   * as the typed `RemoteResponse` error. Stamps contract version 5.
   * @param teamSessionId - the TeamSession (root session) id whose
   *   ordinary open to permit.
   */
  prepareOrdinaryOpen(teamSessionId: string): Promise<RemoteResponse>
  /**
   * `team.getProjection` (contract v6, team-view-sync-complete) — the
   * whole-projection pull WITH the v6 freshness pair: on success
   * `data.projection` carries the frozen projection shape PLUS
   * `durableGeneration` (=== the durable `generation`) and
   * `liveToken` (the host's deterministic semantic-live-state token —
   * frozen decisions 3 + 4). The client freshness identity is the PAIR
   * (durable generation, live token): a strictly newer durable
   * generation advances the durable view (ledger refresh); an equal
   * durable generation with a changed live token refreshes the live
   * overlay only (no ledger refresh); both equal is a duplicate.
   * Stamps contract version 6 (the v1 wrapper {@link getProjectionLegacy}
   * keeps stamping version 1 — v1–v5 wire behavior is unchanged).
   */
  getProjection(teamSessionId: string): Promise<RemoteResponse>
  /**
   * `team.getReadState` (contract v6, v6-only method,
   * team-view-sync-complete) — the per-session durable read-state
   * query: resolves ONE DSH session's authoritative Team affiliation
   * (`team-root` / `team-member` / `none`) + the owning TeamSession's
   * durable generation. The closed v6 param set is `{ sessionId }`
   * ONLY. On success `data` is the CLOSED value (every field present,
   * `null` cells typed): a `none` answer rests only on a positively
   * confirmed no-affiliation; EVERY storage/integrity failure arrives
   * as the typed `RemoteResponse` error (fail closed — never a silent
   * `none`). Stamps contract version 6.
   * @param sessionId - the DSH session id to classify.
   */
  getReadState(sessionId: string): Promise<RemoteResponse>
  /** `member.create` — admit one member instance. */
  memberCreate(params: RemoteMemberCreateParams): Promise<RemoteResponse>
  /** `member.send` — first message to a member instance. */
  memberSend(params: RemoteMemberSendParams): Promise<RemoteResponse>
  /** `member.followup` — follow-up message to a member instance. */
  memberFollowup(params: RemoteMemberFollowupParams): Promise<RemoteResponse>
  /** `member.archive` — soft-remove an instance (durable fact). */
  memberArchive(params: RemoteMemberLifecycleParams): Promise<RemoteResponse>
  /** `member.restore` — restore an archived instance. */
  memberRestore(params: RemoteMemberLifecycleParams): Promise<RemoteResponse>
  /** `member.dispose` — hard-remove an instance (durable fact). */
  memberDispose(params: RemoteMemberLifecycleParams): Promise<RemoteResponse>
  /** `override.get` — read one capability override. */
  overrideGet(params: RemoteOverrideGetParams): Promise<RemoteResponse>
  /**
   * `override.set` — set one capability override (typed effect).
   * STAMPS CONTRACT VERSION 7 (pre-alpha3 W1 fix-A, F10): the v7 closed
   * set carries the optional `expectedGeneration` slot-guard — ABSENT
   * is legacy-compatible (no conflict check, the byte-for-byte v1
   * behavior); PRESENT is the optimistic guard (the Governance service
   * answers the typed `OVERRIDE_GENERATION_CONFLICT` with zero write on
   * a stale slot winner).
   */
  overrideSet(params: RemoteOverrideSetParamsV7): Promise<RemoteResponse>
  /**
   * `override.reset` — clear one capability override (typed effect).
   * STAMPS CONTRACT VERSION 7 (pre-alpha3 W1 fix-A, F10): the v7 closed
   * set carries the optional `expectedGeneration` slot-guard — ABSENT
   * is legacy-compatible (no conflict check, the byte-for-byte v1
   * behavior); PRESENT is the optimistic guard (the Governance service
   * answers the typed `OVERRIDE_GENERATION_CONFLICT` with zero write on
   * a stale slot winner).
   */
  overrideReset(params: RemoteOverrideResetParamsV7): Promise<RemoteResponse>
  /** `policyState.get` — read the team policy state. */
  policyStateGet(params: RemotePolicyStateGetParams): Promise<RemoteResponse>
  /** `policyState.set` — set the team policy state (typed effect). */
  policyStateSet(params: RemotePolicyStateSetParams): Promise<RemoteResponse>
  /** `compatibility.get` — read the compatibility report. */
  compatibilityGet(params: RemoteCompatibilityGetParams): Promise<RemoteResponse>
  /** `compatibility.ack` — acknowledge one compatibility requirement. */
  compatibilityAck(params: RemoteCompatibilityAckParams): Promise<RemoteResponse>
  /** `compatibility.reprobe` — re-run the compatibility probe. */
  compatibilityReprobe(params: RemoteCompatibilityReprobeParams): Promise<RemoteResponse>
  /** `handoff.prepare` — stage a handoff from one session. */
  handoffPrepare(params: RemoteHandoffPrepareParams): Promise<RemoteResponse>
  /** `handoff.create` — materialize the handoff (typed effect). */
  handoffCreate(params: RemoteHandoffCreateParams): Promise<RemoteResponse>
  /** `legacy.inspect` — inspect a legacy Team home (read-only). */
  legacyInspect(params: RemoteLegacyInspectParams): Promise<RemoteResponse>
}

/**
 * Create the Team Remote client bound to one seam carrier.
 * @param carrier - the public unary RPC carrier (Seam 5; structurally
 *   `ClientConnectionRpc` of the served web app).
 * @returns the client; all methods share the one carrier.
 */
export function createTeamRemoteClient(carrier: TeamRpcCarrier): TeamRemoteClient {
  // The single envelope-assembly boundary (plan §6.1 + TCM vNext §15.3):
  // `version` is the remote contract version THIS call declares. The cast
  // papers over nominal/readonly variance against the RemoteSafeRecord
  // index signature only — the wire value is exactly the frozen fields
  // and the host validates them per field.
  const callWithVersion = async (
    method: string,
    params: object,
    version: RemoteContractVersion,
  ): Promise<RemoteResponse> => {
    const envelope = {
      version,
      params: params as RemoteSafeRecord,
    }
    let result: TeamRpcResult
    try {
      result = await carrier.call(REMOTE_RPC_CHANNEL, method, envelope)
    } catch (error) {
      // Transport-level loss: the ONLY rejection kind (frozen contract).
      throw new PushTransportLossError(
        `team-remote transport: ${method} — ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (!isRemoteResponse(result)) {
      // Envelope anomaly on the carrier (not a typed RPC outcome): the
      // channel cannot be trusted for this round trip — same channel-loss
      // class, never a silent value.
      throw new PushTransportLossError(
        `team-remote transport: ${method} — malformed seam envelope`,
      )
    }
    return result
  }

  // TCM vNext §15.3 (pre-alpha3 PR-F: this module is the client remote
  // wrapper boundary — the ONLY client place a version literal appears):
  // the public generic `call` STAMPS CONTRACT VERSION 1 (the frozen
  // default); every other wrapper above stamps its wire version here.
  const call = (method: string, params: object): Promise<RemoteResponse> =>
    callWithVersion(method, params, REMOTE_CONTRACT_VERSION)

  return {
    call,
    getProjectionLegacy: (teamSessionId) => call('team.getProjection', { teamSessionId }),
    getLedgerPage: (teamSessionId, afterSequence = 0, limit = 50) =>
      call('team.getLedgerPage', { teamSessionId, afterSequence, limit }),
    catalogList: () => call('catalog.list', {}),
    catalogGet: (params) => call('catalog.get', params),
    intentProbe: (params) => call('intent.probe', params),
    teamCreateEmbeddedWork: (params) => call('team.create', params),
    teamCreate: (params) => callWithVersion('team.create', params, REMOTE_CONTRACT_VERSION_V2),
    teamAdmitInitialWork: (params) =>
      callWithVersion('team.admitInitialWork', params, REMOTE_CONTRACT_VERSION_V2),
    // Team D1-D6 repair v2 D1 — the two v3-only wrappers (contract
    // version 3). `team.ensureRootLive` is inert until D2 (the host
    // handler arrives with D2; see the interface doc).
    listRoots: () => callWithVersion('team.listRoots', {}, REMOTE_CONTRACT_VERSION_V3),
    ensureRootLive: (teamSessionId) =>
      callWithVersion('team.ensureRootLive', { teamSessionId }, REMOTE_CONTRACT_VERSION_V3),
    // F3/F11/F9/T1.4 repair round r1 F9 — the v4-only human control-
    // resolution command (contract version 4; the host derives the human
    // principal — the closed v4 param set carries no caller fields).
    resolveControl: (params) =>
      callWithVersion('team.resolveControl', params, REMOTE_CONTRACT_VERSION_V4),
    // C1 restart-0.1.7-rc.1 recovery (guide §10.2) — the v5-only one-shot
    // ordinary-activation permit (contract version 5; a Team control-plane
    // RPC — NO Team ensure, NO Team Agent side effect, no revoke RPC: an
    // unconsumed permit expires by TTL).
    prepareOrdinaryOpen: (teamSessionId) =>
      callWithVersion(
        'team.prepareOrdinaryOpen',
        { teamSessionId },
        REMOTE_CONTRACT_VERSION_V5,
      ),
    // team-view-sync-complete (remote contract v6) — the v6 freshness-pair
    // projection pull (the v6 handler answers the SAME endpoint with the
    // `durableGeneration` + `liveToken` cells inside data.projection).
    getProjection: (teamSessionId) =>
      callWithVersion('team.getProjection', { teamSessionId }, REMOTE_CONTRACT_VERSION_V6),
    // team-view-sync-complete (remote contract v6) — the v6-only
    // per-session durable read-state query (fail-closed on the host side:
    // a `none` only on positively confirmed no-affiliation; storage /
    // integrity failures arrive as the typed error).
    getReadState: (sessionId) =>
      callWithVersion('team.getReadState', { sessionId }, REMOTE_CONTRACT_VERSION_V6),
    memberCreate: (params) => call('member.create', params),
    memberSend: (params) => call('member.send', params),
    memberFollowup: (params) => call('member.followup', params),
    memberArchive: (params) => call('member.archive', params),
    memberRestore: (params) => call('member.restore', params),
    memberDispose: (params) => call('member.dispose', params),
    overrideGet: (params) => call('override.get', params),
    // pre-alpha3 W1 fix-A (F10) — contract v7: the version-aware
    // override mutation closed sets (the optional `expectedGeneration`
    // slot-guard; ABSENT = the byte-for-byte v1 wire behavior).
    overrideSet: (params) => callWithVersion('override.set', params, REMOTE_CONTRACT_VERSION_V7),
    overrideReset: (params) =>
      callWithVersion('override.reset', params, REMOTE_CONTRACT_VERSION_V7),
    policyStateGet: (params) => call('policyState.get', params),
    policyStateSet: (params) => call('policyState.set', params),
    compatibilityGet: (params) => call('compatibility.get', params),
    compatibilityAck: (params) => call('compatibility.ack', params),
    compatibilityReprobe: (params) => call('compatibility.reprobe', params),
    handoffPrepare: (params) => call('handoff.prepare', params),
    handoffCreate: (params) => call('handoff.create', params),
    legacyInspect: (params) => call('legacy.inspect', params),
  }
}

/**
 * Defensive client-boundary re-check that one carrier result is
 * structurally a frozen `RemoteResponse` (success: `value.data` +
 * `value.provenance`; failure: typed `error.code/message/details`).
 * The frozen dispatcher already validated the response before it
 * existed; this mirrors the remote package's own boundary re-check
 * (`readFrameShape`) against a corrupt carrier, not a re-validation of
 * the DTO.
 * @param result - one carrier result of a `/team-remote` call, typed
 *   `unknown` because the carrier value is not type-trusted end-to-end:
 *   this guard IS the validation, not a formality.
 * @returns whether the result is a usable frozen `RemoteResponse`.
 */
function isRemoteResponse(result: unknown): result is RemoteResponse {
  if (typeof result !== 'object' || result === null) return false
  const block = result as Record<string, unknown>
  if (block.ok === true) {
    const value = block.value
    if (typeof value !== 'object' || value === null) return false
    const valueRecord = value as Record<string, unknown>
    return (
      'data' in valueRecord &&
      typeof valueRecord.provenance === 'object' &&
      valueRecord.provenance !== null
    )
  }
  if (block.ok !== false) return false
  const error = block.error
  if (typeof error !== 'object' || error === null) return false
  const errorRecord = error as Record<string, unknown>
  return (
    typeof errorRecord.code === 'string' &&
    typeof errorRecord.message === 'string' &&
    typeof errorRecord.details === 'object' &&
    errorRecord.details !== null
  )
}
