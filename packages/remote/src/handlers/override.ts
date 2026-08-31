/**
 * The `override` category handler (design note §3 / D-7): autonomy overlays
 * and explicit human overrides over the P7-T2 MutationService + mutation
 * store. `override.get` is a read (no actor); `override.set` records a
 * durable value; `override.reset` revokes the addressed record
 * (audit-preserving).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/override
 */

import type {
  RemoteMethodParams,
  RemoteOverrideGetParams,
  RemoteOverrideResetParams,
  RemoteOverrideSetParams,
} from '../contracts/params.js'
import type { RemoteOverridePort, RemoteOverrideResetRequest, RemoteOverrideSetRequest } from './ports.js'

/**
 * The override category handler (`override.get`, `override.set`,
 * `override.reset`).
 */
export function createRemoteOverrideHandler(deps: RemoteOverridePort) {
  return (method: string, params: RemoteMethodParams) => {
    switch (method) {
      case 'override.get': {
        const getParams = params as RemoteOverrideGetParams
        const override = deps.get(
          getParams.teamSessionId,
          getParams.capability,
          getParams.scope,
          getParams.targetInstanceId,
        )
        return { data: { override } }
      }
      case 'override.set': {
        const setParams = params as RemoteOverrideSetParams
        const request: RemoteOverrideSetRequest = {
          teamSessionId: setParams.teamSessionId,
          capability: setParams.capability,
          value: setParams.value,
          actor: setParams.actor,
          ...(setParams.scope !== undefined ? { scope: setParams.scope } : {}),
          ...(setParams.targetInstanceId !== undefined
            ? { targetInstanceId: setParams.targetInstanceId }
            : {}),
        }
        const record = deps.set(request)
        return { data: { record } }
      }
      case 'override.reset': {
        const resetParams = params as RemoteOverrideResetParams
        const request: RemoteOverrideResetRequest = {
          teamSessionId: resetParams.teamSessionId,
          capability: resetParams.capability,
          actor: resetParams.actor,
          ...(resetParams.scope !== undefined ? { scope: resetParams.scope } : {}),
          ...(resetParams.targetInstanceId !== undefined
            ? { targetInstanceId: resetParams.targetInstanceId }
            : {}),
        }
        const { removed } = deps.reset(request)
        return { data: { removed } }
      }
      default:
        throw new Error(`override handler routed an unknown method: ${method}`)
    }
  }
}
