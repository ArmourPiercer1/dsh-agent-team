import type { GatewayReceipt, GovernanceResult, ProviderGateway } from '../../../domain/tool-governance/src/index.js';
import type { DomainVetoReader, SearchOriginResolver, WebGatewayCallRequest, WebGatewaySeamPorts } from './types.js';
/** Constructor dependencies (all host-injected; none optional by default). */
export interface CreateWebGatewayOptions {
    readonly ports: WebGatewaySeamPorts;
    readonly searchOrigin: SearchOriginResolver;
    readonly readDomainVeto?: DomainVetoReader;
    readonly onObserve?: (observation: Readonly<Record<string, string | boolean>>) => void;
}
export interface WebGateway extends ProviderGateway {
    /** The lane-typed entry carrying the operation payload (see DISCLOSURE). */
    readonly callWeb: (request: WebGatewayCallRequest) => Promise<GovernanceResult<GatewayReceipt>>;
}
/**
 * Build the web arm. The gateway never arms itself: enablement is the
 * assembly's closed-key decision (`webEnabledRaw`, types.ts), and this class
 * is only constructed when that decision armed the row.
 */
export declare function createWebGateway(options: CreateWebGatewayOptions): WebGateway;
/** Re-exported lane surface. */
export type { DomainVetoReader, SearchOriginResolver, WebDestinationEnvelope, WebGatewayCallRequest, WebGatewaySeamPorts, WebOperationPayload, } from './types.js';
export { parseWebEnabledRaw, webGatewayRefusal } from './types.js';
export type { WebAddressVeto, WebEnabledParse, WebFetchSeamRequest, WebFetchSeamResult, WebSearchSeamRequest, WebSearchSeamResult } from './types.js';
export { deriveDestination, literalAddressVeto, originOf } from './destination-envelope.js';
export type { EnvelopeFailure } from './destination-envelope.js';
//# sourceMappingURL=index.d.ts.map