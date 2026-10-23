/**
 * `runtime/web-gateway` — the web arm of the PR7 {@link ProviderGateway}
 * (M2 B-WEB lane, owner=CONNECTOR).
 *
 * DELEGATION LAW (integration ruling 2026-10-23, condition 2): this gateway
 * delegates retrieval to the REAL installed Host providers through the public
 * web seam (`ctx.web.fetch` / `ctx.web.search`, host
 * `packages/web/web/src/index.ts:140/:157` @ 639ed01539). The chain's FINAL
 * DNS/IP validation, EVERY-redirect-hop revalidation and connection pinning
 * ARE the production `web-fetch-http` provider's (network.ts/policy.ts) —
 * the contract's "Gateway 最终执行" is satisfied by the whole chain; this file
 * runs no second, weaker copy, and never resolves a name itself.
 * PROVIDER DESTINATIONS COME FROM REAL CONFIG ONLY: the search arm asks an
 * injected {@link SearchOriginResolver} (host-side reader of the installed
 * provider's own config); with no provider/credential the resolver throws the
 * seam's typed code and the call refuses — a fixed-URL fake is impossible
 * structurally, because this module contains no destination constant.
 *
 * CLOSED-SET EFFECT MAPPING (root ruling; no new kinds, no new PA types):
 *   I = tool-invoke@<exact definition>   — carried by the grant/binding legs
 *   N = connect@network-destination      — the envelope destination MUST be
 *       an N arm of the grant (checked with the frozen `resourceEquals`,
 *       refusal `destination-outside-grant`); per redirect hop the provider
 *       re-validates non-publicness and the receipt DISCLOSES a final-origin
 *       change (see OPEN ITEMS).
 *   D = domain-ref                       — the Domain Authority answers at the
 *       effect-commit point via the injected reader; 'denied' refuses with
 *       ZERO transport and is never rewritten by Team approval.
 *   S = NO kind. The exact-operation permission rides I; URL/query digests
 *       and caps are manifest material — here: `payloadFingerprint` + the
 *       receipt's `outcomeFingerprint`.
 *
 * SEAM-CODE MAP (the closed 8-code {@link GovernanceErrorCode} set has no
 * "provider unavailable" member — the least-wrong mapping is documented,
 * the seam's own code travels VERBATIM in `error.details.seamCode`):
 *   WEB_BLOCKED_URL, WEB_INVALID_URL, url-unparseable, url-scheme-unsupported,
 *   loopback/private literal veto, destination-outside-grant, domain denied
 *     → DOMAIN_DENIED (destination refused; zero bytes left the lane)
 *   WEB_PROVIDER_CONFIGURED_MISSING, WEB_PROVIDER_CONFIGURED_UNAVAILABLE,
 *   WEB_PROVIDER_AMBIGUOUS, WEB_PROVIDER_UNAVAILABLE,
 *   WEB_PROVIDER_CREDENTIAL_MISSING, unmapped seam errors
 *     → IO_POLICY_UNSUPPORTED (this configuration cannot run the capability)
 *   binding/shape integrity            → TOOL_BINDING_UNVERIFIED
 *   not-armed                          → IO_POLICY_UNSUPPORTED
 * `sideEffectUnknown`: false ONLY on refusals that provably precede transport
 * (envelope/belt/veto/grant checks + provider policy throws, whose pre-connect
 * position is fixture-measured — p09 W9 `WEB_BLOCKED_URL`, accessLog +0);
 * any other seam failure says true, never a silent false.
 *
 * OPEN ITEMS (disclosed, not silently solved):
 *  - the frozen GatewayCallRequest carries no retrieval payload (§"opaque ref"
 *    channel unbuilt): the payload rides a closed lane extension of the
 *    target (types.ts DISCLOSURE) pending the integration owner's ruling.
 *  - a redirect that changes origin moves N: the provider re-validates
 *    non-publicness per hop (production law), the Team grant covers the
 *    REQUEST origin, and the receipt records `finalOriginMismatch` so the
 *    mismatch is durable fact, never a hidden widening.
 *
 * @module runtime/web-gateway
 */
