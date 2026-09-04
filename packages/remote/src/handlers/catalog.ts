/**
 * The `catalog` category handler (design note §3): pre-creation blueprint
 * discovery. Backed by the {@link RemoteCatalogPort} (host wiring:
 * `BlueprintCatalog`, `packages/domain/blueprint`).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/catalog
 */

import type { RemoteCatalogGetParams, RemoteMethodParams } from '../contracts/params.js'
import type { RemoteCatalogPort } from './ports.js'

/** Parse the union to the catalog-category param types (category-routed). */
function asCatalogGetParams(params: RemoteMethodParams): RemoteCatalogGetParams {
  return params as RemoteCatalogGetParams
}

/** The catalog category handler (`catalog.list`, `catalog.get`). */
export function createRemoteCatalogHandler(deps: RemoteCatalogPort) {
  return (method: string, params: RemoteMethodParams): { readonly data: unknown } => {
    switch (method) {
      case 'catalog.list': {
        const blueprints = deps.list()
        return { data: { blueprints } }
      }
      case 'catalog.get': {
        const getParams = asCatalogGetParams(params)
        const blueprint = deps.get(getParams.blueprintId, getParams.blueprintRevision)
        return { data: { blueprint } }
      }
      default:
        throw new Error(`catalog handler routed an unknown method: ${method}`)
    }
  }
}
