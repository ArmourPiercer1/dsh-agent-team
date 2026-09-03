/**
 * P9-T3 (S2-A) — the public DSH connection seam, as seen by the Team
 * client.
 *
 * This module is a STRUCTURAL MIRROR of the carrier-neutral Connection
 * RPC contracts served by `@deepseek-ai/dsh-client-connection`
 * (upstream `packages/client/connection/src/rpc.ts`):
 *
 *   - `ClientConnectionRpc.call(channel, endpoint, payload, signal?)`
 *     resolves the carrier result `ConnectionRpcResult<unknown>` =
 *     `{ ok: true, value } | { ok: false, error: { code, message,
 *     details } }` and REJECTS only on transport-level failure
 *     (fetch/HTTP failure, malformed server-response envelope, rpcId
 *     mismatch — upstream `createWebConnectionRpc`);
 *   - the initiator mints the rpcId (a branded string, `RpcId`), the
 *     responder echoes it; correlation stays inside Connection
 *     (upstream client AGENTS.md layering rule "rpcId is strictly
 *     bidirectional");
 *   - a channel is an absolute path matching
 *     `/^\/[A-Za-z0-9._~-]+$/`; endpoints are dotted method names.
 *
 * The mirror is deliberately structural (no cross-package type import):
 * the frozen seam verdict is SAME (host-seam-map.md, Seam 5, pinned at
 * P9-T0 / cd5ef814), the Team client consumes only `call`, and keeping
 * the carrier surface local keeps the dependency graph of this package
 * closed to the six audited link: inputs.
 *
 * The Team Remote contract v1 rides the single channel
 * `REMOTE_RPC_CHANNEL = '/team-remote'` (frozen in
 * `@dsh-agent-team/remote`); dotted catalog method names are the
 * endpoints. No browser-side stream subscription exists on this channel
 * (Seam 5: `ClientConnectionRpc.open` is absent in the served web app),
 * so projection sync is invalidation + pull (frozen backend guarantee;
 * plan Trap B response).
 *
 * Pure module: no React, no node: builtins, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/transport/host-seams
 */

/** Carrier-neutral failure returned by one logical RPC endpoint. */
export interface TeamRpcFailure {
  readonly code: string
  readonly message: string
  readonly details: unknown
}

/**
 * Carrier-neutral result returned by one logical RPC endpoint. A
 * `/team-remote` endpoint serves the frozen dispatcher result, which is
 * structurally this union itself (a typed `RemoteResponse`): success
 * carries `{ data, provenance }`, failure carries a typed error.
 */
export type TeamRpcResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: TeamRpcFailure }

/**
 * The unary RPC carrier the Team client binds to. Structurally
 * `ClientConnectionRpc` (upstream `packages/client/connection/src/rpc.ts`
 * `ClientConnectionRpc.call`); only `call` is consumed — the optional
 * `open` stream face is absent in the served web app (Seam 5).
 */
export interface TeamRpcCarrier {
  /**
   * Call one endpoint on an already-registered logical channel.
   * @param channel - absolute logical channel (the frozen `/team-remote`).
   * @param endpoint - the catalog method name (e.g. `team.getProjection`).
   * @param payload - the frozen request envelope `{ version, params }`.
   * @param signal - optional caller cancellation.
   * @returns the endpoint-owned result; rejects only on transport-level
   *   failure (channel loss, malformed envelope, correlation mismatch).
   */
  call(
    channel: string,
    endpoint: string,
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<TeamRpcResult>
}
