/**
 * `runtime/web-gateway` shared types — M2 B-WEB lane (web arm of the PR7
 * ProviderGateway).
 *
 * Contract authority: `docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/
 * M0-B-FAMILY-TARGET-CONTRACTS.md` §B-WEB (owner=CONNECTOR): the P layer wires
 * the DORMANT PR7 shape to the REAL installed Host providers; the Gateway
 * delegates DNS/IP validation, per-redirect-hop revalidation and connection
 * pinning to the production `web-fetch-http` provider and NEVER runs a second,
 * weaker copy of those checks. Effects are the closed set (root ruling
 * 2026-10-23): I = `tool-invoke@<exact definition>`, N =
 * `connect@network-destination(scheme://host[:port])` PER REAL destination
 * (search = the config-resolved provider origin, host `web-search-deepseek/
 * src/provider.ts:34` `DEEPSEEK_DEFAULT_BASE_URL` + `:217` endpoint build);
 * D = `domain-ref` when an independent Domain Authority answers; S carries NO
 * new effect kind — the exact-operation permission rides I, and URL/query
 * digests plus caps are manifest material (`payloadFingerprint`), never PA
 * vocabulary.
 *
 * PAYLOAD-PATH DISCLOSURE (pending the contract's "fingerprint + opaque ref"
 * channel — `tool-governance/src/interfaces.ts:170-178` carries only the
 * fingerprint): the retrieval payload itself travels on a LANE EXTENSION of
 * `GatewayTarget` (`WebGatewayTarget.webOperation`). The frozen
 * {@link GatewayCallRequest} signature is honored exactly — a plain envelope
 * WITHOUT the extension is a typed refusal, never a guess — and every key the
 * lane adds is closed-world. Flagged to the integration owner for ratification
 * or replacement by the frozen ref channel.
 *
 * @module runtime/web-gateway/types
 */
import type { DomainVeto, GatewayCallRequest, GatewayReceipt, GatewayTarget, GovernanceError, GovernanceErrorCode, OperationGrant, ToolBinding } from '../../../domain/tool-governance/src/index.js';
/** The fetch request the seam accepts (host WebFetchRequest: url only — by
 *  design, timeout/format/prompt are NOT retrieval controls at this seam). */
export interface WebFetchSeamRequest {
    readonly url: string;
}
/** The fetch outcome fields the receipt fingerprints (host WebFetchResult). */
export interface WebFetchSeamResult {
    readonly url: string;
    readonly statusCode: number;
    readonly truncated: boolean;
}
/** The search request the seam accepts (host WebSearchRequest). */
export interface WebSearchSeamRequest {
    readonly query: string;
    readonly maxResults?: number;
}
/** The search outcome fields the receipt fingerprints (host WebSearchResult). */
export interface WebSearchSeamResult {
    readonly sources: readonly {
        readonly url: string;
    }[];
    readonly truncated: boolean;
}
/** One object carrying BOTH seam capabilities — structurally the Host
 *  `ctx.web` service (`ctx.web.search` / `ctx.web.fetch`). */
export interface WebGatewaySeamPorts {
    readonly fetch: (request: WebFetchSeamRequest, signal?: AbortSignal) => Promise<WebFetchSeamResult>;
    readonly search: (request: WebSearchSeamRequest, signal?: AbortSignal) => Promise<WebSearchSeamResult>;
}
/** One retrieval operation, exact and closed. One search call = one query
 *  (the seam's own unit); multi-query tools fan out ABOVE this lane. */
export type WebOperationPayload = {
    readonly kind: 'web.fetch';
    readonly url: string;
} | {
    readonly kind: 'web.search';
    readonly query: string;
    readonly maxResults?: number;
};
/** Lane extension of the frozen {@link GatewayTarget}: adds the operation
 *  payload, changes nothing else. Closed key set: destination,
 *  domainAuthorityId, webOperation. */
export interface WebGatewayTarget extends GatewayTarget {
    readonly webOperation?: WebOperationPayload;
}
/** The lane call request: the frozen envelope with the extended target. */
export interface WebGatewayCallRequest extends Omit<GatewayCallRequest, 'target'> {
    readonly target: WebGatewayTarget;
}
/** Resolves the search provider's origin FROM REAL CONFIG (never a fixed
 *  URL). ROOT 07:38 GROUP 4: the resolver is a TRUSTED-INJECTED reader —
 *  CENTER's edge binds it to the provider's OWN live config sources (the
 *  `web-search-deepseek` settings namespace + launchEnvironment; see
 *  `boundSearchOriginSource` in the assembly row). The gateway itself reads
 *  no env, no Team-side mirror, no providerId name; provider SELECTION stays
 *  the seam's own call-time law (`WebRuntime.search/fetch` resolveProvider —
 *  host web/src/index.ts:137-164), never re-implemented here. */
export type SearchOriginResolver = () => string | Promise<string>;
/** The complete trusted fact set for ONE call (C2): full effects set, live
 *  generations, member/call identity. Produced ONLY by the center edge. */
