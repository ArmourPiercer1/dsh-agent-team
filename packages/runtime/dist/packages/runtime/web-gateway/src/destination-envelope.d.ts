/**
 * `runtime/web-gateway` destination envelope — M2 B-WEB lane.
 *
 * THE LAW SPLIT (contract §B-WEB + integration ruling 2026-10-23, verbatim
 * honored): the authoritative DNS/IP validation, EVERY-redirect-hop
 * revalidation and connection pinning belong to the production
 * `web-fetch-http` provider — host `packages/web/web-fetch-http/src/network.ts`
 * (`isPublicIpAddress` :54; "…resolves to a non-public IP address", code
 * `WEB_BLOCKED_URL` :101) and its policy (`policy.ts:31-36`) @ 639ed01539.
 * This module runs NO copy of those checks. What it does is the Team lane's
 * own belt BEFORE transport:
 *
 *  1. DESTINATION IDENTITY — derive the frozen network-destination locator
 *     `scheme://host[:port]` (law: `tool-governance/src/resource.ts:91-99`,
 *     no path) FROM THE REAL URL / REAL provider config. The endpoint PATH
 *     is transport detail and never enters the resource identity.
 *  2. SCHEME — the envelope exists only for `http`/`https`; other schemes are
 *     refused HERE (the provider policy enforces the same law independently —
 *     belt and authority, not a copy).
 *  3. LITERAL NON-PUBLIC ADDRESS VETO — the literal forms of the standard
 *     non-public classes (loopback, RFC1918, link-local, ULA, CGNAT,
 *     multicast/reserved, `localhost` hostnames). This is a STRICTER-OR-EQUAL
 *     literal pre-check: whatever it waves through is still fully validated
 *     post-DNS by the provider; whatever it vetoes never leaves the lane.
 *     Drift toward MORE lenience here could not weaken the provider — the
 *     provider re-checks every address of every hop regardless; that is why
 *     this belt is allowed to be dumb and offline.
 *
 * @module runtime/web-gateway/destination-envelope
 */
import type { WebAddressVeto, WebDestinationEnvelope } from './types.js';
/** Parse failure reasons for one retrieval URL / config origin. */
export type EnvelopeFailure = {
    readonly code: 'url-unparseable';
    readonly detail: string;
} | {
    readonly code: 'url-scheme-unsupported';
    readonly detail: string;
};
/**
 * Derive the destination envelope from an absolute retrieval URL (fetch arm)
 * or a config-resolved provider endpoint (search arm — the path is dropped:
 * `https://api.deepseek.com/anthropic/v1` ⇒ `https://api.deepseek.com`,
 * authority host `web-search-deepseek/src/provider.ts:34/:217`).
 */
export declare function deriveDestination(input: string): WebDestinationEnvelope | EnvelopeFailure;
/** Origin (`scheme://host[:port]`) of any absolute URL — receipt material.
 *  `null` on unparseable input (never throws at fingerprint time). */
export declare function originOf(absoluteUrl: string): string | null;
/**
 * The literal-address belt. Recognizes ONLY literals (a hostname that happens
 * to resolve privately is the provider's catch, post-DNS — measured e.g. by
 * the p09 W9 leg: `WEB_BLOCKED_URL` at resolve time).
 */
export declare function literalAddressVeto(host: string): WebAddressVeto | null;
//# sourceMappingURL=destination-envelope.d.ts.map