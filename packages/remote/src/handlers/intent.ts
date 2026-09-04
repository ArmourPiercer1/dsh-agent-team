/**
 * The `intent` category handler (design note §3): the pre-creation
 * compatibility probe (Architecture §7 TeamIntent flow). Backed by the
 * {@link RemoteIntentPort} (host wiring: the pure domain
 * `evaluateCompatibility` fed by the blueprint's requirements).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/intent
 */

import type { RemoteIntentProbeParams, RemoteMethodParams } from '../contracts/params.js'
import type { RemoteIntentPort } from './ports.js'

/** Parse the union to the intent-category param types (category-routed). */
function asIntentProbeParams(params: RemoteMethodParams): RemoteIntentProbeParams {
  return params as RemoteIntentProbeParams
}

/** The intent category handler (`intent.probe`). */
export function createRemoteIntentHandler(deps: RemoteIntentPort) {
  return (method: string, params: RemoteMethodParams): { readonly data: unknown } => {
    switch (method) {
      case 'intent.probe': {
        const probeParams = asIntentProbeParams(params)
        const compatibility = deps.probe(
          probeParams.blueprintId,
          probeParams.blueprintRevision,
          probeParams.environmentFacts,
        )
        return { data: { compatibility } }
      }
      default:
        throw new Error(`intent handler routed an unknown method: ${method}`)
    }
  }
}