export interface WebTrustedCallFacts {
    readonly member: {
        readonly teamSessionId: string;
        readonly instanceId: string;
    };
    readonly callId: string;
    /** CURRENT binding generation (not the presented document's claim). */
    readonly bindingRevision: number;
    readonly authorityGeneration: number;
    readonly policyGeneration: number;
    /** The ledger's FULL effects set for this call (every effect, every kind). */
    readonly effects: {
        readonly effects: readonly unknown[];
    };
}
/** Center-edge capture port: correlation ids in, trusted facts out. The
 *  gateway hands it ONLY ids (realmId/grantId/bindingId); grant/binding
 *  DOCUMENTS never travel into the authority's judgement path. */
export interface WebFactsSource {
    capture(correlation: {
        readonly realmId: string;
        readonly grantId: string;
        readonly bindingId: string;
    }): Promise<{
        readonly ok: true;
        readonly value: WebTrustedCallFacts;
    } | {
        readonly ok: false;
        readonly error: GovernanceError;
    }>;
}
/** What the authority returns for a SUCCESSFUL consume: the admitted
 *  manifest facts the gateway validates the derived destination against.
 *  `effects` is the M1 EffectSet shape (`{ effects: [...] }`). */
export interface WebConsumedGrant {
    readonly grantId: string;
    readonly effects: {
        readonly effects: readonly unknown[];
    };
}
/** The exact material the authority needs to decide (C2 shape): trusted
 *  facts + correlation only; cancellation state at decision time travels
 *  to the real consume boundary (C3 cancel-first). */
export interface WebAuthorityInput {
    readonly facts: WebTrustedCallFacts;
    readonly correlation: {
        readonly grantId: string;
        readonly bindingId: string;
        readonly payloadFingerprint: string;
    };
    readonly operationKind: WebOperationPayload['kind'];
    readonly canonicalLocator: string;
    /** LIVE, re-readable cancel source (root bf6a39be): the authority must
     *  evaluate it AT ITS DECISION POINT. The lane never snapshots a boolean
     *  here — a construction-time `false` would impersonate "not cancelled",
     *  the very check/execute split C3 closed. */
    readonly isCancelled: () => boolean;
}
/** The injected center-edge authority port (ONE consume per call). */
export interface WebGrantAuthority {
    consume(input: WebAuthorityInput): Promise<{
        readonly ok: true;
        readonly value: WebConsumedGrant;
    } | {
        readonly ok: false;
        readonly error: GovernanceError;
    }>;
}
/** Row lifecycle (C3): ONE closed state must cover EVERY exported reference;
 *  the gateway re-checks it after each await and before delegating, and the
 *  abort signal it exposes drains in-flight transport when close() fires. */
export interface WebRowLifecycle {
    isClosed(): boolean;
    readonly signal: AbortSignal | undefined;
}
/** The Domain Authority's answer at the effect-commit point (D arm). Absent
 *  reader ⇒ `not-applicable`, honestly reported in the receipt. */
export type DomainVetoReader = (target: WebGatewayTarget) => DomainVeto | Promise<DomainVeto>;
/** One literal-address veto (the belt the Team lane adds BEFORE transport;
 *  the authoritative DNS/IP law stays the provider's — no copy, no weakening). */
export interface WebAddressVeto {
    readonly code: 'loopback-hostname' | 'literal-non-public-ipv4' | 'literal-non-public-ipv6';
    readonly detail: string;
}
/** The derived network destination for one retrieval operation. */
export interface WebDestinationEnvelope {
    /** `scheme://host[:port]` — the frozen locator law (`resource.ts:91-99`). */
    readonly canonicalLocator: string;
    readonly scheme: 'http' | 'https';
    readonly host: string;
    readonly port: number | null;
    readonly literalVeto: WebAddressVeto | null;
}
export type WebEnabledParse = {
    readonly ok: true;
    readonly enabled: boolean;
    readonly readAs: string;
} | {
    readonly ok: false;
    readonly refusal: {
        readonly code: 'web-config-not-boolean';
        readonly detail: string;
    };
};
/**
 * The closed-key enable switch (jobs `jobsEnabled` precedent shape):
 * ABSENT ⇒ disabled (default-off), BOOLEAN ⇒ as-is, ANYTHING ELSE ⇒ typed
 * refusal — a truthy string never arms the row.
 */
export declare function parseWebEnabledRaw(raw: unknown): WebEnabledParse;
/** A frozen {@link GovernanceError} with optional details (never thrown —
 *  the closed Result shape, `errors.ts:53`). `sideEffectUnknown` is the
 *  honest top-level field (`errors.ts:48`): set TRUE only when bytes may
 *  have left the lane; refusals that provably precede transport say false. */
export declare function webGatewayRefusal(code: GovernanceErrorCode, message: string, options?: {
    readonly details?: Readonly<Record<string, string | number | boolean | null>>;
    readonly sideEffectUnknown?: boolean;
}): {
    readonly ok: false;
    readonly error: GovernanceError;
};
/** Re-exported so consumers type receipts without a governance re-import. */
export type { DomainVeto, GatewayCallRequest, GatewayReceipt, GatewayTarget, OperationGrant, ToolBinding, WebGatewayCallRequest as WebCallRequest };
//# sourceMappingURL=types.d.ts.map