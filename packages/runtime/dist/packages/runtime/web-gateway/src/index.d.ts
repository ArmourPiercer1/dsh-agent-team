import type { GatewayReceipt, GovernanceResult, ProviderGateway } from '../../../domain/tool-governance/src/index.js';
import type { DomainVetoReader, SearchOriginResolver, WebFactsSource, WebGatewayCallRequest, WebGatewaySeamPorts, WebGrantAuthority, WebRowLifecycle } from './types.js';
/** Constructor dependencies (all host-injected; none optional by default). */
export interface CreateWebGatewayOptions {
    readonly ports: WebGatewaySeamPorts;
    readonly searchOrigin: SearchOriginResolver;
    /** GROUP 3: the center-edge approval authority (ONE consume per call). */
    readonly authority: WebGrantAuthority;
    /** C2: the center-edge ledger capture port (correlation ids → facts). */
    readonly factsSource: WebFactsSource;
    /** C3: the ONE row closed/abort state this gateway itself consults. */
    readonly lifecycle: WebRowLifecycle;
    readonly readDomainVeto?: DomainVetoReader;
    readonly onObserve?: (observation: Readonly<Record<string, string | boolean>>) => void;
}
/** Per-call runtime options (the frozen envelope carries NO runtime signal —
 *  cancellation is a transport concern, not manifest material). */
export interface WebCallOptions {
    readonly signal?: AbortSignal;
}
export interface WebGateway extends ProviderGateway {
    /** The lane-typed entry carrying the operation payload (see DISCLOSURE). */
    readonly callWeb: (request: WebGatewayCallRequest, options?: WebCallOptions) => Promise<GovernanceResult<GatewayReceipt>>;
}
/**
 * Build the web arm. The gateway never arms itself: enablement is the
 * assembly's closed-key decision (`webEnabledRaw`, types.ts), and this class
 * is only constructed when that decision armed the row.
 */
export declare function createWebGateway(options: CreateWebGatewayOptions): WebGateway;
/** Re-exported lane surface. */
export type { DomainVetoReader, SearchOriginResolver, WebAuthorityInput, WebConsumedGrant, WebDestinationEnvelope, WebFactsSource, WebGatewayCallRequest, WebGatewaySeamPorts, WebGrantAuthority, WebOperationPayload, WebRowLifecycle, WebTrustedCallFacts, } from './types.js';
export { parseWebEnabledRaw, webGatewayRefusal } from './types.js';
export type { WebAddressVeto, WebEnabledParse, WebFetchSeamRequest, WebFetchSeamResult, WebSearchSeamRequest, WebSearchSeamResult } from './types.js';
export { deriveDestination, literalAddressVeto, originOf } from './destination-envelope.js';
export type { EnvelopeFailure } from './destination-envelope.js';
//# sourceMappingURL=index.d.ts.map