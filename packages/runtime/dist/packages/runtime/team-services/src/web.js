/**
 * Alpha.5 BL-18 (P2-05) — the confined `web` face: the network axis of a
 * governed Member, enforced BEFORE any provider call.
 *
 * WHY THIS FILE EXISTS. The native `web_fetch`/`web_search` face at the host pin
 * is upstream's `@deepseek-ai/dsh-tool-web`: it owns the schema, argument
 * validation and presentation, and every execution goes through `ctx.web`
 * (`packages/web/tool-web/src/index.ts`: `await ctx.web.fetch({ url }, signal)`).
 * The Member realm isolates `fs` and (BL-16/17) `subprocess`; it isolated no
 * `web`, so a governed Member's `web_fetch` resolved the INHERITED host `ctx.web`
 * — the real HTTP provider, the process-wide proxy dispatcher, ambient egress —
 * with zero guard facts and no consult of the compiled `network` axis. This
 * module is the missing service identity: a subclass of the host's OWN `web`
 * class, mounted on the Member's isolated scope, whose `fetch`/`search` consult
 * the compiled lane and then delegate to the composition-injected provider.
 *
 * NO SECOND PERMISSION COMPUTATION. The decision reads
 * `effective.network.access` — the field `compileEffectiveIo` already produced
 * as `ceiling ∩ tool restriction` (P1-02). There is no re-intersection here, no
 * second lane algebra, and no Member-supplied input: the effective policy is
 * the same object the `fs` face guards with, and the fact stream is the SAME
 * `observeGuard` transport (`a5sf-guard-consult/1`) the `fs`/`subprocess` faces
 * emit. The method names (`web:fetch`, `web:search`) are what the fact says was
 * consulted; they are not a second decision.
 *
 * THE CAPABILITY QUESTION IS BL-17'S, ANSWERED BY BL-17'S PROBE. A `network:
 * deny` lane is a claim about the OS/network boundary. This face therefore asks
 * the backend's OWN capability probe — the SAME `probeNetworkDenial` the
 * confined process face calls (imported, not copied) — and admits the call only
 * on an explicit `enforced` answer. Absence, a throw, a refusal or a missing row
 * all mean `unsupported`, and `unsupported` REFUSES: zero provider calls, zero
 * DNS lookups, zero connects, one typed fact. On this host no backend in either
 * lane reports `enforced`, so a `network: deny` web call is always refused
 * before the wire — the honest product state, not a documented limitation.
 *
 * REDIRECT / PROXY — WHAT THE REFUSAL COVERS, AND WHAT IT DOES NOT. The refusal
 * is POSITIONED before the provider is entered, so a deny lane has no request
 * that could be redirected and no dispatcher that could resolve a proxy: both
 * are downstream of the call this face never makes (measured by the arms as a
 * zero counter on a fake boundary that records fetch/proxy/connect attempts).
 * On an ALLOW lane this face does NOT mediate redirects or proxy selection —
 * the host fetch provider follows same-origin redirects under its own hop cap
 * and honours the process-wide proxy dispatcher. That limit is not hidden in
 * prose: it rides the ALLOW constituent as the typed residual annotations
 * {@link WEB_NETWORK_RESIDUALS} on the same fact, so a reader of the evidence
 * sees the admitted call's unmediated dimensions. Nothing here claims coverage
 * of a dimension it does not own.
 *
 * WHAT THIS IS NOT: not a network sandbox (it cannot make a socket fail), not a
 * provider (the composition injects one, exactly like the confined process
 * provider), not a second policy compiler, and not a claim that a governed
 * Member can fetch "safely" — an admitted call is ordinary host egress, and the
 * live half of the row is unproven (see `evidence/a5sf-web/README.md`).
 *
 * @module @dsh-agent-team/runtime/team-services/web
 */
import { observeGuard } from './guard-observability.js';
import { probeNetworkDenial } from './subprocess.js';
import { TeamIoDenial } from './types.js';
/**
 * The guard METHOD the confined web face consults for one admitted fetch. It is
 * a distinct method name so the fact says which call was decided; the decision
 * itself is the compiled lane's `network` axis, not a new evaluator.
 */
export const WEB_FETCH_GUARD_METHOD = 'web:fetch';
/** The same for the sibling network row on this face (a SECOND call path). */
export const WEB_SEARCH_GUARD_METHOD = 'web:search';
/**
 * The typed residual an ALLOW-constituent carries: dimensions this face does
 * NOT mediate once a call is admitted. They are annotation VALUES on the same
 * guard fact (the transport `observeGuard` already supports), which is why the
 * fact count never changes and no new evidence channel is invented.
 *
 * `WEB_REDIRECT_UNMEDIATED_ON_ALLOW` — the host fetch provider follows
 * same-origin redirects under its own hop cap; this face does not re-check the
 * chain. On a `network: deny` lane this is unreachable by construction: the
 * refusal happens before the provider, so no request exists to redirect.
 *
 * `WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW` — the host provider resolves its
 * dispatcher through the process-wide proxy policy (`proxyRouteFor`); this face
 * does not select or veto a proxy. On a `network: deny` lane this is likewise
 * unreachable: no provider call means no proxy lookup and no DNS.
 */
