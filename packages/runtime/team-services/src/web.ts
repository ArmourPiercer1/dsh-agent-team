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

import type { Context } from '@deepseek-ai/cordis'
import type { ProviderResult } from '../../sandbox-provider/index.js'
import {
  evaluateNetworkRequirement,
  NETWORK_PROOF_FACE_MISMATCH,
  type NetworkEnforcementProof,
} from '../../sandbox-provider/index.js'
import type { EffectiveIoPolicy } from '../../member-io-policy/src/types.js'
import type { FsGuard } from './fs.js'
import { observeGuard, type GuardConsultObserver } from './guard-observability.js'
import { probeNetworkDenial, type ConfinedCapabilityRow } from './subprocess.js'
import { TeamIoDenial } from './types.js'

/**
 * The guard METHOD the confined web face consults for one admitted fetch. It is
 * a distinct method name so the fact says which call was decided; the decision
 * itself is the compiled lane's `network` axis, not a new evaluator.
 */
export const WEB_FETCH_GUARD_METHOD = 'web:fetch'

/** The same for the sibling network row on this face (a SECOND call path). */
export const WEB_SEARCH_GUARD_METHOD = 'web:search'

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
] as const)

/** One residual token (the closed set this face can emit). */
export type WebNetworkResidual = (typeof WEB_NETWORK_RESIDUALS)[number]

/**
 * PD-27 — the marker that says "this `web` service IS the Member's confined
 * face", set on the class `createConfinedWebClass` returns.
 *
 * WHY A MARKER IS NEEDED AT ALL. The confined face is a SUBCLASS of the host's
 * own `web` service, so it exposes exactly the same `fetch`/`search` as the
 * inherited base provider — duck typing cannot tell them apart, and getting
 * that wrong is precisely PD-18's hole (the tool runs on the base provider with
 * zero guard facts). A tool that has to answer "is this scope's `web` governed?"
 * asks this marker and nothing else.
 *
 * WHY A GLOBAL SYMBOL AND NOT AN EXPORT: the model-visible shadow
 * (`src/plugin/live/confined-web-tool.mjs`) is COPIED into the dist mirror, not
 * compiled with this file, so it cannot import this constant across the two
 * trees; both sides spell `Symbol.for('a5sf.confined.web.face')` and the
 * host-free parity test asserts the two agree.
 */
export const A5SF_CONFINED_WEB_MARK = Symbol.for('a5sf.confined.web.face')

/**
 * Whether `service` is a confined web face (PD-27). Only the marker counts;
 * `undefined`/`null` (no `web` service) and a plain provider are both `false`.
 *
 * @param service - the value of `ctx.web` on the scope being asked.
 * @returns true only for the realm-mounted confined face.
 */
export function isConfinedWebFace(service: unknown): boolean {
  if (service === null || service === undefined) return false
  if (typeof service !== 'object' && typeof service !== 'function') return false
  return (service as Record<symbol, unknown>)[A5SF_CONFINED_WEB_MARK] === true
}

/**
 * The structural web Provider the confined face delegates to. It mirrors what
 * the host `ctx.web` seam exposes (`fetch`/`search`) and what the composition
 * owns: the ONE transport. The optional `probe` is the SAME capability probe
 * BL-17 added for the process lane; a provider without one answers
 * `unsupported`, never a default allow.
 */
export interface ConfinedWebProvider {
  fetch(request: unknown, signal?: AbortSignal): Promise<unknown>
  search?(request: unknown, signal?: AbortSignal): Promise<unknown>
  probe?: () => Promise<ProviderResult<readonly ConfinedCapabilityRow[]>>
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
  networkProof?: () => NetworkEnforcementProof | null | Promise<NetworkEnforcementProof | null>
}

/** A Provider constructor Cordis can mount as the `web` service. */
export type WebProviderConstructor = new (ctx: Context, config?: Record<string, unknown>) => ConfinedWebProvider

/** The confined `web` surface a realm reports in its `faces` answer. */
export interface ConfinedWebSurface {
  fetch(request: unknown, signal?: AbortSignal): Promise<unknown>
  search(request: unknown, signal?: AbortSignal): Promise<unknown>
}

