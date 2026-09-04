/**
 * The `legacy` category handler (design note §3): read-only legacy Team
 * inspection (DevPlan §20.6 degradation) over the P7-T7
 * `inspectLegacyTeam`. Read-only by construction: the legacy reader never
 * writes.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/legacy
 */

import type { RemoteLegacyInspectParams, RemoteMethodParams } from '../contracts/params.js'
import type { RemoteLegacyPort } from './ports.js'

/** The legacy category handler (`legacy.inspect`). */
export function createRemoteLegacyHandler(deps: RemoteLegacyPort) {
  return (method: string, params: RemoteMethodParams) => {
    switch (method) {
      case 'legacy.inspect': {
        const inspectParams = params as RemoteLegacyInspectParams
        const inspection = deps.inspect(
          inspectParams.dshHome,
          inspectParams.workspaceCwd,
          inspectParams.projectDir,
        )
        return { data: { inspection } }
      }
      default:
        throw new Error(`legacy handler routed an unknown method: ${method}`)
    }
  }
}
