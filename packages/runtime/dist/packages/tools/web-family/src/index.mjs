/**
 * web-family/src/index.mjs — the web-family lane barrel (u7-f, the first
 * network-effect family). Pure re-exports only: one home per fact, no copy.
 *
 * @module web-family
 */
export {
  WEB_FAMILY_ID,
  WEB_FETCH_NATIVE_NAME,
  WEB_SEARCH_NATIVE_NAME,
  MAX_REDIRECT_HOPS,
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_MAX_FETCH_BYTES,
  DEFAULT_ALLOWED_SCHEMES,
  WEB_SEARCH_MAX_QUERIES,
  WEB_SEARCH_MAX_RESULTS,
  webRefusal,
  parseGovernedWebFetchArgs,
  parseGovernedWebSearchArgs,
  gateWebUrl,
  isLoopbackHost,
  redirectStaysInDestination,
} from './web-mechanics.mjs'
export {
  WEB_TRANSPORT_ID,
  createWebTransport,
  createWebTransportSearchPort,
  isTransportCode,
} from './web-transport.mjs'
export {
  validateWebSearchProvider,
  noProviderRefusal,
} from './web-search-provider.mjs'
export { createGovernedWebFetchExecutor } from './fetch-executor.mjs'
export { createGovernedWebSearchExecutor } from './search-executor.mjs'
export { buildFetchRowDefinition, FETCH_ROW_PRESENTATION_FACE } from './fetch-row.mjs'
export { buildSearchRowDefinition, SEARCH_ROW_PRESENTATION_FACE } from './search-row.mjs'
export { buildWebFamilyContribution } from './web-family-contribution.mjs'
import * as webMechanics from './web-mechanics.mjs'
import * as webTransport from './web-transport.mjs'
import * as webSearchProvider from './web-search-provider.mjs'

/** The three bound namespaces the contribution pins losslessly. */
export const WEB_FAMILY_NAMESPACES = Object.freeze({
  mechanics: webMechanics,
  transport: webTransport,
  providerLaw: webSearchProvider,
})