/** What {@link createConfinedWebClass} needs. */
export interface ConfinedWebOptions {
  /** The compiled `EffectiveIo` (`ceiling ∩ restriction`) this face enforces. */
  readonly effective: EffectiveIoPolicy
  /** The composition-owned web provider (the ONE transport). Never a Member input. */
  readonly provider: ConfinedWebProvider
  /** The admission guard; defaults to {@link createWebNetworkGuard}. */
  readonly guard?: FsGuard
  /** Optional fact observer — wrapped with `observeGuard` (one fact/consult). */
  readonly onGuardConsult?: GuardConsultObserver
  /** The realm this face reports its facts on (defaults to the Member ceiling). */
  readonly realm?: 'member' | 'binding'
  /** The binding identity the effective policy was compiled for, if any. */
  readonly toolBindingIdentity?: string | null
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
export function createWebNetworkGuard(
  effective: EffectiveIoPolicy,
  provider: ConfinedWebProvider,
): FsGuard {
  return async function webNetworkGuard(method: string, target: string): Promise<void> {
    // The permission: the ONE compiled lane. A non-`deny` axis is not a
    // network refusal (the face does not invent a second class of deny).
    if (effective.network.access !== 'deny') return
    // The capability: BL-17's probe, imported. Only an explicit `enforced`
    // answer proceeds; everything else is the closed `unsupported`.
    const capability = await probeNetworkDenial(provider)
    if (capability.level !== 'enforced') {
      throw new TeamIoDenial(
        'NETWORK_UNCONFINED_REALM',
        `the effective lane requests network=deny, but the web provider's capability probe reports `
          + `${capability.dimension}='${capability.level}' (${capability.note}); refusing before any provider call `
          + 'instead of fetching under a deny claim this host cannot enforce. A backend that proves '
          + "'enforced' is the only configuration that admits this call",
        { memberIdentity: effective.memberIdentity, method, target },
      )
    }
    // PD-15 — A LEVEL (OR A ROW) IS NOT A FACE-BOUND PROOF. The pre-fix guard
    // returned here, which is the hole #645 found: a composition that handed
    // the web face the SUBPROCESS lane's realm-bound `enforced` row admitted a
    // deny `web_fetch` into ordinary host egress, because the in-process web
    // transport cannot ride the launcher's per-child netns. Ask for a proof
    // that names its face and refuse anything minted for another one.
    const proof = await readNetworkProof(provider)
    const admission = evaluateNetworkRequirement('deny', effective.memberIdentity, proof, 'web')
    if (admission.ok) return
    const refusal = admission.error.details?.['refusal']
    if (refusal === NETWORK_PROOF_FACE_MISMATCH) {
      throw new TeamIoDenial(
        NETWORK_PROOF_FACE_MISMATCH,
        `the effective lane requests network=deny, but the web provider offered a network-enforcement proof minted for `
          + `a different face (${admission.error.message}); an in-process web transport cannot inherit the confined `
          + `launcher's network namespace, so another face's measurement is not evidence about this face — refusing `
          + 'before any provider call (PD-15)',
        { memberIdentity: effective.memberIdentity, method, target },
      )
    }
    throw new TeamIoDenial(
      'NETWORK_UNCONFINED_REALM',
      `the effective lane requests network=deny, and the web provider's probe reports 'enforced' (${capability.note}), `
        + `but it offered no face-bound proof for the 'web' face (${admission.error.message}); a capability level alone `
        + 'does not prove this face, so the call is refused before any provider call',
      { memberIdentity: effective.memberIdentity, method, target },
    )
  }
}

/**
 * Read the provider's optional face-bound proof. Absence, a throw or a
 * non-object answer are all the SAME closed answer (`null`): the guard then
 * refuses with `NETWORK_UNCONFINED_REALM` instead of inventing a proof. The
 * proof's own shape is validated by {@link evaluateNetworkRequirement}; nothing
 * here "fixes up" a malformed proof into an admissible one.
 */
async function readNetworkProof(provider: ConfinedWebProvider): Promise<NetworkEnforcementProof | null> {
  const read = provider.networkProof
  if (typeof read !== 'function') return null
  try {
    const proof = await read.call(provider)
    return proof !== null && typeof proof === 'object' ? proof : null
  } catch {
    return null
  }
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
export function createConfinedWebClass(
  Base: new (ctx: never, config?: never) => object,
  options: ConfinedWebOptions,
): WebProviderConstructor {
  const { effective, provider } = options
  if (effective === undefined || effective === null) {
    throw new TypeError('createConfinedWebClass needs the compiled EffectiveIo policy')
  }
  if (provider === undefined || provider === null || typeof provider.fetch !== 'function') {
    throw new TypeError('createConfinedWebClass needs the composition-owned web provider')
  }
  const laneGuard = options.guard ?? createWebNetworkGuard(effective, provider)
  const guard: FsGuard = options.onGuardConsult === undefined
    ? laneGuard
    : observeGuard(laneGuard, options.onGuardConsult, {
      realm: options.realm ?? 'member',
      memberIdentity: effective.memberIdentity,
      toolBindingIdentity: options.toolBindingIdentity ?? null,
      policyRevision: effective.policyRevision,
    })

  class ConfinedWeb extends (Base as new (ctx: never, config?: never) => object) {
    /**
     * One fetch: consult the lane (one fact), then the ONE provider call.
     * A refusal throws a typed `TeamIoDenial` BEFORE the provider line — the
     * position is the guarantee, not the message.
     */
    async fetch(request: unknown, signal?: AbortSignal): Promise<unknown> {
      const url = declaredUrlOf(request, 'fetch')
      await guard(WEB_FETCH_GUARD_METHOD, url, WEB_NETWORK_RESIDUALS)
      return provider.fetch(request, signal)
    }

    /** The sibling network row — the SECOND call path on this face. */
    async search(request: unknown, signal?: AbortSignal): Promise<unknown> {
      if (typeof provider.search !== 'function') {
        // A face that cannot search must not invent a result: the SAME typed
        // vocabulary, a fact on the same transport, zero provider calls.
        throw new TeamIoDenial(
          'IO_POLICY_UNSUPPORTED',
          'this web face was installed with a provider that exposes no search; refusing instead of returning a fabricated result',
          { memberIdentity: effective.memberIdentity, method: WEB_SEARCH_GUARD_METHOD, target: declaredUrlOf(request, 'search') },
        )
      }
      const target = declaredUrlOf(request, 'search')
      await guard(WEB_SEARCH_GUARD_METHOD, target, WEB_NETWORK_RESIDUALS)
      return provider.search(request, signal)
    }
  }
  // PD-27: the marker the model-visible shadow (`confined-web-tool.mjs`) asks to
  // decide whether THIS scope's `web` is governed. It is set on the prototype so
  // every mounted instance answers it without carrying per-instance state.
  Object.defineProperty(ConfinedWeb.prototype, A5SF_CONFINED_WEB_MARK, {
    configurable: true,
    value: true,
  })
  return ConfinedWeb as unknown as WebProviderConstructor
}

/**
 * The `locator` a web consultation is recorded under: the DECLARED URL (or the
 * declared query), never a header, a body or a resolved address. A malformed
 * request records a stable marker instead of throwing before the decision — the
 * provider is the one that rejects a bad request, and the fact must still say
 * what was consulted.
 *
 * PD-27: the SINGULAR `query` is read as well. The pinned host `web_search` tool
 * calls `ctx.web.search({ query, maxResults })` — one query per seam call — while
 * the tool's PUBLIC schema is the plural `queries`. PD-15 recorded the resulting
 * `<search:malformed-request>` locator as a product-side gap; reading both
 * spellings makes the fact name the query that was actually decided without
 * changing the seam's shape.
 */
function declaredUrlOf(request: unknown, kind: 'fetch' | 'search'): string {
  if (request !== null && typeof request === 'object') {
    const url = (request as { url?: unknown }).url
    if (typeof url === 'string' && url !== '') return url
    const query = (request as { query?: unknown }).query
    if (typeof query === 'string' && query !== '') return `query:${query}`
    const queries = (request as { queries?: unknown }).queries
    if (Array.isArray(queries) && queries.length > 0 && typeof queries[0] === 'string') {
      return `queries:${String(queries.length)}`
    }
  }
  return `<${kind}:malformed-request>`
}