export const WEB_NETWORK_RESIDUALS = Object.freeze([
    'WEB_REDIRECT_UNMEDIATED_ON_ALLOW',
    'WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW',
]);
/**
 * Build the lane admission for one web face. It answers exactly one question
 * on the compiled policy — "does this lane claim `network: deny`?" — and, when
 * it does, asks the backend's own probe whether that claim can be kept. It is
 * the same shape as the confined process face's network leg (BL-17) and shares
 * its probe and its typed token.
 *
 * `allow` returns without touching the provider; `deny` NEVER reaches the
 * provider (the refusal is thrown before the delegate line in the class below).
 */
export function createWebNetworkGuard(effective, provider) {
    return async function webNetworkGuard(method, target) {
        // The permission: the ONE compiled lane. A non-`deny` axis is not a
        // network refusal (the face does not invent a second class of deny).
        if (effective.network.access !== 'deny')
            return;
        // The capability: BL-17's probe, imported. Only an explicit `enforced`
        // answer admits the call; everything else is the closed `unsupported`.
        const capability = await probeNetworkDenial(provider);
        if (capability.level === 'enforced')
            return;
        throw new TeamIoDenial('NETWORK_UNCONFINED_REALM', `the effective lane requests network=deny, but the web provider's capability probe reports `
            + `${capability.dimension}='${capability.level}' (${capability.note}); refusing before any provider call `
            + 'instead of fetching under a deny claim this host cannot enforce. A backend that proves '
            + "'enforced' is the only configuration that admits this call", { memberIdentity: effective.memberIdentity, method, target });
    };
}
/**
 * Create the confined `web` Provider class for one Member: the host's OWN class
 * is the service identity, and `fetch`/`search` are REPLACED by the confined
 * path (there is no unguarded fallback to inherit).
 *
 * The injected provider is the only thing this face ever calls for a fetch; it
 * is never `super.fetch`, so a provider registered on the confined instance's
 * inherited registry cannot silently take the call. That is stated in the
 * header: the composition declares its provider on the install spec, next to
 * the launcher/transport pin.
 */
export function createConfinedWebClass(Base, options) {
    const { effective, provider } = options;
    if (effective === undefined || effective === null) {
        throw new TypeError('createConfinedWebClass needs the compiled EffectiveIo policy');
    }
    if (provider === undefined || provider === null || typeof provider.fetch !== 'function') {
        throw new TypeError('createConfinedWebClass needs the composition-owned web provider');
    }
    const laneGuard = options.guard ?? createWebNetworkGuard(effective, provider);
    const guard = options.onGuardConsult === undefined
        ? laneGuard
        : observeGuard(laneGuard, options.onGuardConsult, {
            realm: options.realm ?? 'member',
            memberIdentity: effective.memberIdentity,
            toolBindingIdentity: options.toolBindingIdentity ?? null,
            policyRevision: effective.policyRevision,
        });
    class ConfinedWeb extends Base {
        /**
         * One fetch: consult the lane (one fact), then the ONE provider call.
         * A refusal throws a typed `TeamIoDenial` BEFORE the provider line — the
         * position is the guarantee, not the message.
         */
        async fetch(request, signal) {
            const url = declaredUrlOf(request, 'fetch');
            await guard(WEB_FETCH_GUARD_METHOD, url, WEB_NETWORK_RESIDUALS);
            return provider.fetch(request, signal);
        }
        /** The sibling network row — the SECOND call path on this face. */
        async search(request, signal) {
            if (typeof provider.search !== 'function') {
                // A face that cannot search must not invent a result: the SAME typed
                // vocabulary, a fact on the same transport, zero provider calls.
                throw new TeamIoDenial('IO_POLICY_UNSUPPORTED', 'this web face was installed with a provider that exposes no search; refusing instead of returning a fabricated result', { memberIdentity: effective.memberIdentity, method: WEB_SEARCH_GUARD_METHOD, target: declaredUrlOf(request, 'search') });
            }
            const target = declaredUrlOf(request, 'search');
            await guard(WEB_SEARCH_GUARD_METHOD, target, WEB_NETWORK_RESIDUALS);
            return provider.search(request, signal);
        }
    }
    return ConfinedWeb;
}
/**
 * The `locator` a web consultation is recorded under: the DECLARED URL, never
 * a header, a body or a resolved address. A malformed request records a stable
 * marker instead of throwing before the decision — the provider is the one that
 * rejects a bad request, and the fact must still say what was consulted.
 */
function declaredUrlOf(request, kind) {
    if (request !== null && typeof request === 'object') {
        const url = request.url;
        if (typeof url === 'string' && url !== '')
            return url;
        const queries = request.queries;
        if (Array.isArray(queries) && queries.length > 0 && typeof queries[0] === 'string') {
            return `queries:${String(queries.length)}`;
        }
    }
    return `<${kind}:malformed-request>`;
}
//# sourceMappingURL=web.js.map