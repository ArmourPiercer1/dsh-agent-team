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
  REMOTE_RPC_CHANNEL,
  PushTransportLossError,
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
  type RemoteOverrideResetParams,
  type RemoteOverrideSetParams,
  type RemotePolicyStateGetParams,
  type RemotePolicyStateSetParams,
  type RemoteResponse,
  type RemoteSafeRecord,
  type RemoteTeamCreateParams,
} from '../../../remote/src/index.js'
import type { TeamRpcCarrier, TeamRpcResult } from './host-seams.js'

/**
 * The Team Remote client surface (plan §6.1): the frozen unary endpoint
 * `call` plus typed wrappers for every catalog method (23, frozen
 * method catalog of `@dsh-agent-team/remote`).
 */
export interface TeamRemoteClient {
  /**
   * Call one frozen catalog method with its closed param object.
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
  /** `team.getProjection` — the whole-projection pull (frozen G8 feed). */
  getProjection(teamSessionId: string): Promise<RemoteResponse>
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
  /** `team.create` — materialize a fresh TeamSession. */
  teamCreate(params: RemoteTeamCreateParams): Promise<RemoteResponse>
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
  /** `override.set` — set one capability override (typed effect). */
  overrideSet(params: RemoteOverrideSetParams): Promise<RemoteResponse>
  /** `override.reset` — clear one capability override (typed effect). */
  overrideReset(params: RemoteOverrideResetParams): Promise<RemoteResponse>
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
  const call = async (method: string, params: object): Promise<RemoteResponse> => {
    // The single envelope-assembly boundary (plan §6.1): the cast papers
    // over nominal/readonly variance against the RemoteSafeRecord index
    // signature only — the wire value is exactly the frozen fields and
    // the host validates them per field.
    const envelope = {
      version: REMOTE_CONTRACT_VERSION,
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

  return {
    call,
    getProjection: (teamSessionId) => call('team.getProjection', { teamSessionId }),
    getLedgerPage: (teamSessionId, afterSequence = 0, limit = 50) =>
      call('team.getLedgerPage', { teamSessionId, afterSequence, limit }),
    catalogList: () => call('catalog.list', {}),
    catalogGet: (params) => call('catalog.get', params),
    intentProbe: (params) => call('intent.probe', params),
    teamCreate: (params) => call('team.create', params),
    memberCreate: (params) => call('member.create', params),
    memberSend: (params) => call('member.send', params),
    memberFollowup: (params) => call('member.followup', params),
    memberArchive: (params) => call('member.archive', params),
    memberRestore: (params) => call('member.restore', params),
    memberDispose: (params) => call('member.dispose', params),
    overrideGet: (params) => call('override.get', params),
    overrideSet: (params) => call('override.set', params),
    overrideReset: (params) => call('override.reset', params),
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
