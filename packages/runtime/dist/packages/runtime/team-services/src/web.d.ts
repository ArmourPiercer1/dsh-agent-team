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
 * PD-15 — THE PROOF IS BOUND TO THE FACE. An `enforced` row is evidence about
 * the face that MEASURED it. BL-42's mechanism is a per-child network namespace
 * created by the confined launcher; this transport runs IN-PROCESS and never
 * enters that namespace, so the subprocess lane's proof is not evidence about
 * this face. A deny call is therefore admitted only when the provider also
 * offers a `networkProof` whose `face` is `'web'`; a proof minted for another
 * face is refused with `NETWORK_PROOF_FACE_MISMATCH`, and an unnamed proof is
 * refused rather than defaulted. No proof shape makes this face OS-isolated —
 * a `web`-face proof can only ever be a SERVICE-LEVEL statement, and a future
 * transport that rides a confined child is the only path to an OS-level one.
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
import type { Context } from '@deepseek-ai/cordis';
import type { ProviderResult } from '../../sandbox-provider/index.js';
import { type NetworkEnforcementProof } from '../../sandbox-provider/index.js';
import type { EffectiveIoPolicy } from '../../member-io-policy/src/types.js';
import type { FsGuard } from './fs.js';
import { type GuardConsultObserver } from './guard-observability.js';
import { type ConfinedCapabilityRow } from './subprocess.js';
/**
 * The guard METHOD the confined web face consults for one admitted fetch. It is
 * a distinct method name so the fact says which call was decided; the decision
 * itself is the compiled lane's `network` axis, not a new evaluator.
 */
export declare const WEB_FETCH_GUARD_METHOD = "web:fetch";
/** The same for the sibling network row on this face (a SECOND call path). */
export declare const WEB_SEARCH_GUARD_METHOD = "web:search";
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
export declare const WEB_NETWORK_RESIDUALS: readonly ["WEB_REDIRECT_UNMEDIATED_ON_ALLOW", "WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW"];
/** One residual token (the closed set this face can emit). */
export type WebNetworkResidual = (typeof WEB_NETWORK_RESIDUALS)[number];
/**
 * The structural web Provider the confined face delegates to. It mirrors what
 * the host `ctx.web` seam exposes (`fetch`/`search`) and what the composition
 * owns: the ONE transport. The optional `probe` is the SAME capability probe
 * BL-17 added for the process lane; a provider without one answers
 * `unsupported`, never a default allow.
 */
export interface ConfinedWebProvider {
    fetch(request: unknown, signal?: AbortSignal): Promise<unknown>;
    search?(request: unknown, signal?: AbortSignal): Promise<unknown>;
    probe?: () => Promise<ProviderResult<readonly ConfinedCapabilityRow[]>>;
    /**
     * PD-15 — the face-bound proof this provider stands behind, or `null`/absent.
     *
     * A capability ROW is not enough for the web face: a row produced by the
     * confined process lane is evidence about a child in a network namespace, and
     * this transport runs in-process. The provider must therefore name BOTH the
     * mechanism and the face it was measured for; the guard admits only a proof
     * whose `face` is `'web'`. Lacking one, the call is refused — never admitted
     * on the strength of another face's measurement.
     */
    networkProof?: () => NetworkEnforcementProof | null | Promise<NetworkEnforcementProof | null>;
}
/** A Provider constructor Cordis can mount as the `web` service. */
export type WebProviderConstructor = new (ctx: Context, config?: Record<string, unknown>) => ConfinedWebProvider;
/** The confined `web` surface a realm reports in its `faces` answer. */
export interface ConfinedWebSurface {
    fetch(request: unknown, signal?: AbortSignal): Promise<unknown>;
    search(request: unknown, signal?: AbortSignal): Promise<unknown>;
}
/** What {@link createConfinedWebClass} needs. */
export interface ConfinedWebOptions {
    /** The compiled `EffectiveIo` (`ceiling ∩ restriction`) this face enforces. */
    readonly effective: EffectiveIoPolicy;
    /** The composition-owned web provider (the ONE transport). Never a Member input. */
    readonly provider: ConfinedWebProvider;
    /** The admission guard; defaults to {@link createWebNetworkGuard}. */
    readonly guard?: FsGuard;
    /** Optional fact observer — wrapped with `observeGuard` (one fact/consult). */
    readonly onGuardConsult?: GuardConsultObserver;
    /** The realm this face reports its facts on (defaults to the Member ceiling). */
    readonly realm?: 'member' | 'binding';
    /** The binding identity the effective policy was compiled for, if any. */
    readonly toolBindingIdentity?: string | null;
}
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
export declare function createWebNetworkGuard(effective: EffectiveIoPolicy, provider: ConfinedWebProvider): FsGuard;
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
export declare function createConfinedWebClass(Base: new (ctx: never, config?: never) => object, options: ConfinedWebOptions): WebProviderConstructor;
//# sourceMappingURL=web.d.ts.map