import { canonicalJsonFingerprint, resourceEquals, } from '../../../domain/tool-governance/src/index.js';
import { deriveDestination, originOf } from './destination-envelope.js';
import { webGatewayRefusal, } from './types.js';
const REQUEST_KEYS = ['grant', 'binding', 'target', 'payloadFingerprint'];
const TARGET_KEYS = ['destination', 'domainAuthorityId', 'webOperation'];
const FETCH_PAYLOAD_KEYS = ['kind', 'url'];
const SEARCH_PAYLOAD_KEYS = ['kind', 'query', 'maxResults'];
const OPERATION_TOOL = Object.freeze({
    'web.fetch': 'web_fetch',
    'web.search': 'web_search',
});
/** Seam `WebError` codes that mean "the destination itself was refused". */
const DESTINATION_SEAM_CODES = new Set(['WEB_BLOCKED_URL', 'WEB_INVALID_URL']);
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function extraKeys(obj, allowed) {
    return Object.keys(obj).filter((k) => !allowed.includes(k));
}
/**
 * Build the web arm. The gateway never arms itself: enablement is the
 * assembly's closed-key decision (`webEnabledRaw`, types.ts), and this class
 * is only constructed when that decision armed the row.
 */
export function createWebGateway(options) {
    const { ports, searchOrigin, readDomainVeto, onObserve } = options;
    const callWeb = async (request) => {
        const outcome = await runCall(request);
        onObserve?.(Object.freeze({ ...outcome.obs }));
        return outcome.result;
    };
    async function runCall(request) {
        // — envelope integrity (never re-admitting; that is admission's law) —
        if (!isRecord(request)) {
            return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', 'a gateway call request is a record'), { operation: 'malformed-request' });
        }
        const requestExtras = extraKeys(request, REQUEST_KEYS);
        if (requestExtras.length > 0) {
            return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', `the call envelope is closed; undeclared keys: ${requestExtras.join(', ')}`), { operation: 'malformed-request' });
        }
        const { grant, binding, target, payloadFingerprint } = request;
        if (typeof payloadFingerprint !== 'string' || payloadFingerprint.length === 0) {
            return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', 'the S leg requires a non-empty payloadFingerprint (manifest material)'), { operation: 'malformed-request' });
        }
        if (!isRecord(grant) || typeof grant['grantId'] !== 'string' || grant['grantId'].length === 0 || typeof grant['realmId'] !== 'string' || !isRecord(grant['effects'])) {
            return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', 'the gateway consumes a well-formed admitted grant envelope (grantId/realmId/effects) as an opaque one-shot token; validity is admission law'), { operation: 'malformed-request' });
        }
        if (!isRecord(binding) || typeof binding['bindingId'] !== 'string' || typeof binding['toolName'] !== 'string') {
            return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', 'the binding envelope needs bindingId + toolName'), { operation: 'malformed-request' });
        }
        if (grant['bindingId'] !== binding['bindingId']) {
            return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', 'grant.bindingId does not match the presented binding'), { operation: 'malformed-request', bindingId: String(binding['bindingId']) });
        }
        // — operation payload (closed lane extension of the frozen target) —
        if (!isRecord(target)) {
            return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', 'the gateway target is a record'), { operation: 'malformed-request' });
        }
        const targetExtras = extraKeys(target, TARGET_KEYS);
        if (targetExtras.length > 0) {
            return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', `the gateway target is closed; undeclared keys: ${targetExtras.join(', ')}`), { operation: 'malformed-request' });
        }
        const rawOperation = target['webOperation'];
        if (!isRecord(rawOperation) || typeof rawOperation['kind'] !== 'string') {
            return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', 'operation-payload-absent: the frozen GatewayCallRequest carries only a fingerprint; the lane refuses to GUESS the retrieval payload (types.ts DISCLOSURE)'), { operation: 'payload-absent' });
        }
        const kind = rawOperation['kind'];
        if (kind !== 'web.fetch' && kind !== 'web.search') {
            return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', `unknown web operation kind ${JSON.stringify(kind)}`), { operation: String(kind) });
        }
        const payloadKeys = kind === 'web.fetch' ? FETCH_PAYLOAD_KEYS : SEARCH_PAYLOAD_KEYS;
        const payloadExtras = extraKeys(rawOperation, payloadKeys);
        if (payloadExtras.length > 0) {
            return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', `the ${kind} payload is closed; undeclared keys: ${payloadExtras.join(', ')}`), { operation: kind });
        }
        // — I leg: the binding must BE the exact definition this operation runs —
        if (binding['toolName'] !== OPERATION_TOOL[kind]) {
            return done(webGatewayRefusal('TOOL_BINDING_UNVERIFIED', `binding toolName ${JSON.stringify(binding['toolName'])} is not the definition of operation ${kind}`), { operation: kind });
        }
        // — destination: derived, never supplied (a caller-claimed destination is
        //   only a cross-check: a target.destination that disagrees is refused) —
        let envelope;
        let delegate;
        if (kind === 'web.fetch') {
            const url = rawOperation['url'];
            if (typeof url !== 'string' || url.length === 0) {
                return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', 'web.fetch requires a non-empty url'), { operation: kind });
            }
            const derived = deriveDestination(url);
            if ('code' in derived) {
                return done(webGatewayRefusal('DOMAIN_DENIED', `${derived.code}: ${derived.detail}`), { operation: kind, refusal: derived.code });
            }
            envelope = derived;
            delegate = async () => {
                const res = await ports.fetch({ url });
                return fingerprintForFetch(envelope, res);
            };
        }
        else {
            const query = rawOperation['query'];
            if (typeof query !== 'string' || query.length === 0) {
                return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', 'web.search requires a non-empty query'), { operation: kind });
            }
            if (rawOperation['maxResults'] !== undefined && (typeof rawOperation['maxResults'] !== 'number' || !Number.isInteger(rawOperation['maxResults']) || rawOperation['maxResults'] < 1)) {
                return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', 'maxResults, when present, is a positive integer'), { operation: kind });
            }
            let origin;
            try {
                origin = await searchOrigin(); // REAL config only — see SearchOriginResolver
            }
            catch (err) {
                return done(seamFailure(err), { operation: kind, refusal: seamCodeOf(err) ?? 'search-origin-resolver-threw' });
            }
            const derived = deriveDestination(origin);
            if ('code' in derived) {
                return done(webGatewayRefusal('IO_POLICY_UNSUPPORTED', `search provider destination is not a usable origin (${derived.code}): ${derived.detail}`), { operation: kind, refusal: derived.code });
            }
            envelope = derived;
            const maxResults = rawOperation['maxResults'];
            delegate = async () => {
                const res = await ports.search({ query, ...(typeof maxResults === 'number' ? { maxResults } : {}) });
                return fingerprintForSearch(envelope, res);
            };
        }
        const operationLabel = `${kind}@${envelope.canonicalLocator}`;
        if (envelope.literalVeto !== null) {
            return done(webGatewayRefusal('DOMAIN_DENIED', `literal-address belt: ${envelope.literalVeto.code} — ${envelope.literalVeto.detail} (zero transport; the provider's post-DNS law stands regardless)`), { operation: operationLabel, refusal: envelope.literalVeto.code });
        }
        // the frozen locator law is the FROZEN parser's, not a copy:
        const destinationResource = Object.freeze({
            realmId: String(grant['realmId']),
            kind: 'network-destination',
            canonicalLocator: envelope.canonicalLocator,
            rights: Object.freeze(['connect']),
        });
        if (target['destination'] !== undefined && target['destination'] !== null) {
            const claimed = target['destination'];
            if (!isRecord(claimed) || claimed['canonicalLocator'] !== envelope.canonicalLocator || claimed['kind'] !== 'network-destination') {
                return done(webGatewayRefusal('DOMAIN_DENIED', `destination-claim-mismatch: a claimed target.destination must equal the derived destination (destinations are derived, never supplied)`), { operation: operationLabel, refusal: 'destination-claim-mismatch' });
            }
        }
        // — N arm: the grant must carry connect@this exact destination —
        const grantEffects = grant['effects'];
        const effectList = Array.isArray(grantEffects.effects) ? grantEffects.effects : [];
        const hasN = effectList.some((e) => isRecord(e) && e['kind'] === 'connect' && isRecord(e['resource'])
            && resourceEquals(e['resource'], destinationResource));
        if (!hasN) {
            return done(webGatewayRefusal('DOMAIN_DENIED', `destination-outside-grant: no connect@${envelope.canonicalLocator} arm exists in the admitted effect set`), { operation: operationLabel, refusal: 'destination-outside-grant' });
        }
        // — D arm: the Domain Authority answers at the effect-commit point, last
        //   before transport; Team approval can never rewrite it —
        let domainVeto = 'not-applicable';
        if (readDomainVeto !== undefined) {
            domainVeto = await readDomainVeto(target);
            if (domainVeto === 'denied') {
                return done(webGatewayRefusal('DOMAIN_DENIED', 'the Domain Authority denied this effect commit (Team approval cannot rewrite it)'), { operation: operationLabel, refusal: 'domain-denied' });
            }
        }
        // — delegate to the REAL provider (the seam resolves the configured
        //   provider at call time; we never select or imitate one) —
        try {
            const outcomeFingerprint = await delegate();
            return done({ ok: true, value: Object.freeze({ outcomeFingerprint, domainVeto }) }, { operation: operationLabel, outcome: 'ok' });
        }
        catch (err) {
            return done(seamFailure(err), { operation: operationLabel, refusal: seamCodeOf(err) ?? 'seam-error' });
        }
    }
    function fingerprintForFetch(envelope, res) {
        const finalOrigin = originOf(res.url);
        const finalOriginMismatch = finalOrigin !== envelope.canonicalLocator;
        return canonicalJsonFingerprint({
            operation: 'web.fetch',
            destination: envelope.canonicalLocator,
            statusCode: res.statusCode,
            truncated: res.truncated,
            finalOrigin,
            finalOriginMismatch,
        });
    }
    function fingerprintForSearch(envelope, res) {
        const sourceOrigins = [...new Set(res.sources.map((s) => originOf(s.url) ?? 'unparseable'))].sort();
        return canonicalJsonFingerprint({
            operation: 'web.search',
            destination: envelope.canonicalLocator,
            sourceOrigins,
            truncated: res.truncated,
        });
    }
    function seamFailure(err) {
        const code = seamCodeOf(err);
        const message = err instanceof Error ? err.message : String(err);
        if (code !== undefined && DESTINATION_SEAM_CODES.has(code)) {
            // pre-connect refusal by the provider's own policy/DNS law (fixture-
            // measured: p09 W9 `WEB_BLOCKED_URL`, server accessLog +0) — honest false
            return webGatewayRefusal('DOMAIN_DENIED', `provider refused the destination (${code})`, { details: Object.freeze({ seamCode: code }), sideEffectUnknown: false });
        }
        return webGatewayRefusal('IO_POLICY_UNSUPPORTED', `the web capability cannot run in this configuration (${code ?? 'unmapped seam error'}): ${message}`, {
            ...(code === undefined ? {} : { details: Object.freeze({ seamCode: code }) }),
            sideEffectUnknown: true,
        });
    }
    function seamCodeOf(err) {
        if (isRecord(err) && typeof err['code'] === 'string')
            return err['code'];
        return undefined;
    }
    function done(result, obs) {
        return { result, obs };
    }
    const call = async (request) => callWeb(request);
    return Object.freeze({ call, callWeb });
}
export { parseWebEnabledRaw, webGatewayRefusal } from './types.js';
export { deriveDestination, literalAddressVeto, originOf } from './destination-envelope.js';
//# sourceMappingURL=index.js.map